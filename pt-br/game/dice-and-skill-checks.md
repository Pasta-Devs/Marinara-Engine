# Game Mode: dados e testes de perícia

Use o botão de dados para rolar dados para o Game Master (GM, o mestre do jogo) no Game Mode. Este guia também mostra como o GM conduz um teste de perícia contra uma Difficulty Class (DC, classe de dificuldade), o número que uma rolagem precisa alcançar ou superar.

## Rolar os dados

A barra de digitação de mensagens tem um botão de dados. A dica dele é **Roll dice** (rolar os dados).

1. Clique no botão de dados para abrir o menu rápido de dados.
2. Clique em uma opção pronta: d20, d6, 2d6, d10, d100, d4, d8 ou d12.
3. Um chip aparece na barra de digitação, assim: `🎲 d20`. A rolagem fica na fila e ainda não é enviada.
4. Envie a sua mensagem. Marinara rola e acrescenta o resultado ao final da mensagem como uma marcação, que o GM lê para narrar a cena em torno dela.

Para tirar uma rolagem da fila antes de enviar, clique em **Clear queued roll** (limpar a rolagem em espera) no chip.

Um único dado, sem bônus, fica assim:

```text
[dice: d20 = 14]
```

Com mais de um dado, ou com bônus, as parcelas também aparecem:

```text
[dice: 3d8+2 = 18 (4, 6, 6 +2)]
```

O GM também pode pedir uma rolagem na narração com `[dice: 3d8+2]`. Marinara fornece os números reais e mostra o mesmo cartão animado. Isso funciona em conexões só de texto, incluindo as assinaturas Claude e Grok. Quando o GM rola várias vezes em um turno, cada cartão de dados espera a vez dele: feche um para ver o próximo. Todas as rolagens ficam salvas no swipe ativo daquele turno e continuam em **Logs** (registros) depois de recarregar. Continuar um turno mantém as rolagens anteriores dele. Gerar novamente cria um conjunto novo para o novo swipe.

## Rolar dados personalizados

O menu de dados tem um campo de texto para uma rolagem personalizada na notação `NdM`: `N` dados com `M` lados cada, com um bônus ou uma penalidade opcional no final. O campo mostra o exemplo `3d8+2` (três dados de 8 lados, some 2).

1. Abra o menu de dados.
2. Digite a sua notação, por exemplo `2d6+1`.
3. Pressione <kbd>Enter</kbd> ou clique no botão de avião de papel. A rolagem entra na fila como um chip.

| Notação | Significado |
| --- | --- |
| `d20` | Um dado de 20 lados |
| `4d8-1` | Quatro dados de 8 lados, subtraia 1 |
| `4d6kh3` | Role quatro dados de 6 lados e mantenha os três maiores |
| `2d20kl1` | Mantenha o menor: uma rolagem com desvantagem |
| `4d6dl1+2` | Descarte o menor dado e some 2 |

`kh` e `kl` mantêm os dados maiores ou menores. `dh` e `dl` descartam esses dados. Todo dado rolado é registrado, e só os mantidos são somados.

Se não funcionou: um texto que não seja `NdM` ou um simples `dM`, opcionalmente seguido de `kh`, `kl`, `dh` ou `dl` e um número, falha com um erro que informa o formato esperado.

Você pode rolar no máximo 100 dados de uma vez, e cada dado pode ter no máximo 1000 lados. Uma rolagem simples acima disso é reduzida aos limites, e o cartão mostra a notação reduzida, então `500d6` gera um cartão `100d6`. Uma rolagem que mantém ou descarta dados acima dos limites, como `101d6kh3`, é recusada com um erro de valor fora da faixa, porque a redução mudaria quais dados são mantidos.

<a id="skill-checks"></a>

## Testes de perícia

Um teste de perícia põe à prova algo arriscado, como se esgueirar, notar uma pista ou convencer um NPC (personagem não jogável). Você não começa um teste. O GM pede o teste na narração, e Marinara o transforma em uma rolagem animada de d20 com uma faixa de resultado. A faixa mostra a perícia e o alvo, por exemplo **Stealth Check** com **DC 15**. Cada teste resolvido ganha a própria faixa, depois dos cartões de dados que estiverem na fila.

