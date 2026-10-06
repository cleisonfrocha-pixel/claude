// Domínio puro: cenários (§22, Fase 14). "Comparar caminhos sem alterar
// os dados reais, mostrando impacto em caixa, dívida, reserva e
// patrimônio" (texto do blueprint). A simulação roda mês a mês sobre uma
// base tirada dos dados de verdade e devolve, pra cada caminho, quando a
// dívida zera, quando o nome limpa, quando a reserva fecha, e se em algum
// mês o dinheiro não fecha. Nada aqui grava coisa nenhuma (CLAUDE.md:
// simulação não escreve no dado real).
//
// Modelo, deliberadamente simples e dito em voz alta (vira "premissas" na
// tela):
// - Dívida COM acordo (parcela > 0): o saldo é o valor de quitar hoje
//   (valor presente das parcelas, domain/dividas.js) e rende a taxa do
//   contrato — informada ou a implícita no principal/parcela/prazo. A
//   parcela abate; pagando só ela, quita exatamente na última parcela.
//   Pagamento extra abate o saldo e corta os juros dali pra frente.
// - Dívida SEM acordo (parcela zero, típico de negativada parada) não
//   diminui sozinha e, se tem juros informado, cresce todo mês.
// - Sobra do mês vai, conforme a estratégia, pra dívida (negativadas
//   primeiro, das menores pras maiores, porque é o que limpa o nome mais
//   rápido; depois a de juros mais alto) e/ou pra reserva.
// - Viver não é negociável (pedido explícito do usuário, 28/09/2026): o
//   essencial (inclui categoria "filho") e o investimento mínimo mensal
//   que ele definir são pagos sempre, puxando da reserva se precisar — só
//   aí é que o caminho "aperta" de verdade (primeiroMesNegativo).
// - Quando falta dinheiro pra pagar TODAS as parcelas do mês, o motor não
//   inventa mais reserva nem marca o caminho inteiro como inviável: ele
//   paga o que dá, na ordem de prioridade de cada dívida (a que o usuário
//   define, ou — sem ela — a mais cara de deixar parada primeiro), e as
//   outras ficam paradas naquele mês (`ordemDePagamento`). É a mesma coisa
//   que aconteceria na vida real: algumas contas ficam pra depois.

import { calcularRendaAtual } from "./renda.js";
import { calcularCustos } from "./orcamento.js";
import { visaoDoMes } from "./mes.js";
import { calcularSaldoAtual, statusDivida, taxaMensalEfetiva, sujaONome } from "./dividas.js";
import { calcularComposicaoAtivos } from "./patrimonio.js";
import { somarMeses, competenciaDeData } from "./tempo.js";
import { leituraDaFonte } from "./pisoDaRenda.js";
import { formatarBRL } from "./dinheiro.js";

export const HORIZONTE_MESES = 24;
const MESES_HISTORICO = 3;
// "Perto o bastante do melhor": um caminho que chega ao objetivo até
// esta quantidade de meses depois do mais rápido, com menos esforço,
// ganha a recomendação. Esforço também custa, e o usuário precisa
// conseguir sustentar o caminho.
const TOLERANCIA_MESES = 3;

function arredondarPara(centavos, passoCentavos) {
  return Math.round(centavos / passoCentavos) * passoCentavos;
}

/** Os últimos `meses` meses FECHADOS que tiveram movimento, do mais
 * recente pro mais antigo — nunca o mês corrente. Mês zerado não entra na
 * média, senão um histórico curto (cadastro recém-começado) derrubaria a
 * média pela metade. O mês corrente fica de fora por definição: ele está
 * em andamento, então tem sempre menos lançamento que um mês fechado, e
 * entrar na média com o mesmo peso faria renda e gasto parecerem menores
 * do que são (pior ainda perto do início do mês, quando quase nada foi
 * lançado ainda). */
