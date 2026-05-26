import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// ── GET — settings + all tabs + setup status ──────────────────────────────────

export async function GET() {
  try {
    const db = getSupabaseAdmin();

    // maybeSingle() returns { data: null, error: null } for empty table —
    // unlike single() which fires PGRST116 on zero rows.
    const [settingsRes, tabsRes, bucketRes] = await Promise.all([
      db.from("why_robocode_settings").select("*").limit(1).maybeSingle(),
      db.from("why_robocode_tabs").select("*").order("sort_order", { ascending: true }),
      db.storage.getBucket("why-robocode"),
    ]);

    const tablesOk = !settingsRes.error && !tabsRes.error;
    const bucketOk = !bucketRes.error;

    if (!tablesOk || !bucketOk) {
      return NextResponse.json({
        settings:    null,
        tabs:        [],
        setupNeeded: { tables: !tablesOk, bucket: !bucketOk },
      });
    }

    return NextResponse.json({
      settings:    settingsRes.data ?? null,
      tabs:        tabsRes.data    ?? [],
      setupNeeded: false,
    });
  } catch (err) {
    console.error("[studio/why-robocode GET]", err);
    return NextResponse.json({ error: "Failed to fetch" }, { status: 500 });
  }
}

// ── PATCH — upsert settings row ───────────────────────────────────────────────

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json() as Record<string, unknown>;
    const allowed = ["section_title", "section_subtitle"];
    const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
    for (const k of allowed) {
      if (k in body) update[k] = body[k];
    }

    const db = getSupabaseAdmin();
    const { data: existing } = await db
      .from("why_robocode_settings")
      .select("id")
      .limit(1)
      .single();

    let result;
    if (existing?.id) {
      result = await db
        .from("why_robocode_settings")
        .update(update)
        .eq("id", existing.id)
        .select()
        .single();
    } else {
      result = await db
        .from("why_robocode_settings")
        .insert(update)
        .select()
        .single();
    }

    if (result.error) throw result.error;
    return NextResponse.json(result.data);
  } catch (err) {
    console.error("[studio/why-robocode PATCH]", err);
    return NextResponse.json({ error: "Failed to update settings" }, { status: 500 });
  }
}

// ── POST — create new tab with image upload ───────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const fd        = await request.formData();
    const imageFile = fd.get("image") as File | null;
    const tab_name  = (fd.get("tab_name") as string)?.trim();
    const sortOrder = parseInt((fd.get("sort_order") as string) ?? "0", 10);

    if (!tab_name)                            return NextResponse.json({ error: "Tab name required" },  { status: 400 });
    if (!imageFile || imageFile.size === 0)   return NextResponse.json({ error: "Image required" }, { status: 400 });

    const buffer = Buffer.from(await imageFile.arrayBuffer());
    const path   = `${Date.now()}-${imageFile.name.replace(/\s+/g, "-")}`;

    const { error: uploadErr } = await getSupabaseAdmin().storage
      .from("why-robocode")
      .upload(path, buffer, { contentType: imageFile.type, upsert: false });
    if (uploadErr) throw uploadErr;

    const { data: urlData } = getSupabaseAdmin().storage.from("why-robocode").getPublicUrl(path);

    const { data, error } = await getSupabaseAdmin()
      .from("why_robocode_tabs")
      .insert({
        tab_name,
        image_url:  urlData.publicUrl,
        sort_order: isNaN(sortOrder) ? 0 : sortOrder,
        is_active:  true,
      })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    console.error("[studio/why-robocode POST]", err);
    return NextResponse.json({ error: "Failed to create tab" }, { status: 500 });
  }
}
