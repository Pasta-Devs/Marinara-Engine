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

Você pode fazer upload de imagens PNG, JPEG, GIF, WebP, AVIF e SVG passivas. Arquivos PNG com transparência dão o melhor resultado, porque a área vazia em volta do personagem continua transparente sobre a cena. Imagens de substituição não compatíveis ou inválidas são recusadas sem remover o sprite salvo.

### Upload de um sprite

1. Abra a aba **Sprites** e escolha **Facial Expressions** ou **Full-body**.
2. Clique em **Add sprites** (adicionar sprites) e depois em **Upload images** (fazer upload de imagens). Você pode selecionar várias imagens juntas.
3. O nome de cada arquivo vira o rótulo inicial do sprite. Abra um sprite para renomeá-lo depois.

Os novos sprites aparecem soltos na grade normal. No editor de persona, use o campo de nome da caixa **Add Sprite** (adicionar sprite) e o botão **Upload** de sempre para um único sprite.

### Upload de uma pasta inteira de uma vez

Se você tem muitos sprites em uma pasta, importe todos em uma única etapa.

1. Dê aos arquivos de imagem o nome da expressão ou da pose. Por exemplo, um arquivo chamado `admiration.png` cria uma expressão chamada admiration.
2. Abra **Add sprites** e clique em **Import folder** (importar pasta). No editor de persona, clique em **Upload Folder** dentro de **Add Sprite**.
3. Escolha a pasta com as imagens.

O nome de cada arquivo, sem a extensão, vira o nome do sprite. Enquanto o processo roda, aparece a linha de progresso "Uploading X/Y sprites".

Subpastas viram pastas de sprites opcionais. Um `catalog.json` exportado também restaura a organização em pastas e os rótulos editados. Informações de pasta inválidas são informadas, e as imagens utilizáveis são importadas mesmo assim. Importações com falha ou parciais informam a falha, em vez de mostrar sucesso com zero imagens.

Para criar várias versões da mesma expressão, use um nome comum antes do sublinhado. Por exemplo, `happy_01.png` e `happy_blush.png` contam como variantes de happy.

Para que o Expression Engine também escolha pela roupa ou pela condição, acrescente mais palavras depois da expressão, da mais importante para a menos importante. Por exemplo, use `happy_pajamas.png` ou `angry_formalwear_soaked_01.png`. Um número no final, como `_01`, só marca outra versão da mesma imagem. Quando vários sprites têm a mesma expressão, o agente vê tanto a expressão (`happy`) quanto os nomes completos deles (`happy_pajamas`). Quando nenhum sprite tem todas as palavras pedidas, a última palavra é descartada primeiro. Se não houver `happy_pajamas_wounded`, é usado um sprite `happy_pajamas` e, depois, qualquer sprite happy.

### Gerenciar um sprite

Abra um sprite de personagem para ver a prévia e as ações disponíveis. Sprites de persona mantêm as ações no próprio bloco:

- **Frame** (enquadrar): corta a imagem para deixar o personagem na posição que você quiser.
- **Download**: salva o arquivo do sprite no seu computador.
- **Replace** (substituir): faz upload de uma nova imagem com o mesmo nome.
- **Rename** (renomear; na prévia do personagem): muda o rótulo, com até 160 caracteres, mantendo o identificador do arquivo e a URL. Referências concretas à imagem que já existem continuam funcionando.
- **Folder** (pasta; na prévia do personagem) ou **Move sprite** (mover sprite; no bloco da persona): escolhe uma pasta, ou **No folder** (sem pasta), sem arrastar.
- **Delete** (excluir): remove aquele sprite.

Ao excluir, Marinara pede confirmação. No editor de persona, **Delete All Expressions** ou **Delete All Full-Body** remove a categoria inteira, mesmo com uma busca ativa.

### Pastas opcionais e seleção

Clique em **New folder** (nova pasta) para criar uma pasta recolhida chamada **unnamed**. Dê dois cliques ou dois toques no nome para renomeá-la; use a seta para expandi-la. Expressões e sprites de corpo inteiro têm pastas separadas. As pastas aparecem acima dos sprites soltos e podem ser arrastadas para mudar a ordem.

Arraste sprites individuais para pastas expandidas ou recolhidas. No celular, mantenha um bloco pressionado para começar a arrastar; um deslize normal continua rolando a tela. Arraste um sprite que está numa pasta para a área solta para tirá-lo da pasta. A área destacada mostra o destino. O controle **Folder** da prévia e o botão **Move sprite** do bloco da persona são a alternativa pelo teclado.

Clique em **Select** (selecionar) para mostrar as caixas de seleção e **Select all sprites** (selecionar todos os sprites); depois arraste juntos os sprites selecionados ou use as ferramentas de limpeza e exclusão disponíveis. **Cancel** (cancelar) sai do modo de seleção. A busca filtra os sprites visíveis; uma busca sem resultados não significa que a biblioteca está vazia.

As pastas só organizam os sprites; nunca escolhem um conjunto ativo nem escondem imagens dos chats ou agentes. Excluir uma pasta deixa os sprites dela soltos.

### Character Sheet

A linha compacta **Character Sheet** do editor de personagem abre com **Manage** (gerenciar). Crie ou faça upload de uma ficha ali e ative **Use as reference image** (usar como imagem de referência) quando quiser que ela seja a preferida para a semelhança do personagem. A escolha de referências e o uso do avatar como alternativa funcionam como antes.

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