function mesesComMovimento(transacoes, competencia, meses) {
  const lista = [];
  for (let i = 1; i <= meses; i++) {
    const c = somarMeses(competencia, -i);
    const renda = calcularRendaAtual(transacoes, c);
    const custos = calcularCustos(transacoes, [], c);
    // Mês sem nenhuma renda lançada não é mês fechado: é mês que ficou
    // pela metade (só gasto, ex.: fatura lançada em resumo). Usá-lo como
    // "histórico" faz a simulação achar que a casa não ganha nada.
    if (renda > 0) lista.push(c);
  }
  return lista;
}

function media(valores) {
  return valores.length ? Math.round(valores.reduce((s, v) => s + v, 0) / valores.length) : 0;
}

/** A base de partida, tirada dos dados reais. `clareza` é o painel de
 * clareza de caixa (§4): de lá vêm o saldo em conta e a reserva.
 *
 * Usa `saldoAtualCentavos`, não `livreCentavos`: `livreCentavos` já desconta
 * os compromissos dos próximos 30 dias (§4), e o mês 1 da simulação, logo
 * abaixo, já refaz esse desconto por conta própria (renda menos o custo
 * médio menos as parcelas do mês). Partir de `livreCentavos` descontaria o
 * mesmo compromisso duas vezes no primeiro mês. */
