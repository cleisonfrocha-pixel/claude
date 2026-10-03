// Leitura do que a tela Início mostra além do caixa: confiança do número,
// próximos 7 dias e o que falta cadastrar. Tudo calculado na leitura.

import { assinarBase } from "./base.js";
import { calcularClarezaDeCaixa } from "../domain/caixa.js";
import { confiancaDoNumero, proximosDias, completarRetrato } from "../domain/inicio.js";
import { obterMetas } from "./orcamentoRepo.js";
import { contasDoMes } from "../domain/contasDoMes.js";
import { hojeISO, competenciaDeData } from "../domain/tempo.js";
import { lerSituacao } from "../domain/situacao.js";
import { oQuePesa } from "../domain/prioridade.js";
import { cartoesNoCaixa } from "../domain/cartaoNoCaixa.js";
import { simularGasto } from "../domain/simularGasto.js";
import { carregarBase } from "./base.js";
import { registrarInstantaneo } from "./evolucaoRepo.js";
import { lerPerfil } from "./perfilRepo.js";
import { prazosQueVem } from "../domain/perfil.js";

const HORIZONTE_DIAS = 30;

export function calcularInicio(base, hoje = hojeISO(), metas = null, perfil = null) {
  const caixa = calcularClarezaDeCaixa({ ...base, hoje, horizonteDias: HORIZONTE_DIAS });
  const situacao = lerSituacao({ ...base, hoje, horizonteDias: HORIZONTE_DIAS });
  const contexto = { categorias: base.categorias, dividas: base.dividas, hoje };
  // Guarda o pior momento do mês para a aba Evolução. Fora do cálculo: falha aqui não derruba o Início.
  registrarInstantaneo(base, situacao, hoje).catch((e) => console.error("Instantâneo de caixa:", e));
  return {
    caixa,
    situacao,
    pesa: oQuePesa(caixa.detalhes.compromissos, contexto, { max: 3 }),
    cartoes: cartoesNoCaixa({ cartoes: base.cartoes, faturas: base.faturas, transacoes: base.transacoes, pontos: caixa.pontos, naContaCentavos: caixa.saldoAtualCentavos, hoje }),
    confianca: confiancaDoNumero(caixa.detalhes.entradas),
    proximos: proximosDias({ compromissos: caixa.detalhes.compromissos, entradas: caixa.detalhes.entradas, hoje, dias: 7 }),
    retrato: completarRetrato({ ...base, metas, hoje }),
    contasMes: (() => {
      const competencia = competenciaDeData(hoje);
      const c = contasDoMes({ ...base, competencia, hoje });
      return { competencia, resumo: c.resumo, atrasadas: c.grupos.atrasada.slice(0, 3) };
    })(),
    prazos: prazosQueVem(perfil, hoje, { dias: 90 }),
    horizonteDias: HORIZONTE_DIAS,
  };
}

export function assinarInicio(cb) {
  return assinarBase(async (base) => calcularInicio(base, hojeISO(), await obterMetas(), await lerPerfil()), cb);
}

/** "Posso gastar X?": simula sobre o dado de agora e não grava nada. */
export async function simularPeloPainel(gasto, hoje = hojeISO()) {
  const base = await carregarBase();
  return simularGasto({ ...base, hoje, horizonteDias: HORIZONTE_DIAS }, gasto);
}
