// Domínio puro: visão por pessoa. Casal sem renda conjunta precisa das
// duas leituras ao mesmo tempo: a de cada um (quem ganha quanto, quem
// cobre o próprio essencial, de quem são as dívidas) e a da casa (a soma
// de tudo). Nada aqui é número novo: é o mesmo cálculo de renda, custo,
// saldo e dívida das outras fases, aplicado ao recorte de cada pessoa.
//
// Invariante (testada): cada pessoa + "sem dono" soma exatamente a casa.
// Dinheiro sem responsável não some; aparece como "sem dono" pra ser
// atribuído.

import { calcularRendaAtual } from "./renda.js";
import { calcularCustos, calcularMargem } from "./orcamento.js";
import { visaoDoMes, numerosDoMes, sobraDoMes } from "./mes.js";
import { calcularSaldoConta } from "./caixa.js";
import { calcularVisaoConsolidada, calcularSaldoAtual } from "./dividas.js";
import { calcularComposicaoAtivos } from "./patrimonio.js";

export const SEM_DONO = "__sem_dono__";

/** De quem é uma transação: o responsável marcado nela; sem isso, o dono
 * da conta; sem isso, o dono do cartão. Perna de transferência não tem
 * responsável próprio, então cai sempre no dono da conta. */
export function donoDaTransacao(t, { contasPorId, cartoesPorId }) {
  if (t.pessoaId) return t.pessoaId;
  const conta = t.contaId ? contasPorId.get(t.contaId) : null;
  if (conta && conta.pessoaId) return conta.pessoaId;
  const cartao = t.cartaoId ? cartoesPorId.get(t.cartaoId) : null;
  if (cartao && cartao.pessoaId) return cartao.pessoaId;
  return SEM_DONO;
}

// `transacoes` é o que é DA pessoa (renda, gasto); `transacoesDasContas` é
// o extrato inteiro, porque saldo é da conta, não de quem gastou — uma
// despesa dela paga na conta dele sai da conta dele.
function numerosDoRecorte({ contas, transacoes, transacoesDasContas, dividas, ativos, categorias, competencia, hoje, visao }) {
  const { rendaCentavos, custos, renda } = numerosDoMes({
    rendaPagaCentavos: calcularRendaAtual(transacoes, competencia),
    custos: calcularCustos(transacoes, categorias, competencia),
    visao,
  });
  const visaoDividas = calcularVisaoConsolidada(dividas, hoje);
  const contasAtivas = contas.filter((c) => c.status === "ativa");
  const saldoOperacaoCentavos = contasAtivas.filter((c) => !c.ehReserva).reduce((s, c) => s + calcularSaldoConta(c, transacoesDasContas), 0);
  const saldoReservaCentavos = contasAtivas.filter((c) => c.ehReserva).reduce((s, c) => s + calcularSaldoConta(c, transacoesDasContas), 0);
  const { totalCentavos: ativosCentavos } = calcularComposicaoAtivos(ativos);
  const parcelasCentavos = visaoDividas.comprometimentoMensalCentavos;
  return {
    rendaCentavos,
    rendaConfirmadaCentavos: renda ? renda.confirmadaCentavos : rendaCentavos,
    rendaProvavelCentavos: renda ? renda.provavelCentavos : 0,
    rendaIncertaCentavos: renda ? renda.incertaCentavos : 0,
    despesasCentavos: custos.atualCentavos,
    essencialCentavos: custos.essencialCentavos,
    discricionarioCentavos: custos.discricionarioCentavos,
    parcelasCentavos,
    // Mesma fórmula da margem da Fase 8: renda menos essencial menos parcelas.
    coberturaCentavos: calcularMargem({ rendaAtualCentavos: rendaCentavos, custoEssencialCentavos: custos.essencialCentavos, comprometimentoMensalDividasCentavos: parcelasCentavos }),
    resultadoMesCentavos: rendaCentavos - custos.atualCentavos,
    // A mesma "sobra do mês" do Início, do Plano e da Renda (um número por pergunta).
    sobraMesCentavos: visao ? sobraDoMes(visao, parcelasCentavos) : rendaCentavos - custos.atualCentavos - parcelasCentavos,
    saldoOperacaoCentavos,
    saldoReservaCentavos,
    dividasSaldoCentavos: visaoDividas.saldoProblemasCentavos,
    dividasAtivas: visaoDividas.quantidadeProblemas,
    financiamentosSaldoCentavos: visaoDividas.saldoFinanciamentosCentavos,
    financiamentosQuantidade: visaoDividas.quantidadeFinanciamentos,
    financiamentosParcelaCentavos: visaoDividas.parcelasFinanciamentosCentavos,
    dividasAtrasadas: visaoDividas.quantidadeSoAtrasadas,
    dividasNegativadas: visaoDividas.quantidadeNegativadas,
    saldoNegativadoCentavos: visaoDividas.saldoNegativadoCentavos,
    ativosCentavos,
    patrimonioLiquidoCentavos: ativosCentavos - visaoDividas.saldoTotalAtualCentavos,
  };
}

/**
 * Transferências entre contas de pessoas diferentes: "quem passou dinheiro
 * pra quem" no mês. Não é receita nem despesa de ninguém (CLAUDE.md), mas
 * é exatamente o que mostra como um casal sem renda conjunta se sustenta.
 */
