# Guia de temas com Card CSS

O Card CSS dá a um card de personagem ou de persona um visual próprio no chat. Você coloca CSS no campo **Creator Notes** (notas do criador) do card, e Marinara o aplica nas mensagens daquele personagem. Ele só pode estilizar o chat, nunca o resto do aplicativo. Este guia é para quem cria cards.

## Antes de começar

Termos usados neste guia:

- **CSS** controla cores, fontes, bordas e espaçamentos.
- **Card CSS** é o CSS colocado dentro de um card. Ele define o tema das mensagens daquele card.
- **Card Theming** (tema do card) é o controle, por chat, que liga o Card CSS. Ele fica em **Chat Settings → Characters** (configurações do chat → personagens), ou em **Party** (equipe) no Game.
- Um **seletor** é a parte de uma regra de CSS que escolhe quais elementos serão estilizados. Um espaço entre dois seletores significa "dentro de", então `.a .b` corresponde a um `.b` que está dentro de um `.a`.
- Um **layout** é a forma como as mensagens ficam dispostas. O Conversation tem o layout de linhas **Linear** e o layout **Bubbles**.

## Início rápido

Veja um bloco inicial para colar no passo 2:

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

Você acrescenta o CSS ao card e depois liga o recurso no chat.

1. Abra o personagem no Character Editor e localize o campo **Creator Notes**. As personas têm o mesmo campo no Persona Editor.
2. Cole o bloco inicial no campo **Creator Notes** e salve o card.
3. Abra um chat com esse personagem.
4. Abra **Chat Settings** e depois **Characters** (ou **Party** no Game).
5. Escolha **Exclusive** ou **Chat** em **Card Theming**. O modo começa em **Disabled**.

As mensagens do personagem mudam na hora.

Se não funcionou: os botões **Disabled**, **Exclusive** e **Chat** só aparecem quando um personagem ativo no chat tem CSS no campo **Creator Notes**. O CSS de persona sozinho não faz os botões aparecerem, então o tema de uma persona também precisa de um personagem no chat com um bloco `<style>`. Verifique se o seu bloco `<style>` foi salvo. Nos chats de Roleplay, **Color Character Names in Text** (colorir os nomes dos personagens no texto) fica em **Characters**, logo abaixo de **Add Character** (adicionar personagem).

O nome ganha um brilho rosa e o texto fica rosa-claro em todos os layouts. A regra da bolha acrescenta um degradê roxo com borda rosa. `.mari-message-bubble` só existe no layout **Bubbles** e no roleplay, então no layout padrão de Conversation, o **Linear**, a regra da bolha não faz nada.

Para um teste que não deixa dúvida, use esta regra. Ela atinge o texto da mensagem, que existe em todos os modos e layouts, e deixa o plano de fundo dele rosa vibrante.

```css
[data-card-css] .mari-message-content {
  background: hotpink;
}
```

## Como funciona o Card Theming

