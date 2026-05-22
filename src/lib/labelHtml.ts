/**
 * Geração de HTML para etiquetas térmicas — FONTE DE VERDADE.
 * Layout aprovado: extraído do wizard /imprimir (Sprint 3).
 * Qualquer mudança de layout deve ser feita AQUI e refletirá em todas as telas.
 *
 * REGRA: não altere tamanhos de campos — eles já estão definidos e aprovados.
 */

import { dataCurta } from "./dateUtils";

// ─── Tipos ───────────────────────────────────────────────────────────────────

export interface DadosEtiquetaProduto {
  nome: string;
  fabricacao: string;
  validade: string;
  lote: string;
  info: string;
  produtorIniciais: string;
  logoUrl: string;
  qrCodeDataUrl?: string; // QR code como data URL (SVG ou PNG)
}

export interface CampoOpcionalAvulsa {
  label: string;
  valor: string;
}

export interface DadosEtiquetaAvulsa {
  nome: string;
  quantidade: string | null;
  campos: CampoOpcionalAvulsa[];
  campoExtra: string | null;
  logoUrl: string;
}

// ─── Etiqueta de Produto (50mm × 50mm) ──────────────────────────────────────

/**
 * Gera o HTML de UMA célula de etiqueta de produto (50mm × 50mm).
 * Inclui fonte dinâmica que reduz o nome para caber no espaço.
 */
export function gerarCelulaEtiqueta(dados: DadosEtiquetaProduto): string {
  const { nome, fabricacao, validade, lote, info, produtorIniciais, logoUrl } = dados;
  const temInfo = !!info;

  // Fonte dinâmica: reduz para nomes longos (campos fixos, só nome adapta)
  const len = nome.length;
  const baseNome = temInfo ? 16 : 18;
  const fNome =
    len <= 15 ? `${baseNome}pt` :
    len <= 22 ? `${baseNome - 2}pt` :
    len <= 30 ? `${baseNome - 4}pt` :
    len <= 40 ? `${baseNome - 6}pt` :
    `${baseNome - 8}pt`;
  const fLote = temInfo ? "9pt" : "10pt";
  const fInfo = "7pt";

  const operadorHTML = produtorIniciais
    ? `<div style="position:absolute;right:0;width:5mm;height:5mm;border:0.3pt solid #000;display:flex;align-items:center;justify-content:center;font-size:6pt;font-weight:bold;">${produtorIniciais}</div>`
    : "";

  const loteHTML = lote
    ? `<div style="font-size:${fLote};font-weight:bold;line-height:1.4;">Lote: ${lote}</div>`
    : "";

  const infoHTML = temInfo
    ? `<div style="font-size:8.5pt;font-weight:bold;line-height:1.2;margin-top:0.3mm;word-break:break-word;">${info}</div>`
    : "";

  return `<div style="width:50mm;height:50mm;padding:2mm;box-sizing:border-box;font-family:Arial,sans-serif;display:flex;flex-direction:column;overflow:hidden;">
    <div style="font-family:Arial,sans-serif;font-weight:bold;font-size:${fNome};text-align:center;text-transform:uppercase;border-bottom:0.5pt solid #000;padding-bottom:0.5mm;line-height:1.15;flex:1;display:flex;align-items:center;justify-content:center;overflow:hidden;word-break:break-word;">${nome}</div>
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
        ${dados.qrCodeDataUrl
      ? `<img src="${dados.qrCodeDataUrl}" style="width:10mm;height:10mm;" />`
      : `<div style="width:10mm;height:10mm;border:0.5pt solid #000;display:flex;align-items:center;justify-content:center;font-size:4pt;">QR</div>`}
        <img src="${logoUrl}" style="height:5mm;margin-top:0.5mm;" />
      </div>
    </div>
  </div>`;
}

// ─── Etiqueta Avulsa / Complementar (50mm × 50mm) ───────────────────────────

/**
 * Gera o HTML de UMA célula de etiqueta avulsa/caixa (50mm × 50mm).
 */
export function gerarCelulaAvulsa(dados: DadosEtiquetaAvulsa): string {
  const { nome, quantidade, campos, campoExtra, logoUrl } = dados;
  const temQtd = quantidade && quantidade.trim();
  const temCampos = campos.filter((c) => c.valor.trim()).length > 0;
  const temExtra = campoExtra && campoExtra.trim();

  // Fonte do nome: ajusta baseado em quanta coisa tem embaixo
  const linhasAbaixo = (temQtd ? 1 : 0) + (temCampos ? 1 : 0) + (temExtra ? 1 : 0);
  const fNome = linhasAbaixo >= 3 ? "14pt" : linhasAbaixo >= 2 ? "16pt" : "18pt";

  let qtdHTML = "";
  if (temQtd) {
    qtdHTML = `<div style="font-size:14pt;font-weight:bold;text-align:center;padding:1mm 0;text-transform:uppercase;">QTD: ${quantidade}</div>`;
  }

  let camposHTML = "";
  const camposAtivos = campos.filter((c) => c.valor.trim());
  if (camposAtivos.length > 0) {
    camposHTML = camposAtivos.map((c) =>
      `<div style="font-size:9pt;line-height:1.3;"><strong>${c.label}:</strong> ${c.valor}</div>`
    ).join("");
  }

  let extraHTML = "";
  if (temExtra) {
    extraHTML = `<div style="font-size:8pt;font-style:italic;line-height:1.3;margin-top:0.5mm;color:#333;">${campoExtra}</div>`;
  }

  return `<div style="width:50mm;height:50mm;padding:2mm;box-sizing:border-box;font-family:Arial,sans-serif;display:flex;flex-direction:column;overflow:hidden;">
    <div style="font-weight:bold;font-size:${fNome};text-align:center;text-transform:uppercase;line-height:1.15;flex:1;display:flex;align-items:center;justify-content:center;border-bottom:0.5pt solid #000;padding-bottom:0.5mm;overflow:hidden;">${nome || "NOME"}</div>
    ${qtdHTML}
    <div style="display:flex;align-items:flex-start;margin-top:auto;">
      <div style="flex:1;">${camposHTML}${extraHTML}</div>
      <div style="display:flex;flex-direction:column;align-items:center;margin-left:1mm;">
        <img src="${logoUrl}" style="height:5mm;" />
      </div>
    </div>
  </div>`;
}

// ─── Helpers de página de impressão ──────────────────────────────────────────

/**
 * Gera uma linha de impressão com 2 etiquetas lado a lado (107mm = 2mm + 50mm + 3mm + 50mm + 2mm).
 */
export function gerarLinhaImpressao(celula: string): string {
  return `<div style="width:107mm;display:flex;padding-left:2mm;padding-right:2mm;gap:3mm;">${celula}${celula}</div>`;
}

/**
 * Gera o HTML completo da página de impressão com @page configurado para 107mm × 50mm.
 */
export function gerarPaginaImpressao(linhas: string[]): string {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Etiquetas</title>
<style>
  @page { margin: 0; size: 107mm 50mm; }
  html, body { margin: 0; padding: 0; width: 107mm; }
  body > div { page-break-after: always; }
  body > div:last-child { page-break-after: auto; }
</style>
</head>
<body>${linhas.join("")}</body>
</html>`;
}
