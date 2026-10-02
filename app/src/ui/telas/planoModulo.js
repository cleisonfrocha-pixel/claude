// Plano — o módulo com três perguntas em abas: o que está acontecendo
// (diagnóstico, decisões, plano vivo), como isso se divide entre as
// pessoas da casa, e quais caminhos existem daqui pra frente.

import { criarTelaComAbas } from "./comAbas.js";
import telaVisaoGeral from "./plano.js";
import telaPorPessoa from "./planoPessoas.js";
import telaCaminhos from "./planoCaminhos.js";
import telaFechamento from "./fechamento.js";
import telaPerguntar from "./perguntar.js";
import telaPatrimonioEMetas from "./patrimonioEMetas.js";

export default criarTelaComAbas({
  titulo: "Plano",
  subtitulo: "Diagnóstico sem moralizar, quem cobre o quê na casa, e os caminhos possíveis daqui pra frente.",
  botaoFlutuante: { rotulo: "Perguntar", aba: "perguntar" },
  abas: [
    { id: "geral", rotulo: "Visão geral", tela: telaVisaoGeral },
    { id: "pessoas", rotulo: "Por pessoa", tela: telaPorPessoa },
    { id: "caminhos", rotulo: "Caminhos", tela: telaCaminhos },
    { id: "fechamento", rotulo: "Fechamento", tela: telaFechamento, oculta: true },
    { id: "perguntar", rotulo: "Perguntar", tela: telaPerguntar, oculta: true },
    { id: "patrimonio", rotulo: "Patrimônio & Metas", tela: telaPatrimonioEMetas },
  ],
});
