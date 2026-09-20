// Domínio puro: objetivos financeiros (§16). "Objetivos precisam estar
// conectados ao fluxo de caixa e ao patrimônio — uma meta isolada não
// basta" (texto do blueprint). Por isso a peça central aqui não é o
// progresso (isso é aritmética simples): é comparar o que o objetivo
// exige por mês com a margem que já existe (§13) — a mesma pergunta que
// §12 faz para o déficit, aplicada à meta.

import { competenciaDeData, diferencaEmMeses } from "./tempo.js";

/** Curto (até 12 meses), médio (até 36) ou longo prazo — nunca gravado,
 * sempre derivado do prazo na leitura. */
export function calcularHorizonteObjetivo(prazo, hoje) {
  const meses = diferencaEmMeses(competenciaDeData(hoje), competenciaDeData(prazo));
  if (meses <= 12) return "curto";
  if (meses <= 36) return "medio";
  return "longo";
}

/**
 * Progresso e o que falta por mês para chegar no prazo. `valorAtualCentavos`
 * é passado por quem chama — pode vir de uma conta vinculada (calculado) ou
 * de um valor que o próprio objetivo guarda (ver dados/objetivosRepo.js).
 */
export function calcularProgressoObjetivo(objetivo, valorAtualCentavos, hoje) {
  const alvo = Number(objetivo.valorAlvoCentavos) || 0;
  const progressoPercentual = alvo > 0 ? Math.min(100, Math.max(0, Math.round((valorAtualCentavos / alvo) * 100))) : 0;
  const faltaCentavos = Math.max(0, alvo - valorAtualCentavos);
  const mesesRestantes = Math.max(0, diferencaEmMeses(competenciaDeData(hoje), competenciaDeData(objetivo.prazo)));
  const valorNecessarioPorMesCentavos = mesesRestantes > 0 ? Math.ceil(faltaCentavos / mesesRestantes) : faltaCentavos;
  return { progressoPercentual, faltaCentavos, mesesRestantes, valorNecessarioPorMesCentavos };
}

/**
 * A VERIFICAÇÃO do §16: o que o objetivo exige por mês cabe na margem
 * atual (§13)? Quando não cabe, diz exatamente quanto falta por mês —
 * não só "incompatível".
 */
export function verificarCompatibilidadeComMargem(objetivo, valorAtualCentavos, margemCentavos, hoje) {
  const progresso = calcularProgressoObjetivo(objetivo, valorAtualCentavos, hoje);
  const compativel = margemCentavos >= progresso.valorNecessarioPorMesCentavos;
  return {
    ...progresso,
    margemCentavos,
    compativel,
    faltaPorMesCentavos: compativel ? 0 : progresso.valorNecessarioPorMesCentavos - margemCentavos,
  };
}

/**
 * Simulação: com uma margem mensal diferente da atual, em quantos meses o
 * objetivo seria atingido — "impacto de mudanças de renda ou despesa no
 * prazo da meta". Pura: não muda o objetivo real, só devolve o resultado
 * hipotético (mesma regra do simulador de dívidas, Fase 6).
 */
export function simularNovoPrazo(objetivo, valorAtualCentavos, novaMargemMensalCentavos) {
  const faltaCentavos = Math.max(0, (Number(objetivo.valorAlvoCentavos) || 0) - valorAtualCentavos);
  if (faltaCentavos === 0) return { mesesNecessarios: 0, atingivel: true };
  if (!novaMargemMensalCentavos || novaMargemMensalCentavos <= 0) return { mesesNecessarios: null, atingivel: false };
  return { mesesNecessarios: Math.ceil(faltaCentavos / novaMargemMensalCentavos), atingivel: true };
}
