// Tema claro/escuro (Sprint 5, pós-auditoria de UX/UI). Referência do
// usuário: o app do Nubank abre escuro, sem depender da preferência do
// sistema do aparelho — por isso, sem escolha salva, o padrão aqui é
// escuro, não "seguir o sistema". Quem preferir claro troca em
// Preferências. Preferência por aparelho (localStorage), mesmo raciocínio
// de privacidade.js — e a mesma chave que o script inline de index.html
// lê antes da primeira pintura, para não haver flash de tema errado.

const CHAVE = "gedi_fin_tema";

export function temaAtual() {
  try {
    return window.localStorage.getItem(CHAVE) === "claro" ? "claro" : "escuro";
  } catch {
    return "escuro";
  }
}

export function aplicar(tema) {
  const escuro = tema !== "claro";
  document.documentElement.setAttribute("data-theme", escuro ? "dark" : "light");
  try {
    window.localStorage.setItem(CHAVE, escuro ? "escuro" : "claro");
  } catch {
    // Sem acesso a localStorage: o tema continua funcionando na sessão atual.
  }
}

export function alternar() {
  const novo = temaAtual() === "claro" ? "escuro" : "claro";
  aplicar(novo);
  return novo;
}

export function inicializar() {
  aplicar(temaAtual());
}
