// Gerenciar recorrências — antes só existia `recorrencias.criar()`, chamado
// de dentro de Transações; não havia como ver, pausar ou editar uma
// recorrência já criada depois disso (achado #12 da auditoria de UX). Uma
// recorrência pausada para de gerar novos meses (`gerarPendentes` só roda
// quando `ativa`), mas os lançamentos já gerados continuam existindo — a
// pausa afeta o futuro, não apaga o passado.

import { recorrencias } from "../../dados/recorrenciasRepo.js";
import { pessoas, contas, cartoes, categorias, ErroDeValidacao } from "../../dados/repositorios.js";
import { formatarBRL, paraCentavos } from "../../domain/dinheiro.js";
import { competenciaLabel } from "../../domain/tempo.js";
import { abrir as abrirModal, fechar as fecharModal } from "../modal.js";
import { escapeHtml, mostrarToast } from "../utilitarios.js";

const ROTULO_TIPO = { despesa: "Despesa", receita: "Receita" };

let lista = [];
let contexto = { pessoas: [], contas: [], cartoes: [], categorias: [] };
let pararAssinatura = null;
let container = null;

export default {
  async montar(alvo) {
    container = alvo;
    await carregarContexto();
    if (pararAssinatura) pararAssinatura();
    pararAssinatura = recorrencias.assinar((nova) => { lista = nova; renderizar(); });
    renderizar();
  },
  desmontar() {
    if (pararAssinatura) { pararAssinatura(); pararAssinatura = null; }
    container = null;
  },
};

async function carregarContexto() {
  const [p, c, ca, cat] = await Promise.all([pessoas.listar(), contas.listar(), cartoes.listar(), categorias.listar()]);
  contexto = { pessoas: p, contas: c, cartoes: ca, categorias: cat };
}

function nomeConta(id) { return (contexto.contas.find((c) => c.id === id) || {}).dados?.nome || "-"; }
function nomeCartao(id) { return (contexto.cartoes.find((c) => c.id === id) || {}).dados?.apelido || "-"; }
function nomeCategoria(id) { return (contexto.categorias.find((c) => c.id === id) || {}).dados?.nome || null; }

function opcoes(lista2, valorFn, rotuloFn) {
  return lista2.map((i) => ({ valor: valorFn(i), rotulo: rotuloFn(i) }));
}

function renderizar() {
  if (!container) return;
  container.innerHTML = `
    <div class="tela-head" style="margin-top:0;">
      <div>
        <h2 class="tela-titulo">Recorrências</h2>
        <p class="tela-sub">Compromissos mensais que geram lançamentos sozinhos. Pausar interrompe os próximos meses. O que já foi lançado continua.</p>
      </div>
    </div>
    <div class="lista-cartoes" id="lista-recorrencias"></div>
  `;
  renderizarLista();
}

function renderizarLista() {
  const alvo = container.querySelector("#lista-recorrencias");
  if (!alvo) return;
  if (!lista.length) {
    alvo.innerHTML = `<div class="vazio">Nenhuma recorrência cadastrada ainda. Crie uma em Dinheiro → Transações → Nova transação → Recorrente.</div>`;
    return;
  }
  const ordenada = lista.slice().sort((a, b) => (a.dados.descricao || "").localeCompare(b.dados.descricao || ""));
  alvo.innerHTML = ordenada.map(linhaRecorrencia).join("");

  alvo.querySelectorAll("[data-editar]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const item = lista.find((r) => r.id === btn.getAttribute("data-editar"));
      if (item) abrirModalEditar(item);
    });
  });
  alvo.querySelectorAll("[data-pausar]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const item = lista.find((r) => r.id === btn.getAttribute("data-pausar"));
      if (!item) return;
      await recorrencias.atualizar(item.id, { ativa: !item.dados.ativa });
      mostrarToast(item.dados.ativa ? "Recorrência pausada." : "Recorrência retomada.");
    });
  });
  alvo.querySelectorAll("[data-apagar]").forEach((btn) => {
    btn.addEventListener("click", () => confirmarApagar(btn.getAttribute("data-apagar")));
  });
}

