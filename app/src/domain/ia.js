// Assistente de IA (§20): camada de interpretação sobre dados já calculados.
// Este arquivo é puro: monta (1) o retrato compacto que a IA pode ler, com
// cada fonte identificada, e (2) as instruções. A IA nunca recebe permissão
// de escrever: não existe nenhuma ferramenta de gravação. Respostas devem
// citar as fontes ("Dados usados"), e o que não está no retrato é "não sei".

import { formatarBRL } from "./dinheiro.js";
import { calcularSaldoAtual, parcelasRestantes, statusDivida, classificarDivida } from "./dividas.js";
import { perfilParaIA, instrucoesDoPerfil } from "./perfil.js";

const R = (c) => formatarBRL(Number(c) || 0);

/** Retrato compacto, em linhas "[fonte] texto", pronto para o prompt e para
 * a tela "Dados usados". `p` junta os painéis já calculados. */
export function montarRetratoParaIA({ hoje, inicio, geral, fechamento, dividas, fontesRenda, achados, ativos, perfil }) {
  // O perfil vai primeiro: se o retrato passar do limite, o que é cortado são as últimas linhas, nunca quem a pessoa é.
  const linhas = [...perfilParaIA(perfil, hoje)];
  const add = (fonte, texto) => linhas.push({ fonte, texto });
  const c = inicio?.caixa;
  if (c) {
    if (inicio.contasMes?.resumo?.quantidade) {
      const r = inicio.contasMes.resumo;
      add("Contas do mês", `${r.quantidadePagas} de ${r.quantidade} contas pagas (${R(r.pagoCentavos)} de ${R(r.totalCentavos)}); faltam ${R(r.faltaCentavos)}${r.quantidadeAtrasadas ? `; ${r.quantidadeAtrasadas} atrasada(s) (${R(r.atrasadasCentavos)}): ${inicio.contasMes.atrasadas.map((i) => i.descricao).join(", ")}` : "; nada atrasado"}.`);
    }
    add("Início", `Hoje é ${hoje}. Em conta (sem a reserva): ${R(c.saldoAtualCentavos)}. Vai entrar nos próximos ${inicio.horizonteDias} dias (confirmado e provável): ${R(c.entradasPrevistasCentavos)}. Vai sair: ${R(c.comprometidoCentavos)}. Pode gastar até ${c.horizonteAte}: ${R(c.seguroParaGastarCentavos)} (é o ponto mais baixo do saldo${c.diaMaisApertado ? `, em ${c.diaMaisApertado}` : ""}).`);
    const f = inicio.confianca;
    add("Início", `Confiança do número: ${f.nivel}. ${f.frase}${f.esperadoCentavos ? ` Ainda esperado, não recebido: ${R(f.esperadoCentavos)} de ${R(f.totalCentavos)}.` : ""}`);
    for (const i of (inicio.proximos || []).slice(0, 10)) add("Próximos 7 dias", `${i.atrasado ? "ATRASADO " : ""}${i.data}: ${i.descricao} ${i.tipo === "entrada" ? "+" : "-"}${R(i.valorCentavos)}${i.certeza && i.certeza !== "confirmado" ? ` (${i.certeza})` : ""}`);
    for (const r of (inicio.retrato || []).slice(0, 6)) add("Cadastro incompleto", r.texto);
  }
  if (geral?.baseReal?.frase) add("Plano · Base real", geral.baseReal.frase);
  const a = geral?.agora;
  if (a) {
    add("Plano · Onde você está", `Mês atual: recebido ${R(a.rendaConfirmadaCentavos)}, esperado ${R(a.rendaProvavelCentavos)}${a.rendaIncertaCentavos ? `, incerto (fora da conta) ${R(a.rendaIncertaCentavos)}` : ""}; gastos do mês ${R(a.gastoCentavos)}; parcelas de dívida ${R(a.parcelasCentavos)}; ${a.sobraCentavos < 0 ? "FALTA" : "sobra"} no mês ${R(Math.abs(a.sobraCentavos))}.`);
    add("Plano · Pra onde você vai", (geral.futuro || []).map((h) => `${h.rotulo}: saldo ${R(h.saldoFinalSeguroCentavos)}${h.saidaCritica ? ` (aperta em ${h.saidaCritica.data})` : ""}`).join("; "));
    const m = geral.mapa;
    if (m) {
      for (const l of m.linhas.slice(0, 12)) add("Plano · Próximos meses", `${l.competencia}${l.atual ? " (só o resto do mês)" : ""}: sobra ${R(l.sobraCentavos)}, termina com ${R(l.saldoFimCentavos)} em conta${l.marcos.length ? `; muda: ${l.marcos.map((x) => `${x.texto} (${R(x.valorCentavos)})`).join(", ")}` : ""}.`);
      if (m.semDiaADia) add("Plano · Próximos meses", "Atenção: ainda não há histórico de gasto do dia a dia (mercado, lazer); os meses futuros estão mais folgados que a vida real.");
      if (m.buraco?.mesDaVirada) add("Plano · Próximos meses", `Em ${m.buraco.mesDaVirada} o mês deixa de se pagar: faltam ${R(m.buraco.deficitMensalCentavos)} por mês.`);
    }
    for (const l of geral.alavancas || []) add("Plano · Alavancas", `${l.titulo}: +${R(l.impactoMensalCentavos)}/mês. ${l.premissa}`);
  }
  for (const f of fontesRenda || []) {
    if (f.ativa === false) continue;
    add("Renda", `${f.nome} (${f.tipo}): ${R(f.valorEsperadoCentavos)}${f.diaRecebimento ? `, dia ${f.diaRecebimento}` : ""}${f.fim ? `, só até ${f.fim}` : ""}`);
  }
  for (const d of (dividas || []).filter((x) => statusDivida(x, hoje) !== "quitada").slice(0, 12)) {
    const fin = classificarDivida(d, hoje) === "financiamento";
    add(fin ? "Financiamentos em dia" : "Dívidas", fin
      ? `${d.nome}${d.credor ? ` (${d.credor})` : ""}: parcela ${R(d.valorParcelaCentavos)}/mês, ${parcelasRestantes(d)} parcelas restantes (soma ${R(calcularSaldoAtual(d))}); pago em dia, não é dívida atrasada`
      : `${d.nome}${d.credor ? ` (${d.credor})` : ""}: deve ${R(calcularSaldoAtual(d))}; parcela ${R(d.valorParcelaCentavos)}; ${parcelasRestantes(d)} parcelas restantes${d.negativada ? "; negativada" : ""}${d.emRisco ? "; em risco" : ""}`);
  }
  for (const x of (ativos || []).slice(0, 8)) add("Bens", `${x.nome}: ${R(x.valorAtualCentavos)}`);
  if (!(ativos || []).length) add("Bens", "Nenhum bem cadastrado: o patrimônio mostrado só tem as dívidas.");
  const fe = fechamento;
  if (fe) {
    add("Fechamento", `${fe.competencia} (${fe.situacao}): entrou ${R(fe.atual.receitaCentavos)}, saiu ${R(fe.atual.despesaCentavos)}, resultado ${R(fe.atual.resultadoCentavos)}${fe.mesAnterior ? `; mês anterior ${R(fe.mesAnterior.resultadoCentavos)}` : "; sem mês anterior para comparar"}.`);
    for (const m of fe.mudancas || []) add("Fechamento", `Gasto em ${m.nome}: ${R(m.anteriorCentavos)} -> ${R(m.atualCentavos)}`);
  }
  for (const x of (achados || []).slice(0, 8)) add("Alertas do Plano", `[${x.urgencia}] ${x.titulo}. Sugestão: ${x.acaoSugerida || "-"}`);
  return limitarRetrato(linhas);
}

