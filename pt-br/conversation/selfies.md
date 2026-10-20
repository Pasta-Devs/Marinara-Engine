# Selfies

Este guia explica as selfies no Conversation Mode. Uma selfie é uma imagem que o personagem gera de si mesmo e envia no chat, como uma foto compartilhada em um aplicativo de mensagens. Aqui você vê como ativar as selfies, como configurá-las e como pedir uma manualmente.

## O que são as selfies

As selfies são um recurso do Conversation Mode. O personagem pode enviar uma foto gerada de si mesmo durante um chat comum. Isso é diferente das imagens de cena usadas no Roleplay Mode e no Game Mode. As selfies existem para combinar com a cara de aplicativo de mensagens do Conversation Mode.

As selfies usam a geração de imagens. Cada selfie enviada pelo personagem consome uma requisição de geração de imagens da conexão escolhida. Por isso, as selfies ficam desativadas até você configurá-las.

Quem fornece as selfies é o pacote opcional **Illustrator**. Instale o Illustrator em **Agents → Download Agents** (baixar agentes) antes de configurá-las.

## Como ativar as selfies

As selfies ficam em **Illustrator Settings** (configurações do Illustrator), dentro da seção **Agents** de um chat do Conversation. Os **Commands** (comandos) são ações ocultas que o personagem pode tomar por conta própria, como enviar uma selfie ou tocar uma música. Os controles de comando aparecem dentro da seção **Agents** quando há um pacote de comandos instalado.

Para ativar as selfies:

1. Abra um chat do Conversation.
2. Abra **Chat Settings** (configurações do chat), no ícone de controles deslizantes.
3. Localize a seção **Agents**.
4. Ative o botão liga/desliga principal **Commands** dentro dela. Enquanto ele estiver desligado, nenhum personagem consegue usar ações ocultas.
5. Localize a seção **Illustrator Settings**.
6. Ative a chave **Generated Selfies** (selfies geradas).

Depois de ativar a opção **Generated Selfies**, as configurações de selfie aparecem logo abaixo da chave. Você vê campos para a conexão, o modelo de prompt, o estilo e as referências. Os botões de **Resolution** (resolução) só aparecem depois que você escolhe uma **Selfie Connection**.

## Configurações de selfie

Com as selfies ativadas, defina a aparência delas e qual serviço as cria. Todas essas configurações ficam na seção **Illustrator Settings**, em **Chat Settings → Agents**, e valem apenas para o chat atual.

### Selfie Connection

O campo **Selfie Connection** (conexão da selfie) escolhe o serviço de geração de imagens que desenha a foto. O valor padrão é **None (selfies disabled)**, ou seja, nenhum serviço foi escolhido ainda. Escolha aqui uma das conexões de imagem já configuradas.

Enquanto não houver uma **Selfie Connection**, os personagens não conseguem enviar selfies. Se aparecer o aviso **Choose a Selfie Connection to let characters generate selfie images**, a conexão ainda está vazia.

Para saber como adicionar uma conexão de imagem, veja [Provedores de geração de imagens e configuração](../media/image-providers.md).

### Prompt Model

O campo **Prompt Model** (modelo de prompt) escolhe o modelo de texto que escreve a descrição da selfie. Em seguida, a conexão de imagem desenha essa descrição. O valor padrão é **Main chat model**, que reaproveita o mesmo modelo usado no chat. Escolha outra conexão de texto se preferir que outro modelo escreva a descrição da selfie.

### Image Style

O campo **Image Style** (estilo da imagem) escolhe um Style Profile para a selfie. Um Style Profile é um conjunto salvo de palavras de estilo artístico, como "anime" ou "realistic photo". O valor padrão é **Use default style from Style Profiles in Advanced settings**, que segue o estilo padrão global.

Para saber mais sobre estilos, veja [Perfis de estilo de imagem](../media/style-profiles.md).

### Send Avatar References

**Send Avatar References** (enviar referências de avatar) é um menu suspenso que vem em **Off** (desativado) por padrão. Ele fica abaixo da seção **Video messages** (mensagens de vídeo), e cada opção diz a que se aplica: **Images only** (só imagens), **Videos only** (só vídeos) ou **Images and videos** (imagens e vídeos).

