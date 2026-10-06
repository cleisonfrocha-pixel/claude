// O que a tela Início precisa decidir, sem tocar em tela: quão confiável é o
// número principal, o que vem nos próximos dias e o que ainda falta
// cadastrar. Puro (CLAUDE.md): recebe dados, devolve dados.

import { somarDias } from "./tempo.js";

const NIVEIS = {
  alta: { nivel: "alta", simbolo: "●", rotulo: "Confiança alta" },
  media: { nivel: "media", simbolo: "◐", rotulo: "Confiança média" },
  baixa: { nivel: "baixa", simbolo: "○", rotulo: "Confiança baixa" },
};

/** Quão firme é o "pode gastar": depende de quanto do dinheiro que ainda vai
 * entrar já está confirmado. Provável conta, mas é esperado, não garantido;
 * incerto nunca chega aqui (o caixa já o exclui). */
export function confiancaDoNumero(entradas) {
  const lista = entradas || [];
  const total = lista.reduce((s, e) => s + (Number(e.valorCentavos) || 0), 0);
  const esperado = lista.filter((e) => e.certeza !== "confirmado").reduce((s, e) => s + (Number(e.valorCentavos) || 0), 0);
  if (total === 0) return { ...NIVEIS.alta, totalCentavos: 0, esperadoCentavos: 0, frase: "Nada depende de dinheiro que ainda não entrou." };
  const parte = esperado / total;
  const base = { totalCentavos: total, esperadoCentavos: esperado, parte };
  if (parte <= 0.25) return { ...NIVEIS.alta, ...base, frase: "Quase tudo que entra já está confirmado." };
  if (parte <= 0.6) return { ...NIVEIS.media, ...base, frase: "Parte do que vai entrar ainda é esperado, não recebido." };
  return { ...NIVEIS.baixa, ...base, frase: "A maior parte do que vai entrar ainda é esperada, não recebida." };
}

/** Entradas e saídas dos próximos `dias` dias, em ordem de data. Atrasado
 * vem primeiro: é o que pesa hoje. */
export function proximosDias({ compromissos, entradas, hoje, dias = 7 }) {
  const limite = somarDias(hoje, dias);
  const itens = [
    ...(compromissos || []).map((c) => ({ ...c, tipo: "saida" })),
    ...(entradas || []).map((e) => ({ ...e, tipo: "entrada" })),
  ].filter((i) => i.data && i.data <= limite);
  // Atrasado primeiro; depois por data; verba sem dia fixo por último.
  return itens.sort((a, b) => (b.atrasado ? 1 : 0) - (a.atrasado ? 1 : 0) || (a.semDia ? 1 : 0) - (b.semDia ? 1 : 0) || a.data.localeCompare(b.data));
}

/** Uma lista só para a Home: o que sai e entra nos próximos dias, com as saídas que PESAM marcadas
 * (e o porquê). Antes eram duas listas ("O que pesa agora" e "Próximos 7 dias") repetindo os mesmos
 * itens. Um item pesado que cai depois da janela entra na lista mesmo assim, para não sumir. */
export function agendaDaHome({ proximos, pesa }) {
  const chave = (i) => `${i.descricao}|${i.valorCentavos}|${i.vencimento || i.data}`;
  const pesados = new Map((pesa || []).map((p) => [chave(p), p]));
  const lista = (proximos || []).map((i) => {
    const p = i.tipo === "saida" ? pesados.get(chave(i)) : null;
    if (p) pesados.delete(chave(i));
    return p ? { ...i, pesa: true, razoes: p.razoes || [] } : i;
  });
  for (const p of pesados.values()) lista.push({ ...p, tipo: "saida", pesa: true, razoes: p.razoes || [] });
  return lista.sort((a, b) => (b.atrasado ? 1 : 0) - (a.atrasado ? 1 : 0) || (a.semDia ? 1 : 0) - (b.semDia ? 1 : 0) || (a.data || "").localeCompare(b.data || ""));
}

/** O que falta para o painel enxergar a vida inteira. Cada item aponta o
 * dado que está faltando e a tela onde se resolve. */
