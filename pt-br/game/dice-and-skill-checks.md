# Game Mode: dados e testes de perícia

Neste guia você aprende a rolar os dados no Game Mode do Marinara Engine. Ele explica o menu rápido de dados, a notação personalizada e os limites de cada rolagem personalizada. Também mostra como o Game Master (o mestre do jogo) conduz um teste de perícia contra uma Difficulty Class (DC).

## Rolar os dados

A barra de digitação de um chat em Game Mode tem um botão de dados. Passe o mouse sobre ele para ver a dica **Roll dice** (rolar os dados). Clique no botão para abrir o menu rápido de dados.

O menu traz oito opções prontas, de um clique só:

| Opção | Rola |
|---|---|
| d20 | um dado de 20 lados |
| d6 | um dado de 6 lados |
| 2d6 | dois dados de 6 lados |
| d10 | um dado de 10 lados |
| d100 | um dado de 100 lados |
| d4 | um dado de 4 lados |
| d8 | um dado de 8 lados |
| d12 | um dado de 12 lados |

Para fazer uma rolagem rápida:

1. Abra a barra de digitação em um chat em Game Mode.
2. Clique no botão de dados.
3. Clique em uma das oito opções, por exemplo **d20**.
4. Um chip pequeno aparece na barra de digitação, assim: `🎲 d20`.

A rolagem não é enviada na hora: ela fica na fila. Para tirar da fila, clique no botão de limpar dentro do chip. A dica dele é **Clear queued roll** (limpar a rolagem em espera).

A conta dos dados só acontece quando você envia a próxima mensagem. Marinara acrescenta o resultado ao final da mensagem, como uma marcação. Um único dado, sem bônus, fica assim:

```
[dice: d20 = 14]
```

Uma rolagem com mais de um dado, ou com bônus, também mostra as parcelas:

```
[dice: 3d8+2 = 18 (4, 6, 6 +2)]
```

O Game Master lê essa marcação e narra a cena de acordo com o resultado.

Quando o Game Master faz várias rolagens em um turno, cada cartão de dados ganha seu próprio lugar na fila. Feche um cartão para ver o próximo. Todas as rolagens são salvas no swipe ativo (resposta alternativa) daquele turno e continuam em **Logs** (registros) após recarregar. Continuar um turno preserva as rolagens anteriores; gerar novamente cria um conjunto separado para o novo swipe.

O Game Master também pode pedir uma rolagem na narração com `[dice: 3d8+2]`. O motor fornece os números reais e mostra o mesmo cartão animado. Isso funciona em conexões que aceitam apenas texto, incluindo as assinaturas Claude e Grok. A notação e os limites são os mesmos do menu de dados.

## Notação personalizada de dados

O menu de dados também tem um campo de texto para uma rolagem personalizada. Ele usa a notação padrão `NdM`. O `N` é a quantidade de dados e o `M` é a quantidade de lados de cada dado. No final, acrescente um bônus ou uma penalidade.

O texto de exemplo do campo mostra `3d8+2`. Isso quer dizer: role três dados de 8 lados e some 2 ao total.

Para usar uma rolagem personalizada:

1. Clique no botão de dados para abrir o menu.
2. Digite a notação no campo de texto, por exemplo `2d6+1`.
3. Pressione Enter ou clique no botãozinho de avião de papel (enviar), ao lado do campo.
4. A rolagem aparece na fila como um chip, pronta para o envio.

Outros exemplos que você pode digitar:

- `d20` rola um dado de 20 lados.
- `4d8-1` rola quatro dados de 8 lados e subtrai 1.
- `2d6+3` rola dois dados de 6 lados e soma 3.

Existem dois limites rígidos. São no máximo 100 dados por rolagem, e cada dado tem no máximo 1000 lados. Se você pedir mais que isso, Marinara reduz o pedido até esses limites, em vez de recusar. Se o texto não for uma notação `NdM` válida, a rolagem falha e aparece um erro informando o formato esperado.

## Testes de perícia

Um teste de perícia decide se você tem sucesso em algo arriscado, como se esgueirar, notar uma pista ou convencer um NPC (personagem não jogável). Quem começa o teste não é você: o Game Master pede o teste dentro da narração. Marinara transforma o pedido em uma rolagem animada de d20, com uma faixa de resultado.

