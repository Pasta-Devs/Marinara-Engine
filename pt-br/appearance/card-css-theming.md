# Guia de temas com Card CSS

Este guia mostra a quem cria personagens e personas como dar um visual próprio ao card dentro do chat. Você coloca CSS no campo **Creator Notes** (notas do criador) do card, e Marinara Engine aplica esse código com segurança nas mensagens daquele personagem. O alcance é só o chat, nunca o resto do aplicativo.

## Antes de começar

Algumas definições simples que aparecem ao longo do guia:

- **CSS** é a linguagem que controla cores, fontes, bordas e espaçamentos em uma página web.
- **Card CSS** é o CSS que você coloca dentro de um card de personagem ou de persona. Ele define o tema das mensagens daquele card.
- **Card Theming** (tema do card) é o controle na tela que liga o Card CSS em um chat.
- Um **seletor** é a parte de uma regra de CSS que escolhe quais elementos serão estilizados.
- Um **seletor descendente** usa um espaço com o sentido de "dentro de". `.a .b` corresponde a um `.b` que está dentro de um `.a`.
- A **cascata** é o sistema do CSS que decide qual regra vence quando várias regras valem para o mesmo elemento.
- O **layout** é a forma como as mensagens ficam dispostas na tela. Marinara tem o layout de linhas **Linear** e o layout **Bubbles**.

## Início rápido

O tema do card é montado em dois lugares. Primeiro você acrescenta o CSS ao card. Depois liga o recurso no chat.

1. Abra o personagem no Character Editor e localize o campo **Creator Notes**. As personas têm o mesmo campo no Persona Editor.
2. Cole um bloco `<style>` no campo **Creator Notes** e salve o card.
3. Abra um chat com esse personagem.
4. Abra **Chat Settings** (configurações do chat) e vá até a seção **Card Theming**.
5. Escolha **Exclusive** ou **Chat**. O modo começa em **Disabled**.

As mensagens do personagem mudam na hora. Os botões de modo de **Card Theming** (Disabled, Exclusive, Chat) só aparecem quando um personagem ativo naquele chat tem CSS no campo **Creator Notes**. Nos chats de Roleplay, a seção em si está sempre presente, pois também contém o interruptor **Color Character Names in Text** (colorir os nomes dos personagens no texto). O CSS de persona sozinho não faz os botões aparecerem. Pelo menos um personagem do chat precisa ter o próprio bloco `<style>`. Se os botões não aparecerem, verifique se o bloco `<style>` foi salvo corretamente.

Veja um bloco inicial para colar no campo **Creator Notes**:

```html
<style>
  /* the visible message bubble (Bubbles layout, and roleplay) */
  [data-card-css] .mari-message-bubble {
    background: linear-gradient(135deg, #2a1240, #3a1030);
    border: 1px solid #ff66cc;
    border-radius: 14px;
  }
  /* the name and the text (works in every message style) */
  [data-card-css] .mari-message-name {
    color: #ff8fd4;
    text-shadow: 0 0 8px rgba(255, 102, 204, 0.6);
  }
  [data-card-css] .mari-message-content {
    color: #ffd6f0;
  }
</style>
```

O nome do personagem ganha um brilho rosa e o texto fica rosa-claro em todos os layouts. A regra da bolha acrescenta um degradê roxo com borda rosa. Um detalhe: `.mari-message-bubble` só existe no layout **Bubbles** e no roleplay. O layout padrão de Conversation é o **Linear**, que não tem elemento de bolha, então a regra da bolha não faz nada ali. A observação "Bubbles em comparação com Linear", mais abaixo, explica a diferença.

**Teste de sanidade:** para um teste que não deixa dúvida, use a regra abaixo. Ela atinge o texto da mensagem, que existe em todos os modos e layouts. O plano de fundo do texto fica rosa vibrante na mesma hora.

```css
[data-card-css] .mari-message-content {
  background: hotpink;
}
```

## Como funciona o Card Theming

Quando um personagem com CSS no campo **Creator Notes** está ativo, Marinara faz quatro coisas:

1. Lê todos os blocos `<style>` do campo **Creator Notes**.
2. Sanitiza o CSS e remove tudo o que for perigoso. Veja a seção "O que você não pode estilizar", mais abaixo.
3. Delimita o escopo do CSS para que ele alcance apenas o chat.
4. Insere o CSS de modo que os seletores com escopo tenham prioridade sobre a estilização de mensagens do próprio aplicativo.

