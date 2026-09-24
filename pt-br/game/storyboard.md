# Guia do agente Storyboard

O agente **Storyboard**, que você baixa dentro do aplicativo, transforma um trecho concluído da história em imagens de quadros-chave em ordem e, se você quiser, em clipes curtos de imagem para vídeo. Ele funciona no **Roleplay** e no **Game Mode**. Os chats de Conversation não usam o Storyboard.

Este é o fluxo de trabalho atual, baseado em agentes. O pacote do Storyboard traz os prompts de planejamento (o prompt é o texto que Marinara envia para a IA), os valores padrão e os controles de cada chat. O Marinara Engine faz a integração que gera as mídias, salva tudo na Gallery (a galeria) e mostra o resultado no chat ou no visualizador do Game.

## Roleplay e Game Mode em resumo

| | Roleplay | Game Mode |
| --- | --- | --- |
| Origem da história | As mensagens concluídas do usuário e do assistente desde o último episódio bem-sucedido | Um turno concluído de narração do GM, o mestre do jogo |
| Opções automáticas | **Manual only**, **Still images** ou **Animations** | Botões liga/desliga separados: **Automatic Storyboard Illustrations** e **Automatic Storyboard Animations** |
| Ação manual | **Gallery > Create storyboard** para a última resposta concluída do assistente | **Gallery > Create storyboard** para o último turno concluído do GM |
| Exibição | Dentro do chat, logo abaixo da resposta do assistente que encerra o episódio | Visualizador flutuante ou plano de fundo do Game, em sincronia com a narração |
| Prompts de planejamento | Episode contract, visual style, animation addon opcional e output contract | Planejadores separados para imagem estática e para animação |
| Prompts finais compartilhados | Prompt de imagem da ilustração e prompt de vídeo da animação | Prompt de imagem da ilustração e prompt de vídeo da animação |

Nos dois modos, Marinara salva as imagens dos quadros-chave na aba **Images** da Gallery e os clipes na aba **Videos**.

## Instalar o agente

1. Abra o painel **Agents** (agentes) pelo ícone de estrelinhas.
2. Selecione a opção **Download Agents** (baixar agentes).
3. Abra o item **Storyboard** e clique no botão **Install** (instalar).
4. Abra um chat em Roleplay ou em Game Mode e depois a seção **Chat Settings > Agents** (as configurações do chat, área de agentes).
5. Ative a opção **Enable Agents** (ativar os agentes) e, no card do Storyboard, ative **Enable Storyboards** (ativar os storyboards).

Instalar o pacote deixa o agente disponível nos chats compatíveis, mas não o ativa sozinho em todos eles. O pacote atual não exige reiniciar o Marinara depois da instalação.

Se o Storyboard não aparecer no painel Chat Settings, verifique se o pacote está instalado e se o chat está em Roleplay ou em Game Mode.

## Configurações do agente Storyboard

Abra o painel **Agents**, selecione **Storyboard** e abra a configuração dele. Esses valores valem como padrão nos chats que não tiverem ajustes próprios.

### Padrões de geração e de mídia

| Configuração | Padrão | Para que serve |
| --- | --- | --- |
| Agent connection | A conexão de agente selecionada | Planeja o storyboard com um modelo de linguagem (LLM) |
| **Image connection** | Use the Game image connection | Gera cada quadro-chave; é preciso ter uma conexão de imagem em algum ponto da cadeia de alternativas |
| **Video connection** | Use the Game video connection | Gera os clipes quando as animações estão ativadas |
| **Automatic generation** | Still images | Define o comportamento automático inicial dos chats recém-ativados |
| **Keyframes per turn** | 3, de 1 a 6 | Define o número desejado de quadros em ordem |
| **Clip seconds** | 5, de 1 a 15 | Define a duração pedida para cada clipe |
| **Viewer display** | Floating viewer | Define o padrão do visualizador no Game Mode; no Roleplay, os storyboards sempre aparecem dentro do chat |
| **Default Roleplay episode interval** | 1, de 1 a 100 | Define quanto material novo do Roleplay se acumula entre os episódios automáticos |
| **Attach Card Appearance** | On | Acrescenta aos prompts de imagem os detalhes de aparência dos personagens identificados |
| **Send Avatar References** | On | Envia os avatares dos personagens e das personas identificados quando o provedor de imagem aceita referências |
| **Use the final image template** | On | Formata o quadro planejado antes de enviá-lo ao provedor de imagem |
| **Use NovelAI character prompts** | On | Usa o prompt nativo por personagem nas conexões oficiais compatíveis do NovelAI V4/V4.5 |

