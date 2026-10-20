# Organizando a biblioteca de personagens

Este guia explica o **Characters panel** (painel de personagens), a barra lateral onde ficam todos os personagens. Aqui você vê como buscar, ordenar, agrupar personagens em pastas, marcar favoritos, filtrar por tags e exportar ou excluir vários personagens de uma vez.

## O painel Characters

O **Characters panel** é a lista de personagens dentro do painel lateral. Ele reúne todos os personagens que você criou ou importou. No topo do painel, você tem estas opções:

- Clique em **Download** (baixar) para abrir o [Card Browser](bot-browser.md) e encontrar personagens em sites públicos.
- Clique em **Open Library** (abrir a biblioteca) para ver os mesmos personagens em uma grade de página inteira.
- Clique no botão **New** (o ícone de mais) para abrir a janela **Create Character**.
- Clique no botão **Import** (o ícone de download) para importar um arquivo de personagem.
- Clique no botão **Select** (o ícone de check) para ligar o modo de seleção múltipla e agir em lote.

A biblioteca completa usa a cor de texto chroma escolhida em **Settings** (Configurações). Ela também preserva o card selecionado, a ordenação e a posição da rolagem quando você abre um personagem para editar e volta.

Cada linha de personagem mostra o avatar, o nome, uma linha de título opcional, o criador e a versão, até 3 tags e uma estimativa aproximada de tokens. Um selo pequeno de estrela marca um favorito. Ao passar o mouse sobre a linha, aparecem um botão **Duplicate** (duplicar) e um botão **Delete** (excluir).

Quando há muitos personagens, um botão **Load more** (carregar mais) aparece no rodapé. Clique nele para carregar a próxima página de personagens.

## Busca

Digite na caixa de busca no topo do painel para filtrar a lista. O texto de exemplo do campo é **Search characters or -tag:"tag name"**.

O texto simples é comparado com o nome, o título, a descrição e as tags do personagem. Ao digitar `knight`, por exemplo, você vê todos os personagens com "knight" em qualquer um desses campos.

Também é possível esconder os personagens que têm uma tag específica. Coloque um sinal de menos antes da tag:

```
-tag:"tag name"
```

Vale saber algumas coisas sobre essa exclusão por tag:

- Use aspas quando a tag tiver espaço, como em `-tag:"slow burn"`.
- Numa tag de uma palavra só, as aspas podem ficar de fora, como em `-vampire`.
- A exclusão de uma tag esconde todo personagem que a carrega, mesmo que o resto do texto buscado combine com ele.

Você pode juntar texto simples e exclusão na mesma caixa. Por exemplo, `mage -tag:"villain"` acha os personagens que combinam com "mage" e esconde os que têm a tag "villain".

## Ordenação

Ao lado da caixa de busca fica o menu suspenso de ordenação. Escolha uma destas ordens:

| Opção         | O que faz                              |
| ------------- | -------------------------------------- |
| **Manual order** | A ordem que você mesmo definiu.     |
| **A-Z**       | Nomes de A a Z.                        |
| **Z-A**       | Nomes de Z a A.                        |
| **Newest**    | Os criados mais recentemente primeiro. |
| **Oldest**    | Os criados há mais tempo primeiro.     |
| **Favorites** | Favoritos primeiro, depois o resto.    |

Para definir uma ordem manual, arraste a linha de um personagem para cima ou para baixo. Também dá para apertar Alt+Up ou Alt+Down em uma linha selecionada. Qualquer um dos dois muda a ordenação para **Manual order** (ordem manual).

## Pastas

As pastas servem para agrupar personagens relacionados dentro do painel. O uso é opcional: se preferir, mantenha todos os personagens em uma lista única.

Para criar uma pasta:

1. Clique no botão **New Folder** (nova pasta).
2. A nova pasta aparece com o nome **unnamed**, que é o padrão.
3. Renomeie na hora ou depois (veja abaixo).

Para renomear uma pasta, dê um duplo clique nela, toque duas vezes ou selecione a pasta e aperte a tecla F2. Digite o novo nome e aperte Enter.

Para colocar um personagem numa pasta, arraste a linha do personagem e solte sobre a pasta. Assim que existir pelo menos uma pasta, uma linha de ajuda mostra **Drag and drop characters to folders, double-click or double-tap to rename**. Para tirar o personagem de lá, passe o mouse sobre a linha dele dentro da pasta e clique no botão de remover da pasta, ou arraste-o para fora.

