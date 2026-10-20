# Busca semântica para lorebooks

Este guia explica a busca semântica nos lorebooks do Marinara Engine. Um lorebook é um conjunto de fatos do seu mundo. Com a busca semântica, uma entrada do lorebook é acionada pelo sentido do texto, e não só pelas palavras-chave exatas. Aqui você vê como configurar uma fonte de embeddings, vetorizar as entradas e ajustar a correspondência.

## O que a busca semântica acrescenta

Um lorebook é um conjunto de entradas. Cada entrada tem palavras-chave de gatilho e um bloco de texto. Normalmente, a entrada só é acionada quando uma dessas palavras-chave exatas aparece no chat recente. Se o texto usar outra palavra, a entrada fica em silêncio.

A busca semântica resolve isso. Ela compara o sentido do chat recente com o sentido das entradas. Assim, uma entrada pode ser acionada mesmo sem nenhuma palavra-chave exata. Por exemplo, uma entrada com a palavra-chave "espada" também corresponde a uma mensagem que fala só em "lâmina".

Isso funciona com embeddings. Um embedding é uma representação numérica do texto: uma lista de números que captura o sentido de um trecho. Marinara salva um embedding, também chamado de vetor, para cada entrada. Essa etapa se chama vetorização. Durante o chat, Marinara gera o embedding das mensagens recentes e localiza as entradas de sentido mais próximo.

A correspondência por palavra-chave continua funcionando com a busca semântica ligada. A busca semântica acrescenta correspondências extras. Ela não substitui as palavras-chave.

As correspondências por palavra-chave e por sentido têm a mesma prioridade quando Marinara aplica os limites de entradas e o orçamento de tokens do lorebook. Se nem todas as entradas correspondentes couberem, a ordem de entradas que você configurou decide entre as correspondências por palavra-chave e as semânticas do momento; o método de ativação em si não tem preferência.

## Antes de começar: escolha uma fonte de embeddings

A busca semântica precisa de um modelo capaz de criar embeddings. Você tem duas opções.

Seja qual for a sua escolha, você pode torná-la o padrão de todo o aplicativo: abra **Connections** (Conexões), depois **Defaults** (padrões) e escolha-a em **Embeddings**. Toda conexão que não defina um modelo de embeddings nem uma **Embedding Connection** própria passa a usá-la. A configuração própria de uma conexão continua tendo prioridade, e a linha mostra quantas conexões usam as próprias configurações. **None** mantém o modelo local integrado como alternativa.

Opção 1: uma conexão com um modelo de embeddings.

1. Abra o painel **Connections** (Conexões).
2. Abra uma conexão para edição.
3. Localize a seção **Semantic Search (Embeddings)** (busca semântica por embeddings).
4. Digite o nome de um modelo de embeddings no campo do modelo. Um valor comum é `text-embedding-3-small`.
5. Salve a conexão.

Uma conexão também pode enviar as requisições de embeddings pela chave de API e pelo endereço de outra conexão. Na mesma seção, escolha essa conexão em **Embedding Connection** (conexão de embeddings). O padrão é **Same as this connection** (a mesma desta conexão). Se a conexão escolhida tiver um modelo de embeddings próprio, Marinara o usa; caso contrário, usa o nome de modelo digitado aqui. Isso vale tanto na vetorização quanto durante o chat.

Nem todo provedor oferece embeddings. Se o provedor não for capaz de gerar embeddings, o editor pede que você escolha uma conexão dedicada a embeddings.

Opção 2: o modelo local integrado.

Marinara roda um modelo de embeddings pequeno na sua própria máquina, sem chave de API. No seletor do lorebook, essa opção se chama **Local Model (sidecar)** (modelo local). Ela só aparece depois que você baixa o modelo local. Veja [Como configurar o Local Model](../connections/local-model.md) para saber como instalar.

Em uma versão Marinara Lite, a opção **Local Model (sidecar)** fica oculta. No Lite, a busca semântica precisa de uma conexão com um modelo de embeddings.

## Ative o recurso Vectors em um lorebook

Em lorebooks novos, a busca semântica vem desativada por padrão. A ativação é feita lorebook por lorebook.

1. Abra o lorebook que você quer pesquisar por sentido.
2. Fique na aba **Overview** (visão geral).
3. Localize o botão liga/desliga **Vectors** (vetores) e ative-o.

O texto de ajuda de **Vectors** diz: "When on, entries in this lorebook may use semantic embeddings. When off, keyword matching still works and vectorization skips this lorebook."

Com **Vectors** desativado, o painel semântico mostra este aviso: "Semantic search is disabled by the lorebook-level Vectors toggle."

## O painel Semantic Search (Embeddings)

Com **Vectors** ativado, o painel **Semantic Search (Embeddings)** aparece na aba **Overview**. Uma etiqueta de status mostra quantas entradas estão vetorizadas, por exemplo "8/12 entries vectorized". Ela fica verde, com um sinal de visto, assim que todas as entradas ficam prontas.

O painel tem três configurações numéricas.

| Configuração | O que faz | Padrão | Faixa |
|---|---|---|---|
| **Query Messages** | Quantas mensagens recentes do chat entram no embedding da busca neste lorebook. | 10 | 0 a 100 |
| **Score Threshold** | Semelhança calibrada mínima para que uma entrada seja acionada. Quanto maior, mais rigoroso. | 0.3 | 0 a 1 |
| **Vector Limit** | Máximo de correspondências semânticas que este lorebook acrescenta em uma geração. | 10 | 1 a 100 |

Defina **Query Messages** como 0 para pesquisar todo o histórico do chat, em vez de apenas uma janela recente.

