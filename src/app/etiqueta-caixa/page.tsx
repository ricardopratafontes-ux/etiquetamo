"use client";

import NavBar from "@/components/NavBar";
import { useState } from "react";

function dataHoje(): string {
  return new Date().toLocaleDateString("pt-BR");
}

interface EtiquetaCaixaProps {
  nome: string;
  quantidade: string;
  campoOpcionalLabel: string;
  campoOpcionalValor: string;
}

/**
 * Etiqueta de caixa: 50mm x 50mm
 * DEC-017: Tipo separado com fluxo proprio.
 * Foco em NOME GRANDE + quantidade + campo opcional (lote ou fabricacao).
 * Finalidade: identificar caixas/volumes, nao unidades individuais.
 */
function EtiquetaCaixa({ nome, quantidade, campoOpcionalLabel, campoOpcionalValor }: EtiquetaCaixaProps) {
  return (
    <div
      style={{
        width: "50mm",
        height: "50mm",
        padding: "2.5mm",
        boxSizing: "border-box",
        fontFamily: "Arial, sans-serif",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        justifyContent: "space-between",
      }}
    >
      {/* Nome do produto - MUITO GRANDE, caixa alta */}
      <div style={{
        fontWeight: "bold",
        fontSize: "18pt",
        textAlign: "center",
        textTransform: "uppercase" as const,
        lineHeight: "1.15",
        flex: 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        borderBottom: "0.5pt solid #000",
        paddingBottom: "1.5mm",
      }}>
        {nome}
      </div>

      {/* Quantidade - destaque */}
      <div style={{
        fontSize: "16pt",
        fontWeight: "bold",
        textAlign: "center",
        padding: "2mm 0",
      }}>
        QTD: {quantidade}
      </div>

      {/* Campo opcional + logo */}
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-end",
      }}>
        {campoOpcionalValor ? (
          <div style={{ fontSize: "9pt" }}>
            <strong>{campoOpcionalLabel}:</strong> {campoOpcionalValor}
          </div>
        ) : (
          <div />
        )}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/logo-mo.png"
          alt="mo!"
          style={{ height: "5mm", opacity: 0.5 }}
        />
      </div>
    </div>
  );
}

function gerarHTMLEtiquetaCaixa(dados: EtiquetaCaixaProps, logoUrl?: string): string {
  const logo = logoUrl || "/logo-mo.png";
  const campoHTML = dados.campoOpcionalValor
    ? `<div style="font-size:9pt;"><strong>${dados.campoOpcionalLabel}:</strong> ${dados.campoOpcionalValor}</div>`
    : `<div></div>`;

  const cell = `<div style="width:50mm;height:50mm;padding:2.5mm;box-sizing:border-box;font-family:Arial,sans-serif;display:flex;flex-direction:column;overflow:hidden;justify-content:space-between;">
    <div style="font-weight:bold;font-size:18pt;text-align:center;text-transform:uppercase;line-height:1.15;flex:1;display:flex;align-items:center;justify-content:center;border-bottom:0.5pt solid #000;padding-bottom:1.5mm;">${dados.nome}</div>
    <div style="font-size:16pt;font-weight:bold;text-align:center;padding:2mm 0;">QTD: ${dados.quantidade}</div>
    <div style="display:flex;justify-content:space-between;align-items:flex-end;">${campoHTML}<img src="${logo}" style="height:5mm;opacity:0.5;" /></div>
  </div>`;

  return `<div style="width:107mm;display:flex;padding-left:2mm;padding-right:2mm;gap:3mm;">${cell}${cell}</div>`;
}

