// Importar (§18). Duas etapas sempre separadas na tela também: "Analisar"
// só lê e mostra o que seria criado, nada é gravado até "Confirmar" — o
// usuário decide linha por linha o que entra, o que é duplicata (fica
// desmarcado por padrão) e o que é transferência entre contas próprias.

import { contas, pessoas, categorias, ErroDeValidacao } from "../../dados/repositorios.js";
import { analisarTexto, confirmarImportacao, assinarLotes } from "../../dados/importacaoRepo.js";
import { formatarBRL } from "../../domain/dinheiro.js";
import { formatarData } from "../../domain/tempo.js";
import { escapeHtml, mostrarToast } from "../utilitarios.js";

const ROTULO_FORMATO = { csv: "Planilha (CSV)", ofx: "Extrato bancário (OFX)" };

let container = null;
let ctx = { contas: [], pessoas: [], categorias: [] };
let candidatos = null; // null = ainda não analisou
let marcados = new Map(); // índice -> { marcado, categoriaId, pessoaId, confirmarComoTransferencia }
let ultimoFormato = "csv";
let ultimaContaId = "";
let ultimoTexto = "";
let lotes = [];
let pararAssinaturaLotes = null;
let loteExpandido = null;

export default {
  async montar(alvo) {
    container = alvo;
    candidatos = null;
    marcados = new Map();
    loteExpandido = null;
    const [listaContas, listaPessoas, listaCategorias] = await Promise.all([contas.listar(), pessoas.listar(), categorias.listar()]);
    ctx = {
      contas: listaContas.filter((c) => c.dados.status === "ativa").map((c) => ({ id: c.id, nome: c.dados.nome })),
      pessoas: listaPessoas.filter((p) => p.dados.ativo).map((p) => ({ id: p.id, nome: p.dados.nome })),
      categorias: listaCategorias.filter((c) => c.dados.ativa).map((c) => ({ id: c.id, nome: c.dados.nome, natureza: c.dados.natureza, ativa: true })),
    };
    if (pararAssinaturaLotes) pararAssinaturaLotes();
    pararAssinaturaLotes = assinarLotes((r) => { lotes = r; renderizar(); });
    renderizar();
  },
  desmontar() {
    if (pararAssinaturaLotes) { pararAssinaturaLotes(); pararAssinaturaLotes = null; }
    container = null;
    candidatos = null;
  },
};

function tagCandidato(c) {
  if (c.possivelDuplicata) return `<span class="item-tag critico">possível duplicata</span>`;
  if (c.possivelTransferencia) return `<span class="item-tag atencao">possível transferência</span>`;
  if (c.ambiguo) return `<span class="item-tag atencao">sem categoria sugerida</span>`;
  if (!c.valido) return `<span class="item-tag critico">linha inválida</span>`;
  return `<span class="item-tag">pronto</span>`;
}

function linhaCandidato(c, i) {
  const estado = marcados.get(i);
  const opcoesCategoria = ctx.categorias.filter((cat) => cat.natureza === c.tipo);
  return `
    <div class="item-cartao" style="align-items:flex-start;">
      <input type="checkbox" data-marca="${i}" ${estado.marcado ? "checked" : ""} ${!c.valido ? "disabled" : ""} style="margin-top:14px;">
      <div class="item-corpo">
        <div class="item-titulo">${escapeHtml(c.descricao || "(sem descrição)")} ${tagCandidato(c)}</div>
        <div class="item-sub">${c.data ? escapeHtml(formatarData(c.data)) : "data inválida"} · ${c.tipo}
          ${c.possivelDuplicata ? ` · ${escapeHtml(c.motivoDuplicata)}` : ""}</div>
        ${c.possivelTransferencia ? `
          <label class="field-check" style="margin-top:6px;">
            <input type="checkbox" data-transf="${i}" ${estado.confirmarComoTransferencia ? "checked" : ""}>
            Tratar como transferência entre contas próprias (não conta como receita nem despesa)
          </label>` : ""}
        ${(!c.possivelDuplicata && !c.possivelTransferencia && c.valido) ? `
          <div class="field" style="margin-top:6px;max-width:260px;">
            <label>Categoria</label>
            <select data-categoria="${i}">
              <option value="">Selecione uma categoria</option>
              ${opcoesCategoria.map((cat) => `<option value="${escapeHtml(cat.id)}" ${estado.categoriaId === cat.id ? "selected" : ""}>${escapeHtml(cat.nome)}</option>`).join("")}
            </select>
          </div>` : ""}
      </div>
      <div class="item-valor mono">${formatarBRL(Math.abs(c.valorCentavos || 0))}</div>
    </div>`;
}

