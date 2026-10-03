// Perfil da casa: a base de conhecimento pessoal que todo plano e toda resposta da IA precisam ler antes de
// opinar. Puro (CLAUDE.md). Guarda o que o painel não consegue saber sozinho: quem é o Cleison, a regra do
// dinheiro dele, os negócios, o momento e o jeito de falar. Texto livre em seções, mais prazos com data.

export const REGRAS_PADRAO = {
  // "Só conto dinheiro fechado": negociação, ideia de projeto e expectativa de venda não existem até fecharem.
  contarSoDinheiroFechado: true,
};

export function padraoPerfil(dados = {}) {
  return { versao: 1, atualizadoEm: "", regras: { ...REGRAS_PADRAO }, secoes: [], prazos: [], ...dados };
}

export function validarPerfil(p) {
  const erros = [];
  if (!Array.isArray(p.secoes)) erros.push("Seções inválidas.");
  for (const s of p.secoes || []) if (!s.id || !s.titulo) erros.push("Toda seção precisa de id e título.");
  for (const x of p.prazos || []) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(x.data || "")) erros.push(`Prazo "${x.titulo || "sem título"}" sem data válida.`);
    if (!x.titulo) erros.push("Todo prazo precisa de um título.");
  }
  return erros;
}

function diasEntre(a, b) {
  return Math.round((new Date(`${b}T12:00:00Z`) - new Date(`${a}T12:00:00Z`)) / 86400000);
}

/** Datas que pesam no plano, as mais próximas primeiro. Prazo vencido há mais de 7 dias sai da lista. */
export function prazosQueVem(perfil, hoje, { dias = 90 } = {}) {
  return (perfil?.prazos || [])
    .map((p) => ({ ...p, diasAte: diasEntre(hoje, p.data) }))
    .filter((p) => p.diasAte >= -7 && p.diasAte <= dias)
    .sort((a, b) => a.diasAte - b.diasAte);
}

/** Linhas do perfil para o prompt da IA, sempre as primeiras (o corte de tamanho tira as últimas). */
export function perfilParaIA(perfil, hoje) {
  if (!perfil || !(perfil.secoes || []).length) return [];
  const linhas = [{ fonte: "Perfil", texto: "Esta é a base de conhecimento sobre o Cleison e a Carolina. Leia ANTES de dar qualquer plano. Plano genérico é erro." }];
  for (const s of perfil.secoes) linhas.push({ fonte: `Perfil · ${s.titulo}`, texto: String(s.texto || "").replace(/\s+/g, " ").trim() });
  for (const p of prazosQueVem(perfil, hoje || "9999-12-31", { dias: 400 })) linhas.push({ fonte: "Perfil · Prazos", texto: `${p.data}: ${p.titulo}${p.diasAte != null && hoje ? ` (${p.diasAte >= 0 ? `faltam ${p.diasAte} dias` : "venceu"})` : ""}${p.nota ? `. ${p.nota}` : ""}` });
  if (perfil.regras?.contarSoDinheiroFechado) linhas.push({ fonte: "Perfil · Regra", texto: "Só conta dinheiro fechado. Serviço em negociação, ideia de projeto e expectativa de venda NÃO existem até fecharem: nunca os use em plano, projeção ou saldo." });
  return linhas;
}

/** Jeito de falar e de pensar, anexado às instruções da IA. */
export function instrucoesDoPerfil(perfil) {
  if (!perfil) return "";
  if (perfil !== true && !(perfil.secoes || []).length) return "";
  return `
Sobre quem pergunta (do PERFIL nos DADOS): é o Cleison, dono do painel junto com a esposa, Carolina. Eles estão numa situação financeira ruim e querem sair dela. Ele não entende de finanças e o dia é corrido: se você confundir, ele volta pra planilha. Regras extras, acima das anteriores:
A. Fale direto, honesto e informal, sem texto genérico de IA e sem travessão.
B. Todo plano usa o PERFIL: GEDI, Mercado Livre, galpão, momento e prazos. Se a resposta serviria pra qualquer pessoa, está errada.
C. Só dinheiro fechado entra na conta. Nunca projete venda, negociação ou ideia como renda.
D. Se ele insistir sem argumento novo, mantenha sua posição. Se estiver complicando em vez de executar, avise.
E. Quando houver prazo no PERFIL que pese na resposta (decisão da GEDI, obra do galpão), cite a data.
F. O limite de 220 palavras e a linha "Baseado em:" continuam valendo.`;
}