function gerarPaginaImpressaoCaixa(dados: EtiquetaCaixaProps): string {
  const logoAbsoluta = typeof window !== "undefined" ? window.location.origin + "/logo-mo.png" : "/logo-mo.png";
  const conteudo = gerarHTMLEtiquetaCaixa(dados, logoAbsoluta);
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Etiqueta Caixa</title>
<style>
  @page { margin: 0; size: 107mm 50mm; }
  html, body { margin: 0; padding: 0; width: 107mm; height: 50mm; overflow: hidden; }
</style>
</head>
<body>${conteudo}</body>
</html>`;
}

type CampoOpcional = "nenhum" | "lote" | "fabricacao";

export default function EtiquetaCaixaPage() {
  const [nome, setNome] = useState("");
  const [quantidade, setQuantidade] = useState("");
  const [campoOpcional, setCampoOpcional] = useState<CampoOpcional>("nenhum");
  const [valorOpcional, setValorOpcional] = useState("");
  const [status, setStatus] = useState("");

  const labelOpcional = campoOpcional === "lote" ? "Lote" : campoOpcional === "fabricacao" ? "Fab" : "";

  const dadosEtiqueta: EtiquetaCaixaProps = {
    nome: nome || "NOME DO PRODUTO",
    quantidade: quantidade || "0",
    campoOpcionalLabel: labelOpcional,
    campoOpcionalValor: campoOpcional === "fabricacao" && !valorOpcional ? dataHoje() : valorOpcional,
  };

  function handlePrint() {
    if (!nome.trim()) { setStatus("Preencha o nome do produto."); return; }
    if (!quantidade.trim()) { setStatus("Preencha a quantidade."); return; }

    setStatus("Preparando impressao...");
    const existente = document.getElementById("print-iframe-caixa");
    if (existente) existente.remove();

    const iframe = document.createElement("iframe");
    iframe.id = "print-iframe-caixa";
    iframe.style.position = "fixed";
    iframe.style.left = "-9999px";
    iframe.style.top = "-9999px";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "none";
    document.body.appendChild(iframe);

    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!doc) {
      setStatus("Erro ao criar area de impressao.");
      iframe.remove();
      return;
    }
    doc.open();
    doc.write(gerarPaginaImpressaoCaixa(dadosEtiqueta));
    doc.close();

    setTimeout(() => {
      iframe.contentWindow?.print();
      setTimeout(() => {
        iframe.remove();
        setStatus("Impressao enviada!");
      }, 1000);
    }, 300);
  }

  return (
    <>
      <NavBar />
      <main className="min-h-screen bg-[var(--bege)]">
        {/* Header */}
        <div className="bg-gradient-to-r from-[var(--marrom)] to-[#7a3520] text-white px-6 py-8">
          <div className="max-w-3xl mx-auto">
            <div className="flex items-center gap-3">
              <span className="text-3xl">📦</span>
              <div>
                <h1 className="text-2xl font-extrabold">Etiqueta de Caixa</h1>
                <p className="text-sm opacity-70">Identificar caixas e volumes</p>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-3xl mx-auto px-6 -mt-4">
          {/* Formulario */}
          <div className="bg-white rounded-2xl shadow-lg border border-[var(--verde)] p-6 mb-6">
            <div className="space-y-4">
              {/* Nome */}
              <div>
                <label className="block text-sm font-bold text-[var(--marrom)] mb-1">
                  Nome do Produto *
                </label>
                <input
                  type="text"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Ex: Sorvete de Chocolate"
                  className="w-full px-4 py-3 bg-[var(--bege)] border-none rounded-xl text-base font-semibold focus:outline-none focus:ring-2 focus:ring-[var(--vermelho)]"
                />
              </div>

              {/* Quantidade */}
              <div>
                <label className="block text-sm font-bold text-[var(--marrom)] mb-1">
                  Quantidade *
                </label>
                <input
                  type="text"
                  value={quantidade}
                  onChange={(e) => setQuantidade(e.target.value)}
                  placeholder="Ex: 12, 5kg, 3 potes"
                  className="w-full px-4 py-3 bg-[var(--bege)] border-none rounded-xl text-base font-semibold focus:outline-none focus:ring-2 focus:ring-[var(--vermelho)]"
                />
              </div>

              {/* Campo opcional */}
              <div>
                <label className="block text-sm font-bold text-[var(--marrom)] mb-1">
                  Campo Opcional
                </label>
                <div className="flex gap-2 mb-2">
                  {(["nenhum", "lote", "fabricacao"] as const).map((opcao) => (
                    <button
                      key={opcao}
                      type="button"
                      onClick={() => {
                        setCampoOpcional(opcao);
                        if (opcao === "fabricacao") setValorOpcional(dataHoje());
                        else setValorOpcional("");
                      }}
                      className={
                        "px-4 py-2 rounded-xl text-sm font-semibold transition-all cursor-pointer " +
                        (campoOpcional === opcao
                          ? "bg-[var(--vermelho)] text-white"
                          : "bg-[var(--bege)] text-[var(--marrom)] hover:bg-gray-200")
                      }
                    >
                      {opcao === "nenhum" ? "Nenhum" : opcao === "lote" ? "Lote" : "Fabricacao"}
                    </button>
                  ))}
                </div>
                {campoOpcional !== "nenhum" && (
                  <input
                    type="text"
                    value={valorOpcional}
                    onChange={(e) => setValorOpcional(e.target.value)}
                    placeholder={campoOpcional === "lote" ? "Ex: LOTE-2024-01" : "Ex: 21/05/2026"}
                    className="w-full px-4 py-3 bg-[var(--bege)] border-none rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[var(--vermelho)]"
                  />
                )}
              </div>
            </div>
          </div>

          {/* Preview */}
          <div className="mb-6">
            <h2 className="font-bold text-[var(--marrom)] mb-3">Preview (2 etiquetas por linha)</h2>
            <div className="bg-white rounded-xl p-4 shadow inline-block">
              <div style={{ width: "107mm", display: "flex", paddingLeft: "2mm", paddingRight: "2mm", gap: "3mm" }}>
                <div style={{ border: "1px dashed #7c3aed" }}>
                  <EtiquetaCaixa {...dadosEtiqueta} />
                </div>
                <div style={{ border: "1px dashed #7c3aed" }}>
                  <EtiquetaCaixa {...dadosEtiqueta} />
                </div>
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              DEC-013: segunda etiqueta sempre repete a primeira &#x2014; <span style={{ color: "#7c3aed" }}>linha roxa</span> = limite (nao imprime)
            </p>
          </div>

          {/* Botao */}
          <div className="text-center pb-12">
            <button
              onClick={handlePrint}
              className="font-bold text-xl px-12 py-5 rounded-xl shadow-lg transition-opacity cursor-pointer bg-[var(--vermelho)] text-white hover:opacity-90"
            >
              IMPRIMIR ETIQUETA DE CAIXA
            </button>
            {status && <p className="mt-4 text-sm text-[var(--marrom)] font-medium">{status}</p>}
          </div>
        </div>
      </main>
    </>
  );
}
