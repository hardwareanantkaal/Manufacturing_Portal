import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { get } from "@vercel/blob";

// Admin-facing download — no x-api-key check here, unlike the device-facing
// /api/v1/firmware/[firmwareId] route. This path isn't under /api, so
// proxy.ts's matcher already requires a valid admin session to reach it at
// all; that's the only gate this needs.
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const firmware = await prisma.firmware.findUnique({ where: { id } });
  if (!firmware) {
    return NextResponse.json({ error: "Unknown firmware" }, { status: 404 });
  }

  const result = await get(firmware.binUrl, { access: "private" }).catch(() => null);
  if (!result || result.statusCode !== 200) {
    return NextResponse.json({ error: "Firmware file missing" }, { status: 404 });
  }

  return new Response(result.stream, {
    status: 200,
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Length": String(result.blob.size),
      "Content-Disposition": `attachment; filename="${firmware.version}.bin"`,
    },
  });
}
