import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { stat, open } from "fs/promises";
import { Readable } from "stream";
import path from "path";

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

  const filePath = path.join(process.cwd(), "public", firmware.binUrl);
  const stats = await stat(filePath).catch(() => null);
  if (!stats) {
    return NextResponse.json({ error: "Firmware file missing on disk" }, { status: 404 });
  }

  const range = request.headers.get("range");
  const commonHeaders = {
    "Content-Type": "application/octet-stream",
    "Accept-Ranges": "bytes",
  };

  if (!range) {
    const handle = await open(filePath, "r");
    const nodeStream = handle.createReadStream();
    nodeStream.on("close", () => handle.close().catch(() => {}));
    return new Response(Readable.toWeb(nodeStream) as ReadableStream, {
      status: 200,
      headers: { ...commonHeaders, "Content-Length": String(stats.size) },
    });
  }

  // "bytes=<start>-<end>" — end is optional (means "to EOF")
  const match = /^bytes=(\d*)-(\d*)$/.exec(range);
  if (!match) {
    return new Response(null, {
      status: 416,
      headers: { "Content-Range": `bytes */${stats.size}` },
    });
  }

  const start = match[1] ? parseInt(match[1], 10) : 0;
  const end = match[2] ? parseInt(match[2], 10) : stats.size - 1;

  if (Number.isNaN(start) || Number.isNaN(end) || start > end || end >= stats.size) {
    return new Response(null, {
      status: 416,
      headers: { "Content-Range": `bytes */${stats.size}` },
    });
  }

  const chunkSize = end - start + 1;
  const handle = await open(filePath, "r");
  const nodeStream = handle.createReadStream({ start, end });
  nodeStream.on("close", () => handle.close().catch(() => {}));

  return new Response(Readable.toWeb(nodeStream) as ReadableStream, {
    status: 206,
    headers: {
      ...commonHeaders,
      "Content-Length": String(chunkSize),
      "Content-Range": `bytes ${start}-${end}/${stats.size}`,
    },
  });
}
