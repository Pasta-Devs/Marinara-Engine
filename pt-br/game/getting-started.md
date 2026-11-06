# Game Mode: primeiros passos

Game Mode transforma o Marinara Engine em um RPG para um jogador só, conduzido por um Game Master de IA. Use este guia para começar um jogo, jogar o primeiro turno e encontrar os controles.

Game Mode é um dos três modos de chat (Conversation, Roleplay e Game Mode). O Game Master (GM) é a IA que narra o mundo, interpreta cada personagem que você encontra e decide o que acontece em seguida, como o Dungeon Master de um RPG de mesa. Marinara acompanha o mapa, a equipe, os personagens não jogáveis (NPCs), os itens, as missões, o tempo dentro do mundo e o clima. Um jogo longo pode ser dividido em várias **sessões**, como as noites de jogo de uma campanha.

Não é preciso usar todas as mecânicas. Você pode deixar de lado o combate e os dados e jogar pela história.

## Antes de começar

Você precisa de uma coisa só: uma conta de IA para o Game Master. Veja [Conectando a um provedor de IA](../connections/connecting-to-a-provider.md) se ainda não adicionou nenhuma.

Todo o resto é opcional e vem desativado por padrão. Você pode adicionar depois:

- **Imagens.** O agente **Illustrator** desenha retratos de NPCs, planos de fundo de locais e imagens de cena. Baixe-o em **Agents → Agent Organizer** (Agentes → Organizador de agentes). Ele precisa de uma conta de imagens. Sem ele, você ainda tem a história, o acompanhamento do estado e o combate, mas as áreas visuais ficam vazias.
- **Efeitos de cena pelo Built-in model.** Marinara consegue rodar um modelo pequeno no seu próprio computador para escolher planos de fundo e músicas sem custo. Ele passa a ser o **Scene effects model** (modelo de efeitos de cena) padrão assim que você o baixa. Até lá, o padrão é **Skip - use inline tags from GM** (pular – usar as tags embutidas do GM). Veja [Como configurar o Built-in model](../connections/local-model.md).
- **Storyboards.** Baixe o agente Storyboard e depois ative-o para o jogo. Veja [Guia do agente Storyboard](storyboard.md).
- **Vídeo.** Uma conta de vídeo só é necessária para vídeos de cena ou Storyboards animados.
- **Música.** O agente **Music DJ** toca música do Spotify ou de uma pasta de música local.

## Comece um jogo