Quando um personagem com CSS no campo **Creator Notes** está ativo, Marinara lê todos os blocos `<style>`, remove tudo o que for perigoso (veja [O que você não pode estilizar](#what-you-cannot-style)), delimita o escopo do CSS para que ele alcance apenas o chat e o insere de modo que os seletores dele tenham prioridade sobre a estilização de mensagens do próprio aplicativo.

A forma de aplicação é escolhida por chat em **Chat Settings → Characters** (ou **Party** no Game).

| Modo | O que faz |
| --- | --- |
| **Disabled** (padrão) | O Card CSS fica desligado. |
| **Exclusive** | O CSS de cada personagem afeta somente as mensagens dele. |
| **Chat** | Todo o Card CSS afeta a área inteira do chat, incluindo elementos da interface. |

Use **Exclusive** em chats em grupo, onde cada personagem tem um visual próprio. Use **Chat** em cards de conversa a dois que dão tema a toda a superfície do chat, como o plano de fundo.

## A regra de escopo

Marinara reescreve o seu CSS para que ele alcance apenas o chat.

- No modo **Chat**, tudo fica sob o escopo da área do chat. `[data-card-css]` significa a área do chat.
- No modo **Exclusive**, tudo fica sob o escopo de cada elemento de mensagem do seu personagem. `[data-card-css]` significa a mensagem deste personagem.

Por isso, use `[data-card-css]` para estilizar o próprio elemento da mensagem e seletores de classe normais para o que está dentro dele, como `.mari-message-bubble`, `.mari-message-content` e `.mari-message-name`. Uma classe no mesmo elemento não pode ser encontrada como descendente. Monte tudo com `[data-card-css] .mari-message-...` e o card funciona nos dois modos.

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

No escopo **Exclusive**, `[data-card-css]` é a mensagem do próprio personagem, que também é `.mari-message-assistant`. Para dar tema também às suas linhas, use o escopo **Chat**. Ali, `[data-card-css] .mari-message-user` e `.mari-message-assistant` selecionam cada lado.

## Mirar em um modo com @chat-mode

Coloque as regras dentro de `@chat-mode roleplay`, `@chat-mode conversation` ou `@chat-mode game` para atingir uma superfície só. O CSS fora de qualquer bloco vale em todo lugar. As consultas `@media` padrão funcionam dentro desses blocos.

```html
<style>
  /* Applies in all modes */
  [data-card-css] .mari-message-name {
    color: #00ff95;
  }

  @chat-mode roleplay {
    [data-card-css] .mari-message-bubble {
      border: 1px solid rgba(0, 255, 149, 0.4);
      box-shadow: 0 0 16px rgba(0, 255, 149, 0.25);
    }
  }

  @chat-mode conversation {
    [data-card-css] .mari-message-bubble {
      background: rgba(0, 40, 28, 0.9);
      border-radius: 1rem;
    }
  }
</style>
```

O Game Mode tem suporte básico. No modo **Chat**, o Card CSS alcança toda a superfície do jogo, então `[data-card-css]` dá tema à área do jogo. O Game tem um layout próprio e não tem bolhas de mensagem, então mire em algo amplo, como o plano de fundo da área. A estilização por personagem (**Exclusive**) da narração do jogo ainda não está disponível.

## O que você pode estilizar

Roleplay e Conversation têm o mesmo esqueleto. Fique com as classes `mari-*` e os atributos `data-*` abaixo. As outras classes mudam de uma versão para outra.

| Seletor | O que atinge |
| --- | --- |
| `[data-card-css]` | A linha inteira da mensagem (o elemento de escopo). Bom para detalhes nas bordas, ou para a área do chat no modo **Chat**. |
| `[data-card-css] .mari-message-bubble` | A bolha visível: plano de fundo, borda, cantos, sombra. No layout **Bubbles** e no roleplay. |
| `[data-card-css] .mari-message-content` | No **Bubbles**, o próprio elemento da bolha. No **Linear**, só o texto da mensagem. |
| `[data-card-css] .mari-message-name` | O nome de exibição do personagem. |
| `[data-card-css] .mari-message-meta` | A linha de cabeçalho com o nome e o horário. |
| `[data-card-css] .mari-message-timestamp` | O horário. |
| `[data-card-css] .mari-message-avatar` | A coluna do avatar. |
| `[data-card-css] .mari-message-narrator` | As mensagens do narrador (roleplay). |
| `[data-card-css] .mari-message-user` | As mensagens do usuário. Use `.mari-message-assistant` para as mensagens do personagem. |
| `[data-card-css] p`, `[data-card-css] span` | Parágrafos e trechos em linha dentro do texto. |
| `[data-grouped]` | Mensagens seguidas do mesmo personagem. Só no Conversation. Use `[data-card-css]:not([data-grouped])` para a primeira mensagem de um conjunto. |

Para mudar o layout, abra **Settings → Appearance → Conversation** (Configurações → Aparência → Conversation), depois **Conversation Display** e então **Chat Layout**. No **Linear**, estilize `.mari-message-content` (o texto) e `[data-card-css]` (a linha), já que não há bolha.

Uma bolha estilizada:

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

No layout **Linear** de Conversation, uma linha "(name) is typing..." aparece enquanto um personagem escreve.

| Seletor | O que atinge |
| --- | --- |
| `[data-card-css] .mari-typing-text` | O rótulo. |
| `[data-card-css] .mari-typing-dots span` | Os pontinhos animados. |
| `[data-card-css] .mari-typing-indicator` | A linha. Ela carrega o nome em `data-typing-name`. |

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

Por padrão, o avatar é um círculo. O exemplo mira no botão de avatar clicável. Para um avatar não clicável, use `.mari-message-avatar > div`. No roleplay, o botão fica dentro de uma `div` extra que faz o brilho. Desative o brilho dela se você quiser só o seu próprio anel.

```css
[data-card-css] .mari-message-avatar button {
  border-radius: 6px; /* 0 for sharp corners, 50% for a circle */
  box-shadow: 0 0 0 2px #ff66cc;
}
@chat-mode roleplay {
  [data-card-css] .mari-message-avatar > div {
    box-shadow: none;
  }
}
```

### Janelinha de perfil About Me (só em Conversation)

No Conversation Mode, clicar em um avatar abre uma janelinha de perfil com o "about me". Os cards de personagem e as personas podem dar tema à própria janelinha. Ela não existe em roleplay nem em game, então coloque essas regras dentro de `@chat-mode conversation` se o card também trouxer CSS para outros modos.

O cartão da janelinha é o elemento de escopo. Mire nele com `[data-card-css].mari-about-me-popout` (sem espaço, mesmo elemento) e nos filhos dele como descendentes. No modo **Chat**, você pode usar `.mari-about-me-name` direto.

| Seletor | O que atinge |
| --- | --- |
| `[data-card-css].mari-about-me-popout` | O cartão da janelinha: plano de fundo, borda, formato. |
| `[data-card-css] .mari-about-me-banner` | A faixa superior (que usa a cor do nome por padrão). |
| `[data-card-css] .mari-about-me-avatar` | O invólucro do avatar ampliado. Use `... > div` para o círculo. |
| `[data-card-css] .mari-about-me-status` | O pontinho de status de presença (só personagens). |
| `[data-card-css] .mari-about-me-name` | O título com o nome de exibição. |
| `[data-card-css] .mari-about-me-handle` | A linha secundária com @nome, que aparece quando o nome de exibição no Convo é diferente. |
| `[data-card-css] .mari-about-me-presence` | A linha de status ou de atividade (só personagens). |
| `[data-card-css] .mari-about-me-box` | A caixa que contém o About Me. |
| `[data-card-css] .mari-about-me-label` | A legenda "ABOUT ME". |
| `[data-card-css] .mari-about-me-badge` | A pílula Default ou Chat-specific. |
| `[data-card-css] .mari-about-me-text` | O corpo do texto de about me. |

```css
@chat-mode conversation {
  [data-card-css].mari-about-me-popout {
    background: radial-gradient(120% 120% at 50% 0%, #241a3a 0%, #14101f 70%);
    border: 1px solid rgba(180, 120, 255, 0.45);
    border-radius: 1.25rem;
  }
  [data-card-css] .mari-about-me-banner {
    background: linear-gradient(90deg, #b478ff, #ff77c6);
  }
  [data-card-css] .mari-about-me-name {
    color: #e9d8ff;
  }
}
```

<a id="what-you-cannot-style"></a>

## O que você não pode estilizar

O sanitizador remove estes itens por segurança.

| Bloqueado | Motivo |
| --- | --- |
| `url(https://...)` | Nada de requisições de rede, para evitar rastreamento e vazamento de dados. Só `url(data:...)` é permitido, para imagens e fontes embutidas. |
| `@font-face` com URLs externas | Só ficam as fontes de origem `data:`. O nome da família é renomeado, para não sobrepor as fontes do aplicativo. |
| `@import` | Nada de carregar folhas de estilo externas. |
| Seletores `:has()` | Não podem sondar elementos fora do chat. |
| Regras aninhadas e seletores que começam com `~` ou `+` | Descartados, para que o Card CSS não alcance nada fora do próprio escopo. Escreva seletores comuns. |
| HTML em `content:` | Texto decorativo é permitido, mas `<` e `>` são removidos e o texto fica limitado a 200 caracteres. `attr()` e `counter()` são permitidos. |
| `position: fixed` | Vira `position: absolute`, então não há sobreposições em tela cheia. |
| `!important` | Removido, para que o Card CSS não force a sobreposição dos estilos do aplicativo. |
| Tokens de tema do aplicativo | Tokens como `--primary` e `--background` são removidos, para que o Card CSS não repinte a interface do aplicativo. |

O Card CSS tem prioridade sobre os estilos de mensagem do próprio aplicativo em cores, planos de fundo, bordas e fontes dentro do chat. Ele não vence o que o sanitizador remove, nada que esteja fora do chat, nem os estilos que o aplicativo aplica em linha ou com `!important`. A cor e o tamanho globais da fonte do chat, definidos em **Settings**, são um exemplo.

Para uma fonte personalizada, embuta-a com um URI `data:` em base64 ou use uma pilha de fontes do sistema.

```css
@font-face {
  font-family: "MyFont";
  src: url(data:font/woff2;base64,d09GMgAB...) format("woff2");
}
```

## Dicas

1. Estilize a bolha com `.mari-message-bubble`, não com `[data-card-css]`. A linha ocupa a largura inteira, então um plano de fundo nela fica quase invisível.
2. Use cores em `rgba()` para elas se integrarem tanto no tema claro quanto no escuro.
3. Mantenha as animações discretas. Prefira `transition` a uma `animation` pesada em dispositivos mais simples. Anime `opacity`, não `box-shadow`, que força um redesenho a cada quadro.
4. Use `@media (max-width: 768px)` para celulares.
5. Não dependa de classes utilitárias. Só os ganchos `mari-*` documentados são estáveis.

## Vitrine: Eldritch Grimoire

Este exemplo usa os principais ganchos em todos os modos: nomes brilhantes, texto serifado com tema, um avatar com anel, uma bolha de roleplay animada com runa no canto, uma bolha de Conversation, um indicador de digitação sinistro e a superfície do jogo. Cole-o no campo **Creator Notes** e escolha um modo de Card Theming em **Chat Settings → Characters** (ou **Party** no Game). Defina **Chat** para a superfície do jogo. Troque as cores, o glifo de `content` e as fontes para deixar tudo com a sua cara.

```html
<style>
  @keyframes grimoire-pulse {
    0%,
    100% {
      opacity: 0.35;
    }
    50% {
      opacity: 1;
    }
  }

  /* All modes */
  [data-card-css] .mari-message-name {
    color: #ff5c8a;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    text-shadow: 0 0 8px rgba(255, 92, 138, 0.7), 0 0 16px rgba(168, 85, 247, 0.45);
  }
  [data-card-css] .mari-message-timestamp {
    color: rgba(243, 215, 255, 0.5);
    font-variant: small-caps;
  }
  [data-card-css] .mari-message-avatar button {
    border-radius: 7px;
    box-shadow: 0 0 0 2px rgba(220, 38, 120, 0.6), 0 0 14px rgba(168, 85, 247, 0.5);
  }
  [data-card-css] .mari-message-content {
    color: #f3d7ff;
    font-family: "Iowan Old Style", Georgia, "Times New Roman", serif;
  }

  @chat-mode roleplay {
    [data-card-css] {
      border-left: 2px solid rgba(220, 38, 120, 0.35);
    }
    [data-card-css] .mari-message-avatar > div {
      box-shadow: none;
    }
    [data-card-css] .mari-message-bubble {
      background: linear-gradient(135deg, #1a0a24 0%, #2d0a2e 55%, #3a0a1e 100%);
      border: 1px solid rgba(220, 38, 120, 0.45);
      border-radius: 4px 16px 16px 16px;
      position: relative;
      overflow: hidden;
      box-shadow: 0 0 16px rgba(190, 70, 190, 0.4);
    }
    /* breathing inner glow: animate a full-bleed overlay's opacity, which is cheap */
    [data-card-css] .mari-message-bubble::after {
      content: "";
      position: absolute;
      inset: 0;
      border-radius: inherit;
      pointer-events: none;
      box-shadow: inset 0 0 26px rgba(120, 0, 80, 0.65);
      animation: grimoire-pulse 4s ease-in-out infinite;
    }
    [data-card-css] .mari-message-bubble::before {
      content: "✦";
      position: absolute;
      top: 1px;
      right: 7px;
      font-size: 0.7rem;
      color: rgba(220, 38, 120, 0.55);
    }
    [data-card-css] .mari-message-narrator {
      color: #c9a8ff;
      font-style: italic;
    }
  }

  @chat-mode conversation {
    [data-card-css]:not([data-grouped]) {
      border-left: 2px solid rgba(220, 38, 120, 0.35);
    }
    [data-card-css] .mari-message-bubble {
      background: rgba(26, 10, 36, 0.92);
      border: 1px solid rgba(220, 38, 120, 0.4);
      border-radius: 1rem;
    }
    [data-card-css] .mari-typing-text {
      color: #ff5c8a;
      font-style: italic;
    }
    [data-card-css] .mari-typing-dots span {
      background: #ff5c8a;
    }
    [data-card-css].mari-about-me-popout {
      background: radial-gradient(120% 120% at 50% 0%, #241a3a 0%, #12081c 72%);
      border: 1px solid rgba(220, 38, 120, 0.45);
      border-radius: 1.25rem;
    }
    [data-card-css] .mari-about-me-banner {
      background: linear-gradient(90deg, #a855f7, #dc2678);
    }
    [data-card-css] .mari-about-me-name {
      color: #ffd7ef;
    }
  }

  /* Game: in Chat scope, [data-card-css] is the whole game surface */
  @chat-mode game {
    [data-card-css] {
      background-image: radial-gradient(120% 80% at 50% 0%, rgba(58, 10, 46, 0.5), transparent 70%);
    }
  }
</style>
```

## Usar um assistente de IA para criar o Card CSS

Para não escrever o CSS à mão, passe este prompt a um assistente de IA. Preencha o conceito do personagem no ponto indicado.

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
