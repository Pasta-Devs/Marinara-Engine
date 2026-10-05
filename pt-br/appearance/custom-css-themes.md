# Temas de CSS personalizados (Theme Library)

Este guia explica como mudar toda a aparência do Marinara Engine com um tema de CSS personalizado. Aqui você vê como criar, importar, exportar e ativar temas. Também vê quais variáveis de CSS pode alterar e como os temas convivem com o Card CSS.

## Estilos prontos para janelas de chat

Para mudar o visual sem escrever CSS, abra **Settings > Appearance > App** e encontre **Chat widget style** no fim de **App Style**. **Dottore** dá aos controles molduras de instrumentos cianas e cantos recortados. **Mari** acrescenta molduras rosas e douradas com Gemas Essenciais nos títulos das janelas. Os botões usam o mesmo fundo das janelas. Cada preset tem sua própria fonte, funciona nos modos claro e escuro e muda juntos os botões, as janelas e as seções expansíveis.

Os controles **Font** e **Shape** permitem mudar esses detalhes separadamente. **Preset font** e **Preset shape** seguem o estilo escolhido.

Abaixo ficam três controles de cor. Cada um tem um seletor de cor sólida e uma opção de gradiente para misturar cores:

- **Border & Buttons Color** muda os contornos e os ícones dos botões. Os ícones usam a primeira cor do gradiente.
- **Background Color** preenche botões, janelas, seções expansíveis e campos editáveis.
- **Text Color** muda o texto dos widgets. Os gradientes aparecem nos títulos e rótulos; o texto dos campos editáveis usa a primeira cor.

Os controles de cor mantêm as cores originais dos ornamentos.

Use **Reset color** ao lado de um controle para voltar às cores claras ou escuras do preset. Escolher um preset redefine **Font**, **Shape** e as três cores. **Default** restaura o visual original. As janelas ficam onde você as colocou.

Os temas CSS personalizados ainda podem substituir esses presets. As variáveis públicas de janelas e gavetas abaixo têm prioridade sobre as cores do preset. Use `--mari-window-font-family` para as letras das janelas, `--mari-drawer-radius` para os cantos das seções e `--mari-window-ornament: none` para ocultar o ornamento do título. Para remover toda a decoração do preset, escolha **Default** primeiro.


## O que é um tema personalizado

Um tema personalizado é um bloco de CSS que repinta Marinara. CSS, sigla de Cascading Style Sheets, é o código que define cores, bordas e espaçamentos no aplicativo inteiro. Um tema pode mudar o plano de fundo da página, a cor de destaque, os cards, as bordas, o texto e muito mais.

Os temas personalizados ficam na seção **Theme Library** (biblioteca de temas). Marinara guarda esses temas no servidor, então eles aparecem em todos os dispositivos e navegadores conectados ao mesmo servidor. Isso é diferente da maioria das outras configurações de aparência, que ficam só em um dispositivo. Para as configurações por dispositivo, veja o guia [Configurações de aparência](appearance-settings.md).

Só um tema personalizado fica ativo por vez. Guarde quantos temas quiser na biblioteca e alterne entre eles quando precisar.

## Onde encontrar a Theme Library

1. Abra **Settings** (Configurações).
2. Abra a aba **Addons**.
3. Procure a seção **Theme Library**.

A seção se chama **Theme Library** e traz o texto "Create, import, activate, edit, export, or remove custom CSS themes."

## Criar um tema

1. Na seção **Theme Library**, clique em **Create Theme** (criar tema).
2. Digite um nome no campo **Theme name**.
3. Escreva ou cole o CSS na caixa de texto grande.
4. Deixe a opção **Preview** ativada para ver as mudanças no aplicativo enquanto digita. Desative **Preview** para parar a visualização ao vivo.
5. Clique em **Save**.

