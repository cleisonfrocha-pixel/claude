// Barramento de navegação: qualquer tela pede "vá pra X e faça Y" sem
// conhecer o shell. O shell registra o tratador; a tela destino consome a
// ação pendente quando termina de montar.

let tratador = null;
let acaoPendente = null;

export function registrar(fn) { tratador = fn; }

/** destino = { modulo, aba?, acao? } */
export function navegar(destino) {
  acaoPendente = destino.acao || null;
  if (tratador) tratador(destino);
}

/** Devolve true uma única vez se a ação pendente é a pedida. */
export function consumirAcao(nome) {
  if (acaoPendente !== nome) return false;
  acaoPendente = null;
  return true;
}