export function calcularRepasses(transacoes, competencia, contexto) {
  const pernas = new Map();
  for (const t of transacoes || []) {
    if (t.tipo !== "transferencia" || !t.transferenciaId || t.competencia !== competencia) continue;
    if (t.status === "cancelado") continue;
    if (!pernas.has(t.transferenciaId)) pernas.set(t.transferenciaId, {});
    pernas.get(t.transferenciaId)[t.direcao] = t;
  }
  const porPar = new Map();
  for (const { saida, entrada } of pernas.values()) {
    if (!saida || !entrada) continue;
    const de = donoDaTransacao(saida, contexto);
    const para = donoDaTransacao(entrada, contexto);
    if (de === para) continue;
    const chave = `${de}>${para}`;
    const atual = porPar.get(chave) || { dePessoaId: de, paraPessoaId: para, totalCentavos: 0, quantidade: 0 };
    atual.totalCentavos += Number(saida.valorCentavos) || 0;
    atual.quantidade += 1;
    porPar.set(chave, atual);
  }
  return Array.from(porPar.values()).sort((a, b) => b.totalCentavos - a.totalCentavos);
}

/**
 * Quem não cobre o próprio essencial + parcelas com a própria renda, e
 * quanto da folga dos outros cobre essa falta. É a leitura central de um
 * casal sem renda conjunta: a casa pode fechar no azul enquanto um dos
 * dois está sendo sustentado pelo outro sem que isso esteja à vista.
 */
export function calcularDesequilibrio(porPessoa) {
  const comFalta = porPessoa.filter((p) => p.numeros.coberturaCentavos < 0)
    .map((p) => ({ pessoaId: p.pessoaId, faltaCentavos: -p.numeros.coberturaCentavos }));
  const folgaCentavos = porPessoa.filter((p) => p.numeros.coberturaCentavos > 0).reduce((s, p) => s + p.numeros.coberturaCentavos, 0);
  const faltaTotalCentavos = comFalta.reduce((s, p) => s + p.faltaCentavos, 0);
  const cobertoCentavos = Math.min(folgaCentavos, faltaTotalCentavos);
  return {
    comFalta,
    folgaCentavos,
    faltaTotalCentavos,
    cobertoCentavos,
    descobertoCentavos: faltaTotalCentavos - cobertoCentavos,
  };
}

/**
 * A visão inteira: um bloco por pessoa cadastrada (na ordem do cadastro),
 * um "sem dono" só quando existe algo sem responsável, e a casa. A
 * participação de cada um na renda e no custo da casa sai daqui também.
 */
export function calcularVisaoPorPessoa({ pessoas, contas, cartoes, faturas, categorias, transacoes, dividas, ativos, competencia, hoje, fontesRenda, recorrencias }) {
  const projetar = (pessoaId) => (fontesRenda || recorrencias
    ? visaoDoMes({ transacoes, categorias, fontesRenda, recorrencias, dividas, cartoes, faturas, competencia, hoje, pessoaId })
    : null);
  const contexto = {
    contasPorId: new Map((contas || []).map((c) => [c.id, c])),
    cartoesPorId: new Map((cartoes || []).map((c) => [c.id, c])),
  };
  // Responsável que não existe mais no cadastro (pessoa apagada) conta como
  // "sem dono" — senão o registro sumiria das duas pontas e a soma das
  // pessoas deixaria de fechar com a casa.
  const idsPessoas = new Set((pessoas || []).map((p) => p.id));
  const dono = (id) => (id && idsPessoas.has(id) ? id : SEM_DONO);
  const todas = transacoes || [];
  const recorte = (pessoaId) => ({
    contas: (contas || []).filter((c) => dono(c.pessoaId) === pessoaId),
    transacoes: todas.filter((t) => dono(donoDaTransacao(t, contexto)) === pessoaId),
    dividas: (dividas || []).filter((d) => dono(d.pessoaId) === pessoaId),
    ativos: (ativos || []).filter((a) => dono(a.pessoaId) === pessoaId),
  });

  const montar = (pessoaId, nome) => {
    const r = recorte(pessoaId);
    const numeros = numerosDoRecorte({
      contas: r.contas, transacoes: r.transacoes, transacoesDasContas: todas,
      dividas: r.dividas, ativos: r.ativos, categorias, competencia, hoje, visao: projetar(pessoaId),
    });
    return {
      pessoaId, nome,
      numeros,
      quantidadeLancamentos: r.transacoes.length,
      dividas: r.dividas.map((d) => ({ id: d.id, nome: d.nome, credor: d.credor, negativada: !!d.negativada, saldoCentavos: calcularSaldoAtual(d) })),
    };
  };

  const porPessoa = (pessoas || []).map((p) => montar(p.id, p.nome));
  const semDono = montar(SEM_DONO, "Sem responsável");
  const temSemDono = semDono.quantidadeLancamentos > 0 || semDono.dividas.length > 0
    || Object.values(semDono.numeros).some((v) => v !== 0);

  const casa = numerosDoRecorte({
    contas: contas || [], transacoes: todas, transacoesDasContas: todas, dividas: dividas || [], ativos: ativos || [], categorias, competencia, hoje, visao: projetar(undefined),
  });

  const pct = (parte, total) => (total > 0 ? Math.round((parte / total) * 100) : null);
  for (const p of porPessoa) {
    p.participacaoRendaPct = pct(p.numeros.rendaCentavos, casa.rendaCentavos);
    p.participacaoCustoPct = pct(p.numeros.despesasCentavos, casa.despesasCentavos);
  }

  return {
    competencia,
    pessoas: porPessoa,
    semDono: temSemDono ? semDono : null,
    casa,
    repasses: calcularRepasses(todas, competencia, contexto)
      .map((r) => ({ ...r, dePessoaId: dono(r.dePessoaId), paraPessoaId: dono(r.paraPessoaId) }))
      .filter((r) => r.dePessoaId !== r.paraPessoaId),
    desequilibrio: calcularDesequilibrio(porPessoa),
  };
}
