# World Maps: instalação, criação e viagem

> **Compatibilidade atual:** este guia corresponde ao World Maps **1.3.1**. O
> pacote aceita Marinara Engine **2.3.5 a 3.x** e funciona em chats de Roleplay
> e Game. O Marinara Engine **2.4.1** acrescenta a limpeza coordenada do fluxo de
> movimento e a atualização imediata de Lorebooks após importações portáteis. O
> Engine **2.3.5 a 2.4.0** continua compatível, mas exige atualizar Lorebooks
> manualmente depois da importação e não inclui essa limpeza do fluxo.

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

Marinara mantém um local atual oficial dentro dessa hierarquia. A trilha de
navegação atual, os detalhes exatos do local, os destinos próximos e o lore
vinculado elegível servem de base para a próxima resposta. O mapa também
acompanha o movimento explícito ou a descoberta estabelecidos na última mensagem
do usuário. A narração visível da IA pode descrever o resultado, mas não move o
mapa nem inventa locais sozinha.

Os mapas podem ser independentes em cada chat ou ficar vinculados a um mundo
compartilhado da conta. Os modelos criam cópias limpas que podem seguir caminhos
diferentes. Já um mundo compartilhado mantém uma única hierarquia oficial e um
único conjunto de artes, enquanto cada chat vinculado guarda o próprio local
atual, o histórico de viagem, as capturas e os vínculos com o Game.

## Visão geral do recurso

O World Maps 1.3.1 oferece:

- regiões, assentamentos, lugares, edifícios, andares e cômodos aninhados;
- trilhas de navegação e um local atual oficial da história;
- visualização em lista, em mapa posicionado e em camadas ordenadas para os
  locais filhos;
- viagem entre pai e filho, ligações diretas e planejamento de rota em vários
  turnos;
- movimento validado e descoberta estabelecidos na última mensagem do usuário;
- mundos compartilhados da conta que podem ser vinculados a chats de Roleplay e
  Game;
- rascunhos revisados por chat, com controles de publicação, descarte, conflito e
  desvinculação;
- modelos de mapa da conta, criados manualmente, com IA ou por importação;
- rascunhos e expansões de mapa feitos com IA e apoiados na configuração ou no
  lore selecionado;
- descrições públicas do local, memória privada do modelo e lore do local exato;
- uma imagem de referência opcional da galeria do chat ou da Global Gallery (a
  galeria global da conta) para cada local;
- um plano de fundo separado, da galeria do chat ou da Global Gallery, para cada
  mapa de filhos posicionado;
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

## Escolher a relação certa entre o chat e o mapa

A biblioteca guarda dois recursos reutilizáveis que pertencem à conta, enquanto
cada chat mantém o próprio local em tempo de execução e o próprio histórico. O
nome amigável de um recurso não é a identidade dele: o World Maps 1.3.1
acrescenta **(copy)** ou um número quando um recurso recém-salvo ficaria com um
nome já usado.

| Recurso ou estado                    | Pertence a                        | Escolha quando                                                                                | O que as edições posteriores afetam                    |
| ------------------------------------ | --------------------------------- | --------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| **Mapa de chat independente**        | Um chat de Roleplay ou Game       | Esta história deve ter um mundo só dela                                                       | Só aquele chat                                         |
| **Modelo independente**              | A sua conta                       | Você quer um ponto de partida reutilizável                                                    | Só as cópias novas; os chats existentes não mudam      |
| **Mundo compartilhado oficial**      | A sua conta                       | Vários chats devem usar uma hierarquia mantida em um lugar só                                 | A definição compartilhada usada pelos chats vinculados |
| **Rascunho de chat vinculado**       | Um chat vinculado, até publicar   | Uma história vinculada descobriu ou editou algo que talvez caiba no mundo compartilhado       | Nenhum outro chat, até você escolher **Publish**       |
| **Cópia independente desvinculada**  | Um chat que já foi vinculado      | Esta história deve manter o mapa atual, mas parar de receber as edições do mundo compartilhado | Só o chat desvinculado                                 |

Copiar não é vincular. As opções **Use template**, **Add to chat** e
**Independent copy** criam mapas separados. Já **Use shared world**, na
configuração do Game, e **Link to chat**, na biblioteca, anexam o chat ao mundo
compartilhado oficial.

