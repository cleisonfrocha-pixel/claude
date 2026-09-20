// Patrimônio e construção de riqueza (§14) e reserva e segurança
// financeira (§15). Tela bespoke (como Renda e Plano): a composição e a
// evolução precisam reagir a ativo, dívida e conta mudando, não só à
// lista de ativos — a fábrica de cadastro sozinha não dá conta disso.

import { ativos, ErroDeValidacao } from "../../dados/repositorios.js";
import { assinarPainelPatrimonio } from "../../dados/patrimonioRepo.js";
import { CLASSES_ATIVO } from "../../domain/esquema.js";
import { paraCentavos, formatarBRL } from "../../domain/dinheiro.js";
import { formatarData, competenciaLabel } from "../../domain/tempo.js";
import { abrir as abrirModal, fechar as fecharModal } from "../modal.js";
import { escapeHtml, iniciais, mostrarToast } from "../utilitarios.js";

const ROTULO_CLASSE = {
  liquido: "Líquido", investimento: "Investimento", veiculo: "Veículo",
  imovel: "Imóvel", participacao: "Participação", outro: "Outro",
};

let painel = null;
let pararAssinatura = null;
let container = null;

export default {
  montar(alvo) {
    container = alvo;
    if (pararAssinatura) pararAssinatura();
    pararAssinatura = assinarPainelPatrimonio((r) => { painel = r; renderizar(); });
    renderizar();
  },
  desmontar() {
    if (pararAssinatura) { pararAssinatura(); pararAssinatura = null; }
    container = null;
    painel = null;
  },
};

function linhaVariacao(rotulo, variacao) {
  if (!variacao) return `<div class="resumo-item"><span>${escapeHtml(rotulo)}</span><b class="mono" data-valor>-</b></div>`;
  return `<div class="resumo-item"><span>${escapeHtml(rotulo)}</span><b class="mono ${variacao.variacaoCentavos < 0 ? "valor-neg" : "valor-pos"}" data-valor>${variacao.variacaoCentavos >= 0 ? "+" : ""}${formatarBRL(variacao.variacaoCentavos)}</b></div>`;
}

function blocoRelacao(r) {
  if (!r) return `<div class="tela-sub">Ainda não há um mês anterior para comparar.</div>`;
  const sinal = (bom) => bom ? '<span class="valor-pos">✓</span>' : '<span class="valor-neg">✕</span>';
  return `
    <div class="fatura-linha"><span class="rotulo">Dívida caiu</span>${sinal(r.passivoCaiu)}</div>
    <div class="fatura-linha"><span class="rotulo">Ativo subiu</span>${sinal(r.ativoSubiu)}</div>
    <div class="fatura-linha"><span class="rotulo">Patrimônio cresceu</span>${sinal(r.patrimonioSubiu)}</div>
  `;
}

function cartaoAtivo(a) {
  return `
    <div class="item-cartao" data-id="${escapeHtml(a.id)}">
      <div class="item-avatar">${escapeHtml(iniciais(a.nome))}</div>
      <div class="item-corpo">
        <div class="item-titulo">${escapeHtml(a.nome)}</div>
        <div class="item-sub">${ROTULO_CLASSE[a.classe]} · avaliado em ${escapeHtml(formatarData(a.dataAvaliacao))}</div>
      </div>
      <div class="item-valor mono" data-valor>${formatarBRL(a.valorAtualCentavos)}</div>
      <div class="item-acoes">
        <button class="icon-btn" data-acao="editar" data-id="${escapeHtml(a.id)}" title="Editar" aria-label="Editar">✎</button>
        <button class="icon-btn danger" data-acao="apagar" data-id="${escapeHtml(a.id)}" title="Apagar" aria-label="Apagar">✕</button>
      </div>
    </div>`;
}

function linhaMetaReserva(m) {
  if (m.metaCentavos == null) {
    return `<div class="fatura-linha"><span class="rotulo">${m.meses} meses</span><span class="tela-sub" style="margin:0;">sem custo essencial para calcular</span></div>`;
  }
  const largura = Math.min(100, m.progressoPercentual);
  return `
    <div style="margin-bottom:12px;">
      <div class="fatura-linha" style="border-bottom:none;padding-bottom:2px;">
        <span class="rotulo">${m.meses} meses de essencial<small>meta: <span data-valor>${formatarBRL(m.metaCentavos)}</span></small></span>
        <b>${m.progressoPercentual}%</b>
      </div>
      <div class="barra-limite${m.progressoPercentual >= 100 ? "" : m.progressoPercentual >= 50 ? " atencao" : " critico"}"><span style="width:${largura}%"></span></div>
    </div>`;
}

