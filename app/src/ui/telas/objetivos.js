// Objetivos financeiros (§16). "Uma meta isolada não basta — precisa
// estar conectada ao fluxo de caixa e ao patrimônio" (texto do blueprint).
// Tela bespoke (como Dívidas e Renda): a compatibilidade com a margem
// depende de renda, custos e dívidas, não só da lista de objetivos.

import { objetivos, ErroDeValidacao } from "../../dados/repositorios.js";
import { assinarPainelObjetivos } from "../../dados/objetivosRepo.js";
import { simularNovoPrazo, simularMetaReversa } from "../../domain/objetivos.js";
import { paraCentavos, formatarBRL } from "../../domain/dinheiro.js";
import { formatarData, hojeISO, somarMeses } from "../../domain/tempo.js";
import { abrir as abrirModal, fechar as fecharModal } from "../modal.js";
import { escapeHtml, iniciais, mostrarToast } from "../utilitarios.js";

const ROTULO_HORIZONTE = { curto: "Curto prazo", medio: "Médio prazo", longo: "Longo prazo" };

let painel = null;
let pararAssinatura = null;
let container = null;
const expandidos = new Set();

export default {
  montar(alvo) {
    container = alvo;
    expandidos.clear();
    if (pararAssinatura) pararAssinatura();
    pararAssinatura = assinarPainelObjetivos((r) => { painel = r; renderizar(); });
    renderizar();
  },
  desmontar() {
    if (pararAssinatura) { pararAssinatura(); pararAssinatura = null; }
    container = null;
    painel = null;
  },
};

function cartaoObjetivo(o) {
  const aberto = expandidos.has(o.id);
  return `
    <div class="item-cartao" data-id="${escapeHtml(o.id)}">
      <div class="item-avatar">${escapeHtml(iniciais(o.nome))}</div>
      <div class="item-corpo">
        <div class="item-titulo">${escapeHtml(o.nome)}</div>
        <div class="item-sub">${ROTULO_HORIZONTE[o.horizonte]} · prazo ${escapeHtml(formatarData(o.prazo))} · ${o.progressoPercentual}%</div>
      </div>
      <div class="item-valor mono" data-valor>${formatarBRL(o.valorAtualCalculadoCentavos)}</div>
      <span class="item-tag${o.compativel ? "" : " critico"}">${o.compativel ? "no ritmo" : "fora do ritmo"}</span>
      <button class="btn-mini${aberto ? " ativo" : ""}" data-acao="expandir" data-id="${escapeHtml(o.id)}" aria-expanded="${aberto}">${aberto ? "Fechar" : "Detalhes"}</button>
      <div class="item-acoes">
        <button class="btn-mini" data-acao="editar" data-id="${escapeHtml(o.id)}" >Editar</button>
        <button class="btn-mini perigo" data-acao="apagar" data-id="${escapeHtml(o.id)}" >Apagar</button>
      </div>
    </div>
    ${aberto ? `<div class="item-extra" data-extra-id="${escapeHtml(o.id)}">${detalheObjetivo(o)}</div>` : ""}`;
}

function detalheObjetivo(o) {
  const largura = Math.min(100, o.progressoPercentual);
  return `
    <div class="tela-sub" style="margin:0 0 4px;"><span data-valor>${formatarBRL(o.valorAtualCalculadoCentavos)}</span> de <span data-valor>${formatarBRL(o.valorAlvoCentavos)}</span> (${o.progressoPercentual}%)</div>
    <div class="barra-limite${o.progressoPercentual >= 100 ? "" : ""}"><span style="width:${largura}%"></span></div>
    <div class="fatura-linha"><span class="rotulo">Falta</span><b data-valor>${formatarBRL(o.faltaCentavos)}</b></div>
    <div class="fatura-linha"><span class="rotulo">Meses restantes</span><b>${o.mesesRestantes}</b></div>
    <div class="fatura-linha"><span class="rotulo">Necessário por mês</span><b data-valor>${formatarBRL(o.valorNecessarioPorMesCentavos)}</b></div>
    <div class="fatura-linha"><span class="rotulo">Sobra do mês hoje</span><b data-valor>${formatarBRL(o.margemCentavos)}</b></div>
    ${o.compativel
      ? `<div class="alerta-tudo-coberto" style="margin-top:10px;">Essa meta cabe no que sobra por mês.</div>`
      : `<div class="erro-form" style="margin-top:10px;">Fora do ritmo: faltam <span data-valor>${formatarBRL(o.faltaPorMesCentavos)}</span> por mês para chegar no prazo com a sobra de hoje.</div>`}

    <div class="simulador-bloco">
      <div class="simulador-titulo">Simular com outra sobra mensal</div>
      <div class="simulador-linha">
        <div class="field"><label for="sim-sobra-${o.id}">Sobra mensal hipotética</label>
          <input type="text" inputmode="decimal" id="sim-sobra-${o.id}" data-campo="sobra" placeholder="0,00"></div>
        <button class="btn btn-ghost btn-sm" type="button" data-acao="simular-prazo">Simular</button>
      </div>
      <div class="simulador-resultado" data-resultado="prazo"></div>
    </div>`;
}

