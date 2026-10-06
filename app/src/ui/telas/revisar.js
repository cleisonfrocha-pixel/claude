// Revisar (Fase 12, Sprint 4): o que ficou sem classificação, agrupado por
// favorecido. Uma resposta resolve todos os lançamentos do mesmo nome, e vale
// para os próximos extratos (regra). Nada some: cada lançamento continua na tela
// Transações, só muda de categoria ou vira "repasse" (dinheiro de terceiro que
// passou por você: mexe no saldo, não é renda nem gasto).

import { assinarFila, aplicarDecisao, aplicarRegrasGuardadas } from "../../dados/favorecidosRepo.js";
import { formatarBRL } from "../../domain/dinheiro.js";
import { formatarData } from "../../domain/tempo.js";
import { escapeHtml, mostrarToast } from "../utilitarios.js";

let container = null;
let fila = { grupos: [], categorias: [] };
let parar = null;
let ocupado = false;

export default {
  montar(alvo) {
    container = alvo;
    if (parar) parar();
    parar = assinarFila((r) => { fila = r; if (!ocupado) renderizar(); });
    renderizar();
  },
  desmontar() {
    if (parar) { parar(); parar = null; }
    container = null;
  },
};

function resumoGrupo(g) {
  const partes = [];
  if (g.saiuCentavos) partes.push(`saiu <span data-valor>${formatarBRL(g.saiuCentavos)}</span>`);
  if (g.entrouCentavos) partes.push(`entrou <span data-valor>${formatarBRL(g.entrouCentavos)}</span>`);
  const quando = g.desde === g.ate ? formatarData(g.desde) : `${formatarData(g.desde)} a ${formatarData(g.ate)}`;
  return `${g.quantidade} lançamento${g.quantidade === 1 ? "" : "s"} · ${partes.join(" e ")} · ${escapeHtml(quando)}`;
}

function opcoesDeCategoria(g) {
  const natureza = g.entrouCentavos && !g.saiuCentavos ? "receita" : "despesa";
  const lista = fila.categorias.filter((c) => c.natureza === natureza);
  return `<option value="">Escolher categoria</option>${lista.map((c) => `<option value="${escapeHtml(c.id)}">${escapeHtml(c.nome)}</option>`).join("")}`;
}

function cartaoDoGrupo(g, i) {
  return `
    <div class="item-cartao" style="align-items:flex-start;" data-grupo="${i}">
      <div class="item-corpo">
        <div class="item-titulo">${escapeHtml(g.nome)}</div>
        <div class="item-sub">${resumoGrupo(g)}</div>
        <div class="field" style="margin-top:8px;max-width:280px;">
          <label for="rev-cat-${i}">É o quê?</label>
          <select id="rev-cat-${i}" data-categoria="${i}">${opcoesDeCategoria(g)}</select>
        </div>
        <label class="field-check" style="margin-top:6px;">
          <input type="checkbox" data-lembrar="${i}" checked> Lembrar nos próximos extratos
        </label>
        <div class="acoes-linha" style="margin-top:8px;gap:8px;display:flex;flex-wrap:wrap;">
          <button class="btn-mini" data-acao="categoria" data-i="${i}">Aplicar a todos</button>
          <button class="btn-mini" data-acao="repasse" data-i="${i}" title="Dinheiro de outra pessoa que passou por você: não é renda nem gasto">É repasse</button>
        </div>
      </div>
    </div>`;
}

// Dez por vez (item 68 da lista de 05/10): a página com 59 favorecidos, cada um com a lista inteira
// de categorias, ficava enorme. Resolveu um, sobe o próximo.
const POR_VEZ = 10;

function renderizar() {
  if (!container) return;
  const total = fila.grupos.length;
  const pendentes = fila.grupos.reduce((s, g) => s + g.quantidade, 0);
  container.innerHTML = `
    <div class="tela-head" style="margin-top:0;">
      <div>
        <h2 class="tela-titulo">Revisar lançamentos</h2>
        <p class="tela-sub">Lançamentos sem classificação, agrupados por quem recebeu ou pagou. Uma resposta vale para todos do mesmo nome.</p>
      </div>
    </div>
    ${total ? `
      <p class="item-sub" style="margin:0 0 10px;"><strong>${pendentes}</strong> lançamento${pendentes === 1 ? "" : "s"} em <strong>${total}</strong> favorecido${total === 1 ? "" : "s"}. Os de mais dinheiro vêm primeiro.</p>
      <div style="margin-bottom:12px;"><button class="btn-mini" data-acao="regras">Aplicar regras que já tenho</button></div>
      <div class="lista-cartoes">${fila.grupos.slice(0, POR_VEZ).map(cartaoDoGrupo).join("")}</div>
      ${total > POR_VEZ ? `<p class="item-sub">Mostrando os ${POR_VEZ} de mais dinheiro. Quando você resolver estes, aparecem os próximos (faltam ${total - POR_VEZ}).</p>` : ""}`
    : `<div class="vazio">Nada para revisar. Tudo que entrou e saiu já tem categoria.</div>`}
  `;
  container.querySelectorAll("[data-acao]").forEach((b) => b.addEventListener("click", aoClicar));
}

async function aoClicar(e) {
  const b = e.currentTarget;
  const acao = b.dataset.acao;
  if (ocupado) return;
  ocupado = true;
  b.disabled = true;
  try {
    if (acao === "regras") {
      const n = await aplicarRegrasGuardadas();
      mostrarToast(n ? `${n} lançamento${n === 1 ? "" : "s"} classificado${n === 1 ? "" : "s"} pelas regras.` : "As regras guardadas não resolvem nada agora.");
    } else {
      const i = Number(b.dataset.i);
      const g = fila.grupos[i];
      const lembrar = container.querySelector(`[data-lembrar="${i}"]`)?.checked !== false;
      let decisao;
      if (acao === "repasse") decisao = { tipo: "repasse" };
      else {
        const categoriaId = container.querySelector(`[data-categoria="${i}"]`)?.value;
        if (!categoriaId) { mostrarToast("Escolha a categoria primeiro."); b.disabled = false; ocupado = false; return; }
        decisao = { tipo: "categoria", categoriaId };
      }
      const r = await aplicarDecisao(g, decisao, { lembrar });
      mostrarToast(`${g.nome}: ${r.mudados} lançamento${r.mudados === 1 ? "" : "s"} atualizado${r.mudados === 1 ? "" : "s"}${r.naoServiu ? `, ${r.naoServiu} não serviu${r.naoServiu === 1 ? "" : "ram"} (categoria de outra natureza)` : ""}.`);
    }
  } catch (erro) {
    mostrarToast(`Não deu: ${erro.message || erro}`);
  } finally {
    ocupado = false;
    renderizar();
  }
}
