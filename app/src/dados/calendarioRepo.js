// Carrega os dados do calendário financeiro (domain/calendario.js): a
// grade do mês visível e o resumo de pressão/cobertura, que fica preso a
// uma janela fixa a partir de hoje — não muda quando o usuário só navega
// de mês na grade (mesma ideia do painel da Home, que não muda com nada
// além dos dados de verdade).

import { contas, cartoes } from "./repositorios.js";
import { transacoes } from "./transacoesRepo.js";
import { faturas } from "./faturasRepo.js";
import { calcularClarezaDeCaixa } from "../domain/caixa.js";
import { compromissosPorDia, calcularCoberturaDiaria, diaDeMaiorPressao, diasSemCobertura } from "../domain/calendario.js";
import { hojeISO, diasNoMes, dataDeCompetencia, somarDias } from "../domain/tempo.js";

const HORIZONTE_COBERTURA_DIAS = 90;

function comId(lista) {
  return lista.map((item) => ({ id: item.id, ...item.dados }));
}

async function carregarTudo() {
  const [listaContas, listaCartoes, listaFaturas, listaTransacoes] = await Promise.all([
    contas.listar(), cartoes.listar(), faturas.listar(), transacoes.listar(),
  ]);
  return {
    contas: comId(listaContas),
    cartoes: comId(listaCartoes),
    faturas: comId(listaFaturas),
    transacoes: listaTransacoes.map((t) => t.dados),
  };
}

/**
 * `mesVisivel` — competência "AAAA-MM" que a grade deve desenhar.
 * Devolve os dias do mês visível (com cobertura calculada), mais o resumo
 * fixo de 90 dias (pior dia, obrigações sem cobertura) que persiste
 * independente da navegação.
 */
export async function calcularCalendario(mesVisivel) {
  const dados = await carregarTudo();
  const hoje = hojeISO();
  const clareza = calcularClarezaDeCaixa({ ...dados, hoje, horizonteDias: 30 });

  const primeiroDiaMesVisivel = `${mesVisivel}-01`;
  const ultimoDiaMesVisivel = dataDeCompetencia(mesVisivel, diasNoMes(mesVisivel));
  const horizontePadraoAte = somarDias(hoje, HORIZONTE_COBERTURA_DIAS);
  // O passeio de cobertura precisa alcançar o mês visível inteiro, mesmo
  // quando o usuário navega além dos 90 dias padrão do resumo.
  const ateDoPasseio = ultimoDiaMesVisivel > horizontePadraoAte ? ultimoDiaMesVisivel : horizontePadraoAte;

  const todosOsDias = compromissosPorDia({ ...dados, de: hoje, ate: ateDoPasseio });
  const cobertura = calcularCoberturaDiaria(clareza.saldoAtualCentavos, todosOsDias);

  const diasDoMesVisivel = cobertura.filter((d) => d.data >= primeiroDiaMesVisivel && d.data <= ultimoDiaMesVisivel);
  const dentroDoHorizontePadrao = cobertura.filter((d) => d.data <= horizontePadraoAte);

  return {
    diasDoMesVisivel,
    piorDia: diaDeMaiorPressao(dentroDoHorizontePadrao),
    semCobertura: diasSemCobertura(dentroDoHorizontePadrao),
    horizonteAte: horizontePadraoAte,
    saldoAtualCentavos: clareza.saldoAtualCentavos,
    hoje,
  };
}

/** Assina o calendário ao vivo — recalcula sempre que conta ou transação
 * mudar. `cb` recebe o resultado agora e a cada mudança. */
export function assinarCalendario(mesVisivel, cb) {
  let cancelada = false;
  async function recalcular() {
    if (cancelada) return;
    const r = await calcularCalendario(mesVisivel);
    if (cancelada) return;
    cb(r);
  }
  const pararContas = contas.assinar(recalcular);
  const pararTransacoes = transacoes.assinar(recalcular);
  return () => {
    cancelada = true;
    pararContas();
    pararTransacoes();
  };
}
