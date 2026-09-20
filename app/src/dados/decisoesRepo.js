// Carrega o painel da Central de Decisões (§9) e do Plano Vivo (§10): os
// achados são sempre recalculados ao vivo a partir dos dados reais — só a
// DISPOSIÇÃO do usuário sobre um achado (resolvida, ignorada, adiada,
// cancelada) é gravada, numa coleção separada (`decisoes`), com um
// retrato do achado no momento da decisão (precisa sobreviver mesmo
// depois que o achado real já não existir mais — ex.: a dívida que
// motivou o achado foi quitada). Guardar essa disposição não fere "nada
// de total gravado" (CLAUDE.md): não é um saldo nem um indicador, é o
// registro de uma decisão tomada — um fato histórico, como uma transação.

import * as db from "./db.js";
import { contas, cartoes, categorias, pessoas, dividas as dividasRepoBase, fontesRenda, ativos } from "./repositorios.js";
import { transacoes } from "./transacoesRepo.js";
import { faturas } from "./faturasRepo.js";
import { recorrencias } from "./recorrenciasRepo.js";
import { calcularPainelPatrimonio } from "./patrimonioRepo.js";
import { calcularSaldoConta, calcularClarezaDeCaixa } from "../domain/caixa.js";
import { calcularVisaoCartao } from "../domain/cartoes.js";
import { calcularVisaoConsolidada } from "../domain/dividas.js";
import { calcularHorizonte } from "../domain/projecao.js";
import { calcularDiagnostico } from "../domain/diagnostico.js";
import { calcularRendaAtual } from "../domain/renda.js";
import { calcularCustos, calcularMargem, identificarCategoriasCrescentes } from "../domain/orcamento.js";
import {
  detectarNovaRecorrencia, detectarRecorrenciaValorDiferente, detectarAumentoCartao,
  detectarReceitaEsperadaNaoRecebida, compararComPeriodoAnterior,
} from "../domain/anomalias.js";
import { detectarAchados, montarPlanoVivo, priorizarAchados } from "../domain/decisoes.js";
import { hojeISO, competenciaAtual, somarMeses } from "../domain/tempo.js";

const CAMINHO_DECISOES = "decisoes";

function comId(lista) {
  return lista.map((item) => ({ id: item.id, ...item.dados }));
}

async function carregarTudo() {
  const [listaContas, listaCartoes, listaFaturas, listaTransacoes, listaDividas, listaCategorias, listaPessoas, listaFontesRenda, listaRecorrencias, listaAtivos, listaDecisoes] = await Promise.all([
    contas.listar(), cartoes.listar(), faturas.listar(), transacoes.listar(),
    dividasRepoBase.listar(), categorias.listar(), pessoas.listar(), fontesRenda.listar(), recorrencias.listar(), ativos.listar(),
    db.listar(CAMINHO_DECISOES),
  ]);
  return {
    contas: comId(listaContas),
    cartoes: comId(listaCartoes),
    faturas: comId(listaFaturas),
    transacoes: listaTransacoes.map((t) => t.dados),
    dividas: comId(listaDividas),
    categorias: comId(listaCategorias),
    pessoas: comId(listaPessoas),
    fontesRenda: comId(listaFontesRenda),
    recorrencias: comId(listaRecorrencias),
    ativos: comId(listaAtivos),
    decisoes: comId(listaDecisoes),
  };
}

function montarCartoesVisao({ cartoes: listaCartoes, faturas: listaFaturas, transacoes: listaTransacoes, hoje }) {
  return listaCartoes
    .filter((c) => c.status === "ativo")
    .map((cartao) => {
      const faturasDoCartao = listaFaturas.filter((f) => f.cartaoId === cartao.id);
      const transacoesDoCartao = listaTransacoes.filter((t) => t.cartaoId === cartao.id);
      const visao = calcularVisaoCartao({ cartao, transacoesDoCartao, faturasDoCartao, hoje });
      const lancamentos = visao.faturaAtual
        ? transacoesDoCartao.filter((t) => t.faturaId === visao.faturaAtual.id).map((t) => ({ descricao: t.descricao || "Compra", valorCentavos: t.valorCentavos, data: t.data }))
        : [];
      return { cartaoId: cartao.id, apelido: cartao.apelido, visao, lancamentos };
    });
}

