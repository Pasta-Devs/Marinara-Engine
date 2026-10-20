# Game Mode: primeiros passos

Game Mode transforma o Marinara Engine em um RPG para um jogador só, conduzido por um Game Master de IA. Neste guia você vê o que é o Game Mode e o que precisa ter antes de começar. Depois, ele percorre o assistente de configuração e mostra onde encontrar cada recurso de jogo. Leia uma vez, comece um jogo e siga os links do final para os assuntos mais aprofundados.

## O que é o Game Mode

Game Mode é um dos modos de chat do Marinara. Os outros são Conversation e Roleplay.

No Game Mode, um Game Master (GM) de IA conduz uma história para você. O Game Master (o mestre do jogo) é a IA que narra o mundo, interpreta cada personagem que você encontra e decide o que acontece em seguida. Funciona como o Dungeon Master de um RPG de mesa.

O motor acompanha o estado do jogo turno a turno. Isso inclui o mapa, a equipe, os personagens não jogáveis (NPCs), os itens, as missões, o tempo dentro do mundo e o clima. O jogo se desenrola ao longo de muitos turnos. Um jogo longo pode ser dividido em várias **sessões**, do mesmo jeito que um grupo de mesa divide a campanha em várias noites de jogo. A campanha é a história inteira, do começo ao fim.

Não é preciso usar todas as mecânicas. Alguns jogadores deixam de lado o combate e os dados, e usam o Game Mode para uma partida visual, guiada pela história. Os sistemas de RPG ficam ali, prontos para quando você quiser.

## Antes de começar

Só uma coisa é necessária para começar um jogo: uma conexão com um provedor de IA para o GM. A conexão liga o Marinara a um provedor de IA para que ele gere texto. Veja [Conectando a um provedor de IA](../connections/connecting-to-a-provider.md) se você ainda não configurou nenhuma.

Todo o resto é opcional e vem desativado por padrão. Esses itens podem ser adicionados depois:

- **Geração de imagens.** Game Mode tem um layout visual com planos de fundo e arte dos personagens. Para preencher tudo isso, você precisa de uma conexão de geração de imagens. A configuração **Visual Generation** (geração visual) do assistente vem desativada por padrão, então você mesmo precisa ativá-la. Sem ela, a história, o acompanhamento do estado e o combate continuam funcionando, mas as áreas visuais ficam vazias.
- **Um modelo local para os efeitos de cena.** Marinara consegue rodar um modelo pequeno na sua própria máquina, identificado como **Local Model (Gemma)**. Ele cuida das sugestões de plano de fundo e de música sem custo extra. É a opção padrão do assistente. Veja [Como configurar o Local Model](../connections/local-model.md).
- **O agente Storyboard.** Instale-o em **Agents > Download Agents** e, quando quiser Storyboards estáticos ou animados, ative-o para o Game já criado em **Chat Settings > Agents**.
- **Uma conexão de geração de vídeos.** Só é necessária para vídeos de cena ou Storyboards animados.
- **Música.** O agente **Music DJ** toca a música do jogo. Ele precisa do Spotify ou de uma pasta de música local, e vem desativado por padrão.

## O assistente de configuração

Ao criar um chat em Game Mode, abre-se um **assistente de configuração**. Ele tem sete etapas. O único campo obrigatório é a conexão do GM, na primeira etapa. Todos os outros campos já vêm com um valor razoável. Você pode passar rápido pelo assistente e deixar o Marinara preencher o resto.

As sete etapas são:

