// Início — o bloco Dinheiro do §25, entregue pela Fase 2. Responde à
// pergunta central do §4: "Quanto eu posso gastar sem criar um problema
// mais adiante?" — com um número, e esse número explicável linha a linha
// (o portão da fase), não uma caixa preta.
//
// Situação, próximas ações, dívidas e patrimônio (os outros blocos do §25)
// chegam nas Fases 6, 7 e 9 — por enquanto o Início é só o painel de
// dinheiro mais um lembrete de quem ainda falta cadastrar.

import { pessoas, contas } from "../../dados/repositorios.js";
import { assinarClarezaDeCaixa } from "../../dados/caixaRepo.js";
import { assinarProjecao } from "../../dados/projecaoRepo.js";
import { formatarBRL } from "../../domain/dinheiro.js";
import { formatarData } from "../../domain/tempo.js";
import { escapeHtml } from "../utilitarios.js";

const HORIZONTE_DIAS = 30;

let pararAssinatura = null;
let pararAssinaturaProjecao = null;
let estadoProjecao = null;
let container = null;

function itemContador(rotulo, valor, sub) {
  return `
    <div class="item-cartao">
      <div class="item-corpo">
        <div class="item-titulo">${escapeHtml(rotulo)}</div>
        <div class="item-sub">${escapeHtml(sub)}</div>
      </div>
      <div class="item-valor mono">${valor}</div>
    </div>`;
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
    pararAssinaturaProjecao = assinarProjecao((r) => { estadoProjecao = r; renderizarFluxoResumo(); });
  },
  desmontar() {
    if (pararAssinatura) { pararAssinatura(); pararAssinatura = null; }
    if (pararAssinaturaProjecao) { pararAssinaturaProjecao(); pararAssinaturaProjecao = null; }
    estadoProjecao = null;
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
  container.querySelector("#ir-configuracoes").addEventListener("click", () => {
    document.querySelector('[data-modulo="configuracoes"]')?.click();
  });
}

function renderizarPedindoConta() {
  container.innerHTML = `
    <div class="tela-head" style="margin-top:0;"><div><h2 class="tela-titulo">Início</h2></div></div>
    <div class="vazio">
      Ainda não há nenhuma conta cadastrada — sem isso não dá pra saber quanto dinheiro existe.
      <div><button class="btn btn-primary" id="ir-dinheiro">Cadastrar conta</button></div>
    </div>`;
  container.querySelector("#ir-dinheiro").addEventListener("click", () => {
    document.querySelector('[data-modulo="dinheiro"]')?.click();
  });
}

function renderizarPainel(painel, listaContas, listaCartoes) {
  if (!container) return;
  const {
    saldoAtualCentavos, saldoReservaCentavos, comprometidoCentavos,
    livreCentavos, seguroParaGastarCentavos, detalhes,
  } = painel;

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

    <div class="tela-head"><div><h3 class="tela-titulo" style="font-size:17px;">Por que esse número</h3>
      <p class="tela-sub">Saldo atual, conta por conta</p></div></div>
    <div class="lista-cartoes" id="contas-detalhe" style="margin-bottom:20px;"></div>

    <div class="tela-head"><div><h3 class="tela-titulo" style="font-size:17px;">Compromissos próximos</h3>
      <p class="tela-sub">O que está pressionando o caixa nos próximos ${HORIZONTE_DIAS} dias</p></div></div>
    <div id="compromissos-detalhe"></div>

    <div class="tela-head"><div><h3 class="tela-titulo" style="font-size:17px;">Fluxo de caixa</h3>
      <p class="tela-sub">Entradas e saídas projetadas — os quatro horizontes do §7</p></div></div>
    <div id="fluxo-caixa-home"></div>
  `;

  const contasAlvo = container.querySelector("#contas-detalhe");
  if (!detalhes.contasOperacao.length) {
    contasAlvo.innerHTML = `<div class="vazio">Nenhuma conta de operação ativa.</div>`;
  } else {
    contasAlvo.innerHTML = detalhes.contasOperacao.map((x) => itemContador(
      x.conta.nome,
      formatarBRL(x.saldoCentavos),
      x.conta.instituicao || "",
    )).join("");
  }

  const compromissosAlvo = container.querySelector("#compromissos-detalhe");
  if (!detalhes.compromissos.length) {
    compromissosAlvo.innerHTML = `<div class="vazio">Nada previsto para os próximos ${HORIZONTE_DIAS} dias.</div>`;
  } else {
    compromissosAlvo.innerHTML = `<div class="item-cartao" style="display:block;">` +
      detalhes.compromissos.map((item) => `
        <div class="compromisso-item">
          <div>
            <div class="compromisso-desc">${item.atrasado ? '<span class="tag-atrasado">Atrasado</span>' : ""}${escapeHtml(item.descricao)}</div>
            <div class="compromisso-data">${escapeHtml(formatarData(item.data))}</div>
          </div>
          <div class="compromisso-valor" data-valor>${formatarBRL(item.valorCentavos)}</div>
        </div>`).join("") +
      `</div>`;
  }

  renderizarFluxoResumo();
}

function renderizarFluxoResumo() {
  if (!container) return;
  const alvo = container.querySelector("#fluxo-caixa-home");
  if (!alvo) return;

  if (!estadoProjecao) {
    alvo.innerHTML = `<div class="tela-sub">Carregando…</div>`;
    return;
  }

  alvo.innerHTML = `<div class="horizontes-grid">` +
    estadoProjecao.horizontes.map((h) => {
      const net = h.entradasSeguroCentavos - h.saidasSeguroCentavos;
      return `
        <button class="horizonte-card" data-ir-planejamento>
          <div class="rotulo">${h.saidaCritica ? '<span class="ponto-critico"></span>' : ""}${escapeHtml(h.rotulo)}</div>
          <div class="funcao">${escapeHtml(h.funcao)}</div>
          <div class="net ${net < 0 ? "valor-neg" : "valor-pos"}" data-valor>${net >= 0 ? "+" : ""}${formatarBRL(net)}</div>
        </button>`;
    }).join("") +
    `</div>`;

  alvo.querySelectorAll("[data-ir-planejamento]").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelector('[data-modulo="planejamento"]')?.click();
    });
  });
}
