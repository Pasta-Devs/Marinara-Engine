# Emojis, stickers e GIFs personalizados

Envie os seus próprios emojis e stickers, busque GIFs e controle quais emojis e stickers personalizados um personagem pode usar nas respostas. Essas ferramentas funcionam só no Conversation Mode. O Roleplay e o Game Mode usam o seletor de emojis simples.

## Onde encontrar essas ferramentas

Em um chat de Conversation, clique no botão redondo de carinha ao lado da caixa de mensagem, **Emoji, GIFs & stickers**. Um painel se abre acima dele (uma folha acima do teclado em um celular). As abas dele são:

- **Emoji**: a grade de emojis padrão, mais uma aba de estrela **Custom emojis** para as suas imagens enviadas.
- **GIFs**: busca de GIFs ao vivo.
- **Kaomoji**: rostos de texto como `(^_^)`.
- **Stickers**: os seus stickers enviados.

Uma aba **Tools** também aparece quando outras ferramentas de entrada estão ativadas.

## Envie um emoji personalizado

Um emoji personalizado é uma imagem pequena que você envia uma vez e usa em qualquer chat de Conversation. Em uma mensagem que você escreve, ele é um atalho: o nome entre dois-pontos, como `:kekw:`.

1. Vá para **Emoji** e depois para a aba de estrela **Custom emojis**.
2. Clique em **Upload** e escolha um ou mais arquivos de imagem.
3. Na janela **Name this emoji**, digite um nome e clique em **Add**.

O emoji aparece na grade **Custom emojis**.

Regras:

- Um nome tem de 1 a 32 caracteres: letras minúsculas, números e sublinhados. O aplicativo muda os outros caracteres para você.
- A imagem pode ter no máximo 256 por 256 pixels. Arquivos GIF animados funcionam e tocam no chat.
- Os nomes precisam ser únicos. Um nome já usado mostra `An emoji named ":name:" already exists.`

Se não funcionou: confira o nome e o tamanho da imagem em relação às regras acima.

## Use um emoji personalizado

Clique em um bloco na grade **Custom emojis**. Isso insere o atalho dele na sua mensagem e não a envia. Você também pode digitar o atalho, em minúsculas, exatamente como foi salvo.

Em um chat de Conversation, um atalho aparece como uma imagem pequena na linha. Uma mensagem só com atalhos de emoji os mostra maiores. Se o nome não existe mais, por exemplo depois que você o exclui, a mensagem mostra o texto simples `:kekw:`.

## Renomeie, exclua, exporte e importe

Clique em **Edit** no topo da aba **Custom emojis** para ativar o modo de edição.

- Clique em um bloco para abri-lo, **Rename emoji**, e depois clique em **Rename**.
- Clique no selo de lixeira de um bloco para excluí-lo. **Delete emoji** avisa que as mensagens que o usaram vão mostrar o texto no lugar.
- Clique em **Export** para baixar todos os seus emojis personalizados como `marinara-custom-emojis.json`. As imagens estão dentro do arquivo.
- Clique em **Import** para carregar um arquivo exportado. Ele ignora os emojis que quebram as regras de nome ou de tamanho ou que colidem com um existente.

## Stickers personalizados

Um sticker é uma imagem maior que aparece sozinha na própria linha. Normalmente você clica nele na aba **Stickers**. O texto `sticker:name:` é o que é inserido. Na aba **Stickers**, clique em **Upload** e use **Edit**, **Export** e **Import** como nos emojis. As diferenças:

- A janela de envio é **Name this sticker**.
- A maior imagem tem 512 por 512 pixels (emojis: 256 por 256).
- O arquivo exportado é `marinara-custom-stickers.json`.

Para enviar um sticker, clique no bloco dele. A janela **Send sticker** oferece:

- **Send & reply**: publica o sticker como a própria mensagem e deixa o personagem responder.
- **Add to message**: coloca o texto `sticker:name:` na sua mensagem para você continuar digitando.