1. **Connection.** Escolha o **Game Mode**: **Overworld RPG** ou **Classic**. O Overworld RPG ainda não está pronto, então, por enquanto, as partidas novas começam como **Classic**. Veja [Classic ou Overworld RPG](#classic-or-overworld-rpg). Defina o nome do jogo, escolha a conexão do GM e, se quiser, uma conexão para os efeitos de cena. Os efeitos de cena usam **Local Model (Gemma)** por padrão.
2. **World.** Defina gênero, cenário, tom, dificuldade, classificação de conteúdo e idioma. As ideias oferecidas abaixo do cenário, e depois abaixo dos objetivos, vêm de tipos diferentes de cenário, em uma mistura nova a cada vez que o assistente abre. Escolha **Classic** ou **Tactical** em **Combat Preference** (preferência de combate). Partidas Tactical também oferecem semente, tamanho e orientações de terreno opcionais para o campo de batalha. Se houver um conjunto de regras de Game Mode instalado, a opção **Rules** (regras) aparece abaixo: mantenha **Marinara's own rules** ou escolha o conjunto. Veja [Escolher as regras](#choosing-rules). No Overworld RPG, abaixo disso ficam **Setting kit** (kit de cenário) e **Your world** (o seu mundo). Veja [Escolher um kit de cenário](#choosing-a-setting-kit) e [Criar um mundo](#making-a-world).
3. **Party.** Escolha a persona (o personagem que você interpreta), o **Game Master Mode** e os integrantes da equipe. **GM intro message** (mensagem de introdução do GM) define a primeira mensagem do jogo. Veja [A mensagem de introdução do GM](#the-gm-intro-message).
4. **Goals.** Conte ao GM o que você espera da aventura.
5. **Lorebooks.** Anexe os lorebooks cujos fatos o GM deve tratar como cânone. O lorebook é um conjunto de fatos do seu mundo. Veja [Visão geral dos lorebooks](../lorebooks/overview.md).
6. **Features.** Ative sistemas opcionais como Visual Generation, Music DJ e widgets do HUD. Os agentes instaláveis podem ser ativados em Chat Settings depois que o Game é criado.
7. **GM.** Escolha o estilo de apresentação e revise as instruções avançadas do GM antes de o mundo ser criado.

Ao terminar, clique em **Start Game**.

Nas partidas Tactical, deixar as opções do campo de batalha vazias permite que o GM escolha uma descrição adequada à cena e o motor gere o tabuleiro. Uma semente fixa repete a geração com as mesmas entradas do encontro; as orientações de terreno pedem ao GM elementos como uma parede em ruínas ou uma clareira. Veja [Game Mode: combate](combat.md#tactical-battles-and-terrain) para regras de movimento, bônus de terreno e falhas de geração.

<a id="classic-or-overworld-rpg"></a>

### Classic ou Overworld RPG

Uma partida nova é jogada em um de dois Game Modes, escolhido na primeira etapa e mantido em todas as sessões da partida:

- **Overworld RPG** (o padrão, quando estiver pronto): um mundo feito para o seu cenário, percorrido em um mapa de overworld, com cidades para visitar, lugares para explorar e masmorras para descer. Ele precisa de um kit de cenário e de um mundo; até você escolher um kit, o kit do seu primeiro gênero é usado (High fantasy para um gênero sem kit), e um mundo é sorteado para ele.
- **Classic**: o Game Mode como sempre foi. A história é contada cena a cena, com o mapa de cena e as batalhas, sem kit de cenário, mundo, overworld, cidades ou mapas de masmorra.

Uma partida criada antes de essa escolha existir continua jogando como antes: com um mundo, é uma partida Overworld; sem mundo, é uma partida Classic.

O Overworld RPG ainda está sendo finalizado. Até ficar pronto, o cartão dele aparece esmaecido com o aviso "Overworld games, with a setting kit and a generated world, are not ready yet. New games start as Classic games." Toda partida nova é então Classic, e as opções de kit de cenário e de mundo abaixo não aparecem. Elas descrevem as partidas Overworld RPG.

<a id="choosing-rules"></a>

### Escolher as regras

**Rules** (regras) só aparece quando há pelo menos um conjunto de regras instalado, e só para uma partida nova. Essa opção é separada de **Combat Preference**: uma decide como funcionam os testes e as fichas de personagem, a outra decide como as batalhas são mostradas.

- **Marinara's own rules** é o padrão: os testes d20 integrados e a ficha de seis atributos.
- Um conjunto de regras, como **5e (SRD 5.1)**, mostra um resumo curto do que cobre e uma linha dizendo o que as batalhas vão fazer. Um conjunto que resolve as próprias lutas diz isso. Um que só empresta a ficha diz que as batalhas rodam no combate do Marinara com a saúde, a energia e as habilidades da própria ficha. Um que não faz nenhuma das duas coisas diz que as batalhas rodam no combate do Marinara e nomeia a **Combat Preference** que você escolheu.

Quando o conjunto resolve as próprias lutas, a tela de batalha é a desse conjunto: o menu traz os ataques e as habilidades do seu personagem, cada um dizendo o que gasta da economia de ações e das reservas do próprio conjunto; o painel abaixo mostra a ordem dos turnos, a rodada, as condições de todos com os nomes do próprio conjunto e o que resta de cada orçamento; e o registro mostra a aritmética real, como "Juno attacks Rust jackal with Road axe: 8 (5 + 3) + 3 = 11 against Guard 6, a hit." Cada ação é gravada na ficha de personagem no momento em que acontece, então fechar a aba no meio da luta não perde nada, e o Game Master é avisado depois de que os números já estão resolvidos. Se esse conjunto também diz quanto vale uma casa do campo de batalha na própria unidade de distância dele, a sua **Combat Preference** decide como a luta é mostrada: **Classic** joga sem posições, e **Tactical** joga em um tabuleiro onde você anda, mede alcance e distância na unidade do próprio conjunto e mira uma área em uma casa. Veja [Game Mode: combate](combat.md#games-whose-ruleset-resolves-its-own-fights). Um conjunto que não diz nada sobre distância mantém a preferência, mas não a usa.

O conjunto de regras é definido quando a partida é criada e fica com ela. Não é possível trocá-lo nem acrescentá-lo depois.

Alguns conjuntos oferecem **layers** (camadas): variantes nomeadas, como Low magic ou Hard winter, mostradas como botões liga/desliga abaixo do conjunto, com uma linha dizendo o que cada uma faz. Uma camada pode deixar as dificuldades mais duras, restringir uma escolha na ficha de personagem, deixar algumas entradas prontas fora do seletor do editor de fichas e dar instruções extras ao Game Master, inclusive para o mundo que ele cria na configuração. Algumas camadas excluem umas às outras, e o assistente desativa a que você não pode ter. As camadas ficam fixas quando a partida começa, exatamente como o próprio conjunto, e uma ficha que já usa algo que uma camada retira continua com isso.

Os conjuntos de regras vêm de dois lugares. Os oficiais são instalados em **Download Agents**, onde aparecem marcados como **Rules**. Os da comunidade são importados de um arquivo ou do repositório GitHub de um autor e ficam arquivados sob a origem deles, como `local/ember-roads` ou `alice/v20`. A importação usa a mesma opção **Allow custom Agent imports** dos agentes importados. Enquanto essa opção está desligada, os conjuntos importados ficam de fora das partidas novas, e as partidas que já usam um continuam funcionando. Uma partida com um conjunto importado sempre joga na versão exata em que foi criada. Para escrever o seu, veja [Escrever conjuntos de regras de Game Mode](../extending/writing-rulesets.md).

Depois que você escolhe um conjunto, a etapa **Party** lista a sua persona e os integrantes da equipe abaixo dos seletores e diz quem **Has a sheet** (tem ficha) para ele e quem **Starts on a blank sheet** (começa com ficha em branco). Uma ficha é adicionada em **Stats** no editor de personagem ou de persona (veja [Fichas de conjuntos de regras](../characters/colors-and-stats.md#ruleset-sheets)). A partida copia cada ficha quando o mundo é gerado. Nada do que você muda na partida volta para o personagem ou a persona. Um integrante sem ficha recebe uma em branco, com todos os valores no padrão do conjunto; a geração do mundo nunca inventa valores.

Um arquivo de configuração compartilhado lembra o conjunto dele. Se você importar um e não tiver esse conjunto, ou tiver uma versão mais antiga dele, o assistente diz qual era o conjunto, e a partida usa as regras próprias do Marinara, a menos que você o instale e o escolha.

<a id="choosing-a-setting-kit"></a>

### Escolher um kit de cenário

Um **Setting kit** (kit de cenário) dá ao Game Master as palavras em que o seu tipo de mundo é escrito: como os lugares dele se chamam e qual o tamanho que um assentamento pode ter, os tipos de grupo, pelo que um lugar pode ser conhecido, como as pessoas viajam, como se chamam um ano e um dia, como os povos dele dão nome a si mesmos, o que uma luta vencida pode render, o dinheiro e as coisas do dia a dia que ele vende, os elementos, os lugares onde as lutas acontecem e qual família de arte, música e sons ele usa (veja [Recursos do jogo](game-assets.md#a-settings-own-art-and-music)). O kit também diz quais tipos de mudança o mundo tem, como rivalidades, crimes, guerras ou desastres, e com que rapidez ele muda sozinho. Um tipo desligado nunca entra como evento de fundo, e uma cena não escala para ele, então uma briga pode continuar sendo só uma briga.

Ele só é oferecido para uma partida Overworld RPG nova, que sempre tem um: até você escolher um kit, o do seu primeiro gênero é usado. Há oito para começar: alta fantasia, wuxia e xianxia, dias atuais, sobrenatural moderno, anos 1920, cyberpunk, space opera e pós-apocalíptico. O de dias atuais é tranquilo por padrão, sem crime, conflito ou catástrofe, em ritmo lento, para slice of life.

Escolher um kit antes de ter escolhido um gênero define o gênero que combina com ele, como **Cyberpunk** para cyberpunk ou **Wuxia** para wuxia e xianxia, e as ideias de cenário e de objetivo passam a começar pelas do kit. Um gênero que você mesmo escolheu continua como está.

Depois de escolher um, **Write it for my setting** (escrever para o meu cenário) pede à sua conexão do Game Master que o reescreva para o gênero, o cenário e o tom que você escolheu. Se o que o modelo escreve não fizer sentido como um todo, ele recebe mais um pedido com os motivos, e depois o assistente diz o que estava errado e mantém o kit que você tinha. **Change its words** (mudar as palavras) abre todas as palavras do kit para edição. Uma lista é digitada em uma linha, separada por vírgulas. Um kit com um problema, como um nome vazio ou nenhum assentamento, diz o que está errado, e a partida não pode começar até isso ser corrigido.

A partida mantém o kit com que foi criada. O Game Master o lê a cada turno, e a geração do mundo usa as palavras dele. Um arquivo de configuração compartilhado também leva o kit.

Uma Experience pode trazer o próprio **map pack** (pacote de mapa): um kit de cenário, mapas prontos e tiles próprios. Com essa Experience ligada, a configuração mostra o kit dela como definido (sem kit para escolher) e, se ela traz mapas, um **Map** (mapa) para escolher; a partida é jogada nesse mapa e desenhada com os tiles da Experience. Desligar a Experience devolve as suas próprias escolhas.

**Download this kit** (baixar este kit) salva o kit como um arquivo (`.worldkit.json`) para compartilhar, e **Import a kit file** (importar um arquivo de kit) lê um de volta. **Import a world file** (importar um arquivo de mundo) traz um mundo inteiro de uma vez (veja abaixo).

<a id="making-a-world"></a>

### Criar um mundo

Com um kit de cenário escolhido, **Your world** (o seu mundo) monta um mundo inteiro nas palavras do kit antes de a partida começar: as regiões dele, assentamentos de todos os tamanhos da escala do kit, pelo que cada lugar é conhecido e os caminhos entre eles (estradas, rios, rotas marítimas, rotas de salto), com quantos dias cada viagem leva. Toda partida Overworld RPG nova tem um, sorteado a partir de uma semente que você pode mudar.

Um mundo é feito a partir de uma **World seed** (semente do mundo). A mesma semente, o mesmo kit e o mesmo resumo sempre fazem o mesmo mundo, então **Roll** (sortear) dá outro, e digitar um número de volta traz um de volta. A prévia abaixo é o mundo que a partida vai jogar: um mapa pequeno do terreno e dos assentamentos, o lugar onde a equipe começa e uma lista de todos os assentamentos por região.

- **Start from this lore** (começar por este lore) lê os lorebooks que você marcar em busca dos lugares que eles citam e dos eventos datados que registram, cada um mantido exatamente como o lore diz, com as entradas de onde veio. **Build around the lore** (construir em volta do lore) preenche o mundo ao redor deles; **Only the lore's places** (só os lugares do lore) não cria nada além deles.
- **Write the world's brief** (escrever o resumo do mundo) pede o resto à sua conexão do Game Master: o presente quando a partida começa, os lugares principais, os grupos em torno dos quais o presente gira (o que cada um quer, quem são os aliados e os rivais dele) e nomes para os lugares e as pessoas que o mundo cria, no som e na ordem próprios de cada povo do kit. Os lugares do lore são mantidos, seja o que for que o modelo escreva, e tudo o que não combina com o kit fica de fora e é contado, assim como os poucos nomes a que os modelos recorrem o tempo todo. **Change the brief** (mudar o resumo) abre as palavras dele para edição, inclusive os nomes e sobrenomes de cada povo.

Sem um resumo, o mundo é só o kit e os lugares do lore, e os lugares que ele cria ficam numerados até um resumo lhes dar nomes.

Um mundo também tem um passado. Antes de a partida começar, o próprio motor do mundo o faz avançar ano a ano desde a fundação: cada assentamento é fundado e cresce até o tamanho atual, os grupos do resumo são fundados nas suas sedes, ganham e perdem líderes e se aproximam ou brigam entre si, e, onde o mundo os tem, bandidos, guerras e fomes deixam as suas marcas, com alguns lugares perdidos para eles. Uma mudança grave só vem depois de se formar por um tempo (tensão antes de uma guerra, uma estiagem antes de uma fome), e ela só usa os tipos de mudança que o kit permite: o passado de um mundo tranquilo também é tranquilo. Os eventos datados que o seu lore registra, ou que o resumo cita, acontecem quando e onde dizem. A mesma semente e o mesmo resumo sempre dão o mesmo passado.

O Game Master fica sabendo dos eventos mais marcantes do passado, de quem controla o lugar onde a equipe está e de quem lidera esse grupo, além do passado desse próprio lugar. Sobre qualquer outro lugar ou grupo ele pode perguntar, e recebe a resposta no turno seguinte.

Todo assentamento tem as suas pessoas, sorteadas pela semente quando a equipe chega lá: mais nos lugares maiores, cada uma com um nome da lista da própria cultura, um ofício que combina com aquilo pelo que o lugar é conhecido, um temperamento, aquilo que lhe importa, um jeito de falar e uma aparência, e algumas que vieram de outro lugar. O Game Master vê algumas pessoas do lugar atual que a equipe ainda não conheceu e traz uma delas quando alguém novo entra na cena. Alguém que ele nomeia por completo entra nos personagens acompanhados da partida, com o que faz e como é, para que duas pessoas com o mesmo nome possam ser diferenciadas. Sem as listas de nomes de um resumo, as pessoas são chamadas pelo ofício.

Durante o jogo, o Game Master sempre sabe onde a equipe está, para onde pode ir dali e quanto tempo leva cada caminho. Ele indica para onde a equipe vai com uma tag de lugar. Um lugar que o mundo lista mantém o tamanho que o mundo lhe deu. Em um conjunto de regras com mercados, ele também assume o tamanho correspondente na escala do mercado, então a capital de um mundo é o maior lugar do mercado. Um lugar que o mundo não lista, como uma casa de fazenda ou um acampamento, mantém o nome que o Game Master lhe dá. Quando a partida começa, o passado do mundo fica fixo. A disposição dele também fica fixa, exceto pelas edições manuais (veja abaixo). Um arquivo de configuração compartilhado leva o mundo como ele foi feito da primeira vez.

O que a equipe faz ao mundo fica feito. Quando a equipe ajuda ou atrapalha um grupo, torna dois grupos amigos ou inimigos, toma o lado de um grupo ou o trai, melhora ou danifica um lugar, toma um lugar para um grupo, destrói um grupo, põe alguém à frente de um grupo ou leva um lugar à ruína, o Game Master registra isso na resposta, como faz com um lugar ou grupo que a história introduz. Cada mudança é conferida com o mundo: uma mudança de um tipo que o kit tem desligado, como uma guerra em um mundo aconchegante de dias atuais, ou que cita um lugar ou grupo que o mundo não tem, é recusada. Dali em diante, o Game Master fica sabendo do mundo como a história o deixou: como o lugar está, quem o controla e quem lidera esse grupo, o que a equipe fez ali, a posição da equipe com cada grupo com que lidou e o que mudou desde o começo do jogo. Um lugar que a história acrescentou é um lugar para onde a equipe pode ir. Uma mudança pertence à resposta que a fez, então um swipe, uma nova geração ou uma mensagem excluída a desfaz junto com essa resposta.

O mundo também segue sem a equipe. Quando o Game Master diz que o tempo passa (uma viagem, uma noite de descanso, uma longa espera), o mundo dá os próprios passos, uma semana de cada vez, e só nos tipos de mudança que o kit tem: fortunas sobem e caem, recém-chegados se instalam, grupos se aproximam ou viram rivais, líderes deixam o posto e, onde o mundo os tem, problemas encontram lugares em tempos difíceis, e a tensão entre dois grupos pode virar uma guerra depois de uma estação de acúmulo. Catástrofes nunca vêm sozinhas; só o Game Master pode narrar uma, como pode narrar qualquer evento além da equipe, recusado se o tipo dele estiver desligado. Nada é decidido onde a equipe está: algo prestes a acontecer ali fica para a cena resolver. As notícias viajam: o Game Master fica sabendo de uma mudança depois de passados os dias que as estradas levam, como um boato de longe, e vê o que está se formando por perto, para que a equipe possa intervir. Ele pode segurar uma guerra em formação só quando ela não faz sentido para o mundo ou arruinaria o jogo sem uma chance real de a equipe impedi-la. Os feitos da equipe contam mais à medida que ela fica conhecida: a ajuda de um estranho muda pouco, a de uma equipe famosa muda muito.

Um mundo também pode guardar **hand edits** (edições manuais). São mudanças que você faz com um editor de mundo, uma ferramenta que muda um mundo depois de ele ser feito. Você pode renomear ou mover lugares, pintar o terreno e acrescentar lugares e pessoas. Também pode pintar o campo de batalha tático de um lugar (veja [Game Mode: combate](combat.md#tactical-battles-and-terrain)) e dispor uma cidade à mão (veja [A cidade](map-time-weather.md#the-town)). Todas as partes do jogo veem as edições na hora: o Game Master, o overworld, as cidades e a aba World. Um lugar renomeado ainda responde pelo nome antigo, e o Game Master fica sabendo de como ele se chamava antes.

As edições manuais mudam o mundo daqui em diante, nunca o passado dele. A história do mundo, e as mudanças que ele fez sozinho, continuam como estavam. Um assentamento que você acrescenta fica como você o acrescentou. Uma cidade mantém a disposição dela, então os lugares e as pessoas que você acrescenta vão para os próximos lotes de construção livres e para as próximas casas livres.

Um mundo pode viajar como arquivo. **Download this world** (baixar este mundo), em **Your world**, salva o mundo que você está criando, e **Download the world** (baixar o mundo), na aba World de uma partida, salva o mundo dessa partida, com as edições manuais e tudo, como um arquivo `.world.json`. **Import a world file** (ao lado do kit de cenário) lê um arquivo na configuração de uma partida nova: ele escolhe o kit de cenário do arquivo e cria o mundo dele, com as edições manuais. **Your worlds** (os seus mundos) faz o mesmo com um mundo guardado na sua biblioteca, como um criado fora de qualquer partida com um criador como o Pixelforge.

Um arquivo de mundo também pode trazer a **story** (história) do mundo: os eventos e as cenas que um criador escreveu para ele. A história vem com o mundo e é mantida nas mesmas condições. Durante o jogo, as cenas de uma história aparecem na narração antes da resposta do Game Master, exatamente como foram escritas. Os objetivos de missão dela aparecem em **Story**, na aba World do diário, assim que a história os mostra. Para escrever uma, veja [Escrever roteiros de história de Game Mode](../extending/writing-story-scripts.md).

As edições manuais e a história foram feitas para aquela semente e aquele resumo, então ficam de fora se você mudar qualquer um dos dois. Se um arquivo não puder ser lido, ele é recusado e o assistente diz por quê. Um arquivo de mundo também leva o mundo como ele foi feito, então um mundo criado por outra versão do criador de mundos abre exatamente como foi feito. Um arquivo mais antigo sem isso é recusado. Se algo no arquivo não combinar com o kit de cenário, fica de fora e o assistente diz o quê.

Uma partida criada sem mundo antes de a escolha de Game Mode existir pode ganhar um depois, só se você quiser: a aba **World** do diário oferece **Make a world for this game** (criar um mundo para esta partida), com as mesmas opções de kit de cenário e de mundo de uma partida nova. O mundo começa no turno seguinte; os turnos passados, o mapa e as pessoas da partida continuam como estão. Enquanto o Overworld RPG não estiver pronto, o botão aparece esmaecido com o mesmo aviso da configuração.

Uma partida mantém o mundo como foi feito. Os lugares, as pessoas, as cidades e a história são salvos com a partida quando ela começa e sempre que as edições manuais dela são salvas, então uma atualização que muda o jeito como os mundos são feitos nunca muda um mundo que já está em jogo. Uma sessão nova, uma ramificação e um chat exportado mantêm o mesmo mundo, e o modo como o mundo seguiu nas sessões anteriores (as fortunas, os governantes e as guerras) é mantido como se desenrolou. Um mundo feito por uma versão anterior do gerador de mundos continua jogável como foi feito, mas não pode mais ser editado.

Uma partida com mundo abre no **overworld**, o mundo desenhado como um mapa de pixels onde você pode levar a equipe de assentamento em assentamento pelos caminhos do mundo e entrar na cidade em que ela está; a visualização da cena fica a um clique de distância. Veja [O overworld](map-time-weather.md#the-overworld).

<a id="the-gm-intro-message"></a>

### A mensagem de introdução do GM

**GM intro message** (mensagem de introdução do GM), na etapa **Party**, decide como a partida começa:

- **None** (nenhuma, o padrão): o Game Master abre a partida como achar melhor.
- **Defined** (definida): digite a primeira mensagem exatamente como ela deve ficar. A partida começa exatamente com essa mensagem, e gerá-la de novo dá o mesmo texto.
- **Guided** (guiada): descreva como a abertura deve ser, como onde ela começa, quem está lá e o que acontece primeiro. O Game Master escreve a abertura a partir disso.

O texto pode ter até 8.000 caracteres. Ele não pode conter chaves duplas, e o texto de **Guided** também não pode conter colchetes. O campo avisa quando o texto não pode ser usado. A história de um mundo pode trazer a própria introdução. Quando a história a trava, o campo a mostra com "Set by this Experience and locked, so the game opens as its creator meant." e ela não pode ser mudada.

### Padrões que vale conhecer

Estes são os valores iniciais das etapas **World**, **Party** e **Features**. Todos podem ser alterados.

| Configuração | Padrão | Observações |
|---|---|---|
| Genre | Fantasy | Escolha múltipla, mais as entradas que você criar; um kit de cenário escolhido antes define o próprio gênero |
| Tone | Heroic | Escolha múltipla |
| Difficulty | Normal | Casual, Normal, Hard ou Brutal; níveis mais altos tornam o combate mais implacável |
| Content Rating | SFW | SFW ou NSFW; NSFW apenas permite conteúdo adulto, não o obriga |
| Language | English | Todo o texto dentro do jogo é escrito nesse idioma |
| Game Master Mode | Standalone GM | Standalone GM monta um GM para você; Character GM usa um dos seus cards como GM |
| Visual Generation | Off | Ative para ter imagens; exige uma conexão de geração de imagens |
| Game Presentation | Standard | **Storyboard Optimized** usa o Storyboard Game Prompt para moldar a narração do GM; não instala nem ativa o agente Storyboard |
| Music DJ | Off | Exige o Spotify ou uma pasta de música local |
| Custom HUD Widgets | On | Usa widgets de status criados pela IA a partir do novo mundo |
| Start Muted | Off | Começa o jogo com o áudio no mudo |

É a sua primeira vez no Game Mode? Deixe **Game Master Mode** em **Standalone GM**. Marinara monta um GM justo e levemente irônico para você, e assim você conhece o modo antes de escrever um card de GM personalizado.

Escolha **Storyboard Optimized** na última etapa quando quiser os turnos do GM escritos como cenas visuais prontas para filmar. Essa opção seleciona o preset interno **Storyboard Game Prompt** para a narração do GM. Ela não instala nem ativa o agente Storyboard, não ativa a geração de imagens nem a de vídeos, não altera as conexões e não substitui os padrões de planejador e de formatador do agente. Depois de criar o Game, instale e ative o Storyboard à parte e ajuste as configurações de quadro-chave, planejador, imagem e vídeo em **Chat Settings > Agents > Storyboards**.

A combinação alternativa de plano único em estilo anime continua disponível depois da configuração: escolha **Anime Episode Director** no Animation Planner e **Anime Game Video** no Storyboard Video Prompt.

O editor **GM Prompt** mostra uma prévia do prompt em uso para a apresentação selecionada. Com **Storyboard Optimized** selecionado, abrir o editor exibe o Storyboard Game Prompt, junto com a macro de contagem de quadros-chave. Se você deixar esse texto como está, o preset interno continua selecionado; se editar, cria um prompt personalizado que passa por cima do preset da apresentação.

## Os três tipos de chamada de IA

Game Mode usa três tipos diferentes de chamada de IA. Conhecer os três ajuda a entender de onde vêm os custos e os erros.

1. **Geração do mundo.** Acontece uma única vez, quando você clica em **Start Game**. A conexão do GM devolve um documento grande e estruturado em um formato chamado JSON. Esse documento traz a visão geral do mundo, o mapa inicial, os NPCs, as fichas de personagem da equipe e os widgets que aparecem na tela. O JSON é um formato de texto rígido, que a IA precisa devolver exatamente certo, senão o jogo não consegue ler. Essa é a etapa mais exigente, e por isso a escolha do modelo pesa mais aqui.
2. **Turnos de jogo.** Cada mensagem enviada monta um prompt novo com o estado atual. Em seguida, o GM narra e atualiza o mundo. A matemática das rodadas de combate é calculada pelo motor, não pelo modelo, então os resultados saem justos e consistentes.
3. **Resumos de sessão.** Quando você encerra uma sessão, o GM escreve uma recapitulação estruturada e notas de continuidade. Quando você começa uma sessão nova, ele escreve uma mensagem curta de ligação para o próximo capítulo emendar direitinho. As sessões antigas são compactadas em resumos, para que campanhas longas não sobrecarreguem o modelo.

## Modos de destinatário: com quem você está falando

A barra de digitação tem um botãozinho de balão de fala ao lado do botão de anexar arquivos. A dica dele diz **Choose who to address**. Esse botão define para quem vai a sua mensagem, e tem três estados.

- Por padrão, a mensagem entra na cena. Ela vale como uma ação ou uma fala normal dentro do jogo. O GM e a equipe respondem dentro da história.
- **Talk to Party** acrescenta a marca `[To the party]` e fala diretamente com os companheiros. Use para conversa tática, do tipo "O que fazemos aqui?". Essa opção só aparece quando a equipe não está vazia.
- **Talk to GM** acrescenta a marca `[To the GM]` e fala com o GM fora do personagem. Use para perguntas como "Meu personagem sabe alguma coisa sobre o templo?" ou para pedidos de ritmo da história.

O modo ativo mostra uma marca **On** no menu. Para desativar **Talk to Party** ou **Talk to GM**, clique de novo nessa mesma entrada do menu. As mensagens voltam a entrar na cena.

<a id="optional-tool-planning-and-lore-searches"></a>

## Planejamento opcional de ferramentas e buscas de lore

Durante o jogo, abra **Chat Settings → Function Calling** (configurações do chat → chamadas de função). **Let the GM search lore** (permitir que o GM busque lore) permite buscar informações pelo significado sem ativar todas as outras ferramentas opcionais. Primeiro ative a vetorização dos lorebooks relevantes e vetorize suas entradas. As buscas respeitam os livros e as pastas ativados e os controles de entradas específicos do chat. Elas usam a conexão de embeddings configurada e podem acrescentar uma solicitação de continuação ao modelo.

Os chats Game exigem **Let the GM search lore** para consultas a lorebooks por ferramentas, mesmo com **Enable Tool Use** ativado. Enquanto a opção estiver desativada, `search_lorebook` fica indisponível no seletor de ferramentas. Uma entrada já selecionada continua visível com uma explicação para que você possa removê-la ou reativar a pesquisa de lore.

**Game tool connection** (conexão de ferramentas do jogo) usa **Same as narrator** (a mesma do narrador) por padrão, mantendo o ciclo normal de ferramentas. Escolher outra conexão executa uma única solicitação de planejamento separada antes da narração. Esse modelo escolhe as ferramentas, e o narrador recebe os resultados reais como texto. A solicitação adicional é cobrada na conexão selecionada; um modelo mais barato pode reduzir o custo das ferramentas, mas escolher ferramentas diferentes. Esse único passo de planejamento não pode encadear uma segunda busca a partir do primeiro resultado. Use **Same as narrator** quando quiser que o narrador raciocine ao longo de várias rodadas de ferramentas (até quatro por turno; depois disso, ele narra com os resultados que tiver).

As conexões de assinatura Claude e Grok não aceitam chamadas nativas de ferramentas. Os controles afetados explicam isso e ficam desativados até que uma conexão compatível para ferramentas de Game seja selecionada. Comandos de texto e tags de dados continuam funcionando. Se uma conexão separada estiver ausente ou sua solicitação falhar, o turno informa a falha em vez de narrar silenciosamente sem o trabalho solicitado às ferramentas.

**Finish rolled turns in one request** (Terminar turnos com dados em uma solicitação) muda o segundo tipo de chamada descrito acima. Um turno com rolagens normalmente custa duas solicitações: o rascunho e uma reescrita com os números reais. Com a opção ativa, o GM escreve o desfecho às cegas e o motor preenche os números depois, então o turno custa uma solicitação. Ela fica desativada por padrão. Duas coisas ainda acrescentam outra solicitação: chamar a ferramenta de dados com **Enable Tool Use** ativo e uma **Game tool connection** separada, que sempre faz seu próprio planejamento. Veja [Game Mode: Dados e testes de habilidade](dice-and-skill-checks.md#finishing-a-rolled-turn-in-one-request).

Se os modelos locais compartilham pouca memória de GPU, abra **Chat Settings → Agents** e ative **Run Game tasks one at a time** (executar tarefas Game uma por vez). Narração, agentes e mídia de cena aguardam uns pelos outros dentro desse chat Game. A opção começa desativada e não reserva a GPU contra outros chats ou aplicativos. Os controles de cancelamento existentes continuam disponíveis durante a execução e a espera.

## Ativar os agentes

Os agentes são ajudantes de IA opcionais que rodam junto com o GM. Para usá-los em um jogo, abra **Chat Settings** (configurações do chat) durante a partida, vá até a seção **Agents** e ative **Enable Agents**. Manter agentes rodando aumenta o custo, porque eles fazem chamadas extras.

Dois agentes valem destaque no Game Mode:

- **Game Session Keeper** ajuda a manter a continuidade entre as sessões.
- **Music DJ** escolhe a música de fundo. Ele precisa do Spotify ou de uma pasta de música local.

Game Mode também usa **Review Agent Outputs** para você conferir o que cada agente produziu. Para o panorama completo dos agentes, veja [Agentes: ajudantes de IA para os seus chats](../agents/agents-overview.md).

## Escolher um modelo

A geração do mundo é a parte mais difícil do Game Mode. Ela pede ao modelo um documento JSON longo e rígido, sem nenhum campo faltando. Um modelo que se sai bem em um chat comum pode falhar nessa etapa.

Para a geração do mundo, use um modelo de ponta, atual e capaz, em uma conexão paga. Em 2026, os jogadores relatam bons resultados com os modelos de topo dos principais provedores. Alguns exemplos: Anthropic Claude, OpenAI GPT e Google Gemini. Os nomes específicos mudam com frequência, então trate isso como exemplo, não como uma lista fixa.

Nos turnos de jogo do dia a dia, às vezes é possível descer para um modelo mais barato, porque os turnos pedem narração, e não JSON rígido. Se o GM começar a esquecer NPCs ou a contradizer detalhes anteriores, volte para um modelo mais forte.

Evite modelos gratuitos ou de roteamento automático para a geração do mundo. Eles podem cair em um modelo menor, incapaz de produzir um JSON de mundo válido. Modelos abertos pequenos também costumam falhar nessa etapa.

Para a referência completa dos parâmetros, veja [Parâmetros de geração](../prompts/generation-parameters.md).

<a id="the-games-controls"></a>

## Os controles do jogo

No computador, os controles do jogo abrem pelos botões perto do canto superior direito do chat. No celular, eles ficam no menu móvel de três pontos **Chat tools** (ferramentas do chat):

- **Game controls** (o controle de videogame):
  - **Retry turn**, **Retry scene analysis**, **Retry Music DJ** quando o Music DJ toca a música do jogo, e **Retry assets image generation**.
  - Quando um storyboard toca como fundo do jogo, também há repetir, reproduzir/pausar e silenciar.
  - Em uma partida com mundo, **Show the scene** (mostrar a cena) e **Show the overworld** (mostrar o overworld) alternam as visualizações, e **Show the map** (mostrar o mapa) volta para um mapa aberto de masmorra, caverna ou estação.
  - **Edit game data** (editar dados do jogo) corrige à mão os dados salvos da partida (veja [Editar os dados do jogo à mão](sessions-and-saves.md#editing-game-data-by-hand)), e **Checkpoints** leva a partida de volta a um momento anterior (veja [Como o jogo salva](sessions-and-saves.md#how-your-game-saves)).
- **Session** (a pena): histórico de sessões, diário e controles de sessão. Veja [Game Mode: sessões e saves](sessions-and-saves.md).
- **Volume** (o alto-falante): volume de **Master**, **Music**, **Sound Effects**, **TTS** e **Ambient**.
- **Game Assets** (a pasta): mídias de cena e Asset Browser. Veja [Recursos do jogo](game-assets.md).
- **Connected chat**, quando o jogo está ligado a uma Conversation. Veja [Chats conectados](../chats/connected-chats.md#switching-between-connected-chats).

Escolha uma ferramenta para abrir os controles dela em uma janela móvel no computador ou em um painel de largura total no celular. No computador, arraste o botão dela para movê-lo. No celular, mova o menu de três pontos, ou destrave-o para reordenar as ferramentas lá dentro. Fechar a janela ou o painel deixa você abrir a ferramenta de novo no mesmo lugar. Veja [Janelas de controles e seus botões](../chats/chat-settings.md#control-windows-and-their-buttons).

Você também pode guardar esses controles dentro de **Chat Settings**. Abra a janela de um controle e escolha **Put back in Chat Settings**; ele passa a aparecer ali como uma seção expansível. O botão para destacar a seção a transforma de novo em uma janela separada. Cada jogo salva a sua escolha, e **Reset View** restaura a disposição inicial: botões no computador, ou entradas de Chat tools no celular.

**Character Profiles** (perfis dos personagens) fica fora de Chat tools, tanto no computador quanto no celular. Arraste o botão de retrato dele para onde quiser e depois abra-o para escolher um integrante da equipe e ver ou editar a ficha de personagem dele. No celular, **Map** (mapa) também tem o próprio botão móvel. Os dois seguem o estilo de widget do seu chat, salvam as posições para esta partida e podem ser travados pela janela aberta. O mapa do computador mantém os controles atuais do painel de mapa.

## Onde fica cada assunto do jogo

Este guia coloca você dentro de um jogo. Cada assunto mais aprofundado tem o guia próprio:

- [Game Mode: combate](combat.md) trata dos encontros, do menu de ações, da matemática do dano e dos eventos de tempo limitado.
- [Game Mode: equipe e NPCs](party-and-npcs.md) trata dos Character Profiles, das fichas de personagem e do Adventure Journal.
- [Game Mode: sessões e saves](sessions-and-saves.md) trata de encerrar e começar sessões e do histórico de sessões.
- [Game Mode: mapa, tempo e clima](map-time-weather.md) trata das visualizações do mapa e do relógio e clima automáticos.
- [Game Mode: dados e testes de perícia](dice-and-skill-checks.md) trata do menu de dados e das regras dos testes de perícia.
- [Game Mode: widgets do HUD](hud-widgets.md) trata dos widgets de status que aparecem na tela.
- [Recursos do jogo](game-assets.md) trata da biblioteca de músicas, sons, sprites e planos de fundo.
- [Guia do agente Storyboard](storyboard.md) trata da instalação e dos Storyboards no Roleplay e no Game Mode.

As Author's Notes funcionam aqui do mesmo jeito que nos outros modos. Veja [Roleplay Mode: primeiros passos](../roleplay/getting-started.md).

## Solução de problemas

### A geração do mundo falha com erro de JSON ou 422

A causa mais comum é o modelo não ter conseguido produzir o JSON estruturado inteiro. Tente o seguinte, nesta ordem.

1. Confira qual conexão o GM está usando. Se ela aponta para um modelo gratuito ou de roteamento automático, troque por um modelo pago e capaz.
2. Tente de novo. Algumas falhas são pontuais, e a mesma configuração funciona na segunda tentativa.
3. Encurte um campo de cenário ou de preferências muito longo. Entradas longas deixam menos espaço para o modelo escrever o JSON de saída.

Se a chamada quase deu certo e o JSON saiu só um pouco quebrado, Marinara oferece a janela **Repair JSON**. Ela abre um editor com números de linha e a saída bruta do modelo. Uma linha de status informa se o JSON está válido ou mostra o erro de leitura. Clique em **Format** para organizar um JSON válido. Depois, clique em **Apply Repaired JSON** para usar a versão corrigida sem pagar por uma nova tentativa completa. A opção **Repair JSON** também aparece nos resumos de sessão e em outras chamadas estruturadas.

Para mais sintomas e soluções, veja [Solução de problemas do Marinara Engine](../TROUBLESHOOTING.md).

### O GM narra de forma alegre mesmo com o tom sombrio que você escolheu

Alguns modelos permanecem animados independentemente do tom. Você tem duas opções. Acrescente uma instrução clara no campo de preferências do assistente, como "mantenha a narração sombria, não suavize os fracassos". Ou troque por um modelo cuja voz padrão combine com o tom que você quer.

## Guias relacionados

- [Game Mode: combate](combat.md)
- [Game Mode: equipe e NPCs](party-and-npcs.md)
- [Game Mode: sessões e saves](sessions-and-saves.md)
- [Game Mode: mapa, tempo e clima](map-time-weather.md)
- [Game Mode: dados e testes de perícia](dice-and-skill-checks.md)
- [Game Mode: widgets do HUD](hud-widgets.md)
- [Recursos do jogo](game-assets.md)
- [Guia do agente Storyboard](storyboard.md)
- [Roleplay Mode: primeiros passos](../roleplay/getting-started.md)
- [Conectando a um provedor de IA](../connections/connecting-to-a-provider.md)
- [Agentes: ajudantes de IA para os seus chats](../agents/agents-overview.md)
- [Parâmetros de geração](../prompts/generation-parameters.md)
- [Solução de problemas do Marinara Engine](../TROUBLESHOOTING.md)
