# Exportar e importar chats

Neste guia você aprende a salvar um chat em um arquivo e a carregar um chat de volta no Marinara Engine. A exportação funciona com um chat só ou com vários de uma vez. Também é possível importar um arquivo de chat vindo do Marinara ou do SillyTavern (outro aplicativo de chat para roleplay).

## Formatos de arquivo que você vai encontrar

Marinara usa dois formatos de arquivo de chat.

- **JSONL**: JSONL quer dizer JSON Lines. É um arquivo de texto simples que salva uma mensagem por linha. Esse é o formato de exportação padrão. Um arquivo JSONL pode ser importado de volta no Marinara depois.
- **Text**: uma transcrição em `.txt`, simples e fácil de ler. Serve bem para leitura e compartilhamento, mas Marinara não consegue importar esse formato de volta. Use **Text** só quando a ideia for uma pessoa ler o chat.

A importação de chat aceita apenas arquivos `.jsonl`. Se você pretende importar o chat de novo mais tarde, exporte em **JSONL**, não em **Text**.

## Exportar um único chat

Para exportar um chat para um arquivo, use a seção **Chat Branches** de **Chat Settings** (ramificações do chat). Esse é o caminho mais rápido para exportar o histórico de uma conversa específica.

1. Abra o chat que você quer exportar.
2. Abra **Chat Settings** e expanda **Chat Branches**, abaixo de **Chat Name**.
3. Clique em **JSONL** para salvar o chat como arquivo JSONL, ou clique em **Text** para salvar como arquivo de texto legível.
4. O navegador baixa o arquivo.

O download salva o chat que está aberto no momento, com as mensagens dele.

## Exportar vários chats de uma vez

Você pode selecionar vários chats e baixar todos juntos em um único arquivo `.zip`.

1. Abra a lista de chats na barra lateral esquerda.
2. Escolha a aba de modo que você quer: **CONVO** (Conversation), **RP** (Roleplay) ou **GM** (Game). Cada aba exporta somente os próprios chats.
3. Clique no botão **Select chats** (selecionar chats), no topo da lista de chats.
4. Clique em cada chat que você quer incluir. Uma caixa de seleção é marcada para cada um.
5. Aparece uma barra na parte de baixo com a contagem, por exemplo "3 selected".
6. Clique em **Export** nessa barra.
7. O navegador baixa um arquivo `.zip` com as transcrições em JSONL, um arquivo por chat.

A exportação em massa sempre usa o formato **JSONL**. Clique em **Delete** na mesma barra apenas se a intenção for excluir os chats selecionados.

## Importar um chat como um chat novo

Isso cria um chat totalmente novo a partir de um arquivo `.jsonl`. Use essa opção para importar arquivos de chat salvos pelo Marinara ou exportados do SillyTavern.

1. Abra a lista de chats na barra lateral esquerda.
2. Escolha a aba de modo que você quer: **CONVO**, **RP** ou **GM**. Marinara cria o chat importado na aba que estiver aberta naquele momento.
3. Clique no botão de importar, ao lado do botão **New**, no topo da lista. A dica dele diz **Import SillyTavern or Marinara chat JSONL**.
4. Escolha o arquivo `.jsonl` no seletor de arquivos.
5. Aparece uma mensagem dizendo "Imported N messages", e Marinara leva você direto para o chat novo.

Se você quer o chat novo no Roleplay Mode, abra a aba **RP** antes de importar. Quem define o modo é a aba aberta, não o arquivo.

## Importar um chat como uma nova ramificação

Também é possível carregar um arquivo `.jsonl` dentro de um chat existente como uma nova ramificação. Uma ramificação é uma cópia separada e salva do chat, que você explora por conta própria. Veja [Ramificações de chat](branches.md) para saber mais sobre ramificações.

1. Abra o chat em que você quer adicionar a ramificação.
2. Abra **Chat Settings** e expanda **Chat Branches**, abaixo de **Chat Name**.
3. Clique em **Import** nessa seção.
4. Escolha o arquivo `.jsonl`.
5. Aparece uma mensagem dizendo "Imported N messages as a new branch".

A nova ramificação entra no chat aberto. Ela reaproveita os personagens, a persona, a conexão e o preset de prompt do chat aberto.

## Incluir o raciocínio nas exportações

Alguns modelos salvam junto da resposta um texto oculto de pensamento ou raciocínio. Uma configuração decide se esse texto oculto vai ou não para os arquivos exportados.

A configuração é **Include reasoning in exports** (incluir o raciocínio nas exportações). Ela fica em **Settings** (Configurações), na aba **Advanced**, na seção **Message Tools**. É um botão liga/desliga, desativado por padrão.

- Com a opção **off**, Marinara deixa o pensamento e o raciocínio salvos de fora tanto das exportações em **JSONL** quanto das em **Text**.
- Com a opção **on**, Marinara acrescenta esse texto oculto de pensamento e raciocínio aos dois formatos.

Essa configuração vale tanto para a exportação de um único chat quanto para a exportação em massa em `.zip`.

Deixe **Include reasoning in exports** desativado antes de compartilhar uma transcrição com outra pessoa. O raciocínio oculto pode conter anotações que você não pretendia enviar junto. Ative a opção só quando quiser um registro completo para uso próprio.

## Guias relacionados

- [Ramificações de chat](branches.md)
- [Importando do SillyTavern](../data/importing-from-sillytavern.md)
- [Fazer backup e restaurar Marinara](../data/backup-and-restore.md)
- [Visão geral das configurações](../settings/settings-overview.md)
