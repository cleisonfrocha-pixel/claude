# Plano da Rodada 7: do painel de dados ao painel de situação

Só plano. Nada daqui foi executado. Parte do que o pedido descreve já existe; o plano ajusta o que falta e não refaz o que funciona.

## 1. Como o painel se sai hoje contra o pedido

| O que o pedido quer | Situação hoje | Lacuna |
|---|---|---|
| Separar "na conta" de "livre" | Início mostra Em conta, Vai entrar, Vai sair e um "Pode gastar" | Não existe o degrau **comprometido**. A pessoa vê entrada e saída do mês inteiro, não "do que está na conta, X já tem dono" |
| "Quanto posso gastar sem me prejudicar" | "Pode gastar até 01/11" (ponto mais baixo em 30 dias) e "até a próxima entrada certa" | Esses números **contam entradas prováveis**. Falta o número só com o garantido, ao lado do número com o provável |
| Horizonte e menor ponto de caixa | Trilha única, menor ponto e dia mais apertado, "o que quebra" | Não diz em palavras se está **confortável, apertado ou em risco**; o menor ponto não é comparado a nada |
| Cartão como ferramenta de caixa | Compra no cartão não sai da conta até a fatura; fatura pesa no dia do pagamento (inclusive o dia habitual); limite livre informado; "cabe no cartão" na folha Paguei | Isso está escondido dentro do Paguei. **Não há visão de cartão no Início**: limite livre, quanto já está na próxima fatura, quando ela sai e se o saldo cobre |
| Cartão não é dinheiro extra | Compra reduz limite e entra na fatura | Falta mostrar a **margem futura**: o que a fatura vai tirar do caixa e quando |
| Entrada esperada x confiável | Selo de confiança (alta/baixa) | Está só como selo. Não separa na conta "confirmado / provável / incerto" |
| Hierarquia das saídas | Contas ordenadas por estado e data | Uma assinatura de R$ 15 atrasada e um Jeep de R$ 3.316 aparecem com o mesmo peso. Não há "o que gera consequência real" |
| Início como diagnóstico | Muitos blocos de dado | Falta uma **primeira resposta única**: "como estou hoje" em uma frase, e uma próxima decisão |
| Dívidas sem dominar | Bloco de atenção + placar na tela Dívidas | O alerta de dívida negativada ocupa o topo do Início e rouba a vez de coisas mais urgentes |
| Evolução (saindo do buraco?) | Fechamento mensal e snapshot de patrimônio existem | Não há **série**: atrasos, dívida total, caixa mínimo e margem mês a mês |
| "Posso gastar X agora? Cabe no cartão?" | Só dentro do Paguei | Falta uma pergunta direta, com simulação que **não escreve** no dado real |
| Bola de neve ou administrando | Nada | Falta um indicador simples (atrasos, juros, parcelas sobre a renda) |

## 2. Ideia central

Um único cálculo novo, **a leitura de situação**, que usa a trilha de caixa que já existe e devolve:

1. `naConta`: soma das contas de operação.
2. `comprometido`: o que vai sair até o próximo ponto de reposição (próxima entrada confirmada), em quatro grupos: atrasado, essencial, parcelas e dívidas, resto.
3. `livre`: o menor saldo da trilha até lá. É o número que responde "posso gastar".
4. Duas versões do livre: **garantido** (só entrada confirmada ou já recebida) e **provável** (com as prováveis). Incerto nunca entra, como manda o CLAUDE.md.
5. `zona`: confortável, apertado ou risco, comparando o menor ponto com o custo essencial de um mês (regra escrita, testada e mostrada ao usuário).
6. `proximaDecisao`: uma frase, derivada dos dados (ex.: "Jeep vence 04/10 e o Del Poente só cai 05/10: faltam R$ 69. Adiar ou antecipar uma entrada.").

Tudo calculado na leitura, nada gravado, e todo número aponta os lançamentos que o originaram (§9 e §17 do blueprint).

## 3. Sprints (cada uma com testes, commit, publicação e RASTREABILIDADE)

### Sprint 56: leitura de situação (motor)
- `domain/situacao.js` (puro): `naConta`, `comprometidoPorGrupo`, `livreGarantido`, `livreProvavel`, `zona`, `proximaDecisao`, com os itens de origem.
- Reaproveita `calcularClarezaDeCaixa`; duas passadas da trilha (só confirmado, e confirmado + provável).
- Regra da zona definida em um lugar só e explicada na tela.
- Testes: garantido ≤ provável sempre; incerto fora; livre bate com o menor ponto da trilha; comprometido soma os mesmos itens de A pagar (invariante).

### Sprint 57: peso das saídas
- `domain/prioridade.js`: cada saída ganha um peso (consequência real: atrasada com corte ou juros, essencial, parcela de financiamento, dívida negociável, assinatura, verba). Usa categoria essencial, `emRisco`, `bloqueio`, valor e atraso.
- A pagar e o Início passam a mostrar "o que pesa agora" (no máximo 3) e agrupam o resto sem alarme.
- Redução de ruído: alerta de dívida só sobe ao topo do Início se afeta o caixa ou tem prazo (oferta vencendo, corte iminente).
- Testes: assinatura pequena nunca sobe acima de parcela grande vencendo em 3 dias; ordem estável.

