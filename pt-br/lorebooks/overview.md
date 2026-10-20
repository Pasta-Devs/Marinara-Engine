# Visão geral dos lorebooks

Neste guia você aprende o que é um lorebook no Marinara Engine, como funciona o painel **Lorebooks** (a biblioteca de lorebooks) e como um lorebook fica ativo em um chat. O guia também traz o passo a passo para criar o primeiro lorebook e a primeira entrada. Assuntos mais profundos, como palavras-chave, momento de acionar e busca semântica, têm guias próprios, indicados no final.

## O que é um lorebook

O lorebook é uma pequena base de conhecimento que a IA consulta durante o chat. Ele também recebe o nome de **World Info**, e os dois nomes significam a mesma coisa. Cada lorebook guarda uma lista de entradas. A entrada tem duas partes: algumas palavras-chave que servem de gatilho e um bloco de texto.

Quando uma palavra-chave aparece nas mensagens recentes, Marinara Engine insere o texto daquela entrada no prompt. O prompt é o conjunto de instruções ocultas e de histórico que Marinara envia para a IA a cada resposta. Com isso, a IA usa fatos que ninguém contou diretamente na conversa.

Veja um exemplo simples. Você escreve uma entrada de lorebook com a palavra-chave `Eldoria` e este texto:

```
Eldoria is a rainy port city ruled by a council of nine merchants.
```

A partir daí, sempre que você ou um personagem menciona Eldoria, a IA recebe esse fato. Ela responde como se sempre tivesse conhecido a cidade. Sem a entrada, restaria à IA adivinhar.

Os lorebooks servem para a lore do mundo, histórias de fundo dos personagens, nomes de lugares, facções, regras e qualquer fato que a IA precise lembrar. Não é preciso repetir esses fatos em toda mensagem. O lorebook entrega cada fato só quando ele é relevante, o que economiza espaço no prompt.

A correspondência por palavra-chave funciona em qualquer conexão de IA e não exige configuração extra. Marinara também encontra entradas pelo significado, em vez das palavras exatas, com a busca semântica. Esse é um recurso à parte, que você precisa ativar, e tem um guia só dele.

## O painel **Lorebooks**

O painel **Lorebooks** é a biblioteca onde você navega, pesquisa e gerencia todos os lorebooks. Abra o painel pela barra lateral do aplicativo. A lista mostra cada lorebook com imagem, nome e uma descrição curta.

Três botões de ícone ficam no topo do painel. Eles mostram só o ícone, sem texto. Passe o mouse sobre um botão para ver o nome dele.

- O botão **New** (novo, um sinal de mais) abre a janela **Create Lorebook** (criar lorebook) para você montar um lorebook.
- O botão **Import** (importar, uma seta para baixo) abre a janela **Import Lorebook** (importar lorebook) para trazer um arquivo de lorebook.
- O botão **Select** (selecionar, um sinal de visto) liga o modo de seleção múltipla, para exportar ou excluir vários lorebooks de uma vez.

Abaixo dos botões há um campo de busca com o texto de exemplo **Search lorebooks**. Ele filtra a lista por nome, descrição, nomes de personagem ou persona vinculados e tags. Ao lado dele fica o menu suspenso **Sort order** (ordem de exibição), com estas opções: **Manual order** (ordem manual), **A-Z**, **Z-A**, **Newest**, **Oldest** e **Token Budget**. Com **Manual order**, arraste os lorebooks para a ordem que você quiser, ou mova um deles com Alt+Up e Alt+Down no teclado. A sua ordem fica guardada.

Cada linha de lorebook traz o botão **Copy** (copiar) e o botão **Delete** (excluir). Os botões aparecem quando você passa o mouse sobre a linha. No celular, ficam sempre visíveis. O botão **Copy** duplica o lorebook. Um lorebook desativado exibe um pequeno selo **OFF**. Clique na imagem para fazer upload de uma nova ou substituir a atual.

Também é possível criar pastas de biblioteca com o botão **New Folder** (nova pasta). Arraste um lorebook para cima de uma pasta para guardá-lo ali. Assim uma biblioteca grande fica organizada. No celular, mantenha um lorebook pressionado por um instante e depois arraste-o. Essas pastas da biblioteca são diferentes das pastas de entradas que você cria dentro de um mesmo lorebook.

## Categorias

Todo lorebook tem uma categoria. A categoria é apenas um rótulo para você organizar a biblioteca. Ela não muda como nem quando o lorebook é acionado.

O painel tem estas abas de categoria:

- A aba **All** mostra todos os lorebooks, agrupados por categoria.
- A aba **Active** mostra só os lorebooks relevantes para o chat aberto no momento.
- As abas **World**, **Character**, **NPC**, **Spellbook** e **Other** mostram, cada uma, os lorebooks daquela categoria.

Ao criar um lorebook, você escolhe uma entre cinco categorias: **World**, **Character**, **NPC**, **Spellbook** ou **Other**. O padrão é **Other**. A categoria pode ser trocada depois, na aba **Overview** (visão geral) do lorebook. Repare que a aba **Overview** chama essa mesma categoria de **Uncategorized**, e não de **Other**. Use os rótulos que fizerem sentido para você. Por exemplo, coloque anotações de lugares e de ambientação em **World** e a história de um companheiro em **Character**.

## Como um lorebook é acionado

O lorebook só alimenta a IA quando está ativo no chat atual. Existem três formas de deixar um lorebook ativo. Escolha a que combina com o seu caso.

