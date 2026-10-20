# Organizando as conexões

Neste guia você aprende a manter as conexões salvas em ordem no Marinara Engine. Aqui estão as pastas de conexões, a busca e a ordenação, como duplicar e excluir, o conjunto aleatório, o **Quick Connection Switcher** (troca rápida de conexão) e como exportar ou importar conexões. Uma conexão é uma configuração salva que ensina Marinara a chegar até um serviço de IA.

Tudo isso acontece no painel **Connections** (Conexões). Ao abrir o painel, as conexões salvas aparecem em uma lista de linhas. Cada linha mostra o nome da conexão e, logo abaixo, o provedor e o modelo.

## Pastas de conexões

Use as pastas de conexões para juntar conexões parecidas. Por exemplo: todos os modelos locais em uma pasta e todos os provedores pagos em outra.

Para criar uma pasta, siga estes passos:

1. Clique no botão **New Folder** (nova pasta), acima da lista de conexões.
2. Aparece uma pasta nova chamada "unnamed".
3. Renomeie a pasta na hora, para não confundir depois (veja abaixo).

Para renomear uma pasta, dê um duplo clique na linha dela ou um toque duplo, se a tela for sensível ao toque. Outra opção: selecione a linha da pasta e aperte a tecla **F2**. Digite o novo nome e aperte Enter.

Para guardar uma conexão dentro de uma pasta, arraste a linha da conexão e solte em cima da pasta. Para tirar a conexão de lá, arraste-a para a área abaixo das pastas. Durante o arraste aparece a indicação **Drop here to move out of folder**.

Em uma tela sensível ao toque, mantenha uma linha pressionada para pegá-la e depois arraste. Um deslize normal continua rolando a lista.

Para recolher ou expandir uma pasta, clique uma vez na linha dela. Um número pequeno na linha da pasta mostra quantas conexões estão lá dentro.

Para excluir uma pasta, clique no ícone de lixeira na linha dela. Se ainda houver conexões dentro, Marinara pede uma confirmação na janela **Delete Folder**. Uma pasta vazia é excluída na hora, sem pedir confirmação. Excluir a pasta não exclui as conexões que estavam dentro dela. Essas conexões voltam para a área das conexões sem pasta.

## Busca e ordenação

A caixa **Search connections** filtra a lista conforme você digita. A busca considera o nome da conexão, o provedor, o modelo, a URL base, o serviço de imagem ou vídeo e o modelo de embedding (representação numérica do texto). Quando nada corresponde, aparece "No connections match your search".

O menu suspenso **Sort order** (ordem da lista), ao lado da caixa de busca, muda a ordem das conexões. São cinco opções:

| Opção | O que faz |
|---|---|
| **Custom** | A ordem que você mesmo definiu arrastando as linhas. |
| **A-Z** | Ordena pelo nome, de A a Z. |
| **Z-A** | Ordena pelo nome, de Z a A. |
| **Newest** | As conexões mais novas primeiro. |
| **Oldest** | As conexões mais antigas primeiro. |

Para definir uma ordem própria, arraste as linhas de conexão para cima ou para baixo. Ao arrastar uma conexão, Marinara já muda a ordenação para **Custom** sozinho. Você também pode mover uma linha selecionada com Alt+Up ou Alt+Down.

## Duplicar e excluir

Passe o mouse sobre a linha de uma conexão (ou olhe a linha, em tela sensível ao toque) para ver os botões de ação.

Para duplicar uma conexão, clique no botão **Duplicate** (duplicar), o ícone de cópia. Marinara faz uma cópia completa, inclusive da chave de API guardada. A cópia abre no editor para você renomear. Não existe etapa de confirmação.

Para excluir uma conexão só, clique no botão **Delete** (excluir) dela, o ícone de lixeira. Marinara mostra a janela **Delete Connection** com o texto Delete "your connection name"? This cannot be undone. Clique em **Delete** para confirmar.

Para excluir ou exportar várias conexões de uma vez, clique no botão **Select** (selecionar), no topo do painel. Isso liga o modo de seleção. Toque nas conexões que quiser e use o botão **Export** (exportar) ou **Delete** na barra de ações, embaixo. A exclusão em lote mostra a janela **Delete Connections** antes de remover as conexões.

<a id="the-random-pool-and-quick-connection-switcher"></a>

## O conjunto aleatório e o Quick Connection Switcher

O conjunto aleatório faz o chat escolher uma conexão diferente a cada resposta gerada. Isso ajuda quando você quer dividir as requisições entre vários provedores ou modelos.

Para colocar uma conexão no conjunto aleatório, clique no ícone de embaralhar na linha dela. A dica (o texto que aparece ao passar o mouse) diz **Add to random pool**. Com a conexão já no conjunto, a dica muda para **In random pool (click to remove)**. Clique no ícone de novo para tirar a conexão de lá.

Para o chat usar o conjunto aleatório, abra **Chat Settings** (configurações do chat), procure a seção **Connection** e escolha **🎲 Random** no menu suspenso. No Game Mode, esse menu suspenso se chama **GM / Party Model**. A partir daí, cada resposta sorteia uma conexão do conjunto.

