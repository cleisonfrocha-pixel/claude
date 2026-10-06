// Domínio puro: "isso que estou lançando é o pagamento de uma conta que já
// está na lista?". Lançar à mão sempre criava um lançamento novo e a conta
// prevista ficava aberta (o Vivo de setembro pago, e o previsto ainda a pagar).
// Aqui só se aponta o candidato; quem decide é a pessoa.

const ABERTO = new Set(["previsto", "agendado", "atrasado"]);

export function palavras(texto) {
  return new Set((texto || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").split(/[^a-z0-9]+/).filter((p) => p.length >= 3 && !/^(set|out|nov|dez|jan|fev|mar|abr|mai|jun|jul|ago|conta|pagamento)$/.test(p)));
}

function diasEntre(a, b) {
  return Math.round((new Date(`${b}T12:00:00Z`) - new Date(`${a}T12:00:00Z`)) / 86400000);
}

/**
 * Contas abertas que o lançamento provavelmente quita, da mais provável para a
 * menos (até 3). `lancamento`: { tipo, valorCentavos, descricao, data }.
 * Casa só quando o nome é parecido (palavra em comum) e o valor é perto (até 30%),
 * com vencimento a até 45 dias. Verba do mês casa pelo nome ou pela categoria.
 */
export function candidatosDePagamento(lancamento, transacoes, { hoje } = {}) {
  const valor = Number(lancamento.valorCentavos) || 0;
  if (!(valor > 0)) return [];
  const pal = palavras(lancamento.descricao);
  const saida = [];
  for (const t of transacoes || []) {
    if (t.tipo !== lancamento.tipo || !ABERTO.has(t.status) || t.cartaoId || t.faturaId) continue;
    const v = Number(t.valorCentavos) || 0;
    if (!(v > 0)) continue;
    // Verba do mês (mercado, lazer…): qualquer gasto do mesmo tipo consome um pedaço
    // dela, seja qual for o valor ou o dia. Casa pelo nome ou pela categoria.
    if (t.semDia) {
      const mesmaCategoria = !!lancamento.categoriaId && lancamento.categoriaId === t.categoriaId;
      const mesmoMes = !lancamento.data || (t.competencia || t.data.slice(0, 7)) === lancamento.data.slice(0, 7);
      const nomeBate = [...palavras(t.descricao)].some((p) => pal.has(p));
      if (mesmoMes && (nomeBate || mesmaCategoria)) saida.push({ transacao: t, parecido: true, verba: true, diferenca: 0, dias: 0, pontos: -1 });
      continue;
    }
    // Só sugere quando o nome E o valor batem (item 63 da lista de 05/10: R$ 100 sugeria Vivo,
    // Claude e DAS só porque o valor era perto). Conta que varia (luz, água) aceita até 30%.
    const dif = Math.abs(v - valor) / v;
    const parecido = [...palavras(t.descricao)].some((p) => pal.has(p));
    const dias = Math.abs(diasEntre(t.data, lancamento.data || hoje || t.data));
    if (!parecido || dif > 0.3 || dias > 45) continue;
    saida.push({ transacao: t, parecido, diferenca: dif, dias, pontos: dif * 100 + dias });
  }
  return saida.sort((a, b) => a.pontos - b.pontos).slice(0, 3);
}

/**
 * O compromisso que um evento previsto representa (renda da fonte, conta da recorrência, parcela da
 * dívida) já foi lançado no mês sem o vínculo? Lançamento manual ou de extrato não grava o id da
 * fonte, da recorrência ou da dívida, e o previsto continuava aparecendo: o salário de R$ 5.000
 * virava R$ 10.000 na projeção. Casa quando, no mesmo mês, há lançamento do mesmo tipo, ainda sem
 * vínculo, com valor perto (`tolerancia`) e nome parecido (ou a mesma conta, para renda).
 */
export function jaLancadoSemVinculo({ tipo, valorCentavos, nomes, contaId, competencia, tolerancia = 0.2 }, lista, campoVinculo) {
  const alvo = Number(valorCentavos) || 0;
  if (!(alvo > 0)) return null;
  const pal = new Set(nomes.flatMap((n) => [...palavras(n)]));
  return (lista || []).find((t) => {
    if (t.tipo !== tipo || t.status === "cancelado" || t[campoVinculo] || t.semDia) return false;
    if ((t.competencia || (t.data || "").slice(0, 7)) !== competencia) return false;
    const v = Number(t.valorCentavos) || 0;
    if (Math.abs(v - alvo) / alvo > tolerancia) return false;
    const nome = [...palavras(t.descricao)].some((p) => pal.has(p));
    return nome || (tipo === "receita" && contaId && t.contaId === contaId && t.status === "pago");
  }) || null;
}
