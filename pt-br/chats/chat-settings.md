# Visão geral do painel Chat Settings

**Chat Settings** (configurações do chat) é o painel de opções do chat que está aberto: o modelo, os personagens, os agentes, a busca, os resumos, as ramificações e a galeria. A maioria das configurações pertence só a esse chat.

## Como abrir Chat Settings

1. Abra um chat.
2. Toque no botão **Chat Settings** (o ícone de controles deslizantes). Um painel se abre. No celular, **Help** (o **?**) mostra um guia dos ícones.
3. Toque no título de uma seção para abri-la. Toque no título de novo para recolhê-la.

Chat Settings abre automaticamente quando você cria um chat. Para fechar, toque no **X** dele ou no botão de controles deslizantes de novo.

No computador, o botão de controles deslizantes começa no canto superior direito do chat. Com o Tracker Panel exibido à direita, ele começa à esquerda desse painel. O Tracker Panel é um painel lateral do Roleplay que mostra o que os agentes (ajudantes que rodam junto com as respostas) acompanham, como os personagens que estão na cena.

Você pode arrastar o botão de controles deslizantes para um lugar melhor. Ele se alinha aos botões próximos do chat enquanto você arrasta. No computador, segure <kbd>Alt</kbd> para posicioná-lo livremente. Cada chat lembra a posição. Um pontinho no botão indica que os agentes estão trabalhando. Em um chat de Roleplay com o Advanced Memory Recall, um pontinho fixo no outro canto indica que algumas memórias de cena precisam de atenção. Veja [Corrigir problemas de memória](../agents/memory.md#fixing-memory-problems).

Na primeira vez que você abre um chat, um vídeo curto mostra como organizar os botões e as janelas. Clique em **Got it** (entendi). Ele continua dispensado nos seus outros chats e depois de recarregar a página. Para manter as dicas de layout ocultas em um chat, clique no **X** ao lado delas (**Hide these tips for this chat**).

## As seções em resumo

As seções que você vê dependem do modo do chat. A seção **Impersonate** é explicada em [Geração guiada e Impersonate](guided-and-impersonate.md).

- Barra de perfil de configurações: aplica ou salva um pacote de configurações de chat. Veja [Perfis de configurações](settings-profiles.md). (Conversation, Roleplay.)
- **Search messages** (buscar mensagens): encontra mensagens por palavras, ou por `#` e um número de mensagem. As abas **Bookmarks** (favoritos) e **Trash** (lixeira) listam as mensagens marcadas e as excluídas. (Exceto Game.)
- **Chat Name** (nome do chat): o nome que aparece na lista de chats. Clique nele para renomear. Ele nunca é enviado ao modelo.
- **Chat Branches** (ramificações do chat): troque, renomeie, exporte e importe ramificações. Veja [Ramificações de chat](branches.md).
- **Connection** (conexão): qual modelo responde neste chat. Veja abaixo.
- **Prompt Preset** (preset de prompt): a estrutura de prompt salva para este chat.
- **Advanced Parameters** (parâmetros avançados): substitui configurações de geração, como a temperatura, neste chat. Veja [Parâmetros de geração](../prompts/generation-parameters.md).
- **Persona**: quem você interpreta. Veja [Escolhendo a persona de um chat](../characters/choosing-your-persona.md). (Conversation, Roleplay.)
- **Characters** (personagens): os personagens do chat. (Conversation, Roleplay.)
- **Party** (equipe): substitui **Persona** e **Characters** e junta as duas em um lugar só. (Game.)
- **Group Chat** (chat em grupo): quem fala em um grupo. Veja [Chats em grupo](group-chats.md). (Chats com mais de um personagem.)
- **Scoped Regex Scripts**: controle por chat dos scripts de regex que pertencem a um personagem. Veja [Scripts de regex](../extending/regex-scripts.md#the-per-chat-scoped-regex-scripts-setting). (Aparece só quando um personagem do chat tem scripts com escopo.)
- **Chat Variables** (variáveis do chat): texto com nome que você reutiliza com `{{name}}`. Veja abaixo.
- **Connected Chats** (chats conectados): liga um chat a outro. Veja [Chats conectados](connected-chats.md).
- **Lorebooks**: anexa informações do mundo. Veja [Visão geral dos lorebooks](../lorebooks/overview.md).
- **Chat Summary** (resumo do chat): revisa e cria resumos. Veja [Memory Recall e resumos do chat](../agents/memory.md#chat-summary-roleplay). (Onde os resumos se aplicam.)
- **Active Context** (contexto ativo): mostra os lorebooks e o contexto ativos neste chat. Veja [Orçamento de tokens e recursão](../lorebooks/token-budgets.md#seeing-skipped-entries-in-active-context).
- **Agents** (agentes): ativa os ajudantes. Veja [Agentes: ajudantes de IA para os seus chats](../agents/agents-overview.md).
- **Agent activity** (atividade dos agentes): mostra o que os agentes fizeram. Execute os trackers de novo, repita ou pare agentes e limpe os trackers. Veja [Agent activity](../roleplay/getting-started.md#agent-activity). (Roleplay, com agentes ou Advanced Memory ativados.)
- **Author's Notes** (notas do autor): uma nota que o modelo lê a cada turno. Veja [Author's Notes](../roleplay/getting-started.md#authors-notes). (Roleplay.)
- **Background** (plano de fundo): a imagem de fundo do chat. (Roleplay, Game.)
- **Gallery** (galeria): as imagens e os vídeos do chat. Veja [Planos de fundo de cena e a galeria](../media/scene-backgrounds.md).
- **Widgets**: quais widgets do HUD aparecem no jogo. (Game.)
- **Impersonate**: configurações do comando `/impersonate`. (Roleplay.)
- **Memory Recall**: lembra partes anteriores do chat. Veja [Memory Recall e resumos do chat](../agents/memory.md). (Não existe na versão Lite.)
- **Function Calling** (chamada de funções): permite que o modelo use ferramentas (funções) neste chat.
- **Translation** (tradução): tradução automática das mensagens. Veja [Tradução de mensagens](../integrations/message-translation.md).

Os chats de Conversation também têm as seções Autonomous Messaging (os personagens mandam mensagem para você primeiro), Commands (ações que os personagens fazem por conta própria) e de notas. Elas são explicadas em [Conversation Mode: primeiros passos](../conversation/getting-started.md).

## Escolha o modelo de um chat

A seção **Connection** escolhe o modelo que responde neste chat. Uma escolha muda só este chat.

1. Abra **Chat Settings** e a seção **Connection**.
2. Toque no campo **Model** (modelo). Ele mostra o modelo atual.
3. Confira se ele diz que o chat segue o **Main** (principal). O Main é o modelo padrão que você define em **Connections** (Conexões).
4. Escolha um modelo. O seletor é o mesmo do botão de modelo na caixa de mensagem. O modelo atual fica no topo, com os modelos recentes e os com estrela logo abaixo, agrupados por conta. Busque entre modelos e contas, ou use **Browse** (navegar) para abrir o catálogo de uma conta.

**Follow Main** (seguir o principal) desfaz a escolha própria do chat, então o chat muda quando você muda o Main. **Shuffle** (sortear) escolhe um modelo diferente do seu conjunto a cada resposta. Veja [Shuffle](../connections/organizing-connections.md#shuffle). Se uma conta precisa de chave ou está desligada, o modelo dela leva à ação de reparo. Para adicionar uma conta, veja [Conectando a um provedor de IA](../connections/connecting-to-a-provider.md).

## Use as variáveis do chat

Uma variável do chat é um nome para um trecho de texto. Por exemplo, adicione `char1` com o valor `Mary` e depois escreva `{{char1}} walks in.` em uma mensagem. O modelo lê "Mary walks in."

1. Abra **Chat Settings** e a seção **Chat Variables**.
2. Toque em **Add variable** (adicionar variável) e preencha o **name** (nome) e o **value** (valor) da linha.
3. Pressione <kbd>Enter</kbd> ou clique fora do campo para salvar. O botão de lixeira remove uma variável.

Os nomes usam letras, números e sublinhados, começam com uma letra ou um sublinhado e têm no máximo 64 caracteres. Um nome com exatamente 21 caracteres é reservado para referências a personagens. Um nome que pertence a uma macro embutida, como `char` ou `user`, é recusado.

- A sua mensagem continua mostrando a etiqueta que você digitou. Só o modelo vê o valor. Mudar um valor depois muda todos os turnos anteriores que usaram a etiqueta.
- As variáveis pertencem só a este chat e continuam lá depois de reiniciar.
- Este é o mesmo armazenamento que o `{{setvar}}` usa. Uma seção do prompt ou uma entrada de lorebook que define o mesmo nome sobrescreve o seu valor.

Com muitas variáveis, clique em **Search and edit all in the State Editor** (buscar e editar tudo no State Editor). Ele lista todas as variáveis para você buscar, editar, colar várias de uma vez como JSON e revisar as alterações antes de salvar. Veja [O State Editor](../roleplay/hud-and-trackers.md#the-state-editor). Para as outras macros entre chaves duplas, veja [Macros de prompt](../prompts/macros.md).

<a id="settings-profiles"></a>

## Perfis de configurações

Um perfil de configurações é um pacote salvo de configurações de chat que você pode aplicar a outros chats. A barra de perfil fica no topo do painel e não aparece em Game. Como salvar, aplicar, importar, exportar e escolher um padrão está explicado em [Perfis de configurações](settings-profiles.md).

## Mover, fixar e travar a janela

No computador, Chat Settings flutua sobre o chat, e o conteúdo se reorganiza conforme o tamanho da janela. Uma janela abre abaixo do botão dela na primeira vez, ou na posição salva.

- Mover: arraste a barra de título. Ou dê foco à barra de título e use as setas, com <kbd>Shift</kbd> para passos maiores.
- Redimensionar: arraste uma borda ou um canto. Ou dê foco à alça do canto inferior direito e use as setas.
- Fixar: clique em **Pin** (fixar). Uma janela fixada continua aberta quando você clica em outro lugar e reabre depois de recarregar a página. Uma janela não fixada fecha quando você clica fora dela ou pressiona <kbd>Esc</kbd>, a não ser que você esteja digitando ou usando um menu aberto.
- Travar: clique em **Lock** (travar). A janela não pode ser movida nem redimensionada, e o botão dela fica no lugar. Você ainda pode abri-la.
- Fechar: clique no **X**.

As janelas ficam dentro da área do chat. Uma janela ou um botão pode ficar ao lado da caixa de mensagem, mas nunca a cobre. No celular, Chat Settings abre como um painel de largura total que se ajusta acima do teclado.

## Ajuda, trackers e Reset View

Estes botões ficam na barra de título.

- **Help** (o **?**) mostra etiquetas que explicam os controles do chat. No celular, ele fecha Chat Settings primeiro. Para ocultá-lo, ative **Settings → General → App Behavior → Hide chat Help button** (Configurações → Geral → Comportamento do aplicativo → ocultar o botão Help do chat).
- **Reset View** (a seta circular) pede confirmação e depois restaura o layout inicial deste chat: as seções destacadas voltam, e os tamanhos, as posições, as fixações e as travas das janelas são redefinidos.
- **Favorite layout** (a estrela) salva esta disposição para novos chats. Veja [Escolher um layout para novos chats](#choosing-a-layout-for-new-chats).
- **Tracker Panel** (o dado) liga ou desliga o painel em um chat de Roleplay que usa agentes ou Advanced Memory. No computador, ele abre ao lado do chat. No celular ou no tablet, um botão móvel o abre. Ele também muda a preferência de Tracker Panel em **Settings → Appearance** (Configurações → Aparência).

Quando o Tracker Panel não está visível, os trackers do computador usam a [janela Trackers](../roleplay/hud-and-trackers.md#the-trackers-window). Com pouco espaço ao lado das mensagens, ela começa como um pequeno botão **Trackers**. Use o dado para mostrar o Tracker Panel de novo.

<a id="popping-a-section-out-into-its-own-window"></a>

## Destacar uma seção em uma janela própria

Destaque uma seção para dar a ela uma janela própria.

1. Clique no botão **Pop out** (destacar) da seção, o quadrado com uma seta ao lado do **?** dela. No computador, você também pode arrastar o título da seção para fora de Chat Settings.
2. Mova, redimensione, fixe ou trave a nova janela como faria com Chat Settings. Ela começa sem fixação, então clicar em outro lugar a reduz a um botão.
3. Para devolvê-la, clique em **Put back in Chat Settings** (a seta curva ao lado do **X**) ou arraste a janela sobre Chat Settings.

O **X** reduz a seção a um pequeno botão com o ícone dela. Arraste o botão para onde quiser e clique nele para reabrir a janela. Os trackers saem da janela Trackers da mesma maneira, e o botão de retorno deles é **Put back in Trackers**.

No celular, destacar uma seção fecha Chat Settings e adiciona a seção ao menu de três pontos **Chat tools** (ferramentas do chat). Toque nos pontos e depois no ícone redondo da seção. Toque em **Put back in Chat Settings** para devolvê-la.

<a id="the-phones-chat-tools-menu"></a>

## O menu Chat tools do celular

O botão móvel de três pontos reúne as ferramentas que você tirou de Chat Settings. Toque nele para abrir os botões redondos com ícones e depois toque em uma ferramenta. Toque nos pontos de novo para recolhê-los. Os botões dos trackers, o botão do mapa de Game e Character Profiles continuam separados.

Arraste o botão de três pontos para mover o menu. Abra o menu e use o cadeado no topo para mantê-lo no lugar. Enquanto estiver destravado, arraste uma ferramenta para cima ou para baixo para reordená-la, ou dê foco a ela e use as setas. Travar impede tanto mover quanto reordenar. O menu segue o estilo dos widgets do chat.

<a id="control-windows-and-their-buttons"></a>

## Janelas de controles e seus botões

Algumas ferramentas abrem pequenas janelas próprias: **Game controls**, **Session**, **Volume** e **Game Assets** de um jogo; **Connected chat**; e os controles de pacotes instalados.

No computador, esses botões começam perto do canto superior direito do chat. Clique em um para abrir a janela dele. Fechar a janela traz o botão de volta. No celular, eles ficam no menu **Chat tools** e abrem como painéis de largura total.

Para guardar um deles dentro de Chat Settings, abra a janela e escolha **Put back in Chat Settings**. Use o botão de destacar da seção para separá-lo de novo. **Reset View** restaura a disposição inicial.

Arraste um botão para movê-lo. Os botões próximos se alinham enquanto você arrasta. Segure <kbd>Alt</kbd> para posicioná-lo livremente, ou use as setas enquanto ele está com foco. **Calls** de Conversation continua sendo um botão comum. Em Game, **Character Profiles** (perfis dos personagens) e o botão **Map** (mapa) do celular podem ser movidos, e o cadeado deles guarda as posições de cada jogo.

## Cada chat guarda seu próprio layout de janelas

Cada chat lembra os tamanhos e as posições das janelas, as fixações e as travas, as seções destacadas e as posições dos botões. As posições do celular e a ordem e a trava do menu Chat tools são salvas separadamente das posições do computador. Um [perfil de configurações](settings-profiles.md) pode salvar um layout para outros chats.

<a id="choosing-a-layout-for-new-chats"></a>

## Escolher um layout para novos chats

A estrela ao lado de **Reset View** torna a disposição atual o layout inicial de novos chats no mesmo modo. Conversation, Roleplay e Game têm, cada um, o seu próprio favorito.

1. Organize as janelas e os botões. Guarde as ferramentas dentro de Chat Settings ou destaque-as.
2. Oculte as dicas de layout se os novos chats também devem ocultá-las.
3. Clique na estrela. Ela fica preenchida quando o layout, as dicas e o modo de Scoped Regex Scripts atuais correspondem ao favorito salvo.

O favorito salva as posições, os tamanhos, as fixações, as travas, as ferramentas destacadas ou guardadas, a escolha das dicas de layout e o modo de [Scoped Regex Scripts](../extending/regex-scripts.md#the-per-chat-scoped-regex-scripts-setting) do chat. Um chat com a opção **Use preset default** (usar o padrão do preset) não salva nenhum modo, então os novos chats seguem o próprio preset de prompt. Os personagens, o modelo, as configurações de IA e as mensagens ficam com o chat.

Para substituir o favorito, mude a disposição e clique na estrela de novo. Para parar de usá-lo, clique na estrela preenchida. Isso só afeta os chats que você criar depois.

Um perfil de configurações com layout próprio salvo tem prioridade sobre o favorito quando é aplicado. Um perfil sem layout salvo mantém a disposição favorita. Os perfis continuam aplicando a própria configuração de dicas de layout e o próprio modo de Scoped Regex Scripts. Veja [Perfis de configurações](settings-profiles.md#favorite-window-layouts).

Depois de atualizar de uma versão mais antiga, a sua disposição antiga de botões de ferramentas já vem marcada com estrela nos três modos, até você substituir ou limpar o favorito. Uma instalação nova tem as ferramentas dentro de Chat Settings e nenhum favorito.

## Mudar a aparência das janelas do chat

Abra **Settings → Appearance → App** e role até **Chat widget style** (estilo dos widgets do chat), no fim de **App Style**. **Default** mantém o visual do Marinara. **Dottore** usa azuis gelados, metal claro e cantos recortados. **Prof. Mari** usa azuis de pedras preciosas, dourado quente e molduras arqueadas. Ambos seguem os modos claro e escuro e mudam o visual dos botões móveis, das janelas e das seções nos três modos de chat.

- **Font** (fonte), **Shape** (forma) e os três seletores de cor abaixo dos presets combinam o visual. As fontes instaladas no Marinara aparecem na lista de fontes. Escolher um preset de novo redefine a fonte, a forma e as cores personalizadas.
- **Button size (px)** (tamanho do botão em pixels) define o tamanho dos botões móveis do chat, de 32 a 96. Um campo vazio mantém o padrão.
- **Apply preset font**, **Apply preset shape** e **Apply preset colors** (aplicar a fonte, a forma e as cores do preset) estendem o estilo às mensagens, às caixas de entrada e aos controles do chat. Cada um funciona de forma independente, e todos começam desativados. As mensagens de Conversation usam a fonte e as cores, mas mantêm a própria forma. Com **Apply preset colors** ativado, as falas entre aspas mantêm a Dialogue Highlight Color própria de cada personagem ou persona.

Essas escolhas não movem as janelas. Elas são salvas com as preferências do aplicativo e sincronizam com os navegadores conectados ao mesmo servidor. Veja [Temas de CSS personalizados](../appearance/custom-css-themes.md#ready-made-chat-window-styles).
