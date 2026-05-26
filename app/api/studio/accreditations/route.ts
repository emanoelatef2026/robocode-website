import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    const { data, error } = await getSupabaseAdmin()
      .from("accreditations")
      .select("*")
      .order("sort_order", { ascending: true });
    if (error) throw error;
    return NextResponse.json(data ?? []);
  } catch (err) {
    console.error("[admin/accreditations GET]", err);
    return NextResponse.json({ error: "Failed to fetch" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const fd          = await request.formData();
    const logoFile    = fd.get("logo") as File | null;
    const name        = (fd.get("name") as string)?.trim();
    const sortOrder   = parseInt((fd.get("sort_order") as string) ?? "0", 10);
    const active      = fd.get("active") !== "false";
    const website_url = (fd.get("website_url") as string)?.trim() || null;

    if (!name)                          return NextResponse.json({ error: "Name required" },  { status: 400 });
    if (!logoFile || logoFile.size === 0) return NextResponse.json({ error: "Logo required" }, { status: 400 });

    const buffer = Buffer.from(await logoFile.arrayBuffer());
    const path   = `${Date.now()}-${logoFile.name.replace(/\s+/g, "-")}`;

    const { error: uploadErr } = await getSupabaseAdmin().storage
      .from("accreditations")
      .upload(path, buffer, { contentType: logoFile.type, upsert: false });
    if (uploadErr) throw uploadErr;

    const { data: urlData } = getSupabaseAdmin().storage.from("accreditations").getPublicUrl(path);

    const { data, error } = await getSupabaseAdmin()
      .from("accreditations")
      .insert({ name, logo_url: urlData.publicUrl, active, sort_order: isNaN(sortOrder) ? 0 : sortOrder, website_url })
      .select().single();
    if (error) throw error;

    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    console.error("[admin/accreditations POST]", err);
    return NextResponse.json({ error: "Failed to create" }, { status: 500 });
  }
}
