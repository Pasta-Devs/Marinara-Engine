# Exportar e importar chats

Salve um chat em um arquivo, compartilhe-o como uma história legível ou carregue de volta um arquivo de chat do Marinara ou do SillyTavern (outro aplicativo de chat para roleplay). Você pode exportar um chat, parte de um chat ou vários chats de uma vez.

<a id="file-formats-you-will-see"></a>

## Formatos de arquivo que você vai encontrar

| Formato | O que é | Dá para importar de volta? |
| --- | --- | --- |
| **JSONL** | JSON Lines, um arquivo de texto simples com uma mensagem por linha. O formato padrão. | Sim |
| **Text** | Uma transcrição `.txt` legível. | Não |
| **Markdown** | Um arquivo `.md` legível. Ele começa com o nome do chat e as datas que ele abrange, e depois traz cada mensagem abaixo do nome de quem a enviou. | Não |
| **Story** | Uma página web `.html` estilizada, com o nome e o avatar de quem envia cada mensagem. Abra o arquivo em um navegador para ler, compartilhar ou imprimir. | Não |

Os arquivos **Markdown** e **Story** deixam de fora as mensagens de sistema e as mensagens ocultas para você. A importação de chat aceita apenas `.jsonl`, então exporte em **JSONL** se você quiser importar o chat depois.

Um arquivo **JSONL** deixa de fora alguns endereços salvos com o chat: o webhook do espelhamento no Discord, o endereço do DeepLX, a chave do DeepL e o endereço do Intiface. A importação também nunca os traz. Se você usa esses dados, digite-os de novo no painel **Chat Settings** (configurações do chat) do chat importado.

## Exportar um único chat

1. Abra o chat.
2. Abra **Chat Settings** e expanda **Chat Branches** (ramificações do chat), abaixo de **Chat Name** (nome do chat). Os botões de exportação ficam nesta seção mesmo que o chat tenha só uma ramificação.
3. Toque em **JSONL**, **Text**, **Markdown** ou **Story**.

O navegador baixa o arquivo. Ele contém a ramificação que você está vendo, com as mensagens dela.

<a id="export-part-of-a-chat"></a>

## Exportar parte de um chat

Use **Export a range** (exportar um intervalo) para salvar só algumas mensagens. Essa opção não está disponível em chats de Game.

1. Em **Chat Branches**, clique em **Export a range**.
2. Clique na primeira mensagem e depois na última. Uma dica diz "Select the first and last message to export."
3. Clique em **Export selected** (exportar selecionadas).
4. Na janela **Export messages** (exportar mensagens), confira a contagem de mensagens e a primeira e a última mensagem, e depois escolha **Text**, **Markdown**, **JSONL** ou **Story**.

Marinara exporta todas as mensagens, da primeira à última que você escolheu. Clique em **Cancel** (cancelar) para parar sem exportar.

## Exportar vários chats de uma vez

1. Na barra lateral esquerda, clique na aba do modo que você quer: **CONVO**, **RP** ou **GM**. Cada aba exporta somente os próprios chats.
2. Clique em **Select chats** (selecionar chats), no topo da lista.
3. Clique em cada chat que você quer. Uma barra na parte de baixo mostra a contagem, por exemplo "3 selected".
4. Clique em **Export** (exportar) na barra.

O navegador baixa um arquivo `.zip` com uma transcrição em JSONL por chat. A exportação em massa sempre usa **JSONL**. Veja [Como gerenciar a lista de chats](managing-chats.md#selecting-multiple-chats).

## Importar um chat como um chat novo

Isso cria um chat novo a partir de um arquivo `.jsonl` salvo pelo Marinara ou exportado do SillyTavern.

1. Na barra lateral esquerda, clique na aba do modo que você quer. O chat importado usa o modo da aba que está aberta, não o modo que está no arquivo.
2. Clique no botão **Import** (importar), ao lado do botão **+**. O rótulo dele é **Import SillyTavern or Marinara chat JSONL**.
3. Escolha o seu arquivo `.jsonl`.

Aparece a mensagem "Imported N messages", e Marinara abre o chat novo. Para mais detalhes sobre arquivos do SillyTavern, veja [Importar do SillyTavern](../data/importing-from-sillytavern.md).

Se não funcionou: uma pequena mensagem na parte de baixo da tela diz **Import failed** (a importação falhou), com o motivo. Confira se o arquivo termina em `.jsonl`.

## Importar um chat como uma nova ramificação

Isso carrega um arquivo `.jsonl` em um chat que você já tem, como uma nova ramificação. Veja [Ramificações de chat](branches.md).

1. Abra o chat que vai receber a ramificação.
2. Abra **Chat Settings**, expanda **Chat Branches** e clique em **Import**.
3. Escolha o seu arquivo `.jsonl`.

Aparece a mensagem "Imported N messages as a new branch". A ramificação reaproveita os personagens, a persona, a conexão e o preset de prompt do chat aberto.

## Incluir o raciocínio e as notas privadas nas exportações

Duas configurações decidem se o texto oculto vai para os arquivos exportados. As duas são botões liga/desliga em **Settings → Advanced → Message Tools** (Configurações → Avançado → Ferramentas de mensagem), e as duas vêm desativadas por padrão. Elas valem para a exportação de um único chat e para a exportação em `.zip`.

| Configuração | Quando está ativada |
| --- | --- |
| **Include reasoning in exports** (incluir o raciocínio nas exportações) | Acrescenta o pensamento salvo do modelo a todos os formatos. Nos arquivos **Markdown** e **Story**, ele fica em uma seção recolhível **Thinking** (pensamento), abaixo da mensagem. |
| **Include private notes in exports** (incluir as notas privadas nas exportações) | Acrescenta as suas notas privadas de mensagem às exportações em **JSONL** e **Text**. |

> **Aviso:** deixe as duas desativadas antes de compartilhar uma transcrição. O raciocínio oculto e as notas privadas podem conter coisas que você não pretendia enviar.