- Nas imagens, Marinara envia o avatar ou o sprite do personagem ao serviço de imagem como foto de referência. Assim, a selfie fica mais parecida com o personagem. Isso só funciona quando o provedor de imagens aceita imagens de referência.
- Nos vídeos, uma mensagem de vídeo cujo **First frame** (primeiro quadro) é **Prompt only** parte do avatar ou do sprite do personagem, em vez de nenhuma imagem. Os serviços de vídeo aceitam uma única imagem inicial, então os outros primeiros quadros, que já partem de uma imagem do personagem, não mudam.

### Attach Card Appearance

**Attach Card Appearance** (anexar a aparência do card) é um menu suspenso que vem em **Off** por padrão, com as mesmas opções **Images only**, **Videos only** e **Images and videos**. Ele acrescenta o texto de aparência do card de cada personagem citado no prompt ao prompt da selfie, ao prompt do vídeo ou aos dois. Com isso, o modelo recebe mais detalhes sobre o visual do personagem.

Se o card ou a persona também tiver **Image Appearance Override** (aparência alternativa para imagens) ativado, Marinara envia essa aparência alternativa no lugar do texto de **Appearance**. Ative a opção abaixo de **Appearance** no editor de personagens ou de personas quando a descrição completa de **Appearance** tiver sido escrita para o narrador, e não para um modelo de imagem. A IA que escreve a descrição da selfie também continua lendo a **Appearance** do card. Ela mantém as palavras da aparência alternativa exatamente como foram escritas e usa o texto de **Appearance** só para completar outros detalhes.

### Resolution

O campo **Resolution** define o tamanho da imagem da selfie. Os botões de **Resolution** só aparecem depois que você escolhe uma **Selfie Connection**. Escolha um dos botões rápidos. O padrão é **896x1152**, um formato retrato alto que combina com a maioria das selfies.

Os tamanhos disponíveis são:

| Resolução  | Formato            |
| ---------- | ------------------ |
| 512x512    | Quadrado           |
| 512x768    | Retrato            |
| 768x768    | Quadrado           |
| 768x1024   | Retrato            |
| 896x1152   | Retrato (padrão)   |
| 1024x1024  | Quadrado           |

## Como o personagem envia uma selfie

Com as selfies configuradas, o personagem decide sozinho enviar uma durante o chat. Você não digita nenhum comando. O personagem escolhe a hora, Marinara gera a foto e publica no chat. As respostas seguintes veem uma nota curta com o que a selfie mostrou, para o personagem se lembrar de que a enviou.

A resposta do modelo usa `[selfie]`, com contexto opcional:

```text
Here is a picture from my walk!
[selfie: context="standing beside the river at sunset"]
```

As formas `[selfie: "standing beside the river"]` e `[selfie: standing beside the river]` também funcionam. O comando não diferencia maiúsculas de minúsculas, então `[SELFIE:xxxxx.]` é uma sintaxe válida. É um comando de Conversation, não um gatilho de imagem de Roleplay ou Game Mode. Um marcador que permanece no texto pode indicar outro modo de chat ou **Commands** desativado. Confirme que Illustrator está instalado, **Generated Selfies** está ativado e **Selfie Connection** está selecionada. Se a geração começar e falhar, examine o erro de conexão ou do provedor de imagens; mudar as maiúsculas do marcador não resolve isso.

## Como pedir uma selfie manualmente

Outra opção: pedir a selfie você mesmo, em vez de esperar o personagem.

1. Abra **Chat Settings** e expanda **Gallery** (galeria).
2. Clique no botão **Selfie**, no ícone de câmera.
3. Se o chat tiver mais de um personagem, escolha quem vai tirar a selfie na lista de personagens ao lado do botão.
4. Se a opção **Expose media prompts before sending** estiver ativada em **Settings**, **Generations**, **Overall Generations**, revise ou edite o prompt de selfie já montado e clique em **Generate**. Cancelar a revisão não envia nenhuma requisição de imagem.
5. Espere enquanto o botão mostra **Generating...**.

Quando a selfie fica pronta, aparece a mensagem **Selfie generated.** e a foto entra no chat. Esse pedido manual também usa a **Selfie Connection** escolhida, então consome uma requisição de geração de imagens.

## Gerar uma selfie de novo

