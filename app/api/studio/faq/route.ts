import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    const { data, error } = await getSupabaseAdmin()
      .from("faq_items")
      .select("*")
      .order("sort_order", { ascending: true });
    if (error) throw error;
    return NextResponse.json(data ?? []);
  } catch (err) {
    console.error("[admin/faq GET]", err);
    return NextResponse.json({ error: "Failed to fetch" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as {
      question: string;
      answer:   string;
      category: string;
      sort_order?: number;
      active?: boolean;
    };

    const { question, answer, category } = body;
    if (!question) return NextResponse.json({ error: "Question required" }, { status: 400 });
    if (!answer)   return NextResponse.json({ error: "Answer required" },   { status: 400 });
    if (!category) return NextResponse.json({ error: "Category required" }, { status: 400 });

    const { data, error } = await getSupabaseAdmin()
      .from("faq_items")
      .insert({
        question,
        answer,
        category,
        sort_order: body.sort_order ?? 0,
        active:     body.active    ?? true,
      })
      .select().single();
    if (error) throw error;

    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    console.error("[admin/faq POST]", err);
    return NextResponse.json({ error: "Failed to create" }, { status: 500 });
  }
}
