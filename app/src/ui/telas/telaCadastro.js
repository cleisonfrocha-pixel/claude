// Fábrica de tela de cadastro CRUD — usada por pessoas, contas, cartões e
// categorias (Fase 0). Os quatro cadastros têm a mesma forma: lista com
// busca visual simples, botão de adicionar, modal com campos, editar,
// apagar. Em vez de repetir isso quatro vezes, cada cadastro só descreve
// os campos e como se exibe; esta fábrica cuida do resto.

import { avatarMarcaHtml } from "../avatarMarca.js";
import { paraCentavos, formatarBRL, valorDigitadoValido } from "../../domain/dinheiro.js";
import { escapeHtml, mostrarToast } from "../utilitarios.js";
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
 * @param {(dados: object, contexto: object, id: string) => {titulo, sub, valorDireita?, tag?}} config.exibir
 * @param {() => Promise<object>} [config.carregarContexto] - dados extra para selects dinâmicos (ex.: lista de pessoas)
 * @param {(dados: object, id: string, contexto: object) => string} [config.renderExtra] - quando presente,
 *   cada item ganha uma seta de expandir; ao abrir, mostra o HTML retornado aqui (ex.: fatura atual/próxima
 *   de um cartão). Calculado a partir do `contexto` carregado no mount — não é ao vivo dentro do detalhe
 *   expandido; reabrir a aba atualiza.
 * @param {(dados: object, id: string, contexto: object, elExtra: HTMLElement) => void} [config.aoRenderizarExtra] -
 *   chamado logo depois que o HTML de `renderExtra` entra no DOM, com o próprio elemento — é onde um
 *   cadastro liga interatividade dentro do painel expandido (ex.: o simulador de dívidas), sem duplicar
 *   a lógica de lista/expandir desta fábrica.
 * @param {(itens: Array, contexto: object) => Array<{titulo: string, sub?: string, ids: string[]}>} [config.secoes] - quando
 *   presente, a lista é dividida em seções (cada uma com título e os ids dos itens que ficam nela)
 * @param {(itens: Array, contexto: object) => string} [config.resumo] - quando presente, um bloco de
 *   visão consolidada renderizado acima da lista, recalculado toda vez que a lista muda.
 */