function renderizar() {
  if (!container) return;

  if (!painel) {
    container.innerHTML = `
      <div class="tela-head" style="margin-top:0;"><div><h2 class="tela-titulo">Objetivos</h2></div></div>
      <p class="tela-sub">Carregando…</p>`;
    return;
  }

  container.innerHTML = `
    <div class="tela-head" style="margin-top:0;">
      <div>
        <h2 class="tela-titulo">Metas</h2>
        <p class="tela-sub">Cada meta é conferida contra o que sobra por mês, não fica isolada.</p>
      </div>
      <button class="btn btn-primary" data-acao="novo-objetivo">+ Novo objetivo</button>
    </div>
    <div class="resumo-mes">
      <div class="resumo-item"><span>Sobra do mês hoje</span><b class="mono ${painel.margemCentavos < 0 ? "valor-neg" : "valor-pos"}" data-valor>${formatarBRL(painel.margemCentavos)}</b></div>
    </div>
    <section class="inicio-bloco meta-reversa">
      <h3>Quero chegar em… dá?</h3>
      <p class="tela-sub" style="margin:0 0 10px;">Simulação: não grava nada. Diz se cabe no que sobra por mês hoje.</p>
      <div class="row2">
        <div class="field"><label for="mr-valor">Quanto quero juntar</label>
          <input type="text" inputmode="decimal" id="mr-valor" placeholder="0,00"></div>
        <div class="field"><label for="mr-prazo">Até quando</label>
          <input type="date" id="mr-prazo"></div>
      </div>
      <div class="field"><label for="mr-atual">Quanto já tenho para isso <small>pode deixar em branco</small></label>
        <input type="text" inputmode="decimal" id="mr-atual" placeholder="0,00"></div>
      <div id="mr-resultado" class="simulador-resultado"></div>
    </section>
    <div class="lista-cartoes" id="lista-objetivos"></div>
  `;

  ligarMetaReversa();
  renderizarLista();
  container.querySelector('[data-acao="novo-objetivo"]').addEventListener("click", () => abrirFormularioObjetivo(null));
}

function ligarMetaReversa() {
  const q = (id) => container.querySelector(id);
  const calcular = () => {
    const alvo = paraCentavos(q("#mr-valor").value);
    const prazo = q("#mr-prazo").value;
    const saida = q("#mr-resultado");
    if (!(alvo > 0) || !prazo) { saida.innerHTML = ""; return; }
    const hoje = hojeISO();
    if (prazo <= hoje) { saida.innerHTML = `<div class="erro-form">Escolha uma data no futuro.</div>`; return; }
    const r = simularMetaReversa({ valorAlvoCentavos: alvo, valorAtualCentavos: paraCentavos(q("#mr-atual").value) || 0, prazo, hoje, margemCentavos: painel.margemCentavos });
    if (r.da) {
      saida.innerHTML = `<div class="alerta-tudo-coberto"><b>Dá.</b> Precisa de <span data-valor>${formatarBRL(r.necessarioPorMesCentavos)}</span> por mês e hoje sobra <span data-valor>${formatarBRL(r.margemCentavos)}</span>${r.folgaPorMesCentavos > 0 ? `, folga de <span data-valor>${formatarBRL(r.folgaPorMesCentavos)}</span>` : ""}.</div>`;
      return;
    }
    const quando = r.mesesComMargemAtual != null ? formatarData(somarMeses(hoje.slice(0, 7), r.mesesComMargemAtual) + hoje.slice(7)) : null;
    saida.innerHTML = `
      <div class="erro-form"><b>Não dá do jeito que está.</b> Faltam <span data-valor>${formatarBRL(r.faltaPorMesCentavos)}</span> por mês: precisa de <span data-valor>${formatarBRL(r.necessarioPorMesCentavos)}</span> e hoje ${r.margemCentavos > 0 ? `sobra <span data-valor>${formatarBRL(r.margemCentavos)}</span>` : "não sobra nada"}.</div>
      <div class="tela-sub" style="margin-top:8px;">
        ${quando ? `Com a sobra de hoje você chega lá em <b>${r.mesesComMargemAtual} meses</b> (por volta de ${escapeHtml(quando)}). ` : "Com a sobra de hoje não há prazo possível: primeiro é preciso abrir folga no mês. "}
        ${r.margemCentavos > 0 ? `No prazo pedido dá pra juntar <span data-valor>${formatarBRL(r.valorPossivelNoPrazoCentavos)}</span>.` : ""}
      </div>`;
  };
  ["#mr-valor", "#mr-prazo", "#mr-atual"].forEach((id) => { q(id).addEventListener("input", calcular); q(id).addEventListener("change", calcular); });
}

