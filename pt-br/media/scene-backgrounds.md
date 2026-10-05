# Planos de fundo de cena e a galeria

Este guia explica os planos de fundo de cena gerados por IA, as imagens que Marinara Engine cria para você a partir da **Gallery** (galeria), e a própria galeria. Existem dois guias relacionados: [Planos de fundo do chat](../appearance/chat-backgrounds.md) trata da biblioteca de imagens enviadas e escolhidas à mão, e [Planos de fundo do Roleplay](../roleplay/backgrounds.md) trata do agente que escolhe um plano de fundo sozinho a cada turno.

## Onde os planos de fundo de cena funcionam

Os planos de fundo de cena funcionam nos modos Roleplay e Game. No Conversation Mode eles não existem. Se você tentar gerar um no Conversation Mode, o aplicativo mostra esta mensagem:

```
Scene background generation is available in Roleplay and Game modes.
```

Para gerar um plano de fundo, é preciso ter uma conexão de **Image Generation** (geração de imagens). Configure uma antes, caso ainda não tenha. Veja [Provedores de geração de imagens e configuração](image-providers.md).

## Gerar e aplicar um plano de fundo pela galeria

A **Gallery** guarda as imagens e os vídeos do chat. É uma seção de **Chat Settings**: abra Chat Settings e expanda Gallery. No computador, você pode destacá-la em uma janela própria; veja [Visão geral de Chat Settings](../chats/chat-settings.md#popping-a-section-out-into-its-own-window). O botão **Background** (plano de fundo) gera o fundo da cena atual.

Para gerar um plano de fundo:

1. Abra a seção **Gallery** de **Chat Settings**.
2. Clique no botão **Background**.
3. O texto do botão muda para **Generating...** enquanto a imagem é criada.
4. Você deve ver esta mensagem de status: "AI background generation is running. The new background will be applied when it finishes."
5. Ao terminar, a nova imagem entra na cena atual na hora. A mensagem "Background generated." confirma isso.

O plano de fundo nasce da cena atual. Em um jogo, isso inclui o gênero, a ambientação, o local, o clima e a hora do dia. Os planos de fundo gerados usam o tamanho de tela **Backgrounds**, que é de 1280 por 720 pixels por padrão. Esse tamanho pode ser alterado em **Settings**, depois **Generations**, depois **Image Generation**.

### Se nenhuma conexão de imagem estiver definida

Quando Marinara não encontra uma conexão de imagem para usar, a etapa de geração falha com esta mensagem:

```
Choose an image generation connection for the Illustrator agent, or mark one as the default image connection.
```

Para resolver, abra o painel **Connections** (conexões), expanda a seção **Defaults** e escolha uma conexão de imagem em **Images**. Outra opção: definir uma conexão de imagem específica no agente **Illustrator**.

## A seção Gallery

A **Gallery** tem duas abas, **Images** e **Videos**. Cada aba mostra a quantidade de itens que guarda. A aba **Videos** só aparece quando os vídeos de cena estão ativados para o chat.

No topo da seção, os botões de ação aparecem apenas quando o recurso correspondente se aplica ao chat:

- **Illustrate**: executa o agente Illustrator para uma imagem avulsa da cena. Veja [Agente Illustrator](illustrator-agent.md).
- **Selfie**: gera uma selfie do personagem no Conversation Mode.
- **Background**: gera e aplica um plano de fundo de cena, como descrito acima.
- **Video**: cria um vídeo de cena a partir da última ilustração.
- **Create storyboard**: gera os quadros-chave do último turno do Game Mode ou de um episódio de Roleplay concluído, quando o Storyboard está ativo.
- **Browse Images**: abre um navegador das imagens salvas para inserir.
- **View storyboard**: abre o storyboard mais recente do Game Mode.

Abaixo dos botões fica a área **Upload Images** (enviar imagens). Arraste imagens até ela para acrescentar as suas próprias fotos à galeria deste chat.

### Ações de cada imagem

Passe o ponteiro sobre qualquer imagem da aba **Images**, ou toque nela no celular, para revelar as ações:

- Abrir a imagem em tamanho real (**Open gallery image**).
- **Pin to chat**: fixa a imagem no chat.
- **Download image**: salva a imagem no dispositivo.
- **Animate illustration**: transforma essa imagem em um vídeo de cena.
- **Copy prompt**: copia o prompt salvo da imagem, ou seja, o texto que Marinara envia para a IA. Se a imagem não tiver um prompt salvo, aparece **No prompt saved** e o botão fica desativado.
- **Delete gallery image**: exclui a imagem depois da sua confirmação.

## Revisar o prompt antes do envio

Você pode conferir e editar o prompt antes que o Marinara envie o pedido de plano de fundo ao provedor de imagens.

1. Abra **Settings**, depois **Generations**, depois **Image Generation**.
2. Ative a opção **Expose media prompts before sending**.

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
- [Provedores de geração de imagens e configuração](image-providers.md): configure uma conexão de imagem.
- [Geração de vídeo de cena](scene-video.md): transforme uma imagem da galeria em vídeo.
