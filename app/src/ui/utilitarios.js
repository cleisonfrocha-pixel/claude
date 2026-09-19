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