export function montarBaseCenarios({ transacoes, categorias, dividas, fontesRenda, recorrencias, cartoes, faturas, ativos, clareza, competencia, hoje, investimentoMinimoMensalCentavos = 0 }) {
  let meses = mesesComMovimento(transacoes, competencia, MESES_HISTORICO);
  let rendas = meses.map((c) => calcularRendaAtual(transacoes, c));
  let custos = meses.map((c) => calcularCustos(transacoes, categorias, c));
  // Sem nenhum mês fechado com movimento (cadastro recém-começado), o mês
  // corrente projetado — o que está pago mais o que ainda vai entrar e
  // sair — serve de base. Não inventa nada: só lê o que foi cadastrado.
  const semHistorico = !meses.length;
  if (semHistorico) {
    const v = visaoDoMes({ transacoes, categorias, fontesRenda, recorrencias, dividas, cartoes, faturas, competencia, hoje });
    meses = [competencia];
    rendas = [v.rendaContavelCentavos];
    custos = [{ essencialCentavos: v.essencialCentavos, atualCentavos: v.gastoCentavos, discricionarioCentavos: v.gastoCentavos - v.essencialCentavos, faturaSemDetalheCentavos: 0 }];
  }

  const rendaMediaCentavos = media(rendas);
  const custoEssencialCentavos = media(custos.map((c) => c.essencialCentavos));
  const custoAtualCentavos = media(custos.map((c) => c.atualCentavos));
  // Não essencial = o que dá pra cortar. Parcela de dívida NÃO entra aqui
  // (a simulação paga as parcelas pelo cronograma de cada dívida — contar
  // de novo seria a mesma parcela duas vezes). Fatura paga sem compra
  // lançada é gasto de categoria desconhecida: conta, mas não é cortável.
  const discricionarioCentavos = media(custos.map((c) => c.discricionarioCentavos));
  const semCategoriaCentavos = media(custos.map((c) => c.faturaSemDetalheCentavos || 0));

  // Renda garantida (caminho conservador): fonte fixa/recorrente pelo
  // valor esperado; fonte variável pelo PIOR mês fechado dela; receita sem
  // fonte, pelo pior mês. Sem fonte nenhuma, o pior mês da casa. Nunca
  // inventa renda que os dados não mostraram.
  const ativas = (fontesRenda || []).filter((f) => f.ativa !== false);
  const porFonteNoMes = (fonteId, c) => (transacoes || [])
    .filter((t) => t.tipo === "receita" && t.status === "pago" && t.competencia === c && (fonteId ? t.fonteRendaId === fonteId : !t.fonteRendaId))
    .reduce((s, t) => s + (Number(t.valorCentavos) || 0), 0);
  const piorMes = (valores) => (valores.length ? Math.min(...valores) : 0);
  let rendaGarantidaCentavos;
  if (ativas.length) {
    rendaGarantidaCentavos = 0;
    for (const f of ativas) {
      if (f.tipo === "fixa" || f.tipo === "recorrente") {
        // Com 3 ou mais meses reais, garantido é o menor mês que ela pagou (nunca mais que o combinado);
        // fonte irregular ou que caiu tem piso baixo, e o plano não finge que ela vem.
        const esperado = Number(f.valorEsperadoCentavos) || 0;
        const leitura = leituraDaFonte((transacoes || []).filter((t) => t.tipo === "receita" && t.fonteRendaId === f.id), competenciaDeData(hoje));
        rendaGarantidaCentavos += leitura && leitura.meses >= 3 ? Math.min(esperado, leitura.pisoCentavos) : esperado;
      }
      else if (f.tipo === "variavel") rendaGarantidaCentavos += piorMes(meses.map((c) => porFonteNoMes(f.id, c)));
    }
    rendaGarantidaCentavos += piorMes(meses.map((c) => porFonteNoMes(null, c)));
    if (rendaMediaCentavos > 0) rendaGarantidaCentavos = Math.min(rendaGarantidaCentavos, rendaMediaCentavos);
  } else {
    rendaGarantidaCentavos = piorMes(rendas.filter((r) => r > 0));
  }

  const dividasAtivas = (dividas || [])
    .filter((d) => statusDivida(d, hoje) !== "quitada")
    .map((d) => {
      const parcela = Number(d.valorParcelaCentavos) > 0 ? Number(d.valorParcelaCentavos) : 0;
      const informada = d.taxaJurosMensalPct != null && Number.isFinite(Number(d.taxaJurosMensalPct));
      return {
        id: d.id, nome: d.nome, credor: d.credor || "",
        saldoCentavos: calcularSaldoAtual(d),
        parcelaCentavos: parcela,
        // Com acordo, a taxa do contrato (informada ou implícita): o saldo
        // é o valor presente das parcelas, então ele rende juros e a
        // parcela abate — pagar a mais economiza juros de verdade.
        taxaMensalPct: parcela > 0 ? Math.round(taxaMensalEfetiva(d) * 1e6) / 1e4 : (informada ? Number(d.taxaJurosMensalPct) : null),
        taxaInformada: informada,
        negativada: sujaONome(d),
        prioridadePagamento: Number.isInteger(d.prioridadePagamento) ? d.prioridadePagamento : null,
      };
    })
    .filter((d) => d.saldoCentavos > 0);

  return {
    competencia,
    mesesHistorico: semHistorico ? 0 : meses.length,
    semHistorico,
    rendaMediaCentavos,
    rendaGarantidaCentavos,
    fonteRendaGarantida: ativas.length ? "fontes" : "pior_mes",
    custoEssencialCentavos,
    custoAtualCentavos,
    discricionarioCentavos,
    semCategoriaCentavos,
    // Continuar investindo mesmo com dívida em aberto — decisão do
    // usuário (CLAUDE.md-like: só ele define, o motor nunca inventa esse
    // número). Protegido igual ao essencial: paga antes de qualquer dívida.
    investimentoMinimoMensalCentavos: Math.max(0, Number(investimentoMinimoMensalCentavos) || 0),
    // Aperto de datas que a conta mensal não enxerga (o mês fecha, mas um
    // dia específico fica negativo) — vem da clareza de caixa (§4).
    apertoCaixa: clareza && clareza.seguroParaGastarCentavos < 0 && clareza.diaMaisApertado
      ? { data: clareza.diaMaisApertado, faltaCentavos: -clareza.seguroParaGastarCentavos } : null,
    dividas: dividasAtivas,
    reservaCentavos: Math.max(0, clareza?.saldoReservaCentavos || 0),
    caixaCentavos: clareza?.saldoAtualCentavos || 0,
    ativosCentavos: calcularComposicaoAtivos(ativos || []).totalCentavos,
    suficiente: meses.length > 0 && (rendaMediaCentavos > 0 || custoAtualCentavos > 0),
  };
}

/** Os seis caminhos. `opcoes` ajusta o corte, a renda extra e a meta de
 * reserva — o usuário mexe nisso na tela e tudo recalcula na hora. */
