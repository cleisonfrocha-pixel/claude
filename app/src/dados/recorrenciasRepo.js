// Recorrências — compromissos mensais (aluguel, assinatura, financiamento)
// e a geração das transações previstas que eles representam à frente.
// Gerar cedo demais suja a projeção; por isso `gerarPendentes` só cria até
// um horizonte curto (ver ARQUITETURA.md, reuso do `ensureProvisionedEntries`
// do GEDI).

import * as db from "./db.js";
import { cartoes } from "./repositorios.js";
import { obterOuCriarFatura } from "./faturasRepo.js";
import { padraoRecorrencia, validarRecorrencia, padraoTransacao, validarTransacao } from "../domain/esquema.js";
import { competenciasFaltantes, competenciaFatura } from "../domain/transacoes.js";
import { competenciaAtual, dataDeCompetencia } from "../domain/tempo.js";
import { ErroDeValidacao } from "./repositorios.js";

const CAMINHO = "recorrencias";
const HORIZONTE_PADRAO_MESES = 3;

function agora() {
  return new Date().toISOString();
}

export const recorrencias = {
  caminho: CAMINHO,
  listar: () => db.listar(CAMINHO),
  assinar: (cb) => db.assinar(CAMINHO, cb),
  async criar(dadosParciais) {
    const dados = padraoRecorrencia(dadosParciais);
    const erros = validarRecorrencia(dados);
    if (erros.length) throw new ErroDeValidacao(erros);
    const t = agora();
    const id = await db.criar(CAMINHO, { ...dados, criadoEm: t, atualizadoEm: t });
    await gerarPendentes(id);
    return id;
  },
  async atualizar(id, campos) {
    const atual = (await db.listar(CAMINHO)).find((r) => r.id === id);
    const dados = padraoRecorrencia({ ...(atual ? atual.dados : {}), ...campos });
    const erros = validarRecorrencia(dados);
    if (erros.length) throw new ErroDeValidacao(erros);
    await db.atualizar(CAMINHO, id, { ...campos, atualizadoEm: agora() });
    if (dados.ativa) await gerarPendentes(id);
  },
  apagar: (id) => db.apagar(CAMINHO, id),
};

/** Gera as transações previstas que ainda faltam para uma recorrência,
 * dentro do horizonte — nunca duplica uma competência que já existe, nunca
 * sobrescreve um lançamento real (só cria o que falta). */
export async function gerarPendentes(recorrenciaId, horizonteMeses = HORIZONTE_PADRAO_MESES) {
  const todasRecorrencias = await db.listar(CAMINHO);
  const recorrencia = todasRecorrencias.find((r) => r.id === recorrenciaId);
  if (!recorrencia || !recorrencia.dados.ativa) return [];

  const todasTransacoes = await db.listar("transacoes");
  const existentes = todasTransacoes
    .filter((t) => t.dados.recorrenciaId === recorrenciaId)
    .map((t) => t.dados.competencia);

  const faltantes = competenciasFaltantes(recorrencia.dados, {
    competenciaAtual: competenciaAtual(),
    horizonteMeses,
    competenciasExistentes: existentes,
  });

  const t = agora();
  const ids = [];
  for (const competencia of faltantes) {
    const data = dataDeCompetencia(competencia, recorrencia.dados.diaBase);
    const dados = padraoTransacao({
      tipo: recorrencia.dados.tipo,
      valorCentavos: recorrencia.dados.valorEstimadoCentavos,
      data,
      competencia,
      contaId: recorrencia.dados.contaId,
      cartaoId: recorrencia.dados.cartaoId,
      categoriaId: recorrencia.dados.categoriaId,
      pessoaId: recorrencia.dados.pessoaId,
      descricao: recorrencia.dados.descricao,
      status: "previsto",
      certeza: "provavel",
      recorrenciaId,
    });
    if (recorrencia.dados.cartaoId && recorrencia.dados.tipo === "despesa") {
      const cartaoDoc = (await cartoes.listar()).find((c) => c.id === recorrencia.dados.cartaoId);
      if (cartaoDoc) {
        const competenciaFat = competenciaFatura(cartaoDoc.dados, data);
        dados.faturaId = await obterOuCriarFatura(recorrencia.dados.cartaoId, competenciaFat);
      }
    }
    const erros = validarTransacao(dados);
    if (erros.length) continue; // recorrência mal configurada não deve travar as outras
    ids.push(await db.criar("transacoes", { ...dados, criadoEm: t, atualizadoEm: t }));
  }
  return ids;
}
