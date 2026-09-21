# Agendas de personagem e mensagens autônomas

Neste guia você aprende como os personagens do Conversation Mode mandam mensagem primeiro e como definir quando isso acontece. Ele explica as mensagens autônomas, as agendas de personagem, o comando **/status** e o seu próprio status de presença. Esses recursos funcionam só no Conversation Mode.

## Para que servem as mensagens autônomas e as agendas

Uma mensagem autônoma é a mensagem que o personagem envia primeiro, sem você escrever nada. Marinara Engine (Marinara, para encurtar) envia essas mensagens quando você fica um tempo em silêncio, para o chat parecer uma troca de mensagens de verdade.

Duas configurações controlam esse comportamento:

- **Autonomous Messages** (mensagens autônomas) define se os personagens podem entrar em contato.
- **Schedules** (agendas) dão a cada personagem uma rotina semanal, para que pareçam acordados, ocupados ou dormindo em horários diferentes.

As agendas são opcionais. Com as mensagens autônomas ativadas e as agendas desativadas, os personagens continuam entrando em contato de acordo com a sociabilidade deles e com o seu status. A sociabilidade (talkativeness) é uma configuração de cada personagem: ela define com que frequência o personagem começa uma conversa sozinho.

## Ative as mensagens autônomas

Esse controle fica no chat, não no card de personagem. Todos esses controles ficam na seção **Autonomous Messaging** (mensagens autônomas) de **Chat Settings** (configurações do chat).

1. Abra um chat no Conversation Mode.
2. Abra **Chat Settings** (o ícone de engrenagem).
3. Localize a seção **Autonomous Messaging**.
4. Ative o botão liga/desliga **Autonomous Messages**.

No assistente de configuração de chat novo, **Autonomous Messages** vem ativado por padrão. Desative quando quiser em **Chat Settings**.

### Chat Check-In Cap

Abaixo do botão liga/desliga, o campo **Chat Check-In Cap** (limite de contatos do chat) define quantas vezes por dia os personagens podem entrar em contato neste chat.

- A opção padrão é **Default chat ceiling (talkativeness-based)**. O limite vem da sociabilidade de cada personagem.
- Escolha **Numeric value** para exibir um campo numérico e digitar qualquer teto inteiro positivo. Tetos altos podem gerar muitas requisições ao modelo e muitas notificações.

Esse limite vale para o chat inteiro. O limite próprio de um personagem, definido na agenda dele, só pode reduzir esse número, nunca aumentar.

O padrão baseado em sociabilidade funciona assim:

| Sociabilidade do personagem | Contatos por dia (padrão) |
|---|---|
| 80 ou mais | 8 |
| 60 a 79 | 6 |
| 40 a 59 | 5 |
| 20 a 39 | 3 |
| abaixo de 20 | 2 |

### Ative as agendas

**Schedules** (agendas) fica em **Autonomous Messaging**. As rotinas salvas pertencem aos personagens e são reutilizadas nos chats Conversation, inclusive quando um personagem entra em um chat existente. Desativar explicitamente as agendas em um chat mantém essa escolha sem remover a rotina do personagem.

1. Ative o botão liga/desliga **Schedules**.
2. Rotinas existentes aparecem imediatamente. Ativar agendas não gera novas; clique em **Generate** quando quiser criá-las.
3. Quando as rotinas existem, aparece a lista **Edit schedules** (editar as agendas), com uma linha por personagem.

A renovação semanal automática fica desativada até você habilitá-la para o personagem em **Character Schedule Manager** (gerenciador de agendas). Uma falha não é repetida continuamente ao reabrir o chat; use os controles de geração para tentar novamente.

Cada linha mostra quantos dias estão preenchidos, por exemplo **3 days scheduled**, ou então **Create schedule** se o personagem ainda não tem agenda. O botão **Generate** (chamado de **Regenerate** quando já existem rotinas) refaz as rotinas quando você quiser.

## O editor de agendas

Clique na linha do personagem na lista **Edit schedules** para abrir o editor de agenda. O título da janela mostra **Edit**, o nome do personagem e **Schedule**.

No topo, a área **Routine profile** (perfil da rotina) mostra um resumo da semana em linguagem simples. Use o botão **Generate summary** para criar o resumo, ou **Refresh summary** para atualizá-lo. Se você mudar a agenda depois de criar o resumo, aparece o aviso **Summary may be stale**.

