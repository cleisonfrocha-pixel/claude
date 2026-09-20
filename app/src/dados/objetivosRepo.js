// Carrega o painel de objetivos (§16): progresso de cada um, e a
// verificação central — o que o objetivo exige por mês cabe na margem
// atual (§13)? Reaproveita renda e custos já calculados na Fase 8, não
// recalcula do zero.

import { objetivos, contas, categorias, pessoas, dividas as dividasRepoBase } from "./repositorios.js";
import { transacoes } from "./transacoesRepo.js";
import { calcularSaldoConta } from "../domain/caixa.js";
import { calcularVisaoConsolidada } from "../domain/dividas.js";
import { calcularRendaAtual } from "../domain/renda.js";
import { calcularCustos, calcularMargem } from "../domain/orcamento.js";
import { calcularHorizonteObjetivo, verificarCompatibilidadeComMargem } from "../domain/objetivos.js";
import { hojeISO, competenciaAtual } from "../domain/tempo.js";

function comId(lista) {
  return lista.map((item) => ({ id: item.id, ...item.dados }));
}

async function carregarTudo() {
  const [listaObjetivos, listaContas, listaCategorias, listaPessoas, listaDividas, listaTransacoes] = await Promise.all([
    objetivos.listar(), contas.listar(), categorias.listar(), pessoas.listar(), dividasRepoBase.listar(), transacoes.listar(),
  ]);
  return {
    objetivos: comId(listaObjetivos),
    contas: comId(listaContas),
    categorias: comId(listaCategorias),
    pessoas: comId(listaPessoas),
    dividas: comId(listaDividas),
    transacoes: listaTransacoes.map((t) => t.dados),
  };
}

export async function calcularPainelObjetivos() {
  const dados = await carregarTudo();
  const hoje = hojeISO();
  const competencia = competenciaAtual();

  const rendaAtualCentavos = calcularRendaAtual(dados.transacoes, competencia);
  const custos = calcularCustos(dados.transacoes, dados.categorias, competencia);
  const visaoDividas = calcularVisaoConsolidada(dados.dividas, hoje);
  const margemCentavos = calcularMargem({
    rendaAtualCentavos, custoEssencialCentavos: custos.essencialCentavos,
    comprometimentoMensalDividasCentavos: visaoDividas.comprometimentoMensalCentavos,
  });

  const listaObjetivos = dados.objetivos.map((o) => {
    let valorAtualCentavos = Number(o.valorAtualCentavos) || 0;
    if (o.contaVinculadaId) {
      const conta = dados.contas.find((c) => c.id === o.contaVinculadaId);
      if (conta) valorAtualCentavos = calcularSaldoConta(conta, dados.transacoes);
    }
    const compat = verificarCompatibilidadeComMargem(o, valorAtualCentavos, margemCentavos, hoje);
    return {
      ...o,
      valorAtualCalculadoCentavos: valorAtualCentavos,
      horizonte: calcularHorizonteObjetivo(o.prazo, hoje),
      ...compat,
    };
  });

  return { hoje, competencia, margemCentavos, objetivos: listaObjetivos, contas: dados.contas, pessoas: dados.pessoas };
}

/** Assina o painel ao vivo — recalcula sempre que objetivo, conta, dívida
 * ou transação mudar. */
export function assinarPainelObjetivos(cb) {
  let cancelada = false;
  async function recalcular() {
    if (cancelada) return;
    const r = await calcularPainelObjetivos();
    if (cancelada) return;
    cb(r);
  }
  const pararObjetivos = objetivos.assinar(recalcular);
  const pararContas = contas.assinar(recalcular);
  const pararDividas = dividasRepoBase.assinar(recalcular);
  const pararTransacoes = transacoes.assinar(recalcular);
  return () => {
    cancelada = true;
    pararObjetivos();
    pararContas();
    pararDividas();
    pararTransacoes();
  };
}