function linhaRecorrencia(item) {
  const d = item.dados;
  const destino = d.cartaoId ? nomeCartao(d.cartaoId) : (d.contaId ? nomeConta(d.contaId) : "");
  const categoria = d.categoriaId ? nomeCategoria(d.categoriaId) : null;
  const sub = [`todo dia ${d.diaBase}`, destino, categoria].filter(Boolean).join(" · ");
  const classeValor = d.tipo === "receita" ? "valor-pos" : "valor-neg";
  const sinal = d.tipo === "receita" ? "+" : "−";
  return `
    <div class="item-cartao">
      <div class="item-corpo">
        <div class="item-titulo">${escapeHtml(d.descricao || ROTULO_TIPO[d.tipo])}</div>
        <div class="item-sub">${escapeHtml(sub)}${d.fim ? ` · até ${escapeHtml(competenciaLabel(d.fim))}` : ""}</div>
      </div>
      <div class="item-valor mono ${classeValor}" data-valor>${sinal}${formatarBRL(d.valorEstimadoCentavos)}</div>
      <span class="item-tag${d.ativa ? "" : " inativa"}">${d.ativa ? "ativa" : "pausada"}</span>
      <div class="item-acoes">
        <button class="icon-btn" title="${d.ativa ? "Pausar" : "Retomar"}" aria-label="${d.ativa ? "Pausar" : "Retomar"}" data-pausar="${escapeHtml(item.id)}">${d.ativa ? "⏸" : "▶"}</button>
        <button class="icon-btn" title="Editar" aria-label="Editar" data-editar="${escapeHtml(item.id)}">✎</button>
        <button class="icon-btn danger" title="Apagar" aria-label="Apagar" data-apagar="${escapeHtml(item.id)}">✕</button>
      </div>
    </div>`;
}

function campoOndeConta(idPrefixo, atual) {
  const contasOpts = opcoes(contexto.contas.filter((c) => c.dados.status === "ativa"), (c) => c.id, (c) => c.dados.nome);
  const cartoesOpts = opcoes(contexto.cartoes.filter((c) => c.dados.status === "ativo"), (c) => c.id, (c) => c.dados.apelido);
  const ondeAtual = atual?.cartaoId ? "cartao" : "conta";
  return `
    <div class="field"><label for="${idPrefixo}-onde">Onde</label>
      <select id="${idPrefixo}-onde">
        <option value="conta" ${ondeAtual === "conta" ? "selected" : ""}>Conta</option>
        <option value="cartao" ${ondeAtual === "cartao" ? "selected" : ""}>Cartão</option>
      </select>
    </div>
    <div class="field" id="${idPrefixo}-campo-conta" ${ondeAtual === "cartao" ? "hidden" : ""}><label for="${idPrefixo}-conta">Conta</label>
      <select id="${idPrefixo}-conta">${contasOpts.map((o) => `<option value="${escapeHtml(o.valor)}" ${atual?.contaId === o.valor ? "selected" : ""}>${escapeHtml(o.rotulo)}</option>`).join("")}</select></div>
    <div class="field" id="${idPrefixo}-campo-cartao" ${ondeAtual === "conta" ? "hidden" : ""}><label for="${idPrefixo}-cartao">Cartão</label>
      <select id="${idPrefixo}-cartao">${cartoesOpts.map((o) => `<option value="${escapeHtml(o.valor)}" ${atual?.cartaoId === o.valor ? "selected" : ""}>${escapeHtml(o.rotulo)}</option>`).join("")}</select></div>`;
}

function ligarAlternanciaOnde(idPrefixo) {
  const onde = document.getElementById(`${idPrefixo}-onde`);
  if (!onde) return;
  onde.addEventListener("change", () => {
    document.getElementById(`${idPrefixo}-campo-conta`).hidden = onde.value !== "conta";
    document.getElementById(`${idPrefixo}-campo-cartao`).hidden = onde.value !== "cartao";
  });
}

function campoCategoria(idPrefixo, natureza, atual) {
  const cats = opcoes(contexto.categorias.filter((c) => c.dados.ativa && c.dados.natureza === natureza), (c) => c.id, (c) => c.dados.nome);
  return `<div class="field"><label for="${idPrefixo}-categoria">Categoria</label>
    <select id="${idPrefixo}-categoria">${cats.length ? cats.map((o) => `<option value="${escapeHtml(o.valor)}" ${atual === o.valor ? "selected" : ""}>${escapeHtml(o.rotulo)}</option>`).join("") : '<option value="">Nenhuma categoria cadastrada</option>'}</select></div>`;
}

function campoPessoa(idPrefixo, atual) {
  const ps = opcoes(contexto.pessoas.filter((p) => p.dados.ativo), (p) => p.id, (p) => p.dados.nome);
  return `<div class="field"><label for="${idPrefixo}-pessoa">Pessoa</label>
    <select id="${idPrefixo}-pessoa">${ps.map((o) => `<option value="${escapeHtml(o.valor)}" ${atual === o.valor ? "selected" : ""}>${escapeHtml(o.rotulo)}</option>`).join("")}</select></div>`;
}

