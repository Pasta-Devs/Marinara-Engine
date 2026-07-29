# World Maps: instalação, criação e viagem

> **Compatibilidade atual:** este guia corresponde ao World Maps **1.2.0**
> no Marinara Engine **2.3.5**. O pacote funciona em chats de Roleplay e Game.

World Maps acrescenta um estado do mundo persistente ao Roleplay e ao
Game. Em vez de manter um único local em texto livre, ele representa o mundo
como lugares aninhados:

```text
The Shattered Coast
└── Brinewatch
    ├── Harbor District
    │   ├── Tideglass Inn
    │   └── Quest Hall
    └── Old Sewers
```

Marinara mantém um local atual oficial dentro dessa hierarquia. O caminho de
navegação atual, os detalhes exatos do local, os destinos próximos e o lore
vinculado elegível servem de base para a próxima resposta. O mapa também
acompanha uma viagem narrada até o fim rumo a um lugar conhecido, ou registra um
lugar recém-descoberto quando a história realmente chega lá.

Cada chat recebe a própria cópia de trabalho de um mapa. Com os modelos da conta,
você prepara um mundo original ou de fandom uma vez só e depois adiciona uma
cópia limpa a qualquer chat de Roleplay ou Game.

## Visão geral do recurso

O World Maps 1.2.0 oferece:

- regiões, assentamentos, lugares, edifícios, andares e cômodos aninhados;
- caminhos de navegação e um local oficial da história;
- visualização em lista, em mapa posicionado e em camadas ordenadas para os
  locais filhos;
- viagem entre pai e filho, ligações diretas e planejamento de rota em vários
  turnos;
- movimento validado a partir da narração concluída e descoberta de novos locais;
- modelos de mapa da conta, criados manualmente, com IA ou por importação;
- rascunhos e expansões de mapa feitos com IA e apoiados na configuração ou no
  lore selecionado;
- descrições públicas do local, memória privada do modelo e lore do local exato;
- uma imagem de referência opcional da galeria para cada local;
- um plano de fundo da galeria separado para cada mapa de filhos posicionado;
- geração em lote revisada para as artes de local que estiverem faltando;
- uma substituição global do prompt de arte do Maps, baseada em variáveis;
- suporte a referência de local nas ilustrações do Roleplay e nos Storyboards do
  Game;
- importação, exportação, arquivamento, edição consciente do histórico e
  vínculos com o mapa do Game; e
- bibliotecas globais de prompt para a construção de mapas com IA e para a
  inserção do local em tempo de execução.

Os destinos disponíveis entram no contexto do modelo. Com as escolhas CYOA
ativadas, o modelo pode então oferecer os filhos do local atual ou os lugares
conectados como próximas opções. As escolhas em si continuam sendo geradas pelo
modelo.

## Início rápido

1. Abra a página **Agents** (Agentes), clique em **Download Agents** (baixar
   agentes) e instale o **World Maps**.
2. Reinicie Marinara quando o aviso aparecer. O pacote contém código de servidor.
3. Abra um chat de Roleplay ou Game.
4. Abra **Agents → World Maps** e ative o pacote para o chat atual. Outra
   opção: ativar pela seção **Chat Settings → Agents** (configurações do chat)
   desse chat.
5. Crie o mapa com **Use template**, **Create with AI** ou **Build manually**.
   Chats já existentes também podem importar um arquivo de mapa.
6. Revise a hierarquia de trabalho, escolha um local inicial, ative o mapa e
   clique em **Save** (salvar).
7. Abra o **Story map** durante o chat. Selecione um destino alcançável e envie o
   próximo turno, ou descreva a viagem naturalmente e deixe a resposta atualizar
   o local quando a chegada se concretizar.
8. Se quiser, atribua artes da galeria aos locais ou use a seção **Location
   artwork** para revisar e gerar as imagens que faltam.