## Início rápido

1. Abra a página **Agents** (Agentes), clique em **Download Agents** (baixar
   agentes) e instale o **World Maps**.
2. Reinicie Marinara quando o aviso aparecer. O pacote contém código de servidor.
3. Abra um chat de Roleplay ou Game.
4. Abra o globo dedicado do **World Maps**, quando o Engine oferecer esse botão,
   ou use **Agents → World Maps**, e ative o pacote para o chat atual. Outra
   opção: ativar pela seção **Chat Settings → Agents** (configurações do chat)
   desse chat.
5. Crie o mapa com **Use template**, **Create with AI** ou **Build manually**.
   Chats já existentes também podem importar um arquivo de mapa.
6. Revise a hierarquia de trabalho, escolha um local inicial, ative o mapa e
   clique em **Save** (salvar).
7. Abra o **Story map** durante o chat. Selecione um destino alcançável e envie o
   próximo turno, ou estabeleça o movimento da equipe diretamente na mensagem,
   para que o Maps possa validar e aplicar a chegada.
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
tudo pronto, oferece a biblioteca de mapas do mundo da conta, indica qual é o
chat de destino no momento e mostra o status do mapa nesse chat. Instalar o
pacote deixa o recurso disponível, mas não o ativa em todos os chats.

### Roleplay

1. Abra o chat de Roleplay.
2. Abra **Chat Settings** pelo botão de engrenagem.
3. Ative **Enable Agents**.
4. Em **Tracker Agents**, ative **World Maps**.
5. Abra **Edit world map** (editar o mapa do mundo) ou a biblioteca **World map
   library**. Em versões compatíveis do Engine, o globo da barra superior do
   computador abre essa mesma biblioteca; no celular, use o globo do painel
   lateral **Chats**.

A biblioteca funciona igual, seja aberta pela página principal **Agents**, seja
pela seção **Chat Settings** do Roleplay. Use **Add to chat** para uma cópia
independente do modelo, ou **Link to chat** (vincular ao chat) para um mundo
compartilhado duradouro.

### Game

Durante a configuração do Game, escolha World Maps e depois selecione um dos
caminhos de configuração:

- **Create with AI** prepara uma hierarquia gerada para você revisar.
- **Use template** abre a biblioteca de mundos antes de o Game ser criado.
- **Build manually** começa com uma hierarquia em branco e editável.

Depois de escolher **Use template**, o seletor mostra primeiro a seção **Shared
worlds** e depois **Independent templates**:

- **Use shared world** vincula o novo Game àquele mundo oficial que pertence à
  conta. O Game continua com o próprio local atual, o próprio histórico, as
  próprias capturas, os próprios vínculos e as próprias descobertas não
  publicadas.
- **Use template** cria uma cópia de trabalho pertencente ao Game para revisão.
  O modelo da conta nunca é editado.

Os locais do recurso selecionado viram o mundo hierárquico inicial. Nenhum mapa
comum de Game entra como alternativa no lugar dele.

Também é possível adicionar World Maps a um Game já existente mais tarde,
em **Chat Settings → Agents**.

## Criar e reaproveitar modelos de mapa

Abra **World Maps → Open world library**. Os modelos pertencem à
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

Os modelos mantêm as referências de arte da Global Gallery, que valem para a
conta inteira. Ao usar **Save as template** (salvar como modelo) em um chat, o
Maps promove para a Global Gallery a arte do chat que estiver referenciada e
reaproveita uma imagem compartilhada idêntica, quando já existir uma. Cada chat
que aplica o modelo passa a apontar para essa mesma arte compartilhada, sem criar
outra cópia na galeria.

Só a arte é compartilhada. Cada definição de mapa aplicada continua sendo uma
cópia de trabalho independente: editar o modelo não atualiza os mapas já
adicionados aos chats.

## Vincular chats a um mundo compartilhado

Use a seção **Shared worlds** (mundos compartilhados) da **World map library**
quando vários chats de Roleplay ou Game precisarem ler a mesma hierarquia
oficial. Crie um mundo compartilhado em branco, importe um, promova um modelo
existente com **Make shared** (tornar compartilhado) ou abra um mapa de chat
salvo e escolha **Make shared**. Essa última opção promove para a Global Gallery
a arte do chat referenciada, cria o mundo pertencente à conta e vincula o chat
original a ele.