function abrirModalEditar(item) {
  const d = item.dados;
  const html = `
    <div class="modal">
      <h2>Editar recorrência</h2>
      <div id="erro-formulario"></div>
      <form id="form-editar-recorrencia" novalidate>
        <div class="field"><label>Tipo</label>
          <div class="radio-group">
            <label class="radio-opt"><input type="radio" name="rc-tipo" value="despesa" ${d.tipo === "despesa" ? "checked" : ""}> Despesa</label>
            <label class="radio-opt"><input type="radio" name="rc-tipo" value="receita" ${d.tipo === "receita" ? "checked" : ""}> Receita</label>
          </div>
        </div>
        ${campoOndeConta("rc", d)}
        <div class="row2">
          <div class="field"><label for="rc-valor">Valor estimado</label><input type="text" inputmode="decimal" id="rc-valor" placeholder="0,00" value="${formatarBRL(d.valorEstimadoCentavos).replace("R$ ", "")}"></div>
          <div class="field"><label for="rc-dia">Dia do mês</label><input type="number" id="rc-dia" min="1" max="31" value="${d.diaBase}"></div>
        </div>
        <div id="rc-categoria-wrap">${campoCategoria("rc", d.tipo, d.categoriaId)}</div>
        ${campoPessoa("rc", d.pessoaId)}
        <div class="field"><label for="rc-descricao">Descrição</label><input type="text" id="rc-descricao" value="${escapeHtml(d.descricao || "")}"></div>
        <div class="field"><label for="rc-fim">Encerra em (opcional)</label><input type="month" id="rc-fim" value="${escapeHtml(d.fim || "")}"></div>
        <div class="modal-actions">
          <button type="button" class="btn btn-ghost" data-acao="cancelar">Cancelar</button>
          <button type="submit" class="btn btn-primary">Salvar</button>
        </div>
      </form>
    </div>`;
  abrirModal(html);
  document.querySelector('[data-acao="cancelar"]').addEventListener("click", fecharModal);
  ligarAlternanciaOnde("rc");
  document.querySelectorAll('input[name="rc-tipo"]').forEach((r) => {
    r.addEventListener("change", () => {
      document.getElementById("rc-categoria-wrap").innerHTML = campoCategoria("rc", r.value);
    });
  });
  document.getElementById("form-editar-recorrencia").addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const erroEl = document.getElementById("erro-formulario");
    erroEl.innerHTML = "";
    try {
      const tipo = document.querySelector('input[name="rc-tipo"]:checked').value;
      const onde = document.getElementById("rc-onde").value;
      await recorrencias.atualizar(item.id, {
        tipo,
        valorEstimadoCentavos: paraCentavos(document.getElementById("rc-valor").value),
        diaBase: parseInt(document.getElementById("rc-dia").value, 10),
        contaId: onde === "conta" ? document.getElementById("rc-conta").value : null,
        cartaoId: onde === "cartao" ? document.getElementById("rc-cartao").value : null,
        categoriaId: document.getElementById("rc-categoria")?.value || "",
        pessoaId: document.getElementById("rc-pessoa").value,
        descricao: document.getElementById("rc-descricao").value.trim(),
        fim: document.getElementById("rc-fim").value || null,
      });
      mostrarToast("Recorrência atualizada.");
      fecharModal();
    } catch (erro) {
      const msg = erro instanceof ErroDeValidacao ? erro.erros.join(" ") : "Não foi possível salvar. Tente novamente.";
      erroEl.innerHTML = `<div class="erro-form">${escapeHtml(msg)}</div>`;
    }
  });
}

function confirmarApagar(id) {
  abrirModal(`
    <div class="modal">
      <h2>Apagar esta recorrência?</h2>
      <p class="tela-sub" style="margin-bottom:20px;">Os lançamentos já gerados continuam existindo. Só para de gerar novos meses. Não pode ser desfeito.</p>
      <div class="modal-actions">
        <button class="btn btn-ghost" data-acao="cancelar">Cancelar</button>
        <button class="btn btn-primary" style="background:var(--danger);" data-acao="confirmar">Apagar</button>
      </div>
    </div>`);
  document.querySelector('[data-acao="cancelar"]').addEventListener("click", fecharModal);
  document.querySelector('[data-acao="confirmar"]').addEventListener("click", async () => {
    await recorrencias.apagar(id);
    fecharModal();
    mostrarToast("Recorrência apagada.");
  });
}
