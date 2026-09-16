import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { get, type GetBlobResult } from "@vercel/blob";

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
  console.log(`[firmware-download] firmwareId=${firmwareId} range=${JSON.stringify(range)}`);

  let result: GetBlobResult | null = null;

  if (range) {
    // Try the range as given. Anything that goes wrong here — malformed
    // syntax, an out-of-bounds range, Blob storage rejecting it outright —
    // surfaces as a thrown error rather than a result we can inspect. A
    // device that gets a 416 back has no way to recover from it, so on any
    // failure here we deliberately fall through to a full download instead
    // of ever returning 416 to the device.
    try {
      result = await get(firmware.binUrl, { access: "private", headers: { Range: range } });
    } catch (err) {
      console.log(
        `[firmware-download] range request failed, falling back to full download: ${err instanceof Error ? err.message : String(err)}`
      );
      result = null;
    }
  }

  if (!result) {
    result = await get(firmware.binUrl, { access: "private" }).catch(() => null);
  }

  if (!result || result.statusCode !== 200) {
    return NextResponse.json({ error: "Firmware file missing" }, { status: 404 });
  }

  // Derive our own response status from the raw upstream headers rather
  // than trusting a single fixed status — a Range request still comes back
  // as result.statusCode 200 in this SDK's type, but the underlying fetch
  // response is a real 206 with a Content-Range header when Blob storage
  // actually honored the range. If we fell back to a full download above,
  // there's no Content-Range and this correctly reports 200 instead.
  const contentRange = result.headers.get("content-range");

  // Buffered, not streamed: piping result.stream straight into the Response
  // made Vercel serve it with chunked transfer-encoding and no
  // Content-Length at all — the ESP8266's esp_http_client needs the total
  // size up front to call Update.begin(), so a chunked response is a dead
  // end for it, not just a missing header. Firmware images are well under
  // 1MB, comfortably inside the serverless memory limit, so buffering the
  // whole thing is the simpler and correct trade here.
  const buffer = await new Response(result.stream).arrayBuffer();

  return new Response(buffer, {
    status: contentRange ? 206 : 200,
    headers: {
      "Content-Type": "application/octet-stream",
      "Accept-Ranges": "bytes",
      "Content-Length": String(buffer.byteLength),
      ...(contentRange ? { "Content-Range": contentRange } : {}),
    },
  });
}
