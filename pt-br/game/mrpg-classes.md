# Game Mode: classes MRPG

Toda partida nova usa classes **MRPG** (Marinara RPG), inclusive as partidas criadas a partir de uma Experience. Cada integrante da equipe tem uma classe, ganha níveis nas lutas que a equipe vence e abre novas classes conforme progride. Esta página é o guia do jogador para essas classes: como escolher uma classe, o que os status significam, como os níveis e as promoções funcionam e como é a ficha do personagem.

Dois tipos de partida não usam classes MRPG:

- **Partidas Legacy.** As partidas criadas antes da existência das classes MRPG mantêm as fichas **Legacy** até você decidir migrá-las. Veja [Migrar uma partida Legacy para MRPG](#move-a-legacy-game-to-mrpg).
- **Partidas com conjunto de regras.** Uma partida jogada com um conjunto de regras, como 5e (SRD 5.1), usa as fichas do próprio conjunto. Veja [Jogar com um conjunto de regras](rulesets.md).

Para saber como uma luta funciona com classes MRPG, veja [Batalhas numa partida MRPG](combat.md#battles-in-an-mrpg-game).

<a id="how-it-works"></a>

## Como funciona

- Cada personagem treina em duas **árvores** dentre oito: uma **árvore principal** que você escolhe e uma **árvore irmã** aberta pelo temperamento dele.
- Ele começa a partida na classe básica da árvore principal, no nível 1.
- Vencer lutas concede experiência. Os status de um personagem vêm da **classe ativa** e aumentam conforme essa classe ganha níveis.
- No nível de classe 10, uma classe pode ser promovida a uma classe avançada; no nível de classe 20, a uma classe mestre. Os níveis param no 30.
- Fora da batalha, um personagem pode trocar para qualquer classe que tenha aberto e levar consigo até quatro habilidades de outras classes em que treinou.

<a id="the-eight-trees"></a>

## As oito árvores

| Árvore | Fileira | Como luta | Árvore irmã para estes temperamentos |
| --- | --- | --- | --- |
| **Blade** | Frente | Combatentes armados que enfrentam o inimigo de frente. | Reckless |
| **Guard** | Frente | Portadores de escudo que recebem os golpes destinados aos aliados e fazem o inimigo vir até eles. | Protective, Honourable |
| **Scout** | Frente | Oportunistas rápidos que atacam, desviam e roubam. | Opportunistic, Cowardly |
| **Marksman** | Trás | Arqueiros que trocam de munição conforme o alvo. | Patient, Cautious |
| **Channeler** | Trás | Magos de fogo, gelo, raio, vento, madeira, terra, água e metal. | Arrogant, Methodical |
| **Hexer** | Trás | Conjuradores de maldições que enfraquecem inimigos e drenam o HP deles. | Cruel |
| **Mender** | Trás | Curandeiros que mantêm a equipe de pé e curam o que a aflige. | Supportive |
| **Herald** | Trás | Líderes de batalha que dão ordens e cantam canções que fortalecem a equipe. | Coordinated, Disciplined |

Uma equipe com uma mistura de árvores se sai melhor. Golpes corpo a corpo contra a fileira de trás causam metade do dano, então as árvores da fileira de trás dependem da fileira da frente para manter a linha (veja [Fileiras](combat.md#rows)).

<a id="classes-in-each-tree"></a>

### Classes de cada árvore

Cada árvore tem sete classes. A classe básica é promovida no nível de classe 10 a uma de duas classes avançadas, e cada uma delas é promovida no nível de classe 20 à sua classe mestre. Uma terceira linha, na última coluna, fica aberta apenas para um personagem **Pure** (puro): aquele cujo temperamento aponta de volta para a própria árvore principal, de modo que ele não tem árvore irmã e treina sozinho naquela única árvore.

| Árvore | Classe básica | Avançada (10) → Mestre (20) | Só Pure |
| --- | --- | --- | --- |
| Blade | Blade | Duelist → Headsman; Bloodsworn → Cleaver | Weaponmaster → Paragon of Arms |
| Guard | Guard | Sentinel → Stonewall; Warden → Elder Warden | Aegis → Bulwark |
| Scout | Scout | Rogue → Phantom; Skirmisher → Harrier | Shade → Shroud |
| Marksman | Marksman | Sharpshooter → Farshot; Tracker → Huntsmaster | Artillerist → Siegebreaker |
| Channeler | Channeler | Elementalist → Stormcaller; Rune Scholar → Runelord | Astral Adept → Starweaver |
| Hexer | Hexer | Witch → Carrion Lord; Dreamcaller → Dreamweaver | Nullifier → Void Sovereign |
| Mender | Mender | Cleric → Saint; Apothecary → Panacean | Lifebinder → Lightbearer |
| Herald | Herald | Cantor → Maestro; Field Captain → Marshal | Standard-Bearer → Lodestar |

A aba **Classes** da ficha do personagem descreve cada classe e lista as habilidades dela com o nível de classe em que cada uma é aprendida.

<a id="choose-a-characters-trees"></a>

## Escolher as árvores de um personagem

**Árvore principal.** Escolha-a antes da partida, na seção **Game Mode** da aba **Stats** do card de um personagem ou de uma persona da biblioteca (veja [Escolhas de MRPG em um card](../characters/colors-and-stats.md#mrpg-picks-on-a-card)). Deixe a opção em **Auto**, e a árvore será deduzida da descrição do personagem e, dentro da partida, também da classe e das habilidades dele. Um personagem cujo card não menciona nenhuma árvore começa como Blade. Até o personagem ganhar a primeira experiência, você também pode mudar a árvore dentro da partida, na aba **Classes** da ficha, em **Main tree** (árvore principal).

**Status fortes e fracos.** A mesma seção do card permite escolher até dois status nos quais o personagem é **Strong in** (forte em) e um no qual ele é **Weak in** (fraco em). Cada partida rola de novo o crescimento oculto de cada personagem, e essas escolhas influenciam a rolagem. Elas não definem números.

**Árvore irmã.** Quando a partida cria o card de jogo de um personagem, o Game Master deduz o temperamento dele a partir da Description e da personalidade: como ele aborda uma luta. Esse temperamento abre a árvore irmã na tabela acima. Escreva a Description pensando nisso se quiser uma árvore irmã específica. A ficha mostra o temperamento ao lado da árvore irmã, por exemplo, "from Cautious". A história pode mudar o temperamento de um personagem mais tarde, mas a árvore irmã continua sendo aquela com que ele começou.

Um personagem cujo temperamento abre a própria árvore principal, como um Blade Reckless, é **Pure**: ele treina numa única árvore, e a linha exclusiva para Pure fica aberta para ele.

<a id="what-the-stats-mean"></a>

## O que os status significam

| Status | O que faz |
| --- | --- |
| **HP** | Vida. Um personagem que chega a 0 cai. A barra de HP numa luta é maior que o status e aumenta com o nível. |
| **Strength** (Str, Força) | Dano com armas. Também aumenta Stamina. |
| **Magic** (Mag, Magia) | Dano de magias e de cajados, varinhas e focos, além do poder de cura. Também define o MP. |
| **Skill** (Skl, Habilidade) | Precisão e acertos críticos. |
| **Speed** (Spd, Velocidade) | A frequência com que o personagem age e a capacidade dele de desviar. Também aumenta Stamina. |
| **Defense** (Def, Defesa) | Reduz o dano de armas e de outros ataques físicos. |
| **Resistance** (Res, Resistência) | Reduz o dano de magia. |
| **Luck** (Lck, Sorte) | Um pouco de precisão e desvio, além de proteção contra acertos críticos. |

Dois recursos pagam pelas habilidades:

- **MP** paga pela magia. É igual a 8 mais o dobro da Magia e não volta durante uma luta.
- **Stamina** (ST) paga por todo o resto. É igual a 10 mais a Força mais a metade da Velocidade, e uma parte volta a cada turno, em maior quantidade num turno usado para defender.

Os mesmos status são usados nos testes de perícia fora da batalha. Veja [Testes de perícia](#skill-checks).

<a id="levels-and-experience"></a>

## Níveis e experiência

**Experiência.** Uma luta vencida concede experiência por cada inimigo que a equipe derrotou, inclusive os que se renderam ou fugiram. Metade é dividida igualmente entre todos que lutaram, e metade conforme a contribuição de cada um: dano, cura e suporte. Inimigos abaixo do nível de um personagem concedem menos, e os que estão acima concedem mais; um personagem abaixo do nível médio da equipe ganha metade a mais. Uma luta perdida ou da qual a equipe fugiu não concede nada.

**Nível do personagem.** Cada 100 pontos de experiência rendem um nível, até o 30. O painel final da tela de batalha, **What the party gained** (o que a equipe ganhou), mostra a experiência, cada nível ganho e os status que aumentaram.

**Nível de classe.** A classe ativa recebe a mesma experiência para o próprio nível de classe. Uma classe treinada abaixo da metade do nível do personagem recebe o dobro, para que uma classe adotada mais tarde alcance as outras. Os status de um personagem vêm da classe ativa no nível de classe dela: cada nível de classe rola um aumento para cada status, de acordo com o crescimento da classe e as aptidões ocultas do personagem, e pelo menos dois status aumentam a cada vez.

Isso significa que uma classe recém-adotada começa com um corpo de nível 1. Troque para uma classe nova entre as lutas em que puder se dar a esse luxo e volte para a anterior quando precisar da força que acumulou.

**Promoção.** Quando uma classe chega ao nível de classe 10, as classes avançadas dela se abrem; no nível de classe 20, abre-se a classe mestre. O painel final mostra **A promotion is open** (uma promoção está disponível). Faça a promoção na aba **Classes**, usando **Promote to** (promover para) e o nome da classe. A classe promovida começa no nível de classe da classe de origem, acrescenta um bônus único de status e preenche os espaços livres de habilidades levadas com as habilidades ativas das classes das quais veio.

As taxas de crescimento ficam ocultas. Com **Debug** ativado, a aba **Status** mostra a chance exata de aumento de cada status.

<a id="switch-classes-and-carry-skills"></a>

## Trocar de classe e levar habilidades

As classes são trocadas fora da batalha, na aba **Classes**. Escolha uma classe para ver as habilidades dela e o que a troca deixaria para trás; depois, selecione **Take up** (adotar) para uma classe ainda não treinada ou **Switch to** (trocar para) para uma classe treinada antes, no nível de classe que ela alcançou.

Um personagem usa apenas as habilidades da classe ativa, mais até quatro habilidades **levadas** de outras classes em que treinou. Escolha-as na aba **Skills** (habilidades), em **Carry from other classes** (levar de outras classes). Uma habilidade levada usa os status do próprio personagem. Algumas habilidades pertencem a uma árvore inteira, como Cover de um Guard, e todas as classes daquela árvore as mantêm sem ocupar um espaço. Quando uma troca removeria uma habilidade que você vinha usando, a ficha avisa primeiro para que você possa levá-la.

<a id="the-character-sheet"></a>

## A ficha do personagem

Abra a ficha de um integrante da equipe em **Character Profiles** (perfis dos personagens). Ela tem quatro abas:

- **Status**: nível, experiência, classe ativa, status com o equipamento contabilizado e HP, MP e Stamina no início de uma luta. **Row** (fileira) define se o personagem fica na fileira da frente ou de trás nas batalhas Turn-Based; cada classe tem um padrão.
- **Classes**: as duas árvores e todas as classes delas, com o que está aberto, os requisitos de cada classe e as promoções.
- **Skills**: as habilidades da classe ativa e aquelas levadas de outras classes, com os respectivos custos.
- **Gear** (equipamento): um espaço de **Weapon** (arma), um de **Armour** (armadura) e dois de **Accessory** (acessório), preenchidos com o que a equipe carrega e a classe pode usar. Cada peça mostra os status antes de você equipá-la. Com o espaço de arma ou armadura vazio, o personagem luta com a peça padrão da classe para o nível dele.

A arma determina os status usados por um ataque: um cajado, uma varinha ou um foco ataca com Magia contra Resistência, e qualquer outra arma usa Força contra Defesa.

**Companheiros domados.** Um Tracker pode domar uma fera selvagem enfraquecida numa luta. Ela entra para os companheiros dele, mostrados na aba **Status**, até o limite de oito. O companheiro ativo aumenta o status em que é mais forte enquanto uma classe Tracker ou Huntsmaster estiver ativa, e o aumento é maior para feras de nível mais alto e de elite. Quando o estábulo estiver cheio, solte uma para ficar com a recém-chegada. A troca de companheiros é feita fora da batalha.

**Permadeath** (morte permanente). Com **Permadeath** ativada (uma opção da etapa **World** do assistente, desativada por padrão), um integrante da equipe que cair numa luta e não for salvo antes do fim desaparece para sempre. Com ela desativada, os caídos se levantam depois da luta.

<a id="skill-checks"></a>

## Testes de perícia

Os testes fora da batalha usam os status MRPG do personagem, aqueles concedidos pela classe ativa dele. Cada perícia se apoia num status, como Stealth em Velocidade ou Persuasion em Sorte. Veja [Dados e testes de perícia](dice-and-skill-checks.md#how-the-result-is-decided) para consultar a lista completa e o bônus concedido por cada status.

<a id="new-party-members-and-shared-games"></a>

## Novos integrantes da equipe e partidas compartilhadas

**Quem entra numa partida em andamento.** Um companheiro que entra depois do início da partida chega no nível que o Game Master determinar. A maioria começa em um nível baixo, e um combatente experiente pode começar perto do nível da equipe. O Game Master também pode conceder crescimento mais rápido em alguns status, para um talento bruto que vai alcançar os outros, ou status melhores desde o início, para alguém que já tenha competência. Um recém-chegado sobre o qual o Game Master não disser nada começa no nível 1.

**Convidados numa partida compartilhada.** Cada convidado monta o próprio personagem ao entrar na sala: nome, descrição, um **conceito do personagem** para o Game Master e as mesmas escolhas de **Game Mode** de um card (árvore inicial, status fortes e status fraco). Ao escolher uma das suas personas, esses campos são preenchidos a partir dela. Use o conceito para dizer ao Game Master quem é o seu personagem e como gostaria que ele entrasse na história. O Game Master encaixa o personagem na história e escolhe a árvore irmã dele.

- **Uma partida nova.** Todos, o anfitrião e os convidados, começam no nível 1.
- **Uma partida em andamento.** O Game Master também define o nível inicial, o crescimento e os status do convidado, como faria com qualquer recém-chegado.
- **Um convidado que retorna.** O personagem de um convidado permanece na partida quando ele sai, com seu nível, equipamento e feras domadas. Enquanto o jogador estiver ausente, o personagem não participa das lutas, não ganha experiência e fica de fora das cenas. Quando o convidado volta, joga com o mesmo personagem no nível em que o deixou.

Os testes de perícia de cada jogador leem os status do próprio personagem.

<a id="move-a-legacy-game-to-mrpg"></a>

## Migrar uma partida Legacy para MRPG

Uma partida Legacy mantém as fichas Legacy pelo tempo que você quiser. Para migrá-la, abra o **Journal** (diário) e, na aba **All** (tudo), encontre o card **MRPG classes** (classes MRPG). Selecione **Upgrade** (atualizar).

Para cada integrante da equipe, o card mostra:

- **Class.** (classe) A árvore em que ele começa, preenchida com a escolha do card da biblioteca ou, se não houver, com a classe Legacy. Você pode alterá-la.
- **Sister tree.** (árvore irmã) A árvore aberta pelo temperamento. Um personagem que ainda não tenha temperamento recebe um deduzido da Description quando você faz a atualização.
- **Gear.** (equipamento) Cada arma e peça de armadura Legacy que ele carrega e a peça MRPG em que ela se transformaria. Desmarque a caixa para deixar um item como está.

Ao confirmar com **Upgrade the party** (atualizar a equipe):

- Cada integrante da equipe começa no nível 10, o nível máximo da classe inicial, com os status de cada nível rolados como numa subida de nível. A primeira promoção fica disponível na hora.
- A classe no card passa a ser a classe MRPG. A classe e as habilidades Legacy passam para uma nota **Before the upgrade** (antes da atualização) no card, para que a história ainda as conheça. Os status Legacy também permanecem no card, mas não são mais usados em testes nem lutas.
- Cada arma ou peça de armadura aceita se transforma na peça MRPG correspondente e mantém o nome, e o personagem a veste se a classe permitir.

> **Aviso:** A atualização é irreversível. Uma partida migrada para classes MRPG não pode voltar às fichas Legacy.

A atualização não é oferecida durante uma luta. Termine a luta primeiro. Uma partida jogada com um conjunto de regras não pode ser atualizada: ela mantém as fichas do conjunto.

<a id="related-guides"></a>

## Guias relacionados

- [Game Mode: combate](combat.md)
- [Game Mode: equipe e NPCs](party-and-npcs.md)
- [Game Mode: dados e testes de perícia](dice-and-skill-checks.md)
- [Cores do personagem e status de RPG](../characters/colors-and-stats.md)