Aplicar um modelo, um rascunho de IA ou um arquivo importado muda apenas a cópia
de trabalho do editor. Nada disso afeta as respostas enquanto a hierarquia não
for ativada e salva.

## Instalar e ativar o pacote

Abra a página **Agents** pela aba Sparkles na barra lateral direita. Clique em
**Download Agents**, selecione **World Maps** e clique em **Install**. Se
o catálogo depois oferecer **Update**, instale essa atualização também. Siga o
aviso de reinício antes de usar o pacote.

A página do World Maps informa a versão instalada do pacote e se está
tudo pronto, oferece a biblioteca de modelos da conta e mostra o status do mapa
no chat atual. Instalar o pacote deixa o recurso disponível, mas não o ativa em
todos os chats.

### Roleplay

1. Abra o chat de Roleplay.
2. Abra **Chat Settings** pelo botão de engrenagem.
3. Ative **Enable Agents**.
4. Em **Tracker Agents**, ative **World Maps**.
5. Abra **Edit hierarchical map** ou a biblioteca **Map templates**.

A biblioteca de modelos funciona igual, seja aberta pela página principal
**Agents**, seja pelo **Chat Settings** do Roleplay. Use **Add to chat** para
copiar um modelo para o chat ativo.

### Game

Durante a configuração do Game, escolha World Maps e depois selecione um
dos caminhos de configuração:

- **Create with AI** prepara uma hierarquia gerada para você revisar.
- **Use template** abre o seletor de modelos antes de o Game ser criado.
- **Build manually** começa com uma hierarquia em branco e editável.

Depois de escolher **Use template**, selecione e confirme um modelo específico. A
configuração cria uma cópia de trabalho pertencente ao Game para revisão; o
modelo da conta nunca é editado. Os locais do modelo selecionado viram o mundo
hierárquico inicial. Nenhum mapa comum de Game entra como alternativa no lugar
dele.

Também é possível adicionar World Maps a um Game já existente mais tarde,
em **Chat Settings → Agents**.

## Criar e reaproveitar modelos de mapa

Abra **Agents → World Maps → Open map templates**. Os modelos pertencem à
conta, e não a um chat só, então servem bem para mundos de fandom reutilizáveis,
cenários de campanha, masmorras, cidades ou mapas iniciais pessoais.

Pela biblioteca, você pode:

- criar um modelo manualmente;
- usar **Create with AI** para gerar um rascunho;
- importar um arquivo `.hierarchical-map.json`;
- pesquisar, ver, editar, exportar ou excluir um modelo;
- usar **Add to chat** com um chat de Roleplay ou Game aberto; ou
- escolher **Use template** durante a configuração do Game.

Cada aplicação cria uma cópia de trabalho independente. Edições posteriores no
modelo não mudam os chats que já o copiaram, e as edições feitas no chat não
mudam o modelo.

Os modelos não copiam a arte da galeria do chat. Os IDs de imagem pertencem à
galeria do chat de origem e não seriam portáveis. Adicione ou gere as referências
de local e os planos de fundo do mapa no chat de trabalho depois de aplicar o
modelo.

## Entender o editor de mapas

No computador, o editor mostra três painéis. Em telas estreitas, alterne entre as
abas **Hierarchy**, **Local** e **Details**.

- A aba **Hierarchy** mostra a árvore completa. Ao selecionar um local, você o
  edita. O botão **Enter** muda a parte da hierarquia que está sendo visualizada;
  ele não move a história.
- A aba **Local** mostra os filhos imediatos do local atual em lista, mapa
  posicionado ou camadas ordenadas.
- A aba **Details** edita o texto do local, a hierarquia, o lore, a arte, as
  ligações, o status e os vínculos com o mapa do Game.

O cabeçalho do editor traz os controles de construção com IA, além de
**Templates**, **Export**, **Import**, o botão liga/desliga Enabled e **Save**.
Alterações não salvas ficam marcadas como **Unsaved**. Se você sair com trabalho
não salvo, Marinara pergunta se deve descartá-lo.

