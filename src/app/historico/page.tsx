"use client";

import NavBar from "@/components/NavBar";
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { dataHoje, dataCurta } from "@/lib/dateUtils";
import { gerarCelulaEtiqueta, gerarCelulaAvulsa } from "@/lib/labelHtml";

const ORG_SLUG = "gelateria";

// --- Tipos ---
interface PrintRecord {
  id: string;
  product_name: string;
  operator_id: string;
  fabrication_date: string;
  expiry_date: string | null;
  lot: string | null;
  additional_info: string | null;
  quantity: number;
  printed_at: string;
  reprint_of: string | null;
  item_id: string;
}

interface AvulsaRecord {
  id: string;
  label_data: {
    nome: string;
    quantidade: string | null;
    campos: { label: string; valor: string }[];
    campoExtra: string | null;
  };
  quantity_printed: number;
  created_at: string;
}

interface Operador {
  id: string;
  name: string;
}

type TabAtiva = "producao" | "avulsas";
type FiltroData = "hoje" | "7dias" | "30dias" | "todos";

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("pt-BR");
}

function formatDateTime(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("pt-BR") + " " + d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

// dateUtils e labelHtml importados do módulo compartilhado

function arredondarPar(n: number): number {
  return n % 2 === 0 ? n : n + 1;
}

export default function HistoricoPage() {
  const [orgId, setOrgId] = useState("");
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabAtiva>("producao");
  const [filtroData, setFiltroData] = useState<FiltroData>("7dias");
  const [busca, setBusca] = useState("");
  const [reimprindo, setReimprindo] = useState<string | null>(null);

  // Dados
  const [prints, setPrints] = useState<PrintRecord[]>([]);
  const [avulsas, setAvulsas] = useState<AvulsaRecord[]>([]);
  const [operadores, setOperadores] = useState<Operador[]>([]);

  // Carregar dados
  const carregar = useCallback(async () => {
    setLoading(true);
    const { data: org } = await supabase.from("organizations").select("id").eq("slug", ORG_SLUG).single();
    if (!org) { setLoading(false); return; }
    setOrgId(org.id);

    const [printRes, avulsaRes, opRes] = await Promise.all([
      supabase.from("print_history").select("*").eq("organization_id", org.id).order("printed_at", { ascending: false }).limit(500),
      supabase.from("avulsa_history").select("*").eq("organization_id", org.id).order("created_at", { ascending: false }).limit(500),
      supabase.from("operators").select("id, name").eq("organization_id", org.id),
    ]);

    if (printRes.data) setPrints(printRes.data);
    if (avulsaRes.data) setAvulsas(avulsaRes.data);
    if (opRes.data) setOperadores(opRes.data);
    setLoading(false);
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  // Helpers
  function nomeOperador(id: string): string {
    const op = operadores.find((o) => o.id === id);
    return op ? op.name : "—";
  }

  function iniciais(nome: string): string {
    const p = nome.trim().split(/\s+/);
    if (p.length === 1) return p[0].substring(0, 2).toUpperCase();
    return (p[0][0] + p[p.length - 1][0]).toUpperCase();
  }

  // Filtro de data
  function filtrarPorData<T extends { printed_at?: string; created_at?: string }>(items: T[]): T[] {
    if (filtroData === "todos") return items;
    const agora = new Date();
    const limite = new Date();
    if (filtroData === "hoje") { limite.setHours(0, 0, 0, 0); }
    else if (filtroData === "7dias") { limite.setDate(agora.getDate() - 7); }
    else if (filtroData === "30dias") { limite.setDate(agora.getDate() - 30); }

    return items.filter((item) => {
      const dateStr = ("printed_at" in item && item.printed_at) ? item.printed_at : ("created_at" in item && item.created_at) ? item.created_at : "";
      if (!dateStr) return false;
      return new Date(dateStr) >= limite;
    });
  }

  // Filtro de busca
  const printsFiltrados = filtrarPorData(prints).filter((p) => {
    if (!busca.trim()) return true;
    const term = busca.trim().toLowerCase();
    return p.product_name.toLowerCase().includes(term) ||
      nomeOperador(p.operator_id).toLowerCase().includes(term) ||
      (p.lot && p.lot.toLowerCase().includes(term));
  });

  const avulsasFiltradas = filtrarPorData(avulsas).filter((a) => {
    if (!busca.trim()) return true;
    const term = busca.trim().toLowerCase();
    return a.label_data.nome.toLowerCase().includes(term);
  });

  // Totais
  const totalPrints = printsFiltrados.reduce((sum, p) => sum + p.quantity, 0);
  const totalAvulsas = avulsasFiltradas.reduce((sum, a) => sum + a.quantity_printed, 0);

  // --- Reimpressão: Produção ---
  async function reimprimirProducao(record: PrintRecord) {
    setReimprindo(record.id);
    const logoUrl = window.location.origin + "/logo-mo.png";
    const opNome = nomeOperador(record.operator_id);
    const opIniciais = opNome !== "—" ? iniciais(opNome) : "";

    const fab = formatDate(record.fabrication_date);
    const val = record.expiry_date ? formatDate(record.expiry_date) : "—";

    const celula = gerarCelulaEtiqueta({
      nome: record.product_name, fabricacao: fab, validade: val,
      lote: record.lot || "", info: record.additional_info || "", produtorIniciais: opIniciais, logoUrl
    });

    const total = arredondarPar(record.quantity);
    const celulas: string[] = [];
    for (let i = 0; i < total; i++) celulas.push(celula);

    let linhas = "";
    for (let i = 0; i < celulas.length; i += 2) {
      linhas += `<div style="width:107mm;display:flex;padding-left:2mm;padding-right:2mm;gap:3mm;page-break-after:always;">${celulas[i]}${celulas[i + 1] || celulas[i]}</div>`;
    }

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Reimpressão</title>
<style>@page{margin:0;size:107mm 50mm}@media print{html,body{margin:0;padding:0;width:107mm}.no-print{display:none!important}}html,body{margin:0;padding:0}</style>
</head><body>${linhas}
<div class="no-print" style="text-align:center;padding:20px;">
  <button onclick="window.print()" style="padding:12px 32px;font-size:16px;font-weight:bold;background:#f31c40;color:white;border:none;border-radius:12px;cursor:pointer;">🖨️ Imprimir</button>
  <button onclick="window.close()" style="padding:12px 32px;font-size:16px;margin-left:12px;background:#98472d;color:white;border:none;border-radius:12px;cursor:pointer;">Fechar</button>
</div></body></html>`;

    const win = window.open("", "_blank");
    if (win) { win.document.write(html); win.document.close(); }

    // Salvar reimpressão no histórico
    if (orgId) {
      await supabase.from("print_history").insert({
        organization_id: orgId,
        item_id: record.item_id,
        operator_id: record.operator_id,
        product_name: record.product_name,
        fabrication_date: record.fabrication_date,
        expiry_date: record.expiry_date,
        lot: record.lot,
        additional_info: record.additional_info,
        quantity: total,
        reprint_of: record.id,
      });
      carregar();
    }
    setReimprindo(null);
  }

  // --- Reimpressão: Avulsa ---
  async function reimprimirAvulsa(record: AvulsaRecord) {
    setReimprindo(record.id);
    const logoUrl = window.location.origin + "/logo-mo.png";
    const celula = gerarCelulaAvulsa({ ...record.label_data, logoUrl });

    const total = arredondarPar(record.quantity_printed);
    const celulas: string[] = [];
    for (let i = 0; i < total; i++) celulas.push(celula);

    let linhas = "";
    for (let i = 0; i < celulas.length; i += 2) {
      linhas += `<div style="width:107mm;display:flex;padding-left:2mm;padding-right:2mm;gap:3mm;page-break-after:always;">${celulas[i]}${celulas[i + 1] || celulas[i]}</div>`;
    }

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Reimpressão Avulsa</title>
<style>@page{margin:0;size:107mm 50mm}@media print{html,body{margin:0;padding:0;width:107mm}.no-print{display:none!important}}html,body{margin:0;padding:0}</style>
</head><body>${linhas}
<div class="no-print" style="text-align:center;padding:20px;">
  <button onclick="window.print()" style="padding:12px 32px;font-size:16px;font-weight:bold;background:#f31c40;color:white;border:none;border-radius:12px;cursor:pointer;">🖨️ Imprimir</button>
  <button onclick="window.close()" style="padding:12px 32px;font-size:16px;margin-left:12px;background:#98472d;color:white;border:none;border-radius:12px;cursor:pointer;">Fechar</button>
</div></body></html>`;

    const win = window.open("", "_blank");
    if (win) { win.document.write(html); win.document.close(); }

    // Salvar reimpressão no histórico avulsa
    if (orgId) {
      await supabase.from("avulsa_history").insert({
        organization_id: orgId,
        label_data: record.label_data,
        quantity_printed: total,
      });
      carregar();
    }
    setReimprindo(null);
  }

  if (loading) {
    return (<><NavBar /><main className="min-h-screen bg-[var(--bege)] flex items-center justify-center"><p className="text-[var(--marrom)] font-medium animate-pulse">Carregando histórico...</p></main></>);
  }

  return (
    <>
      <NavBar />
      <main className="min-h-screen bg-[var(--bege)]">
        {/* Header */}
        <div className="bg-gradient-to-r from-[var(--vermelho)] to-[#d41636] text-white px-6 py-6">
          <div className="max-w-6xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-3xl">📜</span>
              <div>
                <h1 className="text-2xl font-extrabold">Histórico de Impressões</h1>
                <p className="text-sm text-white/70">Consulte e reimprima etiquetas anteriores</p>
              </div>
            </div>
            <div className="flex items-center gap-4 text-sm">
              <div className="bg-white/20 rounded-xl px-4 py-2 text-center">
                <p className="text-2xl font-extrabold">{tab === "producao" ? printsFiltrados.length : avulsasFiltradas.length}</p>
                <p className="text-[10px] text-white/80">registros</p>
              </div>
              <div className="bg-white/20 rounded-xl px-4 py-2 text-center">
                <p className="text-2xl font-extrabold">{tab === "producao" ? totalPrints : totalAvulsas}</p>
                <p className="text-[10px] text-white/80">etiquetas</p>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-6xl mx-auto px-6 -mt-4 pb-8">
          {/* Tabs + Filtros */}
          <div className="bg-white rounded-2xl shadow-lg p-4 mb-4">
            <div className="flex items-center gap-4 flex-wrap">
              {/* Tabs */}
              <div className="flex bg-gray-100 rounded-xl p-1">
                <button onClick={() => setTab("producao")}
                  className={"px-4 py-2 rounded-lg text-sm font-bold cursor-pointer transition-all " + (tab === "producao" ? "bg-[var(--vermelho)] text-white shadow" : "text-gray-500 hover:text-gray-700")}>
                  🏭 Produção ({prints.length})
                </button>
                <button onClick={() => setTab("avulsas")}
                  className={"px-4 py-2 rounded-lg text-sm font-bold cursor-pointer transition-all " + (tab === "avulsas" ? "bg-[var(--vermelho)] text-white shadow" : "text-gray-500 hover:text-gray-700")}>
                  🏷️ Avulsas ({avulsas.length})
                </button>
              </div>

              {/* Filtro de data */}
              <div className="flex bg-gray-100 rounded-xl p-1">
                {(["hoje", "7dias", "30dias", "todos"] as FiltroData[]).map((f) => (
                  <button key={f} onClick={() => setFiltroData(f)}
                    className={"px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-all " + (filtroData === f ? "bg-[var(--marrom)] text-white shadow" : "text-gray-500 hover:text-gray-700")}>
                    {f === "hoje" ? "Hoje" : f === "7dias" ? "7 dias" : f === "30dias" ? "30 dias" : "Todos"}
                  </button>
                ))}
              </div>

              {/* Busca */}
              <div className="flex-1 min-w-[200px]">
                <input type="text" value={busca} onChange={(e) => setBusca(e.target.value)}
                  placeholder="🔍 Buscar por produto, operador, lote..."
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[var(--vermelho)] focus:ring-1 focus:ring-[var(--vermelho)] bg-white" />
              </div>
            </div>
          </div>

          {/* === Tab Produção === */}
          {tab === "producao" && (
            <div className="space-y-2">
              {printsFiltrados.length === 0 ? (
                <div className="bg-white rounded-2xl shadow-md p-12 text-center">
                  <span className="text-5xl block mb-4">📭</span>
                  <p className="text-gray-500 font-medium">Nenhuma impressão encontrada</p>
                  <p className="text-xs text-gray-400 mt-1">Ajuste os filtros ou faça sua primeira impressão</p>
                </div>
              ) : (
                printsFiltrados.map((p) => {
                  const opNome = nomeOperador(p.operator_id);
                  const isReprint = !!p.reprint_of;
                  return (
                    <div key={p.id} className={"bg-white rounded-xl shadow-sm border px-4 py-3 flex items-center gap-4 transition-all hover:shadow-md " + (isReprint ? "border-orange-200 bg-orange-50/30" : "border-gray-100")}>
                      {/* Info principal */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-bold text-[var(--marrom)] text-sm truncate">{p.product_name}</p>
                          {isReprint && <span className="text-[9px] bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded-full font-bold">↻ Reimpressão</span>}
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-[10px] text-gray-500">
                          <span>👤 {opNome}</span>
                          <span>📅 {formatDateTime(p.printed_at)}</span>
                          <span>🏷️ {p.quantity} etiq.</span>
                          {p.lot && <span>📦 Lote: {p.lot}</span>}
                          {p.fabrication_date && <span>Fab: {formatDate(p.fabrication_date)}</span>}
                          {p.expiry_date && <span>Val: {formatDate(p.expiry_date)}</span>}
                        </div>
                      </div>

                      {/* Botão reimprimir */}
                      <button onClick={() => reimprimirProducao(p)}
                        disabled={reimprindo === p.id}
                        className={"px-4 py-2 rounded-xl text-xs font-bold cursor-pointer transition-all shrink-0 " + (reimprindo === p.id ? "bg-gray-200 text-gray-400" : "bg-[var(--vermelho)] text-white hover:bg-red-600 shadow-sm hover:shadow-md")}>
                        {reimprindo === p.id ? "..." : "🖨️ Reimprimir"}
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* === Tab Avulsas === */}
          {tab === "avulsas" && (
            <div className="space-y-2">
              {avulsasFiltradas.length === 0 ? (
                <div className="bg-white rounded-2xl shadow-md p-12 text-center">
                  <span className="text-5xl block mb-4">📭</span>
                  <p className="text-gray-500 font-medium">Nenhuma etiqueta avulsa encontrada</p>
                  <p className="text-xs text-gray-400 mt-1">Ajuste os filtros ou imprima etiquetas avulsas</p>
                </div>
              ) : (
                avulsasFiltradas.map((a) => (
                  <div key={a.id} className="bg-white rounded-xl shadow-sm border border-gray-100 px-4 py-3 flex items-center gap-4 transition-all hover:shadow-md">
                    {/* Info principal */}
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-[var(--marrom)] text-sm truncate">{a.label_data.nome}</p>
                      <div className="flex items-center gap-3 mt-1 text-[10px] text-gray-500 flex-wrap">
                        <span>📅 {formatDateTime(a.created_at)}</span>
                        <span>🏷️ {a.quantity_printed} etiq.</span>
                        {a.label_data.quantidade && <span>QTD: {a.label_data.quantidade}</span>}
                        {a.label_data.campos && a.label_data.campos.length > 0 && (
                          <span>{a.label_data.campos.map((c) => `${c.label}: ${c.valor}`).join(", ")}</span>
                        )}
                        {a.label_data.campoExtra && <span className="italic">"{a.label_data.campoExtra}"</span>}
                      </div>
                    </div>

                    {/* Botão reimprimir */}
                    <button onClick={() => reimprimirAvulsa(a)}
                      disabled={reimprindo === a.id}
                      className={"px-4 py-2 rounded-xl text-xs font-bold cursor-pointer transition-all shrink-0 " + (reimprindo === a.id ? "bg-gray-200 text-gray-400" : "bg-[var(--vermelho)] text-white hover:bg-red-600 shadow-sm hover:shadow-md")}>
                      {reimprindo === a.id ? "..." : "🖨️ Reimprimir"}
                    </button>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </main>
    </>
  );
}