Escolha **Link to chat** para anexar o chat indicado no status de chat de destino
da biblioteca. O local atual e todos os IDs de local já usados pelo histórico da
campanha precisam existir no mundo compartilhado. Caso contrário, use
**Independent copy** (cópia independente) ou migre antes o mapa atual do chat
para um novo mundo compartilhado.

Os chats vinculados compartilham apenas a definição do mapa e a arte da Global
Gallery. Eles não compartilham mensagens, locais atuais, capturas de viagem,
estado do Game, vínculos com o mapa do Game, conexões de provedor nem
credenciais.

As edições e descobertas feitas dentro de um chat vinculado são salvas como um
rascunho não publicado daquele chat. Elas não mudam o mundo oficial nem os outros
chats enquanto você não escolher **Publish** (publicar). Outra opção: usar
**Discard** para descartar o rascunho, ou **Detach and keep copy** (desvincular e
manter a cópia) para parar de compartilhar mantendo a versão atual do chat. Se o
mundo oficial mudar enquanto um rascunho estiver pendente, o Maps avisa que há um
conflito e exige a desvinculação ou o descarte, em vez de sobrescrever qualquer
uma das versões em silêncio.

Editar um mundo compartilhado pela biblioteca atualiza a definição oficial
diretamente. O editor de mundo compartilhado não oferece exclusão permanente de
local; arquive os locais para que os IDs estáveis continuem disponíveis. Um chat
vinculado também não pode excluir nenhum local em definitivo enquanto você não
escolher **Detach and keep copy**. E o próprio mundo compartilhado não pode ser
excluído enquanto todos os chats vinculados não forem desvinculados ou
revinculados.

Os mundos compartilhados e os modelos mantêm as referências de arte da Global
Gallery sem copiar o arquivo de imagem para cada chat. Marinara bloqueia a
exclusão de uma imagem da Global Gallery enquanto um modelo salvo, um mundo
compartilhado, um mapa de chat independente ou o rascunho de um chat vinculado
ainda a referenciar. Remova antes os vínculos de arte, se a intenção for excluir
o próprio arquivo.

## Desvincular, substituir ou recomeçar

Cada uma dessas ações responde a uma pergunta diferente:

- Para parar de compartilhar preservando a hierarquia atual do chat vinculado,
  salve ou descarte as alterações pendentes do editor e escolha **Detach and
  keep copy**. O chat vira independente e deixa de receber as atualizações
  oficiais.
- Para continuar compartilhando, mas com outro mundo oficial, abra a biblioteca
  de mundos com o chat de destino indicado e escolha **Link to chat** no mundo
  substituto. As verificações de compatibilidade com o histórico continuam
  valendo.
- Para substituir o mapa de um chat independente, abra o editor dele e escolha
  **Replace / start over**. Antes disso, você pode salvar um modelo ou exportar
  um backup; depois, escolha **Create with AI**, **Use template or shared
  world**, **Import map file** ou **Start blank**.
- Para dar a um chat um mapa sem relação com o anterior, use esse mesmo fluxo de
  substituição. Remover e adicionar o agente de novo não zera o mapa.

A substituição continua sendo uma cópia de trabalho até você usar **Save**.
Salvar uma substituição limpa qualquer destino ou rota em fila. Depois que o
histórico de mensagens passa a citar IDs de local, o Maps pode recusar uma
substituição sem relação, para preservar as trilhas de navegação históricas.
Nesse caso, mantenha uma cópia independente e expanda ou arquive o mapa
existente.

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

- a trilha de navegação atual;
- o ID exato do local atual e a descrição pública;
- a memória privada do modelo do local atual exato, quando houver;
- os destinos alcançáveis em um movimento; e
- um índice limitado dos locais conhecidos ativos e dos IDs exatos deles.

O índice de locais conhecidos permite que a resposta reconheça uma chegada em
outro ponto do mundo salvo. Os destinos próximos também podem alimentar a prosa
comum ou as escolhas CYOA.

