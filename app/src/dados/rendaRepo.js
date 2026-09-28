// Carrega o painel de renda e orçamento (§12, §13): junta fontes de
// renda, custos, margem, e a pergunta central — havendo déficit, qual é a
// causa. Tudo calculado ao vivo a partir dos dados reais; as duas únicas
// metas que não vêm de lançamento nenhum (custo desejado, meta de
// recuperação) moram em orcamentoRepo.js.

import { carregarBase, assinarBase } from "./base.js";
import { obterMetas } from "./orcamentoRepo.js";
import { calcularClarezaDeCaixa } from "../domain/caixa.js";
import { calcularVisaoConsolidada } from "../domain/dividas.js";
import {
  calcularRendaAtual, calcularConcentracaoRenda, calcularPrevisibilidadeFonte,
  calcularGaps, diagnosticarCausaDeficit,
} from "../domain/renda.js";
import {
  calcularCustos, calcularMargem, calcularRecorrenteVsExtraordinario,
  calcularEvolucaoPorCategoria, identificarCategoriasCrescentes,
} from "../domain/orcamento.js";
import { hojeISO, competenciaAtual } from "../domain/tempo.js";

/** Uma leitura única do painel inteiro. */
export async function calcularPainelRenda() {
  return montarPainelRenda(await carregarBase());
}

async function montarPainelRenda(dados) {
  const hoje = hojeISO();
  const competencia = competenciaAtual();
  const metas = await obterMetas();

  const clareza = calcularClarezaDeCaixa({ ...dados, hoje, horizonteDias: 30 });
  const visaoDividas = calcularVisaoConsolidada(dados.dividas, hoje);

  const rendaAtualCentavos = calcularRendaAtual(dados.transacoes, competencia);
  const concentracao = calcularConcentracaoRenda(dados.transacoes, competencia);
  const custos = calcularCustos(dados.transacoes, dados.categorias, competencia);
  const margemCentavos = calcularMargem({
    rendaAtualCentavos, custoEssencialCentavos: custos.essencialCentavos,
    comprometimentoMensalDividasCentavos: visaoDividas.comprometimentoMensalCentavos,
  });

  const metaRecuperacaoEfetivaCentavos = metas.metaRecuperacaoCentavos != null
    ? metas.metaRecuperacaoCentavos
    : custos.essencialCentavos + visaoDividas.comprometimentoMensalCentavos;

  const gaps = calcularGaps({
    rendaAtualCentavos, custoEssencialCentavos: custos.essencialCentavos,
    custoDesejadoCentavos: metas.custoDesejadoCentavos, metaRecuperacaoCentavos: metaRecuperacaoEfetivaCentavos,
  });

  const causaDeficit = diagnosticarCausaDeficit({
    rendaAtualCentavos, custoEssencialCentavos: custos.essencialCentavos, custoAtualCentavos: custos.atualCentavos,
    custoDividasPagasCentavos: custos.dividasCentavos,
    comprometimentoMensalDividasCentavos: visaoDividas.comprometimentoMensalCentavos,
    seguroParaGastarCentavos: clareza.seguroParaGastarCentavos,
  });

  const fontes = dados.fontesRenda.map((fonte) => ({
    ...fonte,
    previsibilidade: calcularPrevisibilidadeFonte(fonte, dados.transacoes.filter((t) => t.fonteRendaId === fonte.id), { competenciaAtual: competencia }),
  }));

  return {
    hoje, competencia,
    rendaAtualCentavos,
    concentracao,
    fontes,
    custos,
    margemCentavos,
    recorrenteVsExtraordinario: calcularRecorrenteVsExtraordinario(dados.transacoes, competencia, dados.recorrencias),
    evolucaoCategorias: calcularEvolucaoPorCategoria(dados.transacoes, competencia),
    categoriasCrescentes: identificarCategoriasCrescentes(dados.transacoes, competencia),
    metas: { ...metas, metaRecuperacaoEfetivaCentavos },
    gaps,
    causaDeficit,
    comprometimentoMensalDividasCentavos: visaoDividas.comprometimentoMensalCentavos,
    categorias: dados.categorias,
    pessoas: dados.pessoas,
    transacoes: dados.transacoes,
  };
}

/** Assina o painel ao vivo — recalcula quando qualquer cadastro mudar. */
export function assinarPainelRenda(cb) {
  return assinarBase(montarPainelRenda, cb);
}