A forma de aplicação é escolhida por chat em **Chat Settings**, na seção **Card Theming**. São três modos.

| Modo | O que faz |
| --- | --- |
| **Disabled** (padrão) | O Card CSS fica desligado, então nenhuma estilização do personagem é aplicada. |
| **Exclusive** | O CSS de cada personagem afeta somente as mensagens dele. |
| **Chat** | Todo o Card CSS afeta a área inteira do chat, incluindo elementos da interface. |

Use **Exclusive** em chats em grupo, onde cada personagem tem o visual próprio. Use **Chat** em chats com um personagem só, quando o card deve dar tema a toda a superfície do chat.

## A regra de escopo que realmente importa

Marinara reescreve o seu CSS para que ele alcance apenas o chat. A forma de reescrever depende do modo.

- O modo **Chat** coloca tudo sob o escopo da área do chat. `.mari-message-bubble` corresponde normalmente, porque fica dentro dessa área.
- O modo **Exclusive** coloca tudo sob o escopo dos elementos de mensagem do seu personagem. Esses elementos carregam `data-card-css`. Uma classe nesse mesmo elemento não pode ser encontrada como descendente. Só o que está dentro dele pode.

Daí vem a regra portátil. Use `[data-card-css]` para estilizar o próprio elemento da mensagem. Use seletores de classe normais para tudo o que está dentro dele, como `.mari-message-bubble`, `.mari-message-content` e `.mari-message-name`.

`[data-card-css]` significa "a mensagem deste personagem" no modo **Exclusive** e "a área do chat" no modo **Chat**. Funciona nos dois. Os seletores de elementos internos (os que têm um espaço) funcionam igual nos dois modos.

```css
[data-card-css] {
  /* the message row itself, good for a left accent border */
  border-left: 3px solid #ff66cc;
}
[data-card-css] .mari-message-bubble {
  /* the visible bubble inside it */
  border-radius: 14px;
}
```

## Mirar em um modo com @chat-mode

Coloque as regras dentro de blocos `@chat-mode` para atingir uma superfície só. O CSS fora de qualquer bloco vale em todo lugar.

```html
<style>
  /* Applies in ALL modes */
  [data-card-css] .mari-message-name {
    color: #00ff95;
  }

  /* Only in Roleplay mode */
  @chat-mode roleplay {
    [data-card-css] .mari-message-bubble {
      border: 1px solid rgba(0, 255, 149, 0.4);
      box-shadow: 0 0 16px rgba(0, 255, 149, 0.25);
    }
  }

  /* Only in Conversation mode */
  @chat-mode conversation {
    [data-card-css] .mari-message-bubble {
      background: rgba(0, 40, 28, 0.9);
      border-radius: 1rem;
    }
  }
</style>
```

As consultas `@media` padrão funcionam normalmente dentro dos blocos `@chat-mode`. Use essas consultas para layouts responsivos.

O **Game Mode** tem suporte básico. No modo **Chat**, o Card CSS alcança toda a superfície do jogo. Assim, `[data-card-css]` dá tema à área do jogo, e `@chat-mode game` mira nela. Game usa um layout próprio. Os ganchos de bolha de mensagem citados acima não existem lá, então mire em algo amplo, como o plano de fundo da área. A estilização por personagem (Exclusive) da narração do jogo ainda não está disponível.

## O que você pode estilizar

A estrutura do chat tem o mesmo esqueleto em Roleplay e em Conversation. Estes são os elementos que o Card CSS pode atingir. As classes utilitárias internas não são ganchos estáveis. Elas mudam de uma versão para outra, então fique com as classes `mari-*` e os atributos `data-*` da tabela abaixo.