### Game prompt library (biblioteca de prompts do Game Mode)

A biblioteca do Game tem duas trilhas de planejamento. A trilha ativa depende do que o jogo está criando: imagens estáticas ou clipes.

| Configuração | Padrão | Para que serve |
| --- | --- | --- |
| **Still planner** | Still Keyframes | Divide um turno concluído do GM em momentos prontos para virar imagem estática |
| **Animation planner** | Comic Page Animation | Cria primeiros quadros prontos para animar e direções de movimento que levam a duração em conta |

O pacote também traz planejadores voltados para NovelAI, quadrinhos, mangá colorido, mangá em preto e branco, episódio de anime e LTX. O texto do prompt de cada planejador pode ser editado na configuração global do agente. O chat do Game escolhe entre as opções de imagem estática e de animação na seção **Chat Settings > Agents > Storyboards**.

### Roleplay prompt library (biblioteca de prompts do Roleplay)

No Roleplay, Marinara junta quatro prompts selecionados em um único pedido ao planejador.

| Configuração | Padrão | Para que serve |
| --- | --- | --- |
| **Episode contract** | Completed Roleplay Episode | Escolhe os momentos já concluídos e apoiados no texto de origem, mantendo a ordem das mensagens |
| **Visual style** | Normal / Anime | Define o tratamento visual de cada quadro-chave |
| **Animation addon** | Simple Storyboard Motion | Só nos clipes, acrescenta movimento, câmera, diálogo e som vindos do texto, o clima do ambiente e uma pausa no fim |
| **Output contract** | Roleplay Keyframe JSON | Define os campos estruturados de quadro-chave que o planejador devolve |

Abra **Prompt library** (Biblioteca de prompts), recolhida dentro de Stage 1, para editar essas coleções completas. Clique em **Add option** (adicionar opção) para criar um prompt personalizado, renomeie a opção, escreva uma descrição curta e edite o corpo do prompt. As opções nativas podem voltar ao padrão do pacote.

### Formatadores compartilhados do provedor

Depois que o modo escolhido planeja os quadros, os formatadores compartilhados montam os pedidos finais enviados ao provedor.

| Configuração | Padrão | Para que serve |
| --- | --- | --- |
| **Default image prompt** | Game Scene Illustration | Formata cada quadro-chave planejado para o provedor de imagem |
| **Default video prompt** | Cinematic Scene Video | Formata a imagem do primeiro quadro e o plano de movimento para o provedor de vídeo |

Cada etapa numerada tem sua própria **Prompt library** recolhida: Stage 2 contém os formatadores de imagem, Stage 3 os planejadores de movimento que consideram a imagem, e Stage 4 os formatadores que repassam o prompt de vídeo sem alterações. As opções nativas de imagem incluem também **Storyboard Illustration** e **Storyboard First Frame**. Entre as de vídeo estão **Anime Game Video**, **Comic Page Video** e **Narration Passthrough**. Os chats de Game e de Roleplay podem usar formatadores diferentes sem mexer na coleção de prompts compartilhada.

### Padrões globais e ajustes de cada chat

Cada chat pode substituir os padrões do agente. No painel Chat Settings, os valores herdados aparecem com a marca **Using agent default**, e um botão de redefinição surge assim que você cria um ajuste próprio.

A ordem de prioridade das conexões muda um pouco de um modo para outro:

- O Roleplay oferece seletores de prompt, de imagem e de vídeo em cada chat. A opção **Use global default** herda a configuração do Storyboard.
- O Game Mode usa as conexões de planejamento, de imagem e de vídeo próprias do jogo, quando elas estão definidas, e só depois recorre aos padrões do agente Storyboard.

As imagens estáticas exigem uma conexão de imagem. As animações precisam de um quadro-chave gerado com sucesso e de uma conexão de vídeo.

## Storyboards no Roleplay

No Roleplay, o storyboard reúne as trocas de mensagens já concluídas em um episódio visual e mostra esse episódio logo abaixo da resposta do assistente que o encerra.

### Início rápido

