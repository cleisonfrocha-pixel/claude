// Carrega o painel de qualidade, completude e confiança dos dados (§23):
// o quanto da vida financeira já está mapeada, o que ainda precisa de
// confirmação, o que não é conferido há muito tempo, e a data da última
// atualização — a base do aviso que outras telas (Plano/Diagnóstico)
// mostram quando uma conclusão se apoia em dados incompletos.

import { pessoas, contas, categorias, dividas as dividasRepoBase, fontesRenda, ativos } from "./repositorios.js";
import { transacoes } from "./transacoesRepo.js";
import {
  calcularCompletudeGeral, identificarItensAConfirmar, identificarSaldosNaoConciliados,
  calcularUltimaAtualizacao, calcularConfiabilidade,
} from "../domain/qualidade.js";
import { hojeISO, somarDias } from "../domain/tempo.js";

const DIAS_LIMITE_CONCILIACAO = 180;
const DIAS_LIMITE_TRANSACAO_RECENTE = 30;

function comId(lista) {
  return lista.map((item) => ({ id: item.id, ...item.dados }));
}

async function carregarTudo() {
  const [listaPessoas, listaContas, listaCategorias, listaDividas, listaFontesRenda, listaAtivos, listaTransacoes] = await Promise.all([
    pessoas.listar(), contas.listar(), categorias.listar(), dividasRepoBase.listar(),
    fontesRenda.listar(), ativos.listar(), transacoes.listar(),
  ]);
  return {
    pessoas: comId(listaPessoas),
    contas: comId(listaContas),
    categorias: comId(listaCategorias),
    dividas: comId(listaDividas),
    fontesRenda: comId(listaFontesRenda),
    ativos: comId(listaAtivos),
    transacoes: listaTransacoes.map((t) => t.dados),
  };
}

export async function calcularPainelQualidade() {
  const dados = await carregarTudo();
  const hoje = hojeISO();
  const limiteTrintaDias = somarDias(hoje, -DIAS_LIMITE_TRANSACAO_RECENTE);
  const limiteConciliacao = somarDias(hoje, -DIAS_LIMITE_CONCILIACAO);

  const completude = calcularCompletudeGeral({ ...dados, limiteTrintaDias });
  const itensAConfirmar = identificarItensAConfirmar(dados);
  const saldosNaoConciliados = identificarSaldosNaoConciliados(dados, { limiteData: limiteConciliacao });
  const ultimaAtualizacao = calcularUltimaAtualizacao([
    dados.pessoas, dados.contas, dados.categorias, dados.dividas, dados.fontesRenda, dados.ativos,
  ]);
  const confiabilidade = calcularConfiabilidade({ completude, itensAConfirmar, saldosNaoConciliados });

  return { hoje, completude, itensAConfirmar, saldosNaoConciliados, ultimaAtualizacao, confiabilidade };
}

/** Assina o painel ao vivo — recalcula sempre que qualquer cadastro base
 * ou transação mudar (qualquer um deles pode mudar completude ou
 * confiabilidade). */
export function assinarPainelQualidade(cb) {
  let cancelada = false;
  async function recalcular() {
    if (cancelada) return;
    const r = await calcularPainelQualidade();
    if (cancelada) return;
    cb(r);
  }
  const pararPessoas = pessoas.assinar(recalcular);
  const pararContas = contas.assinar(recalcular);
  const pararCategorias = categorias.assinar(recalcular);
  const pararDividas = dividasRepoBase.assinar(recalcular);
  const pararFontesRenda = fontesRenda.assinar(recalcular);
  const pararAtivos = ativos.assinar(recalcular);
  const pararTransacoes = transacoes.assinar(recalcular);
  return () => {
    cancelada = true;
    pararPessoas();
    pararContas();
    pararCategorias();
    pararDividas();
    pararFontesRenda();
    pararAtivos();
    pararTransacoes();
  };
}
