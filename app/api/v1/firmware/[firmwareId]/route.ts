import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { get } from "@vercel/blob";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ firmwareId: string }> }
) {
  const { firmwareId } = await params;

  const firmware = await prisma.firmware.findUnique({
    where: { id: firmwareId },
    include: { product: true },
  });
  if (!firmware) {
    return NextResponse.json({ error: "Unknown firmware" }, { status: 404 });
  }

  const apiKey = request.headers.get("x-api-key");
  if (apiKey !== firmware.product.apiKey) {
    return NextResponse.json({ error: "Invalid API key" }, { status: 401 });
  }

  const range = request.headers.get("range");

  let result;
  try {
    result = await get(firmware.binUrl, {
      access: "private",
      // Forwarded straight through to Blob storage, which handles the
      // actual byte-range math — we don't parse/validate it ourselves.
      ...(range ? { headers: { Range: range } } : {}),
    });
  } catch {
    // The SDK's result type only models 200/304 — an invalid/out-of-bounds
    // Range (416) or any other unexpected upstream status surfaces as a
    // thrown error instead of a result we can inspect.
    return new Response(null, { status: 416 });
  }

  if (!result || result.statusCode !== 200) {
    return NextResponse.json({ error: "Firmware file missing" }, { status: 404 });
  }

  // Derive our own response status from the raw upstream headers rather
  // than trusting a single fixed status — a Range request still comes
  // back as result.statusCode 200 in this SDK's type, but the underlying
  // fetch response is a real 206 with a Content-Range header when Blob
  // storage actually honored the range.
  const contentRange = result.headers.get("content-range");

  return new Response(result.stream, {
    status: contentRange ? 206 : 200,
    headers: {
      "Content-Type": "application/octet-stream",
      "Accept-Ranges": "bytes",
      "Content-Length": result.headers.get("content-length") ?? String(result.blob.size),
      ...(contentRange ? { "Content-Range": contentRange } : {}),
    },
  });
}
