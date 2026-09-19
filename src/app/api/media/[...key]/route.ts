import { NextResponse, type NextRequest } from "next/server";
import { EXTENSION_BY_CONTENT_TYPE, isObjectKey } from "@/modules/storage/keys";
import { StorageError } from "@/modules/storage/provider";
import { getStorage } from "@/server/storage";

/** Areas of the public store that may be served to anyone by key (pictures only). */
const PUBLIC_AREAS = new Set(["avatars"]);

const CONTENT_TYPE_BY_EXTENSION = new Map(
  Object.entries(EXTENSION_BY_CONTENT_TYPE).map(([type, extension]) => [extension, type] as const),
);

/**
 * GET /api/media/<area>/<owner>/<file> — a public object as bytes, when the
 * public bucket has no domain of its own (decision R13, ADR 0008). Keys are
 * content-addressed (a fresh id per upload), so the response is immutable.
 */
export async function GET(_request: NextRequest, { params }: RouteContext<"/api/media/[...key]">) {
  const { key: parts } = await params;
  const key = parts.join("/");
  const [area, , file, ...rest] = parts;
  const extension = file?.split(".").pop() ?? "";
  const contentType = CONTENT_TYPE_BY_EXTENSION.get(extension);
  if (!isObjectKey(key) || !PUBLIC_AREAS.has(area) || !file || rest.length > 0 || !contentType?.startsWith("image/")) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  let bytes: Uint8Array;
  try {
    const storage = await getStorage();
    bytes = await storage.download({ store: "public", key });
  } catch (error) {
    const status = error instanceof StorageError && error.code === "not_found" ? 404 : 503;
    return NextResponse.json({ error: status === 404 ? "not_found" : "unavailable" }, { status });
  }
  return new NextResponse(new Uint8Array(bytes), {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Content-Length": String(bytes.byteLength),
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
