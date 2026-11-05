# Geração de vídeo de cena

Um vídeo de cena é um clipe MP4 curto da cena. Ele pode animar uma imagem da galeria, usando a imagem como primeiro quadro enquanto a IA acrescenta o movimento. Em Roleplay, ele também pode ser criado só a partir da história. Este guia mostra como configurar um serviço de vídeo, criar clipes pela galeria e pelo Game Mode e mudar as configurações de vídeo.

Os vídeos de cena funcionam nos chats de Roleplay e de Game Mode. Já os chats de Conversation enviam mensagens de vídeo. Veja [Mensagens de vídeo](../conversation/selfies.md#video-messages).

O Game Mode e **Animate illustration** (animar a ilustração) sempre partem de uma imagem, então gere ou faça upload de uma antes. Em Roleplay, `/video` e o botão **Video** da galeria seguem a configuração **First frame** (primeiro quadro) do Illustrator. Sem um First frame escolhido, eles não precisam de imagem.

Os vídeos de cena usam um tipo de conta à parte, **Video Generation** (geração de vídeo), e não a geração de imagens comum. Os clipes prontos são salvos com o chat e aparecem na galeria, onde você pode fixar, baixar ou assistir a cada um.

## Configure um serviço de vídeo

1. Clique em **Connections** (Conexões) na barra superior e depois em **Add** (adicionar). A janela **Add account** (adicionar conta) abre.
2. Escolha um serviço na seção **Images & video** (imagens e vídeo). Os serviços estão listados abaixo.
3. Cole a chave de API de um serviço em nuvem. O ComfyUI local não precisa de chave. O SwarmUI só precisa de um Swarm Auth Token se o seu servidor exigir uma conta.
4. Clique em **Connect** (conectar) e depois escolha um modelo ou mantenha o padrão. O NanoGPT não tem padrão, então escolha um na lista dele. No ComfyUI, deixe o modelo sem definir, a menos que o fluxo de trabalho use `%model%`. No SwarmUI, o modelo é opcional.
5. Abra o modelo de vídeo e clique em **Test video** (testar vídeo) para conferir.

Cada serviço preenche um endereço padrão e, quando faz sentido, um modelo padrão. O NanoGPT não tem modelo padrão, então escolha um.

| Serviço de vídeo | Modelo padrão | Observações |
| --- | --- | --- |
| **Google AI Studio** | `gemini-omni-flash-preview` | Roda os modelos Gemini Omni e Veo pela API do Gemini. |
| **xAI Imagine** | `grok-imagine-video-1.5` | Vídeo do Grok Imagine pela API de vídeos da xAI. |
| **OpenRouter Video** | `google/veo-3.1` | Você pode digitar o ID de qualquer modelo de vídeo do OpenRouter. |
| **NanoGPT** | nenhum, escolha um | Modelos de vídeo pelo NanoGPT. |
| **Atlas Cloud** | `google/veo3.1/text-to-video` | Modelos hospedados de texto para vídeo e de imagem para vídeo. |
| **Seedance 2.0** | `seedance-2-0` | Modos por texto, por primeiro quadro e por primeiro e último quadro. |
| **ComfyUI** | definido pelo fluxo de trabalho | Fluxos de trabalho de vídeo locais do WAN e outros, em formato de API. |
| **SwarmUI** | definido pelo fluxo de trabalho | Fluxos de trabalho de vídeo do ComfyUI pelo seu servidor SwarmUI. |

O **Google AI Studio** abrange duas famílias. **Gemini Omni** usa `gemini-omni-flash-preview`. **Google Veo** usa `veo-3.1-generate-preview`. O modelo que você escolhe decide qual delas roda.

No **ComfyUI**, use `http://127.0.0.1:8188` e cole um fluxo de trabalho de vídeo em formato de API em **ComfyUI workflow (required)** (fluxo de trabalho do ComfyUI, obrigatório). Ele é obrigatório. Veja [Configuração de workflows do ComfyUI](comfyui.md#comfyui-video-workflows) para conhecer os marcadores e os nós de saída.

No **SwarmUI**, Marinara preenche `http://127.0.0.1:7801`. Cole um fluxo de trabalho de vídeo em formato de API em **ComfyUI workflow (required)**. Ele é obrigatório. O SwarmUI não consegue usar os marcadores `%reference_image_name%`, então use `%reference_image%`. Se o seu servidor exigir uma conta, cole um Swarm Auth Token em **API key** (chave de API).

### Defina como modelo de vídeo padrão

Para usar um modelo de vídeo quando o chat não tem um próprio, ajuste a tarefa **Video** em **Defaults** (padrões), no topo do painel **Connections**. Em Chat Settings, ela aparece como **Default video provider** (provedor de vídeo padrão). Sem um modelo no chat e sem um padrão, as ações de vídeo avisam para você escolher um.

### Video prompting instructions

Cada modelo de vídeo tem uma caixa **Video prompting instructions** (instruções de prompt de vídeo). Diga ali à IA que escreve os seus prompts de vídeo o que o seu modelo de vídeo espera, como movimentos de câmera, tamanho do prompt ou som. Ela orienta as animações da galeria no Roleplay, as mensagens de vídeo do Conversation e o **Image-aware shot planning** (planejamento de tomadas com base na imagem) do Storyboard. Se a IA copiar uma frase inteira dela para o prompt, Marinara remove essa frase. Os vídeos de cena do Game Mode, os clipes das chamadas e as expressões animadas escrevem os prompts deles separadamente e a ignoram.

### Padrões de vídeo por modelo

Um modelo de vídeo tem um painel **Video defaults** (padrões de vídeo) para a duração padrão do clipe, a proporção e a resolução. Esses padrões têm prioridade sobre a duração de reserva do aplicativo inteiro.

Duração padrão, faixa de duração, proporção e resolução de cada serviço:

- Gemini Omni: 10s, 1 a 60s, 16:9, resolução padrão do provedor.
- Google Veo: 8s, 4, 6 ou 8s, 16:9, 720p.
- xAI Imagine: 10s, 1 a 15s, 16:9, 720p.
- OpenRouter Video: 10s, 1 a 60s, 16:9, 720p.
- Atlas Cloud: 8s, 1 a 60s, 16:9, 720p.
- Seedance 2.0: 5s, 4 a 15s, 16:9, 720p.
- ComfyUI e SwarmUI: 5s, 1 a 60s, 16:9, 720p.

O Gemini Omni não tem campo de resolução, e a duração dele vai no texto do prompt. O Google Veo força 8 segundos sempre que anima uma imagem de referência, porque precisa de 8 segundos para misturar o primeiro e o último quadro.

<a id="seedance-reference-frames"></a>

### Quadros de referência do Seedance

O Seedance precisa buscar a sua imagem de referência por um link público na web. Um servidor local do Marinara não tem um, então as instalações locais simples exigem um passo a mais.

1. Abra o modelo do Seedance.
2. Ative **Upload Seedance reference frames temporarily** (enviar temporariamente os quadros de referência do Seedance). O quadro vai para um link público temporário.
3. Opcional: defina **Temporary link lifetime** (validade do link temporário). O padrão é 12 horas.

Se o seu servidor Marinara já tiver um endereço público, você pode definir uma variável de ambiente em vez disso. Veja a [Referência de configuração do servidor](../CONFIGURATION.md).

## Gere um vídeo pela galeria

Os chats de Roleplay e de Game Mode podem criar vídeos de cena pela galeria. Abra **Chat Settings** (configurações do chat) e expanda **Gallery** (galeria). A galeria tem uma aba **Images** e uma aba **Videos**, cada uma com um contador.

### No Roleplay

**Video**, na linha de ações no topo da galeria, cria um clipe da resposta mais recente, como `/video`. Acrescente uma descrição depois de `/video` para dizer o que o clipe deve mostrar.

- **First frame**: segue a configuração **First frame** do Illustrator. Pode ser uma nova imagem do Illustrator da resposta mais recente (desenhada primeiro e depois animada), o avatar ou sprite do personagem, ou nenhuma imagem. Sem nenhuma escolhida, o clipe é criado só a partir da história.
- **Avatar**: o clipe parte de quem a sua descrição mencionar primeiro, incluindo a sua persona. Basta uma parte do nome que ninguém mais compartilhe, com inicial maiúscula ("Lena" para "Dr. Lena Kowalski"). Sem ninguém mencionado, ele parte do personagem do chat.
- **Revisão**: com **Expose media prompts before sending** (mostrar os prompts de mídia antes de enviar) ativado, você pode revisar e editar o prompt do clipe antes.
- **Contexto**: a IA lê a mesma quantidade de mensagens recentes que o Illustrator lê para uma imagem (o **Context Size** do Illustrator, em **Agent Budget**, na tela de configuração dele).
- **Sem imagem**: quando o clipe parte de nenhuma imagem ou de um avatar, a IA descreve a própria cena. As instruções dela são o **Roleplay Clip Director**, em **Settings → Generations → Video Generation Prompt Overrides** (Configurações → Gerações → Substituições de prompt de geração de vídeos).

O clipe pronto toca no próprio chat, abaixo da resposta mais recente, mesmo quando a imagem veio de uma resposta anterior. Os clipes não abrem sozinhos em uma janela flutuante. Para deixar um flutuando, use **Pin video to chat** (fixar o vídeo no chat) em **Videos**. Para tirar um clipe de uma mensagem, use o botão **X** dele. O clipe continua na galeria.

### No Game Mode

1. Verifique se há pelo menos uma imagem em **Images**. Use **Illustrate** (ilustrar) ou faça upload de uma.
2. Clique em **Video** na linha de ações no topo da galeria.
3. Se **Expose media prompts before sending** estiver ativado (**Settings → Generations → Overall Generations**), revise ou edite o prompt e clique em **Generate** (gerar). Cancelar não inicia nenhuma requisição.
4. O botão mostra **Generating...**, e uma faixa avisa que a geração de vídeo está em andamento.
5. Quando terminar, o clipe aparece em **Videos**.

Se não houver imagem, Marinara diz "Add or generate a gallery image before generating a scene video." Crie ou faça upload de uma e tente de novo.

### Animar uma imagem

1. Abra a aba **Images**.
2. Passe o mouse sobre a imagem.
3. Clique em **Animate illustration** (o ícone de filme).

Com a revisão de prompt ativada, uma janela mostra o prompt exato compilado, a duração, a proporção e a resolução daquela imagem. A sua edição vale só para aquele clipe. Em Roleplay, a IA que planeja o movimento lê a mesma quantidade de mensagens recentes que o Illustrator, terminando na resposta à qual a imagem pertence. As instruções reaproveitáveis dela são o **Roleplay Gallery Animation Director**, em **Settings → Generations → Video Generation Prompt Overrides**.

Cada clipe em **Videos** toca ali mesmo, com a duração e o nome do modelo. Use **Pin video to chat** ou **Download scene video** (baixar o vídeo de cena). Sem clipes, a aba mostra **No videos yet** (ainda não há vídeos).

## Como escolher um serviço

Os oito serviços criam clipes curtos a partir da sua imagem.

- **Google AI Studio (Gemini Omni)**: duração de até 60 segundos, escrita no prompt.
- **Google AI Studio (Veo)**: qualidade alta, fixa em 4, 6 ou 8 segundos. Usa 8 quando anima uma imagem.
- **xAI Imagine**: de 1 a 15 segundos, com um limite de tamanho do prompt menor que o dos outros.
- **OpenRouter Video**: de 1 a 60 segundos, com qualquer modelo de vídeo que a sua conta aceite.
- **NanoGPT**: de 1 a 60 segundos, sem modelo padrão.
- **Atlas Cloud**: carrega o catálogo atual de vídeo do Atlas Cloud, com os modelos de imagem para vídeo primeiro, cada um com o preço inicial por segundo de vídeo gerado. Se não conseguir, Marinara mostra os modelos iniciais Veo 3.1 e Seedance 2.0. Você pode digitar o ID exato de um modelo. Os limites do modelo continuam valendo.
- **Seedance 2.0**: de 4 a 15 segundos, com os modos de primeiro quadro e de primeiro e último quadro. Precisa de um link público para a sua imagem de referência.
- **ComfyUI**: local, pelo seu fluxo de trabalho em formato de API. Marinara envia a imagem de referência direto quando o fluxo de trabalho usa `%reference_image_name%`.
- **SwarmUI**: local, pelo seu fluxo de trabalho e pelo seu servidor SwarmUI. A imagem de referência entra por meio de `%reference_image%`.

Os trabalhos de vídeo demoram. O serviço inicia o trabalho, e Marinara aguarda e verifica até o clipe ficar pronto. Um clipe pode levar vários minutos. Modelos WAN locais grandes talvez precisem de mais que os 30 minutos padrão. Aumente `VIDEO_GEN_TIMEOUT_MS` e reinicie Marinara.

### Diferenças entre os modelos do Atlas Cloud

Os modelos do Atlas Cloud não aceitam todos as mesmas configurações. Antes de cada requisição, Marinara lê o esquema de entrada publicado do modelo em `static.atlascloud.ai` e adapta os seus padrões a ele.

- A imagem de origem vai no campo de imagem que aquele modelo usa.
- A duração do clipe muda para a duração mais próxima que o modelo oferece. Um modelo limitado a 5 ou 10 segundos transforma um padrão de 8 segundos em 10.
- A resolução muda para o nível mais próximo que o modelo oferece. Os modelos que recebem um tamanho em pixels recebem o `width*height` mais próximo da sua proporção e resolução.
- Uma configuração que o modelo não tem fica de fora, então vale o padrão do próprio modelo.

O log do servidor lista cada valor alterado em uma linha que começa com `[video-gen/atlas-cloud] fitted request`. Se não for possível ler o esquema, Marinara envia a mesma requisição geral de antes.

Escolha um modelo de imagem para vídeo para os vídeos de cena. Um modelo de texto para vídeo não tem campo de imagem. Ele ignora a sua imagem e cria um clipe sem relação com ela a partir do prompt, e o log do servidor avisa isso. **Test video** envia um gradiente simples como primeiro quadro quando o modelo exige uma imagem, então os modelos de imagem para vídeo podem passar no teste.

Muitos modelos do Atlas Cloud têm entradas próprias, como `negative_prompt`, `seed`, `generate_audio`, `shot_type`, `enable_prompt_expansion` ou listas de LoRA.

1. Abra o modelo do Atlas Cloud e escolha ou digite um modelo.
2. Expanda **Video defaults** e depois **Atlas Cloud setup** (configuração do Atlas Cloud).
3. Encontre **Model options** (opções do modelo) abaixo dos controles de duração, proporção e resolução.

A parte superior de **Model options** lista as durações, as resoluções, os tamanhos de quadro e as proporções que o modelo aceita. Um modelo de texto para vídeo também mostra um aviso. Cada opção usa o nome e a descrição do próprio Atlas Cloud e começa em **Model default** (padrão do modelo), com o valor padrão entre parênteses. Uma opção deixada em **Model default** não é enviada. Altere uma opção para enviar o seu valor em todos os vídeos deste modelo, inclusive em **Test video**. Entradas de listas e objetos, como LoRAs, recebem JSON.

As escolhas são salvas por modelo. **Reset model options** (redefinir as opções do modelo) limpa as escolhas do modelo atual. Clique em **Save** (salvar) para manter as suas alterações. Se uma opção salva não servir mais para o modelo, Marinara a deixa de fora e informa o nome dela na linha do log.

## Gere um vídeo em Game Assets

O Game Mode tem um segundo lugar para criar um vídeo de cena, o **Game Assets**. Clique no botão de pasta dele, perto do canto superior direito do chat. Ele abre como uma janela no computador e como um painel de largura total no celular. Se você o moveu para Chat Settings, abra a seção **Game Assets** ali.

1. Abra **Game Assets**.
2. Clique em **Generate video** ("Generate a scene video from the latest illustration").
3. O clipe mais recente toca ali quando fica pronto.

**Generate video** (gerar vídeo) fica inativo até o jogo ter um modelo de vídeo e uma ilustração de cena. Se você clicar cedo demais, pode ver "Choose a Video Generation connection in Game Settings first." (defina um modelo de vídeo para o jogo) ou "Generate a scene illustration before generating a scene video." Se um clipe falhar, o painel mostra "Scene video generation failed." Tente de novo e, se continuar falhando, confira a sua chave.

## Escolha um modelo de vídeo para um chat

Cada chat escolhe o próprio modelo de vídeo em **Chat Settings → Agents → Scene Videos** (configurações do chat → agentes → vídeos de cena).

- O **Roleplay** mostra um cartão **Scene Videos** ("Generate manual MP4 scene videos from gallery images"). Ele tem um controle só, a lista de modelos de vídeo.
- O **Game Mode** mostra um cartão **Scene Videos** ("Generate MP4 scene videos from game illustrations") com mais controles. A lista de modelos de vídeo escolhe o modelo. **Game Video Prompt** é o modelo de prompt que decide como a imagem se anima. O padrão embutido é **Cinematic Scene Video**. **Edit Video Prompt Presets** (editar os presets de prompt de vídeo) adiciona e edita as suas próprias cópias para este chat.

**Game Video Prompt** controla os vídeos manuais da galeria e do Game Assets no Game Mode. As animações da galeria no Roleplay usam o **Roleplay Gallery Animation Director**. O agente Storyboard tem o próprio **Storyboard Video Prompt** padrão. Cada chat pode substituí-lo em **Chat Settings → Agents → Storyboards**. Redefinir volta ao padrão do agente Storyboard.

Ao criar um chat de Game Mode, o assistente de configuração tem um seletor de modelo de vídeo na etapa **Features** (recursos), depois que você ativa a geração visual.

## Configurações de geração de vídeo

Alguns padrões de vídeo valem para o aplicativo inteiro. Abra **Settings → Generations** e encontre **Video Generation** ("Set default clip lengths and edit reusable video prompts for Game, Gallery, and Calls").

- **Scene video fallback length** (duração de reserva do vídeo de cena): usada só quando o modelo de vídeo selecionado não tem duração própria. O padrão é 10 segundos. A faixa vai de 1 a 60.
- **Video Generation Prompt Overrides**: edita os modelos reaproveitáveis de prompt de vídeo. **Roleplay Gallery Animation Director** define as instruções enviadas ao Prompt Model antes de um clipe da galeria no Roleplay. A variável `${durationSeconds}` dele vira a duração do clipe.
- **Videos per reply** (vídeos por resposta): quantas mensagens de vídeo os personagens de Conversation podem enviar em uma resposta e quantos clipes o Illustrator acrescenta a uma resposta de Roleplay. O padrão é 3. A faixa vai de 1 a 10. Cada personagem de Conversation envia no máximo um. A opção existe para chats em grupo e para quando você pede vários vídeos de uma vez. Aumente para deixar mais personagens enviarem um clipe. Diminua para economizar requisições. Os clipes acima do limite são ignorados. `/video` e o botão **Video** da galeria não entram nessa contagem.
- **Animated expression length** pertence aos sprites animados de retrato. Veja [Expressões animadas](animated-expressions.md).

## Storyboards

O agente Storyboard, que você baixa à parte, monta imagens de quadro-chave em ordem e clipes no Roleplay e no Game Mode. Com as animações ativadas, Marinara anima cada quadro-chave bem-sucedido com o modelo de vídeo selecionado e o **Storyboard Video Prompt** do agente. Veja o [Guia do agente Storyboard](../game/storyboard.md).

## Solução de problemas

### "Choose a Video Generation connection"

O seu chat não tem modelo de vídeo. Abra **Chat Settings → Agents → Scene Videos** e escolha um. Se a lista estiver vazia, adicione um em **Connections**.

### "Add or generate a gallery image before generating a scene video"

O Game Mode e **Animate illustration** precisam de uma imagem existente. O Roleplay pode criar um clipe só a partir da história quando nenhum primeiro quadro está escolhido. Use **Illustrate**, faça upload de uma imagem ou clique em **Animate illustration** em uma que você já tem.

### O vídeo demora muito

Isso é normal. Google, xAI, OpenRouter, NanoGPT, Atlas Cloud e Seedance iniciam um trabalho, e Marinara espera por ele. Um clipe pode levar vários minutos.

### O Seedance não consegue ler a imagem de referência

O Seedance precisa de um link público para a sua imagem. Em um servidor local, ative **Upload Seedance reference frames temporarily** no modelo do Seedance. Veja [Quadros de referência do Seedance](#seedance-reference-frames).

### Uma requisição de vídeo falha sempre

Confira se a conta tem uma chave de API válida e acesso a vídeo. Abra a conta em **Connections** e confirme a chave e o modelo. Para os tempos limite do servidor, veja a [Referência de configuração do servidor](../CONFIGURATION.md).

## Guias relacionados

- [Expressões animadas](animated-expressions.md)
- [Guia do agente Storyboard](../game/storyboard.md)
- [Storyboards com LTX 2.3 no Game Mode](../game/ltx-2-3-storyboards.md)
- [Provedores de IA compatíveis](../connections/providers-reference.md)
- [Referência de configuração do servidor](../CONFIGURATION.md)
