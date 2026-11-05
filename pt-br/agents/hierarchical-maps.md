# World Maps: instalação, criação e viagem

> **Compatibilidade atual:** este guia corresponde ao World Maps **1.3.1**, que é compatível com o Marinara Engine **2.3.5 a 3.x** em chats de Roleplay e Game. O Engine **2.4.1** acrescenta a limpeza do fluxo de movimento e a atualização imediata de Lorebooks após importações portáteis. O Engine 2.3.5 a 2.4.0 continua funcionando, mas exige atualizar Lorebooks manualmente depois de uma importação.

O World Maps dá à sua história um mapa de lugares que podem ficar uns dentro dos outros, como um litoral, uma cidade, um bairro e uma estalagem. Marinara sempre sabe onde a equipe está, e a IA usa isso para se manter coerente. Para experimentar: instale o **World Maps** no **Agent Organizer** (organizador de agentes), reinicie e siga o [Início rápido](#quick-start).

Em vez de um único local em texto livre, o mundo é um conjunto de lugares aninhados:

```text
The Shattered Coast
└── Brinewatch
    ├── Harbor District
    │   ├── Tideglass Inn
    │   └── Quest Hall
    └── Old Sewers
```

Marinara mantém um local atual oficial dentro dessa hierarquia. A trilha de navegação atual, os detalhes exatos do local, os destinos próximos e o lore vinculado elegível servem de base para a próxima resposta. O mapa também pode acompanhar o movimento explícito ou a descoberta estabelecidos na última mensagem do usuário. A narração visível da IA pode descrever o resultado, mas não move o mapa nem inventa locais sozinha.

Os mapas podem ser independentes em cada chat ou ficar vinculados a um mundo compartilhado da conta. Os modelos criam cópias limpas que podem seguir caminhos diferentes. Já um mundo compartilhado mantém uma única hierarquia oficial e um único conjunto de artes, enquanto cada chat vinculado guarda o próprio local atual, o histórico de viagem, os instantâneos e os vínculos com o Game.

## Visão geral do recurso

O World Maps 1.3.1 oferece:

- regiões, assentamentos, lugares, edifícios, andares e cômodos aninhados, com trilhas de navegação e um local atual oficial da história;
- visualização em lista, em mapa posicionado e em camadas ordenadas, viagem entre pai e filho, ligações diretas e rotas de vários turnos;
- movimento validado e descoberta estabelecidos na sua última mensagem;
- modelos da conta e mundos compartilhados que você pode vincular a chats de Roleplay e Game, com rascunhos revisados por chat;
- rascunhos e expansões de mapa feitos com IA, descrições públicas, memória privada do modelo e lore do local exato;
- importação e exportação portáteis, com lore vinculado e artes opcionais;
- imagens de referência e planos de fundo para os locais, com geração em lote revisada das artes que faltam; e
- bibliotecas globais de prompt para a construção de mapas com IA e para a inserção do local em tempo de execução.

Os destinos disponíveis estão no contexto do modelo. Com as escolhas CYOA ativadas, o modelo pode oferecer os filhos do local atual ou os lugares conectados como próximas opções. As escolhas exatas continuam sendo geradas pelo modelo.

## Escolher a relação certa entre o chat e o mapa

A biblioteca guarda dois recursos reutilizáveis que pertencem à conta, enquanto cada chat mantém o próprio local em tempo de execução e o próprio histórico. O nome amigável de um recurso não é a identidade dele: o World Maps 1.3.1 acrescenta **(copy)** ou um número quando um recurso recém-salvo ficaria com um nome já usado.

| Recurso ou estado | Pertence a | Escolha quando | O que as edições posteriores afetam |
| --- | --- | --- | --- |
| **Mapa de chat independente** | Um chat de Roleplay ou Game | Esta história deve ter um mundo só dela | Só aquele chat |
| **Modelo independente** | A sua conta | Você quer um ponto de partida reutilizável | Só as cópias novas; os chats existentes não mudam |
| **Mundo compartilhado oficial** | A sua conta | Vários chats devem usar uma hierarquia mantida em um lugar só | A definição compartilhada usada pelos chats vinculados |
| **Rascunho de chat vinculado** | Um chat vinculado, até publicar | Uma história vinculada descobriu ou editou algo que talvez caiba no mundo compartilhado | Nenhum outro chat, até você escolher **Publish** |
| **Cópia independente desvinculada** | Um chat que já foi vinculado | Esta história deve manter o mapa atual, mas parar de receber as edições do mundo compartilhado | Só o chat desvinculado |

Copiar não é vincular. As opções **Use template**, **Add to chat** e **Independent copy** criam mapas separados. Já **Use shared world**, na configuração do Game, e **Link to chat**, na biblioteca, anexam o chat ao mundo compartilhado oficial.

<a id="quick-start"></a>

## Início rápido

1. Abra **Agents** (Agentes), clique em **Agent Organizer** e instale o **World Maps**. Reinicie Marinara quando o aviso aparecer, porque o pacote tem código de servidor.
2. Abra um chat de Roleplay ou Game.
3. Abra **Agents → World Maps** (ou o globo do World Maps, quando o seu Engine tiver um) e ative-o para o chat. Você também pode ativá-lo em **Chat Settings → Agents** (configurações do chat → agentes).
4. Crie o mapa com **Use template**, **Create with AI** ou **Build manually**. Chats já existentes também podem importar um arquivo de mapa.
5. Revise a hierarquia de trabalho, escolha um local inicial, ative **Enabled** (ativado) e clique em **Save** (salvar).
6. Abra o **Story map** durante o chat. Selecione um destino alcançável e envie o seu próximo turno, ou descreva o movimento da equipe na sua mensagem, para que o Maps possa validar e aplicar a chegada.
7. Opcional: atribua artes da galeria aos locais ou use **Location artwork** para revisar e gerar as imagens que faltam.

Aplicar um modelo, um rascunho de IA ou um arquivo importado muda apenas a cópia de trabalho do editor. Isso não afeta as respostas enquanto a hierarquia não for ativada e salva.

Se não funcionou, veja [World Maps não aparece no Chat Settings](#world-maps-is-missing-from-chat-settings).

## Instalar e ativar o pacote

A página do World Maps mostra a versão instalada e se está tudo pronto, a biblioteca de mapas do mundo da conta, o chat de destino e o status do mapa nesse chat. Instalar o pacote deixa o recurso disponível. Isso não o ativa em todos os chats.

### Roleplay

1. Abra o chat de Roleplay e clique em **Chat Settings**.
2. Ative **Enable Agents**.
3. Em **Tracker Agents**, ative **World Maps**.
4. Abra **Edit world map** (editar o mapa do mundo) ou a **World map library** (biblioteca de mapas do mundo). Em versões compatíveis do Engine, o globo da barra superior do computador abre essa mesma biblioteca. No celular, use o globo do painel lateral Chats.

A biblioteca funciona igual, onde quer que você a abra. Use **Add to chat** (adicionar ao chat) para uma cópia independente do modelo, ou **Link to chat** (vincular ao chat) para um mundo compartilhado duradouro.

### Game

Durante a configuração do Game, escolha World Maps e depois selecione um dos caminhos de configuração:

- **Create with AI** prepara uma hierarquia gerada para você revisar.
- **Use template** abre a biblioteca de mundos antes de o Game ser criado.
- **Build manually** começa com uma hierarquia em branco e editável.
- **From the world** (a partir do mundo) aparece quando o Game cria um mundo (veja [Criar um mundo](../game/getting-started.md#making-a-world)). Ele dispõe esse mundo como o mapa: as regiões, os assentamentos e os lugares dele, e os caminhos entre eles com os tempos de viagem. Você revisa o resultado antes de ele ser salvo. Não precisa de geração por IA, e os lugares do mapa são os lugares do mundo. Durante o jogo, os dois andam juntos. O Game Master e os mercados usam o lugar onde o mapa coloca a equipe. Quando o Game Master cita um lugar do mundo, o mapa leva a equipe até lá. Com o World Maps 1.6.0 ou posterior, ele faz o caminho mais curto. Versões anteriores avançam só um passo: um lugar dentro do atual, o lugar ao redor dele ou um lugar ligado a ele por um caminho.

Depois de escolher **Use template**, o seletor mostra primeiro a seção **Shared worlds** e depois **Independent templates**:

- **Use shared world** vincula o novo Game àquele mundo oficial que pertence à conta. O Game continua com o próprio local atual, o próprio histórico, os próprios instantâneos, os próprios vínculos e as próprias descobertas não publicadas.
- **Use template** cria uma cópia de trabalho pertencente ao Game para revisão. O modelo da conta nunca é editado.

Os locais do recurso selecionado viram o mundo hierárquico inicial. Nenhum mapa comum de Game entra como alternativa no lugar dele.

Também é possível adicionar World Maps a um Game já existente mais tarde, em **Chat Settings → Agents**.

## Criar e reaproveitar modelos de mapa

Abra **World Maps → Open world library**. Os modelos pertencem à sua conta, e não a um chat só, então servem bem para mundos de fandom reutilizáveis, cenários de campanha, masmorras e cidades.

Pela biblioteca, você pode criar um modelo manualmente ou com **Create with AI**, importar um arquivo `.hierarchical-map.json`, pesquisar, ver, editar, exportar ou excluir um modelo, usar **Add to chat** com um chat de Roleplay ou Game aberto, ou escolher **Use template** durante a configuração do Game.

Cada uso cria uma cópia de trabalho independente. Edições posteriores no modelo não mudam os chats que já o copiaram, e as edições feitas no chat não mudam o modelo.

Os modelos mantêm as referências de arte da Global Gallery (a galeria global da conta), que valem para a conta inteira. Ao usar **Save as template** (salvar como modelo) em um chat, o Maps promove para a Global Gallery a arte do chat que estiver referenciada e reaproveita uma imagem compartilhada idêntica, quando existir uma. Só a arte é compartilhada. Cada mapa aplicado continua sendo uma cópia independente.

## Vincular chats a um mundo compartilhado

Use a seção **Shared worlds** (mundos compartilhados) da World map library quando vários chats de Roleplay ou Game precisarem ler a mesma hierarquia. Crie um mundo compartilhado em branco, importe um, promova um modelo com **Make shared** (tornar compartilhado) ou abra um mapa de chat salvo e escolha **Make shared**. Essa última opção promove para a Global Gallery a arte do chat referenciada, cria o mundo compartilhado e vincula o chat original a ele.

Escolha **Link to chat** para anexar o chat indicado no status de chat de destino da biblioteca. O local atual e todos os IDs de local já usados pelo histórico da campanha precisam existir no mundo compartilhado. Caso contrário, use **Independent copy** (cópia independente) ou migre antes o mapa atual do chat para um novo mundo compartilhado.

Os chats vinculados compartilham apenas a definição do mapa e a arte da Global Gallery. Eles não compartilham mensagens, locais atuais, instantâneos de viagem, estado do Game, vínculos com o mapa do Game, conexões de provedor nem credenciais.

As edições e descobertas feitas dentro de um chat vinculado são salvas como um rascunho não publicado daquele chat. Elas não mudam o mundo oficial nem os outros chats enquanto você não escolher **Publish** (publicar). Outra opção: usar **Discard** para descartar o rascunho, ou **Detach and keep copy** (desvincular e manter a cópia) para parar de compartilhar mantendo a versão atual do chat. Se o mundo oficial mudar enquanto um rascunho estiver pendente, o Maps avisa que há um conflito e exige a desvinculação ou o descarte, em vez de sobrescrever qualquer uma das versões em silêncio.

Quando você publica, os editores de chats vinculados sem alterações não salvas que estão em cache nesta aba do navegador passam para a nova revisão oficial. Editores com trabalho não salvo mantêm o rascunho e mostram um conflito em vez de serem sobrescritos. Reabra os chats vinculados em outras abas ou janelas do navegador para carregar a nova revisão nelas.

Editar um mundo compartilhado pela biblioteca atualiza a definição oficial diretamente. O editor de mundo compartilhado não oferece exclusão permanente de local; arquive os locais para que os IDs estáveis continuem disponíveis. Um chat vinculado também não pode excluir nenhum local em definitivo enquanto você não escolher **Detach and keep copy**. E o próprio mundo compartilhado não pode ser excluído enquanto todos os chats vinculados não forem desvinculados ou revinculados.

Os mundos compartilhados e os modelos mantêm as referências de arte da Global Gallery sem copiar o arquivo de imagem para cada chat. Marinara bloqueia a exclusão de uma imagem da Global Gallery enquanto um modelo salvo, um mundo compartilhado, um mapa de chat independente ou o rascunho de um chat vinculado ainda a referenciar. Remova antes os vínculos de arte, se a intenção for excluir o próprio arquivo.

## Desvincular, substituir ou recomeçar

Cada uma dessas ações responde a uma pergunta diferente:

- Para parar de compartilhar preservando a hierarquia atual do chat vinculado, salve ou descarte as alterações pendentes do editor e escolha **Detach and keep copy**. O chat vira independente e deixa de receber as atualizações oficiais.
- Para continuar compartilhando, mas com outro mundo oficial, abra a biblioteca de mundos com o chat de destino indicado e escolha **Link to chat** no mundo substituto. As verificações de compatibilidade com o histórico continuam valendo.
- Para substituir o mapa de um chat independente, abra o editor dele e escolha **Replace / start over**. Antes disso, você pode salvar um modelo ou exportar um backup; depois, escolha **Create with AI**, **Use template or shared world**, **Import map file** ou **Start blank**.
- Para dar a um chat um mapa sem relação com o anterior, use esse mesmo fluxo de substituição. Remover e adicionar o agente de novo não zera o mapa.

A substituição continua sendo uma cópia de trabalho até você usar **Save**. Salvar uma substituição limpa qualquer destino ou rota em fila. Depois que o histórico de mensagens passa a citar IDs de local, o Maps pode recusar uma substituição sem relação, para preservar as trilhas de navegação históricas. Nesse caso, mantenha uma cópia independente e expanda ou arquive o mapa existente.

## Entender o editor de mapas

No computador, o editor mostra três painéis. Em telas estreitas, alterne entre as abas **Hierarchy**, **Local** e **Details**.

- A aba **Hierarchy** mostra a árvore completa. Ao selecionar um local, você o edita. O botão **Enter** muda a parte da hierarquia que está sendo visualizada; ele não move a história.
- A aba **Local** mostra os filhos imediatos do local atual em lista, mapa posicionado ou camadas ordenadas.
- A aba **Details** edita o texto do local, a hierarquia, o lore, a arte, as ligações, o status e os vínculos com o mapa do Game.

O cabeçalho do editor traz os controles de construção com IA, além de **Templates**, **Export**, **Import**, o botão liga/desliga Enabled e **Save**. Alterações não salvas ficam marcadas como **Unsaved**. Se você sair com trabalho não salvo, Marinara pergunta se deve descartá-lo.

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
- uma imagem de referência do local e um botão liga/desliga opcional de uso da imagem;
- um plano de fundo próprio para o mapa de filhos, quando a apresentação for Map; e
- status ativo ou arquivado.

Na apresentação **Map**, arraste os filhos para o lugar ou digite as posições X e Y exatas, de 0 a 100. O pai selecionado também pode ter uma imagem da galeria atrás dos filhos. Na apresentação **Layers**, dê a cada filho uma ordem de camada distinta.

As ligações diretas podem conectar quaisquer lugares válidos da hierarquia: uma balsa entre cidades, uma escada entre andares selecionados, um portal entre mundos ou uma passagem secreta entre cômodos de edifícios diferentes.

Uma torre de 25 andares normalmente deve modelar os andares como irmãos sob uma única torre, e não como uma cadeia de pais com 25 níveis. O mapa aceita até 5.000 locais e 20 níveis de hierarquia.

## Criar ou expandir um mapa com IA

Com o mapa vazio, clique em **Create with AI** ou **Draft with AI**. Com um mapa já existente, clique em **Expand with AI**.

### Escolher o que o construtor lê

Em **Build from**, escolha uma destas fontes:

- **Game setup** usa a configuração e os personagens atuais. No Game, isso inclui a visão geral do mundo e os personagens da equipe.
- **Selected lore** usa os lorebooks escolhidos. A opção **Strict canon** cria apenas lugares apoiados no lore. A opção **Canon + expansion** permite acréscimos que combinem com o material.

O construtor não lê o histórico de turnos. Acrescente o que faltar na configuração ou no lore aos campos **What should this world include?** ou **What should be added?**

Escolha um tamanho:

| Tamanho | Resultado aproximado |
| --- | --- |
| **Small** | 8 lugares |
| **Medium** | 16 lugares |
| **Large** | 28 lugares |

A geração cria um rascunho, não um mapa salvo. Pesquise ou expanda a pré-visualização completa, selecione locais e revise os caminhos, as descrições, a memória privada do modelo e a origem no lore. Use **Edit prompt**, **Regenerate** ou **Discard draft** antes de continuar.

Se o modelo devolver um JSON completo, mas malformado, o World Maps faz uma única tentativa de reparo só de formatação. A solicitação de reparo instrui o modelo a preservar todos os locais e valores gerados, corrigindo apenas a sintaxe do JSON. Uma resposta incompleta não vai para reparo. Nesse caso, o Maps pede que você aumente o **Max Output Tokens** da conexão ou escolha um tamanho de mapa menor antes de tentar de novo.

Clique em **Continue to editor** para um mapa novo, ou em **Add to working map** para uma expansão. Depois que o histórico da campanha passa a citar IDs de local, o Maps protege essas referências permitindo a expansão em vez da substituição completa por algo sem relação.

## Criar ou editar um mapa manualmente

Com o mapa vazio, clique em **Build manually**. O Maps cria um local inicial amplo. Selecione esse local na hierarquia e use:

- **Add child** para um lugar dentro do local selecionado;
- **Add sibling** para um lugar ao lado dele, sob o mesmo pai;
- **Duplicate** para copiar a subárvore de um local e depois editá-la; e
- **Archive** para aposentar um lugar sem apagar as referências históricas.

Defina o lugar inicial da história com **Set as starting location**. A hierarquia precisa de um local inicial ativo antes de ser ativada. Ative **Enabled** e clique em **Save** depois de resolver os problemas apontados pelo editor.

## Entender o que chega ao modelo

Toda geração feita com um mapa salvo e ativado recebe um bloco oficial de contexto espacial contendo:

- a trilha de navegação atual;
- o ID exato do local atual e a descrição pública;
- a memória privada do modelo do local atual exato, quando houver;
- os destinos alcançáveis em um movimento; e
- um índice limitado dos locais conhecidos ativos e dos IDs exatos deles.

O índice de locais conhecidos permite que a resposta reconheça uma chegada em outro ponto do mundo salvo. Os destinos próximos também podem alimentar a prosa comum ou as escolhas CYOA.

Os nomes dos pais dão orientação, mas as descrições, a memória privada, a arte e o lore vinculado dos pais não são herdados. Se o local atual for `Tower → Floor 7 → Alchemy Lab`, os detalhes do laboratório ficam ativos, enquanto a torre e o andar contribuem apenas com os nomes na trilha de navegação.

A **Private model memory** (memória privada do modelo) é uma nota salva só para a IA, e não uma memória que se atualiza sozinha. Use esse campo para segredos, atmosfera, perigos permanentes, regras locais ou fatos que só devem valer naquele lugar exato. Coloque na descrição pública ou na memória privada do modelo tudo que precisa chegar ao modelo, em vez de depender só do resumo de percepção.

## Mover-se durante a história

O Maps aceita viagem em fila, rotas planejadas e chegada validada conduzida pelo usuário. O movimento é salvo junto com o turno, então o local acompanha o histórico de mensagens selecionado e o swipe. Reiniciar Marinara não foi pensado para zerar o local atual; ao trocar de ramificação ou de swipe, o Maps restaura o instantâneo espacial salvo com aquele histórico selecionado.

### Colocar um destino explícito na fila

Selecionar um destino coloca o movimento na fila; nada acontece na hora. O movimento é confirmado com a próxima mensagem que você enviar, o que mantém local e turno em sincronia.

Os destinos alcançáveis em um movimento são:

- o pai do local atual;
- os filhos ativos do local atual; e
- os locais conectados por uma ligação direta disponível.

Só um passo hierárquico pode ser confirmado por turno. Use o X no destino pendente para cancelá-lo. Se a revisão do mapa ou o local atual mudar antes do envio, o movimento pendente passa para **Needs review**.

Geração guiada, regeneração e continuação não criam um novo turno do usuário, então não consomem um destino ou um passo de rota na fila. **Impersonate** cria uma mensagem do usuário. Por isso, um turno de Impersonate bem-sucedido confirma o movimento na fila uma vez; uma falha do provedor não confirma nada, e um movimento desatualizado volta para revisão em vez de mudar o local.

### Planejar uma rota de vários turnos

Selecione um local ativo distante no mapa do mundo. Se o grafo de pais, filhos e ligações disponíveis tiver um caminho, o Maps mostra a rota mais curta e oferece **Plan route**.

Uma rota coloca o primeiro passo na fila. Cada turno que o usuário envia depois disso confirma um passo e enfileira o próximo, até chegar ao destino; não existe um botão separado para avançar. Cancele a rota quando quiser. Se o mapa ou o local atual mudar de forma inesperada, a rota passa para **Needs review** em vez de adivinhar um caminho novo.

Por exemplo, viajar do Floor 1 até o irmão Floor 25 normalmente leva um turno para sair rumo à torre e outro para entrar no Floor 25. Uma ligação direta pode transformar essa viagem em um passo só.

### Acompanhar a viagem conduzida pelo usuário e descobrir lugares novos

A última mensagem do usuário é a autoridade para as mudanças automáticas no mapa:

- Um movimento direto da equipe em foco, no presente ou no imperativo, estabelece a chegada. "Vamos para a Kitchen" e "Ela entra na área externa; nós vamos atrás dela" podem levar a história a locais conhecidos correspondentes.
- A chegada explícita a um lugar significativo, com nome, duradouro e que pode ser visitado de novo, ou a descoberta dele, pode acrescentá-lo ao mundo. "Descobrimos um cômodo escondido" pode criar esse local e entrar nele.
- A resposta visível pode narrar a consequência, mas a narração da IA sozinha nunca autoriza um movimento nem um local novo.
- Intenções futuras, viagens que falharam ou não terminaram, menções, movimento só de NPCs, lugares imaginários, acampamentos temporários, corredores, veículos e outros detalhes passageiros não criam nem movem locais.

Ainda cabe ao modelo interpretar a frase do usuário e emitir uma diretriz oculta do Maps, que o aplicativo valida. Modelos de linguagem diferentes podem reagir de formas distintas a uma prosa ambígua. Use **Set destination** para um movimento garantido no próximo turno, ou **Set current story location** para corrigir um estado já salvo.

No Marinara Engine **2.4.1** ou mais novo, as diretrizes completas de movimento e descoberta do Maps são removidas do texto em streaming e das mensagens salvas. A prosa comum entre colchetes e os espaços dela continuam iguais. Se uma diretriz bruta do Maps aparecer em uma mensagem, atualize o Marinara Engine e o World Maps, reinicie quando o aplicativo pedir e gere de novo ou remova a mensagem afetada, para que ela não seja repetida no contexto mais tarde.

Uma chegada validada e conduzida pelo usuário pode ignorar o limite de um passo: quando é preciso, o Maps registra uma ligação direta disponível a partir do local atual. Se já havia um destino na fila, esse movimento é salvo primeiro, junto com a mensagem do usuário; depois, a chegada conduzida pelo usuário vira o local final na resposta do assistente, e a fila de um passo é limpa. Em uma rota planejada, a chegada ao próximo passo previsto avança normalmente. A chegada em outro ponto, inclusive um salto para um passo mais adiante da rota, coloca a rota em **Needs review**, para o Maps não reescrever o plano em silêncio. Cancele ou replaneje essa rota a partir do local atual resultante.

### Local inicial x local atual da história

O **local inicial** é o padrão quando uma história nova começa. O **local atual da história** é onde este chat está agora. Mudar o local inicial não conserta a posição atual de um chat que já existe.

Para corrigir o estado salvo, selecione um local ativo no painel **Details** do editor e escolha **Set current story location**. Isso é uma correção administrativa, não uma viagem narrada. A correção passa a valer quando você clica em **Save**. Ela limpa o destino ou a rota em fila e não reescreve as mensagens anteriores.

### Viagem no Roleplay

O controle **Story location** aparece acima da caixa de mensagem.

1. Abra o mapa da história para examinar a hierarquia e a trilha de navegação atual.
2. Selecione um local para ler a descrição dele.
3. Use **Explore inside**, **Browse up** ou a trilha de navegação para explorar sem se mover.
4. Clique em **Set destination** para um lugar alcançável, ou em **Plan route** para um alvo distante alcançável.
5. Envie a próxima mensagem para confirmar o passo em fila.

### Viagem no Game

O Game Mode acrescenta um **Hierarchical world map**. A marcação **You are here** indica o local atual da história. Explorar, centralizar e examinar não movem a equipe. Coloque um destino ou uma rota na fila e depois envie o próximo turno do Game.

Quando a última mensagem do usuário estabelece a chegada da equipe, a resposta gerada do Game pode emitir o comando oculto que atualiza o local hierárquico. Os detalhes do local atual passam então a embasar o GM, a equipe, a arte da cena e a referência elegível do Storyboard.

## Mapa hierárquico do mundo x mapa comum do Game

O Game pode conter dois sistemas de mapa:

- O **World Maps** é o local oficial da história ou do mundo, como em `The Shattered Coast → Brinewatch → Tideglass Inn`.
- Um mapa comum do Game, em grade ou em nós, traz o detalhe local ou tático dentro daquele local da história e também participa do tempo e do clima do Game.

Quando o World Maps comanda a abertura do Game, o modelo de mapa selecionado ou o rascunho revisado é que fornece o mundo inicial. O mapa comum do Game não é reaproveitado como entrada de prompt nem promovido a hierarquia alternativa.

Em configurações avançadas, um local hierárquico pode ser vinculado a um mapa de Game inteiro, a uma célula da grade ou a um nó. Selecionar uma posição vinculada do Game prepara o movimento hierárquico correspondente; as posições sem vínculo mantêm o comportamento tático normal. Salve a hierarquia antes de editar os vínculos. Limpar um vínculo não exclui nenhum dos dois mapas.

## Dar identidade visual aos locais

As referências de local e os planos de fundo do mapa de filhos são independentes, mesmo quando usam a mesma imagem da galeria.

| Arte | Para que serve | Vai para a geração de imagens? |
| --- | --- | --- |
| **Location reference image** | Fixa a identidade visual do lugar atual exato. Escolha uma arte do chat ou da Global Gallery compartilhada, ou crie com IA. | Sim, quando **Use for Roleplay illustrations and Game storyboards** está ativado e o pedido é elegível. |
| **Child map background** | Aparece atrás dos locais filhos móveis de um pai que usa a apresentação Map. Cada camada do mapa pode ter o próprio plano de fundo. | Não. Serve só para exibição. |

As referências de personagem ou de persona preservam quem está presente; a referência de local preserva onde a cena acontece. Quando o provedor tem suporte a isso, combinar as duas ajuda a manter personagens e planos de fundo coerentes entre as imagens.

O pipeline de imagens acrescenta esta instrução quando há uma referência de local elegível anexada:

> Location handling: an attached location reference image is available. Use it
> to set the scene location.

Cada provedor tem os próprios limites de imagem de referência. As referências pedidas explicitamente e as referências de personagem podem reduzir quantas referências automáticas cabem.

### Definir uma referência de local

Selecione um local no editor e abra **Location reference image**.

- **Choose artwork** atribui uma imagem já revisada do chat atual ou da Global Gallery compartilhada. O seletor identifica a origem de cada uma.
- **Create with AI** abre um prompt editável de imagem de ambientação e salva o resultado na galeria antes de você decidir se vai usá-lo.
- **Use for Roleplay illustrations and Game storyboards** controla se a imagem selecionada participa das gerações elegíveis.

Para um pai que usa a apresentação Map, abra **Child map background** à parte. Escolha uma imagem da galeria e posicione-a atrás dos marcadores dos filhos. Essa imagem nunca é enviada a um provedor só porque aparece no mapa. Use uma imagem quadrada, por exemplo de 1024 × 1024 px, para combinar com a grade de coordenadas de 100 × 100. O editor e a visualização durante o chat usam a mesma área quadrada.

Quando uma imagem da galeria cumpre os dois papéis, **Remove reference only** (remover só a referência) a mantém como plano de fundo do mapa de filhos. Use **Reject both and create replacement** (recusar as duas e criar uma substituta) quando a imagem estiver errada para os dois papéis. Depois da geração, **Use for both** (usar para as duas) atribui a imagem nova como referência do local e como plano de fundo do mapa de filhos de uma vez só.

### Gerar em lote as artes de local que faltam

A seção **Location artwork** do editor encontra os locais sem referência ou sem plano de fundo do mapa de filhos.

1. Clique em **Review requests**.
2. Confira a quantidade de pedidos antes de gastar pedidos do provedor.
3. Confirme a conexão de imagem, o modelo, o estilo do Engine, o estado do estilo de arte da campanha, as instruções de imagem salvas e o tamanho de saída.
4. Edite cada prompt positivo e negativo, se precisar.
5. Cancele a revisão ou clique em **Generate N images** para confirmar.
6. Revise as artes geradas no mapa de trabalho e clique em **Save**.

Cada imagem distinta que falta é um pedido separado ao provedor. Mundos grandes podem ficar lentos ou caros, então a revisão continua rolável e mantém a quantidade de pedidos à vista. Sempre que possível, a arte existente é reaproveitada sem um novo pedido. Uma imagem nova vira a referência do local e também o plano de fundo do mapa de filhos, quando esse mapa precisa de um.

Também conta como ausente um link salvo da galeria cuja imagem não existe mais. Se você editar o local enquanto a geração está rodando, o Maps aplica o resultado só aos papéis de arte que ainda estão faltando. Uma substituta escolhida há pouco, o botão de referência, a posição do plano de fundo, o estado de arquivamento e edições do rascunho sem relação não são sobrescritos pela requisição concluída.

Os prompts positivo e negativo exatos, já editados, que aparecem na revisão são os enviados ao provedor. O material do prompt positivo não é copiado para o prompt negativo.

## Personalizar o prompt automático de arte

Abra **Settings → Generations → Prompt Overrides** (Configurações → Gerações → Substituições de prompt) e selecione **Maps location artwork**. Esse é o modelo de prompt global usado quando o Maps pré-visualiza e gera a arte automática de local. As variáveis usam a sintaxe `${variableName}` e podem ser inseridas pelo editor.

| Variável | Significado |
| --- | --- |
| `${locationName}` | Nome do local |
| `${locationDescription}` | Descrição pública do local exato |
| `${locationType}` | Region, Settlement, Place, Building, Floor ou Room |
| `${locationPrompt}` | Prompt de ambientação completo preparado pelo Maps como alternativa |
| `${parentLocationName}` | Nome do pai direto, ou vazio na raiz |
| `${parentLocationDescription}` | Descrição pública do pai direto, ou vazio |
| `${locationPath}` | Trilha de navegação completa, da raiz até o local |
| `${genre}` / `${genreLine}` | Gênero do Game, bruto ou pontuado; vazio fora do Game |
| `${campaignArtStyle}` / `${campaignArtStyleLine}` | Estilo da campanha, só quando **Use campaign art style** está ativado |
| `${imageInstructions}` / `${imageInstructionsLine}` | Instruções de imagem salvas no Chat Settings, brutas ou formatadas |

O modelo de prompt interno usa o prompt exato do local mais o gênero, o estilo da campanha e as instruções de imagem salvas, quando houver. Ele deixa de fora por padrão, de propósito, a descrição do pai e o caminho completo, o que evita forçar um marco do pai – uma torre, por exemplo – em toda imagem de filho ou de andar.

Personalizações comuns:

- Remova `${genreLine}` se o gênero do Game não deve aparecer na arte automática do mapa.
- Mantenha `${campaignArtStyleLine}` só se quiser que o botão liga/desliga **Use campaign art style** de cada chat controle esse material. Com o botão desativado, a variável fica vazia.
- Acrescente `${parentLocationName}`, `${parentLocationDescription}` ou `${locationPath}` apenas quando o provedor precisar desse contexto mais amplo.
- Use **Reset to default** para voltar ao modelo de prompt interno.

O perfil de estilo do Engine e as configurações globais de imagem positiva e negativa entram depois desse modelo. Eles continuam fazendo parte do fluxo compartilhado de imagens do Illustrator, e não das configurações específicas do Maps. Se sobrar texto inesperado no prompt negativo, verifique a configuração global de imagem negativa e o campo editável da revisão.

## Vincular o lore aos locais

O World Maps usa o lore de duas maneiras:

1. O construtor de IA pode ler os lorebooks selecionados ao criar um rascunho ou uma expansão.
2. Um local salvo pode ativar entradas enquanto esse local exato for o atual.

Para anexar o lore em tempo de execução, selecione o local, abra **Linked lore**, pesquise as entradas disponíveis, anexe as que quiser e salve.

Escolha **Open** (abrir) em uma entrada vinculada para sair do espaço de trabalho do mapa e abrir o lorebook dela. Um espaço de trabalho sem alterações fecha direto. Se o mapa tiver alterações não salvas, salve antes ou confirme de forma explícita que o rascunho pode ser descartado; o World Maps nunca abre o lorebook por trás do editor de mapas ainda visível.

As entradas vinculadas não passam do pai para o filho. O lore anexado a Brinewatch não é acionado no Tideglass Inn, a não ser que também esteja anexado lá.

O lore do local atual não precisa de correspondência de palavra-chave, mas também não ignora os controles do lorebook. Livros e entradas desativados ou excluídos do chat continuam indisponíveis, e as condições, o momento, a probabilidade e o orçamento de tokens da entrada continuam valendo. As referências que estiverem faltando ficam visíveis no editor, para você consertá-las ou desanexá-las.

## Configurações avançadas de prompt do Maps

A página principal **Agents → World Maps** controla dois sistemas globais de prompt:

- **Generation prompt** é uma biblioteca nomeada de Roleplay/Game para rascunhos e expansões de mapa com IA. Cada chat pode escolher uma opção de forma independente. A pré-visualização resolvida usa a configuração, os personagens, o lore e o contexto de mapa atuais, sem fazer um pedido ao modelo.
- **Turn prompt insert** controla o texto de sistema global de Roleplay/Game que apresenta o local atual nos turnos comuns. Marinara mantém em volta dele o invólucro `<spatial_context>`, que pertence ao aplicativo, e as variáveis oficiais obrigatórias.

A opção **Connection Override** dessa mesma página afeta os rascunhos e as expansões de mapa com IA. Deixe o campo vazio para usar a conexão do chat atual. Essas configurações não substituem a opção **Maps location artwork**, que fica à parte nas configurações globais de geração.

Esses controles são feitos para personalização avançada. Preserve as variáveis obrigatórias e confira as pré-visualizações resolvidas antes de salvar.

## Importar, exportar e arquivar com segurança

### Exportar um mapa portátil

Use **Export** no editor de um chat, de um modelo ou de um mundo compartilhado para baixar a hierarquia de trabalho como um arquivo `.world-map.json`. Antes de baixar, escolha quanto lore vinculado deve acompanhar o mapa:

| Opção de lore | Conteúdo do arquivo |
| --- | --- |
| **Map only** | A hierarquia e a procedência legível entre locais e lore, sem conteúdo de lorebooks. Entradas ausentes não podem ser recriadas. |
| **Map + linked entries** | Só as entradas vinculadas pelo mapa e os caminhos de pasta necessários para organizá-las. É a opção portátil recomendada. |
| **Map + complete lorebooks** | Todas as entradas e pastas de cada lorebook vinculado, inclusive material não relacionado ao mapa. |

Antes de compartilhar o arquivo, revise os lorebooks listados, a contagem de entradas, o tamanho estimado e o mapeamento expansível entre locais e lore. Lorebooks completos podem conter notas privadas ou sem relação.

Deixe **Include map artwork** ativado para reunir no mesmo arquivo as imagens de referência dos locais e os planos de fundo dos mapas de filhos. Desative a opção quando quiser um backup menor. Os arquivos antigos `.hierarchical-map.json` continuam compatíveis com a importação.

### Importar um mapa e restaurar lore portátil

Use **Import** para carregar uma hierarquia na cópia de trabalho de um chat, em um modelo independente ou em um mundo compartilhado. Quando o arquivo contém conteúdo de lorebook, **Restore portable map lore** mostra uma prévia de quatro grupos: **Exact IDs**, **Unique content**, **Need a choice** e **New entries**.

Um ID exato de entrada só é oficial quando pertence ao lorebook de destino. Um ID de outra origem é ambíguo, e não uma correspondência automática: escolha a linha de destino exata `Lorebook → Entry (ID)` ou **Import a new copy** (importar uma nova cópia). Fora isso, o World Maps só reaproveita uma entrada quando todo o conteúdo portátil e as configurações dela têm uma única correspondência. O nome sozinho nunca basta.

Depois de revisar o resultado esperado, escolha a estratégia geral de importação:

- **Import separate copies** (importar cópias separadas) não reaproveita nenhuma entrada. Ela cria lorebooks independentes, identificados pela procedência, como `Original Lorebook - Map Name (World Map)`, e acrescenta **(copy)** ou **(copy N)** para evitar uma colisão de nomes na biblioteca.
- **Reuse matches & import the rest** (reaproveitar as correspondências e importar o resto) mantém as correspondências exatas e únicas, aplica as suas escolhas nas linhas ambíguas e cria lorebooks novos apenas para as entradas que ainda precisam ser importadas.

Depois da importação, o Maps lista os lorebooks concretos que reaproveitou e os que criou. As cópias criadas continuam na biblioteca de Lorebooks se o mapa for excluído mais tarde. No Engine **2.4.1** ou mais novo, a visualização principal de Lorebooks é atualizada na hora. No Engine **2.3.5 a 2.4.0**, recarregue Marinara uma vez depois de restaurar o lore portátil.

A arte incluída também é restaurada, e os links das imagens são remapeados. A arte do chat volta para a galeria do chat de destino. A arte compartilhada é reaproveitada da Global Gallery quando a mesma imagem já existe, ou é adicionada lá uma vez quando um modelo ou uma referência compartilhada precisa dela.

Revise o mapa importado e clique em **Save** para torná-lo oficial. A importação não salva na hora. Uma exportação **Map only** pode preservar a procedência legível do lore e os vínculos de ID exato existentes, mas não consegue recriar lorebooks ou entradas excluídos, porque o conteúdo deles não está no arquivo.

Depois que o histórico da campanha passa a citar um mapa, as mudanças importadas precisam manter os IDs de local existentes. Acrescente ou atualize locais em vez de trocar a hierarquia por outra com IDs sem relação.

### Arquivar ou excluir locais permanentemente

O arquivamento preserva as referências antigas. Antes de arquivar um local:

- mova ou arquive os filhos ativos dele;
- escolha outro local inicial ativo, se necessário; e
- escolha um substituto ativo, caso ele seja o local atual em tempo de execução.

Os locais arquivados podem ser restaurados pelo painel Details. O World Maps 1.3.1 também oferece **Delete permanently** (excluir em definitivo) para um local arquivado ou para um ramo totalmente arquivado, quando é seguro removê-lo. O editor desativa essa ação quando o local é o local inicial ou o local atual da história já salvo, aparece no histórico de mensagens, tem um vínculo com o mapa do Game, participa de um destino ou de uma rota em fila, ou pertence a um chat ainda vinculado a um mundo compartilhado. Os editores de mundo compartilhado e de modelo não oferecem exclusão permanente de local. Resolva antes a dependência apontada, desvincule o chat vinculado quando fizer sentido, ou mantenha o local arquivado.

A exclusão permanente tira o local do rascunho de trabalho e limpa as referências de hierarquia e de ligação direta quando você clica em **Save**. Fechar sem salvar continua descartando a exclusão. Os locais excluídos não aparecem mais nas exportações; os locais arquivados que continuam protegidos seguem sendo exportados, para que os IDs estáveis deles possam apoiar o histórico e os dados vinculados. Não edite o JSON exportado para burlar essas proteções.

## Solução de problemas

<a id="world-maps-is-missing-from-chat-settings"></a>

### World Maps não aparece no Chat Settings

Instale o pacote e reinicie Marinara. O chat precisa ser de Roleplay ou Game. Ative **Enable Agents** e depois ative **World Maps** em **Tracker Agents**.

### As opções Add to chat e Link to chat não aparecem na biblioteca de mundos

Abra um chat de Roleplay ou Game antes de abrir a biblioteca. Ela indica o chat de destino e mostra **Add to chat** para os modelos ou **Link to chat** para os mundos compartilhados. Durante a configuração do Game, as ações equivalentes são **Use template** e **Use shared world**. Se **Use shared world** não aparecer enquanto houver mundos compartilhados na lista, o navegador talvez ainda esteja rodando um cliente antigo do pacote. Salve ou descarte o editor de mapas aberto, feche-o, salve qualquer trabalho não relacionado em outras abas, recarregue Marinara uma vez de forma forçada e reabra a configuração do Game.

### A configuração do Game usou os locais errados ou os de reserva

Escolha **Use template** e depois confirme **Use template**, para uma cópia independente, ou **Use shared world**, para um vínculo, antes de concluir a configuração. Revise e salve o mapa do Game.

### Um chat vinculado ainda mostra um mundo compartilhado antigo

Os editores da aba em que você publica se atualizam sozinhos. Um chat com mudanças não salvas ou não publicadas mantém o rascunho e mostra um conflito. Reabra os chats de outras abas ou janelas para carregar a nova revisão.

### O mapa não pode ser ativado

Crie pelo menos um local ativo e defina um local inicial ativo. Corrija todos os problemas mostrados no topo do editor, depois ative e salve de novo.

### A geração de mapa com IA está indisponível ou falha

- Confira se o chat ou a opção **Connection Override** da página do World Maps tem uma conexão funcionando com um modelo de linguagem.
- Salve ou descarte as alterações do editor antes de reabrir o construtor de IA. Para uma expansão, escolha um alvo ativo. Para a geração apoiada no lore, selecione pelo menos um lorebook ativado e não excluído.
- Se o Maps disser que a resposta terminou antes de um JSON completo, aumente o **Max Output Tokens** da conexão ou escolha um tamanho de mapa menor. O Maps não repara respostas incompletas.
- Se o Maps informar um JSON malformado, ele já tentou um reparo só de sintaxe. Tente de novo. Se o modelo continuar falhando, use outra conexão ou outro modelo.

### O local atual não acompanhou uma mensagem

O movimento automático exige que a sua última mensagem estabeleça diretamente a chegada da equipe e que o modelo produza uma diretriz oculta válida do Maps. A narração da IA sozinha, a intenção, a discussão, a viagem que falhou, o movimento só de NPCs e os lugares temporários não movem o marcador. Tente uma frase direta, como "Vamos para a Kitchen". Use **Set destination** para um movimento garantido no próximo turno.

### O local atual mudou depois de reabrir o chat

Confira qual ramificação de mensagens e qual swipe estão selecionados. O local acompanha o instantâneo salvo com esse histórico. Se o histórico estiver certo e o marcador não, abra o editor, selecione o local ativo correto, escolha **Set current story location** e clique em **Save**.

### Um destino ou uma rota mostra Needs review

A revisão do mapa ou o local atual mudou depois que o movimento entrou na fila. Abra o mapa da história, confira o caminho e selecione o destino ou a rota outra vez. Se um destino ainda aparecer, cancele-o antes de selecioná-lo de novo.

### Uma rota planejada não avança

Cada turno do usuário confirma o passo mostrado e coloca o próximo na fila. Se um turno não fizer a rota avançar, cancele-a e replaneje a partir do local atual. Se o local salvo estiver errado, use **Set current story location** e **Save**, o que limpa a rota desatualizada.

### Este chat deveria usar um mapa completamente diferente

Abra o editor e escolha **Replace / start over**. Se precisar, salve antes um modelo ou uma exportação. Se o chat for vinculado e precisar manter a hierarquia, use antes **Detach and keep copy**. Remover e adicionar o World Maps de novo não zera o mapa dele.

### Um local distante não pode ser selecionado

Use **Plan route** se existir um caminho ativo de pais, filhos ou ligações. Se não existir, acrescente uma ligação direta ou viaje pelos lugares alcançáveis, um turno por vez. Explorar nunca move a história.

### Os prompts automáticos de arte incluem material indesejado

- O gênero do Game sempre aparece: abra **Settings → Generations → Prompt Overrides → Maps location artwork**, remova `${genreLine}` e salve.
- O estilo da campanha aparece quando deveria estar desativado: verifique **Chat Settings → Illustrator → Use campaign art style**. Com a opção desativada, `${campaignArtStyle}` e `${campaignArtStyleLine}` ficam vazios.
- Um marco do pai aparece em toda imagem de filho: evite `${parentLocationDescription}` e `${locationPath}` no modelo, a não ser que sejam necessários.
- O prompt negativo tem texto inesperado: edite o campo negativo antes de confirmar e depois verifique a configuração global de imagem negativa. O modelo do Maps monta só o prompt positivo.

### Uma referência de local não é usada nas imagens nem nos Storyboards

Confira se a imagem da galeria ainda existe e se **Use for Roleplay illustrations and Game storyboards** está ativado no local atual exato. Um plano de fundo do mapa de filhos serve só para exibição e não substitui uma referência, a menos que a mesma imagem também esteja definida como referência do local.

### O modelo ignora o mapa

Confira se o World Maps está ativo no chat, se a hierarquia está **Enabled**, se as suas alterações foram salvas e se aparece um local atual no controle Story location. A pré-visualização resolvida do **Turn prompt insert** ajuda no diagnóstico.

### O lore vinculado não é acionado

Confira se a entrada está anexada ao local atual exato e se a entrada e o lorebook estão ativados e não excluídos do chat. O lore vinculado ao pai não é herdado. Em um mapa importado, confira o resumo da importação. **Map only** não traz conteúdo de lorebook, então importe um arquivo exportado com **Map + linked entries** ou **Map + complete lorebooks** e depois escolha a correspondência exata, o destino ambíguo ou a cópia separada. No Engine 2.3.5 a 2.4.0, recarregue Marinara uma vez depois de restaurar o lore.

## Guias relacionados

- [Agentes: ajudantes de IA para os seus chats](agents-overview.md)
- [Referência dos agentes para download](built-in-agents.md)
- [Visão geral dos lorebooks](../lorebooks/overview.md)
- [Roleplay Mode: primeiros passos](../roleplay/getting-started.md)
- [Game Mode: primeiros passos](../game/getting-started.md)
- [Game Mode: mapa, tempo e clima](../game/map-time-weather.md)
