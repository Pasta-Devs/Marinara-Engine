# Memory Recall e resumos do chat

Este guia explica **Memory Recall** (busca em mensagens anteriores), a opção **Advanced Memory Recall (Alpha)** (recuperação avançada de memória) para gerenciar automaticamente o contexto de Roleplay, **Chat Summary** e **Automatic Summarization** de Conversation.

## Os dois sistemas de memória

Todo modelo de IA só consegue ler uma quantidade limitada de texto de cada vez. Esse limite é a janela de contexto. Quando o chat fica longo, as mensagens mais antigas saem dessa janela e a IA esquece o que aconteceu. Marinara Engine (chamado de Marinara daqui em diante) tem dois sistemas separados que resolvem isso.

- O **Memory Recall** procura, nas mensagens antigas, os trechos mais relacionados ao que você acabou de dizer e insere esses trechos de volta no prompt, sem chamar atenção. Funciona em todos os modos de chat.
- Os resumos comprimem as mensagens antigas em recapitulações curtas, que ocupam o lugar das mensagens originais no prompt. Os chats de Roleplay usam o **Chat Summary**. Os chats de Conversation usam a **Automatic Summarization**.

Os chats de Game Mode contam apenas com o **Memory Recall**. Nenhum dos dois recursos de resumo existe ali.

Os dois sistemas podem ser usados ao mesmo tempo. Eles fazem trabalhos diferentes e não entram em conflito.

## Configurar o Memory Recall

O **Memory Recall** encontra trechos relevantes do começo do chat e os insere no prompt como lembranças. Para isso, ele usa um embedding: uma impressão digital numérica do significado de uma mensagem. Marinara compara a impressão digital da nova mensagem com as impressões digitais guardadas das mensagens antigas e acrescenta as mais parecidas.

### Ativar o Memory Recall

1. Abra um chat e clique no botão **Chat Settings** (configurações do chat) no cabeçalho do chat.
2. Localize a seção **Memory Recall** (o ícone é um cérebro).
3. Ative o botão liga/desliga **Enable Memory Recall**.

A opção **Enable Memory Recall** vale para cada chat separadamente. O padrão depende do modo:

- Ativada por padrão nos chats de Conversation.
- Ativada por padrão nos chats de Roleplay ou Game que têm uma cena ativa.
- Desativada por padrão em todos os outros chats.

Ao desativar o botão liga/desliga, as lembranças recuperadas deixam de entrar no prompt. Nada do que já foi guardado é excluído.

### A fonte de embeddings

O Memory Recall precisa de uma fonte de embeddings para montar essas impressões digitais de significado. A definição fica na conexão, não nas configurações do chat. A conexão é um vínculo salvo com um provedor de IA.

1. Abra o painel **Connections** (Conexões) e edite uma conexão.
2. Localize a seção **Semantic Search (Embeddings)** (busca semântica).
3. Digite o nome de um modelo de embeddings no campo do modelo. Um valor de exemplo é `text-embedding-3-small`.
4. Se quiser, defina uma **Embedding Endpoint URL** para substituir o endereço.
5. Se quiser, use o menu suspenso **Embedding Connection** para aproveitar a chave e o endereço de outra conexão. Entre as opções estão **Same as this connection** e **Local Model (sidecar)**.

Alguns provedores não oferecem embeddings. Nesse caso, Marinara mostra um aviso pedindo que você escolha uma conexão dedicada a embeddings, como uma conexão compatível com OpenAI, a Google ou o Local Model.

Se nenhuma conexão de embeddings for definida, Marinara recorre a um modelo de embeddings local embutido. Ele baixa esse modelo uma única vez e o executa na sua própria máquina, sem precisar de chave de API. Para saber mais sobre o modelo embutido, veja [Como configurar o Local Model](../connections/local-model.md).

Essa mesma configuração **Semantic Search (Embeddings)** também alimenta a busca semântica dos lorebooks, então configurar uma vez já ajuda os dois recursos.

### Memories for This Chat

Para ver o que um chat lembrou, abra **Chat Settings**, vá até **Memory Recall** e clique em **Access memories for this chat**. Com Advanced Memory ativado, o visualizador permanece no painel lateral de Roleplay; caso contrário, abre a janela **Memories for This Chat**.

A janela mostra a quantidade de blocos de memória guardados e uma estimativa aproximada de tokens. Cada card de bloco mostra o período que ele cobre, a quantidade de mensagens, um status e a data de criação. O status é um destes:

