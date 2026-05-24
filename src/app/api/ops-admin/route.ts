import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const ORG_SLUG = "gelateria";

/**
 * GET /api/ops-admin — Diagnostico da fila de OPs
 * POST /api/ops-admin — Acoes administrativas (limpar duplicatas, encerrar OPs)
 */
export async function GET() {
  const supabase = createClient(supabaseUrl, supabaseKey);

  const { data: org } = await supabase
    .from("organizations").select("id").eq("slug", ORG_SLUG).single();
  if (!org) return NextResponse.json({ error: "org not found" }, { status: 404 });

  // Buscar todas as OPs
  const { data: ops } = await supabase
    .from("omie_print_queue")
    .select("id, omie_order_id, omie_order_number, product_name, item_id, quantity, lot, status, created_at")
    .eq("organization_id", org.id)
    .order("created_at", { ascending: false });

  const allOps = ops || [];
  const pending = allOps.filter((o) => o.status === "pending");
  const completed = allOps.filter((o) => o.status !== "pending");
  // Show all distinct statuses for debugging
  const statuses = [...new Set(allOps.map((o) => o.status))];

  // Detectar duplicatas (mesmo omie_order_id com status pending)
  const orderIdCount: Record<string, number> = {};
  for (const op of pending) {
    if (op.omie_order_id) {
      orderIdCount[op.omie_order_id] = (orderIdCount[op.omie_order_id] || 0) + 1;
    }
  }
  const duplicatas = Object.entries(orderIdCount).filter(([, count]) => count > 1);

  return NextResponse.json({
    total: allOps.length,
    pending: pending.length,
    completed: completed.length,
    duplicatas: duplicatas.map(([id, count]) => ({ omie_order_id: id, count })),
    ops_pending: pending.map((o) => ({
      id: o.id,
      omie_order_id: o.omie_order_id,
      product_name: o.product_name,
      item_id: o.item_id,
      quantity: o.quantity,
      lot: o.lot,
      created_at: o.created_at,
    })),
    statuses,
    using_service_key: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
  });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const action = body.action;

  const supabase = createClient(supabaseUrl, supabaseKey);
  const { data: org } = await supabase
    .from("organizations").select("id").eq("slug", ORG_SLUG).single();
  if (!org) return NextResponse.json({ error: "org not found" }, { status: 404 });

  // Limpar duplicatas: manter apenas a mais recente de cada omie_order_id
  if (action === "clean_duplicates") {
    const { data: pending } = await supabase
      .from("omie_print_queue")
      .select("id, omie_order_id, created_at")
      .eq("organization_id", org.id)
      .eq("status", "pending")
      .order("created_at", { ascending: false });

    const seen = new Set<string>();
    const toDelete: string[] = [];
    for (const op of (pending || [])) {
      if (!op.omie_order_id) continue;
      if (seen.has(op.omie_order_id)) {
        toDelete.push(op.id);
      } else {
        seen.add(op.omie_order_id);
      }
    }

    if (toDelete.length > 0) {
      await supabase.from("omie_print_queue").delete().in("id", toDelete);
    }

    return NextResponse.json({
      action: "clean_duplicates",
      removed: toDelete.length,
    });
  }

  // Encerrar todas as OPs pendentes (reset total)
  if (action === "complete_all") {
    // Debug: contar pendentes primeiro
    const { data: pendingBefore, error: countErr } = await supabase
      .from("omie_print_queue")
      .select("id")
      .eq("organization_id", org.id)
      .eq("status", "pending");

    const { data: updated, error: updateErr } = await supabase
      .from("omie_print_queue")
      .update({ status: "completed" })
      .eq("organization_id", org.id)
      .eq("status", "pending")
      .select("id");

    return NextResponse.json({
      action: "complete_all",
      pending_before: pendingBefore?.length || 0,
      completed: updated?.length || 0,
      count_error: countErr?.message || null,
      update_error: updateErr?.message || null,
      org_id: org.id,
    });
  }

  // Deletar todas as OPs pendentes (reset total via delete)
  if (action === "delete_all_pending") {
    const { data: deleted, error: deleteErr } = await supabase
      .from("omie_print_queue")
      .delete()
      .eq("organization_id", org.id)
      .eq("status", "pending")
      .select("id");

    return NextResponse.json({
      action: "delete_all_pending",
      deleted: deleted?.length || 0,
      error: deleteErr?.message || null,
    });
  }

  return NextResponse.json({ error: "unknown action" }, { status: 400 });
}
