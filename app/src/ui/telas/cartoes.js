import { criarTelaCadastro } from "./telaCadastro.js";
import { cartoes, pessoas, contas } from "../../dados/repositorios.js";
import { BANDEIRAS_CARTAO } from "../../domain/esquema.js";
import { formatarBRL } from "../../domain/dinheiro.js";

const ROTULO_BANDEIRA = {
  visa: "Visa", mastercard: "Mastercard", elo: "Elo", amex: "American Express", outra: "Outra",
};

export default criarTelaCadastro({
  repo: cartoes,
  titulo: "Cartões",
  subtitulo: "Limite, fechamento e vencimento — a base para acompanhar compromissos futuros (§5).",
  rotuloNovo: "Novo cartão",
  singular: "Cartão",
  campos: [
    { id: "apelido", rotulo: "Apelido", tipo: "texto", obrigatorio: true, placeholder: "Ex.: Nubank Roxinho" },
    { id: "pessoaId", rotulo: "Responsável", tipo: "select-contexto", origemContexto: "pessoas", obrigatorio: true, permiteVazio: true, rotuloVazio: "Selecione uma pessoa" },
    { id: "contaPagamentoId", rotulo: "Conta de pagamento da fatura", tipo: "select-contexto", origemContexto: "contas", obrigatorio: true, permiteVazio: true, rotuloVazio: "Selecione uma conta" },
    { id: "bandeira", rotulo: "Bandeira", tipo: "select", opcoes: BANDEIRAS_CARTAO.map((b) => ({ valor: b, rotulo: ROTULO_BANDEIRA[b] })) },
    { id: "limiteTotalCentavos", rotulo: "Limite total", tipo: "moeda" },
    { id: "diaFechamento", rotulo: "Dia de fechamento", tipo: "numero", min: 1, max: 31, obrigatorio: true },
    { id: "diaVencimento", rotulo: "Dia de vencimento", tipo: "numero", min: 1, max: 31, obrigatorio: true },
  ],
  async carregarContexto() {
    const [listaPessoas, listaContas] = await Promise.all([pessoas.listar(), contas.listar()]);
    return {
      pessoas: listaPessoas.map((p) => ({ valor: p.id, rotulo: p.dados.nome })),
      contas: listaContas.map((c) => ({ valor: c.id, rotulo: c.dados.nome })),
    };
  },
  exibir(dados, contexto) {
    const pessoa = (contexto.pessoas || []).find((p) => p.valor === dados.pessoaId);
    return {
      titulo: dados.apelido,
      sub: `${ROTULO_BANDEIRA[dados.bandeira] || dados.bandeira} · fecha dia ${dados.diaFechamento}, vence dia ${dados.diaVencimento}${pessoa ? " · " + pessoa.rotulo : ""}`,
      valorDireita: formatarBRL(dados.limiteTotalCentavos),
      tag: dados.status === "ativo" ? null : dados.status,
      tagInativa: dados.status !== "ativo",
    };
  },
});