### O que um local pode conter

Cada local pode ter:

- um pai e qualquer número de filhos;
- um tipo Region, Settlement, Place, Building, Floor ou Room;
- um nome e um ícone;
- uma descrição pública e uma memória privada do modelo;
- um resumo curto de percepção;
- ligações com entradas de lorebook do local exato;
- ligações diretas de mão única ou de mão dupla com outros locais;
- uma apresentação dos filhos em List, Map ou Layers;
- uma imagem de referência do local e um botão liga/desliga opcional de uso da
  imagem;
- um plano de fundo próprio para o mapa de filhos, quando a apresentação for Map;
  e
- status ativo ou arquivado.

Na apresentação **Map**, arraste os filhos para o lugar ou digite as posições X e
Y exatas, de 0 a 100. O pai selecionado também pode ter uma imagem da galeria
atrás dos filhos. Na apresentação **Layers**, dê a cada filho uma ordem de camada
distinta.

As ligações diretas podem conectar quaisquer lugares válidos da hierarquia: uma
balsa entre cidades, uma escada entre andares selecionados, um portal entre
mundos ou uma passagem secreta entre cômodos de edifícios diferentes.

Uma torre de 25 andares normalmente deve modelar os andares como irmãos sob uma
única torre, e não como uma cadeia de pais com 25 níveis. O mapa aceita até 500
locais e 20 níveis de hierarquia.

## Criar ou expandir um mapa com IA

Com o mapa vazio, clique em **Create with AI** ou **Draft with AI**. Com um mapa
já existente, clique em **Expand with AI**.

### Escolher o que o construtor lê

Em **Build from**, escolha uma destas fontes:

- **Game setup** usa a configuração e os personagens atuais. No Game, isso inclui
  a visão geral do mundo e os personagens da equipe.
- **Selected lore** usa os lorebooks escolhidos. A opção **Strict canon** cria
  apenas lugares apoiados no lore. A opção **Canon + expansion** permite
  acréscimos que combinem com o material.

O construtor não lê o histórico de turnos. Acrescente o que faltar na
configuração ou no lore aos campos **What should this world include?** ou **What
should be added?**

Escolha um tamanho:

| Tamanho    | Resultado aproximado |
| ---------- | -------------------- |
| **Small**  | 8 lugares            |
| **Medium** | 16 lugares           |
| **Large**  | 28 lugares           |

A geração cria um rascunho, não um mapa salvo. Pesquise ou expanda a
pré-visualização completa, selecione locais e revise os caminhos, as descrições,
a memória privada do modelo e a origem no lore. Use **Edit prompt**,
**Regenerate** ou **Discard draft** antes de continuar.

Clique em **Continue to editor** para um mapa novo, ou em **Add to working map**
para uma expansão. Depois que o histórico da campanha passa a citar IDs de local,
o Maps protege essas referências permitindo a expansão em vez da substituição
completa por algo sem relação.

## Criar ou editar um mapa manualmente

Com o mapa vazio, clique em **Build manually**. O Maps cria um local inicial
amplo. Selecione esse local na hierarquia e use:

- **Add child** para um lugar dentro do local selecionado;
- **Add sibling** para um lugar ao lado dele, sob o mesmo pai;
- **Duplicate** para copiar a subárvore de um local e depois editá-la; e
- **Archive** para aposentar um lugar sem apagar as referências históricas.

Defina o lugar inicial da história com **Set as starting location**. A hierarquia
precisa de um local inicial ativo antes de ser ativada. Ative o botão **Enabled**
e clique em **Save** depois de resolver os problemas apontados pelo editor.

## Entender o que chega ao modelo

Toda geração feita com um mapa salvo e ativado recebe um bloco oficial de
contexto espacial contendo:

- o caminho de navegação atual;
- o ID exato do local atual e a descrição pública;
- a memória privada do modelo do local atual exato, quando houver;
- os destinos alcançáveis em um movimento; e
- um índice limitado dos locais conhecidos ativos e dos IDs exatos deles.

O índice de locais conhecidos permite que a resposta reconheça uma chegada em
outro ponto do mundo salvo. Os destinos próximos também podem alimentar a prosa
comum ou as escolhas CYOA.

Os nomes dos pais dão orientação, mas as descrições, a memória privada, a arte e
o lore vinculado dos pais não são herdados. Se o local atual for
`Tower → Floor 7 → Alchemy Lab`, os detalhes do laboratório ficam ativos, enquanto a torre e o
andar contribuem apenas com os nomes no caminho de navegação.

A **Private model memory** (memória privada do modelo) é uma nota salva só para a
IA, e não uma memória que se atualiza sozinha. Use esse campo para segredos,
atmosfera, perigos permanentes, regras locais ou fatos que só devem valer naquele
lugar exato. Coloque na descrição pública ou na memória privada do modelo tudo
que precisa chegar ao modelo, em vez de depender só do resumo de percepção.

## Se mover durante a história

O Maps aceita viagem explícita, rotas planejadas e chegada narrada validada. O
movimento é salvo junto com o turno, então o local acompanha o histórico de
mensagens selecionado e o swipe.

### Colocar um destino explícito na fila

Selecionar um destino coloca o movimento na fila; nada acontece na hora. O
movimento é confirmado com a próxima mensagem que você enviar, o que mantém local
e turno em sincronia.

Os destinos de um movimento são:

- o pai do local atual;
- os filhos ativos do local atual; e
- os locais conectados por uma ligação direta disponível.

Só um passo hierárquico pode ser confirmado por turno. Use o X no destino
pendente para cancelá-lo. Se a revisão do mapa ou o local atual mudar antes do
envio, o movimento pendente passa para **Needs review**.

### Planejar uma rota de vários turnos

Selecione um local ativo distante no mapa do mundo. Se o grafo de pais, filhos e
ligações disponíveis tiver um caminho, o Maps mostra a rota mais curta e oferece
**Plan route**.

Uma rota coloca o primeiro passo na fila. Cada turno seguinte confirma um passo e
enfileira o próximo, até chegar ao destino. Cancele a rota quando quiser. Se o
mapa ou o local atual mudar de forma inesperada, a rota passa para **Needs
review** em vez de adivinhar um caminho novo.

Por exemplo, viajar do Floor 1 até o irmão Floor 25 normalmente leva um turno
para sair rumo à torre e outro para entrar no Floor 25. Uma ligação direta pode
transformar essa viagem em um passo só.

### Acompanhar a viagem narrada e descobrir lugares novos

O modelo recebe instruções protegidas para a chegada concluída:

- Se a resposta de fato chega a um local conhecido e ativo, o Maps pode mover o
  local atual para lá. Se a história revelou um caminho novo, o Maps registra uma
  conexão direta disponível.
- Se a resposta de fato chega a um lugar duradouro e desconhecido, o Maps pode
  acrescentá-lo como local filho ou conectado, mover a história para lá e
  preservar o caminho de volta.
- Intenções, menções, viagens que falharam ou não terminaram, acampamentos
  temporários, corredores e veículos não criam um local nem movem o marcador.

Por exemplo, depois de o usuário dizer "Vamos pegar missões no Quest Hall", uma
resposta que conclui a chegada pode levar o próximo estado da história para o
Quest Hall. Já "Devíamos visitar o Quest Hall mais tarde" deve manter o local
atual como está.

Esse comportamento é validado pelo aplicativo, mas ainda cabe ao modelo
identificar que a chegada aconteceu. Use **Set destination** quando você precisar
de um movimento garantido.

### Viagem no Roleplay

O controle **Story location** aparece acima da caixa de mensagem.

1. Abra o mapa da história para examinar a hierarquia e o caminho de navegação
   atual.
