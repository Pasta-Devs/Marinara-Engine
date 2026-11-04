# Organizando a biblioteca de personagens

O painel **Characters** (personagens) é a lista do painel lateral com todos os personagens que você criou ou importou. Use o painel para buscar, ordenar, agrupar personagens em pastas, marcar favoritos, filtrar por tags e exportar ou excluir vários de uma vez.

## O painel Characters

No topo do painel, você pode:

- Clicar em **Download** (baixar) para abrir o [Card Browser](bot-browser.md) e encontrar personagens em sites públicos.
- Clicar em **Open Library** (abrir a biblioteca) para abrir uma grade maior, em página inteira, com os mesmos personagens.
- Clicar em **New** (o ícone de mais) para abrir a janela **Create Character**.
- Clicar em **Import** (o ícone de download) para importar um arquivo de personagem. Veja [Importar e exportar cards de personagem](import-export.md).
- Clicar em **Select** (o ícone de check) para ligar o modo de seleção e agir em lote.

A biblioteca completa preserva o card selecionado, a ordenação e a posição da rolagem quando você abre um personagem para editar e volta.

Cada linha mostra o avatar, o nome, uma linha de título opcional, o criador e a versão, até 3 tags e uma estimativa aproximada de tokens. Um pequeno selo de estrela marca um favorito. Passe o mouse sobre uma linha para ver **Duplicate** (duplicar) e **Delete** (excluir). Se você tiver muitos personagens, clique em **Load more** (carregar mais), no rodapé, para carregar a próxima página.

<a id="search"></a>

## Busca

Digite na caixa de busca no topo. O texto de exemplo é **Search characters/tags** (buscar personagens/tags). O texto simples é comparado com o nome, o título, a descrição e as tags do personagem, sem diferenciar maiúsculas de minúsculas. Digitar `knight` mostra todos os personagens com "knight" em qualquer um desses campos.

| Busca | O que encontra |
| --- | --- |
| `male genshin` ou `male,genshin` | Cards que têm as duas tags exatas. |
| `male "Modern AU"` | Coloque entre aspas uma tag que tenha espaços ou vírgulas. |
| `-tag:"slow burn"` | Esconde todo card com essa tag, mesmo que o resto da busca corresponda. |
| `-vampire` | O mesmo, para uma tag de uma palavra só. As aspas podem ficar de fora. |
| `mage -tag:"villain"` | Cards que correspondem a "mage", sem os que têm a tag "villain". |

A busca comum por frases continua funcionando. A mesma busca funciona na Character Library em página inteira e para personas.

## Ordenação

Escolha uma ordem no menu suspenso de ordenação, ao lado da caixa de busca.

| Opção | O que faz |
| --- | --- |
| **Manual order** (ordem manual) | A ordem que você mesmo definiu. |
| **A-Z** | Nomes de A a Z. |
| **Z-A** | Nomes de Z a A. |
| **Newest** | Os criados mais recentemente primeiro. |
| **Oldest** | Os criados há mais tempo primeiro. |
| **Favorites** | Favoritos primeiro, depois o resto. |

Para definir uma ordem manual, arraste uma linha para cima ou para baixo, ou pressione <kbd>Alt</kbd>+<kbd>Up</kbd> ou <kbd>Alt</kbd>+<kbd>Down</kbd> em uma linha com foco. Qualquer um dos dois muda a ordenação para **Manual order**.

## Pastas

As pastas agrupam personagens relacionados, por exemplo por história ou série, para que uma lista longa fique mais fácil de percorrer. O uso é opcional.

1. Clique em **New Folder** (nova pasta). Aparece uma pasta chamada **unnamed**.
2. Renomeie a pasta: dê um duplo clique ou um toque duplo nela, ou selecione-a e pressione <kbd>F2</kbd>. Digite o novo nome e pressione <kbd>Enter</kbd>.
3. Arraste a linha de um personagem para cima da pasta para colocá-lo dentro dela. Assim que existir uma pasta, uma linha de ajuda mostra **Drag and drop characters to folders, double-click or double-tap to rename**.

