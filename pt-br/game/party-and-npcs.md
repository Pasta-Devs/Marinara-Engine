# Game Mode: equipe e NPCs

Neste guia você conhece as pessoas da sua campanha no Game Mode: os integrantes da equipe e os NPCs (personagens não jogáveis) que o Game Master apresenta. Aqui você vê como abrir a ficha de personagem de cada integrante, editar ou regenerar essa ficha e ler o Adventure Journal, incluindo as etiquetas de reputação dos NPCs. O guia também explica os dois modos de Game Master.

Game Mode é um dos modos de chat que Marinara Engine oferece. Ele roda um RPG (jogo de interpretação de papéis) para um jogador só, com um Game Master de IA, abreviado como GM. Para a configuração inicial e o básico, veja [Game Mode: primeiros passos](getting-started.md).

## A barra da equipe

A barra da equipe mostra os personagens que viajam com você. Ela fica perto do topo da tela do jogo.

Em uma tela de computador, ela é uma fileira horizontal de retratos pequenos dos personagens. No celular, a barra se reduz a um único avatar. Quando a equipe tem mais de um integrante, esse avatar exibe um contador. Toque nele para abrir a lista de integrantes. Com apenas um integrante, tocar no avatar abre direto a ficha de personagem dele.

Veja o que fazer na barra da equipe:

1. Clique ou toque em um retrato para abrir a ficha de personagem correspondente.
2. Passe o mouse por cima de um retrato (no computador) para revelar um botão **X** pequeno.
3. Clique no **X** para remover esse personagem da equipe.

Qualquer companheiro recrutado pelo Game Master pode ser removido, tenha ele entrado durante a configuração inicial ou mais tarde na história. A sua persona é o personagem que você interpreta. Ela não tem botão **X**, então você não pode remover a si mesmo da equipe.

## Fichas de personagem

A ficha de personagem é um resumo de um integrante da equipe, feito sob medida para o jogo. Ela é diferente do card de personagem. O Game Master escreve a ficha a partir do personagem e da história atual.

Para abrir uma ficha, clique no retrato do personagem na barra da equipe. A ficha mostra as seções abaixo que tiverem conteúdo:

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

Em uma [partida com conjunto de regras](dice-and-skill-checks.md#games-that-use-a-ruleset), cada ficha começa com **Ruleset sheet**. A disposição depende do conjunto; sem conjunto, esse bloco não aparece.

- **Resources** mostra valor atual e máximo de saúde, espaços de magia ou recursos de classe. Use mais, menos ou digite um valor. **Temp** é uma reserva temporária.
- **Tracks** são contadores limitados, como exaustão.

- **Wound tracks** (Trilhas de ferimentos) mostram uma fileira de casas em vez de um número, para sistemas que marcam dano em vez de contá-lo. Cada casa informa o nome daquele nível de ferimento e quanto ele tira das rolagens. Escolha primeiro o tipo de dano se o conjunto oferecer mais de um e use **Mark** (Marcar) ou **Clear one** (Limpar uma). Você também pode clicar na próxima casa vazia para adicionar uma marca ou na última marcada para removê-la; as demais não respondem a cliques. Uma marca mais grave ocupa a casa superior e empurra as leves para baixo; a linha inferior indica a penalidade ativa e o que não coube na trilha. Se o conjunto definir isso, a penalidade afeta as rolagens: retira dados de uma reserva ou é adicionada a uma rolagem somada, e o cartão de dados mostra quanto foi aplicado.
- **Notes** guarda notas curtas, como concentração.
- **Conditions** ativa e desativa condições.
- Os descansos recuperam o que o conjunto determina. Em 5e (SRD 5.1), o descanso longo recupera saúde, espaços de magia e metade dos dados de vida, no mínimo um.
- Abaixo há um resumo de atributos, perícias e salvaguardas treinadas e valores escolhidos, como classe de armadura.

O GM registra gastos, dano, cura, condições e descansos; o motor valida cada mudança. Uma operação inválida, como magia sem espaço disponível, é rejeitada por completo com um aviso.

Usar uma entrada do catálogo paga todo o custo e um uso de cada contador de linha associado. O espaço de magia é gasto no nível declarado. O GM pode pedir um nível maior, mas o motor nunca aumenta sozinho. Se faltar qualquer parte do custo, nada é gasto. Ações gratuitas, como truques, são apenas narradas. Máximos por nível e usos por atributo são recalculados na edição.

O estado pertence à mensagem. Trocar a variante da resposta ou regenerar restaura a ficha anterior ao turno para evitar gastos duplicados. **Edit sheet** usa o mesmo editor e catálogos do cartão para configuração, listas, treinamento e bônus, incluindo valores somente leitura e **Review** para textos novos. **Save sheet** altera apenas a cópia dessa partida. O botão separado **Edit Sheet** continua editando a ficha geral. Pacote ausente ou antigo mostra um aviso e bloqueia testes até ser restaurado.

## Recrutar e remover integrantes da equipe

O Game Master controla quem está na equipe conforme a história avança. Não existe um botão manual de "adicionar companheiro". Em vez disso, o GM inclui ou remove integrantes pela narração, de acordo com o que acontece na cena.

Para dispensar um companheiro por conta própria, use o botão **X** na barra da equipe, como descrito acima. A sua própria persona não pode ser removida desse jeito.

## O Adventure Journal

O Adventure Journal (o diário da aventura) é o registro contínuo da campanha. Marinara monta esse registro com os eventos salvos do jogo, e não com texto escrito pela IA, então ele se mantém factual.

Clique no botão **Session** (sessão) na barra de ferramentas do topo e escolha a aba **Journal**. O painel Journal abre com estas abas:

- **Timeline** (linha do tempo): a lista do que já aconteceu, como locais encontrados, encontros com NPCs, resultados de combate, missões e eventos de itens.
- **NPCs**: os NPCs que você já conheceu, com retratos e etiquetas de reputação (veja abaixo).
- **Map** (mapa): uma lista simples dos nomes dos locais que você descobriu.
- **Items** (itens): o registro dos itens que você conseguiu, usou, perdeu ou removeu.
- **Library** (biblioteca): anotações e livros do mundo do jogo que o Game Master mostrou, salvos para você reler.
- **Notes** (anotações): o seu bloco de notas livre.

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