### Tuning

Abra a seção **Tuning** (ajustes) para ver os controles principais.

- **Chat talkativeness** é um controle deslizante com cinco níveis: **Rare**, **Quiet**, **Balanced**, **Social** e **Very frequent**. **Balanced** é o padrão, no meio da escala. Esse valor substitui a sociabilidade padrão do personagem onde a agenda dele for usada. Ele afeta com que frequência o personagem começa mensagens, envia continuações e entra na conversa em grupo. Também define o limite diário padrão do personagem.
- **Wait before checking in** é o tempo de silêncio, em minutos, antes de o personagem iniciar um contato. A faixa vai de 15 a 360 minutos. O padrão é **120**.
- **Check-in moments** são os motivos que o personagem pode usar para entrar em contato. As opções são **Morning**, **Goodnight**, **Meal breaks**, **After busy** e **Long absence**. Todas vêm ativadas. Clique em uma para desativá-la.

### Advanced timing

Dentro da seção **Tuning**, abra **Advanced timing** (ajuste fino de horários) para ver mais três controles.

- **Daily safety limit** é um máximo rígido para esse personagem: **Default** ou um número de 1 a 8 por dia. Ele só pode reduzir o limite do chat, nunca aumentar. Em geral, deixe em **Default**.
- **Delay while you're away** define quantos minutos o personagem espera antes de enviar uma mensagem enquanto o status dele é **Away**. Deixe em branco para usar o padrão, um valor aleatório de 1 a 3 minutos. A faixa vai de 0 a 120 minutos.
- **Delay while you're busy** faz o mesmo enquanto o status do personagem é **Busy**. Deixe em branco para usar o padrão, um valor aleatório de 2 a 5 minutos. A faixa vai de 0 a 120 minutos.

### Schedule AI: reescreva a semana

Abra a seção **Schedule AI** para o modelo reescrever a rotina para você. Escolha uma opção em **Week action**:

- **Rewrite** cria um rascunho novo da semana inteira.
- **Adjust** mantém quase toda a rotina e aplica as suas orientações.
- **Vary** deixa a semana bem diferente, mas ainda plausível.
- **Repair** corrige lacunas e problemas óbvios com mudanças pequenas.

Se quiser, digite orientações na caixa **Week guidance**, por exemplo:

```
make weekdays more nocturnal, keep weekends social
```

Depois clique no botão com o nome da ação escolhida, como **Rewrite week**. O resultado é apenas um rascunho. Marinara só salva quando você clica em **Save schedule**. Se o modelo retornar JSON inválido, corrija em **Edit generated schedule JSON** (editar JSON da agenda gerada) e escolha **Apply to draft** (aplicar ao rascunho). Correções validadas e dias gerados com sucesso ficam no rascunho até salvar. Uma falha interrompe a chamada sem tentar novamente de forma automática. **Stop** ou fechar o editor cancela a solicitação ativa. Fechar o gerenciador ou as configurações do chat também cancela a geração iniciada ali.

### Blocos diários

Abaixo dessas seções, cada dia de segunda a domingo tem a própria linha. Um dia sem nada definido mostra **No blocks scheduled for this day**.

Cada bloco tem três partes, sob o rótulo **Status, time & activity**:

- Um **status** escolhido entre **Online**, **Away**, **Busy** e **Offline**.
- Um intervalo de horário, digitado assim: `09:00-11:30`.
- Uma nota curta de atividade, por exemplo `at work`.

Use **Add block** para acrescentar um intervalo de horário. Use o ícone de lixeira para remover um bloco. Cada dia também tem a própria caixa de orientação, com os rótulos **Guide Monday**, **Guide Tuesday** e assim por diante. Escreva uma orientação ali e clique no botão correspondente, como **Regenerate Monday**, para reescrever só aquele dia.

O status do bloco muda o que o personagem faz quando chega a hora do contato. O personagem com um bloco **Offline** nunca manda mensagem primeiro nesse horário. O personagem com um bloco **Busy** espera três vezes mais que o normal antes de entrar em contato.

Ao terminar, clique em **Save schedule**. O botão **Cancel** fecha o editor sem salvar.

### Mover uma agenda entre personagens ou instalações