- **Vectorized**: a impressão digital está pronta para a busca.
- **Waiting for vector**: a impressão digital ainda está sendo criada.
- **Embedding unavailable**: nenhuma fonte de embeddings conseguiu criá-la.

A barra de ferramentas tem ícones para exportar lembranças, importar lembranças, reconstruir as lembranças e limpar tudo. Cada bloco também tem o próprio ícone de lixeira, para esquecer só aquele bloco.

- Ao clicar no ícone de lixeira de um bloco, abre-se a caixa de diálogo **Forget Memory**. Confirme em **Forget**.
- O ícone de lixeira que limpa tudo abre a caixa de diálogo **Clear Memories**. Confirme em **Clear**. Isso remove as lembranças do Memory Recall, mas não exclui as mensagens do chat.
- O ícone de atualizar reconstrói todos os blocos de memória a partir das mensagens atuais do chat. Use esse ícone depois de trocar o modelo de embeddings.
- A exportação salva um arquivo `.marinara.json`. A importação aceita arquivos `.json` ou `.marinara` e os mescla com as lembranças existentes.

### Como o Memory Recall se comporta

Vale prestar atenção nestes pontos:

- Marinara guarda blocos de memória em segundo plano sempre que existe uma fonte de embeddings, mesmo com a opção **Enable Memory Recall** desativada. O botão liga/desliga só controla se as lembranças guardadas entram no prompt. Para parar de guardar lembranças, remova a fonte de embeddings ou limpe as lembranças de tempos em tempos.
- Um bloco só é criado a partir de 5 mensagens novas. Lotes menores esperam a próxima resposta.
- Os trechos recuperados precisam ser relacionados o bastante para passar em um teste de semelhança. Combinações fracas são ignoradas, então a recuperação pode não trazer nada mesmo com lembranças guardadas.
- Só uma pequena parte do prompt é reservada para as lembranças recuperadas, ou seja, apenas as poucas mais relevantes entram.
- Se você trocar o modelo de embeddings depois que já existem lembranças, os blocos antigos deixam de combinar. Use o ícone de reconstruir para refazê-los.
- Ao excluir as mensagens de um chat, os blocos de memória dele também são excluídos.

Algumas versões em contêiner do Marinara, conhecidas como Marinara Lite, desativam o Memory Recall por completo. Nessas versões, a seção **Memory Recall** nem aparece.

## Advanced Memory Recall (Alpha, Roleplay)

Abra **Chat Settings → Memory Recall** e ative **Advanced Memory Recall (Alpha)**. Você também pode ativar **Automatic context and memory handling (alpha)** (gerenciamento automático de contexto e memória) abaixo de Agents no assistente de configuração de Roleplay. Esse modo opcional gerencia em conjunto a janela do histórico atual, os resumos de continuidade e os trechos antigos relevantes. As configurações e o progresso da preparação estão disponíveis no assistente e no painel lateral Chat Settings, tanto no computador quanto no celular. O visualizador do arquivo permanece no painel Chat Settings.

### Configuração

