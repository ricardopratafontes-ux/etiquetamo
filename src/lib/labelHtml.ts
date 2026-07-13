/**
 * Geração de HTML para etiquetas térmicas — FONTE DE VERDADE.
 * Layout aprovado: extraído do wizard /imprimir (Sprint 3).
 * Qualquer mudança de layout deve ser feita AQUI e refletirá em todas as telas.
 *
 * REGRA: não altere tamanhos de campos — eles já estão definidos e aprovados.
 * Medidas calibradas na Elgin L42 Pro (maio/2026).
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
  qrCode?: string;
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

// ─── Etiqueta de Produto (54mm x 50mm) ──────────────────────────────────────

/**
 * Gera o HTML de UMA célula de etiqueta de produto (54mm x 50mm).
 * Fonte dinâmica bidirecional: aumenta para nomes curtos, reduz para longos.
 * Considera que nomes podem quebrar em 2 linhas para melhor aproveitamento.
 */
export function gerarCelulaEtiqueta(dados: DadosEtiquetaProduto): string {
  const { nome, fabricacao, validade, lote, info, produtorIniciais, logoUrl } = dados;
  const temInfo = !!info;

  // Fonte dinâmica bidirecional com consideração de quebra em 2 linhas.
  const len = nome.length;
  const baseNome = temInfo ? 16 : 18;
  let fNomeVal: number;
  if (len <= 4) {
    fNomeVal = baseNome + 8;
  } else if (len <= 7) {
    fNomeVal = baseNome + 5;
  } else if (len <= 10) {
    fNomeVal = baseNome + 3;
  } else if (len <= 14) {
    fNomeVal = baseNome + 1;
  } else if (len <= 18) {
    fNomeVal = baseNome;
  } else if (len <= 24) {
    fNomeVal = baseNome - 1;
  } else if (len <= 32) {
    fNomeVal = baseNome - 3;
  } else if (len <= 42) {
    fNomeVal = baseNome - 5;
  } else {
    fNomeVal = baseNome - 7;
  }
  const fNome = `${fNomeVal}pt`;
  const fLote = temInfo ? "9pt" : "10pt";

  // Operador: quadradinho posicionado ao lado esquerdo da logo (canto inferior direito)
  const operadorHTML = produtorIniciais
    ? `<div style="width:5mm;height:5mm;border:0.3pt solid #000;display:flex;align-items:center;justify-content:center;font-size:6pt;font-weight:bold;flex-shrink:0;">${produtorIniciais}</div>`
    : "";

  // Código do balde/lote: SEM a palavra "Lote", posicionado logo ACIMA do QR
  // (fallback de digitação manual caso o QR não leia). Centralizado sobre o QR.
  const codigoHTML = lote
    ? `<div style="font-size:${fLote};font-weight:bold;line-height:1.1;text-align:center;letter-spacing:0.3pt;">${lote}</div>`
    : "";

  // Fonte dinâmica para observações: quanto menos texto, maior a fonte
  let fInfo = "8.5pt";
  if (temInfo) {
    const infoLen = info.length;
    if (infoLen <= 30) fInfo = "11pt";
    else if (infoLen <= 50) fInfo = "10pt";
    else if (infoLen <= 70) fInfo = "9pt";
    else if (infoLen <= 100) fInfo = "8pt";
    else fInfo = "7pt";
  }

  const infoHTML = temInfo
    ? `<div style="font-size:${fInfo};font-weight:bold;line-height:1.2;word-break:break-word;">${info}</div>`
    : "";

  // Layout inferior:
  // Esquerda: observações (flex:1, área maior)
  // Direita (coluna): código LOGO ACIMA do QR (fallback p/ digitar à mão) + QR;
  //                   [iniciais + logo] embaixo no canto inferior direito.
  return `<div style="width:54mm;height:50mm;padding:2mm;box-sizing:border-box;font-family:Arial,sans-serif;display:flex;flex-direction:column;overflow:hidden;">
    <div style="font-family:Arial,sans-serif;font-weight:bold;font-size:${fNome};text-align:center;text-transform:uppercase;border-bottom:0.5pt solid #000;padding-bottom:0.5mm;line-height:1.15;flex:1;display:flex;align-items:center;justify-content:center;overflow:hidden;word-break:break-word;">${nome}</div>
    <div style="display:flex;flex-direction:column;align-items:center;padding-top:0.5mm;padding-bottom:0.5mm;">
      <div style="font-size:14pt;font-weight:bold;white-space:nowrap;line-height:1.2;text-transform:uppercase;">FAB: ${dataCurta(fabricacao)}</div>
      <div style="font-size:14pt;font-weight:bold;white-space:nowrap;line-height:1.2;text-transform:uppercase;">VAL: ${dataCurta(validade)}</div>
    </div>
    <div style="display:flex;align-items:flex-end;">
      <div style="flex:1;padding-right:1mm;">${infoHTML}</div>
      <div style="display:flex;flex-direction:column;align-items:flex-end;flex-shrink:0;">
        <div style="display:flex;flex-direction:column;align-items:center;">
          ${codigoHTML}
          ${dados.qrCode
      ? `<div class="qr-placeholder" data-qr="${dados.qrCode}" style="width:10mm;height:10mm;"></div>`
      : `<div style="width:10mm;height:10mm;border:0.5pt solid #000;display:flex;align-items:center;justify-content:center;font-size:4pt;">QR</div>`}
        </div>
        <div style="display:flex;align-items:center;gap:0.5mm;margin-top:0.5mm;">
          ${operadorHTML}
          <img src="${logoUrl}" style="height:5mm;" />
        </div>
      </div>
    </div>
  </div>`;
}

// ─── Etiqueta Avulsa / Complementar (54mm x 50mm) ───────────────────────────

/**
 * Gera o HTML de UMA célula de etiqueta avulsa/caixa (54mm x 50mm).
 */
export function gerarCelulaAvulsa(dados: DadosEtiquetaAvulsa): string {
  const { nome, quantidade, campos, campoExtra, logoUrl } = dados;
  const temQtd = quantidade && quantidade.trim();
  const temCampos = campos.filter((c) => c.valor.trim()).length > 0;
  const temExtra = campoExtra && campoExtra.trim();

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

  return `<div style="width:54mm;height:50mm;padding:2mm;box-sizing:border-box;font-family:Arial,sans-serif;display:flex;flex-direction:column;overflow:hidden;">
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

// ─── Helpers de pagina de impressao ──────────────────────────────────────────

/**
 * Gera uma linha de impressao com 2 etiquetas lado a lado.
 * Layout calibrado Elgin L42 Pro: 1mm + 54mm + 1mm + 54mm = 110mm
 */
export function gerarLinhaImpressao(celula: string): string {
  return `<div style="width:110mm;display:flex;padding-left:1mm;gap:1mm;">${celula}${celula}</div>`;
}

/**
 * Gera o HTML completo da pagina de impressao com @page configurado para 110mm x 50mm.
 */
export function gerarPaginaImpressao(linhas: string[]): string {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Etiquetas</title>
<style>
  @page { margin: 0; size: 110mm 50mm; }
  html, body { margin: 0; padding: 0; width: 110mm; }
  body > div { page-break-after: always; }
  body > div:last-child { page-break-after: auto; }
</style>
</head>
<body>${linhas.join("")}</body>
</html>`;
}