export function cenariosPadrao(base, { cortePct = 30, aumentoRendaCentavos = null, metaReservaMeses = 3 } = {}) {
  const aumento = aumentoRendaCentavos != null
    ? aumentoRendaCentavos
    : Math.max(50000, arredondarPara(base.rendaMediaCentavos * 0.2, 5000));
  const corte = Math.max(0, Math.min(100, cortePct));
  return [
    {
      id: "atual", nome: "Seguir como está", esforco: 0,
      descricao: "Mesma renda e mesmo gasto. Só as parcelas combinadas são pagas; o que sobra fica parado na conta.",
      renda: "media", cortePct: 0, aumentoCentavos: 0, estrategia: "parado",
    },
    {
      id: "quitacao", nome: "Quitação acelerada", esforco: 1,
      descricao: "Mesma renda e mesmo gasto, mas toda sobra vai pra dívida: negativadas primeiro, depois a de juros mais alto. Sem dívida, a sobra vira reserva.",
      renda: "media", cortePct: 0, aumentoCentavos: 0, estrategia: "dividas",
    },
    {
      id: "corte", nome: `Cortar ${corte}% do não essencial`, esforco: 2,
      descricao: `Gasto não essencial ${corte}% menor, e a diferença vai pra dívida na mesma ordem da quitação acelerada.`,
      renda: "media", cortePct: corte, aumentoCentavos: 0, estrategia: "dividas",
    },
    {
      id: "renda", nome: `Mais ${formatarBRL(aumento)} de renda por mês`, esforco: 2,
      descricao: "Uma renda extra fixa por mês (freela, projeto, venda), toda ela direto pra dívida.",
      renda: "media", cortePct: 0, aumentoCentavos: aumento, estrategia: "dividas",
    },
    {
      id: "conservador", nome: "Conservador", esforco: 1,
      descricao: `Conta só com a renda garantida e monta ${metaReservaMeses} meses de reserva antes de acelerar dívida.`,
      renda: "garantida", cortePct: 0, aumentoCentavos: 0, estrategia: "reserva_primeiro",
    },
    {
      id: "recuperacao", nome: "Recuperação completa", esforco: 3,
      descricao: `Corte de ${corte}% no não essencial e renda extra de ${formatarBRL(aumento)}: um mês de colchão, depois dívida, depois reserva cheia.`,
      renda: "media", cortePct: corte, aumentoCentavos: aumento, estrategia: "colchao_dividas_reserva",
    },
  ];
}

/** Ordem de ataque: negativadas primeiro (menor saldo primeiro — cada uma
 * quitada é um nome a menos sujo), depois as demais por juros mais alto,
 * empate pelo menor saldo. */
export function ordemDeQuitacao(dividas) {
  return [...dividas].sort((a, b) => {
    if (a.negativada !== b.negativada) return a.negativada ? -1 : 1;
    if (a.negativada) return a.saldoCentavos - b.saldoCentavos;
    const ja = a.taxaMensalPct || 0, jb = b.taxaMensalPct || 0;
    if (ja !== jb) return jb - ja;
    return a.saldoCentavos - b.saldoCentavos;
  });
}

function totalDividas(dividas) {
  return dividas.reduce((s, d) => s + d.saldoCentavos, 0);
}

/** Ordem de PAGAR a parcela mínima quando não dá pra pagar todas no mês
 * (não é a ordem de mandar sobra extra — essa é `ordemDeQuitacao`, pra
 * quitar mais rápido). Quem o usuário marcou com prioridade paga na ordem
 * que ele definiu (1 primeiro). Sem prioridade nenhuma definida, protege
 * primeiro a de juro mais alto — é a mais cara de ficar parada — e, empatado,
 * a de menor saldo (evita reabrir atraso numa dívida quase quitada).
 * Prioridade definida sempre vem antes de não definida: o usuário decidiu
 * por alguma, e essa decisão pesa mais que qualquer heurística. */
export function ordemDePagamento(dividas) {
  return [...dividas].sort((a, b) => {
    const pa = a.prioridadePagamento, pb = b.prioridadePagamento;
    if (pa != null || pb != null) {
      if (pa == null) return 1;
      if (pb == null) return -1;
      if (pa !== pb) return pa - pb;
    }
    const ja = a.taxaMensalPct || 0, jb = b.taxaMensalPct || 0;
    if (ja !== jb) return jb - ja;
    return a.saldoCentavos - b.saldoCentavos;
  });
}