- Escolha **Maximum allowed context before compression (tokens)** dentro do contexto aceito pelo modelo do chat. O teto cobre o prompt de saída estimado: instruções, mensagens, memórias recuperadas, ferramentas e anexos, tanto no chat quanto no processamento de memória. Tokens de resposta e margem de segurança são contados separadamente. O limite total de contexto do modelo continua valendo; não é uma contagem exata do tokenizador nem um limite de cobrança.
- Escolha **Summary and recall budget (tokens)** (orçamento de resumos e recuperação) dentro desse teto. As constantes ativas devem ocupar no máximo **70%** como meta. A prioridade é constantes, resumos das cenas selecionadas e, por último, trechos de mensagens. A memória total pode usar até **2,000 tokens extras** quando necessário, respeitando o contexto completo. Com 10k, a meta é até 7k de constantes e até 12k no total; as mesmas proporções valem para outros valores. Mensagens atuais não entram na parcela constante nem acionam sua consolidação.
- **Helper model** (modelo auxiliar) decide cenas, resume cenas e compacta continuidade. Usa a conexão dos agentes e, na falta dela, a do chat. A detecção histórica pode usar principal ou auxiliar; resumos sempre usam o auxiliar. Os modelos resolvidos aparecem antes da preparação.
- Todas as chamadas de resumo de memória usam **Chat Summary → Maximum output size**, com pelo menos **8,196 tokens de saída** para dar espaço ao raciocínio. Isso inclui resumos de cenas e consolidação de constantes; valores maiores são preservados. O limite comum de resposta da conexão auxiliar não substitui esse ajuste. Entrada e reserva de saída ainda precisam caber no contexto total do modelo.
- Cada pedido de resumo recebe instruções, mensagens acessíveis daquela cena, correções por intervalo aplicáveis e o formato de saída JSON. Cenas grandes demais são processadas em lotes salvos e depois combinadas. As recapitulações pedem **2–3 parágrafos**. O prompt padrão descreve acontecimentos passados, sem seções de situação atual ou tensões abertas; prompts personalizados escolhidos em **Summaries** continuam valendo. Advanced Memory funciona independentemente do interruptor principal Agents e não exige um agente baixado.
- **Maximum recalled scenes** (máximo de cenas recuperadas) é **3** por padrão. É um teto; correspondências fracas são ignoradas. **0** desativa cenas opcionais e mantém continuidade necessária. Cada cena fornece seu resumo seguido de no máximo um trecho.
- **Moving context** (contexto móvel) controla mensagens por trecho, **3–10** por padrão. Ambos os limites em **0** fornecem só resumos; apenas o mínimo em **0** torna trechos opcionais. Relevância, acesso e espaço podem reduzir a quantidade a nenhuma.

Em um chat de grupo Individual antigo, confirme uma vez os intervalos de conhecimento que faltarem para os personagens. A primeira fala de um personagem não prova que ele sabia de tudo o que aconteceu antes. Selecione um personagem real como **Narrator** (Narrador) apenas quando ele precisar ignorar os limites de participação. A ocultação específica por personagem e os intervalos de conhecimento confirmados continuam restringindo a memória. O **Hide from AI** (Ocultar da IA) global, definido manualmente ou por resumos automáticos, só remove um turno da transcrição ativa: Advanced Memory continua analisando esse turno, identificando os participantes da cena, resumindo e indexando seu conteúdo para a recuperação permitida. Marcadores de início recortam a transcrição ativa. Você pode corrigir esses intervalos depois; personagens adicionados precisam de sua própria confirmação.

Em um chat existente, clique primeiro em **Prepare existing history** (Preparar histórico existente). Se o histórico recuperado mudar os limites de uma cena coberta por uma correção manual, desative essa memória para manter seu texto como referência, ou exclua-a, e prepare o histórico novamente. Salvar a mesma correção não pode atribuir seu texto com segurança a outro intervalo de origem. A preparação processa o histórico antigo em lotes e mostra a etapa atual ao lado da roda de hamster da Professor Mari. **Cancel** mantém o trabalho concluído; **Resume** continua depois de fechar o painel, reiniciar o servidor ou atualizar o aplicativo. Uma chamada ao modelo que falha preserva a memória válida anterior e exibe um erro para tentar novamente. Não redefina a memória para se recuperar de uma chamada com falha: Resume reutiliza os resumos concluídos e a detecção de cenas que não mudou. A última cena em andamento continua aberta e é resumida quando termina; trechos de origem limitados são usados se suas mensagens ativas excederem o limite de contexto.

Abra um resumo em **Access memories for this chat** e escolha **Delete summary** (excluir resumo) no final. Confirme o resumo e seu público. Também vale para entradas antigas **Continuity** (continuidade) e **Ongoing scene** (cena em andamento). A preparação normal não recria resumos de cenas excluídos. Mensagens originais permanecem intactas. Novos constantes ficam em **Chat Summaries**, com os controles existentes de edição, ativação, combinação e exclusão. A continuidade antiga do cofre não é constante adicional.

### Durante o chat

A detecção de cenas acontece depois que a resposta principal de Roleplay é salva. **Standalone scene check interval (messages)** tem padrão **5**. O verificador recebe mensagens recentes numeradas, uma mensagem anterior para contexto, instruções e formato de saída. Ele aponta o número exato que encerra cada cena ou não retorna finais se ela continua. Contam mensagens de personas e personagens. A frequência independe dos horários dos agentes de acompanhamento; uma verificação devida compartilha uma chamada após a geração quando visibilidade e orçamento permitem, ou usa o auxiliar separadamente. Cada intervalo começa depois do final anterior e inclui a nova mensagem final. Só um final detectado prepara em segundo plano o resumo e o índice da cena encerrada, inclusive quando ela termina na resposta mais recente. Transições incertas deixam a cena aberta. **Agents**, no canto superior esquerdo, mostra **Advanced Recall**, com progresso, erros e recuperação, mesmo com agentes comuns desativados. O progresso só é consultado durante uma tarefa de memória; arquivos prontos não são consultados em repouso.

