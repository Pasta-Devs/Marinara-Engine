# Geração guiada e Impersonate

Este guia explica duas formas de conduzir um chat no Marinara Engine. A geração guiada aponta o rumo da resposta da IA sem publicar nenhuma mensagem visível. Já o Impersonate faz a IA escrever a sua própria resposta no seu lugar. O guia também apresenta o menu **Quick replies** (respostas rápidas), que coloca as duas ações ao lado do botão **Send** (enviar).

## Geração guiada

Com a geração guiada, você diz para a IA que rumo a próxima resposta deve tomar. A sua instrução fica fora do personagem: ela orienta a resposta, mas não aparece como mensagem comum do chat.

### Conduzir uma resposta com /guided

A forma principal de guiar uma resposta é o comando de barra `/guided`.

1. Digite `/guided` seguido do rumo desejado na caixa de mensagem.
2. Pressione Enter ou clique em **Send**.
3. A IA gera a próxima resposta seguindo o rumo que você indicou.

Veja um exemplo de instrução que empurra a resposta seguinte para uma confissão:

```
/guided make him admit he is lying
```

O comando tem apelidos curtos. No lugar de `/guided`, digite `/narrator`, `/narrate` ou `/nar`.

Em um chat em grupo, o rumo pode ser direcionado a um personagem só. Digite `/guided respond for <character> <direction>`. Troque `<character>` pelo nome do personagem e `<direction>` pela sua instrução. Por exemplo:

```
/guided respond for Alice make her admit she is lying
```

### Regeneração guiada

A resposta também pode ser guiada na hora de regenerar. Nesse caso, Marinara aproveita o texto já digitado na caixa de mensagem como um rumo de uso único.

1. Abra **Settings** (Configurações), depois **Advanced** (avançado) e então **Message Tools** (ferramentas de mensagem).
2. Ative a opção **Guide swipes/regens with chat input**. Essa configuração vem desativada por padrão.
3. Volte para um chat e digite um rumo na caixa de mensagem, sem enviar.
4. Clique em **Regenerate** (regenerar) na mensagem da IA.

Com a configuração ativada e algum texto na caixa, a dica do botão **Regenerate** passa a mostrar **Regenerate (guided)**. A IA cria uma nova versão da resposta usando o texto digitado como rumo.

### Consultar a orientação salva

Quando uma resposta nasce de um rumo, Marinara salva esse rumo para você consultar depois. Uma ação **Stored guidance** (orientação salva), com ícone de pergaminho, aparece na mensagem.

1. Clique no ícone **Stored guidance** na mensagem da IA.
2. Abre-se a janela **Stored guidance**, com o rumo que originou aquela resposta.

A janela identifica a origem do rumo:

- **/guided**: veio do comando `/guided`.
- **Guided regenerate**: veio de um clique guiado em **Regenerate**.
- **Game start**: veio da configuração do Game Mode.

Para rumos vindos do `/guided` e da regeneração guiada, o botão **Copy /guided** copia a instrução já no formato de um comando `/guided` pronto para usar. Cole em outro chat para repetir a mesma condução.

## Impersonate

O Impersonate faz a IA escrever a sua próxima mensagem, com a voz da sua persona. A persona é o personagem que você interpreta, escrito no chat como `{{user}}`. Veja [Personas do usuário](../characters/personas.md) para aprender a criar uma.

O Impersonate funciona apenas em chats de Roleplay. Ele não está disponível em chats de Conversation nem em chats de Game Mode. Ao tentar usá-lo em um chat de Conversation, aparece a mensagem "Impersonate is not available in Conversation mode."

### Como usar o /impersonate

1. Digite `/impersonate` na caixa de mensagem. Se quiser, acrescente um rumo depois do comando.
2. Pressione Enter ou clique em **Send**.
3. A IA escreve uma mensagem de usuário como a sua persona e publica no chat.

Neste exemplo, a IA escreve com a sua voz uma mensagem que pergunta sobre o tempo:

```
/impersonate ask about the weather
```

O comando tem um apelido curto. No lugar de `/impersonate`, digite `/imp`.

Uma mensagem escrita pelo Impersonate pode ser refeita. A ação **Regenerate** funciona nas mensagens de usuário criadas pelo Impersonate, então você consegue uma versão diferente.