1. Na barra lateral de chats, abra a aba **GM** e clique no botão **+** (**New Game**). Ou clique em **Game** na tela inicial. O assistente de configuração abre. Veja [Como gerenciar a lista de chats](../chats/managing-chats.md).
2. Na primeira etapa, escolha o **Model** (modelo) que roda o GM. Escolha uma conta que você já adicionou. Se a lista estiver vazia, adicione uma primeiro. Para a geração do mundo, escolha um modelo pago e forte (veja [Escolher um modelo](#choosing-a-model)).
3. Clique em **Next** (avançar) em cada etapa. Todos os outros campos têm um valor padrão, então você pode só ir avançando.
4. Na última etapa, clique em **Create world** (criar mundo). O botão mostra **Generating World…** enquanto Marinara monta o seu mundo. É uma única solicitação grande ao seu modelo, então espere até ela terminar.
5. Quando o mundo estiver pronto, a tela do jogo mostra **Start Game** (iniciar o jogo). Clique nesse botão. Em seguida, o GM escreve a primeira mensagem.

Se os widgets personalizados do HUD estiverem ativados (o padrão), um botão **Review Starting Widgets** (revisar os widgets iniciais) fica abaixo de **Start Game**. Você pode ignorá-lo ou usá-lo para mudar os widgets iniciais antes. Veja [Game Mode: widgets do HUD](hud-widgets.md).

> **Dica:** Se é a sua primeira vez no Game Mode, deixe **Game Master Mode** em **Standalone GM**. Marinara monta um narrador sarcástico para você.

Se não funcionou, veja [A geração do mundo falha com erro de JSON ou 422](#world-generation-fails-with-a-json-or-422-error).

### O assistente de configuração

| Etapa | O que você define |
|---|---|
| **Connection** | **Game Name** (nome do jogo), o **Model** que roda o GM e um **Scene effects model** opcional. Por enquanto, o cartão **Game Mode** mostra só **VN** (veja [VN ou Overworld](#vn-or-overworld)). |
| **World** | Gênero, cenário, tom, dificuldade, classificação de conteúdo e idioma. **Combat Preference** (preferência de combate) é **Turn-Based** (por turnos) ou **Tactical** (tático). Toda partida nova usa classes **MRPG** (Marinara RPG; veja [Classes MRPG](mrpg-classes.md)). Quando há um conjunto de regras instalado, aparece a opção **Rules** (veja [Escolha as regras](#choose-rules)). |
| **Party** | A sua persona (o personagem que você interpreta), **Game Master Mode**, os integrantes da equipe e **GM intro message** (veja [A mensagem de introdução do GM](#the-gm-intro-message)). A árvore MRPG inicial de cada integrante vem da seção **Game Mode** do card dele (veja [Escolher as árvores de um personagem](mrpg-classes.md#choose-a-characters-trees)). |
| **Goals** | O que você quer da aventura. |
| **Lorebooks** | Os lorebooks que o GM trata como cânone. Um lorebook é um conjunto de fatos de fundo sobre o mundo. Veja [Visão geral dos lorebooks](../lorebooks/overview.md). |
| **Features** | **Enable Agents** e, em seguida, um cartão para cada agente baixado (**Illustrator**, **Music DJ**, **Lorebook Keeper**), além de **Custom HUD Widgets**, **Quick Time Events** e **Start Muted**. |
| **GM** | O estilo de apresentação e o **GM Prompt**. |

As ideias oferecidas abaixo do cenário e dos objetivos mudam a cada vez que o assistente abre. Em um jogo Tactical, o GM escreve uma descrição breve para cada luta, e Marinara monta um tabuleiro a partir dela. Veja [Game Mode: combate](combat.md#tactical-battles-and-terrain).

A etapa **World** também tem opções de combate para chefes. **GM directs bosses** (o GM dirige os chefes) vem ativada por padrão. Ela deixa o GM decidir os turnos dos chefes usando a sua conexão do GM, o que pode levar um momento. Os inimigos comuns decidem por conta própria, a menos que **GM directs bosses** esteja ativada e o conjunto de regras do jogo entregue a oposição ao Game Master (veja [Texto do Game Master](../extending/ruleset-sheets.md#game-master-text)). Enquanto **GM directs bosses** estiver ativada, **Game Master also plays named and brilliant opponents** (ativada por padrão) deixa o GM controlar também personagens com nome próprio e inimigos muito espertos. Outras duas opções sempre aparecem: **Companions fight on their own** (companheiros lutam por conta própria; ativada por padrão, desative para você mesmo controlar a equipe inteira) e **Let cruel opponents strike the fallen** (permitir que oponentes cruéis golpeiem os caídos; desativada por padrão). Uma partida nova também oferece **Permadeath** (morte permanente; desativada por padrão): um integrante da equipe que cair numa luta e não for salvo antes do fim desaparece para sempre. Veja [Game Mode: combate](combat.md).

Com o agente **Hierarchical Maps** baixado (agora chamado World Maps, veja [World Maps](../agents/hierarchical-maps.md)) e **Enable Agents** ativado, a etapa **Features** também pode esboçar um **Hierarchical world map** (mapa hierárquico do mundo), usar um modelo de mapa salvo ou ligar um mundo compartilhado.

### Padrões que vale conhecer

| Configuração | Padrão | Observações |
|---|---|---|
| Genre | Fantasy | Várias opções permitidas, mais as suas próprias. Um kit de cenário escolhido antes define o próprio gênero. |
| Tone | Heroic | Várias opções permitidas. |
| Difficulty | Normal | **Casual**, **Normal**, **Hard** ou **Brutal**. Níveis mais altos tornam as lutas mais difíceis: mais inimigos, e mais fortes, numa partida MRPG (veja [Batalhas numa partida MRPG](combat.md#battles-in-an-mrpg-game)); inimigos que batem mais forte numa partida Legacy (veja [Ajuste pela dificuldade](combat.md#difficulty-scaling)). |
| Content Rating | SFW | **SFW** ou **NSFW**. NSFW apenas permite conteúdo adulto, não o obriga. |
| Language | English | Todo o texto dentro do jogo é escrito nesse idioma. |
| Game Master Mode | Standalone GM | **Character GM** usa um dos seus cards de personagem como GM. |
| Scene effects model | Built-in model | Só depois que você o baixa. Até lá, o padrão é **Skip - use inline tags from GM**. |
| Enable Agents | Off | Ative para ver os cartões dos agentes. |
| Illustrator | Off | Precisa do agente Illustrator e de uma conta de imagens. |
| Music DJ | Off | Precisa do Spotify ou de uma pasta de música local. |
| Custom HUD Widgets | On | O modelo cria widgets de status para o mundo novo. |
| Quick Time Events | On | Desative para jogar com leitor de tela ou sem limite de tempo. |
| Start Muted | Off | Começa o jogo com todo o áudio no mudo. |
| Game Presentation | Standard | Veja abaixo. |

<a id="choose-rules"></a>

### Escolha as regras

**Rules** (regras) só aparece para um jogo novo e só quando há pelo menos um conjunto de regras instalado. **Marinara's own rules** (regras do próprio Marinara) é o padrão: os testes d20 embutidos e a ficha de seis atributos. Um conjunto de regras como **5e (SRD 5.1)** substitui isso pelos testes e pela ficha de personagem próprios de um sistema de mesa, e também pode resolver as batalhas com as próprias regras. O assistente mostra o que cada conjunto de regras abrange. A escolha fica fixa depois que o jogo é criado. Veja [Game Mode: jogar com um conjunto de regras](rulesets.md).

<a id="the-gm-intro-message"></a>

### A mensagem de introdução do GM

**GM intro message** (mensagem de introdução do GM), na etapa **Party**, decide como o jogo começa:

- **None** (nenhuma, o padrão): o GM abre o jogo como achar melhor.
- **Defined** (definida): digite a primeira mensagem exatamente como ela deve ficar. O jogo começa com esse texto, e gerar de novo dá o mesmo texto.
- **Guided** (guiada): descreva como a abertura deve ser, como onde ela começa e quem está lá. O GM escreve a abertura a partir disso.

O texto pode ter até 8.000 caracteres. Ele não pode conter chaves duplas, e o texto de **Guided** também não pode conter colchetes. O campo avisa quando o texto não pode ser usado. A história de um mundo pode definir a própria introdução. Nesse caso, o campo a mostra como travada e você não pode mudá-la.

### Storyboard Optimized

Na etapa **GM**, **Game Presentation** (apresentação do jogo) pode ser **Standard** ou **Storyboard Optimized** (otimizado para storyboard). **Storyboard Optimized** usa o Storyboard Game Prompt, que molda os turnos do GM em momentos visuais prontos para filmar. Ele não baixa nem ativa o agente Storyboard, não ativa a geração de imagens nem a de vídeos e não muda as suas contas. Depois de criar o jogo, configure essas coisas em **Chat Settings → Agents → Storyboards** (Configurações do chat → Agentes → Storyboards).

O editor **GM Prompt** mostra uma prévia do prompt da apresentação selecionada. Se você deixar o texto como está, o preset interno continua selecionado. Se editar, o seu texto passa por cima do preset.

A combinação alternativa de plano único em estilo anime continua disponível depois da configuração: escolha **Anime Episode Director** no Animation Planner e **Anime Game Video** no Storyboard Video Prompt.

## Jogue o primeiro turno

Digite o que o seu personagem faz ou diz e envie. O GM responde, atualiza o mundo e pode pedir uma rolagem de dados ou começar uma luta.

O botão de balão de fala ao lado do botão de anexar arquivos define quem recebe a sua mensagem. A dica dele é **Choose who to address** (escolha com quem falar).

| Modo | O que faz |
|---|---|
| Padrão | A sua mensagem entra na cena como uma ação ou uma fala. O GM e a equipe respondem dentro da história. |
| **Talk to Party** | Acrescenta a marca `[To the party]` e fala com os seus companheiros. Só aparece quando a equipe não está vazia. |
| **Talk to GM** | Acrescenta a marca `[To the GM]` e pergunta ao GM fora do personagem, por exemplo "Meu personagem sabe alguma coisa sobre o templo?". |

O modo ativo mostra **On** no menu. Clique de novo na mesma entrada para desativá-lo.

<a id="the-games-controls"></a>

## Os controles do jogo

No computador, os controles abrem pelos botões perto do canto superior direito do chat. No celular, eles ficam no menu móvel de três pontos **Chat tools** (ferramentas do chat).

| Controle | O que ele contém |
|---|---|
| **Game controls** (controle de videogame) | **Retry turn**, **Retry scene analysis**, **Retry Music DJ** (quando o Music DJ toca a música) e **Retry assets image generation**. Para um plano de fundo de storyboard, também repetir, reproduzir/pausar e silenciar. **Show the scene**, **Show the overworld** e **Show the map** alternam as visualizações nos jogos que as têm. **Edit game data** corrige à mão os dados salvos (veja [Editar os dados do jogo à mão](sessions-and-saves.md#editing-game-data-by-hand)). **Checkpoints** volta para um momento anterior (veja [Como o jogo salva](sessions-and-saves.md#how-your-game-saves)). |
| **Session** (pena) | O histórico de sessões, o diário e os controles de sessão. Veja [Game Mode: sessões e saves](sessions-and-saves.md). |
| **Volume** (alto-falante) | Volume de **Master**, **Music**, **Sound Effects**, **TTS** e **Ambient**. |
| **Game Assets** (pasta) | As mídias de cena e o Asset Browser. Veja [Recursos do jogo](game-assets.md). |
| **Connected chat** | Aparece quando o jogo está ligado a uma Conversation. Veja [Chats conectados](../chats/connected-chats.md#switching-between-connected-chats). |

Escolha uma ferramenta para abri-la em uma janela móvel no computador ou em um painel de largura total no celular. No computador, arraste o botão de uma ferramenta para movê-lo. No celular, mova o menu de três pontos ou destrave-o para reordenar as ferramentas lá dentro. Veja [Janelas de controles e seus botões](../chats/chat-settings.md#control-windows-and-their-buttons).

Você também pode manter um controle dentro de **Chat Settings**. Abra a janela do controle e escolha **Put back in Chat Settings** (devolver para as configurações do chat). Ele passa a aparecer ali como uma seção expansível, e o botão de destacar dele o transforma de novo em uma janela. Cada jogo salva a sua escolha. **Reset View** (redefinir a visualização) restaura a disposição inicial.

**Character Profiles** (perfis dos personagens) fica fora de Chat tools no computador e no celular. Arraste o botão de retrato dele para onde quiser e depois abra-o para escolher um integrante da equipe e ver ou editar a ficha dele. No celular, **Map** (mapa) também tem o próprio botão móvel. Os dois seguem o estilo de widget do seu chat, salvam as posições para este jogo e podem ser travados pela janela aberta.

<a id="choosing-a-model"></a>

## Escolher um modelo

A geração do mundo é a parte mais difícil do Game Mode. Ela pede ao modelo um documento JSON longo e rígido (um formato de texto que precisa estar exato, senão o jogo não consegue ler) sem nenhum campo faltando. Um modelo que conversa bem ainda pode falhar nessa etapa.

- Para a geração do mundo, use um modelo de ponta, atual e capaz, em uma conta paga. Em 2026, os jogadores relatam bons resultados com os modelos de topo dos principais provedores, como Anthropic Claude, OpenAI GPT e Google Gemini. Os nomes dos modelos mudam com frequência, então trate esses nomes como exemplos, não como uma lista fixa.
- Os modelos mais baratos que recomendamos, ambos testados em jogo até 31 de outubro de 2026, são DeepSeek V4 Flash e Claude Haiku 5.5.
- Nos turnos seguintes, às vezes dá para usar um modelo mais barato, porque os turnos pedem narração, e não JSON rígido. Se o GM esquecer NPCs ou contradisser detalhes anteriores, volte para um modelo mais forte.
- Evite modelos gratuitos ou de roteamento automático para a geração do mundo. Eles podem cair em um modelo pequeno, incapaz de produzir um JSON válido. Modelos pequenos de pesos abertos também costumam falhar.

Para a referência completa dos parâmetros, veja [Parâmetros de geração](../prompts/generation-parameters.md).

## Quanto custa um turno

Game Mode faz três tipos de solicitação de IA:

1. **Geração do mundo.** Uma vez, quando você clica em **Start Game**. Uma única solicitação grande que devolve a visão geral do mundo, o mapa inicial, os NPCs, as fichas da equipe e os widgets.
2. **Turnos de jogo.** Cada mensagem monta um prompt novo com o estado atual. O GM narra e atualiza o mundo. O motor, e não o modelo, calcula a matemática das rodadas de combate, então os resultados saem justos.
3. **Resumos de sessão.** Quando você encerra uma sessão, o GM escreve uma recapitulação e notas de continuidade. Quando você começa a seguinte, ele escreve uma mensagem curta de ligação. As sessões mais antigas são compactadas em resumos, para que campanhas longas caibam no modelo.

<a id="optional-tool-planning-and-lore-searches"></a>

## Planejamento opcional de ferramentas e buscas de lore

Abra **Chat Settings → Function Calling** (configurações do chat → chamada de funções) durante o jogo.

- **Let the GM search lore** (permitir que o GM busque lore) deixa o GM consultar fatos dos lorebooks pelo significado. Primeiro ative a vetorização dos lorebooks e vetorize as entradas deles. As buscas respeitam os livros e as pastas ativados e os botões liga/desliga de entradas específicos do chat. Elas usam a sua conta de embeddings e podem acrescentar uma solicitação ao modelo. Os chats de Game precisam dessa opção para consultar lorebooks, mesmo com **Enable Tool Use** ativado. Enquanto ela estiver desativada, `search_lorebook` fica indisponível no seletor de ferramentas.
- **Game tool provider** (provedor de ferramentas do jogo) usa **Same as narrator** (o mesmo do narrador) por padrão, o que mantém o ciclo normal de ferramentas (até quatro rodadas de ferramentas por turno). Escolher outra conta faz uma solicitação de planejamento separada antes da narração. Esse modelo escolhe as ferramentas, e o narrador recebe os resultados delas como texto. Isso custa uma solicitação a mais por turno nessa conta. Um modelo mais barato pode reduzir o custo, mas pode escolher ferramentas diferentes. Uma única etapa de planejamento não consegue encadear uma segunda consulta.
- **Finish rolled turns in one request** (terminar turnos com dados em uma solicitação) vem ativada por padrão e economiza uma solicitação nos turnos que rolam dados. Veja [Game Mode: dados e testes de perícia](dice-and-skill-checks.md#finishing-a-rolled-turn-in-one-request).

As contas de assinatura Claude e Grok não têm suporte a chamadas nativas de ferramentas. Os controles explicam isso e ficam desativados, a menos que um **Game tool provider** compatível esteja selecionado. Comandos de texto e tags de dados continuam funcionando. Se uma conta separada estiver ausente ou a solicitação dela falhar, o turno informa a falha em vez de narrar sem o trabalho das ferramentas.

Se os modelos locais compartilham pouca memória de GPU, abra **Chat Settings → Agents** e ative **Run Game tasks one at a time** (executar as tarefas do Game uma por vez). Narração, agentes e mídia de cena passam a esperar uns pelos outros dentro desse chat de Game. A opção vem desativada por padrão e não reserva a GPU contra outros chats ou aplicativos.

## Ativar os agentes

Os agentes são ajudantes de IA opcionais que rodam junto com o GM. Eles fazem solicitações extras, então aumentam o custo. Para usá-los, abra **Chat Settings → Agents** durante o jogo e ative **Enable Agents**. Dois são úteis no Game Mode:

- **Game Session Keeper** ajuda a manter a continuidade entre as sessões.
- **Music DJ** escolhe a música de fundo.

**Review Agent Outputs** (revisar as saídas dos agentes) deixa você conferir o que um agente produziu. Veja [Agentes: ajudantes de IA para os seus chats](../agents/agents-overview.md).

## Solução de problemas

<a id="world-generation-fails-with-a-json-or-422-error"></a>

### A geração do mundo falha com erro de JSON ou 422

O mais provável é que o modelo não tenha conseguido produzir o JSON inteiro. Tente o seguinte, nesta ordem.

1. Confira qual modelo o GM usa. Se for um modelo gratuito ou de roteamento automático, troque por um modelo pago e capaz.
2. Tente de novo. Algumas falhas acontecem uma vez só.
3. Encurte um campo de cenário ou de preferências muito longo. Entradas longas deixam menos espaço para o JSON.

Se a chamada quase deu certo, Marinara oferece a janela **Repair JSON**, com a saída bruta do modelo em um editor com números de linha. Uma linha de status diz se o JSON é válido ou mostra o erro de leitura. Clique em **Format** para organizar um JSON válido e depois em **Apply Repaired JSON** para usar a sua correção sem pagar por uma nova tentativa. **Repair JSON** também aparece nos resumos de sessão e em outras chamadas estruturadas. Para mais soluções, veja [Solução de problemas do Marinara Engine](../TROUBLESHOOTING.md).

### O GM narra de forma alegre mesmo com o tom sombrio que você escolheu

Alguns modelos continuam animados. Acrescente uma instrução clara no campo de preferências do assistente, como "mantenha a narração sombria, não suavize os fracassos". Ou troque por um modelo cuja voz padrão combine com o tom.

## Onde fica cada assunto

- [Game Mode: combate](combat.md): os encontros, o menu de ações, a matemática do dano e os Quick-Time Events.
- [Game Mode: classes MRPG](mrpg-classes.md): a escolha de classes, os status, os níveis e as promoções, a ficha de classe, as partidas compartilhadas e a migração de uma partida Legacy.
- [Game Mode: equipe e NPCs](party-and-npcs.md): os Character Profiles, as fichas e o Adventure Journal.
- [Game Mode: sessões e saves](sessions-and-saves.md): encerrar e começar sessões, o histórico e os checkpoints.
- [Game Mode: mapa, tempo e clima](map-time-weather.md): as visualizações do mapa, o relógio, o clima e o moral.
- [Game Mode: dados e testes de perícia](dice-and-skill-checks.md): o menu de dados e as regras dos testes de perícia.
- [Game Mode: widgets do HUD](hud-widgets.md): os widgets de status na tela.
- [Recursos do jogo](game-assets.md): a biblioteca de músicas, sons, sprites e planos de fundo.
- [Guia do agente Storyboard](storyboard.md): os Storyboards para Game Mode e Roleplay.
- [Roleplay Mode: primeiros passos](../roleplay/getting-started.md): as Author's Notes funcionam aqui do mesmo jeito.

## Overworld

As seções abaixo descrevem as partidas **Overworld**, que ainda não estão disponíveis. Leia-as só se o seu servidor as tiver ativado.

<a id="vn-or-overworld"></a>

### VN ou Overworld

Uma partida nova é jogada em um de dois modos de jogo, escolhido na primeira etapa e mantido em todas as sessões da partida:

- **Overworld** é um mundo feito para o seu cenário, percorrido em um mapa de overworld, com cidades, lugares para explorar e masmorras. Ele precisa de um kit de cenário e de um mundo. Até você escolher um kit, o do seu primeiro gênero é usado (High fantasy se o gênero não tiver um), e um mundo é sorteado para ele.
- **VN** é o Game Mode como sempre foi, contado como uma visual novel: cena a cena, com o mapa de cena e as batalhas, e sem kit de cenário, mundo, overworld, cidades ou mapas de masmorra.

Overworld fica travado, a menos que o dono do servidor defina `MARINARA_OVERWORLD_GAMES`. Enquanto estiver travado, o cartão aparece esmaecido com o aviso "Overworld games, with a setting kit and a generated world, are not ready yet. New games start as VN games." Toda partida nova é então uma partida VN, e as opções de kit de cenário e de mundo não aparecem. Uma partida criada antes de essa escolha existir continua jogando como antes: com um mundo, é uma partida Overworld; sem mundo, é uma partida VN.

<a id="choosing-a-setting-kit"></a>

### Escolher um kit de cenário

Um **Setting kit** (kit de cenário) dá ao GM as palavras em que o seu tipo de mundo é escrito: os nomes dos lugares e os tamanhos dos assentamentos, os tipos de grupo, como as pessoas viajam, os nomes para um ano e um dia, como os povos dão nome a si mesmos, o dinheiro e as mercadorias, os elementos, os lugares de batalha e qual família de arte e música ele usa (veja [Recursos do jogo](game-assets.md#a-settings-own-art-and-music)). Ele também diz quais tipos de mudança o mundo permite, como rivalidades, crimes, guerras ou desastres, e com que rapidez ele muda. Um tipo desligado nunca entra, então uma briga pode continuar sendo só uma briga.

Há oito kits: alta fantasia, wuxia e xianxia, dias atuais, sobrenatural moderno, anos 1920, cyberpunk, space opera e pós-apocalíptico. O de dias atuais é tranquilo por padrão, sem crime, conflito ou catástrofe, em ritmo lento.

- Escolher um kit antes de um gênero define o gênero que combina com ele. Um gênero que você mesmo escolheu continua como está.
- **Write it for my setting** (escrever para o meu cenário) pede ao seu modelo do GM que reescreva o kit para o seu gênero, cenário e tom. Se o resultado não fizer sentido como um todo, o modelo recebe mais um pedido com os motivos. Se ainda falhar, o assistente diz o que estava errado e mantém o kit que você tinha.
- **Change its words** (mudar as palavras) abre todas as palavras do kit. Digite uma lista em uma linha, separada por vírgulas. Um kit com um problema, como um nome vazio ou nenhum assentamento, diz o que está errado, e a partida não pode começar até isso ser corrigido.
- **Download this kit** (baixar este kit) salva um arquivo `.worldkit.json` para compartilhar. **Import a kit file** (importar um arquivo de kit) lê um de volta.

A partida mantém o kit com que foi criada, e um arquivo de configuração compartilhado o leva junto. Uma Experience pode trazer o próprio pacote de mapas (um kit, mapas prontos e tiles). Com essa Experience ligada, a configuração mostra o kit dela como definido e, se ela traz mapas, um **Map** (mapa) para escolher. Desligar a Experience devolve as suas escolhas.

<a id="making-a-world"></a>

### Criar um mundo

Com um kit escolhido, **Your world** (o seu mundo) monta um mundo nas palavras do kit antes de a partida começar: as regiões, os assentamentos de todos os tamanhos, pelo que cada lugar é conhecido e os caminhos entre eles (estradas, rios, rotas marítimas, rotas de salto), com o tempo de cada viagem em dias.

Um mundo vem de uma **World seed** (semente do mundo). A mesma semente, o mesmo kit e o mesmo resumo sempre fazem o mesmo mundo. **Roll** (sortear) dá outro, e digitar um número de volta traz um mundo de volta. A prévia mostra um mapa pequeno do terreno e dos assentamentos, o lugar onde a equipe começa e uma lista dos assentamentos por região.

- **Start from this lore** (começar por este lore) lê os lorebooks marcados em busca dos lugares e dos eventos datados que eles registram, mantidos exatamente como estão escritos. **Build around the lore** (construir em volta do lore) preenche o mundo ao redor deles. **Only the lore's places** (só os lugares do lore) não cria nada além deles.
- **Write the world's brief** (escrever o resumo do mundo) pede ao seu modelo do GM o presente, os lugares principais, os grupos em torno dos quais o presente gira (o que cada um quer, quem são os aliados e os rivais dele) e nomes para os lugares e as pessoas no som próprio de cada povo. Os lugares do lore são mantidos, seja o que for que o modelo escreva. Tudo o que não combina com o kit fica de fora e é contado. **Change the brief** (mudar o resumo) abre as palavras dele, inclusive os nomes e sobrenomes de cada povo. Sem um resumo, os lugares ficam numerados e as pessoas são chamadas pelo ofício.

**Um mundo tem um passado.** Antes de a partida começar, o mundo avança ano a ano desde a fundação. Os assentamentos crescem, os grupos são fundados, ganham e perdem líderes e se aproximam ou brigam entre si. Onde o mundo os tem, bandidos, guerras e fomes deixam marcas. Uma mudança grave só vem depois de se formar por um tempo, e só nos tipos que o kit permite. Os eventos datados do seu lore ou do resumo acontecem quando e onde dizem. A mesma semente e o mesmo resumo dão o mesmo passado.

**O que o GM sabe.** O GM sempre sabe onde a equipe está, para onde pode ir e quanto tempo leva cada caminho. Ele fica sabendo dos eventos mais marcantes do passado, de quem lidera o lugar atual e da história desse lugar. Sobre qualquer outro lugar ou grupo, ele pode perguntar e recebe a resposta no turno seguinte. Ele indica para onde a equipe vai com uma tag de lugar. Um lugar que o mundo lista mantém o tamanho que o mundo lhe deu. Um lugar que o mundo não lista, como uma casa de fazenda, mantém o nome que o GM lhe dá. Cada assentamento tem pessoas sorteadas pela semente quando a equipe chega: um nome da própria cultura, um ofício que combina com o lugar, um temperamento, um jeito de falar e uma aparência. Quando o GM nomeia alguém por completo, essa pessoa entra nos personagens acompanhados.

**O que a equipe faz fica feito.** Quando a equipe ajuda ou atrapalha um grupo, muda o que dois grupos sentem um pelo outro, toma ou arruína um lugar ou põe alguém à frente de um grupo, o GM registra isso na resposta. Cada mudança é conferida com o mundo. Uma mudança de um tipo que o kit tem desligado, ou que cita um lugar ou grupo que o mundo não tem, é recusada. Dali em diante, o GM fica sabendo do mundo como a história o deixou. Um lugar que a história acrescentou é um lugar para onde a equipe pode ir. Um swipe, uma nova geração ou uma mensagem excluída desfaz a mudança junto com a resposta dela.

**O mundo segue sem a equipe.** Quando o GM diz que o tempo passa, o mundo avança uma semana de cada vez, só nos tipos de mudança que o kit tem. Catástrofes nunca vêm sozinhas: só o GM pode narrar uma, e ela é recusada se o tipo dela estiver desligado. Nada é decidido onde a equipe está. As notícias viajam: o GM fica sabendo de uma mudança distante depois de passados os dias que as estradas levam. Os feitos da equipe contam mais à medida que ela fica conhecida.

**Edições manuais.** Em um editor de mundo, você pode renomear ou mover lugares, pintar o terreno, acrescentar lugares e pessoas, pintar o campo de batalha tático de um lugar (veja [Game Mode: combate](combat.md#tactical-battles-and-terrain)) e dispor uma cidade (veja [A cidade](map-time-weather.md#the-town)). Todas as partes do jogo veem as edições na hora. Um lugar renomeado ainda responde pelo nome antigo. As edições mudam o mundo daqui em diante, nunca o passado dele. Uma cidade mantém a disposição dela, então os lugares e as pessoas que você acrescenta vão para os próximos lotes e casas livres.

**Arquivos de mundo.** **Download this world** (baixar este mundo), em **Your world**, salva o mundo que você está criando, e **Download the world** (baixar o mundo), na aba World de uma partida, salva o mundo dessa partida, com as edições manuais, como um arquivo `.world.json`. **Import a world file** (importar um arquivo de mundo), ao lado do kit de cenário, lê um arquivo na configuração de uma partida nova: ele escolhe o kit do arquivo e cria o mundo dele. **Your worlds** (os seus mundos) faz o mesmo com um mundo da sua biblioteca. Um arquivo também pode trazer a história do mundo: os eventos e as cenas que o criador dele escreveu. As cenas de uma história aparecem na narração antes da resposta do GM, exatamente como foram escritas, e os objetivos de missão dela ficam listados em **Story**, na aba World do diário. Para escrever uma, veja [Escrever roteiros de história de Game Mode](../extending/writing-story-scripts.md). As edições manuais e a história pertencem àquela semente e àquele resumo, então ficam de fora se você mudar qualquer um dos dois. Um arquivo que não pode ser lido é recusado, e o assistente diz por quê. Um arquivo cujo conteúdo não combina com o kit fica em parte de fora, e o assistente diz o quê.

**Mais tarde e salvo.** Uma partida criada sem mundo pode ganhar um depois, pela aba **World** do diário, com **Make a world for this game** (criar um mundo para esta partida). O mundo começa no turno seguinte, e os turnos passados, o mapa e as pessoas continuam como estão. O botão fica esmaecido enquanto o Overworld RPG estiver travado. Uma partida mantém o mundo como foi feito, então uma sessão nova, uma ramificação e um chat exportado mantêm o mesmo mundo. Um mundo feito por uma versão anterior do gerador continua jogável, mas não pode mais ser editado.

Uma partida com mundo abre no **overworld**, um mapa de pixels onde você leva a equipe de assentamento em assentamento e entra nas cidades. Veja [O overworld](map-time-weather.md#the-overworld).
