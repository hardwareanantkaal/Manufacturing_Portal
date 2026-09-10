import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkPendingOta } from "@/lib/ota-check";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ productKey: string }> }
) {
  const { productKey } = await params;
  const url = new URL(request.url);
  const mac = url.searchParams.get("mac");
  const version = url.searchParams.get("version");

  const product = await prisma.product.findUnique({ where: { productKey } });
  if (!product) {
    return NextResponse.json({ error: "Unknown product" }, { status: 404 });
  }

  const apiKey = request.headers.get("x-api-key");
  if (apiKey !== product.apiKey) {
    return NextResponse.json({ error: "Invalid API key" }, { status: 401 });
  }

  if (!mac) {
    return NextResponse.json({ error: "mac is required" }, { status: 400 });
  }

  const device = await prisma.device.findUnique({ where: { mac: mac.toUpperCase() } });
  if (!device || device.productId !== product.id) {
    return NextResponse.json({ error: "Unknown device for this product" }, { status: 404 });
  }

  await prisma.device.update({
    where: { id: device.id },
    data: {
      lastSeenAt: new Date(),
      ...(version ? { fwVersion: version } : {}),
    },
  });

  const ota = await checkPendingOta(device.id, url.origin);
  if (!ota) {
    return new Response(null, { status: 204 });
  }
  return NextResponse.json(ota);
}
