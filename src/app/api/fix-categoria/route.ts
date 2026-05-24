import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function GET() {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const { data: updated, error } = await supabase
    .from("categories")
    .update({ name: "BALDES" })
    .eq("id", "c71c3dfd-0b87-4979-835f-e17903e2d5e0")
    .select("id, name");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    action: "rename_to_BALDES",
    rows_affected: updated?.length || 0,
    result: updated,
  });
}
