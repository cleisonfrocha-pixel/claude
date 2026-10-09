// Plano — o módulo com três perguntas em abas: o que está acontecendo
// (diagnóstico, decisões, plano vivo), como isso se divide entre as
// pessoas da casa, e quais caminhos existem daqui pra frente.

import { criarTelaComAbas } from "./comAbas.js";
import telaVisaoGeral from "./plano.js";
import telaPorPessoa from "./planoPessoas.js";
import telaCaminhos from "./planoCaminhos.js";
import telaEvolucao from "./planoEvolucao.js";
import telaRelatorios from "./planoRelatorios.js";
import telaMeuAno from "./planoMeuAno.js";
import telaFechamento from "./fechamento.js";
import telaPerguntar from "./perguntar.js";
import telaPatrimonioEMetas from "./patrimonioEMetas.js";
import telaMetasForm from "./metasForm.js";
import { criarTelaEmSecoes } from "./secoes.js";
import { criarTelaEmPilha } from "./pilha.js";

// Três abas (lista de 05/10, item 83): Plano (próximos passos), Ano (histórico) e Metas.
const telaPlano = criarTelaEmPilha([
  telaVisaoGeral,
  criarTelaEmSecoes([{ titulo: "Simular caminhos", resumo: "O que muda se você quitar mais rápido ou ganhar mais", tela: telaCaminhos }], { abertaPrimeira: false }),
]);
const telaAno = criarTelaEmSecoes([
  { titulo: "Meu ano", resumo: "Mês a mês, o que entrou e o que saiu", tela: telaMeuAno },
  { titulo: "Estou saindo do buraco?", resumo: "Evolução dos últimos meses", tela: telaEvolucao },
  { titulo: "Pra onde vai o dinheiro", resumo: "Relatórios com gráficos", tela: telaRelatorios },
  { titulo: "Cleison e Carolina", resumo: "Quem cobre o quê na casa", tela: telaPorPessoa },
]);
const telaMetas = criarTelaEmPilha([telaMetasForm, telaPatrimonioEMetas]);

export default criarTelaComAbas({
  botaoFlutuante: { rotulo: "Perguntar", aba: "perguntar" },
  abas: [
    { id: "geral", rotulo: "Plano", tela: telaPlano },
    { id: "meuano", rotulo: "Ano", tela: telaAno },
    { id: "patrimonio", rotulo: "Metas", tela: telaMetas },
    { id: "fechamento", rotulo: "Fechamento", tela: telaFechamento, oculta: true },
    { id: "perguntar", rotulo: "Perguntar", tela: telaPerguntar, oculta: true },
  ],
});
