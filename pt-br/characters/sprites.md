# Sprites de personagem (expressões e corpo inteiro)

Neste guia você aprende a adicionar arte de personagem, chamada de sprite, e a gerar essa arte com IA. Também vai ver como limpar o plano de fundo e controlar a forma como os sprites aparecem na tela. Os sprites funcionam no Roleplay Mode e no Game Mode.

## O que são sprites

O sprite é a arte do personagem em pé: uma imagem do personagem que Marinara Engine mostra flutuando sobre a cena do chat. Marinara usa dois tipos de sprite:

- **Facial Expressions** (expressões faciais): retratos para diferentes humores, como feliz, triste ou bravo.
- **Full-body** (corpo inteiro): imagens do corpo todo para diferentes poses, como parado, andando ou em posição de combate.

Os sprites só aparecem na tela no **Roleplay Mode** e no **Game Mode**. Chats simples no Conversation Mode não mostram a arte do sprite. Ainda assim, o upload pode ser feito em qualquer modo, porque o personagem guarda os sprites dele independentemente do chat que o usa.

Os sprites são adicionados por personagem. Outra opção: adicionar sprites a uma persona, o personagem que representa você. O editor de persona tem a mesma aba **Sprites** descrita abaixo.

## Onde fica a aba Sprites

Os sprites são gerenciados dentro do editor de personagem (ou de persona).

1. Abra um personagem para editá-lo.
2. Clique na aba **Sprites** dentro do editor.
3. No topo da aba, escolha uma categoria: **Facial Expressions**, **Full-body** ou **Clips**.

Este guia explica as categorias **Facial Expressions** e **Full-body**. A categoria **Clips** é um recurso separado, usado em chamadas de voz e de vídeo. Sobre os clipes, veja [Chamadas de áudio e vídeo no Conversation Mode](../conversation/calls.md).

## Upload dos seus próprios sprites

Você pode fazer upload da arte que já tem. Marinara aceita os arquivos de imagem mais comuns. Arquivos PNG com transparência dão o melhor resultado, porque a área vazia em volta do personagem continua transparente sobre a cena.

### Upload de um sprite

1. Abra a aba **Sprites** e escolha **Facial Expressions** ou **Full-body**.
2. Na caixa **Add Sprite** (adicionar sprite), digite um nome no campo de texto. Para expressões, o texto de exemplo mostra "Expression name (e.g. happy, sad, angry)". Para poses, mostra "Pose name (e.g. idle, walk, battle_stance)".
3. Clique em **Upload** e escolha um arquivo de imagem.

O novo sprite aparece na grade abaixo, com o nome que você deu.

### Adição rápida das expressões mais comuns

Na categoria **Facial Expressions**, a linha **Quick add** (adição rápida) mostra nomes de expressão sugeridos que você ainda não usou, como feliz ou bravo. Clique em um deles para abrir o seletor de arquivos já com esse nome preenchido. Assim você não precisa digitar o nome.

### Upload de uma pasta inteira de uma vez

Se você tem muitos sprites em uma pasta, importe todos em uma única etapa.

1. Dê aos arquivos de imagem o nome da expressão ou da pose. Por exemplo, um arquivo chamado `admiration.png` cria uma expressão chamada admiration.
2. Na caixa **Add Sprite**, clique em **Upload Folder**.
3. Escolha a pasta com as imagens.

O nome de cada arquivo, sem a extensão, vira o nome do sprite. Enquanto o processo roda, aparece a linha de progresso "Uploading X/Y sprites".

Para criar várias versões da mesma expressão, use um nome comum antes do sublinhado. Por exemplo, `happy_01.png` e `happy_blush.png` contam como variantes de happy.

### Gerenciar um sprite

Passe o mouse sobre um card de sprite na grade para ver as ações disponíveis:

- **Frame** (enquadrar): corta a imagem para deixar o personagem na posição que você quiser.
- **Download**: salva o arquivo do sprite no seu computador.
- **Replace** (substituir): faz upload de uma nova imagem com o mesmo nome.
- **Delete** (excluir): remove aquele sprite.

Ao excluir, Marinara pede confirmação com a mensagem "Delete sprite for" e o nome. Quando há mais de um sprite visível, a mesma janela também oferece **Delete All Expressions** ou **Delete All Full-Body**.

## Gerar sprites com IA

