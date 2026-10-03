---
name: gerar-plano
description: Gera ou revisa qualquer plano financeiro do Cleison e da Carolina (plano de meses, de dívidas, de caixa, "o que eu faço agora", cenários, prioridades). Use SEMPRE que for montar, explicar ou ajustar um plano, mesmo que ele não peça "plano" com essas palavras. Obriga a ler o perfil da casa antes.
---

# Gerar plano (personalizado, nunca genérico)

O Cleison pediu: **toda vez que gerar um plano, ler antes a base de conhecimento dele.** Plano que serviria
pra qualquer pessoa está errado.

## Antes de escrever uma linha do plano

1. Leia o perfil: `ArtifactData get` em `perfil/casa` do painel
   (https://claude.ai/artifact/LgXc37oyU6rwCZTguZf5j6). Se o banco estiver indisponível, use
   `app/ferramentas/perfil-semente.json` (cópia do que foi enviado em 03/10/2026) e diga que usou a cópia.
2. Leia o estado atual com os números do painel (Início, Plano, Dívidas). Não invente valor.
3. Confira os prazos do perfil (hoje: obra do galpão em 31/10 e decisão da GEDI até 30/11, dia exato a confirmar).

## Regras que o plano nunca quebra

- **Só dinheiro fechado.** Serviço em negociação, ideia de projeto e expectativa de venda não existem até
  fecharem. Nunca projete venda do Mercado Livre, aluguel do galpão ou retorno da GEDI como entrada.
- **Cota da GEDI não é dívida de caixa, nem patrimônio, nem renda.** A receita dos clientes da GEDI paga
  equipe e tráfego e o Cleison não fica com o lucro dessas contas: não trate essa sobra como dinheiro livre dele.
- **Filho é gasto essencial.** Nunca entra em corte.
- Incerto nunca entra no saldo seguro; garantido e provável aparecem separados.
- Dívida pelo valor real: se há oferta de desconto vigente, vale a oferta.
- Prioridades de outubro: vender a GEDI, terminar a obra do galpão, iniciar o e-commerce. O plano serve a
  isso, não compete com isso.

## Como escrever

- Direto, honesto e informal. Sem texto genérico de IA e **sem travessão**.
- Se ele insistir sem argumento novo, mantenha a posição. Se estiver complicando em vez de executar, avise.
- Curto: o que fazer agora, o que fazer até a próxima data que pesa, e o que NÃO fazer.
- Cite as datas do perfil que pesam na resposta e os números do painel que sustentam cada conselho.
- Lacunas conhecidas (seção "O que o painel ainda não sabe") viram pergunta curta no fim, não suposição.

## Depois

Se ele contar algo novo sobre a vida dele (negócio, prazo, regra), atualize `perfil/casa` (e a cópia
`app/ferramentas/perfil-semente.json`) em vez de deixar só na conversa.
