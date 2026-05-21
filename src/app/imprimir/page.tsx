"use client";

import NavBar from "@/components/NavBar";
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";

const ORG_SLUG = "gelateria";

// --- Tipos ---
interface Colaborador { id: string; name: string; active: boolean; }
interface Categoria { id: string; name: string; }
interface ItemDB {
  id: string; name: string; code: string | null; category_id: string | null;
  uses_label: boolean; uses_lot: boolean; uses_expiry: boolean;
  expiry_days: number | null; additional_info: string | null;
  uses_counting_label: boolean | null; storage_type: string | null;
  net_weight: string | null; unit: string | null;
}
interface ItemCarrinho {
  item: ItemDB;
  quantidade: number;
  produtores: string[]; // IDs dos colaboradores que produziram
  lote: string;
}

// --- Helpers ---
function iniciais(nome: string): string {
  const p = nome.trim().split(/\s+/);
  if (p.length === 1) return p[0].substring(0, 2).toUpperCase();
  return (p[0][0] + p[p.length - 1][0]).toUpperCase();
}

function arredondarPar(n: number): number {
  return n % 2 === 0 ? n : n + 1;
}

function dataHoje(): string {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

function calcValidade(diasValidade: number | null): string {
  if (!diasValidade) return "—";
  const d = new Date();
  d.setDate(d.getDate() + diasValidade);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

/** Encurta data de dd/mm/aaaa para dd/mm/aa */
function dataCurta(data: string): string {
  return data.replace(/\/(\d{4})$/, (_, ano: string) => "/" + ano.slice(2));
}

// --- Steps ---
type StepTipo = "producao" | "contagem" | null;
type Step = 1 | 2 | 3 | 4;

export default function ImprimirWizard() {
  // Data loading
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [todosItens, setTodosItens] = useState<ItemDB[]>([]);
  const [orgId, setOrgId] = useState("");
  const [loading, setLoading] = useState(true);

  // Wizard state
  const [step, setStep] = useState<Step>(1);
  const [tipo, setTipo] = useState<StepTipo>(null);
  const [emitente, setEmitente] = useState<Colaborador | null>(null);
  const [familiaSelecionada, setFamiliaSelecionada] = useState<string | null>(null);

  // Step 4: seleção de item
  const [modalItem, setModalItem] = useState<ItemDB | null>(null);
  const [modalProdutores, setModalProdutores] = useState<string[]>([]);
  const [modalQtd, setModalQtd] = useState(1);
  const [modalLote, setModalLote] = useState("");

  // Carrinho
  const [carrinho, setCarrinho] = useState<ItemCarrinho[]>([]);

  // Impressão
  const [imprimindo, setImprimindo] = useState(false);

  // --- Load data ---
  const carregar = useCallback(async () => {
    setLoading(true);
    const { data: org } = await supabase.from("organizations").select("id").eq("slug", ORG_SLUG).single();
    if (!org) { setLoading(false); return; }
    setOrgId(org.id);

    const [colabRes, catRes, itensRes] = await Promise.all([
      supabase.from("operators").select("*").eq("organization_id", org.id).eq("active", true).order("name"),
      supabase.from("categories").select("*").eq("organization_id", org.id).order("name"),
      supabase.from("items").select("*").eq("organization_id", org.id).eq("active", true).order("name"),
    ]);

    if (colabRes.data) setColaboradores(colabRes.data);
    if (catRes.data) setCategorias(catRes.data);
    if (itensRes.data) setTodosItens(itensRes.data);
    setLoading(false);
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  // --- Itens filtrados por tipo e família ---
  const itensFiltrados = todosItens.filter((item) => {
    // Filtro por tipo
    if (tipo === "contagem") {
      if (!item.uses_counting_label) return false;
    } else {
      // Produção: itens com etiqueta (excluir os que são só contagem)
      if (!item.uses_label) return false;
    }
    // Filtro por família
    if (familiaSelecionada) {
      if (familiaSelecionada === "__sem_familia__") return item.category_id === null;
      return item.category_id === familiaSelecionada;
    }
    return true;
  });

  // Famílias que têm itens do tipo selecionado
  const familiasComItens = (() => {
    const itensDoTipo = todosItens.filter((item) =>
      tipo === "contagem" ? item.uses_counting_label : item.uses_label
    );
    const catIds = new Set(itensDoTipo.map((i) => i.category_id));
    const cats = categorias.filter((c) => catIds.has(c.id));
    const temSemFamilia = itensDoTipo.some((i) => !i.category_id);
    return { cats, temSemFamilia };
  })();

  // --- Handlers ---
  function selecionarTipo(t: StepTipo) {
    setTipo(t);
    setStep(2);
  }

  function selecionarEmitente(c: Colaborador) {
    setEmitente(c);
    setStep(3);
  }

  function selecionarFamilia(catId: string | null) {
    setFamiliaSelecionada(catId);
    setStep(4);
  }

  function abrirModalItem(item: ItemDB) {
    setModalItem(item);
    setModalProdutores([]);
    setModalQtd(1);
    setModalLote("");
  }

  function toggleProdutor(id: string) {
    setModalProdutores((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function adicionarAoCarrinho() {
    if (!modalItem || modalProdutores.length === 0) return;
    const existente = carrinho.findIndex((c) => c.item.id === modalItem.id);
    if (existente >= 0) {
      setCarrinho((prev) => prev.map((c, i) =>
        i === existente ? { ...c, quantidade: c.quantidade + modalQtd, produtores: modalProdutores, lote: modalLote } : c
      ));
    } else {
      setCarrinho((prev) => [...prev, { item: modalItem, quantidade: modalQtd, produtores: modalProdutores, lote: modalLote }]);
    }
    setModalItem(null);
  }

  function removerDoCarrinho(idx: number) {
    setCarrinho((prev) => prev.filter((_, i) => i !== idx));
  }

  function ajustarQtd(idx: number, delta: number) {
    setCarrinho((prev) => prev.map((c, i) => {
      if (i !== idx) return c;
      const nova = Math.max(1, c.quantidade + delta);
      return { ...c, quantidade: nova };
    }));
  }

  function voltar() {
    if (step === 2) { setStep(1); setTipo(null); }
    else if (step === 3) { setStep(2); setEmitente(null); }
    else if (step === 4) { setStep(3); setFamiliaSelecionada(null); }
  }

  // Total de etiquetas (arredondado para par)
  const totalEtiquetas = carrinho.reduce((acc, c) => acc + arredondarPar(c.quantidade), 0);

  // Nome da família selecionada
  function nomeFamilia(catId: string | null): string {
    if (!catId || catId === "__sem_familia__") return "Sem família";
    const cat = categorias.find((c) => c.id === catId);
    return cat ? cat.name : "—";
  }

  // Iniciais dos produtores
  function iniciaisProdutores(ids: string[]): string {
    return ids.map((id) => {
      const c = colaboradores.find((x) => x.id === id);
      return c ? iniciais(c.name) : "??";
    }).join(" ");
  }

  // --- Gerar HTML de uma etiqueta individual (layout estabelecido) ---
  function gerarCelulaEtiqueta(
    nome: string, fabricacao: string, validade: string,
    lote: string, info: string, produtorIniciais: string, logoUrl: string
  ): string {
    const temInfo = !!info;
    const fNome = temInfo ? "16pt" : "18pt";
    const fLote = temInfo ? "9pt" : "10pt";
    const fInfo = "7pt";

    const operadorHTML = produtorIniciais
      ? `<div style="position:absolute;right:0;width:5mm;height:5mm;border:0.3pt solid #000;display:flex;align-items:center;justify-content:center;font-size:6pt;font-weight:bold;">${produtorIniciais}</div>`
      : "";

    const loteHTML = lote
      ? `<div style="font-size:${fLote};font-weight:bold;line-height:1.4;">Lote: ${lote}</div>`
      : "";

    const infoHTML = temInfo
      ? `<div style="font-size:${fInfo};font-style:italic;line-height:1.3;margin-top:0.5mm;">${info}</div>`
      : "";

    return `<div style="width:50mm;height:50mm;padding:2mm;box-sizing:border-box;font-family:Arial,sans-serif;display:flex;flex-direction:column;overflow:hidden;">
      <div style="font-family:Arial,sans-serif;font-weight:bold;font-size:${fNome};text-align:center;text-transform:uppercase;border-bottom:0.5pt solid #000;padding-bottom:0.5mm;line-height:1.15;flex:1;display:flex;align-items:center;justify-content:center;overflow:hidden;">${nome}</div>
      <div style="display:flex;flex-direction:column;align-items:center;padding-top:0.5mm;padding-bottom:0.5mm;">
        <div style="font-size:14pt;font-weight:bold;white-space:nowrap;line-height:1.2;text-transform:uppercase;">FAB: ${dataCurta(fabricacao)}</div>
        <div style="display:flex;align-items:center;width:100%;position:relative;">
          <div style="width:100%;text-align:center;font-size:14pt;font-weight:bold;white-space:nowrap;line-height:1.2;text-transform:uppercase;">VAL: ${dataCurta(validade)}</div>
          ${operadorHTML}
        </div>
      </div>
      <div style="display:flex;align-items:flex-start;">
        <div style="flex:1;">${loteHTML}${infoHTML}</div>
        <div style="display:flex;flex-direction:column;align-items:center;margin-left:1mm;">
          <div style="width:10mm;height:10mm;border:0.5pt solid #000;display:flex;align-items:center;justify-content:center;font-size:4pt;">QR</div>
          <img src="${logoUrl}" style="height:5mm;opacity:0.8;margin-top:0.5mm;" />
        </div>
      </div>
    </div>`;
  }

  // --- Impressão ---
  async function imprimirTudo() {
    if (carrinho.length === 0) return;
    setImprimindo(true);

    const fabricacao = dataHoje();
    const logoUrl = window.location.origin + "/logo-mo.png";

    // Gera células individuais de etiqueta
    const celulas: string[] = [];
    for (const item of carrinho) {
      const validade = calcValidade(item.item.expiry_days);
      const prods = iniciaisProdutores(item.produtores);

      for (let i = 0; i < item.quantidade; i++) {
        celulas.push(gerarCelulaEtiqueta(
          item.item.name, fabricacao, validade,
          item.lote, item.item.additional_info || "", prods, logoUrl
        ));
      }
    }

    // Arredonda para par (duplica última se ímpar) — DEC-023
    if (celulas.length % 2 !== 0) {
      celulas.push(celulas[celulas.length - 1]);
    }

    // Monta linhas de 2 etiquetas (107mm = 2mm + 50mm + 3mm + 50mm + 2mm)
    let linhas = "";
    for (let i = 0; i < celulas.length; i += 2) {
      linhas += `<div style="width:107mm;display:flex;padding-left:2mm;padding-right:2mm;gap:3mm;page-break-after:always;">${celulas[i]}${celulas[i + 1]}</div>`;
    }

    const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Impressão EtiquetaMO</title>
<style>
  @page { margin: 0; size: 107mm 50mm; }
  @media print { html, body { margin: 0; padding: 0; width: 107mm; } .no-print { display: none !important; } }
  html, body { margin: 0; padding: 0; }
</style>
</head>
<body>
${linhas}
<div class="no-print" style="text-align:center;padding:20px;">
  <button onclick="window.print()" style="padding:12px 32px;font-size:16px;font-weight:bold;background:#f31c40;color:white;border:none;border-radius:12px;cursor:pointer;">🖨️ Imprimir</button>
  <button onclick="window.close()" style="padding:12px 32px;font-size:16px;margin-left:12px;background:#98472d;color:white;border:none;border-radius:12px;cursor:pointer;">Fechar</button>
</div>
</body>
</html>`;

    const win = window.open("", "_blank");
    if (win) {
      win.document.write(html);
      win.document.close();
    }

    // Salvar no histórico
    if (orgId && emitente) {
      for (const item of carrinho) {
        await supabase.from("print_history").insert({
          organization_id: orgId,
          item_id: item.item.id,
          operator_id: emitente.id,
          product_name: item.item.name,
          fabrication_date: new Date().toISOString().split("T")[0],
          expiry_date: item.item.expiry_days ? (() => { const d = new Date(); d.setDate(d.getDate() + item.item.expiry_days!); return d.toISOString().split("T")[0]; })() : null,
          lot: item.lote || null,
          additional_info: item.item.additional_info || null,
          quantity: arredondarPar(item.quantidade),
        });
      }
    }

    setImprimindo(false);
  }

  // --- Render ---
  if (loading) {
    return (<><NavBar /><main className="min-h-screen bg-[var(--bege)] flex items-center justify-center"><p className="text-[var(--marrom)] font-medium animate-pulse">Carregando...</p></main></>);
  }

  return (
    <>
      <NavBar />
      <main className="min-h-screen bg-[var(--bege)]">
        {/* Header */}
        <div className="bg-gradient-to-r from-[var(--marrom)] to-[#7a3520] text-white px-6 py-6">
          <div className="max-w-6xl mx-auto">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-3xl">🖨️</span>
                <div>
                  <h1 className="text-2xl font-extrabold">Impressão de Etiquetas</h1>
                  <p className="text-base font-bold text-white mt-0.5">
                    {step === 1 && "👉 Escolha o tipo de etiqueta"}
                    {step === 2 && "👉 Quem está emitindo?"}
                    {step === 3 && "👉 Escolha a família de produtos"}
                    {step === 4 && `📦 ${nomeFamilia(familiaSelecionada)} — Adicione ao carrinho`}
                  </p>
                </div>
              </div>
              {/* Breadcrumb */}
              <div className="flex items-center gap-1.5 text-xs">
                <span className={step >= 1 ? "bg-white px-2.5 py-1 rounded-lg font-extrabold text-[var(--marrom)]" : "bg-white/10 px-2.5 py-1 rounded-lg text-white/50"}>1. Tipo</span>
                <span className="text-white/40">›</span>
                <span className={step >= 2 ? "bg-white px-2.5 py-1 rounded-lg font-extrabold text-[var(--marrom)]" : "bg-white/10 px-2.5 py-1 rounded-lg text-white/50"}>2. Emitente</span>
                <span className="text-white/40">›</span>
                <span className={step >= 3 ? "bg-white px-2.5 py-1 rounded-lg font-extrabold text-[var(--marrom)]" : "bg-white/10 px-2.5 py-1 rounded-lg text-white/50"}>3. Família</span>
                <span className="text-white/40">›</span>
                <span className={step >= 4 ? "bg-white px-2.5 py-1 rounded-lg font-extrabold text-[var(--marrom)]" : "bg-white/10 px-2.5 py-1 rounded-lg text-white/50"}>4. Produtos</span>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-6xl mx-auto px-6 -mt-4 pb-8">
          {/* Botão voltar */}
          {step > 1 && (
            <button onClick={voltar} className="flex items-center gap-1.5 text-sm text-white bg-[var(--marrom)] font-bold px-4 py-2 rounded-xl mb-4 mt-2 hover:bg-[#7a3520] cursor-pointer transition-all shadow-sm">
              ← Voltar
            </button>
          )}

          {/* ===== STEP 1: Tipo ===== */}
          {step === 1 && (
            <div className="grid grid-cols-2 gap-6 max-w-2xl mx-auto mt-8">
              <button onClick={() => selecionarTipo("producao")} className="bg-white rounded-2xl shadow-lg border-2 border-transparent hover:border-[var(--vermelho)] p-8 flex flex-col items-center gap-4 cursor-pointer transition-all hover:shadow-xl hover:-translate-y-1">
                <span className="text-6xl">🏭</span>
                <span className="text-xl font-extrabold text-[var(--marrom)]">Produção</span>
                <span className="text-sm text-gray-500 text-center">Etiquetas para produtos fabricados na cozinha</span>
              </button>
              <button onClick={() => selecionarTipo("contagem")} className="bg-white rounded-2xl shadow-lg border-2 border-transparent hover:border-[var(--vermelho)] p-8 flex flex-col items-center gap-4 cursor-pointer transition-all hover:shadow-xl hover:-translate-y-1">
                <span className="text-6xl">📋</span>
                <span className="text-xl font-extrabold text-[var(--marrom)]">Contagem</span>
                <span className="text-sm text-gray-500 text-center">Etiquetas de identificação e contagem de estoque</span>
              </button>
            </div>
          )}

          {/* ===== STEP 2: Emitente ===== */}
          {step === 2 && (
            <div className="max-w-3xl mx-auto mt-4">
              {colaboradores.length === 0 ? (
                <div className="text-center py-16 bg-white rounded-2xl shadow-lg">
                  <span className="text-6xl block mb-4">👥</span>
                  <h2 className="text-xl font-bold text-[var(--marrom)] mb-2">Nenhum colaborador cadastrado</h2>
                  <p className="text-gray-500 text-sm mb-4">Cadastre a equipe antes de imprimir.</p>
                  <a href="/colaboradores" className="px-6 py-3 bg-[var(--vermelho)] text-white rounded-xl font-bold inline-block">Ir para Equipe</a>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  {colaboradores.map((c) => (
                    <button key={c.id} onClick={() => selecionarEmitente(c)} className="bg-white rounded-2xl shadow-md border-2 border-transparent hover:border-[var(--vermelho)] p-5 flex flex-col items-center gap-3 cursor-pointer transition-all hover:shadow-lg hover:-translate-y-0.5">
                      <div className="w-16 h-16 flex items-center justify-center bg-[var(--vermelho)] text-white font-extrabold text-xl rounded-2xl shadow-sm">
                        {iniciais(c.name)}
                      </div>
                      <span className="text-base font-bold text-[var(--marrom)]">{c.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ===== STEP 3: Família ===== */}
          {step === 3 && (
            <div className="max-w-4xl mx-auto mt-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {familiasComItens.cats.map((cat) => {
                  const count = todosItens.filter((i) =>
                    i.category_id === cat.id && (tipo === "contagem" ? i.uses_counting_label : i.uses_label)
                  ).length;
                  return (
                    <button key={cat.id} onClick={() => selecionarFamilia(cat.id)} className="bg-white rounded-2xl shadow-md border-2 border-transparent hover:border-[var(--vermelho)] p-5 flex flex-col items-center gap-2 cursor-pointer transition-all hover:shadow-lg hover:-translate-y-0.5">
                      <span className="text-3xl">🏷️</span>
                      <span className="text-base font-bold text-[var(--marrom)] text-center leading-tight">{cat.name}</span>
                      <span className="text-xs text-gray-400">{count} {count === 1 ? "item" : "itens"}</span>
                    </button>
                  );
                })}
                {familiasComItens.temSemFamilia && (
                  <button onClick={() => selecionarFamilia("__sem_familia__")} className="bg-white rounded-2xl shadow-md border-2 border-transparent hover:border-[var(--vermelho)] p-5 flex flex-col items-center gap-2 cursor-pointer transition-all hover:shadow-lg hover:-translate-y-0.5">
                    <span className="text-3xl">📦</span>
                    <span className="text-base font-bold text-[var(--marrom)]">Sem família</span>
                    <span className="text-xs text-gray-400">
                      {todosItens.filter((i) => !i.category_id && (tipo === "contagem" ? i.uses_counting_label : i.uses_label)).length} itens
                    </span>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* ===== STEP 4: Produtos + Carrinho ===== */}
          {step === 4 && (
            <div className="flex gap-6 mt-2">
              {/* Lista de produtos */}
              <div className="flex-1">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-bold text-[var(--marrom)] text-lg">{nomeFamilia(familiaSelecionada)}</h3>
                  <button onClick={() => { setFamiliaSelecionada(null); setStep(3); }} className="px-4 py-2 bg-[var(--marrom)] text-white text-sm font-bold rounded-xl cursor-pointer hover:bg-[#7a3520] transition-all shadow-sm">
                    🏷️ Trocar família
                  </button>
                </div>
                <div className="space-y-2">
                  {itensFiltrados.length === 0 ? (
                    <div className="text-center py-12 bg-white rounded-xl">
                      <p className="text-gray-500">Nenhum item nesta família para {tipo}.</p>
                    </div>
                  ) : (
                    itensFiltrados.map((item) => {
                      const noCarrinho = carrinho.some((c) => c.item.id === item.id);
                      return (
                        <button
                          key={item.id}
                          onClick={() => abrirModalItem(item)}
                          className={
                            "w-full text-left bg-white rounded-xl shadow-sm px-4 py-3 flex items-center justify-between cursor-pointer transition-all hover:shadow-md " +
                            (noCarrinho ? "border-2 border-green-400 bg-green-50" : "border border-gray-100 hover:border-[var(--vermelho)]")
                          }
                        >
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-[var(--marrom)] text-sm truncate">{item.name}</p>
                            <p className="text-[10px] text-gray-400">
                              {item.expiry_days ? `${item.expiry_days}d validade` : "Sem validade"}
                              {item.uses_lot ? " · Lote" : ""}
                              {item.storage_type && item.storage_type !== "ambiente" ? ` · ${item.storage_type === "congelado" ? "🧊" : "❄️"}` : ""}
                            </p>
                          </div>
                          {noCarrinho ? (
                            <span className="text-xs font-bold text-green-600 bg-green-100 px-2 py-1 rounded-lg">✓ No carrinho</span>
                          ) : (
                            <span className="text-xs font-bold text-[var(--vermelho)]">+ Adicionar</span>
                          )}
                        </button>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Carrinho lateral */}
              <div className="w-80 shrink-0">
                <div className="bg-white rounded-2xl shadow-lg border-2 border-[var(--verde)] sticky top-4">
                  <div className="bg-[var(--verde)] px-4 py-3 rounded-t-2xl">
                    <h3 className="font-bold text-[var(--marrom)] text-sm flex items-center gap-2">
                      🛒 Carrinho <span className="ml-auto bg-[var(--marrom)] text-white text-xs px-2 py-0.5 rounded-full">{carrinho.length}</span>
                    </h3>
                  </div>
                  <div className="p-4 max-h-[400px] overflow-y-auto">
                    {carrinho.length === 0 ? (
                      <p className="text-center text-gray-400 text-sm py-6">Nenhum item adicionado</p>
                    ) : (
                      <div className="space-y-3">
                        {carrinho.map((c, idx) => (
                          <div key={idx} className="bg-[var(--bege)] rounded-xl p-3">
                            <div className="flex items-start justify-between gap-2">
                              <p className="font-bold text-[var(--marrom)] text-xs leading-tight flex-1">{c.item.name}</p>
                              <button onClick={() => removerDoCarrinho(idx)} className="text-red-400 hover:text-red-600 text-xs cursor-pointer">✕</button>
                            </div>
                            <div className="flex items-center justify-between mt-2">
                              <div className="flex items-center gap-2">
                                <button onClick={() => ajustarQtd(idx, -1)} className="w-7 h-7 flex items-center justify-center bg-white rounded-lg text-[var(--marrom)] font-bold shadow-sm cursor-pointer hover:bg-gray-100">−</button>
                                <span className="text-sm font-extrabold text-[var(--marrom)] w-6 text-center">{c.quantidade}</span>
                                <button onClick={() => ajustarQtd(idx, 1)} className="w-7 h-7 flex items-center justify-center bg-white rounded-lg text-[var(--marrom)] font-bold shadow-sm cursor-pointer hover:bg-gray-100">+</button>
                              </div>
                              <span className="text-[10px] text-gray-500">
                                → {arredondarPar(c.quantidade)} etiq.
                              </span>
                            </div>
                            <p className="text-[10px] text-gray-400 mt-1">
                              Prod: <span className="font-bold text-[var(--marrom)]">{iniciaisProdutores(c.produtores)}</span>
                              {c.lote && <> · Lote: {c.lote}</>}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  {carrinho.length > 0 && (
                    <div className="border-t border-gray-200 p-4">
                      <div className="flex justify-between text-sm mb-3">
                        <span className="text-gray-500">Total de etiquetas:</span>
                        <span className="font-extrabold text-[var(--marrom)]">{totalEtiquetas}</span>
                      </div>
                      <div className="flex justify-between text-[10px] text-gray-400 mb-3">
                        <span>Emitente: {emitente?.name}</span>
                        <span>{dataHoje()}</span>
                      </div>
                      <button
                        onClick={imprimirTudo}
                        disabled={imprimindo}
                        className={"w-full py-3 rounded-xl font-extrabold text-base cursor-pointer transition-all shadow-lg " + (imprimindo ? "bg-gray-300 text-gray-500" : "bg-[var(--vermelho)] text-white hover:bg-red-600 hover:shadow-xl")}
                      >
                        {imprimindo ? "Preparando..." : `🖨️ Imprimir ${totalEtiquetas} Etiquetas`}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ===== Modal: Adicionar ao Carrinho ===== */}
          {modalItem && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setModalItem(null)}>
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden" onClick={(e) => e.stopPropagation()}>
                <div className="bg-[var(--marrom)] px-5 py-4 text-white">
                  <h3 className="font-bold text-lg">{modalItem.name}</h3>
                  <p className="text-xs opacity-70">
                    {modalItem.expiry_days ? `Validade: ${modalItem.expiry_days} dias` : "Sem validade definida"}
                    {modalItem.uses_lot ? " · Precisa de lote" : ""}
                  </p>
                </div>
                <div className="p-5 space-y-4">
                  {/* Quem produziu */}
                  <div>
                    <label className="text-sm font-semibold text-[var(--marrom)] mb-2 block">Quem produziu? <span className="text-[var(--vermelho)]">*</span></label>
                    <div className="flex flex-wrap gap-2">
                      {colaboradores.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => toggleProdutor(c.id)}
                          className={
                            "flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-bold cursor-pointer transition-all " +
                            (modalProdutores.includes(c.id)
                              ? "bg-[var(--vermelho)] text-white shadow-md"
                              : "bg-[var(--bege)] text-[var(--marrom)] hover:bg-gray-200")
                          }
                        >
                          <span className="w-7 h-7 flex items-center justify-center bg-white/20 rounded-lg text-xs font-extrabold">
                            {iniciais(c.name)}
                          </span>
                          {c.name.split(" ")[0]}
                        </button>
                      ))}
                    </div>
                    {modalProdutores.length === 0 && (
                      <p className="text-xs text-[var(--vermelho)] mt-1">Selecione pelo menos um produtor</p>
                    )}
                  </div>

                  {/* Lote (se necessário) */}
                  {modalItem.uses_lot && (
                    <div>
                      <label className="text-sm font-semibold text-[var(--marrom)] mb-1.5 block">Lote do fabricante</label>
                      <input
                        type="text"
                        value={modalLote}
                        onChange={(e) => setModalLote(e.target.value)}
                        placeholder="Ex: LT2026-05A"
                        className="w-full px-4 py-3 bg-gray-100 border-2 border-gray-200 rounded-xl text-sm font-medium focus:outline-none focus:border-[var(--vermelho)] focus:bg-white transition-all"
                      />
                    </div>
                  )}

                  {/* Quantidade */}
                  <div>
                    <label className="text-sm font-semibold text-[var(--marrom)] mb-2 block">Quantidade</label>
                    <div className="flex items-center gap-4 justify-center">
                      <button onClick={() => setModalQtd(Math.max(1, modalQtd - 1))} className="w-12 h-12 flex items-center justify-center bg-[var(--bege)] rounded-xl text-xl font-bold text-[var(--marrom)] cursor-pointer hover:bg-gray-200 transition-all">−</button>
                      <span className="text-3xl font-extrabold text-[var(--marrom)] w-16 text-center">{modalQtd}</span>
                      <button onClick={() => setModalQtd(modalQtd + 1)} className="w-12 h-12 flex items-center justify-center bg-[var(--bege)] rounded-xl text-xl font-bold text-[var(--marrom)] cursor-pointer hover:bg-gray-200 transition-all">+</button>
                    </div>
                    <p className="text-center text-xs text-gray-400 mt-1">
                      Serão impressas <span className="font-bold text-[var(--marrom)]">{arredondarPar(modalQtd)}</span> etiquetas (par na bobina)
                    </p>
                  </div>
                </div>

                {/* Footer */}
                <div className="border-t border-gray-200 px-5 py-4 flex gap-3">
                  <button
                    onClick={adicionarAoCarrinho}
                    disabled={modalProdutores.length === 0}
                    className={"flex-1 py-3 rounded-xl font-bold text-sm cursor-pointer transition-all " + (modalProdutores.length === 0 ? "bg-gray-200 text-gray-400" : "bg-[var(--vermelho)] text-white hover:bg-red-600 shadow-lg")}
                  >
                    🛒 Adicionar ao Carrinho
                  </button>
                  <button onClick={() => setModalItem(null)} className="px-6 py-3 rounded-xl font-bold text-sm bg-gray-100 text-gray-600 hover:bg-gray-200 cursor-pointer transition-all">
                    Cancelar
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </>
  );
}