2. Selecione um local para ler a descrição dele.
3. Use **Explore inside**, **Browse up** ou o caminho de navegação para explorar
   sem se mover.
4. Clique em **Set destination** para um lugar alcançável, ou em **Plan route**
   para um alvo distante alcançável.
5. Envie a próxima mensagem para confirmar o passo em fila.

### Viagem no Game

O Game Mode acrescenta um **Hierarchical world map**. A marcação **You are here**
indica o local atual da história. Explorar, centralizar e examinar não movem a
equipe. Coloque um destino ou uma rota na fila e depois envie o próximo turno do
Game.

A resposta gerada do Game também pode atualizar o local hierárquico depois de uma
chegada narrada e concluída. Os detalhes do local atual passam então a embasar o
GM, a equipe, a arte da cena e a referência elegível do Storyboard.

## Mapa hierárquico do mundo x mapa comum do Game

O Game pode conter dois sistemas de mapa:

- O **World Maps** é o local oficial da história ou do mundo, como em
  `The Shattered Coast → Brinewatch → Tideglass Inn`.
- Um mapa comum do Game, em grade ou em nós, traz o detalhe local ou tático
  dentro daquele local da história e também participa do tempo e do clima do
  Game.

Quando o World Maps comanda a abertura do Game, o modelo selecionado ou o
rascunho revisado é que fornece o mundo inicial. O mapa comum do Game não é
reaproveitado como entrada de prompt nem promovido a hierarquia alternativa.

Em configurações avançadas, um local hierárquico pode ser vinculado a um mapa de
Game inteiro, a uma célula da grade ou a um nó. Selecionar uma posição vinculada
do Game prepara o movimento hierárquico correspondente; as posições sem vínculo
mantêm o comportamento tático normal. Salve a hierarquia antes de editar os
vínculos. Limpar um vínculo não exclui nenhum dos dois mapas.

## Dar identidade visual aos locais

As referências de local e os planos de fundo do mapa de filhos são independentes,
mesmo quando usam a mesma imagem da galeria.

| Arte                         | Para que serve                                                                                                                     | Vai para a geração de imagens?                                                                         |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| **Location reference image** | Fixa a identidade visual do lugar atual exato. Escolha na galeria ou crie com IA.                                                   | Sim, quando **Use for Roleplay illustrations and Game storyboards** está ativado e o pedido é elegível. |
| **Child map background**     | Aparece atrás dos locais filhos móveis de um pai que usa a apresentação Map. Cada camada do mapa pode ter o próprio plano de fundo. | Não. Serve só para exibição.                                                                           |

As referências de personagem ou de persona preservam quem está presente; a
referência de local preserva onde a cena acontece. Quando o provedor tem suporte
a isso, combinar as duas ajuda a manter personagens e planos de fundo coerentes
entre as imagens.

A esteira de imagens acrescenta esta instrução quando há uma referência de local
elegível anexada:

> Location handling: an attached location reference image is available. Use it
> to set the scene location.

Cada provedor tem os próprios limites de imagem de referência. As referências
pedidas explicitamente e as referências de personagem podem reduzir quantas
referências automáticas cabem.

### Definir uma referência de local

Selecione um local no editor e abra **Location reference image**.

- **Choose from Gallery** atribui uma imagem já revisada.
- **Create with AI** abre um prompt editável de imagem de ambientação e salva o
  resultado na galeria antes de você decidir se vai usá-lo.
- **Use for Roleplay illustrations and Game storyboards** controla se a imagem
  selecionada participa das gerações elegíveis.

Para um pai que usa a apresentação Map, abra **Child map background** à parte.
Escolha uma imagem da galeria e posicione-a atrás dos marcadores dos filhos. Essa
imagem nunca é enviada a um provedor só porque aparece no mapa.

### Gerar em lote as artes de local que faltam

A seção **Location artwork** do editor encontra os locais sem referência ou sem
plano de fundo do mapa de filhos.