Todo tema novo começa a partir de um modelo. Esse modelo lista as variáveis mais comuns como exemplos comentados, então basta remover as marcas de comentário e colocar os seus valores. Ao salvar um tema recém-criado, Marinara já o ativa na hora. E ainda mostra uma confirmação com o nome do tema, mais ou menos assim: Theme "My Theme" saved and activated.

Para mudar um tema depois, encontre-o na lista **Installed Themes** (temas instalados). Clique no ícone de código (a dica dele diz **Edit theme CSS**), faça as edições e clique em **Save**. Editar um tema salvo atualiza o conteúdo dele, mas não muda qual tema está ativo.

## Importar e exportar temas

Os temas podem ser compartilhados como arquivos. Isso ajuda a levar um tema de um servidor para outro ou a passá-lo para um amigo.

Para importar um tema:

1. Clique em **Import File** (importar arquivo) na seção **Theme Library**.
2. Escolha um arquivo `.css` ou um arquivo `.json`.
3. Leia a mensagem de aviso. Ela informa quantos temas foram importados, ignorados ou falharam.

Um arquivo `.css` vira um tema só, com o nome do arquivo. Um arquivo `.json` pode conter um ou vários temas, e existem dois tipos dele.

O primeiro tipo é o arquivo exportado por Marinara. Ele envolve cada tema em campos extras que Marinara acrescenta na exportação. Você não precisa ler nem editar nada. Importe o arquivo do jeito que está.

O segundo tipo é um arquivo pequeno que você mesmo escreve. Para um único tema, isto basta:

```
{ "name": "My Theme", "css": "..." }
```

Os temas importados vão para o servidor, mas não se ativam sozinhos. Se um tema com o mesmo nome e o mesmo CSS já existir no servidor, ele é ignorado em vez de entrar duas vezes.

Para exportar um tema, encontre-o na lista **Installed Themes** e clique no ícone de upload (a dica dele diz **Export theme**). Marinara baixa um arquivo `.json` que pode ser importado em outro lugar.

## Ativar um tema

A lista **Installed Themes** mostra todos os temas, mais um item **Default Theme** no topo.

1. Clique no nome de um tema para ativá-lo. Uma marca de seleção indica o tema ativo.
2. Clique em **Default Theme** para desligar o tema personalizado e voltar à aparência original do Marinara.

O botão **Reset Appearance** (restaurar a aparência) fica no topo da seção **App Style**, em **Settings -> Appearance**. Ao usá-lo, o tema personalizado ativo também é desligado.

Para excluir um tema de vez, clique no ícone de lixeira na linha dele (a dica diz **Remove theme**) e confirme na janela **Delete Theme**. Isso exclui em definitivo o CSS do tema no servidor.

## Referência das variáveis de CSS

O editor de temas tem uma seção retrátil chamada **CSS Variable Reference**. Clique nela para ver as variáveis mais úteis que podem ser substituídas. Um tema muda o aplicativo definindo essas variáveis em um bloco `:root`. A referência lista estas variáveis:

| Variável | O que ela controla |
| --- | --- |
| `--background` | Plano de fundo da página |
| `--foreground` | Texto principal |
| `--primary` | Destaque e botões |
| `--primary-foreground` | Texto sobre a cor primária |
| `--secondary` | Cards e campos |
| `--card` | Plano de fundo do card |
| `--border` | Bordas |
| `--muted-foreground` | Texto esmaecido |
| `--sidebar` | Plano de fundo da barra lateral |
| `--sidebar-border` | Borda da barra lateral |
| `--marinara-shell-edge-border` | Borda esquerda e direita da moldura |
| `--destructive` | Erro e exclusão |
| `--popover` | Plano de fundo do menu suspenso |
| `--accent` | Realce ao passar o mouse |

Essa lista não é um limite. Um tema pode definir qualquer variável de CSS que Marinara usa e ainda acrescentar outros estilos personalizados.

Alguns efeitos visuais têm variáveis próprias. Um tema pode pedir a animação de pulso do destaque, por exemplo, definindo `--marinara-theme-accent-pulse: enabled`.

