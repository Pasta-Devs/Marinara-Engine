# Fontes de conhecimento: agentes Retrieval e Router

**Knowledge Retrieval** (busca de conhecimento) e **Knowledge Router** (roteador de conhecimento) trazem fatos dos seus lorebooks para um chat só quando a cena precisa deles. Você não precisa colocar cada detalhe em cada prompt. Os dois agentes funcionam apenas em chats de Roleplay, e nenhum deles vem ativado por padrão.

## Por que usá-los

Um lorebook é um conjunto de anotações sobre o mundo ou sobre os personagens. Cada anotação é uma entrada. Enviar todas as entradas a cada turno desperdiça tokens (os pedacinhos de texto que um modelo lê e pelos quais você paga) e pode confundir a IA.

Esses agentes usam geração aumentada por recuperação (RAG): Marinara encontra as entradas que combinam com a cena atual e acrescenta só elas ao prompt daquele turno.

## Escolha entre Retrieval e Router

| Pergunta | Knowledge Retrieval | Knowledge Router |
| --- | --- | --- |
| Como acrescenta o conteúdo | Resume as fontes antes | Acrescenta as entradas escolhidas palavra por palavra |
| Custo por turno | Maior | Menor |
| Consegue ler arquivos enviados | Sim | Não |
| Melhor para | Fontes menores, ou um resumo enxuto | Lorebooks grandes com boas descrições de entrada |

- **Knowledge Retrieval** lê todas as entradas ativas dos lorebooks escolhidos, mais os arquivos enviados, e pede à IA que resuma os fatos que combinam com as mensagens recentes. Isso custa mais, porque a IA lê todo o texto de origem.
- **Knowledge Router** monta um pequeno catálogo das suas entradas. Cada linha tem um ID, um nome, algumas palavras-chave e um resumo curto. A IA escolhe entradas no catálogo, e Marinara as acrescenta na íntegra. A IA nunca lê todas as entradas, então o roteador continua barato mesmo com um lorebook grande.

Você pode adicionar os dois ao mesmo chat, mas eles se sobrepõem e aumentam o custo. O editor de agentes avisa quando os dois estão configurados. Escolha um só.

## Adicione um agente de conhecimento a um chat

Antes de começar: instale o agente pelo **Agent Organizer** (organizador de agentes). Veja [Agentes: ajudantes de IA para os seus chats](agents-overview.md).

1. Em um chat de Roleplay, abra **Chat Settings** (configurações do chat).
2. Encontre a seção **Agents** e ative **Enable Agents** (ativar agentes).
3. Clique em **Add Agent** (adicionar agente).
4. Abra o grupo **Writer Agents** e escolha **Knowledge Retrieval** ou **Knowledge Router**.
5. Na janela de configuração, escolha as fontes (veja abaixo).

O cartão de configurações do agente aparece então em **Agents**, e ele roda a cada novo turno. Enquanto o Knowledge Retrieval trabalha, o indicador de progresso pode mostrar **Retrieving knowledge...**.

> **Observação:** esses agentes rodam só em turnos novos. Eles não rodam de novo quando você regenera uma resposta.

## Escolha as fontes

Os dois agentes têm os mesmos controles de fonte.

- **Use chat-active lorebooks** (usar os lorebooks ativos do chat) vem ativado por padrão. No editor de agentes, o mesmo botão liga/desliga se chama **Use this chat's active lorebooks**. Enquanto ele estiver ativado e você não escolher nenhum lorebook fixo, o agente lê os lorebooks ativos no chat atual.
- **Fixed source override** (**Fixed Source Lorebooks** na janela de configuração) prende o agente aos lorebooks que você escolher. Uma seleção fixa sempre vence os lorebooks ativos do chat, em todos os chats que usam esse agente.

Use fontes fixas quando um agente deve ler sempre o mesmo lorebook de referência. Deixe o botão liga/desliga ativado, sem escolhas fixas, para acompanhar o que o chat estiver usando.

## Envie arquivos (só no Knowledge Retrieval)

Nas configurações do **Knowledge Retrieval**, clique em **Upload file** (enviar arquivo). Os arquivos enviados ficam disponíveis para todos os chats que usam o Knowledge Retrieval.

Os tipos aceitos são `.txt`, `.md`, `.csv`, `.json`, `.xml`, `.html`, `.htm`, `.log`, `.yaml`, `.yml`, `.tsv` e `.pdf`. O seletor de arquivos bloqueia os outros tipos. Cada arquivo mostra o nome e o tamanho, com um botão de exclusão.

- Todo arquivo, com exceção do PDF, é lido como texto simples. Um arquivo que não é texto, como uma imagem renomeada para `.txt`, é enviado, mas acrescenta conteúdo ilegível.
- Um PDF digitalizado, feito só de imagem, não tem camada de texto. O agente insere um marcador no lugar do conteúdo. Use um PDF com texto selecionável.

## Escreva boas descrições de entrada

Isso importa principalmente para o Knowledge Router, que escolhe as entradas pela **Description** (descrição) delas.

1. Abra a entrada no editor de lorebooks.
2. Preencha **Description** com um resumo curto e específico do que a entrada cobre.

O roteador usa a descrição apenas para escolher entradas. Ela não vai para a IA principal como conteúdo da história. Sem descrição, o roteador recorre ao começo do conteúdo da entrada, o que é menos preciso.

Quando você escolhe os lorebooks de origem do roteador, um selo de cobertura aparece ao lado de **Fixed source override**, por exemplo **75% described (9/12)**. O ponto fica verde a partir de 75%, âmbar de 25% a 74% e vermelho abaixo de 25%. Para lorebooks vazios, ele mostra **No entries yet**. Mire no verde.

## Opcional: pré-seleção por significado

O Knowledge Router também consegue encontrar entradas candidatas por significado, não só por palavra-chave. Isso usa um embedder, um modelo pequeno que transforma texto em números para que Marinara possa comparar significados. O roteador funciona sem ele.

1. Abra o editor de lorebooks e encontre **Semantic search (embeddings)** (busca semântica por embeddings).
2. Escolha uma conta que tenha um modelo de embedding. Se você definiu um padrão **Embeddings** em **Connections → Defaults** (Conexões → Padrões), ele já vem escolhido, a não ser que você tenha escolhido outra fonte antes.
3. Use a mesma fonte de embedding da conta do seu chat. Vetores de tamanho diferente são ignorados.
4. Clique no botão de vetorizar. Ele mostra quantas entradas ainda precisam de vetores. **Re-vectorize all** refaz todas as entradas.

Se um lorebook não tiver vetores, ou nenhum embedder estiver disponível, o roteador monta a lista de candidatos só com palavras-chave. Nada quebra. Veja [Busca semântica para lorebooks](../lorebooks/semantic-search.md).

## Guias relacionados

- [Busca semântica para lorebooks](../lorebooks/semantic-search.md)
- [Visão geral dos lorebooks](../lorebooks/overview.md)
- [Agentes: ajudantes de IA para os seus chats](agents-overview.md)