1. Clique em **Review requests**.
2. Confira a quantidade de pedidos antes de gastar pedidos do provedor.
3. Confirme a conexão de imagem, o modelo, o estilo do Engine, o estado do estilo
   de arte da campanha, as instruções de imagem salvas e o tamanho de saída.
4. Edite cada prompt positivo e negativo, se precisar.
5. Cancele a revisão ou clique em **Generate N images** para confirmar.
6. Revise as artes geradas no mapa de trabalho e clique em **Save**.

Cada imagem que falta é um pedido separado ao provedor. Mundos grandes podem
ficar lentos ou caros, então a revisão continua rolável e mantém a quantidade de
pedidos à vista. Sempre que possível, a arte existente é reaproveitada sem um
novo pedido. Uma imagem nova vira a referência do local e também o plano de fundo
do mapa de filhos, quando esse mapa precisa de um.

Os prompts positivo e negativo exatos que aparecem na revisão são os enviados ao
provedor. O material do prompt positivo não é copiado para o prompt negativo.

## Personalizar o prompt automático de arte

Abra **Settings → Generations → Prompt Overrides** (Configurações) e selecione
**Maps location artwork**. Esse é o modelo global usado quando o Maps
pré-visualiza e gera a arte automática de local. As variáveis usam a sintaxe
`${variableName}` e podem ser inseridas pelo editor.

| Variável                                            | Significado                                                             |
| --------------------------------------------------- | ----------------------------------------------------------------------- |
| `${locationName}`                                   | Nome do local                                                           |
| `${locationDescription}`                            | Descrição pública do local exato                                        |
| `${locationType}`                                   | Region, Settlement, Place, Building, Floor ou Room                      |
| `${locationPrompt}`                                 | Prompt de ambientação completo preparado pelo Maps como alternativa     |
| `${parentLocationName}`                             | Nome do pai direto, ou vazio na raiz                                    |
| `${parentLocationDescription}`                      | Descrição pública do pai direto, ou vazio                               |
| `${locationPath}`                                   | Caminho de navegação completo, da raiz até o local                      |
| `${genre}` / `${genreLine}`                         | Gênero do Game, bruto ou pontuado; vazio fora do Game                   |
| `${campaignArtStyle}` / `${campaignArtStyleLine}`   | Estilo da campanha, só quando **Use campaign art style** está ativado   |
| `${imageInstructions}` / `${imageInstructionsLine}` | Instruções de imagem salvas no Chat Settings, brutas ou formatadas      |

O modelo interno usa o prompt exato do local mais o gênero, o estilo da campanha
e as instruções de imagem salvas, quando houver. Ele deixa de fora, de
propósito, a descrição do pai e o caminho completo, o que evita forçar um marco
do pai – uma torre, por exemplo – em toda imagem de filho ou de andar.

Personalizações comuns:

- Remova `${genreLine}` se o gênero do Game não deve aparecer na arte automática
  do mapa.
- Mantenha `${campaignArtStyleLine}` só se o botão liga/desliga **Use campaign
  art style** de cada chat deve controlar esse material. Com o botão desativado,
  a variável fica vazia.
- Acrescente `${parentLocationName}`, `${parentLocationDescription}` ou
  `${locationPath}` apenas quando o provedor precisar desse contexto mais amplo.
- Use **Reset to default** para voltar ao modelo interno.

O perfil de estilo do Engine e as configurações globais de imagem positiva e
negativa entram depois desse modelo. Eles continuam fazendo parte do fluxo
compartilhado de imagens do Illustrator, e não das configurações específicas do
Maps. Se sobrar texto inesperado no prompt negativo, verifique a configuração
global de imagem negativa e o campo editável da revisão.

## Vincular o lore aos locais

O World Maps usa o lore de duas maneiras:

1. O construtor de IA pode ler os lorebooks selecionados ao criar um rascunho ou
   uma expansão.
