// Configurações › Sobre nós. A base de conhecimento que o gerador de plano e a IA leem antes de opinar:
// quem somos, a regra do dinheiro, os negócios, o momento e as datas que pesam. Texto livre, editável.

import { assinarPerfil, salvarPerfil } from "../../dados/perfilRepo.js";
import { formatarData, hojeISO } from "../../domain/tempo.js";
import { prazosQueVem } from "../../domain/perfil.js";
import { escapeHtml, mostrarToast } from "../utilitarios.js";

let container = null;
let parar = null;
let perfil = null;
let editando = null; // id da seção em edição, "nova" ou null

const novoId = () => `s${Date.now().toString(36)}`;

async function gravar(mudanca, aviso = "Salvo.") {
  try { perfil = await salvarPerfil({ ...perfil, ...mudanca }); mostrarToast(aviso); } catch (e) { mostrarToast(e.message || "Não consegui salvar."); }
}

function renderizar() {
  if (!container || !perfil) return;
  const hoje = hojeISO();
  const prazos = [...(perfil.prazos || [])].sort((a, b) => a.data.localeCompare(b.data));
  const secao = (s) => editando === s.id ? `
    <section class="inicio-bloco" data-sec="${escapeHtml(s.id)}">
      <div class="field"><label>Título</label><input type="text" data-campo="titulo" value="${escapeHtml(s.titulo)}"></div>
      <div class="field"><label>O que o painel precisa saber</label><textarea data-campo="texto" rows="9" style="width:100%;">${escapeHtml(s.texto)}</textarea></div>
      <div class="modal-actions"><button class="btn btn-ghost" data-a="cancelar">Cancelar</button><button class="btn btn-primary" data-a="salvar">Salvar</button></div>
    </section>` : `
    <section class="inicio-bloco" data-sec="${escapeHtml(s.id)}">
      <h3>${escapeHtml(s.titulo)}</h3>
      <p class="tela-sub" style="white-space:pre-wrap;color:var(--text);margin:0 0 8px;">${escapeHtml(s.texto)}</p>
      <details class="menu-mais"><summary class="btn-mini" aria-label="Mais opções">⋯</summary><div class="menu-mais-lista"><button class="btn-mini" data-a="editar">Editar</button><button class="btn-mini perigo" data-a="apagar">Apagar</button></div></details>
    </section>`;
  const nova = editando === "nova" ? secao({ id: "nova", titulo: "", texto: "" }) : "";
  container.innerHTML = `
    <p class="tela-sub" style="margin:0 0 12px;">É o que o painel não sabe sozinho. Todo plano e toda resposta da IA leem isso antes de opinar. Quanto mais certo, menos genérico.</p>
    <section class="inicio-bloco">
      <label class="field-check"><input type="checkbox" id="perfil-fechado" ${perfil.regras?.contarSoDinheiroFechado ? "checked" : ""}> Só contar dinheiro fechado (negociação, ideia e expectativa de venda não entram em plano nenhum)</label>
    </section>
    <section class="inicio-bloco">
      <h3>Datas que pesam</h3>
      ${prazos.length ? prazos.map((p) => { const d = prazosQueVem({ prazos: [p] }, hoje, { dias: 9999 })[0]; return `<div class="fatura-linha" data-prazo="${escapeHtml(p.id)}"><span class="rotulo">${escapeHtml(p.titulo)}<small>${escapeHtml(formatarData(p.data))}${d ? (d.diasAte >= 0 ? ` · faltam ${d.diasAte} dias` : " · já passou") : ""}${p.nota ? ` · ${escapeHtml(p.nota)}` : ""}</small></span><button class="btn-mini perigo" data-a="tirar-prazo">Tirar</button></div>`; }).join("") : `<p class="tela-sub">Nenhuma data cadastrada.</p>`}
      <div class="row2" style="margin-top:10px;"><div class="field"><label for="pz-titulo">O que acontece</label><input type="text" id="pz-titulo" placeholder="Ex.: Decidir sobre a GEDI"></div><div class="field"><label for="pz-data">Dia</label><input type="date" id="pz-data"></div></div>
      <button class="btn btn-ghost btn-sm" data-a="novo-prazo">Adicionar data</button>
    </section>
    ${nova}
    ${(perfil.secoes || []).map(secao).join("")}
    <button class="btn btn-primary" data-a="nova-secao" style="margin-top:6px;">+ Nova seção</button>
    ${!(perfil.secoes || []).length ? `<div class="vazio">Ainda não há nada aqui. Conte quem vocês são, os negócios e o momento. Pode ser em texto corrido.</div>` : ""}`;
  ligar();
}

function ligar() {
  container.querySelector("#perfil-fechado")?.addEventListener("change", (ev) => gravar({ regras: { ...perfil.regras, contarSoDinheiroFechado: ev.target.checked } }));
  container.querySelector('[data-a="nova-secao"]')?.addEventListener("click", () => { editando = "nova"; renderizar(); });
  container.querySelector('[data-a="novo-prazo"]')?.addEventListener("click", async () => {
    const titulo = container.querySelector("#pz-titulo").value.trim();
    const data = container.querySelector("#pz-data").value;
    if (!titulo || !data) { mostrarToast("Preencha o que acontece e o dia."); return; }
    await gravar({ prazos: [...(perfil.prazos || []), { id: novoId(), data, titulo }] }, "Data adicionada.");
  });
  container.querySelectorAll('[data-a="tirar-prazo"]').forEach((b) => b.addEventListener("click", () => {
    const id = b.closest("[data-prazo]").dataset.prazo;
    gravar({ prazos: perfil.prazos.filter((p) => p.id !== id) }, "Data tirada.");
  }));
  container.querySelectorAll("[data-sec]").forEach((el) => {
    const id = el.dataset.sec;
    el.querySelector('[data-a="editar"]')?.addEventListener("click", () => { editando = id; renderizar(); });
    el.querySelector('[data-a="cancelar"]')?.addEventListener("click", () => { editando = null; renderizar(); });
    el.querySelector('[data-a="apagar"]')?.addEventListener("click", () => { if (confirm("Apagar esta seção?")) gravar({ secoes: perfil.secoes.filter((s) => s.id !== id) }, "Seção apagada."); });
    el.querySelector('[data-a="salvar"]')?.addEventListener("click", async () => {
      const titulo = el.querySelector('[data-campo="titulo"]').value.trim();
      const texto = el.querySelector('[data-campo="texto"]').value.trim();
      if (!titulo) { mostrarToast("Dê um título."); return; }
      const secoes = id === "nova" ? [...(perfil.secoes || []), { id: novoId(), titulo, texto }] : perfil.secoes.map((s) => (s.id === id ? { ...s, titulo, texto } : s));
      editando = null;
      await gravar({ secoes });
      renderizar();
    });
  });
}

export default {
  async montar(alvo) {
    container = alvo;
    container.innerHTML = `<p class="tela-sub">Carregando…</p>`;
    parar = assinarPerfil((p) => { if (editando) { perfil = p; return; } perfil = p; renderizar(); });
  },
  desmontar() { if (parar) { parar(); parar = null; } container = null; perfil = null; editando = null; },
};
