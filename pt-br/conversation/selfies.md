# Selfies

Uma selfie é uma imagem que um personagem gera de si mesmo e envia em um chat de Conversation, como uma foto compartilhada em um aplicativo de mensagens. Este guia cobre como ativar as selfies, escolher a aparência delas, pedir uma à mão e as mensagens em vídeo.

As selfies vêm do pacote opcional **Illustrator** e usam a geração de imagens. Cada selfie é uma requisição de imagem ao serviço que você escolhe, então elas só gastam algo depois que você as ativa. Elas são diferentes das imagens de cena no Roleplay e no Game Mode.

## Ative as selfies

Antes de começar: instale o **Illustrator** em **Agents → Agent Organizer** e adicione uma conta de imagens, que é uma conta de um serviço que cria imagens (veja [Provedores de geração de imagens e configuração](../media/image-providers.md)).

1. Abra um chat de Conversation e depois abra **Chat Settings**.
2. Encontre a seção **Agents** e abra **Illustrator Settings**.
3. Ative **Generated Selfies**. As configurações de selfie aparecem abaixo dela.
4. Em **Selfie model**, escolha a sua conta de imagens.

Ativar **Generated Selfies** também ativa a chave geral **Commands** do chat.

Os personagens só enviam selfies quando **Selfie model** está definido. Até lá, o chat mostra "Choose a Selfie Provider to let characters generate selfie images."

