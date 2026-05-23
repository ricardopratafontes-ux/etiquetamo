import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
// Usar service_role key para bypass de RLS (server-side only)
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function GET() {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // 1. Buscar todas as categorias
  const { data: allCats, error: listErr } = await supabase
    .from("categories")
    .select("id, name, organization_id")
    .order("name");

  if (listErr) {
    return NextResponse.json({ error: listErr.message, step: "list" }, { status: 500 });
  }

  // 2. Encontrar "Food Service" (case-insensitive)
  const foodServiceCats = (allCats || []).filter(
    (c: Record<string, string>) => c.name.toLowerCase().includes("food service")
  );

  if (foodServiceCats.length === 0) {
    return NextResponse.json({
      message: "Nenhuma categoria Food Service encontrada",
      all_categories: allCats?.map((c) => ({ id: c.id, name: c.name })),
    });
  }

  // 3. Renomear para "Baldes"
  const results = [];
  for (const cat of foodServiceCats) {
    const { data: updated, error: updateErr } = await supabase
      .from("categories")
      .update({ name: "Baldes" })
      .eq("id", cat.id)
      .select("id, name");

    results.push({
      id: cat.id,
      old_name: cat.name,
      new_name: "Baldes",
      rows_affected: updated?.length || 0,
      success: !updateErr && (updated?.length || 0) > 0,
      error: updateErr?.message || null,
      using_service_key: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    });
  }

  // 4. Verificar resultado
  const { data: afterCats } = await supabase
    .from("categories")
    .select("id, name")
    .order("name");

  return NextResponse.json({
    action: "rename_food_service_to_baldes",
    updates: results,
    categories_after: afterCats?.map((c) => ({ id: c.id, name: c.name })),
  });
}