2. Um local salvo pode ativar entradas enquanto esse local exato for o atual.

Para anexar o lore em tempo de execução, selecione o local, abra **Linked lore**,
pesquise as entradas disponíveis, anexe as que quiser e salve.

As entradas vinculadas não passam do pai para o filho. O lore anexado a
Brinewatch não é acionado no Tideglass Inn, a não ser que também esteja anexado
lá.

O lore do local atual não precisa de correspondência de palavra-chave, mas
também não ignora os controles do lorebook. Livros e entradas desativados ou
excluídos do chat continuam indisponíveis, e as condições, o momento, a
probabilidade e o orçamento de tokens da entrada continuam valendo. As
referências que estiverem faltando ficam visíveis no editor, para você
consertá-las ou desanexá-las.

## Configurações avançadas de prompt do Maps

A página principal **Agents → World Maps** controla dois sistemas globais
de prompt:

- **Generation prompt** é uma biblioteca nomeada de Roleplay/Game para rascunhos
  e expansões de mapa com IA. Cada chat escolhe uma opção de forma independente.
  A pré-visualização resolvida usa a configuração, os personagens, o lore e o
  contexto de mapa atuais, sem fazer um pedido ao modelo.
- **Turn prompt insert** controla o texto de sistema global de Roleplay/Game que
  apresenta o local atual nos turnos comuns. Marinara mantém em volta dele o
  invólucro `<spatial_context>`, que pertence ao aplicativo, e as variáveis
  oficiais obrigatórias.

A opção **Connection Override** dessa mesma página afeta os rascunhos e as
expansões de mapa com IA. Deixe o campo vazio para usar a conexão do chat atual.
Essas configurações não substituem a opção **Maps location artwork**, que fica à
parte nas configurações globais de geração.

Esses controles são feitos para personalização avançada. Preserve as variáveis
obrigatórias e confira as pré-visualizações resolvidas antes de salvar.

## Importar, exportar e arquivar com segurança

Use **Export** para baixar a hierarquia de trabalho como um arquivo
`.world-map.json`. Deixe **Include map artwork** ativado para reunir no mesmo
arquivo as imagens de referência dos locais e os fundos dos mapas de filhos.
Desative a opção quando quiser um backup menor, só com a definição. Os arquivos
antigos `.hierarchical-map.json` continuam compatíveis com a importação.

Use **Import** para carregar uma hierarquia na cópia de trabalho. A arte
incluída é restaurada na Gallery do chat de destino, e os vínculos das imagens
são remapeados. Revise o resultado e clique em **Save** para torná-lo oficial.
A importação não salva na hora.

Depois que o histórico da campanha passa a citar um mapa, as mudanças importadas
precisam manter os IDs de local existentes. Acrescente ou atualize locais em vez
de trocar a hierarquia por outra com IDs sem relação.

O arquivamento preserva as referências antigas. Antes de arquivar um local:

- mova ou arquive os filhos ativos dele;
- escolha outro local inicial ativo, se necessário; e
- escolha um substituto ativo, caso ele seja o local atual em tempo de execução.

Os locais arquivados podem ser restaurados pelo painel Details.

## Solução de problemas

### World Maps não aparece no Chat Settings

Confirme que o pacote está instalado e que Marinara foi reiniciado. O chat ativo
precisa ser de Roleplay ou Game. Ative **Enable Agents** e depois ative
**World Maps** em **Tracker Agents**.

### A opção Add to chat não aparece na biblioteca de modelos

Abra um chat compatível de Roleplay ou Game antes de abrir a biblioteca. A
biblioteca mostra **Add to chat** tanto pela página principal do Hierarchical
Maps quanto pelas configurações do chat. Durante a configuração do Game, a ação
equivalente é **Use template**.

### A configuração do Game usou os locais errados ou os de reserva

