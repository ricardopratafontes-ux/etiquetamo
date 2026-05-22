import { supabase } from "@/lib/supabase";
import { NextResponse } from "next/server";

/**
 * Rota temporária para renomear "Food Service" → "Baldes" na tabela categories.
 * Acesse GET /api/fix-categoria no navegador uma única vez.
 * DEPOIS de rodar, delete este arquivo.
 */
export async function GET() {
  // 1. Buscar categoria com nome parecido com "food service"
  const { data: cats, error: fetchErr } = await supabase
    .from("categories")
    .select("id, name")
    .ilike("name", "%food%service%");

  if (fetchErr) {
    return NextResponse.json({ erro: "Falha ao buscar categorias", detalhe: fetchErr.message }, { status: 500 });
  }

  if (!cats || cats.length === 0) {
    // Tentar busca mais ampla pra ajudar debug
    const { data: todas } = await supabase.from("categories").select("id, name").order("name");
    return NextResponse.json({
      mensagem: "Nenhuma categoria 'Food Service' encontrada. Listando todas para conferência:",
      categorias: todas,
    });
  }

  // 2. Renomear para "Baldes"
  const resultados = [];
  for (const cat of cats) {
    const { error: updErr } = await supabase
      .from("categories")
      .update({ name: "Baldes" })
      .eq("id", cat.id);

    resultados.push({
      id: cat.id,
      de: cat.name,
      para: "Baldes",
      sucesso: !updErr,
      erro: updErr?.message || null,
    });
  }

  return NextResponse.json({
    mensagem: "Rename executado",
    resultados,
    aviso: "APAGUE este arquivo (src/app/api/fix-categoria/route.ts) depois de confirmar.",
  });
}
