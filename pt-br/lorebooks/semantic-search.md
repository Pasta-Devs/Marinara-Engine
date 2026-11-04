# Busca semântica para lorebooks

Com a busca semântica, uma entrada do lorebook é acionada pelo sentido, e não só pelas palavras-chave exatas. Assim, uma entrada com a palavra-chave "espada" pode corresponder a uma mensagem que diz "lâmina". Use quando o seu texto usa muitas palavras diferentes para a mesma ideia.

Isso funciona com embeddings, listas de números que capturam o sentido de um texto. Marinara salva um embedding, também chamado de vetor, para cada entrada. Criar esses embeddings se chama vetorização. Durante o chat, Marinara gera o embedding das suas mensagens recentes e localiza as entradas mais próximas.

A busca semântica acrescenta correspondências. As suas palavras-chave continuam funcionando. As correspondências por palavra-chave e por sentido têm a mesma prioridade dentro dos orçamentos, então, quando nem tudo cabe, quem decide é a **Order** (ordem) da entrada.

## Como configurar a busca semântica

Você precisa primeiro de uma fonte de embeddings, depois do botão liga/desliga **Vectors** (vetores) e, por fim, de uma vetorização.

### Passo 1: escolha uma fonte de embeddings

Antes de começar: você precisa de uma conta cujo serviço ofereça embeddings ou do modelo embutido. Nem todo serviço oferece embeddings. Se o seu não oferecer, o editor pede que você escolha uma conta dedicada a embeddings.

Opção 1: uma conta com um modelo de embeddings.

1. Abra o painel **Connections** (Conexões) e abra uma conta para edição.
2. Abra **Advanced** (avançado) e depois **More** (mais). Ali, localize **Semantic search (embeddings)** (busca semântica por embeddings).
3. Digite o nome de um modelo de embeddings, como `text-embedding-3-small`. Se não tiver certeza do nome, procure na documentação do seu serviço ou use o modelo embutido.
4. Salve a conta.
5. Clique em **Test embedding** (testar embedding) para conferir. Marinara salva primeiro, gera o embedding de um exemplo curto e mostra o tamanho do vetor, como "1536 dimensions", ou o erro que o serviço devolveu.

Para enviar as requisições de embeddings pela chave e pelo endereço de outra conta, escolha essa conta em **Embedding provider** (provedor de embeddings). O padrão é **Same as this provider** (o mesmo deste provedor). Se a conta escolhida tiver um modelo de embeddings próprio, Marinara o usa. Caso contrário, usa o nome de modelo digitado aqui.

Opção 2: o modelo embutido. Ele roda no seu computador, sem chave de API, e se chama **Built-in model** (modelo embutido) no seletor. Ele aparece depois que você o baixa e fica oculto nas versões Lite. Veja [Como configurar o Built-in model](../connections/local-model.md).

Para tornar uma fonte o padrão de todas as contas que não definem nenhuma, abra **Connections** e escolha-a na tarefa **Embeddings**. A configuração própria de uma conta continua tendo prioridade. A opção padrão, **Marinara's own search** (a busca do próprio Marinara), mantém o modelo embutido como alternativa.

### Passo 2: ative Vectors

A busca semântica vem desativada em lorebooks novos.

1. Abra o lorebook e fique na aba **Overview** (visão geral).
2. Ative **Vectors**. Com ele ativado, as entradas também podem ser encontradas pelo sentido. Com ele desativado, as palavras-chave continuam funcionando e o lorebook não é vetorizado.

Com **Vectors** desativado, o painel diz "Semantic search is disabled by the lorebook-level Vectors toggle."

### Passo 3: vetorize as entradas

1. No painel **Semantic search (embeddings)**, escolha uma fonte no menu suspenso. A primeira opção é **No semantic search**. Em seguida vem **Built-in model**, quando disponível, e depois as suas contas elegíveis.
2. Clique em **Vectorize N missing**, por exemplo "Vectorize 5 missing".
3. Espere. Um chip mostra o progresso, como "8/12 entries vectorized", e fica verde quando todas terminam.