Por segurança, Marinara limpa o CSS do tema personalizado antes de executá-lo. Estilos que carregam um arquivo de outro site não funcionam. Para usar uma imagem ou uma fonte dentro de um tema, incorpore o conteúdo como URI `data:` em vez de um link da web. Uma URI `data:` guarda o conteúdo do arquivo direto dentro do CSS.

## Estilizar janelas e gavetas do chat

No computador, **Chat Settings** abre como uma janela móvel. Suas seções recolhíveis são chamadas de **drawers** (gavetas). Uma gaveta pode sair para uma janela própria e depois se minimizar em um pequeno botão móvel, chamado **bubble** (bolha).

Outras ferramentas também usam essas janelas e botões, incluindo Game controls, Session, Volume, Game Assets, chats conectados e controles de pacotes. No celular, as janelas são painéis de largura total e Tracker Panel tem seu próprio botão móvel.

As classes, os atributos de dados e as variáveis abaixo permitem estilizar essas partes juntas. As regras do tema substituem os padrões sem `!important`.

### Classes

| Parte | Classe |
| --- | --- |
| Janela | `.mari-window` |
| Barra de título | `.mari-window__header` |
| Título e seu ícone | `.mari-window__title-row` |
| Título | `.mari-window__title` |
| Botões da barra de título (Reset View, estrela de layout favorito, Tracker Panel, fixar, travar, fechar, Put back) | `.mari-window__controls` (cada botão é `.mari-window__control`) |
| Conteúdo da janela | `.mari-window__body` |
| Bordas e cantos de redimensionamento | `.mari-window__resize-handle` |
| Marca no canto exibida quando o ponteiro ou o foco está na janela | `.mari-window__resize-grip` |
| Gaveta | `.mari-drawer` |
| Cabeçalho e título da gaveta | `.mari-drawer__header`, `.mari-drawer__title` |
| Ícone, contador e **?** da gaveta | `.mari-drawer__icon`, `.mari-drawer__count`, `.mari-drawer__help` |
| Prévia de uma gaveta recolhida (widget pequeno do tracker) | `.mari-drawer__summary` |
| Botões ao lado da seta e botão para destacar a gaveta | `.mari-drawer__actions`, `.mari-drawer__popout` |
| Seta e conteúdo da gaveta | `.mari-drawer__arrow`, `.mari-drawer__body` |
| Prévia que segue o ponteiro ao arrastar uma gaveta para fora | `.mari-drawer-ghost` |
| Botão de uma janela minimizada (bolha) | `.mari-window-bubble` |
| Linha exibida quando uma bolha arrastada se alinha a outra | `.mari-window-snap-guide` |
| Ponto exibido enquanto os agentes trabalham (botão Chat Settings, janela Trackers) | `.mari-agents-running-dot` |

### Atributos de dados

