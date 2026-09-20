// Início — dashboard (Sprint 3, reformado no Sprint 8 pelo molde do print
// do Nubank que o usuário anexou): zona roxa no topo com as ações rápidas
// de sempre (ocultar valores, configurações) e o item mais urgente
// flutuando por cima; corpo escuro com o saldo em texto puro (não mais
// dentro de um cartão roxo — o roxo agora é só a faixa de cima, igual no
// print); um carrossel com o que mais precisa de atenção, quando há mais
// de um item; e a grade de cartões — um por módulo — pra ir clicando.
// Cada bloco de prosa do diagnóstico completo continua existindo, só que
// na tela de origem — o cartão daqui é a porta de entrada pra ele, não
// uma cópia.

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
import { icone } from "../icones.js";
import * as privacidade from "../privacidade.js";

const HORIZONTE_DIAS = 30;

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
      renderizarBanner();
      renderizarCarrossel();
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
      Ainda não há nenhuma pessoa cadastrada. Comece por aí: tudo no sistema pertence a alguém.
      <div><button class="btn btn-primary" id="ir-configuracoes">Cadastrar pessoas</button></div>
    </div>`;
  container.querySelector("#ir-configuracoes").addEventListener("click", () => irPara("configuracoes"));
}

function renderizarPedindoConta() {
  container.innerHTML = `
    <div class="tela-head" style="margin-top:0;"><div><h2 class="tela-titulo">Início</h2></div></div>
    <div class="vazio">
      Ainda não há nenhuma conta cadastrada. Sem isso não dá pra saber quanto dinheiro existe.
      <div><button class="btn btn-primary" id="ir-dinheiro">Cadastrar conta</button></div>
    </div>`;
  container.querySelector("#ir-dinheiro").addEventListener("click", () => irPara("dinheiro"));
}

function renderizarPainel(painel) {
  if (!container) return;
  const { saldoAtualCentavos, saldoReservaCentavos, comprometidoCentavos, livreCentavos, seguroParaGastarCentavos } = painel;
  const negativo = seguroParaGastarCentavos < 0;

  container.innerHTML = `
    <div class="home-topo-roxo">
      <div class="home-topo-acoes">
        <button class="home-topo-acao" id="botao-ocultar-home" title="Ocultar valores" aria-label="Ocultar valores"></button>
        <button class="home-topo-acao" id="botao-config-home" title="Configurações" aria-label="Configurações">${icone("configuracoes", 19)}</button>
      </div>
      <div id="banner-home"></div>
    </div>

    <button class="home-saldo-rotulo" id="ir-dinheiro-saldo">Dinheiro seguro para gastar ${icone("chevron", 15)}</button>
    <div class="home-saldo-valor${negativo ? " negativo" : ""}" data-valor>${formatarBRL(seguroParaGastarCentavos)}</div>
    <div class="home-saldo-sub">O que sobra do saldo das suas contas depois de descontar tudo que já está
      comprometido nos próximos ${HORIZONTE_DIAS} dias. Não conta o dinheiro de reserva.</div>

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

    <div id="carrossel-home"></div>

    <div class="tela-head"><div><h3 class="tela-titulo" style="font-size:17px;">Tudo em um toque</h3>
      <p class="tela-sub">Cada cartão abre o módulo por trás do número</p></div></div>
    <div class="home-grid" id="grade-home"></div>
  `;

  container.querySelector("#ir-dinheiro-saldo").addEventListener("click", () => irPara("dinheiro"));
  container.querySelector("#botao-config-home").addEventListener("click", () => irPara("configuracoes"));
  ligarBotaoOcultar();
  renderizarBanner();
  renderizarCarrossel();
  renderizarGrade();
}

function ligarBotaoOcultar() {
  const botao = container?.querySelector("#botao-ocultar-home");
  if (!botao) return;
  const desenhar = () => {
    const oculto = privacidade.estaOculto();
    botao.innerHTML = icone(oculto ? "olhoFechado" : "olho", 19);
    botao.setAttribute("title", oculto ? "Mostrar valores" : "Ocultar valores");
  };
  desenhar();
  botao.addEventListener("click", () => { privacidade.alternar(); desenhar(); });
}

/** Achados pendentes ordenados por prioridade, prontos pra dividir entre o
 * banner (só o primeiro, só se for urgente de verdade) e o carrossel (o
 * resto, até um total de 3 pra não virar uma lista infinita na Home). */
function achadosParaHome() {
  const todos = estadoDecisoes?.achadosPendentes || [];
  const bannerMostrado = todos[0] && todos[0].urgencia === "alta";
  return {
    banner: bannerMostrado ? todos[0] : null,
    carrossel: (bannerMostrado ? todos.slice(1) : todos).slice(0, 3),
  };
}

/** O item mais urgente, flutuando sobre a faixa roxa (molde do print): só
 * aparece quando existe algo urgente de verdade, nunca inventa pressão
 * onde não há. */
function renderizarBanner() {
  if (!container) return;
  const alvo = container.querySelector("#banner-home");
  if (!alvo) return;
  const { banner } = achadosParaHome();
  if (!banner) { alvo.innerHTML = ""; return; }
  alvo.innerHTML = `
    <button class="home-banner-flutuante" data-ir="plano">
      <div class="icone-caixa">${icone("alerta", 19)}</div>
      <div>
        <div class="titulo">${escapeHtml(banner.titulo)}</div>
        <div class="sub">${escapeHtml(banner.acaoSugerida)}</div>
      </div>
    </button>`;
  alvo.querySelector("[data-ir]").addEventListener("click", () => irPara("plano"));
}

/** O que mais precisa de atenção depois do banner, um cartão por vez,
 * arrastável (scroll-snap nativo, sem biblioteca) com bolinhas de posição
 * que acompanham o arrasto. Só aparece quando sobra algo pra mostrar. */
function renderizarCarrossel() {
  if (!container) return;
  const alvo = container.querySelector("#carrossel-home");
  if (!alvo) return;
  const { carrossel } = achadosParaHome();
  if (!carrossel.length) { alvo.innerHTML = ""; return; }

  alvo.innerHTML = `
    <div class="home-carrossel" id="trilha-carrossel">
      ${carrossel.map((a) => `
        <button class="home-carrossel-item" data-ir="plano">
          <div class="titulo">${escapeHtml(a.titulo)}</div>
          <div class="sub">${escapeHtml(a.acaoSugerida)}</div>
        </button>`).join("")}
    </div>
    ${carrossel.length > 1 ? `<div class="home-carrossel-dots" id="dots-carrossel">
      ${carrossel.map((_, i) => `<button data-indice="${i}" aria-label="Item ${i + 1}"${i === 0 ? ' class="ativo"' : ""}></button>`).join("")}
    </div>` : ""}
  `;

  alvo.querySelectorAll("[data-ir]").forEach((btn) => {
    btn.addEventListener("click", () => irPara("plano"));
  });

  const trilha = alvo.querySelector("#trilha-carrossel");
  const dots = alvo.querySelectorAll("#dots-carrossel button");
  if (!trilha || !dots.length) return;
  dots.forEach((dot) => {
    dot.addEventListener("click", () => {
      const item = trilha.children[Number(dot.dataset.indice)];
      if (item) item.scrollIntoView({ behavior: "smooth", inline: "start", block: "nearest" });
    });
  });
  trilha.addEventListener("scroll", () => {
    const indice = Math.round(trilha.scrollLeft / (trilha.children[0]?.offsetWidth || 1));
    dots.forEach((dot, i) => dot.classList.toggle("ativo", i === indice));
  }, { passive: true });
}

// `valorEhDinheiro` decide se o valor do cartão entra no modo "ocultar
// valores" (§27): um total em R$ borra, mas um rótulo como "Em dia" ou
// "3/5 no ritmo" não é dinheiro e não deve borrar — senão o botão vira
// ilegível à toa quando a privacidade está ligada.
function cartaoHome({ modulo, icone: nomeIcone, destaque, rotulo, valor, valorClasse, valorEhDinheiro, sub }) {
  return `
    <button class="home-card${destaque ? " destaque" : ""}" data-ir="${escapeHtml(modulo)}">
      <div class="home-card-icone">${icone(nomeIcone, 17)}</div>
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
      modulo: "dinheiro", icone: "dinheiro", destaque: true, rotulo: "Transações",
      valor: "Lançar", valorEhDinheiro: false,
      sub: `<span data-valor>${formatarBRL(receitaCentavos)}</span> entraram · <span data-valor>${formatarBRL(despesaCentavos)}</span> saíram este mês`,
    }));
  }

  if (estadoProjecao) {
    const critico = estadoProjecao.horizontes.find((h) => h.saidaCritica);
    const h7 = estadoProjecao.horizontes[0];
    const net = h7.entradasSeguroCentavos - h7.saidasSeguroCentavos;
    cartoes.push(cartaoHome({
      modulo: "planejamento", icone: "planejamento", rotulo: "Planejamento",
      valor: critico ? "Caixa aperta" : `${net >= 0 ? "+" : ""}${formatarBRL(net)}`,
      valorClasse: critico ? "valor-neg" : (net < 0 ? "valor-neg" : "valor-pos"),
      valorEhDinheiro: !critico,
      sub: critico ? `previsto para ${escapeHtml(formatarData(critico.saidaCritica.data))}` : "saldo previsto em 7 dias",
    }));
  }

  if (estadoDividas) {
    cartoes.push(cartaoHome({
      modulo: "dividas", icone: "dividas", rotulo: "Dívidas",
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
      modulo: "renda", icone: "renda", rotulo: "Renda",
      valor: formatarBRL(estadoRenda.rendaAtualCentavos),
      valorClasse: deficit ? "valor-neg" : "valor-pos",
      valorEhDinheiro: true,
      sub: deficit ? "há déficit este mês" : "sem déficit este mês",
    }));
  }

  if (estadoPatrimonio) {
    const { liquidoCentavos } = estadoPatrimonio;
    cartoes.push(cartaoHome({
      modulo: "patrimonio", icone: "patrimonio", rotulo: "Patrimônio",
      valor: formatarBRL(liquidoCentavos),
      valorClasse: liquidoCentavos < 0 ? "valor-neg" : "valor-pos",
      valorEhDinheiro: true,
      sub: "líquido: ativos menos passivos",
    }));
  }

  if (estadoObjetivos) {
    const total = estadoObjetivos.objetivos.length;
    const noRitmo = estadoObjetivos.objetivos.filter((o) => o.compativel).length;
    cartoes.push(cartaoHome({
      modulo: "objetivos", icone: "objetivos", rotulo: "Objetivos",
      valor: total === 0 ? "Nenhum" : `${noRitmo}/${total}`,
      valorClasse: total > 0 && noRitmo < total ? "valor-neg" : "",
      valorEhDinheiro: false,
      sub: total === 0 ? "nenhum objetivo cadastrado" : "no ritmo da margem atual",
    }));
  }

  if (estadoDecisoes) {
    const qtd = estadoDecisoes.achadosPendentes.length;
    cartoes.push(cartaoHome({
      modulo: "plano", icone: "plano", rotulo: "Plano",
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