function blocoLotes() {
  if (!lotes.length) return `<div class="vazio">Nenhuma importação feita ainda.</div>`;
  return `<div class="lista-cartoes">${lotes.map((l) => {
    const conta = ctx.contas.find((c) => c.id === l.contaId);
    const aberto = loteExpandido === l.id;
    return `
      <div class="item-cartao" data-id="${escapeHtml(l.id)}">
        <div class="item-corpo">
          <div class="item-titulo">${escapeHtml(ROTULO_FORMATO[l.formato] || l.formato)}${conta ? ` · ${escapeHtml(conta.nome)}` : ""}</div>
          <div class="item-sub">${escapeHtml(formatarData((l.criadoEm || "").slice(0, 10)))} · ${l.quantidadeCandidatos} lançamento${l.quantidadeCandidatos === 1 ? "" : "s"}</div>
        </div>
        <button class="icon-btn item-chevron${aberto ? " aberto" : ""}" data-acao="expandir-lote" data-id="${escapeHtml(l.id)}" title="Ver o texto original" aria-label="Ver o texto original">▾</button>
      </div>
      ${aberto ? `<div class="item-extra"><pre style="white-space:pre-wrap;word-break:break-word;font-family:inherit;margin:0;">${escapeHtml(l.texto)}</pre></div>` : ""}
    `;
  }).join("")}</div>`;
}

function renderizar() {
  if (!container) return;

  container.innerHTML = `
    <div class="tela-head" style="margin-top:0;">
      <div>
        <h2 class="tela-titulo">Importar</h2>
        <p class="tela-sub">Cole um extrato (CSV ou OFX) — nada é gravado até você revisar e confirmar. §18</p>
      </div>
    </div>

    <div class="field"><label for="imp-conta">Conta de destino</label>
      <select id="imp-conta">
        <option value="">Selecione uma conta</option>
        ${ctx.contas.map((c) => `<option value="${escapeHtml(c.id)}" ${ultimaContaId === c.id ? "selected" : ""}>${escapeHtml(c.nome)}</option>`).join("")}
      </select></div>

    <div class="field"><label>Formato</label>
      <div class="radio-group">
        <label class="radio-opt"><input type="radio" name="imp-formato" value="csv" ${ultimoFormato === "csv" ? "checked" : ""}> Planilha (CSV)</label>
        <label class="radio-opt"><input type="radio" name="imp-formato" value="ofx" ${ultimoFormato === "ofx" ? "checked" : ""}> Extrato bancário (OFX)</label>
      </div>
    </div>

    <div id="imp-colunas-csv" ${ultimoFormato !== "csv" ? "hidden" : ""}>
      <div class="row2">
        <div class="field"><label for="imp-col-data">Coluna da data (nº, começa em 0)</label><input type="number" id="imp-col-data" value="0" min="0"></div>
        <div class="field"><label for="imp-col-descricao">Coluna da descrição</label><input type="number" id="imp-col-descricao" value="1" min="0"></div>
      </div>
      <div class="row2">
        <div class="field"><label for="imp-col-valor">Coluna do valor</label><input type="number" id="imp-col-valor" value="2" min="0"></div>
        <label class="field-check" style="margin-top:26px;"><input type="checkbox" id="imp-cabecalho"> A primeira linha é cabeçalho</label>
      </div>
    </div>

    <div class="field"><label for="imp-texto">Conteúdo</label>
      <textarea id="imp-texto" rows="8" style="width:100%;font-family:var(--font-mono, monospace);font-size:13px;" placeholder="${ultimoFormato === "csv" ? "15/03/2026,Mercado,-150,00" : "Cole aqui o conteúdo do arquivo .ofx"}">${escapeHtml(ultimoTexto)}</textarea></div>

    <button class="btn btn-primary" id="imp-analisar">Analisar</button>

    ${candidatos ? `
      <div class="tela-head"><div><h3 class="tela-titulo" style="font-size:17px;">Revisão</h3>
        <p class="tela-sub">${candidatos.length} linha${candidatos.length === 1 ? "" : "s"} encontrada${candidatos.length === 1 ? "" : "s"} — desmarque o que não deve entrar</p></div></div>
      <div id="imp-lista-candidatos">${candidatos.map((c, i) => linhaCandidato(c, i)).join("")}</div>
      <button class="btn btn-primary" id="imp-confirmar" style="margin-top:12px;">Confirmar importação</button>
    ` : ""}

    <div class="tela-head"><div><h3 class="tela-titulo" style="font-size:17px;">Já importado</h3>
      <p class="tela-sub">Histórico dos lotes — o texto original fica guardado, mesmo que os lançamentos sejam editados depois</p></div></div>
    ${blocoLotes()}
  `;

  ligarEventos();
}

