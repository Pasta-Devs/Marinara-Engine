# Fontes de conhecimento: agentes Retrieval e Router

Neste guia você conhece os dois agentes de conhecimento do Marinara Engine: **Knowledge Retrieval** (busca de conhecimento) e **Knowledge Router** (roteador de conhecimento). Os dois trazem fatos dos lorebooks para o chat só quando a cena precisa deles. Assim você não precisa colocar cada detalhe em cada prompt.

## O que esses agentes fazem

Um lorebook é um conjunto de anotações sobre o mundo ou sobre os personagens, escritas com antecedência. Cada anotação é uma entrada. Conforme o chat cresce, enviar todas as entradas a cada turno desperdiça tokens. Um token é um pedacinho de texto que a IA lê, e mais tokens significam custo maior. Enviar tudo também pode confundir a IA.

Os agentes de conhecimento resolvem isso com RAG. RAG quer dizer geração aumentada por recuperação. Na prática, o aplicativo encontra as entradas que combinam com a cena atual e acrescenta só elas ao prompt daquele turno.

Marinara faz isso com dois agentes opcionais:

- **Knowledge Retrieval** lê as fontes escolhidas, resume os fatos que importam e acrescenta o resumo ao prompt.
- **Knowledge Router** lê uma lista curta das entradas, escolhe as que combinam com a cena e acrescenta essas entradas palavra por palavra.

Os dois agentes funcionam apenas em chats de **Roleplay**. Não é possível adicioná-los no Conversation Mode nem no Game Mode. Nenhum dos dois vem ativado por padrão. Você mesmo adiciona ao chat o que preferir.

## Knowledge Retrieval x Knowledge Router

Use esta tabela para escolher. Leia as observações abaixo dela antes de decidir.

| Pergunta | Knowledge Retrieval | Knowledge Router |
|---|---|---|
| Como acrescenta o conteúdo | Resume as fontes antes | Acrescenta as entradas escolhidas palavra por palavra |
| Custo por turno | Maior | Menor |
| Consegue ler arquivos enviados | Sim | Não |
| Melhor para | Fontes menores, ou quando você quer um resumo enxuto | Lorebooks grandes com boas descrições de entrada |

**Knowledge Retrieval** lê todas as entradas ativas dos lorebooks escolhidos, mais o texto dos arquivos que você enviar. Depois pede à IA um resumo curto dos fatos que combinam com as mensagens recentes. Isso custa mais por turno, porque a IA lê todo o material de origem.

**Knowledge Router** é a opção mais barata. Ele monta um pequeno catálogo das entradas. Cada linha do catálogo tem um ID, um nome, algumas palavras-chave e um resumo curto. A IA lê esse catálogo, escolhe as entradas que combinam com a cena, e Marinara acrescenta essas entradas na íntegra. A IA nunca lê todas as entradas por completo, então o roteador continua barato mesmo com um lorebook grande.

Os dois agentes podem conviver no mesmo chat, mas o conteúdo pode se repetir e o custo em tokens sobe. O editor de agentes avisa quando os dois estão configurados. Para deixar os prompts mais limpos, escolha um só.

## Como adicionar um agente de conhecimento a um chat

Faça isso dentro de um chat de **Roleplay**.

1. Abra **Chat Settings** (configurações do chat).
2. Encontre a seção **Agents**.
3. Ative a opção **Enable Agents**. A lista de agentes é liberada.
4. Clique em **Add Agent**.
5. Abra o grupo **Writer Agents**.
6. Escolha **Knowledge Retrieval** ou **Knowledge Router**.

Uma janela de configuração abre para você já escolher as fontes. Depois de adicionar o agente, o card de configurações dele aparece na seção **Agents**. A partir daí o agente roda sozinho a cada novo turno.

Enquanto **Knowledge Retrieval** trabalha, o indicador de progresso pode mostrar a fase **Retrieving knowledge...**.

Observação: esses agentes não rodam de novo quando você regenera uma resposta já existente. Eles rodam só em turnos novos.

## Como enviar arquivos para o Knowledge Retrieval

Só **Knowledge Retrieval** lê arquivos enviados. **Knowledge Router** usa apenas os lorebooks.

Nas configurações de **Knowledge Retrieval** há uma lista de arquivos e o botão **Upload file** (enviar arquivo). Os arquivos enviados ficam disponíveis para todos os chats que usam **Knowledge Retrieval**, não só para o chat atual.

