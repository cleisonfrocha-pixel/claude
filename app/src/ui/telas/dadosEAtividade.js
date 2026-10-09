// Configurações › Dados: levar uma cópia completa embora e ver o que mudou
// por último. Nada aqui altera dado.

import { hojeISO } from "../../domain/tempo.js";
import { exportarJSON, exportarTransacoesCSV, atividade } from "../../dados/exportacaoRepo.js";
import { abrir as abrirModal, fechar as fecharModal } from "../modal.js";
import { escapeHtml, mostrarToast } from "../utilitarios.js";
import { formatarData } from "../../domain/tempo.js";

const ROTULO_COLECAO = {
  pessoas: "Pessoa", contas: "Conta", cartoes: "Cartão", categorias: "Categoria", dividas: "Dívida", fontesRenda: "Fonte de renda",
  ativos: "Bem", objetivos: "Meta", transacoes: "Lançamento", faturas: "Fatura", recorrencias: "Recorrência", decisoes: "Decisão",
  patrimonioSnapshots: "Retrato do patrimônio", lotesImportacao: "Importação",
};

let container = null;

export default {
  async montar(alvo) {
    container = alvo;
    alvo.innerHTML = `<p class="tela-sub">Carregando…</p>`;
    const recente = await atividade();
    if (!container) return;
    alvo.innerHTML = `
      <div class="tela-head" style="margin-top:0;"><div><h2 class="tela-titulo">Dados</h2>
        <p class="tela-sub">Seus dados são seus: leve uma cópia completa quando quiser.</p></div></div>
      <section class="inicio-bloco">
        <h3>Exportar</h3>
        <p class="tela-sub" style="margin:0 0 10px;">A cópia completa (JSON) tem tudo: pessoas, contas, cartões, lançamentos, dívidas, bens, metas e decisões. O CSV tem só os lançamentos, para abrir em planilha.</p>
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          <button class="btn btn-primary" data-exportar="json">Cópia completa (JSON)</button>
          <button class="btn btn-ghost" data-exportar="csv">Lançamentos (CSV)</button>
        </div>
      </section>
      <section class="inicio-bloco">
        <h3>Atividade recente</h3>
        ${recente.length ? `<div class="inicio-lista">${recente.map((a) => `
          <div class="inicio-linha" style="grid-template-columns:78px 1fr auto;">
            <span class="inicio-data">${escapeHtml(formatarData(a.quando.slice(0, 10)))}</span>
            <span class="inicio-desc">${escapeHtml(a.titulo)}<small> ${escapeHtml(ROTULO_COLECAO[a.colecao] || a.colecao)}</small></span>
            <small>${a.acao}</small>
          </div>`).join("")}</div>` : `<p class="tela-sub" style="margin:0;">Nada registrado ainda.</p>`}
      </section>`;
    alvo.querySelectorAll("[data-exportar]").forEach((b) => b.addEventListener("click", () => exportar(b.dataset.exportar)));
  },
  desmontar() { container = null; },
};

async function exportar(tipo) {
  const texto = tipo === "json" ? await exportarJSON() : await exportarTransacoesCSV();
  const nome = `painel-financeiro-${hojeISO()}.${tipo}`;
  abrirModal(`
    <div class="modal">
      <h2>Sua cópia está pronta</h2>
      <p class="tela-sub" style="margin:0 0 10px;">${escapeHtml(nome)}. Se o download não começar sozinho, copie o texto e cole num arquivo.</p>
      <textarea class="dados-texto" readonly id="dados-texto"></textarea>
      <div class="modal-actions" style="margin-top:12px;">
        <button class="btn btn-ghost" data-acao="fechar">Fechar</button>
        <button class="btn btn-ghost" data-acao="copiar">Copiar</button>
        <button class="btn btn-primary" data-acao="baixar">Baixar</button>
      </div>
    </div>`);
  const area = document.getElementById("dados-texto");
  area.value = texto;
  document.querySelector('[data-acao="fechar"]').addEventListener("click", fecharModal);
  document.querySelector('[data-acao="copiar"]').addEventListener("click", async () => {
    try { await navigator.clipboard.writeText(texto); mostrarToast("Copiado."); }
    catch (e) { area.select(); mostrarToast("Selecionei o texto: use copiar do seu aparelho."); }
  });
  document.querySelector('[data-acao="baixar"]').addEventListener("click", () => {
    try {
      const url = URL.createObjectURL(new Blob([texto], { type: tipo === "json" ? "application/json" : "text/csv;charset=utf-8" }));
      const a = document.createElement("a");
      a.href = url; a.download = nome;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      mostrarToast("Download iniciado.");
    } catch (e) { mostrarToast("Não consegui baixar aqui: use Copiar."); }
  });
}