Os nomes dos pais dão orientação, mas as descrições, a memória privada, a arte e
o lore vinculado dos pais não são herdados. Se o local atual for
`Tower → Floor 7 → Alchemy Lab`, os detalhes do laboratório ficam ativos,
enquanto a torre e o andar contribuem apenas com os nomes na trilha de
navegação.

A **Private model memory** (memória privada do modelo) é uma nota salva só para a
IA, e não uma memória que se atualiza sozinha. Use esse campo para segredos,
atmosfera, perigos permanentes, regras locais ou fatos que só devem valer naquele
lugar exato. Coloque na descrição pública ou na memória privada do modelo tudo
que precisa chegar ao modelo, em vez de depender só do resumo de percepção.

## Mover-se durante a história

O Maps aceita viagem em fila, rotas planejadas e chegada validada conduzida pelo
usuário. O movimento é salvo junto com o turno, então o local acompanha o
histórico de mensagens selecionado e o swipe. Reiniciar Marinara não deve zerar o
local atual; ao trocar de ramificação ou de swipe, o Maps restaura a captura
espacial salva com aquele histórico selecionado.

### Colocar um destino explícito na fila

Selecionar um destino coloca o movimento na fila; nada acontece na hora. O
movimento é confirmado com a próxima mensagem que você enviar, o que mantém local
e turno em sincronia.

Os destinos alcançáveis em um movimento são:

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

Uma rota coloca o primeiro passo na fila. Cada turno que o usuário envia depois
disso confirma um passo e enfileira o próximo, até chegar ao destino; não existe
um botão separado para avançar. Cancele a rota quando quiser. Se o mapa ou o
local atual mudar de forma inesperada, a rota passa para **Needs review** em vez
de adivinhar um caminho novo.

Por exemplo, viajar do Floor 1 até o irmão Floor 25 normalmente leva um turno
para sair rumo à torre e outro para entrar no Floor 25. Uma ligação direta pode
transformar essa viagem em um passo só.

### Acompanhar a viagem conduzida pelo usuário e descobrir lugares novos

A última mensagem do usuário é a autoridade para as mudanças automáticas no mapa:

- Um movimento direto da equipe em foco, no presente ou no imperativo,
  estabelece a chegada. "Vamos para a Kitchen" e "Ela entra na área externa; nós
  vamos atrás dela" podem levar a história a locais conhecidos correspondentes.
- A chegada explícita a um lugar significativo, com nome, duradouro e que pode
  ser visitado de novo, ou a descoberta dele, pode acrescentá-lo ao mundo.
  "Descobrimos um cômodo escondido" pode criar esse local e entrar nele.
- A resposta visível pode narrar a consequência, mas a narração da IA sozinha
  nunca autoriza um movimento nem um local novo.
- Intenções futuras, viagens que falharam ou não terminaram, menções, movimento
  só de NPCs, lugares imaginários, acampamentos temporários, corredores,
  veículos e outros detalhes passageiros não criam nem movem locais.

Ainda cabe ao modelo interpretar a frase do usuário e emitir uma diretriz oculta
do Maps, que o aplicativo valida. Modelos de linguagem diferentes podem reagir de
formas distintas a uma prosa ambígua. Use **Set destination** para um movimento
garantido no próximo turno, ou **Set current story location** para corrigir um
estado já salvo.

Uma chegada validada e conduzida pelo usuário pode ignorar o limite de um passo:
quando é preciso, o Maps registra uma ligação direta disponível a partir do local
atual. Se já havia um destino na fila, esse movimento é salvo primeiro, junto com
a mensagem do usuário; depois, a chegada conduzida pelo usuário vira o local
final na resposta do assistente, e a fila de um passo é limpa. Em uma rota
planejada, a chegada ao próximo passo previsto avança normalmente. A chegada em
outro ponto, inclusive um salto para um passo mais adiante da rota, coloca a rota
em **Needs review**, para o Maps não reescrever o plano em silêncio. Cancele ou
replaneje essa rota a partir do local atual resultante.

### Local inicial x local atual da história

O **local inicial** é o padrão quando uma história nova começa. O **local atual
da história** é onde este chat está agora. Mudar o local inicial não conserta a
posição atual de um chat que já existe.

