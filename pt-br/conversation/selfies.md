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

O botão liga/desliga **Send Avatar References** (enviar referências de avatar) vem desativado por padrão. Quando ele está ativo, Marinara envia o avatar ou o sprite do personagem ao serviço de imagem como foto de referência. Assim, a selfie fica mais parecida com o personagem. Isso só funciona quando o provedor de imagens aceita imagens de referência.

### Attach Card Appearance

O botão liga/desliga **Attach Card Appearance** (anexar a aparência do card) vem desativado por padrão. Quando ele está ativo, Marinara acrescenta o texto de aparência do card de personagem à descrição da selfie. Com isso, o modelo recebe mais detalhes sobre o visual do personagem.

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

Com as selfies configuradas, o personagem decide sozinho enviar uma durante o chat. Você não digita nenhum comando. O personagem escolhe a hora, Marinara gera a foto e publica no chat.

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
4. Se a opção **Expose media prompts before sending** estiver ativada em **Settings**, **Generations**, **Image Generation**, revise ou edite o prompt de selfie já montado e clique em **Generate**. Cancelar a revisão não envia nenhuma requisição de imagem.
5. Espere enquanto o botão mostra **Generating...**.

Quando a selfie fica pronta, aparece a mensagem **Selfie generated.** e a foto entra no chat. Esse pedido manual também usa a **Selfie Connection** escolhida, então consome uma requisição de geração de imagens.

## Guias relacionados

- [Conversation Mode: primeiros passos](getting-started.md)
- [Provedores de geração de imagens e configuração](../media/image-providers.md)
- [Perfis de estilo de imagem](../media/style-profiles.md)