function renderizarLista() {
  const alvo = container.querySelector("#lista-objetivos");
  if (!alvo) return;
  if (!painel.objetivos.length) {
    alvo.innerHTML = `<div class="vazio">Nenhum objetivo cadastrado.<div><button class="btn btn-primary" data-acao="novo-objetivo-vazio">+ Novo objetivo</button></div></div>`;
    alvo.querySelector('[data-acao="novo-objetivo-vazio"]').addEventListener("click", () => abrirFormularioObjetivo(null));
    return;
  }
  alvo.innerHTML = painel.objetivos.map(cartaoObjetivo).join("");

  alvo.querySelectorAll('[data-acao="expandir"]').forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.id;
      if (expandidos.has(id)) expandidos.delete(id); else expandidos.add(id);
      renderizarLista();
    });
  });
  alvo.querySelectorAll('[data-acao="editar"]').forEach((btn) => {
    btn.addEventListener("click", () => {
      const o = painel.objetivos.find((x) => x.id === btn.dataset.id);
      if (o) abrirFormularioObjetivo(o);
    });
  });
  alvo.querySelectorAll('[data-acao="apagar"]').forEach((btn) => {
    btn.addEventListener("click", () => {
      const o = painel.objetivos.find((x) => x.id === btn.dataset.id);
      if (o) confirmarApagarObjetivo(o);
    });
  });

  painel.objetivos.forEach((o) => {
    if (!expandidos.has(o.id)) return;
    const elExtra = alvo.querySelector(`[data-extra-id="${o.id}"]`);
    if (!elExtra) return;
    const btnSimular = elExtra.querySelector('[data-acao="simular-prazo"]');
    const inputMargem = elExtra.querySelector('[data-campo="sobra"]');
    const resultado = elExtra.querySelector('[data-resultado="prazo"]');
    if (btnSimular) {
      btnSimular.addEventListener("click", () => {
        const novaMargem = paraCentavos(inputMargem.value);
        if (!novaMargem || novaMargem <= 0) {
          resultado.innerHTML = `<div class="erro-form">Informe uma sobra maior que zero.</div>`;
          return;
        }
        const r = simularNovoPrazo(o, o.valorAtualCalculadoCentavos, novaMargem);
        resultado.innerHTML = r.atingivel
          ? `<div class="simulador-aviso" style="font-size:13px;color:var(--text);">Com <span data-valor>${formatarBRL(novaMargem)}</span>/mês, a meta seria atingida em ${r.mesesNecessarios} ${r.mesesNecessarios === 1 ? "mês" : "meses"}. Isto é uma simulação. Nada foi alterado no objetivo.</div>`
          : `<div class="erro-form">Com essa sobra, a meta nunca seria atingida.</div>`;
      });
    }
  });
}