### Como o resultado é decidido

O teste rola um d20 e soma dois modificadores:

- Um modificador de perícia, tirado do nível de perícia que o jogo acompanha para o seu personagem. Ele é 0 se o jogo ainda não tem um nível para aquela perícia.
- Um modificador de atributo, tirado do atributo que rege a perícia. Cada perícia é ligada a um atributo automaticamente: Stealth usa Dexterity, Perception usa Wisdom, Persuasion usa Charisma. Uma perícia que Marinara não reconhece usa Intelligence.

Numa partida com classes **MRPG**, o modificador de atributo vem dos atributos MRPG do personagem, aqueles concedidos pela classe ativa dele (veja [Classes MRPG](mrpg-classes.md)). Os atributos Legacy que ainda estiverem num card atualizado não são usados. Cada perícia se apoia num atributo:

| Atributo | Perícias |
| --- | --- |
| Força | Athletics, Intimidation |
| Velocidade | Acrobatics, Stealth |
| Habilidade | Sleight of Hand, Investigation, Perception, Medicine, Survival, Animal Handling e qualquer perícia que não esteja listada aqui |
| Defesa | Endurance, Constitution |
| Magia | Arcana, History, Nature, Intelligence |
| Resistência | Insight, Religion, Wisdom |
| Sorte | Persuasion, Deception, Performance, Charisma |

O teste soma um quinto desse atributo, arredondado para baixo, até +5. Isso equivale a cerca de +1 para o melhor atributo de um personagem novo, +2 ou +3 no nível 10 e +5 no nível máximo. Um atributo baixo não soma nada.

Se o total alcançar ou superar a DC, o teste tem sucesso. Duas rolagens passam por cima da conta:

- Um 20 natural é um **CRITICAL SUCCESS** (sucesso crítico) e sempre passa.
- Um 1 natural é um **CRITICAL FAILURE** (falha crítica) e sempre falha.

A faixa mostra **CRITICAL SUCCESS**, **SUCCESS**, **FAILURE** ou **CRITICAL FAILURE**.

### Vantagem e desvantagem

O GM pode pedir um teste com vantagem (rolar dois d20 e ficar com o maior) ou com desvantagem (ficar com o menor). A faixa mostra o modo ao lado da DC e marca o dado usado. Se o GM pedir as duas coisas ao mesmo tempo, Marinara deixa esse teste como está em vez de adivinhar, então nenhuma faixa aparece para ele.

### Rolar o seu próprio d20 antes

Coloque um `d20` na fila pelo menu de dados antes de o teste acontecer. O teste então usa o seu número em vez de rolar um dado novo. Os seus modificadores de perícia e de atributo continuam valendo.

