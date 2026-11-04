# Vincular lorebooks a personagens e personas

Vincule um lorebook a um personagem ou a uma persona e ele se ativa sozinho nos chats certos. Você também pode embutir um lorebook dentro de um card de personagem e controlar os lorebooks de um chat. Ainda não conhece os lorebooks? Comece pela [Visão geral dos lorebooks](overview.md).

## Vincular ou embutir

| Recurso | Vincular (atribuir) | Embutir |
| --- | --- | --- |
| O que acontece | O personagem ou a persona aponta para um lorebook da sua biblioteca. | O lorebook é escrito dentro do card de personagem. |
| Quando se ativa | Nos chats com aquele personagem ou aquela persona. | Igual, e ele acompanha o card. |
| É exportado com o card | Não | Sim |
| Disponível para | Personagens e personas | Só personagens |

Na maioria das vezes, vincule. Embuta só quando você pretende compartilhar o card com o lorebook dele.

## A aba Lorebook no editor

O editor de personagem e o editor de persona têm, os dois, uma aba **Lorebook**.

1. Abra um personagem ou uma persona para editar.
2. Clique na aba **Lorebook**. A seção **Lorebooks** tem dois botões, **New** (novo) e **Assign Lorebook** (atribuir um lorebook).

**New** cria um lorebook já vinculado a este personagem ou a esta persona, com a categoria definida como **Character**. **Assign Lorebook** vincula um lorebook que você já tem.

## Atribuir um lorebook existente

Antes de começar: o seletor lista só os lorebooks cujo **Category** (categoria) é **Character**, inclusive para personas. Se faltar um lorebook, abra-o, defina **Category** como **Character** na aba **Overview** (visão geral) e tente de novo.

1. Na aba **Lorebook**, clique em **Assign Lorebook**.
2. Digite parte do nome na caixa de busca.
3. Clique no lorebook. Aparece uma marca de seleção.
4. Deixe **Scope** (escopo) em **All chats with** e o nome, ou mude (veja abaixo).
5. Clique em **Assign** (atribuir).

O lorebook passa a aparecer na lista de atribuídos. Use o botão **Scope** na linha dele para mudar o escopo, e o ícone de lixeira para remover o vínculo. Clique no nome para abrir o lorebook.

Um lorebook global não pode ser vinculado também. Veja [Visão geral dos lorebooks](overview.md).

### Scope

O **Scope** decide quais chats podem usar o lorebook vinculado. Só entram na conta os chats com este personagem ou que usam esta persona.

| Scope | Resultado |
| --- | --- |
| **All chats with** (o nome) | O padrão. Ele se ativa em todos esses chats. |
| **Disabled for all chats** | O vínculo continua, mas o lorebook nunca se ativa. Use para pausar. |
| **Specific chats** | Só os chats que você marcar na lista. Marque pelo menos um para poder salvar. |

Para mudar o escopo depois, clique em **Scope** na linha, ajuste e clique em **Assign** de novo.

## Embutir um lorebook em um card de personagem

Antes de começar: atribua primeiro o lorebook ao personagem (veja acima).

1. Abra o personagem e clique na aba **Lorebook**.
2. Na linha do lorebook, clique em **Embed into card** (embutir no card).

Um selo **Embedded** aparece na linha, e as entradas passam a ser exportadas com o card.

Um card comporta um lorebook embutido. Se ele já tiver um, **Embed into card** fica desativado, e a dica do botão pede que você remova primeiro o lorebook embutido atual.

Depois de editar o lorebook vinculado, clique em **Refresh** (atualizar) na linha dele para regravar a cópia embutida com as entradas atuais.

### Gerenciar um lorebook embutido

Quando um card tem um lorebook embutido, estes controles aparecem abaixo da lista de atribuídos, com uma lista somente leitura das entradas dele.

- **Import Embedded Lorebook** (importar o lorebook embutido) transforma as entradas do card em um lorebook normal na sua biblioteca, vinculado de volta ao personagem. Quando já existe uma cópia vinculada, o botão mostra **Reimport Embedded Lorebook**.
- **Edit Embedded Lorebook** (editar o lorebook embutido) abre esse lorebook vinculado. As suas edições são sincronizadas de volta com a cópia do card.
- **Remove from card** (remover do card) exclui a cópia embutida. Um lorebook vinculado à parte continua intacto.

Muitos cards importados de outras ferramentas chegam com um lorebook embutido. Clique em **Import Embedded Lorebook** para ter uma versão editável.

## A seção Lorebooks em Chat Settings

Cada chat tem os próprios controles de lorebook.

1. Abra um chat.
2. Abra **Chat Settings** (configurações do chat).
3. Encontre a seção **Lorebooks**. Um selo mostra quantos lorebooks estão ativos.

Cada lorebook ativo tem um selo que diz por que ele está ligado.

| Selo | Significado |
| --- | --- |
| **Chat** | Você o adicionou a este chat. |
| **Global** | É um lorebook global. |
| **Character** | Está vinculado a um personagem deste chat. |
| **Persona** | Está vinculado à persona deste chat. |

Você pode mudar o que fica ativo só neste chat.

- **Add Lorebook** (adicionar um lorebook) adiciona um lorebook a este chat. Ele mostra o selo **Chat**.
- O ícone de lixeira (**Remove from chat**) remove um lorebook que você adicionou.
- O ícone de olho cortado (**Disable in this chat**) esconde aqui um lorebook automático, sem desfazer o vínculo. Ele passa a mostrar o nome riscado e o selo **Disabled**.
- O ícone de olho (**Enable in this chat**) o liga de novo.

### Lorebook Token Budget

**Lorebook Token Budget** limita quantos tokens de texto de lorebook este chat pode acrescentar. O padrão é 8192, e 0 significa sem limite. Ele vale por cima do **Token Budget** próprio de cada lorebook. Veja [Orçamento de tokens e recursão em lorebooks](token-budgets.md).

## Guias relacionados

- [Visão geral dos lorebooks](overview.md)
- [Orçamento de tokens e recursão em lorebooks](token-budgets.md)
- [Importar e exportar lorebooks](import-export.md)
- [Criando e editando personagens](../characters/creating-and-editing-characters.md)
- [Visão geral do painel Chat Settings](../chats/chat-settings.md)