Use o botão **Export schedule** (exportar a agenda), no fim do editor, para baixar o rascunho atual como um arquivo JSON. A exportação inclui os blocos semanais, o resumo da rotina, a sociabilidade, os momentos de contato e as configurações de **Advanced timing**.

Abra o editor de agenda de outro personagem e escolha **Import schedule** (importar a agenda) para abrir esse arquivo. Marinara valida o arquivo antes de substituir o rascunho do editor e move a rotina importada para a semana atual. A importação não é salva sozinha: clique em **Save schedule** para manter a agenda, ou em **Cancel** para deixar a agenda do personagem como estava.

### Schedule generation preferences

De volta à seção **Chat Settings**, a caixa **Schedule generation preferences** (preferências de geração das agendas) guarda orientações em texto livre sobre como as rotinas devem ser escritas. Essa configuração é global. Ela vale para todos os chats do Conversation Mode na próxima geração de agendas, feita por você ou pelo aplicativo. Por exemplo:

```
Make everyone go to sleep before midnight. I work 9-5 on weekdays.
```

## Defina um status pontual com /status

O comando **/status** define ou limpa um status temporário do personagem, sem mudar a agenda salva. Ele funciona só no Conversation Mode.

A forma do comando é:

```
/status <online|idle|dnd|offline|clear> [character name]
```

Digite `idle` para Away e `dnd` para Busy. São os mesmos quatro status usados nos blocos da agenda. Para deixar um personagem chamado Mira ocupado agora:

```
/status dnd Mira
```

Para limpar essa substituição e devolver Mira à agenda dela:

```
/status clear Mira
```

Se o chat tem só um personagem, o nome pode ser omitido. Execute **/status** sem nenhuma opção para ver a lista de personagens e a ajuda de uso.

## Como as mensagens autônomas são ritmadas

Marinara controla o ritmo das mensagens autônomas para nenhum personagem encher você de mensagens. As regras abaixo usam a agenda de cada personagem.

- O personagem espera até você ficar em silêncio pelo tempo definido em **Wait before checking in**. O padrão é 120 minutos.
- O personagem com status atual **Offline** não manda mensagem primeiro.
- O personagem com status atual **Busy** espera três vezes mais.
- Depois da primeira mensagem, o personagem pode enviar até mais duas enquanto você continua em silêncio. São três mensagens no total por período de silêncio.
- Cada continuação espera mais que a anterior. A primeira espera o dobro do tempo base, e a segunda espera quatro vezes o tempo base.
- Quando você responde, a contagem zera. O silêncio seguinte começa do zero.

Se vários personagens estão prontos ao mesmo tempo, vai primeiro quem tem a maior sociabilidade e o melhor momento.

## O seu status de presença

O seu status diz aos personagens se você está por perto. O controle de status fica no rodapé da barra lateral e continua visível em todos os modos de chat. O efeito dele sobre as mensagens vale só no Conversation Mode.

Clique no indicador de status para abrir quatro opções:

- **Active**: você está online e disponível.
- **Idle**: aparece quando você está ausente.
- **Do Not Disturb**: interrompe todas as mensagens autônomas.
- **Invisible**: esconde o seu status dos personagens.

**Idle** é quase sempre automático. Se o status é **Active** e você fica 10 minutos sem fazer nada, Marinara muda o status para **Idle**. Quando você volta, o status volta para **Active**. Você também pode escolher **Idle** na janela que se abre. Ao escolher qualquer status manualmente, a troca automática é desligada até você marcar **Active** de novo.

Escolha **Do Not Disturb** quando quiser silêncio. Nenhum personagem manda mensagem primeiro enquanto essa opção estiver ativa. **Idle** não bloqueia as mensagens autônomas. Os personagens continuam entrando em contato enquanto você está ausente.

Ao lado do indicador de status fica o campo **What are you doing?** (o que você está fazendo?). Escreva uma atividade curta, de até 120 caracteres. As entradas recentes aparecem na lista **Recent status**, para você reaproveitá-las.

## Guias relacionados

- [Conversation Mode: primeiros passos](getting-started.md)
- [Perfis do Conversation Mode (nome de exibição, About Me e comportamento)](profiles.md)
- [Visão geral do painel Chat Settings](../chats/chat-settings.md)