export function completarRetrato({ pessoas, contas, cartoes, fontesRenda, dividas, ativos, objetivos, metas, hoje }) {
  const faltas = [];
  const ativas = (lista) => (lista || []).filter((x) => x.ativa !== false && x.status !== "inativa");
  for (const p of ativas(pessoas)) {
    if (p.papel === "filho" || p.papel === "dependente") continue;
    if (!(fontesRenda || []).some((f) => f.pessoaId === p.id && f.ativa !== false)) {
      faltas.push({ id: `renda-${p.id}`, texto: `${p.nome}: ainda sem renda cadastrada`, destino: { modulo: "dinheiro", aba: "renda" } });
    }
    if (!(contas || []).some((c) => c.pessoaId === p.id && c.status === "ativa")
      && !(cartoes || []).some((c) => c.pessoaId === p.id)) {
      faltas.push({ id: `conta-${p.id}`, texto: `${p.nome}: sem conta nem cartão`, destino: { modulo: "dinheiro", aba: "contas" } });
    }
  }
  if (!(ativos || []).length) faltas.push({ id: "bens", texto: "Nenhum bem cadastrado (carro, imóvel, investimentos)", destino: { modulo: "plano", aba: "patrimonio" } });
  if (!(objetivos || []).length) faltas.push({ id: "meta", texto: "Nenhuma meta definida", destino: { modulo: "plano", aba: "patrimonio" } });
  if (metas && (metas.custoDesejadoCentavos == null || metas.metaRecuperacaoCentavos == null)) {
    faltas.push({ id: "metas-protecao", texto: "Defina o custo de vida desejado e a meta de recuperação (a proteção do essencial usa isso)", destino: { modulo: "dinheiro", aba: "renda" } });
  }
  const semParcelas = (dividas || []).filter((d) => !(Number(d.valorParcelaCentavos) > 0) && (Number(d.saldoOriginalCentavos) || 0) > 0);
  if (semParcelas.length) faltas.push({ id: "parcelas", texto: `${semParcelas.length} dívida(s) sem valor de parcela`, destino: { modulo: "dividas" } });
  return faltas;
}

/**
 * "Você chega em DD/MM com R$ X" (item 52 da lista de 05/10): a conta aberta até a próxima entrada
 * (ou até o fim do horizonte, sem entrada à vista). `caixa` vem de calcularClarezaDeCaixa.
 * - `ate`: a data da chegada (o dia da próxima entrada; sem entrada, o fim do horizonte);
 * - `chegaComCentavos`: o saldo na véspera da entrada (hoje, se ela é amanhã);
 * - `menorCentavos`/`diaDoMenor`: se no meio do caminho desce mais que isso;
 * - `saidas`/`entradas`: o que acontece até lá, para a conta fechar na tela:
 *   na conta hoje + entradas − saídas = chegaComCentavos.
 */
export function chegadaAteAProximaEntrada(caixa) {
  const e = caixa.proximaEntrada;
  const ate = e ? e.data : caixa.horizonteAte;
  const antes = (d) => (e ? d < ate : d <= ate);
  const pontos = (caixa.pontos || []).filter((p) => antes(p.data));
  const chegaComCentavos = pontos.length ? pontos[pontos.length - 1].saldoCentavos : caixa.saldoAtualCentavos;
  let menorCentavos = caixa.saldoAtualCentavos, diaDoMenor = null;
  for (const p of pontos) if (p.saldoCentavos < menorCentavos) { menorCentavos = p.saldoCentavos; diaDoMenor = p.data; }
  const saidas = (caixa.detalhes?.compromissos || []).filter((c) => antes(c.data));
  const entradas = (caixa.detalhes?.entradas || []).filter((x) => antes(x.data));
  return {
    ate, entrada: e || null, chegaComCentavos, menorCentavos, diaDoMenor,
    saidas, entradas,
    saiCentavos: saidas.reduce((s, c) => s + c.valorCentavos, 0),
    entraCentavos: entradas.reduce((s, x) => s + x.valorCentavos, 0),
  };
}

/** O que entra nos próximos dias, separado pelo que dá pra contar (item 51): `certo` é o confirmado;
 * `esperado` é o provável (renda que costuma cair, mas ainda não caiu). Incerto nunca chega aqui. */
export function aReceber(entradas) {
  const lista = [...(entradas || [])].sort((a, b) => (a.data || "").localeCompare(b.data || ""));
  const certo = lista.filter((e) => (e.certeza || "confirmado") === "confirmado");
  const esperado = lista.filter((e) => (e.certeza || "confirmado") !== "confirmado");
  const soma = (l) => l.reduce((s, e) => s + (Number(e.valorCentavos) || 0), 0);
  return { certo, esperado, certoCentavos: soma(certo), esperadoCentavos: soma(esperado) };
}
