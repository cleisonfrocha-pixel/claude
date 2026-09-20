# Arquitetura e decisões

> Decisões que valem para todas as fases. O blueprint não define tecnologia
> (ele diz isso explicitamente na página 1), então tudo aqui é escolha nossa
> e pode ser revista — mas cada revisão custa retrabalho, então estão
> registradas com o motivo.

---

## D1 — O repositório é a fonte da verdade; o artefato é o deploy

O Painel GEDI hoje é um único arquivo HTML de 143 KB / ~2.000 linhas, editado
dentro do próprio artefato. Isso funciona para um painel de uma tela. O produto
do blueprint tem 11 módulos, um motor de projeção e uma central de decisões —
umas 10x o tamanho. Em arquivo único isso vira intratável em poucas semanas.

**Decisão:** o código-fonte vive neste repositório, organizado em arquivos, e é
publicado como **artefato multi-arquivo** (o Artifact aceita `files`: CSS, JS e
dados publicados ao lado da página, referenciados por caminho relativo).

O que isso compra:

- histórico, diff e revisão de cada mudança;
- o motor financeiro roda em Node e é **testável** fora do navegador;
- várias sessões de trabalho continuam de onde a anterior parou sem reler
  2.000 linhas;
- o artefato continua sendo o produto que você abre no celular.

Restrição a respeitar: scripts externos só carregam de `cdnjs` / `jsdelivr`.
Nossos próprios arquivos são servidos pela mesma origem do artefato, então
módulos ES com caminho relativo funcionam. Na prática: **sem framework**,
JavaScript puro em módulos — igual ao GEDI, só que organizado.

## D2 — Os dados saem do HTML e vão para o banco do artefato (`db`)

Hoje o GEDI guarda o estado **dentro do HTML**: cada alteração regenera o
documento inteiro e republica (capability `artifact`). Para um painel mensal de
clientes, ok. Para uma vida financeira — transações de anos, parcelas, faturas —
isso significa reescrever o documento inteiro a cada lançamento, com teto de
16 MB e risco de perder uma edição quando duas acontecem juntas.

**Decisão:** migrar a persistência para a capability **`db`** (armazenamento de
documentos JSON do lado do servidor, fora da página).

O que isso compra:

- os dados não competem com o tamanho da página;
- escrita por documento, não regeneração do arquivo inteiro;
- `onSnapshot`: se você lança no celular, a tela do computador atualiza;
- **a IA (Fase 13) consegue ler os dados** — é isso que torna o assistente do
  §20 viável sem backend;
- caminhos privados por pessoa (`data/users/<id>/`) para o módulo Pessoas.

Custo a aceitar: última escrita vence, sem transações. Todo cálculo que combina
vários documentos é feito na leitura, nunca mantido como total gravado que
pode dessincronizar.

**Aviso de privacidade que precisa estar claro:** dados no `db` de um artefato
são legíveis por quem tem acesso ao artefato e pela Claude quando você pedir
análise. O artefato nasce privado. Compartilhar com edição (para o cônjuge, por
exemplo) dá acesso aos lançamentos. Não é cofre bancário — é um painel pessoal.
Se isso não for aceitável, a Trilha B (D6) é o caminho.

> **Confirmado pelo dono do produto (19/09/2026):** o modelo é aceitável — é um
> painel pessoal, não um cofre bancário. Trilha A confirmada; o gatilho 4 do D6
> está descartado enquanto essa posição não mudar.

## D3 — O motor financeiro é puro e portátil

Todo cálculo — saldo comprometido, projeção, pressão de dívida, gap de renda —
vive em `src/domain/`, como funções puras: entram dados, sai resultado, sem
tocar em DOM, sem tocar em `window.claude`, sem saber que existe artefato.

Motivo: é a única parte do sistema que **não pode** ser reescrita numa eventual
migração. Se um dia o produto virar app com backend (D6), a interface muda e o
motor viaja junto, intacto. É também a parte que precisa de teste automatizado,
porque um erro de R$ 0,01 em "quanto posso gastar" destrói a confiança no
produto inteiro — e o blueprint (§31) diz que o valor do sistema é justamente
reduzir incerteza.

Regra prática: `src/domain/` não pode conter a palavra `document` nem `window`.

## D4 — Open Finance entra por um adaptador, não por dentro

O §19 pede Open Finance já na V1, mas com duas condições explícitas: "sem custo
recorrente de um plano comercial caro" e "preparado para que o projeto pessoal
não fique preso a um único fornecedor".

Open Finance de verdade (Pluggy, Belvo, Klavi e similares) exige certificado,
redirect OAuth, webhook e servidor — **nada disso cabe num artefato**. É o único
item do blueprint inteiro que obriga infraestrutura externa.

**Decisão:** definir desde a Fase 11 uma interface única de entrada de dados —
`ConectorDeDados` — com os métodos `listarContas`, `listarTransacoes`,
`saldoAtual`, `statusDaConexao`. Implementações:

| Implementação | Fase | Custo | Cobre |
|---|---|---|---|
| Manual | F1 | zero | tudo, com trabalho |
| Planilha / CSV / OFX | ✅ F11 | zero | histórico e extrato bancário |
| Google Drive (capability `mcp`) | adiado | zero | planilhas que já estão no Drive |
| Provedor de Open Finance | F12 | pago | sincronização automática |

CSV/OFX entregues na Fase 11 como texto colado, sem precisar de nenhuma
capability nova — a forma do candidato (`domain/importacao.js`) já é o
`ConectorDeDados` na prática. Google Drive ficou pra trás: CSV colado já
cobre "planilha", e formalizar a interface faz mais sentido quando a Fase 12
trouxer o segundo adaptador de verdade.

