# Configurações de aparência

Neste guia você percorre, seção por seção, a aba **Settings -> Appearance** (Configurações -> Aparência) do Marinara Engine. Aqui entram cores, tamanho do texto, layout do chat, estilo das mensagens em cada modo e como voltar tudo ao padrão.

Fontes, planos de fundo e temas de CSS personalizados têm guias próprios. Esta página traz os links no lugar certo.

## Como abrir as configurações de aparência

1. Abra a seção **Settings**.
2. Escolha a aba **Appearance**.

A aba é dividida em seções que você percorre rolando a tela: **App Style**, **Text & Scale**, **Conversation Display**, **Tracker Panel**, **Roleplay Messages**, **Game Presentation**, **Atmosphere**, **Conversation Theme** e **Backgrounds**.

## Color Scheme (escuro ou claro)

O menu suspenso **Color Scheme** (esquema de cores) fica na seção **App Style**. São duas opções:

- **Dark** (o padrão). Cansa menos a vista em ambiente escuro.
- **Light**.

Várias cores mais abaixo têm padrões separados para o modo escuro e o claro. Elas acompanham o Color Scheme ativo automaticamente, até você definir uma cor própria.

## Visual Style

**Visual Style** (estilo visual) define a cara do aplicativo inteiro. A escolha é entre dois cards:

- **Default (Marinara)** (o padrão). Um visual retrô Y2K, com efeitos de brilho.
- **SillyTavern**. Um visual limpo e minimalista, inspirado no SillyTavern original.

Isso é só uma capa. Não tem relação com a importação de dados do SillyTavern, que é uma ferramenta à parte.

## Background Color e Accent Color

Esses dois controles ficam na seção **App Style**. Os dois aceitam uma cor sólida ou um gradiente. Gradiente é a transição suave entre duas ou mais cores.

- **Background Color** (cor de fundo) pinta a estrutura principal do aplicativo, atrás de tudo. O padrão é `#050312` no modo Dark e `#faf8ff` no modo Light.
- **Accent Color** (cor de destaque) colore botões, ícones ativos, contornos de foco, realces e as bordas dos painéis. O padrão é `#d4acfb` nos dois esquemas.

Um valor como `#d4acfb` é um código de cor hexadecimal, uma forma curta de escrever uma cor. Para voltar ao padrão do esquema, limpe o campo com **Reset to default** (voltar ao padrão).

Dois botões liga/desliga mudam o comportamento da Accent Color:

- **Accent Pulse** (desativado por padrão) anima a Accent Color de leve. Cores sólidas clareiam e escurecem. Gradientes ficam alternando entre as próprias cores.
- **RGB Mode** (desativado por padrão) faz a cor de destaque percorrer uma paleta de arco-íris enquanto estiver ativo. A Accent Color salva continua intacta.

Só um dos dois funciona por vez. Ativar o **RGB Mode** desativa o **Accent Pulse**, e ativar o **Accent Pulse** desativa o **RGB Mode**. A prévia do Accent Pulse aparece em tempo real com a aba Appearance aberta. Se o dispositivo estiver configurado para reduzir animações, os dois efeitos são ignorados.

## Chat widget style

No fim de **App Style**, escolha **Default**, **Dottore** ou **Prof. Mari** para os botões, as janelas e as seções móveis do chat. Você pode mudar separadamente a fonte, a forma da moldura e as três cores principais. Os seletores de cor também aceitam gradientes.

**Button size (px)** (tamanho do botão em pixels) muda os botões móveis do chat e seus ícones sem alterar Display Size. Digite um tamanho de 32 a 96 pixels. Deixe o campo vazio ou use o botão de redefinir para manter o padrão atual. O tamanho fica salvo nas preferências de aparência e se mantém quando você escolhe outro preset.