1. **Global.** O lorebook global fica ativo em todos os chats, desde que esteja ativado. Ligue o botão liga/desliga **Global** na aba **Overview** do lorebook. Use essa opção para fatos que valem em qualquer lugar, como as regras do seu mundo compartilhado.
2. **Vinculado a um personagem ou persona.** O lorebook vinculado é acionado sozinho em qualquer chat que inclua aquele personagem ou use aquela persona. Os vínculos são definidos na aba **Overview** ou no editor de personagem ou de persona. Essa é a escolha mais comum para a história de fundo do próprio personagem.
3. **Fixado em um único chat.** Você adiciona um lorebook a um chat só, pelas configurações daquele chat. Ele fica ativo apenas ali. Isso ajuda quando a lore serve a uma história específica, e não à biblioteca inteira.

Um mesmo lorebook não pode ser global e vinculado ao mesmo tempo. Ao ativar **Global**, Marinara remove os vínculos com personagens e personas assim que você salva. As duas opções se excluem.

Todo lorebook ativo continua respeitando o botão liga/desliga **Enabled** (ativado). Se o lorebook estiver desativado, nenhuma entrada dele é acionada, mesmo que ele seja global ou vinculado. Para ver quais lorebooks estão ativos no chat aberto, abra as configurações do chat e procure a seção **Lorebooks**. A lista de ativos também pode ser editada ali. Um guia à parte trata dessa seção.

## Crie o primeiro lorebook e a primeira entrada

Veja como criar um lorebook e adicionar uma entrada:

1. Abra o painel **Lorebooks** e clique em **New**. A janela **Create Lorebook** abre.
2. Digite um nome no campo **Name** (nome). Esse campo é obrigatório. Um exemplo claro é `Eldoria World Lore`.
3. Escreva uma **Description** (descrição) curta, se quiser. Ela é opcional e só ajuda você a encontrar o lorebook depois.
4. Escolha uma **Category** (categoria) no menu suspenso ou deixe em **Other**.
5. Clique no botão **Create Lorebook**. O novo lorebook aparece na lista do painel.

O lorebook ainda está sem entradas. Adicione a primeira agora.

1. Clique na linha do seu lorebook no painel. O editor de página inteira abre.
2. Clique na aba **Entries** (entradas). O selo ao lado dela mostra a quantidade de entradas.
3. Clique em **Add Entry** (adicionar uma entrada). Uma entrada nova e vazia aparece.
4. Na entrada, adicione uma ou mais palavras-chave de gatilho, como `Eldoria`.
5. No campo **Content** (conteúdo) da entrada, escreva o texto que a IA deve receber.

Marinara salva a entrada sozinha pouco depois de você parar de digitar. Aparece um aviso curto: **Saved automatically**. O lorebook já funciona: quando uma palavra-chave corresponde às mensagens recentes, o conteúdo da entrada entra no prompt. O [guia de entradas](entries.md) explica as palavras-chave, as regras de correspondência e as opções de momento de acionar. As seções [Estratégia de escrita](entries.md#authoring-strategy-choosing-the-right-entry) e [Exemplo prático](entries.md#worked-example-a-small-setting) mostram como escolher os controles certos para cada entrada.

## As configurações da aba **Overview**

Abra um lorebook e clique na aba **Overview** para definir o comportamento do lorebook inteiro. Os campos mais importantes são o nome, a categoria, os vínculos e os botões liga/desliga descritos acima. A aba também tem estas configurações numéricas.

| Configuração | O que faz | Padrão |
|---|---|---|
| **Scan Depth** | Quantas mensagens recentes Marinara verifica em busca de palavras-chave. Use 0 para varrer o chat inteiro. | 2 |
| **Token Budget** | O máximo de tokens que este lorebook pode acrescentar a um prompt. Use 0 para não ter limite. | 2048 |
| **Entry Limit** | O máximo de entradas que este lorebook pode acrescentar a um prompt. A faixa vai de 1 a 1000. | 100 |
| **Max Depth** | Quantas passagens recursivas extras executar. Esse campo aparece só com **Recursive** ativado. A faixa vai de 1 a 10. | 3 |

O token é um pedacinho de texto, mais ou menos alguns caracteres. A IA tem espaço limitado para o prompt, então o **Token Budget** impede que um único lorebook ocupe todo esse espaço.

A aba também tem três botões liga/desliga:

- **Enabled** liga ou desliga o lorebook inteiro. Vem ligado por padrão.
- **Recursive** permite que o texto de uma entrada ativada acione outras entradas, em passagens extras. Vem desligado por padrão. Ative quando uma parte da lore precisar encadear com outra relacionada.
- **Vectors** permite que as entradas usem a correspondência por significado. Vem desligado por padrão. A correspondência por palavra-chave continua funcionando com ele desligado.

Abaixo dessas configurações fica o painel **Semantic Search (Embeddings)** (busca semântica). Ele monta os dados que fazem a correspondência por significado funcionar. O guia de busca semântica trata da configuração, das fontes de embedding (a representação numérica do texto) e dos botões de vetorização.

Os detalhes finos dos orçamentos de tokens, do **Entry Limit** e da recursão também têm um guia próprio. Comece com os valores padrão acima. Eles funcionam bem na maioria dos lorebooks e podem ser ajustados depois.

## Guias relacionados

- [Entradas de lorebook: chaves, posição e momento de acionar](entries.md)
- [Orçamento de tokens e recursão em lorebooks](token-budgets.md)
- [Busca semântica para lorebooks](semantic-search.md)
- [Vincular lorebooks a personagens e personas](linking-to-characters.md)
- [Importar e exportar lorebooks](import-export.md)
- [Fontes de conhecimento: agentes Retrieval e Router](../agents/knowledge-sources.md)