Com uma conexão de imagem configurada, Marinara desenha os sprites para você. A conexão é o vínculo entre Marinara e um serviço de IA. Para gerar sprites você precisa de uma conexão de imagem; para sprites animados, de uma conexão de vídeo. Para configurar uma, veja [Conectando a um provedor de IA](../connections/connecting-to-a-provider.md).

Para começar, clique em **Generate Sprite** na caixa **Add Sprite**. Isso abre a janela **Generate Sprites**. No topo você escolhe a origem: **Expressions (Portrait)** ou **Full-body**.

Preencha a janela:

1. Escolha uma **Image Generation Connection** (conexão de geração de imagens) no menu suspenso.
2. Adicione até quatro **Reference Images** (imagens de referência) se quiser que a arte siga um visual específico. Você também pode marcar a caixa para usar o avatar atual como referência.
3. Escreva uma **Appearance Description** (descrição da aparência) do personagem. Esse campo é obrigatório.
4. Se quiser, ative a opção **Transparent sprite background**. Marinara pede primeiro a transparência PNG nativa. Se o provedor não conseguir devolver o canal alfa, Marinara escolhe um fundo saturado em verde, magenta ou ciano, aquele que menos se sobrepõe às cores da **Appearance Description**, e depois remove esse fundo automaticamente.
5. Defina quantas imagens quer criar em **Expression Count** (ou **Pose Count**, no caso do corpo inteiro) e escolha quais expressões ou poses preencher.
6. Clique no botão **Generate**.

Quando as imagens ficam prontas, você faz a revisão. Cada uma pode ser ativada ou desativada, renomeada e cortada antes de salvar. Quando o resultado agradar, salve as imagens selecionadas no conjunto de sprites do personagem.

Na origem **Full-body**, se o personagem já tiver expressões em retrato, marque **Match existing expression sprites**. Isso cria poses de corpo inteiro correspondentes a cada nome de expressão que você já tem.

Duas observações sobre a geração com IA:

- A geração pode levar alguns minutos, mesmo que o texto dentro do aplicativo sugira menos tempo. Serviços de IA lentos demoram mais. Espere em vez de começar de novo.
- Em alguns dispositivos, como certas instalações Android, a geração de sprites com IA e a limpeza do plano de fundo não estão disponíveis. Nesse caso, o botão fica desativado e Marinara mostra o motivo na tela.

### Sprites de retrato animados

Na origem **Expressions (Portrait)** existe uma caixa de seleção chamada **Generate animated portraits**. Com ela ativada, Marinara cria clipes curtos em movimento no lugar de imagens paradas e transforma cada clipe em um sprite GIF em loop. O GIF é um arquivo de imagem que reproduz uma animação curta. Os retratos animados usam uma conexão de vídeo, não uma conexão de imagem.

## Limpar o plano de fundo dos sprites

O sprite fica melhor quando só o personagem aparece e o plano de fundo é transparente. Os sprites estáticos gerados usam transparência nativa quando o provedor tem suporte a ela. Caso contrário, Marinara remove um fundo chroma uniforme e adaptativo, com borda suave, e limpa a cor dele do cabelo, do tecido e de outros pixels parcialmente transparentes. Sprites antigos com fundo branco continuam com suporte.

### Limpar um sprite manualmente

Clique na imagem de um sprite na grade para abrir o editor de limpeza. Lá você apaga o plano de fundo, pinta áreas de volta e confere o resultado sobre fundos escuro, claro e xadrez. Também é possível desfazer, voltar ao original e aplicar as alterações no fim.

### Limpar vários sprites de uma vez

O botão **Clean Backgrounds** remove o plano de fundo de todos os sprites visíveis na grade.

1. Ajuste o controle deslizante **Cleanup strength** (intensidade da limpeza). Ele vai de Soft a Aggressive, de 0 a 100, e começa em 35. Um valor maior remove mais do plano de fundo, mas pode comer parte do personagem.
2. Clique em **Clean Backgrounds** e confirme.

Depois de uma limpeza em lote, Marinara salva uma cópia de proteção. Aparece a linha "Last cleanup has a restore point" com o botão **Undo Cleanup**. Clique nele para devolver cada sprite afetado ao estado anterior.

A limpeza do plano de fundo funciona em imagens PNG, JPG, JPEG, WEBP e AVIF. Não funciona em arquivos GIF ou SVG.

