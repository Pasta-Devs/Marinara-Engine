# Personas do usuário: criar e editar

Este guia explica o que é uma persona, como criar e editar uma, e como importar, exportar, duplicar e excluir personas. A persona é o seu próprio card de personagem: a identidade que Marinara Engine usa para representar você no chat.

## O que é uma persona

A persona é quem você é dentro do chat, ou seja, o personagem que você interpreta. Ela tem um nome, uma descrição e outros detalhes opcionais. Marinara envia esses detalhes em todo prompt, o texto que Marinara manda para a IA, para que a IA saiba com quem está falando.

Crie quantas personas quiser e mantenha todas no painel **Personas** (personas). Escolha a persona de cada chat ou selecione **None** (nenhuma) para não usar persona. Este guia trata da criação e da edição de personas. Para escolher qual persona um chat usa, veja [Escolhendo a persona de um chat](choosing-your-persona.md).

### A macro {{user}}

A macro é um marcador dentro do texto que o aplicativo troca por um valor real antes de enviar o prompt. A macro **{{user}}** vira o nome da persona que o chat está usando. Essa é a persona selecionada para o chat. Por exemplo, se essa persona se chama Alex, **{{user}}** vira Alex no prompt.

Se o chat não tiver persona selecionada, a IA chama você pelo nome genérico "User", e Marinara não envia nenhum detalhe de persona. Para entender como o chat escolhe a persona, veja [Escolhendo a persona de um chat](choosing-your-persona.md). Para saber mais sobre macros, veja [Macros](../prompts/macros.md).

## O painel Personas

O painel **Personas** é a sua biblioteca de personas. Abra pelo ícone de pessoa na barra superior da barra lateral direita. Ele fica ao lado dos botões **Lorebooks**, **Presets**, **Connections** e **Agents**.

O painel traz estes controles:

- O botão **Download** (baixar) abre o [Card Browser](bot-browser.md), onde você também encontra personas no PlotLight.
- O botão **Open Library** (abrir a biblioteca) abre a Persona Library em página inteira, com layout responsivo. Ela usa o mesmo layout de grade com prévia da Character Library, com descrições da persona, seções do card, tags e estimativas de tokens.
- O botão **New** (novo) cria uma persona.
- O botão **Import** (importar) abre a janela **Import Persona**.
- O botão **Select** (selecionar) liga o modo de seleção em massa, para agir sobre várias personas de uma vez.
- A caixa de busca, com o texto de exemplo **Search personas**, procura no nome, na descrição, no comentário e nas tags.
- O menu suspenso de ordenação oferece **Manual order** (ordem manual), **A-Z**, **Z-A**, **Newest**, **Oldest** e **Tokens** (tamanho estimado do prompt). **Manual order** mantém a ordem que você definiu: arraste uma linha para cima ou para baixo, ou aperte Alt+Up ou Alt+Down em uma linha selecionada. Em uma tela sensível ao toque, mantenha uma linha pressionada para pegá-la.
- O botão **New Folder** (nova pasta) cria uma pasta para organizar as personas.
- A etiqueta **Tags** expande a lista de tags para filtrar.

Cada linha mostra o avatar, o nome e uma prévia curta da descrição da persona. Ao passar o mouse sobre uma linha, aparecem as ações **Duplicate** (duplicar) e **Delete** (excluir). Clique na linha para abrir a persona no **Persona Editor** (editor de personas) em página inteira.

Se houver mais personas do que cabe em uma página, um botão **Load more** (carregar mais) aparece embaixo. Quando ainda não existe nenhuma persona, o painel mostra uma mensagem curta: "No personas yet".

## Criar uma persona

1. Abra o painel **Personas**.
2. Clique em **New**. A janela **Create Persona** abre.
3. Digite um nome no campo **Name**. Esse é o único campo obrigatório.
4. Clique em **Create**.

A persona é criada com a descrição vazia. Ela abre na hora no **Persona Editor** completo, para você preencher o resto. Na janela de criação não é possível definir outros campos. Todo o restante é editado depois, no **Persona Editor**.

Depois de criar uma persona, selecione-a no chat em que quiser usá-la.