Um teste solicitado por texto começa com a tentativa. O motor resolve os dados e faz uma solicitação adicional ao modelo com os resultados reais para que o Game Master conclua o desfecho no mesmo turno. Isso também corrige um rascunho que tenha adivinhado o desfecho antes da rolagem. A solicitação adicional envia o prompt novamente e consome mais tokens de entrada e saída. Se ela falhar, o turno preserva os resultados resolvidos sem salvar um desfecho inventado ou parcial.

Em uma conexão compatível com a ferramenta de dados, o Game Master pode obter uma rolagem real durante a geração. O cartão aparece assim que a ferramenta responde; o teste concluído registra esse resultado sem rolar novamente. Cada teste de habilidade resolvido recebe seu próprio banner, depois dos cartões de dados na fila.

A faixa mostra a perícia e o número alvo, por exemplo **Stealth Check** com **DC 15** ao lado. DC quer dizer Difficulty Class, ou classe de dificuldade. É o número que a rolagem precisa alcançar ou superar.

### Como o resultado é decidido

O teste rola um dado de 20 lados e soma dois modificadores:

- Um modificador de perícia, tirado do nível de perícia que o jogo acompanha para o personagem. Se o jogo ainda não tem um nível para aquela perícia, esse modificador é 0.
- Um modificador de atributo, tirado do atributo que rege aquela perícia.

O total é a rolagem do dado mais os dois modificadores. Se o total alcançar ou superar a DC, o teste tem sucesso. Se ficar abaixo, o teste falha. Cada perícia é ligada automaticamente a um atributo que a rege. Por exemplo: Stealth usa Dexterity, Perception usa Wisdom e Persuasion usa Charisma. Uma perícia que Marinara não reconhece cai em Intelligence.

### Sucesso crítico e falha crítica

Duas rolagens passam por cima da conta:

- Um 20 natural (o dado marca 20) é um **CRITICAL SUCCESS** (sucesso crítico). Sempre passa, mesmo contra uma DC alta.
- Um 1 natural (o dado marca 1) é um **CRITICAL FAILURE** (falha crítica). Sempre falha, mesmo com modificadores altos.

A faixa mostra um de quatro resultados: **CRITICAL SUCCESS**, **SUCCESS**, **FAILURE** ou **CRITICAL FAILURE**.

### Outros sistemas de dados

O Game Master pode indicar outra notação, como `[skill_check: skill="Endurance" dc="12" dice="3d6+2"]`. Esses testes usam o modificador fixo da notação em vez dos modificadores de d20 da ficha do personagem e têm sucesso quando o total atinge a DC. As regras do 1 e do 20 naturais se aplicam apenas ao teste padrão de d20 descrito acima.

As paradas de sucessos precisam informar tanto o limiar por dado quanto o número de sucessos necessários: `[skill_check: skill="Intimidation" dc="4" dice="6d10" resolution="successes" threshold="6"]` rola seis d10, conta uma vez cada dado com resultado de pelo menos 6 e passa com no mínimo quatro sucessos. O motor não adivinha um limiar ausente nem implementa dados explosivos, regras de botch ou outras regras especiais de paradas. Uma parada sem um limiar válido fica sem resolução, e os números inventados pelo modelo são removidos.

### Vantagem e desvantagem

O Game Master pode pedir um teste com vantagem ou com desvantagem. Um teste nunca é rolado com as duas coisas ao mesmo tempo.

- Com vantagem, Marinara rola dois dados de 20 lados e fica com o maior.
- Com desvantagem, Marinara rola dois dados e fica com o menor.

Quando um dos dois está ativo, a faixa mostra o modo ao lado da DC e indica qual dado foi usado.

### Rolar o próprio dado antes

Você pode deixar um `d20` na fila pelo menu de dados antes de o teste acontecer. Nesse caso, o teste de perícia usa o número que você tirou, em vez de rolar um dado novo. Os modificadores de perícia e de atributo continuam sendo somados por cima.

## Guias relacionados

- [Game Mode: combate](combat.md)
- [Game Mode: primeiros passos](getting-started.md)
- [Game Mode: equipe e NPCs](party-and-npcs.md)