A limpeza automática analisa a imagem antes de escolher o motor. A limpeza de fundo integrada e rápida cuida primeiro do chroma uniforme e dos fundos brancos antigos. Se a borda não for realmente uniforme, Marinara pode recorrer ao removedor de fundo por IA, que é opcional, quando ele está instalado. O editor de limpeza manual continua sendo a opção mais segura para uma cena cheia de elementos ou para um personagem com cores quase idênticas às do plano de fundo.

## Exportar sprites

Os sprites de um personagem podem ser salvos no seu computador como um arquivo zip. O zip é um único arquivo que guarda vários arquivos juntos.

1. Abra a aba **Sprites**.
2. Clique em **Export** na caixa **Add Sprite**.
3. Escolha **Expressions only** ou **Full-body only** para exportar a categoria atual, ou **All sprites** para exportar tudo.

O download é uma pasta com o nome do personagem, contendo os arquivos de imagem dos sprites.

## Como os sprites aparecem no chat

Fazer o upload dos sprites é só metade do trabalho. Você também decide quando e como eles aparecem durante o chat. Isso é definido nas configurações do chat, não no editor de personagem.

### Roleplay Mode

No **Roleplay Mode**, o agente opcional **Expression Engine** comanda a exibição dos sprites. Baixe o agente em **Agents → Agent Organizer (organizador de agentes)** e depois adicione-o ao chat. Ele lê o humor de cada mensagem e escolhe o sprite de expressão correspondente. Para detalhes, veja [Referência dos agentes para download](../agents/built-in-agents.md).

Para os sprites aparecerem em um chat de Roleplay, tudo isto precisa ser verdade:

- O agente **Expression Engine** está ativado para o chat.
- Pelo menos um personagem ou a persona ativa está escolhido como dono dos sprites.
- Pelo menos uma origem de sprite está ativada.

Abra as configurações do chat e localize o card do agente **Expression Engine**. É ali que você controla a exibição dos sprites:

- **Sprite Source** (origem do sprite): escolha **Expressions**, **Full-body** ou as duas. As duas ficam ativadas por padrão. Pelo menos uma precisa continuar ativada.
- **Expression Avatars**: substitui o pequeno avatar da mensagem pelo sprite de expressão correspondente, em vez de mostrar uma sobreposição flutuante. Vem desativado por padrão e existe só no Roleplay Mode.

### Game Mode

No **Game Mode**, o sprite de corpo inteiro aparece automaticamente para o personagem que está falando ou lutando. Aqui o agente Expression Engine não é necessário. Basta ter sprites de corpo inteiro enviados para aquele personagem. Sobre a configuração geral do Game Mode, veja [Game Mode: primeiros passos](../game/getting-started.md).

### Mover e redimensionar sprites (modo Arrange)

Assim que um dono de sprites está ativado, o card do agente **Expression Engine** mostra a seção **Sprite Layout** (disposição dos sprites).

- Clique em **Arrange** para entrar no modo de arrastar e leve cada sprite para onde quiser. Clique em **Done** ao terminar.
- O botão **Reset** limpa as posições personalizadas e volta à disposição automática.
- A opção **Default Side** define se os novos sprites ficam mais para a **Left** ou para a **Right**. O padrão é Left. Mudar o lado inverte a disposição atual.
- Quatro controles deslizantes definem tamanho e transparência: **Expression Size** e **Full-body Size** vão de 5% a 200%. **Expression Opacity** e **Full-body Opacity** vão de 15% a 100%. Todos começam em 100%.

## Clipes de chamada de vídeo

A categoria **Clips** da aba **Sprites** é um recurso diferente. Ela cria vídeos curtos em loop que funcionam como a câmera do personagem durante uma chamada de voz ou de vídeo no Conversation Mode. Como pertence ao recurso de chamadas, está documentada à parte. Veja [Chamadas de áudio e vídeo no Conversation Mode](../conversation/calls.md).

## Guias relacionados

- [Criando e editando personagens](creating-and-editing-characters.md)
- [Roleplay Mode: primeiros passos](../roleplay/getting-started.md)
- [Game Mode: primeiros passos](../game/getting-started.md)
- [Chamadas de áudio e vídeo no Conversation Mode](../conversation/calls.md)
- [Expressões animadas](../media/animated-expressions.md)
- [Referência dos agentes para download](../agents/built-in-agents.md)
