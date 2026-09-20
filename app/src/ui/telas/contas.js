import { criarTelaCadastro } from "./telaCadastro.js";
import { contas, pessoas } from "../../dados/repositorios.js";
import { TIPOS_CONTA } from "../../domain/esquema.js";
import { formatarBRL } from "../../domain/dinheiro.js";

const ROTULO_TIPO = {
  corrente: "Conta corrente", poupanca: "Poupança", investimento: "Investimento",
  dinheiro: "Dinheiro em espécie", outra: "Outra",
};

export default criarTelaCadastro({
  repo: contas,
  titulo: "Contas",
  subtitulo: "Onde o dinheiro está, por instituição. A base da clareza de caixa (§4).",
  rotuloNovo: "Nova conta",
  singular: "Conta",
  generoFeminino: true,
  async carregarContexto() {
    const lista = await pessoas.listar();
    return { pessoas: lista.map((p) => ({ valor: p.id, rotulo: p.dados.nome })) };
  },
  campos: [
    { id: "nome", rotulo: "Nome da conta", tipo: "texto", obrigatorio: true, placeholder: "Ex.: Conta principal" },
    { id: "instituicao", rotulo: "Instituição", tipo: "texto", placeholder: "Ex.: Nubank" },
    { id: "pessoaId", rotulo: "Responsável", tipo: "select-contexto", origemContexto: "pessoas", obrigatorio: true, permiteVazio: true, rotuloVazio: "Selecione uma pessoa" },
    { id: "tipo", rotulo: "Tipo", tipo: "select", opcoes: TIPOS_CONTA.map((t) => ({ valor: t, rotulo: ROTULO_TIPO[t] })) },
    { id: "saldoInicialCentavos", rotulo: "Saldo inicial", tipo: "moeda" },
    { id: "dataSaldoInicial", rotulo: "Data do saldo inicial", tipo: "data" },
    { id: "ehReserva", rotulo: "É dinheiro de reserva/segurança (§15)", tipo: "check" },
    { id: "status", rotulo: "Encerrada", tipo: "check", valorMarcado: "encerrada", valorDesmarcado: "ativa", padrao: "ativa" },
  ],
  exibir(dados, contexto) {
    const pessoa = (contexto.pessoas || []).find((p) => p.valor === dados.pessoaId);
    return {
      titulo: dados.nome,
      sub: `${dados.instituicao ? dados.instituicao + " · " : ""}${ROTULO_TIPO[dados.tipo] || dados.tipo}${pessoa ? " · " + pessoa.rotulo : ""}`,
      valorDireita: formatarBRL(dados.saldoInicialCentavos),
      tag: dados.status === "ativa" ? null : "encerrada",
      tagInativa: dados.status !== "ativa",
    };
  },
});