| Seletor | O que atinge |
| --- | --- |
| `[data-card-css]` | A linha inteira da mensagem (o elemento de escopo). Bom para detalhes na lateral ou na borda, ou para a área do chat no modo **Chat**. |
| `[data-card-css] .mari-message-bubble` | A bolha visível: plano de fundo, borda, cantos, sombra. Existe no layout **Bubbles** e no roleplay. |
| `[data-card-css] .mari-message-content` | No layout **Bubbles**, o próprio elemento da bolha, incluindo plano de fundo, borda e cantos. No **Linear**, só o texto da mensagem. |
| `[data-card-css] .mari-message-name` | O nome de exibição do personagem. |
| `[data-card-css] .mari-message-meta` | A linha de cabeçalho que traz o nome e o horário. |
| `[data-card-css] .mari-message-timestamp` | O horário. |
| `[data-card-css] .mari-message-avatar` | A coluna do avatar. |
| `[data-card-css] .mari-message-narrator` | As mensagens do narrador (roleplay). |
| `[data-card-css] .mari-message-user` | As mensagens do usuário. Use `.mari-message-assistant` para as mensagens do personagem. |
| `[data-card-css] p`, `... span` | Parágrafos e trechos em linha dentro do texto. |
| `[data-grouped]` | Mensagens seguidas do mesmo personagem. Só no Conversation Mode; as linhas de roleplay nunca têm esse atributo. Use `[data-card-css]:not([data-grouped])` para a primeira mensagem de um conjunto. |

**Bubbles em comparação com Linear.** O layout **Bubbles** é o que `.mari-message-bubble` atinge. O layout **Linear** não tem elemento de bolha, então estilize `.mari-message-content` (o texto) e `[data-card-css]` (a linha). Para mudar o layout, vá em **Settings** (Configurações), depois **Appearance**, depois a seção **Conversation Display** e então **Chat Layout**. O roleplay sempre tem bolha.

Veja uma bolha estilizada de conversation ou roleplay:

```css
[data-card-css] .mari-message-bubble {
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
  border: 1px solid rgba(100, 149, 237, 0.35);
  border-radius: 1rem;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.35);
}
[data-card-css] .mari-message-name {
  color: #6495ed;
  text-shadow: 0 0 8px rgba(100, 149, 237, 0.5);
}
[data-card-css] .mari-message-content {
  font-family: Georgia, serif;
}
```

### Indicador de digitação

Enquanto o personagem escreve a resposta, o layout **Linear** de Conversation mostra uma linha com "(name) is typing...". Ela também pode ser estilizada.

| Seletor | O que atinge |
| --- | --- |
| `[data-card-css] .mari-typing-text` | O texto "(name) is typing...". |
| `[data-card-css] .mari-typing-dots span` | Os pontinhos animados. |
| `[data-card-css] .mari-typing-indicator` | A linha em si. Ela também carrega o nome em `data-typing-name`. |

```css
[data-card-css] .mari-typing-text {
  color: #ff66cc;
  font-style: italic;
}
[data-card-css] .mari-typing-dots span {
  background: #ff66cc;
}
```

### Avatar

Por padrão, o avatar é um círculo. Com CSS puro, você muda o formato e acrescenta um anel em volta. Os exemplos abaixo miram no botão de avatar clicável. Se alguma superfície exibir o avatar sem ser clicável, aplique a mesma ideia na alternativa `.mari-message-avatar > div` daquele layout. No roleplay, o botão fica dentro de uma `div` extra que faz o brilho. Deixe esse invólucro sem estilo se você quer só o seu próprio anel.

```css
[data-card-css] .mari-message-avatar button {
  border-radius: 6px; /* 0 for sharp corners, 50% for a circle */
  box-shadow: 0 0 0 2px #ff66cc;
}
/* roleplay only: drop the app glow wrapper so just your ring shows */
@chat-mode roleplay {
  [data-card-css] .mari-message-avatar > div {
    box-shadow: none;
  }
}
```

### Janelinha de perfil About Me (só em Conversation)

No Conversation Mode, ao clicar em um avatar abre uma janelinha de perfil com o "about me" do personagem ou da persona. Ela pode receber tema pelo mesmo escopo `[data-card-css]`. Essa janelinha só existe no Conversation Mode. Não existe em roleplay nem em game. Coloque essas regras dentro de `@chat-mode conversation` se o card também trouxer CSS de roleplay ou de game. Tanto os cards de personagem quanto as personas podem dar tema à própria janelinha a partir do campo **Creator Notes**.

Um detalhe sobre as personas: os botões de modo de **Card Theming** só aparecem quando um personagem ativo do chat tem CSS no campo **Creator Notes**. CSS só de persona não faz os botões aparecerem. Portanto, para o tema da janelinha da persona funcionar, pelo menos um personagem do chat também precisa ter um bloco `<style>`.