/** Um caminho, mês a mês. Devolve a série e os marcos. */
export function simularCenario(base, cenario, { meses = HORIZONTE_MESES, metaReservaMeses = 3, investimentoMinimoMensalCentavos } = {}) {
  const investimentoMinimo = investimentoMinimoMensalCentavos != null ? investimentoMinimoMensalCentavos : (base.investimentoMinimoMensalCentavos || 0);
  const rendaBase = cenario.renda === "garantida" ? base.rendaGarantidaCentavos : base.rendaMediaCentavos;
  const rendaCentavos = rendaBase + (cenario.aumentoCentavos || 0);
  const custoCentavos = base.custoEssencialCentavos + (base.semCategoriaCentavos || 0) + Math.round(base.discricionarioCentavos * (1 - (cenario.cortePct || 0) / 100));
  const metaReservaCentavos = base.custoEssencialCentavos * metaReservaMeses;
  const colchaoCentavos = base.custoEssencialCentavos;

  const dividas = base.dividas.map((d) => ({ ...d }));
  let caixa = base.caixaCentavos;
  let reserva = base.reservaCentavos;
  let jurosAcumuladosCentavos = 0;
  let pagoExtraCentavos = 0;
  const parcelasPuladas = []; // { mes, competencia, dividas: [{id, nome}] } — parcela que não coube no mês

  const temNegativadas = dividas.some((d) => d.negativada);
  const marcos = {
    mesDividaZerada: totalDividas(dividas) === 0 ? 0 : null,
    mesNomeLimpo: temNegativadas ? null : 0,
    mesReservaMeta: metaReservaCentavos > 0 && reserva >= metaReservaCentavos ? 0 : null,
    primeiroMesNegativo: null,
  };

  const pagarDividas = (valor) => {
    let restante = valor;
    for (const d of ordemDeQuitacao(dividas.filter((x) => x.saldoCentavos > 0))) {
      if (restante <= 0) break;
      const p = Math.min(restante, d.saldoCentavos);
      d.saldoCentavos -= p;
      restante -= p;
    }
    pagoExtraCentavos += valor - restante;
    return valor - restante;
  };
  const guardarNaReserva = (valor, teto) => {
    const x = Math.max(0, Math.min(valor, teto - reserva));
    reserva += x;
    return x;
  };

  const serie = [];
  for (let m = 1; m <= meses; m++) {
    // Juros: dívida com acordo rende na taxa do contrato e a parcela abate;
    // sem acordo cresce se tem juros informado (ver cabeçalho).
    for (const d of dividas) {
      if (d.saldoCentavos > 0 && d.taxaMensalPct > 0) {
        const j = Math.round(d.saldoCentavos * d.taxaMensalPct / 100);
        d.saldoCentavos += j;
        jurosAcumuladosCentavos += j;
      }
    }
    // Sobrevivência (essencial, inclui a categoria "filho") e o
    // investimento mínimo são protegidos: saem primeiro, puxando da
    // reserva se precisar. Só uma falta AQUI é o caminho "apertando" de
    // verdade (primeiroMesNegativo) — não pagar uma dívida não é.
    caixa += rendaCentavos - custoCentavos - investimentoMinimo;
    if (caixa < 0) {
      const tira = Math.min(reserva, -caixa);
      reserva -= tira;
      caixa += tira;
      if (caixa < 0 && marcos.primeiroMesNegativo == null) marcos.primeiroMesNegativo = m;
    }

    // Parcelas do mês: paga na ordem de prioridade (`ordemDePagamento`) até
    // o dinheiro que sobrou acabar. O que não coube fica parado neste mês
    // — juro continua contando (bloco acima), mas a reserva não é drenada
    // pra forçar pagar tudo, e o caminho não vira "inviável" só por isso.
    let parcelas = 0;
    let disponivelDividas = Math.max(0, caixa);
    const puladasEsteMes = [];
    for (const d of ordemDePagamento(dividas.filter((x) => x.saldoCentavos > 0 && x.parcelaCentavos > 0))) {
      const p = Math.min(d.parcelaCentavos, d.saldoCentavos);
      if (p <= disponivelDividas) {
        d.saldoCentavos -= p;
        disponivelDividas -= p;
        parcelas += p;
      } else {
        puladasEsteMes.push({ id: d.id, nome: d.nome });
      }
    }
    caixa -= parcelas;
    if (puladasEsteMes.length) parcelasPuladas.push({ mes: m, competencia: somarMeses(base.competencia, m), dividas: puladasEsteMes });

    if (caixa > 0) {
      if (cenario.estrategia === "dividas") {
        caixa -= pagarDividas(caixa);
        caixa -= guardarNaReserva(caixa, metaReservaCentavos);
      } else if (cenario.estrategia === "reserva_primeiro") {
        caixa -= guardarNaReserva(caixa, metaReservaCentavos);
        caixa -= pagarDividas(caixa);
      } else if (cenario.estrategia === "colchao_dividas_reserva") {
        caixa -= guardarNaReserva(caixa, colchaoCentavos);
        caixa -= pagarDividas(caixa);
        caixa -= guardarNaReserva(caixa, metaReservaCentavos);
      }
    }

    const divida = totalDividas(dividas);
    if (marcos.mesDividaZerada == null && divida === 0) marcos.mesDividaZerada = m;
    if (marcos.mesNomeLimpo == null && !dividas.some((d) => d.negativada && d.saldoCentavos > 0)) marcos.mesNomeLimpo = m;
    if (marcos.mesReservaMeta == null && metaReservaCentavos > 0 && reserva >= metaReservaCentavos) marcos.mesReservaMeta = m;

    serie.push({
      mes: m,
      competencia: somarMeses(base.competencia, m),
      dividaCentavos: divida,
      reservaCentavos: reserva,
      caixaCentavos: caixa,
      patrimonioCentavos: base.ativosCentavos + reserva + caixa - divida,
    });
  }

  const final = serie[serie.length - 1] || { dividaCentavos: totalDividas(dividas), reservaCentavos: reserva, caixaCentavos: caixa, patrimonioCentavos: base.ativosCentavos + reserva + caixa - totalDividas(dividas) };
  const doze = serie[Math.min(11, serie.length - 1)] || final;

  // Resumo por dívida: quantos meses ela ficou sem pagamento neste
  // caminho — a pergunta que o usuário faz de verdade ("quais ficam pra
  // trás, e por quanto tempo").
  const porDivida = new Map();
  for (const evento of parcelasPuladas) {
    for (const d of evento.dividas) {
      if (!porDivida.has(d.id)) porDivida.set(d.id, { id: d.id, nome: d.nome, quantidadeMeses: 0, primeiroMes: evento.mes });
      porDivida.get(d.id).quantidadeMeses += 1;
    }
  }
  const dividasComAtraso = [...porDivida.values()].sort((a, b) => b.quantidadeMeses - a.quantidadeMeses);

  return {
    rendaCentavos,
    custoCentavos,
    sobraMensalInicialCentavos: rendaCentavos - custoCentavos - investimentoMinimo - base.dividas.reduce((s, d) => s + d.parcelaCentavos, 0),
    metaReservaCentavos,
    ...marcos,
    viavel: marcos.primeiroMesNegativo == null,
    jurosAcumuladosCentavos,
    pagoExtraCentavos,
    parcelasPuladas,
    dividasComAtraso,
    final,
    em12Meses: doze,
    serie,
  };
}

