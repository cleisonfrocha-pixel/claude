// Aba "A pagar" de Dinheiro: as contas do mês, cada uma com seu estado
// (atrasada, vence hoje, a pagar, paga) e um peso visual diferente. Paguei é
// um toque, com aviso curto e "Desfazer". O progresso do mês é calculado na
// leitura (domain/contasDoMes.js), nunca gravado.

import * as tempo from "../../domain/tempo.js";
import { formatarBRL, paraCentavos } from "../../domain/dinheiro.js";
import { assinarContasDoMes } from "../../dados/contasRepo.js";
import { baixarComPergunta } from "../baixaUI.js";
import { escapeHtml, mostrarToast } from "../utilitarios.js";
import { navegar } from "../navegacao.js";
import * as modal from "../modal.js";
import { barraEvolucao } from "../barraEvolucao.js";
import { avatarMarcaHtml } from "../avatarMarca.js";
import { abrirLancamento, editarLancamento } from "./transacoes.js";
import { ajustarEvento } from "../../dados/baixaRepo.js";
import { carregarBase } from "../../dados/base.js";

const GRUPOS = ["atrasada", "hoje", "a_pagar", "paga"];
const DESTINO_ORIGEM = {
  recorrencia: { modulo: "dinheiro", aba: "recorrencias" },
  divida: { modulo: "dividas" },
  fatura: { modulo: "dinheiro", aba: "cartoes" },
  transacao: { modulo: "dinheiro", aba: "transacoes" },
  cartaoUso: { modulo: "dinheiro", aba: "cartoes" },
};

// "pagar" = contas do mês; "receber" = entradas do mês. Mesma tela, mesmos
// estados (o motor usa o mesmo vocabulário nos dois lados).
let lado = "pagar";
const TEXTOS = {
  pagar: {
    titulo: "A pagar", sub: "Cada conta do mês com o seu estado. Toque em Paguei quando pagar.", botao: "Paguei", selo: "Paga",
    unidade: "contas pagas", feito: "pagos", falta: "faltam", totalRotulo: "Total de contas do mês", jaFeito: "Já pago", atrasadoRotulo: "Atrasado", previstoRotulo: "Ainda a pagar (previsto)", umAtrasado: "conta atrasada", variosAtrasados: "contas atrasadas", umFalta: "conta a vencer", variosFalta: "contas a vencer", vazio: "Nenhuma conta neste mês. Cadastre em Recorrências ou lance uma conta a pagar.",
    grupos: { atrasada: ["Atrasadas", "Pagando estas primeiro, o mês sai do vermelho."], hoje: ["Vencem hoje", ""], a_pagar: ["A pagar", ""], paga: ["Pagas", ""] },
    pronto: (d) => `${d} paga.`,
    adicionar: "+ Adicionar conta a pagar",
    preset: { tipo: "despesa", status: "previsto", titulo: "Adicionar conta a pagar", dica: "Esqueceu uma conta? Coloque o valor e o dia que vence. Ela entra na lista e no caixa.", rotuloData: "Vence em" },
  },
  receber: {
    titulo: "A receber", sub: "O que deve entrar no mês. Toque em Recebi quando o dinheiro cair.", botao: "Recebi", selo: "Recebida",
    unidade: "entradas recebidas", feito: "recebidos", falta: "faltam", totalRotulo: "Total a receber no mês", jaFeito: "Já recebido", atrasadoRotulo: "Ainda não caiu", previstoRotulo: "Ainda vai entrar (previsto)", umAtrasado: "entrada atrasada", variosAtrasados: "entradas atrasadas", umFalta: "entrada a cair", variosFalta: "entradas a cair", vazio: "Nenhuma entrada prevista neste mês. Cadastre em Renda.",
    grupos: { atrasada: ["Ainda não caíram", "Passou do dia esperado. Vale conferir com quem paga."], hoje: ["Caem hoje", ""], a_pagar: ["A receber", ""], paga: ["Recebidas", ""] },
    pronto: (d) => `${d} recebida.`,
    adicionar: "+ Adicionar entrada",
    preset: { tipo: "receita", status: "previsto", titulo: "Adicionar entrada a receber", dica: "Vai cair um dinheiro que não está na lista? Coloque o valor e o dia. Se não for certo, marque como Provável ou Incerto.", rotuloData: "Cai em" },
  },
};
let mesVisivel = tempo.competenciaAtual();
let painel = null;
let parar = null;
let container = null;