### As configurações do Impersonate

O Impersonate tem uma seção de configurações que vale para todo `/impersonate` executado, em todos os chats. O acesso é pelas configurações de cada chat.

1. Abra o painel **Chat Settings** (configurações do chat) de um chat de Roleplay.
2. Localize a seção **Impersonate**.

A seção reúne estes controles:

- **Prompt Template**: uma instrução opcional enviada ao modelo sempre que você usa o Impersonate. Deixe em branco para usar o prompt do próprio chat ou, quando o chat não tiver um, o padrão embutido. O campo aceita as macros `{{user}}`, `{{persona_description}}` e `{{impersonate_direction}}`. Uma macro é um marcador que Marinara substitui por texto real antes do envio. Clique em **Built-in default** para ler o texto padrão. O botão **Reset** limpa um modelo personalizado e devolve o campo ao estado vazio.
- **Preset**: use um preset de prompt específico só nas respostas do Impersonate. Um preset é um conjunto salvo de configurações de prompt. Veja [Presets](../prompts/presets.md). O padrão é **Use chat default**. Os presets valem apenas em Roleplay.
- **Connection**: envie as respostas do Impersonate por uma conexão específica, como um modelo mais barato ou mais rápido. Uma conexão é um vínculo salvo com um provedor de IA. Veja [Conectando a um provedor de IA](../connections/connecting-to-a-provider.md). O padrão é **Use chat default**. Também existe a opção **Random**.
- **Skip agents**: quando ativado, Marinara pula a linha de agentes (trackers, roteadores de lorebook e ajudantes parecidos) durante o Impersonate. Assim o Impersonate fica rápido e não altera o estado do mundo. Vem desativado por padrão. Veja [Agentes: ajudantes de IA para os seus chats](../agents/agents-overview.md).
- **Use CYOA as direction**: quando ativado, clicar em uma opção CYOA usa aquele texto como rumo do Impersonate em vez de publicá-lo como mensagem comum. CYOA significa choose your own adventure, um conjunto de escolhas clicáveis que alguns chats mostram depois da resposta. Essa configuração vem desativada por padrão.

### Definir um prompt de Impersonate personalizado

Também é possível definir um prompt de Impersonate para um único chat, por comando de barra.

1. Digite `/impersonate_prompt` seguido do seu prompt entre aspas.
2. Pressione Enter.

Por exemplo:

```
/impersonate_prompt "You will now play as my OC:"
```

Para limpar o prompt daquele chat e voltar ao padrão, digite:

```
/impersonate_prompt reset
```

O comando tem um apelido curto, `/imp_prompt`.

## O menu Quick replies

O menu **Quick replies** acrescenta ações extras de envio ao lado do botão **Send** comum. Com ele, a geração guiada e o Impersonate ficam a um clique, sem precisar digitar um comando de barra.

As ações exibidas são escolhidas nas configurações.

1. Abra **Settings**, depois **Advanced** e então **Message Tools**.
2. Ative a opção **Quick replies**. Ela vem desativada por padrão.
3. Expanda a opção para escolher quais ações aparecem. Com o menu ativado, as três ações vêm ativadas por padrão.

As três ações são:

- **Post only**: adiciona a mensagem digitada ao chat sem iniciar uma resposta da IA. Você também pode usar o comando de barra `/send <message>`.
- **Guide reply**: envia o texto digitado como rumo do `/guided`, e não como mensagem comum.
- **Impersonate**: gera uma resposta como a sua persona, usando o texto digitado como rumo. Essa ação fica oculta em chats de Conversation, porque o Impersonate não funciona lá.

Quando só uma ação está ativada, o botão dela aparece direto ao lado do **Send**. Com mais de uma ativada, elas se agrupam em um menu pequeno. Clique no botão de três pontos (identificado como **Quick replies**) para abri-lo.

## Guias relacionados

- [Ações de mensagem: editar, excluir, swipe e regenerar](messages.md)
- [Peek Prompt: veja o que a IA recebeu](peek-prompt.md)
- [Personas do usuário: criar e editar](../characters/personas.md)
- [Presets](../prompts/presets.md)