| Seletor | O que atinge |
| --- | --- |
| `[data-card-css].mari-about-me-popout` | O card da janelinha em si (o elemento de escopo): plano de fundo, borda, formato. |
| `[data-card-css] .mari-about-me-banner` | A faixa superior (que usa a cor do nome por padrão). |
| `[data-card-css] .mari-about-me-avatar` | O invólucro do avatar ampliado. Use `... > div` para o círculo. |
| `[data-card-css] .mari-about-me-status` | O pontinho de status de presença (só personagens). |
| `[data-card-css] .mari-about-me-name` | O título com o nome de exibição. |
| `[data-card-css] .mari-about-me-handle` | A linha secundária com @nome (aparece quando o nome de exibição no Convo é diferente). |
| `[data-card-css] .mari-about-me-presence` | A linha de status ou de atividade (só personagens). |
| `[data-card-css] .mari-about-me-box` | A caixa que contém o About Me. |
| `[data-card-css] .mari-about-me-label` | A legenda "ABOUT ME". |
| `[data-card-css] .mari-about-me-badge` | A pílula Default ou Chat-specific. |
| `[data-card-css] .mari-about-me-text` | O corpo do texto de about me já renderizado. |

O card da janelinha é o elemento de escopo. Mire nele com `[data-card-css].mari-about-me-popout` (sem espaço, mesmo elemento). Mire nos filhos com um seletor descendente, como `[data-card-css] .mari-about-me-name`. No modo **Chat**, a área inteira está no escopo, então `.mari-about-me-name` pode ser usado direto.

Veja uma janelinha de "about me" com tema. Cole no campo **Creator Notes** de um personagem ou de uma persona e ative o **Card Theming** em **Chat Settings**. Se você colar em uma persona, lembre do detalhe citado acima. Algum personagem do chat também precisa ter CSS no campo **Creator Notes**, senão os botões de modo continuam escondidos.

```html
<style>
@chat-mode conversation {
  [data-card-css].mari-about-me-popout {
    background: radial-gradient(120% 120% at 50% 0%, #241a3a 0%, #14101f 70%);
    border: 1px solid rgba(180, 120, 255, 0.45);
    border-radius: 1.25rem;
  }
  [data-card-css] .mari-about-me-banner {
    background: linear-gradient(90deg, #b478ff, #ff77c6);
  }
  [data-card-css] .mari-about-me-avatar > div {
    border-radius: 0.9rem; /* squircle avatar */
    box-shadow: 0 0 0 2px #b478ff;
  }
  [data-card-css] .mari-about-me-name {
    color: #e9d8ff;
    text-shadow: 0 0 10px rgba(180, 120, 255, 0.6);
  }
  [data-card-css] .mari-about-me-box {
    background: rgba(180, 120, 255, 0.08);
    border: 1px solid rgba(180, 120, 255, 0.25);
    border-radius: 0.75rem;
  }
  [data-card-css] .mari-about-me-label {
    color: #b478ff;
    letter-spacing: 0.12em;
  }
  [data-card-css] .mari-about-me-text {
    font-family: Georgia, serif;
    color: #f2e9ff;
  }
}
</style>
```

## O que você não pode estilizar

O sanitizador remove estes itens por segurança.

| Bloqueado | Motivo |
| --- | --- |
| `url(https://...)` | Nada de requisições de rede, para evitar rastreamento e vazamento de dados. Só `url(data:...)` é permitido, para imagens e fontes embutidas. |
| `@font-face` com URLs externas | Só ficam as fontes de origem `data:`. O nome da família é renomeado automaticamente, para não sobrepor as fontes do aplicativo. |
| `@import` | Nada de carregar folhas de estilo externas. |
| Seletores `:has()` | Não podem sondar elementos fora do chat. |
| Regras aninhadas e seletores que começam com `~` ou `+` | Descartados, para que o Card CSS não alcance nada fora do próprio escopo. Escreva-os como seletores comuns. |
| HTML em `content:` | Texto decorativo é permitido, mas `<` e `>` são removidos e o texto fica limitado a 200 caracteres. `attr()` e `counter()` são permitidos. |
| `position: fixed` | Vira `position: absolute`, então não há sobreposições em tela cheia. |
| `!important` | Removido, para que o Card CSS não force a sobreposição dos estilos do aplicativo. |
| Tokens de tema do aplicativo | Tokens como `--primary` e `--background` são removidos, para que o Card CSS não repinte a interface do aplicativo. |

