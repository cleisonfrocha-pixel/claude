// Início — dashboard (Sprint 3, referência Nubank pedida pelo usuário):
// um número central, o que precisa de atenção AGORA em destaque, e uma
// grade de cartões — um por módulo — pra ir clicando. Antes a Home
// empilhava o diagnóstico inteiro (seis blocos de prosa, um embaixo do
// outro); útil pra quem já conhece o produto, ruim pra quem só quer abrir
// o app e resolver o que precisa. Cada bloco de prosa continua existindo,
// só que na tela de origem — o cartão daqui é a porta de entrada pra ele,
// não uma cópia.

import { pessoas, contas, dividas } from "../../dados/repositorios.js";
import { assinarClarezaDeCaixa } from "../../dados/caixaRepo.js";
import { assinarProjecao } from "../../dados/projecaoRepo.js";
import { assinarPainelDecisoes } from "../../dados/decisoesRepo.js";
import { assinarPainelPatrimonio } from "../../dados/patrimonioRepo.js";
import { assinarPainelRenda } from "../../dados/rendaRepo.js";
import { assinarPainelObjetivos } from "../../dados/objetivosRepo.js";
import { calcularVisaoConsolidada } from "../../domain/dividas.js";
import { formatarBRL } from "../../domain/dinheiro.js";
import { formatarData, hojeISO } from "../../domain/tempo.js";
import { escapeHtml } from "../utilitarios.js";

const HORIZONTE_DIAS = 30;
const ROTULO_URGENCIA = { alta: "urgente", media: "atenção", baixa: "oportuno" };
const CLASSE_URGENCIA = { alta: "critico", media: "atencao", baixa: "" };

let pararAssinatura = null;
let pararAssinaturaProjecao = null;
let pararAssinaturaDividas = null;
let pararAssinaturaDecisoes = null;
let pararAssinaturaPatrimonio = null;
let pararAssinaturaRenda = null;
let pararAssinaturaObjetivos = null;
let estadoDiagnostico = null;
let estadoProjecao = null;
let estadoDividas = null;
let estadoDecisoes = null;
let estadoPatrimonio = null;
let estadoRenda = null;
let estadoObjetivos = null;
let container = null;

function irPara(modulo) {
  document.querySelector(`[data-modulo="${modulo}"]`)?.click();
}

export default {
  async montar(alvo) {
    container = alvo;
    container.innerHTML = `<div class="tela-sub" style="margin-top:18px;">Carregando…</div>`;

    const [p, c] = await Promise.all([pessoas.listar(), contas.listar()]);

    if (!p.length) {
      renderizarPedindoCadastro();
      return;
    }
    if (!c.length) {
      renderizarPedindoConta();
      return;
    }

    if (pararAssinatura) pararAssinatura();
    pararAssinatura = assinarClarezaDeCaixa(renderizarPainel, HORIZONTE_DIAS);

    if (pararAssinaturaProjecao) pararAssinaturaProjecao();
    estadoProjecao = null;
    pararAssinaturaProjecao = assinarProjecao((r) => { estadoProjecao = r; renderizarGrade(); });

    if (pararAssinaturaDividas) pararAssinaturaDividas();
    estadoDividas = null;
    pararAssinaturaDividas = dividas.assinar((lista) => {
      const dividasComId = lista.map((i) => ({ id: i.id, ...i.dados }));
      estadoDividas = calcularVisaoConsolidada(dividasComId, hojeISO());
      renderizarGrade();
    });

    if (pararAssinaturaDecisoes) pararAssinaturaDecisoes();
    estadoDecisoes = null;
    pararAssinaturaDecisoes = assinarPainelDecisoes((r) => {
      estadoDecisoes = r;
      estadoDiagnostico = r.diagnostico;
      renderizarAlerta();
      renderizarGrade();
    });

    if (pararAssinaturaPatrimonio) pararAssinaturaPatrimonio();
    estadoPatrimonio = null;
    pararAssinaturaPatrimonio = assinarPainelPatrimonio((r) => { estadoPatrimonio = r; renderizarGrade(); });

    if (pararAssinaturaRenda) pararAssinaturaRenda();
    estadoRenda = null;
    pararAssinaturaRenda = assinarPainelRenda((r) => { estadoRenda = r; renderizarGrade(); });

    if (pararAssinaturaObjetivos) pararAssinaturaObjetivos();
    estadoObjetivos = null;
    pararAssinaturaObjetivos = assinarPainelObjetivos((r) => { estadoObjetivos = r; renderizarGrade(); });
  },
  desmontar() {
    if (pararAssinatura) { pararAssinatura(); pararAssinatura = null; }
    if (pararAssinaturaProjecao) { pararAssinaturaProjecao(); pararAssinaturaProjecao = null; }
    if (pararAssinaturaDividas) { pararAssinaturaDividas(); pararAssinaturaDividas = null; }
    if (pararAssinaturaDecisoes) { pararAssinaturaDecisoes(); pararAssinaturaDecisoes = null; }
    if (pararAssinaturaPatrimonio) { pararAssinaturaPatrimonio(); pararAssinaturaPatrimonio = null; }
    if (pararAssinaturaRenda) { pararAssinaturaRenda(); pararAssinaturaRenda = null; }
    if (pararAssinaturaObjetivos) { pararAssinaturaObjetivos(); pararAssinaturaObjetivos = null; }
    estadoDiagnostico = null;
    estadoProjecao = null;
    estadoDividas = null;
    estadoDecisoes = null;
    estadoPatrimonio = null;
    estadoRenda = null;
    estadoObjetivos = null;
    container = null;
  },
};

