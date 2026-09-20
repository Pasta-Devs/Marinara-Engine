# Geração de vídeo de cena

Este guia explica como Marinara Engine transforma a ilustração de uma cena em um clipe de vídeo MP4 curto. Aqui você vê os provedores de vídeo, como gerar um clipe pela galeria, os controles do Game Mode e as configurações de vídeo. Um vídeo de cena é um clipe animado curto, criado a partir de uma única imagem estática.

## Para que serve o vídeo de cena

O vídeo de cena pega uma imagem que já está na galeria e a anima em um clipe MP4 curto. A imagem estática vira o primeiro quadro, e a IA acrescenta o movimento. Os vídeos de cena funcionam nos chats de **Roleplay** e de **Game Mode**.

Você sempre precisa de uma imagem antes. A geração de vídeos de cena não funciona só com texto. Gere ou faça upload de uma imagem na galeria para depois animá-la.

Os vídeos de cena usam um tipo de conexão à parte, chamado **Video Generation** (geração de vídeos). Não é a mesma coisa que a geração de imagens comum. Marinara salva os clipes prontos junto com o chat e os mostra na galeria, onde você pode fixar, baixar ou assistir a cada um.

## Conexões de Video Generation

Para criar vídeos de cena, primeiro adicione uma conexão capaz de gerar vídeo. Isso acontece no mesmo painel **Connections** (conexões) usado pelas conexões de chat e de imagem.

1. Abra o painel **Settings** (Configurações) e depois a seção **Connections**.
2. Clique em **Add Connection**.
3. Defina o tipo de provedor como **Video Generation**.
4. Em **Video Service**, escolha um dos seis serviços abaixo.
5. Digite a chave de API do serviço em nuvem. Um código secreto, parecido com uma senha. O ComfyUI local não precisa de chave.
6. Nos serviços em nuvem, escolha um modelo ou mantenha o padrão do provedor. No ComfyUI, deixe o modelo em branco, a menos que o fluxo de trabalho use `%model%`.
7. Salve a conexão.

O seletor **Video Service** oferece seis opções. Cada uma preenche um endereço web padrão e, quando faz sentido, um modelo padrão:

| Video Service        | Modelo padrão                     | Observações                                                                        |
| -------------------- | --------------------------------- | ---------------------------------------------------------------------------------- |
| **Google AI Studio** | `gemini-omni-flash-preview`       | Roda os modelos de vídeo Gemini Omni e Veo pela API do Gemini.                |
| **xAI Imagine**      | `grok-imagine-video-1.5`          | Vídeo do Grok Imagine pela API de vídeos da xAI.                               |
| **OpenRouter Video** | `google/veo-3.1`                  | Modelos de vídeo pelo OpenRouter. Você pode digitar o ID de qualquer modelo de vídeo do OpenRouter. |
| **Atlas Cloud**      | `google/veo3.1/text-to-video`     | Modelos hospedados de texto para vídeo e de imagem para vídeo pelo Atlas Cloud.          |
| **Seedance 2.0**     | `seedance-2-0`                    | Modos de vídeo por texto, por primeiro quadro e por primeiro e último quadro.                     |
| **ComfyUI**          | Definido pelo fluxo de trabalho                  | Fluxos de trabalho de vídeo locais do WAN e outros, exportados em formato de API.                  |

A opção **Google AI Studio** abrange duas famílias de modelos. **Gemini Omni** usa `gemini-omni-flash-preview`. **Google Veo** usa `veo-3.1-generate-preview`. Qual deles roda depende do modelo escolhido na conexão.