function ligarEventos() {
  container.querySelectorAll('input[name="imp-formato"]').forEach((r) => {
    r.addEventListener("change", () => {
      ultimoFormato = r.value;
      ultimoTexto = document.getElementById("imp-texto").value;
      renderizar();
    });
  });
  const selConta = container.querySelector("#imp-conta");
  if (selConta) selConta.addEventListener("change", () => { ultimaContaId = selConta.value; });

  const btnAnalisar = container.querySelector("#imp-analisar");
  if (btnAnalisar) {
    btnAnalisar.addEventListener("click", async () => {
      const contaId = document.getElementById("imp-conta").value;
      const texto = document.getElementById("imp-texto").value;
      ultimaContaId = contaId;
      ultimoTexto = texto;
      if (!contaId) { mostrarToast("Escolha a conta de destino."); return; }
      if (!texto.trim()) { mostrarToast("Cole o conteúdo antes de analisar."); return; }
      const colunas = ultimoFormato === "csv" ? {
        colunaData: parseInt(document.getElementById("imp-col-data").value, 10) || 0,
        colunaDescricao: parseInt(document.getElementById("imp-col-descricao").value, 10) || 0,
        colunaValor: parseInt(document.getElementById("imp-col-valor").value, 10) || 0,
        temCabecalho: document.getElementById("imp-cabecalho").checked,
      } : undefined;
      candidatos = await analisarTexto(texto, { formato: ultimoFormato, contaId, colunas });
      marcados = new Map(candidatos.map((c, i) => [i, {
        marcado: c.valido && !c.possivelDuplicata,
        categoriaId: c.categoriaSugeridaId || "",
        confirmarComoTransferencia: !!c.possivelTransferencia,
      }]));
      renderizar();
    });
  }

  container.querySelectorAll("[data-marca]").forEach((el) => {
    el.addEventListener("change", () => {
      const i = Number(el.dataset.marca);
      marcados.get(i).marcado = el.checked;
    });
  });
  container.querySelectorAll("[data-transf]").forEach((el) => {
    el.addEventListener("change", () => {
      const i = Number(el.dataset.transf);
      marcados.get(i).confirmarComoTransferencia = el.checked;
    });
  });
  container.querySelectorAll("[data-categoria]").forEach((el) => {
    el.addEventListener("change", () => {
      const i = Number(el.dataset.categoria);
      marcados.get(i).categoriaId = el.value;
    });
  });

  const btnConfirmar = container.querySelector("#imp-confirmar");
  if (btnConfirmar) {
    btnConfirmar.addEventListener("click", async () => {
      const aceitos = [];
      for (const [i, estado] of marcados.entries()) {
        if (!estado.marcado) continue;
        const c = candidatos[i];
        if (!c.possivelTransferencia && !estado.categoriaId) {
          mostrarToast("Escolha uma categoria para todo lançamento marcado.");
          return;
        }
        aceitos.push({ candidato: c, categoriaId: estado.categoriaId, confirmarComoTransferencia: estado.confirmarComoTransferencia });
      }
      if (!aceitos.length) { mostrarToast("Nada marcado para importar."); return; }
      const contaId = document.getElementById("imp-conta").value;
      const texto = document.getElementById("imp-texto").value;
      try {
        await confirmarImportacao({ texto, formato: ultimoFormato, contaId, aceitos });
        mostrarToast(`${aceitos.length} lançamento${aceitos.length === 1 ? "" : "s"} importado${aceitos.length === 1 ? "" : "s"}.`);
        candidatos = null;
        marcados = new Map();
        ultimoTexto = "";
        renderizar();
      } catch (erro) {
        mostrarToast(erro instanceof ErroDeValidacao ? erro.erros.join(" ") : "Não foi possível importar. Tente novamente.");
      }
    });
  }

  container.querySelectorAll('[data-acao="expandir-lote"]').forEach((btn) => {
    btn.addEventListener("click", () => {
      loteExpandido = loteExpandido === btn.dataset.id ? null : btn.dataset.id;
      renderizar();
    });
  });
}
