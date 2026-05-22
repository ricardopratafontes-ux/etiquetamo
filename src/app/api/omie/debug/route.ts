import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * GET /api/omie/debug
 * Retorna os payloads dos webhooks recebidos para diagnóstico.
 * TEMPORÁRIO — remover depois.
 */
export async function GET() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const { data: queue, error: qErr } = await supabase
    .from("omie_print_queue")
    .select("id, product_name, webhook_payload, created_at")
    .order("created_at", { ascending: false })
    .limit(5);

  const { data: syncLogs, error: sErr } = await supabase
    .from("omie_sync_log")
    .select("*")
    .order("started_at", { ascending: false })
    .limit(3);

  return NextResponse.json({
    print_queue: queue || [],
    print_queue_error: qErr?.message || null,
    sync_logs: syncLogs || [],
    sync_logs_error: sErr?.message || null,
    env: {
      OMIE_APP_KEY_present: !!process.env.OMIE_APP_KEY,
      OMIE_APP_SECRET_present: !!process.env.OMIE_APP_SECRET,
      OMIE_APP_KEY_preview: process.env.OMIE_APP_KEY?.slice(0, 6) + "...",
    },
  });
}