Marinara insere o Card CSS com seletores de escopo que superam os estilos de mensagem do próprio aplicativo. Ele vence em cores, planos de fundo, bordas e fontes dentro do chat. Ele só não vence o que o sanitizador remove, o que está fora do chat e os estilos que o aplicativo aplica em linha ou com `!important`. A cor e o tamanho globais da fonte do chat, definidos em **Settings**, são um exemplo disso.

**Fontes personalizadas.** Embuta a fonte com um URI `data:` em base64 ou use uma pilha de fontes do sistema ou seguras para a web.

```css
@font-face {
  font-family: "MyFont";
  src: url(data:font/woff2;base64,d09GMgAB...) format("woff2");
}
```

```css
font-family: "Courier New", Consolas, monospace;
```

## Exclusive em comparação com Chat: como escolher o escopo

- Com **Exclusive**, `[data-card-css]` significa as mensagens deste personagem. É a melhor opção para chats em grupo e para dar identidade a cada personagem. O CSS que atinge elementos dentro da mensagem funciona igual ao do modo **Chat**.
- Com **Chat**, `[data-card-css]` significa a área inteira do chat. É a melhor opção para cards de conversa a dois que querem dar tema ao plano de fundo ou à atmosfera, não só às bolhas de mensagem.

Monte tudo com seletores `[data-card-css] .mari-message-...` e o card funciona direito nos dois modos.

## Dicas

1. Estilize a bolha com `.mari-message-bubble`, não com `[data-card-css]`. Este último é a linha inteira, então um plano de fundo nele fica quase invisível.
2. Use cores em `rgba()` para elas se integrarem tanto no tema claro quanto no escuro.
3. Mantenha as animações discretas. Prefira `transition` a uma `animation` pesada em dispositivos mais simples.
4. Use `@media (max-width: 768px)` para celulares.
5. Não dependa de classes utilitárias. Só os ganchos `mari-*` documentados são estáveis.

## Vitrine: Eldritch Grimoire

Este é um card propositalmente exagerado. Ele usa todos os ganchos documentados, em todos os modos. Ele mostra:

- nomes em versais rúnicas brilhantes e texto serifado com tema
- um avatar remodelado e com anel, além de horários em versalete
- um sigilo na borda da linha da mensagem
- uma bolha de roleplay animada com runa no canto e narração estilizada
- uma bolha de Conversation e um indicador de digitação sinistro
- a janelinha de perfil que abre ao clicar no avatar, com tema completo
- a superfície do jogo

Cole tudo no campo **Creator Notes** e ative o **Card Theming** em **Chat Settings**. Ele dá tema às mensagens em Roleplay e Conversation, à janelinha em Conversation e à superfície em Game (defina o modo como **Chat** para o jogo). As seções são separadas por `@chat-mode`, então cada modo recebe exatamente os ganchos que tem. Tudo passa pelo sanitizador sem problema.

