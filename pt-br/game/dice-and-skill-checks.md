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

Há dois limites fixos. Você pode rolar no máximo 100 dados de uma vez, e cada dado pode ter até 1000 lados. Se pedir mais, o aplicativo reduz a solicitação a esses limites em vez de recusá-la, e o cartão de resultado mostra a notação reduzida: digitar `500d6` gera um cartão `100d6` para os cem dados que realmente foram rolados. Se o texto não estiver em uma notação de dados válida, que é `NdM` ou um simples `dM` como `d20`, a rolagem falha e aparece um erro que informa o formato esperado.

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

Essa é a reserva de uma partida **sem conjunto de regras**, e ela não muda. Uma partida com um conjunto baseado em reservas é diferente: o motor possui suas regras. Veja [Partidas com um conjunto de regras](#games-that-use-a-ruleset).

Solicitações não compatíveis, como `4d6kh3`, `3d6!` ou `4dF`, não são roladas. O motor registra a notação não compatível e remove números inventados dos registros de testes. Esses resultados permanecem em aberto; o motor não substitui silenciosamente o sistema de dados.

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

Uma partida pode usar um conjunto de regras, como 5e (SRD 5.1), no lugar das regras próprias do Marinara. O conjunto pertence àquela partida e fica com ela. Você o escolhe em **Rules** (regras) no assistente de configuração, ao criar a partida (veja [Escolher as regras](getting-started.md#choosing-rules)). Uma partida sem conjunto de regras funciona exatamente como descrito acima.

Quando uma partida tem um conjunto de regras:

- O Game Master continua apenas nomeando a perícia ou a salvaguarda e definindo uma dificuldade. Ele recebe a escala de dificuldade do próprio conjunto, em vez da escala integrada. Uma dificuldade pode ir até onde essa escala for, mesmo além do intervalo de 1 a 40 que as regras do Marinara permitem. Um caminho continua limitado a 1–40 mesmo em uma partida com conjunto de regras: a alternativa que rola um teste ainda pendente em um turno salvo.
- O motor rola os dados do conjunto e soma o modificador da **ficha do conjunto** do personagem, formada pelas partes que o conjunto declara: o modificador de atributo quando a perícia ou a salvaguarda nomeia um atributo, o bônus do nível de treinamento (um múltiplo de um bônus de proficiência, um número fixo ou os dois) e qualquer bônus extra informado na ficha. Os bônus de perícia e os atributos integrados não são usados.
- Um teste pode ser de um integrante da equipe. O Game Master acrescenta `who="Name"` à marcação, e o motor usa a ficha desse personagem. Sem `who`, o teste é do jogador. Um integrante que ainda não tem ficha rola com uma ficha em branco, com todos os valores no padrão do conjunto. Um nome que não corresponde a ninguém da equipe, ou que dois integrantes compartilham, rola os dados sem nenhum modificador. A única exceção é o nome do seu próprio personagem: se um integrante tiver o mesmo nome, esse nome continua significando você e usa a sua ficha. O motor nunca pega emprestada a ficha de outra pessoa.
- Os resultados naturais seguem o conjunto. Em 5e (SRD 5.1), um 20 natural ou um 1 natural não tem efeito especial em testes e salvaguardas, então um 20 natural que não alcança a dificuldade falha. Isso difere de propósito das regras do próprio Marinara.
- Os números que o próprio Game Master escreve não são aceitos sem verificação. Uma marcação com cara de concluída é rolada de novo e substituída quando o modificador não é o da ficha, quando rolou uma quantidade ou um tamanho de dados diferente do que o conjunto usa, quando o dado contado não é o que o modo de rolagem mantém, ou quando alega um resultado natural que o conjunto não tem.
- Um dado que você mesmo rolou antes do teste só é usado quando o conjunto rola um único d20. Um conjunto que rola outros dados, como 2d6 ou uma parada, o ignora e rola normalmente.
- O Game Master pode rolar uma perícia ou uma salvaguarda com um atributo diferente do habitual, acrescentando `with="Ability"` à marcação. Só vale um atributo que o seu conjunto declara; qualquer outro é ignorado, e a perícia mantém o dela.
- O Game Master pode nomear uma dificuldade da escala em vez de escrever o número dela, como `difficulty="Hard"`. O motor rola contra o número desse degrau, e o teste salvo mostra o número. Um nome que a escala não tem é ignorado.
- Os marcadores de rolagem podem nomear os atributos, as perícias e as salvaguardas do conjunto, e `PROF` para o bônus de proficiência quando o conjunto tem um.
- Se o pacote do conjunto estiver ausente ou for mais antigo que aquele com que a partida foi criada, os testes são salvos sem números e continuam pendentes. Eles nunca são rolados com as regras de outro sistema.
- Se algo na sua ficha modifica uma rolagem, como um amuleto que rola de novo os dados que caíram mal, o Game Master o nomeia no teste e o motor faz o resto: cobra o custo do amuleto, aplica o efeito e rola. Um amuleto que você não escolheu, ou que não consegue pagar, não faz nada e não custa nada.
- Se o conjunto permite gastar um recurso para firmar uma rolagem, o Game Master indica isso no próprio teste e o motor faz as duas coisas de uma vez: cobra os pontos, soma o que eles compraram e rola. Se a reserva não cobrir o custo, nada é gasto e a rolagem é a que seria sem isso. O registro mostra o que realmente foi pago, não o que foi pedido. Quanto um teste pode comprar é definido pelo conjunto: um número fixo, um número da sua ficha ou tantos quantos dados o teste tiver.
- Se o conjunto diz que um número da sua ficha acompanha certas rolagens, como uma mochila pesada em toda rolagem de Brawn, o motor o soma a todo teste em que ele se aplica, e o cartão de dados diz o que a ficha acrescentou.
- Um conjunto pode dizer o que acontece com um teste quando você não tem treinamento na perícia: ele pode custar dados ou pontos, ficar um degrau mais difícil ou nem ser possível. Um teste que você não pode tentar sem treinamento não é rolado, e a narração diz isso em vez de mostrar um resultado. A sua ficha não mostra número para uma perícia assim até você treiná-la.
- Se o conjunto tem uma trilha de ferimentos e diz que a penalidade dela vale nas rolagens, estar ferido deixa todo teste mais difícil. Em um conjunto de paradas, ela tira essa quantidade de dados da parada, nunca abaixo da menor parada que o conjunto permite, que alguns sistemas definem como nenhum dado. Em um conjunto que soma os dados, é uma penalidade fixa na rolagem. De qualquer forma, o teste diz quanto foi aplicado, para que você veja por que rolou menos dados. Veja [A ficha do conjunto](party-and-npcs.md#the-ruleset-sheet).
- O Game Master também mantém atualizados na ficha os recursos, as condições e os descansos de cada personagem, e o motor recusa uma alteração que a ficha não permite. Veja [A ficha do conjunto](party-and-npcs.md#the-ruleset-sheet).

### Conjuntos com paradas de dados

Alguns sistemas não somam um bônus à rolagem. Em vez disso, o número da ficha é quantos dados você rola, e você conta os que saem altos o bastante. Um conjunto de regras pode ser escrito assim, e uma partida com ele se comporta de um jeito um pouco diferente:

- **O número da ficha é uma quantidade de dados.** Um atributo 3 e um ofício que vale 2 rolam cinco dados. A sua ficha mostra isso como "5 dice" em vez de "+5", no editor e no que o Game Master lê.
- **A dificuldade é uma contagem de sucessos.** Um trabalho difícil pede três sucessos, não um total de 15. A escala de dificuldade do conjunto diz quantos cada degrau exige.
- **O motor rola os dados e os conta.** Quais faces contam, se uma face alta rola outro dado ou conta em dobro, se faces baixas cancelam sucessos e o que conta como tropeço (fumble) ou como sucesso excepcional: tudo isso vem do conjunto. O cartão de dados mostra todos os dados rolados, separando os que alcançaram o alvo dos que não alcançaram, e mostra quantos sucessos saíram contra quantos o teste exigia. Uma parada grande ocupa mais linhas em vez de encolher, e o cartão nunca mostra uma soma quando os dados não foram somados.
- **O Game Master pode ajustar um teste**, se o conjunto permitir: um alvo por dado mais difícil ou mais fácil, dados acrescentados ou retirados pelas circunstâncias, e uma face mais baixa a partir da qual os dados rolam de novo ou contam em dobro. Cada ajuste fica dentro do intervalo que o conjunto declara. Um degrau da escala de dificuldade pode ter o próprio alvo por dado, que vale quando o Game Master escolhe esse degrau. O cartão de dados avisa quando um teste rolou de novo ou contou em dobro em uma face diferente da habitual do conjunto.
- **Os dados podem ser rolados de novo**, se o conjunto tiver uma regra para isso: o Game Master a nomeia no teste quando a situação pede, e os dados que caíram baixo são rolados de novo, uma vez ou até saírem mais altos. Um recurso que você gasta pode comprar o mesmo. Uma rolagem só é refeita de um jeito; quando dois jeitos se aplicariam, vale o que alcança mais dados.
- **Dois atributos podem ser rolados juntos**, se o conjunto disser: um teste de atributo pode somar os dados de um segundo atributo, para que dois valores sejam rolados como uma só parada.
- **Em alguns conjuntos, algo pode dar errado junto com o resultado.** Em um conjunto que trata como tropeço faces baixas em metade dos dados ou mais, um teste que ainda conseguiu os sucessos mantém o resultado, e o cartão de dados acrescenta que algo deu errado junto. Sem nenhum sucesso, é uma falha crítica.
- **O Game Master nunca fornece os números.** Um resultado de parada escrito na narração é sempre substituído pela rolagem do próprio motor. Vantagem não se aplica, nem um dado que você mesmo rolou antes do teste.
- **Deixar o Game Master ver um dado de cada tamanho não vale para esses testes.** Os dados mostrados a ele são de vinte lados; um teste de parada é rolado às cegas pelo motor e narrado como qualquer outra rolagem às cegas.

### Outras formas de um conjunto rolar

Um conjunto de regras também pode rolar os testes de outras formas. O motor continua rolando os dados, e o cartão de dados segue o conjunto:

- **Ficar com os dados mais altos.** Role um punhado de dados e leia o mais alto, os dois mais altos ou os três mais altos, como o conjunto determinar.
- **Rolar contra a ficha.** Role um valor igual ou menor que um número da sua ficha, como a porcentagem de uma perícia, em vez de somar um bônus aos dados.
- **Dados com faces próprias.** As faces podem valer outra coisa além do número, como menos, branco e mais. Alguns dados trazem símbolos, como sucesso, vantagem e os opostos deles, em vez de números.
- **Resultados em patamares.** Um teste pode cair em um de vários resultados, como um sucesso crítico ou um sucesso com custo, em vez de um simples passou ou falhou. O cartão de dados nomeia o patamar, e o Game Master o narra.
- **Alguns testes rolados de outro jeito.** Um conjunto pode rolar a maioria dos testes de um jeito e nomear alguns que rolam de forma diferente.

<a id="finishing-a-rolled-turn-in-one-request"></a>

## Terminar um turno com dados em uma só solicitação

Por padrão, um turno com rolagens custa duas solicitações ao modelo: uma para o rascunho e outra para reescrever o desfecho com os números reais. **Finish rolled turns in one request** (Terminar turnos com dados em uma solicitação), em **Chat Settings → Function Calling**, elimina a segunda. A opção fica desativada por padrão e só vale para o chat em que você a ativa.

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

- [Game Mode: combate](combat.md)
- [Game Mode: primeiros passos](getting-started.md)
- [Game Mode: equipe e NPCs](party-and-npcs.md)
