// Domínio puro: central de decisões (§9) e plano vivo (§10). "A plataforma
// precisa sair do modelo 'aqui estão seus dados' e entrar no modelo 'aqui
// está o que merece sua atenção'" (texto do blueprint).
//
// Cada achado (problema, risco ou oportunidade) nasce de um painel que já
// foi calculado em outra parte do domínio — clareza de caixa (§4),
// projeção (§7), dívidas (§11), cartões (§5) — e sempre aponta a origem
// (CLAUDE.md: "todo alerta e toda ação apontam os dados que os
// originaram"). Nada aqui é gravado: quem decide o que fica pendente,
// resolvido, ignorado, adiado ou cancelado é a camada de dados
// (dados/decisoesRepo.js), que guarda só a disposição do usuário, nunca o
// conteúdo do achado — o achado em si é recalculado toda vez.

import { statusDivida, dataProximoVencimento } from "./dividas.js";
import { somarDias } from "./tempo.js";

const PESO_URGENCIA = { alta: 3, media: 2, baixa: 1 };

function achado({ chave, origemId, tipo, urgencia, titulo, acaoSugerida, impactoCentavos = null, prazo = null, origem, dados = {} }) {
  return {
    id: `${chave}:${origemId}`,
    chave, tipo, urgencia, titulo, acaoSugerida, impactoCentavos, prazo, origem, dados,
  };
}

/**
 * Detecta os achados a partir dos painéis já calculados. Cada gerador é
 * independente e só olha pro painel que lhe diz respeito — a lista final é
 * a junção de tudo, sem nenhum acoplamento entre os geradores.
 *
 * `cartoesVisao`: [{ cartaoId, apelido, visao }] — visao de domain/cartoes.js.
 * `dividas`: lista de dívidas (com `id`).
 */
export function detectarAchados({ clareza, horizonte30d, dividas, cartoesVisao, hoje }) {
  const achados = [];

  // Problema: dinheiro seguro para gastar está negativo (§4).
  if (clareza && clareza.seguroParaGastarCentavos < 0) {
    achados.push(achado({
      chave: "caixa_seguro_negativo", origemId: "seguro", tipo: "problema", urgencia: "alta",
      titulo: "O dinheiro seguro para gastar está negativo",
      acaoSugerida: "Revisar despesas previstas ou adiar compromissos não essenciais.",
      impactoCentavos: Math.abs(clareza.seguroParaGastarCentavos),
      origem: { tipo: "clareza_caixa", id: "seguro", rotulo: "Início — Dinheiro seguro para gastar" },
    }));
  }

  // Oportunidade: sobra dinheiro livre além do comprometido (§4).
  if (clareza && clareza.livreCentavos > 10000) {
    achados.push(achado({
      chave: "caixa_sobra_livre", origemId: "livre", tipo: "oportunidade", urgencia: "baixa",
      titulo: "Sobra dinheiro livre depois do que já está comprometido",
      acaoSugerida: "Considerar reforçar a reserva ou adiantar uma parcela de dívida.",
      impactoCentavos: clareza.livreCentavos,
      origem: { tipo: "clareza_caixa", id: "livre", rotulo: "Início — Livre" },
    }));
  }

  // Risco: saída de caixa crítica prevista no horizonte de 30 dias (§7).
  if (horizonte30d && horizonte30d.saidaCritica) {
    const sc = horizonte30d.saidaCritica;
    const diasAteAperto = hoje ? Math.round((new Date(sc.data) - new Date(hoje)) / 86400000) : null;
    achados.push(achado({
      chave: "projecao_saida_critica", origemId: "30d", tipo: "risco",
      urgencia: diasAteAperto !== null && diasAteAperto <= 7 ? "alta" : "media",
      titulo: "O saldo seguro projetado fica negativo dentro de 30 dias",
      acaoSugerida: "Ajustar despesas previstas antes dessa data ou garantir uma entrada extra.",
      impactoCentavos: sc.gapCentavos,
      prazo: sc.data,
      origem: { tipo: "projecao", id: "30d", rotulo: "Planejamento — Fluxo de caixa (30 dias)" },
      dados: { itens: sc.itens },
    }));
  }

  // Problema: dívida atrasada (§11).
  for (const d of dividas || []) {
    if (statusDivida(d, hoje) !== "atrasada") continue;
    achados.push(achado({
      chave: "divida_atrasada", origemId: d.id, tipo: "problema", urgencia: "alta",
      titulo: `Dívida atrasada: ${d.nome}`,
      acaoSugerida: "Regularizar a parcela em atraso ou renegociar com o credor.",
      impactoCentavos: d.valorParcelaCentavos,
      prazo: dataProximoVencimento(d),
      origem: { tipo: "divida", id: d.id, rotulo: d.nome },
    }));
  }

  // Risco: dívida marcada manualmente como em risco (§11) — só quando
  // ainda não está atrasada, pra não duplicar o mesmo alerta duas vezes.
  for (const d of dividas || []) {
    if (!d.emRisco) continue;
    if (statusDivida(d, hoje) === "atrasada") continue;
    if (statusDivida(d, hoje) === "quitada") continue;
    achados.push(achado({
      chave: "divida_em_risco", origemId: d.id, tipo: "risco", urgencia: "media",
      titulo: `Dívida marcada como em risco: ${d.nome}`,
      acaoSugerida: "Acompanhar de perto — considerar renegociar antes que atrase.",
      origem: { tipo: "divida", id: d.id, rotulo: d.nome },
    }));
  }

  // Risco: cartão perto ou no limite (§5).
  for (const c of cartoesVisao || []) {
    if (!c.visao || c.visao.nivelAlerta === "normal") continue;
    achados.push(achado({
      chave: "cartao_limite", origemId: c.cartaoId, tipo: "risco",
      urgencia: c.visao.nivelAlerta === "critico" ? "alta" : "media",
      titulo: `Cartão ${c.apelido} está ${c.visao.nivelAlerta === "critico" ? "no limite" : "perto do limite"}`,
      acaoSugerida: "Evitar novas compras nesse cartão até liberar espaço.",
      impactoCentavos: c.visao.disponivelCentavos,
      origem: { tipo: "cartao", id: c.cartaoId, rotulo: c.apelido },
      dados: { percentualUtilizado: c.visao.percentualUtilizado },
    }));
  }

  return achados;
}

