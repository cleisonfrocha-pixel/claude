// Carrega os dados do calendário financeiro (domain/calendario.js): a
// grade do mês visível e o resumo de pressão/cobertura, que fica preso a
// uma janela fixa a partir de hoje — não muda quando o usuário só navega
// de mês na grade (mesma ideia do painel da Home, que não muda com nada
// além dos dados de verdade).

import { carregarBase, assinarBase } from "./base.js";
import { calcularClarezaDeCaixa } from "../domain/caixa.js";
import { compromissosPorDia, calcularCoberturaDiaria, diaDeMaiorPressao, diasSemCobertura } from "../domain/calendario.js";
import { eventosFuturos } from "../domain/previstos.js";
import { hojeISO, diasNoMes, dataDeCompetencia, somarDias } from "../domain/tempo.js";

const HORIZONTE_COBERTURA_DIAS = 90;

/**
 * `mesVisivel` — competência "AAAA-MM" que a grade deve desenhar.
 * Devolve os dias do mês visível (com cobertura calculada), mais o resumo
 * fixo de 90 dias (pior dia, obrigações sem cobertura) que persiste
 * independente da navegação.
 */
export async function calcularCalendario(mesVisivel) {
  return montarCalendario(mesVisivel, await carregarBase());
}

function montarCalendario(mesVisivel, dados) {
  const hoje = hojeISO();
  const clareza = calcularClarezaDeCaixa({ ...dados, hoje, horizonteDias: 30 });

  const primeiroDiaMesVisivel = `${mesVisivel}-01`;
  const ultimoDiaMesVisivel = dataDeCompetencia(mesVisivel, diasNoMes(mesVisivel));
  const horizontePadraoAte = somarDias(hoje, HORIZONTE_COBERTURA_DIAS);
  // O passeio de cobertura precisa alcançar o mês visível inteiro, mesmo
  // quando o usuário navega além dos 90 dias padrão do resumo.
  const ateDoPasseio = ultimoDiaMesVisivel > horizontePadraoAte ? ultimoDiaMesVisivel : horizontePadraoAte;

  const extras = eventosFuturos({ ...dados, de: hoje, ate: ateDoPasseio, hoje });
  const todosOsDias = compromissosPorDia({ ...dados, de: hoje, ate: ateDoPasseio, hoje, extras });
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

/** Assina o calendário ao vivo — recalcula quando qualquer cadastro mudar. */
export function assinarCalendario(mesVisivel, cb) {
  return assinarBase((base) => montarCalendario(mesVisivel, base), cb);
}