function campoObjetivoHtml(o, contasDisponiveis, pessoasDisponiveis) {
  const contasOpts = (contasDisponiveis || []).map((c) => `<option value="${escapeHtml(c.id)}" ${o?.contaVinculadaId === c.id ? "selected" : ""}>${escapeHtml(c.nome)}</option>`).join("");
  const pessoasOpts = (pessoasDisponiveis || []).map((p) => `<option value="${escapeHtml(p.id)}" ${o?.pessoaId === p.id ? "selected" : ""}>${escapeHtml(p.nome)}</option>`).join("");
  return `
    <div class="field"><label for="campo-obj-nome">Nome</label>
      <input type="text" id="campo-obj-nome" value="${escapeHtml(o?.nome || "")}" placeholder="Ex.: Entrada do apartamento" required></div>
    <div class="field"><label for="campo-obj-pessoa">Responsável</label>
      <select id="campo-obj-pessoa" required><option value="" ${o?.pessoaId ? "" : "selected"}>Selecione uma pessoa</option>${pessoasOpts}</select></div>
    <div class="row2">
      <div class="field"><label for="campo-obj-alvo">Valor-alvo</label>
        <input type="text" inputmode="decimal" id="campo-obj-alvo" placeholder="0,00" value="${o ? formatarBRL(o.valorAlvoCentavos).replace("R$ ", "") : ""}"></div>
      <div class="field"><label for="campo-obj-prazo">Prazo</label>
        <input type="date" id="campo-obj-prazo" value="${escapeHtml(o?.prazo || "")}" required></div>
    </div>
    <div class="field"><label for="campo-obj-conta">Conta vinculada (opcional)</label>
      <select id="campo-obj-conta"><option value="">Nenhuma (valor atual digitado à mão)</option>${contasOpts}</select></div>
    <div class="field"><label for="campo-obj-atual">Valor atual (se sem conta vinculada)</label>
      <input type="text" inputmode="decimal" id="campo-obj-atual" placeholder="0,00" value="${o ? formatarBRL(o.valorAtualCentavos).replace("R$ ", "") : ""}"></div>
  `;
}

function abrirFormularioObjetivo(o) {
  const editando = !!o;
  abrirModal(`
    <div class="modal">
      <h2>${editando ? "Editar" : "Novo"} objetivo</h2>
      <div id="erro-formulario"></div>
      <form id="form-objetivo" novalidate>
        ${campoObjetivoHtml(o, painel.contas, painel.pessoas)}
        <div class="modal-actions">
          <button type="button" class="btn btn-ghost" data-acao="cancelar">Cancelar</button>
          <button type="submit" class="btn btn-primary">${editando ? "Salvar" : "Criar"}</button>
        </div>
      </form>
    </div>
  `);
  document.querySelector('[data-acao="cancelar"]').addEventListener("click", fecharModal);
  document.getElementById("form-objetivo").addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const campos = {
      nome: document.getElementById("campo-obj-nome").value,
      valorAlvoCentavos: paraCentavos(document.getElementById("campo-obj-alvo").value),
      prazo: document.getElementById("campo-obj-prazo").value,
      contaVinculadaId: document.getElementById("campo-obj-conta").value || null,
      valorAtualCentavos: paraCentavos(document.getElementById("campo-obj-atual").value),
      pessoaId: document.getElementById("campo-obj-pessoa").value,
    };
    try {
      if (editando) {
        await objetivos.atualizar(o.id, campos);
        mostrarToast("Objetivo atualizado.");
      } else {
        await objetivos.criar(campos);
        mostrarToast("Objetivo criado.");
      }
      fecharModal();
    } catch (erro) {
      const el = document.getElementById("erro-formulario");
      const msg = erro instanceof ErroDeValidacao ? erro.erros.join(" ") : "Não foi possível salvar. Tente novamente.";
      if (el) el.innerHTML = `<div class="erro-form">${escapeHtml(msg)}</div>`;
    }
  });
}

function confirmarApagarObjetivo(o) {
  abrirModal(`
    <div class="modal">
      <h2>Apagar “${escapeHtml(o.nome)}”?</h2>
      <p class="tela-sub" style="margin-bottom:20px;">Esta ação não pode ser desfeita.</p>
      <div class="modal-actions">
        <button class="btn btn-ghost" data-acao="cancelar">Cancelar</button>
        <button class="btn btn-primary" style="background:var(--danger);" data-acao="confirmar">Apagar</button>
      </div>
    </div>
  `);
  document.querySelector('[data-acao="cancelar"]').addEventListener("click", fecharModal);
  document.querySelector('[data-acao="confirmar"]').addEventListener("click", async () => {
    await objetivos.apagar(o.id);
    fecharModal();
    mostrarToast("Objetivo apagado.");
  });
}