function renderizar() {
  if (!container) return;

  if (!painel) {
    container.innerHTML = `
      <div class="tela-head" style="margin-top:0;"><div><h2 class="tela-titulo">Patrimônio</h2></div></div>
      <p class="tela-sub">Carregando…</p>`;
    return;
  }

  const negativo = painel.liquidoCentavos < 0;

  container.innerHTML = `
    <div class="tela-head" style="margin-top:0;">
      <div>
        <h2 class="tela-titulo">Patrimônio</h2>
        <p class="tela-sub">A transformação do fluxo de caixa em patrimônio. Não é só sair das dívidas.</p>
      </div>
    </div>

    <div class="hero-caixa">
      <div class="hero-caixa-label">Patrimônio líquido</div>
      <div class="hero-caixa-valor${negativo ? " negativo" : ""}" data-valor>${formatarBRL(painel.liquidoCentavos)}</div>
      <div class="hero-caixa-sub"><span data-valor>${formatarBRL(painel.ativosCentavos)}</span> em ativos, menos <span data-valor>${formatarBRL(painel.passivosCentavos)}</span> em dívidas ativas, em ${escapeHtml(competenciaLabel(painel.competencia))}.</div>
    </div>

    <div class="resumo-mes">
      ${linhaVariacao("Variação do mês", painel.variacaoMensal)}
      ${linhaVariacao("Variação acumulada", painel.variacaoAcumulada)}
    </div>

    <div class="tela-head"><div><h3 class="tela-titulo" style="font-size:17px;">Dívida, ativo e patrimônio</h3>
      <p class="tela-sub">Comparado com o mês anterior</p></div></div>
    ${blocoRelacao(painel.relacao)}

    ${painel.composicao.length ? `
      <div class="tela-head"><div><h3 class="tela-titulo" style="font-size:17px;">Composição do patrimônio</h3></div></div>
      ${painel.composicao.map((c) => `<div class="fatura-linha"><span class="rotulo">${ROTULO_CLASSE[c.classe]}</span><b data-valor>${formatarBRL(c.valorCentavos)} <span style="font-weight:400;font-size:11px;">(${c.percentual}%)</span></b></div>`).join("")}
    ` : ""}

    <div class="tela-head"><div><h3 class="tela-titulo" style="font-size:17px;">Ativos</h3>
      <p class="tela-sub">Líquidos, investimentos, veículos, imóveis, participações e outros</p></div>
      <button class="btn btn-primary" data-acao="novo-ativo">+ Novo ativo</button>
    </div>
    <div class="lista-cartoes" id="lista-ativos" style="margin-bottom:20px;"></div>

    <div class="tela-head"><div><h3 class="tela-titulo" style="font-size:17px;">Reserva</h3>
      <p class="tela-sub">${painel.reserva.coberturaMeses != null
        ? `<span data-valor>${formatarBRL(painel.reserva.saldoReservaCentavos)}</span> guardados. Cobre ${painel.reserva.coberturaMeses.toFixed(1)} meses (${painel.reserva.coberturaDias} dias) de custo essencial`
        : `<span data-valor>${formatarBRL(painel.reserva.saldoReservaCentavos)}</span> guardados. Sem custo essencial registrado ainda para calcular cobertura`}</p></div></div>
    ${painel.reserva.metas.map(linhaMetaReserva).join("")}
  `;

  renderizarListaAtivos();
  ligarEventosGerais();
}

function renderizarListaAtivos() {
  const alvo = container.querySelector("#lista-ativos");
  if (!alvo) return;
  if (!painel.ativos.length) {
    alvo.innerHTML = `<div class="vazio">Nenhum ativo cadastrado.<div><button class="btn btn-primary" data-acao="novo-ativo-vazio">+ Novo ativo</button></div></div>`;
    alvo.querySelector('[data-acao="novo-ativo-vazio"]').addEventListener("click", () => abrirFormularioAtivo(null));
    return;
  }
  alvo.innerHTML = painel.ativos.map(cartaoAtivo).join("");
  alvo.querySelectorAll('[data-acao="editar"]').forEach((btn) => {
    btn.addEventListener("click", () => {
      const a = painel.ativos.find((x) => x.id === btn.dataset.id);
      if (a) abrirFormularioAtivo(a);
    });
  });
  alvo.querySelectorAll('[data-acao="apagar"]').forEach((btn) => {
    btn.addEventListener("click", () => {
      const a = painel.ativos.find((x) => x.id === btn.dataset.id);
      if (a) confirmarApagarAtivo(a);
    });
  });
}

