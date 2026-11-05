# Game Mode: widgets do HUD

Os widgets do HUD são pequenos painéis nas bordas esquerda e direita da tela do jogo. Eles acompanham coisas como uma barra de vida, um contador de ouro ou o nível de confiança de um aliado. HUD quer dizer heads-up display. Cada jogo tem os próprios widgets, separados dos trackers do HUD do Roleplay (veja [HUD e trackers do Roleplay](../roleplay/hud-and-trackers.md)).

Um jogo pode ter no máximo 4 widgets no total, divididos entre os lados esquerdo e direito como você quiser. Os widgets só são usados quando **Custom HUD Widgets** (widgets personalizados do HUD) está ativado no jogo. Essa opção vem ativada por padrão no assistente de configuração. O Game Master (GM) então monta um conjunto inicial enquanto cria o seu mundo.

## Tipos de widget

O GM escolhe um tipo para cada widget que cria. Você pode escolher os tipos quando monta os widgets manualmente.

| Tipo de widget | O que mostra |
| --- | --- |
| **Progress Bar** | Uma barra horizontal com um valor dentro de um máximo, como vida ou estamina. |
| **Gauge** | Um mostrador em meia-lua com um valor dentro de um máximo. |
| **Relationship Meter** | Uma barra com marcos e um rótulo, boa para a confiança de um NPC ou um vínculo. |
| **Counter** | Um número grande, como ouro, dias passados ou abates. |
| **Stat Block** | Uma grade pequena de campos nomeados com valores, como STR e DEX ou uma palavra de status. |
| **List** | Uma lista curta com marcadores, como as metas ativas. |
| **Inventory Grid** | Uma grade de espaços de itens, com abas de categoria e contagem de itens opcionais. |
| **Timer** | Um cronômetro regressivo em minutos e segundos que pode correr em tempo real. |

## Revisar os widgets antes de o jogo começar

Quando existem widgets personalizados, um botão **Review Starting Widgets** (revisar os widgets iniciais) fica embaixo de **Start Game** (iniciar o jogo) na tela do jogo. Clicar nele abre a janela **Review Starting Widgets** antes de você começar. Ela lista todos os widgets iniciais para você ajustá-los antes de o jogo fixá-los.

1. Aperte **Edit** (editar) em um widget para mudar os valores iniciais ou renomear os campos do **Stat Block**.
2. Aperte **Remove** (remover) para tirar um widget que você não quer.
3. Aperte **Start Game** para começar a jogar com os widgets como estão. Aperte **Back** (voltar) para fechar a janela sem começar.

Uma janela parecida, **Prepare Next Session Widgets** (preparar os widgets da próxima sessão), aparece quando você inicia uma nova sessão em um jogo em andamento. Ela tem **Start Next Session** no lugar de **Start Game**, e **Cancel** no lugar de **Back**.

## Editar um widget durante o jogo

O GM atualiza os valores dos widgets conforme a história avança. Se ele deixar passar uma atualização, ajuste o widget à mão.

1. Encontre o painel do widget na borda esquerda ou direita da tela.
2. Clique no botão de lápis (**Edit**) no cabeçalho do widget.
3. Mude os valores na janela de edição, por exemplo o **Maximum value** de uma barra.
4. Clique em **Save Changes** (salvar as alterações).

Clique no cabeçalho do widget para recolher ou expandir o corpo dele.

## Mover e travar os painéis

Os painéis de widget ficam travados no lugar por padrão. Cada um tem um ícone de cadeado no cabeçalho.

1. Clique no ícone de cadeado para destravar o painel. Um contorno leve indica que ele pode ser movido.
2. Arraste o painel para o novo lugar.
3. Clique no ícone de cadeado de novo para travá-lo.

Para devolver um painel ao lugar padrão, dê um duplo clique no ícone de cadeado, ou pressione <kbd>R</kbd> com o ícone em foco. Cada painel guarda a própria posição e o estado de trava por jogo. O seu layout não passa para outros jogos.

No celular, os widgets aparecem como pequenas pastilhas, e não como painéis inteiros. Toque em uma pastilha para abrir aquele widget e toque no X para fechá-lo.

## Montar os próprios widgets

Você mesmo pode criar os widgets em vez de deixar o GM criá-los. Abra o editor manual em um destes lugares:

- No assistente de configuração: ative **Custom HUD Widgets** e depois ative **Build Widget Setup** (montar a configuração de widgets). O editor aparece logo abaixo.
- Em um jogo já existente: abra **Chat Settings** (configurações do chat) e depois a seção **Widgets**.

1. Escolha um tipo de widget no menu suspenso e aperte **Add** (adicionar).
2. Defina o **Icon** (um símbolo curto ou emoji), o **Label**, o **Type**, o **Side** (**Left HUD** ou **Right HUD**) e o **Accent** (a cor).
3. Preencha os campos daquele tipo: uma barra usa **Value** e **Max**, um contador usa **Count**, uma grade de inventário usa **Slots** e **Contents**, e um cronômetro usa **Seconds** e **Running**.
4. Em **Chat Settings**, aperte **Save Widgets** (salvar os widgets) para aplicar as mudanças. **Reset** desfaz as edições não salvas.

O editor mostra quantos dos 4 widgets permitidos você já usou.

## Compartilhar widgets com a importação e a exportação

Você pode salvar um layout de widgets em um arquivo e carregá-lo em outro jogo. O assistente de configuração e a seção **Widgets** de **Chat Settings** têm esses botões.

1. Aperte **Export Widgets** (exportar os widgets) para baixar os seus widgets como um arquivo JSON (um formato de dados em texto simples).
2. Em outro jogo, aperte **Import Widgets** (importar os widgets) e escolha esse arquivo.
3. Em **Chat Settings**, aperte **Save Widgets** para que os widgets carregados sejam aplicados.

## Guias relacionados

- [Game Mode: primeiros passos](getting-started.md)
- [HUD e trackers do Roleplay](../roleplay/hud-and-trackers.md)