1. Instale o Storyboard e ative-o no chat em Roleplay.
2. Na seção **Chat Settings > Agents > Storyboards**, escolha uma **Prompt connection** e uma **Image connection**, ou deixe as duas em **Use global default** quando a configuração global já estiver pronta.
3. Escolha um **Automatic mode**:
   - **Manual only**: nenhum episódio automático; o botão **Create storyboard** (criar o storyboard) monta um episódio de imagens estáticas na hora que você pedir.
   - **Still images**: cria automaticamente um episódio ilustrado.
   - **Animations**: cria automaticamente as imagens dos quadros-chave e um clipe para cada quadro; é preciso ter uma conexão de vídeo.
4. Ajuste os campos **Messages per episode** e **Keyframes per episode**.
5. Termine uma nova resposta do assistente ou abra a Gallery e clique em **Create storyboard**.

Nos storyboards com vários quadros-chave, use as setas para passar de um quadro para outro. O quadro animado mostra o clipe dentro do chat; enquanto o clipe está pendente ou indisponível, ele exibe a imagem no lugar.

### Como funciona o intervalo entre episódios

O intervalo define quantas mensagens novas do usuário e do assistente precisam se acumular entre dois storyboards automáticos bem-sucedidos. Os dois tipos de mensagem avançam o intervalo, e o episódio inclui as mensagens novas em ordem cronológica.

O padrão é 1, ou seja, a próxima resposta concluída do assistente já pode gerar um episódio. Um valor maior deixa o diálogo e a ação se acumularem. O texto de origem fica limitado às 20 mensagens mais recentes e a 12.000 caracteres, para que um chat antigo ou muito longo não crie um pedido de planejamento sem limite.

O marco de cadência só avança depois que um storyboard completo ou parcial é salvo. Um episódio que falha não consome o material de origem. Abrir um chat existente não recupera as respostas antigas: a geração automática espera uma nova resposta concluída do assistente.

### A cadeia de prompts do Roleplay

No Roleplay, o planejamento tem quatro camadas antes dos formatadores compartilhados do provedor:

1. **Episode contract** escolhe os momentos de história já concluídos e apoiados no texto, e liga cada um às mensagens enviadas.
2. **Visual style** define o tratamento Normal/Anime, NovelAI, Comic, Colored Manga ou B&W Manga.
3. **Animation addon** entra apenas nos storyboards animados. Ele descreve uma ação viável, o comportamento da câmera, o diálogo e o som apoiados no texto, o clima do ambiente e uma pausa no fim.
4. **Output contract** define o resultado estruturado de quadros-chave que o planejador devolve.

Depois, o **Storyboard Illustration Prompt** formata cada primeiro quadro planejado para o provedor de imagem. Com os clipes ativados, o **Storyboard Video Prompt** formata o plano de movimento para o provedor de vídeo.

A biblioteca de prompts do Roleplay é separada da biblioteca de planejadores do Game. Editar um estilo visual do Roleplay não altera os planejadores de imagem estática nem os de animação do Game Mode.

### Storyboard e Illustrator juntos

O Storyboard é um agente separado do Illustrator. As ações manuais do Illustrator e as demais mídias dele continuam disponíveis. Com o Storyboard do Roleplay em **Still images** ou **Animations**, Marinara suprime a imagem automática de primeiro plano do Illustrator naquela resposta concluída, para que os dois agentes não criem mídias concorrentes depois da resposta. A opção **Manual only** mantém o caminho normal do Illustrator.

## Storyboards no Game Mode

No Game Mode, o Storyboard usa exatamente um turno concluído de narração do GM como origem da história. Ele remove as tags de comando ocultas do GM, planeja os quadros em ordem e liga cada quadro a um intervalo de trechos legíveis do turno. O visualizador troca de quadro conforme a leitura avança por esses trechos.

### Início rápido

1. Instale o Storyboard.
2. Crie ou abra um chat em Game Mode.
3. Abra a seção **Chat Settings > Agents**, ative **Enable Agents** e depois **Enable Storyboards**.
4. Verifique se o jogo tem uma conexão de imagem, ou se a configuração global do Storyboard fornece uma.
5. Termine um turno de narração do GM.
6. Abra o painel **Gallery** e clique em **Create storyboard**.

Para reabrir um visualizador do Game que você fechou, clique em **View storyboard** na Gallery. A geração manual segue a configuração de animação do momento: com **Automatic Storyboard Animations** ativado, o storyboard manual também pede os clipes.

### Storyboards automáticos no Game

O card do Storyboard tem dois botões liga/desliga de automação:

