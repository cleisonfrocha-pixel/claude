// Leitura única de tudo que os painéis calculam. Antes cada painel lia
// só algumas coleções — e a mesma pergunta ("quanto posso gastar?") dava
// um número na Início e outro na Renda, porque uma tela esquecia as
// faturas. Aqui todas leem o mesmo retrato, com o `id` embutido em cada
// cadastro (domain/ cruza por id) e as transações como dados puros.

import { contas, cartoes, categorias, pessoas, dividas, fontesRenda, ativos, objetivos } from "./repositorios.js";
import { transacoes } from "./transacoesRepo.js";
import { faturas } from "./faturasRepo.js";
import { recorrencias } from "./recorrenciasRepo.js";

function comId(lista) {
  return lista.map((item) => ({ id: item.id, ...item.dados }));
}

const REPOS = { contas, cartoes, faturas, categorias, pessoas, dividas, fontesRenda, recorrencias, ativos, objetivos };

export async function carregarBase() {
  const nomes = Object.keys(REPOS);
  const [listaTransacoes, ...listas] = await Promise.all([transacoes.listar(), ...nomes.map((n) => REPOS[n].listar())]);
  const base = { transacoes: comId(listaTransacoes) };
  nomes.forEach((n, i) => { base[n] = comId(listas[i]); });
  return base;
}

/** Recalcula `calcular(base)` sempre que qualquer coleção mudar. As
 * assinaturas disparam juntas ao montar: junta num recálculo só. */
export function assinarBase(calcular, cb) {
  let cancelada = false;
  let agendado = null;
  function agendar() {
    if (cancelada || agendado) return;
    agendado = setTimeout(async () => {
      agendado = null;
      try {
        const r = await calcular(await carregarBase());
        if (!cancelada) cb(r);
      } catch (erro) {
        // Uma leitura que falha (rede, limite) não pode derrubar a tela: a
        // próxima mudança de dado recalcula.
        console.error("Falha ao recalcular o painel:", erro);
      }
    }, 0);
  }
  const paradas = [transacoes, ...Object.values(REPOS)].map((repo) => repo.assinar(agendar));
  return () => {
    cancelada = true;
    clearTimeout(agendado);
    paradas.forEach((parar) => parar());
  };
}
