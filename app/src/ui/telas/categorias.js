import { criarTelaCadastro } from "./telaCadastro.js";
import { categorias } from "../../dados/repositorios.js";
import { GRUPOS_CATEGORIA, NATUREZAS_CATEGORIA } from "../../domain/esquema.js";

const ROTULO_GRUPO = {
  moradia: "Moradia", transporte: "Transporte", alimentacao: "Alimentação", saude: "Saúde",
  educacao: "Educação", lazer: "Lazer", dividas: "Dívidas", renda: "Renda", outros: "Outros",
};
const ROTULO_NATUREZA = { receita: "Receita", despesa: "Despesa", transferencia: "Transferência" };

export default criarTelaCadastro({
  repo: categorias,
  titulo: "Categorias",
  subtitulo: "Como receitas e despesas se organizam. Essencial marca o que compõe o custo mínimo de vida (§13).",
  rotuloNovo: "Nova categoria",
  singular: "Categoria",
  generoFeminino: true,
  campos: [
    { id: "nome", rotulo: "Nome", tipo: "texto", obrigatorio: true, placeholder: "Ex.: Mercado" },
    { id: "grupo", rotulo: "Grupo", tipo: "select", opcoes: GRUPOS_CATEGORIA.map((g) => ({ valor: g, rotulo: ROTULO_GRUPO[g] })) },
    { id: "natureza", rotulo: "Natureza", tipo: "select", opcoes: NATUREZAS_CATEGORIA.map((n) => ({ valor: n, rotulo: ROTULO_NATUREZA[n] })) },
    { id: "essencial", rotulo: "Essencial (custo mínimo de vida)", tipo: "check" },
    { id: "ativa", rotulo: "Ativa", tipo: "check" },
  ],
  exibir(dados) {
    return {
      titulo: dados.nome,
      sub: `${ROTULO_GRUPO[dados.grupo] || dados.grupo} · ${ROTULO_NATUREZA[dados.natureza] || dados.natureza}${dados.essencial ? " · essencial" : ""}`,
      tag: dados.ativa ? null : "inativa",
      tagInativa: !dados.ativa,
    };
  },
});