export function criarTelaCadastro(config) {
  let contexto = {};
  let itens = [];
  let pararAssinatura = null;
  let containerAtual = null;
  const expandidos = new Set();

  async function montar(container) {
    containerAtual = container;
    container.innerHTML = `
      <div class="tela-head">
        <div>
          <h2 class="tela-titulo">${escapeHtml(config.titulo)}</h2>
          <p class="tela-sub">${escapeHtml(config.subtitulo)}</p>
        </div>
        <button class="btn btn-primary" data-acao="novo">+ ${escapeHtml(config.rotuloNovo)}</button>
      </div>
      ${config.resumo ? `<div id="resumo-cadastro"></div>` : ""}
      <div class="lista-cartoes" id="lista-cadastro"></div>
    `;
    container.querySelector('[data-acao="novo"]').addEventListener("click", () => abrirFormulario(null));

    if (config.carregarContexto) {
      contexto = (await config.carregarContexto()) || {};
    }

    if (pararAssinatura) pararAssinatura();
    pararAssinatura = config.repo.assinar((lista) => {
      itens = lista;
      renderizarLista();
    });
  }

  function desmontar() {
    if (pararAssinatura) { pararAssinatura(); pararAssinatura = null; }
    containerAtual = null;
    expandidos.clear();
  }

  function renderizarLista() {
    if (!containerAtual) return;
    const alvo = containerAtual.querySelector("#lista-cadastro");
    if (!alvo) return;
    if (config.resumo) {
      const elResumo = containerAtual.querySelector("#resumo-cadastro");
      if (elResumo) elResumo.innerHTML = config.resumo(itens, contexto);
    }
    if (!itens.length) {
      alvo.innerHTML = `
        <div class="vazio">
          Nenhum registro ainda.
          <div><button class="btn btn-primary" data-acao="novo-vazio">+ ${escapeHtml(config.rotuloNovo)}</button></div>
        </div>`;
      alvo.querySelector('[data-acao="novo-vazio"]').addEventListener("click", () => abrirFormulario(null));
      return;
    }
    const htmlDoItem = (item) => {
      const v = config.exibir(item.dados, contexto, item.id);
      const expansivel = typeof config.renderExtra === "function";
      const aberto = expansivel && expandidos.has(item.id);
      return `
        <div class="item-cartao" data-id="${escapeHtml(item.id)}">
          ${avatarMarcaHtml([v.titulo, v.sub])}
          <div class="item-corpo">
            <div class="item-titulo">${escapeHtml(v.titulo)}</div>
            <div class="item-sub">${escapeHtml(v.sub || "")}</div>
          </div>
          ${v.valorDireita != null ? `<div class="item-valor" data-valor>${escapeHtml(v.valorDireita)}</div>` : ""}
          ${v.tag ? `<span class="item-tag${v.tagInativa ? " inativa" : ""}${v.tagClasse ? " " + escapeHtml(v.tagClasse) : ""}">${escapeHtml(v.tag)}</span>` : ""}
          ${v.evolucaoHtml || ""}
          ${v.barra ? `<div class="item-barra"><div class="barra-limite"><span style="width:${Math.max(0, Math.min(100, v.barra.percentual))}%"></span></div><div class="item-barra-texto"><span>${escapeHtml(v.barra.esquerda || "")}</span><span data-valor>${escapeHtml(v.barra.direita || "")}</span></div></div>` : ""}
          <div class="item-acoes">
            ${v.acaoPrimaria ? `<button class="btn-mini btn-baixa" data-acao="primaria">${escapeHtml(v.acaoPrimaria)}</button>` : ""}
            ${(v.acoesExtras || []).map((x) => `<button class="btn-mini btn-extra" data-acao="extra" data-extra="${escapeHtml(x.id)}">${escapeHtml(x.rotulo)}</button>`).join("")}
            ${expansivel ? `<button class="btn-mini${aberto ? " ativo" : ""}" data-acao="expandir" aria-expanded="${aberto}">${aberto ? "Fechar" : (config.rotuloDetalhes || "Detalhes")}</button>` : ""}
            <button class="btn-mini" data-acao="editar">Editar</button>
            <button class="btn-mini perigo" data-acao="apagar">Apagar</button>
          </div>
        </div>
        ${aberto ? `<div class="item-extra" data-extra-id="${escapeHtml(item.id)}">${config.renderExtra(item.dados, item.id, contexto)}</div>` : ""}`;
    };
    if (typeof config.secoes === "function") {
      const secoes = config.secoes(itens, contexto);
      alvo.innerHTML = secoes.map((sec) => {
        const doGrupo = itens.filter((i) => sec.ids.includes(i.id));
        return `
          <div class="tela-head" style="margin:18px 0 8px;"><div><h3 class="tela-titulo" style="font-size:15px;">${escapeHtml(sec.titulo)} <span class="tela-sub" style="display:inline;">(${doGrupo.length})</span></h3>
            ${sec.sub ? `<p class="tela-sub">${sec.sub}</p>` : ""}</div></div>
          ${doGrupo.length ? doGrupo.map(htmlDoItem).join("") : `<div class="tela-sub">Nenhuma.</div>`}`;
      }).join("");
    } else {
      alvo.innerHTML = itens.map(htmlDoItem).join("");
    }
    if (typeof config.aoRenderizarExtra === "function") {
      itens.forEach((item) => {
        if (!expandidos.has(item.id)) return;
        const elExtra = alvo.querySelector(`[data-extra-id="${item.id}"]`);
        if (elExtra) config.aoRenderizarExtra(item.dados, item.id, contexto, elExtra);
      });
    }
    alvo.querySelectorAll('[data-acao="primaria"]').forEach((btn) => {
      btn.addEventListener("click", async (ev) => {
        const item = itens.find((i) => i.id === ev.target.closest(".item-cartao").dataset.id);
        if (!item || typeof config.aoAcaoPrimaria !== "function") return;
        btn.disabled = true;
        try { await config.aoAcaoPrimaria(item, contexto); } finally { btn.disabled = false; }
      });
    });
    alvo.querySelectorAll('[data-acao="extra"]').forEach((btn) => {
      btn.addEventListener("click", async () => {
        const item = itens.find((i) => i.id === btn.closest(".item-cartao")?.dataset.id);
        if (item && typeof config.aoAcaoExtra === "function") await config.aoAcaoExtra(btn.dataset.extra, item, contexto);
      });
    });
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
    alvo.querySelectorAll('[data-acao="expandir"]').forEach((btn) => {
      btn.addEventListener("click", (ev) => {
        const id = ev.target.closest(".item-cartao").dataset.id;
        if (expandidos.has(id)) expandidos.delete(id); else expandidos.add(id);
        renderizarLista();
      });
    });
  }

  function confirmarApagar(item) {
    const v = config.exibir(item.dados, contexto, item.id);
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
      // "valorMarcado"/"valorDesmarcado" deixam a caixa dirigir um campo de
      // texto com dois valores (ex.: status "ativa"/"encerrada"), não só um
      // booleano puro — ver lerCampo(). Em registro novo, valorAtual vem de
      // um objeto vazio (undefined): sem "padrao" a caixa nasceria sempre
      // desmarcada, mesmo quando o padrão do domínio é o contrário (ex.:
      // pessoa/categoria nascem ativas).
      const temMapa = Object.prototype.hasOwnProperty.call(campo, "valorMarcado");
      const marcado = valorAtual != null
        ? (temMapa ? valorAtual === campo.valorMarcado : !!valorAtual)
        : (temMapa ? campo.padrao === campo.valorMarcado : !!campo.padrao);
      return `
        <label class="field-check">
          <input type="checkbox" id="${id}" ${marcado ? "checked" : ""}>
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
      controle = `<input type="number" id="${id}" value="${valorAtual != null ? escapeHtml(valorAtual) : ""}" min="${campo.min ?? ""}" max="${campo.max ?? ""}" step="${campo.step ?? "any"}" ${obrig}>`;
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
    if (campo.tipo === "check") {
      if (Object.prototype.hasOwnProperty.call(campo, "valorMarcado")) {
        return el.checked ? campo.valorMarcado : campo.valorDesmarcado;
      }
      return el.checked;
    }
    if (campo.tipo === "moeda") {
      if (el.value.trim() && !valorDigitadoValido(el.value)) throw new ErroDeValidacao([`${campo.rotulo}: valor não reconhecido. Use o formato 1.234,56.`]);
      return paraCentavos(el.value);
    }
    if (campo.tipo === "numero") return el.value === "" ? null : Number(el.value);
    return el.value;
  }

  function abrirFormulario(item) {
    const editando = !!item;
    const dados = editando ? item.dados : {};
    const linhas = config.campos.map((c) => campoParaHtml(c, dados[c.id])).join("");
    abrirModal(`
      <div class="modal">
        <h2>${editando ? "Editar" : config.generoFeminino ? "Nova" : "Novo"} ${escapeHtml(config.singular)}</h2>
        <div id="erro-formulario"></div>
        <form id="form-cadastro" novalidate>
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
      try {
        config.campos.forEach((c) => { campos[c.id] = lerCampo(c); });
        if (editando) {
          await config.repo.atualizar(item.id, campos);
          mostrarToast(`${config.singular} atualizad${config.generoFeminino ? "a" : "o"}.`);
        } else {
          await config.repo.criar(campos);
          mostrarToast(`${config.singular} criad${config.generoFeminino ? "a" : "o"}.`);
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
