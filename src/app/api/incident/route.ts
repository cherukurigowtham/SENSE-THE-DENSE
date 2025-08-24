import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(()=>null);
  if (!body || !body.fsq_id || !body.type) return NextResponse.json({ ok:false }, { status:400 });
  const { data, error } = await supabase.from("incidents").insert({
    fsq_id: body.fsq_id, type: body.type, note: body.note ?? null
  }).select("id").single();
  return NextResponse.json({ ok: !error, id: data?.id });
}
