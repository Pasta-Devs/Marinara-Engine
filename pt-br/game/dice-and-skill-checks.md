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
- `4d6kh3` rola quatro dados de 6 lados e mantém os três maiores. `kl` mantém os menores, e `dh` e `dl` descartam os maiores ou os menores em vez disso; assim, `2d20kl1` é uma rolagem com desvantagem, e `4d6dl1+2` descarta o menor dado e soma 2. Todos os dados rolados são registrados, e somente os mantidos são somados.

Há dois limites fixos. Você pode rolar no máximo 100 dados de uma vez, e cada dado pode ter até 1000 lados. Se uma rolagem simples pedir mais, o aplicativo a reduz a esses limites em vez de recusá-la, e o cartão de resultado mostra a notação reduzida: digitar `500d6` gera um cartão `100d6` para os cem dados que realmente foram rolados. Uma rolagem que mantém ou descarta dados e ultrapassa os limites, como `101d6kh3`, é recusada com um erro de valor fora da faixa, porque reduzir a quantidade de dados mudaria quais são mantidos. Se o texto não estiver em uma notação de dados válida, que é `NdM` ou um simples `dM` como `d20`, opcionalmente seguida de `kh`, `kl`, `dh` ou `dl` e um número, a rolagem falha e aparece um erro que informa o formato esperado.

<a id="symbol-dice-by-name"></a>

### Dados de símbolos por nome

Em uma partida cujo conjunto de regras rola dados de símbolos (um conjunto `symbol-pool`, como um sistema no estilo de Genesys), o campo personalizado também aceita esses dados por nome. Informe uma quantidade e o nome do dado de cada tipo, por exemplo `2 ability 1 proficiency vs 2 difficulty`. Os nomes podem ser o ID ou o rótulo do dado, sem diferenciar maiúsculas de minúsculas, e você pode separá-los com espaços, vírgulas, `+` ou `vs`.

O cartão mostra cada dado com os símbolos da face, depois os símbolos que sobram após a anulação e se isso é um sucesso. A marcação acrescentada à mensagem traz o mesmo, por exemplo `[dice: 2 ability vs 1 difficulty = 1 Success, 1 Advantage; success]`. Uma rolagem pode indicar até 40 dados. Quando o Game Master rola com a ferramenta de dados, também pode usar esses nomes. A notação comum `NdM` continua rolando como acima em qualquer partida.

<a id="skill-checks"></a>

## Testes de perícia

Um teste de perícia decide se você tem sucesso em algo arriscado, como se esgueirar, notar uma pista ou convencer um NPC (personagem não jogável). Quem começa o teste não é você: o Game Master pede o teste dentro da narração. Marinara transforma o pedido em uma rolagem animada de d20, com uma faixa de resultado.

Um teste solicitado no texto começa pela tentativa. O motor resolve os dados e faz uma solicitação adicional ao modelo com os resultados reais para que o Game Master conclua o desfecho no mesmo turno. Isso também corrige um rascunho que adivinhou o resultado antes da rolagem. A solicitação adicional reenvia o prompt e usa mais tokens de entrada e saída. Se ela falhar, o turno mantém os resultados resolvidos no registro sem salvar um desfecho inventado ou parcial. Um aviso com o botão **Regenerate turn** (regenerar turno) permanece no turno, inclusive após recarregar o chat.

Desative **Narrate dice outcomes immediately** (narrar os resultados dos dados imediatamente) em **Chat Settings → Function Calling** para manter os resultados reais para o próximo turno sem essa solicitação extra. Essa configuração vem ativada por padrão. Solicitações que não produzem nenhuma rolagem real nunca acionam a solicitação extra de narração.

