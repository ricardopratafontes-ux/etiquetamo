import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function GET() {
  const supabase = createClient(supabaseUrl, supabaseKey);

  const { data: org } = await supabase
    .from("organizations")
    .select("id")
    .eq("slug", "gelateria")
    .single();

  if (!org) return NextResponse.json({ error: "org not found" });

  const { data: ops } = await supabase
    .from("omie_print_queue")
    .select("id, omie_order_id, omie_order_number, product_name, item_id, quantity, lot, status, created_at")
    .eq("organization_id", org.id)
    .order("created_at", { ascending: false });

  const { data: items } = await supabase
    .from("items")
    .select("id, name, code, category_id, omie_product_id")
    .eq("organization_id", org.id)
    .eq("active", true)
    .order("name");

  const { data: cats } = await supabase
    .from("categories")
    .select("id, name")
    .eq("organization_id", org.id);

  const catMap: Record<string, string> = {};
  for (const c of cats || []) catMap[c.id] = c.name;

  function normalizar(s: string): string {
    return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
  }

  const analise = (ops || []).filter(op => op.status === "pending").map(op => {
    const nomeOP = normalizar(op.product_name);
    const matches = (items || []).filter(it => {
      const nomeItem = normalizar(it.name);
      return nomeOP.includes(nomeItem) || nomeItem.includes(nomeOP);
    });
    return {
      op_product_name: op.product_name,
      op_norm: nomeOP,
      omie_order_id: op.omie_order_id,
      quantity: op.quantity,
      lot: op.lot,
      item_id_atual: op.item_id,
      matches: matches.map(m => ({
        id: m.id, name: m.name, norm: normalizar(m.name),
        cat: catMap[m.category_id || ""] || "sem",
      })),
    };
  });

  const orderIdCount: Record<string, number> = {};
  for (const op of ops || []) {
    if (op.omie_order_id) {
      const key = String(op.omie_order_id);
      orderIdCount[key] = (orderIdCount[key] || 0) + 1;
    }
  }
  const duplicatas = Object.entries(orderIdCount).filter(([, count]) => count > 1);

  return NextResponse.json({
    resumo: {
      total_ops: (ops || []).length,
      pendentes: (ops || []).filter(o => o.status === "pending").length,
      queued: (ops || []).filter(o => o.status === "queued").length,
      completed: (ops || []).filter(o => o.status === "completed").length,
      skipped: (ops || []).filter(o => o.status === "skipped").length,
      total_itens: (items || []).length,
    },
    duplicatas_por_order_id: duplicatas,
    ops: ops,
    itens: (items || []).map(i => ({
      id: i.id, name: i.name, code: i.code,
      cat: catMap[i.category_id || ""] || "sem",
      omie_pid: i.omie_product_id,
    })),
    analise_matching: analise,
  });
}
