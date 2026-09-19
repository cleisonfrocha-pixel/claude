// Modo de ocultar valores (§27). Preferência puramente individual de quem
// está olhando a tela agora — por isso localStorage é o lugar certo (ver
// docs/ARQUITETURA.md, D2: "conveniência de um único viewer", não estado
// compartilhado). Cada aparelho lembra separadamente se os valores estão
// visíveis ou não.

const CHAVE = "gedi_fin_ocultar_valores";

export function estaOculto() {
  try {
    return window.localStorage.getItem(CHAVE) === "1";
  } catch {
    return false;
  }
}

export function aplicar(oculto) {
  document.body.classList.toggle("valores-ocultos", !!oculto);
  try {
    window.localStorage.setItem(CHAVE, oculto ? "1" : "0");
  } catch {
    // Sem acesso a localStorage (aba privada, storage bloqueado): a
    // preferência simplesmente não sobrevive a um recarregamento — o
    // botão continua funcionando dentro da sessão atual.
  }
}

export function alternar() {
  const novo = !document.body.classList.contains("valores-ocultos");
  aplicar(novo);
  return novo;
}

export function inicializar() {
  aplicar(estaOculto());
}
