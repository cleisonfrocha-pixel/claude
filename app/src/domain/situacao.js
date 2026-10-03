// Leitura de situação: transforma a trilha de caixa em respostas simples.
// "Quanto tenho na conta, quanto já tem dono, quanto está livre, e dá pra
// confiar?" Puro (CLAUDE.md): nada é gravado, tudo sai dos mesmos itens da
// trilha, e cada grupo carrega os itens que o formam (§9 e §17 do blueprint).

import { calcularClarezaDeCaixa } from "./caixa.js";
import { formatarBRL } from "./dinheiro.js";
import { formatarData } from "./tempo.js";

export const GRUPOS = ["atrasado", "cartao", "parcelas", "essencial", "outros"];
export const ROTULO_GRUPO = { atrasado: "Atrasado", cartao: "Faturas de cartão", parcelas: "Parcelas e dívidas", essencial: "Essencial", outros: "Outras contas" };

/** Zona do caixa, pelo menor ponto que o saldo toca no horizonte, comparado ao
 * que a pessoa já tem que pagar num mês (obrigações). Cortes explícitos:
 * negativo ou abaixo de meio mês de obrigações = risco; até um mês = apertado;
 * a partir de um mês = confortável. */
export const CORTE_RISCO = 0.5;
export const CORTE_CONFORTO = 1;

export function zonaDoCaixa(menorPontoCentavos, obrigacoesMensaisCentavos) {
  const obr = Math.max(0, obrigacoesMensaisCentavos || 0);
  if (menorPontoCentavos < 0) return "risco";
  if (obr === 0) return "confortavel";
  if (menorPontoCentavos < obr * CORTE_RISCO) return "risco";
  if (menorPontoCentavos < obr * CORTE_CONFORTO) return "apertado";
  return "confortavel";
}

export const ROTULO_ZONA = { confortavel: "Confortável", apertado: "Apertado", risco: "Zona de risco" };

function grupoDe(c, categoriaPorId) {
  if (c.atrasado) return "atrasado";
  if (c.tipo === "fatura") return "cartao";
  if (c.tipo === "parcela") return "parcelas";
  const cat = categoriaPorId.get(c.categoriaId);
  if (cat && (cat.essencial || cat.grupo === "dividas")) return cat.grupo === "dividas" ? "parcelas" : "essencial";
  return "outros";
}

/**
 * @returns {{
 *  naContaCentavos, reservaCentavos,
 *  ate: {data, descricao, valorCentavos, certeza}|null,   // próxima entrada confirmada ou provável
 *  comprometido: {totalCentavos, grupos: Record<string,{totalCentavos, itens}>},
 *  livreGarantidoCentavos, livreProvavelCentavos,         // até a próxima entrada
 *  menorPontoCentavos, diaMaisApertado,                    // no horizonte todo
 *  obrigacoesMensaisCentavos, zona, buraco, decisao
 * }}
 */
