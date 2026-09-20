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
 * a junção de tudo, sem nenhum acoplamento entre os geradores. Todo
 * achado que tem lançamento concreto por trás carrega `dados.lancamentos`
 * — é o que faz "abrir o alerta mostra os lançamentos que o geraram"
 * (portão da Fase 10) valer pra lista inteira, não só pros novos.
 *
 * `cartoesVisao`: [{ cartaoId, apelido, visao, lancamentos? }] — visao de
 * domain/cartoes.js, lancamentos são as transações da fatura atual.
 * `dividas`: lista de dívidas (com `id`).
 *
 * Anomalias e alertas da Fase 10 (§17, §24) — cada array já vem pronto de
 * `dados/decisoesRepo.js`, na maioria reaproveitando cálculo de outra fase
 * (§8 `foraDoPadrao`, §13 `categoriasCrescentes`, §14 `relacaoPatrimonio`):
 * `foraDoPadrao`, `categoriasCrescentes`: domain/diagnostico.js e
 *   domain/orcamento.js, enriquecidos com nomeCategoria e lancamentos.
 * `novaRecorrencia`, `recorrenciaValorDiferente`, `aumentoCartao`,
 *   `receitaEsperadaNaoRecebida`: domain/anomalias.js.
 * `mudancaReceita`, `mudancaMargem`: domain/anomalias.js,
 *   `compararComPeriodoAnterior` aplicado a receita e margem.
 * `relacaoPatrimonio`: domain/patrimonio.js (Fase 9), reaproveitado inteiro.
 */