- `data-window` identifica uma janela e sua bolha: `chat-settings`, `trackers`, as janelas de controles `control:game`, `control:session`, `control:volume`, `control:assets`, `control:connected-chat`, `control:package:<package>` e `control:beholder:<package>`, e `drawer:<window>:<drawer>` para uma gaveta destacada, por exemplo `drawer:chat-settings:chat-name`.
- `data-drawer` identifica uma gaveta, por exemplo `chat-name`. Alguns nomes começam com o modo do chat, como `roleplay-agents` ou `conversation-agents`. Os trackers usam `tracker-world`, `tracker-persona`, `tracker-characters`, `tracker-quests`, `tracker-inventory`, `tracker-custom` e `agent-activity`.
- `data-presentation` vale `"window"` em uma janela de computador ou `"sheet"` em um painel de celular.
- `data-pinned` e `data-locked` valem `"true"` enquanto a janela está fixada ou travada.
- `data-window-control` identifica cada botão da barra de título: `"pin"`, `"lock"`, `"close"` ou `"put-back"`. Um botão de fixar ou travar ativado também tem `aria-pressed="true"`.
- `data-chat-settings-control` identifica os botões extras da barra de título de Chat Settings: `"reset-view"`, `"favorite-layout"` e `"tracker-panel"`. A estrela favorita tem `aria-pressed="true"` e um ícone preenchido quando o layout atual corresponde ao favorito salvo.
- `data-edge` vale `"n"`, `"s"`, `"e"`, `"w"`, `"ne"`, `"nw"`, `"se"` ou `"sw"` em cada alça de redimensionamento.
- O botão de uma gaveta aberta dentro de `.mari-drawer__header` tem `aria-expanded="true"`.
- `data-drawer-control="pop-out"` marca o botão para destacar uma gaveta.
- `data-outside="true"` marca uma prévia de arraste longe o bastante da janela para se destacar ao soltar.
- `data-axis` vale `"x"` em uma guia de alinhamento vertical e `"y"` em uma horizontal.
- `data-detached` vale `"true"` quando uma gaveta aparece em sua própria janela, tanto na janela quanto na gaveta dentro dela. Essa janela é identificada por `data-window="drawer:<window>:<drawer>"`, por exemplo `data-window="drawer:chat-settings:chat-name"`, e `data-drawer-host` indica a janela de origem.
- `data-dragging` vale `"true"` em uma gaveta enquanto seu título é arrastado, e `data-drop-target` vale `"true"` em uma janela quando uma gaveta destacada fica sobre ela, pronta para voltar.
- Uma bolha tem o `data-window` da sua janela e `data-minimized="true"`, por exemplo `.mari-window-bubble[data-window="control:volume"]`. As janelas de controles se chamam `control:game`, `control:session`, `control:volume`, `control:assets`, `control:connected-chat`, `control:package:<package>` e `control:beholder:<package>`. `data-dragging` vale `"true"` em uma bolha durante o arraste.
- Uma bolha travada tem `data-locked="true"`, inclusive o botão Chat Settings. Ela continua abrindo sua janela, mas não pode ser movida até a janela ser destravada. Use `.mari-window-bubble[data-locked="true"]` para dar uma aparência diferente a esses botões.
- No celular, as janelas têm `data-presentation="sheet"`, assim como suas bolhas, que são um pouco maiores. A bolha de Tracker Panel é `.mari-window-bubble[data-tracker-panel-toggle="bubble"]`.
- O botão Chat Settings também é uma bolha: `.mari-window-bubble[data-chat-settings-button]`, com `data-open="true"` enquanto Chat Settings está aberto.
- Uma seção destacada se reduz a uma bolha com `data-drawer-host` (a janela de origem), e o botão **Put back** da sua janela é `[data-window-control="put-back"]`.

### Variáveis

Cada variável usa as cores compartilhadas dos controles do chat quando não é definida, então o tema só precisa das que você quer alterar.

| Variável | O que controla |
| --- | --- |
| `--mari-window-bg` | Fundo da janela |
| `--mari-window-text` | Texto da janela |
| `--mari-window-border`, `--mari-window-border-width` | Borda da janela |
| `--mari-window-radius` | Arredondamento dos cantos |
| `--mari-window-shadow` | Sombra da janela |
| `--mari-window-backdrop-filter` | Desfoque atrás da janela |
| `--mari-window-header-bg`, `--mari-window-header-text`, `--mari-window-header-border` | Cores da barra de título |
| `--mari-window-header-padding` | Espaçamento da barra de título |
| `--mari-window-control-color`, `--mari-window-control-color-hover`, `--mari-window-control-bg-hover` | Botões de título, incluindo a estrela favorita |
| `--mari-window-control-color-active`, `--mari-window-control-bg-active` | Botões de título ativados, incluindo fixar, travar e estrela favorita preenchida |
| `--mari-window-control-radius`, `--mari-window-control-gap` | Arredondamento e espaçamento dos botões |
| `--mari-window-focus-ring` | Contorno do foco do teclado e da janela para onde uma gaveta vai voltar |
| `--mari-window-resize-handle-size` | Largura das bordas de redimensionamento |
| `--mari-window-bubble-size`, `--mari-window-bubble-radius`, `--mari-window-bubble-shadow` | Tamanho, arredondamento e sombra das bolhas |
| `--mari-window-bubble-bg`, `--mari-window-bubble-bg-hover`, `--mari-window-bubble-border` | Fundo e borda das bolhas |
| `--mari-window-bubble-text`, `--mari-window-bubble-text-hover` | Cor do ícone da bolha |
| `--mari-window-snap-guide` | Cor da guia de alinhamento |
| `--mari-drawer-bg`, `--mari-drawer-border` | Fundo e separador da gaveta |
| `--mari-drawer-header-bg`, `--mari-drawer-header-bg-hover` | Cores do cabeçalho da gaveta |
| `--mari-drawer-header-padding`, `--mari-drawer-body-padding-inline`, `--mari-drawer-body-padding-bottom` | Espaçamento da gaveta |
| `--mari-drawer-title-color`, `--mari-drawer-icon-color`, `--mari-drawer-arrow-color` | Texto e ícones do cabeçalho da gaveta |
| `--mari-drawer-count-bg`, `--mari-drawer-count-text` | Contador da gaveta |

