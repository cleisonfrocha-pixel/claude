// O plano em passos: o que fazer, em que ordem, com que valor e por quê. Puro (CLAUDE.md): só junta o que os
// outros motores já calculam (situação de caixa, mapa dos 12 meses, ofertas de dívida, prazos do perfil) numa
// lista ordenada por urgência. Cada passo aponta a tela onde se resolve. Nada é gravado.

import { formatarBRL } from "./dinheiro.js";
import { formatarData } from "./tempo.js";

const BRL = (v) => formatarBRL(v);
const dm = (d) => formatarData(d).slice(0, 5);
const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const nomeMes = (c) => MESES[Number(c.slice(5, 7)) - 1];
const diasEntre = (a, b) => Math.round((new Date(`${b}T12:00:00Z`) - new Date(`${a}T12:00:00Z`)) / 86400000);

/** @returns {{ veredito: {tom, titulo, texto}, passos: Array<{id, prazo, tom, titulo, texto, valorCentavos?, destino, detalhes?: string[]}> }} */
export function montarPlanoDeAcao({ situacao, mapa, panorama, prazos = [], alavancas = [], reservaCentavos = 0, custoEssencialMesCentavos = 0, hoje }) {
  const passos = [];
  const buraco = situacao?.buraco || null;
  const atrasadas = situacao?.comprometido?.grupos?.atrasado || { totalCentavos: 0, itens: [] };

  // 1. O curto prazo: falta dinheiro antes da próxima entrada.
  if (buraco) {
    const dias = diasEntre(hoje, buraco.data);
    passos.push({
      id: "caixa-curto", prazo: dias <= 7 ? "Esta semana" : "Este mês", tom: "urgente",
      titulo: `Em ${dm(buraco.data)} faltam ${BRL(buraco.faltaCentavos)}`,
      texto: situacao.decisao?.texto || "", valorCentavos: buraco.faltaCentavos,
      detalhes: (buraco.causas || []).slice(0, 3).map((c) => `${c.descricao}: ${BRL(c.valorCentavos)}`),
      destino: { modulo: "dinheiro", aba: "apagar" },
    });
  }

  // 2. O que já está atrasado.
  if (atrasadas.totalCentavos > 0) {
    passos.push({
      id: "atrasadas", prazo: "Agora", tom: "urgente",
      titulo: `Resolver o que está atrasado (${BRL(atrasadas.totalCentavos)})`,
      texto: "Atraso cobra juros e multa e pesa no nome. Pague ou negocie estes primeiro.",
      valorCentavos: atrasadas.totalCentavos,
      detalhes: atrasadas.itens.slice(0, 4).map((i) => `${i.descricao}: ${BRL(i.valorCentavos)}`),
      destino: { modulo: "dinheiro", aba: "apagar" },
    });
  }

  // 3. A virada: o mês em que a conta deixa de fechar.
  const b = mapa?.buraco;
  const virada = b?.mesDaVirada ? mapa.linhas.find((l) => l.competencia === b.mesDaVirada) : null;
  if (virada) {
    const antes = mapa.linhas[mapa.linhas.indexOf(virada) - 1];
    passos.push({
      id: "virada", prazo: `Até ${antes ? nomeMes(antes.competencia) : "lá"}`, tom: "atencao",
      titulo: `${nomeMes(virada.competencia)[0].toUpperCase()}${nomeMes(virada.competencia).slice(1)} é a virada: o mês deixa de se pagar`,
      texto: `${antes ? `A sobra vai de ${BRL(antes.sobraCentavos)} para ${BRL(virada.sobraCentavos)}. ` : ""}Faltam ${BRL(b.deficitMensalCentavos)} por mês. Para fechar: entrar esse valor a mais, cortar o mesmo, ou juntar antes o que falta.`,
      valorCentavos: b.deficitMensalCentavos,
      detalhes: [
        ...virada.marcos.slice(0, 3).map((m) => `${m.texto}: ${BRL(m.valorCentavos)}`),
        ...alavancas.slice(0, 3).map((a) => `${a.titulo}: +${BRL(a.impactoMensalCentavos)}/mês`),
      ],
      destino: { modulo: "plano", aba: "caminhos" },
    });
  } else if (b && b.faltaParaAguentarCentavos > 0) {
    passos.push({
      id: "negativo", prazo: "Neste ano", tom: "atencao",
      titulo: `O saldo fica negativo em ${nomeMes(b.mesDoPontoMaisBaixo)}`,
      texto: `Ponto mais baixo: ${BRL(b.pontoMaisBaixoCentavos)}. Faltam ${BRL(b.faltaParaAguentarCentavos)} para atravessar os 12 meses.`,
      valorCentavos: b.faltaParaAguentarCentavos, destino: { modulo: "plano", aba: "caminhos" },
    });
  }

  // 4. Limpar o nome: ofertas, da que mais compensa para a que menos.
  const ofertas = panorama?.ofertas || [];
  if (ofertas.length) {
    const livre = situacao?.livreGarantidoCentavos ?? 0;
    const menor = Math.min(...ofertas.map((o) => o.valorCentavos));
    passos.push({
      id: "nome", prazo: "Quando houver caixa", tom: "normal",
      titulo: `Limpar o nome: ${ofertas.length} ${ofertas.length === 1 ? "oferta" : "ofertas"} na mesa`,
      texto: livre >= menor
        ? `Dá para fechar a primeira agora (${BRL(ofertas[0].valorCentavos)}). Fechar todas custa ${BRL(panorama.totalOfertasCentavos)} e economiza ${BRL(panorama.economiaCentavos)}.`
        : `Hoje o livre garantido é ${BRL(livre)}, menos que a menor oferta (${BRL(menor)}). Fechar todas custa ${BRL(panorama.totalOfertasCentavos)} e economiza ${BRL(panorama.economiaCentavos)}: separe um valor por mês para isso.`,
      valorCentavos: panorama.totalOfertasCentavos,
      detalhes: ofertas.slice(0, 4).map((o) => `${o.credor || o.nome}: ${BRL(o.valorCentavos)} (−${o.descontoPct}%)`),
      destino: { modulo: "dividas" },
    });
  }

  // 5. Prazos do perfil que mudam o plano.
  for (const p of prazos) {
    if (p.diasAte < 0) continue;
    passos.push({
      id: `prazo:${p.id || p.data}`, prazo: p.diasAte === 0 ? "Hoje" : `Em ${p.diasAte} ${p.diasAte === 1 ? "dia" : "dias"} (${dm(p.data)})`,
      tom: p.diasAte <= 30 ? "atencao" : "normal", titulo: p.titulo, texto: p.nota || "", destino: { modulo: "plano", aba: "caminhos" },
    });
  }

  // 6. Reserva: só quando nada acima grita.
  if (reservaCentavos <= 0 && custoEssencialMesCentavos > 0 && !buraco) {
    passos.push({
      id: "reserva", prazo: "Quando sobrar", tom: "normal", titulo: "Começar a reserva",
      texto: `Hoje não há reserva. A primeira meta é um mês de essencial: ${BRL(custoEssencialMesCentavos)}.`,
      valorCentavos: custoEssencialMesCentavos, destino: { modulo: "plano", aba: "patrimonio" },
    });
  }

  const ordemTom = { urgente: 0, atencao: 1, normal: 2 };
  passos.sort((a, b2) => (ordemTom[a.tom] ?? 3) - (ordemTom[b2.tom] ?? 3));

  const ultimo = mapa?.linhas?.[mapa.linhas.length - 1];
  const fim = ultimo ? `No ritmo de hoje, o saldo termina os próximos 12 meses em ${BRL(ultimo.saldoFimCentavos)}${b ? ` (ponto mais baixo ${BRL(b.pontoMaisBaixoCentavos)} em ${nomeMes(b.mesDoPontoMaisBaixo)})` : ""}.` : "";
  let veredito;
  if (buraco) veredito = { tom: "urgente", titulo: "Primeiro o curto prazo: o caixa aperta antes da próxima entrada", texto: fim };
  else if (virada) veredito = { tom: "atencao", titulo: `Hoje fecha, mas ${nomeMes(virada.competencia)} muda o jogo`, texto: fim };
  else if (b && b.faltaParaAguentarCentavos > 0) veredito = { tom: "atencao", titulo: "O saldo não aguenta os 12 meses sem ajuste", texto: fim };
  else veredito = { tom: "bom", titulo: "O plano fecha nos próximos 12 meses", texto: fim };
  return { veredito, passos };
}
