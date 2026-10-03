// Retrato que o assistente de IA lê: tudo calculado agora, só leitura.

import { carregarBase } from "./base.js";
import { obterMetas } from "./orcamentoRepo.js";
import { calcularInicio } from "./inicioRepo.js";
import { calcularPlanoGeral } from "./planoGeralRepo.js";
import { calcularFechamento } from "./fechamentoRepo.js";
import { calcularPainelDecisoes } from "./decisoesRepo.js";
import { montarRetratoParaIA } from "../domain/ia.js";
import { hojeISO, competenciaAtual } from "../domain/tempo.js";
import { lerPerfil } from "./perfilRepo.js";

export async function carregarRetratoIA() {
  const hoje = hojeISO();
  const base = await carregarBase();
  const [metas, fechamento, decisoes, perfil] = await Promise.all([
    obterMetas(), calcularFechamento(competenciaAtual()), calcularPainelDecisoes(), lerPerfil(),
  ]);
  return montarRetratoParaIA({
    hoje,
    inicio: calcularInicio(base, hoje, metas),
    geral: calcularPlanoGeral(base, hoje),
    fechamento,
    dividas: base.dividas,
    fontesRenda: base.fontesRenda,
    ativos: base.ativos,
    achados: decisoes.achadosPendentes,
    perfil,
  });
}