Não gostou de uma imagem? Clique em uma selfie no chat para abri-la e depois clique em **Regenerate image** (gerar a imagem de novo), a seta circular ao lado do botão de fixar. Você pode editar o prompt, o prompt negativo e os prompts de personagem, e escolher uma **Image connection** (conexão de imagem). Clique em **Generate image** (gerar imagem). A imagem nova substitui a antiga na mensagem, e a antiga continua na galeria. Cada tentativa consome uma requisição de geração de imagens.

As imagens feitas antes de essa opção existir também podem ser geradas de novo. Elas usam a conexão de selfie do chat, e os prompts negativos e de personagem delas não foram salvos.

<a id="video-messages"></a>

## Mensagens de vídeo

O personagem também pode enviar um clipe de vídeo curto para você. Digite `/video`, ou `/video Aster` para escolher um personagem, ou clique em **Video** (o ícone de filme) na **Gallery** do chat; esse botão usa o personagem escolhido na galeria. **Video** funciona sempre que o Illustrator estiver instalado, mesmo com as selfies desativadas. O clipe chega como uma mensagem nova daquele personagem e toca no chat. Quando você pede um clipe dessa forma, ele mostra o momento mais recente da conversa: a IA que escreve o clipe lê tantas mensagens recentes quanto o Illustrator lê para uma imagem (o tamanho de contexto do **Agent Budget** dele). Quando o primeiro quadro é uma selfie, ela lê as mesmas mensagens, então o clipe também parte desse momento. As respostas seguintes veem uma nota curta com o que o clipe mostra. Você também pode animar uma imagem da galeria: o clipe continua aquela imagem, é enviado pelo personagem escolhido na galeria e entra na resposta mais recente. Se não for possível acrescentar o clipe ao chat, ele continua salvo na aba **Videos** da galeria. A galeria própria de um personagem só lista uma mensagem de vídeo quando o clipe mostra esse personagem; veja [Galerias de personagem e de persona](../characters/galleries.md).

Configure isso em **Chat Settings**, **Agents**, **Illustrator Settings**, na seção **Video messages** (mensagens de vídeo):

- O campo **Video Connection** (conexão de vídeo) escolhe a conexão de Video Generation. Deixe em **Default video connection** (conexão de vídeo padrão) para usar a sua conexão padrão. As **Video Prompting Instructions** (instruções de prompt de vídeo) de uma conexão orientam a IA que escreve o prompt do vídeo.
- O campo **First frame** (primeiro quadro) escolhe a imagem de onde o clipe parte:
  - A opção padrão, **New selfie, or the avatar if no selfie connection** (nova selfie ou o avatar, se não houver conexão de selfie), cria uma selfie nova quando as selfies estão ativadas e há uma **Selfie Connection** definida; caso contrário, usa o avatar.
  - **New selfie, then animate it** (nova selfie e depois animá-la) sempre cria uma selfie nova primeiro. Essa opção exige as selfies ativadas e uma **Selfie Connection**, e a selfie também fica salva na galeria. Com a opção **Expose media prompts before sending** ativada, você revisa o prompt da selfie junto com o do clipe.
  - **Avatar or sprite** (avatar ou sprite) parte do avatar do personagem ou, se não houver avatar, de um sprite de corpo inteiro.
  - **Prompt only (no picture)** (só o prompt: sem imagem) não envia nenhuma imagem, então o modelo de vídeo trabalha só com o prompt. Alguns fluxos de trabalho do ComfyUI precisam de uma imagem e falham sem ela. Quando **Send Avatar References** inclui os vídeos, essa opção aparece como **Prompt only (avatar from Send Avatar References)** (só o prompt: avatar de Send Avatar References) e o clipe parte do avatar.

Imagens em outros formatos, como WebP, são convertidas para o serviço de vídeo. Uma mensagem de vídeo consome uma requisição de vídeo, mais uma requisição de imagem quando parte de uma selfie nova. A IA que escreve o prompt é a escolhida em **Prompt Model**, e as instruções dela ficam em **Settings**, **Generations**, **Video Generation Prompt Overrides**, **Conversation Video Message**.

## Guias relacionados

- [Conversation Mode: primeiros passos](getting-started.md)
- [Provedores de geração de imagens e configuração](../media/image-providers.md)
- [Perfis de estilo de imagem](../media/style-profiles.md)