function renderizarPedindoCadastro() {
  container.innerHTML = `
    <div class="tela-head" style="margin-top:0;"><div><h2 class="tela-titulo">Início</h2></div></div>
    <div class="vazio">
      Ainda não há nenhuma pessoa cadastrada.<br>Comece por aí — tudo no sistema pertence a alguém.
      <div><button class="btn btn-primary" id="ir-configuracoes">Cadastrar pessoas</button></div>
    </div>`;
  container.querySelector("#ir-configuracoes").addEventListener("click", () => irPara("configuracoes"));
}

function renderizarPedindoConta() {
  container.innerHTML = `
    <div class="tela-head" style="margin-top:0;"><div><h2 class="tela-titulo">Início</h2></div></div>
    <div class="vazio">
      Ainda não há nenhuma conta cadastrada — sem isso não dá pra saber quanto dinheiro existe.
      <div><button class="btn btn-primary" id="ir-dinheiro">Cadastrar conta</button></div>
    </div>`;
  container.querySelector("#ir-dinheiro").addEventListener("click", () => irPara("dinheiro"));
}

function renderizarPainel(painel) {
  if (!container) return;
  const { saldoAtualCentavos, saldoReservaCentavos, comprometidoCentavos, livreCentavos, seguroParaGastarCentavos } = painel;
  const negativo = seguroParaGastarCentavos < 0;

  container.innerHTML = `
    <div class="tela-head" style="margin-top:0;">
      <div>
        <h2 class="tela-titulo">Início</h2>
        <p class="tela-sub">Sua vida financeira agora, nos próximos ${HORIZONTE_DIAS} dias.</p>
      </div>
    </div>

    <div class="hero-caixa">
      <div class="hero-caixa-label">Dinheiro seguro para gastar</div>
      <div class="hero-caixa-valor${negativo ? " negativo" : ""}" data-valor>${formatarBRL(seguroParaGastarCentavos)}</div>
      <div class="hero-caixa-sub">O que sobra do saldo das suas contas depois de descontar tudo que já está
        comprometido nos próximos ${HORIZONTE_DIAS} dias — sem contar o dinheiro de reserva.</div>
    </div>

    ${saldoReservaCentavos !== 0 ? `
      <div class="reserva-nota">
        <span>Além disso, você tem em reserva/segurança</span>
        <b data-valor>${formatarBRL(saldoReservaCentavos)}</b>
      </div>` : ""}

    <div class="resumo-mes">
      <div class="resumo-item"><span>Saldo atual</span><b class="mono" data-valor>${formatarBRL(saldoAtualCentavos)}</b></div>
      <div class="resumo-item"><span>Comprometido (${HORIZONTE_DIAS} dias)</span><b class="mono valor-neg" data-valor>${formatarBRL(comprometidoCentavos)}</b></div>
      <div class="resumo-item"><span>Livre</span><b class="mono ${livreCentavos < 0 ? "valor-neg" : "valor-pos"}" data-valor>${formatarBRL(livreCentavos)}</b></div>
    </div>

    <div id="alerta-home"></div>

    <div class="tela-head"><div><h3 class="tela-titulo" style="font-size:17px;">Tudo em um toque</h3>
      <p class="tela-sub">Cada cartão abre o módulo por trás do número</p></div></div>
    <div class="home-grid" id="grade-home"></div>
  `;

  renderizarAlerta();
  renderizarGrade();
}