Para corrigir o estado salvo, selecione um local ativo no painel **Details** do
editor e escolha **Set current story location**. Isso é uma correção
administrativa, não uma viagem narrada. A correção passa a valer quando você
clica em **Save**. Ela limpa o destino ou a rota em fila e não reescreve as
mensagens anteriores.

### Viagem no Roleplay

O controle **Story location** aparece acima da caixa de mensagem.

1. Abra o mapa da história para examinar a hierarquia e a trilha de navegação
   atual.
2. Selecione um local para ler a descrição dele.
3. Use **Explore inside**, **Browse up** ou a trilha de navegação para explorar
   sem se mover.
4. Clique em **Set destination** para um lugar alcançável, ou em **Plan route**
   para um alvo distante alcançável.
5. Envie a próxima mensagem para confirmar o passo em fila.

### Viagem no Game

O Game Mode acrescenta um **Hierarchical world map**. A marcação **You are here**
indica o local atual da história. Explorar, centralizar e examinar não movem a
equipe. Coloque um destino ou uma rota na fila e depois envie o próximo turno do
Game.

Quando a última mensagem do usuário estabelece a chegada da equipe, a resposta
gerada do Game pode emitir o comando oculto que atualiza o local hierárquico. Os
detalhes do local atual passam então a embasar o GM, a equipe, a arte da cena e a
referência elegível do Storyboard.

## Mapa hierárquico do mundo x mapa comum do Game

O Game pode conter dois sistemas de mapa:

- O **World Maps** é o local oficial da história ou do mundo, como em
  `The Shattered Coast → Brinewatch → Tideglass Inn`.
- Um mapa comum do Game, em grade ou em nós, traz o detalhe local ou tático
  dentro daquele local da história e também participa do tempo e do clima do
  Game.

Quando o World Maps comanda a abertura do Game, o modelo de mapa selecionado ou
o rascunho revisado é que fornece o mundo inicial. O mapa comum do Game não é
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
| **Location reference image** | Fixa a identidade visual do lugar atual exato. Escolha uma arte do chat ou da Global Gallery compartilhada, ou crie com IA.         | Sim, quando **Use for Roleplay illustrations and Game storyboards** está ativado e o pedido é elegível. |
| **Child map background**     | Aparece atrás dos locais filhos móveis de um pai que usa a apresentação Map. Cada camada do mapa pode ter o próprio plano de fundo. | Não. Serve só para exibição.                                                                           |

As referências de personagem ou de persona preservam quem está presente; a
referência de local preserva onde a cena acontece. Quando o provedor tem suporte
a isso, combinar as duas ajuda a manter personagens e planos de fundo coerentes
entre as imagens.

O pipeline de imagens acrescenta esta instrução quando há uma referência de local
elegível anexada:

> Location handling: an attached location reference image is available. Use it
> to set the scene location.

Cada provedor tem os próprios limites de imagem de referência. As referências
pedidas explicitamente e as referências de personagem podem reduzir quantas
referências automáticas cabem.

### Definir uma referência de local

Selecione um local no editor e abra **Location reference image**.

- **Choose artwork** atribui uma imagem já revisada do chat atual ou da Global
  Gallery compartilhada. O seletor identifica a origem de cada uma.
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
**Maps location artwork**. Esse é o modelo de prompt global usado quando o Maps
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
| `${locationPath}`                                   | Trilha de navegação completa, da raiz até o local                       |
| `${genre}` / `${genreLine}`                         | Gênero do Game, bruto ou pontuado; vazio fora do Game                   |
| `${campaignArtStyle}` / `${campaignArtStyleLine}`   | Estilo da campanha, só quando **Use campaign art style** está ativado   |
| `${imageInstructions}` / `${imageInstructionsLine}` | Instruções de imagem salvas nas configurações do chat, brutas ou formatadas |

O modelo de prompt interno usa o prompt exato do local mais o gênero, o estilo
da campanha e as instruções de imagem salvas, quando houver. Ele deixa de fora,
de propósito, a descrição do pai e o caminho completo, o que evita forçar um
marco do pai – uma torre, por exemplo – em toda imagem de filho ou de andar.

Personalizações comuns:

- Remova `${genreLine}` se o gênero do Game não deve aparecer na arte automática
  do mapa.
