// Domínio puro: dinheiro. Sem `document`, sem `window`, sem `claude`.
// Regra do CLAUDE.md: dinheiro é inteiro em centavos. Ponto flutuante
// só existe aqui, na borda entre texto digitado/exibido e o inteiro.

/**
 * Converte um texto digitado pelo usuário (aceita "1.234,56", "1234.56",
 * "1234,56" ou "1234") em centavos inteiros. Nunca lança: entrada inválida
 * vira 0, para que o formulário sempre tenha um número com que trabalhar.
 * @param {string|number} texto
 * @returns {number} centavos (inteiro, pode ser negativo)
 */
export function paraCentavos(texto) {
  if (typeof texto === "number") {
    return Number.isFinite(texto) ? Math.round(texto * 100) : 0;
  }
  if (texto == null) return 0;
  let s = String(texto).trim();
  if (s === "") return 0;
  const negativo = /^-/.test(s) || /^\(.*\)$/.test(s);
  s = s.replace(/^-/, "").replace(/^\(|\)$/g, "");
  s = s.replace(/[^\d.,]/g, "");
  // Decide o separador decimal: o último "," ou "." que aparece é o decimal,
  // desde que tenha 1 ou 2 dígitos depois. O resto vira separador de milhar.
  const ultimaVirgula = s.lastIndexOf(",");
  const ultimoPonto = s.lastIndexOf(".");
  const posDecimal = Math.max(ultimaVirgula, ultimoPonto);
  let inteiro, decimal;
  if (posDecimal === -1) {
    inteiro = s;
    decimal = "00";
  } else {
    const casasDepois = s.length - posDecimal - 1;
    if (casasDepois === 3) {
      // "1.234" ou "1,234" — três dígitos depois do separador é milhar, não decimal.
      inteiro = s.replace(/[.,]/g, "");
      decimal = "00";
    } else {
      inteiro = s.slice(0, posDecimal).replace(/[.,]/g, "");
      decimal = (s.slice(posDecimal + 1) + "00").slice(0, 2);
    }
  }
  inteiro = inteiro.replace(/\D/g, "") || "0";
  const centavos = parseInt(inteiro, 10) * 100 + parseInt(decimal || "0", 10);
  return negativo ? -centavos : centavos;
}

/** Centavos inteiros -> número em reais (só para cálculo, nunca para exibir). */
export function paraReais(centavos) {
  return (Number(centavos) || 0) / 100;
}

/**
 * Formata centavos como "R$ 1.234,56", no padrão pt-BR.
 * @param {number} centavos
 * @param {{comSinal?: boolean}} [opcoes] comSinal antepõe "+" a valores positivos
 */
export function formatarBRL(centavos, opcoes) {
  const c = Math.round(Number(centavos) || 0);
  const valor = Math.abs(c) / 100;
  const texto = valor.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const sinal = c < 0 ? "-" : opcoes && opcoes.comSinal && c > 0 ? "+" : "";
  return `${sinal}R$ ${texto}`;
}

/** Formatação curta para espaços pequenos: "R$ 1,2k" acima de mil reais. */
export function formatarBRLCurto(centavos) {
  const c = Math.round(Number(centavos) || 0);
  if (Math.abs(c) < 100000) return formatarBRL(c);
  const milhares = c / 100000;
  const sinal = c < 0 ? "-" : "";
  const texto = Math.abs(milhares).toLocaleString("pt-BR", { maximumFractionDigits: 1 });
  return `${sinal}R$ ${texto}k`;
}

/** Soma uma lista de valores em centavos, com segurança contra não-números. */
export function somar(...centavosLista) {
  return centavosLista.reduce((acc, v) => acc + (Math.round(Number(v)) || 0), 0);
}

/**
 * Divide um total em centavos em N partes inteiras que somam exatamente o
 * total — nunca sobra nem falta 1 centavo por arredondamento. Usado para
 * parcelamento: R$ 100,00 em 3x não pode virar 33,33 + 33,33 + 33,33 = 99,99.
 * O resto da divisão vai para as PRIMEIRAS parcelas (convenção comum de
 * parcelamento: a primeira parcela absorve a diferença, nunca a última
 * passar despercebida).
 * @param {number} totalCentavos
 * @param {number} partes quantidade de parcelas (inteiro >= 1)
 * @returns {number[]} array de `partes` valores em centavos
 */
export function dividirCentavos(totalCentavos, partes) {
  const n = Math.max(1, Math.round(partes) || 1);
  const total = Math.round(Number(totalCentavos) || 0);
  const base = Math.trunc(total / n);
  const resto = total - base * n;
  const sinalResto = resto < 0 ? -1 : 1;
  const restoAbs = Math.abs(resto);
  const valores = new Array(n).fill(base);
  for (let i = 0; i < restoAbs; i++) {
    valores[i] += sinalResto;
  }
  return valores;
}
