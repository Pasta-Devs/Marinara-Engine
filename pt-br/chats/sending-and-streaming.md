# Enviar mensagens e streaming

Digite uma mensagem, envie e veja a resposta aparecer. Este guia trata do envio, dos anexos, do streaming e de como parar uma resposta, tentar de novo e ler um erro.

## Enviar uma mensagem

Antes de começar: o seu chat precisa de um modelo. Veja [Conectando a um provedor de IA](../connections/connecting-to-a-provider.md).

1. Digite na barra de entrada, na parte de baixo do chat.
2. Clique em **Send** (enviar) ou pressione <kbd>Enter</kbd>, se **Send on Enter** (enviar com Enter) estiver ativado para aquele modo de chat.

A sua mensagem aparece e, em seguida, a resposta chega em streaming. Cada chat gera uma resposta por vez. Enquanto uma resposta está em streaming, **Send** vira um botão de parar.

Se não funcionou: sem um modelo definido para o chat, a resposta falha na hora, com um aviso de que nenhuma conexão está configurada. Escolha um em [Chat Settings](chat-settings.md).

### Send on Enter

Ele fica em **Settings → General → Input & Editing** (Configurações → Geral → Entrada e edição). Há um botão liga/desliga para cada modo de chat.

| Modo de chat | Padrão | Quando está desligado |
| --- | --- | --- |
| Roleplay | Desligado | <kbd>Enter</kbd> adiciona uma nova linha. Clique em **Send**. |
| Conversations | Ligado | <kbd>Ctrl</kbd>+<kbd>Enter</kbd> (<kbd>Cmd</kbd>+<kbd>Enter</kbd> no Mac) envia. |
| Game | Ligado | <kbd>Ctrl</kbd>+<kbd>Enter</kbd> (<kbd>Cmd</kbd>+<kbd>Enter</kbd> no Mac) envia. |

No Roleplay, ele vem desligado por padrão porque as mensagens de roleplay costumam ser longas e precisam de quebras de linha. Professor Mari tem um botão liga/desliga próprio, **Enter sends to Professor Mari** (Enter envia para a Professor Mari), em **Settings → General → Search and Professor Mari settings** (Configurações → Geral → configurações da busca e da Professor Mari).

## Anexar imagens e arquivos

1. Toque no clipe de papel na barra de entrada.
2. Escolha um arquivo. Ele aparece como uma pequena etiqueta acima da caixa de entrada.
3. Envie normalmente.

Marinara aceita imagens, arquivos PDF e arquivos de texto simples (`.txt`, `.md`, `.markdown`, `.json`, `.jsonl`, `.csv`, `.log`, `.xml`, `.yaml`, `.yml`). Cada arquivo precisa ter no máximo 20 MB. Marinara recusa um arquivo maior ou de um tipo sem suporte, com um aviso.

Um modelo só consegue ver uma imagem se tiver suporte a visão. Para um modelo só de texto, ative **Image captioning** (descrição automática de imagens) em **Chat Settings → Advanced Parameters** (configurações do chat → parâmetros avançados). A opção vem desativada por padrão. Marinara então descreve cada imagem em texto, com um modelo que você escolhe, e envia essa descrição no lugar da imagem.

## Mostrar uma imagem da galeria dentro de uma mensagem

Os anexos são para o modelo ver. Um link da galeria mostra uma imagem para você dentro do texto da mensagem. As mensagens aceitam a sintaxe de imagem do Markdown, e Marinara resolve links `card://` para arquivos da galeria:

```text
![a caption](card://characters/<character-id>/gallery/<filename>.png)
```

No Roleplay, o navegador de recursos do chat pode inserir um link para você. Você também pode colar um em mensagens, saudações e diálogos de exemplo.

