// Carrega o painel de patrimônio (§14) e reserva (§15): ativos, passivos
// (as mesmas dívidas do §11), composição, patrimônio líquido, e a
// evolução mensal/acumulada a partir de um retrato (snapshot) por
// competência. O snapshot é a ÚNICA coisa gravada aqui além dos
// cadastros — e é um retrato datado, não um saldo vivo (ver
// domain/patrimonio.js e MODELO-DE-DADOS.md): criado uma vez por
// competência, na primeira leitura do mês, e nunca sobrescrito depois —
// senão "evolução mensal" viraria sempre "hoje contra hoje".

import * as db from "./db.js";
import { contas, cartoes, categorias, ativos, pessoas, dividas as dividasRepoBase } from "./repositorios.js";
import { transacoes } from "./transacoesRepo.js";
import { calcularClarezaDeCaixa } from "../domain/caixa.js";
import { calcularVisaoConsolidada } from "../domain/dividas.js";
import { calcularCustos } from "../domain/orcamento.js";
import {
  calcularComposicaoAtivos, montarSnapshot, calcularVariacao, calcularRelacaoDividaAtivoPatrimonio,
} from "../domain/patrimonio.js";
import { calcularReserva } from "../domain/reserva.js";
import { hojeISO, competenciaAtual } from "../domain/tempo.js";

const CAMINHO_SNAPSHOTS = "patrimonioSnapshots";

function comId(lista) {
  return lista.map((item) => ({ id: item.id, ...item.dados }));
}

async function carregarTudo() {
  const [listaContas, listaCartoes, listaCategorias, listaAtivos, listaPessoas, listaDividas, listaTransacoes, listaSnapshots] = await Promise.all([
    contas.listar(), cartoes.listar(), categorias.listar(), ativos.listar(), pessoas.listar(), dividasRepoBase.listar(), transacoes.listar(), db.listar(CAMINHO_SNAPSHOTS),
  ]);
  return {
    contas: comId(listaContas),
    cartoes: comId(listaCartoes),
    categorias: comId(listaCategorias),
    ativos: comId(listaAtivos),
    pessoas: comId(listaPessoas),
    dividas: comId(listaDividas),
    transacoes: listaTransacoes.map((t) => t.dados),
    snapshots: comId(listaSnapshots),
  };
}

export async function calcularPainelPatrimonio() {
  const hoje = hojeISO();
  const competencia = competenciaAtual();
  const dados = await carregarTudo();

  const { totalCentavos: ativosCentavos, composicao } = calcularComposicaoAtivos(dados.ativos);
  const visaoDividas = calcularVisaoConsolidada(dados.dividas, hoje);
  const passivosCentavos = visaoDividas.saldoTotalAtualCentavos;
  const liquidoCentavos = ativosCentavos - passivosCentavos;

  let snapshotsOrdenados = [...dados.snapshots].sort((a, b) => a.competencia.localeCompare(b.competencia));
  let snapshotAtual = snapshotsOrdenados.find((s) => s.competencia === competencia);
  if (!snapshotAtual) {
    snapshotAtual = montarSnapshot({ competencia, ativosCentavos, passivosCentavos, composicao });
    await db.criar(CAMINHO_SNAPSHOTS, snapshotAtual);
    snapshotsOrdenados = [...snapshotsOrdenados, snapshotAtual].sort((a, b) => a.competencia.localeCompare(b.competencia));
  }

  const indiceAtual = snapshotsOrdenados.findIndex((s) => s.competencia === competencia);
  const snapshotAnterior = snapshotsOrdenados.slice(0, indiceAtual).reverse()[0] || null;
  const primeiroSnapshot = snapshotsOrdenados[0] || null;

  const variacaoMensal = calcularVariacao(snapshotAtual, snapshotAnterior);
  const variacaoAcumulada = primeiroSnapshot && primeiroSnapshot.competencia !== competencia
    ? calcularVariacao(snapshotAtual, primeiroSnapshot) : null;
  const relacao = calcularRelacaoDividaAtivoPatrimonio(snapshotAtual, snapshotAnterior);

  const clareza = calcularClarezaDeCaixa({ ...dados, hoje, horizonteDias: 30 });
  const custos = calcularCustos(dados.transacoes, dados.categorias, competencia);
  const reserva = calcularReserva({ saldoReservaCentavos: clareza.saldoReservaCentavos, custoEssencialCentavos: custos.essencialCentavos });

  return {
    hoje, competencia,
    ativos: dados.ativos,
    pessoas: dados.pessoas,
    ativosCentavos, passivosCentavos, liquidoCentavos, composicao,
    variacaoMensal, variacaoAcumulada, relacao,
    reserva,
    historicoSnapshots: snapshotsOrdenados,
  };
}

/** Assina o painel ao vivo — recalcula sempre que conta, ativo, dívida ou
 * transação mudar. */
export function assinarPainelPatrimonio(cb) {
  let cancelada = false;
  async function recalcular() {
    if (cancelada) return;
    const r = await calcularPainelPatrimonio();
    if (cancelada) return;
    cb(r);
  }
  const pararContas = contas.assinar(recalcular);
  const pararAtivos = ativos.assinar(recalcular);
  const pararDividas = dividasRepoBase.assinar(recalcular);
  const pararTransacoes = transacoes.assinar(recalcular);
  return () => {
    cancelada = true;
    pararContas();
    pararAtivos();
    pararDividas();
    pararTransacoes();
  };
}