export default {
  montar(alvo) {
    container = alvo;
    lado = "pagar";
    mesVisivel = tempo.competenciaAtual();
    assinar();
    renderizar();
  },
  desmontar() {
    if (parar) { parar(); parar = null; }
    container = null;
    painel = null;
  },
};

function assinar() {
  if (parar) parar();
  painel = null;
  parar = assinarContasDoMes(mesVisivel, (r) => { painel = r; renderizar(); });
}

function trocarMes(novo) {
  mesVisivel = novo;
  assinar();
  renderizar();
}

const diaMes = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;

function quando(i, hoje) {
  const rec = lado === "receber";
  if (i.estado === "paga") return i.pagoEm ? `${rec ? "recebida" : "paga"} em ${diaMes(i.pagoEm)}` : (rec ? "recebida" : "paga");
  if (i.semDia && i.totalDaVerbaCentavos > 0) return `verba do mês: gastou ${formatarBRL(i.gastoDaVerbaCentavos || 0)} de ${formatarBRL(i.totalDaVerbaCentavos)}`;
  if (i.semDia || !i.vencimento) return "sem dia fixo, até o fim do mês";
  if (i.estado === "atrasada") return rec ? `esperada dia ${diaMes(i.vencimento)} · não caiu há ${plural(i.diasAtraso, "dia", "dias")}` : `venceu dia ${diaMes(i.vencimento)} · atrasada há ${plural(i.diasAtraso, "dia", "dias")}`;
  if (i.estado === "hoje") return rec ? "cai hoje" : "vence hoje";
  const dias = Math.round((new Date(`${i.vencimento}T12:00:00Z`) - new Date(`${hoje}T12:00:00Z`)) / 86400000);
  return `${rec ? "cai" : "vence"} dia ${diaMes(i.vencimento)} · ${dias === 1 ? "amanhã" : `em ${dias} dias`}${i.incerta ? " · incerta, fora da conta" : ""}`;
}

function cartaoConta(i, hoje) {
  const paga = i.estado === "paga";
  return `
    <div class="conta-card estado-${i.estado}${i.incerta ? " incerta" : ""}" data-chave="${escapeHtml(i.chave)}">
      <span class="conta-marca" aria-hidden="true">${paga ? "✓" : i.estado === "atrasada" ? "!" : ""}</span>
      ${avatarMarcaHtml([i.descricao], { classe: "conta-logo" })}
      <div class="conta-corpo">
        <div class="conta-titulo">${escapeHtml(i.descricao)}</div>
        <div class="conta-sub">${escapeHtml(quando(i, hoje))}</div>
      </div>
      <div class="conta-direita">
        <div class="conta-valor mono" data-valor>${formatarBRL(i.valorCentavos)}</div>
        <div class="conta-acoes">
          ${paga ? `<span class="conta-selo">${TEXTOS[lado].selo}</span>` : i.estimativa ? `<span class="conta-selo">estimativa</span>` : `<button class="btn-mini btn-baixa conta-pagar" data-pagar>${TEXTOS[lado].botao}</button>`}
          <button class="btn-mini conta-mais" data-mais aria-label="Mais opções de ${escapeHtml(i.descricao)}">⋯</button>
        </div>
      </div>
    </div>`;
}

/** "A pagar" é a lista longa: quebra em esta semana, semana que vem, mais pra
 * frente e sem dia fixo, pra dar pra bater o olho. */
