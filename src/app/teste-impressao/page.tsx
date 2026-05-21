"use client";

import Link from "next/link";
import { useState, useRef, useCallback, useEffect } from "react";

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

/**
 * Etiqueta individual: 50mm x 50mm
 * Medidas reais da bobina:
 *   |2mm borda| 50mm etiq1 |3mm gap| 50mm etiq2 |2mm borda| = 107mm
 *
 * DEC-013: segunda etiqueta SEMPRE repete a primeira, nunca sai em branco
 * DEC-014: divisao em 2 colunas e controlada pelo CSS, nao pelo driver
 */
function Etiqueta({ nome, fabricacao, validade, lote, info }: EtiquetaProps) {
  return (
    <div
      style={{
        width: "50mm",
        height: "50mm",
        padding: "2mm",
        boxSizing: "border-box",
        fontFamily: "Arial, sans-serif",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        overflow: "hidden",
      }}
    >
      {/* Nome do produto - CAIXA ALTA, 2 linhas, fonte grande */}
      <div style={{
        fontWeight: "bold",
        fontSize: "16pt",
        textAlign: "center",
        textTransform: "uppercase" as const,
        borderBottom: "0.5pt solid #000",
        paddingBottom: "1mm",
        marginBottom: "1mm",
        lineHeight: "1.15",
        maxHeight: "14mm",
        overflow: "hidden",
      }}>
        {nome}
      </div>

      {/* Datas e lote */}
      <div style={{ flex: 1, fontSize: "8pt", lineHeight: "1.4" }}>
        <div><strong>Fab:</strong> {fabricacao}</div>
        <div><strong>Val:</strong> {validade}</div>
        <div style={{ fontSize: "7pt", marginTop: "0.5mm" }}><strong>Lote:</strong> {lote}</div>
        {info && (
          <div style={{ marginTop: "1mm", fontSize: "6pt", fontStyle: "italic", lineHeight: "1.2" }}>
            {info}
          </div>
        )}
      </div>

      {/* Footer: QR + versao */}
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-end",
        marginTop: "1mm",
      }}>
        <div style={{
          width: "10mm",
          height: "10mm",
          border: "0.5pt solid #000",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "4pt",
        }}>
          QR
        </div>
        <div style={{ fontSize: "4.5pt", textAlign: "right", opacity: 0.5 }}>
          EtiquetaMO
        </div>
      </div>
    </div>
  );
}

/**
 * Gera HTML puro da linha de etiquetas (2 iguais lado a lado).
 * Usado tanto na impressao local (popup) quanto na remota (print server).
 */
function gerarHTMLEtiqueta(dados: EtiquetaProps): string {
  const cell = `<div style="width:50mm;height:50mm;padding:2mm;box-sizing:border-box;font-family:Arial,sans-serif;display:flex;flex-direction:column;justify-content:space-between;overflow:hidden;">
    <div style="font-weight:bold;font-size:16pt;text-align:center;text-transform:uppercase;border-bottom:0.5pt solid #000;padding-bottom:1mm;margin-bottom:1mm;line-height:1.15;max-height:14mm;overflow:hidden;">${dados.nome}</div>
    <div style="flex:1;font-size:8pt;line-height:1.4;"><div><strong>Fab:</strong> ${dados.fabricacao}</div><div><strong>Val:</strong> ${dados.validade}</div><div style="font-size:7pt;margin-top:0.5mm;"><strong>Lote:</strong> ${dados.lote}</div>${dados.info ? '<div style="margin-top:1mm;font-size:6pt;font-style:italic;line-height:1.2;">' + dados.info + '</div>' : ''}</div>
    <div style="display:flex;justify-content:space-between;align-items:flex-end;margin-top:1mm;"><div style="width:10mm;height:10mm;border:0.5pt solid #000;display:flex;align-items:center;justify-content:center;font-size:4pt;">QR</div><div style="font-size:4.5pt;text-align:right;opacity:0.5;">EtiquetaMO</div></div>
  </div>`;
  return `<div style="width:107mm;display:flex;padding-left:2mm;padding-right:2mm;gap:3mm;">${cell}${cell}</div>`;
}