Para saber como o GM termina um turno depois de uma rolagem, e quanto isso custa, veja [Como um turno com dados é narrado](#how-a-rolled-turn-is-narrated).

<a id="games-that-use-a-ruleset"></a>

### Partidas com um conjunto de regras

Em uma partida com um conjunto de regras, como 5e (SRD 5.1), os testes usam os dados, a escala de dificuldade e os modificadores da ficha do próprio conjunto e, em alguns conjuntos de regras, uma reserva de dados ou dados de símbolos. Veja [Testes com um conjunto de regras](rulesets.md#checks-on-a-ruleset).

## Referência

<a id="how-a-rolled-turn-is-narrated"></a>

### Como um turno com dados é narrado

Quando o GM pede um teste no texto, Marinara resolve os dados e tem três formas de concluir o desfecho. As três ficam em **Chat Settings → Function Calling** (configurações do chat → chamada de funções).

| Configuração | Padrão | O que acontece |
| --- | --- | --- |
| **Finish rolled turns in one request** (terminar turnos com dados em uma solicitação) | Ativada | Uma solicitação. O GM escreve o desfecho sem números e Marinara os preenche. Veja abaixo. |
| **Narrate dice outcomes immediately** (narrar os resultados dos dados imediatamente) | Ativada | Duas solicitações. O GM faz um rascunho, Marinara rola e depois mais uma solicitação reenvia o prompt com os resultados reais para que o GM conclua o desfecho no mesmo turno. Isso custa mais tokens de entrada e de saída. |
| As duas desativadas | | Os resultados reais ficam guardados para o próximo turno, sem solicitação extra. |

Com **Narrate dice outcomes immediately**, se a solicitação extra falhar, o turno mantém os resultados resolvidos no registro dele sem salvar um desfecho adivinhado ou parcial. Um aviso com o botão **Regenerate turn** (regenerar turno) continua no turno, mesmo depois de recarregar. Uma solicitação sem rolagens reais nunca aciona a solicitação extra.

Em uma conexão que tem suporte à ferramenta de dados, o GM pode, em vez disso, obter uma rolagem real durante a geração. O cartão de dados aparece assim que a ferramenta responde, e o teste concluído registra esse resultado sem rolar de novo.

<a id="finishing-a-rolled-turn-in-one-request"></a>

#### Terminar um turno com dados em uma só solicitação

Sem isso, um turno que rola dados custa duas solicitações. **Finish rolled turns in one request** elimina a segunda. A opção vem ativada por padrão. Desative-a em um chat para que esse chat reescreva cada turno com dados usando os números reais.

Isso funciona porque o GM fixa o texto antes de qualquer número existir. Ele nunca vê uma rolagem antes de decidir o que acontece, então não pode direcionar o desfecho. Marinara rola depois e salva o próprio registro. Enquanto a opção está ativada, o GM escreve um teste de uma de três formas:

- **Dois desfechos.** O GM escreve o teste sem números e depois uma linha de sucesso e uma linha de falha. Marinara rola, mantém a metade escolhida pela rolagem e descarta a outra antes de você ler o turno.
- **Só um número.** Para dano, cura, ouro, duração, quantidade ou distância, o GM escreve um marcador como `[[roll: 2d6+3]]` no meio da frase, e Marinara coloca o número no lugar dele. Um marcador pode nomear um modificador da ficha, como em `[[roll: 1d8+STR]]`. Essa forma só é oferecida quando a sua partida tem uma ficha para consultar, e um nome que Marinara não consegue resolver é recusado, e não tratado como zero. Passe o ponteiro sobre um número vindo de um marcador para ver os dados dele. Cada um também aparece em **Logs** como uma linha de rolagem própria.
- **Três ou mais finais.** O GM pede o valor e para. Marinara rola e registra o valor, o turno termina sem o desfecho, e o GM narra o que o número significou no começo do próximo turno.

Um teste que não está escrito em nenhuma dessas formas volta ao último comportamento, então nada fica sem resolver e nada é inventado.

- **Narrate dice outcomes immediately** não é usado enquanto esta opção está ativada. Continua visível, mas desativado, e o valor salvo dele é mantido para quando você desativar esta opção.
- Os turnos existentes não mudam. A opção só afeta os turnos gerados depois que você a ativar.
- Um turno ainda pode custar mais de uma solicitação em dois casos: **Enable Tool Use** está ativado e a ferramenta de dados está na sua lista de ferramentas (uma chamada de ferramenta custa uma rodada extra completa), ou um **Game tool provider** diferente de **Same as narrator** está definido (ele sempre faz uma solicitação de planejamento).
- Quando algo não pode ser rolado, um aviso curto substitui o número, nunca um valor inventado. **Logs** diz o que ficou de fora.
- Enquanto o turno é escrito, os marcadores e os blocos de ramificação ficam fora do texto em streaming, então você nunca vê um número mudar.

<a id="symbol-dice-by-name"></a>

### Dados de símbolos por nome

Em uma partida cujo conjunto de regras rola dados de símbolos (um conjunto de regras `symbol-pool`, como um sistema no estilo de Genesys), o campo personalizado também aceita esses dados por nome. Informe uma quantidade e o nome de um dado para cada tipo, por exemplo `2 ability 1 proficiency vs 2 difficulty`. Os nomes podem ser o ID ou o rótulo de um dado, sem diferenciar maiúsculas de minúsculas, separados por espaços, vírgulas, `+` ou `vs`. Uma rolagem pode indicar até 40 dados.

O cartão mostra cada dado com os símbolos da face, depois os símbolos que sobram após a anulação e se isso é um sucesso. A marcação da mensagem traz o mesmo, por exemplo `[dice: 2 ability vs 1 difficulty = 1 Success, 1 Advantage; success]`. A ferramenta de dados do GM também aceita esses nomes. A notação simples `NdM` continua funcionando em qualquer partida.

### Outros dados em um teste de perícia

O GM pode indicar outra notação, como `[skill_check: skill="Endurance" dc="12" dice="3d6+2"]`. Esses testes usam o modificador fixo da notação em vez dos modificadores de d20 da ficha e têm sucesso quando o total alcança a DC. As regras do 1 natural e do 20 natural só valem para o teste padrão de d20.

Uma reserva de sucessos precisa informar tanto o limiar por dado quanto o número de sucessos necessários: `[skill_check: skill="Intimidation" dc="4" dice="6d10" resolution="successes" threshold="6"]` rola seis d10, conta cada dado que mostra pelo menos 6 e tem sucesso com pelo menos quatro. Marinara não adivinha um limiar ausente nem implementa dados explosivos, botches ou outras regras especiais de reserva. Uma reserva sem um limiar válido fica sem resolução, e os números inventados são removidos.

Essa é a reserva que uma partida sem conjunto de regras recebe. Uma partida com um conjunto de regras baseado em reservas de dados é diferente: veja [Testes com um conjunto de regras](rulesets.md#checks-on-a-ruleset).

O atributo `dice=` de um teste só aceita a notação simples `NdM`. Pedidos como `4d6kh3`, `3d6!` ou `4dF` não são rolados: Marinara registra a notação sem suporte e remove os números inventados, e o desfecho fica em aberto.

### Deixar o Game Master ver um dado de cada tamanho

**Let the Game Master see one die of each size** (deixar o Game Master ver um dado de cada tamanho) fica abaixo de **Finish rolled turns in one request**. Ela vem desativada por padrão. Ela atende a um caso que as formas às cegas não atendem: um número que precisa escolher entre três ou mais finais, como uma margem de sucesso ou uma tabela de localização de acerto. Sem ela, esse teste encerra o turno e é narrado no turno seguinte.

Quando ativada, Marinara rola um dado de cada tamanho padrão antes do turno e mostra ao GM o próximo valor de cada um, para que ele possa escrever o que o número significa na mesma passagem.

> **Aviso:** O GM passa a ver o número antes de decidir o que testar e qual dificuldade dar ao teste. Ele pode escolher uma dificuldade que o dado que tem em mãos vai superar, ou evitar pedir um teste enquanto estiver com um número ruim. Marinara não consegue dizer se uma dificuldade combina com a ficção, então não consegue detectar isso. Uma sessão suspeitamente heroica pode ser sorte manipulada.

O que Marinara impõe sem depender da cooperação do GM:

- Os valores saem em ordem e nenhum sai duas vezes.
- Todo número do registro é do Marinara. A rolagem, o modificador, o total e o resultado são recalculados a partir da fila e da sua ficha. Um número que não corresponde é substituído, e **Logs** avisa.
- A dificuldade fica entre 1 e 40. Uma partida com conjunto de regras pode ir até onde vai a escala de dificuldade do conjunto.
- Um swipe, uma regeneração ou uma continuação do mesmo turno recebe os mesmos valores, então não dá para rolar de novo em busca de sorte.
- **Values shown per size** (valores mostrados por tamanho) define quantos valores o GM vê por tamanho. O padrão é 1. As rolagens posteriores desse tamanho no mesmo turno não são vistas e são narradas no turno seguinte.
- **Rethrow after idle turns** (rolar novamente após turnos sem uso), com padrão 3, rola de novo um dado não gasto depois desse número de turnos. Sem isso, um valor baixo poderia ficar na frente da fila pelo resto do chat. Defina 0 para desativar a nova rolagem.
- Se o GM pedir mais rolagens do que a fila contém, o teste mantém a pergunta, perde todos os números e é narrado no turno seguinte. **Logs** diz em qual turno.

## Guias relacionados

- [Game Mode: jogar com um conjunto de regras](rulesets.md)
- [Game Mode: combate](combat.md)
- [Game Mode: primeiros passos](getting-started.md)
- [Game Mode: equipe e NPCs](party-and-npcs.md)
