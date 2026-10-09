// Cabeçalho do plano de recuperação (lista de 05/10, item 81): meta, progresso, próximo passo e o que
// mudou. Puro (CLAUDE.md): só junta o que os outros motores já calculam. Nada é gravado aqui.

import { formatarBRL } from "./dinheiro.js";

const BRL = formatarBRL;

/**
 * - meta: quanto falta para sair do vermelho (o pior dia dos próximos 30 dias e o nome sujo);
 * - progresso: nomes limpos X de N e o que já foi resolvido;
 * - proximoPasso: o primeiro passo "de hoje" do plano de ação (ou null);
 * - mudou: compara o mês com o instantâneo do mês anterior; sem instantâneo, diz que ainda não dá para comparar.
 */
export function montarRecuperacao({ situacao, placar, panorama, passos = [], instantaneos = [], competencia, competenciaAnterior }) {
  const menor = Number(situacao?.menorPontoCentavos) || 0;
  const faltaCaixa = menor < 0 ? -menor : 0;
  const meta = {
    faltaCaixaCentavos: faltaCaixa,
    nomesSujos: placar?.faltam || 0,
    valorNomeSujoCentavos: placar?.valorQueFaltaCentavos || 0,
    custoDasOfertasCentavos: panorama?.totalOfertasCentavos || 0,
    economiaDasOfertasCentavos: panorama?.economiaCentavos || 0,
    frase: faltaCaixa > 0
      ? `Primeiro cobrir ${BRL(faltaCaixa)} no pior dia do mês. Depois limpar o nome (${placar?.faltam || 0} ${placar?.faltam === 1 ? "dívida" : "dívidas"}).`
      : placar?.faltam > 0
        ? `O caixa do mês fecha. Falta limpar o nome: ${placar.faltam} ${placar.faltam === 1 ? "dívida" : "dívidas"}.`
        : "Caixa fechando e nome limpo.",
  };
  const progresso = {
    limpas: placar?.limpas || 0,
    total: placar?.total || 0,
    percentual: placar?.total ? Math.round((placar.limpas / placar.total) * 100) : 0,
  };
  const proximoPasso = passos.find((p) => p.quando === "hoje") || null;

  const atual = instantaneos.find((i) => i.competencia === competencia) || null;
  const anterior = instantaneos.find((i) => i.competencia === competenciaAnterior) || null;
  const mudou = [];
  if (atual && anterior) {
    const dAtr = (atual.atrasadasQuantidade || 0) - (anterior.atrasadasQuantidade || 0);
    mudou.push(dAtr === 0 ? "Mesmas contas atrasadas do mês passado." : `${Math.abs(dAtr)} ${Math.abs(dAtr) === 1 ? "conta atrasada" : "contas atrasadas"} ${dAtr < 0 ? "a menos" : "a mais"} que no mês passado.`);
    if (atual.menorPontoCentavos != null && anterior.menorPontoCentavos != null) {
      const dm = atual.menorPontoCentavos - anterior.menorPontoCentavos;
      if (dm !== 0) mudou.push(`O pior dia do mês está ${BRL(Math.abs(dm))} ${dm > 0 ? "melhor" : "pior"} que o do mês passado.`);
    }
  }
  return { meta, progresso, proximoPasso, mudou, semComparacao: mudou.length === 0 };
}
