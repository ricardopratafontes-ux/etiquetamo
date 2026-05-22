"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@supabase/supabase-js";
import NavBar from "@/components/NavBar";
import PatternStrip from "@/components/PatternStrip";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

const ORG_SLUG = "gelateria";

interface PrintQueueItem {
  id: string;
  omie_order_id: number | null;
  omie_order_number: string | null;
  product_name: string;
  item_id: string | null;
  quantity: number;
  lot: string | null;
  status: string;
  created_at: string;
}

export default function OmiePage() {
  const [printQueue, setPrintQueue] = useState<PrintQueueItem[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    const { data: org } = await supabase
      .from("organizations")
      .select("id")
      .eq("slug", ORG_SLUG)
      .single();

    if (!org) {
      setLoading(false);
      return;
    }

    const { data: pData } = await supabase
      .from("omie_print_queue")
      .select("*")
      .eq("organization_id", org.id)
      .eq("status", "pending")
      .order("created_at", { ascending: false });

    setPrintQueue((pData || []) as PrintQueueItem[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSkipQueue = async (id: string) => {
    await supabase
      .from("omie_print_queue")
      .update({ status: "skipped" })
      .eq("id", id);
    loadData();
  };

  const handleMarkPrinted = async (id: string) => {
    await supabase
      .from("omie_print_queue")
      .update({ status: "printed", printed_at: new Date().toISOString() })
      .eq("id", id);
    loadData();
  };

  return (
    <>
      <NavBar />
      <main className="min-h-screen bg-[var(--bege)]">
        <div className="max-w-4xl mx-auto px-6 py-6">
          {/* Header */}
          <div className="flex items-center gap-3 mb-6">
            <span className="text-3xl">🏭</span>
            <div>
              <h1 className="text-2xl font-bold text-[var(--marrom)]">
                Ordens de Producao
              </h1>
              <p className="text-sm text-[var(--marrom)] opacity-60">
                Notificacoes de producao recebidas do OMIE
              </p>
            </div>
          </div>

          {/* Webhook info */}
          <div className="bg-white rounded-2xl p-5 shadow-md mb-6">
            <h3 className="text-sm font-bold text-[var(--marrom)] mb-2">
              Webhook OMIE
            </h3>
            <p className="text-sm text-[var(--marrom)] opacity-70 mb-3">
              Configure no painel OMIE para receber notificacoes de ordens de
              producao automaticamente.
            </p>
            <div className="bg-gray-50 rounded-lg p-3 font-mono text-xs text-gray-600 break-all">
              POST https://etiquetamo.vercel.app/api/omie/webhook
            </div>
          </div>

          {/* Fila de Impressao */}
          {loading ? (
            <div className="text-center py-12 text-[var(--marrom)] opacity-60">
              Carregando...
            </div>
          ) : printQueue.length === 0 ? (
            <div className="bg-white rounded-2xl p-8 shadow-md text-center">
              <span className="text-4xl block mb-2">🖨️</span>
              <p className="text-[var(--marrom)] font-semibold">Fila vazia</p>
              <p className="text-sm text-[var(--marrom)] opacity-60">
                Nenhuma ordem de producao aguardando impressao
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-[var(--marrom)] opacity-70">
                  Ordens de producao recebidas do OMIE
                </p>
                <span className="bg-[var(--vermelho)] text-white text-xs px-3 py-1 rounded-full font-bold">
                  {printQueue.length} pendente{printQueue.length > 1 ? "s" : ""}
                </span>
              </div>
              {printQueue.map((p) => (
                <div
                  key={p.id}
                  className="bg-white rounded-xl p-4 shadow-sm border-l-4 border-[var(--vermelho)] flex items-center justify-between"
                >
                  <div>
                    <p className="font-semibold text-[var(--marrom)]">
                      {p.product_name}
                    </p>
                    <p className="text-xs text-[var(--marrom)] opacity-60">
                      {p.omie_order_number && `OP #${p.omie_order_number} · `}
                      Qtd: {p.quantity}
                      {p.lot && ` · Lote: ${p.lot}`}
                      {" · "}
                      {new Date(p.created_at).toLocaleString("pt-BR")}
                    </p>
                    {!p.item_id && (
                      <p className="text-xs text-orange-600 font-medium mt-1">
                        ⚠️ Item nao vinculado no EtiquetaMO
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleMarkPrinted(p.id)}
                      className="text-xs px-3 py-1.5 rounded-lg bg-[var(--vermelho)] text-white hover:opacity-90 transition-colors font-semibold"
                    >
                      ✓ Impresso
                    </button>
                    <button
                      onClick={() => handleSkipQueue(p.id)}
                      className="text-xs px-3 py-1.5 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
                    >
                      Pular
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
      <PatternStrip />
    </>
  );
}
