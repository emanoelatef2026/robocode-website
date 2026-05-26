import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime  = "nodejs";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id }   = await params;
    const formData = await request.formData();

    const update: Record<string, unknown> = {};

    const title       = (formData.get("title")       as string | null)?.trim();
    const ageRange    = (formData.get("age_range")   as string | null)?.trim();
    const description = (formData.get("description") as string | null)?.trim();
    const skillsRaw   = formData.get("skills")       as string | null;
    const techRaw     = formData.get("technologies") as string | null;
    const outcomesRaw = formData.get("outcomes")     as string | null;
    const sortRaw     = formData.get("sort_order")   as string | null;
    const activeRaw   = formData.get("active")       as string | null;
    const imageFile   = formData.get("image")        as File | null;

    if (title)       update.title       = title;
    if (ageRange)    update.age_range   = ageRange;
    if (description) update.description = description;
    if (skillsRaw)   update.skills       = JSON.parse(skillsRaw)       as string[];
    if (techRaw)     update.technologies = JSON.parse(techRaw)         as string[];
    if (outcomesRaw) update.outcomes     = JSON.parse(outcomesRaw)     as string[];
    if (sortRaw !== null) {
      const n = parseInt(sortRaw, 10);
      update.sort_order = isNaN(n) ? 0 : n;
    }
    if (activeRaw !== null) update.active = activeRaw !== "false";

    if (imageFile && imageFile.size > 0) {
      const bytes  = await imageFile.arrayBuffer();
      const buffer = Buffer.from(bytes);
      const path   = `${Date.now()}-${imageFile.name.replace(/\s+/g, "-")}`;

      const { error: uploadError } = await getSupabaseAdmin().storage
        .from("learning-journey")
        .upload(path, buffer, { contentType: imageFile.type, upsert: false });

      if (uploadError) throw uploadError;

      const { data: urlData } = getSupabaseAdmin().storage
        .from("learning-journey")
        .getPublicUrl(path);

      update.image_url = urlData.publicUrl;
    }

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
    }

    const { data, error } = await getSupabaseAdmin()
      .from("learning_journey_stages")
      .update(update)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json(data);
  } catch (err) {
    console.error("[admin/learning-journey PATCH]", err);
    return NextResponse.json({ error: "Failed to update stage" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const { data: stage } = await getSupabaseAdmin()
      .from("learning_journey_stages")
      .select("image_url")
      .eq("id", id)
      .single();

    const { error } = await getSupabaseAdmin()
      .from("learning_journey_stages")
      .delete()
      .eq("id", id);

    if (error) throw error;

    if (stage?.image_url) {
      try {
        const url  = new URL(stage.image_url);
        const path = url.pathname.split("/learning-journey/")[1];
        if (path) await getSupabaseAdmin().storage.from("learning-journey").remove([path]);
      } catch { /* best-effort */ }
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[admin/learning-journey DELETE]", err);
    return NextResponse.json({ error: "Failed to delete stage" }, { status: 500 });
  }
}
