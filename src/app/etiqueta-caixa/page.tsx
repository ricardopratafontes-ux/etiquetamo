"use client";

import NavBar from "@/components/NavBar";
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { dataHoje, dataCurta } from "@/lib/dateUtils";
import { gerarCelulaAvulsa } from "@/lib/labelHtml";

const ORG_SLUG = "gelateria";

// dateUtils e labelHtml importados do módulo compartilhado

// --- Tipos ---
interface CampoOpcional {
  label: string;
  valor: string;
}

interface DadosEtiqueta {
  nome: string;
  quantidade: string | null;
  campos: CampoOpcional[];
  campoExtra: string | null;
}

interface Modelo {
  id: string;
  nome: string;
  dados: DadosEtiqueta;
}

interface HistoricoItem {
  id: string;
  label_data: DadosEtiqueta;
  quantity_printed: number;
  created_at: string;
}

// Layout da etiqueta avulsa: importado de @/lib/labelHtml

// --- Componente React de preview ---
function PreviewEtiqueta({ dados }: { dados: DadosEtiqueta }) {
  const temQtd = dados.quantidade && dados.quantidade.trim();
  const camposAtivos = dados.campos.filter((c) => c.valor.trim());
  const temExtra = dados.campoExtra && dados.campoExtra.trim();
  const linhasAbaixo = (temQtd ? 1 : 0) + (camposAtivos.length > 0 ? 1 : 0) + (temExtra ? 1 : 0);
  const fNome = linhasAbaixo >= 3 ? "14pt" : linhasAbaixo >= 2 ? "16pt" : "18pt";

  return (
    <div style={{
      width: "50mm", height: "50mm", padding: "2mm", boxSizing: "border-box",
      fontFamily: "Arial, sans-serif", display: "flex", flexDirection: "column", overflow: "hidden",
    }}>
      <div style={{
        fontWeight: "bold", fontSize: fNome, textAlign: "center", textTransform: "uppercase",
        lineHeight: "1.15", flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
        borderBottom: "0.5pt solid #000", paddingBottom: "0.5mm", overflow: "hidden",
      }}>
        {dados.nome || "NOME"}
      </div>
      {temQtd && (
        <div style={{ fontSize: "14pt", fontWeight: "bold", textAlign: "center", padding: "1mm 0", textTransform: "uppercase" }}>
          QTD: {dados.quantidade}
        </div>
      )}
      <div style={{ display: "flex", alignItems: "flex-start", marginTop: "auto" }}>
        <div style={{ flex: 1 }}>
          {camposAtivos.map((c, i) => (
            <div key={i} style={{ fontSize: "9pt", lineHeight: "1.3" }}>
              <strong>{c.label}:</strong> {c.valor}
            </div>
          ))}
          {temExtra && (
            <div style={{ fontSize: "8pt", fontStyle: "italic", lineHeight: "1.3", marginTop: "0.5mm", color: "#333" }}>
              {dados.campoExtra}
            </div>
          )}
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginLeft: "1mm" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-mo.png" alt="mo!" style={{ height: "5mm", opacity: 0.8 }} />
        </div>
      </div>
    </div>
  );
}

// Opções de campos pré-definidos
const CAMPOS_PRESET = [
  { label: "Lote", placeholder: "Ex: LOTE-2024-01" },
  { label: "Fabricação", placeholder: "Ex: 21/05/2026", autoFill: true },
  { label: "Validade", placeholder: "Ex: 28/05/2026" },
  { label: "Peso", placeholder: "Ex: 5kg" },
];

