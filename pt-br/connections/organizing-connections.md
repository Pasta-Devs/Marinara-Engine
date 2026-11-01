# Organizando as conexões

Neste guia você aprende a manter as contas e os modelos em ordem no Marinara Engine. Aqui estão a lista de contas, os modelos com estrela, como mover e remover modelos, as pastas, o Shuffle e como exportar ou importar. Uma conta é uma chave, um login ou um endereço de um provedor de IA; um modelo é um modelo de IA que você salvou a partir dela. Para adicionar uma conta, veja [Conectando a um provedor de IA](connecting-to-a-provider.md).

## A lista de contas

Abaixo da caixa **Jobs** (tarefas), o painel **Connections** (Conexões) lista as suas contas. Cada conta mostra a imagem, o nome, quantos modelos tem e o endereço. Uma linha de modelo mostra a imagem do modelo, o nome dele e selos como a tarefa que ele faz (**Main**, **Agents**, **Images**), **Custom settings**, o preço ou **Plan**, para os modelos incluídos em uma assinatura.

Clique na linha de uma conta para recolher os modelos dela e clique de novo para mostrá-los. Marinara lembra quais contas você recolheu. **More actions** (mais ações), no topo do painel, tem **Fold all accounts** e **Open all accounts**, para recolher ou abrir todas as contas, além de **Show only Off or Needs key**, que mostra só as contas desligadas ou sem chave, e **Show cost badges**, que mostra os selos de custo. Num painel largo, o menu suspenso de ordenação fica ao lado de **Search models and accounts** (buscar modelos e contas). Num painel estreito, a ordem da lista fica em **More actions**.

Uma conta de gateway que alcança vários criadores de modelos, por exemplo um proxy ou o LinkAPI, agrupa os modelos dela em títulos **via**, como **via NanoGPT**, com o ícone daquele criador.

O card **Built-in model** (modelo embutido), abaixo da caixa Jobs, mostra o modelo que roda no seu computador e o estado dele. Veja [Como configurar o Local Model](local-model.md).

### Ações da conta

Clique em **⋯** na linha de uma conta:

- **Edit account** (editar conta) abre as configurações dela: **Name**, **API key**, **Address**, **Usage and limits** e **Use this account**.
- **Replace key** (substituir a chave) cola uma chave nova.
- **Test** (testar) verifica a chave e mostra o resultado.
- **Add model** (adicionar modelo) abre a lista de modelos da conta. **Add image model** (adicionar modelo de imagem) aparece nos provedores que também geram imagens.
- **Select models** (selecionar modelos) permite mover ou excluir vários modelos de uma vez.
- **Duplicate** (duplicar) adiciona uma cópia da conta, com cópias dos modelos dela.
- **Turn off** (desligar) faz Marinara parar de usar a conta até você usar **Turn on** (ativar) de novo.
- **Delete account** (excluir conta). Antes, Marinara lista as tarefas, os chats e os agentes que ainda usam os modelos dela.

### Ícones dos provedores

Cada conta mostra o ícone do provedor dela. Os ícones vêm com Marinara, então Marinara nunca os carrega da internet. Um endereço personalizado mostra o ícone de um servidor ou gateway conhecido quando o endereço ou o nome contém um deles, por exemplo Ollama, LM Studio, KoboldCpp, Bifrost ou LiteLLM. Caso contrário, mostra a primeira letra do nome. Clique na imagem de uma conta para escolher uma imagem sua.

## Modelos com estrela

A estrela marca os modelos que você quer ter à mão. Os modelos com estrela aparecem em **Starred** (com estrela), perto do topo de todo seletor de modelos. Isso vale para as janelas **Model for** (modelo para) da caixa **Jobs**, para o **Model for this chat** do chat e para os campos de modelo em **Chat Settings** (configurações do chat) e no editor de agente.

Para dar estrela a um modelo, clique na estrela dele na lista **Add model** da conta ou escolha **Star** (dar estrela) no menu **⋯** do modelo. Dar uma tarefa a um modelo também o salva.

