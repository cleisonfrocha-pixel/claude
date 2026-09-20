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
import { contas, cartoes, categorias, pessoas, dividas as dividasRepoBase } from "./repositorios.js";
import { transacoes } from "./transacoesRepo.js";
import { faturas } from "./faturasRepo.js";
import { calcularSaldoConta, calcularClarezaDeCaixa } from "../domain/caixa.js";
import { calcularVisaoCartao } from "../domain/cartoes.js";
import { calcularHorizonte } from "../domain/projecao.js";
import { calcularDiagnostico } from "../domain/diagnostico.js";
import { detectarAchados, montarPlanoVivo, priorizarAchados } from "../domain/decisoes.js";
import { hojeISO, competenciaAtual } from "../domain/tempo.js";

const CAMINHO_DECISOES = "decisoes";

function comId(lista) {
  return lista.map((item) => ({ id: item.id, ...item.dados }));
}

async function carregarTudo() {
  const [listaContas, listaCartoes, listaFaturas, listaTransacoes, listaDividas, listaCategorias, listaPessoas, listaDecisoes] = await Promise.all([
    contas.listar(), cartoes.listar(), faturas.listar(), transacoes.listar(),
    dividasRepoBase.listar(), categorias.listar(), pessoas.listar(), db.listar(CAMINHO_DECISOES),
  ]);
  return {
    contas: comId(listaContas),
    cartoes: comId(listaCartoes),
    faturas: comId(listaFaturas),
    transacoes: listaTransacoes.map((t) => t.dados),
    dividas: comId(listaDividas),
    categorias: comId(listaCategorias),
    pessoas: comId(listaPessoas),
    decisoes: comId(listaDecisoes),
  };
}

function montarCartoesVisao({ cartoes: listaCartoes, faturas: listaFaturas, transacoes: listaTransacoes, hoje }) {
  return listaCartoes
    .filter((c) => c.status === "ativo")
    .map((cartao) => {
      const faturasDoCartao = listaFaturas.filter((f) => f.cartaoId === cartao.id);
      const transacoesDoCartao = listaTransacoes.filter((t) => t.cartaoId === cartao.id);
      return {
        cartaoId: cartao.id,
        apelido: cartao.apelido,
        visao: calcularVisaoCartao({ cartao, transacoesDoCartao, faturasDoCartao, hoje }),
      };
    });
}

/** Uma leitura única do painel inteiro: diagnóstico, achados pendentes,
 * histórico de decisões e o plano vivo montado a partir dos pendentes. */
export async function calcularPainelDecisoes() {
  const dados = await carregarTudo();
  const hoje = hojeISO();
  const competencia = competenciaAtual();

  const contasAtivas = dados.contas.filter((c) => c.status === "ativa");
  const saldoInicialCentavos = contasAtivas.filter((c) => !c.ehReserva).reduce((s, c) => s + calcularSaldoConta(c, dados.transacoes), 0);

  const clareza = calcularClarezaDeCaixa({ ...dados, hoje, horizonteDias: 30 });
  const horizonte30d = calcularHorizonte({ ...dados, saldoInicialCentavos, hoje, dias: 30 });
  const cartoesVisao = montarCartoesVisao({ ...dados, hoje });

  const diagnostico = calcularDiagnostico({ ...dados, clareza, competenciaAtual: competencia, hoje });
  const todosOsAchados = detectarAchados({ clareza, horizonte30d, dividas: dados.dividas, cartoesVisao, hoje });

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

/** Assina o painel ao vivo — recalcula sempre que conta, transação, dívida
 * ou decisão mudar. */
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
  const pararDecisoes = db.assinar(CAMINHO_DECISOES, recalcular);
  return () => {
    cancelada = true;
    pararContas();
    pararTransacoes();
    pararDividas();
    pararDecisoes();
  };
}
