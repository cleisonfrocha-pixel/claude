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
import { competenciaFatura, dataVencimentoFatura, dataPagamentoPrevisto } from "./transacoes.js";
import { dataDaParcela, parcelasRestantes } from "./dividas.js";
import { leituraDaFonte } from "./pisoDaRenda.js";
import { repartirVerba } from "./calendario.js";
import { jaLancadoSemVinculo } from "./conciliacao.js";

const MESES_PISO_VARIAVEL = 3;
const MESES_MINIMOS_HISTORICO = 3;
const DIAS_DO_GASTO_SEMANAL = [1, 8, 15, 22];

/** Quanto a casa gasta por mês no dia a dia (mercado, gasolina, lazer…),
 * pela média dos últimos meses FECHADOS com dados: todo o gasto menos as
 * parcelas de dívida (já projetadas pelo cronograma) e menos o que as
 * recorrências ativas já projetam (aluguel, internet…). É o que a
 * projeção longa precisa pra não virar fantasia — só com o que está
 * agendado, 12 meses pareceriam só entrada. */
export function gastoDiaADiaMensal({ transacoes, categorias, recorrencias, cartoes, faturas, competencia, meses = 3 }) {
  // Compra no cartão que a projeção já conta pelo "uso habitual do cartão" não entra aqui de novo
  // (era o mesmo gasto duas vezes: uma na média do dia a dia, outra na fatura estimada).
  const cartoesComUso = new Set((cartoes || []).filter((c) => c.status !== "encerrado" && usoMensalDoCartao(c, { transacoes, faturas, competenciaHoje: competencia }).valorCentavos > 0).map((c) => c.id));
  const cartaoDaFatura = new Map((faturas || []).map((f) => [f.id, f.cartaoId]));
  const jaNoCartao = (t) => cartoesComUso.has(t.cartaoId || cartaoDaFatura.get(t.faturaId));
  const dividasIds = new Set((categorias || []).filter((c) => c.grupo === "dividas").map((c) => c.id));
  const comDados = new Set((transacoes || []).filter((t) => t.status === "pago" && t.competencia).map((t) => t.competencia));
  const porCategoria = new Map(); // categoria -> total de cada mês fechado com dados
  let mesesLidos = 0;
  for (let i = 1; i <= meses; i++) {
    const c = somarMeses(competencia, -i);
    if (!comDados.has(c)) continue;
    mesesLidos += 1;
    for (const t of transacoes || []) {
      if (t.status !== "pago" || t.competencia !== c || t.tipo !== "despesa") continue;
      if (t.dividaId || dividasIds.has(t.categoriaId) || jaNoCartao(t)) continue;
      const k = t.categoriaId || "sem-categoria";
      porCategoria.set(k, (porCategoria.get(k) || 0) + (Number(t.valorCentavos) || 0));
    }
  }
  if (!mesesLidos) return 0;
  // Categoria a categoria: o que a recorrência ativa já projeta não conta de novo, mas o que a categoria
  // gastou ACIMA do que a recorrência prevê (mercado real maior que o "mercado do mês" cadastrado) é gasto
  // do dia a dia de verdade. Uma categoria folgada não esconde o estouro de outra.
  const recPorCategoria = new Map();
  for (const r of recorrencias || []) {
    if (r.ativa === false || r.tipo !== "despesa") continue;
    const k = r.categoriaId || "sem-categoria";
    recPorCategoria.set(k, (recPorCategoria.get(k) || 0) + (Number(r.valorEstimadoCentavos) || 0));
  }
  let total = 0;
  for (const [k, soma] of porCategoria) total += Math.max(0, Math.round(soma / mesesLidos) - (recPorCategoria.get(k) || 0));
  return total;
}

/** Quanto o cartão realmente gasta por mês: média das últimas 3 faturas já fechadas com valor (compras
 * detalhadas, ou o que foi pago quando a fatura veio sem detalhe). Com menos de 2 faturas, vale o uso
 * informado no cadastro. */
