import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { nextSerial } from "@/lib/serial";
import { generateClaimToken } from "@/lib/claim-token";

const MAC_REGEX = /^[0-9A-Fa-f]{12}$/;

function deviceResponse(device: { serial: string; id: string; claimToken: string | null }) {
  return NextResponse.json({
    serial: device.serial,
    deviceId: device.id,
    claimToken: device.claimToken,
  });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { mac, productId, serial: requestedSerial, imei, iccid, firmwareVersion } = body as {
    mac?: string;
    productId?: string;
    serial?: string;
    imei?: string;
    iccid?: string;
    firmwareVersion?: string;
  };

  if (!mac || !MAC_REGEX.test(mac)) {
    return NextResponse.json(
      { error: "mac must be 12 hex characters, e.g. AABBCCDDEEFF" },
      { status: 400 }
    );
  }
  if (!productId) {
    return NextResponse.json({ error: "productId is required" }, { status: 400 });
  }

  const normalizedMac = mac.toUpperCase();

  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) {
    return NextResponse.json(
      { error: "productId does not match an existing product" },
      { status: 400 }
    );
  }

  // Validate serial uniqueness per product if custom serial is provided
  if (requestedSerial && requestedSerial.trim() !== "") {
    const trimmedSerial = requestedSerial.trim();
    const conflict = await prisma.device.findFirst({
      where: {
        productId,
        serial: trimmedSerial,
        NOT: { mac: normalizedMac },
      },
    });

    if (conflict) {
      return NextResponse.json(
        { error: `Serial number '${trimmedSerial}' is already in use for this product.` },
        { status: 400 }
      );
    }
  }

  const existing = await prisma.device.findUnique({ where: { mac: normalizedMac } });

  if (existing) {
    // A MAC is globally unique — re-registering it under a DIFFERENT
    // product is never a legitimate re-flash, it's a mistake (wrong
    // product selected, or a chip's MAC colliding with another device's
    // record) and must be rejected rather than silently moving the device.
    // Re-registering under the SAME product (re-flashing the same board)
    // is the normal, expected case and still just updates fields.
    if (existing.productId !== productId) {
      return NextResponse.json(
        {
          error: `MAC ${normalizedMac} is already registered under a different product (serial '${existing.serial}'). A device's MAC can't be reassigned to another product.`,
        },
        { status: 409 }
      );
    }

    const finalSerial = requestedSerial?.trim() || existing.serial;
    const updated = await prisma.device.update({
      where: { mac: normalizedMac },
      data: {
        serial: finalSerial,
        ...(imei !== undefined ? { imei: imei || null } : {}),
        ...(iccid !== undefined ? { iccid: iccid || null } : {}),
        ...(firmwareVersion !== undefined ? { fwVersion: firmwareVersion || null } : {}),
      },
    });
    return deviceResponse(updated);
  }

  const serial = requestedSerial?.trim() || (await nextSerial(productId));
  const claimToken = generateClaimToken();

  try {
    const device = await prisma.device.create({
      data: {
        serial,
        mac: normalizedMac,
        claimToken,
        productId,
        imei: imei || null,
        iccid: iccid || null,
        fwVersion: firmwareVersion || null,
      },
    });
    return deviceResponse(device);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      if (err.meta?.target && Array.isArray(err.meta.target) && err.meta.target.includes("serial")) {
        return NextResponse.json(
          { error: `Serial number '${serial}' is already in use for this product.` },
          { status: 400 }
        );
      }
      const device = await prisma.device.findUniqueOrThrow({ where: { mac: normalizedMac } });
      return deviceResponse(device);
    }
    throw err;
  }
}