No caso do **ComfyUI**, use o endereço local de sempre, `http://127.0.0.1:8188`, e cole um fluxo de trabalho de vídeo em formato de API no campo **ComfyUI Workflow**. O fluxo de trabalho é obrigatório. Veja [Configuração de workflows do ComfyUI](comfyui.md#comfyui-video-workflows) para conhecer os marcadores e o que os nós de saída exigem.

### Definir como conexão de vídeo padrão

O editor de uma conexão de Video Generation mostra o grupo **Default for Videos**. Ative a opção **Use as default video connection** para que Marinara use essa conexão quando o chat não tiver uma conexão de vídeo própria. Marque apenas uma conexão como conexão de vídeo padrão.

### Padrões de vídeo da conexão

Cada conexão de Video Generation tem o próprio painel **Video Generation Defaults** no editor de conexões. É ali que você define a duração do clipe, a proporção da imagem e a resolução padrão daquela conexão. Esses padrões por conexão têm prioridade sobre a duração de reserva definida no aplicativo inteiro.

| Serviço          | Duração padrão | Faixa de duração | Proporção | Resolução       |
| ---------------- | -------------- | ------------ | ------------ | ---------------- |
| Gemini Omni      | 10s            | 1 a 60s     | 16:9         | Padrão do provedor |
| Google Veo       | 8s             | 4, 6 ou 8s  | 16:9         | 720p             |
| xAI Imagine      | 10s            | 1 a 15s     | 16:9         | 720p             |
| OpenRouter Video | 10s            | 1 a 60s     | 16:9         | 720p             |
| Atlas Cloud      | 8s             | 1 a 60s     | 16:9         | 720p             |
| Seedance 2.0     | 5s             | 4 a 15s     | 16:9         | 720p             |
| ComfyUI          | 5s             | 1 a 60s     | 16:9         | 720p             |

O Gemini Omni não tem campo de resolução, e a duração dele vai escrita no texto do prompt, não em uma configuração separada. O prompt é o texto que Marinara envia para a IA. O Google Veo força 8 segundos sempre que anima uma imagem de referência, porque precisa desse tempo para misturar o primeiro e o último quadro.

### Quadros de referência do Seedance

O Seedance precisa buscar a imagem de referência por um link público antes de animá-la. Um servidor local do Marinara não tem link público, então instalações locais simples exigem um passo a mais.

Abra a conexão do Seedance e ative a opção **Upload Seedance reference frames temporarily**. Com isso, Marinara envia o quadro de referência para um link público temporário, de onde o Seedance consegue lê-lo. A duração desse link é escolhida no campo **Temporary link lifetime**, que vem com 12 horas por padrão.

Se o servidor Marinara já tiver um endereço web público, defina uma variável de ambiente em vez de usar os uploads temporários. Veja a [Referência de configuração do servidor](../CONFIGURATION.md) para conhecer a configuração de referência de vídeo.

## Como escolher um provedor

Os seis serviços criam clipes curtos a partir da imagem. A diferença está na velocidade, na duração do clipe e na forma como cada um lida com imagens de referência.

- **Google AI Studio (Gemini Omni)**: duração flexível, de até 60 segundos. A duração vai embutida no prompt, e não em um controle separado.
- **Google AI Studio (Veo)**: qualidade alta, mas fixa em 4, 6 ou 8 segundos. Usa 8 segundos quando anima uma imagem.
- **xAI Imagine**: clipes de 1 a 15 segundos. O limite de tamanho do prompt é menor que o dos outros serviços.
- **OpenRouter Video**: de 1 a 60 segundos, e aceita qualquer modelo de vídeo que a conta do OpenRouter tenha.
- **Atlas Cloud**: **Fetch Models** (Buscar modelos) carrega o catálogo atual de vídeo do Atlas Cloud, com os modelos de imagem para vídeo primeiro e o preço inicial por segundo de vídeo de cada um. Se o catálogo estiver indisponível, o Marinara mostra os modelos iniciais Veo 3.1 e Seedance 2.0. Você também pode digitar o identificador exato de um modelo de vídeo do Atlas Cloud; os limites de duração, resolução e imagens de referência de cada modelo continuam valendo.
- **Seedance 2.0**: clipes de 4 a 15 segundos, com os modos de primeiro quadro e de primeiro e último quadro. Precisa de um link público para a imagem de referência.
- **ComfyUI**: geração local pelo fluxo de trabalho em formato de API que você mesmo criou. Marinara envia a imagem de referência direto para o ComfyUI quando o fluxo de trabalho usa `%reference_image_name%`.

Os trabalhos de vídeo demoram. O provedor inicia o trabalho, e Marinara aguarda e verifica até o clipe ficar pronto. Isso leva alguns minutos por clipe, bem mais que uma imagem estática. Modelos WAN locais grandes talvez precisem de mais que os 30 minutos padrão; nesse caso, aumente `VIDEO_GEN_TIMEOUT_MS` e reinicie Marinara.

### Diferenças entre os modelos do Atlas Cloud

Os modelos do Atlas Cloud não aceitam todos as mesmas configurações. Antes de cada solicitação, o Marinara lê o esquema de entrada publicado do modelo em `static.atlascloud.ai` e adapta os padrões da sua conexão:

- A ilustração de origem é enviada no campo de imagem usado pelo modelo.
- A duração do clipe muda para a duração disponível mais próxima. Um modelo limitado a 5 ou 10 segundos transforma um padrão de 8 segundos em 10.
- A resolução muda para o nível disponível mais próximo. Modelos que recebem dimensões em pixels usam o `width*height` mais próximo da sua proporção e resolução.
- Configurações que o modelo não possui são omitidas, deixando valer o padrão do próprio modelo.

O log do servidor lista cada valor alterado em uma linha que começa com `[video-gen/atlas-cloud] fitted request`. Se não for possível ler o esquema, o Marinara envia a mesma solicitação geral de antes.

Escolha um modelo **image-to-video** (imagem para vídeo) para vídeos de cena. Um modelo de texto para vídeo não tem campo de imagem: ele ignora sua ilustração e cria um clipe independente apenas com o prompt. O servidor avisa no log quando isso acontece.

**Test Video** (Testar vídeo) envia um gradiente simples como primeiro quadro quando o modelo do Atlas Cloud exige uma imagem. Assim, modelos de imagem para vídeo também podem passar no teste de conexão.

### Opções dos modelos do Atlas Cloud

Muitos modelos do Atlas Cloud têm entradas próprias, como `negative_prompt`, `seed`, `generate_audio`, `shot_type`, `enable_prompt_expansion` ou listas de LoRA. O editor de conexão mostra as entradas do modelo selecionado:

1. Abra a conexão do Atlas Cloud e escolha ou digite um modelo.
2. Expanda **Video Defaults** (Padrões de vídeo) e depois **Atlas Cloud setup** (Configuração do Atlas Cloud).
3. Encontre **Model options** (Opções do modelo) abaixo dos controles de duração, proporção e resolução.

A parte superior de **Model options** lista as durações, resoluções, tamanhos de quadro e proporções aceitos pelo modelo. Um modelo de texto para vídeo também mostra um aviso ali, pois não consegue usar a imagem da sua galeria.

Cada opção mantém exatamente o nome e a descrição fornecidos pelo Atlas Cloud. Todas começam em **Model default** (Padrão do modelo), com o valor padrão do provedor entre parênteses. Uma opção deixada em **Model default** não é enviada: o Atlas Cloud decide. Altere uma opção para enviar seu valor em todos os vídeos gerados pela conexão, inclusive em **Test Video**. Entradas de listas e objetos, como LoRAs, recebem JSON.

As escolhas são salvas por modelo. Trocar para outro modelo e voltar preserva as opções de cada um. **Reset model options** (Redefinir opções do modelo) limpa as escolhas do modelo atual. Clique em **Save** (Salvar) na conexão para manter suas alterações.

Se uma opção salva deixar de corresponder ao modelo, por exemplo após o Atlas Cloud alterar suas entradas, o Marinara a omite da solicitação e informa seu nome na linha de log `[video-gen/atlas-cloud] fitted request`.

## Gerar um vídeo pela galeria

Tanto os chats de **Roleplay** quanto os de **Game Mode** criam vídeos de cena pelo painel **Gallery** (galeria). Abra o painel pelo ícone de imagem ou de galeria do chat. Os chats de Game Mode têm ainda um segundo lugar para isso, o painel **Game Assets**, explicado mais adiante neste guia.

A galeria tem a aba **Images** e a aba **Videos**, cada uma com um contador. As imagens estáticas ficam em **Images**. Os clipes prontos ficam em **Videos**.

Para animar a imagem mais recente:

1. Verifique se existe pelo menos uma imagem na aba **Images**. Use o botão **Illustrate** ou faça upload de uma imagem antes.
2. Clique em **Video** na linha de ações no topo da galeria.
3. Se a opção **Expose media prompts before sending** estiver ativada em **Settings**, **Generations**, **Overall Generations**, revise ou edite o prompt de animação compilado e clique em **Generate**. Cancelar essa janela não envia nenhuma requisição ao provedor.
4. O botão muda para **Generating...**, e uma faixa avisa que a geração de vídeos está em andamento.
5. Ao terminar, o clipe aparece na aba **Videos**.

Para animar uma imagem específica em vez da mais recente:

1. Abra a aba **Images**.
2. Passe o mouse sobre a imagem desejada.
3. Clique no botão **Animate illustration** (o ícone de filme) nos controles que aparecem.

A mesma janela **Review Video Prompt** abre no caso do **Animate illustration** quando a revisão de prompt está ativada. Ela mostra o prompt exato compilado pelo servidor, além da duração, da proporção e da resolução que serão usadas naquela imagem. A edição vale só para aquela geração. No **Roleplay**, as instruções reaproveitáveis que geram esse prompt são controladas à parte pela configuração **Roleplay Gallery Animation Director**, em **Settings**, **Generations**, **Video Generation Prompt Overrides**.

Na aba **Videos**, cada clipe toca ali mesmo e mostra a duração e o nome do modelo. Você pode fixar um clipe com **Pin video to chat** ou salvá-lo com **Download scene video**. Se ainda não houver nenhum clipe, a aba mostra **No videos yet**.

Se você tentar criar um vídeo sem nenhuma imagem no chat, Marinara mostra esta mensagem: "Add or generate a gallery image before generating a scene video." Gere ou faça upload de uma imagem antes e tente de novo.

## Vídeo de cena no Game Mode

O Game Mode tem um segundo lugar para criar um vídeo de cena: o painel **Game Assets**. Abra esse painel pelo botão **Game Assets**, nos controles do jogo.

1. Abra o painel **Game Assets**.
2. Clique em **Generate video**. A dica desse botão diz "Generate a scene video from the latest illustration."
3. O clipe mais recente toca no painel assim que fica pronto.

O botão **Generate video** fica inativo até o jogo ter uma conexão de vídeo e uma ilustração de cena. Se você clicar cedo demais, pode ver uma destas mensagens:

- "Choose a Video Generation connection in Game Settings first." Defina uma conexão de vídeo para o jogo.
- "Generate a scene illustration before generating a scene video." Crie uma imagem antes.

Se um clipe falhar, o painel mostra "Scene video generation failed." Tente de novo e, se o erro continuar, confira a conexão e a chave de API.

## Escolher a conexão de vídeo de um chat

Cada chat tem a própria conexão de vídeo. Essa escolha fica em **Chat Settings** (configurações do chat), depois **Agents** e depois **Scene Videos**.

Nos chats de **Roleplay**, o cartão **Scene Videos** é descrito como "Generate manual MP4 scene videos from gallery images." Ele tem um controle só, o menu suspenso **Video Connection**. Escolha ali a conexão de Video Generation.

Nos chats de **Game Mode**, o cartão **Scene Videos** é descrito como "Generate MP4 scene videos from game illustrations." Esse tem mais controles:

- **Video Connection**: a conexão de Video Generation que este jogo usa.
- **Game Video Prompt**: o modelo de prompt que decide como a imagem se anima. O padrão embutido é **Cinematic Scene Video**.
- **Edit Video Presets**: adicione e edite cópias próprias do modelo de prompt de vídeo para este chat.

O **Game Video Prompt** continua comandando os vídeos manuais da galeria e do painel Game Assets no Game Mode. As animações da galeria no Roleplay usam a configuração **Roleplay Gallery Animation Director**. O agente Storyboard instalado tem um **Storyboard Video Prompt** padrão próprio, e cada chat de Roleplay ou de Game pode trocá-lo em **Chat Settings > Agents > Storyboards**. Redefinir essa escolha traz de volta o padrão do agente Storyboard, e não o prompt de outro chat.

Ao criar um chat de Game Mode, o assistente de configuração também traz o seletor **Video Generation Connection**. Ele fica na etapa **Features** e aparece depois que você ativa a opção **Visual Generation**.

Quando o chat não tem conexão de vídeo própria, Marinara recorre à conexão marcada com **Use as default video connection**. Sem conexão no chat e sem padrão, as ações de vídeo mostram um aviso pedindo que você escolha uma.

## Configurações de geração de vídeos

Alguns padrões de vídeo ficam nas configurações do aplicativo, não na conexão. Abra **Settings**, depois **Generations** e então a seção **Video Generation**. A descrição dela é "Set default clip lengths and edit reusable video prompts for Game, Gallery, and Calls."

A principal configuração de vídeo de cena aqui é **Scene video fallback length**, que vem com 10 segundos por padrão. Ela só entra em ação quando a conexão de vídeo escolhida não tem duração própria. O valor vai de 1 a 60 segundos.

Esta seção também guarda **Video Generation Prompt Overrides**, onde você edita os modelos de prompt de vídeo reaproveitáveis. A configuração **Roleplay Gallery Animation Director** controla as instruções enviadas ao modelo escolhido no seletor **Prompt Model** antes de gerar um clipe da galeria no Roleplay. A variável `${durationSeconds}` dela é substituída pela duração escolhida para o clipe. É a forma avançada de mudar o movimento dos clipes sem mexer em código.

A mesma seção tem a configuração **Animated expression length**. Ela pertence a outro recurso, os sprites animados de retrato. O sprite é a imagem do personagem no palco. Veja [Expressões animadas](animated-expressions.md) para conhecer esse recurso.

## Storyboards

O agente Storyboard, que você baixa à parte, monta imagens de quadro-chave em ordem e clipes no Roleplay e no Game Mode. O Game Mode usa um turno já concluído do GM (o mestre do jogo); o Roleplay reúne trocas concluídas em um episódio embutido. Com as animações ativadas, Marinara anima cada quadro-chave bem-sucedido com a conexão de vídeo escolhida e o **Storyboard Video Prompt** do agente.

Os storyboards têm controles próprios e um guia próprio. Veja o [Guia do agente Storyboard](../game/storyboard.md) para a instalação e os fluxos de trabalho dos dois modos.

## Solução de problemas

### "Choose a Video Generation connection"

O chat está sem conexão de vídeo selecionada. Abra **Chat Settings**, depois **Agents** e então **Scene Videos**, e escolha uma conexão. Se o menu suspenso estiver vazio, adicione uma conexão em **Settings** e depois **Connections**.

### "Add or generate a gallery image before generating a scene video"

O vídeo de cena sempre anima uma imagem que já existe. Use o botão **Illustrate**, faça upload de uma imagem ou clique em **Animate illustration** em uma imagem que você já tem.

### O vídeo demora muito

Isso é normal. O provedor inicia o trabalho, e Marinara aguarda e verifica até o clipe ficar pronto. Veo, xAI, OpenRouter, Atlas Cloud e Seedance funcionam assim, e um clipe leva alguns minutos.

### O Seedance não consegue ler a imagem de referência

O Seedance precisa de um link público para a imagem. Em um servidor local, abra a conexão do Seedance e ative a opção **Upload Seedance reference frames temporarily**. Veja a seção sobre o Seedance, acima.

### Uma requisição de vídeo falha sempre

Confira se a conexão tem uma chave de API válida e se a conta tem acesso a vídeo. Abra a conexão em **Settings**, depois **Connections**, e confirme a chave e o modelo. Os tempos limite de vídeo no servidor estão na [Referência de configuração do servidor](../CONFIGURATION.md).

## Guias relacionados

- [Expressões animadas](animated-expressions.md)
- [Guia do agente Storyboard](../game/storyboard.md)
- [Storyboards com LTX 2.3 no Game Mode](../game/ltx-2-3-storyboards.md)
- [Provedores de IA compatíveis](../connections/providers-reference.md)
- [Referência de configuração do servidor](../CONFIGURATION.md)
