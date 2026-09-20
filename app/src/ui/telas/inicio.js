// Início — os seis blocos do §25. "Como está minha vida financeira agora?"
// em poucos segundos: Dinheiro, Situação, Próximas ações, Fluxo, Dívidas e
// Patrimônio (Fase 9, o último a chegar).

import { pessoas, contas, dividas } from "../../dados/repositorios.js";
import { assinarClarezaDeCaixa } from "../../dados/caixaRepo.js";
import { assinarProjecao } from "../../dados/projecaoRepo.js";
import { assinarPainelDecisoes } from "../../dados/decisoesRepo.js";
import { assinarPainelPatrimonio } from "../../dados/patrimonioRepo.js";
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
let estadoProjecao = null;
let estadoDividas = null;
let estadoDecisoes = null;
let estadoPatrimonio = null;
let container = null;

function itemContador(rotulo, valor, sub) {
  return `
    <div class="item-cartao">
      <div class="item-corpo">
        <div class="item-titulo">${escapeHtml(rotulo)}</div>
        <div class="item-sub">${escapeHtml(sub)}</div>
      </div>
      <div class="item-valor mono" data-valor>${valor}</div>
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

    if (pararAssinaturaDividas) pararAssinaturaDividas();
    estadoDividas = null;
    pararAssinaturaDividas = dividas.assinar((lista) => {
      const dividasComId = lista.map((i) => ({ id: i.id, ...i.dados }));
      estadoDividas = calcularVisaoConsolidada(dividasComId, hojeISO());
      renderizarDividasResumo();
    });

    if (pararAssinaturaDecisoes) pararAssinaturaDecisoes();
    estadoDecisoes = null;
    pararAssinaturaDecisoes = assinarPainelDecisoes((r) => {
      estadoDecisoes = r;
      renderizarSituacaoResumo();
      renderizarProximasAcoesResumo();
    });

    if (pararAssinaturaPatrimonio) pararAssinaturaPatrimonio();
    estadoPatrimonio = null;
    pararAssinaturaPatrimonio = assinarPainelPatrimonio((r) => {
      estadoPatrimonio = r;
      renderizarPatrimonioResumo();
    });
  },
  desmontar() {
    if (pararAssinatura) { pararAssinatura(); pararAssinatura = null; }
    if (pararAssinaturaProjecao) { pararAssinaturaProjecao(); pararAssinaturaProjecao = null; }
    if (pararAssinaturaDividas) { pararAssinaturaDividas(); pararAssinaturaDividas = null; }
    if (pararAssinaturaDecisoes) { pararAssinaturaDecisoes(); pararAssinaturaDecisoes = null; }
    if (pararAssinaturaPatrimonio) { pararAssinaturaPatrimonio(); pararAssinaturaPatrimonio = null; }
    estadoProjecao = null;
    estadoDividas = null;
    estadoDecisoes = null;
    estadoPatrimonio = null;
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

    <div class="tela-head"><div><h3 class="tela-titulo" style="font-size:17px;">Situação</h3>
      <p class="tela-sub">Estado do caixa e o principal risco ou pressão agora — §8/§9</p></div></div>
    <div id="situacao-home"></div>

    <div class="tela-head"><div><h3 class="tela-titulo" style="font-size:17px;">Próximas ações</h3>
      <p class="tela-sub">O que merece sua atenção agora — §9</p></div></div>
    <div id="proximas-acoes-home"></div>

    <div class="tela-head"><div><h3 class="tela-titulo" style="font-size:17px;">Fluxo de caixa</h3>
      <p class="tela-sub">Entradas e saídas projetadas — os quatro horizontes do §7</p></div></div>
    <div id="fluxo-caixa-home"></div>

    <div class="tela-head"><div><h3 class="tela-titulo" style="font-size:17px;">Dívidas</h3>
      <p class="tela-sub">Saldo devido, comprometimento mensal e pressão sobre a renda — §11</p></div></div>
    <div id="dividas-home"></div>

    <div class="tela-head"><div><h3 class="tela-titulo" style="font-size:17px;">Patrimônio</h3>
      <p class="tela-sub">Ativos, passivos e reserva — §14/§15</p></div></div>
    <div id="patrimonio-home"></div>
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
  renderizarDividasResumo();
  renderizarSituacaoResumo();
  renderizarProximasAcoesResumo();
}

function renderizarSituacaoResumo() {
  if (!container) return;
  const alvo = container.querySelector("#situacao-home");
  if (!alvo) return;

  if (!estadoDecisoes) {
    alvo.innerHTML = `<div class="tela-sub">Carregando…</div>`;
    return;
  }

  const { diagnostico, achadosPendentes } = estadoDecisoes;
  const negativo = diagnostico.estadoCaixa.seguroParaGastarCentavos < 0;
  const principal = achadosPendentes[0];

  alvo.innerHTML = `
    <div class="divida-resumo" style="margin-bottom:0;">
      <div class="diagnostico-linha">
        <div class="rotulo">Estado do caixa</div>
        <div class="texto">${negativo
          ? `Negativo: falta <span class="valor-neg" data-valor>${formatarBRL(Math.abs(diagnostico.estadoCaixa.seguroParaGastarCentavos))}</span> para cobrir o que já está comprometido.`
          : `<span data-valor>${formatarBRL(diagnostico.estadoCaixa.seguroParaGastarCentavos)}</span> seguros para gastar.`}</div>
      </div>
      <div class="diagnostico-linha" style="border-bottom:none;">
        <div class="rotulo">Principal risco ou pressão</div>
        <div class="texto">${principal ? escapeHtml(principal.titulo) : "Nenhum problema ou risco identificado agora."}</div>
      </div>
    </div>`;
}

function renderizarProximasAcoesResumo() {
  if (!container) return;
  const alvo = container.querySelector("#proximas-acoes-home");
  if (!alvo) return;

  if (!estadoDecisoes) {
    alvo.innerHTML = `<div class="tela-sub">Carregando…</div>`;
    return;
  }

  const topAchados = estadoDecisoes.achadosPendentes.slice(0, 3);
  if (!topAchados.length) {
    alvo.innerHTML = `<div class="vazio">Nada pedindo atenção agora.</div>`;
    return;
  }

  alvo.innerHTML = `<div class="lista-cartoes" data-ir-plano>` +
    topAchados.map((a) => `
      <button class="item-cartao" style="width:100%;text-align:left;cursor:pointer;font:inherit;">
        <div class="item-corpo">
          <div class="item-titulo">${escapeHtml(a.titulo)}</div>
          <div class="item-sub">${escapeHtml(a.acaoSugerida)}</div>
        </div>
        <span class="item-tag${CLASSE_URGENCIA[a.urgencia] ? " " + CLASSE_URGENCIA[a.urgencia] : ""}">${ROTULO_URGENCIA[a.urgencia]}</span>
      </button>`).join("") +
    `</div>`;

  alvo.querySelectorAll("button").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelector('[data-modulo="plano"]')?.click();
    });
  });
}

function renderizarDividasResumo() {
  if (!container) return;
  const alvo = container.querySelector("#dividas-home");
  if (!alvo) return;

  if (!estadoDividas) {
    alvo.innerHTML = `<div class="tela-sub">Carregando…</div>`;
    return;
  }
  if (estadoDividas.quantidadeAtivas === 0) {
    alvo.innerHTML = `<div class="vazio">Nenhuma dívida ativa cadastrada.</div>`;
    return;
  }

  alvo.innerHTML = `
    <button class="item-cartao" data-ir-dividas style="width:100%;text-align:left;cursor:pointer;font:inherit;">
      <div class="item-corpo">
        <div class="item-titulo"><span class="valor-neg" data-valor>${formatarBRL(estadoDividas.saldoTotalAtualCentavos)}</span> devendo${estadoDividas.quantidadeAtrasadas > 0
          ? ` · <span style="color:var(--danger);">${estadoDividas.quantidadeAtrasadas} ${estadoDividas.quantidadeAtrasadas === 1 ? "atrasada" : "atrasadas"}</span>`
          : ""}</div>
        <div class="item-sub"><span data-valor>${formatarBRL(estadoDividas.comprometimentoMensalCentavos)}</span>/mês comprometido${estadoDividas.dataQuitacaoTotal ? ` · quita ${escapeHtml(formatarData(estadoDividas.dataQuitacaoTotal))}` : ""}</div>
      </div>
    </button>`;

  alvo.querySelector("[data-ir-dividas]").addEventListener("click", () => {
    document.querySelector('[data-modulo="dividas"]')?.click();
  });
}

function renderizarPatrimonioResumo() {
  if (!container) return;
  const alvo = container.querySelector("#patrimonio-home");
  if (!alvo) return;

  if (!estadoPatrimonio) {
    alvo.innerHTML = `<div class="tela-sub">Carregando…</div>`;
    return;
  }

  const { liquidoCentavos, ativosCentavos, passivosCentavos, variacaoMensal, reserva } = estadoPatrimonio;
  const variacaoTexto = variacaoMensal
    ? `${variacaoMensal.variacaoCentavos >= 0 ? "+" : ""}${formatarBRL(variacaoMensal.variacaoCentavos)} no mês`
    : "primeiro retrato deste mês";
  const coberturaTexto = reserva.coberturaMeses != null
    ? `reserva cobre ${reserva.coberturaMeses.toFixed(1)} meses de custo essencial`
    : "sem custo essencial calculado ainda para medir a reserva";

  alvo.innerHTML = `
    <button class="item-cartao" data-ir-patrimonio style="width:100%;text-align:left;cursor:pointer;font:inherit;">
      <div class="item-corpo">
        <div class="item-titulo"><span class="${liquidoCentavos < 0 ? "valor-neg" : ""}" data-valor>${formatarBRL(liquidoCentavos)}</span> de patrimônio líquido</div>
        <div class="item-sub"><span data-valor>${formatarBRL(ativosCentavos)}</span> em ativos, <span data-valor>${formatarBRL(passivosCentavos)}</span> em passivos · ${escapeHtml(variacaoTexto)}</div>
        <div class="item-sub">${escapeHtml(coberturaTexto)}</div>
      </div>
    </button>`;

  alvo.querySelector("[data-ir-patrimonio]").addEventListener("click", () => {
    document.querySelector('[data-modulo="patrimonio"]')?.click();
  });
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
