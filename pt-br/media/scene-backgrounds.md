# Planos de fundo de cena e a galeria

Os planos de fundo de cena gerados por IA são imagens de fundo que Marinara Engine cria a partir da **Gallery** (galeria). Este guia mostra como criar um, o que a galeria guarda e como redesenhar ou revisar uma imagem. Para a biblioteca de imagens enviadas e escolhidas à mão, veja [Planos de fundo do chat](../appearance/chat-backgrounds.md). Para o agente que escolhe um plano de fundo a cada turno, veja [Planos de fundo do Roleplay](../roleplay/backgrounds.md).

## Onde os planos de fundo de cena funcionam

Os planos de fundo de cena funcionam nos modos Roleplay e Game. Eles não estão disponíveis no modo Conversation. Se você tentar gerar um no modo Conversation, o aplicativo mostra esta mensagem:

```
Scene background generation is available in Roleplay and Game modes.
```

Antes de começar: você precisa de um modelo de imagem. Configure um antes, caso ainda não tenha. Veja [Provedores de geração de imagens e configuração](image-providers.md).

## Gerar e aplicar um plano de fundo pela galeria

A **Gallery** guarda as imagens e os vídeos de um chat. Ela é uma seção de **Chat Settings** (configurações do chat). No computador, você pode destacá-la em uma janela própria (veja [Visão geral do painel Chat Settings](../chats/chat-settings.md#popping-a-section-out-into-its-own-window)). O botão **Background** (plano de fundo) dela cria a arte de fundo da cena atual.

No Roleplay, o botão **Background** aparece assim que o agente **Illustrator** é instalado. Não é preciso adicioná-lo ao chat nem ativar os agentes. Assim como **Illustrate**, ele roda uma vez e não inicia execuções automáticas.

Para gerar um plano de fundo:

1. Abra a seção **Gallery** em **Chat Settings**.
2. Clique no botão **Background**.
3. O texto do botão muda para **Generating...** enquanto a imagem é criada.
4. Uma mensagem de status diz "AI background generation is running. The new background will be applied when it finishes."
5. Ao terminar, a nova imagem é aplicada à cena atual na hora, e "Background generated." confirma isso.

O plano de fundo é montado a partir da cena atual. Em um jogo, isso inclui o gênero, a ambientação, o local, o clima e a hora do dia. Os planos de fundo gerados usam o tamanho de tela **Backgrounds**, que é de 1280 por 720 pixels por padrão. Você pode mudar esse tamanho em **Settings** (Configurações), depois **Generations** (gerações), depois **Image Generation** (geração de imagens).

Se não funcionou: se Marinara não encontra nenhum modelo de imagem para usar, a etapa falha com esta mensagem:

```
Choose an image generation connection for the Illustrator agent, or mark one as the default image connection.
```

Para resolver, abra o painel **Connections** (conexões) e defina a tarefa **Images** em **Defaults** (padrões), ou dê ao agente **Illustrator** um modelo de imagem próprio.

## A seção Gallery

A **Gallery** tem duas abas, **Images** e **Videos**. Cada aba mostra a quantidade de itens que guarda. A aba **Videos** guarda os vídeos de cena nos chats de Roleplay e de Game, e as mensagens de vídeo nos chats de Conversation.

No topo da seção, os botões de ação aparecem apenas quando o recurso correspondente se aplica ao chat:

- **Illustrate**: executa o agente Illustrator para uma imagem avulsa da cena. Veja [Agente Illustrator](illustrator-agent.md).
- **Selfie**: gera uma selfie do personagem no modo Conversation.
- **Background**: gera e aplica um plano de fundo de cena, como descrito acima.
- **Video**: cria um vídeo de cena a partir da última ilustração. No modo Conversation, ele envia uma mensagem de vídeo de um personagem; veja [Mensagens de vídeo](../conversation/selfies.md#video-messages).
- **Create storyboard**: gera os quadros-chave do último turno do Game Mode ou de um episódio de Roleplay concluído, quando o Storyboard está ativo.
- **Browse Images**: abre um navegador das imagens salvas para inserir.
- **View storyboard**: abre o storyboard mais recente do Game Mode.

Abaixo dos botões fica a área **Upload Images** (enviar imagens). Arraste imagens até ela para acrescentar as suas próprias imagens à galeria deste chat.

### Ações de cada imagem

Passe o ponteiro sobre uma imagem da aba **Images**, ou toque nela no celular, para ver as ações:

- Abrir a imagem em tamanho real (**Open gallery image**).
- **Pin to chat**: fixa a imagem no chat como uma imagem flutuante. Arraste-a para movê-la e use a alça do canto para redimensioná-la. Ela mantém o lugar e o tamanho quando você recarrega a página neste navegador. O botão de trava ao lado do botão de dispensar impede que ela seja movida ou redimensionada até você destravá-la.
- **Download image**: salva a imagem no dispositivo.
- **Animate illustration**: transforma essa imagem em um vídeo de cena.
- **Copy prompt**: copia o prompt salvo da imagem. Se a imagem não tiver um prompt salvo, aparece **No prompt saved** e o botão fica desativado.
- **Delete gallery image**: exclui a imagem depois da sua confirmação.

<a id="regenerating-an-image"></a>

### Gerar uma imagem de novo

Você pode gerar de novo uma imagem sem gerar de novo a resposta a que ela pertence. Isso funciona com as imagens da galeria do chat que têm um prompt salvo, como ilustrações, selfies e quadros de storyboard.

1. Abra a imagem em tamanho real, pela galeria ou pela mensagem em que ela está.
2. Clique em **Regenerate image** (gerar a imagem de novo), o botão de seta circular no canto superior direito da imagem.
3. Mude o que quiser nas caixas abaixo da imagem: **Prompt**, **Negative prompt** (prompt negativo), uma caixa para cada personagem em **Character prompts** (prompts de personagem), quando a imagem os tinha, e o modelo de imagem.
4. Clique em **Generate image** (gerar imagem), ou em **Cancel** (cancelar) para deixar a imagem como está.

A imagem nova substitui a antiga na mensagem. A antiga continua na galeria, então você pode fixá-la de novo. As imagens de referência são enviadas de novo a partir dos avatares atuais dos personagens. Algumas imagens mais antigas não salvaram o prompt negativo e os prompts de personagem; o editor avisa quando é o caso.

## Revisar o prompt antes do envio

Você pode conferir e editar o prompt antes que Marinara envie o pedido de plano de fundo ao seu serviço de imagens.

1. Abra **Settings**, depois **Generations**, depois **Overall Generations** (gerações em geral).
2. Ative a opção **Expose media prompts before sending** (mostrar os prompts de mídia antes de enviar).

Com essa configuração ativada, a janela **Review Image Prompt** abre antes de cada pedido ser enviado. O texto de ajuda dela diz: "Edit the prompt below before Marinara sends the image request to your provider."

Nessa janela, você pode:

- Editar o texto do prompt e o prompt negativo.
- Ver o tipo e o tamanho da imagem, além da contagem de caracteres em tempo real.
- Clicar em **Cancel** para desistir, ou em **Generate** para enviar.

Se alguma caixa de prompt estiver vazia, o botão **Generate** fica desativado e aparece este aviso: "Every image request needs a prompt." O texto que você digitar é enviado exatamente como está.

## Gerenciar os planos de fundo salvos

Todo plano de fundo de cena que você gera é salvo na sua biblioteca de planos de fundo. Você também pode acrescentar imagens próprias a essa mesma biblioteca. Os planos de fundo enviados aceitam arquivos JPG, PNG, GIF, WebP e AVIF, com até 20 MB cada.

Os planos de fundo que você acrescentou podem receber tags, ser renomeados e excluídos. As tags ficam em minúsculas e aceitam letras, números, espaços, hifens e sublinhados, até 40 caracteres cada. Os planos de fundo internos, que vêm com os recursos de jogo, aparecem junto com os seus, mas não podem ser renomeados, marcados com tags nem excluídos.

Você gerencia essa biblioteca e define um plano de fundo por chat ou padrão nas configurações de aparência. Para conhecer a biblioteca completa, o seletor e a opção **Background Blur**, veja [Planos de fundo do chat](../appearance/chat-backgrounds.md).

## Guias relacionados

- [Planos de fundo do chat](../appearance/chat-backgrounds.md): a biblioteca de imagens enviadas, escolhidas à mão.
- [Planos de fundo do Roleplay](../roleplay/backgrounds.md): o agente que escolhe um plano de fundo sozinho a cada turno.
- [Agente Illustrator](illustrator-agent.md): ilustrações de cena para os modos Roleplay e Game.
- [Provedores de geração de imagens e configuração](image-providers.md): configure um modelo de imagem.
- [Geração de vídeo de cena](scene-video.md): transforme uma imagem da galeria em vídeo.
