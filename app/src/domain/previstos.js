// Domínio puro: o que vai acontecer e ainda não está lançado. Agenda,
// fluxo de caixa e "posso gastar" só enxergavam transação gravada como
// "previsto" — então a renda fixa cadastrada, a parcela da dívida e a
// conta mensal além dos meses já gerados simplesmente não existiam no
// futuro. Aqui esses eventos são DERIVADOS na leitura (nada é gravado:
// regra "nada de total gravado" e "simulação não escreve no dado real").
//
// Cada evento diz de onde veio (`origem`), pra agenda e alertas poderem
// apontar o cadastro que o gerou (§9/§17).

import { somarMeses, competenciaDeData, dataDeCompetencia } from "./tempo.js";
import { competenciaFatura, dataVencimentoFatura } from "./transacoes.js";
import { dataDaParcela, parcelasRestantes } from "./dividas.js";

const MESES_PISO_VARIAVEL = 3;
const DIAS_DO_GASTO_SEMANAL = [1, 8, 15, 22];

/** Quanto a casa gasta por mês no dia a dia (mercado, gasolina, lazer…),
 * pela média dos últimos meses FECHADOS com dados: todo o gasto menos as
 * parcelas de dívida (já projetadas pelo cronograma) e menos o que as
 * recorrências ativas já projetam (aluguel, internet…). É o que a
 * projeção longa precisa pra não virar fantasia — só com o que está
 * agendado, 12 meses pareceriam só entrada. */
export function gastoDiaADiaMensal({ transacoes, categorias, recorrencias, competencia, meses = 3 }) {
  const dividasIds = new Set((categorias || []).filter((c) => c.grupo === "dividas").map((c) => c.id));
  const comDados = new Set((transacoes || []).filter((t) => t.status === "pago" && t.competencia).map((t) => t.competencia));
  const totais = [];
  for (let i = 1; i <= meses; i++) {
    const c = somarMeses(competencia, -i);
    if (!comDados.has(c)) continue;
    let total = 0;
    for (const t of transacoes || []) {
      if (t.status !== "pago" || t.competencia !== c || t.tipo !== "despesa") continue;
      if (t.dividaId || dividasIds.has(t.categoriaId)) continue;
      total += Number(t.valorCentavos) || 0;
    }
    totais.push(total);
  }
  if (!totais.length) return 0;
  const media = Math.round(totais.reduce((s, v) => s + v, 0) / totais.length);
  const recorrente = (recorrencias || []).filter((r) => r.ativa !== false && r.tipo === "despesa").reduce((s, r) => s + (Number(r.valorEstimadoCentavos) || 0), 0);
  return Math.max(0, media - recorrente);
}

function competenciasEntre(de, ate) {
  const lista = [];
  const fim = competenciaDeData(ate);
  for (let c = competenciaDeData(de); c <= fim; c = somarMeses(c, 1)) lista.push(c);
  return lista;
}

/** Dia em que uma fonte costuma pagar: o cadastrado; sem ele, o dia do
 * último recebimento dela; sem histórico, o último dia do mês (o mais
 * conservador pro caixa — nunca antecipa dinheiro). */
/** Dia típico de recebimento: com 3 ou mais recebimentos reais, vale a
 * mediana dos últimos 3 (o dinheiro cai quando cai, não quando o cadastro
 * diz); antes disso, o dia cadastrado; sem nada, a última data conhecida. */
export function diaDaFonte(fonte, receitasDaFonte) {
  const pagas = receitasDaFonte.filter((t) => t.status === "pago").sort((a, b) => b.data.localeCompare(a.data)).slice(0, 3);
  if (pagas.length >= 3) {
    const dias = pagas.map((t) => Number(t.data.slice(8, 10))).sort((a, b) => a - b);
    return dias[1];
  }
  if (Number(fonte.diaRecebimento) >= 1) return Number(fonte.diaRecebimento);
  const ultima = receitasDaFonte.filter((t) => t.status === "pago").sort((a, b) => b.data.localeCompare(a.data))[0];
  return ultima ? Number(ultima.data.slice(8, 10)) : 31;
}

