# Roleplay: jogar com um conjunto de regras

Um chat de Roleplay pode ser jogado com um conjunto de regras de mesa, do mesmo tipo que o Game Mode usa. O narrador pede um teste quando acontece algo incerto, o Marinara rola os dados a partir da ficha do personagem e a resposta conta o que a rolagem decidiu. Use isso quando quiser dados de verdade e uma ficha de personagem em um roleplay sem começar uma partida de Game Mode.

Qualquer conjunto de regras que você tenha instalado para o Game Mode funciona, como 5e (SRD 5.1), e as fichas que você já fez para ele no editor de personagens e de personas também.

## Ativar um conjunto de regras em um chat

Antes de começar: instale um conjunto de regras. Veja [Obter um conjunto de regras](../game/rulesets.md#get-a-ruleset).

1. Abra o chat de Roleplay.
2. Abra **Chat Settings** (Configurações do chat) e encontre a seção **Ruleset** (Conjunto de regras).
3. Escolha um conjunto de regras na lista. Ela mostra os conjuntos que você tem instalados.
4. O Marinara dá uma ficha a cada membro do chat e diz quantas acrescentou. Cada membro aparece listado abaixo do conjunto de regras.

Cada membro recebe uma cópia da própria ficha para esse conjunto de regras, vinda do editor de personagens ou de personas (veja [Fichas de conjuntos de regras](../characters/colors-and-stats.md#ruleset-sheets)). Um membro sem ficha recebe uma em branco, marcada como **blank sheet** (ficha em branco) na lista, para montar no chat. Sua persona vem primeiro. As mudanças no chat ficam no chat e nunca voltam para o personagem ou a persona.

Se não funcionou: um conjunto de regras importado precisa de **Allow custom Agent imports** (permitir importações de agentes personalizados) ativado. Veja [Obter um conjunto de regras](../game/rulesets.md#get-a-ruleset).

### Montar uma ficha em branco

1. Na seção **Ruleset**, clique em **Build sheet** (montar ficha) ao lado do membro.
2. A ficha de personagem abre no editor de fichas. Quando o conjunto de regras tem um construtor passo a passo, ele abre ali primeiro, igual ao Game Mode e ao editor de personagens.
3. Faça suas escolhas e clique em **Save sheet** (salvar ficha).

### Acrescentar uma ficha para um novo membro

Quando um personagem entrar no chat mais tarde, clique em **Add missing sheets** (adicionar as fichas que faltam). Os membros que já têm ficha continuam com ela.

### Remover uma ficha

Um membro que não deveria ter ficha, como um card de narrador, pode perdê-la.

1. Na seção **Ruleset**, clique no ícone de lixeira ao lado do membro.
2. Clique em **Remove sheet** (remover ficha).

O chat lembra disso, então **Add missing sheets** e uma versão mais nova do conjunto de regras deixam esse membro de fora. Para dar uma ficha de novo, clique no botão dele depois de **No sheet:** (Sem ficha), como **Give Mira a sheet** (Dar uma ficha a Mira).

### Trocar o conjunto de regras ou desligá-lo

- Escolha **None** (Nenhum) para parar de jogar com o conjunto de regras. As fichas são mantidas, então escolher o mesmo conjunto outra vez continua de onde você parou.
- Escolher outro conjunto recomeça todas as fichas, porque uma ficha feita para um conjunto não significa nada para outro.

## Testes durante o jogo

Você escreve seu turno como de costume. Quando seu personagem tenta algo incerto cujo resultado importa, o narrador escreve um teste em vez de decidir o resultado. O Marinara rola o teste a partir da ficha, e então o narrador escreve o que a rolagem decidiu.

A mensagem pronta mostra um cartão de dados onde o teste aconteceu, com a perícia, a dificuldade, os dados e **Success** (Sucesso) ou **Failure** (Falha). Ações comuns que não podem falhar de verdade não recebem teste.

> **Dica:** Alguns modelos ignoram a instrução de pedir testes e decidem o resultado sozinhos. Se nenhum teste aparecer, tente um modelo mais forte na **Connection** (Conexão) do chat.

Testes não são rolados em turnos de **Impersonate** (Personificar). Uma sala multijogador não pode jogar com um conjunto de regras.

## Usar as fichas de personagem

Clique em **Open sheet** (Abrir ficha) ao lado de um membro na seção **Ruleset**. A ficha é a mesma que o Game Mode mostra. O botão de pergaminho no topo do Tracker Panel abre a ficha da sua persona.

- Clique em **−** e **+** ao lado de uma reserva ou trilha, como pontos de vida ou estresse, para mudá-la. A mudança é salva com a mensagem atual, então acompanha os swipes (respostas alternativas) e as ramificações.
- Clique em **Edit ruleset sheet** (editar a ficha do conjunto) para mudar valores, graduações de perícia, campos e listas, e depois em **Save sheet** (salvar ficha).

O narrador lê as fichas em cada turno e as muda com comandos de ficha na resposta, que o Marinara aplica e esconde da mensagem. Para descansar, diga isso no seu turno, por exemplo "a gente faz um descanso longo". O narrador registra o descanso, e as fichas recuperam o que o descanso do conjunto de regras restaura. Você também pode clicar em **Rest** (Descanso) em uma ficha.

## Solução de problemas

| Sintoma | Solução |
| --- | --- |
| **This chat's ruleset is not installed here, so its checks and sheets are paused.** | Instale o conjunto de regras de novo ou escolha outro. |
| O narrador nunca pede testes. | Use um modelo mais forte para o chat. Alguns modelos ignoram a instrução dos testes. |
| Um personagem novo não tem ficha. | Clique em **Add missing sheets**. |

## Guias relacionados

- [Game Mode: jogar com um conjunto de regras](../game/rulesets.md)
- [Game Mode: dados e testes de perícia](../game/dice-and-skill-checks.md)
- [Roleplay Mode: primeiros passos](getting-started.md)
