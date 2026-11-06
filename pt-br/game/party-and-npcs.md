# Game Mode: equipe e NPCs

Este guia trata das pessoas da sua campanha no Game Mode: os integrantes da sua equipe e os NPCs (personagens não jogáveis) que o Game Master (GM) apresenta. Use-o para abrir e editar fichas de personagem, gerenciar o inventário, ler o Adventure Journal e escolher um modo de GM. Para a configuração e o básico, veja [Game Mode: primeiros passos](getting-started.md).

## Confira a equipe e o inventário

1. Clique em **Character Profiles** (perfis dos personagens) e escolha um retrato para ver a ficha daquele personagem.
2. Clique em **Inventory** (inventário) acima do texto da história para ver o que cada um carrega.

Os detalhes dos dois vêm a seguir.

## Character Profiles

**Character Profiles** é um botão de retrato que mostra quem viaja com você. Ele fica fora do menu **Chat tools** (ferramentas do chat; veja [Os controles do jogo](getting-started.md#the-games-controls)). Com vários integrantes na equipe, ele alterna entre os retratos deles e mostra um contador. Antes de a história acrescentar alguém, a equipe é só a sua persona.

1. Clique ou toque no botão **Character Profiles**.
2. Clique ou toque em um retrato para abrir a ficha daquele personagem.

Para remover um companheiro, passe o mouse sobre o retrato dele no computador e clique no **X**. Isso funciona com qualquer companheiro que o GM recrutou, na configuração inicial ou mais tarde. A sua própria persona (o personagem que você interpreta) não tem **X**.

Você pode arrastar o botão pelo chat no computador ou no celular. Abra-o e use **Lock window** (travar janela) para mantê-lo no lugar. No computador, você também pode mover e redimensionar a janela, e **Close** (fechar) a devolve ao botão. A posição fica salva com o chat e segue o estilo de widget do chat definido em **Settings → Appearance → App**. No celular, ele fica separado do menu de três pontos **Chat tools**.

## Fichas de personagem

A ficha de personagem é um resumo de um integrante da equipe feito para o jogo, separado do card de personagem. Numa partida com classes **MRPG**, o que inclui toda partida nova, ela começa com a ficha de classe MRPG do personagem: abas para **Status**, **Classes**, **Skills** e **Gear**, onde você troca de classe, leva habilidades consigo e equipa itens. Veja [A ficha do personagem](mrpg-classes.md#the-character-sheet). Os status MRPG substituem os **Attributes** abaixo.

Abaixo dela, o GM escreve a parte narrativa da ficha a partir do seu personagem e da história atual. Ela mostra as seções que têm conteúdo:

| Seção | O que ela guarda |
| --- | --- |
| **Attributes** | Só para partidas Legacy: valores como STR, DEX e CON, com um modificador, e barras de recurso como HP ou MP. |
| **Stats** | Outras barras de status. |
| **Abilities** | O que o personagem sabe fazer. |
| **Strengths**, **Weaknesses** | Listas curtas. |
| **Details** | Fatos extras, como Skills, Weapon ou Faction. |
| **Inventory** | Os itens que o personagem carrega. |
| **Traits** | Outros campos personalizados. |

Um personagem novo pode mostrar "Character data will populate as the story progresses." A ficha se completa conforme você joga.

<a id="edit-a-sheet-by-hand"></a>

### Editar a ficha à mão

**Retry**, **Save Sheet** e **Cancel** só aparecem depois que você clica em **Edit card** (editar card).

1. Abra a ficha do personagem e clique em **Edit card**.
2. Mude o que precisar:
   - **Class** (classe) e uma descrição curta, em **Sheet Details**.
   - **RPG Attributes** (partidas Legacy): ative **Enable** para acompanhar reservas e atributos. **Add Pool** cria uma barra (nome, valor atual, valor máximo, cor). **Add Attribute** cria um valor como STR. Uma partida com classes MRPG não os usa para testes nem lutas.
   - **Abilities**, **Strengths** e **Weaknesses**: **Add** (adicionar) acrescenta uma linha.
   - **Details**: **Add Detail** acrescenta um fato com rótulo.
3. Clique em **Save Sheet** (salvar a ficha). Clique em **Cancel** (cancelar) para descartar as alterações.

Para a IA recriar a ficha, clique em **Retry** (tentar novamente) durante a edição. Ele usa o personagem e o histórico atual do jogo e faz uma requisição ao seu modelo. Ele cria um rascunho: "new sheet draft is ready. Review it, then save to apply." Revise o rascunho e depois clique em **Save Sheet**. Use isso depois que a história tiver mudado muito um personagem. Em uma tela estreita, o botão mostra só um ícone.

<a id="the-ruleset-sheet"></a>

### A ficha do conjunto

Em uma partida com um conjunto de regras, cada ficha começa com um bloco **Ruleset sheet** (ficha do conjunto) organizado pelo conjunto de regras: os recursos, as trilhas, as condições, os descansos e um resumo da criação do personagem, mantidos atualizados pelo GM enquanto narra. Veja [A ficha do conjunto](rulesets.md#the-ruleset-sheet).

## Recrutar e remover integrantes da equipe

O GM controla quem está na sua equipe pela narração. Não existe um botão para adicionar companheiro.

Quando o GM acrescenta um NPC cujo nome é exatamente igual ao de um dos seus cards de personagem, ou ao de vários, uma janela pergunta qual deles entra. Ela mostra o nome, o título e o avatar de cada card. Escolha um card, ou escolha **Keep the game's own** (manter o do próprio jogo) com o nome do NPC (por exemplo, **Keep the game's own Emma**) para trazer o personagem que o jogo criou. Fechar a janela tem o mesmo efeito. Um card com um nome só parecido, como **Samantha** para um NPC chamado Sam, nunca é adicionado.

Uma Experience pode trazer os próprios companheiros: pessoas do mundo dela que podem se juntar a você, cada uma com uma ficha pronta. A história pode trazer um deles ou mandá-lo embora, e o GM só pode recrutar esses companheiros (os personagens da sua própria biblioteca ainda podem entrar). Um companheiro entra no nível mais alto da sua equipe e sobe de nível junto com a equipe.

## O inventário

Clique no botão **Inventory** acima do texto da história. Uma grade de quadrados se abre. Cada quadrado é uma pilha: um item e quantas unidades dele existem. Clique em uma pilha para selecioná-la.

Cada integrante da equipe tem a própria bolsa. O inventário abre em **All** (todos), que mostra todas as bolsas juntas, com o nome de quem carrega em cada pilha. Clique na aba de um integrante para ver só a bolsa dele. Enquanto ninguém mais carrega nada, não há abas.

- **Mudar a quantidade.** Use **-** e **+** para tirar ou acrescentar uma unidade. Ou digite um número entre eles e pressione <kbd>Enter</kbd>.
  - Um número define a quantidade: `300`.
  - Um sinal acrescenta ou tira essa quantidade: `+100`, `-50`.
  - Definir 0 remove a pilha, e pede confirmação antes quando há mais de uma unidade.
- **Dividir uma pilha.** Clique em **Split** (dividir), digite quantas unidades vão para a nova pilha e clique em **Split** de novo.
- **Dar.** Clique em **Give** (dar), escolha quem recebe e quantas unidades, e clique em **Give** de novo. Ou arraste uma pilha inteira para a aba dessa pessoa.
- **Adicionar.** Digite o nome do item e clique em **Add**. Ele vai para a bolsa da aba aberta, ou para a sua própria bolsa a partir de **All**. Adicionar um item que a bolsa já tem acrescenta uma unidade à primeira pilha dele.
- **Juntar.** Arraste uma pilha para outra pilha do mesmo item. A pilha resultante fica com quem carregava a pilha sobre a qual você a soltou.
- **Trocar de lugar.** Arraste uma pilha para um item diferente para trocar os dois de lugar.
- **Usar.** Clique em **Use** (usar) para dizer ao GM que você usa o item.
- **Apelido.** Digite um novo nome e clique em **Save** (salvar). O item mantém o nome próprio, mostrado ao lado, e um apelido nunca junta pilhas. Digite o nome próprio de novo para apagar o apelido.

### Como o GM muda o seu inventário

O GM acrescenta, remove e entrega itens conforme a história avança, e diz quem os carrega.

- Quando ele tira um item sem dizer de quem, o item sai primeiro da sua bolsa e depois da equipe.
- Uma mudança que não pode acontecer, como tirar algo que ninguém tem, é recusada, e o GM fica sabendo.
- As mudanças são feitas quando a resposta é salva. Regenerar uma resposta recomeça de onde aquele turno começou. Dar swipe de volta mostra o que aquela versão deixou. Uma ramificação guarda o inventário de cada versão.
- Se você mudar algo por conta própria, uma nova resposta acrescenta as mudanças dela por cima, e nada do que você fez é desfeito.
- Uma luta usa itens pela ação **Items** (itens) e conta todas as pilhas de um item juntas.
- Todas as bolsas, divisões e apelidos passam para a próxima sessão.

## O Adventure Journal

O Adventure Journal (o diário da aventura) é um registro contínuo da sua campanha. Ele é montado a partir dos eventos salvos do jogo, e não escrito pela IA, então se mantém factual.

1. Abra **Session** (veja [Abrir Session](sessions-and-saves.md#opening-session)).
2. Escolha a aba **Journal**.

| Aba | O que ela mostra |
| --- | --- |
| **Timeline** | O que já aconteceu: locais encontrados, encontros com NPCs, resultados de combate, missões e eventos de itens. |
| **NPCs** | Os NPCs que você já conheceu, com retratos e etiquetas de reputação. |
| **Map** | Uma lista simples dos nomes dos locais que você descobriu. |
| **Items** | Um registro dos itens que você conseguiu, usou, perdeu ou removeu. |
| **Library** | Anotações e livros do mundo do jogo que o GM mostrou a você, salvos para você reler. |
| **Notes** | O seu próprio bloco de notas. |
| **World** | Em uma partida com mundo gerado, o mundo como a sua equipe o conhece. |

A aba **World** (mundo) mostra onde vocês estão e quanto a equipe é conhecida, a posição dela com cada grupo, o que ela já fez, as notícias que chegaram até ela (os boatos vêm marcados), os problemas que estão se formando e de que ela ouviu falar, e o passado que qualquer morador contaria. Ela mostra só o que a equipe poderia saber. Os segredos que só o GM conhece continuam escondidos. Ela acompanha a história através de swipes e ramificações.

### Anotações do jogador

Na aba **Notes** (anotações), digite do lado esquerdo, e uma prévia formatada aparece do lado direito. Uma legenda avisa que as suas anotações ficam visíveis para o GM e para os integrantes da equipe, então tudo o que você escrever pode influenciar a história. As anotações são salvas pouco depois de você parar de digitar. O rótulo mostra **Saving...** e depois **Saved**.

### Etiquetas de reputação dos NPCs

Cada NPC da aba **NPCs** mostra um retrato, um nome e uma etiqueta de reputação que muda conforme as suas ações. Um NPC aparece assim que o GM o descreve, dá uma reputação a ele ou registra uma nota de relacionamento. A etiqueta só aparece depois que a reputação sai do ponto inicial, então um NPC recém-criado não mostra nenhuma.

| Etiqueta | Significado |
| --- | --- |
| **Devoted** | Profundamente leal a você |
| **Allied** | Aliado forte |
| **Friendly** | Positivo |
| **Neutral** | Sem sentimento marcante |
| **Unfriendly** | Negativo |
| **Hostile** | Virou contra você |
| **Enemy** | Se opõe ativamente |

Cada linha de NPC também permite fazer upload do retrato ou substituí-lo, gerar um retrato com IA (se a geração de imagens estiver ativada) e remover o NPC do diário.

## Modos de Game Master

Você escolhe quem conduz o jogo no assistente de configuração, na etapa **Party** (equipe), em **Game Master Mode** (modo de Game Master). O modo é definido quando você cria o jogo.

- **Standalone GM** (padrão): Marinara monta um GM para você. O assistente o descreve como "A snarky narrator running the show". Você não precisa de um card de personagem.
- **Character GM**: um dos seus próprios cards de personagem é o GM. O modelo interpreta esse personagem enquanto continua conduzindo o jogo. Escolha esta opção para ter uma voz de narrador específica.

Se este é o seu primeiro jogo, use **Standalone GM**.

## Referência: inventário com conjunto de regras

Estas partes valem só para partidas que usam um conjunto de regras, ou um kit de cenário com dinheiro. Veja [Jogar com um conjunto de regras](rulesets.md).

### Itens do conjunto

Estes controles só aparecem quando a partida roda com um conjunto de regras que tem itens.

- **From the ruleset** (do conjunto) abre um seletor com os itens do conjunto, com a busca e os filtros dele. Marque os itens e clique em **Add**: uma unidade de cada vai para onde **Add** coloca um item. Um nome digitado que seja um dos itens do conjunto acrescenta esse item. Alguns conjuntos aceitam só os próprios itens, e aí não há nome para digitar.
- **Starting gear** (equipamento inicial) abre o equipamento que o conjunto oferece para começar. Escolha para quem é em **For** (para), faça as escolhas que o kit pedir e clique em **Take** (pegar). O equipamento que combina com a ficha do personagem aparece primeiro. Pegar é opcional. Quando tudo já tiver sido pego, o botão mostra **Starting gear (taken)**.
- **Use** em um item do conjunto que diz o que faz, como um emplastro de cura, faz Marinara aplicá-lo primeiro:
  - Marinara rola o que o item devolve e grava isso na ficha de quem o carrega.
  - Tira uma unidade da pilha ou gasta uma carga, e conta ao GM o que aconteceu.
  - O que o item faz com outra pessoa fica a cargo do GM.
  - Um item sem nada sobrando é recusado, e um item que precisa ser vestido só funciona enquanto estiver vestido.
  - Alguns itens pedem um teste antes, como um pergaminho acima do seu nível de leitura. Marinara rola o teste e, se ele falhar, o item é gasto à toa.
- Selecionar um item do conjunto mostra o tipo, a raridade, as etiquetas, os atributos e a descrição dele. Uma pilha comporta só a quantidade que o conjunto define, e os itens a mais começam uma nova pilha.
- O GM pode inventar um item com as palavras do conjunto, como uma lâmina com nome. Ele funciona como um item do conjunto, e os detalhes dele dizem que foi inventado e o que Marinara mudou para encaixá-lo no conjunto, como um bônus limitado ao que a raridade permite.
- Alguns conjuntos desativam os itens próprios do Game Mode. Aí o GM dá só os itens do conjunto e os que ele inventa, e você ainda pode digitar itens seus, a menos que o conjunto aceite só os próprios.

### Vestir, vincular e carregar

Um conjunto pode definir como os itens dele são vestidos e carregados.

- **Equipado.** Um item que ocupa espaços, como uma armadura no corpo ou um arco nas duas mãos, tem um botão **Equipped** (equipado). Quem o carrega pode vesti-lo enquanto esses espaços estiverem livres. A aba da bolsa mostra os espaços em uso, como **Hands 2/2**. Equipar uma unidade de uma pilha maior a move para uma pilha própria, marcada como vestida.
- **Vínculo.** Um item que precisa ser vinculado para funcionar (sintonizado, investido) tem um botão com a palavra que o conjunto usa para isso, como **Bound** (vinculado). Um personagem só pode vincular tantos itens quanto a ficha permite, mostrados como **Bound 1/3**. Um item amaldiçoado, depois de vinculado, não pode ser desvinculado, tirado, dado a alguém ou jogado fora. Só a história, por meio do GM, pode acabar com a maldição.
- **Carga.** Quando o conjunto define pesos e capacidade, cada bolsa mostra a carga dela, como **Load 5/6, at most 12**, e **Encumbered** (sobrecarregado) quando ela passa do que quem a carrega aguenta com facilidade. Um item adicionado a partir de **All** vai para alguém que consiga carregá-lo sem ficar sobrecarregado: você primeiro, depois a equipe em ordem. Se ninguém consegue, ele é dividido conforme o espaço que cada um ainda tem, e ninguém recebe mais do que consegue carregar. O que ninguém consegue carregar fica para trás, e você é avisado. Usar **Give** ou arrastar uma pilha para uma bolsa que passaria do limite é recusado.

Dar a outra pessoa um item vestido ou vinculado o tira e o desvincula. Em um conjunto com essas regras, o GM também veste e tira itens, vincula e desvincula, e vê a carga, os espaços e os itens vinculados de cada um.

### Dinheiro e mercados

Um conjunto pode ter o próprio dinheiro: famílias de moedas, como pennies, shillings e crowns, em que cada moeda maior vale certa quantidade da menor. As moedas são pilhas como qualquer item. Elas pesam o que o conjunto define, contam na carga de quem as carrega, e você pode dividi-las, dá-las e juntá-las. **From the ruleset** tem uma lista **Coins** (moedas) para adicioná-las à mão. Acima das pilhas, uma linha mostra cada família da aba aberta e o total dela, como **Coin: crowns ×2, pennies ×12 (worth 132 pennies)**.

- O GM cobra e paga a equipe nessas moedas. Uma luta vencida ou um tesouro rolado também pode deixá-las. Um pagamento sai da bolsa de moedas de um personagem, da sua, a menos que ele diga de quem.
- Um preço só é pago na família em que é dado, então um preço em sal é pago em sal. As moedas maiores saem primeiro e, quando a quantia exata não está ali, uma moeda maior é trocada, com o troco em moedas menores.
- Um preço que a bolsa de moedas não consegue cobrir é recusado, e o GM fica sabendo. Cada pagamento e cada ganho aparecem como uma notificação.
- Uma variante do conjunto pode deixar uma moeda de fora. Nesse caso, ninguém paga nem recebe nessa moeda, e um preço dado nela aparece nas moedas que restaram, pelo mesmo valor.

Um conjunto também pode ter mercados, de modo que o que você pode comprar depende de onde você está.

- O GM diz em que lugar uma cena se passa e qual o tamanho dele, um lugarejo ou uma cidade nas palavras do conjunto. Um lugar pequeno vende menos: coisas raras talvez só se encontrem em uma cidade, e alguns vendedores só abrem loja em lugares maiores ou só atendem alguns compradores, como uma capela que só vende aos fiéis.
- Quando você compra, Marinara calcula o preço a partir do custo do item e de quão barato ou caro é o negócio, tira o valor da bolsa de moedas de quem compra e coloca o item na bolsa dessa pessoa. Hospedagem, passagem e outros serviços são apenas pagos.
- Uma compra que o lugar, o vendedor ou a bolsa de moedas não permitem é recusada, e o GM fica sabendo o motivo.
- Um conjunto pode fazer cada dia em um lugar ser diferente: um lugar pode ter só algumas unidades de algo raro, um vendedor pode aparecer com algo incomum, e você pode vender coisas de volta por uma parte do preço até os vendedores gastarem o que pagam em um dia. Um novo dia no mesmo lugar, que o GM inicia quando a equipe fica por lá, reabastece as prateleiras e as bolsas de moedas.

Uma partida sem conjunto de regras também tem dinheiro e mercado quando o kit de cenário dela os tem. Todo kit inicial tem, por exemplo, cobre, prata e ouro na alta fantasia, moedas de cobre e taéis de prata no wuxia, dólares e centavos nos dias atuais, e créditos no cyberpunk e na space opera. A loja do kit lista as coisas do dia a dia, cada uma com um preço e o menor lugar que a vende, então um vilarejo tem um café, mas só uma cidade tem um kit de primeiros socorros. Você pode mudar o dinheiro e a loja em **Change its words** (mudar as palavras), no kit, ou remover o dinheiro. Veja [Escolher um kit de cenário](getting-started.md#choosing-a-setting-kit).

## Guias relacionados

- [Game Mode: jogar com um conjunto de regras](rulesets.md)
- [Game Mode: primeiros passos](getting-started.md)
- [Game Mode: sessões e saves](sessions-and-saves.md)