export function detectarAchados({
  clareza, horizonte30d, dividas, cartoesVisao, hoje,
  foraDoPadrao, categoriasCrescentes, novaRecorrencia, recorrenciaValorDiferente,
  aumentoCartao, receitaEsperadaNaoRecebida, mudancaReceita, mudancaMargem, relacaoPatrimonio,
}) {
  const achados = [];

  // Problema: dinheiro seguro para gastar está negativo (§4).
  if (clareza && clareza.seguroParaGastarCentavos < 0) {
    achados.push(achado({
      chave: "caixa_seguro_negativo", origemId: "seguro", tipo: "problema", urgencia: "alta",
      titulo: "O dinheiro seguro para gastar está negativo",
      acaoSugerida: "Revisar despesas previstas ou adiar compromissos não essenciais.",
      impactoCentavos: Math.abs(clareza.seguroParaGastarCentavos),
      origem: { tipo: "clareza_caixa", id: "seguro", rotulo: "Início — Dinheiro seguro para gastar" },
      dados: { lancamentos: clareza.detalhes?.compromissos || [] },
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
      dados: { lancamentos: sc.itens },
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
      dados: { lancamentos: [{ descricao: `Parcela de ${d.nome}`, valorCentavos: d.valorParcelaCentavos, data: dataProximoVencimento(d) }] },
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
      dados: { lancamentos: [{ descricao: `Parcela de ${d.nome}`, valorCentavos: d.valorParcelaCentavos, data: dataProximoVencimento(d) }] },
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
      dados: { percentualUtilizado: c.visao.percentualUtilizado, lancamentos: c.lancamentos || [] },
    }));
  }

  // Risco: despesa fora do padrão histórico (§8/§17) — o cálculo já existe
  // em domain/diagnostico.js; aqui só vira achado, com os lançamentos que
  // compõem o valor do mês.
  for (const f of foraDoPadrao || []) {
    achados.push(achado({
      chave: "despesa_fora_padrao", origemId: f.categoriaId, tipo: "risco", urgencia: "media",
      titulo: `Gasto fora do padrão em ${f.nomeCategoria}`,
      acaoSugerida: "Conferir se é um gasto pontual ou se o padrão da categoria mudou.",
      impactoCentavos: f.valorCentavos,
      origem: { tipo: "categoria", id: f.categoriaId, rotulo: f.nomeCategoria },
      dados: { lancamentos: f.lancamentos || [], mediaCentavos: f.mediaCentavos, percentualAcima: f.percentualAcima },
    }));
  }

  // Risco: categoria em alta persistente (§13/§17) — cálculo já existe em
  // domain/orcamento.js (identificarCategoriasCrescentes).
  for (const c of categoriasCrescentes || []) {
    achados.push(achado({
      chave: "categoria_crescente", origemId: c.categoriaId, tipo: "risco", urgencia: "baixa",
      titulo: `${c.nomeCategoria} está em alta há ${c.serieCentavos.length} meses seguidos`,
      acaoSugerida: "Revisar se esse crescimento é temporário ou virou um novo patamar de gasto.",
      impactoCentavos: c.serieCentavos[c.serieCentavos.length - 1],
      origem: { tipo: "categoria", id: c.categoriaId, rotulo: c.nomeCategoria },
      dados: { lancamentos: c.lancamentos || [], crescimentoTotalPercentual: c.crescimentoTotalPercentual },
    }));
  }

  // Informativo: novo compromisso recorrente identificado (§17/§24).
  for (const r of novaRecorrencia || []) {
    achados.push(achado({
      chave: "nova_recorrencia", origemId: r.recorrenciaId, tipo: r.tipo === "receita" ? "oportunidade" : "risco", urgencia: "baixa",
      titulo: `Novo compromisso recorrente: ${r.descricao}`,
      acaoSugerida: r.tipo === "receita" ? "Conferir se essa nova entrada está refletida no orçamento." : "Conferir se esse novo compromisso cabe na margem atual.",
      impactoCentavos: r.valorEstimadoCentavos,
      origem: { tipo: "recorrencia", id: r.recorrenciaId, rotulo: r.descricao },
      dados: { lancamentos: [{ descricao: r.descricao, valorCentavos: r.valorEstimadoCentavos }] },
    }));
  }

  // Risco/oportunidade: recorrência com valor realizado diferente do
  // esperado (§17 — "diferença entre o padrão esperado e o realizado").
  for (const r of recorrenciaValorDiferente || []) {
    const subiu = r.percentual > 0;
    achados.push(achado({
      chave: "recorrencia_valor_diferente", origemId: r.recorrenciaId, tipo: subiu ? "risco" : "oportunidade", urgencia: "baixa",
      titulo: `${r.descricao}: valor ${subiu ? "subiu" : "caiu"} ${Math.abs(r.percentual)}% em relação ao esperado`,
      acaoSugerida: subiu
        ? "Conferir se o reajuste é permanente e atualizar o valor esperado da recorrência."
        : "Conferir se o valor menor é um desconto pontual ou o novo normal.",
      impactoCentavos: Math.abs(r.realizadoCentavos - r.esperadoCentavos),
      prazo: r.dataTransacao,
      origem: { tipo: "recorrencia", id: r.recorrenciaId, rotulo: r.descricao },
      dados: { lancamentos: [{ descricao: r.descricao, valorCentavos: r.realizadoCentavos, data: r.dataTransacao }], esperadoCentavos: r.esperadoCentavos },
    }));
  }

  // Risco: gasto atípico de cartão (§17).
  for (const c of aumentoCartao || []) {
    achados.push(achado({
      chave: "cartao_aumento_atipico", origemId: c.cartaoId, tipo: "risco", urgencia: "media",
      titulo: `Gasto atípico no cartão ${c.apelido}`,
      acaoSugerida: "Revisar as compras deste mês nesse cartão.",
      impactoCentavos: c.atualCentavos,
      origem: { tipo: "cartao", id: c.cartaoId, rotulo: c.apelido },
      dados: { lancamentos: c.lancamentos || [], mediaCentavos: c.mediaCentavos, percentualAcima: c.percentualAcima },
    }));
  }

  // Problema: receita esperada ainda não recebida (§24).
  for (const r of receitaEsperadaNaoRecebida || []) {
    achados.push(achado({
      chave: "receita_esperada_nao_recebida", origemId: r.fonteId, tipo: "problema", urgencia: "alta",
      titulo: `Receita esperada de ${r.nome} ainda não recebida`,
      acaoSugerida: "Confirmar se o recebimento está só atrasado ou se algo mudou nessa fonte.",
      impactoCentavos: r.valorEsperadoCentavos,
      origem: { tipo: "fonteRenda", id: r.fonteId, rotulo: r.nome },
    }));
  }

  // Risco/oportunidade: mudança relevante em receita (§17).
  if (mudancaReceita) {
    achados.push(achado({
      chave: "receita_mudou", origemId: "mes_atual", tipo: mudancaReceita.subiu ? "oportunidade" : "risco",
      urgencia: mudancaReceita.subiu ? "baixa" : "media",
      titulo: `Receita do mês ${mudancaReceita.subiu ? "subiu" : "caiu"} ${Math.abs(mudancaReceita.variacaoPercentual)}% em relação ao mês anterior`,
      acaoSugerida: mudancaReceita.subiu
        ? "Considerar direcionar o excedente para reserva ou dívida."
        : "Entender a causa da queda antes de ajustar despesas.",
      impactoCentavos: Math.abs(mudancaReceita.variacaoCentavos),
      origem: { tipo: "renda", id: "mes_atual", rotulo: "Renda — mês atual" },
    }));
  }

  // Risco: queda relevante de margem (§24).
  if (mudancaMargem && !mudancaMargem.subiu) {
    achados.push(achado({
      chave: "margem_caiu", origemId: "margem_atual", tipo: "risco", urgencia: "media",
      titulo: `A margem mensal caiu ${Math.abs(mudancaMargem.variacaoPercentual)}% em relação ao mês anterior`,
      acaoSugerida: "Revisar custo essencial e comprometimento com dívidas antes que a margem vire déficit.",
      impactoCentavos: Math.abs(mudancaMargem.variacaoCentavos),
      origem: { tipo: "orcamento", id: "margem_atual", rotulo: "Renda — margem mensal" },
    }));
  }

  // Risco: aumento de dívida total (§24) — reaproveita a relação
  // dívida/ativo/patrimônio da Fase 9 (domain/patrimonio.js) inteira.
  if (relacaoPatrimonio && relacaoPatrimonio.variacaoPassivoCentavos > 0) {
    achados.push(achado({
      chave: "divida_aumentou", origemId: "passivo_total", tipo: "risco", urgencia: "media",
      titulo: "O total de dívidas aumentou em relação ao mês anterior",
      acaoSugerida: "Conferir se foi uma dívida nova ou uma reavaliação — e se isso está no plano.",
      impactoCentavos: relacaoPatrimonio.variacaoPassivoCentavos,
      origem: { tipo: "patrimonio", id: "passivo_total", rotulo: "Patrimônio — passivos" },
    }));
  }

  // Oportunidade: evolução positiva do patrimônio (§24).
  if (relacaoPatrimonio && relacaoPatrimonio.patrimonioSubiu) {
    achados.push(achado({
      chave: "patrimonio_evoluiu_positivo", origemId: "patrimonio_liquido", tipo: "oportunidade", urgencia: "baixa",
      titulo: "Patrimônio líquido cresceu em relação ao mês anterior",
      acaoSugerida: "Seguir no mesmo ritmo — considerar reforçar reserva ou objetivos.",
      impactoCentavos: relacaoPatrimonio.variacaoPatrimonioCentavos,
      origem: { tipo: "patrimonio", id: "patrimonio_liquido", rotulo: "Patrimônio — líquido" },
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
