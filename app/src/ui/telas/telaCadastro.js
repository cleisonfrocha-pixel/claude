// Fábrica de tela de cadastro CRUD — usada por pessoas, contas, cartões e
// categorias (Fase 0). Os quatro cadastros têm a mesma forma: lista com
// busca visual simples, botão de adicionar, modal com campos, editar,
// apagar. Em vez de repetir isso quatro vezes, cada cadastro só descreve
// os campos e como se exibe; esta fábrica cuida do resto.

import { paraCentavos, formatarBRL } from "../../domain/dinheiro.js";
import { escapeHtml, iniciais, mostrarToast } from "../utilitarios.js";
import { abrir as abrirModal, fechar as fecharModal } from "../modal.js";
import { ErroDeValidacao } from "../../dados/repositorios.js";

/**
 * @param {object} config
 * @param {object} config.repo - repositório (repositorios.js)
 * @param {string} config.titulo
 * @param {string} config.subtitulo
 * @param {string} config.rotuloNovo - texto do botão "+ Novo ..."
 * @param {Array}  config.campos - [{id, rotulo, tipo, opcoes?, origemContexto?, obrigatorio?, padrao?}]
 *   tipo: 'texto' | 'numero' | 'moeda' | 'data' | 'select' | 'select-contexto' | 'check'
 * @param {(dados: object, contexto: object) => {titulo, sub, valorDireita?, tag?}} config.exibir
 * @param {() => Promise<object>} [config.carregarContexto] - dados extra para selects dinâmicos (ex.: lista de pessoas)
 */