Para a própria galeria de um personagem, use a forma portátil `card://self/gallery/<filename>`. Ela continua funcionando depois que o personagem é exportado e importado. O botão **Copy image reference** (copiar a referência da imagem) da galeria gera essa forma. Veja [Galerias de personagem](../characters/galleries.md#reuse-a-gallery-image-in-messages-and-greetings).

## O streaming da resposta

O streaming mostra a resposta palavra por palavra, em vez de tudo de uma vez. Estas configurações ficam em **Settings → General → Responses** (Configurações → Geral → Respostas).

| Configuração | Padrão | O que faz |
| --- | --- | --- |
| **Enable streaming** | Ligado | Mostra a resposta enquanto ela é escrita. Quando está desligado, a resposta inteira aparece quando o modelo termina. |
| **Streaming speed** | 50 | Controle deslizante de 1 a 100. Um valor menor dá um efeito de máquina de escrever mais lento. Ele não muda a velocidade com que o modelo escreve. |
| **Trim incomplete sentences from the response** | Desligado | Remove uma última frase inacabada antes de a resposta ser salva. Respostas completas e finais em formato de comando ficam como estão. |

## Indicadores de digitação e de progresso

Antes de a primeira palavra chegar, você vê o nome do personagem com três pontinhos animados. Em um chat em grupo, aparece o nome de cada personagem que está respondendo. Enquanto o servidor prepara o prompt, uma linha de progresso passa por estas etiquetas. Algumas etapas só rodam quando o chat usa aquele recurso, então talvez você não veja todas.

- **Preparing context...**
- **Building prompt...**
- **Scanning lorebooks...**
- **Recalling memories...**
- **Running agents...**
- **Retrieving knowledge...**
- **Generating...**

Se o status de um personagem for ocupado ou ausente, um indicador de espera aparece no lugar dos pontinhos. A resposta começa quando o personagem fica disponível.

## Ver o raciocínio do modelo

Alguns modelos devolvem um rastro de raciocínio oculto, chamado de "thinking". Quando uma resposta tem um, aparece na mensagem um ícone de cérebro, **View model thoughts** (ver o raciocínio do modelo). Clique nele para ler o raciocínio.

Para isso funcionar, o modelo precisa devolver o raciocínio. Alguns modelos o envolvem em marcações de texto simples. Para esses, defina **Thinking Tags** (marcações de raciocínio) nas configurações de geração, para que Marinara consiga separar o raciocínio da resposta. Veja [Parâmetros de geração](../prompts/generation-parameters.md).

## Parar uma resposta

Clique no botão de parar, que é o botão **Send** enquanto uma resposta está em streaming. O texto que já chegou costuma ser mantido. Parar de propósito nunca mostra um erro.

<a id="retry-without-retyping"></a>

## Tentar de novo sem redigitar

Se a última mensagem for sua e a IA nunca tiver respondido, deixe a caixa de entrada vazia e clique em **Send** (ou pressione <kbd>Enter</kbd>). Marinara começa uma resposta nova e não acrescenta uma mensagem duplicada. No Conversation, o botão mostra uma seta circular nesse estado. Se a caixa tiver um rascunho, **Send** envia o rascunho.

No Roleplay, um **Send** com a caixa vazia também começa uma resposta totalmente nova depois que a IA já respondeu. Ele não acrescenta texto à resposta anterior. Para estender a resposta anterior, use `/continue`. Veja [Ações de mensagem](messages.md).

## Quando aparece um erro de geração

Uma resposta que falha mostra uma notificação (uma mensagem curta que surge na tela) na parte de baixo da tela, por cerca de 15 segundos. Você pode copiar o texto dela. Marinara reescreve alguns erros para indicar o próximo passo:

| Causa | O que a notificação diz |
| --- | --- |
| O modelo recusa um parâmetro para o qual não tem suporte | Abra **Chat Settings → Advanced Parameters** e desative **Send** para aquele parâmetro. |
| O modelo exige um parâmetro que está desativado | Ative **Send** de novo no mesmo lugar. |
| A resposta voltou vazia | Envie a sua mensagem de novo. |
| Uma resposta já está sendo gerada | Espere, ou interrompa a resposta com o botão de parar. |
| Nenhuma conexão está configurada | Configure uma para o chat. |

Se um erro continuar acontecendo, veja [Solução de problemas](../TROUBLESHOOTING.md).

## Conexões lentas e abas no celular

Uma resposta longa pode demorar. Você pode pará-la a qualquer momento. No celular, o navegador pode pausar a aba de um chat quando você sai dela. Se uma resposta estava em streaming, Marinara mostra **Finishing in background...** e depois verifica se a resposta terminou no servidor. Se ela não tiver aparecido, atualize o chat daqui a pouco.