## O Persona Editor

Ao abrir uma persona, o **Persona Editor** em página inteira ocupa o lugar da área do chat. O cabeçalho tem:

- Uma seta **Back** (voltar) para fechar o editor.
- O quadro do avatar. Clique nele para fazer upload de um novo avatar. Se você tiver uma conexão de geração de imagens configurada, aparece aqui também um botão de varinha **Generate avatar** (gerar avatar).
- O campo de nome e um campo de comentário (para uma anotação curta, como "Modern AU version").
- Um botão **Save** (salvar). Ele fica esmaecido até você fazer alguma mudança.
- Ações em ícone no cabeçalho: **Export persona** (exportar a persona), **Add persona as character** (adicionar a persona como personagem), **Duplicate persona** (duplicar a persona) e **Delete persona** (excluir a persona).

Se você tentar sair com mudanças não salvas, aparece um aviso: "You have unsaved changes. Close without saving?". Ele oferece **Keep editing**, **Discard & close** e **Save & close**.

O corpo do editor tem uma fileira de abas, nesta ordem: **Metadata**, **Card**, **Convo**, **Lorebook**, **Sprites**, **Gallery**, **Colors** e **Stats**.

### Aba Metadata

A aba **Metadata** guarda as informações de identidade e de biblioteca:

- Uma linha **Persona ID** com um botão **Copy** (copiar). Quase ninguém precisa disso. É útil em pedidos de suporte.
- O widget de recorte do avatar. Arraste para reposicionar ou aplicar zoom no recorte redondo do avatar.
- **Name**: o nome de exibição da persona. Marinara insere esse nome nos prompts como a sua identidade.
- **Creator**: quem criou esta persona, para dar o crédito quando você compartilhá-la.
- **Phonetic name**: uma pronúncia alternativa, opcional. Só é usada quando o nome da persona é lido em voz alta pelo Text to Speech (TTS), o recurso do aplicativo que converte texto em voz.
- **Title / Comment**: uma anotação curta e privada, mostrada abaixo do nome na biblioteca.
- **Version**: um texto livre de versão para acompanhar as suas mudanças. O padrão é **1.0**.
- **Tags**: etiquetas de texto livre. Pressione Enter ou clique em **Add** para adicionar uma. Um botão **Remove All** aparece assim que houver tags. As tags servem para filtrar no painel **Personas**.
- **Creator Notes**: uma anotação privada de várias linhas. Marinara não envia esse texto para a IA.

O painel **Version history** (histórico de versões) fica abaixo do campo **Version**. A seção "Histórico de versões", mais adiante, explica como ele funciona.

### Aba Card

Na aba **Card** você escreve os campos principais da persona. Cada campo é uma caixa de texto grande, com uma contagem estimada de tokens ao vivo logo abaixo. Uma barra de atalhos leva você direto a cada seção.

- **Description**: a sua identidade e o seu papel em termos gerais. Isso vai em todo prompt, para a IA saber quem você é.
- **Personality**: o seu temperamento, o seu comportamento, os seus jeitos de falar e os seus padrões emocionais.
- **Backstory**: a sua história, a sua origem, as suas relações e os acontecimentos que marcaram você.
- **Appearance**: descrição física, roupas e detalhes visuais que o modelo deve lembrar.
- **Image Appearance Override** (aparência alternativa para imagens): um botão liga/desliga opcional abaixo de **Appearance**, desativado por padrão. Ative para mostrar um segundo campo para tags curtas de imagem que descrevem a sua persona, como a palavra-gatilho de uma LoRA. Quando a opção está ativada e o campo contém texto, os prompts de imagem usam essas tags exatamente como estão escritas, com **Appearance** mantido como contexto. O narrador sempre recebe o texto completo de **Appearance**.
- **Scenario**: a situação ou o contexto padrão para os roleplays. Use esse campo para dizer onde a persona começa.

Essas caixas de texto aceitam macros. Marinara formata automaticamente as aspas que você digita conforme o estilo de aspas do aplicativo.

### Aba Convo

