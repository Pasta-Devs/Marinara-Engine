# Partidas Overworld (ainda não lançadas)

Notas apenas para desenvolvedores. As partidas **Overworld** (kits de cenário, mundos gerados, mapa do overworld, cidades e mapas de masmorras) ainda não estão implementadas para os jogadores. Nada aqui é documentação de usuário: a Professor Mari e a página Docs do aplicativo não leem `docs/development` (fora os poucos guias que listam), então mantenha o material de Overworld neste arquivo até o modo ser lançado. Quando isso acontecer, mova estas seções de volta para os guias de jogadores em `docs/game/`.

O modo fica bloqueado a menos que o servidor defina esta opção. Não a documente em `docs/CONFIGURATION.md` nem em `.env.example` enquanto o modo estiver inacabado.

| Variável | Padrão | Descrição |
| --- | --- | --- |
| `MARINARA_OVERWORLD_GAMES` | `false` | Permite que os jogadores criem partidas Overworld (um kit de cenário e um mundo gerado) e transformem uma partida antiga em uma delas. Desligado, o assistente oferece só partidas VN. |

## Configuração: modo de jogo, kit de cenário e mundo

### VN ou Overworld

Uma partida nova é jogada em um de dois modos de jogo, escolhido na primeira etapa e mantido em todas as sessões da partida:

- **Overworld** é um mundo feito para o seu cenário, percorrido em um mapa de overworld, com cidades, lugares para explorar e masmorras. Ele precisa de um kit de cenário e de um mundo. Até você escolher um kit, o do seu primeiro gênero é usado (High fantasy se o gênero não tiver um), e um mundo é sorteado para ele.
- **VN** é o Game Mode como sempre foi, contado como uma visual novel: cena a cena, com o mapa de cena e as batalhas, e sem kit de cenário, mundo, overworld, cidades ou mapas de masmorra.

Overworld fica travado, a menos que o dono do servidor defina `MARINARA_OVERWORLD_GAMES`. Enquanto estiver travado, o cartão aparece esmaecido com o aviso "Os jogos Overworld, com kit de cenário e mundo gerado, ainda não estão prontos. Os novos jogos começam como jogos VN." Toda partida nova é então uma partida VN, e as opções de kit de cenário e de mundo não aparecem. Uma partida criada antes de essa escolha existir continua jogando como antes: com um mundo, é uma partida Overworld; sem mundo, é uma partida VN.

### Escolher um kit de cenário

