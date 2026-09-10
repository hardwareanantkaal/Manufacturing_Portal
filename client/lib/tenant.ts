// Every query in this app must be scoped to the logged-in client's own
// data, or one client will see another client's devices, products, or
// firmware. Pages must go through the helpers below rather than calling
// prisma.device.findMany() etc. directly, so tenant scoping can never be
// accidentally left out of a new page. A tenant leak here throws no
// error — it silently returns the wrong rows — so treat every new query
// added to this app as a candidate for a helper here, not a one-off.

import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";

export type RequireClientResult = {
  clientId: string;
  userId: string;
  role: string;
};

export async function requireClient(): Promise<RequireClientResult> {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }
  return { clientId: session.clientId, userId: session.userId, role: session.role };
}

export async function getProducts(clientId: string) {
  return prisma.product.findMany({
    where: { clientId },
    orderBy: { name: "asc" },
  });
}

export async function getProductsWithFirmware(clientId: string) {
  return prisma.product.findMany({
    where: { clientId },
    orderBy: { name: "asc" },
    include: { firmwares: { orderBy: { createdAt: "desc" } } },
  });
}

// A job's firmware always belongs to one product, which always belongs to
// one client (schema-enforced), so an OtaJob can never span clients — a
// direct filter on firmware.product.clientId is always correct here.
export async function getOtaJobsForClient(clientId: string) {
  return prisma.otaJob.findMany({
    where: { firmware: { product: { clientId } } },
    orderBy: { createdAt: "desc" },
    include: {
      firmware: { include: { product: true } },
      targets: { select: { status: true } },
    },
  });
}

export async function getDevices(
  clientId: string,
  filters?: { productId?: string; state?: string; search?: string }
) {
  return prisma.device.findMany({
    where: {
      product: { clientId },
      ...(filters?.productId ? { productId: filters.productId } : {}),
      ...(filters?.state ? { state: filters.state } : {}),
      ...(filters?.search
        ? {
            OR: [
              { serial: { contains: filters.search, mode: "insensitive" as const } },
              { mac: { contains: filters.search, mode: "insensitive" as const } },
            ],
          }
        : {}),
    },
    include: { product: true },
    orderBy: { flashedAt: "desc" },
  });
}

// Returns null if the device doesn't exist OR belongs to a different
// client — the caller must treat both cases identically (call notFound())
// rather than distinguishing them, so a client can't use the difference
// to probe for the existence of another client's device.
export async function getDeviceByMac(clientId: string, mac: string) {
  const device = await prisma.device.findUnique({
    where: { mac },
    include: {
      product: true,
      otaTargets: {
        orderBy: { updatedAt: "desc" },
        include: { job: { include: { firmware: true } } },
      },
    },
  });
  if (!device || device.product.clientId !== clientId) return null;
  return device;
}

export async function getFirmware(clientId: string) {
  return prisma.firmware.findMany({
    where: { product: { clientId } },
    include: { product: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function getDashboardStats(clientId: string) {
  const [totalDevices, onlineDevices, productCount, devices] = await Promise.all([
    prisma.device.count({ where: { product: { clientId } } }),
    prisma.device.count({ where: { product: { clientId }, state: "active" } }),
    prisma.product.count({ where: { clientId } }),
    prisma.device.findMany({
      where: { product: { clientId } },
      select: { fwVersion: true, productId: true },
    }),
  ]);

  // "needs update" = the device's fwVersion doesn't match the latest
  // firmware uploaded for its product (a device that has never reported a
  // version counts as needing one too).
  const productIds = [...new Set(devices.map((d) => d.productId))];
  const latestFirmwarePerProduct = await prisma.firmware.findMany({
    where: { productId: { in: productIds } },
    orderBy: { createdAt: "desc" },
    distinct: ["productId"],
    select: { productId: true, version: true },
  });
  const latestVersionByProduct = new Map(
    latestFirmwarePerProduct.map((f) => [f.productId, f.version])
  );
  const needsUpdateCount = devices.filter((d) => {
    const latest = latestVersionByProduct.get(d.productId);
    return latest !== undefined && d.fwVersion !== latest;
  }).length;

  return { totalDevices, onlineDevices, productCount, needsUpdateCount };
}

export async function getRecentOtaActivity(clientId: string, take = 10) {
  return prisma.otaTarget.findMany({
    where: { device: { product: { clientId } } },
    orderBy: { updatedAt: "desc" },
    take,
    include: {
      device: true,
      job: { include: { firmware: { include: { product: true } } } },
    },
  });
}

// Read-only check, used to decide what the claim confirmation page shows.
// The actual claim (below) re-verifies everything atomically at write time
// rather than trusting this — state can change between page load and the
// user clicking Confirm.
export async function checkClaimEligibility(clientId: string, mac: string, token: string) {
  const device = await prisma.device.findUnique({
    where: { mac },
    include: { product: true },
  });
  if (!device) return { ok: false as const, reason: "not_found" as const };
  if (device.claimToken !== token) return { ok: false as const, reason: "wrong_token" as const };
  if (device.claimedAt) return { ok: false as const, reason: "already_claimed" as const };
  if (device.product.clientId !== clientId) {
    return { ok: false as const, reason: "wrong_client" as const };
  }
  return { ok: true as const, device };
}

// Single atomic conditional update: only succeeds if mac + token +
// unclaimed + belongs-to-this-client ALL still hold at the moment of the
// write. Returns false (rather than throwing) if any condition no longer
// matches, so a double-submit or a second tab can't double-claim or race
// past the checks above.
export async function claimDevice(clientId: string, mac: string, token: string): Promise<boolean> {
  const result = await prisma.device.updateMany({
    where: {
      mac,
      claimToken: token,
      claimedAt: null,
      product: { clientId },
    },
    data: { claimedAt: new Date(), claimToken: null, state: "active" },
  });
  return result.count === 1;
}

// role gate is checked first and server-side here — the page also hides
// the trigger button from viewers, but that alone is not enforcement, only
// a convenience. Device ids come from the client's own form submission and
// are never trusted: every one is re-checked against both this client and
// the firmware's product before anything is created.
export async function createClientOtaJob(
  clientId: string,
  role: string,
  params: { firmwareId: string; deviceIds: string[] }
): Promise<{ error: string | null }> {
  if (role !== "admin") {
    return { error: "Only account admins can trigger OTA updates." };
  }
  if (!params.firmwareId) return { error: "Select a firmware version." };
  if (params.deviceIds.length === 0) return { error: "Select at least one device." };

  const firmware = await prisma.firmware.findUnique({
    where: { id: params.firmwareId },
    include: { product: true },
  });
  if (!firmware || firmware.product.clientId !== clientId) {
    return { error: "Firmware not found." };
  }

  const eligibleDeviceCount = await prisma.device.count({
    where: {
      id: { in: params.deviceIds },
      productId: firmware.productId,
      product: { clientId },
    },
  });
  if (eligibleDeviceCount !== params.deviceIds.length) {
    return { error: "One or more selected devices are not eligible for this firmware." };
  }

  await prisma.$transaction(async (tx) => {
    const job = await tx.otaJob.create({
      data: { firmwareId: params.firmwareId, triggeredByClientId: clientId },
    });
    await tx.otaTarget.createMany({
      data: params.deviceIds.map((deviceId) => ({ jobId: job.id, deviceId })),
    });
  });

  return { error: null };
}
