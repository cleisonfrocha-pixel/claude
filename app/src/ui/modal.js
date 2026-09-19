// Controlador genérico de modal/planilha inferior. As telas montam o HTML
// de dentro (.modal) e passam para cá; este módulo só cuida de abrir,
// fechar, clique fora e Esc.

let elOverlay = null;
let aoFechar = null;

function garantirElemento() {
  if (elOverlay) return elOverlay;
  elOverlay = document.getElementById("overlay-modal");
  return elOverlay;
}

export function abrir(htmlConteudo, { onFechar } = {}) {
  const overlay = garantirElemento();
  if (!overlay) return;
  overlay.innerHTML = htmlConteudo;
  overlay.hidden = false;
  document.body.style.overflow = "hidden";
  aoFechar = onFechar || null;
  const primeiroInput = overlay.querySelector("input, select, textarea");
  if (primeiroInput) {
    requestAnimationFrame(() => {
      // Só foca se nada dentro do modal já está focado — sem isso, o foco
      // atrasado rouba o campo de quem já começou a digitar em outro (gente
      // rápida, autofill, ou qualquer script). Foi um bug real: o texto do
      // segundo campo preenchido acabava dentro do primeiro.
      if (!overlay.contains(document.activeElement)) primeiroInput.focus();
    });
  }
}

export function fechar() {
  const overlay = garantirElemento();
  if (!overlay || overlay.hidden) return;
  overlay.hidden = true;
  overlay.innerHTML = "";
  document.body.style.overflow = "";
  const cb = aoFechar;
  aoFechar = null;
  if (cb) cb();
}

export function religar() {
  const overlay = garantirElemento();
  if (!overlay) return;
  overlay.addEventListener("click", (ev) => {
    if (ev.target === overlay) fechar();
  });
  document.addEventListener("keydown", (ev) => {
    if (ev.key === "Escape" && !overlay.hidden) fechar();
  });
}