A recuperação lê memória preparada. O embedding opcional da consulta tem prazo curto e recorre à correspondência textual se indisponível. A correspondência de texto dá mais peso aos termos distintos da última mensagem do usuário, para que um detalhe breve encontre um resumo de cena longo. As mensagens originais indexadas também permitem encontrar cenas quando a saída de trechos está desativada. Nenhum desses mecanismos acrescenta uma chamada ao modelo. Só funciona na geração principal de Roleplay: agentes, reexecuções manuais e gerações auxiliares de teste não a acionam nem recebem seus resumos ou trechos. A inspeção do prompt principal continua somente leitura.

Variantes regeneradas reutilizam a primeira memória compatível daquela resposta: continuidade, resumos de cenas e trechos exatos. Variantes sem mudanças não repetem busca nem auxiliar. Continuar preserva memória inicial. Respostas antigas sem instantâneo salvam um na próxima geração e o reutilizam depois; não é preciso redefinir. Adições e combinações em segundo plano preservam instantâneos compatíveis. Mudanças do usuário em histórico, acesso, resumos ou memórias invalidam os incompatíveis. O limite atual de contexto sempre vale.

A geração principal lê imediatamente a memória salva. Nunca inicia nem espera a geração de continuidade, mesmo com um auxiliar em segundo plano. Quando o prompt de saída alcança o teto, a janela atual recomeça no início da cena mais recente para **todos os personagens** e cresce até atingir o teto novamente. O corte aparece em **Mark as new start** com **All** selecionado; desmarque All para desfazê-lo. Marcas pessoais continuam valendo. Se uma cena aberta ou constante grande demais não couber, a solicitação usa trechos identificados e mantém as mensagens mais recentes. Esse ajuste temporário não cria outra marca persistente. Resumos salvos e mensagens originais não são sobrescritos.

Após a resposta principal, Advanced Memory amplia os **Chat Summaries** por intervalo apenas para mensagens arquivadas ainda não cobertas, reaproveitando recapitulações prontas quando possível. Entradas existentes, inclusive inativas, já contam como intervalos tratados. Se constantes ativas elegíveis ultrapassarem 70% de **Summary and recall budget**, **Updating continuity** combina só seus textos após a resposta, usando o auxiliar escolhido e **Chat Summary → Maximum output size**. Constantes que cobrem mensagens atuais ficam fora desse orçamento e da compactação; entradas antigas sem intervalo continuam elegíveis. A resposta que cruza o limite é gerada normalmente com as constantes salvas, sem esperar a compactação. Os 2,000 tokens extras pertencem à memória total, não à parcela constante. Modelos compartilhados cujas macros mudam por personagem ficam intactos; se sozinhos excederem a meta, precisam de edição manual. Outros grupos recebem orientação proporcional de tamanho, não um limite rígido de rejeição. Uma substituição menor e concluída recebe um título de intervalo de mensagens e é salva junto com a desativação das entradas anteriores. Resultados com falha ou incompletos não são salvos; entradas existentes continuam utilizáveis e **Resume processing** retoma o trabalho pendente. Resumos de cenas ficam no cofre.

O arquivo recupera resumos relevantes e diálogos exatos com números e falantes originais. Uma seção **Recalled Scenes** contém cada resumo imediatamente seguido de seu trecho disponível, com um único cabeçalho de intervalo. Cenas sem trecho ficam nessa mesma seção. O bloco informa o intervalo atual e o número da última mensagem do usuário. Cenas só são recuperadas quando todas as fontes estão fora do histórico atual enviado; trechos também excluem mensagens atuais. **Chat Summaries** por intervalo são omitidos enquanto qualquer mensagem coberta continuar no contexto. Permanecem salvos e ativos e voltam a ser elegíveis quando todo o intervalo sai da janela. Constantes elegíveis têm prioridade sobre a recuperação opcional e mantêm suas condições de personagem. Todos os resumos selecionados reservam espaço antes dos trechos. Limites de acesso e fontes históricas continuam valendo. Ilustrações e legendas de imagens são omitidas das mensagens recuperadas e novas entradas de resumo; anexos de texto legíveis permanecem. Contam personas e personagens. Regeneração histórica só usa fontes anteriores à resposta alvo, mesmo antes da janela gerenciada. Editar, trocar de variante, ocultar ou excluir fontes provoca nova verificação da memória derivada antes do uso.

