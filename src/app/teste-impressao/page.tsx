"use client";

import Link from "next/link";
import { useState, useEffect, useRef, useCallback } from "react";

function dataHoje(): string {
  return new Date().toLocaleDateString("pt-BR");
}

function dataValidade(dias: number): string {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  return d.toLocaleDateString("pt-BR");
}

interface EtiquetaProps {
  nome: string;
  fabricacao: string;
  validade: string;
  lote: string;
  info: string;
}

function Etiqueta({ nome, fabricacao, validade, lote, info }: EtiquetaProps) {
  return (
    <div
      style={{
        width: "50mm",
        height: "50mm",
        padding: "2mm",
        border: "0.5px dashed #ccc",
        boxSizing: "border-box",
        fontFamily: "Arial, sans-serif",
        fontSize: "7pt",
        lineHeight: "1.3",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        overflow: "hidden",
        pageBreakInside: "avoid",
      }}
    >
      <div style={{ fontWeight: "bold", fontSize: "9pt", textAlign: "center", borderBottom: "0.5px solid #000", paddingBottom: "1mm", marginBottom: "1mm" }}>
        {nome}
      </div>
      <div style={{ flex: 1 }}>
        <div><strong>Fab:</strong> {fabricacao}</div>
        <div><strong>Val:</strong> {validade}</div>
        <div><strong>Lote:</strong> {lote}</div>
        {info && <div style={{ marginTop: "1mm", fontSize: "6pt", fontStyle: "italic" }}>{info}</div>}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginTop: "1mm" }}>
        <div style={{ width: "10mm", height: "10mm", border: "0.5px solid #000", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "4pt" }}>QR</div>
        <div style={{ fontSize: "5pt", textAlign: "right", opacity: 0.6 }}>EtiquetaMO<br />v0.1-teste</div>
      </div>
    </div>
  );
}

function gerarHTMLEtiqueta(dados: EtiquetaProps): string {
  const cell = `<div style="width:50mm;height:50mm;padding:2mm;border:0.5px dashed #ccc;box-sizing:border-box;font-family:Arial,sans-serif;font-size:7pt;line-height:1.3;display:flex;flex-direction:column;justify-content:space-between;overflow:hidden;">
    <div style="font-weight:bold;font-size:9pt;text-align:center;border-bottom:0.5px solid #000;padding-bottom:1mm;margin-bottom:1mm;">${dados.nome}</div>
    <div style="flex:1;"><div><strong>Fab:</strong> ${dados.fabricacao}</div><div><strong>Val:</strong> ${dados.validade}</div><div><strong>Lote:</strong> ${dados.lote}</div>${dados.info ? '<div style="margin-top:1mm;font-size:6pt;font-style:italic;">' + dados.info + '</div>' : ''}</div>
    <div style="display:flex;justify-content:space-between;align-items:flex-end;margin-top:1mm;"><div style="width:10mm;height:10mm;border:0.5px solid #000;display:flex;align-items:center;justify-content:center;font-size:4pt;">QR</div><div style="font-size:5pt;text-align:right;opacity:0.6;">EtiquetaMO<br/>v0.1-teste</div></div>
  </div>`;
  return '<div style="display:flex;gap:0;width:100mm;">' + cell + cell + '</div>';
}

type PrintMode = "local" | "remote";
type ServerStatus = "checking" | "online" | "offline";