/** Quanto contar de uma fonte num mês futuro, e com que certeza.
 * Fixa/recorrente: o valor esperado, provável. Variável: o PIOR dos
 * últimos meses fechados em que ela pagou (piso real, provável); o que
 * passa disso não é garantido. Sem histórico, o esperado como incerto
 * (não entra no saldo seguro). Eventual: nunca projeta. */
function valorDaFonte(fonte, receitasDaFonte, competenciaHoje) {
  const esperado = Number(fonte.valorEsperadoCentavos) || 0;
  if (fonte.tipo === "fixa" || fonte.tipo === "recorrente") return esperado > 0 ? { valorCentavos: esperado, certeza: "provavel" } : null;
  if (fonte.tipo !== "variavel") return null;
  const porMes = new Map();
  for (const t of receitasDaFonte) {
    if (t.status !== "pago" || t.competencia >= competenciaHoje) continue;
    porMes.set(t.competencia, (porMes.get(t.competencia) || 0) + (Number(t.valorCentavos) || 0));
  }
  const recentes = [...porMes.entries()].sort((a, b) => b[0].localeCompare(a[0])).slice(0, MESES_PISO_VARIAVEL).map(([, v]) => v).filter((v) => v > 0);
  if (recentes.length) return { valorCentavos: Math.min(...recentes), certeza: "provavel", piso: true };
  return esperado > 0 ? { valorCentavos: esperado, certeza: "incerto" } : null;
}

/**
 * Eventos futuros derivados dos cadastros, entre `de` e `ate`:
 * - renda de cada fonte ativa (fixa, recorrente, variável pelo piso);
 * - parcela de cada dívida com acordo, nas datas do contrato (parcela já
 *   vencida e não paga entra em `de`, marcada como atrasada);
 * - conta de cada recorrência ativa nos meses que ainda não têm o
 *   lançamento gerado (no cartão, cai no vencimento da fatura).
 * Nunca duplica o que já está lançado: mês com receita da fonte, com o
 * lançamento da recorrência ou com lançamento ligado à parcela é pulado.
 */