A aba **Convo** guarda campos que valem só no Conversation Mode. Eles nunca são enviados nos modos Roleplay e Game. São eles: **Convo Display Name**, **About Me** e **Convo Behavior**. Como esses campos são compartilhados com os personagens, eles têm um guia próprio. Veja [Perfis do Conversation Mode](../conversation/profiles.md).

### Aba Lorebook

A aba **Lorebook** permite anexar entradas de lorebook à persona. O lorebook é um conjunto de fatos do seu mundo, organizados em entradas que acrescentam contexto extra quando são relevantes. As entradas ligadas a uma persona podem ser acionadas quando essa persona está no chat. Veja [Visão geral dos lorebooks](../lorebooks/overview.md).

### Aba Sprites

Na aba **Sprites** você faz upload das artes de corpo inteiro da persona. Os sprites, as imagens do personagem no palco, são usados no Game Mode e no Roleplay. A aba tem categorias próprias: **Facial Expressions**, **Full-body** e **Clips**. Faça upload de uma imagem por vez ou use **Upload Folder** para importar em massa uma pasta de imagens PNG. Como os sprites são um sistema compartilhado, veja [Sprites de personagem](sprites.md) para todos os detalhes.

### Aba Gallery

A aba **Gallery** guarda artes de referência e vídeos anexados à persona. Ela tem duas subabas, **Images** e **Videos**. Use **Upload Persona Images** ou **Upload Persona Videos** para adicionar arquivos. A subaba **Videos** também cuida dos clipes de videochamada usados no recurso de chamada do Conversation Mode. Veja [Galerias de personagem e de persona](galleries.md).

### Aba Colors

A aba **Colors** define a aparência da persona no chat. As cores valem para o seu nome, para as suas falas e para o balão das suas mensagens.

- O botão **Extract Colors from Avatar** (extrair cores do avatar) escolhe as cores automaticamente a partir da imagem do avatar. Ele fica esmaecido, com o texto "Upload an avatar first", enquanto não houver avatar.
- O campo **Name Display Color** define a cor do nome da persona. Ele aceita gradientes CSS.
- O campo **Dialogue Highlight Color** define a cor do texto entre aspas.
- O campo **Message Box Color** define a cor de fundo do balão de mensagem da persona.

Deixe qualquer um desses campos em branco para usar as cores padrão do tema do aplicativo. Para um passo a passo mais completo de cores e stats, veja [Cores do personagem e status de RPG](colors-and-stats.md).

### Aba Stats

A aba **Stats** tem dois blocos separados. Os dois alimentam o painel de status na tela (HUD), a faixa de informações no topo do chat.

- O botão **Enable Persona Stats** liga as barras de status para necessidades como fome, energia e humor. Ao ativar do zero, você recebe as barras iniciais Satiety, Energy, Hygiene e Mood, cada uma em 100 de 100. O agente **Persona Stats** ajusta esses valores conforme a história avança.
- O botão **Enable RPG Attributes** liga os Pools e os atributos no estilo RPG. Ao ativar do zero, você recebe os Pools iniciais HP e MP em 100 de 100 e os atributos iniciais STR, DEX, CON, INT, WIS e CHA, cada um em 10. Esses valores são enviados com o card da persona para o combate e o Game Mode, e para as rolagens opcionais no Roleplay ou no Game Mode. Os agentes de tracker não os atualizam.