function transacoesDaCategoria(transacoesLista, categoriaId, competencia) {
  return transacoesLista
    .filter((t) => t.categoriaId === categoriaId && t.competencia === competencia && t.status === "pago")
    .map((t) => ({ descricao: t.descricao || "Despesa", valorCentavos: t.valorCentavos, data: t.data }));
}

/** Uma leitura única do painel inteiro: diagnóstico, achados pendentes,
 * histórico de decisões e o plano vivo montado a partir dos pendentes.
 *
 * Fase 10 (§17, §23, §24): cada gerador novo de achado recebe insumo já
 * pronto — a maioria reaproveitando um cálculo que já existe em outra
 * fase (diagnóstico §8, categorias crescentes §13, relação de patrimônio
 * §14) em vez de recalcular do zero, mesmo raciocínio de sempre.
 */
export async function calcularPainelDecisoes() {
  const dados = await carregarTudo();
  const hoje = hojeISO();
  const competencia = competenciaAtual();
  const competenciaAnterior = somarMeses(competencia, -1);

  const contasAtivas = dados.contas.filter((c) => c.status === "ativa");
  const saldoInicialCentavos = contasAtivas.filter((c) => !c.ehReserva).reduce((s, c) => s + calcularSaldoConta(c, dados.transacoes), 0);

  const clareza = calcularClarezaDeCaixa({ ...dados, hoje, horizonteDias: 30 });
  const horizonte30d = calcularHorizonte({ ...dados, saldoInicialCentavos, hoje, dias: 30 });
  const cartoesVisao = montarCartoesVisao({ ...dados, hoje });

  const diagnostico = calcularDiagnostico({ ...dados, clareza, competenciaAtual: competencia, hoje });

  const nomePorCategoria = new Map(dados.categorias.map((c) => [c.id, c.nome]));
  const foraDoPadrao = (diagnostico.foraDoPadrao || []).map((f) => ({
    ...f, nomeCategoria: nomePorCategoria.get(f.categoriaId) || "Sem categoria",
    lancamentos: transacoesDaCategoria(dados.transacoes, f.categoriaId, competencia),
  }));
  const categoriasCrescentes = identificarCategoriasCrescentes(dados.transacoes, competencia).map((c) => ({
    ...c, nomeCategoria: nomePorCategoria.get(c.categoriaId) || "Sem categoria",
    lancamentos: transacoesDaCategoria(dados.transacoes, c.categoriaId, competencia),
  }));

  const novaRecorrencia = detectarNovaRecorrencia(dados.recorrencias, competencia);
  const recorrenciaValorDiferente = detectarRecorrenciaValorDiferente(dados.recorrencias, dados.transacoes, competencia);

  const cartoesAtivos = dados.cartoes.filter((c) => c.status === "ativo");
  const aumentoCartao = detectarAumentoCartao(cartoesAtivos, dados.faturas, dados.transacoes, competencia).map((c) => {
    const faturaAtual = dados.faturas.find((f) => f.cartaoId === c.cartaoId && f.competencia === competencia);
    const lancamentos = faturaAtual
      ? dados.transacoes.filter((t) => t.faturaId === faturaAtual.id).map((t) => ({ descricao: t.descricao || "Compra", valorCentavos: t.valorCentavos, data: t.data }))
      : [];
    return { ...c, lancamentos };
  });

  const receitaEsperadaNaoRecebida = detectarReceitaEsperadaNaoRecebida(dados.fontesRenda, dados.transacoes, competencia, hoje);

  const visaoDividasAtual = calcularVisaoConsolidada(dados.dividas, hoje);
  const custosAtual = calcularCustos(dados.transacoes, dados.categorias, competencia);
  const custosAnterior = calcularCustos(dados.transacoes, dados.categorias, competenciaAnterior);
  const rendaAtualCentavos = calcularRendaAtual(dados.transacoes, competencia);
  const rendaAnteriorCentavos = calcularRendaAtual(dados.transacoes, competenciaAnterior);
  // Comprometimento mensal de dívida é o mesmo nos dois meses (parcela é
  // estável mês a mês) — só renda e custo essencial variam de fato.
  const margemAtualCentavos = calcularMargem({
    rendaAtualCentavos, custoEssencialCentavos: custosAtual.essencialCentavos,
    comprometimentoMensalDividasCentavos: visaoDividasAtual.comprometimentoMensalCentavos,
  });
  const margemAnteriorCentavos = calcularMargem({
    rendaAtualCentavos: rendaAnteriorCentavos, custoEssencialCentavos: custosAnterior.essencialCentavos,
    comprometimentoMensalDividasCentavos: visaoDividasAtual.comprometimentoMensalCentavos,
  });
  const mudancaReceita = compararComPeriodoAnterior(rendaAtualCentavos, rendaAnteriorCentavos, { limiarPercentual: 30 });
  const mudancaMargem = compararComPeriodoAnterior(margemAtualCentavos, margemAnteriorCentavos, { limiarPercentual: 20 });

  const painelPatrimonio = await calcularPainelPatrimonio();

  const todosOsAchados = detectarAchados({
    clareza, horizonte30d, dividas: dados.dividas, cartoesVisao, hoje,
    foraDoPadrao, categoriasCrescentes, novaRecorrencia, recorrenciaValorDiferente,
    aumentoCartao, receitaEsperadaNaoRecebida, mudancaReceita, mudancaMargem,
    relacaoPatrimonio: painelPatrimonio.relacao,
  });

  const decisoesPorId = new Map(dados.decisoes.map((d) => [d.id, d]));
  const achadosPendentes = priorizarAchados(
    todosOsAchados.filter((a) => (decisoesPorId.get(a.id)?.status || "pendente") === "pendente"),
  );
  const historico = dados.decisoes
    .filter((d) => d.status && d.status !== "pendente")
    .sort((a, b) => (b.decididoEm || "").localeCompare(a.decididoEm || ""));

  const planoVivo = montarPlanoVivo(achadosPendentes, hoje);

  return { diagnostico, achadosPendentes, historico, planoVivo, hoje };
}