- Mantenha `${campaignArtStyleLine}` só se quiser que o botão liga/desliga **Use
  campaign art style** de cada chat controle esse material. Com o botão
  desativado, a variável fica vazia.
- Acrescente `${parentLocationName}`, `${parentLocationDescription}` ou
  `${locationPath}` apenas quando o provedor precisar desse contexto mais amplo.
- Use **Reset to default** para voltar ao modelo de prompt interno.

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

Abrir uma entrada de lorebook vinculada faz você sair do editor de mapas. Salve o
mapa antes, quando quiser preservar outras edições pendentes, ou confirme de
propósito que elas podem ser descartadas. O World Maps 1.3.1 avisa quando essa
ação pode descartar alterações não salvas do mapa.

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

### Exportar um mapa portátil

Use **Export** no editor de um chat, de um modelo ou de um mundo compartilhado
para baixar a hierarquia de trabalho como um arquivo `.world-map.json`. Antes, escolha quanto lore vinculado deve acompanhar o mapa:

| Opção de lore | Conteúdo do arquivo |
| --- | --- |
| **Map only** | A hierarquia e a procedência legível entre locais e lore, sem conteúdo de lorebooks. Entradas ausentes não podem ser recriadas. |
| **Map + linked entries** | Só as entradas vinculadas pelo mapa e os caminhos de pasta necessários. É a opção portátil recomendada. |
| **Map + complete lorebooks** | Todas as entradas e pastas de cada lorebook vinculado, inclusive material não relacionado ao mapa. |

Antes de compartilhar, revise os lorebooks listados, a contagem de entradas, o tamanho estimado e o mapeamento expansível entre locais e lore. Lorebooks completos podem conter notas privadas ou sem relação. Deixe
**Include map artwork** ativado para reunir no mesmo arquivo as imagens de
referência dos locais e os planos de fundo dos mapas de filhos.
Desative a opção quando quiser um backup menor. Os arquivos
antigos `.hierarchical-map.json` continuam compatíveis com a importação.

### Importar um mapa e restaurar lore portátil

Use **Import** para carregar uma hierarquia na cópia de trabalho de um chat, em
um modelo independente ou em um mundo compartilhado. Quando o arquivo contém lorebooks, **Restore portable map lore** mostra os grupos **Exact IDs**, **Unique content**, **Need a choice** e **New entries**.

Um id exato só é oficial se pertencer ao lorebook de destino. Um id de outra origem é ambíguo: escolha a linha correta `Lorebook → Entry (ID)` ou **Import a new copy**. Sem id, o World Maps só reaproveita uma entrada quando todo o conteúdo portátil e as configurações têm uma única correspondência; o nome sozinho nunca basta.

Depois de revisar o resultado, escolha uma estratégia:

- **Import separate copies** não reaproveita entradas e cria lorebooks independentes, como `Original Lorebook - Map Name (World Map)`, acrescentando **(copy)** ou **(copy N)** para evitar colisões.
- **Reuse matches & import the rest** mantém correspondências exatas e únicas, aplica suas escolhas nas linhas ambíguas e cria lorebooks apenas para as entradas restantes.

O Maps lista os lorebooks reaproveitados e criados. As cópias criadas continuam na biblioteca se o mapa for excluído. O Engine **2.4.1** ou mais novo atualiza Lorebooks na hora; no **2.3.5 a 2.4.0**, recarregue o Marinara uma vez depois da restauração.

A arte incluída também é restaurada e remapeada. A arte do chat volta à Gallery de destino; a compartilhada é reaproveitada da Global Gallery ou adicionada uma vez. Revise e clique em **Save**; a importação não salva na hora. **Map only** preserva a procedência e os vínculos exatos de id existentes, mas não recria lorebooks ou entradas excluídos sem o conteúdo.

Depois que o histórico da campanha passa a citar um mapa, as mudanças importadas
precisam manter os IDs de local existentes. Acrescente ou atualize locais em vez
de trocar a hierarquia por outra com IDs sem relação.

### Arquivar ou excluir locais permanentemente

O arquivamento preserva as referências antigas. Antes de arquivar um local:

