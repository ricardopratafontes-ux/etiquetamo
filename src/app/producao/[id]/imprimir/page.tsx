"use client";

import NavBar from "@/components/NavBar";
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import type { ProductionOrder, ProductionOrderItem, Item } from "@/types/database";
import { useParams, useRouter } from "next/navigation";

/** Encurta data de dd/mm/aaaa para dd/mm/aa */
function dataCurta(data: string): string {
  return data.replace(/\/(\d{4})$/, (_, ano: string) => "/" + ano.slice(2));
}

function dataHoje(): string {
  return new Date().toLocaleDateString("pt-BR");
}

function dataValidade(dias: number): string {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  return d.toLocaleDateString("pt-BR");
}

interface EtiquetaDados {
  nome: string;
  fabricacao: string;
  validade: string;
  lote: string;
  info: string;
  operador: string;
}

interface ItemComDetalhes extends ProductionOrderItem {
  item_name: string;
  item_expiry_days: number | null;
  item_uses_lot: boolean | null;
  item_additional_info: string | null;
}

function gerarHTMLEtiqueta(dados: EtiquetaDados, logoUrl?: string): string {
  const temInfo = !!dados.info;
  const fNome = temInfo ? "16pt" : "18pt";
  const fLote = temInfo ? "9pt" : "10pt";
  const fInfo = "7pt";
  const logo = logoUrl || "/logo-mo.png";

  const operadorHTML = dados.operador
    ? `<div style="position:absolute;right:0;width:5mm;height:5mm;border:0.3pt solid #000;display:flex;align-items:center;justify-content:center;font-size:6pt;font-weight:bold;">${dados.operador}</div>`
    : "";

  const loteHTML = dados.lote
    ? `<div style="font-size:${fLote};font-weight:bold;line-height:1.4;">Lote: ${dados.lote}</div>`
    : "";

  const infoHTML = temInfo
    ? `<div style="font-size:${fInfo};font-style:italic;line-height:1.3;margin-top:0.5mm;">${dados.info}</div>`
    : "";

  const cell = `<div style="width:50mm;height:50mm;padding:2mm;box-sizing:border-box;font-family:Arial,sans-serif;display:flex;flex-direction:column;overflow:hidden;">
    <div style="font-family:Arial,sans-serif;font-weight:bold;font-size:${fNome};text-align:center;text-transform:uppercase;border-bottom:0.5pt solid #000;padding-bottom:0.5mm;line-height:1.15;flex:1;display:flex;align-items:center;justify-content:center;overflow:hidden;">${dados.nome}</div>
    <div style="display:flex;flex-direction:column;align-items:center;padding-top:0.5mm;padding-bottom:0.5mm;">
      <div style="font-size:14pt;font-weight:bold;white-space:nowrap;line-height:1.2;text-transform:uppercase;">FAB: ${dataCurta(dados.fabricacao)}</div>
      <div style="display:flex;align-items:center;width:100%;position:relative;">
        <div style="width:100%;text-align:center;font-size:14pt;font-weight:bold;white-space:nowrap;line-height:1.2;text-transform:uppercase;">VAL: ${dataCurta(dados.validade)}</div>
        ${operadorHTML}
      </div>
    </div>
    <div style="display:flex;align-items:flex-start;">
      <div style="flex:1;">${loteHTML}${infoHTML}</div>
      <div style="display:flex;flex-direction:column;align-items:center;margin-left:1mm;">
        <div style="width:10mm;height:10mm;border:0.5pt solid #000;display:flex;align-items:center;justify-content:center;font-size:4pt;">QR</div>
        <img src="${logo}" style="height:5mm;opacity:0.8;margin-top:0.5mm;" />
      </div>
    </div>
  </div>`;
  return `<div style="width:107mm;display:flex;padding-left:2mm;padding-right:2mm;gap:3mm;">${cell}${cell}</div>`;
}