Um **Kit de cenário** dá ao GM as palavras em que o seu tipo de mundo é escrito: os nomes dos lugares e os tamanhos dos assentamentos, os tipos de grupo, como as pessoas viajam, os nomes para um ano e um dia, como os povos dão nome a si mesmos, o dinheiro e as mercadorias, os elementos, os lugares de batalha e qual família de arte e música ele usa (veja [Recursos do jogo](#art-and-music-families)). Ele também diz quais tipos de mudança o mundo permite, como rivalidades, crimes, guerras ou desastres, e com que rapidez ele muda. Um tipo desligado nunca entra, então uma briga pode continuar sendo só uma briga.

Há oito kits: alta fantasia, wuxia e xianxia, dias atuais, sobrenatural moderno, anos 1920, cyberpunk, space opera e pós-apocalíptico. O de dias atuais é tranquilo por padrão, sem crime, conflito ou catástrofe, em ritmo lento.

- Escolher um kit antes de um gênero define o gênero que combina com ele. Um gênero que você mesmo escolheu continua como está.
- **Escrever para o meu cenário** pede ao seu modelo do GM que reescreva o kit para o seu gênero, cenário e tom. Se o resultado não fizer sentido como um todo, o modelo recebe mais um pedido com os motivos. Se ainda falhar, o assistente diz o que estava errado e mantém o kit que você tinha.
- **Mudar as palavras** abre todas as palavras do kit. Digite uma lista em uma linha, separada por vírgulas. Um kit com um problema, como um nome vazio ou nenhum assentamento, diz o que está errado, e a partida não pode começar até isso ser corrigido.
- **Baixar este kit** salva um arquivo `.worldkit.json` para compartilhar. **Importar um arquivo de kit** lê um de volta.

A partida mantém o kit com que foi criada, e um arquivo de configuração compartilhado o leva junto. Uma Experience pode trazer o próprio pacote de mapas (um kit, mapas prontos e tiles). Com essa Experience ligada, a configuração mostra o kit dela como definido e, se ela traz mapas, um **Mapa** para escolher. Desligar a Experience devolve as suas escolhas.

### Criar um mundo

Com um kit escolhido, **O seu mundo** monta um mundo nas palavras do kit antes de a partida começar: as regiões, os assentamentos de todos os tamanhos, pelo que cada lugar é conhecido e os caminhos entre eles (estradas, rios, rotas marítimas, rotas de salto), com o tempo de cada viagem em dias.

Um mundo vem de uma **Semente do mundo**. A mesma semente, o mesmo kit e o mesmo resumo sempre fazem o mesmo mundo. **Sortear** dá outro, e digitar um número de volta traz um mundo de volta. A prévia mostra um mapa pequeno do terreno e dos assentamentos, o lugar onde a equipe começa e uma lista dos assentamentos por região.

- **Começar por este lore** lê os lorebooks marcados em busca dos lugares e dos eventos datados que eles registram, mantidos exatamente como estão escritos. **Construir em volta do lore** preenche o mundo ao redor deles. **Só os lugares do lore** não cria nada além deles.
- **Escrever o resumo do mundo** pede ao seu modelo do GM o presente, os lugares principais, os grupos em torno dos quais o presente gira (o que cada um quer, quem são os aliados e os rivais dele) e nomes para os lugares e as pessoas no som próprio de cada povo. Os lugares do lore são mantidos, seja o que for que o modelo escreva. Tudo o que não combina com o kit fica de fora e é contado. **Mudar o resumo** abre as palavras dele, inclusive os nomes e sobrenomes de cada povo. Sem um resumo, os lugares ficam numerados e as pessoas são chamadas pelo ofício.

**Um mundo tem um passado.** Antes de a partida começar, o mundo avança ano a ano desde a fundação. Os assentamentos crescem, os grupos são fundados, ganham e perdem líderes e se aproximam ou brigam entre si. Onde o mundo os tem, bandidos, guerras e fomes deixam marcas. Uma mudança grave só vem depois de se formar por um tempo, e só nos tipos que o kit permite. Os eventos datados do seu lore ou do resumo acontecem quando e onde dizem. A mesma semente e o mesmo resumo dão o mesmo passado.

**O que o GM sabe.** O GM sempre sabe onde a equipe está, para onde pode ir e quanto tempo leva cada caminho. Ele fica sabendo dos eventos mais marcantes do passado, de quem lidera o lugar atual e da história desse lugar. Sobre qualquer outro lugar ou grupo, ele pode perguntar e recebe a resposta no turno seguinte. Ele indica para onde a equipe vai com uma tag de lugar. Um lugar que o mundo lista mantém o tamanho que o mundo lhe deu. Um lugar que o mundo não lista, como uma casa de fazenda, mantém o nome que o GM lhe dá. Cada assentamento tem pessoas sorteadas pela semente quando a equipe chega: um nome da própria cultura, um ofício que combina com o lugar, um temperamento, um jeito de falar e uma aparência. Quando o GM nomeia alguém por completo, essa pessoa entra nos personagens acompanhados.

**O que a equipe faz fica feito.** Quando a equipe ajuda ou atrapalha um grupo, muda o que dois grupos sentem um pelo outro, toma ou arruína um lugar ou põe alguém à frente de um grupo, o GM registra isso na resposta. Cada mudança é conferida com o mundo. Uma mudança de um tipo que o kit tem desligado, ou que cita um lugar ou grupo que o mundo não tem, é recusada. Dali em diante, o GM fica sabendo do mundo como a história o deixou. Um lugar que a história acrescentou é um lugar para onde a equipe pode ir. Um swipe, uma nova geração ou uma mensagem excluída desfaz a mudança junto com a resposta dela.

**O mundo segue sem a equipe.** Quando o GM diz que o tempo passa, o mundo avança uma semana de cada vez, só nos tipos de mudança que o kit tem. Catástrofes nunca vêm sozinhas: só o GM pode narrar uma, e ela é recusada se o tipo dela estiver desligado. Nada é decidido onde a equipe está. As notícias viajam: o GM fica sabendo de uma mudança distante depois de passados os dias que as estradas levam. Os feitos da equipe contam mais à medida que ela fica conhecida.

**Edições manuais.** Em um editor de mundo, você pode renomear ou mover lugares, pintar o terreno, acrescentar lugares e pessoas, pintar o campo de batalha tático de um lugar (veja [Game Mode: combate](../game/combat.md#tactical-battles-and-terrain)) e dispor uma cidade (veja [A cidade](#the-town)). Todas as partes do jogo veem as edições na hora. Um lugar renomeado ainda responde pelo nome antigo. As edições mudam o mundo daqui em diante, nunca o passado dele. Uma cidade mantém a disposição dela, então os lugares e as pessoas que você acrescenta vão para os próximos lotes e casas livres.

**Arquivos de mundo.** **Baixar este mundo**, em **O seu mundo**, salva o mundo que você está criando, e **Baixar o mundo**, na aba World de uma partida, salva o mundo dessa partida, com as edições manuais, como um arquivo `.world.json`. **Importar um arquivo de mundo**, ao lado do kit de cenário, lê um arquivo na configuração de uma partida nova: ele escolhe o kit do arquivo e cria o mundo dele. **Os seus mundos** faz o mesmo com um mundo da sua biblioteca. Um arquivo também pode trazer a história do mundo: os eventos e as cenas que o criador dele escreveu. As cenas de uma história aparecem na narração antes da resposta do GM, exatamente como foram escritas, e os objetivos de missão dela ficam listados em **História**, na aba World do diário. Para escrever uma, veja [Escrever roteiros de história de Game Mode](writing-story-scripts.md). As edições manuais e a história pertencem àquela semente e àquele resumo, então ficam de fora se você mudar qualquer um dos dois. Um arquivo que não pode ser lido é recusado, e o assistente diz por quê. Um arquivo cujo conteúdo não combina com o kit fica em parte de fora, e o assistente diz o quê.

**Mais tarde e salvo.** Uma partida criada sem mundo pode ganhar um depois, pela aba **Mundo** do diário, com **Criar um mundo para esta partida**. O mundo começa no turno seguinte, e os turnos passados, o mapa e as pessoas continuam como estão. O botão fica esmaecido enquanto o Overworld RPG estiver travado. Uma partida mantém o mundo como foi feito, então uma sessão nova, uma ramificação e um chat exportado mantêm o mesmo mundo. Um mundo feito por uma versão anterior do gerador continua jogável, mas não pode mais ser editado.

Uma partida com mundo abre no **overworld**, um mapa de pixels onde você leva a equipe de assentamento em assentamento e entra nas cidades. Veja [O overworld](#the-overworld).

## Mapas

### O overworld

Uma partida com mundo gerado (veja [Criar um mundo](#making-a-world)) abre no **overworld** (o mapa do mundo): o terreno do mundo desenhado como um mapa de pixels atrás da narração, com florestas, colinas, litorais e mares, as estradas e rotas entre os assentamentos, cada assentamento desenhado de acordo com o tamanho, e a sua equipe. Os lugares maiores aparecem com nome, assim como aquele onde você está. Arraste o mapa para olhar em volta.

1. Toque ou clique em um assentamento, ou escolha-o em **Lugares** (os mais próximos primeiro, com o tempo do caminho).
2. Confira o tamanho dele e a viagem desde onde você está: dias ou horas, e por quais rotas.
3. Clique em **Ir até lá**. A equipe segue pelas rotas do mundo pelo caminho mais rápido, e os dias da caminhada passam no relógio de uma vez.

O seu próximo turno conta ao GM para onde você foi, quanto tempo levou e por quais rotas, para que ele narre a chegada. Uma segunda caminhada antes do seu próximo turno continua de onde a primeira terminou.

Cavernas, minas, criptas e ruínas a poucos passos de um assentamento aparecem como **sítios**. Um mundo novo tem um ou dois em cada região, com o nome do assentamento ao lado deles ("Hollin Caves", "Ashby Ruins"). **Ir até lá** segue pelas rotas até o assentamento do sítio e depois sai da estrada, a pé. Em um sítio, **Entrar** abre o mapa dele (veja [Masmorras, cavernas e estações](#dungeons-caves-and-stations)). Um sítio importante para a história fica **fechado** (esmaecido, sem viagem e sem entrada) até o GM abri-lo. Um criador de mundos também pode esconder um sítio até esse momento ou deixá-lo aberto desde o início.

Um lugar em ruínas é desenhado em ruínas. Depois que escurece, o mapa fica mais escuro e as janelas se acendem. Cada família de cenário (fantasia, wuxia, dias atuais, anos 1920, ficção científica, terra devastada) tem os seus próprios tiles. Um kit sem família desenha tiles simples.

Para alternar entre as visualizações, use **Mostrar a cena** e **Mostrar o mapa do mundo** em **Controles do jogo**, que no celular fica no menu de três pontos **Ferramentas do chat**. O jogo lembra a sua escolha. Uma luta e a repetição de uma sessão usam telas próprias.

### Pacotes de tiles

Os pacotes de tiles guardam a paleta e cada tile (cada tipo de terreno, os assentamentos por tamanho, a equipe e as ruas, os telhados e os moradores de uma cidade) como linhas de pixels. Cada família de cenário tem um pacote embutido. Abra o painel **Agentes** e encontre **Pacotes de tiles** para:

- escolher com qual pacote cada cenário é desenhado (**Embutido** é o pacote do próprio cenário),
- **Importar um pacote de tiles** de um arquivo `.tilepack.json`,
- **Exportar** um pacote para compartilhá-lo, ou **Remover** um pacote, o que faz todo cenário desenhado com ele voltar aos próprios tiles.

Um pacote só precisa dos tiles que ele muda, e o que ficar de fora é desenhado de forma simples. Um pacote que cita um tile que Marinara não desenha mantém o resto e diz o que deixou de fora.

### A cidade

Em um assentamento, escolha-o no overworld e escolha **Entrar** para ver a cidade. Ela é disposta a partir do mundo: ruas e uma praça, os lugares que o mundo ou a história colocaram nela (com o nome nos prédios), um salão em um lugar maior, locais de trabalho dos ofícios pelos quais o lugar é conhecido e casas. As pessoas estão onde a hora as coloca: no trabalho de dia, na praça ao entardecer, em casa à noite.

Escolha um prédio ou a praça, ou escolha em **Lugares da cidade**, para ver quem está lá e a quantos minutos fica. **Ir até lá** atravessa a cidade pelas ruas, contornando os prédios e tudo o que uma disposição manual pintou, passando pelas pontes dela. Os minutos passam no relógio, e o seu próximo turno conta ao GM para onde a equipe foi e quem está lá. Visitar um lugar com nome, como uma estalagem que a história acrescentou, faz dele o lugar atual da equipe. **Sair da cidade** volta para o overworld. O jogo lembra em qual visualização você estava.

Uma cidade pode ser **disposta à mão** com um editor de mundo como o Pixelforge, como parte das edições manuais do mundo.

- Os prédios podem ser movidos para outros lotes. Um prédio movido para o lote de outro troca de lugar com ele, e todo prédio continua de frente para uma rua.
- O chão pode ser pintado com ruas, calçamento, terreno aberto, árvores ou um poço, mas nunca embaixo de um prédio, diante da porta dele, no meio da praça ou embaixo de uma barraca do mercado.
- Quem mora e trabalha onde nunca muda, e uma caminhada até um prédio movido é contada a partir da nova porta.
- O editor recusa uma disposição que não cabe na cidade e diz o motivo. Os lugares que a história acrescenta durante o jogo continuam encontrando um lote.
- Uma disposição também pode colocar prédios fora dos lotes, pintar campos, trilhas de terra, água com pontes e cercas vivas, e espalhar decorações. A visualização da cidade desenha tudo isso (as decorações, só com um pacote de imagens que as tenha).

### Masmorras, cavernas e estações

Quando a história desce para o subsolo ou embarca em algum lugar, o GM pode abrir um **mapa do lugar**: uma masmorra, caverna ou estação, desenhada sobre a cena. Ele é disposto a partir do jogo e do nome do lugar, então o mesmo lugar sempre tem as mesmas salas, e voltar a ele mantém o mapa como estava. O GM escolhe o visual entre onze: cavernas de rocha, de gelo, de cristal e de lava; uma cripta, um esgoto e um templo; e os corredores, o laboratório, o deck de motores e a hidroponia de uma estação. Com um pacote de tiles para esse visual, o mapa usa a arte dele. Sem um, ele fica em cores simples.

Um lugar da cidade onde a equipe pode descer (uma caverna, mina, cripta, esgoto ou ruína, pelo nome, ou, na ficção científica, uma nave abandonada ou um bunker) mostra **Descer** quando a equipe está lá.

- Ele abre o mesmo mapa toda vez, e sair devolve a equipe à cidade.
- Enquanto a equipe está em outro mapa, saia desse primeiro.
- Um lugar também pode ter um mapa feito à mão com um editor de mundo como o Pixelforge. **Descer** então abre esse mapa, seja qual for o nome do lugar, desenhado com o pacote que ele indica. Em um mapa assim, a saída fica onde a equipe entrou, os objetos de cenário nunca bloqueiam o caminho, e as pessoas ficam nos pontos com nome nas horas que o mapa define. O GM fica sabendo quem está lá.

Clique em um lugar do mapa, ou use as setas do teclado, para ir até lá pelo caminho mais curto. Os minutos passam no relógio (cerca de um minuto a cada trinta passos), e o seu próximo turno conta ao GM de qual área a equipe saiu e para qual foi. O rótulo no topo diz qual é a área atual. **Mostrar a cena** e **Mostrar o mapa** em **Controles do jogo** alternam entre a cena e o mapa.

Para sair, volte até a saída (escada, escada de mão ou alçapão) e escolha **Sair**. O GM também pode encerrar o mapa quando a história sai do lugar. Regenerar um turno que abriu um mapa, andou nele ou saiu dele devolve o mapa ao estado de antes desse turno.

## Tempo

Em um jogo com mundo, o tempo também passa sozinho:

- Enquanto o overworld está na frente e o jogo espera por você, um minuto de jogo passa a cada cinco segundos reais. Ele para enquanto o GM escreve, antes de você ler a resposta dele, enquanto a visualização da cena está na frente e enquanto o aplicativo está em segundo plano.
- Uma caminhada no overworld faz passar os dias que a rota leva.
- Quando o Game Master (GM) diz que dias se passam (uma jornada, um descanso longo, uma espera), o relógio avança esses dias. Uma resposta regenerada não o move de novo. Defina o dia manualmente se a nova narração levar um tempo diferente.

## Combate

### Elementos

Quais elementos existem depende do cenário:

- Sem kit de cenário, ou com um kit que não nomeia nenhum: os seis clássicos (fogo, gelo, raio, veneno, sagrado, sombra).
- Wuxia: as cinco fases (madeira, fogo, terra, metal, água), cada uma superando a seguinte.
- Cyberpunk e space opera: cinético, térmico, EM e químico ou plasma.
- Dias atuais e anos 1920: nenhum.

Chuva e tempestades em terreno aberto enfraquecem os elementos parecidos com fogo e fortalecem os parecidos com raio. Em uma luta tática, um elemento bate mais forte contra um que ele supera e mais fraco contra um que o supera. Você pode mudar os elementos e as reações de um kit em **Mudar as palavras**. Veja [Escolher um kit de cenário](#choosing-a-setting-kit).

### Loot

O que cai depende do seu cenário. Uma partida com kit de cenário deixa o loot do próprio kit (uma partida de dias atuais deixa um vale-presente ou um kit de primeiros socorros, nunca uma espada encantada), e você pode mudar essas palavras em **Mudar as palavras**. Uma partida sem kit deixa o que o gênero dela costuma ter. Um gênero sem kit inicial, como Steampunk, deixa coisas simples que não pertencem a nenhum cenário. Em uma partida cujo conjunto de regras tem tabelas de loot próprias, os inimigos deixam os itens do conjunto, e um conjunto de regras que desativa os itens próprios do Game Mode deixa só os dele.

### Campos de batalha feitos à mão

Um mundo também pode ter campos de batalha feitos à mão: tabuleiros pintados casa por casa para um dos lugares dele, com um editor de mundos como o Pixelforge. Quando uma luta começa nesse lugar, ou dentro dele, ela usa um desses tabuleiros em vez de um gerado.

- O tabuleiro é usado exatamente como foi pintado. Se o lugar tiver vários, a semente da luta (um número que escolhe um deles) decide.
- A descrição de terreno do GM não é usada nesse caso, mas a formação dele continua decidindo onde cada lado começa. O GM fica sabendo que o tabuleiro foi feito para esse lugar.
- Um tabuleiro feito à mão precisa seguir três regras: ele tem um dos três tamanhos de tabuleiro, as duas colunas de cada lado são planícies, onde os lados se posicionam, e toda casa em que um combatente pode ficar se conecta ao resto. O criador recusa um tabuleiro que quebre uma regra e diz por quê.

Esses tabuleiros ficam guardados com as edições manuais do mundo, então viajam em arquivos de mundo, pacotes de mapa e na biblioteca.

### Cenas de campo de batalha

Uma partida com kit de cenário nomeia as próprias cenas com as palavras dele, então uma luta cyberpunk acontece em um terraço ou em um corredor de megabloco, e uma luta wuxia em uma floresta de bambu ou em uma casa de chá. As casas do tabuleiro também usam as palavras do cenário (cobertura e destroços em vez de floresta e ruínas). Você pode mudar as cenas e as palavras das casas de um kit em **Mudar as palavras**.

## Journal, dinheiro e sessões

A aba **Mundo** mostra onde vocês estão e quanto a equipe é conhecida, a posição dela com cada grupo, o que ela já fez, as notícias que chegaram até ela (os boatos vêm marcados), os problemas que estão se formando e de que ela ouviu falar, e o passado que qualquer morador contaria. Ela mostra só o que a equipe poderia saber. Os segredos que só o GM conhece continuam escondidos. Ela acompanha a história através de swipes e ramificações.

Uma partida sem conjunto de regras também tem dinheiro e mercado quando o kit de cenário dela os tem. Todo kit inicial tem, por exemplo, cobre, prata e ouro na alta fantasia, moedas de cobre e taéis de prata no wuxia, dólares e centavos nos dias atuais, e créditos no cyberpunk e na space opera. A loja do kit lista as coisas do dia a dia, cada uma com um preço e o menor lugar que a vende, então um vilarejo tem um café, mas só uma cidade tem um kit de primeiros socorros. Você pode mudar o dinheiro e a loja em **Mudar as palavras**, no kit, ou remover o dinheiro. Veja [Escolher um kit de cenário](#choosing-a-setting-kit).

Em um jogo com mundo gerado, o mundo continua de onde parou: os dias que passaram, os feitos e a reputação da equipe, os lugares e grupos que a história acrescentou e os lugares por onde a equipe andou.

## Famílias de arte e música

Um jogo iniciado com um kit de cenário tem uma família de arte, mostrada em **Arte e música** quando você muda as palavras do kit: `fantasy`, `scifi`, `modern`, `wuxia`, `jazz_age`, `wasteland` ou uma família própria do kit. O jogo usa as pastas com o nome da família dele e todas as pastas sem nome de família, e deixa de fora as pastas das outras famílias. Um jogo cyberpunk nunca toca música de batalha de fantasia nem mostra a floresta encantada. Quando nada da família dele nem das pastas compartilhadas combina, nada toca, em vez de uma trilha de outra família. Um jogo sem kit de cenário usa todas as pastas.

- **Música**: coloque as trilhas do cenário em `music/<state>/<family>/<intensity>`, como `combat/wuxia/intense`. Elas tocam antes das trilhas compartilhadas.
- **Planos de fundo**: `backgrounds/<family>`. Os planos de fundo gerados em um jogo com kit de cenário também são salvos ali.
- **Sons de combate**: um som em `sfx/combat/<family>` com o mesmo nome de um som incluído, como `sword-swing`, substitui esse som nos jogos daquela família. Os sons de combate incluídos são de fantasia, então as lutas das outras famílias ficam silenciosas até você adicionar os sons delas.

Os planos de fundo iniciais incluídos contam como compartilhados, exceto os de fantasia (`ancient_library`, `castle_cliff`, `enchanted_forest`) e o moderno `city_night`. Um kit de cenário salvo antes de existirem as famílias de arte continua funcionando: um kit feito a partir de um kit inicial usa a família desse kit inicial, e qualquer outro usa todas as pastas até você escolher uma família em **Arte e música**. A barra de seleção acima mostra o nome da família do jogo aberto.

## World Maps: A partir do mundo

- **A partir do mundo** aparece quando o Game cria um mundo (veja [Criar um mundo](#making-a-world)). Ele dispõe esse mundo como o mapa: as regiões, os assentamentos e os lugares dele, e os caminhos entre eles com os tempos de viagem. Você revisa o resultado antes de ele ser salvo. Não precisa de geração por IA, e os lugares do mapa são os lugares do mundo. Durante o jogo, os dois andam juntos. O Game Master e os mercados usam o lugar onde o mapa coloca a equipe. Quando o Game Master cita um lugar do mundo, o mapa leva a equipe até lá. Com o World Maps 1.6.0 ou posterior, ele faz o caminho mais curto. Versões anteriores avançam só um passo: um lugar dentro do atual, o lugar ao redor dele ou um lugar ligado a ele por um caminho.

## Roteiros de história

Os mundos podem conter roteiros de história. Veja [Como escrever roteiros de história do Game Mode](writing-story-scripts.md).