```html
<style>
  /* shared keyframe. Animate OPACITY, never box-shadow: box-shadow is a "paint"
     property, so animating it repaints and re-blurs the whole element every frame
     (which pins weak GPUs). Animating a layer's opacity is GPU-composited and cheap. */
  @keyframes grimoire-pulse {
    0%,
    100% {
      opacity: 0.35;
    }
    50% {
      opacity: 1;
    }
  }

  /* EVERYWHERE (all modes). */
  /* These descendant hooks only match where message rows exist, so they are inert
     in Game and safe to leave unwrapped. */

  /* the character name, glowing crimson rune-caps */
  [data-card-css] .mari-message-name {
    color: #ff5c8a;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    font-size: 0.82rem;
    text-shadow: 0 0 8px rgba(255, 92, 138, 0.7), 0 0 16px rgba(168, 85, 247, 0.45);
  }
  /* header row and timestamp */
  [data-card-css] .mari-message-meta {
    align-items: baseline;
  }
  [data-card-css] .mari-message-timestamp {
    color: rgba(243, 215, 255, 0.5);
    font-variant: small-caps;
  }
  /* reshape, ring, and saturate the clickable avatar. For a non-clickable avatar,
     target .mari-message-avatar > div for that layout. */
  [data-card-css] .mari-message-avatar button {
    border-radius: 7px;
    box-shadow: 0 0 0 2px rgba(220, 38, 120, 0.6), 0 0 14px rgba(168, 85, 247, 0.5);
    filter: saturate(1.2) contrast(1.05);
  }
  /* glowing serif message text */
  [data-card-css] .mari-message-content {
    color: #f3d7ff;
    text-shadow: 0 0 2px rgba(168, 85, 247, 0.4);
    font-family: "Iowan Old Style", Georgia, "Times New Roman", serif;
  }

  /* ROLEPLAY */
  @chat-mode roleplay {
    /* the row itself, an arcane left edge. (data-grouped does not exist in
       roleplay, so there is no first-of-run trick here.) */
    [data-card-css] {
      border-left: 2px solid rgba(220, 38, 120, 0.35);
    }
    /* roleplay wraps the avatar button in its own glow layer. Flatten it
       so only the eldritch ring above hugs the picture. */
    [data-card-css] .mari-message-avatar > div {
      box-shadow: none;
    }
    /* the visible bubble and a corner sigil */
    [data-card-css] .mari-message-bubble {
      background: linear-gradient(135deg, #1a0a24 0%, #2d0a2e 55%, #3a0a1e 100%);
      border: 1px solid rgba(220, 38, 120, 0.45);
      border-radius: 4px 16px 16px 16px;
      position: relative;
      overflow: hidden;
      /* a steady outer halo. An element's own box-shadow is not clipped by its own
         overflow: hidden, so this bloom shows even though message content is clipped.
         (No inset here: the pulsing inset glow lives on the ::after, so a static inset
         would stack with it and over-brighten the inner glow.) */
      box-shadow: 0 0 16px rgba(190, 70, 190, 0.4);
    }
    /* the breathing inner glow. Animate a full-bleed overlay's OPACITY (cheap, GPU
       composited) instead of the bubble's box-shadow (expensive: a full repaint every
       frame). overflow: hidden clips a child's OUTER shadow, so the pulse rides the inset
       glow while the halo above stays steady. pointer-events keeps it click-through. */
    [data-card-css] .mari-message-bubble::after {
      content: "";
      position: absolute;
      inset: 0;
      border-radius: inherit;
      pointer-events: none;
      box-shadow: inset 0 0 26px rgba(120, 0, 80, 0.65);
      animation: grimoire-pulse 4s ease-in-out infinite;
      will-change: opacity;
    }
    [data-card-css] .mari-message-bubble::before {
      content: "✦";
      position: absolute;
      top: 1px;
      right: 7px;
      font-size: 0.7rem;
      color: rgba(220, 38, 120, 0.55);
      text-shadow: 0 0 6px rgba(220, 38, 120, 0.9);
    }
    /* narration */
    [data-card-css] .mari-message-narrator {
      color: #c9a8ff;
      font-style: italic;
      opacity: 0.9;
    }
  }

  /* CONVERSATION */
  @chat-mode conversation {
    /* an arcane left edge on the first message of a run. [data-grouped] marks
       continuations from the same character, and it exists only in
       Conversation mode. */
    [data-card-css]:not([data-grouped]) {
      border-left: 2px solid rgba(220, 38, 120, 0.35);
    }
    [data-card-css][data-grouped] {
      border-left: 2px solid transparent;
    }
    /* the Bubbles-layout bubble. In the Linear layout there is no bubble, so
       the EVERYWHERE row hooks above carry the theme instead. */
    [data-card-css] .mari-message-bubble {
      background: rgba(26, 10, 36, 0.92);
      border: 1px solid rgba(220, 38, 120, 0.4);
      border-radius: 1rem;
    }
    /* "(name) is typing..." (Linear layout) */
    [data-card-css] .mari-typing-text {
      color: #ff5c8a;
      font-style: italic;
      letter-spacing: 0.05em;
      text-shadow: 0 0 8px rgba(255, 92, 138, 0.6);
    }
    [data-card-css] .mari-typing-dots span {
      background: #ff5c8a;
      box-shadow: 0 0 6px rgba(255, 92, 138, 0.85);
    }

    /* the avatar-click profile popout. The popout card is the scope element,
       so target it with no space, and its children as descendants. */
    [data-card-css].mari-about-me-popout {
      background: radial-gradient(120% 120% at 50% 0%, #241a3a 0%, #12081c 72%);
      border: 1px solid rgba(220, 38, 120, 0.45);
      border-radius: 1.25rem;
    }
    [data-card-css] .mari-about-me-banner {
      background: linear-gradient(90deg, #a855f7, #dc2678);
    }
    [data-card-css] .mari-about-me-avatar > div {
      border-radius: 0.9rem;
      box-shadow: 0 0 0 2px #dc2678, 0 0 14px rgba(168, 85, 247, 0.5);
    }
    [data-card-css] .mari-about-me-status {
      box-shadow: 0 0 8px rgba(255, 92, 138, 0.9);
    }
    [data-card-css] .mari-about-me-name {
      color: #ffd7ef;
      text-shadow: 0 0 10px rgba(220, 38, 120, 0.6);
    }
    [data-card-css] .mari-about-me-handle {
      color: rgba(201, 168, 255, 0.8);
    }
    [data-card-css] .mari-about-me-presence {
      color: rgba(201, 168, 255, 0.7);
    }
    [data-card-css] .mari-about-me-box {
      background: rgba(168, 85, 247, 0.08);
      border: 1px solid rgba(220, 38, 120, 0.3);
      border-radius: 0.75rem;
    }
    [data-card-css] .mari-about-me-label {
      color: #dc2678;
      letter-spacing: 0.14em;
    }
    [data-card-css] .mari-about-me-badge {
      background: rgba(220, 38, 120, 0.18);
      color: #ffd7ef;
    }
    [data-card-css] .mari-about-me-text {
      color: #f3d7ff;
      font-family: "Iowan Old Style", Georgia, serif;
    }
  }

  /* GAME (set the mode to Chat) */
  @chat-mode game {
    /* Game has its own layout with no message bubbles. In Chat scope,
       [data-card-css] is the whole game surface, so theme the area broadly. */
    [data-card-css] {
      background-image: radial-gradient(120% 80% at 50% 0%, rgba(58, 10, 46, 0.5), transparent 70%);
    }
  }
</style>
```