function gerarPaginaImpressao(etiquetas: EtiquetaDados[]): string {
  const logoAbsoluta = typeof window !== "undefined" ? window.location.origin + "/logo-mo.png" : "/logo-mo.png";
  const linhas = etiquetas.map((e) => gerarHTMLEtiqueta(e, logoAbsoluta)).join("");
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Etiquetas - Ordem de Produção</title>
<style>
  @page { margin: 0; size: 107mm 50mm; }
  html, body { margin: 0; padding: 0; width: 107mm; }
  body > div { page-break-after: always; }
  body > div:last-child { page-break-after: auto; }
</style>
</head>
<body>${linhas}</body>
</html>`;
}

export default function ImprimirOrdem() {
  const params = useParams();
  const router = useRouter();
  const orderId = params.id as string;

  const [ordem, setOrdem] = useState<ProductionOrder | null>(null);
  const [itens, setItens] = useState<ItemComDetalhes[]>([]);
  const [loading, setLoading] = useState(true);
  const [imprimindo, setImprimindo] = useState(false);

  // Campos editáveis pelo operador
  const [operador, setOperador] = useState("");
  const [lotesEditados, setLotesEditados] = useState<Record<string, string>>({});

  const carregar = useCallback(async () => {
    setLoading(true);

    const { data: ordemData } = await supabase
      .from("production_orders")
      .select("*")
      .eq("id", orderId)
      .single();

    if (!ordemData) { setLoading(false); return; }
    setOrdem(ordemData);

    // Buscar itens da ordem com dados do item cadastrado
    const { data: orderItems } = await supabase
      .from("production_order_items")
      .select("*")
      .eq("order_id", orderId);

    if (!orderItems) { setLoading(false); return; }

    // Buscar detalhes dos itens
    const itemIds = orderItems.map((oi) => oi.item_id);
    const { data: itemsData } = await supabase
      .from("items")
      .select("id, name, expiry_days, uses_lot, additional_info")
      .in("id", itemIds);

    const itemsMap = new Map(itemsData?.map((i) => [i.id, i]) || []);

    const itensComDetalhes: ItemComDetalhes[] = orderItems.map((oi) => {
      const item = itemsMap.get(oi.item_id);
      return {
        ...oi,
        item_name: item?.name || "Item não encontrado",
        item_expiry_days: item?.expiry_days || null,
        item_uses_lot: item?.uses_lot || null,
        item_additional_info: item?.additional_info || null,
      };
    });

    setItens(itensComDetalhes);

    // Inicializar lotes editáveis com o valor da ordem
    const lotesIniciais: Record<string, string> = {};
    itensComDetalhes.forEach((i) => {
      lotesIniciais[i.id] = i.lot || "";
    });
    setLotesEditados(lotesIniciais);

    setLoading(false);
  }, [orderId]);

  useEffect(() => { carregar(); }, [carregar]);

  function atualizarLote(itemId: string, valor: string) {
    setLotesEditados((prev) => ({ ...prev, [itemId]: valor }));
  }

  async function imprimirTodos() {
    if (!operador.trim()) {
      alert("Informe as iniciais do operador");
      return;
    }

    setImprimindo(true);
    const fabricacao = dataHoje();

    // Gerar etiquetas (1 por quantidade)
    const etiquetas: EtiquetaDados[] = [];
    for (const item of itens) {
      if (item.printed) continue;
      const validade = item.item_expiry_days ? dataValidade(item.item_expiry_days) : "";
      const lote = lotesEditados[item.id] || "";

      for (let i = 0; i < item.quantity; i++) {
        etiquetas.push({
          nome: item.item_name,
          fabricacao,
          validade,
          lote,
          info: item.item_additional_info || "",
          operador: operador.trim().toUpperCase(),
        });
      }
    }

    if (etiquetas.length === 0) {
      alert("Todos os itens já foram impressos");
      setImprimindo(false);
      return;
    }

    // Gerar HTML e abrir popup de impressão
    const html = gerarPaginaImpressao(etiquetas);
    const popup = window.open("", "_blank", "width=450,height=600");
    if (popup) {
      popup.document.write(html);
      popup.document.close();
      popup.onload = () => {
        popup.print();
      };
    }

    // Marcar itens como impressos
    const idsNaoImpressos = itens.filter((i) => !i.printed).map((i) => i.id);
    await supabase
      .from("production_order_items")
      .update({
        printed: true,
        printed_at: new Date().toISOString(),
        operator_initials: operador.trim().toUpperCase(),
        lot: null, // será atualizado abaixo individualmente
      })
      .in("id", idsNaoImpressos);

    // Atualizar lotes individuais
    for (const item of itens) {
      if (item.printed) continue;
      const lote = lotesEditados[item.id]?.trim() || null;
      if (lote !== item.lot) {
        await supabase
          .from("production_order_items")
          .update({ lot: lote })
          .eq("id", item.id);
      }
    }

    setImprimindo(false);
    carregar(); // recarregar dados
  }

  async function imprimirItem(item: ItemComDetalhes) {
    if (!operador.trim()) {
      alert("Informe as iniciais do operador");
      return;
    }

    const fabricacao = dataHoje();
    const validade = item.item_expiry_days ? dataValidade(item.item_expiry_days) : "";
    const lote = lotesEditados[item.id] || "";

    const etiquetas: EtiquetaDados[] = [];
    for (let i = 0; i < item.quantity; i++) {
      etiquetas.push({
        nome: item.item_name,
        fabricacao,
        validade,
        lote,
        info: item.item_additional_info || "",
        operador: operador.trim().toUpperCase(),
      });
    }

    const html = gerarPaginaImpressao(etiquetas);
    const popup = window.open("", "_blank", "width=450,height=600");
    if (popup) {
      popup.document.write(html);
      popup.document.close();
      popup.onload = () => { popup.print(); };
    }

    // Marcar como impresso
    await supabase
      .from("production_order_items")
      .update({
        printed: true,
        printed_at: new Date().toISOString(),
        operator_initials: operador.trim().toUpperCase(),
        lot: lote.trim() || null,
      })
      .eq("id", item.id);

    carregar();
  }

  const itensNaoImpressos = itens.filter((i) => !i.printed);
  const itensImpressos = itens.filter((i) => i.printed);
  const totalEtiquetasPendentes = itensNaoImpressos.reduce((s, i) => s + i.quantity, 0);

  if (loading) {
    return (
      <>
        <NavBar />
        <main className="min-h-screen bg-[var(--bege)] flex items-center justify-center">
          <div className="text-center">
            <span className="text-4xl block mb-3 animate-pulse">⏳</span>
            <p className="text-[var(--marrom)] font-medium">Carregando ordem...</p>
          </div>
        </main>
      </>
    );
  }

  if (!ordem) {
    return (
      <>
        <NavBar />
        <main className="min-h-screen bg-[var(--bege)] flex items-center justify-center">
          <div className="text-center">
            <span className="text-4xl block mb-3">❌</span>
            <p className="text-[var(--marrom)] font-medium">Ordem não encontrada</p>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <NavBar />
      <main className="min-h-screen bg-[var(--bege)]">
        {/* Header */}
        <div className="bg-gradient-to-r from-[var(--vermelho)] to-[#c0162f] text-white px-6 py-6">
          <div className="max-w-5xl mx-auto">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-3xl">🖨️</span>
                <div>
                  <h1 className="text-xl font-extrabold">{ordem.title}</h1>
                  <p className="text-sm opacity-80">
                    {totalEtiquetasPendentes} etiquetas pendentes · {itensImpressos.length} já impressos
                  </p>
                </div>
              </div>
              <button
                onClick={() => router.push("/producao")}
                className="px-4 py-2 bg-white/15 hover:bg-white/25 rounded-xl text-sm font-semibold transition-all cursor-pointer"
              >
                ← Voltar
              </button>
            </div>
          </div>
        </div>

        <div className="max-w-5xl mx-auto px-6 -mt-4">
          {/* Campo do operador */}
          <div className="bg-white rounded-2xl shadow-lg border border-[var(--verde)] p-5 mb-6">
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <label className="block text-xs font-semibold text-gray-500 mb-1">Iniciais do Operador *</label>
                <input
                  type="text"
                  value={operador}
                  onChange={(e) => setOperador(e.target.value.slice(0, 3))}
                  placeholder="Ex: RP"
                  maxLength={3}
                  className="w-full px-4 py-3 bg-[var(--bege)] border-none rounded-xl text-lg font-bold text-center uppercase focus:outline-none focus:ring-2 focus:ring-[var(--vermelho)]"
                />
              </div>
              <button
                type="button"
                onClick={imprimirTodos}
                disabled={imprimindo || itensNaoImpressos.length === 0 || !operador.trim()}
                className={
                  "flex items-center gap-2 px-6 py-3.5 rounded-xl text-sm font-bold transition-all " +
                  (itensNaoImpressos.length === 0 || !operador.trim()
                    ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                    : "bg-[var(--vermelho)] text-white shadow-lg hover:bg-red-600 cursor-pointer")
                }
              >
                {imprimindo ? "⏳ Imprimindo..." : `🖨️ Imprimir Todos (${totalEtiquetasPendentes})`}
              </button>
            </div>
          </div>

          {/* Itens pendentes */}
          {itensNaoImpressos.length > 0 && (
            <div className="mb-6">
              <h2 className="font-bold text-[var(--marrom)] text-lg mb-3 flex items-center gap-2">
                <span>📋</span> Pendentes de Impressão ({itensNaoImpressos.length})
              </h2>
              <div className="space-y-3">
                {itensNaoImpressos.map((item) => (
                  <div key={item.id} className="bg-white rounded-2xl shadow-md border-l-4 border-l-amber-400 p-4">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-[var(--marrom)] text-base truncate">{item.item_name}</h3>
                        <div className="flex items-center gap-3 mt-2">
                          <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-bold">
                            {item.quantity} {item.quantity === 1 ? "etiqueta" : "etiquetas"}
                          </span>
                          {item.item_expiry_days && (
                            <span className="text-xs text-gray-400">
                              Validade: {item.item_expiry_days} dias
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div>
                          <label className="block text-[10px] font-semibold text-gray-400 mb-0.5">Lote</label>
                          <input
                            type="text"
                            value={lotesEditados[item.id] || ""}
                            onChange={(e) => atualizarLote(item.id, e.target.value)}
                            placeholder="Lote"
                            className="w-24 px-3 py-1.5 bg-[var(--bege)] border border-gray-200 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[var(--vermelho)]"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => imprimirItem(item)}
                          disabled={!operador.trim()}
                          className={
                            "px-4 py-2 rounded-lg text-xs font-bold transition-all " +
                            (!operador.trim()
                              ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                              : "bg-[var(--vermelho)] text-white hover:bg-red-600 cursor-pointer")
                          }
                        >
                          🖨️
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Itens já impressos */}
          {itensImpressos.length > 0 && (
            <div className="mb-8">
              <h2 className="font-bold text-gray-400 text-lg mb-3 flex items-center gap-2">
                <span>✅</span> Já Impressos ({itensImpressos.length})
              </h2>
              <div className="space-y-2">
                {itensImpressos.map((item) => (
                  <div key={item.id} className="bg-white/60 rounded-xl border border-green-200 p-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-green-500">✅</span>
                      <span className="text-sm font-medium text-gray-500">{item.item_name}</span>
                      <span className="text-xs text-gray-400">×{item.quantity}</span>
                      {item.lot && <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded">Lote: {item.lot}</span>}
                    </div>
                    <span className="text-xs text-gray-400">
                      {item.operator_initials} · {item.printed_at ? new Date(item.printed_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : ""}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>
    </>
  );
}