Quando há um conjunto de regras de Game Mode instalado, ou a persona ainda guarda uma ficha de um conjunto que você não tem mais, um bloco **Ruleset sheets** (fichas de conjuntos de regras) aparece abaixo desses dois. Ele guarda a configuração inicial da sua persona para cada conjunto de regras, que uma partida nova com esse conjunto copia. Veja [Fichas de conjuntos de regras](colors-and-stats.md#ruleset-sheets).

Os valores definidos aqui são o ponto de partida dos chats novos. As barras de status da persona podem se atualizar sozinhas quando o agente Persona Stats está ativado; os Pools e os atributos de RPG da persona não são gerenciados por agentes. Para a explicação completa, veja [Cores do personagem e status de RPG](colors-and-stats.md).

## Histórico de versões

Toda vez que você salva uma mudança nos campos do card de uma persona, Marinara salva um instantâneo automaticamente. O painel **Version history**, na aba **Metadata**, lista essas versões salvas com data e hora.

Em cada versão salva você pode:

1. Clicar no título dela para abrir uma comparação com a persona atual.
2. Clicar em **Rename this saved version** (ícone de lápis) para corrigir o rótulo de versão do card sem restaurá-la.
3. Clicar em **Restore this version** para sobrescrever a persona atual com aquela versão salva. Uma caixa de diálogo pede a sua confirmação.
4. Clicar em **Delete this saved version** para tirar aquela entrada do histórico. Isso não muda a persona atual.

Antes da sua primeira edição, o painel mostra "Previous persona states will appear here after the next edit.".

Use o botão **Reset** no cabeçalho do painel para excluir todos os instantâneos salvos da persona e voltar a versão atual do card para `0.0`. Marinara pede confirmação, porque o histórico excluído não pode ser recuperado.

## Duplicar uma persona

Clique em **Duplicate** na linha da persona ou no ícone **Duplicate persona**, no cabeçalho do **Persona Editor**. Isso cria uma cópia completa da persona, com o nome "{nome original} (Copy)". A cópia leva junto todos os campos do card, as cores, os stats e os campos de Convo. Duplicar uma persona não muda a persona selecionada em nenhum chat.

## Excluir personas

Para excluir uma persona, clique no ícone de lixeira na linha dela ou no ícone **Delete persona**, no cabeçalho do **Persona Editor**. Aparece uma caixa de diálogo de confirmação. A exclusão de uma persona não pode ser desfeita.

Para excluir várias de uma vez, clique em **Select** no painel **Personas** e marque as personas desejadas. Depois, use a barra de seleção para excluí-las com **Delete**. Se alguma exclusão falhar, os itens que falharam continuam selecionados, para você tentar de novo.

## Importar e exportar personas

### Importação

Clique em **Import** no painel **Personas** para abrir a janela **Import Persona**. Arraste os arquivos para lá ou clique para procurar. Vários arquivos podem ser importados de uma vez. A janela aceita dois tipos de arquivo:

- Arquivos de pacote nativo **.marinara**. Eles restauram todos os detalhes da persona, os sprites e a estrutura da galeria.
- Arquivos **.json**. Uma exportação JSON do Marinara é importada por completo. Um arquivo JSON genérico, vindo de outra ferramenta, é mapeado campo a campo para uma persona nova. O nome é obrigatório. Os outros campos reconhecidos entram junto quando existem.

Cada arquivo mostra um ícone de sucesso ou de falha e uma mensagem. Uma linha de resumo indica quantos deram certo e quantos falharam.

### Exportação

A exportação sai do ícone **Export persona**, dentro do **Persona Editor**, ou da ação em massa **Export**, no modo de seleção do painel. A janela **Export Persona** oferece dois formatos:

- **Marinara Native**: mantém todos os detalhes da persona no Marinara, os sprites e os lorebooks anexados. Use este formato para levar uma persona de uma instalação do Marinara para outra.
- **Compatible JSON**: exporta só os campos simples da persona. Use este formato em outras ferramentas, que não entendem o formato do Marinara.

A exportação em massa baixa um único arquivo zip, com um arquivo por persona selecionada.

## Adicionar a persona como personagem

O cabeçalho do **Persona Editor** tem um ícone **Add persona as character**. Ele cria um card de personagem novo na biblioteca Characters. O card novo copia o nome, a descrição, a personalidade, o cenário, a história de fundo, a aparência, as tags, o criador, a versão e o avatar da persona.

Isso é útil quando você quer jogar com uma antiga persona no papel de personagem. A persona original não é excluída nem alterada. Para aprender a editar personagens, veja [Criando e editando personagens](creating-and-editing-characters.md).

## Guias relacionados

- [Escolhendo a persona de um chat](choosing-your-persona.md)
- [Cores do personagem e status de RPG](colors-and-stats.md)
- [Criando e editando personagens](creating-and-editing-characters.md)
- [Perfis do Conversation Mode](../conversation/profiles.md)
- [Macros](../prompts/macros.md)