- **Automatic Storyboard Illustrations** cria quadros-chave estáticos depois de um turno concluído do GM.
- **Automatic Storyboard Animations** cria ainda um clipe para cada quadro-chave. Ligar as animações liga as ilustrações; desligar as ilustrações desliga as animações.

A geração automática só roda com o agente Storyboard ativo naquele jogo. Ela também não refaz o storyboard de um turno que já tem um. Quando você quiser mesmo criar outro storyboard do último turno, use a ação manual da Gallery.

Com a opção **Expose image prompts before sending** ativada nas configurações de geração, o storyboard manual do Game mostra os prompts de imagem compilados para revisão. Os storyboards automáticos seguem sem janela de revisão, para não interromper a partida.

### Configurações do Game

Abra a seção **Chat Settings > Agents > Storyboards**.

| Configuração | Padrão do agente | O que controla |
| --- | --- | --- |
| **Enable Storyboards** | Off em cada chat | Ativa o agente instalado neste jogo |
| **Automatic Storyboard Illustrations** | Vem de Automatic generation | Quadros-chave estáticos depois de cada turno concluído do GM |
| **Automatic Storyboard Animations** | Vem de Automatic generation | Clipes MP4 para cada quadro-chave |
| **Keyframes per Turn** | 3, de 1 a 6 | Número desejado de quadros; um turno curto pode render menos |
| **Animation Clip Duration** | 5 segundos, de 1 a 15 | Duração pedida para cada clipe; o provedor pode reduzi-la |
| **Viewer Display** | Floating | Visualizador arrastável ou plano de fundo do jogo em tela cheia |
| **Still Planner** | Still Keyframes | Planeja ilustrações estáticas finalizadas |
| **Animation Planner** | Comic Page Animation | Planeja primeiros quadros prontos para animar e as direções de movimento |
| **Use Storyboard Template** | On | Aplica o formatador final de ilustração selecionado |
| **Storyboard Illustration Prompt** | Game Scene Illustration | Formata o quadro planejado para o provedor de imagem |
| **Storyboard Video Prompt** | Cinematic Scene Video | Formata o primeiro quadro e o plano de movimento para o provedor de vídeo |

O pacote traz ainda planejadores voltados para NovelAI, quadrinhos, mangá, anime e LTX. Escolher um planejador de animação não liga a geração de vídeos sozinho: ainda são necessários **Automatic Storyboard Animations** e uma conexão de vídeo.

### A cadeia de prompts do Game

O Game Mode tem planejadores separados para os resultados estáticos e para os animados:

```text
completed GM narration
  -> Still Planner or Animation Planner
  -> Storyboard Illustration Prompt
  -> image connection
  -> optional Storyboard Video Prompt
  -> video connection
```

O planejador escolhe os momentos da história e coloca todos em ordem. O prompt de ilustração é um formatador voltado ao provedor, não um segundo planejador de história. Com as animações ativadas, o planejador de animação cria uma descrição exata do primeiro quadro e uma direção de movimento; o prompt de vídeo transforma essa direção no pedido final.

### Receitas revisadas para o Game Mode

Cada receita combina uma cadeia do Storyboard aplicada pelo pacote com o restante das configurações do Game e do provedor. Aplique a cadeia indicada quando o pacote oferecê-la, ou reproduza manualmente as escolhas da lista.

#### Storyboards de quadrinhos com o Google

Cadeia aplicada pelo pacote:

- **Illustration Planner**: Still Keyframes
- **Animation Planner**: Comic Page Animation
- **Storyboard Illustration Prompt**: Game Scene Illustration
- **Storyboard Video Prompt**: Comic Page Video
- **Use Storyboard Template**: On

Lista de conferência do Game:

- **Visual Generation**: On
- **Image Connection**: Google/Nano Banana
- **Image Style**: Default
- Mantenha o estilo de arte criado pelo assistente de configuração.
- **Automatic Storyboard Illustrations**: On
- **Automatic Storyboard Animations**: Off
- **Keyframes per Turn**: 3
- **Video Connection**: None

Isso gera storyboards estáticos comuns. A cadeia de animação Comic Page fica salva e só entra em ação se você escolher uma conexão de vídeo mais tarde e ativar **Automatic Storyboard Animations**.

#### Tags diretas do NovelAI

Cadeia aplicada pelo pacote:

- **Illustration Planner**: NovelAI Keyframes
- **Storyboard Illustration Prompt**: crie uma opção personalizada cujo prompt tenha apenas isto:

  ```text
  ${scenePrompt}
  ```

- **Use Storyboard Template**: On
- Deixe o Animation Planner e o Storyboard Video Prompt como estão.

Lista de conferência do Game:

- **Image Style**: Danbooru
- **Use Campaign Art Style**: Off
- **Attach Card Appearance**: Off
- **Send Avatar References**: Off
- **Use NovelAI Character Prompts**: Off
- **Queue media generation requests**: On
- Remova o texto em prosa do campo **Style Text** no perfil Danbooru.
- Ajuste as tags positivas, as negativas e as de ilustração conforme a necessidade.

O modelo de repasse direto envia as tags enxutas do NovelAI vindas do planejador, sem passá-las pelo formatador de ilustração em prosa.

#### Krea 2 + LTX 2.3 locais

Cadeia aplicada pelo pacote:

- **Illustration Planner**: Still Keyframes, como alternativa só para imagem estática
- **Animation Planner**: LTX Simple Image-to-Video
- **Storyboard Illustration Prompt**: Storyboard First Frame
- **Storyboard Video Prompt**: Narration Passthrough
- **Use Storyboard Template**: On

Em uma GPU com 8 GB de VRAM, comece com um quadro-chave em 480p. Depois que essa geração terminar com sucesso, avance para três quadros-chave e resoluções maiores. Veja [Storyboards com LTX 2.3 no Game Mode](ltx-2-3-storyboards.md) para a conexão do ComfyUI, os marcadores e o procedimento completo de teste.

### A apresentação Storyboard Optimized não é o botão do agente

No assistente de configuração do Game, a apresentação **Storyboard Optimized** muda o prompt de narração do GM para que os turnos tragam âncoras visuais mais fáceis de filmar. Ela não instala nem ativa o Storyboard, não liga as mídias automáticas e não escolhe as conexões de imagem e de vídeo.

O agente Storyboard funciona tanto com a apresentação Standard quanto com a Storyboard Optimized. Instale e ative o agente à parte.

### O visualizador do Game

A opção **Floating viewer** é um painel arrastável e redimensionável sobre o jogo. Ele acompanha o ponto da narração do GM em que você está lendo e mostra o quadro correspondente. O vídeo toca assim que fica pronto; enquanto isso, aparece a imagem do quadro.

A opção **Game background** coloca o quadro ativo atrás dos controles do jogo. Enquanto esse modo está ligado, ela substitui o plano de fundo de cena gerado normalmente, e por isso a ação **Generate background** fica indisponível. Os clipes do plano de fundo tocam uma vez e ficam parados no último quadro; os controles do jogo oferecem as ações de repetir, reproduzir/pausar e silenciar.

Fechar o visualizador flutuante o esconde apenas no turno atual. Para reabri-lo, use a ação **Gallery > View storyboard**.

## Prompts de imagem e coerência dos personagens

O planejador escolhido e o prompt final de imagem têm funções diferentes:

- O planejador decide quais momentos mostrar e escreve o conteúdo visual de cada quadro.
- O modelo final de imagem acrescenta a estrutura voltada ao provedor, a aparência dos personagens identificados, o tratamento das referências, o contexto do lugar, a direção de arte da campanha e as instruções de imagem.

Quando o planejador já devolve exatamente a sintaxe de prompt que o provedor de imagem deve receber, use um modelo de repasse direto, como `${scenePrompt}`. Desative a opção **Use the final image template** só quando quiser mesmo pular o formatador selecionado. As instruções de imagem obrigatórias continuam valendo.

Para personagens mais estáveis:

- No card de personagem, mantenha o campo Appearance específico e sempre atualizado.
- Deixe **Attach Card Appearance** ativado, a não ser que o planejador escolhido já repita todos os detalhes de aparência necessários.
- Deixe **Send Avatar References** ativado quando o provedor aceitar referências e os avatares combinarem com a aparência desejada.
- Prefira poucos personagens bem visíveis em cada quadro. O Storyboard só envia as referências dos personagens visíveis identificados e das personas (o personagem que você interpreta), não de todos os personagens do chat.

A opção **Use NovelAI character prompts** só muda os pedidos enviados por conexões oficiais compatíveis do NovelAI V4/V4.5. Os demais provedores seguem pelo caminho de prompt compartilhado, mesmo com o botão ativado.

