"use client";

import NavBar from "@/components/NavBar";
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { dataHoje, calcValidade, dataCurta } from "@/lib/dateUtils";
import { gerarCelulaEtiqueta, gerarCelulaAvulsa, type DadosEtiquetaProduto, type DadosEtiquetaAvulsa } from "@/lib/labelHtml";

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
  uses_complementary_label: boolean | null; complementary_label_text: string | null;
  is_portioned: boolean | null;
}
interface CampoOpcional {
  label: string;
  valor: string;
}
interface DadosComplementar {
  nome: string;
  quantidade: string | null;
  campos: CampoOpcional[];
  campoExtra: string | null;
}
interface ItemCarrinho {
  item: ItemDB;
  quantidade: number;
  produtores: string[];
  lote: string;
  tipoEtiqueta: "normal" | "contagem";
  infoComplementar: string;
  incluirComplementar: boolean;
  complementarDados: DadosComplementar | null;
  pesoOverride: string;
  unidadeOverride: string;
  incluirPeso: boolean;
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

function normalizar(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}



// dateUtils e labelHtml importados do módulo compartilhado

/** Famílias com regras especiais (comparação case-insensitive) */
const FAMILIAS_CONTAGEM_OPCIONAL = ["barra de gelatos", "food service"];
const FAMILIA_USO_CONSUMO = "uso e consumo";
const FAMILIA_INSUMOS = "insumos";

/**
 * Determina se o campo "produtor" é obrigatório, opcional ou oculto.
 * Regras:
 *   Contagem → oculto por padrão; opcional para Barra de Gelatos e Food Service
 *   Produção → oculto para Uso e Consumo; opcional para Insumos; obrigatório para o resto
 */
function regrasProdutor(modo: StepTipo, categoriaNome: string): "obrigatorio" | "opcional" | "oculto" {
  const cat = categoriaNome.toLowerCase().trim();
  if (modo === "contagem") {
    if (FAMILIAS_CONTAGEM_OPCIONAL.some((f) => cat === f)) return "opcional";
    return "oculto";
  }
  // Produção
  if (cat === FAMILIA_USO_CONSUMO) return "oculto";
  if (cat === FAMILIA_INSUMOS) return "opcional";
  return "obrigatorio";
}

// --- Steps ---
type StepTipo = "producao" | "contagem" | "ordem_producao" | null;
type Step = 1 | 2 | 3 | 4;

const CAMPOS_PRESET_COMPL = [
  { label: "Lote", placeholder: "Ex: LOTE-2024-01" },
  { label: "Fabricação", placeholder: "Ex: 21/05/2026", autoFill: true },
  { label: "Validade", placeholder: "Ex: 28/05/2026" },
  { label: "Peso", placeholder: "Ex: 5kg" },
];

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
  const [modalTipoEtiqueta, setModalTipoEtiqueta] = useState<"normal" | "contagem">("normal");
  const [modalInfoComplementar, setModalInfoComplementar] = useState("");
  const [modalIncluirComplementar, setModalIncluirComplementar] = useState(false);
  const [modalComplNome, setModalComplNome] = useState("");
  const [modalComplUsarQtd, setModalComplUsarQtd] = useState(false);
  const [modalComplQtd, setModalComplQtd] = useState("");
  const [modalComplCampos, setModalComplCampos] = useState<CampoOpcional[]>([]);
  const [modalComplUsarExtra, setModalComplUsarExtra] = useState(false);
  const [modalComplExtra, setModalComplExtra] = useState("");
  const [modalPeso, setModalPeso] = useState("");
  const [modalUnidade, setModalUnidade] = useState("");
  const [modalIncluirPeso, setModalIncluirPeso] = useState(false);

  // Carrinho
  const [buscaItem, setBuscaItem] = useState("");
  const [carrinho, setCarrinho] = useState<ItemCarrinho[]>([]);

  // Fila de OP (Ordem de Produção via webhook OMIE)
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
  const [filaOP, setFilaOP] = useState<PrintQueueItem[]>([]);
  const [opSelecionada, setOpSelecionada] = useState<PrintQueueItem | null>(null);
  const [opVinculando, setOpVinculando] = useState<string | null>(null);
  const [opBuscaVinc, setOpBuscaVinc] = useState("");

  // PIN de segurança
  const [pinModal, setPinModal] = useState<Colaborador | null>(null);
  const [pinInput, setPinInput] = useState("");
  const [pinErro, setPinErro] = useState(false);

  // Edição de item no carrinho
  const [editandoIdx, setEditandoIdx] = useState<number | null>(null);

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

    // Carregar fila de OP pendente
    const { data: opData } = await supabase
      .from("omie_print_queue")
      .select("*")
      .eq("organization_id", org.id)
      .eq("status", "pending")
      .order("created_at", { ascending: false });

    const ops = (opData || []) as PrintQueueItem[];
    const itensLocal = itensRes.data || [];

    // Auto-vincular OPs sem item_id usando match por nome
    for (const op of ops) {
      if (op.item_id) continue; // já vinculado
      const nomeOP = normalizar(op.product_name);
      // Tentar match: nome do item contido no nome OMIE ou vice-versa
      const matches = itensLocal.filter((it: ItemDB) => {
        const nomeItem = normalizar(it.name);
        return nomeOP.includes(nomeItem) || nomeItem.includes(nomeOP);
      });
      let bestMatch: ItemDB | null = null;
      if (matches.length === 1) {
        bestMatch = matches[0] as ItemDB;
      } else if (matches.length > 1) {
        // Pegar o mais específico (nome mais longo)
        bestMatch = matches.sort((a: ItemDB, b: ItemDB) => b.name.length - a.name.length)[0] as ItemDB;
      }
      if (bestMatch) {
        // Atualizar no banco e na memória
        op.item_id = bestMatch.id;
        supabase.from("omie_print_queue").update({ item_id: bestMatch.id }).eq("id", op.id);
      }
    }

    setFilaOP(ops);