Se não funcionou: **Illustrator Settings** só aparece quando o Illustrator está instalado. Uma selfie também precisa do comando **Selfies** ativado (veja [Escolha quais Commands um personagem pode usar](getting-started.md#choose-which-commands-a-character-can-use)).

## Configurações de selfie

Todas elas ficam em **Illustrator Settings** e valem só para o chat atual.

- **Selfie model**: a conta de imagens que desenha a imagem. O padrão é **None (selfies disabled)**.
- **Prompt Model**: o modelo de texto que escreve a descrição da imagem. O padrão é **Agent default**.
- **Image Style**: um conjunto salvo de palavras de estilo artístico, como "anime". O padrão é o estilo padrão de Style Profiles nas configurações avançadas. Veja [Perfis de estilo de imagem](../media/style-profiles.md).
- **Images Per Generation**: quantas variantes fazer para cada ilustração ou selfie.
- **Resolution**: o tamanho da imagem. Aparece só depois que você define **Selfie model**. O padrão é 896x1152.
- **Send Avatar References**: envia o avatar ou o sprite do personagem como imagem de referência. Desativada por padrão. Funciona só se o serviço de imagens aceita imagens de referência.
- **Attach Card Appearance**: adiciona ao prompt o texto de **Appearance** do cartão de cada personagem citado. Desativada por padrão.

Opções de **Resolution**: 512x512, 512x768, 768x768, 768x1024, 896x1152 e 1024x1024. 896x1152 é um retrato alto que serve para a maioria das selfies.

**Send Avatar References** e **Attach Card Appearance** oferecem cada uma **Off**, **Images only**, **Videos only** e **Images and videos**.

Se o cartão ou a persona tem **Image Appearance Override** ativado (em **Appearance** no editor), o Marinara envia esse texto no lugar de **Appearance**. Use-o quando **Appearance** é escrito para a história, não para imagens.

## Peça uma selfie à mão

1. Abra **Chat Settings** e expanda a seção **Gallery**.
2. Clique em **Selfie**. Com mais de um personagem, escolha quem a tira na lista ao lado do botão.
3. Se **Expose media prompts before sending** está ativada (**Settings → Generations → Overall Generations**), revise ou edite o prompt e clique em **Generate**. Cancelar não envia nenhuma requisição.
4. Espere enquanto o botão mostra **Generating...**.

Você vê "Selfie generated." e a imagem aparece no chat. Uma requisição manual usa **Selfie model** e custa uma requisição de imagem.

## Como os personagens enviam selfies

Um personagem decide por conta própria quando enviar uma selfie. Você não digita nada. O Marinara gera a imagem e a publica, e as respostas seguintes veem uma nota curta do que ela mostrava.

Se não funcionou: quando você vê o texto literal `[selfie...]` em uma mensagem, confira se o chat está em Conversation Mode, se **Commands** e **Selfies** estão ativados e se **Generated Selfies** está ativada e **Selfie model** está definido. Se a geração começa mas falha, leia o erro sobre a conta de imagens.

## Faça uma selfie de novo

1. Clique em uma selfie no chat para abri-la.
2. Clique em **Regenerate image** (a seta circular ao lado do botão de alfinete).
3. Edite os prompts, se quiser, incluindo os **Character prompts**. Escolha um **Image model**, ou mantenha o **Chat's image provider**.
4. Clique em **Generate image**.

A imagem nova substitui a antiga na mensagem. A antiga continua na Gallery. Cada tentativa é uma requisição de imagem. As imagens feitas antes de esta opção existir usam a conta de selfie do chat, e os prompts negativo e de personagem delas não foram salvos.

<a id="video-messages"></a>

## Mensagens em vídeo

Um personagem pode enviar um vídeo curto. Instale o Illustrator primeiro. As selfies podem ficar desativadas.

Para pedir um você mesmo, digite `/video`, ou `/video Aster` para escolher um personagem. Ou clique em **Video** na **Gallery** do chat, que usa o personagem escolhido ali. O clipe chega como uma mensagem nova e toca no chat. Ele mostra o último momento da conversa: o modelo que o escreve lê tantas mensagens recentes quanto o Illustrator lê para uma imagem (o seu **Agent Budget**). Você também pode animar uma imagem da Gallery. O clipe continua essa imagem e se junta à resposta mais recente.

Se um clipe não puder ser adicionado ao chat, ele ainda fica salvo na aba **Videos** da Gallery. A galeria própria de um personagem lista um vídeo só quando o clipe mostra esse personagem (veja [Galerias de personagens e personas](../characters/galleries.md)).

### Configurações de vídeo

Abra **Chat Settings → Agents → Illustrator Settings**, **Video messages**.

- **Generated Videos**: deixa os personagens enviarem mensagens em vídeo por conta própria. Desativada por padrão nos chats novos, porque cada clipe é uma requisição de vídeo. Ela também aparece como **Videos** na lista de **Commands**.
- **Video Run Interval**: aparece quando **Generated Videos** está ativada. Quantas mensagens precisam passar entre os clipes. **0** os interrompe.
- **Video model**: a conta de vídeo.
- **Default video provider** usa o seu padrão.
- **First frame**: a imagem de que o clipe parte (veja abaixo).

`/video` e o botão **Video** da Gallery funcionam de qualquer forma e ignoram o intervalo. Dar swipe em uma resposta que enviou um clipe deixa o novo swipe enviar o próprio. Em um chat em grupo, cada personagem pode enviar um clipe por resposta, até **Videos per reply** (3 por padrão) em **Settings → Generations → Video Generation**.

Opções de **First frame**:

- **New selfie, or the avatar if no selfie provider** (padrão): uma selfie nova quando as selfies estão ativadas e **Selfie model** está definido, e caso contrário o avatar.
- **New selfie, then animate it**: sempre uma selfie nova, também salva na Gallery. Precisa das selfies ativadas e de **Selfie model**.
- **Avatar or sprite**: o avatar, ou um sprite de corpo inteiro se não houver avatar.
- **Prompt only (no picture)**: nenhuma imagem. Alguns fluxos do ComfyUI falham sem uma. Se **Send Avatar References** inclui vídeos, isto lê **Prompt only (avatar from Send Avatar References)** e parte do avatar.

Com **Expose media prompts before sending** ativada, você revisa o prompt da selfie junto com o prompt do clipe.

As imagens em outros formatos, como WebP, são convertidas para o serviço de vídeo. Uma mensagem em vídeo é uma requisição de vídeo, mais uma requisição de imagem quando ela começa de uma selfie nova. O seu **Prompt Model** escreve o prompt do vídeo, e **Settings → Generations → Video Generation Prompt Overrides → Conversation Video Message** guarda as instruções dele.

## Referência: a tag de selfie

Os personagens pedem uma selfie com uma tag na resposta deles. Você nunca a digita. Ela se parece com `[selfie]`, opcionalmente com contexto:

```text
[selfie: context="standing beside the river at sunset"]
```

`[selfie: "standing beside the river"]` e `[selfie: standing beside the river]` também funcionam, em qualquer combinação de maiúsculas e minúsculas. O Marinara remove a tag e publica a imagem.

## Guias relacionados

- [Conversation Mode: primeiros passos](getting-started.md)
- [Provedores de geração de imagens e configuração](../media/image-providers.md)
- [Perfis de estilo de imagem](../media/style-profiles.md)