Os tipos de arquivo aceitos são .txt, .md, .csv, .json, .xml, .html, .htm, .log, .yaml, .yml, .tsv e .pdf. O seletor de arquivos bloqueia os outros tipos. Cada arquivo da lista mostra o nome e o tamanho, com um botão de exclusão ao lado.

Tenha estes limites em mente:

- Todo arquivo, com exceção do PDF, é lido como texto simples. Um arquivo que não é texto de verdade, como uma imagem renomeada para .txt, até é enviado, mas acrescenta conteúdo embaralhado e ilegível.
- Um PDF digitalizado, feito só de imagem, não tem camada de texto, então o agente não consegue ler. Quando a extração falha, o agente insere um marcador no lugar do conteúdo real. Use um PDF com texto selecionável.

## Como escolher as fontes: substituição fixa x lorebooks do chat

Os dois agentes têm os mesmos controles de fonte no card de configurações.

O botão liga/desliga **Use chat-active lorebooks** vem ativado por padrão. No editor de agentes, esse mesmo botão aparece como **Use this chat's active lorebooks**. Enquanto ele estiver ativado e você não escolher nenhum lorebook fixo, o agente usa os lorebooks que estiverem ativos no chat atual.

Abaixo do botão fica a opção **Fixed source override**, que aparece como **Fixed Source Lorebooks** na janela de configuração. Escolha um ou mais lorebooks aqui para prender o agente exatamente a esse conjunto. Uma seleção fixa sempre vence os lorebooks ativos do chat, em todos os chats que usam esse agente.

Use fontes fixas quando quiser que um agente leia sempre o mesmo lorebook de referência. Deixe o botão ativado e sem escolhas fixas quando quiser que o agente acompanhe o que o chat estiver usando.

## Como escrever boas descrições de entrada

Esta seção importa principalmente para **Knowledge Router**. O roteador decide o que acrescentar lendo o campo **Description** de cada entrada. Uma boa descrição é o que ajuda ele a escolher a entrada certa.

A descrição é escrita no editor de entradas do lorebook, no campo **Description**. Mantenha um resumo curto e específico do que a entrada cobre. O roteador usa esse texto apenas para escolher entradas. Ele não vai para a IA principal como conteúdo da história.

Se a entrada não tiver descrição, o roteador recorre ao começo do conteúdo dela. Essa alternativa é menos precisa. Por isso, preencha uma descrição para cada entrada que você quer que o roteador encontre.

Ao selecionar os lorebooks de origem do roteador, um pequeno selo de cobertura aparece ao lado de **Fixed source override**. Ele mostra quantas entradas têm descrição, em porcentagem e em quantidade, por exemplo **75% described (9/12)**. O ponto fica verde a partir de 75 por cento, âmbar de 25 a 74 por cento e vermelho abaixo de 25 por cento. Ele mostra **No entries yet** quando os lorebooks escolhidos estão vazios. Mire no verde.

## Pré-seleção semântica opcional

**Knowledge Router** também consegue encontrar entradas candidatas por significado, não só por palavra-chave. Isso se chama correspondência semântica. Ela usa um embedder. Um embedder é um modelo pequeno que transforma texto em números para o aplicativo comparar significados. Essa etapa é opcional. O roteador funciona mesmo sem ela.

Para ativar, vetorize o lorebook. Vetorizar quer dizer que o aplicativo roda o embedder uma vez em cada entrada e salva os resultados. Abra o editor de lorebooks e encontre a seção **Semantic Search (Embeddings)**. Escolha uma conexão que tenha um modelo de embedding ou uma **Embedding Connection** (conexão de embedding). Se você escolheu um padrão em **Embeddings**, na seção **Defaults** (padrões) de **Connections**, ele já vem escolhido, a não ser que você tenha selecionado outra fonte antes. Confira a fonte selecionada antes de vetorizar e use a mesma fonte de embedding da sua conexão de chat; vetores de tamanho diferente são ignorados na correspondência semântica. Depois clique em **Vectorize N missing**, em que N é a quantidade de entradas que ainda precisam de vetores. Também é possível clicar em **Re-vectorize** para refazer todas as entradas. Para os detalhes, veja o guia de busca semântica indicado abaixo.

Se o lorebook não tiver vetores, ou se nenhum embedder estiver disponível, o roteador recorre à correspondência por palavras-chave para montar a lista de candidatos. Nada quebra. Ele apenas passa a depender só das palavras-chave.

## Guias relacionados

- [Busca semântica para lorebooks](../lorebooks/semantic-search.md)
- [Visão geral dos lorebooks](../lorebooks/overview.md)
- [Agentes: ajudantes de IA para os seus chats](agents-overview.md)
