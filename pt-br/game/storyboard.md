# Guia do agente Storyboard

O agente **Storyboard**, disponível para download, transforma o texto já concluído da história em imagens de quadros-chave em ordem e, se você quiser, em clipes curtos de imagem para vídeo. Ele funciona no Game Mode e no Roleplay. Os chats de Conversation não o usam.

O pacote do Storyboard traz os prompts de planejamento, os valores padrão e os controles de cada chat. Marinara cuida da geração das mídias, salva os resultados na Gallery (a galeria) e os mostra no chat ou no visualizador do Game. Este guia trata primeiro do Game Mode. O fluxo de trabalho do Roleplay vem depois, em [Storyboards no Roleplay](#roleplay-storyboards). Para o restante do Roleplay, veja [Roleplay Mode: primeiros passos](../roleplay/getting-started.md).

- **Game Mode** usa um turno concluído de narração do GM, o mestre do jogo. Ele tem os botões liga/desliga separados **Automatic Storyboard Illustrations** e **Automatic Storyboard Animations**, além de **Gallery → Create storyboard** (galeria → criar storyboard) para o último turno do GM. O storyboard aparece em um visualizador flutuante ou como plano de fundo do Game, em sincronia com a narração, e usa planejadores separados para imagens estáticas e para animações.
- **Roleplay** usa as mensagens concluídas desde o último episódio bem-sucedido. As opções automáticas dele são **Manual only**, **Still images** ou **Animations**, e **Gallery → Create storyboard** funciona com a última resposta concluída do assistente. O storyboard aparece dentro do chat, abaixo da resposta que encerra o episódio, e usa um episode contract, um visual style, um animation addon opcional e um output contract.

Nos dois modos, as imagens dos quadros-chave são salvas na aba **Images** da Gallery, e os clipes na aba **Videos**.

## Instalar o agente

1. Abra o painel **Agents** (agentes) pelo ícone de estrelinhas.
2. Selecione **Agent Organizer** (organizador de agentes).
3. Abra **Storyboard** e selecione **Install** (instalar).
4. Abra um chat de Game ou de Roleplay e depois **Chat Settings → Agents** (configurações do chat → agentes).
5. Ative **Enable Agents** (ativar agentes) e depois, no cartão do Storyboard, **Enable Storyboards** (ativar os storyboards).

Instalar deixa o agente disponível, mas não o ativa em todos os chats. Não é preciso reiniciar o Marinara.

Se não funcionou e o Storyboard não aparece em Chat Settings, verifique se o pacote está instalado, se o chat é de Game ou de Roleplay e se a versão do pacote funciona com a sua versão do Marinara.

## Storyboards no Game Mode

No Game Mode, o Storyboard usa exatamente um turno concluído de narração do GM como origem da história. Ele remove as tags de comando ocultas do GM, planeja os quadros em ordem e liga cada quadro a um intervalo de trechos legíveis do turno. O visualizador troca de quadro conforme a leitura avança por esses trechos.

### Criar um storyboard no Game

**Antes de começar:** o jogo precisa de uma conta de imagem (a do próprio Game ou uma da configuração global do Storyboard). Veja [Provedores de geração de imagens](../media/image-providers.md).

1. Instale o Storyboard e abra um chat de Game Mode.
2. Abra **Chat Settings → Agents**, ative **Enable Agents** e depois **Enable Storyboards**.
3. Termine um turno de narração do GM.
4. Abra **Chat Settings → Gallery** e selecione **Create storyboard**.

Selecione **View storyboard** (ver storyboard) na Gallery para reabrir um visualizador que você fechou. A geração manual segue a configuração de animação do momento: com **Automatic Storyboard Animations** ativado, um storyboard manual também pede os clipes.

Se não funcionou, veja [Solução de problemas](#troubleshooting).

### Storyboards automáticos no Game

O cartão do Storyboard tem dois botões liga/desliga:

- **Automatic Storyboard Illustrations** cria quadros-chave estáticos depois de um turno concluído do GM.
- **Automatic Storyboard Animations** cria também um clipe para cada quadro-chave. Ligar as animações liga as ilustrações, e desligar as ilustrações desliga as animações.

A geração automática só roda enquanto o agente está ativo naquele jogo, e não refaz o storyboard de um turno que já tem um. Use a ação manual da Gallery quando quiser outro storyboard do último turno.

Com **Expose media prompts before sending** (mostrar os prompts de mídia antes de enviar) ativado nas configurações de geração, um storyboard manual do Game pode mostrar os prompts de imagem compilados para revisão. Os storyboards automáticos pulam a revisão, para não interromper a partida.

### Configurações do Game

Abra **Chat Settings → Agents → Storyboards**.

| Configuração | Padrão do agente | O que controla |
| --- | --- | --- |
| **Enable Storyboards** | Off em cada chat | Ativa o agente instalado neste jogo. |
| **Automatic Storyboard Illustrations** | Vem de Automatic generation | Quadros-chave estáticos depois de cada turno do GM. |
| **Automatic Storyboard Animations** | Vem de Automatic generation | Clipes MP4 para cada quadro-chave. |
| **Keyframes per Turn** | 3 (de 1 a 200) | Número desejado de quadros. Turnos curtos podem render menos. |
| **Animation Clip Duration** | 5 segundos (de 1 a 15) | Duração pedida para cada clipe. O serviço pode limitá-la. |
| **Viewer Display** | Floating | Visualizador arrastável ou o plano de fundo inteiro do Game. |
| **Illustration Planner** | Still Keyframes | Planeja ilustrações estáticas finalizadas. |
| **Animation Planner** | Comic Page Animation | Planeja primeiros quadros prontos para animar e as direções de movimento. |
| **Use Storyboard Template** | On | Aplica o formatador final de ilustração selecionado. |
| **Storyboard Illustration Prompt** | Game Scene Illustration | Formata o quadro planejado para o serviço de imagem. |
| **Storyboard Video Prompt** | Cinematic Scene Video | Formata o primeiro quadro e o plano de movimento para o serviço de vídeo. |

O pacote traz ainda planejadores voltados para NovelAI, quadrinhos, mangá, anime e LTX. Escolher um planejador de animação não liga os vídeos sozinho. Ainda são necessários **Automatic Storyboard Animations** e uma conta de vídeo.

Cada chat pode substituir os padrões do agente. Em Chat Settings, os valores herdados aparecem marcados como **Using agent default**, e um controle de redefinição surge assim que você substitui um deles.

### Como um storyboard do Game é montado

O Game Mode mantém planejadores separados para imagens estáticas e para animações.

```text
completed GM narration
  -> still or animation planner
  -> Storyboard Illustration Prompt
  -> image account
  -> optional Storyboard Video Prompt
  -> video account
```

O planejador escolhe os momentos da história e os coloca em ordem. O prompt de ilustração é um formatador voltado ao serviço, não outro planejador. Com as animações ativadas, o planejador de animação cria uma descrição exata do primeiro quadro e uma direção de movimento, e o prompt de vídeo transforma essa direção no pedido final.

### O visualizador do Game

- **Floating viewer** (visualizador flutuante) é um painel arrastável e redimensionável sobre o jogo. Ele acompanha o ponto da narração em que você está lendo e mostra o quadro correspondente. O vídeo toca quando fica pronto; até lá, aparece a imagem do quadro. Fechar o visualizador o esconde no turno atual. Use **Gallery → View storyboard** para reabri-lo.
- **Game background** (plano de fundo do Game) coloca o quadro ativo atrás do restante da tela. Enquanto está ligado, ele substitui o plano de fundo de cena gerado, então **Generate background** fica indisponível. Os clipes de fundo tocam uma vez e ficam parados no último quadro.

Para repetir, reproduzir/pausar e silenciar, abra **Game controls** (controles do jogo), o botão de controle de videogame perto do canto superior direito do chat. Ele abre como uma janela no computador ou como um painel no celular. Se você o moveu para Chat Settings, abra ali a seção **Game controls**.

### A apresentação Storyboard Optimized não é o botão do agente

No assistente de configuração, a apresentação **Storyboard Optimized** muda o prompt de narração do GM para que os turnos tragam âncoras visuais mais fáceis de filmar. Ela não instala nem ativa o Storyboard, não liga as mídias automáticas e não escolhe as contas de imagem e de vídeo. Você pode usar o agente tanto com **Standard** quanto com **Storyboard Optimized**. Instale e ative o agente à parte.

### Receitas para o Game Mode

Cada receita combina uma cadeia do Storyboard com as demais configurações do Game e do serviço. Aplique a cadeia indicada se o pacote a oferecer, ou escolha manualmente as opções da lista.

#### Storyboards de quadrinhos com o Google

Cadeia: **Illustration Planner** Still Keyframes, **Animation Planner** Comic Page Animation, **Storyboard Illustration Prompt** Game Scene Illustration, **Storyboard Video Prompt** Comic Page Video, **Use Storyboard Template** On.

Lista de conferência do Game:

- **Illustrator**: On (etapa Features do assistente)
- Conta de imagem: Google/Nano Banana, **Image Style**: Default, e mantenha o estilo de arte criado na configuração
- **Automatic Storyboard Illustrations**: On
- **Automatic Storyboard Animations**: Off
- **Keyframes per Turn**: 3
- Conta de vídeo: None

Isso gera storyboards estáticos comuns. A cadeia de animação Comic Page salva só entra em ação se você escolher uma conta de vídeo mais tarde e ativar **Automatic Storyboard Animations**.

#### Tags diretas do NovelAI

Cadeia: **Illustration Planner** NovelAI Keyframes. Em **Storyboard Illustration Prompt**, crie uma opção personalizada cujo prompt contenha apenas o texto abaixo. Defina **Use Storyboard Template** como On. Deixe o Animation Planner e o Video Prompt como estão.

```text
${scenePrompt}
```

Lista de conferência do Game:

- **Image Style**: Danbooru, e remova do perfil Danbooru o **Style text** (texto de estilo) em prosa
- **Use Campaign Art Style**: Off
- **Attach Card Appearance**: Off
- **Send Avatar References**: Off
- **Use NovelAI Character Prompts**: Off
- **Queue media generation requests**: On
- Ajuste as tags positivas, as negativas e as de ilustração conforme a necessidade

O template de repasse direto envia as tags enxutas do NovelAI vindas do planejador, sem envolvê-las no formatador normal em prosa.

#### Krea 2 + LTX 2.3 locais

Cadeia: **Illustration Planner** Still Keyframes como alternativa só para imagens estáticas, **Animation Planner** LTX Simple Image-to-Video, **Storyboard Illustration Prompt** Storyboard First Frame, **Storyboard Video Prompt** Narration Passthrough, **Use Storyboard Template** On.

Em uma GPU com 8 GB de VRAM, comece com um quadro-chave em 480p. Depois que funcionar, avance para três quadros-chave e tamanhos maiores. Para a conta do ComfyUI, os marcadores e o teste completo, veja [Storyboards com LTX 2.3 no Game Mode](ltx-2-3-storyboards.md).

<a id="roleplay-storyboards"></a>

## Storyboards no Roleplay

No Roleplay, os storyboards reúnem as trocas de mensagens já concluídas em um episódio visual, mostrado abaixo da resposta do assistente que o encerra.

### Criar um storyboard no Roleplay

1. Instale o Storyboard e ative-o no chat de Roleplay.
2. Em **Chat Settings → Agents → Storyboards**, escolha uma **Prompt connection** (conexão de prompt) e um **Image model** (modelo de imagem). Se a configuração global estiver completa, você pode deixar os dois em **Use global default** (usar o padrão global).
3. Escolha um **Automatic mode** (modo automático):
   - **Manual only**: nenhum episódio automático. **Create storyboard** cria um episódio de imagens estáticas quando você pedir.
   - **Still images**: cria automaticamente um episódio ilustrado.
   - **Animations**: cria automaticamente as imagens dos quadros-chave e um clipe para cada quadro. É preciso ter uma conta de vídeo.
4. Ajuste **Messages per episode** e **Keyframes per episode**.
5. Termine uma nova resposta do assistente, ou abra **Chat Settings → Gallery** e selecione **Create storyboard**.

Use as setas de um storyboard com vários quadros-chave para passar de um quadro para outro. Um quadro animado mostra o clipe dentro do chat e volta à imagem enquanto o clipe está pendente ou indisponível.

### Como funciona o intervalo entre episódios

O intervalo é quantas mensagens novas do usuário e do assistente precisam se acumular entre dois storyboards automáticos bem-sucedidos. Os dois papéis contam, e o episódio inclui as mensagens novas em ordem. O padrão é 1, então a próxima resposta concluída do assistente já pode gerar um episódio. Um valor maior deixa mais diálogo e ação se acumularem. O texto de origem fica limitado às 20 mensagens mais recentes e a 12.000 caracteres, para que um chat longo não gere um pedido de planejamento sem limite.

O contador só avança depois que um storyboard completo ou parcial é salvo, então um episódio que falha não consome o texto de origem. Abrir um chat existente não recupera as respostas antigas. A geração automática espera uma nova resposta concluída do assistente.

### Biblioteca de prompts do Roleplay

O Roleplay monta um único pedido ao planejador a partir de quatro prompts selecionados:

| Configuração | Padrão | Para que serve |
| --- | --- | --- |
| **Episode contract** | Completed Roleplay Episode | Escolhe os momentos apoiados no texto de origem e os mantém na ordem das mensagens. |
| **Visual style** | Normal / Anime | A aparência de cada quadro-chave. Outros: NovelAI, Comic, Colored Manga, B&W Manga. |
| **Animation addon** | Simple Storyboard Motion | Usado só nos clipes. Acrescenta uma ação viável, o comportamento da câmera, o diálogo e o som do texto de origem, o clima do ambiente e uma pausa no fim. |
| **Output contract** | Roleplay Keyframe JSON | Os campos estruturados de quadro-chave que o planejador devolve. |

Depois, o **Storyboard Illustration Prompt** formata cada primeiro quadro para o serviço de imagem e, com os clipes ativados, o **Storyboard Video Prompt** formata o plano de movimento. Para editar esses prompts, abra a **Prompt library** (biblioteca de prompts) recolhida em Stage 1. Use **Add option** (adicionar opção) para criar um prompt personalizado e depois renomeie a opção, escreva uma descrição curta e edite o corpo. Você pode restaurar as opções nativas ao padrão. Editar um estilo visual do Roleplay não altera os planejadores do Game Mode.

### Storyboard e Illustrator juntos

O Storyboard é separado do Illustrator, e as ações manuais do Illustrator continuam disponíveis. Com o Storyboard do Roleplay em **Still images** ou **Animations**, Marinara pula a imagem automática comum do Illustrator naquela resposta, para que os dois não criem mídias concorrentes. **Manual only** mantém o caminho do Illustrator como está.

## Configurações do agente Storyboard

Abra o painel **Agents**, selecione **Storyboard** e abra a configuração dele. Esses valores são os padrões dos chats que não têm ajustes próprios.

| Configuração | Padrão | Para que serve |
| --- | --- | --- |
| Agent connection | A conta de agente que você selecionou | Planeja o storyboard com um modelo. |
| **Image model** | **Use the chat image connection** | Gera cada quadro-chave. É preciso ter uma conta de imagem em algum ponto da cadeia de alternativas. |
| **Video connection** | **Use the chat video connection** | Gera os clipes quando as animações estão ativadas. |
| **Automatic generation** | Still images | O comportamento automático inicial dos chats recém-ativados. |
| **Keyframes per turn** | 3 (de 1 a 200) | Número desejado de quadros em ordem. |
| **Clip seconds** | 5 (de 1 a 15) | Duração pedida para cada clipe. |
| **Viewer display** | Floating viewer | O padrão do visualizador do Game. O Roleplay sempre mostra os storyboards dentro do chat. |
| **Default Roleplay episode interval** | 1 (de 1 a 100) | Material novo do Roleplay necessário entre os episódios automáticos. |
| **Attach Card Appearance** | On | Acrescenta aos prompts de imagem a aparência dos personagens identificados. Um card ou uma persona com **Image Appearance Override** (aparência alternativa para imagens) ativado fornece esse texto no lugar do campo **Appearance**. |
| **Send Avatar References** | On | Envia os avatares dos personagens e das personas identificados quando o serviço de imagem aceita referências. |
| **Use the final image template** | On | Formata o quadro planejado antes de enviá-lo ao serviço de imagem. Em um chat de Game, é a opção **Use Storyboard Template**. |
| **Use NovelAI character prompts** | On | Prompt nativo por personagem, só nas contas oficiais compatíveis do NovelAI V4 e V4.5. Os outros serviços usam o caminho de prompt compartilhado. |

No Game Mode, a biblioteca tem duas trilhas de planejamento, escolhidas conforme o jogo cria imagens estáticas ou clipes: **Still planner** (padrão Still Keyframes) e **Animation planner** (padrão Comic Page Animation). O texto dos planejadores pode ser editado na configuração global do agente, e cada chat de Game escolhe entre as opções nas próprias configurações.

Depois do planejamento, os formatadores compartilhados criam os pedidos finais: **Default image prompt** (Game Scene Illustration) e **Default video prompt** (Cinematic Scene Video). Cada etapa numerada tem a própria **Prompt library** recolhida: Stage 2 para os formatadores de imagem, Stage 3 para os planejadores de movimento que consideram a imagem e Stage 4 para os formatadores que repassam o prompt de vídeo. As opções de imagem incluem também **Storyboard Illustration** e **Storyboard First Frame**. As de vídeo incluem **Anime Game Video**, **Comic Page Video** e **Narration Passthrough**. Os chats de Game e de Roleplay podem escolher formatadores diferentes.

O **Image-aware shot planning** (planejamento de tomadas com base na imagem) de Stage 3 também segue as **Video prompting instructions** (instruções de prompt de vídeo) da conta de vídeo. Use esse campo no editor da conta para dizer o que o seu modelo de vídeo espera, como termos de câmera, tamanho do prompt ou indicações de som.

As contas são escolhidas de um jeito um pouco diferente em cada modo. O Roleplay tem seletores de prompt, de imagem e de vídeo em cada chat, e **Use global default** herda a configuração do Storyboard. O Game Mode usa as próprias contas de planejamento, de imagem e de vídeo quando estão definidas e, se não, recorre aos padrões do agente. As imagens estáticas precisam de uma conta de imagem. As animações precisam de uma imagem de quadro-chave gerada com sucesso e de uma conta de vídeo.

## Prompts de imagem e coerência dos personagens

O planejador decide quais momentos mostrar e escreve o conteúdo visual de cada quadro. O template final de imagem acrescenta a estrutura voltada ao serviço, a aparência dos personagens identificados, o tratamento das referências, o contexto do lugar, a direção de arte da campanha e as instruções de imagem.

Quando o planejador já devolve exatamente a sintaxe que o serviço de imagem deve receber, use um template de repasse direto, como `${scenePrompt}`. Desative **Use the final image template** só quando quiser pular o formatador de propósito. As instruções de imagem obrigatórias continuam valendo.

Para personagens mais estáveis:

- Mantenha os campos Appearance dos cards de personagem específicos e atualizados.
- Deixe **Attach Card Appearance** ativado, a não ser que o planejador já repita os detalhes necessários.
- Deixe **Send Avatar References** ativado quando o serviço aceitar referências e os avatares combinarem com a aparência que você quer.
- Prefira poucos personagens, bem visíveis, em cada quadro. O Storyboard inclui só os personagens e as personas visíveis identificados, não todos os do chat.

## Custo e desempenho

Cada quadro-chave é uma tarefa de imagem separada. Os storyboards animados acrescentam uma tarefa de vídeo por quadro-chave bem-sucedido, então um storyboard animado de três quadros pode fazer três pedidos de imagem e três pedidos de vídeo. Ao testar um serviço novo ou uma configuração local, comece com imagens estáticas e um quadro-chave. Aumente o número de quadros, a duração dos clipes e o intervalo automático só depois que o caminho básico funcionar.

## Jogos do sistema antigo de storyboard

Chats de Game existentes podem conter configurações da antiga interface de storyboard nativa. Quando o pacote está instalado, Marinara mantém esses valores como ajustes próprios do chat, então um jogo antigo pode se comportar de um jeito diferente dos padrões atuais do agente. Abra **Chat Settings → Agents → Storyboards** e use o controle de redefinição de cada campo para que ele volte a seguir o padrão do agente. Essas configurações são apenas dados de migração. A geração continua exigindo o pacote instalado e ativo no jogo.

<a id="troubleshooting"></a>

## Solução de problemas

### O botão Create storyboard aparece, mas a geração falha

- Ative **Enable Agents** e **Enable Storyboards** no chat.
- Escolha uma conta válida de geração de imagens no cartão do Storyboard do Roleplay, nas configurações do Game ou na configuração global do Storyboard.
- Espere a resposta do assistente ou do GM terminar e tente de novo.

### O Roleplay não criou um episódio automático

- Escolha **Still images** ou **Animations**, e não **Manual only**.
- Espere uma nova resposta do assistente terminar. Abrir um chat não recupera as mensagens antigas.
- Confira **Messages per episode**. É preciso acumular mensagens novas do usuário e do assistente em quantidade suficiente.
- Uma execução que falha não avança o contador, então procure no log do servidor o erro original do serviço ou de leitura da resposta.

### As imagens aparecem, mas os vídeos não

- No Roleplay, escolha **Animations**. No Game Mode, ative **Automatic Storyboard Animations**.
- Escolha uma conta de Video Generation que aceite entrada de imagem para vídeo.
- Olhe a aba **Videos** da Gallery. O clipe pode ficar pronto depois da imagem do quadro-chave.
- Se o planejamento tiver recorrido à alternativa depois de uma falha do modelo, Marinara pode manter as imagens da alternativa e pular os vídeos daquela execução.

### O storyboard ficou incompleto ou travado

Uma tarefa do serviço pode ter falhado, estourado o tempo limite ou esbarrado em um limite de uso ou de conteúdo. Se o serviço estiver funcionando, mas lento, aumente `IMAGE_GEN_TIMEOUT_MS` ou `VIDEO_GEN_TIMEOUT_MS` no `.env` e reinicie o Marinara, porque esses valores são lidos na inicialização. Veja a [Referência de configuração do servidor](../CONFIGURATION.md).

Ative o modo Debug e procure por `storyboard` no log do servidor para ver o planejador, o prompt de imagem compilado, a escolha das referências e o prompt de vídeo. Os logs de debug podem conter texto privado dos chats, então limpe essas informações antes de compartilhar.

## Guias relacionados

- [Agentes: ajudantes de IA para os seus chats](../agents/agents-overview.md)
- [Referência dos agentes para download](../agents/built-in-agents.md)
- [Game Mode: primeiros passos](getting-started.md)
- [Roleplay Mode: primeiros passos](../roleplay/getting-started.md)
- [Provedores de geração de imagens e configuração](../media/image-providers.md)
- [Geração de vídeo de cena](../media/scene-video.md)
- [Storyboards com LTX 2.3 no Game Mode](ltx-2-3-storyboards.md)