export const LIMITE_RETRATO_CARACTERES = 12000;

/** O prompt tem teto: se o retrato passar dele, as últimas linhas (as de
 * menor prioridade) saem, e a última linha avisa que houve corte, pra IA
 * dizer "não tenho esse dado" em vez de inventar. */
export function limitarRetrato(linhas, limite = LIMITE_RETRATO_CARACTERES) {
  let total = 0;
  const saida = [];
  for (const l of linhas) {
    total += l.fonte.length + l.texto.length + 4;
    if (total > limite) {
      saida.push({ fonte: "Aviso", texto: "Os dados foram cortados por ser grande: parte dos dados não está aqui. Diga que não tem esse dado em vez de supor." });
      break;
    }
    saida.push(l);
  }
  return saida;
}

export const INSTRUCOES_IA = `Você é o assistente do painel financeiro de uma família brasileira. Fale em português do Brasil, simples, sem jargão, como a um amigo que não entende de finanças. Regras:
1. Use SOMENTE os números e fatos da seção DADOS. Se a resposta não está lá, diga "não tenho esse dado" e diga qual cadastro falta. Nunca invente valor, data ou taxa.
2. Dinheiro "esperado" ou "incerto" nunca é dinheiro garantido: diga isso quando falar dele.
3. Transferência entre contas próprias não é gasto; compra no cartão e pagamento da fatura não se somam.
4. Não recomende investimento, empréstimo, crédito nem produto financeiro. Sugira apenas ações sobre o que já existe nos dados (renegociar, cortar um gasto, cobrar um recebimento, cadastrar um dado que falta).
5. Você só lê. Não diga que alterou algo e não peça para alterar dados; se algo precisa mudar, diga onde a pessoa faz isso no painel.
6. Seja curto (até 220 palavras), com no máximo 4 tópicos. Termine com uma linha "Baseado em:" listando as fontes dos DADOS que você usou (ex.: Início, Dívidas, Plano · Alavancas).`;

/** Monta as "turns" para sample(): instruções + dados + conversa até aqui. */
export function montarTurnos({ retrato, historico, pergunta }) {
  const dados = retrato.map((l) => `[${l.fonte}] ${l.texto}`).join("\n");
  const extra = retrato.some((l) => l.fonte.startsWith("Perfil")) ? instrucoesDoPerfil(true) : "";
  const base = `${INSTRUCOES_IA}${extra}\n\nDADOS (números atuais do painel, calculado agora):\n${dados}`;
  const recente = (historico || []).slice(-6);
  const turnos = [{ role: "user", content: base }];
  if (recente.length) turnos.push({ role: "assistant", content: "Entendi as regras e li os dados. Pode perguntar." });
  for (const t of recente) turnos.push({ role: t.role, content: t.content });
  turnos.push({ role: "user", content: pergunta });
  return turnos;
}

export const PERGUNTAS_SUGERIDAS = [
  "Qual o tamanho do meu buraco e como eu saio dele?",
  "Explique meu mês em poucas palavras.",
  "Posso gastar R$ 500 num fim de semana sem faltar dinheiro?",
  "O que eu preciso cobrar ou receber esta semana?",
  "Qual dívida eu devo atacar primeiro e por quê?",
  "Por que o painel mostra esses alertas?",
];
