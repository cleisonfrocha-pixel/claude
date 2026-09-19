// Geração de id para operações que gravam mais de um documento ligado
// (transferência, parcelamento) e precisam de uma chave compartilhada antes
// de escrever. Não é puro (usa Date.now/Math.random), por isso fica na
// camada de dados e não em domain/ — mesma função existe separadamente em
// ui/utilitarios.js para ids de elemento de formulário; propósitos
// diferentes, duplicação pequena e deliberada para não inverter a
// dependência entre as camadas.

let contador = 0;
export function uid(prefixo) {
  contador += 1;
  return `${prefixo}_${Date.now().toString(36)}${contador.toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}