## Busque GIFs

A aba **GIFs** busca no Giphy, uma biblioteca de GIFs online. Digite na caixa de busca ou navegue pela lista de populares e clique em um GIF para enviá-lo.

Antes de começar: a busca de GIFs precisa de uma chave de API gratuita do Giphy. Uma chave é um código secreto que deixa o Marinara usar o serviço do Giphy por você. Sem ela, a aba mostra um cartão de configuração. Defini-la significa editar o arquivo `.env`, que é o arquivo de configurações em texto simples do Marinara. Ele fica na pasta do projeto do Marinara, ou em `/app/data/.env` no Docker (veja [Edite o arquivo .env](../CONFIGURATION.md#edit-the-env-file)).

1. Abra o painel de desenvolvedor do Giphy em `https://developers.giphy.com/dashboard/`.
2. Crie uma chave de API para um aplicativo web e copie-a.
3. Abra o arquivo `.env` em um editor de texto.
4. Adicione esta linha no fim, com a sua chave no lugar de `your_key_here`, e salve o arquivo:

   ```text
   GIPHY_API_KEY=your_key_here
   ```

5. Reinicie o Marinara. Isso significa pará-lo e iniciá-lo de novo do jeito que você costuma iniciá-lo (veja [Instalação](../INSTALLATION.md)).

Os resultados de GIF usam a classificação adulta do Giphy. Você não pode mudá-la no aplicativo, então os resultados podem incluir GIFs adultos. Não existe uma fonte de GIFs só seguros.

## Marque uma imagem da galeria como emoji ou sticker

Qualquer imagem em uma Character Gallery ou Persona Gallery pode virar um emoji ou sticker. Ela funciona só em chats que incluem esse personagem ou persona.

1. Abra o **Character Editor** ou o **Persona Editor**.
2. Abra a aba **Gallery** e depois a subaba **Images**.
3. Passe o mouse sobre uma imagem e clique no botão de tag no canto superior esquerdo.
4. Escolha **Make emoji** ou **Make sticker**.
5. Na janela **Custom Emoji** ou **Custom Sticker**, digite um nome.

O botão de tag agora mostra o nome. Os mesmos limites de tamanho valem, e uma imagem grande demais mostra um erro vermelho. Para mudar depois, clique no botão de tag de novo para **Rename**, uma opção de troca como **Switch to sticker**, ou uma opção de remoção como **Remove emoji**. A imagem também continua sendo uma imagem normal da galeria.

## Preferências de seleção

O Marinara diz ao personagem que responde quais emojis e stickers personalizados ele pode usar. Para mudar como ele escolhe, clique na engrenagem **Selection preferences** no topo da aba **Custom emojis** ou **Stickers**. As duas abrem a mesma configuração, salva por chat.

- **Semantic** (padrão): oferece os que melhor combinam com a conversa recente. Ela usa um modelo pequeno no seu próprio computador. Se isso não está disponível, escolhe ao acaso. Quando um personagem responde, os emojis e stickers dele são classificados junto com os compartilhados, e os dele têm preferência quando a classificação fica próxima.
- **Random**: oferece um conjunto aleatório a cada resposta.
- **Tool-call**: um modelo escolhe os adequados a cada resposta. Escolha um modelo em **Select a model...**. Se nenhum está definido ou se ele falha, usa o semântico. É ignorada quando vários personagens respondem em uma rodada de grupo.

**Max offered (each)** é quantos nomes de emojis e quantos nomes de stickers são oferecidos por turno. O padrão é 20, de 1 a 100.

Se um personagem escreve o nome de um sticker como se fosse um emoji, como `:hug:` em vez de `sticker:hug:`, a resposta mostra o sticker. Isso só acontece quando nenhum emoji personalizado tem esse nome.

<a id="describe-emojis-and-stickers"></a>

### Descreva emojis e stickers

Uma descrição diz o que um emoji ou sticker mostra e a sensação que transmite, por exemplo "gato espiando por cima de um travesseiro; tímido, envergonhado". Ela ajuda quando o nome não diz o que a imagem significa.

- Para escrever uma, clique em **Edit** na aba **Custom emojis** ou **Stickers** e depois no pequeno botão de descrição no canto de um bloco. Para um emoji ou sticker marcado na galeria, clique no botão de tag dele e escolha **Add description** (adicionar descrição).
- Para a IA escrever as descrições, clique em **Edit** e depois em **Describe with AI** (descrever com IA). O modelo **Image reading** (leitura de imagens) examina cada imagem e escreve uma descrição curta. Se alguns já tiverem descrição, escolha **Describe only the … without** (descrever apenas os … sem descrição) ou **Describe all … again** (descrever todos os … novamente).

Antes de começar: as descrições por IA precisam de um modelo que consiga ler imagens. Marinara usa o modelo **Image reading** se você definir um na página **Jobs** (tarefas) de **Connections** (Conexões); caso contrário, usa o modelo dos seus agentes.

Duas configurações em **Selection preferences** usam as descrições:

- **Use descriptions** (usar descrições, ativado por padrão): usa a descrição, além do nome, para classificar quais oferecer em **Semantic** e **Tool-call**. Não acrescenta nada ao prompt.
- **Show descriptions to the model** (mostrar descrições ao modelo, desativado por padrão): também lista a descrição de cada emoji ou sticker oferecido ao lado do nome, para o modelo saber o que significa. Acrescenta cerca de 1.000 a 1.800 tokens de entrada por resposta com o padrão de 20 oferecidos.

As descrições usadas apenas para escolher quais oferecer não ensinam ao modelo o que um nome significa. Se um nome diz o oposto da sensação que transmite, como um `:fine:` sarcástico, ative **Show descriptions to the model** ou **Show them to the model**.

### Mostre-os ao modelo

Normalmente o modelo vê apenas os nomes dos seus emojis e stickers personalizados. Se o modelo do chat consegue ler imagens, **Show them to the model** (mostre-os ao modelo), no mesmo painel, também envia imagens para ele saber como cada um é. Isso ajuda principalmente quando os nomes não descrevem a imagem.

- **Desativado** (padrão): apenas os nomes.
- **Last message** (última mensagem): mostra os emojis e stickers personalizados da mensagem mais recente.
- **Recent** (recentes): mostra os das últimas mensagens. **Messages to look at** (mensagens a examinar) define quantas, de 2 a 20. O padrão é 6.

**Offered ones on the sheet** (oferecidos na folha) acrescenta às imagens essa quantidade de emojis oferecidos e essa mesma quantidade de stickers oferecidos, de 0 a 30. O padrão é 6. Uma folha comporta até 30 emojis e 12 stickers; os do chat vêm primeiro, então os oferecidos preenchem o espaço que sobrar.

O modelo recebe uma imagem de emojis numerados e outra de stickers numerados a cada resposta, com os nomes exatos em texto. Isso custa tokens de entrada extras a cada resposta (tokens são os pequenos pedaços de texto e imagens pelos quais um serviço cobra), cerca de 1.000 com os valores padrão. A opção não tem efeito quando o modelo do chat não consegue ler imagens ou quando **Descrição automática de imagens** está ativada. Se o modelo recusar imagens, Marinara envia apenas os nomes.

## As reações usam só os seus emojis personalizados principais

Você pode reagir a uma mensagem com um emoji personalizado, mas só com os emojis que enviou na aba **Custom emojis**. Emojis marcados pela galeria, stickers e GIFs não estão disponíveis como reações. Quando um personagem reage com o nome de um sticker, a reação mostra esse sticker. Veja [Reaja e receba notificações](getting-started.md#react-and-get-notified).

## Guias relacionados

- [Conversation Mode: primeiros passos](getting-started.md)
- [Galerias de personagens e personas](../characters/galleries.md)
- [Referência de configuração do servidor](../CONFIGURATION.md)
