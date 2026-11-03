# Agendas de personagens e mensagens autônomas

Mensagens autônomas são mensagens que um personagem envia primeiro, depois que você fica um tempo em silêncio. Uma agenda é o plano semanal de um personagem, que o faz parecer acordado, ocupado ou dormindo em horários diferentes. Os dois funcionam só no Conversation Mode.

As agendas são opcionais. Com as agendas desativadas, os personagens ainda entram em contato conforme a sua loquacidade (a frequência com que um personagem começa uma conversa) e a sua presença.

Ir direto a: [Ative as agendas](#turn-on-schedules), se você só quer uma agenda.

## Ative as mensagens autônomas

Antes de começar: abra um chat de Conversation. Os chats novos começam com isso ativado (veja [Conversation Mode: primeiros passos](getting-started.md)).

1. Abra **Chat Settings** no chat.
2. Encontre a seção **Autonomous Messaging**.
3. Ative **Autonomous Messages**.

Se não funcionou: os personagens ficam em silêncio enquanto a sua presença é **Do Not Disturb** (veja [O seu status de presença](getting-started.md#your-presence-status)).

### Defina o limite de check-ins

Em **Chat Settings → Autonomous Messaging**, **Chat Check-In Cap** limita quantos check-ins os personagens podem enviar por dia neste chat.

- **Default chat ceiling (talkativeness-based)** tira o limite da loquacidade de cada personagem (tabela abaixo).
- **Numeric value** mostra um campo numérico. Digite qualquer número inteiro igual ou maior que 1. Números altos podem significar muitas requisições ao modelo e muitas notificações.

Um personagem também pode ter o seu próprio **Daily safety limit** (definido na agenda dele). O limite de um personagem funciona assim:

- Limite do chat em **Numeric value** e um **Daily safety limit** definido: vale o número menor.
- Só um dos dois definido: vale esse número, mesmo que seja maior que o número da loquacidade abaixo.
- Nenhum dos dois definido: o número vem da loquacidade do personagem.

| Loquacidade do personagem | Check-ins por dia |
| --- | --- |
| 80 ou mais | 8 |
| 60 a 79 | 6 |
| 40 a 59 | 5 |
| 20 a 39 | 3 |
| abaixo de 20 | 2 |

<a id="turn-on-schedules"></a>

## Ative as agendas

Antes de começar: ative **Autonomous Messages**.

1. Em **Chat Settings → Autonomous Messaging**, ative **Schedules**. (No assistente de novo chat, a mesma opção se chama **Generate Schedules**.) As agendas que já existem aparecem na hora.
2. Escolha o seu fuso horário no campo abaixo dela.
3. Clique em **Generate** para criar agendas para os personagens que não têm nenhuma. O botão passa a mostrar **Regenerate** quando já existem agendas.
4. Espere terminar. Uma lista **Edit schedules** aparece então, com uma linha por personagem. Uma linha diz quantos dias estão preenchidos (por exemplo **3 days scheduled**) ou **Create schedule**. A lista só aparece quando já existem agendas.
5. Clique na linha de um personagem para abrir o editor de agenda dele (próxima seção).

Uma agenda pertence ao personagem e é reutilizada em todo chat de Conversation. Desativar **Schedules** em um chat mantém a opção desativada ali e mantém a agenda.

A renovação semanal automática fica desativada, a menos que você ative **Renew weekly** para esse personagem no **Character Schedule Manager**. Abra-o com o botão de calendário no rodapé da barra lateral, ao lado da caixa de status.

O Marinara tenta uma renovação uma vez por chat a cada vez que a página do aplicativo carrega. Se ela falhar, ele não tenta de novo até você recarregar a página. Clique em **Generate** para tentar de novo.

**Schedule generation preferences**, na mesma área **Schedules** de **Chat Settings**, guarda uma orientação em texto livre sobre como as agendas são escritas. Ela vale para todo chat de Conversation na próxima vez que as agendas forem geradas. Exemplo:

```text
Make everyone go to sleep before midnight. I work 9-5 on weekdays.
```

## O editor de Schedules

O título do editor mostra **Edit**, o nome do personagem e **Schedule**.

No topo, **Routine profile** mostra um resumo da semana em linguagem simples. Clique em **Generate summary** para criá-lo, ou em **Refresh summary** para atualizá-lo. Depois que você muda a agenda, aparece **Summary may be stale**. **Generation model** escolhe o modelo que escreve as agendas.

### Tuning

Abra **Tuning** para os controles principais.

- **Chat talkativeness**: um controle deslizante com **Rare**, **Quiet**, **Balanced**, **Social** e **Very frequent**. O padrão é **Balanced**. Ele define a frequência com que o personagem começa mensagens e entra na conversa de grupo, e o limite diário padrão dele.
- **Wait before checking in**: minutos de silêncio antes de o personagem poder fazer um check-in. O padrão é 120. Você pode usar de 15 a 360.
- **Check-in moments**: chips para **Morning**, **Goodnight**, **Meal breaks**, **After busy** e **Long absence**. Todos ficam ativados. Clique em um para desativá-lo.

Abra **Advanced timing** dentro de **Tuning** para mais três controles.

- **Daily safety limit**: o máximo de check-ins por dia para este personagem. Deixe em **Default**, ou digite um número inteiro igual ou maior que 1. Se o chat também tem um limite numérico, vale o número menor. Caso contrário, este número substitui o número da loquacidade.
- **Delay while you're away**: minutos extras antes de o personagem responder enquanto o status dele é **Away**. Deixe em branco para um tempo aleatório de 1 a 3 minutos. Você pode usar de 0 a 120.
- **Delay while you're busy**: o mesmo enquanto o status dele é **Busy**. Deixe em branco para um tempo aleatório de 2 a 5 minutos. Você pode usar de 0 a 120.

### Schedule AI: refaça a semana

Abra **Schedule AI** para fazer o modelo reescrever a agenda. Escolha uma **Week action**:

| Ação | Resultado |
| --- | --- |
| **Rewrite** | Um rascunho novo da semana inteira. |
| **Adjust** | Mantém a maior parte da agenda e aplica a sua orientação. |
| **Vary** | Uma semana claramente diferente, mas ainda verossímil. |
| **Repair** | Corrige lacunas e problemas óbvios com mudanças pequenas. |

1. Escolha uma **Week action**.
2. Em **Weekly generation**, escolha **Entire week in one request** ou **One request per day**. Uma requisição por dia faz sete requisições menores e pode usar mais tokens (os pedaços pequenos de texto que os modelos contam).
3. Digite dicas opcionais em **Week guidance**, por exemplo `make weekdays more nocturnal, keep weekends social`.
4. Clique no botão que tem o nome da sua ação, como **Rewrite week**.
5. Clique em **Save schedule** para manter o resultado. Até lá, ele é só um rascunho (**Unsaved draft**).

Se não funcionou: o seu rascunho é mantido. Uma chamada que falhou não é repetida, então clique no botão de novo. Clique em **Stop** ou feche o editor para cancelar uma requisição em andamento. Se o editor mostrar **Edit generated schedule JSON**, o modelo devolveu um texto que não pôde ser lido. Corrija o texto ali e clique em **Apply to draft**.

### Blocos diários

Cada dia, de segunda a domingo, tem a sua própria linha. Um dia vazio mostra **No blocks scheduled for this day**. Cada bloco tem um status, um intervalo de tempo como `09:00-11:30` e uma atividade curta como `at work`.

1. Clique em **Add block** embaixo de um dia.
2. Escolha um status: **Online**, **Away**, **Busy** ou **Offline**.
3. Digite o intervalo de tempo e a atividade.
4. Clique em **Save schedule**. **Cancel** fecha o editor sem salvar.

Use o ícone de lixeira para remover um bloco. Para refazer um dia, digite uma dica em **Guide Monday** (ou no dia que você quer) e clique em **Regenerate Monday**.

Durante um bloco **Offline**, o personagem nunca envia mensagem primeiro. Durante um bloco **Busy**, ele espera três vezes mais que o normal.

### Mova uma agenda entre personagens

Clique em **Export schedule** para baixar o rascunho como um arquivo JSON (blocos semanais, resumo, loquacidade, momentos de check-in e tempos). No editor de outro personagem, clique em **Import schedule** para carregá-lo. O Marinara confere o arquivo e move a agenda para a semana atual. Nada é salvo até você clicar em **Save schedule**.

## Defina um status com /status

`/status` define ou limpa um status temporário de um personagem sem mudar a agenda salva dele. Funciona só no Conversation Mode. O status pertence ao personagem, então vale em todo chat em que esse personagem está.

Digite um destes na caixa de mensagem:

```text
/status dnd Mira
/status clear Mira
```

O primeiro deixa a Mira ocupada. O segundo a devolve à agenda dela. Com um só personagem no chat, você pode deixar o nome de fora. `/status` sozinho lista os personagens e o modo de uso.

A forma completa está abaixo. `idle` significa **Away** e `dnd` significa **Busy**. Os colchetes indicam que o nome é opcional.

```text
/status online|idle|dnd|offline|clear [character name]
```

Um status que você define fica até você limpá-lo, e um personagem não pode substituí-lo.

## Deixe os personagens mudarem o próprio status

Com **Schedule Updates** ativado em **Chat Settings → Agents → Commands**, um personagem pode definir o próprio status temporário e a própria atividade. Por exemplo, se você pede que ele se concentre por uma hora, ele pode mudar para **Busy** com a atividade "Studying".

- A mudança dura o tempo que o personagem disser, ou uma hora se ele não disser. O máximo é sete dias.
- Quando o tempo acaba, o personagem volta à agenda dele, ou a **Online** se ele não tem agenda.
- Ele nunca edita a agenda salva.

## Como os check-ins são espaçados

| Regra | Detalhe |
| --- | --- |
| Primeiro check-in | O personagem espera até você ficar em silêncio pelo tempo de **Wait before checking in** dele (120 minutos por padrão). |
| Reação | Uma reação sua, sem mensagem nova, abre uma espera mais curta. |
| Status **Offline** | Nenhum check-in. |
| Status **Busy** | A espera é três vezes mais longa. |
| Acompanhamentos | Até dois a mais enquanto você fica em silêncio, três no total. O primeiro acompanhamento vem depois de duas vezes a espera, o segundo depois de quatro vezes a espera. |
| A sua resposta | A contagem reinicia. |
| Vários personagens prontos | Vai primeiro o que tem a maior loquacidade e o melhor momento. Um personagem que está **Online** tem prioridade maior. |

Em um chat em grupo em que cada personagem responde na própria resposta (veja [Chats em grupo](../chats/group-chats.md)), os personagens compartilham um limite diário e um ritmo. Depois que qualquer personagem faz um check-in, o próximo check-in de qualquer um espera como um acompanhamento. Qualquer personagem cuja própria espera já passou pode enviá-lo, e vai primeiro o que tem menos check-ins no dia. Depois de uma longa ausência, só um personagem faz check-in.

## Guias relacionados

- [Conversation Mode: primeiros passos](getting-started.md)
- [Perfis do Conversation Mode](profiles.md)
- [Visão geral das configurações do chat](../chats/chat-settings.md)