Em uma tela sensível ao toque, mantenha uma linha pressionada para pegá-la e depois arraste. Um swipe normal continua rolando a lista. Enquanto segura uma linha, toque em outras linhas com um segundo dedo para levá-las junto como uma pilha e depois solte a pilha sobre uma pasta.

Clique na pasta para expandir ou recolher. O número ao lado do nome da pasta indica quantos personagens estão dentro dela.

Para excluir uma pasta, passe o mouse sobre ela e clique no botão de lixeira. Se a pasta tiver personagens, aparece uma mensagem de confirmação: **Delete "name"? Its N characters will stay in the library and move out of the folder.** Uma pasta vazia é removida na hora, sem confirmação. Excluir uma pasta nunca exclui os personagens que estão dentro dela – eles apenas voltam para a lista principal.

## Favoritos e chips de tag

### Favoritos

Marcar um personagem como favorito facilita encontrá-lo depois. A estrela de favorito fica dentro do próprio personagem, não na lista do painel. Abra um personagem e clique na estrela **Favorite** (favorito) para ativar ou desativar. Os personagens favoritados exibem um selo pequeno de estrela sobre o avatar, no painel.

Abaixo da área de busca ficam três botões de filtro:

- **All** mostra todos os personagens.
- **Favs** mostra só os favoritos.
- **Non-favs** mostra só os personagens que não são favoritos.

Outra opção: escolha **Favorites** no menu suspenso de ordenação para levar todos os favoritos para o topo da lista.

### Tags

As tags são etiquetas que você adiciona a um personagem para descrevê-lo, como `fantasy` ou `slow burn`. As tags de um personagem são adicionadas e editadas dentro do editor de personagem.

No painel, cada linha de personagem mostra até 3 das suas tags. Clique em um chip de tag em qualquer linha para reduzir a lista aos personagens que compartilham aquela tag.

Quando os personagens têm tags, um botão **Tags** aparece na linha de filtros, com o total de tags entre parênteses (por exemplo, **Tags (12)**). Clique nele para expandir a lista completa de tags:

- Clique em uma tag da lista expandida para usá-la como filtro. Ao clicar em mais de uma tag, o filtro pega os personagens que têm qualquer uma das tags selecionadas.
- Cada tag da lista expandida tem um X pequeno. Ao clicar nele, a tag é excluída de todos os personagens que a têm. Marinara pede uma confirmação: **Remove tag "name" from all characters?**
- Um botão **Clear** (limpar) aparece assim que um filtro de tag está ativo. Clique nele para limpar os filtros de tag.

Para esconder uma tag em vez de incluí-la, use a sintaxe de busca `-tag:` descrita acima, na seção Busca.

## Seleção em lote, exportação e exclusão

Quando quiser agir sobre vários personagens de uma vez, use o modo de seleção.

1. Clique no botão **Select** no topo do painel.
2. Uma caixa de seleção aparece em cada linha de personagem.
3. Clique nos personagens que quer incluir. O cabeçalho do painel mostra quantos estão selecionados.
4. Use a barra de ações no rodapé do painel.

A barra de ações tem dois botões:

- **Export** (exportar) baixa todos os personagens selecionados juntos, em um único arquivo zip chamado `marinara-characters.zip`. É uma exportação em lote no formato nativo do Marinara Engine.
- **Delete** remove todos os personagens selecionados. Marinara pede uma confirmação antes: **Delete N characters?**

No modo de seleção, você também pode arrastar de uma vez todos os personagens selecionados para dentro de uma pasta, em vez de movê-los um a um.

A lista completa dos formatos de arquivo de importação e exportação está no guia sobre importar e exportar, indicado abaixo.

## As pastas também funcionam como equipes de chat em grupo

As pastas que você monta aqui têm um segundo uso. Cada pasta é também uma equipe salva, pronta para entrar em um chat em grupo.

Ao montar um chat com mais de um personagem, procure a opção **Add from Folder** (adicionar a partir de uma pasta). Ela adiciona todos os personagens de uma pasta escolhida em uma única etapa. É o jeito mais rápido de começar um chat em grupo com um conjunto de personagens que você usa junto com frequência. Para entender como funcionam os chats em grupo, veja o guia indicado abaixo.

## Guias relacionados

- [Importar e exportar cards de personagem](import-export.md)
- [Criando e editando personagens](creating-and-editing-characters.md)
- [Chats em grupo e conversas em grupo](../chats/group-chats.md)
