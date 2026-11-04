# Configurações de aparência

A aba **Appearance** (aparência) muda o visual do Marinara: cores, tamanho do texto, layout do chat e estilo das mensagens em cada modo de chat.

Procurando outra coisa?

- Outra fonte: [Fontes personalizadas e Google Fonts](fonts.md).
- Uma imagem de plano de fundo para o chat: [Planos de fundo do chat](chat-backgrounds.md).
- Um tema personalizado (**Settings → Addons → Theme Library**): [Temas de CSS personalizados](custom-css-themes.md).
- A aparência própria de um personagem no chat: [Guia de temas com Card CSS](card-css-theming.md).

## Como abrir as configurações de aparência

1. Abra **Settings** (Configurações).
2. Escolha a aba **Appearance**.
3. Escolha um botão no topo: **App**, **Conversation**, **Roleplay** ou **Game**.

Os botões agrupam as configurações por modo de chat, e a aba mostra só o grupo que você escolher.

| Botão | Seções |
| --- | --- |
| **App** | **App Style**, **Text & Scale**, **Atmosphere**, **Backgrounds** |
| **Conversation** | **Conversation Display**, **Conversation Theme** |
| **Roleplay** | **Tracker Panel**, **Roleplay Presentation** |
| **Game** | **Game Presentation** |

Para recomeçar do zero, clique em **Reset Appearance** (restaurar a aparência) no topo de **App Style**. O botão devolve a aba inteira aos padrões do Marinara, limpa o plano de fundo do chat atual e desativa qualquer tema ativo da Theme Library.

## Botão App

### Color Scheme e Visual Style

Em **App Style**, o menu suspenso **Color Scheme** (esquema de cores) tem **Dark** (o padrão) e **Light**. O aplicativo muda na hora. As cores com padrões separados para o escuro e o claro acompanham o esquema até você definir as suas.

**Visual Style** (estilo visual) tem dois cartões. **Default (Marinara)** é um visual retrô Y2K, com efeitos de brilho. **SillyTavern** é um visual limpo e minimalista. Ele só muda o visual e não tem relação com a importação a partir do SillyTavern.

### Background Color e Accent Color

As duas aceitam uma cor sólida ou um gradiente, uma transição suave entre duas ou mais cores. Limpe um campo com **Reset to default** (voltar ao padrão) para voltar ao padrão.

| Configuração | O que ela colore | Padrão |
| --- | --- | --- |
| **Background Color** (cor de fundo) | A estrutura principal do aplicativo. | `#050312` no Dark, `#faf8ff` no Light |
| **Accent Color** (cor de destaque) | Botões, ícones ativos, contornos de foco, realces, bordas dos painéis e os controles ao redor do chat. | **Marinara Gradient**, uma mistura de rosa, laranja e ciano |

Um valor como `#050312` é um código de cor hexadecimal, uma forma curta de escrever uma cor.

Dois botões liga/desliga mudam o comportamento da cor de destaque. Só um pode ficar ativado por vez.

- **Accent Pulse** anima a cor de destaque. Cores sólidas clareiam e escurecem, e os gradientes alternam entre as próprias cores. Vem ativado por padrão no computador e desativado no celular.
- **RGB Mode** faz a cor de destaque percorrer um arco-íris. A **Accent Color** salva continua igual. Vem desativado por padrão.

Se o dispositivo pedir movimento reduzido, as duas animações são puladas.

### Outros controles de App Style

- **Custom Mouse Pointer** (cursor do mouse personalizado, ativado por padrão) usa o cursor do Marinara na cor de destaque. Desative para usar o cursor do sistema, ou para deixar um tema personalizado controlar o cursor.
- **Reduce Ambient Animations & Effects** (reduzir animações e efeitos de ambiente) interrompe as animações decorativas, as partículas de ambiente, as prévias giratórias e a revelação gradual do texto. Marinara também faz isso quando o dispositivo pede movimento reduzido.
- **Desktop sidebar width** (largura da barra lateral no computador) define a largura das duas barras laterais no computador. **Reset width** (redefinir a largura) restaura o valor. O celular mantém o próprio layout.