- mova ou arquive os filhos ativos dele;
- escolha outro local inicial ativo, se necessário; e
- escolha um substituto ativo, caso ele seja o local atual em tempo de execução.

Os locais arquivados podem ser restaurados pelo painel Details. O World Maps
1.3.1 também oferece **Delete permanently** (excluir em definitivo) para um local
arquivado ou para um ramo totalmente arquivado, quando é seguro removê-lo. O
editor desativa essa ação quando o local é o local inicial ou o local atual da
história já salvo, aparece no histórico de mensagens, tem um vínculo com o mapa
do Game, participa de um destino ou de uma rota em fila, ou pertence a um chat
ainda vinculado a um mundo compartilhado. Os editores de mundo compartilhado e de
modelo não oferecem exclusão permanente de local. Resolva antes a dependência
apontada, desvincule o chat vinculado quando fizer sentido, ou mantenha o local
arquivado.

A exclusão permanente tira o local do rascunho de trabalho e limpa as referências
de hierarquia e de ligação direta quando você clica em **Save**. Fechar sem
salvar continua descartando a exclusão. Os locais excluídos não aparecem mais nas
exportações; os locais arquivados que continuam protegidos seguem sendo
exportados, para que os IDs estáveis deles possam apoiar o histórico e os dados
vinculados. Não edite o JSON exportado para burlar essas proteções.

## Solução de problemas

### World Maps não aparece no Chat Settings

Confirme que o pacote está instalado e que Marinara foi reiniciado. O chat ativo
precisa ser de Roleplay ou Game. Ative **Enable Agents** e depois ative
**World Maps** em **Tracker Agents**.

### As opções Add to chat e Link to chat não aparecem na biblioteca de mundos

Abra um chat compatível de Roleplay ou Game antes de abrir a biblioteca. A
biblioteca indica o chat de destino e mostra **Add to chat** para os modelos ou
**Link to chat** para os mundos compartilhados. Durante a configuração do Game,
as ações equivalentes são **Use template** e **Use shared world**.

Se a biblioteca lista mundos compartilhados durante a configuração do Game, mas
não mostra **Use shared world**, o navegador pode estar rodando um cliente antigo
do pacote, de antes da atualização. Em qualquer editor de mapas aberto, salve o
mapa ou descarte o rascunho de propósito e feche o editor. Salve o trabalho não
relacionado, recarregue Marinara uma vez de forma forçada e reabra a configuração
do Game. As versões mais novas do Engine avisam explicitamente quando uma
atualização de pacote precisa dessa recarga.

### A configuração do Game usou os locais errados ou os de reserva

Escolha **Use template** e depois confirme **Use template**, para uma cópia
independente, ou **Use shared world**, para um vínculo oficial, antes de concluir
a configuração do Game. Revise e salve o mapa do Game. Um modelo continua
inalterado; um Game vinculado mantém as alterações não publicadas enquanto você
não escolher **Publish**.

### Um chat vinculado ainda mostra um mundo compartilhado antigo

Os editores limpos de chats vinculados armazenados na aba em que você publica são atualizados automaticamente. Um chat com mudanças não salvas ou não publicadas mantém o rascunho e mostra um conflito. Reabra os chats de outras abas ou janelas para buscar a nova revisão oficial.

### O mapa não pode ser ativado

Crie pelo menos um local ativo e defina um local inicial ativo. Resolva todos os
problemas mostrados no topo do editor, depois ative e salve de novo.

### A geração de mapa com IA está indisponível

Verifique se o chat ou a opção **Connection Override** do Maps tem uma conexão
funcionando com um modelo de linguagem. Salve ou descarte as alterações abertas
no editor antes de reabrir o construtor de IA. Para uma expansão, escolha um alvo
ativo. Para a geração apoiada no lore, selecione pelo menos um lorebook ativado e
não excluído.

### A geração de mapa com IA informa JSON incompleto ou malformado

Se a resposta terminou antes de produzir um JSON completo, aumente **Max Output Tokens** na conexão ou escolha um mapa menor e gere de novo. O World Maps não gasta outra solicitação tentando reparar uma resposta incompleta.

Se o JSON estiver malformado, uma correção apenas de sintaxe já foi tentada. Gere novamente; se o mesmo modelo falhar repetidamente, use outra conexão ou modelo. Alterar **Max Output Tokens** serve para o caso incompleto.