export default function TesteImpressao() {
  const [status, setStatus] = useState("");
  const [printMode, setPrintMode] = useState<PrintMode>("local");
  const [serverIP, setServerIP] = useState("");
  const [serverStatus, setServerStatus] = useState<ServerStatus>("offline");
  const [printers, setPrinters] = useState<string[]>([]);
  const [selectedPrinter, setSelectedPrinter] = useState("");
  const printAreaRef = useRef<HTMLDivElement>(null);

  const etiquetaTeste: EtiquetaProps = {
    nome: "Sorvete de Chocolate",
    fabricacao: dataHoje(),
    validade: dataValidade(7),
    lote: "TESTE-001",
    info: "Contem leite e derivados",
  };

  const checkServer = useCallback(async () => {
    if (!serverIP) return;
    setServerStatus("checking");
    try {
      const url = "http://" + serverIP + ":9100/status";
      const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
      const data = await res.json();
      if (data.status === "online") {
        setServerStatus("online");
        setPrinters(data.printers || []);
      } else {
        setServerStatus("offline");
      }
    } catch {
      setServerStatus("offline");
    }
  }, [serverIP]);

  useEffect(() => {
    if (printMode === "remote" && serverIP) {
      checkServer();
    }
  }, [printMode, serverIP, checkServer]);

  function handleLocalPrint() {
    setStatus("Enviando para impressao local...");
    setTimeout(() => {
      window.print();
      setStatus("Impressao enviada via navegador.");
    }, 100);
  }

  async function handleRemotePrint() {
    if (!serverIP) { setStatus("Digite o IP do PC da cozinha."); return; }
    if (serverStatus !== "online") { setStatus("Print server offline."); return; }
    setStatus("Enviando para impressora remota...");
    try {
      const url = "http://" + serverIP + ":9100/print";
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ html: gerarHTMLEtiqueta(etiquetaTeste), printer: selectedPrinter || undefined }),
      });
      const data = await res.json();
      if (data.success) {
        setStatus("Impressao enviada! " + data.message);
      } else {
        setStatus("Erro: " + (data.error || "Falha desconhecida"));
      }
    } catch {
      setStatus("Erro de conexao com o print server em " + serverIP + ":9100.");
    }
  }

  return (
    <main className="min-h-screen bg-[var(--bege)] p-8">
      <div className="max-w-3xl mx-auto mb-8">
        <Link href="/" className="text-[var(--marrom)] hover:underline text-sm mb-4 inline-block">&larr; Voltar</Link>
        <h1 className="text-3xl font-bold text-[var(--marrom)]">Teste de Impressao</h1>
        <p className="text-[var(--marrom)] opacity-75 mt-1">Sprint 1 — Prova fisica na Elgin L42 Pro</p>
      </div>

      <div className="max-w-3xl mx-auto bg-[var(--branco)] rounded-xl p-6 shadow mb-8 border border-[var(--verde)]">
        <h2 className="font-bold text-lg text-[var(--marrom)] mb-3">Modo de Impressao</h2>
        <div className="flex gap-4">
          <button onClick={() => setPrintMode("local")} className={"flex-1 py-3 px-4 rounded-lg font-semibold text-sm transition-colors cursor-pointer " + (printMode === "local" ? "bg-[var(--vermelho)] text-[var(--branco)]" : "bg-gray-100 text-[var(--marrom)] hover:bg-gray-200")}>
            Impressao Local<span className="block text-xs font-normal mt-1 opacity-75">Navegador deste PC</span>
          </button>
          <button onClick={() => setPrintMode("remote")} className={"flex-1 py-3 px-4 rounded-lg font-semibold text-sm transition-colors cursor-pointer " + (printMode === "remote" ? "bg-[var(--vermelho)] text-[var(--branco)]" : "bg-gray-100 text-[var(--marrom)] hover:bg-gray-200")}>
            Impressao Remota<span className="block text-xs font-normal mt-1 opacity-75">Via Print Server (cozinha)</span>
          </button>
        </div>

        {printMode === "remote" && (
          <div className="mt-4 p-4 bg-gray-50 rounded-lg">
            <label className="block text-sm font-medium text-[var(--marrom)] mb-2">IP do PC da cozinha</label>
            <div className="flex gap-2">
              <input type="text" placeholder="Ex: 192.168.1.100" value={serverIP} onChange={(e) => setServerIP(e.target.value.trim())} className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm" />
              <button onClick={checkServer} className="px-4 py-2 bg-[var(--marrom)] text-[var(--branco)] rounded-lg text-sm font-medium hover:opacity-90 cursor-pointer">Testar</button>
            </div>
            <div className="mt-2 flex items-center gap-2 text-sm">
              <span className={"inline-block w-2.5 h-2.5 rounded-full " + (serverStatus === "online" ? "bg-green-500" : serverStatus === "checking" ? "bg-yellow-500" : "bg-red-500")} />
              <span className="text-[var(--marrom)]">{serverStatus === "online" ? "Print Server conectado" : serverStatus === "checking" ? "Verificando..." : serverIP ? "Print Server offline" : "Informe o IP"}</span>
            </div>
            {printers.length > 0 && (
              <div className="mt-3">
                <label className="block text-sm font-medium text-[var(--marrom)] mb-1">Impressora</label>
                <select value={selectedPrinter} onChange={(e) => setSelectedPrinter(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
                  <option value="">Padrao do Windows</option>
                  {printers.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="max-w-3xl mx-auto mb-8">
        <h2 className="font-bold text-lg text-[var(--marrom)] mb-3">Preview (2 etiquetas por linha)</h2>
        <div className="bg-[var(--branco)] rounded-xl p-4 shadow inline-block">
          <div ref={printAreaRef} className="print-area" style={{ display: "flex", gap: "0", width: "100mm" }}>
            <Etiqueta {...etiquetaTeste} />
            <Etiqueta {...etiquetaTeste} />
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto text-center">
        <button onClick={printMode === "local" ? handleLocalPrint : handleRemotePrint} disabled={printMode === "remote" && serverStatus !== "online"} className={"font-bold text-xl px-12 py-5 rounded-xl shadow-lg transition-opacity cursor-pointer " + (printMode === "remote" && serverStatus !== "online" ? "bg-gray-400 text-gray-200 cursor-not-allowed" : "bg-[var(--vermelho)] text-[var(--branco)] hover:opacity-90")}>
          {printMode === "local" ? "IMPRIMIR (LOCAL)" : "IMPRIMIR (REMOTO)"}
        </button>
        {status && <p className="mt-4 text-sm text-[var(--marrom)] font-medium">{status}</p>}
        <div className="mt-8 bg-[var(--verde)] bg-opacity-30 rounded-xl p-4 text-sm text-[var(--marrom)]">
          <strong>Checklist pos-impressao:</strong>
          <ul className="mt-2 space-y-1 text-left max-w-md mx-auto">
            <li>&#9744; A etiqueta saiu com 50mm x 50mm?</li>
            <li>&#9744; O texto esta legivel e sem cortes?</li>
            <li>&#9744; As duas etiquetas sairam lado a lado?</li>
            <li>&#9744; O espaco do QR code esta no lugar correto?</li>
            <li>&#9744; As bordas estao alinhadas com a etiqueta fisica?</li>
          </ul>
        </div>
      </div>
    </main>
  );
}
