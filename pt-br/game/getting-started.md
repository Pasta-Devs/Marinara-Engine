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

1. **Connection.** Defina o nome do jogo, escolha a conexão do GM e, se quiser, uma conexão para os efeitos de cena. Os efeitos de cena usam **Local Model (Gemma)** por padrão.
2. **World.** Defina o gênero, o cenário, o tom, a dificuldade, a classificação de conteúdo e o idioma.
3. **Party.** Escolha a persona (o personagem que você interpreta), o **Game Master Mode** e os integrantes da equipe.
4. **Goals.** Conte ao GM o que você espera da aventura.
5. **Lorebooks.** Anexe os lorebooks cujos fatos o GM deve tratar como cânone. O lorebook é um conjunto de fatos do seu mundo. Veja [Visão geral dos lorebooks](../lorebooks/overview.md).
6. **Features.** Ative sistemas opcionais como Visual Generation, Music DJ e widgets do HUD. Os agentes instaláveis podem ser ativados em Chat Settings depois que o Game é criado.
7. **GM.** Escolha o estilo de apresentação e revise as instruções avançadas do GM antes de o mundo ser criado.

Ao terminar, clique em **Start Game**.

### Padrões que vale conhecer

Estes são os valores iniciais das etapas **World**, **Party** e **Features**. Todos podem ser alterados.

| Configuração | Padrão | Observações |
|---|---|---|
| Genre | Fantasy | Escolha múltipla, mais as entradas que você criar |
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

## Planejamento opcional de ferramentas e buscas de lore

Durante o jogo, abra **Chat Settings → Function Calling** (configurações do chat → chamadas de função). **Let the GM search lore** (permitir que o GM busque lore) permite buscar informações pelo significado sem ativar todas as outras ferramentas opcionais. Primeiro ative a vetorização dos lorebooks relevantes e vetorize suas entradas. As buscas respeitam os livros e as pastas ativados e os controles de entradas específicos do chat. Elas usam a conexão de embeddings configurada e podem acrescentar uma solicitação de continuação ao modelo.

**Game tool connection** (conexão de ferramentas do jogo) usa **Same as narrator** (a mesma do narrador) por padrão, mantendo o ciclo normal de ferramentas. Escolher outra conexão executa uma única solicitação de planejamento separada antes da narração. Esse modelo escolhe as ferramentas, e o narrador recebe os resultados reais como texto. A solicitação adicional é cobrada na conexão selecionada; um modelo mais barato pode reduzir o custo das ferramentas, mas escolher ferramentas diferentes. Esse único passo de planejamento não pode encadear uma segunda busca a partir do primeiro resultado. Use **Same as narrator** quando quiser que o narrador raciocine ao longo de várias rodadas de ferramentas.

As conexões de assinatura Claude e Grok não aceitam chamadas nativas de ferramentas. Os controles afetados explicam isso e ficam desativados até que uma conexão compatível para ferramentas de Game seja selecionada. Comandos de texto e tags de dados continuam funcionando. Se uma conexão separada estiver ausente ou sua solicitação falhar, o turno informa a falha em vez de narrar silenciosamente sem o trabalho solicitado às ferramentas.

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

## Onde fica cada assunto do jogo

Este guia coloca você dentro de um jogo. Cada assunto mais aprofundado tem o guia próprio:

- [Game Mode: combate](combat.md) trata dos encontros, do menu de ações, da matemática do dano e dos eventos de tempo limitado.
- [Game Mode: equipe e NPCs](party-and-npcs.md) trata da barra da equipe, das fichas de personagem e do Adventure Journal.
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