/** O item mais urgente da Central de Decisões, em destaque logo abaixo do
 * número principal — pra quem só quer olhar e já ver o que precisa
 * resolver, sem entrar em Plano. Só aparece quando existe algo urgente de
 * verdade (nunca inventa pressão onde não há). */
function renderizarAlerta() {
  if (!container) return;
  const alvo = container.querySelector("#alerta-home");
  if (!alvo) return;
  const principal = estadoDecisoes?.achadosPendentes?.[0];
  if (!principal || principal.urgencia !== "alta") { alvo.innerHTML = ""; return; }
  alvo.innerHTML = `
    <button class="home-alerta" data-ir="plano">
      <div>
        <div class="titulo">${escapeHtml(principal.titulo)}</div>
        <div class="sub">${escapeHtml(principal.acaoSugerida)}</div>
      </div>
      <span class="item-tag critico">urgente</span>
    </button>`;
  alvo.querySelector("[data-ir]").addEventListener("click", () => irPara("plano"));
}

// `valorEhDinheiro` decide se o valor do cartão entra no modo "ocultar
// valores" (§27): um total em R$ borra, mas um rótulo como "Em dia" ou
// "3/5 no ritmo" não é dinheiro e não deve borrar — senão o botão vira
// ilegível à toa quando a privacidade está ligada.
function cartaoHome({ modulo, destaque, rotulo, valor, valorClasse, valorEhDinheiro, sub }) {
  return `
    <button class="home-card${destaque ? " destaque" : ""}" data-ir="${escapeHtml(modulo)}">
      <div class="home-card-rotulo">${escapeHtml(rotulo)}</div>
      <div class="home-card-valor mono${valorClasse ? " " + valorClasse : ""}"${valorEhDinheiro ? " data-valor" : ""}>${valor}</div>
      <div class="home-card-sub">${sub}</div>
    </button>`;
}

/** A grade inteira, um cartão por módulo — cada um lido de um painel que
 * já existe (nenhum número novo é inventado aqui). Redesenha tudo a cada
 * mudança em qualquer painel; é barato (é só HTML de texto) e mantém a
 * grade sempre consistente, sem coordenar qual pedaço mudou. */