Quando exatamente um sprite salvo naquela categoria tem o rótulo gerado, salvar substitui a imagem dele e mantém a pasta e o identificador. Um sprite renomeado para longe desse rótulo é preservado. Rótulos duplicados em pastas diferentes exigem que você escolha explicitamente o sprite a substituir para acertar o certo com segurança.

Na origem **Full-body**, se o personagem já tiver expressões em retrato, marque **Match existing expression sprites**. Isso cria poses de corpo inteiro correspondentes a cada nome de expressão que você já tem.

Duas observações sobre a geração com IA:

- A geração pode levar alguns minutos, mesmo que o texto dentro do aplicativo sugira menos tempo. Serviços de IA lentos demoram mais. Espere em vez de começar de novo.
- Em alguns dispositivos, como certas instalações Android, a geração de sprites com IA e a limpeza do plano de fundo não estão disponíveis. Nesse caso, o botão fica desativado e Marinara mostra o motivo na tela.

### Sprites de retrato animados

Na origem **Expressions (Portrait)** existe uma caixa de seleção chamada **Generate animated portraits**. Com ela ativada, Marinara cria clipes curtos em movimento no lugar de imagens paradas e transforma cada clipe em um sprite GIF em loop. O GIF é um arquivo de imagem que reproduz uma animação curta. Os retratos animados usam uma conexão de vídeo, não uma conexão de imagem.

## Limpar o plano de fundo dos sprites

O sprite fica melhor quando só o personagem aparece e o plano de fundo é transparente. Os sprites estáticos gerados usam transparência nativa quando o provedor tem suporte a ela. Caso contrário, Marinara remove um fundo chroma uniforme e adaptativo, com borda suave, e limpa a cor dele do cabelo, do tecido e de outros pixels parcialmente transparentes. Sprites antigos com fundo branco continuam com suporte.

### Limpar um sprite manualmente

Abra a prévia do sprite de personagem e a ação de limpeza com a varinha, ou clique na imagem de um sprite de persona para abrir o editor de limpeza. Lá você apaga o plano de fundo, pinta áreas de volta e confere o resultado sobre fundos escuro, claro e xadrez. Também é possível desfazer, voltar ao original e aplicar as alterações no fim.

### Limpar vários sprites de uma vez

No editor de personagem, clique em **Select**, escolha os sprites e clique em **Clean Backgrounds**. No editor de persona, o botão de limpeza vale para os sprites selecionados ou, se nada estiver selecionado, para a categoria visível.

1. Ajuste o controle deslizante **Cleanup strength** (intensidade da limpeza). Ele vai de Soft a Aggressive, de 0 a 100, e começa em 35. Um valor maior remove mais do plano de fundo, mas pode comer parte do personagem.
2. Clique em **Clean Backgrounds** e confirme.

Depois de uma limpeza em lote, Marinara salva uma cópia de proteção. Aparece a linha "Last cleanup has a restore point" com o botão **Undo Cleanup**. Clique nele para devolver cada sprite afetado ao estado anterior.

A limpeza do plano de fundo funciona em imagens PNG, JPG, JPEG, WEBP e AVIF. Não funciona em arquivos GIF ou SVG.

A limpeza automática analisa a imagem antes de escolher o motor. A limpeza de fundo integrada e rápida cuida primeiro do chroma uniforme e dos fundos brancos antigos. Se a borda não for realmente uniforme, Marinara pode recorrer ao removedor de fundo por IA, que é opcional, quando ele está instalado. O editor de limpeza manual continua sendo a opção mais segura para uma cena cheia de elementos ou para um personagem com cores quase idênticas às do plano de fundo.

## Exportar sprites

Os sprites de um personagem podem ser salvos no seu computador como um arquivo zip. O zip é um único arquivo que guarda vários arquivos juntos.

1. Abra a aba **Sprites**.
2. Clique em **Export** acima da grade do personagem, ou na caixa **Add Sprite** da persona.
3. Escolha **Expressions only** ou **Full-body only** para exportar a categoria atual, ou **All sprites** para exportar tudo.

O download contém os arquivos de imagem dos sprites e um `catalog.json` com os rótulos e a organização em pastas. As transferências nativas compatíveis de personagens e personas e os backups de perfil também mantêm esses metadados.

### Integrações que entendem pastas

`GET /api/sprites/:ownerId` continua retornando todos os sprites, em pastas ou soltos. `GET /api/sprites/:ownerId/catalog` acrescenta as pastas e a organização para integrações que querem descobrir ou importar uma pasta por vez. Cada sprite inclui seu identificador estável `expression`, o `label` editável, `folderId` e a URL. Use os IDs de pasta para a organização; o array `folders` é a ordem salva, que o editor mostra invertida para que as pastas novas apareçam primeiro. A ordem das pastas não define a prioridade nem a disponibilidade para os agentes.

O navegador de recursos do chat mostra os rótulos editados, mas insere links concretos `card://sprites/<ownerId>/<filename>`, que continuam funcionando depois de uma renomeação. Links do escopo do chat como `card://sprites/facial/joy.png` também podem resolver o rótulo editado; um nome de arquivo correspondente que já existe tem prioridade.

Metadados opcionais ausentes ou ilegíveis não escondem imagens utilizáveis. As edições recusam metadados danificados em vez de substituí-los em silêncio. Listagens só de leitura pulam bibliotecas inacessíveis; exportação e gravação continuam recusando diretórios de dono vinculados.

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