const TXT_MES = (n) => (n === 0 ? "já" : `${n} ${n === 1 ? "mês" : "meses"}`);

/** Qual objetivo manda na recomendação, na ordem que um plano de virada
 * de chave seguiria: primeiro não quebrar, depois limpar o nome, depois
 * ter um colchão mínimo, depois sair da dívida, depois crescer. */
function objetivoPrincipal(base) {
  if (base.dividas.some((d) => d.negativada)) return { campo: "mesNomeLimpo", rotulo: "limpar o nome" };
  if (base.custoEssencialCentavos > 0 && base.reservaCentavos < base.custoEssencialCentavos) return { campo: "mesReservaMeta", rotulo: "montar a reserva" };
  if (base.dividas.length) return { campo: "mesDividaZerada", rotulo: "zerar as dívidas" };
  return { campo: "patrimonio", rotulo: "fazer o patrimônio crescer" };
}

/**
 * Compara os caminhos e aponta o sugerido, sempre com o motivo escrito.
 * Regra: entre os que não apertam, o objetivo principal (acima) decide;
 * quem chega até TOLERANCIA_MESES depois do mais rápido com menos esforço
 * leva, porque o melhor plano é o que dá pra sustentar.
 */
export function compararCenarios(base, opcoes = {}) {
  const meses = opcoes.meses || HORIZONTE_MESES;
  const metaReservaMeses = opcoes.metaReservaMeses || 3;
  const investimentoMinimoMensalCentavos = opcoes.investimentoMinimoMensalCentavos;
  const cenarios = cenariosPadrao(base, { ...opcoes, metaReservaMeses })
    .map((c) => ({ ...c, resultado: simularCenario(base, c, { meses, metaReservaMeses, investimentoMinimoMensalCentavos }) }));

  const nulo = (v) => (v == null ? Infinity : v);
  const melhorPor = (lista, fn) => lista.reduce((a, b) => (fn(b) < fn(a) ? b : a), lista[0]);
  const viaveis = cenarios.filter((c) => c.resultado.viavel);

  const destaques = {
    maisRapidoSemDivida: base.dividas.length ? melhorPor(viaveis.length ? viaveis : cenarios, (c) => nulo(c.resultado.mesDividaZerada) * 10 + c.esforco).id : null,
    maisRapidoNomeLimpo: base.dividas.some((d) => d.negativada) ? melhorPor(viaveis.length ? viaveis : cenarios, (c) => nulo(c.resultado.mesNomeLimpo) * 10 + c.esforco).id : null,
    maiorPatrimonio: melhorPor(viaveis.length ? viaveis : cenarios, (c) => -c.resultado.final.patrimonioCentavos).id,
  };

  const objetivo = objetivoPrincipal(base);
  let recomendado;
  if (!viaveis.length) {
    const aguentaMais = melhorPor(cenarios, (c) => -nulo(c.resultado.primeiroMesNegativo));
    recomendado = {
      id: aguentaMais.id,
      motivo: `Nenhum caminho fecha todos os meses com a renda e o gasto de hoje. "${aguentaMais.nome}" é o que segura mais tempo (aperta no mês ${aguentaMais.resultado.primeiroMesNegativo}). O primeiro passo é aumentar renda ou cortar gasto além do simulado.`,
    };
  } else {
    const valor = (c) => (objetivo.campo === "patrimonio" ? -c.resultado.final.patrimonioCentavos : nulo(c.resultado[objetivo.campo]));
    const melhorValor = Math.min(...viaveis.map(valor));
    let escolhido;
    if (objetivo.campo !== "patrimonio" && melhorValor === Infinity) {
      escolhido = melhorPor(viaveis, (c) => -c.resultado.final.patrimonioCentavos);
      recomendado = {
        id: escolhido.id,
        motivo: `Nenhum caminho consegue ${objetivo.rotulo} em ${meses} meses com os números de hoje. "${escolhido.nome}" é o que deixa vocês em melhor posição no fim do período.`,
      };
    } else {
      const aceitaveis = viaveis.filter((c) => objetivo.campo === "patrimonio" ? valor(c) === melhorValor : valor(c) <= melhorValor + TOLERANCIA_MESES);
      escolhido = melhorPor(aceitaveis, (c) => c.esforco * 1000 + valor(c));
      const maisRapido = melhorPor(viaveis, (c) => valor(c) * 10 + c.esforco);
      const quando = objetivo.campo === "patrimonio" ? "" : ` em ${TXT_MES(escolhido.resultado[objetivo.campo])}`;
      const comparacao = maisRapido.id !== escolhido.id && objetivo.campo !== "patrimonio"
        ? ` "${maisRapido.nome}" chega em ${TXT_MES(maisRapido.resultado[objetivo.campo])}, mas pede mais esforço pra pouca diferença.`
        : "";
      recomendado = {
        id: escolhido.id,
        motivo: `O objetivo mais importante agora é ${objetivo.rotulo}. "${escolhido.nome}" chega lá${quando} sem apertar nenhum mês.${comparacao}`,
      };
    }
  }

  return { base, meses, metaReservaMeses, objetivo, cenarios, destaques, recomendado, premissas: premissas(base, meses, investimentoMinimoMensalCentavos) };
}