export default function EtiquetasAvulsasPage() {
  // Form state
  const [nome, setNome] = useState("");
  const [usarQuantidade, setUsarQuantidade] = useState(false);
  const [quantidade, setQuantidade] = useState("");
  const [campos, setCampos] = useState<CampoOpcional[]>([]);
  const [usarExtra, setUsarExtra] = useState(false);
  const [campoExtra, setCampoExtra] = useState("");
  const [qtdEtiquetas, setQtdEtiquetas] = useState(2);

  // Templates
  const [modelos, setModelos] = useState<Modelo[]>([]);
  const [salvarModelo, setSalvarModelo] = useState(false);
  const [nomeModelo, setNomeModelo] = useState("");

  // History
  const [historico, setHistorico] = useState<HistoricoItem[]>([]);
  const [orgId, setOrgId] = useState("");
  const [loadingHist, setLoadingHist] = useState(true);

  // Status
  const [status, setStatus] = useState("");

  // --- Load data ---
  const carregar = useCallback(async () => {
    setLoadingHist(true);
    // Org
    const { data: org } = await supabase.from("organizations").select("id").eq("slug", ORG_SLUG).single();
    if (org) {
      setOrgId(org.id);
      // Histórico do Supabase
      const { data: hist } = await supabase
        .from("avulsa_history")
        .select("*")
        .eq("organization_id", org.id)
        .order("created_at", { ascending: false })
        .limit(50);
      if (hist) setHistorico(hist);
    }
    // Modelos do localStorage
    try {
      const saved = localStorage.getItem("etiquetamo_avulsa_modelos");
      if (saved) setModelos(JSON.parse(saved));
    } catch { /* ignore */ }
    setLoadingHist(false);
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  // Salvar modelos no localStorage quando mudam
  function salvarModelosLocal(novos: Modelo[]) {
    setModelos(novos);
    try { localStorage.setItem("etiquetamo_avulsa_modelos", JSON.stringify(novos)); } catch { /* ignore */ }
  }

  // --- Dados da etiqueta ---
  const dadosEtiqueta: DadosEtiqueta = {
    nome: nome || "NOME NA ETIQUETA",
    quantidade: usarQuantidade ? (quantidade || "0") : null,
    campos: campos.filter((c) => c.valor.trim()),
    campoExtra: usarExtra ? campoExtra : null,
  };

  // --- Adicionar campo opcional ---
  function adicionarCampo(label: string, autoFill?: boolean) {
    const valor = autoFill ? dataHoje() : "";
    setCampos((prev) => [...prev, { label, valor }]);
  }

  function adicionarCampoCustom() {
    const label = prompt("Nome do campo:");
    if (label && label.trim()) {
      setCampos((prev) => [...prev, { label: label.trim(), valor: "" }]);
    }
  }

  function removerCampo(idx: number) {
    setCampos((prev) => prev.filter((_, i) => i !== idx));
  }

  function atualizarCampo(idx: number, valor: string) {
    setCampos((prev) => prev.map((c, i) => i === idx ? { ...c, valor } : c));
  }

  // --- Carregar modelo ---
  function carregarModelo(modelo: Modelo) {
    setNome(modelo.dados.nome === "NOME NA ETIQUETA" ? "" : modelo.dados.nome);
    setUsarQuantidade(!!modelo.dados.quantidade);
    setQuantidade(modelo.dados.quantidade || "");
    setCampos(modelo.dados.campos);
    setUsarExtra(!!modelo.dados.campoExtra);
    setCampoExtra(modelo.dados.campoExtra || "");
  }

  function excluirModelo(id: string) {
    salvarModelosLocal(modelos.filter((m) => m.id !== id));
  }

  // --- Imprimir ---
  async function handlePrint() {
    if (!nome.trim()) { setStatus("Preencha o nome na etiqueta."); return; }

    setStatus("Preparando impressão...");
    const logoUrl = window.location.origin + "/logo-mo.png";

    // Gera as células
    const celula = gerarCelulaAvulsa({ ...dadosEtiqueta, logoUrl });
    const totalCelulas: string[] = [];
    for (let i = 0; i < qtdEtiquetas; i++) totalCelulas.push(celula);
    // Arredondar para par
    if (totalCelulas.length % 2 !== 0) totalCelulas.push(totalCelulas[totalCelulas.length - 1]);

    let linhas = "";
    for (let i = 0; i < totalCelulas.length; i += 2) {
      linhas += `<div style="width:107mm;display:flex;padding-left:2mm;padding-right:2mm;gap:3mm;page-break-after:always;">${totalCelulas[i]}${totalCelulas[i + 1]}</div>`;
    }

    const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Etiquetas Avulsas</title>
<style>
  @page { margin: 0; size: 107mm 50mm; }
  @media print { html, body { margin: 0; padding: 0; width: 107mm; } .no-print { display: none !important; } }
  html, body { margin: 0; padding: 0; }
</style></head><body>
${linhas}
<div class="no-print" style="text-align:center;padding:20px;">
  <button onclick="window.print()" style="padding:12px 32px;font-size:16px;font-weight:bold;background:#f31c40;color:white;border:none;border-radius:12px;cursor:pointer;">🖨️ Imprimir</button>
  <button onclick="window.close()" style="padding:12px 32px;font-size:16px;margin-left:12px;background:#98472d;color:white;border:none;border-radius:12px;cursor:pointer;">Fechar</button>
</div></body></html>`;

    const win = window.open("", "_blank");
    if (win) { win.document.write(html); win.document.close(); }

    // Salvar modelo se marcado
    if (salvarModelo && nomeModelo.trim()) {
      const novo: Modelo = { id: Date.now().toString(), nome: nomeModelo.trim(), dados: dadosEtiqueta };
      salvarModelosLocal([novo, ...modelos]);
      setSalvarModelo(false);
      setNomeModelo("");
    }

    // Salvar no histórico (Supabase)
    if (orgId) {
      const { data: inserted } = await supabase.from("avulsa_history").insert({
        organization_id: orgId,
        label_data: dadosEtiqueta,
        quantity_printed: qtdEtiquetas <= 1 ? 2 : (qtdEtiquetas % 2 === 0 ? qtdEtiquetas : qtdEtiquetas + 1),
      }).select().single();
      if (inserted) setHistorico((prev) => [inserted, ...prev]);
    }

    setStatus("Impressão enviada!");
    setTimeout(() => setStatus(""), 3000);
  }

  // --- Reimprimir do histórico ---
  async function reimprimirHistorico(item: HistoricoItem) {
    const d = item.label_data;
    setNome(d.nome === "NOME NA ETIQUETA" ? "" : d.nome);
    setUsarQuantidade(!!d.quantidade);
    setQuantidade(d.quantidade || "");
    setCampos(d.campos || []);
    setUsarExtra(!!d.campoExtra);
    setCampoExtra(d.campoExtra || "");
    setQtdEtiquetas(item.quantity_printed);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <>
      <NavBar />
      <main className="min-h-screen bg-[var(--bege)]">
        {/* Header */}
        <div className="bg-gradient-to-r from-[var(--vermelho)] to-[#d41636] text-white px-6 py-6">
          <div className="max-w-4xl mx-auto flex items-center gap-3">
            <span className="text-3xl">🏷️</span>
            <div>
              <h1 className="text-2xl font-extrabold">Etiquetas Avulsas</h1>
              <p className="text-sm text-white/70">Caixas, volumes, identificação livre</p>
            </div>
          </div>
        </div>

        <div className="max-w-4xl mx-auto px-6 -mt-4 pb-8">
          <div className="flex gap-6">
            {/* ===== FORMULÁRIO ===== */}
            <div className="flex-1">
              <div className="bg-white rounded-2xl shadow-lg border border-[var(--verde)] p-6 mb-6">
                <div className="space-y-5">

                  {/* Nome na etiqueta */}
                  <div>
                    <label className="block text-sm font-bold text-[var(--marrom)] mb-1.5">
                      Nome na etiqueta <span className="text-[var(--vermelho)]">*</span>
                    </label>
                    <input
                      type="text"
                      value={nome}
                      onChange={(e) => setNome(e.target.value)}
                      placeholder="Ex: Sorvete de Chocolate, Caixa #5"
                      className="w-full px-4 py-3 bg-[var(--bege)] border-2 border-transparent rounded-xl text-base font-semibold focus:outline-none focus:border-[var(--vermelho)] focus:bg-white transition-all"
                    />
                  </div>

                  {/* Quantidade (toggle) */}
                  <div>
                    <div className="flex items-center gap-3 mb-1.5">
                      <button
                        type="button"
                        onClick={() => setUsarQuantidade(!usarQuantidade)}
                        className={"w-10 h-6 rounded-full transition-all cursor-pointer relative " + (usarQuantidade ? "bg-[var(--vermelho)]" : "bg-gray-300")}
                      >
                        <span className={"absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all " + (usarQuantidade ? "left-4.5" : "left-0.5")} />
                      </button>
                      <label className="text-sm font-bold text-[var(--marrom)]">Quantidade</label>
                    </div>
                    {usarQuantidade && (
                      <input
                        type="text"
                        value={quantidade}
                        onChange={(e) => setQuantidade(e.target.value)}
                        placeholder="Ex: 12, 5kg, 3 potes"
                        className="w-full px-4 py-3 bg-[var(--bege)] border-2 border-transparent rounded-xl text-sm font-medium focus:outline-none focus:border-[var(--vermelho)] focus:bg-white transition-all"
                      />
                    )}
                  </div>

                  {/* Campos opcionais (múltiplos) */}
                  <div>
                    <label className="block text-sm font-bold text-[var(--marrom)] mb-2">Campos opcionais</label>
                    {campos.length > 0 && (
                      <div className="space-y-2 mb-3">
                        {campos.map((campo, idx) => (
                          <div key={idx} className="flex items-center gap-2">
                            <span className="text-xs font-bold text-[var(--marrom)] bg-[var(--bege)] px-2 py-1 rounded-lg min-w-[60px] text-center">{campo.label}</span>
                            <input
                              type="text"
                              value={campo.valor}
                              onChange={(e) => atualizarCampo(idx, e.target.value)}
                              placeholder={CAMPOS_PRESET.find((p) => p.label === campo.label)?.placeholder || "Valor..."}
                              className="flex-1 px-3 py-2 bg-[var(--bege)] border-2 border-transparent rounded-xl text-sm focus:outline-none focus:border-[var(--vermelho)] focus:bg-white transition-all"
                            />
                            <button onClick={() => removerCampo(idx)} className="text-red-400 hover:text-red-600 text-sm cursor-pointer font-bold px-1">✕</button>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="flex flex-wrap gap-2">
                      {CAMPOS_PRESET.map((preset) => (
                        <button
                          key={preset.label}
                          type="button"
                          onClick={() => adicionarCampo(preset.label, preset.autoFill)}
                          className="px-3 py-1.5 bg-[var(--bege)] text-[var(--marrom)] text-xs font-bold rounded-lg cursor-pointer hover:bg-gray-200 transition-all"
                        >
                          + {preset.label}
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={adicionarCampoCustom}
                        className="px-3 py-1.5 bg-[var(--marrom)] text-white text-xs font-bold rounded-lg cursor-pointer hover:bg-[#7a3520] transition-all"
                      >
                        + Personalizado
                      </button>
                    </div>
                  </div>

                  {/* Campo extra (toggle) */}
                  <div>
                    <div className="flex items-center gap-3 mb-1.5">
                      <button
                        type="button"
                        onClick={() => setUsarExtra(!usarExtra)}
                        className={"w-10 h-6 rounded-full transition-all cursor-pointer relative " + (usarExtra ? "bg-[var(--vermelho)]" : "bg-gray-300")}
                      >
                        <span className={"absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all " + (usarExtra ? "left-4.5" : "left-0.5")} />
                      </button>
                      <label className="text-sm font-bold text-[var(--marrom)]">Campo extra</label>
                      <span className="text-[10px] text-gray-400">(texto livre na metade inferior)</span>
                    </div>
                    {usarExtra && (
                      <textarea
                        value={campoExtra}
                        onChange={(e) => setCampoExtra(e.target.value)}
                        placeholder="Informações adicionais que aparecerão na parte inferior da etiqueta..."
                        rows={2}
                        className="w-full px-4 py-3 bg-[var(--bege)] border-2 border-transparent rounded-xl text-sm focus:outline-none focus:border-[var(--vermelho)] focus:bg-white transition-all resize-none"
                      />
                    )}
                  </div>

                  <hr className="border-gray-200" />

                  {/* Quantidade de etiquetas */}
                  <div>
                    <label className="block text-sm font-bold text-[var(--marrom)] mb-2">Quantidade de etiquetas</label>
                    <div className="flex items-center gap-3">
                      <button onClick={() => setQtdEtiquetas(Math.max(1, qtdEtiquetas - 1))} className="w-10 h-10 flex items-center justify-center bg-[var(--bege)] rounded-xl text-lg font-bold text-[var(--marrom)] cursor-pointer hover:bg-gray-200 transition-all">−</button>
                      <span className="text-2xl font-extrabold text-[var(--marrom)] w-12 text-center">{qtdEtiquetas}</span>
                      <button onClick={() => setQtdEtiquetas(qtdEtiquetas + 1)} className="w-10 h-10 flex items-center justify-center bg-[var(--bege)] rounded-xl text-lg font-bold text-[var(--marrom)] cursor-pointer hover:bg-gray-200 transition-all">+</button>
                      <span className="text-xs text-gray-400 ml-2">
                        → {qtdEtiquetas % 2 === 0 ? qtdEtiquetas : qtdEtiquetas + 1} na bobina (par)
                      </span>
                    </div>
                  </div>

                  {/* Salvar modelo */}
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setSalvarModelo(!salvarModelo)}
                      className={"w-5 h-5 rounded border-2 flex items-center justify-center cursor-pointer transition-all " + (salvarModelo ? "bg-[var(--vermelho)] border-[var(--vermelho)] text-white" : "border-gray-300")}
                    >
                      {salvarModelo && <span className="text-xs">✓</span>}
                    </button>
                    <span className="text-sm font-semibold text-[var(--marrom)]">Salvar como modelo</span>
                  </div>
                  {salvarModelo && (
                    <input
                      type="text"
                      value={nomeModelo}
                      onChange={(e) => setNomeModelo(e.target.value)}
                      placeholder="Nome do modelo (ex: Caixa Chocolate)"
                      className="w-full px-4 py-2 bg-[var(--bege)] border-2 border-transparent rounded-xl text-sm font-medium focus:outline-none focus:border-[var(--vermelho)] focus:bg-white transition-all -mt-2"
                    />
                  )}
                </div>

                {/* Botão imprimir */}
                <button
                  onClick={handlePrint}
                  className="w-full mt-6 py-4 bg-[var(--vermelho)] text-white font-extrabold text-lg rounded-xl shadow-lg cursor-pointer hover:bg-red-600 hover:shadow-xl transition-all"
                >
                  🖨️ Imprimir {qtdEtiquetas % 2 === 0 ? qtdEtiquetas : qtdEtiquetas + 1} Etiquetas
                </button>
                {status && <p className="mt-3 text-sm text-center text-[var(--marrom)] font-medium">{status}</p>}
              </div>

              {/* Modelos salvos */}
              {modelos.length > 0 && (
                <div className="bg-white rounded-2xl shadow-md p-5 mb-6">
                  <h3 className="font-bold text-[var(--marrom)] text-sm mb-3 flex items-center gap-2">
                    💾 Modelos Salvos <span className="text-xs text-gray-400 font-normal">({modelos.length})</span>
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {modelos.map((m) => (
                      <div key={m.id} className="flex items-center gap-1 bg-[var(--bege)] rounded-xl px-3 py-2">
                        <button onClick={() => carregarModelo(m)} className="text-sm font-bold text-[var(--marrom)] cursor-pointer hover:underline">
                          {m.nome}
                        </button>
                        <button onClick={() => excluirModelo(m.id)} className="text-red-400 hover:text-red-600 text-xs cursor-pointer ml-1">✕</button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* ===== PREVIEW ===== */}
            <div className="w-80 shrink-0">
              <div className="bg-white rounded-2xl shadow-lg p-5 sticky top-4">
                <h3 className="font-bold text-[var(--marrom)] text-sm mb-3">Preview</h3>
                <div className="bg-gray-50 rounded-xl p-3 inline-block">
                  <div style={{ width: "107mm", display: "flex", paddingLeft: "2mm", paddingRight: "2mm", gap: "3mm", transform: "scale(0.75)", transformOrigin: "top left" }}>
                    <div style={{ border: "1px dashed #7c3aed" }}>
                      <PreviewEtiqueta dados={dadosEtiqueta} />
                    </div>
                    <div style={{ border: "1px dashed #7c3aed" }}>
                      <PreviewEtiqueta dados={dadosEtiqueta} />
                    </div>
                  </div>
                </div>
                <p className="text-[10px] text-gray-400 mt-2">
                  <span style={{ color: "#7c3aed" }}>Linha roxa</span> = limite (não imprime)
                </p>
              </div>
            </div>
          </div>

          {/* ===== HISTÓRICO ===== */}
          <div className="bg-white rounded-2xl shadow-md p-6 mt-6">
            <h3 className="font-bold text-[var(--marrom)] text-base mb-4 flex items-center gap-2">
              📜 Histórico de Impressões
              <span className="text-xs text-gray-400 font-normal">({historico.length} registros)</span>
            </h3>
            {loadingHist ? (
              <p className="text-sm text-gray-400 animate-pulse">Carregando histórico...</p>
            ) : historico.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-6">Nenhuma etiqueta avulsa impressa ainda.</p>
            ) : (
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {historico.map((h) => (
                  <div key={h.id} className="flex items-center justify-between bg-[var(--bege)] rounded-xl px-4 py-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-[var(--marrom)] text-sm truncate">{h.label_data.nome}</p>
                      <p className="text-[10px] text-gray-400">
                        {new Date(h.created_at).toLocaleString("pt-BR")}
                        {" · "}{h.quantity_printed} etiq.
                        {h.label_data.quantidade && ` · QTD: ${h.label_data.quantidade}`}
                        {h.label_data.campos && h.label_data.campos.length > 0 && (
                          <> · {h.label_data.campos.map((c) => `${c.label}: ${c.valor}`).join(", ")}</>
                        )}
                      </p>
                    </div>
                    <button
                      onClick={() => reimprimirHistorico(h)}
                      className="px-3 py-1.5 bg-[var(--marrom)] text-white text-xs font-bold rounded-lg cursor-pointer hover:bg-[#7a3520] transition-all shrink-0 ml-3"
                    >
                      ↻ Reusar
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </>
  );
}
