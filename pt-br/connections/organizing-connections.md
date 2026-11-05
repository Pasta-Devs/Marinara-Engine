# Organizando as conexões

Neste guia você aprende a manter as contas e os modelos em ordem no painel **Connections** (Conexões): recolher, dar estrela, mover, remover, pastas, Shuffle e exportação. Para adicionar uma conta, veja [Conectando a um provedor de IA](connecting-to-a-provider.md).

## A lista de contas

Abaixo da caixa **Jobs** (tarefas), o painel lista as suas contas. Cada conta mostra a imagem, o nome, o número de modelos e o endereço. Uma linha de modelo mostra a imagem do modelo, o nome dele e selos como a tarefa que ele faz (**Main**, **Agents**, **Images**), **Custom settings**, o preço ou **Plan**, para os modelos incluídos em uma assinatura. O card **Built-in model** (modelo embutido) fica abaixo da caixa **Jobs**. Veja [Como configurar o Built-in model](local-model.md).

Clique na linha de uma conta para recolher os modelos dela e clique de novo para mostrá-los. Marinara lembra quais contas você recolheu. **More actions** (mais ações, o botão de três pontos), no topo do painel, tem estes itens:

| Item | O que faz |
| --- | --- |
| **Fold all accounts**, **Open all accounts** | Recolhe ou abre todas as contas. |
| **Show only Off or Needs key** | Lista só as contas que precisam de atenção. |
| **Show cost badges** | Mostra o preço de cada modelo. |
| **Group by folder** (agrupar por pasta), **Group by account** (agrupar por conta) | Troca o jeito de agrupar os modelos. Veja [Pastas](#folders). |
| **Import account**, **Export all accounts** | Veja [Exportar e importar](#export-and-import). |

Num painel largo, o menu suspenso de ordenação fica ao lado de **Search models and accounts** (buscar modelos e contas). Num painel estreito, a ordenação fica em **More actions**. As opções de ordenação são **Custom**, **A–Z**, **Z–A**, **Newest** e **Oldest** (personalizada, de A a Z, de Z a A, mais recentes e mais antigas). **Search models and accounts** filtra a lista conforme você digita.

Algumas contas alcançam modelos de vários criadores, como o NanoGPT ou um proxy. Os modelos delas ficam agrupados em títulos como **via NanoGPT**.

### Ações da conta

Clique em **⋯** na linha de uma conta:

| Ação | O que faz |
| --- | --- |
| **Edit account** (editar conta) | Abre as configurações dela, entre elas **Name**, **Address**, **API key** e **Use this account**. |
| **Replace key** (substituir a chave) | Cola uma chave nova. Se a chave antiga está em outras contas, Marinara pergunta se deve atualizar essas contas também. |
| **Test** (testar) | Verifica a chave e mostra o resultado. |
| **Add model** (adicionar modelo) | Abre a lista de modelos da conta. **Add image model** (adicionar modelo de imagem) aparece nos serviços que também geram imagens. |
| **Select models** (selecionar modelos) | Permite mover ou excluir vários modelos de uma vez. |
| **Duplicate** (duplicar) | Adiciona uma cópia da conta, com cópias dos modelos dela. |
| **Turn off** / **Turn on** (desligar / ativar) | Faz Marinara parar de usar a conta ou voltar a usá-la. |
| **Delete account** (excluir conta) | Veja abaixo. |

Para excluir uma conta, clique em **Delete account**. Marinara pede confirmação e lista o que usa os modelos dela, em **Used by** (usado por): chats, agentes, modelos e tarefas. Clique em **Delete with its N models** (excluir com os N modelos dela) para remover a conta e os modelos dela. Esses chats e essas tarefas passam a precisar de outro modelo. Se um modelo não puder ser removido, o editor lista esse modelo em **This account still has models. Remove these first:**. Abra cada um e remova-o.

Em **Edit account**, **Test account** (testar conta) verifica a chave, **Usage and balance** (uso e saldo) mostra o uso do plano e **More options** tem **Requests per minute** e **Parallel requests**.

### Ícones dos provedores

Cada conta mostra o ícone do serviço dela. Os ícones vêm com Marinara e nunca são carregados da internet. Um endereço personalizado mostra o ícone de um servidor ou gateway conhecido quando o endereço ou o nome contém um deles, como Ollama, LM Studio, KoboldCpp, Bifrost ou LiteLLM. Caso contrário, mostra a primeira letra do nome. Para escolher uma imagem sua, clique na imagem de uma conta e escolha o logotipo de um serviço, envie uma imagem ou use letras.

## Modelos com estrela

A estrela marca os modelos que você quer encontrar rápido. Os modelos com estrela aparecem em **Starred** (com estrela), perto do topo de todo seletor de modelos. Isso vale para as janelas **Model for** (modelo para) da caixa **Jobs**, para o **Model for this chat** e para os campos de modelo em **Chat Settings** (configurações do chat) e no editor de agente.

Para dar estrela a um modelo, clique na estrela dele na lista **Add model** da conta ou escolha **Star** (dar estrela) no menu **⋯** do modelo. Dar uma tarefa a um modelo também o salva.

Para tirar a estrela de um modelo, clique na estrela de novo. Marinara remove o modelo e mostra **Undo** (desfazer) por alguns segundos. O modelo fica, sem a estrela, quando um chat o usa, quando ele tem um papel em **Jobs**, quando tem configurações próprias ou quando é o último modelo da conta. A mensagem informa o motivo.

## Ações do modelo

Clique em **⋯** na linha de um modelo:

| Ação | O que faz |
| --- | --- |
| **Make default for…** (tornar padrão para) | Dá uma tarefa ao modelo, o mesmo que escolhê-lo na caixa **Jobs**. |
| **Edit model** (editar modelo) | Abre as configurações dele. Clicar na linha do modelo faz o mesmo. |
| **Move to account…** (mover para a conta) | Move o modelo para outra conta. Ele passa a usar a chave daquela conta. |
| **Folder** (pasta) | Coloca o modelo em uma pasta. |
| **Duplicate** | Faz uma cópia completa, com as mesmas configurações. |
| **Add to Shuffle** / **Remove from Shuffle** (adicionar ao Shuffle / remover do Shuffle) | Veja [Shuffle](#shuffle). |
| **Change picture** (trocar a imagem) | Abre as opções de imagem. |
| **Remove** (remover) | Exclui o modelo depois que você confirma. A confirmação lista o que usa o modelo. |

Quando você move um modelo, o nome, a imagem, as tarefas e os chats dele vão junto, e as opções do serviço voltam ao padrão.

No computador, você pode arrastar a linha de um modelo para cima de um chat para usar aquele modelo no chat.

<a id="folders"></a>

## Pastas

As pastas agrupam os seus modelos, por exemplo **RP** e **Work**. Escolha **Group by folder** em **More actions** para mostrá-las. Um modelo fica em uma pasta só.

1. Clique em **⋯** em um modelo e escolha **Folder**.
2. Escolha uma pasta, ou clique em **New folder…** (nova pasta), digite um nome e clique em **Create** (criar).

Uma pasta pode ter um ícone e uma cor. Para renomear ou excluir uma pasta, abra o menu **⋯** dela. Excluir uma pasta mantém os modelos dela, em **Not in a folder** (fora de pasta).

## Shuffle

O Shuffle faz o chat escolher um modelo diferente a cada resposta que escreve. Use-o para dividir as requisições entre vários serviços ou modelos.

1. Clique em **⋯** em cada modelo que você quer no conjunto e escolha **Add to Shuffle**.
2. Em um chat, abra **Model for this chat** pela caixa de mensagem, ou **Chat Settings → Connection → Model**, e escolha **Shuffle** (sortear).

A partir daí, cada resposta sorteia um modelo do seu conjunto do Shuffle.

Se o modelo sorteado para uma resposta falhar e o **Main** (principal) tiver um modelo em **If it fails** (se falhar), esse modelo escreve a resposta no lugar dele. Um aviso mostra o modelo que falhou e um motivo curto, como "key rejected", "rate limited" ou "not found". A resposta fica com um pequeno rótulo **Fallback** (reserva). Toque nele, ou aponte para ele, para ver a mesma linha de novo.

Uma escolha em **Model for this chat** muda só aquele chat. Para mudar o modelo dos chats novos, defina o **Main** na caixa **Jobs**.

<a id="export-and-import"></a>

## Exportar e importar

Você pode exportar as contas para um arquivo, para fazer backup ou levá-las a outra instalação, e importá-las depois.

> **Aviso:** a exportação nunca inclui as chaves de API. Depois de importar, abra cada conta e digite a chave de novo. Nunca compartilhe uma chave com ninguém.

- **Exportar um modelo:** abra o modelo com **Edit model** e clique em **Export model** (exportar modelo).
- **Exportar tudo:** abra **More actions** e escolha **Export all accounts** (exportar todas as contas). Marinara lembra que o arquivo não tem chaves. Clique em **Export** (exportar).
- **Importar:** abra **More actions** e escolha **Import account** (importar conta). Solte um ou mais arquivos (`.json`, `.jsonl` ou `.zip`) na janela, ou clique para procurar os arquivos. Isso inclui o `marinara-connections.zip` que você exportou. Cada conta importada fica com a chave vazia até você preenchê-la.

Um modelo sozinho é baixado como um arquivo `.connection.json`. Vários vêm juntos como `marinara-connections.zip`. As estrelas vão junto. O catálogo de modelos do serviço não vai, então ele é carregado de novo na primeira vez que você abrir os modelos da conta.

## Guias relacionados

- [Conectando a um provedor de IA](connecting-to-a-provider.md)
- [Visão geral do painel Chat Settings](../chats/chat-settings.md)