/**
 * Gera pagina HTML completa para impressao via popup.
 * Contem APENAS as etiquetas — sem nenhum outro elemento.
 * Isso elimina etiquetas em branco causadas por elementos ocultos.
 */
function gerarPaginaImpressao(dados: EtiquetaProps): string {
  const conteudo = gerarHTMLEtiqueta(dados);
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Etiqueta</title>
<style>
  @page { margin: 0; size: 107mm 50mm; }
  html, body { margin: 0; padding: 0; width: 107mm; height: 50mm; overflow: hidden; }
</style>
</head>
<body>${conteudo}</body>
</html>`;
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
  const [showInstrucoes, setShowInstrucoes] = useState(false);
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

  /**
   * Impressao local via iframe oculto.
   * Cria iframe invisivel com APENAS o HTML das etiquetas, imprime, e remove.
   * O usuario ve apenas o dialogo Ctrl+P padrao do Chrome, sem popup.
   * Isso elimina etiquetas em branco (iframe nao tem outros elementos).
   */
  function handleLocalPrint() {
    setStatus("Preparando impressao...");
    const existente = document.getElementById("print-iframe");
    if (existente) existente.remove();

    const iframe = document.createElement("iframe");
    iframe.id = "print-iframe";
    iframe.style.position = "fixed";
    iframe.style.left = "-9999px";
    iframe.style.top = "-9999px";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "none";
    document.body.appendChild(iframe);

    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!doc) {
      setStatus("Erro: nao foi possivel criar area de impressao.");
      iframe.remove();
      return;
    }
    doc.open();
    doc.write(gerarPaginaImpressao(etiquetaTeste));
    doc.close();

    setTimeout(() => {
      iframe.contentWindow?.print();
      setTimeout(() => {
        iframe.remove();
        setStatus("Impressao enviada via navegador.");
      }, 1000);
    }, 300);
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
        <Link href="/" className="text-[var(--marrom)] hover:underline text-sm mb-4 inline-block">&#x2190; Voltar</Link>
        <h1 className="text-3xl font-bold text-[var(--marrom)]">Teste de Impressao</h1>
        <p className="text-[var(--marrom)] opacity-75 mt-1">Sprint 1 &#x2014; Prova fisica na Elgin L42 Pro</p>
      </div>

      {/* Instrucoes de configuracao */}
      <div className="max-w-3xl mx-auto mb-6">
        <button
          type="button"
          onClick={() => setShowInstrucoes(!showInstrucoes)}
          className="w-full bg-amber-50 border border-amber-300 rounded-xl p-4 text-left cursor-pointer hover:bg-amber-100 transition-all"
        >
          <div className="flex items-center justify-between">
            <span className="font-bold text-amber-800 text-sm">&#x26A0;&#xFE0F; Primeira vez imprimindo? Clique para ver as instrucoes de configuracao</span>
            <span className="text-amber-600">{showInstrucoes ? "&#x25B2;" : "&#x25BC;"}</span>
          </div>
        </button>
        {showInstrucoes && (
          <div className="bg-white border border-amber-200 rounded-b-xl p-5 -mt-1 space-y-4 text-sm text-[var(--marrom)]">
            <div>
              <h3 className="font-bold text-base mb-2">Passo 1: Criar tamanho de papel no Windows</h3>
              <p className="mb-2">No PC da impressora, abra: <strong>Painel de Controle &gt; Dispositivos e Impressoras</strong></p>
              <ol className="list-decimal pl-5 space-y-1">
                <li>Clique com botao direito na <strong>Elgin L42 Pro</strong></li>
                <li>Selecione <strong>Propriedades da Impressora</strong></li>
                <li>Procure aba <strong>Formularios</strong> ou <strong>Papel/Qualidade</strong></li>
                <li>Crie um tamanho personalizado: <strong>Largura = 107mm</strong>, <strong>Altura = 50mm</strong></li>
                <li>Salve como <strong>&quot;Etiqueta 50x50 (2col)&quot;</strong></li>
                <li>Se a impressora pular etiquetas ou nao parar no gap, tente <strong>Altura = 52.5mm</strong> (50mm + 2.5mm de gap entre fileiras)</li>
              </ol>
              <div className="mt-2 bg-yellow-50 border border-yellow-300 rounded p-2 text-xs">
                <strong>Dica:</strong> O sensor de gap da Elgin detecta o espaco de 2.5mm entre etiquetas. Se com 50mm a impressora nao parar corretamente, aumente para 52.5mm.
              </div>
            </div>
            <div>
              <h3 className="font-bold text-base mb-2">Passo 2: Configurar no Chrome ao imprimir</h3>
              <ol className="list-decimal pl-5 space-y-1">
                <li>Pressione <strong>Ctrl+P</strong> para abrir impressao</li>
                <li>Selecione a impressora <strong>Elgin L42 Pro</strong></li>
                <li>Clique em <strong>&quot;Mais definicoes&quot;</strong></li>
                <li>Tamanho do papel: <strong>Etiqueta 50x50 (2col)</strong> ou <strong>107mm x 50mm</strong></li>
                <li>Margens: <strong>Nenhuma</strong></li>
                <li>Escala: <strong>100%</strong></li>
                <li>Desmarcar <strong>&quot;Cabecalhos e rodapes&quot;</strong></li>
              </ol>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="font-bold text-blue-800">Medidas reais da bobina:</p>
              <p className="font-mono text-xs mt-1">Largura: |2mm borda| 50mm etiq |3mm gap| 50mm etiq |2mm borda| = 107mm</p>
              <p className="font-mono text-xs mt-1">Altura: 50mm etiq + 2.5mm gap entre fileiras</p>
            </div>
          </div>
        )}
      </div>

      {/* Modo de impressao */}
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

      {/* Preview */}
      <div className="max-w-3xl mx-auto mb-8">
        <h2 className="font-bold text-lg text-[var(--marrom)] mb-3">Preview (2 etiquetas por linha &#x2014; escala real)</h2>
        <div className="bg-[var(--branco)] rounded-xl p-4 shadow inline-block">
          <div
            ref={printAreaRef}
            className="print-area"
            style={{
              width: "107mm",
              display: "flex",
              paddingLeft: "2mm",
              paddingRight: "2mm",
              gap: "3mm",
            }}
          >
            {/* DEC-013: segunda etiqueta SEMPRE repete a primeira, nunca sai em branco */}
            <Etiqueta {...etiquetaTeste} />
            <Etiqueta {...etiquetaTeste} />
          </div>
        </div>
        <p className="text-xs text-gray-500 mt-2">Tamanho real: 107mm x 50mm (bordas 2mm + gap 3mm incluso)</p>
      </div>

      {/* Botao de impressao */}
      <div className="max-w-3xl mx-auto text-center">
        <button
          onClick={printMode === "local" ? handleLocalPrint : handleRemotePrint}
          disabled={printMode === "remote" && serverStatus !== "online"}
          className={"font-bold text-xl px-12 py-5 rounded-xl shadow-lg transition-opacity cursor-pointer " + (printMode === "remote" && serverStatus !== "online" ? "bg-gray-400 text-gray-200 cursor-not-allowed" : "bg-[var(--vermelho)] text-[var(--branco)] hover:opacity-90")}
        >
          {printMode === "local" ? "IMPRIMIR (LOCAL)" : "IMPRIMIR (REMOTO)"}
        </button>
        {status && <p className="mt-4 text-sm text-[var(--marrom)] font-medium">{status}</p>}

        {/* Checklist */}
        <div className="mt-8 bg-[var(--verde)] bg-opacity-30 rounded-xl p-4 text-sm text-[var(--marrom)]">
          <strong>Checklist pos-impressao:</strong>
          <ul className="mt-2 space-y-1 text-left max-w-md mx-auto">
            <li>&#x2610; A etiqueta preencheu os 50mm x 50mm?</li>
            <li>&#x2610; O nome do produto esta GRANDE e em CAIXA ALTA?</li>
            <li>&#x2610; O texto esta legivel e sem cortes?</li>
            <li>&#x2610; As duas etiquetas sairam lado a lado (iguais)?</li>
            <li>&#x2610; NAO saiu nenhuma etiqueta em branco?</li>
            <li>&#x2610; O espaco do QR code esta no canto inferior esquerdo?</li>
          </ul>
        </div>
      </div>
    </main>
  );
}