Se não funcionou: sem modelo de embeddings em nenhuma conta, o painel diz "No connections with an embedding model configured. Set an Embedding Model on a connection first." Conclua o passo 1 e tente de novo.

## O painel Semantic search (embeddings)

Depois que você ativa **Vectors**, o painel aparece na aba **Overview** com estas configurações.

| Configuração | O que faz | Padrão | Faixa |
| --- | --- | --- | --- |
| **Query Messages** | Quantas mensagens recentes do usuário entram na busca. 0 usa todas as mensagens disponíveis. | 10 | 0 a 100 |
| **Score Threshold** | A semelhança de que uma entrada precisa para ser acionada. Quanto maior, mais rigoroso. | 0.3 | 0 a 1 |
| **Vector Limit** | O máximo de entradas que este lorebook pode acrescentar pelo sentido em uma resposta. | 10 | 1 a 100 |

**Include character context** (incluir o contexto dos personagens) também busca nas respostas recentes dos personagens, separado das suas mensagens, e fica com a correspondência mais forte. Ele gera embeddings de mais texto e vem desativado por padrão. **Query Messages** passa então a valer também para as respostas dos personagens.

Um **Score Threshold** baixo, como 0.2, deixa passar mais entradas, mas corre o risco de trazer correspondências fora do assunto. Um alto, como 0.5, só aceita sentidos bem próximos. Comece pelo padrão.

**Vector Limit** conta só as correspondências por sentido. Os seus orçamentos de tokens normais continuam valendo.

## Vetorizar de novo, excluir e pular

- **Re-vectorize N entries** aparece quando todas as entradas têm vetor. Ele reconstrói todos depois que você confirma.
- **Re-vectorize all** aparece quando algumas entradas têm vetor e outras não. Ele reconstrói tudo de uma vez.
- **Delete vectors** remove só os vetores salvos. O texto e as palavras-chave das entradas ficam, e as palavras-chave continuam funcionando.
- **No Vector**, em uma entrada, faz essa entrada ser pulada. O texto de ajuda diz que a vetorização em massa pula a entrada e remove qualquer embedding salvo. A entrada continua sendo acionada por palavra-chave.

### Depois de trocar o modelo de embeddings

Os vetores salvos pertencem ao modelo que os criou. Depois de trocar de modelo, use **Re-vectorize N entries** ou **Re-vectorize all** para que todas as entradas usem o mesmo modelo. Uma execução "missing only" que devolve um tamanho de vetor diferente é recusada com "Embedding dimensions changed. Use Re-vectorize all entries instead of only missing entries before switching embedding models."

Uma falha é silenciosa. Durante o chat, Marinara gera o embedding das suas mensagens com o modelo de embeddings da conta ativa, ou com o modelo do **Embedding provider** dela. Se a conta não definir nenhum dos dois, usa a fonte da tarefa **Embeddings** ou o modelo embutido. Se o tamanho de vetor desse modelo for diferente do dos vetores das suas entradas, Marinara pula essas entradas na correspondência semântica e não mostra nenhum erro. Vetorize com a mesma fonte que você usa no chat, e vetorize de novo depois de qualquer troca de modelo.

## A busca semântica e o Knowledge Router

Quando um lorebook está vetorizado, o agente **Knowledge Router** também usa as correspondências por sentido para montar a lista de entradas candidatas. Sem vetores, ele usa só as correspondências por palavra-chave. Veja [Fontes de conhecimento: agentes Retrieval e Router](../agents/knowledge-sources.md).

## Guias relacionados

- [Visão geral dos lorebooks](overview.md)
- [Conectando a um provedor de IA](../connections/connecting-to-a-provider.md)
- [Como configurar o Built-in model](../connections/local-model.md)
- [Fontes de conhecimento: agentes Retrieval e Router](../agents/knowledge-sources.md)