Defina uma variável em `:root` para mudar todas as janelas, ou em um seletor para mudar uma:

```css
:root {
  --mari-window-radius: 0.5rem;
  --mari-window-bubble-bg: #3b0764;
}

[data-window="chat-settings"] .mari-drawer[data-drawer="chat-name"] {
  --mari-drawer-border: transparent;
}
```

## Limites de tamanho e de nome

O nome do tema aceita até 200 caracteres. O CSS aceita até 256 KiB, medidos em bytes UTF-8, e não em caracteres. Um tema maior que isso é recusado na hora de salvar ou importar.

## Admin Access em instalações remotas

Criar, editar, importar, ativar e excluir um tema são ações protegidas. Isso só importa quando você abre Marinara pela rede.

Se você abre Marinara no mesmo computador que roda o servidor, por loopback (também chamado de localhost), essas ações funcionam sem mais nada. Se você abre Marinara em outro dispositivo, como um celular ou um computador da mesma rede, o servidor precisa antes de um segredo de administrador.

Para gerenciar temas pela rede:

1. No servidor, defina a variável `ADMIN_SECRET` no arquivo `.env`.
2. No aplicativo, abra **Settings -> Advanced -> Admin Access** e informe o mesmo valor.

Sem isso, as mudanças de tema feitas pela rede falham. Para a configuração completa, veja a [Referência de configuração do servidor](../CONFIGURATION.md) e o guia [Acesso remoto](../REMOTE_ACCESS.md).

## Como os temas e o Card CSS funcionam juntos

Marinara tem duas formas de adicionar CSS personalizado. São recursos separados e os dois podem ficar ativos ao mesmo tempo.

Um tema personalizado repinta o aplicativo inteiro. Ele pode substituir as variáveis centrais do Marinara, usar `!important` e usar `position: fixed`. É exatamente para isso que serve um tema.

O Card CSS é outra coisa. Quem cria um personagem ou uma persona pode embutir CSS no card, e você ativa esse CSS por chat. A limpeza do Card CSS é bem mais rígida. Ele não pode substituir as variáveis centrais do aplicativo, o `!important` é removido e `position: fixed` vira `position: absolute`. Ele estiliza as mensagens do chat, não o aplicativo inteiro. Veja o [guia de temas com Card CSS](card-css-theming.md).

Se o aplicativo estiver com a aparência estranha, vale conferir tanto o tema ativo quanto o Card CSS. Qualquer um dos dois pode ser a causa.

## Guias relacionados

- [Guia de temas com Card CSS](card-css-theming.md)
- [Configurações de aparência](appearance-settings.md)
- [Referência de configuração do servidor](../CONFIGURATION.md)
- [Acesso remoto: Basic Auth e lista de IPs permitidos](../REMOTE_ACCESS.md)