function porSemana(lista, hoje) {
  const dias = (i) => Math.round((new Date(`${i.vencimento}T12:00:00Z`) - new Date(`${hoje}T12:00:00Z`)) / 86400000);
  const faixas = [
    ["Esta semana", (i) => i.vencimento && dias(i) <= 7],
    ["Semana que vem", (i) => i.vencimento && dias(i) > 7 && dias(i) <= 14],
    ["Mais pra frente", (i) => i.vencimento && dias(i) > 14],
    ["Sem dia fixo", (i) => !i.vencimento],
  ];
  return faixas.map(([rotulo, ok]) => {
    const sub = lista.filter(ok);
    return sub.length ? `<div class="conta-faixa">${rotulo}</div>${sub.map((i) => cartaoConta(i, hoje)).join("")}` : "";
  }).join("");
}

function mensagemDoMes(r) {
  const { resumo: s } = r;
  const rec = lado === "receber";
  if (!s.quantidade) return rec ? "Nenhuma entrada marcada neste mês." : "Nenhuma conta marcada neste mês.";
  if (s.faltaCentavos === 0) return rec ? "Tudo que era esperado já entrou." : "Mês em dia: tudo pago.";
  if (s.quantidadeAtrasadas) return rec
    ? `${plural(s.quantidadeAtrasadas, "entrada ainda não caiu", "entradas ainda não caíram")} (${formatarBRL(s.atrasadasCentavos)}). Vale conferir.`
    : `${plural(s.quantidadeAtrasadas, "conta atrasada", "contas atrasadas")} (${formatarBRL(s.atrasadasCentavos)}). Comece por elas.`;
  if (s.proxima) return rec ? `Próxima a cair: ${s.proxima.descricao}, dia ${diaMes(s.proxima.vencimento)}.` : `Nada atrasado. Próxima: ${s.proxima.descricao}, dia ${diaMes(s.proxima.vencimento)}.`;
  return rec ? "Nenhuma entrada atrasada." : "Nada atrasado.";
}

function dadosDoLado() {
  return lado === "receber" ? painel.entradas : painel;
}