function renderizarGrade() {
  if (!container) return;
  const alvo = container.querySelector("#grade-home");
  if (!alvo) return;

  const cartoes = [];

  if (estadoDiagnostico) {
    const receitaCentavos = estadoDiagnostico.receita.totalCentavos;
    const despesaCentavos = estadoDiagnostico.pressaoFixas.totalCentavos;
    cartoes.push(cartaoHome({
      modulo: "dinheiro", destaque: true, rotulo: "Transações",
      valor: "Lançar", valorEhDinheiro: false,
      sub: `<span data-valor>${formatarBRL(receitaCentavos)}</span> entraram · <span data-valor>${formatarBRL(despesaCentavos)}</span> saíram este mês`,
    }));
  }

  if (estadoProjecao) {
    const critico = estadoProjecao.horizontes.find((h) => h.saidaCritica);
    const h7 = estadoProjecao.horizontes[0];
    const net = h7.entradasSeguroCentavos - h7.saidasSeguroCentavos;
    cartoes.push(cartaoHome({
      modulo: "planejamento", rotulo: "Planejamento",
      valor: critico ? "Caixa aperta" : `${net >= 0 ? "+" : ""}${formatarBRL(net)}`,
      valorClasse: critico ? "valor-neg" : (net < 0 ? "valor-neg" : "valor-pos"),
      valorEhDinheiro: !critico,
      sub: critico ? `previsto para ${escapeHtml(formatarData(critico.saidaCritica.data))}` : "saldo previsto em 7 dias",
    }));
  }

  if (estadoDividas) {
    cartoes.push(cartaoHome({
      modulo: "dividas", rotulo: "Dívidas",
      valor: estadoDividas.quantidadeAtivas === 0 ? "Zerado" : formatarBRL(estadoDividas.saldoTotalAtualCentavos),
      valorClasse: estadoDividas.quantidadeAtivas > 0 ? "valor-neg" : "valor-pos",
      valorEhDinheiro: estadoDividas.quantidadeAtivas > 0,
      sub: estadoDividas.quantidadeAtivas === 0
        ? "nenhuma dívida ativa"
        : `${estadoDividas.quantidadeAtrasadas > 0 ? `${estadoDividas.quantidadeAtrasadas} atrasada${estadoDividas.quantidadeAtrasadas > 1 ? "s" : ""} · ` : ""}<span data-valor>${formatarBRL(estadoDividas.comprometimentoMensalCentavos)}</span>/mês`,
    }));
  }

  if (estadoRenda) {
    const deficit = estadoRenda.causaDeficit?.temDeficit;
    cartoes.push(cartaoHome({
      modulo: "renda", rotulo: "Renda",
      valor: formatarBRL(estadoRenda.rendaAtualCentavos),
      valorClasse: deficit ? "valor-neg" : "valor-pos",
      valorEhDinheiro: true,
      sub: deficit ? "há déficit este mês" : "sem déficit este mês",
    }));
  }

  if (estadoPatrimonio) {
    const { liquidoCentavos } = estadoPatrimonio;
    cartoes.push(cartaoHome({
      modulo: "patrimonio", rotulo: "Patrimônio",
      valor: formatarBRL(liquidoCentavos),
      valorClasse: liquidoCentavos < 0 ? "valor-neg" : "valor-pos",
      valorEhDinheiro: true,
      sub: "líquido — ativos menos passivos",
    }));
  }

  if (estadoObjetivos) {
    const total = estadoObjetivos.objetivos.length;
    const noRitmo = estadoObjetivos.objetivos.filter((o) => o.compativel).length;
    cartoes.push(cartaoHome({
      modulo: "objetivos", rotulo: "Objetivos",
      valor: total === 0 ? "Nenhum" : `${noRitmo}/${total}`,
      valorClasse: total > 0 && noRitmo < total ? "valor-neg" : "",
      valorEhDinheiro: false,
      sub: total === 0 ? "nenhum objetivo cadastrado" : "no ritmo da margem atual",
    }));
  }

  if (estadoDecisoes) {
    const qtd = estadoDecisoes.achadosPendentes.length;
    cartoes.push(cartaoHome({
      modulo: "plano", rotulo: "Plano",
      valor: qtd === 0 ? "Em dia" : `${qtd} ${qtd === 1 ? "pendência" : "pendências"}`,
      valorClasse: qtd > 0 ? "valor-neg" : "valor-pos",
      valorEhDinheiro: false,
      sub: qtd === 0 ? "nada pedindo atenção agora" : escapeHtml(estadoDecisoes.achadosPendentes[0].titulo),
    }));
  }

  if (!cartoes.length) { alvo.innerHTML = `<div class="tela-sub">Carregando…</div>`; return; }
  alvo.innerHTML = cartoes.join("");
  alvo.querySelectorAll("[data-ir]").forEach((btn) => {
    btn.addEventListener("click", () => irPara(btn.getAttribute("data-ir")));
  });
}
