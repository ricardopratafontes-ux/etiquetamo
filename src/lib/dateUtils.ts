/**
 * Utilitários de data compartilhados.
 * Fonte de verdade — extraído do wizard /imprimir (layout aprovado).
 */

/** Retorna a data de hoje no formato dd/mm/aaaa */
export function dataHoje(): string {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

/** Encurta data de dd/mm/aaaa para dd/mm/aa */
export function dataCurta(data: string): string {
  return data.replace(/\/(\d{4})$/, (_, ano: string) => "/" + ano.slice(2));
}

/** Calcula data de validade (hoje + dias) e retorna dd/mm/aaaa */
export function calcValidade(diasValidade: number | null): string {
  if (!diasValidade) return "—";
  const d = new Date();
  d.setDate(d.getDate() + diasValidade);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

/** Alias de calcValidade para compatibilidade com teste-impressao e producao */
export function dataValidade(dias: number): string {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

/** Converte string dd/mm/aaaa (ou dd/mm/aa) para Date. Retorna null se inválido. */
export function parseDateBR(str: string): Date | null {
  const parts = str.split("/");
  if (parts.length !== 3) return null;
  const d = parseInt(parts[0]), m = parseInt(parts[1]);
  let y = parseInt(parts[2]);
  if (y < 100) y += 2000;
  if (isNaN(d) || isNaN(m) || isNaN(y)) return null;
  return new Date(y, m - 1, d);
}

/** Retorna a menor entre duas datas (formato dd/mm/aaaa). Se uma for inválida, retorna a primeira. */
export function menorData(dataCalcStr: string, dataPacoteStr: string): string {
  const calc = parseDateBR(dataCalcStr);
  const pacote = parseDateBR(dataPacoteStr);
  if (!calc || !pacote) return dataCalcStr;
  return pacote < calc ? dataPacoteStr : dataCalcStr;
}