export function criarTelaCadastro(config) {
  let contexto = {};
  let itens = [];
  let pararAssinatura = null;

  async function montar(container) {
    container.innerHTML = `
      <div class="tela-head">
        <div>
          <h2 class="tela-titulo">${escapeHtml(config.titulo)}</h2>
          <p class="tela-sub">${escapeHtml(config.subtitulo)}</p>
        </div>
        <button class="btn btn-primary" data-acao="novo">+ ${escapeHtml(config.rotuloNovo)}</button>
      </div>
      <div class="lista-cartoes" id="lista-cadastro"></div>
    `;
    container.querySelector('[data-acao="novo"]').addEventListener("click", () => abrirFormulario(null));

    if (config.carregarContexto) {
      contexto = (await config.carregarContexto()) || {};
    }

    if (pararAssinatura) pararAssinatura();
    pararAssinatura = config.repo.assinar((lista) => {
      itens = lista;
      renderizarLista(container);
    });
  }

  function desmontar() {
    if (pararAssinatura) { pararAssinatura(); pararAssinatura = null; }
  }

  function renderizarLista(container) {
    const alvo = container.querySelector("#lista-cadastro");
    if (!alvo) return;
    if (!itens.length) {
      alvo.innerHTML = `
        <div class="vazio">
          Nenhum registro ainda.
          <div><button class="btn btn-primary" data-acao="novo-vazio">+ ${escapeHtml(config.rotuloNovo)}</button></div>
        </div>`;
      alvo.querySelector('[data-acao="novo-vazio"]').addEventListener("click", () => abrirFormulario(null));
      return;
    }
    alvo.innerHTML = itens.map((item) => {
      const v = config.exibir(item.dados, contexto);
      return `
        <div class="item-cartao" data-id="${escapeHtml(item.id)}">
          <div class="item-avatar">${escapeHtml(iniciais(v.titulo))}</div>
          <div class="item-corpo">
            <div class="item-titulo">${escapeHtml(v.titulo)}</div>
            <div class="item-sub">${escapeHtml(v.sub || "")}</div>
          </div>
          ${v.valorDireita != null ? `<div class="item-valor" data-valor>${escapeHtml(v.valorDireita)}</div>` : ""}
          ${v.tag ? `<span class="item-tag${v.tagInativa ? " inativa" : ""}">${escapeHtml(v.tag)}</span>` : ""}
          <div class="item-acoes">
            <button class="icon-btn" data-acao="editar" title="Editar" aria-label="Editar">✎</button>
            <button class="icon-btn danger" data-acao="apagar" title="Apagar" aria-label="Apagar">✕</button>
          </div>
        </div>`;
    }).join("");
    alvo.querySelectorAll('[data-acao="editar"]').forEach((btn) => {
      btn.addEventListener("click", (ev) => {
        const id = ev.target.closest(".item-cartao").dataset.id;
        const item = itens.find((i) => i.id === id);
        if (item) abrirFormulario(item);
      });
    });
    alvo.querySelectorAll('[data-acao="apagar"]').forEach((btn) => {
      btn.addEventListener("click", (ev) => {
        const id = ev.target.closest(".item-cartao").dataset.id;
        const item = itens.find((i) => i.id === id);
        if (item) confirmarApagar(item);
      });
    });
  }

  function confirmarApagar(item) {
    const v = config.exibir(item.dados, contexto);
    abrirModal(`
      <div class="modal">
        <h2>Apagar “${escapeHtml(v.titulo)}”?</h2>
        <p class="tela-sub" style="margin-bottom:20px;">Esta ação não pode ser desfeita.</p>
        <div class="modal-actions">
          <button class="btn btn-ghost" data-acao="cancelar">Cancelar</button>
          <button class="btn btn-primary" style="background:var(--danger);" data-acao="confirmar">Apagar</button>
        </div>
      </div>
    `);
    document.querySelector('[data-acao="cancelar"]').addEventListener("click", fecharModal);
    document.querySelector('[data-acao="confirmar"]').addEventListener("click", async () => {
      await config.repo.apagar(item.id);
      fecharModal();
      mostrarToast("Registro apagado.");
    });
  }

  function campoParaHtml(campo, valorAtual) {
    const id = `campo-${campo.id}`;
    const obrig = campo.obrigatorio ? "required" : "";
    if (campo.tipo === "check") {
      return `
        <label class="field-check">
          <input type="checkbox" id="${id}" ${valorAtual ? "checked" : ""}>
          ${escapeHtml(campo.rotulo)}
        </label>`;
    }
    let controle;
    if (campo.tipo === "select" || campo.tipo === "select-contexto") {
      const opcoes = campo.tipo === "select-contexto"
        ? (contexto[campo.origemContexto] || [])
        : campo.opcoes;
      controle = `<select id="${id}" ${obrig}>
        ${campo.permiteVazio ? `<option value="">${escapeHtml(campo.rotuloVazio || "Selecione")}</option>` : ""}
        ${opcoes.map((o) => `<option value="${escapeHtml(o.valor)}" ${String(valorAtual) === String(o.valor) ? "selected" : ""}>${escapeHtml(o.rotulo)}</option>`).join("")}
      </select>`;
    } else if (campo.tipo === "moeda") {
      const inicial = valorAtual != null ? formatarBRL(valorAtual).replace("R$ ", "") : "";
      controle = `<input type="text" inputmode="decimal" id="${id}" placeholder="0,00" value="${escapeHtml(inicial)}">`;
    } else if (campo.tipo === "numero") {
      controle = `<input type="number" id="${id}" value="${valorAtual != null ? escapeHtml(valorAtual) : ""}" min="${campo.min ?? ""}" max="${campo.max ?? ""}" ${obrig}>`;
    } else if (campo.tipo === "data") {
      controle = `<input type="date" id="${id}" value="${escapeHtml(valorAtual || "")}" ${obrig}>`;
    } else {
      controle = `<input type="text" id="${id}" value="${escapeHtml(valorAtual || "")}" placeholder="${escapeHtml(campo.placeholder || "")}" ${obrig}>`;
    }
    return `<div class="field"><label for="${id}">${escapeHtml(campo.rotulo)}</label>${controle}</div>`;
  }

  function lerCampo(campo) {
    const el = document.getElementById(`campo-${campo.id}`);
    if (!el) return undefined;
    if (campo.tipo === "check") return el.checked;
    if (campo.tipo === "moeda") return paraCentavos(el.value);
    if (campo.tipo === "numero") return el.value === "" ? null : Number(el.value);
    return el.value;
  }

  function abrirFormulario(item) {
    const editando = !!item;
    const dados = editando ? item.dados : {};
    const linhas = config.campos.map((c) => campoParaHtml(c, dados[c.id])).join("");
    abrirModal(`
      <div class="modal">
        <h2>${editando ? "Editar" : "Novo"} ${escapeHtml(config.singular)}</h2>
        <div id="erro-formulario"></div>
        <form id="form-cadastro">
          ${linhas}
          <div class="modal-actions">
            <button type="button" class="btn btn-ghost" data-acao="cancelar">Cancelar</button>
            <button type="submit" class="btn btn-primary">${editando ? "Salvar" : "Criar"}</button>
          </div>
        </form>
      </div>
    `);
    document.querySelector('[data-acao="cancelar"]').addEventListener("click", fecharModal);
    document.getElementById("form-cadastro").addEventListener("submit", async (ev) => {
      ev.preventDefault();
      const campos = {};
      config.campos.forEach((c) => { campos[c.id] = lerCampo(c); });
      try {
        if (editando) {
          await config.repo.atualizar(item.id, campos);
          mostrarToast(`${config.singular} atualizado${config.generoFeminino ? "a" : ""}.`);
        } else {
          await config.repo.criar(campos);
          mostrarToast(`${config.singular} criado${config.generoFeminino ? "a" : ""}.`);
        }
        fecharModal();
      } catch (erro) {
        const el = document.getElementById("erro-formulario");
        const msg = erro instanceof ErroDeValidacao ? erro.erros.join(" ") : "Não foi possível salvar. Tente novamente.";
        if (el) el.innerHTML = `<div class="erro-form">${escapeHtml(msg)}</div>`;
      }
    });
  }

  return { montar, desmontar };
}
