// Peso das saídas: o que gera consequência real se não for resolvido sobe; o
// que é rotina não vira alarme. Puro (CLAUDE.md). Recebe os compromissos da
// trilha de caixa (domain/caixa.js) e devolve cada um com `peso` e `nivel`.

function diasEntre(a, b) {
  return Math.round((new Date(`${b}T12:00:00Z`) - new Date(`${a}T12:00:00Z`)) / 86400000);
}

export const NIVEL_CRITICO = 70;
export const NIVEL_IMPORTANTE = 35;

/** Peso de uma saída. Cada razão fica anotada em `razoes`, para a tela dizer
 * por que aquilo está no topo. */
export function pesarSaida(c, { categorias = [], dividas = [], hoje }) {
  const cat = categorias.find((x) => x.id === c.categoriaId);
  const divida = c.origem?.tipo === "divida" ? dividas.find((d) => d.id === c.origem.id) : null;
  const dias = hoje && c.vencimento ? diasEntre(hoje, c.vencimento) : null;
  const razoes = [];
  let peso = 0;
  const soma = (n, razao) => { peso += n; razoes.push(razao); };

  if (c.atrasado) soma(35, "já está atrasada");
  if (c.tipo === "fatura") soma(20, "fatura de cartão");
  if (c.tipo === "parcela" || c.origem?.tipo === "divida") soma(20, "parcela");
  if (cat?.essencial) soma(15, "essencial");
  if (divida && (divida.emRisco || divida.negativada)) soma(15, "dívida em risco");
  if (divida?.bloqueio) soma(15, `trava: ${divida.bloqueio}`);
  if (dias != null && dias >= 0 && dias <= 3 && !c.atrasado) soma(20, dias === 0 ? "vence hoje" : `vence em ${dias} ${dias === 1 ? "dia" : "dias"}`);
  const valor = Number(c.valorCentavos) || 0;
  const porValor = Math.min(25, Math.floor(valor / 20000)); // um ponto a cada R$ 200, até R$ 5.000
  if (porValor > 0) soma(porValor, "valor alto");
  if (cat && /assinatura/i.test(cat.nome || "")) { peso -= 15; razoes.push("assinatura"); }
  if (c.semDia) { peso -= 10; razoes.push("verba do mês"); }
  peso = Math.max(0, peso);
  return { peso, nivel: peso >= NIVEL_CRITICO ? "critico" : peso >= NIVEL_IMPORTANTE ? "importante" : "rotina", razoes };
}

export function pesarSaidas(compromissos, contexto) {
  return (compromissos || []).map((c) => ({ ...c, ...pesarSaida(c, contexto) }));
}

/** As poucas saídas que merecem atenção agora (nunca a lista inteira). */
export function oQuePesa(compromissos, contexto, { max = 3 } = {}) {
  return pesarSaidas(compromissos, contexto)
    .filter((c) => c.nivel !== "rotina")
    .sort((a, b) => b.peso - a.peso || (a.data || "").localeCompare(b.data || "") || b.valorCentavos - a.valorCentavos)
    .slice(0, max);
}