Se a conexão sorteada para uma resposta falhar e você tiver definido uma conexão de reserva para **Main** (principal), a reserva escreve a resposta no lugar dela. Um aviso mostra a conexão que falhou, o modelo dela e um motivo curto, como "key rejected", "rate limited" ou "not found", para você saber qual conexão do conjunto precisa de conserto. A resposta fica com um pequeno rótulo **Fallback** (reserva); toque nele, ou aponte para ele, para ver a mesma linha de novo.

O **Quick Connection Switcher** é o jeito mais rápido de trocar a conexão do chat em que você está, e também o modelo dela. Clique no ícone de elo na área de digitação do chat para abrir. Ele mostra as conexões à esquerda e, à direita, os **Models** (modelos) da conexão escolhida:

- Clique em uma conexão para o chat atual passar a usá-la na hora. O menu continua aberto para você escolher em seguida um dos modelos dela.
- Clique em um modelo para usá-lo. O modelo é salvo na conexão, a conexão passa a ser a do chat, se ainda não era, e o menu fecha. Um sinal de visto marca o modelo que a conexão usa agora. Assim como no editor de conexão, escolher um modelo da lista também atualiza a janela de contexto da conexão e o limite de saída dela, quando o provedor informa esses valores.
- Digite na caixa **Search or enter model ID…** para filtrar a lista. Apertar Enter escolhe o modelo cujo ID ou nome você digitou, ou o único modelo que sobrou na lista. Para usar um modelo que não está na lista, digite o ID exato dele: aperte Enter quando nada na lista corresponder a esse ID, ou clique na linha **Use "…"**.
- Clique na estrela ao lado de um modelo para fixá-lo. Os modelos fixados ficam no topo, em **Pinned** (fixados), inclusive os que você digitou à mão. Clique na estrela de novo para desafixar o modelo.
- Na primeira vez que você abre os modelos de uma conexão, Marinara carrega a lista do provedor e salva essa lista com a conexão, então nas próximas vezes ela aparece na hora. Clique no botão de atualizar, ao lado da caixa de busca, para carregar a lista de novo, por exemplo depois que o provedor lançar modelos novos. Mudar a chave de API, a URL base ou o provedor da conexão também carrega uma lista nova.
- Se o provedor não tem lista de modelos ou não responde, o menu avisa, e você ainda pode digitar o ID de um modelo.
- Clique no botão de dado, no topo do menu, para ativar ou desativar o conjunto aleatório neste chat.
- Com o conjunto aleatório ativo, clicar em uma conexão passa a colocá-la no conjunto ou tirá-la de lá. Um sinal de visto mostra quais conexões estão no conjunto. A coluna **Models** fica oculta, porque o conjunto não tem uma conexão única.

No celular, toque na seta em forma de chevron ao lado da caixa de mensagem e abra a aba **Connections**. Toque em uma conexão para passar o chat para ela; o menu se fecha. Para escolher um modelo, toque na seta no fim da linha da conexão. Os modelos dela abrem no mesmo menu, e o chat só troca quando você escolhe um. Toque na seta de voltar para retornar à lista de conexões.

**A troca de modelo vale em todos os lugares em que a conexão é usada.** A nota no rodapé do menu, "Model changes are saved to this connection.", quer dizer que os agentes, os recursos auxiliares e os outros chats que usam a mesma conexão também passam para o modelo novo. As outras configurações de modelo da conexão, como o modelo de embedding ou a conexão de descrição de imagens, não mudam. Se você quer um modelo diferente só para uma finalidade, duplique a conexão e altere a cópia.

## Exportar e importar conexões

Exporte as conexões para um arquivo, seja para fazer backup, seja para levá-las a outra instalação, e importe esse arquivo depois.

**A exportação nunca inclui as chaves de API.** Depois de importar as conexões, abra cada uma e digite a chave de API de novo. Os modelos fixados vão junto; a lista de modelos salva não vai, então ela é carregada de novo na primeira vez que você abrir os modelos da conexão.

Para exportar uma conexão só, abra a conexão no editor e clique no botão **Export** dela, o ícone de upload. Para exportar várias de uma vez, use o modo **Select** no painel e clique em **Export** na barra de ações. Antes de o download começar, Marinara mostra a janela **Export Connection Data** com este aviso: This will export your connection data, WITHOUT your provided API Key. Remember to never share those with others! Clique em **Export** para seguir.

Uma conexão sozinha é baixada como um arquivo `.connection.json`. Várias conexões vêm juntas em um arquivo `marinara-connections.zip`.

Para importar conexões, clique no botão **Import** (importar), no topo do painel Connections. Abre a janela **Import Connections**. Solte um ou mais arquivos `.json` nela ou clique para procurar os arquivos. A janela lembra: Imported connections never include API keys. Add each key again after import. Depois da importação, cada conexão nova fica com a chave de API vazia até você preenchê-la.

## Guias relacionados

- [Conectando a um provedor de IA](connecting-to-a-provider.md)
- [Visão geral do painel Chat Settings](../chats/chat-settings.md)