O provedor pago vira **mais um adaptador**, atrás da mesma interface. Se o preço
não fechar, o produto continua completo — só com mais digitação. É assim que o
§19 é atendido sem que ele vire o gargalo da V1.

## D5 — Cada capability do artefato cobre um item do blueprint

Mapeamento verificado contra o contrato 0.2.52 (não é suposição):

| Capability | Cobre | Seção |
|---|---|---|
| `db` | todo o armazenamento financeiro | §3 e todas |
| `sample` | assistente de IA dentro da própria página | §20 |
| `mcp` | importar planilha do Google Drive | §18 |
| `downloads` | exportação completa dos próprios dados | §27 |
| `assets` | documentos e comprovantes anexados | §27 |
| `user` | identidade das pessoas do núcleo familiar | §3 |
| `room` | duas pessoas editando ao mesmo tempo | §3 |

Consequência prática: **o único item do blueprint que o artefato não alcança é
o §19.** Todo o resto — inclusive a IA, que parecia exigir backend — é
alcançável na Trilha A.

## D6 — Trilha A agora, Trilha B só se um gatilho disparar

**Trilha A (recomendada, é o que este plano executa):** repositório + artefato
multi-arquivo + `db`. Zero infraestrutura, zero custo recorrente, funciona no
celular hoje.

**Trilha B (app com backend próprio):** só vale a pena se um destes acontecer:

1. você contratar Open Finance e quiser sincronização automática de verdade;
2. os dados passarem do que o `db` aguenta com folga;
3. você precisar de app nativo (o §28 diz explicitamente para não fazer isso
   antes de validar a experiência central);
4. a privacidade do D2 deixar de ser aceitável — **descartado em 19/09/2026**,
   ver a confirmação no D2.

Enquanto nenhum disparar, Trilha B é custo sem retorno. E por causa do D3, se um
dia disparar, o motor financeiro atravessa inteiro — a migração é de casca, não
de produto.

## D7 — A regra de escopo do §2 é lei, não conselho

> "Uma funcionalidade de P2 ou P3 não deve atrasar a entrega de nenhuma
> capacidade P0 ou P1 que impacte diretamente clareza, caixa, dívida, projeção
> ou decisão."

Operacionalmente: nenhuma fase P2 começa antes da Fase 7 fechar (que é o marco
da V1-P0). Ideia boa de P2 que aparecer no meio do caminho vai para o fim do
`PLANO-DE-IMPLANTACAO.md`, não para a fase atual.

## D8 — A margem de segurança do §4 é a reserva que você já separou

O §4 pede "dinheiro seguro para gastar: quanto pode ser utilizado sem
comprometer obrigações futuras e a margem de segurança definida pelo
sistema" — mas não diz qual deve ser essa margem. Duas opções: inventar uma
regra (ex.: sempre deixar de lado 10% do saldo, ou um múltiplo arbitrário
do custo essencial) ou usar o que o modelo já tem.

**Decisão:** a margem de segurança são as contas marcadas `ehReserva` no
cadastro (Fase 0, §15). "Dinheiro seguro para gastar" = saldo livre das
contas de **operação**; as contas de reserva ficam inteiramente de fora do
cálculo, mostradas separadamente. Não inventamos uma margem por cima disso.

Por quê: qualquer número inventado agora (10%? 20%? um mês de custo
essencial?) seria um palpite sem lastro — o produto ainda não sabe, nesta
fase, qual é o custo essencial de ninguém (isso só chega no §13, Fase 8).
Usar a reserva que a própria pessoa já separou é a única margem que o
sistema pode afirmar com confiança **hoje**, sem inventar dado. Quando a
Fase 8 trouxer custo essencial e a Fase 9 trouxer reserva com meta e
cobertura em dias, essa margem pode — e deve — ficar mais sofisticada
(ex.: alertar quando a reserva estiver abaixo da meta, mesmo com saldo
"livre" positivo). Até lá, esta é a definição, registrada para não virar
uma surpresa silenciosa quando for revista.

## D9 — Horizonte fixo de 30 dias até a Fase 5 trazer os quatro horizontes

"Comprometido" e "compromissos próximos" (§4) precisam de um horizonte —
até quando olhar à frente. O §7 define quatro horizontes lado a lado (7,
30, 90 dias e 12 meses), mas essa é uma fase inteira à frente (Fase 5).

**Decisão:** a Fase 2 usa um horizonte único fixo de 30 dias corridos,
parametrizado (`horizonteDias` em `domain/caixa.js`) para não travar o
design quando os quatro horizontes chegarem — trocar o painel de "um
número" para "quatro números lado a lado" é questão de chamar a mesma
função com parâmetros diferentes, não de reescrevê-la.

## D10 — O resumo do calendário (§6) usa uma janela fixa de 90 dias, a grade não

A tela Planejamento tem duas partes com necessidades diferentes: a **grade**,
que o usuário navega mês a mês (é uma visão de calendário, não faz sentido
travada em setembro), e o **resumo** — "dia de maior pressão" e "obrigações
sem cobertura" — que precisa ser uma verdade estável, não algo que muda
porque o usuário clicou em "próximo mês" e o app parou de olhar para o dia
que realmente aperta.

**Decisão:** `dados/calendarioRepo.js` calcula o resumo (`piorDia`,
`semCobertura`) sempre sobre uma janela fixa de 90 dias a partir de hoje —
o mesmo horizonte do §7 mais distante que a Fase 4 antecipa — independente
de qual mês a grade está mostrando. A grade em si (`diasDoMesVisivel`) usa
o mês navegado. Mesma lógica da D9 (Home) e do mesmo motivo: um painel de
resumo que muda de resposta conforme a navegação do usuário é um painel que
mente.