A opção **Score Threshold** controla o quanto os sentidos precisam estar próximos. Um valor baixo, como 0.2, deixa passar mais entradas, mas corre o risco de trazer correspondências fora do assunto. Um valor alto, como 0.5, é mais rigoroso e só aceita sentidos bem próximos. Comece pelo padrão e ajuste se aparecerem correspondências demais ou de menos.

Marinara calibra essa pontuação com vários trechos neutros e sem relação entre si, gerados pelo mesmo modelo de embeddings. Isso remove o piso de cosseno comum, anormalmente alto, que alguns backends de embeddings locais e compatíveis com OpenAI produzem – neles, textos sem nenhuma relação chegam a pontuar 0.95 ou mais. Com isso, a configuração continua útil em qualquer modelo de embeddings, sem exigir um corte específico por modelo, perto de 1.0.

A opção **Vector Limit** limita só as correspondências semânticas. Os orçamentos de tokens normais continuam valendo por cima disso.

## Vetorize as entradas

Vetorizar é criar e salvar o embedding de cada entrada. Esse passo é obrigatório para a correspondência semântica funcionar.

1. Ative **Vectors** no lorebook.
2. No painel **Semantic Search (Embeddings)**, escolha uma fonte de embeddings no menu suspenso. A primeira opção é **No semantic search**. Em seguida vem **Local Model (sidecar)**, quando disponível. Depois dela aparecem as conexões elegíveis.
3. Clique no botão de vetorização. Quando faltar o vetor de algumas entradas, o botão mostra **Vectorize N missing**, por exemplo "Vectorize 5 missing".
4. Aguarde o fim da execução. A etiqueta de status passa a indicar todas as entradas vetorizadas.

Se nenhuma conexão tiver um modelo de embeddings ou uma **Embedding Connection**, o painel mostra este aviso no lugar do menu suspenso: "No connections with an embedding model configured. Set an Embedding Model on a connection first." Configure primeiro uma fonte de embeddings, com os passos acima.

Quando todas as entradas já têm vetor, o botão principal muda para **Re-vectorize N entries**. Isso reconstrói todos os vetores salvos. Marinara pede uma confirmação antes de sobrescrevê-los.

Um botão separado, **Re-vectorize all**, aparece quando algumas entradas têm vetor e outras ainda não. Use-o para reconstruir tudo de uma vez.

Para excluir os vetores salvos, clique em **Delete vectors**. Isso remove apenas os embeddings. O texto e as palavras-chave das entradas não mudam. A correspondência por palavra-chave continua funcionando depois de excluir os vetores.

### Deixe uma entrada de fora

Você pode deixar uma entrada fora da vetorização e manter todas as outras. Abra a entrada e ative o botão liga/desliga **No Vector**. O texto de ajuda diz: "When enabled, bulk vectorization skips this entry and removes any stored embedding." Essa entrada continua sendo acionada por palavra-chave. Ela só não corresponde por sentido.

## Vetorizar de novo depois de trocar de modelo

Os vetores salvos estão vinculados ao modelo de embeddings que os criou. Se você mudar para outro modelo de embeddings, os vetores antigos podem deixar de corresponder.

Reconstrua todos os vetores depois de trocar o modelo de embeddings. Use **Re-vectorize N entries** ou **Re-vectorize all** para que todas as entradas usem o mesmo modelo.

Não faça só uma vetorização parcial depois de trocar de modelo. Se uma execução do tipo "missing only" devolver um tamanho de vetor diferente do que está salvo, o servidor recusa a operação com esta mensagem: "Embedding dimensions changed. Use Re-vectorize all entries instead of only missing entries before switching embedding models."

Existe uma falha silenciosa que vale a pena conhecer. Durante o chat, Marinara gera o embedding das mensagens recentes com um modelo de consulta. Esse modelo de consulta é o modelo de embeddings da própria conexão ativa ou, se ela definir uma, o da sua **Embedding Connection**. Se a conexão não definir nenhum dos dois, Marinara usa o padrão de **Embeddings** em **Defaults**, no painel **Connections**, ou, quando ele é **None**, o modelo local integrado. O modelo de consulta pode produzir um tamanho de vetor diferente do modelo que vetorizou as entradas. Nesse caso, Marinara ignora essas entradas na correspondência semântica. Nenhum erro aparece. Para evitar isso, vetorize as entradas com a mesma fonte de embeddings usada durante o chat. Definir um padrão de **Embeddings** ajuda: o seletor de vetorização começa nele, a menos que você tenha escolhido outra coisa antes, e as conexões sem configurações de embeddings próprias fazem a consulta com ele. Vetorize de novo a cada troca de modelo.

## Como isso alimenta o agente Knowledge Router

A busca semântica também ajuda o agente **Knowledge Router**. Esse agente escolhe as entradas relevantes do lorebook e as insere no prompt, o texto que Marinara envia para a IA, quando o lorebook é grande. Com o lorebook vetorizado, o roteador usa as correspondências semânticas para montar sua lista de entradas candidatas, junto com as correspondências por palavra-chave.

Essa etapa é opcional para o roteador. Se o lorebook não estiver vetorizado, ou se nenhuma fonte de embeddings estiver disponível, o roteador recorre somente às correspondências por palavra-chave. A vetorização apenas melhora a lista de candidatas. Veja [Fontes de conhecimento: agentes Retrieval e Router](../agents/knowledge-sources.md) para entender como esse agente funciona.

## Guias relacionados

- [Visão geral dos lorebooks](overview.md)
- [Conectando a um provedor de IA](../connections/connecting-to-a-provider.md)
- [Como configurar o Local Model](../connections/local-model.md)
- [Fontes de conhecimento: agentes Retrieval e Router](../agents/knowledge-sources.md)