**Linhas do usuário em comparação com as do personagem.** No escopo **Exclusive**, `[data-card-css]` é a mensagem do próprio personagem, que também é `.mari-message-assistant`. Para dar tema também às suas linhas, use o escopo **Chat**. Ali `[data-card-css]` é a área inteira, e `[data-card-css] .mari-message-user` e `.mari-message-assistant` selecionam cada lado.

Troque as cores, o glifo de `content` e as fontes para deixar tudo com a sua cara.

## Usar um assistente de IA para criar o Card CSS

Se você prefere não escrever o CSS à mão, passe este prompt (o texto que Marinara envia para a IA) a um assistente de IA. Preencha o conceito do personagem no ponto indicado.

```text
I'm creating a character card for Marinara Engine (an AI chat app). The card has a
"Creator Notes" field where I can embed <style> blocks. Write CSS that themes the
character's messages.

Character concept: [describe the aesthetic]

Technical constraints:
- Use [data-card-css] for the message row (works in both Exclusive and Chat modes);
  use normal class selectors for things inside it.
- [data-card-css] .mari-message-bubble = the visible bubble (background / border /
  corners / shadow); [data-card-css] .mari-message-content = the text;
  [data-card-css] .mari-message-name = the display name;
  [data-card-css] .mari-message-avatar button = the clickable avatar
  (non-clickable fallback: .mari-message-avatar > div; in roleplay the button sits
  under an extra glow-wrapper div).
- Style the typing indicator via [data-card-css] .mari-typing-text and
  [data-card-css] .mari-typing-dots span.
- Conversation only: the avatar-click "about me" popout is themable via
  [data-card-css].mari-about-me-popout (the card), the banner via
  .mari-about-me-banner, the avatar via .mari-about-me-avatar > div, the name via
  .mari-about-me-name, the box via .mari-about-me-box, and the body via
  .mari-about-me-text. Wrap these in @chat-mode conversation { ... }.
- Wrap roleplay-only CSS in @chat-mode roleplay { ... }, conversation-only in
  @chat-mode conversation { ... }; CSS outside applies everywhere.
- Blocked: url(https://...), @import, :has(), !important, app theme tokens
  (--primary, etc.). position: fixed becomes absolute. Use url(data:...) and
  rgba() colors.
- [data-grouped] marks continuation messages, in Conversation mode ONLY
  (roleplay rows never carry it); there, use
  [data-card-css]:not([data-grouped]) for first-in-group.

Output a single <style> block I can paste into Creator Notes.
```

## Guias relacionados

- [Configurações de aparência](appearance-settings.md)
- [Temas de CSS personalizados (Theme Library)](custom-css-themes.md)
- [Criando e editando personagens](../characters/creating-and-editing-characters.md)
