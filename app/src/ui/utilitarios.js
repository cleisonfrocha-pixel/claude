// Pequenos utilitários de interface — só estes tocam o DOM diretamente
// fora dos módulos de tela.

let contador = 0;
export function uid(prefixo) {
  contador += 1;
  return `${prefixo}_${Date.now().toString(36)}${contador.toString(36)}`;
}

export function escapeHtml(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[c]);
}

/** Iniciais para o "avatar" de texto de um item de lista. */
export function iniciais(nome) {
  const partes = String(nome || "").trim().split(/\s+/).filter(Boolean);
  if (!partes.length) return "?";
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
}

let toastTimer = null;
export function mostrarToast(mensagem) {
  const el = document.getElementById("toast");
  if (!el) return;
  el.textContent = mensagem;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 2600);
}

/** Campo de data nativo segue o idioma do aparelho (em alguns, mês/dia).
 * Pra nunca haver dúvida, toda data ganha por baixo a forma por extenso
 * ("sábado, 3 de outubro de 2026"), igual em qualquer aparelho. */
export function ligarDicaDeData() {
  const extenso = (iso) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(iso || "")) return "";
    return new Date(`${iso}T12:00:00Z`).toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
  };
  const atualizar = (input) => {
    let dica = input.nextElementSibling;
    if (!dica || !dica.classList.contains("dica-data")) {
      dica = document.createElement("small");
      dica.className = "dica-data";
      input.insertAdjacentElement("afterend", dica);
    }
    dica.textContent = extenso(input.value);
  };
  const varrer = () => document.querySelectorAll('input[type="date"]').forEach(atualizar);
  new MutationObserver(varrer).observe(document.body, { childList: true, subtree: true });
  document.addEventListener("input", (ev) => { if (ev.target?.type === "date") atualizar(ev.target); });
  document.addEventListener("change", (ev) => { if (ev.target?.type === "date") atualizar(ev.target); });
  varrer();
}