export function lerSituacao({ contas, transacoes, faturas, cartoes, dividas, recorrencias, fontesRenda, categorias, hoje, horizonteDias = 30 }) {
  const base = { contas, transacoes, faturas, cartoes, dividas, recorrencias, fontesRenda, hoje, horizonteDias };
  const provavel = calcularClarezaDeCaixa(base);
  const garantido = calcularClarezaDeCaixa({ ...base, soConfirmado: true });
  const categoriaPorId = new Map((categorias || []).map((c) => [c.id, c]));

  // O que já tem dono: as saídas até o dia em que o dinheiro volta a entrar.
  // Sem entrada à vista, o horizonte inteiro.
  const reposicao = provavel.proximaEntrada?.data || null;
  const grupos = Object.fromEntries(GRUPOS.map((g) => [g, { totalCentavos: 0, itens: [] }]));
  for (const c of provavel.detalhes.compromissos) {
    if (reposicao && c.data >= reposicao) continue;
    const g = grupoDe(c, categoriaPorId);
    grupos[g].totalCentavos += c.valorCentavos;
    grupos[g].itens.push(c);
  }
  for (const g of GRUPOS) grupos[g].itens.sort((a, b) => b.valorCentavos - a.valorCentavos);
  const totalCentavos = GRUPOS.reduce((s, g) => s + grupos[g].totalCentavos, 0);

  // Obrigações de um mês: o que não dá pra escolher não pagar (tudo menos "outras contas").
  const obrigacoesMensaisCentavos = provavel.detalhes.compromissos.reduce((s, c) => (grupoDe(c, categoriaPorId) === "outros" ? s : s + c.valorCentavos), 0);

  const menorPontoCentavos = provavel.seguroParaGastarCentavos;
  const zona = zonaDoCaixa(menorPontoCentavos, obrigacoesMensaisCentavos);
  const buraco = provavel.primeiroBuraco;

  return {
    naContaCentavos: provavel.saldoAtualCentavos,
    reservaCentavos: provavel.saldoReservaCentavos,
    ate: provavel.proximaEntrada,
    comprometido: { totalCentavos, grupos },
    livreProvavelCentavos: provavel.seguroAteAProximaEntradaCentavos,
    livreGarantidoCentavos: garantido.seguroAteAProximaEntradaCentavos,
    garantidoAteEntradaConfirmada: garantido.proximaEntrada,
    menorPontoCentavos, menorPontoGarantidoCentavos: garantido.seguroParaGastarCentavos,
    diaMaisApertado: provavel.diaMaisApertado,
    obrigacoesMensaisCentavos, zona, buraco,
    decisao: proximaDecisao({ provavel, grupos, zona, buraco, livre: provavel.seguroAteAProximaEntradaCentavos }),
  };
}

const BRL = (v) => formatarBRL(v);
const dm = (d) => formatarData(d).slice(0, 5);

/** Uma frase só: a próxima decisão que faz sentido, com os dados que a sustentam. */
export function proximaDecisao({ provavel, grupos, zona, buraco, livre }) {
  if (buraco) {
    const maior = buraco.causas[0];
    const adiavel = [...grupos.outros.itens, ...grupos.essencial.itens].find((i) => !i.atrasado && i.data <= buraco.data);
    const entrada = provavel.detalhes.entradas.find((e) => e.data > buraco.data);
    const partes = [`Em ${dm(buraco.data)} faltam ${BRL(buraco.faltaCentavos)}${maior ? ` (pesa ${maior.descricao}, ${BRL(maior.valorCentavos)})` : ""}.`];
    if (entrada) partes.push(`A próxima entrada, ${entrada.descricao || "entrada"} de ${BRL(entrada.valorCentavos)}, só cai em ${dm(entrada.data)}.`);
    partes.push(adiavel ? `Dá para adiar ${adiavel.descricao} (${BRL(adiavel.valorCentavos)}) ou antecipar uma entrada.` : "Antecipe uma entrada ou renegocie o vencimento mais pesado.");
    return { tipo: "buraco", texto: partes.join(" "), dataCritica: buraco.data, origem: buraco.causas.map((c) => c.origem).filter(Boolean) };
  }
  const atrasadas = grupos.atrasado;
  if (atrasadas.itens.length) {
    return { tipo: "atrasadas", texto: `Pague primeiro o que está atrasado (${BRL(atrasadas.totalCentavos)}): ${atrasadas.itens.slice(0, 3).map((i) => i.descricao).join(", ")}. Cabe no caixa.`, origem: atrasadas.itens.map((i) => i.origem).filter(Boolean) };
  }
  if (zona === "apertado") return { tipo: "apertado", texto: `Cabe, mas com pouca folga. Pode gastar até ${BRL(livre)} até a próxima entrada sem faltar.`, origem: [] };
  return { tipo: "livre", texto: `Você pode gastar até ${BRL(livre)} até a próxima entrada sem faltar dinheiro em dia nenhum.`, origem: [] };
}