Há uma terceira opção que mantém o desfecho no mesmo turno sem a segunda solicitação. Veja [Terminar um turno com dados em uma só solicitação](#finishing-a-rolled-turn-in-one-request).

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

Essa é a reserva de uma partida **sem conjunto de regras**, e ela não muda. Uma partida com um conjunto baseado em reservas é diferente: o motor possui suas regras. Veja [Testes com um conjunto de regras](rulesets.md#checks-on-a-ruleset).

O atributo `dice=` de um teste só aceita a notação simples `NdM`. Solicitações nesse atributo, como `4d6kh3`, `3d6!` ou `4dF`, não são roladas. O motor registra a notação não compatível e remove números inventados dos registros de testes. Esses resultados permanecem em aberto; o motor não substitui silenciosamente o sistema de dados.

### Vantagem e desvantagem

O Game Master pode pedir um teste com vantagem ou com desvantagem. Um teste nunca é rolado com as duas coisas ao mesmo tempo.

- Com vantagem, Marinara rola dois dados de 20 lados e fica com o maior.
- Com desvantagem, Marinara rola dois dados e fica com o menor.

Se o GM pedir as duas ao mesmo tempo, o aplicativo deixa o teste como está em vez de adivinhar a intenção; nenhum banner aparece para ele.

Quando um dos dois está ativo, a faixa mostra o modo ao lado da DC e indica qual dado foi usado.

### Rolar o próprio dado antes

Você pode deixar um `d20` na fila pelo menu de dados antes de o teste acontecer. Nesse caso, o teste de perícia usa o número que você tirou, em vez de rolar um dado novo. Os modificadores de perícia e de atributo continuam sendo somados por cima.

<a id="games-that-use-a-ruleset"></a>

## Partidas com um conjunto de regras

Em uma partida com um conjunto de regras, como 5e (SRD 5.1), os testes são rolados do jeito do conjunto de regras: com seus próprios dados, escala de dificuldade e modificadores da ficha e, em alguns conjuntos de regras, uma reserva de dados ou dados de símbolos. Veja [Testes com um conjunto de regras](rulesets.md#checks-on-a-ruleset).

<a id="finishing-a-rolled-turn-in-one-request"></a>

## Terminar um turno com dados em uma só solicitação

Sem essa opção, um turno com rolagens custa duas solicitações ao modelo: uma para o rascunho e outra para reescrever o desfecho com os números reais. **Finish rolled turns in one request** (terminar turnos com dados em uma solicitação), em **Chat Settings → Function Calling**, elimina a segunda. A opção fica ativada por padrão; desative-a em um chat para que ele reescreva cada turno com rolagens usando os números reais.

Isso funciona porque o Game Master fixa seu texto antes de qualquer número existir. Ele não vê a rolagem antes de decidir o que acontece, então não pode direcionar o desfecho para o dado recebido. O motor rola depois, e é seu registro que fica salvo.

Com a opção ativa, o GM deve escrever o teste de uma destas três formas, conforme a natureza do desfecho.

**Se o desfecho tem duas possibilidades, ele escreve as duas.** O teste é escrito sem números, seguido de um bloco com uma linha de sucesso e outra de falha. O motor rola, mantém a metade escolhida pelo resultado e apaga a outra antes de você ler o turno. Você vê um único desfecho, como se a rolagem tivesse vindo antes.

**Se o resultado é apenas um número, ele escreve um marcador e continua.** Dano, cura, ouro, duração, quantidade ou distância: o GM escreve `[[roll: 2d6+3]]` no meio da frase e o motor coloca o número no lugar. Um marcador pode nomear um modificador da ficha em vez de um valor, como `[[roll: 1d8+STR]]`, e o motor o adiciona; essa forma só é oferecida quando a partida realmente tem uma ficha para consultar. Um nome que não pode ser resolvido é recusado, não tratado como zero. Passe o ponteiro sobre o número de um marcador para ver os dados; cada um também aparece em **Logs** (Registros) como uma linha de rolagem separada.

**Se o próprio número precisa escolher entre três ou mais finais, ele pede o valor e para.** É o mesmo teste mínimo ou pedido `[dice:]` que o GM escreve hoje. O motor rola e registra o resultado; o turno termina sem desfecho. O GM narra o significado do número no começo do próximo turno, exatamente como ocorre com **Narrate dice outcomes immediately** desativado.

Um teste que não segue nenhuma dessas formas volta a esse mesmo comportamento: nada fica sem resolver e nada é inventado.

Estes detalhes ajudam antes de ativar:

- **Narrate dice outcomes immediately não é usado enquanto esta opção está ativa.** Continua visível, desativado e com uma nota explicativa. Seu valor salvo não muda; desativar a solicitação única restaura a configuração anterior.
- **Seus turnos existentes não mudam.** Só afeta turnos gerados depois da ativação; uma transcrição já salva continua igual na leitura.
- **Um turno ainda pode custar mais de uma solicitação em dois casos.** Se **Enable Tool Use** estiver ativo e a ferramenta de dados estiver na lista, o GM ainda pode chamá-la, o que custa uma rodada extra completa. Uma **Game tool connection** diferente de **Same as narrator** também sempre faz sua própria solicitação de planejamento. Nenhuma delas é a reescrita do desfecho que esta opção remove.
- **Você recebe um aviso se algo não puder ser rolado.** Um número que o motor não entende é substituído por um aviso curto, não por um valor inventado. Uma ramificação ilegível mantém a rolagem registrada e perde as duas metades. Nos dois casos, uma linha em **Logs** informa o que foi omitido.
- **Enquanto o turno é escrito**, marcadores e blocos de ramificações ficam retidos do texto transmitido, para que você não veja um número aparecer e depois mudar. A frase pronta chega quando o turno termina.

### Deixar o Game Master ver um dado de cada tamanho

Abaixo há uma segunda opção, **Let the Game Master see one die of each size** (Deixar o Game Master ver um dado de cada tamanho), desativada por padrão. Ela atende ao caso que as duas formas às cegas não resolvem: um número que escolhe entre três ou mais finais, como margem de sucesso, tabela de localização de acerto ou rolagem de reação. Sem ela, esse teste precisa encerrar o turno e ser narrado no começo do próximo.

Quando ativa, o motor rola um dado de cada tamanho padrão antes do turno e mostra o próximo valor de cada um ao GM, para que ele possa gastar um e narrar seu significado na mesma passagem.

**Essa é a troca envolvida, e vale lê-la com atenção.** O GM vê o número antes de decidir o que testar e qual será a dificuldade. Isso permite direcionar resultados de formas que as opções às cegas não permitem: escolher uma dificuldade que o dado recebido supera ou evitar pedir um teste enquanto estiver com um número ruim. O motor não consegue dizer se uma dificuldade combina com a ficção, então não consegue detectar isso. Um jogador que não sabe que o GM viu os dados interpretará uma sessão suspeitamente heroica como sorte.

O motor impõe estas regras sem depender da cooperação do GM:

- **Os valores saem em ordem e nenhum sai duas vezes.** O motor mantém a fila e entrega o próximo, independentemente do que o turno diga.
- **Todos os números do registro vêm do motor.** A rolagem, o modificador, o total e o resultado são recalculados a partir da fila e da ficha. Um número escrito pelo GM que não corresponde é substituído, com uma linha em **Logs** avisando.
- **A dificuldade tem limites.** Fica entre 1 e 40, o que não era imposto antes a um teste escrito. Uma partida com conjunto de regras pode usar toda a escala de dificuldade dele.
- **Pedir de novo não melhora a sorte.** Uma variante de resposta, regeneração ou continuação do mesmo turno recebe os mesmos valores; não é possível rolar de novo até sair algo bom.
- **Só o próximo valor de cada tamanho é mostrado.** É a configuração **Values shown per size** (Valores mostrados por tamanho), cujo padrão é 1. Rolagens posteriores do mesmo tamanho no turno não são vistas antecipadamente e são narradas no próximo.
- **Um dado não gasto é rolado de novo depois de um tempo.** É **Rethrow after idle turns** (Rolar novamente após turnos sem uso), com padrão 3. Sem isso, um valor baixo pode ficar na frente da fila pelo resto do chat enquanto o GM evita esse tamanho. O valor 0 desativa a renovação e permite esse comportamento novamente.
- **Pedir mais rolagens do que a fila contém não produz outra.** O teste mantém sua pergunta, perde todos os números e será narrado no próximo turno. **Logs** informa em qual turno isso ocorreu.

## Guias relacionados

- [Game Mode: jogar com um conjunto de regras](rulesets.md)
- [Game Mode: combate](combat.md)
- [Game Mode: primeiros passos](getting-started.md)
- [Game Mode: equipe e NPCs](party-and-npcs.md)