Abra **Access memories for this chat** (Acessar memórias deste chat) no mesmo painel para buscar resumos de cenas numerados cronologicamente, inspecionar seus períodos e públicos, editar **Summary text** (Texto do resumo) ou ler as mensagens originais completas com **Inspect source messages** (Inspecionar mensagens de origem). Os trechos internos literais não são entradas separadas de resumo de cena. Períodos da história fundamentados nas fontes acompanham o contexto recuperado; datas desconhecidas continuam desconhecidas. Você pode desativar registros de recuperação, reindexar, exportar/importar ou confirmar **Delete all memories** (Excluir todas as memórias) para reiniciar a preparação mantendo o chat original e suas configurações. Correções dos resumos manuais originais são preservadas e invalidam a continuidade dependente. Para excluir uma cena da recuperação, desative seu registro de memória. A ocultação de origem específica por personagem continua controlando quem pode acessá-la; a ocultação global não a remove do arquivo.

Um personagem presente em parte de uma cena pode compartilhar o acesso à memória dela com outros participantes, mesmo que algumas mensagens estejam ocultas para ele. Uma cena sem mensagens de origem acessíveis continua indisponível. As novas instruções de resumo identificam a visibilidade das mensagens, descrevem eventos compartilhados em texto simples e reservam `{{#if character == "Name"}}…{{/if}}` para partes privadas. Mencionar um personagem ausente não o torna participante. Se a visibilidade das fontes ou os nomes dos personagens mudarem, o resumo antigo fica indisponível para leitores com acesso parcial até você preparar a cena novamente ou revisar as condições privadas e salvar o texto corrigido. Resumos antigos sem informações de visibilidade salvas exigem a mesma revisão antes do acesso parcial; alterar apenas o público não confirma o texto. Leitores com acesso a todas as mensagens de origem ainda podem recuperar a memória, e o texto corrigido manualmente nunca é reescrito silenciosamente. Essas verificações não chamam um modelo durante a recuperação. As datas e os períodos da cena são metadados compartilhados por todos os participantes atribuídos, mesmo quando algumas mensagens estão ocultas. Trechos originais nunca incluem mensagens ocultas para o personagem; trechos de resumos com escopo condicional continuam restritos ao narrador, porque a visibilidade das mensagens não descreve, por si só, todo fato privado. Os Chat Summaries constantes continuam incluindo mensagens ocultas da IA; as condições por personagem controlam o acesso aos detalhes privados sem excluir essas mensagens da cobertura do resumo.

Enquanto ativado, o modo avançado assume a recuperação, portanto o interruptor Standard Recall não insere uma segunda cópia. Também substitui a programação normal de resumos automáticos de Roleplay nesse chat. Desativar Advanced Memory restaura essas configurações normais. Lorebooks existentes e agentes baixados mantêm suas próprias regras de escopo; Advanced Memory não pode tornar privado qualquer contexto externo ou escrito pelo usuário.

### Posicionamento no preset

Autores de presets podem posicionar estes marcadores comuns de conteúdo usando os controles existentes de ordem, nome, papel e grupo das seções:

| Marcador | Conteúdo |
| --- | --- |
| `chat_summary` | Entradas constantes elegíveis de Chat Summaries. |
| `current_scene_summary` | Trechos de origem limitados da parte antiga de uma cena em andamento. |
| `recalled_scenes` | Todos os resumos de cenas selecionadas, cada um seguido de seu trecho histórico disponível. |

O seletor de presets oferece somente **Recalled Scenes** para recuperação. Marcadores existentes `recalled_messages` permanecem aliases compatíveis e aparecem como Recalled Scenes. Um `recalled_scenes` ativado tem prioridade; os dois nunca criam seções separadas.

Cada componente segue **XML**, **Markdown** ou **None** no preset e explica brevemente sua finalidade. Componentes vazios não acrescentam nada. A primeira ocorrência ativada determina a posição; sem marcador ativado, o conteúdo aparece uma vez antes do histórico, mantendo presets antigos compatíveis. Trechos são contexto, não novas mensagens ou comandos. Marcadores avançados de cenas ficam vazios com Advanced Memory desligado.