### O local atual não acompanhou uma mensagem

O movimento automático exige que a última mensagem do usuário estabeleça
diretamente a chegada da equipe em foco e que o modelo produza uma diretriz
oculta válida do Maps. A narração da IA sozinha, a intenção, a conversa, a viagem
que falhou, o movimento só de NPCs e os lugares passageiros não movem o marcador.
Tente uma frase direta, como "Vamos para a Kitchen". Use **Set destination** para
um movimento garantido no próximo turno.

### O local atual mudou depois de reabrir o chat

Confira qual ramificação de mensagens e qual swipe estão selecionados: o local
atual acompanha a captura espacial salva com esse histórico. Se o histórico
selecionado estiver certo e o marcador não, abra o editor de mapas, selecione o
local ativo correto, escolha **Set current story location** e clique em **Save**.

### Um destino ou uma rota mostra Needs review

A revisão do mapa ou o local atual mudou depois que o movimento entrou na fila.
Abra o mapa da história, confira o caminho atual e selecione o destino ou a rota
outra vez. Se o destino mostrado ainda estiver na fila, cancele-o antes de
selecioná-lo de novo.

### Uma rota planejada não avança

Cada turno do usuário deve confirmar o próximo passo mostrado e enfileirar o
seguinte. Não existe um controle separado para avançar. Se um turno concluído não
fizer a rota avançar, cancele-a e replaneje a partir do local atual. Se o local
salvo já estiver errado, use **Set current story location** e **Save**: essa
correção administrativa limpa a rota desatualizada.

### Este chat deveria usar um mapa completamente diferente

Abra o editor de mapas e escolha **Replace / start over**. Se precisar, preserve
antes um modelo ou uma exportação; depois, crie, importe, copie ou vincule o mapa
substituto. Se o chat for vinculado e precisar preservar a hierarquia atual, use
antes **Detach and keep copy**. Remover e adicionar o World Maps de novo não zera
o mapa dele.

### Um local distante não pode ser selecionado

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

**Outras regras do World Maps 1.3.1:** geração guiada, regeneração e continuação não criam um turno do usuário, então não consomem um destino ou passo de rota na fila. **Impersonate** cria uma mensagem do usuário: um turno bem-sucedido confirma o movimento uma vez, uma falha do provedor não confirma nada e um movimento desatualizado volta para **Needs review**.

No Marinara Engine **2.4.1** ou mais novo, as diretrizes completas de movimento e descoberta do Maps são removidas do texto transmitido e das mensagens salvas sem alterar textos comuns entre colchetes nem seus espaços. Se uma diretriz bruta aparecer, atualize Engine e World Maps, reinicie quando solicitado e gere de novo ou remova a mensagem afetada.

Quando uma imagem da Gallery cumpre os dois papéis, **Remove reference only** a mantém como fundo do mapa filho; **Reject both and create replacement** troca ambos e **Use for both** atribui uma nova imagem aos dois. Um link salvo da Gallery cuja imagem sumiu também conta como ausente. Um resultado concluído durante a edição só preenche os papéis ainda vazios e não substitui uma imagem nova, o botão de referência, a posição do fundo, o estado de arquivo nem outras mudanças do rascunho.

**Open** em uma entrada vinculada sai do mapa e abre o lorebook. Um rascunho limpo fecha imediatamente; com mudanças não salvas, salve antes ou confirme o descarte. Se o lore importado não for ativado, veja o resumo: **Map only** não traz conteúdo restaurável. Use **Map + linked entries** ou **Map + complete lorebooks** e escolha a correspondência exata, o destino ambíguo ou uma cópia separada. O lore ligado ao pai não é herdado pelos locais filhos.

## Guias relacionados

- [Agentes: ajudantes de IA para os seus chats](agents-overview.md)
- [Referência dos agentes para download](built-in-agents.md)
- [Visão geral dos lorebooks](../lorebooks/overview.md)
- [Roleplay Mode: primeiros passos](../roleplay/getting-started.md)
- [Game Mode: primeiros passos](../game/getting-started.md)
- [Game Mode: mapa, tempo e clima](../game/map-time-weather.md)