/** Grava a disposição do usuário sobre um achado — um retrato dele no
 * momento da decisão, não o achado inteiro (que continua sendo
 * recalculado ao vivo enquanto estiver pendente). */
export async function decidirAchado(achado, status) {
  return db.definir(CAMINHO_DECISOES, achado.id, {
    status,
    chave: achado.chave,
    tipo: achado.tipo,
    titulo: achado.titulo,
    origemRotulo: achado.origem?.rotulo || null,
    impactoCentavos: achado.impactoCentavos,
    prazo: achado.prazo,
    decididoEm: new Date().toISOString(),
  });
}

/** Volta um item do histórico para pendente (desfazer uma decisão). */
export async function reabrirDecisao(id) {
  return db.apagar(CAMINHO_DECISOES, id);
}

/** Assina o painel ao vivo — recalcula sempre que conta, transação,
 * dívida, fonte de renda, recorrência, ativo (via patrimônio) ou decisão
 * mudar. */
export function assinarPainelDecisoes(cb) {
  let cancelada = false;
  async function recalcular() {
    if (cancelada) return;
    const r = await calcularPainelDecisoes();
    if (cancelada) return;
    cb(r);
  }
  const pararContas = contas.assinar(recalcular);
  const pararTransacoes = transacoes.assinar(recalcular);
  const pararDividas = dividasRepoBase.assinar(recalcular);
  const pararFontesRenda = fontesRenda.assinar(recalcular);
  const pararRecorrencias = recorrencias.assinar(recalcular);
  const pararAtivos = ativos.assinar(recalcular);
  const pararDecisoes = db.assinar(CAMINHO_DECISOES, recalcular);
  return () => {
    cancelada = true;
    pararContas();
    pararTransacoes();
    pararDividas();
    pararFontesRenda();
    pararRecorrencias();
    pararAtivos();
    pararDecisoes();
  };
}
