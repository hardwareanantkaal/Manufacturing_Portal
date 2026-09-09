import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const productId = searchParams.get("productId");
  const mac = searchParams.get("mac")?.toUpperCase();
  const serialToCheck = searchParams.get("serial")?.trim();

  if (!productId) {
    return NextResponse.json({ error: "productId is required" }, { status: 400 });
  }

  // If checking a specific serial's availability
  if (serialToCheck) {
    const conflict = await prisma.device.findFirst({
      where: {
        productId,
        serial: serialToCheck,
        ...(mac ? { NOT: { mac } } : {}),
      },
    });

    return NextResponse.json({
      available: !conflict,
      serial: serialToCheck,
      conflict: conflict ? { mac: conflict.mac, serial: conflict.serial } : null,
    });
  }

  // Check if device with mac is already registered
  if (mac) {
    const existing = await prisma.device.findUnique({ where: { mac } });
    if (existing) {
      return NextResponse.json({
        serial: existing.serial,
        isExisting: true,
        claimToken: existing.claimToken,
      });
    }
  }

  // Otherwise, calculate proposed next serial (counter value + 1)
  const counter = await prisma.counter.findUnique({
    where: { name: `device_serial:${productId}` },
  });

  const nextVal = (counter?.value ?? 0) + 1;
  const proposedSerial = String(nextVal).padStart(6, "0");

  return NextResponse.json({
    serial: proposedSerial,
    isExisting: false,
  });
}