function ligarEventosGerais() {
  const btnNovo = container.querySelector('[data-acao="novo-ativo"]');
  if (btnNovo) btnNovo.addEventListener("click", () => abrirFormularioAtivo(null));
}

function campoAtivoHtml(a) {
  const pessoasOpts = (painel.pessoas || []).map((p) => `<option value="${escapeHtml(p.id)}" ${a?.pessoaId === p.id ? "selected" : ""}>${escapeHtml(p.nome)}</option>`).join("");
  return `
    <div class="field"><label for="campo-ativo-nome">Nome</label>
      <input type="text" id="campo-ativo-nome" value="${escapeHtml(a?.nome || "")}" placeholder="Ex.: Apartamento, Tesouro Direto" required></div>
    <div class="field"><label for="campo-ativo-pessoa">Responsável</label>
      <select id="campo-ativo-pessoa" required><option value="" ${a?.pessoaId ? "" : "selected"}>Selecione uma pessoa</option>${pessoasOpts}</select></div>
    <div class="field"><label for="campo-ativo-classe">Classe</label>
      <select id="campo-ativo-classe">${CLASSES_ATIVO.map((c) => `<option value="${c}" ${a?.classe === c ? "selected" : ""}>${ROTULO_CLASSE[c]}</option>`).join("")}</select></div>
    <div class="field"><label for="campo-ativo-valor">Valor atual</label>
      <input type="text" inputmode="decimal" id="campo-ativo-valor" placeholder="0,00" value="${a ? formatarBRL(a.valorAtualCentavos).replace("R$ ", "") : ""}"></div>
    <div class="field"><label for="campo-ativo-data">Data da avaliação</label>
      <input type="date" id="campo-ativo-data" value="${escapeHtml(a?.dataAvaliacao || new Date().toISOString().slice(0, 10))}" required></div>
  `;
}

function abrirFormularioAtivo(a) {
  const editando = !!a;
  abrirModal(`
    <div class="modal">
      <h2>${editando ? "Editar" : "Novo"} ativo</h2>
      <div id="erro-formulario"></div>
      <form id="form-ativo" novalidate>
        ${campoAtivoHtml(a)}
        <div class="modal-actions">
          <button type="button" class="btn btn-ghost" data-acao="cancelar">Cancelar</button>
          <button type="submit" class="btn btn-primary">${editando ? "Salvar" : "Criar"}</button>
        </div>
      </form>
    </div>
  `);
  document.querySelector('[data-acao="cancelar"]').addEventListener("click", fecharModal);
  document.getElementById("form-ativo").addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const campos = {
      nome: document.getElementById("campo-ativo-nome").value,
      pessoaId: document.getElementById("campo-ativo-pessoa").value,
      classe: document.getElementById("campo-ativo-classe").value,
      valorAtualCentavos: paraCentavos(document.getElementById("campo-ativo-valor").value),
      dataAvaliacao: document.getElementById("campo-ativo-data").value,
    };
    try {
      if (editando) {
        await ativos.atualizar(a.id, campos);
        mostrarToast("Ativo atualizado.");
      } else {
        await ativos.criar(campos);
        mostrarToast("Ativo criado.");
      }
      fecharModal();
    } catch (erro) {
      const el = document.getElementById("erro-formulario");
      const msg = erro instanceof ErroDeValidacao ? erro.erros.join(" ") : "Não foi possível salvar. Tente novamente.";
      if (el) el.innerHTML = `<div class="erro-form">${escapeHtml(msg)}</div>`;
    }
  });
}

function confirmarApagarAtivo(a) {
  abrirModal(`
    <div class="modal">
      <h2>Apagar “${escapeHtml(a.nome)}”?</h2>
      <p class="tela-sub" style="margin-bottom:20px;">Esta ação não pode ser desfeita.</p>
      <div class="modal-actions">
        <button class="btn btn-ghost" data-acao="cancelar">Cancelar</button>
        <button class="btn btn-primary" style="background:var(--danger);" data-acao="confirmar">Apagar</button>
      </div>
    </div>
  `);
  document.querySelector('[data-acao="cancelar"]').addEventListener("click", fecharModal);
  document.querySelector('[data-acao="confirmar"]').addEventListener("click", async () => {
    await ativos.apagar(a.id);
    fecharModal();
    mostrarToast("Ativo apagado.");
  });
}