Abaixo dos seletores de cor, **Apply preset font** (aplicar fonte do preset), **Apply preset shape** (aplicar forma do preset) e **Apply preset colors** (aplicar cores do preset) deixam o restante do chat combinando. Eles começam desativados e funcionam de forma independente. Eles se aplicam às mensagens, aos campos de entrada e aos controles do chat. No Game Mode, também se aplicam aos widgets do HUD, ao painel do mapa, aos comentários laterais, às fichas de personagem, aos registros, ao inventário, aos painéis de combate e às janelas de diálogo. As mensagens de Conversation usam a fonte e as cores opcionais, mas mantêm sua própria forma. Suas escolhas personalizadas de fonte, forma e cores também entram. Com **Apply preset colors** ativado, as falas entre aspas continuam usando a Dialogue Highlight Color própria de cada personagem ou persona. Para ver exemplos e temas personalizados, consulte [Temas de CSS personalizados](custom-css-themes.md#ready-made-chat-window-styles).

## Custom Mouse Pointer

**Custom Mouse Pointer** (cursor do mouse personalizado, ativado por padrão) usa o cursor na cor de destaque do Marinara em todo o aplicativo. Desative para usar o cursor normal do sistema, ou para deixar um tema de CSS personalizado controlar o cursor.

## Display Size e Chat Font Size

Esses dois controles ficam na seção **Text & Scale**.

- **Display Size** (tamanho da exibição) define o tamanho base do texto no aplicativo inteiro, neste dispositivo. As opções são **Tiny**, **Small**, **Medium**, **Default** (17px), **Large** e **Huge**.
- **Chat Font Size** (tamanho da fonte do chat) é um controle deslizante que define o tamanho do texto das mensagens do chat. Vai de 12px a 48px. O padrão é 16px.

O menu suspenso **Font** fica nessa mesma seção. Para adicionar fontes próprias ou baixar do Google Fonts, veja [Fontes personalizadas e Google Fonts](fonts.md).

## Cores e contorno do texto do chat

Também na seção **Text & Scale**, quatro controles mudam a leitura do texto do chat sobre o plano de fundo.

- **Chat Text Color** (cor do texto do chat) define a cor principal do texto das mensagens. O padrão é `#d4d4d4` no modo Dark e `#1a1025` no modo Light.
- **Default Dialogue Color** (cor padrão do diálogo) colore as falas entre aspas quando o card de personagem ou a persona não define uma Dialogue Highlight Color própria. As cores definidas no card têm prioridade. Com **Apply preset colors** ativado, essas falas passam a usar a cor de texto do estilo do chat.
- **Chat Chrome Text Color** define o texto comum nos widgets de tracker, nos nomes das pastas e nas descrições das configurações. Usa os mesmos padrões da **Chat Text Color**.
- **Text Outline / Stroke** (contorno do texto) acrescenta um contorno ao texto do chat, para ele continuar legível sobre planos de fundo carregados. Defina a cor do contorno e a espessura em **Width**, de 0px a 5px. O padrão é 0.5px. Com a espessura em 0, o contorno some.

Cada cor acompanha o padrão do Color Scheme até você definir a sua. Ao limpar um campo de cor, ele volta ao padrão do esquema, em vez de ficar vazio.

## Chat Layout (Conversation Display)

A seção **Conversation Display** tem um único controle, **Chat Layout** (layout do chat), que muda a aparência das mensagens no Conversation Mode. Uma prévia ao vivo acompanha a escolha.

- **Linear** (o padrão). Linhas em estilo de chat.
- **Bubbles**. Balões em estilo de mensageiro.

## Tracker Panel

A seção **Tracker Panel** define o estilo do painel lateral de trackers do Roleplay. Esse painel é um recurso à parte, com guia próprio. Veja [HUD e trackers do Roleplay](../roleplay/hud-and-trackers.md).

## Aparência das mensagens no Roleplay

A seção **Roleplay Messages** define o estilo das mensagens nos chats de Roleplay.

- **Chat position** escolhe onde as mensagens e a caixa de entrada ficam em telas largas: **Left**, **Center** (o padrão) ou **Right**. As duas se movem juntas, e uma barra lateral aberta ou o Tracker Panel do mesmo lado as empurra para o lado, para que o chat nunca fique por baixo. No celular e em janelas estreitas o chat continua ocupando a largura toda, e o Game Mode mantém a caixa de diálogo centralizada.
- **Roleplay Messages Background Opacity** é um controle deslizante de 0% a 100%. O padrão é 90%. Diminua para deixar o plano de fundo aparecer através dos balões de mensagem.
- **Roleplay Avatars** escolhe o estilo do avatar ao lado de cada mensagem. As quatro opções são **None**, **Small Circles** (o padrão), **Small Rectangles** e **Glued Side Panel**.
- **Scrollable Avatars** (desativado por padrão) mantém os avatares à vista enquanto você rola uma mensagem longa.
- **Message avatar scale** é um controle deslizante de 75% a 250%. O padrão é 100%.
- **Default sprite scale** é um controle deslizante de 50% a 175%. O padrão é 100%. Um tamanho de sprite definido em um chat específico continua prevalecendo sobre esse padrão.

## Game Presentation

A seção **Game Presentation** ajusta a escala das artes no Game Mode. O Game Mode exibe um retrato de diálogo e um sprite de corpo inteiro. Esses dois controles deslizantes definem o tamanho de cada um.

- **Dialogue portrait scale** é um controle deslizante de 75% a 175%. O padrão é 100%.
- **Full-body sprite scale** é um controle deslizante de 75% a 275%. O padrão é 135%.

**Game Dialogue Display** define o comportamento da caixa de diálogo:

- **Classic VN** (o padrão). A caixa de diálogo mostra um trecho ativo por vez. As falas anteriores ficam no botão **Logs**.
- **History Above VN**. Os trechos anteriores aparecem acima da caixa de diálogo. A sessão inteira continua acessível ali, rolando a tela.

## Efeitos de clima em Atmosphere

A seção **Atmosphere** tem um único botão liga/desliga, **Dynamic weather effects (rain, snow, fog, etc.)**, ativado por padrão. Ele exibe partículas animadas de clima de acordo com o clima e a hora do dia na história.

Esse botão só produz efeito quando o agente **World State** está ativado no chat. Esse agente lê o clima a partir da história. Sem ele, o botão não muda nada na tela. Veja [Agentes: ajudantes de IA para os seus chats](../agents/agents-overview.md).

## Conversation Theme

A seção **Conversation Theme** define um plano de fundo em gradiente de duas cores para todos os chats do Conversation Mode. Ela tem abas **Dark** e **Light** separadas, então cada Color Scheme guarda o próprio gradiente. Esse é um padrão que vale para todos os chats de Conversation no dispositivo, e não uma configuração por chat.

## Backgrounds

Na seção **Backgrounds** você importa e escolhe imagens de plano de fundo para o chat e define um **Background Blur**. Como esse é um recurso próprio, com biblioteca própria, ele tem um guia dedicado. Veja [Planos de fundo do chat](chat-backgrounds.md).

## Reset Appearance

O botão **Reset Appearance** (restaurar a aparência) fica no topo da seção **App Style**. Ele devolve a aba **Appearance** inteira aos padrões do Marinara. Isso inclui cores, tamanhos de texto, layout, escalas de avatar e de sprite, e gradientes.

A restauração também limpa o plano de fundo do chat atual e desativa qualquer tema personalizado ativo da Theme Library. Use quando o visual ficar bagunçado e você quiser recomeçar do zero.

## Configurações que ficam só neste dispositivo

A maior parte das configurações de Appearance é sincronizada com os outros dispositivos. Duas não: **Display Size** e **Chat Font Size** ficam salvas no navegador em uso e nunca sincronizam.

Para ver o quadro completo de quais configurações sincronizam entre dispositivos e quais ficam locais, veja [Visão geral das configurações](../settings/settings-overview.md).

## Guias relacionados

- [Fontes personalizadas e Google Fonts](fonts.md)
- [Planos de fundo do chat](chat-backgrounds.md)
- [Temas de CSS personalizados (Theme Library)](custom-css-themes.md)
- [Guia de temas com Card CSS](card-css-theming.md)
- [Visão geral das configurações](../settings/settings-overview.md)