export function eventosFuturos({ transacoes, dividas, recorrencias, fontesRenda, cartoes, de, ate, hoje, gastoDiaADiaMensalCentavos = 0 }) {
  const eventos = [];
  const lista = transacoes || [];
  const competenciaHoje = competenciaDeData(hoje || de);
  const comps = competenciasEntre(de, ate);
  const cartaoPorId = new Map((cartoes || []).map((c) => [c.id, c]));
  const recorrenciasAtivas = (recorrencias || []).filter((r) => r.ativa !== false);

  for (const f of fontesRenda || []) {
    if (f.ativa === false) continue;
    const receitas = lista.filter((t) => t.tipo === "receita" && t.fonteRendaId === f.id);
    const valor = valorDaFonte(f, receitas, competenciaHoje);
    if (!valor) continue;
    // Se já existe uma recorrência de receita da mesma pessoa com o mesmo
    // valor (±10%), ela já representa esse dinheiro — não conta duas vezes.
    const coberta = recorrenciasAtivas.some((r) => r.tipo === "receita" && r.pessoaId && r.pessoaId === f.pessoaId
      && Math.abs((Number(r.valorEstimadoCentavos) || 0) - valor.valorCentavos) <= valor.valorCentavos * 0.1);
    if (coberta) continue;
    const dia = diaDaFonte(f, receitas);
    for (const c of comps) {
      if (f.fim && c > f.fim) continue; // contrato acabou: não projeta além do último mês
      if (receitas.some((t) => t.competencia === c && t.status !== "cancelado")) continue;
      const dataOriginal = dataDeCompetencia(c, dia);
      // Dia esperado já passou neste mês e ninguém confirmou o recebimento:
      // não some do calendário, pesa hoje como atrasado (mesmo tratamento
      // da parcela de dívida, acima) — é o "precisa cobrar" que o usuário
      // espera ver.
      const atrasado = dataOriginal < de;
      const data = atrasado ? de : dataOriginal;
      if (data < de || data > ate) continue;
      eventos.push({
        data, vencimento: dataOriginal, tipo: "receita", valorCentavos: valor.valorCentavos, certeza: valor.certeza, virtual: true, atrasado,
        descricao: valor.piso ? `${f.nome} (pior mês recente)` : f.nome,
        origem: { tipo: "fonteRenda", id: f.id },
      });
    }
  }

  for (const d of dividas || []) {
    const parcela = Number(d.valorParcelaCentavos) || 0;
    if (!(parcela > 0) || parcelasRestantes(d) <= 0) continue;
    const pagas = Number(d.parcelasPagas) || 0;
    const total = Number(d.quantidadeParcelas) || 0;
    for (let k = pagas; k < total; k++) {
      const vencimento = dataDaParcela(d, k);
      if (!vencimento || vencimento > ate) break;
      const c = competenciaDeData(vencimento);
      if (lista.some((t) => t.dividaId === d.id && t.competencia === c && t.status !== "cancelado")) continue;
      const atrasado = vencimento < de;
      eventos.push({
        data: atrasado ? de : vencimento, vencimento, tipo: "despesa", valorCentavos: parcela, certeza: "confirmado", virtual: true, atrasado,
        descricao: `Parcela ${k + 1}/${total} · ${d.nome}`,
        origem: { tipo: "divida", id: d.id },
      });
    }
  }

  for (const r of recorrenciasAtivas) {
    const valor = Number(r.valorEstimadoCentavos) || 0;
    if (!(valor > 0)) continue;
    const cartao = r.cartaoId ? cartaoPorId.get(r.cartaoId) : null;
    if (r.cartaoId && !cartao) continue;
    for (const c of competenciasEntre(somarMeses(competenciaDeData(de), -2), ate)) {
      if (r.inicio && c < r.inicio) continue;
      if (r.fim && c > r.fim) continue;
      if (lista.some((t) => t.recorrenciaId === r.id && t.competencia === c)) continue;
      const dataLancamento = dataDeCompetencia(c, r.diaBase);
      // Mês que já passou sem o lançamento gerado não vira cobrança
      // retroativa: só projeta daqui pra frente.
      if (dataLancamento < (hoje || de)) continue;
      const data = cartao && r.tipo === "despesa" ? dataVencimentoFatura(cartao, competenciaFatura(cartao, dataLancamento)) : dataLancamento;
      if (data < de || data > ate) continue;
      eventos.push({
        data, tipo: r.tipo === "receita" ? "receita" : "despesa", valorCentavos: valor, certeza: "provavel", virtual: true,
        descricao: cartao ? `${r.descricao} (no ${cartao.apelido || "cartão"})` : r.descricao,
        origem: { tipo: "recorrencia", id: r.id },
      });
    }
  }

  // Gasto do dia a dia estimado, em quatro parcelas semanais por mês. Só
  // quem pede (projeção longa) passa o valor: o "posso gastar" de 30 dias
  // é justamente o orçamento desse gasto, não pode descontá-lo de novo.
  if (gastoDiaADiaMensalCentavos > 0) {
    const porSemana = Math.round(gastoDiaADiaMensalCentavos / DIAS_DO_GASTO_SEMANAL.length);
    for (const c of comps) {
      for (const dia of DIAS_DO_GASTO_SEMANAL) {
        const data = dataDeCompetencia(c, dia);
        if (data < de || data > ate) continue;
        eventos.push({
          data, tipo: "despesa", valorCentavos: porSemana, certeza: "provavel", virtual: true,
          descricao: "Gasto do dia a dia (média dos últimos meses)",
          origem: { tipo: "gastoMedio", id: c },
        });
      }
    }
  }

  return eventos.sort((a, b) => a.data.localeCompare(b.data));
}
