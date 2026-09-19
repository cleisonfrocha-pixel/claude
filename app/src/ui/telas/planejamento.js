// Planejamento — módulo do §26 que reúne calendário (§6) e fluxo de caixa
// e projeção (§7): duas perguntas relacionadas ("quando" e "até onde vai
// dar"), cada uma com sua própria tela, mesmo padrão de sub-abas já usado
// em "Dinheiro" e "Configurações".

import { criarTelaComAbas } from "./comAbas.js";
import telaCalendario from "./calendario.js";
import telaFluxoCaixa from "./fluxoCaixa.js";

export default criarTelaComAbas({
  titulo: "Planejamento",
  subtitulo: "O que ainda vai acontecer com o seu dinheiro, e até onde a trajetória aguenta.",
  abas: [
    { id: "calendario", rotulo: "Calendário", tela: telaCalendario },
    { id: "fluxo", rotulo: "Fluxo de caixa", tela: telaFluxoCaixa },
  ],
});
