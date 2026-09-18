import { NextResponse, type NextRequest } from "next/server";
import { isSupabaseConfigured } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const MAX_QUERY_LENGTH = 60;

/**
 * Language typeahead over the ISO 639-3 table (public reference data).
 * GET /api/languages?q=kab -> { items: [{ code, iso639_1, name_en, direction }] }
 */
export async function GET(request: NextRequest) {
  const q = (request.nextUrl.searchParams.get("q") ?? "").trim().slice(0, MAX_QUERY_LENGTH);
  if (q.length < 2 || !isSupabaseConfigured()) return NextResponse.json({ items: [] });

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("search_languages", { q, max_results: 12 });
  if (error) return NextResponse.json({ items: [] }, { status: 500 });

  return NextResponse.json(
    {
      items: data.map((l) => ({
        code: l.code,
        iso639_1: l.iso639_1 ?? null,
        name_en: l.name_en,
        direction: l.direction,
      })),
    },
    { headers: { "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400" } },
  );
}