Para tirar a estrela de um modelo, clique na estrela de novo. Marinara remove o modelo e mostra **Undo** (desfazer) por alguns segundos. O modelo fica, sem a estrela, quando ainda tem um papel em **Jobs**, tem configurações próprias ou é o último modelo da conta. A mensagem informa o motivo.

## Ações do modelo

Clique em **⋯** na linha de um modelo:

- **Make default for…** (tornar padrão para) dá uma tarefa ao modelo, o mesmo que escolhê-lo na caixa **Jobs**.
- **Edit model** (editar modelo) abre as configurações dele. Clicar na linha do modelo faz o mesmo.
- **Move to account…** (mover para a conta) move o modelo para outra conta do mesmo provedor ou para uma conta nova. O modelo passa a usar a chave e o catálogo daquela conta. Os chats que usam o modelo continuam funcionando.
- **Folder** (pasta) coloca o modelo em uma pasta. As pastas aparecem quando você escolhe **Group by folder** (agrupar por pasta) em **More actions**.
- **Duplicate** faz uma cópia completa, com as mesmas configurações, sem perguntar.
- **Add to Shuffle** (adicionar ao Shuffle) ou **Remove from Shuffle** (remover do Shuffle).
- **Change picture** (trocar a imagem).
- **Remove** (remover) exclui o modelo depois que você confirma.

No computador, você pode arrastar a linha de um modelo para cima de um chat para usar aquele modelo no chat.

## Busca

**Search models and accounts**, no topo do painel, filtra a lista conforme você digita. Quando nada corresponde, o painel avisa.

## Shuffle

O Shuffle faz o chat escolher um modelo diferente a cada resposta que escreve. Isso ajuda quando você quer dividir as requisições entre vários provedores ou modelos.

Para colocar um modelo no Shuffle, escolha **Add to Shuffle** no menu **⋯** dele. Para o chat usar o Shuffle, abra **Model for this chat** pela caixa de mensagem ou por **Chat Settings → Connection → Model** e escolha **Shuffle** (sortear). A partir daí, cada resposta sorteia um modelo do seu Shuffle.

Se o modelo sorteado para uma resposta falhar e o **Main** (principal) tiver um modelo em **If it fails** (se falhar), esse modelo escreve a resposta no lugar dele. Um aviso mostra o modelo que falhou e um motivo curto, como "key rejected", "rate limited" ou "not found", para você saber qual deles precisa de conserto. A resposta fica com um pequeno rótulo **Fallback** (reserva); toque nele, ou aponte para ele, para ver a mesma linha de novo.

Uma escolha em **Model for this chat** muda só aquele chat. Para mudar o modelo dos chats novos, defina o **Main** na caixa **Jobs**.

## Exportar e importar

Exporte as contas para um arquivo, seja para fazer backup, seja para levá-las a outra instalação, e importe esse arquivo depois.

**A exportação nunca inclui as chaves de API.** Depois de importar, abra cada conta e digite a chave de novo. As estrelas vão junto; o catálogo do provedor não vai, então ele é carregado de novo na primeira vez que você abrir os modelos da conta.

Para exportar um modelo só, abra o modelo com **Edit model** e clique no botão **Export** (exportar) dele, o ícone de upload. Para exportar tudo, abra **More actions** e escolha **Export all accounts** (exportar todas as contas). Antes de o download começar, Marinara lembra que o arquivo não tem chaves.

Um modelo sozinho é baixado como um arquivo `.connection.json`. Vários vêm juntos em um arquivo `marinara-connections.zip`.

Para importar, abra **More actions** e escolha **Import account** (importar conta). Solte um ou mais arquivos `.json` na janela ou clique para procurar os arquivos. Cada conta importada fica com a chave vazia até você preenchê-la.

## Guias relacionados

- [Conectando a um provedor de IA](connecting-to-a-provider.md)
- [Visão geral do painel Chat Settings](../chats/chat-settings.md)
