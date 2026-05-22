import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function GET() {
  const supabase = createClient(supabaseUrl, supabaseKey);

  // 1. Buscar todas as categorias para diagnóstico
  const { data: allCats, error: listErr } = await supabase
    .from("categories")
    .select("id, name, slug, organization_id")
    .order("name");

  if (listErr) {
    return NextResponse.json({ error: listErr.message, step: "list" }, { status: 500 });
  }

  // 2. Encontrar "Food Service" (case-insensitive search)
  const foodServiceCats = (allCats || []).filter(
    (c: Record<string, string>) => c.name.toLowerCase().includes("food service")
  );

  if (foodServiceCats.length === 0) {
    return NextResponse.json({
      message: "Nenhuma categoria 'Food Service' encontrada",
      all_categories: allCats?.map((c) => ({ id: c.id, name: c.name, slug: c.slug })),
    });
  }

  // 3. Renomear cada uma para "Baldes"
  const results = [];
  for (const cat of foodServiceCats) {
    const { error: updateErr } = await supabase
      .from("categories")
      .update({ name: "Baldes", slug: "baldes" })
      .eq("id", cat.id);

    results.push({
      id: cat.id,
      old_name: cat.name,
      new_name: "Baldes",
      success: !updateErr,
      error: updateErr?.message || null,
    });
  }

  // 4. Verificar resultado
  const { data: afterCats } = await supabase
    .from("categories")
    .select("id, name, slug")
    .order("name");

  return NextResponse.json({
    action: "rename_food_service_to_baldes",
    updates: results,
    categories_after: afterCats?.map((c) => ({ id: c.id, name: c.name, slug: c.slug })),
  });
}