## Custo e desempenho

Cada quadro-chave é uma tarefa de imagem separada. Os storyboards animados acrescentam uma tarefa de vídeo por quadro-chave bem-sucedido. Por isso, um storyboard animado de três quadros pode fazer três pedidos de imagem e três pedidos de vídeo.

Ao testar um provedor novo ou um fluxo de trabalho local, comece com imagens estáticas e apenas um quadro-chave. Aumente o número de quadros, a duração dos clipes e a cadência automática só depois que o caminho básico estiver confiável.

## Jogos existentes do sistema antigo de storyboard

Hoje o Storyboard é um agente que você baixa, mas os chats de Game antigos ainda podem conter configurações definidas pela interface de storyboard nativa do Engine, a anterior ao pacote. Ao instalar o pacote, Marinara preserva esses valores como ajustes próprios do chat: uma configuração de Game que funciona não é descartada.

Ou seja, um jogo antigo pode se comportar de um jeito diferente dos padrões atuais do agente. Abra a seção **Chat Settings > Agents > Storyboards** e use o botão de redefinição de cada campo quando quiser que ele volte a herdar o padrão do agente Storyboard.

As configurações antigas são apenas dados de migração, não uma segunda implementação do Storyboard. A geração atual continua exigindo o pacote Storyboard instalado e ativo naquele jogo.

## Solução de problemas

### O Storyboard não aparece no painel Chat Settings

- Instale o **Storyboard** pelo painel **Agents > Download Agents**.
- Use um chat em Roleplay ou em Game Mode: o modo Conversation não tem suporte.
- Verifique se a versão do pacote é compatível com a versão instalada do Engine.

### O botão Create storyboard aparece, mas a geração falha

- Ative **Enable Agents** e **Enable Storyboards** naquele chat.
- Escolha uma conexão válida de geração de imagens no card do Storyboard do Roleplay, nas configurações do Game ou na configuração global do Storyboard.
- Espere a resposta do assistente ou do GM terminar antes de tentar de novo.

### O Roleplay não criou o episódio automático

- Escolha **Still images** ou **Animations**, e não **Manual only**.
- Espere uma nova resposta do assistente terminar. Abrir um chat não recupera as mensagens antigas.
- Confira o campo **Messages per episode**. Desde o último marco de cadência bem-sucedido, é preciso acumular mensagens novas do usuário e do assistente em quantidade suficiente.
- Uma execução que falha não avança o marco. Procure o erro original do provedor ou de leitura da resposta no log do servidor, ou seja, no registro que o servidor grava.

### As imagens aparecem, mas os vídeos não

- No Roleplay, escolha **Animations**. No Game Mode, ative **Automatic Storyboard Animations**.
- Escolha uma conexão Video Generation.
- Verifique se a conexão de vídeo aceita entrada de imagem para vídeo.
- Olhe a aba **Videos** da Gallery. O clipe pode ficar pronto depois da imagem do quadro-chave.
- Se o planejamento tiver recorrido à alternativa depois de uma falha do LLM, Marinara pode manter as imagens geradas pela alternativa e pular os vídeos daquela execução.

### O storyboard ficou incompleto ou travado

Uma ou mais tarefas do provedor podem ter falhado, estourado o tempo limite ou esbarrado em um limite de uso ou de conteúdo. Se o provedor estiver funcionando, mas lento, aumente as variáveis `IMAGE_GEN_TIMEOUT_MS` ou `VIDEO_GEN_TIMEOUT_MS` no arquivo `.env` e reinicie o Marinara, porque esses valores são lidos na inicialização.

Ative o modo Debug e procure por `storyboard` no log do servidor para conferir o planejador, o prompt de imagem compilado, a escolha das referências e o prompt de vídeo. Os logs de debug podem conter o texto privado dos chats e os prompts: limpe essas informações antes de compartilhar.

## Guias relacionados

- [Agentes: ajudantes de IA para os seus chats](../agents/agents-overview.md)
- [Referência dos agentes para download](../agents/built-in-agents.md)
- [Game Mode: primeiros passos](getting-started.md)
- [Roleplay Mode: primeiros passos](../roleplay/getting-started.md)
- [Provedores de geração de imagens e configuração](../media/image-providers.md)
- [Geração de vídeo de cena](../media/scene-video.md)
- [Storyboards com LTX 2.3 no Game Mode](ltx-2-3-storyboards.md)