Escolha **Use template**, selecione um modelo concreto no seletor e confirme
antes de concluir a configuração do Game. Revise a cópia de trabalho pertencente
ao Game e salve. O modelo da conta continua inalterado.

### O mapa não pode ser ativado

Crie pelo menos um local ativo e defina um local inicial ativo. Resolva todos os
problemas mostrados no topo do editor, depois ative e salve de novo.

### A geração de mapa com IA está indisponível

Verifique se o chat ou a opção **Connection Override** do Maps tem uma conexão
funcionando com um modelo de linguagem. Salve ou descarte as alterações abertas
no editor antes de reabrir o construtor de IA. Para uma expansão, escolha um alvo
ativo. Para a geração apoiada no lore, selecione pelo menos um lorebook ativado e
não excluído.

### O local atual não acompanhou uma mensagem

O movimento automático exige que a resposta gerada conclua uma chegada e produza
uma diretriz oculta válida do Maps. Intenção, conversa, viagem que falhou e
lugares passageiros não movem o marcador. Use **Set destination** para um
movimento garantido no próximo turno.

### Um destino ou uma rota mostra Needs review

A revisão do mapa ou o local atual mudou depois que o movimento entrou na fila.
Abra o mapa da história, confira o caminho atual e selecione o destino ou a rota
outra vez.

### Não consigo selecionar um local distante

Use **Plan route** se existir um caminho ativo de pais, filhos ou ligações. Se
não existir, acrescente uma ligação direta disponível ou viaje pelos lugares
alcançáveis, um turno por vez. Os controles de exploração nunca movem a história.

### O prompt automático de arte sempre inclui o gênero do Game

Abra **Settings → Generations → Prompt Overrides → Maps location artwork** e
remova `${genreLine}` do modelo. Salve a substituição e reabra a revisão de arte.

### O estilo da campanha aparece mesmo estando desativado

Verifique **Chat Settings → Illustrator → Use campaign art style**. Com esse
botão desativado, `${campaignArtStyle}` e `${campaignArtStyleLine}` resolvem para
vazio. O resumo da revisão deve mostrar o estilo de arte da campanha como
**Off**.

### Um marco do local pai aparece em toda imagem de filho

Evite `${parentLocationDescription}` e `${locationPath}` no modelo global de
arte, a não ser que sejam necessários. O prompt de local padrão fica limitado ao
local exato e deixa de fora esses campos mais amplos.

### O prompt negativo de imagem contém material inesperado

Revise e edite o campo negativo antes de confirmar. Depois, verifique a
configuração global compartilhada de imagem negativa. O modelo de arte do Maps
monta o prompt positivo; ele não é copiado para o campo negativo.

### Uma referência de local não é usada nas imagens nem nos Storyboards

Confirme que a imagem da galeria ainda existe e que a opção **Use for Roleplay
illustrations and Game storyboards** está ativada no local atual exato. O plano
de fundo do mapa de filhos serve só para exibição e não substitui uma referência,
a menos que a mesma imagem da galeria também seja atribuída como referência do
local.

### O modelo ignora o mapa

Confirme que o World Maps está ativo no chat, que a hierarquia está
**Enabled**, que as últimas alterações foram salvas e que aparece um local atual
no controle Story location. Use a pré-visualização resolvida do **Turn prompt
insert** para um diagnóstico avançado.

### O lore vinculado não é acionado

Confirme que a entrada está anexada ao local atual exato. Verifique se a entrada
e o lorebook estão ativados e se o lorebook não está excluído do chat.

## Guias relacionados

- [Agentes: ajudantes de IA para os seus chats](agents-overview.md)
- [Referência dos agentes para download](built-in-agents.md)
- [Visão geral dos lorebooks](../lorebooks/overview.md)
- [Roleplay Mode: primeiros passos](../roleplay/getting-started.md)
- [Game Mode: primeiros passos](../game/getting-started.md)
- [Game Mode: mapa, tempo e clima](../game/map-time-weather.md)
