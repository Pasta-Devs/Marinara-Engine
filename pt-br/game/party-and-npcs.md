# Game Mode: equipe e NPCs

Neste guia você conhece as pessoas da sua campanha no Game Mode: os integrantes da equipe e os NPCs (personagens não jogáveis) que o Game Master apresenta. Aqui você vê como abrir a ficha de personagem de cada integrante, editar ou regenerar essa ficha e ler o Adventure Journal, incluindo as etiquetas de reputação dos NPCs. O guia também explica os dois modos de Game Master.

Game Mode é um dos modos de chat que Marinara Engine oferece. Ele roda um RPG (jogo de interpretação de papéis) para um jogador só, com um Game Master de IA, abreviado como GM. Para a configuração inicial e o básico, veja [Game Mode: primeiros passos](getting-started.md).

## Character Profiles

Clique ou toque no botão de avatar **Character Profiles** (perfis dos personagens) para ver os personagens que viajam com você. Com vários integrantes na equipe, o botão alterna entre os retratos deles e mostra um contador.

Você pode arrastar esse botão pelo chat no computador ou no celular. Abra-o e use **Lock window** (travar janela) para mantê-lo no lugar. No computador, você também pode mover e redimensionar a janela. **Close** (fechar) a devolve ao botão. A posição fica salva com o chat e segue o estilo de widget do chat definido em **Settings → Appearance → App**. No celular, ele fica separado do menu de três pontos **Chat tools** (ferramentas do chat).

Veja o que fazer dentro de **Character Profiles**:

1. Clique ou toque em um retrato para abrir a ficha de personagem correspondente.
2. Passe o mouse por cima de um retrato (no computador) para revelar um botão **X** pequeno.
3. Clique no **X** para remover esse personagem da equipe.

Qualquer companheiro recrutado pelo Game Master pode ser removido, tenha ele entrado durante a configuração inicial ou mais tarde na história. A sua persona é o personagem que você interpreta. Ela não tem botão **X**, então você não pode remover a si mesmo da equipe.

## Fichas de personagem

A ficha de personagem é um resumo de um integrante da equipe, feito sob medida para o jogo. Ela é diferente do card de personagem. O Game Master escreve a ficha a partir do personagem e da história atual.

Abra **Character Profiles** e clique ou toque no retrato do personagem. A ficha mostra as seções abaixo que tiverem conteúdo:

- **Attributes** (atributos): valores no estilo do RPG de mesa, como STR, DEX e CON, cada um com um modificador.
- **Stats** (status): barras de recurso, como HP ou MP.
- **Abilities** (habilidades): o que o personagem sabe fazer.
- **Strengths** e **Weaknesses** (pontos fortes e pontos fracos): listas curtas.
- **Details** (detalhes): fatos extras, como Skills, Weapon ou Faction.
- **Inventory** (inventário): os itens que o personagem carrega.
- **Traits** (traços): outros campos personalizados.

Em um personagem novo, pode aparecer a mensagem "Character data will populate as the story progresses". A ficha se completa conforme você joga.

### Regenerar a ficha com IA

Clique em **Regenerate Sheet** (regenerar a ficha) para a IA reescrever a ficha daquele personagem. Ela usa o personagem e o contexto atual do jogo. Isso ajuda quando a história mudou muito um personagem.

### Editar a ficha à mão

Clique em **Edit Sheet** (editar a ficha) para alterar a ficha você mesmo. No modo de edição, estes itens ficam disponíveis:

- **Class** (classe) e uma descrição curta, na seção **Sheet Details**.
- **RPG Attributes**: ative a opção **Enable** para acompanhar barras no estilo HP e atributos. Use **Add Pool** para criar uma barra (nome, valor atual, valor máximo e cor). Use **Add Attribute** para criar um valor como STR.
- **Abilities**, **Strengths** e **Weaknesses**: use **Add** para acrescentar uma linha.
- **Details**: use **Add Detail** para acrescentar um fato com etiqueta.

Ao terminar, clique em **Save Sheet** (salvar a ficha). Clique em **Cancel** para descartar as alterações.

<a id="the-ruleset-sheet"></a>

### A ficha do conjunto