### Sprint 58: cartão como fluxo
- `domain/cartaoNoCaixa.js`: por cartão, limite livre, o que já está na próxima fatura, data em que ela sai da conta, e se o saldo naquele dia cobre (usa a trilha).
- Pergunta "posso usar o cartão agora, e quanto?": o maior valor que cabe no limite **e** deixa a trilha sem ficar negativa no dia da fatura.
- Cartão nunca soma como renda nem como "livre": o painel mostra lado a lado "livre na conta" e "livre no cartão", nunca somados.
- Testes: compra no cartão reduz limite e aumenta fatura sem mexer no saldo de hoje; fatura aparece no dia certo; margem futura cai.

### Sprint 59: "posso gastar X?" (simulação que não escreve)
- Tela e função `simularGasto({valor, forma: conta|cartão|adiar, dia})`: devolve veredito (cabe, cabe no cartão, adiar até dd/mm, não cabe), o novo menor ponto de caixa e o que quebraria.
- Vive em coleção separada ou só em memória; nenhum lançamento real é criado (regra do domínio). Botão opcional "lançar de verdade" leva ao fluxo normal de Lançar.
- Testes: simulação não altera nenhuma coleção; veredito coerente com a trilha.

### Sprint 60: Início como diagnóstico
- Reescrita **do topo** do Início (não do resto): uma frase de situação, a zona, os quatro números (na conta, comprometido, livre garantido, livre com provável), as próximas entradas confiáveis, as próximas saídas que pesam, o menor ponto e o dia, e a próxima decisão.
- Bloco de cartões compacto (limite livre, próxima fatura, quando sai) e bloco de dívidas compacto (placar, sem dominar).
- Linguagem de leigo, com o "i" de ajuda já usado, e privacidade (ocultar valores) mantida.
- Verificação no celular e no desktop com os dados reais.

### Sprint 61: evolução
- `domain/evolucao.js`: série mensal de atrasos (quantidade e valor), dívida total e em atraso, menor ponto de caixa, margem do mês e patrimônio líquido.
- Guarda o instantâneo no fechamento do mês (já existe o mecanismo de fechamento e de snapshot de patrimônio). Meses sem instantâneo aparecem como "sem dado", nunca inventados.
- Indicador de bola de neve: atrasos crescendo, juros em dívida sem acordo, parcelas sobre a renda confirmada. Mostra "melhorando / estável / piorando" com os números que sustentam.
- Aba de evolução no Plano com cinco linhas curtas e um gráfico simples por indicador.

### Sprint 62: reauditoria
- Reauditoria com os dados reais, celular e desktop, respondendo uma por uma as 12 perguntas do pedido e anotando em qual tela cada uma é respondida.
- Teste de consistência entre Início, A pagar, Agenda e Plano para a mesma data.
- Atualiza RASTREABILIDADE e republica.

## 4. As 12 perguntas e onde cada uma será respondida

| Pergunta | Resposta no painel |
|---|---|
| Como eu estou hoje? | Frase de situação e zona (S60) |
| Quanto eu realmente tenho disponível? | Livre garantido e livre com provável (S56) |
| Quanto preciso guardar? | Comprometido por grupo (S56) |
| Quanto posso gastar sem comprometer minhas contas? | Livre + "posso gastar X?" (S56, S59) |
| O que vai sair nos próximos dias? | Saídas que pesam (S57) |
| Quando entra dinheiro de novo? | Próximas entradas confiáveis (S56, S60) |
| Qual o momento mais apertado do mês? | Menor ponto de caixa e dia (já existe, S60) |
| Posso usar o cartão agora? | Cartão no caixa (S58) |
| Quanto já comprometi da próxima fatura? | Cartão no caixa (S58) |
| Bola de neve ou administrando? | Indicador de evolução (S61) |
| O que precisa da minha atenção agora? | "O que pesa agora" e próxima decisão (S57, S60) |
| Estou saindo do buraco? | Evolução mês a mês (S61) |

## 5. O que não muda
- Centavos em inteiro; transferência não é receita nem despesa; compra no cartão não é pagamento da fatura; nada de total gravado; simulação não escreve; incerto fora do saldo seguro; `src/domain` puro; todo motor novo com teste; sem framework.
- Nenhuma funcionalidade P2 ou P3 entra: tudo acima é leitura sobre o que já está cadastrado.
- A tela de cadastro, a folha Paguei, a conciliação e o subir-painel continuam como estão.

## 6. Decisões que preciso do Cleison (nenhuma bloqueia a Sprint 56)
1. **Zona de risco:** sugiro "confortável" quando o menor ponto cobre um mês de custo essencial, "apertado" entre meio mês e um mês, "risco" abaixo disso. Concorda com esses cortes, ou prefere outros?
2. **Dia habitual de pagamento da fatura:** o Nubank você paga por volta do dia 12 (vence 18)? Os outros cartões seguem o vencimento?
3. **Verba no cartão:** anúncios do Gedi e Morelli vão no cartão. Quer que o painel já considere essas verbas como compras do cartão da fatura seguinte?

## 7. Fora do plano (de propósito)
- Reagrupar Dinheiro em 3 abas e a ponte "sobra do mês x caixa" (já decidido na Sprint 54).
- Open Finance e comprovantes (já fora de escopo).