    setLoading(false);
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  // --- Itens filtrados por tipo e família ---
  const itensFiltrados = todosItens.filter((item) => {
    // Filtro por tipo
    if (tipo === "contagem") {
      if (!item.uses_counting_label) return false;
    } else {
      if (!item.uses_label) return false;
    }
    // Filtro por família
    if (familiaSelecionada) {
      if (familiaSelecionada === "__sem_familia__") { if (item.category_id !== null) return false; }
      else if (item.category_id !== familiaSelecionada) return false;
    }
    // Filtro por busca
    if (buscaItem.trim()) {
      if (!item.name.toLowerCase().includes(buscaItem.trim().toLowerCase())) return false;
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

  const EMITENTES_COM_PIN = ["ricardo", "maria silvania"];
  const PIN_CORRETO = "4109";

  function selecionarEmitente(c: Colaborador) {
    const nomeNorm = c.name.toLowerCase().trim();
    if (EMITENTES_COM_PIN.some((n) => nomeNorm.includes(n))) {
      setPinModal(c);
      setPinInput("");
      setPinErro(false);
      return;
    }
    setEmitente(c);
    setStep(3);
  }

  function confirmarPin() {
    if (pinInput === PIN_CORRETO && pinModal) {
      setEmitente(pinModal);
      setPinModal(null);
      setPinInput("");
      setPinErro(false);
      setStep(3);
    } else {
      setPinErro(true);
    }
  }

  function selecionarFamilia(catId: string | null) {
    setFamiliaSelecionada(catId); setBuscaItem("");
    setStep(4);
  }

  // Nome da categoria pelo ID (para regras de produtor)
  function nomeCategoriaPorId(catId: string | null): string {
    if (!catId) return "";
    const cat = categorias.find((c) => c.id === catId);
    return cat ? cat.name : "";
  }

  function abrirModalItem(item: ItemDB) {
    setModalItem(item);
    setModalProdutores([]);
    setModalQtd(1);
    setModalLote("");
    const armazInfo = textoArmazenagem(item.storage_type);
    const addInfo = item.additional_info || "";
    setModalInfoComplementar(addInfo ? `${armazInfo} | ${addInfo}` : armazInfo);
    setModalTipoEtiqueta(tipo === "contagem" ? "contagem" : "normal");
    setModalIncluirComplementar(false);
    setModalComplNome(item.complementary_label_text || item.name);
    setModalComplUsarQtd(false);
    setModalComplQtd("");
    setModalComplCampos([]);
    setModalComplUsarExtra(false);
    setModalComplExtra("");
    setModalPeso(item.net_weight || "");
    setModalUnidade(item.unit || "");
    setModalIncluirPeso(false);
  }

  function toggleProdutor(id: string) {
    setModalProdutores((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function adicionarAoCarrinho() {
    if (!modalItem) return;
    const catNome = nomeCategoriaPorId(modalItem.category_id);
    const regra = regrasProdutor(tipo, catNome);
    // Bloqueia só se obrigatório e vazio
    if (regra === "obrigatorio" && modalProdutores.length === 0) return;

    const complDados: DadosComplementar | null = modalIncluirComplementar ? {
      nome: modalComplNome || modalItem.name,
      quantidade: modalComplUsarQtd ? (modalComplQtd || "0") : null,
      campos: modalComplCampos.filter((c) => c.valor.trim()),
      campoExtra: modalComplUsarExtra ? modalComplExtra : null,
    } : null;
    const novoItem: ItemCarrinho = {
      item: modalItem, quantidade: modalQtd, produtores: modalProdutores, lote: modalLote,
      tipoEtiqueta: modalTipoEtiqueta, infoComplementar: modalInfoComplementar,
      incluirComplementar: modalIncluirComplementar, complementarDados: complDados,
      pesoOverride: modalPeso, unidadeOverride: modalUnidade, incluirPeso: modalIncluirPeso,
    };
    if (editandoIdx !== null) {
      // Modo edição: substituir item no índice
      setCarrinho((prev) => prev.map((c, i) => i === editandoIdx ? novoItem : c));
      setEditandoIdx(null);
    } else {
      const existente = carrinho.findIndex((c) => c.item.id === modalItem.id && c.tipoEtiqueta === modalTipoEtiqueta);
      if (existente >= 0) {
        setCarrinho((prev) => prev.map((c, i) =>
          i === existente ? { ...novoItem, quantidade: c.quantidade + modalQtd } : c
        ));
      } else {
        setCarrinho((prev) => [...prev, novoItem]);
      }
    }
    // Se veio de uma OP, marcar como processada
    if (opSelecionada) {
      supabase.from("omie_print_queue").update({ status: "queued" }).eq("id", opSelecionada.id);
      setFilaOP((prev) => prev.filter((p) => p.id !== opSelecionada.id));
      setOpSelecionada(null);
    }
    setModalItem(null);
  }

  function removerDoCarrinho(idx: number) {
    setCarrinho((prev) => prev.filter((_, i) => i !== idx));
  }

  function editarItemCarrinho(idx: number) {
    const c = carrinho[idx];
    if (!c) return;
    setEditandoIdx(idx);
    abrirModalItem(c.item);
    setModalQtd(c.quantidade);
    setModalLote(c.lote);
    setModalTipoEtiqueta(c.tipoEtiqueta);
    setModalInfoComplementar(c.infoComplementar);
    setModalIncluirComplementar(c.incluirComplementar);
    setModalProdutores(c.produtores);
    setModalPeso(c.pesoOverride);
    setModalUnidade(c.unidadeOverride);
    setModalIncluirPeso(c.incluirPeso);
    if (c.complementarDados) {
      setModalComplNome(c.complementarDados.nome);
      setModalComplUsarQtd(!!c.complementarDados.quantidade);
      setModalComplQtd(c.complementarDados.quantidade || "");
      setModalComplCampos(c.complementarDados.campos.length > 0 ? c.complementarDados.campos : [{ label: "", valor: "" }]);
      setModalComplUsarExtra(!!c.complementarDados.campoExtra);
      setModalComplExtra(c.complementarDados.campoExtra || "");
    }
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
    else if (step === 3) {
      if (tipo === "ordem_producao") { setStep(1); setTipo(null); setEmitente(null); }
      else { setStep(2); setEmitente(null); }
    }
    else if (step === 4) {
      if (tipo === "ordem_producao") { setStep(2); setEmitente(null); }
      else { setStep(3); setFamiliaSelecionada(null); setBuscaItem(""); }
    }
  }

  // Abrir modal de configuração para item de OP
  function abrirModalOP(op: PrintQueueItem, item: ItemDB) {
    setOpSelecionada(op);
    setOpVinculando(null);
    setOpBuscaVinc("");
    abrirModalItem(item);
    // Pré-preencher dados da OP
    if (op.lot) setModalLote(op.lot);
    if (op.quantity > 1) setModalQtd(op.quantity);
  }

  function pularOP(opId: string) {
    supabase.from("omie_print_queue").update({ status: "skipped" }).eq("id", opId);
    setFilaOP((prev) => prev.filter((p) => p.id !== opId));
    if (opVinculando === opId) { setOpVinculando(null); setOpBuscaVinc(""); }
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

  function textoArmazenagem(tipo: string | null): string {
    if (tipo === "congelado") return "Conservar congelado (-12°C a -18°C)";
    if (tipo === "refrigerado") return "Conservar refrigerado (0°C a 5°C)";
    return "Conservar em temperatura ambiente (até 25°C)";
  }

  // Layout de etiquetas: importado de @/lib/labelHtml (fonte de verdade)

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
      const qrCode = item.item.code || "";

      for (let i = 0; i < item.quantidade; i++) {
        celulas.push(gerarCelulaEtiqueta({
          nome: item.item.name, fabricacao, validade,
          lote: item.lote, info: item.infoComplementar || "", produtorIniciais: prods, logoUrl,
          qrCode,
        }));
      }
      // Etiquetas complementares (mesma qtd)
      if (item.incluirComplementar && item.complementarDados) {
        for (let i = 0; i < item.quantidade; i++) {
          celulas.push(gerarCelulaAvulsa({
            nome: item.complementarDados.nome,
            quantidade: item.complementarDados.quantidade,
            campos: item.complementarDados.campos,
            campoExtra: item.complementarDados.campoExtra,
            logoUrl
          }));
        }
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
  <button onclick="window.print()" style="padding:12px 32px;font-size:16px;font-weight:bold;background:#f31c40;color:white;border:none;border-radius:12px;cursor:pointer;">🖨️ Imprimir novamente</button>
  <button onclick="window.close()" style="padding:12px 32px;font-size:16px;margin-left:12px;background:#98472d;color:white;border:none;border-radius:12px;cursor:pointer;">Fechar</button>
</div>
<script src="https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.min.js"></script>
<script>
(function(){
  var els = document.querySelectorAll('.qr-placeholder');
  for(var i=0;i<els.length;i++){
    var code = els[i].getAttribute('data-qr');
    if(!code) continue;
    try {
      var qr = qrcode(0,'M');
      qr.addData(code);
      qr.make();
      var img = qr.createImgTag(2,0);
      els[i].innerHTML = img;
      els[i].querySelector('img').style.cssText = 'width:10mm;height:10mm;';
    } catch(e) {
      els[i].innerHTML = '<div style="width:10mm;height:10mm;border:0.5pt solid #000;display:flex;align-items:center;justify-content:center;font-size:5pt;font-weight:bold;">'+code+'</div>';
    }
  }
  setTimeout(function(){window.print()},600);
  window.onafterprint=function(){window.close();};
})();
</script>
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

    setCarrinho([]);
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
        <div className="bg-gradient-to-r from-[var(--vermelho)] to-[#d41636] text-white px-6 py-6">
          <div className="max-w-6xl mx-auto">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-3xl">🖨️</span>
                <div>
                  <h1 className="text-2xl font-extrabold">Impressão de Etiquetas</h1>
                  <p className="text-base font-bold text-white mt-0.5">
                    {step === 1 && "👉 Escolha o tipo de etiqueta"}
                    {step === 2 && "👉 Quem está emitindo?"}
                    {step === 3 && (tipo === "ordem_producao" ? "👉 Selecione as ordens de produção" : "👉 Escolha a família de produtos")}
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
                <span className={step >= 3 ? "bg-white px-2.5 py-1 rounded-lg font-extrabold text-[var(--marrom)]" : "bg-white/10 px-2.5 py-1 rounded-lg text-white/50"}>3. {tipo === "ordem_producao" ? "Ordens" : "Família"}</span>
                {tipo !== "ordem_producao" && (
                  <>
                    <span className="text-white/40">›</span>
                    <span className={step >= 4 ? "bg-white px-2.5 py-1 rounded-lg font-extrabold text-[var(--marrom)]" : "bg-white/10 px-2.5 py-1 rounded-lg text-white/50"}>4. Produtos</span>
                  </>
                )}
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
            <div className="grid grid-cols-3 gap-6 max-w-3xl mx-auto mt-8">
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
              <button onClick={() => selecionarTipo("ordem_producao")} className="bg-white rounded-2xl shadow-lg border-2 border-transparent hover:border-[var(--vermelho)] p-8 flex flex-col items-center gap-4 cursor-pointer transition-all hover:shadow-xl hover:-translate-y-1 relative">
                <span className="text-6xl">📋🏭</span>
                <span className="text-xl font-extrabold text-[var(--marrom)]">Ordem de Produção</span>
                <span className="text-sm text-gray-500 text-center">Ordens recebidas automaticamente do OMIE</span>
                {filaOP.length > 0 && (
                  <span className="absolute top-3 right-3 bg-[var(--vermelho)] text-white text-xs px-2.5 py-1 rounded-full font-bold animate-pulse">
                    {filaOP.length}
                  </span>
                )}
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

          {/* ===== STEP 3 (OP): Fila de Ordens de Produção ===== */}
          {step === 3 && tipo === "ordem_producao" && (
            <div className="flex gap-6 mt-2">
              <div className="flex-1">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-[var(--marrom)] text-lg">Ordens de Produção Pendentes</h3>
                  {filaOP.length > 0 && (
                    <span className="bg-[var(--vermelho)] text-white text-xs px-3 py-1 rounded-full font-bold">
                      {filaOP.length} pendente{filaOP.length > 1 ? "s" : ""}
                    </span>
                  )}
                </div>

                {filaOP.length === 0 ? (
                  <div className="bg-white rounded-2xl p-8 shadow-md text-center">
                    <span className="text-4xl block mb-2">✅</span>
                    <p className="text-[var(--marrom)] font-semibold">Nenhuma ordem pendente</p>
                    <p className="text-sm text-gray-500 mt-1">Quando o OMIE enviar novas ordens de produção, elas aparecerão aqui.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {filaOP.map((op) => {
                      const itemVinculado = op.item_id ? todosItens.find((i) => i.id === op.item_id) : null;
                      const jaNoCarrinho = itemVinculado ? carrinho.some((c) => c.item.id === itemVinculado.id) : false;
                      const isVinculando = opVinculando === op.id;
                      const itensVincBusca = isVinculando ? todosItens.filter((i) =>
                        opBuscaVinc.trim() ? i.name.toLowerCase().includes(opBuscaVinc.trim().toLowerCase()) : true
                      ).slice(0, 10) : [];
                      return (
                        <div key={op.id} className={"bg-white rounded-xl p-4 shadow-sm border-l-4 " + (jaNoCarrinho ? "border-green-400 bg-green-50" : "border-[var(--vermelho)]")}>
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-semibold text-[var(--marrom)]">{op.product_name}</p>
                              <p className="text-xs text-gray-500">
                                {op.omie_order_number && `OP #${op.omie_order_number} · `}
                                Qtd: {op.quantity}
                                {op.lot && ` · Lote: ${op.lot}`}
                                {" · "}
                                {new Date(op.created_at).toLocaleString("pt-BR")}
                              </p>
                              {!itemVinculado && !isVinculando && (
                                <p className="text-xs text-orange-600 font-medium mt-1">⚠️ Item não vinculado — clique em Vincular para associar</p>
                              )}
                              {jaNoCarrinho && (
                                <p className="text-xs text-green-600 font-bold mt-1">✓ No carrinho</p>
                              )}
                            </div>
                            <div className="flex gap-2 shrink-0">
                              {itemVinculado && !jaNoCarrinho && (
                                <button onClick={() => abrirModalOP(op, itemVinculado)}
                                  className="text-xs px-3 py-1.5 rounded-lg bg-[var(--vermelho)] text-white hover:opacity-90 transition-colors font-semibold cursor-pointer">
                                  🛒 Configurar
                                </button>
                              )}
                              {!itemVinculado && !isVinculando && (
                                <button onClick={() => { setOpVinculando(op.id); setOpBuscaVinc(""); }}
                                  className="text-xs px-3 py-1.5 rounded-lg bg-blue-500 text-white hover:bg-blue-600 transition-colors font-semibold cursor-pointer">
                                  🔗 Vincular
                                </button>
                              )}
                              <button onClick={() => pularOP(op.id)}
                                className="text-xs px-3 py-1.5 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors cursor-pointer">
                                Pular
                              </button>
                            </div>
                          </div>
                          {/* Busca inline para vincular item não-vinculado */}
                          {isVinculando && (
                            <div className="mt-3 pt-3 border-t border-gray-100">
                              <p className="text-[10px] font-bold text-blue-600 mb-1.5">Selecione o item correspondente no EtiquetaMO:</p>
                              <input
                                type="text"
                                placeholder="🔍 Buscar item..."
                                value={opBuscaVinc}
                                onChange={(e) => setOpBuscaVinc(e.target.value)}
                                autoFocus
                                className="w-full px-3 py-2 rounded-lg border border-blue-200 text-sm focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 bg-white mb-2"
                              />
                              <div className="max-h-40 overflow-y-auto space-y-1">
                                {itensVincBusca.map((item) => (
                                  <button
                                    key={item.id}
                                    onClick={() => abrirModalOP(op, item)}
                                    className="w-full text-left px-3 py-2 rounded-lg bg-gray-50 hover:bg-blue-50 hover:border-blue-300 border border-gray-200 text-sm font-medium text-[var(--marrom)] cursor-pointer transition-all flex items-center justify-between"
                                  >
                                    <span>{item.name}</span>
                                    <span className="text-[10px] text-gray-400">{item.code || ""}</span>
                                  </button>
                                ))}
                                {itensVincBusca.length === 0 && opBuscaVinc.trim() && (
                                  <p className="text-xs text-gray-400 text-center py-2">Nenhum item encontrado</p>
                                )}
                              </div>
                              <button onClick={() => { setOpVinculando(null); setOpBuscaVinc(""); }}
                                className="mt-2 text-xs text-gray-500 hover:text-gray-700 cursor-pointer font-medium">
                                ← Cancelar vinculação
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Carrinho lateral (mesmo do step 4) */}
              <div className="w-80 shrink-0">
                <div className="bg-white rounded-2xl shadow-lg border-2 border-[var(--verde)] sticky top-4">
                  <div className="bg-[var(--verde)] px-4 py-3 rounded-t-2xl">
                    <h3 className="font-bold text-[var(--marrom)] text-sm flex items-center gap-2">
                      🛒 Carrinho <span className="ml-auto bg-[var(--marrom)] text-white text-xs px-2 py-0.5 rounded-full">{carrinho.length}</span>
                    </h3>
                  </div>
                  <div className="p-4 max-h-[400px] overflow-y-auto">
                    {carrinho.length === 0 ? (
                      <p className="text-center text-gray-400 text-sm py-6">Adicione ordens da fila</p>
                    ) : (
                      <div className="space-y-3">
                        {carrinho.map((c, idx) => (
                          <div key={idx} className="bg-[var(--bege)] rounded-xl p-3">
                            <div className="flex items-start justify-between gap-2">
                              <p className="font-bold text-[var(--marrom)] text-xs leading-tight flex-1">{c.item.name}</p>
                              <div className="flex gap-1">
                                <button onClick={() => editarItemCarrinho(idx)} className="text-blue-400 hover:text-blue-600 text-xs cursor-pointer" title="Editar">✏️</button>
                                <button onClick={() => removerDoCarrinho(idx)} className="text-red-400 hover:text-red-600 text-xs cursor-pointer" title="Remover">✕</button>
                              </div>
                            </div>
                            <div className="flex items-center justify-between mt-2">
                              <div className="flex items-center gap-2">
                                <button onClick={() => ajustarQtd(idx, -1)} className="w-7 h-7 flex items-center justify-center bg-white rounded-lg text-[var(--marrom)] font-bold shadow-sm cursor-pointer hover:bg-gray-100">−</button>
                                <span className="text-sm font-extrabold text-[var(--marrom)] w-6 text-center">{c.quantidade}</span>
                                <button onClick={() => ajustarQtd(idx, 1)} className="w-7 h-7 flex items-center justify-center bg-white rounded-lg text-[var(--marrom)] font-bold shadow-sm cursor-pointer hover:bg-gray-100">+</button>
                              </div>
                              <span className="text-[10px] text-gray-500">→ {arredondarPar(c.quantidade)} etiq.</span>
                            </div>
                            {c.lote && <p className="text-[10px] text-gray-400 mt-1">Lote: {c.lote}</p>}
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

          {/* ===== STEP 3: Família ===== */}
          {step === 3 && tipo !== "ordem_producao" && (() => {
            // Ícones e cores por nome de família (case-insensitive)
            const FAMILIA_VISUAL: Record<string, { icon: string; bg: string; border: string }> = {
              "gelatos": { icon: "🍨", bg: "bg-pink-50", border: "border-pink-200 hover:border-pink-400" },
              "sorvetes": { icon: "🍦", bg: "bg-purple-50", border: "border-purple-200 hover:border-purple-400" },
              "picolés": { icon: "🧊", bg: "bg-cyan-50", border: "border-cyan-200 hover:border-cyan-400" },
              "barra de gelatos": { icon: "🍫", bg: "bg-amber-50", border: "border-amber-200 hover:border-amber-400" },
              "food service": { icon: "🍽️", bg: "bg-blue-50", border: "border-blue-200 hover:border-blue-400" },
              "uso e consumo": { icon: "🏠", bg: "bg-green-50", border: "border-green-200 hover:border-green-400" },
              "insumos": { icon: "🧪", bg: "bg-orange-50", border: "border-orange-200 hover:border-orange-400" },
              "coberturas": { icon: "🫕", bg: "bg-rose-50", border: "border-rose-200 hover:border-rose-400" },
              "tortas": { icon: "🎂", bg: "bg-fuchsia-50", border: "border-fuchsia-200 hover:border-fuchsia-400" },
              "bolos": { icon: "🍰", bg: "bg-yellow-50", border: "border-yellow-200 hover:border-yellow-400" },
              "açaí": { icon: "🫐", bg: "bg-violet-50", border: "border-violet-200 hover:border-violet-400" },
              "cafeteria": { icon: "☕", bg: "bg-stone-50", border: "border-stone-200 hover:border-stone-400" },
            };
            const FALLBACK_ICONS = ["🏷️", "📦", "🧁", "🥄", "🍮", "✨"];
            function familiaVisual(nome: string, idx: number) {
              const lower = nome.toLowerCase().trim();
              for (const [key, val] of Object.entries(FAMILIA_VISUAL)) {
                if (lower.includes(key)) return val;
              }
              return { icon: FALLBACK_ICONS[idx % FALLBACK_ICONS.length], bg: "bg-gray-50", border: "border-gray-200 hover:border-[var(--vermelho)]" };
            }

            return (
            <div className="max-w-4xl mx-auto mt-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {familiasComItens.cats.map((cat, idx) => {
                  const count = todosItens.filter((i) =>
                    i.category_id === cat.id && (tipo === "contagem" ? i.uses_counting_label : i.uses_label)
                  ).length;
                  const vis = familiaVisual(cat.name, idx);
                  return (
                    <button key={cat.id} onClick={() => selecionarFamilia(cat.id)} className={`${vis.bg} rounded-2xl shadow-md border-2 ${vis.border} p-5 flex flex-col items-center gap-2 cursor-pointer transition-all hover:shadow-lg hover:-translate-y-1`}>
                      <span className="text-4xl drop-shadow-sm">{vis.icon}</span>
                      <span className="text-sm font-bold text-gray-700 text-center leading-tight">{cat.name}</span>
                      <span className="text-[10px] text-gray-400 font-medium">{count} {count === 1 ? "item" : "itens"}</span>
                    </button>
                  );
                })}
                {familiasComItens.temSemFamilia && (
                  <button onClick={() => selecionarFamilia("__sem_familia__")} className="bg-gray-50 rounded-2xl shadow-md border-2 border-gray-200 hover:border-[var(--vermelho)] p-5 flex flex-col items-center gap-2 cursor-pointer transition-all hover:shadow-lg hover:-translate-y-1">
                    <span className="text-4xl drop-shadow-sm">📦</span>
                    <span className="text-sm font-bold text-gray-700">Sem família</span>
                    <span className="text-[10px] text-gray-400 font-medium">
                      {todosItens.filter((i) => !i.category_id && (tipo === "contagem" ? i.uses_counting_label : i.uses_label)).length} itens
                    </span>
                  </button>
                )}
              </div>
            </div>
            );
          })()}

          {/* ===== STEP 4: Produtos + Carrinho ===== */}
          {step === 4 && (
            <div className="flex gap-6 mt-2">
              {/* Lista de produtos */}
              <div className="flex-1">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-bold text-[var(--marrom)] text-lg">{nomeFamilia(familiaSelecionada)}</h3>
                  <button onClick={() => { setFamiliaSelecionada(null); setBuscaItem(""); setStep(3); }} className="px-4 py-2 bg-[var(--marrom)] text-white text-sm font-bold rounded-xl cursor-pointer hover:bg-[#7a3520] transition-all shadow-sm">
                    🏷️ Trocar família
                  </button>
                </div>
                <div>
                  <div className="mb-2">
                    <input
                      type="text"
                      placeholder="🔍 Buscar produto..."
                      value={buscaItem}
                      onChange={(e) => setBuscaItem(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-[var(--vermelho)] focus:ring-1 focus:ring-[var(--vermelho)] bg-white"
                    />
                  </div>
                  {itensFiltrados.length === 0 ? (
                    <div className="text-center py-12 bg-white rounded-xl">
                      <p className="text-gray-500">{buscaItem.trim() ? `Nenhum item encontrado para "${buscaItem}"` : `Nenhum item nesta família para ${tipo}.`}</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-4 gap-1.5">
                    {itensFiltrados.map((item) => {
                      const noCarrinho = carrinho.some((c) => c.item.id === item.id);
                      const armIcon = item.storage_type === "congelado" ? "🧊" : item.storage_type === "refrigerado" ? "❄️" : "🌡️";
                      return (
                        <button
                          key={item.id}
                          onClick={() => abrirModalItem(item)}
                          className={
                            "text-left rounded-lg px-2 py-1.5 cursor-pointer transition-all hover:shadow-md relative " +
                            (noCarrinho
                              ? "bg-green-50 border-2 border-green-400 shadow-sm"
                              : "bg-white border border-gray-200 hover:border-[var(--vermelho)] shadow-sm")
                          }
                        >
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm shrink-0">{armIcon}</span>
                            <p className="font-bold text-[var(--marrom)] text-[11px] leading-tight truncate flex-1">{item.name}</p>
                            {noCarrinho ? (
                              <span className="w-4 h-4 rounded-full bg-green-500 text-white flex items-center justify-center text-[8px] font-bold shrink-0">✓</span>
                            ) : (
                              <span className="w-4 h-4 rounded-full bg-[var(--vermelho)] text-white flex items-center justify-center text-[8px] font-bold shrink-0">+</span>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-0.5 mt-0.5 pl-5">
                            {item.expiry_days && <span className="text-[8px] text-orange-600 bg-orange-50 px-1 rounded">{item.expiry_days}d</span>}
                            {item.uses_lot && <span className="text-[8px] text-blue-600 bg-blue-50 px-1 rounded">Lote</span>}
                            {item.uses_complementary_label && <span className="text-[8px] text-purple-600 bg-purple-50 px-1 rounded">🏷️ Compl.</span>}
                            {item.additional_info && <span className="text-[8px] text-amber-600 bg-amber-50 px-1 rounded truncate max-w-[80px]">📝</span>}
                          </div>
                        </button>
                      );
                    })}
                    </div>
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
                        {carrinho.map((c, idx) => {
                          const previewHTML = gerarCelulaEtiqueta({
                            nome: c.item.name, fabricacao: dataHoje(), validade: calcValidade(c.item.expiry_days),
                            lote: c.lote, info: c.infoComplementar || "", produtorIniciais: iniciaisProdutores(c.produtores),
                            logoUrl: "/logo-mo.png"
                          });
                          return (
                          <div key={idx} className="bg-[var(--bege)] rounded-xl p-3">
                            <div className="flex items-start justify-between gap-2">
                              <p className="font-bold text-[var(--marrom)] text-xs leading-tight flex-1">{c.item.name}</p>
                              <div className="flex gap-1">
                                <button onClick={() => editarItemCarrinho(idx)} className="text-blue-400 hover:text-blue-600 text-xs cursor-pointer" title="Editar">✏️</button>
                                <button onClick={() => removerDoCarrinho(idx)} className="text-red-400 hover:text-red-600 text-xs cursor-pointer" title="Remover">✕</button>
                              </div>
                            </div>
                            {/* Preview miniatura da etiqueta */}
                            <div className="mt-2 flex justify-center gap-1.5">
                              <div className="border border-gray-300 rounded bg-white" style={{ width: "100px", height: "100px", overflow: "hidden" }}>
                                <div style={{ transform: "scale(0.53)", transformOrigin: "top left", width: "50mm", height: "50mm" }} dangerouslySetInnerHTML={{ __html: previewHTML }} />
                              </div>
                              {c.incluirComplementar && c.complementarDados && (() => {
                                const complHTML = gerarCelulaAvulsa({ nome: c.complementarDados.nome, quantidade: c.complementarDados.quantidade, campos: c.complementarDados.campos, campoExtra: c.complementarDados.campoExtra, logoUrl: "/logo-mo.png" });
                                return (
                                  <div className="border border-purple-400 rounded bg-purple-50" style={{ width: "100px", height: "100px", overflow: "hidden" }}>
                                    <div style={{ transform: "scale(0.53)", transformOrigin: "top left", width: "50mm", height: "50mm" }} dangerouslySetInnerHTML={{ __html: complHTML }} />
                                  </div>
                                );
                              })()}
                            </div>
                            {c.incluirComplementar && <p className="text-[8px] text-purple-600 text-center font-bold mt-0.5">🏷️ + Etiqueta complementar</p>}
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
                              {c.produtores.length > 0 && <>Prod: <span className="font-bold text-[var(--marrom)]">{iniciaisProdutores(c.produtores)}</span></>}
                              {c.lote && <>{c.produtores.length > 0 ? " · " : ""}Lote: {c.lote}</>}
                              {c.tipoEtiqueta === "contagem" && <span className="ml-1 text-blue-600 font-bold">[Contagem]</span>}
                            </p>
                          </div>
                          );
                        })}
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
          {modalItem && (() => {
            const catNome = nomeCategoriaPorId(modalItem.category_id);
            const regraProdutor = regrasProdutor(tipo, catNome);
            const temAmbosLabels = modalItem.uses_label && modalItem.uses_counting_label;
            const podeSalvar = regraProdutor === "obrigatorio" ? modalProdutores.length > 0 : true;

            return (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => { setModalItem(null); setOpSelecionada(null); setEditandoIdx(null); }}>
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                {/* Header com nome */}
                <div className="bg-[var(--vermelho)] px-4 py-3 text-white">
                  <h3 className="font-bold text-base leading-tight">{modalItem.name}</h3>
                  {catNome && <p className="text-[10px] text-white/70 mt-0.5">{catNome}</p>}
                </div>

                {/* Ficha do produto — dados do cadastro */}
                <div className="px-4 pt-3 pb-1">
                  <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Dados do cadastro</p>
                  <div className="grid grid-cols-2 gap-1.5">
                    <div className="bg-gray-50 rounded-lg px-2 py-1.5 text-center">
                      <p className="text-[9px] text-gray-400">Armazenagem</p>
                      <p className="text-xs font-bold text-[var(--marrom)]">
                        {modalItem.storage_type === "congelado" ? "🧊 Congelado" : modalItem.storage_type === "refrigerado" ? "❄️ Refrigerado" : "🌡️ Ambiente"}
                      </p>
                    </div>
                    <div className="bg-gray-50 rounded-lg px-2 py-1.5 text-center">
                      <p className="text-[9px] text-gray-400">Validade</p>
                      <p className="text-xs font-bold text-[var(--marrom)]">{modalItem.expiry_days ? `📅 ${modalItem.expiry_days} dias` : "—"}</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg px-2 py-1.5 text-center">
                      <p className="text-[9px] text-gray-400">Lote</p>
                      <p className="text-xs font-bold text-[var(--marrom)]">{modalItem.uses_lot ? "📦 Sim" : "Não"}</p>
                    </div>
                    <div className={"rounded-lg px-2 py-1.5 text-center cursor-pointer transition-all " + (modalIncluirPeso ? "bg-green-50 ring-1 ring-green-300" : "bg-gray-50")}
                      onClick={() => setModalIncluirPeso(!modalIncluirPeso)}>
                      <div className="flex items-center justify-center gap-1">
                        <p className="text-[9px] text-gray-400">Peso/Unidade</p>
                        <div className={"w-6 h-3 rounded-full transition-all flex items-center px-0.5 " + (modalIncluirPeso ? "bg-green-500 justify-end" : "bg-gray-300 justify-start")}>
                          <div className="w-2 h-2 bg-white rounded-full" />
                        </div>
                      </div>
                      <p className="text-xs font-bold text-[var(--marrom)]">{modalPeso && modalPeso !== "0" && modalPeso !== "0,00" ? `${modalPeso} ${modalUnidade}` : "—"}</p>
                    </div>
                  </div>
                  {modalItem.additional_info && (
                    <div className="bg-amber-50 rounded-lg px-2.5 py-1.5 mt-1.5 border border-amber-100">
                      <p className="text-[9px] text-amber-600 font-bold">📝 Info cadastrada</p>
                      <p className="text-[11px] text-amber-800 font-medium">{modalItem.additional_info}</p>
                    </div>
                  )}
                  {modalItem.uses_complementary_label && (
                    <div className={"rounded-lg px-2.5 py-1.5 mt-1.5 border transition-all " + (modalIncluirComplementar ? "bg-purple-100 border-purple-400" : "bg-purple-50 border-purple-100")}>
                      <div className="flex items-center justify-between cursor-pointer" onClick={() => setModalIncluirComplementar(!modalIncluirComplementar)}>
                        <p className="text-[9px] text-purple-600 font-bold">🏷️ Incluir etiqueta complementar</p>
                        <div className={"w-8 h-4 rounded-full transition-all flex items-center px-0.5 " + (modalIncluirComplementar ? "bg-purple-500 justify-end" : "bg-gray-300 justify-start")}>
                          <div className="w-3 h-3 bg-white rounded-full shadow-sm" />
                        </div>
                      </div>
                      {modalIncluirComplementar && (
                        <div className="mt-2 space-y-2" onClick={(e) => e.stopPropagation()}>
                          {/* Nome na complementar */}
                          <input type="text" value={modalComplNome}
                            onChange={(e) => setModalComplNome(e.target.value)}
                            placeholder="Nome na etiqueta complementar"
                            className="w-full px-2 py-1.5 text-[11px] bg-white border border-purple-200 rounded-lg focus:outline-none focus:border-purple-400 font-semibold" />
                          {/* Toggle quantidade */}
                          <div className="flex items-center gap-2">
                            <button type="button" onClick={() => setModalComplUsarQtd(!modalComplUsarQtd)}
                              className={"w-7 h-4 rounded-full transition-all cursor-pointer relative " + (modalComplUsarQtd ? "bg-purple-500" : "bg-gray-300")}>
                              <span className={"absolute top-0.5 w-3 h-3 bg-white rounded-full shadow transition-all " + (modalComplUsarQtd ? "left-3.5" : "left-0.5")} />
                            </button>
                            <span className="text-[10px] font-bold text-purple-700">Quantidade</span>
                          </div>
                          {modalComplUsarQtd && (
                            <input type="text" value={modalComplQtd}
                              onChange={(e) => setModalComplQtd(e.target.value)}
                              placeholder="Ex: 12, 5kg, 3 potes"
                              className="w-full px-2 py-1.5 text-[11px] bg-white border border-purple-200 rounded-lg focus:outline-none focus:border-purple-400" />
                          )}
                          {/* Campos opcionais */}
                          <div>
                            <p className="text-[9px] font-bold text-purple-600 mb-1">Campos opcionais</p>
                            {modalComplCampos.length > 0 && (
                              <div className="space-y-1 mb-1">
                                {modalComplCampos.map((campo, idx) => (
                                  <div key={idx} className="flex items-center gap-1">
                                    <span className="text-[9px] font-bold text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded min-w-[45px] text-center">{campo.label}</span>
                                    <input type="text" value={campo.valor}
                                      onChange={(e) => setModalComplCampos((prev) => prev.map((c, i) => i === idx ? { ...c, valor: e.target.value } : c))}
                                      placeholder={CAMPOS_PRESET_COMPL.find((p) => p.label === campo.label)?.placeholder || "Valor..."}
                                      className="flex-1 px-2 py-1 text-[10px] bg-white border border-purple-200 rounded focus:outline-none focus:border-purple-400" />
                                    <button onClick={() => setModalComplCampos((prev) => prev.filter((_, i) => i !== idx))} className="text-red-400 hover:text-red-600 text-[10px] cursor-pointer font-bold">✕</button>
                                  </div>
                                ))}
                              </div>
                            )}
                            <div className="flex flex-wrap gap-1">
                              {CAMPOS_PRESET_COMPL.map((preset) => (
                                <button key={preset.label} type="button"
                                  onClick={() => setModalComplCampos((prev) => [...prev, { label: preset.label, valor: preset.autoFill ? dataHoje() : "" }])}
                                  className="px-2 py-0.5 bg-purple-50 text-purple-700 text-[9px] font-bold rounded cursor-pointer hover:bg-purple-100 transition-all">
                                  + {preset.label}
                                </button>
                              ))}
                              <button type="button"
                                onClick={() => { const l = prompt("Nome do campo:"); if (l?.trim()) setModalComplCampos((prev) => [...prev, { label: l.trim(), valor: "" }]); }}
                                className="px-2 py-0.5 bg-purple-700 text-white text-[9px] font-bold rounded cursor-pointer hover:bg-purple-800 transition-all">
                                + Custom
                              </button>
                            </div>
                          </div>
                          {/* Campo extra */}
                          <div className="flex items-center gap-2">
                            <button type="button" onClick={() => setModalComplUsarExtra(!modalComplUsarExtra)}
                              className={"w-7 h-4 rounded-full transition-all cursor-pointer relative " + (modalComplUsarExtra ? "bg-purple-500" : "bg-gray-300")}>
                              <span className={"absolute top-0.5 w-3 h-3 bg-white rounded-full shadow transition-all " + (modalComplUsarExtra ? "left-3.5" : "left-0.5")} />
                            </button>
                            <span className="text-[10px] font-bold text-purple-700">Campo extra</span>
                          </div>
                          {modalComplUsarExtra && (
                            <textarea value={modalComplExtra}
                              onChange={(e) => setModalComplExtra(e.target.value)}
                              placeholder="Info adicional na etiqueta complementar..."
                              rows={2}
                              className="w-full px-2 py-1.5 text-[11px] bg-white border border-purple-200 rounded-lg focus:outline-none focus:border-purple-400 resize-none" />
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="px-4 pb-4 pt-2 space-y-3 border-t border-gray-100 mt-2">
                  <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Configurar impressão</p>

                  {/* Tipo de etiqueta (se tem ambos) */}
                  {temAmbosLabels && (
                    <div>
                      <label className="text-xs font-semibold text-[var(--marrom)] mb-1 block">Tipo de etiqueta</label>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setModalTipoEtiqueta("normal")}
                          className={"flex-1 py-2 rounded-lg text-xs font-bold cursor-pointer transition-all border-2 " +
                            (modalTipoEtiqueta === "normal"
                              ? "bg-[var(--vermelho)] text-white border-[var(--vermelho)] shadow-md"
                              : "bg-white text-[var(--marrom)] border-gray-200 hover:border-[var(--vermelho)]")}
                        >
                          🏷️ Normal
                        </button>
                        <button
                          type="button"
                          onClick={() => setModalTipoEtiqueta("contagem")}
                          className={"flex-1 py-2 rounded-lg text-xs font-bold cursor-pointer transition-all border-2 " +
                            (modalTipoEtiqueta === "contagem"
                              ? "bg-blue-600 text-white border-blue-600 shadow-md"
                              : "bg-white text-[var(--marrom)] border-gray-200 hover:border-blue-600")}
                        >
                          📋 Contagem
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Quem produziu — condicional */}
                  {regraProdutor !== "oculto" && (
                    <div>
                      <label className="text-xs font-semibold text-[var(--marrom)] mb-1 block">
                        Quem produziu?
                        {regraProdutor === "obrigatorio" && <span className="text-[var(--vermelho)]"> *</span>}
                        {regraProdutor === "opcional" && <span className="text-gray-400 text-[10px] ml-1">(opcional)</span>}
                      </label>
                      <div className="flex flex-wrap gap-1.5">
                        {colaboradores.map((c) => (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => toggleProdutor(c.id)}
                            className={
                              "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-all " +
                              (modalProdutores.includes(c.id)
                                ? "bg-[var(--vermelho)] text-white shadow-sm"
                                : "bg-[var(--bege)] text-[var(--marrom)] hover:bg-gray-200")
                            }
                          >
                            <span className="w-5 h-5 flex items-center justify-center bg-white/20 rounded text-[10px] font-extrabold">
                              {iniciais(c.name)}
                            </span>
                            {c.name.split(" ")[0]}
                          </button>
                        ))}
                      </div>
                      {regraProdutor === "obrigatorio" && modalProdutores.length === 0 && (
                        <p className="text-[10px] text-[var(--vermelho)] mt-0.5">Selecione pelo menos um produtor</p>
                      )}
                    </div>
                  )}

                  {/* Lote (se necessário) */}
                  {modalItem.uses_lot && (
                    <div>
                      <label className="text-xs font-semibold text-[var(--marrom)] mb-1 block">Lote</label>
                      <input
                        type="text"
                        value={modalLote}
                        onChange={(e) => setModalLote(e.target.value)}
                        placeholder="Ex: LT2026-05A"
                        className="w-full px-3 py-2 bg-gray-100 border border-gray-200 rounded-lg text-sm font-medium focus:outline-none focus:border-[var(--vermelho)] focus:bg-white transition-all"
                      />
                    </div>
                  )}

                  {/* Peso editável (quando toggle ativo) */}
                  {modalIncluirPeso && (
                    <div>
                      <label className="text-xs font-semibold text-[var(--marrom)] mb-1 block">⚖️ Peso / Unidade na etiqueta</label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={modalPeso}
                          onChange={(e) => setModalPeso(e.target.value)}
                          placeholder="0,00"
                          className="flex-1 px-3 py-2 bg-gray-100 border border-gray-200 rounded-lg text-sm font-medium focus:outline-none focus:border-[var(--vermelho)] focus:bg-white transition-all"
                        />
                        <select
                          value={modalUnidade}
                          onChange={(e) => setModalUnidade(e.target.value)}
                          className="px-3 py-2 bg-gray-100 border border-gray-200 rounded-lg text-sm font-medium focus:outline-none focus:border-[var(--vermelho)] focus:bg-white transition-all"
                        >
                          <option value="KG">KG</option>
                          <option value="G">G</option>
                          <option value="ML">ML</option>
                          <option value="L">L</option>
                          <option value="UN">UN</option>
                        </select>
                      </div>
                    </div>
                  )}

                  {/* Info complementar (editável) */}
                  <div>
                    <label className="text-xs font-semibold text-[var(--marrom)] mb-1 flex items-center gap-1">
                      📝 Info na etiqueta
                      {modalItem.additional_info && <span className="text-[9px] text-gray-400 font-normal">(do cadastro)</span>}
                    </label>
                    <input
                      type="text"
                      value={modalInfoComplementar}
                      onChange={(e) => setModalInfoComplementar(e.target.value.slice(0, 60))}
                      placeholder="Ex: Contém glúten, Sem lactose..."
                      className="w-full px-3 py-2 bg-gray-100 border border-gray-200 rounded-lg text-sm font-medium focus:outline-none focus:border-[var(--vermelho)] focus:bg-white transition-all"
                    />
                    <p className="text-[9px] text-gray-400 mt-0.5">{modalInfoComplementar.length}/60 — aparece na etiqueta abaixo do lote</p>
                  </div>

                  {/* Quantidade — compacto inline */}
                  <div className="flex items-center justify-between bg-[var(--bege)] rounded-xl px-4 py-2.5">
                    <span className="text-xs font-semibold text-[var(--marrom)]">Quantidade</span>
                    <div className="flex items-center gap-3">
                      <button onClick={() => setModalQtd(Math.max(1, modalQtd - 1))} className="w-8 h-8 flex items-center justify-center bg-white rounded-lg text-base font-bold text-[var(--marrom)] cursor-pointer hover:bg-gray-100 transition-all shadow-sm">−</button>
                      <span className="text-xl font-extrabold text-[var(--marrom)] w-8 text-center">{modalQtd}</span>
                      <button onClick={() => setModalQtd(modalQtd + 1)} className="w-8 h-8 flex items-center justify-center bg-white rounded-lg text-base font-bold text-[var(--marrom)] cursor-pointer hover:bg-gray-100 transition-all shadow-sm">+</button>
                      <span className="text-[10px] text-gray-400 ml-1">→ {arredondarPar(modalQtd)} etiq.</span>
                    </div>
                  </div>
                </div>

                {/* Footer */}
                <div className="border-t border-gray-200 px-4 py-3 flex gap-2">
                  <button
                    onClick={adicionarAoCarrinho}
                    disabled={!podeSalvar}
                    className={"flex-1 py-2.5 rounded-xl font-bold text-sm cursor-pointer transition-all " + (!podeSalvar ? "bg-gray-200 text-gray-400" : "bg-[var(--vermelho)] text-white hover:bg-red-600 shadow-lg")}
                  >
                    {editandoIdx !== null ? "💾 Salvar" : "🛒 Adicionar"}
                  </button>
                  <button onClick={() => { setModalItem(null); setOpSelecionada(null); setEditandoIdx(null); }} className="px-4 py-2.5 rounded-xl font-bold text-sm bg-gray-100 text-gray-600 hover:bg-gray-200 cursor-pointer transition-all">
                    Cancelar
                  </button>
                </div>
              </div>
            </div>
            );
          })()}
        </div>

        {/* ===== Modal PIN ===== */}
        {pinModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setPinModal(null)}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xs overflow-hidden" onClick={(e) => e.stopPropagation()}>
              <div className="bg-[var(--vermelho)] px-4 py-3 text-white text-center">
                <span className="text-2xl block mb-1">🔒</span>
                <h3 className="font-bold text-base">{pinModal.name}</h3>
                <p className="text-[10px] text-white/80 mt-0.5">Digite o PIN para continuar</p>
              </div>
              <div className="p-5">
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  value={pinInput}
                  onChange={(e) => { setPinInput(e.target.value.replace(/\D/g, "")); setPinErro(false); }}
                  onKeyDown={(e) => e.key === "Enter" && confirmarPin()}
                  placeholder="••••"
                  autoFocus
                  className={"w-full text-center text-2xl font-extrabold tracking-[0.5em] px-4 py-3 border-2 rounded-xl focus:outline-none transition-all " + (pinErro ? "border-red-500 bg-red-50 shake" : "border-gray-200 focus:border-[var(--vermelho)]")}
                />
                {pinErro && <p className="text-xs text-red-500 text-center mt-2 font-semibold">PIN incorreto</p>}
              </div>
              <div className="border-t border-gray-200 px-4 py-3 flex gap-2">
                <button onClick={confirmarPin} className="flex-1 py-2.5 rounded-xl font-bold text-sm bg-[var(--vermelho)] text-white cursor-pointer hover:bg-red-600 transition-all shadow-lg">
                  Confirmar
                </button>
                <button onClick={() => setPinModal(null)} className="px-4 py-2.5 rounded-xl font-bold text-sm bg-gray-100 text-gray-600 hover:bg-gray-200 cursor-pointer transition-all">
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </>
  );
}