A prévia usa memória preparada sem chamadas de modelos ou embeddings. Inicialize o arquivo ou retome trabalho em segundo plano com falha pelo painel. O recibo mostra contexto estimado, limite escolhido e fontes; o inspetor final mostra o que realmente foi enviado.

### Limites e recuperação

A recuperação é seletiva e resumos podem perder nuances. Guarde correções importantes na transcrição ou no editor de resumos. Nenhum sistema reconstrói detalhes nunca registrados. Se embeddings falharem, recuperação lexical limitada e continuidade válida continuam disponíveis; nunca se insere todo o arquivo. Se instruções obrigatórias ou um anexo não couberem no teto do prompt, reduza-os ou aumente o teto. Se a reserva de resposta não couber no contexto total do modelo, reduza a saída ou escolha um modelo com contexto maior. Advanced Memory para em vez de apagar instruções silenciosamente.

## Chat Summary (Roleplay)

O **Chat Summary** comprime as mensagens antigas em recapitulações narrativas curtas, chamadas de entradas de resumo. Cada entrada pode ser escrita pela IA ou por você, e cada uma é ativada ou desativada separadamente. Esse recurso existe apenas nos chats de Roleplay. Salvar um interruptor mantém as outras entradas utilizáveis; Activate All e Deactivate All salvam a seleção em conjunto.

Para abrir, clique no botão **Chat Summary** (o ícone é um pergaminho) no cabeçalho do chat de Roleplay. Isso abre a janela **Chat Summary**.

### Criar uma entrada de resumo

1. Em **Summary Scope**, escolha **Last** para resumir as mensagens mais recentes ou **Range** para escolher um intervalo específico de mensagens.
2. Clique em **Generate** para que a IA escreva uma entrada a partir desse escopo.
3. Ou clique em **Write** para criar uma entrada em branco e digitar a recapitulação você mesmo.

Cada entrada da lista mostra um título, o intervalo de origem ou a quantidade de mensagens e um tamanho estimado em tokens. Uma entrada pode ser ativada ou desativada, expandida, alterada com o botão **Edit** ou excluída com **Delete**. Os botões de ação em massa permitem **Show Inactive** ou **Hide Inactive** e ainda **Activate All** ou **Deactivate All** de uma vez.

### Automatic Summaries

O painel **Automatic Summaries** (resumos automáticos) mantém os resumos atualizados enquanto a conversa continua. Ele aparece apenas nos chats de Roleplay.

- Ative o botão liga/desliga **Enabled** dentro do painel **Automatic Summaries**.
- Defina a frequência no campo **Every**, medida em mensagens do usuário. O padrão é 5, e a faixa vai de 1 a 200.
- Clique em **Backfill Summary** para colocar em dia um chat antigo que nunca teve resumos. O processo percorre o chat em lotes e mostra uma barra de progresso enquanto roda. Clique em **Stop** para encerrar antes do fim.

### Modelos de Summary Prompt

O painel **Summary Prompt** controla as instruções que a IA usa para escrever um resumo. Clique em **Edit** para alterar o prompt ativo. Clique em **Templates** para abrir o gerenciador de modelos. Ali, a opção **New template** permite salvar um prompt com nome. Cada modelo salvo tem os próprios controles **Duplicate**, **Edit** e **Delete**.

Os modelos salvos são uma configuração global, válida para o aplicativo inteiro. Editar ou escolher um modelo em um chat de Roleplay muda o prompt de resumo usado em todos os chats de Roleplay.

### Summary Connection e tamanho da saída

O painel **Summary Connection** escolhe qual conexão escreve os resumos. O padrão dele aparece como **Agent default (falls back to chat connection)**. Ou seja, ele usa primeiro a conexão padrão do agente e, em segundo lugar, a conexão do próprio chat.

O campo **Maximum output size** define o tamanho máximo de um resumo gerado. O padrão é 4096 tokens, e a faixa vai de 1 a 32768.

### Opções de exibição

Os controles de **Display** na janela decidem como as mensagens resumidas aparecem na tela:

- **Hide summarised messages**: esconde as mensagens originais assim que um resumo passa a cobri-las. Desativado por padrão.
- **Recent message tail**: mantém esta quantidade de mensagens mais recentes totalmente visível, mesmo com a ocultação ativada. O padrão é 10, e qualquer número inteiro não negativo é aceito. Com o valor 0, todo o lote resumido fica escondido. Valores mais altos aumentam o tamanho do prompt e o custo do modelo.
- **Collapse hidden messages**: controla a aparência das mensagens escondidas na transcrição.