/** O que a simulação assume, em texto — mostrado sempre junto dos números
 * (§9/§17: todo resultado aponta de onde veio). */
export function premissas(base, meses = HORIZONTE_MESES, investimentoMinimoMensalCentavos) {
  const investimentoMinimo = investimentoMinimoMensalCentavos != null ? investimentoMinimoMensalCentavos : (base.investimentoMinimoMensalCentavos || 0);
  const lista = [
    `Renda: média dos últimos ${base.mesesHistorico} ${base.mesesHistorico === 1 ? "mês" : "meses"} com movimento, ${formatarBRL(base.rendaMediaCentavos)} por mês. Só entra dinheiro que de fato entrou.`,
    `Gasto: média do mesmo período, ${formatarBRL(base.custoEssencialCentavos)} essencial (inclui filho, se cadastrado) e ${formatarBRL(base.discricionarioCentavos)} não essencial por mês${base.semCategoriaCentavos ? `, mais ${formatarBRL(base.semCategoriaCentavos)} de fatura sem compra lançada (não entra no corte)` : ""}. Essencial nunca é cortado, nem pelo caminho mais agressivo — só o não essencial.`,
    base.fonteRendaGarantida === "fontes"
      ? `Renda garantida (caminho conservador): ${formatarBRL(base.rendaGarantidaCentavos)}: fontes fixas pelo valor esperado e renda variável pelo pior mês recente.`
      : `Renda garantida (caminho conservador): ${formatarBRL(base.rendaGarantidaCentavos)}, o pior mês observado, porque não há fonte de renda cadastrada.`,
    "Dívida com acordo: o saldo é o valor pra quitar hoje e rende os juros do contrato (o informado ou, sem ele, o que a parcela embute). Pagar a mais abate o saldo e corta os juros dali pra frente.",
    "Dívida sem acordo não diminui sozinha e, se tem juros informado, cresce todo mês. A simulação não supõe desconto em acordo: se vier desconto, o nome limpa mais cedo.",
    investimentoMinimo > 0
      ? `Investimento: ${formatarBRL(investimentoMinimo)} por mês continuam saindo mesmo com dívida em aberto — protegido como o essencial, nunca vira dinheiro pra pagar dívida.`
      : "Sem investimento mínimo definido: toda a sobra do mês pode ir pra dívida ou reserva, conforme o caminho. Defina um valor em Renda › Metas se quiser continuar investindo mesmo com dívida em aberto.",
    "Quando falta dinheiro pra pagar todas as parcelas do mês, o essencial e o investimento mínimo continuam saindo (puxando da reserva se precisar) e a simulação paga as dívidas possíveis na ordem de prioridade — o resto fica parado naquele mês, rendendo juro, sem drenar a reserva pra forçar pagar tudo.",
    `Ponto de partida: ${formatarBRL(base.caixaCentavos)} em conta hoje e ${formatarBRL(base.reservaCentavos)} em reserva. Horizonte de ${meses} meses.`,
    "Nada disso altera seus dados reais.",
  ];
  if (base.dividas.some((d) => d.parcelaCentavos === 0 && d.taxaMensalPct == null)) {
    lista.splice(5, 0, "Alguma dívida sem acordo está sem juros informado: na simulação ela fica parada, mas na vida real costuma crescer. Informe a taxa em Dívidas pra conta ficar mais honesta.");
  }
  if (base.dividas.some((d) => d.prioridadePagamento == null)) {
    lista.push("Nenhuma prioridade de pagamento definida: quando falta dinheiro pra pagar todas as parcelas, a simulação protege primeiro a de juro mais alto. Defina a prioridade em Dívidas pra decidir você mesmo quem fica pra trás.");
  }
  return lista;
}
