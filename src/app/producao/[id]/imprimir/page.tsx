"use client";

import NavBar from "@/components/NavBar";
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import type { ProductionOrder, ProductionOrderItem, Item } from "@/types/database";
import { useParams, useRouter } from "next/navigation";
import { dataCurta, dataHoje, dataValidade, parseDateBR, menorData } from "@/lib/dateUtils";
import { gerarCelulaEtiqueta, gerarLinhaImpressao, gerarPaginaImpressao } from "@/lib/labelHtml";

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
  item_category_name: string | null;
}

/** Categorias excluídas da regra de validade do pacote (DEC-021) */
const CATEGORIAS_SEM_VALIDADE_PACOTE = ["food service", "producao", "produção"];

// Funções locais removidas — agora importadas de @/lib/dateUtils e @/lib/labelHtml

/** Helper: monta HTML de impressão a partir do array de EtiquetaDados */
function montarHtmlImpressao(etiquetas: EtiquetaDados[]): string {
  const logoUrl = typeof window !== "undefined" ? window.location.origin + "/logo-mo.png" : "/logo-mo.png";
  const linhas = etiquetas.map((e) =>
    gerarLinhaImpressao(
      gerarCelulaEtiqueta({
        nome: e.nome,
        fabricacao: e.fabricacao,
        validade: e.validade,
        lote: e.lote,
        info: e.info,
        produtorIniciais: e.operador,
        logoUrl,
      })
    )
  );
  return gerarPaginaImpressao(linhas);
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
  const [produtor, setProdutor] = useState("");       // quem fez a produção (vai na etiqueta)
  const [impressor, setImpressor] = useState("");     // quem está imprimindo (vai no histórico)
  const [lotesEditados, setLotesEditados] = useState<Record<string, string>>({});

  // DEC-021: validade do pacote (por item)
  const [validadesPacote, setValidadesPacote] = useState<Record<string, string>>({});
  const [modalValidade, setModalValidade] = useState<{ itemId: string; itemName: string } | null>(null);
  const [modalValInput, setModalValInput] = useState("");

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

    // Buscar detalhes dos itens com categoria
    const itemIds = orderItems.map((oi) => oi.item_id);
    const { data: itemsData } = await supabase
      .from("items")
      .select("id, name, expiry_days, uses_lot, additional_info, category_id")
      .in("id", itemIds);

    // Buscar categorias para saber o nome
    const catIds = [...new Set(itemsData?.map((i) => i.category_id).filter(Boolean) || [])];
    let catsMap = new Map<string, string>();
    if (catIds.length > 0) {
      const { data: catsData } = await supabase
        .from("categories")
        .select("id, name")
        .in("id", catIds);
      catsMap = new Map(catsData?.map((c) => [c.id, c.name]) || []);
    }

    const itemsMap = new Map(itemsData?.map((i) => [i.id, i]) || []);

    const itensComDetalhes: ItemComDetalhes[] = orderItems.map((oi) => {
      const item = itemsMap.get(oi.item_id);
      return {
        ...oi,
        item_name: item?.name || "Item não encontrado",
        item_expiry_days: item?.expiry_days || null,
        item_uses_lot: item?.uses_lot || null,
        item_additional_info: item?.additional_info || null,
        item_category_name: item?.category_id ? (catsMap.get(item.category_id) || null) : null,
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

  /** DEC-021: verifica se item precisa de validade do pacote e abre modal */
  function precisaValidadePacote(item: ItemComDetalhes): boolean {
    if (!item.item_uses_lot) return false;
    if (!item.item_category_name) return false;
    const cat = item.item_category_name.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
    return !CATEGORIAS_SEM_VALIDADE_PACOTE.some((c) => cat.includes(c.normalize("NFD").replace(/[̀-ͯ]/g, "")));
  }

  function pedirValidadePacote(item: ItemComDetalhes) {
    setModalValInput(validadesPacote[item.id] || "");
    setModalValidade({ itemId: item.id, itemName: item.item_name });
  }

  function confirmarValidadePacote() {
    if (!modalValidade) return;
    setValidadesPacote((prev) => ({ ...prev, [modalValidade.itemId]: modalValInput }));
    setModalValidade(null);
    setModalValInput("");
  }

  /** Calcula validade final considerando a do pacote (DEC-021) */
  function validadeFinal(item: ItemComDetalhes): string {
    const valCalc = item.item_expiry_days ? dataValidade(item.item_expiry_days) : "";
    if (!valCalc) return valCalc;
    const valPacote = validadesPacote[item.id];
    if (!valPacote) return valCalc;
    return menorData(valCalc, valPacote);
  }

  async function imprimirTodos() {
    if (!produtor.trim()) {
      alert("Informe as iniciais de quem fez a produção");
      return;
    }
    if (!impressor.trim()) {
      alert("Informe as iniciais de quem está imprimindo");
      return;
    }

    setImprimindo(true);
    const fabricacao = dataHoje();

    // DEC-021: verificar se itens que precisam de validade do pacote já foram preenchidos
    for (const item of itens) {
      if (item.printed) continue;
      const lote = lotesEditados[item.id] || "";
      if (lote && precisaValidadePacote(item) && !validadesPacote[item.id]) {
        pedirValidadePacote(item);
        setImprimindo(false);
        return;
      }
    }

    // Gerar etiquetas (1 por quantidade)
    const etiquetas: EtiquetaDados[] = [];
    for (const item of itens) {
      if (item.printed) continue;
      const validade = validadeFinal(item);
      const lote = lotesEditados[item.id] || "";

      for (let i = 0; i < item.quantity; i++) {
        etiquetas.push({
          nome: item.item_name,
          fabricacao,
          validade,
          lote,
          info: item.item_additional_info || "",
          operador: produtor.trim().toUpperCase(),
        });
      }
    }

    if (etiquetas.length === 0) {
      alert("Todos os itens já foram impressos");
      setImprimindo(false);
      return;
    }

    // Gerar HTML e abrir popup de impressão
    const html = montarHtmlImpressao(etiquetas);
    const popup = window.open("", "_blank", "width=450,height=600");
    if (popup) {
      popup.document.write(html);
      popup.document.close();
      popup.onload = () => {
        popup.print();
      };
    }

    // Marcar itens como impressos (operator_initials guarda produtor + impressor)
    const idsNaoImpressos = itens.filter((i) => !i.printed).map((i) => i.id);
    await supabase
      .from("production_order_items")
      .update({
        printed: true,
        printed_at: new Date().toISOString(),
        operator_initials: `${produtor.trim().toUpperCase()}|${impressor.trim().toUpperCase()}`,
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
    if (!produtor.trim()) {
      alert("Informe as iniciais de quem fez a produção");
      return;
    }
    if (!impressor.trim()) {
      alert("Informe as iniciais de quem está imprimindo");
      return;
    }

    // DEC-021: verificar validade do pacote
    const lote = lotesEditados[item.id] || "";
    if (lote && precisaValidadePacote(item) && !validadesPacote[item.id]) {
      pedirValidadePacote(item);
      return;
    }

    const fabricacao = dataHoje();
    const validade = validadeFinal(item);

    const etiquetas: EtiquetaDados[] = [];
    for (let i = 0; i < item.quantity; i++) {
      etiquetas.push({
        nome: item.item_name,
        fabricacao,
        validade,
        lote,
        info: item.item_additional_info || "",
        operador: produtor.trim().toUpperCase(),
      });
    }

    const html = montarHtmlImpressao(etiquetas);
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
        operator_initials: `${produtor.trim().toUpperCase()}|${impressor.trim().toUpperCase()}`,
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
          {/* Campos obrigatórios: produtor + impressor */}
          <div className="bg-white rounded-2xl shadow-lg border border-[var(--verde)] p-5 mb-6">
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <label className="block text-xs font-semibold text-gray-500 mb-1">Quem fez a produção? * (vai na etiqueta)</label>
                <input
                  type="text"
                  value={produtor}
                  onChange={(e) => setProdutor(e.target.value.slice(0, 3))}
                  placeholder="Ex: RP"
                  maxLength={3}
                  className="w-full px-4 py-3 bg-[var(--bege)] border-none rounded-xl text-lg font-bold text-center uppercase focus:outline-none focus:ring-2 focus:ring-[var(--vermelho)]"
                />
              </div>
              <div className="flex-1">
                <label className="block text-xs font-semibold text-gray-500 mb-1">Quem está imprimindo? *</label>
                <input
                  type="text"
                  value={impressor}
                  onChange={(e) => setImpressor(e.target.value.slice(0, 3))}
                  placeholder="Ex: JC"
                  maxLength={3}
                  className="w-full px-4 py-3 bg-[var(--bege)] border-none rounded-xl text-lg font-bold text-center uppercase focus:outline-none focus:ring-2 focus:ring-[var(--vermelho)]"
                />
              </div>
              <button
                type="button"
                onClick={imprimirTodos}
                disabled={imprimindo || itensNaoImpressos.length === 0 || !produtor.trim() || !impressor.trim()}
                className={
                  "flex items-center gap-2 px-6 py-3.5 rounded-xl text-sm font-bold transition-all " +
                  (itensNaoImpressos.length === 0 || !produtor.trim() || !impressor.trim()
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
                          <label className="block text-[10px] font-semibold text-gray-400 mb-0.5">
                            {precisaValidadePacote(item) ? "Lote do Fabricante" : "Lote"}
                          </label>
                          <input
                            type="text"
                            value={lotesEditados[item.id] || ""}
                            onChange={(e) => atualizarLote(item.id, e.target.value)}
                            placeholder={precisaValidadePacote(item) ? "Lote do balde/saco" : "Lote"}
                            className="w-28 px-3 py-1.5 bg-[var(--bege)] border border-gray-200 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[var(--vermelho)]"
                          />
                        </div>
                        {precisaValidadePacote(item) && (
                          <div>
                            <label className="block text-[10px] font-semibold text-gray-400 mb-0.5">Val. Pacote</label>
                            <button
                              type="button"
                              onClick={() => pedirValidadePacote(item)}
                              className={
                                "px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer " +
                                (validadesPacote[item.id]
                                  ? "bg-green-100 text-green-700 border border-green-300"
                                  : "bg-amber-100 text-amber-700 border border-amber-300 animate-pulse")
                              }
                            >
                              {validadesPacote[item.id] || "Informar"}
                            </button>
                          </div>
                        )}
                        <button
                          type="button"
                          onClick={() => imprimirItem(item)}
                          disabled={!produtor.trim() || !impressor.trim()}
                          className={
                            "px-4 py-2 rounded-lg text-xs font-bold transition-all " +
                            (!produtor.trim() || !impressor.trim()
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

          {/* Indicadores de validade do pacote nos itens pendentes */}

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
                      {item.operator_initials?.includes("|")
                        ? `Prod: ${item.operator_initials.split("|")[0]} · Imp: ${item.operator_initials.split("|")[1]}`
                        : item.operator_initials
                      } · {item.printed_at ? new Date(item.printed_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : ""}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Modal: Validade do Pacote (DEC-021) */}
        {modalValidade && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-2xl shadow-2xl p-6 w-[90%] max-w-sm mx-auto">
              <h3 className="font-bold text-[var(--marrom)] text-lg mb-2 flex items-center gap-2">
                <span>📦</span> Validade do Pacote
              </h3>
              <p className="text-sm text-gray-600 mb-4">
                Informe a data de validade impressa no pacote/balde de <strong>{modalValidade.itemName}</strong>.
                A etiqueta usará a menor data entre esta e a calculada.
              </p>
              <input
                type="text"
                value={modalValInput}
                onChange={(e) => setModalValInput(e.target.value)}
                placeholder="DD/MM/AAAA"
                maxLength={10}
                className="w-full px-4 py-3 bg-[var(--bege)] border-none rounded-xl text-lg font-bold text-center focus:outline-none focus:ring-2 focus:ring-[var(--vermelho)] mb-4"
                autoFocus
                onKeyDown={(e) => {
                  // Auto-format: insere / após DD e MM
                  if (e.key !== "Backspace" && e.key !== "Delete") {
                    const v = modalValInput.replace(/\D/g, "");
                    if (v.length === 2 || v.length === 4) {
                      setModalValInput(modalValInput + "/");
                    }
                  }
                }}
              />
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => { setModalValidade(null); setModalValInput(""); }}
                  className="flex-1 py-3 bg-gray-100 text-gray-600 rounded-xl font-bold text-sm hover:bg-gray-200 cursor-pointer transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={confirmarValidadePacote}
                  disabled={!modalValInput.trim() || !parseDateBR(modalValInput)}
                  className={
                    "flex-1 py-3 rounded-xl font-bold text-sm transition-all " +
                    (modalValInput.trim() && parseDateBR(modalValInput)
                      ? "bg-[var(--vermelho)] text-white hover:bg-red-600 cursor-pointer"
                      : "bg-gray-200 text-gray-400 cursor-not-allowed")
                  }
                >
                  Confirmar
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </>
  );
}