/** Prioriza por urgência, depois impacto financeiro, depois prazo mais
 * próximo — os três critérios do §9, nessa ordem. */
export function priorizarAchados(achados) {
  return [...(achados || [])].sort((a, b) => {
    const pu = PESO_URGENCIA[b.urgencia] - PESO_URGENCIA[a.urgencia];
    if (pu !== 0) return pu;
    const pi = (b.impactoCentavos || 0) - (a.impactoCentavos || 0);
    if (pi !== 0) return pi;
    if (a.prazo && b.prazo) return a.prazo.localeCompare(b.prazo);
    if (a.prazo) return -1;
    if (b.prazo) return 1;
    return 0;
  });
}

/**
 * O plano vivo (§10): os mesmos achados pendentes, rebaixados nos cinco
 * horizontes do blueprint. Não é um documento — é recalculado toda vez a
 * partir do que ainda está pendente agora, então muda sozinho conforme a
 * realidade muda (um achado resolvido, ou que deixou de existir porque o
 * dado de origem mudou, simplesmente não aparece mais).
 */
export function montarPlanoVivo(achadosPendentes, hoje) {
  const em7dias = somarDias(hoje, 7);
  const em30dias = somarDias(hoje, 30);
  const em90dias = somarDias(hoje, 90);

  const agora = [], estaSemana = [], esteMes = [], em90 = [], em12meses = [];
  for (const a of priorizarAchados(achadosPendentes)) {
    if (a.urgencia === "alta") { agora.push(a); continue; }
    if (a.prazo && a.prazo <= em7dias) { estaSemana.push(a); continue; }
    if (a.urgencia === "media" || (a.prazo && a.prazo <= em30dias)) { esteMes.push(a); continue; }
    if (a.urgencia === "baixa" || (a.prazo && a.prazo <= em90dias)) { em90.push(a); continue; }
    em12meses.push(a);
  }
  return { agora, estaSemana, esteMes, em90, em12meses };
}