Se o chat exigir aprovação de escrita do agente (uma configuração separada, em Agents), os resumos gerados por IA esperam a sua revisão antes de valer.

## Automatic Summarization (Conversation)

Os chats de Conversation usam outro sistema, a **Automatic Summarization**. Ela fecha cada dia do calendário em um resumo diário e depois junta as semanas concluídas de resumos diários em um resumo semanal. O prompt então envia só os resumos semanais, os resumos diários da semana atual e as mensagens de hoje. Assim cada requisição continua pequena.

Esse recurso funciona sozinho e não pode ser desativado nos chats de Conversation.

### Abrir o editor

1. Abra um chat de Conversation e clique em **Chat Settings**.
2. Localize a seção **Automatic Summarization** (o ícone é um calendário).
3. Clique em **Edit Summaries** para abrir a janela **Automatic Summarization**.

A janela lista primeiro as entradas de semana e depois os dias que ainda não entraram em uma semana. Expanda uma entrada para editar o texto de **Summary** e a lista de **Key Details**, onde você pode acrescentar ou remover linhas.

### Day Rollover Hour e Recent Message Tail

Duas configurações da seção **Automatic Summarization** definem como os dias são separados:

- **Day Rollover Hour**: a hora em que um novo dia começa para os resumos. O padrão é 4 AM, e você pode escolher qualquer hora entre 12 AM (meia-noite) e 11 AM. As mensagens enviadas antes desse horário contam como parte do dia anterior. Escolha um horário em que você nunca está conversando, para uma sessão de madrugada não ser cortada ao meio.
- **Recent Message Tail**: quantas das mensagens mais recentes de hoje continuam palavra por palavra mesmo depois de resumidas. O padrão é 10, e qualquer número inteiro não negativo é aceito. Valores mais altos aumentam o tamanho do prompt e o custo do modelo.

Se você alterar a opção **Day Rollover Hour** depois que já existem resumos, Marinara avisa que os resumos antigos usaram a configuração anterior.

### Preencher os dias que faltam

Às vezes um dia acaba ficando sem resumo, por exemplo depois da importação de um chat antigo. O painel **Missing Summaries** dentro da janela tem um botão **Backfill** que tenta de novo nos dias recentes sem resumo. Ele olha até 14 dias para trás de cada vez.

Trocar a conexão ou o modelo usado nos resumos não reescreve as entradas de dia ou de semana que já existem.

## Solução de problemas

### O Memory Recall não recupera nada

- Verifique se existe uma fonte de embeddings configurada. Se os blocos em **Memories for This Chat** mostram **Embedding unavailable**, configure a seção **Semantic Search (Embeddings)** de uma conexão ou conte com o modelo local embutido. Veja [Como configurar o Local Model](../connections/local-model.md).
- Se os blocos mostram **Waiting for vector**, dê tempo a eles. As impressões digitais são criadas depois das respostas.
- A recuperação só acrescenta lembranças bem relacionadas à sua última mensagem. Se nada parecer relacionado, nada é acrescentado. Isso é normal.
- Se você trocou o modelo de embeddings há pouco tempo, use o ícone de reconstruir em **Memories for This Chat** para os blocos antigos combinarem com o novo modelo.

### Os resumos não são gerados

- Verifique se o chat tem uma conexão de texto funcionando. O Chat Summary usa a **Summary Connection**, e a Automatic Summarization usa a conexão de resumo resolvida. Se nenhuma funcionar, a geração é pulada.
- Se o chat exigir aprovação de escrita do agente, os resumos de IA esperam pela sua aprovação.
- Um resumo que falha é repetido automaticamente depois de um intervalo. Se ele continuar travado, use **Backfill Summary** (Roleplay) ou **Backfill** (Conversation) para tentar de novo manualmente.

## Guias relacionados

- [Como configurar o Local Model](../connections/local-model.md)
- [Conectando a um provedor de IA](../connections/connecting-to-a-provider.md)
- [Conversation Mode: primeiros passos](../conversation/getting-started.md)
- [Roleplay Mode: primeiros passos](../roleplay/getting-started.md)
- [Solução de problemas do Marinara Engine](../TROUBLESHOOTING.md)