function renderizar() {
  if (!container) return;
  const T = TEXTOS[lado];
  const cabeca = `<div class="tela-head" style="margin-top:0;"><div><h2 class="tela-titulo">${T.titulo}</h2>
    <p class="tela-sub">${T.sub}</p></div>
    <button class="btn btn-primary btn-adicionar-conta" id="btn-adicionar-conta">${T.adicionar}</button></div>`;
  if (!painel) { container.innerHTML = `${cabeca}<p class="tela-sub">Carregando…</p>`; return; }

  const dados = dadosDoLado();
  const { resumo: s, grupos } = dados;
  const hoje = painel.hoje;
  const classeBarra = s.quantidadeAtrasadas && lado === "pagar" ? "critico" : "";
  const seletor = `
    <div class="lado-seletor" role="tablist">
      <button class="lado-opcao${lado === "pagar" ? " ativo" : ""}" data-lado="pagar" role="tab">A pagar <span>${painel.resumo.quantidade - painel.resumo.quantidadePagas}</span></button>
      <button class="lado-opcao${lado === "receber" ? " ativo" : ""}" data-lado="receber" role="tab">A receber <span>${painel.entradas.resumo.quantidade - painel.entradas.resumo.quantidadePagas}</span></button>
    </div>`;
  container.innerHTML = `
    ${seletor}
    ${cabeca}
    <div class="mes-nav">
      <button class="icon-btn" id="mes-prev" aria-label="Mês anterior">‹</button>
      <div class="mes-nav-label">${escapeHtml(tempo.competenciaLabel(mesVisivel))}</div>
      <button class="icon-btn" id="mes-next" aria-label="Próximo mês">›</button>
    </div>

    <div class="mes-progresso">
      ${barraEvolucao({
        totalRotulo: T.totalRotulo, totalCentavos: s.pagoCentavos + s.faltaCentavos,
        segmentos: [
          { tipo: "pago", rotulo: T.jaFeito, centavos: s.pagoCentavos, detalhe: `${s.quantidadePagas} de ${s.quantidade} ${T.unidade}` },
          ...(s.atrasadasCentavos > 0 ? [{ tipo: "atrasado", rotulo: T.atrasadoRotulo, centavos: s.atrasadasCentavos, detalhe: plural(s.quantidadeAtrasadas, T.umAtrasado, T.variosAtrasados) }] : []),
          { tipo: "previsto", rotulo: T.previstoRotulo, centavos: Math.max(0, s.faltaCentavos - s.atrasadasCentavos), detalhe: plural(Math.max(0, s.quantidade - s.quantidadePagas - s.quantidadeAtrasadas), T.umFalta, T.variosFalta) },
        ],
      })}
      <div class="mes-progresso-msg ${s.quantidadeAtrasadas && lado === "pagar" ? "alerta" : s.faltaCentavos === 0 && s.quantidade ? "ok" : ""}">${escapeHtml(mensagemDoMes(dados))}</div>
      ${lado === "receber" && s.incertasCentavos > 0 ? `<div class="mes-progresso-msg">Mais <span data-valor>${formatarBRL(s.incertasCentavos)}</span> são incertos e ficam fora da conta.</div>` : ""}
    </div>

    ${GRUPOS.map((g) => {
      const lista = grupos[g];
      if (!lista.length) return "";
      const [rotulo, dica] = T.grupos[g];
      const soma = lista.filter((i) => !i.incerta).reduce((t, i) => t + i.valorCentavos, 0);
      const cabecaGrupo = `<div class="conta-grupo-topo estado-${g}"><span class="conta-grupo-titulo">${rotulo} <span class="conta-grupo-qtd">${lista.length}</span></span><span class="conta-grupo-soma mono" data-valor>${formatarBRL(soma)}</span></div>`;
      const corpo = `${dica ? `<div class="conta-grupo-dica">${dica}</div>` : ""}${g === "a_pagar" ? porSemana(lista, hoje) : lista.map((i) => cartaoConta(i, hoje)).join("")}`;
      return g === "paga"
        ? `<details class="conta-grupo estado-paga"><summary>${cabecaGrupo}</summary>${corpo}</details>`
        : `<section class="conta-grupo">${cabecaGrupo}${corpo}</section>`;
    }).join("")}
    ${s.quantidade === 0 && !dados.itens.length ? `<div class="vazio">${T.vazio}</div>` : ""}
  `;

  container.querySelector("#btn-adicionar-conta")?.addEventListener("click", () => abrirLancamento(T.preset));
  container.querySelectorAll("[data-lado]").forEach((b) => b.addEventListener("click", () => { lado = b.dataset.lado; renderizar(); }));
  container.querySelectorAll(".conta-card").forEach((el) => {
    const item = dados.itens.find((i) => i.chave === el.dataset.chave);
    el.querySelector("[data-pagar]")?.addEventListener("click", (ev) => pagar(item, ev.currentTarget));
    el.querySelector("[data-mais]")?.addEventListener("click", () => abrirMais(item));
  });
  container.querySelector("#mes-prev").addEventListener("click", () => trocarMes(tempo.somarMeses(mesVisivel, -1)));
  container.querySelector("#mes-next").addEventListener("click", () => trocarMes(tempo.somarMeses(mesVisivel, 1)));
}

async function pagar(item, botao) {
  if (botao) botao.disabled = true;
  await baixarComPergunta(item, lado === "receber" ? "receita" : "despesa");
  if (botao) botao.disabled = false;
}

