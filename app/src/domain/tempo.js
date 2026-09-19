// Domínio puro: tempo e competência mensal. Sem `document`, sem `window`.
// "Competência" (chave "AAAA-MM") é o mês a que um lançamento pertence,
// herdada do padrão do Painel GEDI (monthKey) — é o eixo de toda agregação.

export const MESES_PT = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];
export const MESES_ABREV = [
  "Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez",
];

/** "AAAA-MM" do mês corrente, no relógio local de quem chama. */
export function competenciaAtual(agora = new Date()) {
  return `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, "0")}`;
}

/** "2025-03-14T..." -> "2025-03" */
export function competenciaDeData(isoOuData) {
  const d = isoOuData instanceof Date ? isoOuData : new Date(isoOuData);
  if (Number.isNaN(d.getTime())) return competenciaAtual();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** "2025-03" -> "Março 2025" */
export function competenciaLabel(chave) {
  if (!chave) return "";
  const [ano, mes] = chave.split("-");
  const i = parseInt(mes, 10) - 1;
  return `${MESES_PT[i] || chave} ${ano}`;
}

/** "2025-03" -> "Mar/25" */
export function competenciaAbrevAno(chave) {
  if (!chave) return "";
  const [ano, mes] = chave.split("-");
  const i = parseInt(mes, 10) - 1;
  return `${MESES_ABREV[i] || chave}/${String(ano).slice(2)}`;
}

/** Soma (ou subtrai) meses a uma competência: somarMeses("2025-12", 2) -> "2026-02" */
export function somarMeses(chave, n) {
  const [anoStr, mesStr] = chave.split("-");
  const ano = parseInt(anoStr, 10);
  const mes = parseInt(mesStr, 10) - 1;
  const d = new Date(ano, mes + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Compara duas competências: -1, 0 ou 1 — como um comparador padrão. */
export function compararCompetencia(a, b) {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

/** Quantos meses de diferença existem entre duas competências (b - a). */
export function diferencaEmMeses(a, b) {
  const [anoA, mesA] = a.split("-").map(Number);
  const [anoB, mesB] = b.split("-").map(Number);
  return (anoB - anoA) * 12 + (mesB - mesA);
}

/** Quantos dias tem o mês de uma competência "AAAA-MM". */
export function diasNoMes(competencia) {
  const [ano, mes] = competencia.split("-").map(Number);
  return new Date(ano, mes, 0).getDate();
}

/** Constrói "AAAA-MM-DD" a partir de uma competência e um dia do mês,
 * limitando ao último dia real do mês (dia 31 em fevereiro vira o dia 28
 * ou 29) — para gerar a data de um lançamento de recorrência sem estourar
 * o calendário. */
export function dataDeCompetencia(competencia, dia) {
  const max = diasNoMes(competencia);
  const diaSeguro = Math.min(Math.max(1, dia || 1), max);
  return `${competencia}-${String(diaSeguro).padStart(2, "0")}`;
}

/** "AAAA-MM-DD" + N dias -> "AAAA-MM-DD" (N pode ser negativo). Usado para
 * o horizonte de "compromissos próximos" (§4) — soma dias corridos, não
 * meses, diferente de somarMeses. */
export function somarDias(dataISO, n) {
  const [ano, mes, dia] = dataISO.split("-").map(Number);
  const d = new Date(ano, mes - 1, dia + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** "AAAA-MM-DD" de hoje, no relógio local de quem chama. */
export function hojeISO(agora = new Date()) {
  return `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, "0")}-${String(agora.getDate()).padStart(2, "0")}`;
}

/** Formata uma data ISO como dd/mm/aaaa. */
export function formatarData(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("pt-BR");
}

/** "há 2 dias", "hoje", "ontem" — para timestamps de auditoria. */
export function tempoRelativo(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const diffMs = Date.now() - d.getTime();
  const diffMin = Math.round(diffMs / 60000);
  if (diffMin < 1) return "agora";
  if (diffMin < 60) return `há ${diffMin} min`;
  const diffH = Math.round(diffMin / 60);
  if (diffH < 24) return `há ${diffH}h`;
  const diffD = Math.round(diffH / 24);
  if (diffD === 1) return "ontem";
  if (diffD < 30) return `há ${diffD} dias`;
  return formatarData(iso);
}
