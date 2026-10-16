# Memory Recall e resumos do chat

Este guia explica **Memory Recall** (busca em mensagens anteriores), a opção **Advanced Memory Recall** (recuperação avançada de memória) para gerenciar automaticamente o contexto de Roleplay, **Chat Summary** e **Automatic Summarization** de Conversation.

## Os dois sistemas de memória

Todo modelo de IA só consegue ler uma quantidade limitada de texto de cada vez. Esse limite é a janela de contexto. Quando o chat fica longo, as mensagens mais antigas saem dessa janela e a IA esquece o que aconteceu. Marinara Engine (chamado de Marinara daqui em diante) tem dois sistemas separados que resolvem isso.

- O **Memory Recall** procura, nas mensagens antigas, os trechos mais relacionados ao que você acabou de dizer e insere esses trechos de volta no prompt, sem chamar atenção. Funciona em todos os modos de chat.
- Os resumos comprimem as mensagens antigas em recapitulações curtas, que ocupam o lugar das mensagens originais no prompt. Os chats de Roleplay usam o **Chat Summary**. Os chats de Conversation usam a **Automatic Summarization**.

Os chats de Game Mode contam apenas com o **Memory Recall**. Nenhum dos dois recursos de resumo existe ali.

Os dois sistemas podem ser usados ao mesmo tempo. Eles fazem trabalhos diferentes e não entram em conflito.

## Configurar o Memory Recall

O **Memory Recall** encontra trechos relevantes do começo do chat e os insere no prompt como lembranças. Para isso, ele usa um embedding: uma impressão digital numérica do significado de uma mensagem. Marinara compara a impressão digital da nova mensagem com as impressões digitais guardadas das mensagens antigas e acrescenta as mais parecidas.

### Ativar o Memory Recall

1. Abra um chat e clique no botão **Chat Settings** (configurações do chat). Ele começa no canto superior direito.
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

Para usar uma única fonte de embeddings em todo lugar, escolha-a em **Embeddings**, em **Connections** > **Connection defaults** (conexões padrão). As conexões sem um modelo de embeddings nem uma **Embedding Connection** próprios passam a usá-la, e a configuração própria de uma conexão continua tendo prioridade.

Se nenhuma conexão de embeddings nem padrão de **Embeddings** for definida, Marinara recorre a um modelo de embeddings local embutido. Ele baixa esse modelo uma única vez e o executa na sua própria máquina, sem precisar de chave de API. Para saber mais sobre o modelo embutido, veja [Como configurar o Local Model](../connections/local-model.md).

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

## Advanced Memory Recall (Roleplay)

Abra **Chat Settings → Memory Recall** e ative **Advanced Memory Recall**. Você também pode ativar **Automatic context and memory handling** (gerenciamento automático de contexto e memória) abaixo de Agents no assistente de configuração de Roleplay. Esse modo opcional gerencia em conjunto a janela do histórico atual, os resumos de continuidade e os trechos antigos relevantes. As configurações e o progresso da preparação estão disponíveis no assistente e no painel lateral Chat Settings, tanto no computador quanto no celular. O visualizador do arquivo permanece no painel Chat Settings.

### Configuração