### Chat widget style

No fim de **App Style**, escolha **Default**, **Dottore** ou **Prof. Mari** para os botões, as janelas e as seções móveis do chat. Você pode mudar separadamente a fonte, a forma e as três cores principais, e os três botões liga/desliga **Apply preset** levam o estilo para as mensagens, os campos de entrada e os controles do chat. **Button size (px)** (tamanho do botão em pixels) redimensiona os botões móveis do chat e os ícones deles sem mudar o **Display Size** (tamanho da exibição). Digite de 32 a 96, ou deixe vazio para usar o padrão. Veja todos os controles em [Temas de CSS personalizados](custom-css-themes.md#ready-made-chat-window-styles).

### Display Size e Chat Font Size

Em **Text & Scale**:

- **Display Size** define o tamanho base do texto no aplicativo inteiro, neste dispositivo. A mudança vale na hora. Escolha uma destas opções:

| Opção | Tamanho |
| --- | --- |
| **Tiny** | 12 px |
| **Small** | 14 px |
| **Medium** | 16 px |
| **Default** | 17 px |
| **Large** | 19 px |
| **Huge** | 22 px |
| **Extra large** | 26 px |
| **Extra extra large** | 30 px |
| **Maximum** | 34 px |

- **Chat Font Size** (tamanho da fonte do chat) é um controle deslizante para o texto das mensagens do chat, de 12 px a 72 px. O padrão é 16 px.

O menu suspenso **Font** fica na mesma seção. Veja [Fontes personalizadas e Google Fonts](fonts.md).

### Cores e contorno do texto do chat

Também em **Text & Scale**:

- **Chat Text Color** (cor do texto do chat) é a cor principal do texto das mensagens. O padrão é `#d4d4d4` no Dark e `#1a1025` no Light.
- **Default Dialogue Color** (cor padrão do diálogo) colore as falas entre aspas quando um personagem ou uma persona não tem uma Dialogue Highlight Color própria. As cores do card têm prioridade. Com **Apply preset colors** (aplicar cores do preset) ativado, as falas usam a cor de texto do estilo do chat.
- **Chat Chrome Text Color** define o texto dos controles ao redor do chat: widgets de tracker, nomes das pastas e descrições das configurações. Tem os mesmos padrões da **Chat Text Color**.
- **Text Outline / Stroke** (contorno do texto) acrescenta um contorno para o texto continuar legível sobre planos de fundo carregados. Defina a cor e a espessura em **Width**, de 0 a 5 px. O padrão é 0.5 px, e 0 desativa o contorno.

Ao limpar um campo de cor, ele volta ao padrão do esquema.

### Atmosphere

**Dynamic weather effects (rain, snow, fog, etc.)** vem ativado por padrão. Ele mostra partículas de clima de acordo com o clima e a hora do dia na história. Só aparece algo quando o agente **World State** está ativado no chat. Veja [Agentes: ajudantes de IA para os seus chats](../agents/agents-overview.md).

### Backgrounds

A seção **Backgrounds** reúne o seletor **Chat Background** (plano de fundo do chat) e o **Background Blur** (desfoque do plano de fundo). Há mais dois controles aqui. **Conversation background image opacity** (opacidade da imagem de fundo no Conversation) define com que intensidade o plano de fundo do chat aparece no Conversation Mode, com o gradiente ainda visível. **Chat List Backgrounds** (planos de fundo na lista de chats) mostra o plano de fundo de cada chat como um banner esmaecido atrás da linha dele na lista de chats. Escolha **Active & Hovered**, **Every Row** ou **Off**. Veja [Planos de fundo do chat](chat-backgrounds.md).

## Botão Conversation

- **Chat Layout** (layout do chat), em **Conversation Display**, muda a aparência das mensagens do Conversation Mode, com uma prévia ao vivo. **Linear** (o padrão) mostra linhas em estilo de chat. **Bubbles** mostra balões em estilo de mensageiro.
- **Avatar Shape** (formato do avatar) é **Circular** ou **Square**. O tamanho do avatar não muda.
- **Always display swipe menu** (sempre mostrar o menu de swipe) mostra as setas de swipe e o contador desde a primeira resposta. Desative para mostrá-los só depois de regenerar.
- **Conversation Theme** define um gradiente de duas cores atrás de todos os chats do Conversation Mode. As abas **Dark** e **Light** guardam cada uma o próprio gradiente. Esse é um padrão para o dispositivo inteiro, e não uma configuração por chat.

## Botão Roleplay

**Tracker Panel** define o estilo do painel lateral de trackers do Roleplay. Veja [HUD e trackers do Roleplay](../roleplay/hud-and-trackers.md).

**Roleplay Presentation** (apresentação do Roleplay) define o estilo das mensagens do Roleplay.

| Configuração | O que faz | Padrão |
| --- | --- | --- |
| **Chat position** (posição do chat) | Onde as mensagens e a caixa de entrada ficam em telas largas: **Left**, **Center** ou **Right**. Uma barra lateral aberta ou um Tracker Panel do mesmo lado as empurra junto. No celular, o chat continua com a largura toda. | **Center** |
| **Visual Novel display** (exibição Visual Novel) | Mostra um parágrafo terminado por vez, com um retrato de diálogo e os seus sprites. Muda o Roleplay atual e o padrão dos chats sem estilo salvo. | Desativado |
| **Roleplay Messages Background Opacity** | Um controle deslizante de 0% a 100%. Diminua para deixar o plano de fundo aparecer através dos balões de mensagem. | 90% |
| **Roleplay Avatars** | O estilo do avatar ao lado de cada mensagem: **None**, **Small Circles**, **Small Rectangles** ou **Glued Side Panel**. | **Small Circles** |
| **Scrollable Avatars** | Mantém os avatares à vista enquanto você rola uma mensagem longa. | Desativado |
| **Message avatar scale** | Um controle deslizante de 75% a 250%. | 100% |
| **Default sprite scale** | Um controle deslizante de 50% a 175%. O tamanho de sprite definido no próprio chat continua prevalecendo. | 100% |

Esta seção também tem **Custom chat width**, **Always display swipe menu**, **Reduced paint effects** (achata transparências e sombras pesadas para manter a navegação fluida), **Show Thinking In Messages**, **Don't Collapse Thinking** e **Narrator's Cycling Avatars**. Com **Visual Novel display** ativado, também aparecem **Auto-play VN paragraphs** com um **Paragraph delay**, **Dialogue portrait scale** e **Full-body sprite scale**.

## Botão Game

Em **Game Presentation**, **Game VN Art** tem dois controles deslizantes: **Dialogue portrait scale** (de 75% a 175%, padrão 100%) e **Full-body sprite scale** (de 75% a 275%, padrão 135%).

**Game Dialogue Display** (exibição do diálogo no Game) define o comportamento da caixa de diálogo.

- **Classic Dialogue Box** (o padrão) mostra um trecho ativo. As falas anteriores ficam no botão **Logs** (registros).
- **History Above Dialogue Box** mostra os trechos anteriores acima da caixa, e a sessão inteira continua rolável ali.

**Game text effects** (efeitos de texto do Game, ativado por padrão) anima palavras dramáticas, ênfases em LETRAS MAIÚSCULAS, comentários entre parênteses e tags de efeito de texto. Desative para ver texto simples.

## Configurações que ficam só neste dispositivo

A maior parte das configurações de Appearance sincroniza com os seus outros dispositivos. **Display Size** e **Chat Font Size** não. Elas ficam salvas no navegador que você usa. Veja em [Visão geral das configurações](../settings/settings-overview.md) o que sincroniza.

## Guias relacionados

- [Fontes personalizadas e Google Fonts](fonts.md)
- [Planos de fundo do chat](chat-backgrounds.md)
- [Temas de CSS personalizados (Theme Library)](custom-css-themes.md)
- [Guia de temas com Card CSS](card-css-theming.md)
- [Visão geral das configurações](../settings/settings-overview.md)
