import { criarTelaCadastro } from "./telaCadastro.js";
import { pessoas } from "../../dados/repositorios.js";
import { PAPEIS_PESSOA } from "../../domain/esquema.js";

const ROTULO_PAPEL = {
  titular: "Titular", conjuge: "Cônjuge", dependente: "Dependente", outro: "Outro",
};

export default criarTelaCadastro({
  repo: pessoas,
  titulo: "Pessoas",
  subtitulo: "Quem faz parte do núcleo financeiro. Cada conta, cartão e dívida pertence a alguém aqui.",
  rotuloNovo: "Nova pessoa",
  singular: "Pessoa",
  generoFeminino: true,
  campos: [
    { id: "nome", rotulo: "Nome", tipo: "texto", obrigatorio: true, placeholder: "Ex.: Cleison" },
    { id: "papel", rotulo: "Papel", tipo: "select", opcoes: PAPEIS_PESSOA.map((p) => ({ valor: p, rotulo: ROTULO_PAPEL[p] })) },
    { id: "ativo", rotulo: "Ativa no núcleo financeiro", tipo: "check", padrao: true },
  ],
  exibir(dados) {
    return {
      titulo: dados.nome,
      sub: ROTULO_PAPEL[dados.papel] || dados.papel,
      tag: dados.ativo ? null : "inativa",
      tagInativa: !dados.ativo,
    };
  },
});
