// "De onde saiu / onde caiu": as opções que a folha de pagamento mostra (cada
// conta com o saldo de agora, cada cartão com o limite livre) e a conferência
// de saldo (a pessoa diz quanto tem no app do banco e o painel passa a contar
// dali pra frente, guardando a diferença à vista).

import { carregarBase } from "./base.js";
import { contas } from "./repositorios.js";
import { calcularSaldoConta } from "../domain/caixa.js";
import { calcularVisaoCartao } from "../domain/cartoes.js";
import { hojeISO } from "../domain/tempo.js";

export async function opcoesDePagamento(hoje = hojeISO()) {
  const base = await carregarBase();
  const pessoaNome = (id) => base.pessoas.find((p) => p.id === id)?.nome || "";
  return {
    contas: base.contas.filter((c) => c.status === "ativa").map((c) => ({
      id: c.id, nome: c.nome, pessoaId: c.pessoaId, pessoa: pessoaNome(c.pessoaId), ehReserva: !!c.ehReserva,
      saldoCentavos: calcularSaldoConta(c, base.transacoes),
    })),
    cartoes: base.cartoes.filter((c) => c.status === "ativo").map((c) => {
      const v = calcularVisaoCartao({ cartao: c, transacoesDoCartao: base.transacoes, faturasDoCartao: base.faturas.filter((f) => f.cartaoId === c.id), hoje });
      return { id: c.id, apelido: c.apelido, pessoaId: c.pessoaId, pessoa: pessoaNome(c.pessoaId), disponivelCentavos: v.disponivelCentavos, limiteCentavos: c.limiteTotalCentavos };
    }),
    hoje,
  };
}

/** Saldo conferido: o saldo da conta passa a ser o informado, a partir de hoje.
 * A diferença para o que o painel calculava fica registrada em `conferencias`
 * (nunca some). Devolve { calculadoCentavos, diferencaCentavos }. */
export async function conferirSaldo(contaId, informadoCentavos, { hoje = hojeISO(), agora = new Date().toISOString() } = {}) {
  const base = await carregarBase();
  const conta = base.contas.find((c) => c.id === contaId);
  if (!conta) throw new Error("Conta não encontrada.");
  if (!Number.isFinite(informadoCentavos)) throw new Error("Informe o saldo que aparece no app do banco.");
  const calculadoCentavos = calcularSaldoConta(conta, base.transacoes);
  const diferencaCentavos = informadoCentavos - calculadoCentavos;
  const conferencias = [...(conta.conferencias || []), { data: hoje, informadoCentavos, calculadoCentavos, diferencaCentavos }].slice(-30);
  await contas.atualizar(contaId, { saldoInicialCentavos: informadoCentavos, dataSaldoInicial: hoje, saldoConferidoEm: agora, conferencias });
  return { calculadoCentavos, diferencaCentavos };
}