Para tirar um personagem, passe o mouse sobre a linha dele dentro da pasta e clique no botão de remover da pasta, ou arraste-o para fora. Clique em uma pasta para expandir ou recolher. O número ao lado do nome indica quantos personagens ela tem.

Em uma tela sensível ao toque, mantenha uma linha pressionada para pegá-la e depois arraste. Um swipe normal continua rolando a lista.

Para mover vários de uma vez, segure uma linha e toque em outras linhas com um segundo dedo para levá-las junto como uma pilha. Depois, solte a pilha sobre uma pasta.

Para excluir uma pasta, passe o mouse sobre ela e clique no botão de lixeira dela. Uma pasta com personagens pede confirmação: **Delete "name"? Its N characters will stay in the library and move out of the folder.** Uma pasta vazia é removida na hora. Excluir uma pasta nunca exclui os personagens que estão dentro dela.

### Usar uma pasta como equipe de chat em grupo

Cada pasta também é uma equipe salva para chats em grupo. Quando você monta um chat com mais de um personagem, **Add from Folder** (adicionar a partir de uma pasta) adiciona todos os personagens de uma pasta em uma única etapa. Veja [Chats em grupo e conversas em grupo](../chats/group-chats.md).

## Favoritos e tags

### Favoritos

Abra um personagem e clique na estrela **Favorite** (favorito) para ativar ou desativar. Não é possível marcar pela lista do painel. Os favoritos mostram um pequeno selo de estrela. Abaixo da caixa de busca, três botões filtram a lista:

- **All** mostra todos os personagens.
- **Favs** mostra só os favoritos.
- **Non-favs** mostra só os personagens que não são favoritos.

Você também pode escolher **Favorites** no menu suspenso de ordenação para levar os favoritos para o topo.

### Tags

As tags são etiquetas como `fantasy` ou `slow burn`. Você as adiciona no editor de personagem. Veja [Criando e editando personagens](creating-and-editing-characters.md#metadata-tab). No painel, clique em um chip de tag em qualquer linha para filtrar a lista aos personagens que compartilham essa tag.

Quando os seus personagens têm tags, aparece um botão **Tags** com uma contagem, como **Tags (12)**. Clique nele para expandir a lista completa:

- Clique em uma tag para incluí-la como filtro. Com várias tags selecionadas, um personagem corresponde se tiver qualquer uma delas.
- Clique no X de uma tag para excluí-la de todos os personagens que a têm. Marinara pede confirmação: **Remove tag "name" from all characters?**
- **Clear** (limpar) aparece assim que um filtro de tag está ativo. Clique nele para limpar os filtros de tag.

Para esconder uma tag em vez disso, use `-tag:` na caixa de busca, como mostrado em [Busca](#search).

<a id="export-or-delete-many-characters"></a>

## Exportar ou excluir vários personagens

1. Clique em **Select** no topo do painel. Uma caixa de seleção aparece em cada linha.
2. Clique nos personagens que você quer. O cabeçalho do painel mostra quantos estão selecionados.
3. Use a barra de ações no rodapé.

A barra de ações tem dois botões:

- **Export** (exportar) baixa os personagens selecionados em um único zip chamado `marinara-characters.zip`, no formato nativo do Marinara.
- **Delete** remove os personagens selecionados. Marinara pede confirmação antes: **Delete N characters?**

No modo de seleção, você também pode arrastar juntos os personagens selecionados para dentro de uma pasta. Para os formatos de arquivo, veja [Importar e exportar cards de personagem](import-export.md).

## Guias relacionados

- [Importar e exportar cards de personagem](import-export.md)
- [Criando e editando personagens](creating-and-editing-characters.md)
- [Chats em grupo e conversas em grupo](../chats/group-chats.md)
