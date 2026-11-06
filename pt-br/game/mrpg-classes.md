# Game Mode: classes MRPG

Toda partida nova usa classes **MRPG** (Marinara RPG), inclusive as partidas criadas a partir de uma Experience. Cada integrante da equipe tem uma classe, sobe de nível nas lutas e desbloqueia novas classes conforme progride. As partidas criadas antes da existência das classes MRPG mantêm as fichas **Legacy** até você decidir migrá-las (veja [Migrar uma partida Legacy para MRPG](#move-a-legacy-game-to-mrpg)).

Uma partida jogada com um conjunto de regras, como 5e (SRD 5.1), usa as fichas do próprio conjunto no lugar, e as classes MRPG não se aplicam a ela.

<a id="classes-and-trees"></a>

## Classes e árvores

Há oito árvores: **Blade**, **Guard**, **Scout**, **Marksman**, **Channeler**, **Hexer**, **Mender** e **Herald**. Cada personagem treina em duas delas:

- **Árvore principal.** Escolhida a partir da ficha. A seção **Game Mode** do card de um personagem ou de uma persona da biblioteca pode defini-la. Caso contrário, ela é deduzida da classe e das habilidades do personagem.
- **Árvore secundária.** Aberta pelo temperamento com que o personagem começa a partida. Um personagem cujo temperamento aponta para a própria árvore principal treina apenas nela e pode alcançar classes abertas somente para quem permanece numa única árvore.

Cada árvore começa numa classe básica. Uma classe avança no nível de classe 10 e novamente no nível 20, e os níveis param no 30. Um personagem pode levar consigo até quatro habilidades de outras classes em que treinou. A troca de classe é feita fora da batalha, pela ficha do personagem. Os atributos seguem a classe ativa.

<a id="the-character-sheet"></a>

## A ficha do personagem

Abra a ficha de um integrante da equipe pela lista da equipe. Ela tem quatro abas: **Status**, **Classes**, **Skills** (habilidades) e **Gear** (equipamento). As taxas de crescimento ficam ocultas. Com **Debug** ativado, as porcentagens exatas de crescimento aparecem.

A sua equipe sobe de nível nas lutas que vence. Uma luta perdida ou da qual a equipe fugiu não concede experiência. Com a opção **Permadeath** (morte permanente) ativada na configuração, um integrante da equipe que cair numa luta e não for salvo antes do fim desaparece para sempre.

<a id="skill-checks"></a>

## Testes de perícia

Os testes fora da batalha leem os atributos MRPG do personagem. Veja [Dados e testes de perícia](dice-and-skill-checks.md#how-the-result-is-decided) para saber qual atributo cada perícia usa.

<a id="newcomers-to-the-party"></a>

## Recém-chegados à equipe

Quem entra depois do início da partida chega no nível que o Game Master determinar. A maioria dos recém-chegados começa em um nível baixo, e um combatente experiente pode começar perto do nível da equipe. O Game Master também pode dar a um recém-chegado:

- **Crescimento mais rápido** em alguns atributos, para um talento bruto que vai alcançar os outros depressa.
- **Atributos melhores desde o início**, para alguém que já tenha certa competência.

O Game Master decide isso quando o personagem entra. Um recém-chegado sobre o qual ele não disser nada começa no nível 1.

<a id="playing-with-others"></a>

## Jogar com outras pessoas

Numa partida compartilhada, cada convidado monta o próprio personagem ao entrar na sala: nome, descrição, um **conceito do personagem** para o Game Master e as mesmas escolhas de **Game Mode** de uma persona (árvore inicial, atributos fortes e atributo fraco). Ao escolher uma das suas personas, esses campos são preenchidos a partir dela. É no conceito que você diz ao Game Master quem é o seu personagem e como gostaria que ele entrasse na história.

O Game Master então encaixa o personagem na história e escolhe a árvore irmã dele.

- **Uma partida nova.** Todos, o anfitrião e os convidados, começam no nível 1.
- **Uma partida já em andamento.** O Game Master também decide o nível inicial do convidado e pode conceder crescimento mais rápido ou atributos melhores, como faria com qualquer [recém-chegado](#newcomers-to-the-party).
- **Um convidado que retorna.** O personagem de um convidado permanece na partida quando ele sai, com seu nível, equipamento e feras domadas. Enquanto o jogador estiver ausente, o personagem não participa das lutas nem ganha experiência, e o Game Master o deixa de fora das cenas. Quando o convidado volta, joga com o mesmo personagem no nível em que o deixou.

<a id="move-a-legacy-game-to-mrpg"></a>

## Migrar uma partida Legacy para MRPG

Uma partida Legacy mantém as fichas Legacy pelo tempo que você quiser. Para migrá-la, abra o **Journal** (diário) e, na aba **All** (tudo), encontre o card **MRPG classes** (classes MRPG). Selecione **Upgrade** (atualizar).

Para cada integrante da equipe, o card mostra:

- **Class.** (classe) A árvore em que ele começa, preenchida com a escolha do card da biblioteca ou, se não houver, com a classe Legacy. Você pode alterá-la.
- **Sister tree.** (árvore irmã) A árvore secundária aberta pelo temperamento. Um personagem que ainda não tenha temperamento recebe um deduzido da Description quando você faz a atualização.
- **Gear.** (equipamento) Cada arma e peça de armadura Legacy que ele carrega e a peça MRPG em que ela se transformaria. Desmarque a caixa para deixar um item como está.

Ao confirmar com **Upgrade the party** (atualizar a equipe):

- Cada integrante da equipe começa no nível 10, o nível máximo da classe inicial, com os atributos de cada nível rolados como numa subida de nível.
- A classe no card passa a ser a classe MRPG. A classe e as habilidades Legacy passam para uma nota **Before the upgrade** (antes da atualização) no card, para que a história ainda as conheça. Os atributos Legacy também permanecem no card.
- Cada arma ou peça de armadura aceita se transforma na peça MRPG correspondente e mantém o nome, e o personagem a veste se a classe permitir.

> **Aviso:** A atualização é irreversível. Uma partida migrada para classes MRPG não pode voltar às fichas Legacy.

A atualização não é oferecida durante uma luta. Termine a luta primeiro. Uma partida jogada com um conjunto de regras não pode ser atualizada: ela mantém as fichas do conjunto.

<a id="related-guides"></a>

## Guias relacionados

- [Game Mode: combate](combat.md)
- [Game Mode: equipe e NPCs](party-and-npcs.md)
- [Game Mode: dados e testes de perícia](dice-and-skill-checks.md)
