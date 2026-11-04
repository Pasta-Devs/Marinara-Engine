# Sprites de personagem (expressões e corpo inteiro)

O sprite é uma imagem do seu personagem para um humor, como feliz ou triste. Marinara mostra o sprite flutuando sobre a cena do chat. Faça upload dos seus próprios sprites, gere sprites com IA, limpe o plano de fundo deles e controle como eles aparecem.

Antes de começar: dê a cada arquivo o nome do humor, como `happy.png`, para que Marinara consiga escolhê-lo. Em um chat de Roleplay, os sprites também precisam do agente **Expression Engine** (um ajudante que escolhe o sprite) ativado. Veja [Como os sprites aparecem no chat](#how-sprites-show-up-in-your-chat).

Existem dois tipos de sprite:

- **Facial Expressions** (expressões faciais) são retratos para humores como feliz, triste ou bravo.
- **Full-body** (corpo inteiro) são imagens do corpo todo para poses como parado, andando ou em posição de combate.

Os sprites aparecem na tela no Roleplay Mode e no Game Mode, não nos chats de Conversation. Você pode fazer upload deles em qualquer modo, porque o personagem mantém os sprites dele em todos os chats. A persona tem a mesma aba **Sprites**.

## Encontre a aba Sprites

1. Abra um personagem (ou uma persona) no editor dele.
2. Clique na aba **Sprites**.
3. No topo, escolha uma categoria: **Facial Expressions**, **Full-body** ou **Clips**.

As seções abaixo explicam **Facial Expressions** e **Full-body**. **Clips** faz parte do recurso de chamadas. Veja [Chamadas de áudio e vídeo no Conversation](../conversation/calls.md).

## Faça upload dos seus próprios sprites

Você pode fazer upload de imagens PNG, JPEG, GIF, WebP, AVIF e SVG. Arquivos PNG com transparência ficam melhores, porque a área vazia em volta do personagem continua transparente. Uma imagem de substituição inválida é recusada, e o sprite salvo continua.

### Faça upload de um ou mais sprites

1. Abra a aba **Sprites** e escolha **Facial Expressions** ou **Full-body**.
2. Clique em **Add sprites** (adicionar sprites).
3. Clique em **Upload images** (fazer upload de imagens) e escolha os arquivos. Você pode selecionar vários juntos.
4. O nome de cada arquivo vira o nome do sprite (o rótulo dele). Abra um sprite para renomeá-lo depois.

Os novos sprites aparecem na grade, fora de qualquer pasta. No editor de persona, use o campo de nome e o botão **Upload** de **Add Sprite** (adicionar sprite) para um único sprite.

### Faça upload de uma pasta inteira

1. Dê aos arquivos de imagem o nome da expressão ou da pose, como `admiration.png` para uma expressão chamada admiration.
2. Abra **Add sprites** e clique em **Import folder** (importar pasta). No editor de persona, clique em **Upload Folder** em **Add Sprite**.
3. Escolha a pasta que contém as imagens.

O nome de cada arquivo, sem a extensão, vira o nome do sprite. Uma linha de progresso mostra "Uploading X/Y sprites". Subpastas viram pastas de sprites opcionais. Um `catalog.json` de uma exportação também restaura as pastas e os rótulos editados. Uma entrada de pasta inválida é informada, e as imagens utilizáveis são importadas mesmo assim.

Se não funcionou: uma importação com falha ou parcial informa a falha, em vez de mostrar sucesso com zero imagens. Confira os tipos de arquivo acima.

### Variantes de nome

| Nome do arquivo | O que significa |
| --- | --- |
| `happy_01.png`, `happy_blush.png` | Duas imagens felizes. Comece os dois nomes com `happy_`. |
| `happy_pajamas.png` | Feliz, de pijama. Coloque o humor primeiro e depois a roupa. |
| `angry_formalwear_soaked_01.png` | Bravo, com roupa formal, encharcado. Um número no final só marca outra versão da mesma imagem. |

O Expression Engine vê tanto a expressão (`happy`) quanto o nome completo (`happy_pajamas`). Se nenhum sprite corresponder a todas as palavras, a última palavra é descartada primeiro. Assim, se não houver `happy_pajamas_wounded`, é usado `happy_pajamas` e, depois, qualquer sprite happy.

<a id="how-sprites-show-up-in-your-chat"></a>

## Como os sprites aparecem no chat

Você escolhe quando e como os sprites aparecem nas configurações do chat, não no editor de personagem.

### Roleplay Mode

O agente Expression Engine comanda os sprites no Roleplay. O agente é um ajudante que roda junto com as respostas. Veja [Agentes: ajudantes de IA para os seus chats](../agents/agents-overview.md). Ele lê o humor de cada mensagem e escolhe um sprite de expressão correspondente. Adicione-o ao chat e instale-o em **Agent Organizer** (organizador de agentes) se ainda não o tiver. Veja [Referência dos agentes para download](../agents/built-in-agents.md#expression-engine).

Para os sprites aparecerem, tudo isto precisa ser verdade:

- O agente Expression Engine está ativado para o chat.
- Pelo menos um personagem, ou a persona, está escolhido como dono dos sprites.
- Pelo menos uma origem de sprite está ativada.

Abra **Chat Settings → Agents** (configurações do chat → agentes) e localize o cartão **Expression Engine**:

- **Sprite Source** (origem do sprite) é **Expressions**, **Full-body** ou as duas. As duas vêm ativadas por padrão, e pelo menos uma precisa continuar ativada.
- **Expression Avatars** substitui o pequeno avatar da mensagem pelo sprite de expressão correspondente. Vem desativado por padrão e só funciona no Roleplay.
- **Only show active sprites** (mostrar só os sprites ativos) mostra só os personagens do último resultado concluído e mantém os sprites atuais visíveis enquanto o próximo resultado é gerado.

### Game Mode

No Game Mode, um sprite de corpo inteiro aparece automaticamente para quem estiver falando ou lutando. Você não precisa do Expression Engine, só de sprites de corpo inteiro para aquele personagem. Veja [Game Mode: primeiros passos](../game/getting-started.md).

### Mova e redimensione os sprites

Assim que um dono de sprites está ativado, o cartão **Expression Engine** mostra **Sprite Layout** (disposição dos sprites).

1. Clique em **Arrange** e arraste cada sprite para onde quiser.
2. Clique em **Done**.

**Reset** limpa as suas posições e volta à disposição automática. **Default Side** é **Left** ou **Right** e começa em Left. Mudar essa opção inverte a disposição atual. **Apply to** permite definir a disposição para todos os personagens ou para um só.

Quatro controles deslizantes definem o tamanho e o nível de transparência. **Expression Size** e **Full-body Size** vão de 5% a 200%. **Expression Opacity** e **Full-body Opacity** vão de 0% a 100%. Os tamanhos e as opacidades começam em 100%.

## Gere sprites com IA

Antes de começar: adicione uma conexão de geração de imagens. Para sprites animados, você também precisa de uma conexão de vídeo. Veja [Conectando a um provedor de IA](../connections/connecting-to-a-provider.md).

1. Abra **Add sprites** e clique em **Generate Sprite**. No editor de persona, o botão fica em **Add Sprite**. A janela **Generate Sprites** abre.
2. Escolha uma origem no topo: **Expressions (Portrait)** ou **Full-body**.
3. Escolha uma **Image Generation Connection** (conexão de geração de imagens).
4. Se quiser, adicione até quatro **Reference Images** (imagens de referência), ou marque a caixa para usar o avatar atual como referência.
5. Escreva uma **Appearance Description** (descrição da aparência). Ela é obrigatória.
6. Se quiser, ative **Transparent sprite background**. Marinara deixa o plano de fundo transparente. Se o serviço não conseguir fazer isso, Marinara desenha um fundo liso verde, magenta ou ciano, diferente das cores da **Appearance Description**, e depois o remove.
7. Defina **Expression Count** (ou **Pose Count**, para corpo inteiro) e escolha quais expressões ou poses criar.
8. Clique em **Generate**.

Quando as imagens chegarem, ative ou desative cada uma, renomeie e corte. Depois, salve as imagens selecionadas nos sprites do personagem. Se exatamente um sprite salvo naquela categoria tiver o rótulo gerado, salvar substitui a imagem dele e mantém a pasta e o identificador. Um sprite que você renomeou para outro rótulo é mantido. Com rótulos duplicados em pastas diferentes, substitua à mão o sprite que você quer.

Na origem **Full-body**, se o personagem já tiver expressões em retrato, marque **Match existing expression sprites** para criar poses de corpo inteiro correspondentes a cada nome de expressão.

A geração pode levar alguns minutos, mais em serviços lentos. Espere em vez de começar de novo. Em alguns dispositivos, como certas instalações Android, a geração de sprites com IA e a limpeza do plano de fundo não estão disponíveis. O botão fica desativado e Marinara mostra o motivo.

### Retratos animados

Na origem **Expressions (Portrait)**, **Generate animated portraits** cria clipes curtos em movimento e transforma cada um em um sprite GIF em loop. O GIF é um arquivo de imagem que reproduz uma animação curta. Essa opção usa uma conexão de vídeo, não uma conexão de imagem. Veja [Expressões animadas](../media/animated-expressions.md).

## Limpe o plano de fundo dos sprites

O sprite fica melhor quando só o personagem aparece. Os sprites gerados usam transparência nativa quando o serviço tem suporte a ela. Caso contrário, Marinara remove uma cor de fundo uniforme e adaptativa, com borda suave, e limpa essa cor do cabelo, do tecido e de outros pixels parcialmente transparentes. Sprites antigos com fundo branco continuam funcionando.

### Limpe um sprite à mão

Abra a prévia do sprite de personagem e use a ação de limpeza com a varinha, ou clique na imagem de um sprite de persona. O editor de limpeza permite apagar o plano de fundo, pintar áreas de volta e conferir o resultado sobre fundos escuro, claro e xadrez. Você pode desfazer, voltar ao original e aplicar quando terminar.

### Limpe vários sprites de uma vez

1. No editor de personagem, clique em **Select** (selecionar) e escolha os sprites. No editor de persona, o botão de limpeza vale para os sprites selecionados ou, se nenhum estiver selecionado, para a categoria visível.
2. Clique em **Clean Backgrounds**.
3. Ajuste o controle deslizante **Cleanup strength** (intensidade da limpeza), de **Soft** a **Aggressive**, de 0 a 100. Ele começa em 35. Um valor maior remove mais plano de fundo, mas pode cortar parte do personagem.
4. Confirme.

Marinara guarda uma cópia de proteção. Uma linha mostra "Last cleanup has a restore point" com **Undo Cleanup**. Clique nele para devolver cada sprite afetado ao estado anterior.

A limpeza funciona em PNG, JPG, JPEG, WEBP e AVIF. Não funciona em GIF nem em SVG.

A limpeza automática analisa a imagem primeiro. A limpeza integrada e rápida cuida de cores uniformes e dos fundos brancos antigos. Se a borda não for uniforme, Marinara pode recorrer ao removedor de fundo por IA opcional, quando ele está instalado. Para uma cena cheia de elementos, ou para um personagem com cores iguais às do plano de fundo, o editor manual é a escolha mais segura.

## Gerencie os sprites

Abra um sprite de personagem para ver a prévia e as ações dele. Sprites de persona mantêm as ações no próprio bloco.

- **Frame** (enquadrar) corta a imagem para deixar o personagem onde você quiser.
- **Download** salva o arquivo do sprite.
- **Replace** (substituir) faz upload de uma nova imagem com o mesmo nome.
- **Rename** (renomear; na prévia do personagem) muda o rótulo, com até 160 caracteres, e mantém o identificador do arquivo e a URL, então as referências à imagem que já existem continuam funcionando.
- **Folder** (pasta; na prévia do personagem) ou **Move sprite** (mover sprite; no bloco da persona) escolhe uma pasta, ou **No folder** (sem pasta), sem arrastar.
- **Delete** (excluir) remove esse sprite depois que você confirma. No editor de persona, **Delete All** com o nome da categoria remove a categoria inteira, mesmo com uma busca ativa.

### Pastas e seleção

Clique em **New folder** (nova pasta) para criar uma pasta recolhida chamada **unnamed**. Dê dois cliques ou dois toques no nome para renomeá-la e use a seta para expandi-la. Expressões e sprites de corpo inteiro têm pastas separadas. As pastas ficam acima dos sprites soltos e podem ser arrastadas para mudar a ordem.

Arraste sprites para uma pasta, ou arraste um sprite que está numa pasta para a área solta para tirá-lo da pasta. No celular, mantenha um bloco pressionado para começar a arrastar. Deslizar o dedo normalmente continua rolando a tela. As pastas só organizam: nunca escolhem um conjunto ativo nem escondem imagens dos chats ou agentes. Excluir uma pasta deixa os sprites dela soltos.

Clique em **Select** para mostrar as caixas de seleção e **Select all sprites** (selecionar todos os sprites). Depois, arraste juntos os sprites selecionados ou use a limpeza e a exclusão. **Cancel** (cancelar) sai do modo de seleção. A busca filtra os sprites visíveis. Uma busca sem resultados não significa que a biblioteca está vazia.

### Character Sheet

A linha **Character Sheet** do editor de personagem abre com **Manage** (gerenciar). Crie ou faça upload de uma ficha ali. Ative **Use as reference image** (usar como imagem de referência) para dar preferência a ela na semelhança do personagem.

## Exporte os sprites

1. Abra a aba **Sprites**.
2. Clique em **Export** acima da grade do personagem, ou na caixa **Add Sprite** da persona.
3. Escolha **Expressions only** ou **Full-body only** para exportar a categoria atual, ou **All sprites** para exportar tudo.

Você recebe um zip com os arquivos dos sprites e um `catalog.json` com os rótulos e as pastas. As exportações nativas de personagens e personas e os backups de perfil também mantêm esses dados.

## Guias relacionados

- [Criando e editando personagens](creating-and-editing-characters.md)
- [Personas](personas.md)
- [Roleplay Mode: primeiros passos](../roleplay/getting-started.md)
- [Game Mode: primeiros passos](../game/getting-started.md)
- [Chamadas de áudio e vídeo no Conversation](../conversation/calls.md)
- [Expressões animadas](../media/animated-expressions.md)
- [Referência dos agentes para download](../agents/built-in-agents.md)

## Referência para desenvolvedores: API de sprites e links

`GET /api/sprites/:ownerId` retorna todos os sprites, em pastas ou soltos. `GET /api/sprites/:ownerId/catalog` acrescenta as pastas e quais sprites estão em cada uma, para ferramentas que importam uma pasta por vez. Cada sprite tem um identificador estável `expression`, um `label` editável, um `folderId` e uma URL. Use os IDs de pasta para saber em qual pasta está cada sprite. O array `folders` é a ordem salva, que o editor mostra invertida para que as pastas novas apareçam primeiro. A ordem das pastas não define a prioridade nem a disponibilidade para os agentes.

O navegador de recursos do chat mostra os rótulos editados, mas insere links concretos `card://sprites/<ownerId>/<filename>`, que continuam funcionando depois de uma renomeação. Links do escopo do chat, como `card://sprites/facial/joy.png`, também podem resolver o rótulo editado. Um nome de arquivo correspondente que já existe tem prioridade.

Metadados opcionais ausentes ou ilegíveis não escondem imagens utilizáveis. As edições recusam metadados danificados em vez de substituí-los. Listagens somente leitura pulam bibliotecas inacessíveis, e os caminhos de exportação e gravação recusam diretórios de dono vinculados.