- Escolha **Maximum allowed context before compression (tokens)** dentro do contexto aceito pelo modelo do chat. Quando o prompt de saída alcança esse tamanho, o contexto mais antigo é cortado e o histórico do chat volta a crescer a partir dali. O que foi cortado é resumido e entra nas memórias que podem ser recuperadas. O teto cobre o prompt de saída estimado: instruções, mensagens, memórias recuperadas, ferramentas e anexos, tanto no chat quanto no processamento de memória. Tokens de resposta e margem de segurança são contados separadamente. O limite total de contexto do modelo continua valendo; não é uma contagem exata do tokenizador nem um limite de cobrança.
- Escolha **Summary and recall budget (tokens)** (orçamento de resumos e recuperação) dentro desse teto. Ele define quanto do contexto vai para as memórias; o recomendado é pelo menos 10% do contexto máximo permitido. As constantes ativas devem ocupar no máximo **70%** desse valor como meta. A prioridade é constantes, resumos das cenas selecionadas, depois [recordações dos personagens](#character-recollections), quando ativadas, e, por último, trechos de mensagens. A memória total pode usar até **2.000 tokens extras** quando necessário, respeitando o contexto completo. Com 10k, a meta é até 7k de constantes e até 12k no total; as mesmas proporções valem para outros valores. Mensagens atuais não entram na parcela constante nem acionam sua consolidação.
- Por padrão: **Helper model** (modelo auxiliar) decide cenas, resume cenas e compacta continuidade. Usa a conexão dos agentes e, na falta dela, a do chat. A detecção histórica pode usar principal ou auxiliar; resumos sempre usam o auxiliar. Os modelos resolvidos aparecem antes da preparação.
- Todas as chamadas de resumo de memória usam **Chat Summary → Maximum output size**, com pelo menos **8.196 tokens de saída** para dar espaço ao raciocínio. Isso inclui resumos de cenas e consolidação de constantes; valores maiores são preservados. O limite comum de resposta da conexão auxiliar não substitui esse ajuste. Entrada e reserva de saída ainda precisam caber no contexto total do modelo.
- Cada pedido de resumo recebe instruções, mensagens acessíveis daquela cena, correções por intervalo aplicáveis e o formato de saída JSON. Cenas grandes demais são processadas em lotes salvos e depois combinadas. As recapitulações pedem **2–3 parágrafos**. O prompt padrão descreve acontecimentos passados, sem seções de situação atual ou tensões abertas; prompts personalizados escolhidos em **Summaries** continuam valendo. Advanced Memory funciona independentemente do interruptor principal Agents e não exige um agente baixado.
- **Maximum recalled scenes** (máximo de cenas recuperadas) é **3** por padrão. É um teto; correspondências fracas são ignoradas. **0** desativa cenas opcionais e mantém continuidade necessária. Cada cena fornece seu resumo seguido de no máximo um trecho.
- **Moving context** (contexto móvel) controla mensagens por trecho, **3–10** por padrão. Um trecho é formado por mensagens exatas de uma cena recuperada, inseridas logo depois do resumo dela. Ambos os limites em **0** fornecem só resumos; apenas o mínimo em **0** torna trechos opcionais. Relevância, acesso e espaço podem reduzir a quantidade a nenhuma. Cada cena recuperada recebe seu trecho mínimo antes que qualquer trecho cresça. Quando uma cena recuperada ainda fica sem trecho, o relatório de recuperação diz o motivo: não sobrou espaço depois dos resumos ou nenhuma das mensagens dela pode ser citada.

Em um chat de grupo Individual antigo, confirme uma vez os intervalos de conhecimento que faltarem para os personagens. A primeira fala de um personagem não prova que ele sabia de tudo o que aconteceu antes. Selecione um personagem real como **Narrator** (Narrador) apenas quando ele precisar ignorar os limites de participação. A ocultação específica por personagem e os intervalos de conhecimento confirmados continuam restringindo a memória. O **Hide from AI** (Ocultar da IA) global, definido manualmente ou por resumos automáticos, só remove um turno da transcrição ativa: Advanced Memory continua analisando esse turno, identificando os participantes da cena, resumindo e indexando seu conteúdo para a recuperação permitida. Marcadores de início recortam a transcrição ativa. Você pode corrigir esses intervalos depois; personagens adicionados precisam de sua própria confirmação.

Em um chat existente, clique primeiro em **Prepare existing history** (Preparar histórico existente). Se o histórico recuperado mudar os limites de uma cena coberta por uma correção manual, desative essa memória para manter seu texto como referência, ou exclua-a, e prepare o histórico novamente. O botão **Fix** (corrigir) pula essa cena e a coloca na lista, em vez de parar; veja [Corrigir problemas de memória](#fixing-memory-problems). Salvar a mesma correção não pode atribuir seu texto com segurança a outro intervalo de origem. A preparação processa o histórico antigo em lotes e mostra a etapa atual ao lado da roda de hamster da Professor Mari. **Cancel** mantém o trabalho concluído; **Resume** continua depois de fechar o painel, reiniciar o servidor ou atualizar o aplicativo. Uma chamada ao modelo que falha preserva a memória válida anterior e exibe um erro para tentar novamente. Não redefina a memória para se recuperar de uma chamada com falha: Resume reutiliza os resumos concluídos e a detecção de cenas que não mudou. A última cena em andamento continua aberta e é resumida quando termina; trechos de origem limitados são usados se suas mensagens ativas excederem o limite de contexto.

Abra um resumo em **Access memories for this chat** e escolha **Delete summary** (excluir resumo) no final. Confirme o resumo e seu público. Também vale para entradas antigas **Continuity** (continuidade) e **Ongoing scene** (cena em andamento). A preparação normal não recria resumos de cenas excluídos. Mensagens originais permanecem intactas. Novos constantes ficam em **Chat Summaries**, com os controles existentes de edição, ativação, combinação e exclusão. A continuidade antiga do cofre não é constante adicional.

<a id="fixing-memory-problems"></a>

### Corrigir problemas de memória

Quando algo na memória de um chat está quebrado, você fica sabendo sem abrir as configurações de memória. Um pontinho que não pisca, na sua cor de destaque, aparece em um canto do botão **Chat Settings**, e um aviso informa quantas cenas têm problemas. Cada conjunto de problemas é anunciado uma vez; o pontinho continua lá até que eles sejam resolvidos. Em **Chat Settings → Memory Recall**, os mesmos problemas aparecem listados acima das configurações, e **Access memories for this chat** mostra o mesmo pontinho.

Pressione **Fix**, no aviso ou nessa lista, para consertar todas as cenas sinalizadas de uma só vez. Ele usa o **Helper model** e a barra de progresso de sempre. **Pause processing** (pausar o processamento) o interrompe e **Resume processing** (retomar o processamento) continua o Fix; o trabalho já feito é mantido. Fix:

- pergunta de novo ao auxiliar quem estava nas cenas marcadas com **Check who was there** (conferir quem estava lá) e salva uma resposta clara. Se o auxiliar ainda não souber dizer, ninguém ganha acesso: a cena mantém apenas os personagens que já tinha e que o auxiliar não deixou de fora, e entra na lista para você conferir;
- verifica quem estava nas cenas antigas salvas antes de existir a verificação de participantes, inclusive aquelas cuja verificação automática falhou;
- escreve novos resumos para cenas cujas mensagens, mensagens ocultas, nomes de personagens ou resumos de apoio mudaram, e para cenas encerradas que não têm resumo. Resumos que você excluiu continuam excluídos;
- retoma o trabalho de memória que parou com um erro.

Fix nunca reescreve um resumo que você editou à mão. Se um deles não corresponder mais às mensagens, deixar de fora mensagens que voltaram a ficar visíveis, ou se os limites da cena tiverem mudado, Fix não mexe nele e o coloca em **need your review** (precisam da sua revisão), depois continua com as outras cenas. As configurações que ele não pode mudar por você, como confirmar o intervalo de conhecimento de cada personagem ou escolher uma conexão de decisão que funcione, continuam listadas até que você as mude.

Ao terminar, Fix mostra **Fixed N scenes** (N cenas corrigidas) e, como números de cena, as cenas listadas em **need your review**. Selecione um número para abrir essa cena em **Access memories for this chat**. Se o painel Chat Settings estava fechado, um aviso com **Show** (mostrar) leva você até lá. O próximo Fix não volta a perguntar sobre uma cena que ele não conseguiu decidir; salve você mesmo o acesso dos personagens a ela.

### Reanalisar as cenas

Se alguma mudança de cena passou despercebida, por exemplo quando uma cena nunca terminou e nada novo foi resumido, use **Re-scan scenes** (reanalisar as cenas) em **Chat Settings → Memory Recall**. Informe o número da primeira e da última mensagem a verificar e pressione **Re-scan** (reanalisar). Por padrão, o intervalo é o da cena em andamento. Advanced Memory volta a procurar as mudanças de cena nessas mensagens, com o modelo de decisão quando **Use Decision model** está ativado e, caso contrário, com o modelo auxiliar, e resume as cenas que mudaram. As cenas fora dessas mensagens mantêm os limites e os resumos, e as verificações normais depois de cada resposta continuam como antes. Se um resumo que você editou fosse mudar, a reanálise é interrompida e indica essa cena, como acontece na preparação.

<a id="optional-jev-decisions"></a>
<a id="optional-decision-model"></a>

### Modelo de decisão opcional

Ative **Use Decision model** (Usar modelo de decisão) no Advanced Memory e escolha um modelo em **Memory Decision connection** (Conexão de decisão para memória). Em **Local models**, o menu mostra os mesmos modelos locais que o **Decision model** (modelo de decisão) global, por exemplo o **Primary local model** (modelo local principal) que você roda em **Local Model**. Um modelo que ainda não pode responder aparece acinzentado com o motivo, e um modelo parado é iniciado quando Advanced Memory faz uma pergunta a ele. Em **Connections**, o menu lista as suas conexões de decisão salvas. Crie uma em **Connections** usando TypeSafe, OpenRouter ou uma fonte de decisão compatível; consulte [Modelos de decisão](../connections/decision-models.md). A opção vem desativada e é salva para cada chat Roleplay. Sua escolha é independente do padrão global de decisão.

O modelo escolhido identifica limites de cena durante a preparação do histórico e as verificações durante o chat. Antes de uma nova resposta, ele escolhe as memórias em duas etapas. Primeiro, a recuperação normal pré-seleciona até 24 resumos de cena, ou até o valor de **Maximum recalled scenes**, se for maior. A pré-seleção combina duas classificações, a correspondência de texto e os embeddings, então uma cena pode entrar por palavras em comum ou pelo significado. Os embeddings comparam cada cena com cada uma das suas mensagens desde a última vez que o personagem que responde falou, até seis, então, em um chat em grupo, eles também cobrem o que você disse a outro personagem; a primeira resposta de um personagem usa a sua mensagem mais recente. Até que quase todas as cenas tenham embeddings, a pré-seleção usa, em vez disso, a classificação da recuperação normal, para que as poucas cenas que já os têm não tirem o lugar das correspondências de texto. A cena logo depois de cada uma das três melhores também ganha uma vaga, para perguntas sobre o que aconteceu em seguida. Cada resumo que o modelo avalia começa com uma linha curta: o intervalo de mensagens, a data na história e quem falou, com base nas mensagens que os personagens que respondem viram. O modelo escolhe as cenas relevantes dessa pré-seleção e depois avalia até 12 mensagens originais de cada cena escolhida, as de melhor correspondência de texto, para escolher o trecho dessa cena. A melhor escolha fica no centro, e as outras escolhas estendem o trecho até **Maximum messages per excerpt** (máximo de mensagens por trecho). Quando ele não aceita nenhuma mensagem de uma cena, a correspondência de texto centraliza o trecho e o relatório de recuperação informa isso. Uma cena em que nenhuma dessas mensagens cabe sozinha no espaço deixado pelos resumos não pode receber um trecho, então o modelo não avalia as mensagens dela; quando isso vale para todas as cenas escolhidas, ele não envia a segunda requisição. A cada nova mensagem, ele verifica se a história passa para outro lugar ou outro momento, muda para personagens que estão em outro lugar ou vem depois de uma linha de quebra de cena, como `***`, ou de uma nota de POV fora do personagem. Ele vê as três mensagens anteriores e quem escreveu cada uma. Limites incertos deixam a cena aberta. O **Helper model** continua escrevendo todos os resumos e atualizações de continuidade. Os limites atuais de cenas, tamanho dos trechos, acesso dos personagens e tokens continuam valendo. Uma decisão válida pode não selecionar nada.

Provedores hospedados recebem a conversa recente e os resumos ou mensagens pré-selecionados que estão sendo avaliados e podem cobrar por várias solicitações por resposta. A recuperação verifica o acesso dos personagens e processa condições de partes privadas dos resumos antes de enviar candidatos. Ela envia apenas mensagens originais que os personagens que recuperam a cena viram no chat, e cada personagem continua recebendo apenas as partes de um resumo destinadas a ele. As solicitações usam lotes limitados pelo contexto da conexão; o contexto anunciado para um roteador de chat Jev não é considerado automaticamente válido para decisões.

Cada etapa da recuperação recebe tempo para o próprio trabalho: mais ou menos o que o modelo precisa para cada pergunta, vezes o número de perguntas, mais a metade disso. Uma etapa recebe no mínimo 10 segundos e no máximo 25, e as duas etapas juntas, no máximo 40 a cada resposta. Os modelos Open-Jev gerenciados usam o tempo medido por pergunta; uma conexão de decisão responde às perguntas de uma requisição todas juntas, então conta cada requisição uma vez só. Quando um modelo desses não consegue responder a todas as perguntas nesse tempo, ele avalia menos perguntas, começando pelas melhores correspondências. Um modelo de chat que recebe uma pergunta por vez conta 1 segundo para cada uma, mas a velocidade real dele é desconhecida, então ele recebe todas as perguntas e valem as respostas que chegam a tempo. As perguntas vão em requisições curtas, então, quando o tempo acaba, as requisições já respondidas continuam valendo. Enquanto a recuperação roda, a resposta mostra o texto provisório de sempre, **Thinking…** (pensando).

Quando uma requisição falha ou esgota o tempo limite, ou um resumo é grande demais para ser enviado, só essas memórias recorrem à recuperação normal, depois das cenas que o modelo escolheu, e o relatório de recuperação informa isso. Conexões ausentes e etapas em que nenhuma resposta voltou recorrem por completo à recuperação normal: a própria classificação da pré-seleção escolhe as cenas e a correspondência de texto escolhe os trechos; decisões de cena indisponíveis usam a verificação de cena existente. Os embeddings também são criados neste modo. Uma cena recém-resumida os recebe na hora. As cenas preparadas no modo de decisão antes de os embeddings passarem a ser criados nele, e as memórias com embeddings de outro modelo de embeddings, recebem os embeddings depois das respostas, algumas de cada vez, começando pelos resumos e pelas cenas mais recentes; **Reindex** (reindexar) cria todos de uma vez.

A inspeção do prompt continua somente para leitura e mostra a recuperação normal sem chamar o provedor de decisão. Em **Peek Prompt → Decision diagnostics** (Peek Prompt → diagnóstico de decisões), **Advanced Memory activity** (atividade do Advanced Memory) mostra os resultados salvos da última recuperação e verificação de cena: modelo, tempo, pontuações, memórias ou inícios de cena selecionados, estado do mecanismo alternativo e o motivo de uma cena recuperada não ter trecho. Os relatórios são registrados para novas chamadas após esta atualização e mantêm até 128 resultados, com os selecionados primeiro. Representam atividade passada, não previsões para a prévia; abrir o painel ou testar declarações do prompt não executa novamente as decisões de memória. As verificações de cena do modelo de decisão sempre usam uma requisição própria, separada dos lotes de trackers e agentes. O relatório de recuperação identifica decisões e alternativas usadas. Os swipes compatíveis reutilizam as seleções salvas; alterar essas configurações invalida seleções salvas incompatíveis. Uma continuação escolhe as memórias de novo.

<a id="deciding-who-sees-new-messages"></a>

### Decidir quem vê as novas mensagens

Em um chat em grupo de Roleplay em que os personagens respondem um de cada vez, Advanced Memory pode decidir quais personagens veem cada nova mensagem, para que você não precise ocultar cada fala de um personagem que saiu da cena. Ative **Decide who sees new messages** (decidir quem vê as novas mensagens) no Advanced Memory. A opção vem desativada por padrão e só aparece em chats em grupo em que os personagens respondem um de cada vez; chats em grupo mesclados e chats com um só personagem não a oferecem.

Com a opção ativada, cada nova mensagem, sua ou de um personagem, fica oculta para os personagens que não estão naquela cena. O resultado usa o mesmo **Hide from AI** por personagem do botão da própria mensagem, então o marcador de olho riscado mostra quem não pode vê-la. A sua própria mensagem é decidida assim que você a envia, mesmo quando nenhum personagem responde. Antes de o próximo personagem responder, as mensagens anteriores já foram decididas, então esse personagem nunca lê uma fala que não deveria ler.

- O **Narrator** escolhido aqui e o **Narrator character** (personagem narrador) escolhido em **Roleplay Commands** (comandos de Roleplay) sempre veem todas as mensagens. O autor de uma mensagem sempre vê a própria mensagem. O destinatário de um sussurro que não está na cena perde o restante da mensagem, mas ainda recebe o sussurro.
- Com **Use Decision model** ativado, pergunta-se ao modelo de decisão, para cada personagem, se ele claramente não pode ver nem ouvir a mensagem, por exemplo por estar em outro lugar ou ter saído. Um personagem que a história nunca coloca na cena conta como estando em outro lugar. Um personagem que está lá, mas ficou de fora de um sussurro, continua vendo o restante da mensagem. Caso contrário, quem decide é o **Helper model**. Em ambos os casos, uma mensagem só é ocultada quando o modelo tem certeza; quando não tem, o personagem continua vendo a mensagem. Quando uma verificação de cena está prevista depois de uma resposta, a mesma requisição também responde quem está presente, então nenhuma chamada extra é feita para essas mensagens.
- O modelo lê as mensagens da cena atual até o momento e sempre pelo menos as últimas mensagens anteriores a ela, mesmo quando uma nova cena acabou de começar. Ele também recebe uma lista dos personagens que falaram desde o início da cena atual. Essa lista é só uma dica: um personagem que está ouvindo em silêncio continua contando como presente, mesmo que não tenha dito nada.
- Se você mesmo mudar o **Hide from AI** de uma mensagem, ou usar `/hide` ou `/unhide` nela, antes ou depois da escolha automática, a sua escolha permanece e Advanced Memory nunca mais altera essa mensagem. Mensagens que você já tinha ocultado de alguém continuam como estão.
- Cada mensagem é decidida uma única vez. Se o modelo falhar ou não responder a tempo, nada é ocultado naquela mensagem, e o erro aparece no log do servidor.

Com Advanced Memory ativado, uma nova resposta de personagem pode mudar de cena ou de ponto de vista com uma linha de quebra, como `***`, `---` ou `* * *`. Ela é então salva como mensagens separadas do mesmo personagem, uma para cada parte.

- Cada parte tem o próprio público. **Decide who sees new messages**, **Hide from AI** e os sussurros valem para cada parte separadamente.
- O personagem que escreveu a resposta continua vendo todas as partes, como acontece com qualquer mensagem dele. Se ele não deve ver uma parte, oculte-a dele você mesmo.
- A linha de quebra fica no topo da parte que vem depois dela. Uma quebra dentro de um bloco de código ou de um bloco HTML, como um painel `<details>`, não conta.
- O raciocínio da resposta aparece na primeira parte. Ele não é enviado de volta ao modelo, mesmo com **Exclude Past Reasoning** (excluir o raciocínio anterior) desativado.
- As informações da mensagem, os trackers e os resultados dos agentes ficam com a última parte.
- O Prose Guardian e outros agentes de reescrita reescrevem cada parte separadamente, e a linha de quebra continua no topo. Com **Hold Message Until Rewrite** (segurar a mensagem até a reescrita) ativado, cada parte espera a própria reescrita. Se a reescrita de uma parte falhar, essa parte fica como foi escrita e as outras são reescritas mesmo assim.
- A leitura automática em voz alta lê todas as partes, em ordem.
- Dar swipe ou regenerar uma parte gera uma nova versão só daquela mensagem. Em uma parte anterior, a nova versão mantém só o texto antes da primeira quebra, porque as cenas depois dela já têm as próprias mensagens.
- Continue e Impersonate nunca dividem a resposta.

<a id="character-recollections"></a>

### Recordações dos personagens

Ative **Character recollections** (recordações dos personagens) no Advanced Memory para dar a cada personagem a própria memória de uma cena. A opção vem desativada por padrão.

- Para cada cena encerrada, cada personagem que estava nela ganha uma memória curta da cena, com cerca de 50–100 palavras, escrita em primeira pessoa e com a voz dele: o que ele pensa ao se lembrar dela e o que mais o marcou. O card de personagem dele decide o que ele percebe, então o que um personagem lógico lembra é diferente do que lembra um personagem que se importa com o que os outros sentiram. O **Narrator**, a sua persona e os personagens que estavam em outro lugar não ganham nenhuma.
- O modelo recebe a instrução de usar só o que cada personagem poderia saber. A requisição marca cada mensagem oculta para um personagem, seja pela ocultação específica por personagem (inclusive **Decide who sees new messages**), seja por vir antes do início do intervalo de conhecimento dele, e indica que uma parte de um resumo escrita só para alguns personagens (`{{#if char == …}}`) é só deles. Mensagens ocultas para todos com o **Hide from AI** global continuam fazendo parte da cena, como acontece nos resumos. Uma recordação que copia quatro palavras seguidas de algo que o personagem dela não poderia saber fica de fora, a não ser que ele tenha lido essa sequência de palavras em outro ponto do chat ou no próprio card, ou que cada uma dessas palavras apareça em várias mensagens que ele leu. Um fato recontado com outras palavras não é detectado assim; só as instruções protegem contra isso.
- Uma recordação só vale enquanto o personagem dela puder ler exatamente o que podia quando ela foi escrita. Se depois uma mensagem da cena for ocultada dele, ou mostrada a ele, uma recordação gerada é escrita de novo, e uma que você editou fica fora dos prompts até você conferi-la e salvá-la de novo.
- As recordações de uma cena nova vêm da mesma requisição do resumo dela, que então também inclui o card de personagem completo de cada personagem que podia ler parte da cena, de modo que nenhuma requisição extra é feita. Se os cards obrigarem a dividir a cena em mais partes do que sem eles, o resumo é escrito sem os cards e as recordações vêm depois, em uma requisição própria, um personagem de cada vez quando vários cards juntos obrigariam a dividir a cena. Um personagem cujo card ocupa mais da metade do espaço que o modelo auxiliar tem para a cena não ganha recordação. Uma cena longa resumida em partes ainda termina com uma recordação por personagem.
- As requisições que só escrevem recordações também incluem os **Chat Summaries** que cobrem a cena e, se você o editou, o resumo da cena, para que a recordação siga as suas correções.
- Ativar a opção em um chat cujas cenas já têm resumo acrescenta recordações a essas cenas, uma requisição por cena, e o progresso aparece como **Writing character recollections** (escrevendo as recordações dos personagens). Os resumos das cenas, inclusive os que você editou, nunca mudam. Cenas que já têm recordações são puladas. Se uma cena falhar, as outras recebem as delas mesmo assim, e **Resume** tenta de novo as que falharam.
- Se o modelo não escrever nada aproveitável para um personagem, a cena guarda uma recordação vazia para ele, e o modelo não é consultado de novo para ele até que mude o resumo da cena ou o que ele podia ler. Você pode escrever uma por conta própria em **Access memories for this chat**.
- As recordações só aparecem com cenas recuperadas, logo abaixo do resumo da cena e antes do trecho dela, uma linha por personagem, como `Kaito's personal recollections from this scene: *…*`. Em um chat em grupo em que os personagens respondem um de cada vez, cada personagem vê apenas a própria, e o **Narrator**, quando responde sozinho, não vê nenhuma. Em uma resposta mesclada, aparece a recordação de cada personagem presente que se lembra da cena, com o nome dele, inclusive quando o narrador compartilha a resposta.
- Elas entram na conta de **Summary and recall budget**: primeiro vêm os resumos das cenas, depois as recordações e, por fim, os trechos. Quando falta espaço, primeiro os trechos diminuem, depois recordações inteiras ficam de fora. Uma recordação nunca é encurtada.
- As recordações nunca são copiadas para os **Chat Summaries** nem usadas para escolher quais cenas são recuperadas.
- Quando o resumo de uma cena muda, porque você o editou ou porque ele foi escrito de novo, as recordações geradas dessa cena ficam desatualizadas e saem dos prompts. Depois de cada resposta, assim que os Chat Summaries estão em dia, as recordações de até três cenas são escritas de novo, começando pelas cenas mais recentes; **Prepare** (preparar), **Re-scan scenes** e **Resume** refazem todas. Uma cena cuja requisição falhou depois de uma resposta espera **Prepare** ou **Resume**.
- Em **Access memories for this chat**, abra uma cena para ler e editar a recordação de cada personagem em **Character recollections**. Uma recordação editada recebe a marca **Manually edited** (editada manualmente) e nunca é substituída. **Delete** (excluir) tira uma recordação dos prompts, e ela nunca é escrita de novo; você ainda pode digitar uma nova no campo vazio dela.
- Desativar a opção mantém as recordações salvas, mas as deixa fora dos prompts. Ativá-la de novo em um chat em que a escrita das recordações parou faz essa escrita recomeçar. Exportação, importação e ramificações incluem as recordações.

### Durante o chat

A detecção de cenas acontece depois que a resposta principal de Roleplay é salva. **Standalone scene check interval (messages)** tem padrão **5**. Quando chega esse número de mensagens novas, o verificador recebe todas as mensagens desde a última verificação (até o dobro do intervalo), a mensagem em que a última verificação terminou, para comparação, as instruções de cena e o formato de saída. Ele aponta a mensagem exata que encerra cada cena, que pode ser aquela mensagem anterior, ou não retorna finais se a cena continua. Contam mensagens de personas e personagens. A frequência independe dos horários dos agentes de acompanhamento; com o modo de decisão desativado, uma verificação programada compartilha uma chamada de um agente de acompanhamento após a geração quando visibilidade e orçamento permitem, ou usa o auxiliar separadamente. Cada intervalo começa depois do final anterior e inclui a nova mensagem final. Só um final detectado prepara em segundo plano o resumo e o índice da cena encerrada, inclusive quando ela termina na resposta mais recente. Transições incertas deixam a cena aberta. **Chat Settings → Agent activity** mostra **Advanced Recall**, com progresso, erros e recuperação, mesmo com agentes comuns desativados. O progresso só é consultado durante uma tarefa de memória; arquivos prontos não são consultados em repouso.

Com o modo de decisão desativado, a recuperação normal lê as memórias preparadas em vez de preparar o arquivo de novo. O embedding opcional da consulta tem um tempo limite curto e, se não estiver disponível, recorre à correspondência de texto. A correspondência de texto dá mais peso aos termos distintos das suas mensagens desde a última vez que o personagem que responde falou, para que um detalhe breve encontre um resumo de cena longo. Um nome mencionado nelas, como o de um animal de estimação, conta mais. Os nomes dos personagens que respondem e o nome da sua persona não contam, nem um nome que aparece na maioria das memórias. As mensagens originais indexadas também permitem encontrar cenas quando a saída de trechos está desativada. A correspondência de texto não acrescenta nenhuma chamada ao modelo. A recuperação só roda na geração principal de Roleplay: chamadas de agentes, reexecuções manuais de agentes e gerações auxiliares de teste não a acionam nem recebem os resumos ou trechos que ela retorna. A inspeção do prompt principal continua somente leitura.

Variantes regeneradas reutilizam a primeira memória compatível daquela resposta: continuidade, resumos de cenas e trechos exatos. Variantes sem mudanças não repetem busca nem auxiliar. Continuar preserva memória inicial. Respostas antigas sem instantâneo salvam um na próxima geração e o reutilizam depois; não é preciso redefinir. Adições e combinações em segundo plano preservam instantâneos compatíveis. Mudanças do usuário em histórico, acesso, resumos ou memórias invalidam os incompatíveis. O limite atual de contexto sempre vale. Um swipe também faz uma nova recuperação quando uma cena anterior que o personagem dele podia recuperar foi salva, editada, ativada ou desativada depois daquela resposta. Uma cena que ainda faz parte do histórico do chat da resposta em que você deu swipe ainda não pode ser recuperada, então salvá-la não provoca outra recuperação.

A geração principal lê imediatamente a memória salva. Nunca inicia nem espera a geração de continuidade, mesmo com um auxiliar em segundo plano. Quando o prompt de saída alcança o teto, a janela atual recomeça no início da cena mais recente para **todos os personagens** e cresce até atingir o teto novamente. As solicitações que vêm depois de uma chamada de função ou de uma rolagem não contam para o teto nem fazem a janela recomeçar. O corte aparece em **Mark as new start** com **All** selecionado; desmarque All para desfazê-lo. Marcas pessoais continuam valendo. Se uma cena aberta ou constante grande demais não couber, a solicitação usa trechos identificados e mantém as mensagens mais recentes. Esse ajuste temporário não cria outra marca persistente. Resumos salvos e mensagens originais não são sobrescritos.

Após a resposta principal, Advanced Memory acrescenta **Chat Summaries** para as mensagens arquivadas que nenhum resumo cobre ainda, reaproveitando recapitulações de cena prontas quando possível. Entradas inativas contam como cobertas. Em um chat em grupo em que os personagens respondem um de cada vez, todos que leram a recapitulação de uma cena compartilham um único resumo dela.

Quando os resumos ativos que um personagem lê ultrapassam 70% de **Summary and recall budget**, **Updating continuity** os combina e encurta após a resposta, usando o auxiliar escolhido e **Chat Summary → Maximum output size**. A resposta em si nunca espera por isso. A parcela de cada personagem é contada separadamente; em um chat em grupo mesclado, a parcela é o que o prompt compartilhado leva. Um resumo que ainda cobre mensagens do histórico atual de alguém espera até que essas mensagens saiam dele. Os 2.000 tokens extras pertencem à memória total, não a essa parcela.

Resumos que personagens diferentes leem são combinados em um só, inclusive os que você mesmo escreveu ou editou. As partes privadas continuam nas seções `{{#if char == "Name"}}…{{/if}}`, para exatamente os personagens que as conheciam. Se o resultado do auxiliar alterar quem pode ler uma parte, ele não é salvo, e grupos menores são tentados no lugar. Uma parte para um personagem que saiu do chat mantém a condição, então continua sendo dele se ele voltar. Resumos que usam macros diferentes de `{{user}}`, ou que só o narrador ainda lê com uma parte desse tipo, ficam como estão; se só eles já preenchem a parcela de um personagem, encurte-os manualmente ou aumente o orçamento. As entradas substituídas, inclusive as suas, ficam inativas, então você pode reativá-las. Resultados com falha ou incompletos não são salvos, e **Resume processing** tenta de novo. Resumos de cenas ficam no cofre.

O prompt de um personagem só mostra o intervalo de mensagens e as datas de um resumo a partir das mensagens que esse personagem pode ver. O **Narrator** do Advanced Memory, quando responde sozinho, lê uma única vez todas as partes de todos os resumos. Uma parte que também depende de uma variável, ou que usa `{{char}}` para mais de um personagem, continua seguindo a condição dela.

O arquivo recupera resumos relevantes e diálogos exatos com números e falantes originais. Uma seção **Recalled Scenes** contém cada resumo imediatamente seguido de seu trecho disponível, com um único cabeçalho de intervalo. Cenas sem trecho ficam nessa mesma seção. O bloco informa o intervalo atual e o número da última mensagem do usuário, para que os acontecimentos passados se distingam do turno atual. Cenas só são recuperadas quando todas as fontes estão fora do histórico atual enviado; trechos também excluem mensagens atuais. **Chat Summaries** por intervalo são omitidos enquanto qualquer mensagem coberta continuar no contexto. Permanecem salvos e ativos e voltam a ser elegíveis quando todo o intervalo sai da janela. Constantes elegíveis têm prioridade sobre a recuperação opcional e mantêm suas condições de personagem. Todos os resumos selecionados reservam espaço antes dos trechos. Limites de acesso e fontes históricas continuam valendo. Ilustrações e legendas de imagens são omitidas das mensagens recuperadas e novas entradas de resumo; anexos de texto legíveis permanecem. Contam personas e personagens. Regeneração histórica só usa fontes anteriores à resposta alvo, mesmo antes da janela gerenciada. Editar, trocar de variante, ocultar ou excluir fontes provoca nova verificação da memória derivada antes do uso.

Abra **Access memories for this chat** (Acessar memórias deste chat) no mesmo painel para buscar resumos de cenas numerados cronologicamente, inspecionar seus períodos e públicos, editar **Summary text** (Texto do resumo) ou ler as mensagens originais completas com **Inspect source messages** (Inspecionar mensagens de origem). Os trechos internos literais não são entradas separadas de resumo de cena. Períodos da história fundamentados nas fontes acompanham o contexto recuperado; datas desconhecidas continuam desconhecidas. Você pode desativar registros de recuperação, reindexar, exportar/importar ou confirmar **Delete all memories** (Excluir todas as memórias) para reiniciar a preparação mantendo o chat original e suas configurações. Correções dos resumos manuais originais são preservadas e invalidam a continuidade dependente. Para excluir uma cena da recuperação, desative seu registro de memória. A ocultação de origem específica por personagem continua controlando quem pode acessá-la; a ocultação global não a remove do arquivo.

Cada resumo de cena também registra quem participou dela. Um nome de participante diferente do card de personagem, como "Kaito" para **Kaito Nakamura**, ainda conta quando corresponde a exatamente um personagem e não pode ser o nome da sua persona. Nomes compartilhados por dois personagens ou por um personagem e a sua persona, descrições como "Kaito's sister" e nomes com observações como "(mentioned)" nunca dão acesso a um personagem. O nome da sua própria persona não é um erro e não dá acesso a nenhum personagem. Quando o auxiliar não diz quem participou, a cena vai para todos os personagens: o único personagem, em um chat com um só personagem, ou todos eles, em um chat em grupo. Em um chat em grupo, Advanced Memory então conta isso como um problema de memória e marca a cena com **Check who was there** em **Access memories**, para que você remova quem não estava lá com **Edit character access** (editar acesso dos personagens) ou deixe **Fix** perguntar de novo ao auxiliar. Nomes que não correspondem a nenhum personagem não dão acesso, e a cena em que aparecem é marcada da mesma forma, para que você defina os participantes dela. Uma cena em que o auxiliar indica explicitamente que só você estava presente continua restrita ao narrador. Resumos de cena salvos antes de existir a verificação de participantes continuam restritos ao narrador até serem verificados: **Fix** e **Prepare existing history** verificam todos eles, e cada resposta que encerra uma cena também verifica até três. Uma cena cuja verificação automática falha aguarda **Fix** ou **Prepare existing history**.

Um personagem presente em parte de uma cena pode compartilhar o acesso à memória dela com outros participantes, mesmo que algumas mensagens estejam ocultas para ele. Uma cena sem mensagens de origem acessíveis continua indisponível. As novas instruções de resumo identificam a visibilidade das mensagens, descrevem eventos compartilhados em texto simples e reservam `{{#if character == "Name"}}…{{/if}}` para partes privadas. Mencionar um personagem ausente não o torna participante. Se a visibilidade das fontes ou o nome de um personagem para quem o resumo foi escrito mudar, o resumo antigo fica indisponível para leitores com acesso parcial até você preparar a cena novamente (**Fix** faz isso em todas essas cenas) ou revisar as condições privadas e salvar o texto corrigido. Um personagem que entra no chat depois não conta como mudança, a menos que só parte da cena esteja visível para ele. Resumos salvos por versões anteriores não registram para quais personagens foram escritos, então precisam de um **Fix** depois que um personagem entra. Resumos antigos sem informações de visibilidade salvas exigem a mesma revisão antes do acesso parcial; alterar apenas o público não confirma o texto. Leitores com acesso a todas as mensagens de origem ainda podem recuperar a memória, e o texto corrigido manualmente nunca é reescrito silenciosamente. Essas verificações não chamam um modelo durante a recuperação. As datas e os períodos da cena são metadados compartilhados por todos os participantes atribuídos, mesmo quando algumas mensagens estão ocultas. Trechos originais nunca incluem mensagens ocultas para o personagem nem sussurros. Um resumo com partes destinadas só a alguns personagens ainda assim recebe um trecho: ele cita apenas as mensagens que aquele personagem viu no chat, então não revela nada que ele já não tenha visto. Para manter uma mensagem fora da memória de um personagem, oculte-a desse personagem. Os Chat Summaries constantes continuam incluindo mensagens ocultas da IA; as condições por personagem controlam o acesso aos detalhes privados sem excluir essas mensagens da cobertura do resumo.

Em um chat em grupo mesclado, uma resposta pode falar por todos os personagens, então a recuperação inclui o que pelo menos um personagem do chat lembra. Uma cena ou uma parte privada de um resumo que nem todos os personagens do chat conhecem é marcada com quem a conhece, como "known only to Kaito". Adicionar um personagem no meio do chat não esconde mais as memórias anteriores dos outros. Uma mensagem oculta para um personagem continua fora do histórico atual compartilhado, mas os personagens que podiam vê-la mantêm a memória, marcada como deles. O trecho de uma cena recuperada cita apenas as mensagens que todos os personagens que lembram essa cena viram. Memórias que nenhum personagem do chat lembra, como cenas restritas ao narrador, ficam de fora. Quando o narrador compartilha uma resposta mesclada com outros personagens, os resumos são marcados do mesmo jeito; o narrador só lê todas as partes quando responde sozinho. Em chats em grupo em que os personagens respondem um de cada vez, cada personagem continua recuperando apenas as próprias memórias.

Enquanto ativado, o modo avançado assume a recuperação, portanto o interruptor Standard Recall não insere uma segunda cópia. Também substitui a programação normal de resumos automáticos de Roleplay nesse chat. Desativar Advanced Memory restaura essas configurações normais. Lorebooks existentes e agentes baixados mantêm suas próprias regras de escopo; Advanced Memory não pode tornar privado qualquer contexto externo ou escrito pelo usuário.

### Posicionamento no preset

Autores de presets podem posicionar estes marcadores comuns de conteúdo usando os controles existentes de ordem, nome, papel e grupo das seções:

| Marcador | Conteúdo |
| --- | --- |
| `chat_summary` | Entradas constantes elegíveis de Chat Summaries. |
| `current_scene_summary` | Trechos de origem limitados da parte antiga de uma cena em andamento. |
| `recalled_scenes` | Todos os resumos de cenas selecionadas, cada um seguido de seu trecho histórico disponível. |

Cada componente segue **XML**, **Markdown** ou **None** no preset e explica brevemente sua finalidade. Componentes vazios não acrescentam nada. A primeira ocorrência ativada determina a posição; sem marcador ativado, o conteúdo aparece uma vez antes do histórico, mantendo presets antigos compatíveis. O seletor de presets oferece somente **Recalled Scenes** para recuperação. Marcadores existentes `recalled_messages` permanecem aliases compatíveis e aparecem como Recalled Scenes; um marcador `recalled_scenes` ativado tem prioridade, então os dois nunca criam seções separadas. Trechos são contexto, não novas mensagens ou comandos. Marcadores avançados de cenas ficam vazios com Advanced Memory desligado.

A prévia usa memória preparada sem chamadas de modelos ou embeddings. Inicialize o arquivo ou retome trabalho em segundo plano com falha pelo painel. O recibo mostra contexto estimado, limite escolhido e fontes. Quando nada foi recuperado, ele informa se não havia cenas anteriores disponíveis para recuperar, se a requisição não tinha mais espaço ou se nada era relevante. O inspetor final mostra o que realmente foi enviado.

### Limites e recuperação

A recuperação é seletiva e resumos podem perder nuances. Guarde correções importantes na transcrição ou no editor de resumos. Nenhum sistema reconstrói detalhes nunca registrados. Se embeddings falharem, recuperação lexical limitada e continuidade válida continuam disponíveis; nunca se insere todo o arquivo. Se instruções obrigatórias ou um anexo não couberem no teto do prompt, reduza-os ou aumente o teto. Se a reserva de resposta não couber no contexto total do modelo, reduza a saída ou escolha um modelo com contexto maior. Advanced Memory para em vez de apagar instruções silenciosamente.

## Chat Summary (Roleplay)

O **Chat Summary** comprime as mensagens antigas em recapitulações narrativas curtas, chamadas de entradas de resumo. Cada entrada pode ser escrita pela IA ou por você, e cada uma é ativada ou desativada separadamente. Esse recurso existe apenas nos chats de Roleplay. Salvar um interruptor mantém as outras entradas utilizáveis; Activate All e Deactivate All salvam a seleção em conjunto.

Para abrir, abra **Chat Settings** e expanda **Chat Summary**, abaixo de **Lorebooks**. No computador, você pode abrir essa seção em uma janela própria; veja [Visão geral de Chat Settings](../chats/chat-settings.md#popping-a-section-out-into-its-own-window).

### Criar uma entrada de resumo

1. Em **Summary Scope**, escolha **Last** para resumir as mensagens mais recentes ou **Range** para escolher um intervalo específico de mensagens.
2. Clique em **Generate** para que a IA escreva uma entrada a partir desse escopo.
3. Ou clique em **Write** para criar uma entrada em branco e digitar a recapitulação você mesmo.

Cada entrada da lista mostra um título, o intervalo de origem ou a quantidade de mensagens e um tamanho estimado em tokens. Uma entrada pode ser ativada ou desativada, expandida, alterada com o botão **Edit** ou excluída com **Delete**. Os botões de ação em massa permitem **Show Inactive** ou **Hide Inactive** e ainda **Activate All** ou **Deactivate All** de uma vez.

Marque as entradas para selecioná-las; no computador, segure Shift e clique em outra entrada para selecionar o intervalo visível entre elas. Depois use **Enable selected** (ativar selecionadas) ou **Disable selected** (desativar selecionadas) para mudar apenas as entradas selecionadas.

Em um chat em grupo mesclado, uma resposta pode falar por todos os personagens. Uma parte de uma entrada escrita para determinados personagens, como `{{#if char == "Kaito"}}…{{/if}}`, é mantida para todos os personagens do chat a quem ela se aplica e marcada com quem a conhece, como "known only to Kaito". Partes que só o **Narrator** do Advanced Memory recebe ficam de fora. Em chats em grupo em que os personagens respondem um de cada vez e em chats com um só personagem, cada personagem lê as entradas como antes, e o **Narrator** do Advanced Memory lê todas as partes, sejam quais forem os personagens que cada uma nomeia.

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

Os controles de **Display** em **Chat Summary** decidem como as mensagens resumidas aparecem na tela:

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
