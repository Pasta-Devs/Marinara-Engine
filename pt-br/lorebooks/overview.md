# Visão geral dos lorebooks

O lorebook é um conjunto de fatos do mundo que a IA lê quando as palavras-chave deles aparecem no chat. Use um para lugares, facções, histórias de fundo e regras, para não precisar repeti-los em toda mensagem.

Cada lorebook guarda entradas. A entrada tem palavras-chave de gatilho e um bloco de texto. Quando uma palavra-chave aparece nas mensagens recentes, Marinara acrescenta o texto da entrada ao prompt, o texto enviado ao modelo para uma resposta. Em outras ferramentas, os lorebooks também se chamam World Info.

Por exemplo, uma entrada com a palavra-chave `Eldoria` e o texto abaixo faz a IA conhecer a cidade sempre que alguém a menciona.

```text
Eldoria is a rainy port city ruled by a council of nine merchants.
```

A correspondência por palavra-chave funciona com qualquer modelo e não exige configuração. Para fazer a correspondência pelo sentido, em vez das palavras exatas, veja [Busca semântica para lorebooks](semantic-search.md).

## Como criar um lorebook e adicionar uma entrada

1. Abra o painel **Lorebooks** pela barra lateral.
2. Clique em **New** (novo, o ícone de mais). A janela **Create Lorebook** (criar lorebook) abre.
3. Digite um **Name** (nome). Esse campo é obrigatório.
4. Acrescente uma **Description** (descrição), se quiser.
5. Escolha uma **Category** (categoria). O padrão é **Other**. Se você vai vincular este lorebook a um personagem, escolha **Character**, porque o seletor do personagem lista só essa categoria.
6. Clique em **Create Lorebook**. O novo lorebook aparece na lista.
7. Clique na linha do lorebook. O editor de página inteira abre.
8. Clique na aba **Entries** (entradas).
9. Clique em **Add Entry** (adicionar entrada). Aparece uma linha de entrada nova e vazia.
10. Digite um nome na linha, como `Eldoria`, e clique na linha para abri-la.
11. Em **Primary Keys** (chaves primárias), digite `Eldoria` e pressione <kbd>Enter</kbd>.
12. Em **Content** (conteúdo), escreva o texto para a IA.

A entrada se salva sozinha pouco depois que você para de digitar, e aparece **Saved automatically**. A partir daí, a entrada entra no prompt sempre que a palavra-chave dela corresponde. Para palavras-chave, posição e momento de acionar, veja [Entradas de lorebook: chaves, posição e momento de acionar](entries.md).

Se não funcionou: confira se o lorebook está ativo no chat (veja abaixo), se o botão liga/desliga **Enabled** (ativado) dele está ligado e se a palavra-chave aparece nas últimas mensagens. Marinara varre só a quantidade de mensagens definida em **Scan Depth**.

## Como deixar um lorebook ativo em um chat

O lorebook só alimenta a IA quando está ativo no chat aberto. Há três formas.

| Forma | Onde definir | Ativo em |
| --- | --- | --- |
| Global | Botão liga/desliga **Global** na aba **Overview** (visão geral) do lorebook | Todos os chats |
| Vinculado | Aba **Overview** do lorebook, ou o editor de personagem ou de persona | Chats com aquele personagem ou aquela persona |
| Adicionado a um chat | **Chat Settings → Lorebooks** | Só aquele chat |

Um mesmo lorebook não pode ser global e vinculado ao mesmo tempo. Ao ativar **Global**, os vínculos dele com personagens e personas são removidos quando você salva.

Um lorebook ativo ainda precisa do botão **Enabled** ligado. Para os vínculos, veja [Vincular lorebooks a personagens e personas](linking-to-characters.md).

## As configurações da aba **Overview**

Abra um lorebook e clique em **Overview** para definir o comportamento do lorebook inteiro.

| Configuração | O que faz | Padrão |
| --- | --- | --- |
| **Scan Depth** | Quantas mensagens recentes Marinara verifica em busca de palavras-chave. 0 varre o chat inteiro. | 2 |
| **Token Budget** | O máximo de tokens que este lorebook pode acrescentar a uma resposta. 0 significa sem limite. | 2048 |
| **Entry Limit** | O máximo de entradas que este lorebook pode acrescentar a uma resposta. Faixa de 1 a 1000. | 100 |
| **Max Depth** | Passagens extras de recursão. Só aparece com **Recursive** ativado. Faixa de 1 a 10. | 3 |

Os tokens são pedacinhos de texto que os modelos contam; em inglês, cerca de três quartos de uma palavra. Para saber o que cada limite faz e o que significa recursão, veja [Orçamento de tokens e recursão em lorebooks](token-budgets.md).

A aba também tem estes botões liga/desliga.

- **Enabled** liga ou desliga o lorebook inteiro. Vem ligado por padrão.
- **Global** deixa o lorebook ativo em todos os chats.
- **Recursive** permite que o texto de uma entrada ativada acione outras entradas. Vem desligado por padrão.
- **Vectors** permite que as entradas também correspondam pelo sentido. Vem desligado por padrão, e as palavras-chave funcionam de qualquer jeito.

O painel **Semantic search (embeddings)**, abaixo dos botões liga/desliga, é tratado em [Busca semântica para lorebooks](semantic-search.md).

## O painel **Lorebooks**

No topo do painel, três botões de ícone mostram o nome quando você passa o mouse sobre eles.

- **New** abre a janela **Create Lorebook**.
- **Import** (importar) abre a janela **Import Lorebook** (importar lorebook). Veja [Importar e exportar lorebooks](import-export.md).
- **Select** (selecionar) liga a seleção múltipla, para você exportar ou excluir vários lorebooks de uma vez.

Abaixo dos botões:

- **Search lorebooks** (buscar lorebooks) filtra por nome, descrição, nomes de personagem ou persona vinculados e tags.
- **Sort order** (ordem de exibição) oferece **Manual order**, **A-Z**, **Z-A**, **Newest**, **Oldest** e **Token Budget**. Com **Manual order** (ordem manual), arraste os lorebooks para o lugar, ou use <kbd>Alt</kbd>+<kbd>Up</kbd> e <kbd>Alt</kbd>+<kbd>Down</kbd>.
- **New Folder** (nova pasta) cria uma pasta de biblioteca. Arraste um lorebook para cima dela. No celular, segure o lorebook e depois arraste. Essas pastas são diferentes das pastas de entradas dentro de um lorebook.

Cada linha tem os botões **Copy** (duplica o lorebook) e **Delete** (excluir). Eles aparecem quando você passa o mouse sobre a linha e ficam sempre visíveis no celular. Um lorebook desativado mostra o selo **OFF**. Clique na imagem para enviar uma ou substituí-la.

### Categorias

A categoria é um rótulo para a sua biblioteca. Ela não muda quando o lorebook é acionado. As abas são **All**, **Active** (lorebooks relevantes para o chat aberto), **World**, **Character**, **NPC**, **Spellbook** e **Other**. Você pode trocar a categoria de um lorebook na aba **Overview** dele, onde **Other** se chama **Uncategorized**.

## Guias relacionados

- [Entradas de lorebook: chaves, posição e momento de acionar](entries.md)
- [Orçamento de tokens e recursão em lorebooks](token-budgets.md)
- [Busca semântica para lorebooks](semantic-search.md)
- [Vincular lorebooks a personagens e personas](linking-to-characters.md)
- [Importar e exportar lorebooks](import-export.md)
- [Fontes de conhecimento: agentes Retrieval e Router](../agents/knowledge-sources.md)