Em uma partida que usa um conjunto de regras (veja [Partidas com um conjunto de regras](dice-and-skill-checks.md#games-that-use-a-ruleset)), cada ficha de personagem começa com um bloco **Ruleset sheet** (ficha do conjunto). A disposição dele vem do conjunto, então uma ficha de 5e e a ficha de outro sistema têm aparências diferentes. Uma partida sem conjunto de regras não tem esse bloco.

- **Recursos**, como pontos de vida, espaços de magia ou um recurso de classe, mostram quanto resta do máximo. Use os botões de menos e de mais, ou digite um número. Um recurso que tem uma reserva temporária também mostra uma caixa **Temp** (temporário).
- **Trilhas**, como exaustão, sobem e descem dentro do intervalo delas.
- **Trilhas de ferimentos** são uma fileira de caixas em vez de um número, para sistemas que marcam o dano em vez de contá-lo. Cada caixa diz como se chama aquele nível de ferimento e quanto ele tira das suas rolagens. Escolha primeiro o tipo de dano quando o conjunto tiver mais de um e depois use **Mark** (marcar) ou **Clear one** (limpar uma). Você também pode clicar na próxima caixa vazia para acrescentar uma marca ou na última caixa marcada para limpar uma; as outras caixas não respondem a cliques. Uma marca mais grave ocupa a caixa mais alta e empurra as mais leves para baixo, e a linha de baixo diz qual penalidade está valendo, junto com o que não coube na trilha. Alguns conjuntos numeram as caixas em vez de dar nome a elas, às vezes tantas quanto o próprio valor de um personagem, e alguns põem cada marca na caixa a que ela se destina: nesses, você pode clicar em qualquer caixa livre, a marca mais leve na caixa mais alta é a que **Clear one** tira, e uma trilha cheia recusa outra marca em vez de piorar uma antiga. Um conjunto também pode acrescentar caixas a uma trilha a partir de uma lista da sua ficha, e fazer um descanso ou uma cura limpar só um tipo de dano. Se o conjunto disser, essa penalidade sai das suas rolagens: ela tira dados de uma parada ou entra em uma rolagem somada, e o cartão de dados diz quanto foi aplicado.
- **Notas**, como aquilo em que um personagem está concentrado, são caixas de texto curtas.
- **Condições** são botões que você liga e desliga.
- **Estados**, como uma forma ou uma postura, assumem um valor de uma lista por vez. Escolha o valor na lista. Um estado pode mudar os números que vêm depois dele, como os dados que uma postura acrescenta às suas rolagens, e um descanso pode devolvê-lo ao ponto de partida.
- **Botões de descanso** aplicam um dos descansos do conjunto. O que um descanso recupera é definido pelo conjunto, e um descanso também pode devolver as cargas dos itens que o personagem carrega, como as de uma varinha; a linha abaixo dos botões diz então o que voltou. Em 5e (SRD 5.1), um descanso longo recupera os pontos de vida e os espaços de magia e devolve metade dos dados de vida do personagem, no mínimo um.
- Abaixo disso há um resumo curto da configuração do personagem: modificadores de atributo, perícias e salvaguardas treinadas e alguns valores escolhidos pelo conjunto, como a classe de armadura.

O Game Master mantém a mesma ficha atualizada enquanto narra. Quando um personagem gasta um recurso, sofre dano, se cura, ganha ou perde uma condição, muda de estado ou descansa, o GM registra a mudança, e o motor a confere com a ficha. Uma mudança que não é possível, como uma magia lançada sem nenhum espaço sobrando, é recusada: nada muda e um aviso informa você.

Quando um personagem usa algo que escolheu nos catálogos do conjunto, como uma magia ou uma característica de classe, o Game Master nomeia o que foi usado e o motor paga o preço inteiro: o custo que o conjunto define, mais um uso de cada contador que veio junto. Uma magia que custa um espaço é paga com o nível de espaço que o conjunto indica para ela, e o Game Master pode pedir um nível mais alto em vez disso. O motor nunca sobe para um espaço mais alto por conta própria. Se qualquer parte do preço não puder ser paga, tudo é recusado e nada é gasto. Algo que não custa nada, como um truque, é apenas narrado.

Alguns números da ficha pertencem ao conjunto, e não a você. Um recurso de classe cujo máximo acompanha o seu nível, ou usos que acompanham um valor de atributo, são definidos pelo conjunto e mantidos corretos quando você edita a ficha.

Alguns valores calculados acompanham o próprio jogo: um conjunto pode calcular um número a partir de um recurso ou de uma trilha como estão no momento, dar um número para cada valor de um estado ou somar uma coluna de uma lista, como o peso do equipamento que você guardou na mochila. Ele também pode limitar uma perícia a um número assim, de modo que uma perícia pode diminuir enquanto um recurso está baixo. Esses valores mostram o valor atual na ficha da partida, e os valores que um teste ou uma luta usa são os do momento em que eles acontecem. O editor de ficha de um card de personagem, que não tem uma partida para ler, mostra esses valores como estariam no início do jogo.

Esses valores ao vivo pertencem à mensagem em que aconteceram. Se você der swipe para outra versão de um turno, ou regenerá-lo, a ficha volta a ser como era antes daquele turno, então nada é gasto duas vezes.

Clique em **Edit sheet** (editar ficha) para mudar a própria configuração do personagem, por exemplo depois de subir de nível: valores, campos, listas como as magias, e o treinamento de perícias e salvaguardas. Os valores calculados se atualizam enquanto você digita. É o mesmo editor do card de personagem, então aqui também dá para acrescentar linhas a partir dos catálogos do conjunto, as células que o conjunto controla aparecem mas não aceitam digitação, e uma lista cujo texto no conjunto mudou oferece um botão **Review** (revisar). Quando o conjunto tem um construtor passo a passo, o editor oferece **Guided** (guiado) ao lado de **All fields** (todos os campos). **Guided** conduz você por cada escolha, como valores, perícias e equipamento inicial, e diz o que cada etapa ainda espera. **All fields** mostra tudo de uma vez. Clique em **Save sheet** (salvar ficha) quando terminar. Isso muda só a cópia da ficha desta partida. A ficha guardada no personagem ou na persona nunca é alterada por uma partida.

O botão separado **Edit Sheet** descrito acima continua editando a ficha geral (classe, habilidades, pontos fortes e assim por diante) e não mexe na ficha do conjunto.

Se o pacote do conjunto foi removido, ou se a cópia instalada é mais antiga que aquela com que a partida foi criada, o bloco mostra um aviso no lugar, e os testes não podem ser rolados até o pacote ser instalado de novo.

### A ficha da equipe e os relógios de progresso

Alguns conjuntos mantêm uma ficha para a equipe inteira, como uma tripulação ou uma companhia. Ela aparece na tela do jogo perto do mapa, com o nome que o próprio conjunto dá a ela. Clique no nome para abri-la. O Game Master a mantém atualizada como faz com a ficha de cada personagem e, onde o conjunto permite, você também pode editá-la. Se outra pessoa salvou a ficha da equipe enquanto você editava, ela mostra a versão dessa pessoa: **Save** (salvar) a substitui pela sua, e **Cancel** mantém a dela.

Um conjunto também pode usar **Progress clocks** (relógios de progresso): círculos divididos em segmentos que o Game Master preenche conforme algo avança, como um alarme sendo dado. Eles aparecem perto do mapa, cada um com quantos segmentos estão preenchidos, e mostram **Done** (concluído) quando ficam cheios.

## O inventário

Clique em **Inventory** acima da narração para abri-lo. Cada quadrado é uma pilha: um item e quantas unidades dele existem. Clique em uma pilha para selecioná-la.

Cada integrante da equipe carrega as próprias coisas. O inventário abre em **All** (todos), que mostra todas as bolsas juntas, com o nome de quem carrega cada pilha no canto dela. Clique na aba de um integrante para ver só a bolsa dele. Enquanto ninguém mais carrega nada, não há abas e todas as pilhas são suas.

- **Mudar a quantidade.** Use **-** e **+** para tirar ou acrescentar uma unidade. Para mudar mais de uma de cada vez, digite no número entre eles e pressione Enter: um número define a quantidade (`300`), e um sinal acrescenta ou tira essa quantidade (`+100`, `-50`). Definir uma pilha como 0 a remove, e pede confirmação antes quando há mais de uma unidade.
- **Dividir uma pilha.** Clique em **Split** (dividir), digite quantas unidades vão para a nova pilha e clique em **Split** de novo. Separar 100 de 300 maçãs deixa uma pilha de 200 e uma nova pilha de 100 ao lado.
- **Dar.** Clique em **Give** (dar), escolha quem recebe e quantas unidades, e clique em **Give** de novo. Para entregar uma pilha inteira, você também pode arrastá-la para a aba da pessoa.
- **Adicionar.** Digite o nome do item e clique em **Add** (adicionar). Ele vai para a bolsa da aba aberta, e para a sua própria bolsa a partir de **All**, a menos que o seu conjunto de regras defina o que cada um pode carregar (veja abaixo). Adicionar um item que a bolsa já tem acrescenta uma unidade à primeira pilha dele.
- **Juntar ou reordenar.** Arraste uma pilha para outra pilha do mesmo item para juntá-las, qualquer que seja o nome de cada uma. A pilha resultante fica com quem carregava a pilha sobre a qual você a soltou. Arraste uma pilha para um item diferente para trocar os dois de lugar.
- **Do conjunto.** Em uma partida cujo conjunto lista itens próprios, **From the ruleset** (do conjunto) abre um seletor com eles, com a busca e os filtros do conjunto. Marque os itens que você quer e clique em **Add**: uma unidade de cada vai para onde **Add** coloca um item, ou seja, para a bolsa da aba aberta ou, a partir de **All**, para a sua própria bolsa, a menos que o seu conjunto defina o que cada um pode carregar. Um nome digitado que seja um dos itens do conjunto também acrescenta esse item. Um conjunto pode aceitar só os próprios itens, e aí não há nome para digitar.
- **Equipamento inicial.** Quando o conjunto oferece equipamento para começar, **Starting gear** (equipamento inicial) o abre. Escolha para quem é em **For** (para), faça as escolhas que um kit pedir e clique no botão **Take** (pegar) dele para colocá-lo na bolsa dessa pessoa. O equipamento que combina com a ficha desse personagem aparece primeiro; o restante pode ser pego se o Game Master concordar. Pegar é opcional. Quando tudo o que foi oferecido já tiver sido pego, o botão mostra **Starting gear (taken)**.
- **Usar.** Clique em **Use** (usar) para dizer ao Game Master que você usa o item. Para um item do conjunto que diz o que acontece ao usá-lo, como um emplastro de cura, o motor faz isso primeiro: rola o que o item devolve, grava isso na ficha de quem o carrega, tira uma unidade da pilha ou gasta uma carga e conta ao Game Master o que aconteceu, para que a história acompanhe. O que o item faz com outra pessoa fica para o Game Master narrar. Um item sem nada sobrando é recusado, e um que precisa ser vestido só é usado enquanto estiver vestido. Alguns itens pedem um teste antes, como um pergaminho acima do que você consegue ler: o motor rola o teste e, se ele falhar, o item é gasto à toa.
- **Apelido.** Digite um novo nome para a pilha e clique em **Save**. É só como você chama aquela pilha: ela continua sendo o mesmo item, o Game Master ainda pode chamá-la pelo nome próprio, e dar um apelido nunca a junta a outra pilha. O nome próprio do item aparece ao lado do apelido. Digite o nome próprio de novo para apagar o apelido.

Um item do conjunto mostra o que ele é quando você o seleciona: tipo, raridade, etiquetas, atributos e descrição. Uma pilha dele comporta só a quantidade que o conjunto define, e o que passar disso começa uma nova pilha. O Game Master também pode inventar um item com as palavras do próprio conjunto, como uma lâmina com nome. Ele funciona como os itens do próprio conjunto, e os detalhes dele dizem que foi inventado, com o que o motor mudou para encaixá-lo no conjunto, como um bônus limitado ao que a raridade permite. Alguns conjuntos desativam os itens próprios do Game Mode: aí o Game Master dá só os itens do conjunto e os que ele inventa, enquanto você ainda pode digitar itens seus, a menos que o conjunto aceite só os próprios.

### Vestir, vincular e carregar

Um conjunto também pode definir como os itens dele são vestidos e carregados:

- **Equipado.** Um item que ocupa espaços, como uma armadura no corpo ou um arco nas duas mãos, tem um botão **Equipped** (equipado). Quem o carrega pode vesti-lo enquanto esses espaços estiverem livres; a aba da bolsa mostra cada espaço em uso, como **Hands 2/2**. Equipar uma unidade de uma pilha maior a separa em uma pilha própria, marcada como vestida.
- **Vínculo.** Um item que precisa ser vinculado para funcionar (sintonizado, investido) tem um botão com o nome que o conjunto usa para isso, como **Bound** (vinculado). Um personagem só pode vincular tantos itens quanto a ficha dele permite, mostrados, por exemplo, como **Bound 1/3**. Um item amaldiçoado, depois de vinculado, continua vinculado: você não pode desvinculá-lo, tirá-lo, dá-lo a alguém ou jogá-lo fora. Só a história, por meio do Game Master, pode acabar com a maldição.
- **Carga.** Quando o conjunto define quanto tudo pesa e quanto cada personagem pode carregar, cada bolsa mostra a carga dela, como **Load 5/6, at most 12**, e **Encumbered** (sobrecarregado) quando passa do que quem a carrega aguenta com facilidade. Um item adicionado a partir de **All** vai para alguém que consiga carregá-lo sem ficar sobrecarregado: você primeiro, depois a equipe em ordem. Quando ninguém consegue carregar tudo, a quantidade é dividida conforme o espaço que cada um ainda tem, e ninguém recebe mais do que consegue carregar. O que ninguém consegue carregar fica para trás, e você é avisado. Entregar a alguém mais do que essa pessoa consegue carregar é recusado, seja por **Give**, seja arrastando uma pilha para uma da bolsa dela.

Dar a outra pessoa um item vestido ou vinculado o tira e o desvincula.

A ficha de personagem de um integrante lista o que ele carrega.

O Game Master acrescenta, remove e entrega itens conforme a história avança, e diz quem os carrega. Um item que ele nomeia e que é um dos itens do conjunto é esse item, e ele fica sabendo o que é cada item do conjunto que vocês têm. Ele usa os itens do conjunto do mesmo jeito que o botão **Use**. Em um conjunto que define como os itens são vestidos e carregados, ele também veste e tira itens, vincula e desvincula, e vê a carga, os espaços e os itens vinculados de cada personagem; um item que ele acrescenta sem dizer quem recebe é dividido do mesmo jeito que os seus. Cada mudança é feita quando a resposta é salva, e a notificação dela aparece quando você chega àquela parte da história. Quando o Game Master tira um item sem dizer de quem, ele sai primeiro da sua bolsa e depois do resto da equipe. Uma mudança que não pode acontecer, como tirar algo que ninguém tem, é recusada, e o Game Master fica sabendo. Quando você regenera uma resposta, as mudanças dela recomeçam de onde aquele turno começou, e dar swipe de volta para uma versão anterior mostra o que aquela versão deixou. Excluir a versão em que você está mostra o que a próxima deixou, e uma ramificação do chat leva junto o inventário de cada versão. Isso só acontece enquanto o inventário continua exatamente como a resposta o deixou: depois que você muda algo por conta própria, uma nova resposta acrescenta as mudanças dela por cima e nada do que você fez é desfeito. Uma luta usa itens pela ação **Items** e conta todas as pilhas de um item juntas, seja quem for que as carregue e seja qual for o nome delas. Todas as bolsas, com divisões e apelidos, passam para a próxima sessão.

### Dinheiro

Um conjunto pode ter o próprio dinheiro: uma ou mais famílias de moedas, como pennies, shillings e crowns, em que cada moeda maior vale certa quantidade da menor. As moedas são pilhas como qualquer item. Elas pesam o que o conjunto define e contam na carga de quem as carrega, e você pode dividi-las, dá-las e juntá-las como qualquer outra coisa. **From the ruleset** tem uma lista **Coins** (moedas) para adicioná-las à mão.

Acima das pilhas, uma linha mostra cada família de moedas na aba aberta e quanto elas somam, como **Coin: crowns ×2, pennies ×12 (worth 132 pennies)**.

O Game Master cobra e paga a equipe nessas moedas, e uma luta vencida ou um tesouro que ele rola também pode deixá-las. Um pagamento sai da bolsa de moedas de um personagem, da sua a menos que o GM diga de quem, e só na família em que o preço é dado: as moedas maiores saem primeiro e, quando a quantia exata não está ali, uma moeda maior é trocada e o troco volta em moedas menores. Um preço que a bolsa de moedas não consegue cobrir é recusado, e o Game Master fica sabendo. Um preço em uma família nunca é pago em outra, então um preço em sal é pago em sal. O dinheiro que a equipe ganha vai para as bolsas como qualquer item. Cada pagamento e cada ganho aparecem como uma notificação.

Uma variante do conjunto pode deixar uma moeda de fora, como uma longa noite em que nenhuma crown chega aos túmulos. Nesse período, ninguém é pago nessa moeda nem paga com ela, e um preço dado nela aparece nas moedas que restaram, pelo mesmo valor.

Um conjunto também pode ter mercados, de modo que o que você pode comprar depende de onde você está. O Game Master diz em que lugar uma cena se passa e qual o tamanho dele, um vilarejo ou uma cidade nas palavras do próprio conjunto, e um lugar pequeno vende menos: coisas raras talvez só se encontrem em uma cidade, e alguns vendedores só abrem loja em lugares maiores ou só atendem alguns compradores, como uma capela que só vende aos fiéis. Quando você compra algo, o motor calcula o preço a partir do custo do item e de quão barato ou caro é o negócio, tira o valor da bolsa de moedas de quem compra e coloca o item na bolsa dessa pessoa. Hospedagem, passagem e outros serviços são apenas pagos. Uma notificação mostra o que foi comprado e por quanto, e uma compra que o lugar, o vendedor ou a bolsa de moedas não permitem é recusada, e o Game Master fica sabendo o motivo. Um conjunto também pode fazer cada dia em um lugar ser diferente: um lugar pode ter só algumas unidades de algo raro, um vendedor pode aparecer com algo incomum naquele dia, e você pode vender coisas de volta a um vendedor que negocia com elas, por uma parte do preço, até os vendedores do lugar gastarem o que pagam em um dia. Um novo dia no mesmo lugar, que o Game Master inicia quando a equipe fica por lá, reabastece as prateleiras e o dinheiro dos vendedores.

Uma partida sem conjunto de regras também tem dinheiro e mercado quando o kit de cenário dela os tem: todo kit inicial tem, como cobre, prata e ouro na alta fantasia, moedas de cobre e taéis de prata no wuxia, dólares e centavos nos dias atuais, e créditos no cyberpunk e na space opera. A loja do kit lista as coisas do dia a dia que o cenário vende, cada uma com um preço e o menor lugar que a vende, então um vilarejo tem um café, mas só uma cidade tem um kit de primeiros socorros. Você pode mudar o dinheiro e a loja em **Change its words** (mudar as palavras), no kit, ou remover o dinheiro de vez. Comprar, pagar e ganhar funcionam então como acima, nas moedas do próprio cenário.

## Recrutar e remover integrantes da equipe

O Game Master controla quem está na equipe conforme a história avança. Não existe um botão manual de "adicionar companheiro". Em vez disso, o GM inclui ou remove integrantes pela narração, de acordo com o que acontece na cena.

Quando o GM adiciona um NPC que tem exatamente o mesmo nome de um dos seus cards de personagem, ou um nome que vários dos seus cards compartilham, uma janela pergunta qual deles entra na equipe. Ela mostra o nome, o título e o avatar de cada card. Escolha um card ou a opção **Keep the game's own** (manter o do próprio jogo) com o nome do NPC, como **Keep the game's own Emma**, para trazer o personagem que o jogo criou. Fechar a janela tem o mesmo efeito. Um card com um nome apenas parecido, como **Samantha** para um NPC chamado Sam, nunca é adicionado.

Para dispensar um companheiro por conta própria, use o **X** ao lado do retrato dele em **Character Profiles**, como descrito acima. A sua própria persona não pode ser removida desse jeito.

## O Adventure Journal

O Adventure Journal (o diário da aventura) é o registro contínuo da campanha. Marinara monta esse registro com os eventos salvos do jogo, e não com texto escrito pela IA, então ele se mantém factual.

Abra **Session** (veja [Abrir Session](sessions-and-saves.md#opening-session)) e escolha a aba **Journal**. Journal tem estas abas:

- **Timeline** (linha do tempo): a lista do que já aconteceu, como locais encontrados, encontros com NPCs, resultados de combate, missões e eventos de itens.
- **NPCs**: os NPCs que você já conheceu, com retratos e etiquetas de reputação (veja abaixo).
- **Map** (mapa): uma lista simples dos nomes dos locais que você descobriu.
- **Items** (itens): o registro dos itens que você conseguiu, usou, perdeu ou removeu.
- **Library** (biblioteca): anotações e livros do mundo do jogo que o Game Master mostrou, salvos para você reler.
- **Notes** (anotações): o seu bloco de notas livre.
- **World** (mundo): em uma partida com mundo gerado, o mundo como a sua equipe o conhece. Ele mostra:
  - onde vocês estão e quanto a equipe é conhecida
  - a posição da equipe com cada grupo com que ela lidou
  - o que a equipe já fez
  - as notícias que chegaram até ela, com os boatos marcados
  - os problemas que estão se formando e de que ela ouviu falar
  - o passado que qualquer morador contaria

  Ele mostra só o que a equipe poderia saber. Os segredos que só o Game Master conhece continuam escondidos. Ele acompanha a história através de swipes e ramificações.

### Anotações do jogador

A aba **Notes** é o seu bloco de notas pessoal. Digite do lado esquerdo; do lado direito aparece a versão formatada. Uma legenda acima do bloco avisa que as anotações ficam visíveis para o Game Master e para os integrantes da equipe. Ou seja, tudo o que você escrever ali pode influenciar a história.

Marinara salva as anotações automaticamente, pouco depois de você parar de digitar. Uma etiqueta pequena mostra **Saving...** durante o salvamento e **Saved** quando termina.

## Etiquetas de reputação dos NPCs

A aba **NPCs** do Adventure Journal acompanha o que cada NPC sente por você. Todo NPC da lista mostra um retrato, um nome e uma etiqueta de reputação.

A etiqueta de reputação muda conforme as suas ações na história. Ela é uma destas sete, da melhor para a pior:

| Etiqueta | Significado |
|---|---|
| **Devoted** | Profundamente leal a você |
| **Allied** | Aliado forte |
| **Friendly** | Positivo |
| **Neutral** | Sem sentimento marcante |
| **Unfriendly** | Negativo |
| **Hostile** | Virou contra você |
| **Enemy** | Se opõe ativamente |

A etiqueta só aparece depois que a reputação do NPC sai do ponto inicial. Um NPC recém-criado, com a reputação intacta, ainda não mostra etiqueta.

Um NPC entra nessa aba assim que o Game Master o descreve, dá uma reputação a ele ou registra uma nota de relacionamento. Cada linha de NPC também oferece estas ações:

- Fazer upload do retrato do NPC ou substituir o retrato atual.
- Gerar um retrato com IA, se a geração de imagens estiver ativada.
- Remover o NPC do Adventure Journal.

## Modos de Game Master

Você escolhe quem conduz o jogo no assistente de configuração, na etapa **Party**, na opção **Game Master Mode**. São duas escolhas:

- **Standalone GM**: a opção padrão. Marinara monta um mestre do jogo para você. O assistente de configuração descreve esse mestre como "A snarky narrator running the show". Não é preciso ter um card de personagem.
- **Character GM**: usa um dos seus próprios cards de personagem como Game Master. Marinara pede ao modelo que interprete esse personagem enquanto conduz o jogo. Escolha esta opção quando quiser uma voz de narrador específica.

Se este é o seu primeiro jogo, use **Standalone GM**. O modo é definido na criação do jogo. Para o passo a passo completo da configuração, veja [Game Mode: primeiros passos](getting-started.md).

## Guias relacionados

- [Game Mode: primeiros passos](getting-started.md)
- [Game Mode: sessões e saves](sessions-and-saves.md)