function abrirMais(item) {
  modal.abrir(`
    <div class="modal">
      <h2>${escapeHtml(item.descricao)}</h2>
      <p class="tela-sub" style="margin-bottom:14px;"><span data-valor>${formatarBRL(item.valorCentavos)}</span> · ${escapeHtml(quando(item, painel.hoje))}</p>
      <div class="modal-actions" style="flex-wrap:wrap;">
        ${item.transacaoId ? `<button class="btn btn-primary" data-m="editar">Editar valor, dia e conta</button>` : item.evento && !item.estimativa ? `<button class="btn btn-primary" data-m="ajustar">Editar só este mês</button>` : ""}
        <button class="btn btn-ghost" data-m="origem">Abrir o cadastro</button>
        <button class="btn btn-ghost" data-m="fechar">Fechar</button>
      </div>
    </div>`);
  const raiz = document.getElementById("overlay-modal");
  raiz.querySelector('[data-m="fechar"]').addEventListener("click", () => modal.fechar());
  raiz.querySelector('[data-m="editar"]')?.addEventListener("click", () => { modal.fechar(); editarLancamento(item.transacaoId); });
  raiz.querySelector('[data-m="ajustar"]')?.addEventListener("click", () => { modal.fechar(); abrirAjusteDoMes(item); });
  raiz.querySelector('[data-m="origem"]').addEventListener("click", () => { modal.fechar(); navegar(DESTINO_ORIGEM[item.origem?.tipo] || DESTINO_ORIGEM.transacao); });
}

/** Item que ainda é só previsão (renda esperada, parcela, recorrência): ajusta valor, dia e conta só neste mês. */
async function abrirAjusteDoMes(item) {
  const base = await carregarBase();
  const ativas = base.contas.filter((c) => c.status === "ativa");
  const e = item.evento;
  const dinheiro = (c) => (c / 100).toFixed(2).replace(".", ",");
  modal.abrir(`
    <div class="modal">
      <h2>Editar ${escapeHtml(item.descricao)}</h2>
      <p class="tela-sub" style="margin-bottom:12px;">Muda só este mês. Os outros meses continuam como no cadastro.</p>
      <div class="row2">
        <div class="field"><label for="aj-valor">Valor</label><input type="text" inputmode="decimal" id="aj-valor" value="${dinheiro(item.valorCentavos)}"></div>
        <div class="field"><label for="aj-data">${lado === "receber" ? "Cai em" : "Vence em"}</label><input type="date" id="aj-data" value="${escapeHtml(e.vencimento || e.data)}"></div>
      </div>
      <div class="field"><label for="aj-conta">Conta</label>
        <select id="aj-conta"><option value="">Padrão do cadastro</option>${ativas.map((c) => `<option value="${escapeHtml(c.id)}" ${item.contaSugeridaId === c.id ? "selected" : ""}>${escapeHtml(c.nome)}</option>`).join("")}</select></div>
      <div class="erro-form" id="aj-erro" hidden></div>
      <div class="modal-actions"><button class="btn btn-ghost" data-aj="cancelar">Cancelar</button><button class="btn btn-primary" data-aj="salvar">Salvar</button></div>
    </div>`);
  const raiz = document.getElementById("overlay-modal");
  raiz.querySelector('[data-aj="cancelar"]').addEventListener("click", () => modal.fechar());
  raiz.querySelector('[data-aj="salvar"]').addEventListener("click", async (ev) => {
    ev.currentTarget.disabled = true;
    const valor = {
      valorCentavos: paraCentavos(raiz.querySelector("#aj-valor").value), data: raiz.querySelector("#aj-data").value, contaId: raiz.querySelector("#aj-conta").value || null,
    };
    try {
      await ajustarEvento(e, valor);
      modal.fechar();
      mostrarToast("Ajustado só neste mês.");
    } catch (erro) {
      ev.currentTarget.disabled = false;
      const el = raiz.querySelector("#aj-erro"); el.textContent = erro.message || "Não foi possível salvar."; el.hidden = false;
    }
  });
}
