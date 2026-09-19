import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/server/actor";
import { resolvePackageAccess } from "@/server/packages/access";

/**
 * GET /api/packages/<item>/assets/<name>[?version=draft|<uuid>]
 * One picture of a package, as bytes, for the platform page to hand to the
 * sandboxed player as a Blob. Never a signed URL, never public.
 */
export async function GET(request: NextRequest, { params }: RouteContext<"/api/packages/[itemId]/assets/[name]">) {
  const { itemId, name } = await params;
  const { actor } = await getSession();
  const access = await resolvePackageAccess(actor, itemId, request.nextUrl.searchParams.get("version"));
  if (!access.ok) return NextResponse.json({ error: "not_found" }, { status: access.status });

  const asset = access.loaded.package.assets.get(`assets/${name}`);
  if (!asset) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return new NextResponse(new Uint8Array(asset.bytes), {
    status: 200,
    headers: {
      "Content-Type": asset.type,
      "Content-Length": String(asset.bytes.byteLength),
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
      "Cache-Control": "private, max-age=300",
    },
  });
}
