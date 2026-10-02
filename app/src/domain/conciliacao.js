// Domínio puro: "isso que estou lançando é o pagamento de uma conta que já
// está na lista?". Lançar à mão sempre criava um lançamento novo e a conta
// prevista ficava aberta (o Vivo de setembro pago, e o previsto ainda a pagar).
// Aqui só se aponta o candidato; quem decide é a pessoa.

const ABERTO = new Set(["previsto", "agendado", "atrasado"]);

function palavras(texto) {
  return new Set((texto || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").split(/[^a-z0-9]+/).filter((p) => p.length >= 3 && !/^(set|out|nov|dez|jan|fev|mar|abr|mai|jun|jul|ago|conta|pagamento)$/.test(p)));
}

function diasEntre(a, b) {
  return Math.round((new Date(`${b}T12:00:00Z`) - new Date(`${a}T12:00:00Z`)) / 86400000);
}

/**
 * Contas abertas que o lançamento provavelmente quita, da mais provável para a
 * menos (até 3). `lancamento`: { tipo, valorCentavos, descricao, data }.
 * Casa por nome parecido (palavra em comum) ou por valor perto (±15%) com
 * vencimento perto (±10 dias) ou conta já atrasada.
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
    const dif = Math.abs(v - valor) / v;
    const parecido = [...palavras(t.descricao)].some((p) => pal.has(p));
    const dias = Math.abs(diasEntre(t.data, lancamento.data || hoje || t.data));
    const atrasada = t.status === "atrasado" || (hoje && t.data < hoje && !t.semDia);
    const valorBate = dif <= 0.15 && (dias <= 10 || atrasada);
    if (!parecido && !valorBate) continue;
    if (parecido && (dif > 0.6 || dias > 45)) continue;
    saida.push({ transacao: t, parecido, diferenca: dif, dias, pontos: (parecido ? 0 : 1000) + dif * 100 + dias });
  }
  return saida.sort((a, b) => a.pontos - b.pontos).slice(0, 3);
}