export function usoMensalDoCartao(cartao, { transacoes, faturas, competenciaHoje }) {
  const informado = Number(cartao.usoMensalCentavos) || 0;
  const totais = [];
  const doCartao = (faturas || []).filter((f) => f.cartaoId === cartao.id && f.competencia < competenciaHoje).sort((a, b) => b.competencia.localeCompare(a.competencia));
  for (const f of doCartao) {
    const compras = (transacoes || []).filter((t) => t.faturaId === f.id && t.tipo === "despesa" && t.status !== "cancelado").reduce((x, t) => x + (Number(t.valorCentavos) || 0), 0);
    const pagos = (transacoes || []).filter((t) => t.faturaId === f.id && t.tipo === "pagamento_fatura" && t.status === "pago").reduce((x, t) => x + (Number(t.valorCentavos) || 0), 0);
    const total = compras > 0 ? compras : pagos;
    if (total > 0) totais.push(total);
    if (totais.length === 3) break;
  }
  if (totais.length >= 2) return { valorCentavos: Math.round(totais.reduce((a, b) => a + b, 0) / totais.length), baseadoEmMeses: totais.length, origem: "faturas" };
  // Uso informado igual ao limite (ou acima) sem nenhuma fatura que mostre isso é o limite copiado no
  // campo errado, não uso de verdade: projetaria 100% do limite todo mês. Vale só o que já está lançado.
  const limite = Number(cartao.limiteTotalCentavos) || 0;
  if (limite > 0 && informado >= limite) return { valorCentavos: 0, baseadoEmMeses: 0, origem: "cadastro igual ao limite (ignorado)" };
  return { valorCentavos: informado, baseadoEmMeses: 0, origem: "cadastro" };
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
 * Com 3 ou mais meses fechados de história, vale o que ela PAGOU, não o que foi combinado:
 *   fixa em dia      -> o menor mês real (nunca acima do cadastrado), provável;
 *   irregular/caiu   -> a média real (dos 3 últimos meses se caiu), incerta: não entra no saldo seguro.
 * Variável: o PIOR dos últimos meses fechados em que pagou (piso real, provável).
 * Sem história suficiente: fixa/recorrente pelo valor esperado (provável), variável sem nada como
 * incerta. Eventual: nunca projeta. `baseadoEmMeses` diz em quantos meses reais o número se apoia. */
function valorDaFonte(fonte, receitasDaFonte, competenciaHoje) {
  const esperado = Number(fonte.valorEsperadoCentavos) || 0;
  if (fonte.tipo === "fixa" || fonte.tipo === "recorrente") {
    const leitura = leituraDaFonte(receitasDaFonte, competenciaHoje);
    if (leitura && leitura.meses >= MESES_MINIMOS_HISTORICO) {
      if (leitura.selo === "fixa") return { valorCentavos: esperado > 0 ? Math.min(esperado, leitura.pisoCentavos) : leitura.pisoCentavos, certeza: "provavel", baseadoEmMeses: leitura.meses, selo: "fixa" };
      if (leitura.selo === "irregular" || leitura.selo === "caiu") {
        const v = leitura.selo === "caiu" ? leitura.mediaUltimosTresCentavos : leitura.mediaCentavos;
        return v > 0 ? { valorCentavos: v, certeza: "incerto", baseadoEmMeses: leitura.meses, selo: leitura.selo } : null;
      }
    }
    return esperado > 0 ? { valorCentavos: esperado, certeza: "provavel" } : null;
  }
  if (fonte.tipo !== "variavel") return null;
  const porMes = new Map();
  for (const t of receitasDaFonte) {
    if (t.status !== "pago" || t.competencia >= competenciaHoje) continue;
    porMes.set(t.competencia, (porMes.get(t.competencia) || 0) + (Number(t.valorCentavos) || 0));
  }
  const recentes = [...porMes.entries()].sort((a, b) => b[0].localeCompare(a[0])).slice(0, MESES_PISO_VARIAVEL).map(([, v]) => v).filter((v) => v > 0);
  if (recentes.length) return { valorCentavos: Math.min(...recentes), certeza: "provavel", piso: true, baseadoEmMeses: recentes.length };
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
export function eventosFuturos({ transacoes, dividas, recorrencias, fontesRenda, cartoes, faturas, de, ate, hoje, gastoDiaADiaMensalCentavos = 0 }) {
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
      if (jaLancadoSemVinculo({ tipo: "receita", valorCentavos: valor.valorCentavos, nomes: [f.nome], contaId: f.contaId, competencia: c, tolerancia: 0.15 }, lista, "fonteRendaId")) continue;
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
        descricao: valor.piso ? `${f.nome} (pior mês recente)` : valor.selo === "fixa" && valor.valorCentavos < (Number(f.valorEsperadoCentavos) || 0) ? `${f.nome} (menor mês real)` : valor.certeza === "incerto" && valor.selo ? `${f.nome} (média real, não é garantido)` : f.nome,
        baseadoEmMeses: valor.baseadoEmMeses || 0,
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
      // Conta e parcela NÃO casam sozinhas por nome e valor: no dado real isso juntava o Vivo de setembro
      // pago em 02/10 com o de outubro, e a Brena do Gedi com a do Del Poente. Só renda casa (abaixo).
      const dataLancamento = dataDeCompetencia(c, r.diaBase);
      // Mês que já passou sem o lançamento gerado não vira cobrança
      // retroativa: só projeta daqui pra frente.
      if (dataLancamento < (hoje || de)) continue;
      if (r.semDia && r.tipo === "despesa" && !cartao) {
        // Verba de um mês futuro ainda não gerada: repartida nas semanas do mês, como a verba lançada.
        for (const parte of repartirVerba({ competencia: c }, de, valor)) {
          if (parte.data > ate) continue;
          eventos.push({ data: parte.data, tipo: "despesa", valorCentavos: parte.valorCentavos, certeza: "provavel", virtual: true, semDia: true, descricao: r.descricao, origem: { tipo: "recorrencia", id: r.id } });
        }
        continue;
      }
      const data = cartao && r.tipo === "despesa" ? dataVencimentoFatura(cartao, competenciaFatura(cartao, dataLancamento)) : dataLancamento;
      if (data < de || data > ate) continue;
      eventos.push({
        data, tipo: r.tipo === "receita" ? "receita" : "despesa", valorCentavos: valor, certeza: "provavel", virtual: true,
        descricao: cartao ? `${r.descricao} (no ${cartao.apelido || "cartão"})` : r.descricao,
        origem: { tipo: "recorrencia", id: r.id },
      });
    }
  }

  // Uso habitual do cartão: quem paga a fatura quase no limite todo mês não pode ter
  // a conta do cartão "sumindo" depois dos meses já lançados. Para cada fatura que
  // ainda não fechou, o que falta entre o uso habitual e o que já está nela vira uma
  // saída estimada no dia em que a fatura costuma sair da conta. É estimativa
  // (certeza provável), nunca dinheiro garantido, e não duplica o que já foi lançado.
  for (const cartao of cartoes || []) {
    const uso = usoMensalDoCartao(cartao, { transacoes: lista, faturas, competenciaHoje }).valorCentavos;
    if (!(uso > 0) || cartao.status === "encerrado") continue;
    for (const c of competenciasEntre(somarMeses(competenciaDeData(de), -1), somarMeses(competenciaDeData(ate), 1))) {
      if (dataDeCompetencia(c, cartao.diaFechamento || 1) < (hoje || de)) continue; // já fechou: vale o que está lançado
      const fatura = (faturas || []).find((f) => f.cartaoId === cartao.id && f.competencia === c);
      if (fatura?.status === "paga") continue;
      const jaNaFatura = fatura
        ? lista.filter((t) => t.faturaId === fatura.id && t.tipo === "despesa" && t.status !== "cancelado").reduce((s, t) => s + (Number(t.valorCentavos) || 0), 0)
        : 0;
      const falta = uso - jaNaFatura;
      if (falta <= 0) continue;
      const data = dataPagamentoPrevisto(cartao, c);
      if (data < de || data > ate) continue;
      eventos.push({
        data, vencimento: dataVencimentoFatura(cartao, c), tipo: "despesa", valorCentavos: falta, certeza: "provavel", virtual: true, estimativa: true,
        descricao: `Uso habitual do ${cartao.apelido || "cartão"} (ainda vai entrar na fatura)`,
        origem: { tipo: "cartaoUso", id: cartao.id }, cartaoId: cartao.id,
      });
    }
  }

  // Gasto do dia a dia estimado, em quatro parcelas semanais por mês. Só
  // quem pede (projeção longa) passa o valor: o "posso gastar" de 30 dias
  // é justamente o orçamento desse gasto, não pode descontá-lo de novo.
  if (gastoDiaADiaMensalCentavos > 0) {
    // Partes inteiras que somam exatamente o mês (o resto de centavos vai na primeira semana).
    const porSemana = Math.floor(gastoDiaADiaMensalCentavos / DIAS_DO_GASTO_SEMANAL.length);
    const sobra = gastoDiaADiaMensalCentavos - porSemana * DIAS_DO_GASTO_SEMANAL.length;
    for (const c of comps) {
      for (const dia of DIAS_DO_GASTO_SEMANAL) {
        const data = dataDeCompetencia(c, dia);
        if (data < de || data > ate) continue;
        eventos.push({
          data, tipo: "despesa", valorCentavos: porSemana + (dia === DIAS_DO_GASTO_SEMANAL[0] ? sobra : 0), certeza: "provavel", virtual: true,
          descricao: "Gasto do dia a dia (média dos últimos meses)",
          origem: { tipo: "gastoMedio", id: c },
        });
      }
    }
  }

  return eventos.sort((a, b) => a.data.localeCompare(b.data));
}
