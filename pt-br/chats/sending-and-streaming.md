# Enviar mensagens e streaming

Este guia explica o básico de qualquer chat no Marinara Engine: como enviar uma mensagem, como a resposta da IA aparece na tela durante o streaming e como parar ou repetir uma resposta. Você também vê aqui como anexar arquivos, o que significam os indicadores de "pensando" e o que fazer quando aparece um erro de geração.

## Enviar uma mensagem

A barra de digitação fica na parte de baixo de todo chat. Escreva o texto na caixa e comece a resposta da IA de uma destas duas formas:

1. Clique no botão **Send** (enviar), à direita da barra de digitação.
2. Ou pressione Enter, se a opção **Send on Enter** (enviar com Enter) estiver ativada para aquele modo de chat.

A mensagem aparece na lista e, logo depois, a resposta da IA vai sendo gerada.

Cada chat gera uma resposta por vez. Enquanto uma resposta está em streaming, o botão **Send** vira um botão de parar, o que impede começar uma segunda resposta sem querer.

Para enviar, é preciso ter uma conexão funcionando. A conexão é o seu vínculo com um provedor de IA (veja o guia relacionado no fim da página). Sem ela, a resposta falha na hora, com um aviso de que nenhuma conexão está configurada para o chat.

### Send on Enter

A configuração **Send on Enter** fica em **Settings** (Configurações), na aba **General**, na seção **Input & Editing**. Existe um botão liga/desliga para cada modo de chat:

| Modo de chat | Padrão | O que o Enter faz quando está ativado |
|---|---|---|
| Roleplay | Off | Enter envia a mensagem |
| Conversations | On | Enter envia a mensagem |
| Game | On | Enter envia a mensagem |

Quando o botão de um modo está desativado, o Enter só quebra a linha. Aí você clica em **Send** para publicar a mensagem. No Roleplay Mode ele vem desativado por padrão, porque as mensagens de roleplay costumam ser longas e precisam de quebras de linha.

## Anexar imagens e arquivos

Anexe imagens ou arquivos para que a IA possa vê-los ou lê-los. Clique no clipe de papel na barra de digitação e escolha um arquivo. Os arquivos anexados aparecem como etiquetas pequenas acima da caixa de texto antes do envio.

Marinara aceita estes tipos de arquivo:

- Imagens.
- Arquivos PDF.
- Arquivos de texto simples: `.txt`, `.md`, `.markdown`, `.json`, `.jsonl`, `.csv`, `.log`, `.xml`, `.yaml` e `.yml`.

Cada arquivo precisa ter no máximo 20 MB. Um arquivo maior é recusado, com um aviso de que ele é grande demais. Um tipo de arquivo sem suporte também é recusado, com um aviso que lista os tipos permitidos.

A IA só consegue "ver" uma imagem se o modelo conectado tiver suporte a visão. Se o modelo trabalha só com texto, ative a opção **Image Captioning** (descrição automática de imagens). Ela fica em **Chat Settings** (configurações do chat), na seção **Advanced Parameters**, e vem desativada por padrão. Com ela ativada, Marinara descreve cada imagem anexada em texto usando uma conexão que você escolhe e envia essa descrição no lugar da imagem original.

## Inserir uma imagem da galeria em uma mensagem

Os anexos são para a IA *ver*. As referências da galeria são para o leitor *ver*: elas exibem uma imagem da galeria dentro do texto da mensagem.

As mensagens aceitam imagens em Markdown, e o Marinara resolve links `card://` especiais para arquivos da galeria:

```text
![a caption](card://characters/<character-id>/gallery/<filename>.png)
```

No Roleplay Mode, o navegador de recursos do chat pode inserir um desses links. Você também pode colá-lo onde houver texto: mensagens, saudações e diálogos de exemplo.

Para imagens da **própria galeria do personagem**, prefira a forma portátil `card://self/gallery/<filename>`, que continua funcionando após exportar e importar o personagem. O botão **Copy image reference** da galeria a produz. Consulte [Galerias de personagens → Reutilizar uma imagem da galeria em mensagens e saudações](../characters/galleries.md#reuse-a-gallery-image-in-messages-and-greetings) para ver os detalhes.

## O streaming da resposta

No streaming, a resposta aparece palavra por palavra conforme é escrita, em vez de surgir inteira de uma vez. Os controles de streaming ficam em **Settings**, na aba **General**, na seção **Responses**:

| Configuração | Padrão | O que faz |
|---|---|---|
| **Enable streaming** | On | Mostra a resposta palavra por palavra conforme é gerada |
| **Streaming speed** | 50 | Define a velocidade com que o texto aparece na tela |
| **Trim incomplete model endings** | Off | Corta uma frase final inacabada antes de salvar |

A opção **Streaming speed** é um controle deslizante de 1 a 100. Um valor baixo dá um efeito de máquina de escrever mais lento, bom para acompanhar a leitura. Um valor alto mostra o texto quase na hora. Marinara suaviza a chegada irregular dos tokens enquanto o modelo escreve e depois usa a velocidade escolhida para terminar a resposta. Essa configuração não muda a velocidade com que o próprio modelo escreve.

Com **Enable streaming** desativado, a resposta completa aparece de uma vez só, depois que o modelo termina.

A opção **Trim incomplete model endings** mexe apenas na mensagem salva. Quando está ativada, Marinara remove da resposta uma frase final que ficou pela metade. Respostas completas e finais em formato de comando ficam intactas.

## Indicadores de digitação e de progresso

Antes da primeira palavra da resposta chegar, Marinara mostra que o personagem está trabalhando. Aparece o nome do personagem com três pontinhos animados. Em um chat em grupo, os nomes de todos os personagens que estão respondendo aparecem juntos.

Enquanto o servidor prepara o prompt (o texto que Marinara envia para a IA), uma linha curta de progresso passa por estas etiquetas:

- **Preparing context...**
- **Building prompt...**
- **Scanning lorebooks...**
- **Recalling memories...**
- **Running agents...**
- **Retrieving knowledge...**
- **Generating...**

Cada etiqueta corresponde a uma etapa que Marinara executa antes ou durante a resposta. A linha some assim que a primeira palavra da resposta chega. Algumas etapas só acontecem quando o chat usa aquele recurso, então nem toda etiqueta vai aparecer.

Se a presença de um personagem estiver marcada como ocupado ou ausente, no lugar dos pontinhos aparece um indicador de espera. A resposta começa assim que o personagem fica disponível de novo.

## Ver o raciocínio do modelo

Alguns modelos expõem um rastro de raciocínio escondido, muitas vezes chamado de "thinking". Marinara guarda esse conteúdo separado da resposta visível.

Quando uma resposta tem raciocínio junto, aparece nela a ação **View thoughts** (ver o raciocínio), com um ícone de cérebro. Clique nela para abrir um painel com o texto capturado.

Para o raciocínio aparecer, o modelo precisa mesmo devolvê-lo. Alguns modelos envolvem o raciocínio em marcações de texto simples. Nesses casos, configure marcações personalizadas em **Thinking Tags** na conexão, para que Marinara consiga separar o raciocínio escondido da resposta visível. Vários pares de marcação comuns já são reconhecidos. O guia de parâmetros de geração, no fim da página, mostra como configurar **Thinking Tags**.

## Parar uma resposta

Para interromper uma resposta que ainda está sendo gerada, clique no botão de parar. Ele é o próprio botão **Send**: enquanto a resposta está em streaming, o ícone vira um símbolo de parada.

O texto que já tinha chegado antes da interrupção costuma continuar na tela. Parar de propósito nunca é tratado como erro.

## Repetir sem redigitar

Se a última mensagem do chat for sua e a IA nunca tiver respondido, não precisa escrever tudo de novo. Deixe a caixa de digitação vazia. Depois clique no botão **Send** (ou pressione Enter) para começar uma resposta nova, sem duplicar a mensagem. No Conversation Mode, o botão mostra uma seta circular de repetição enquanto esse estado está ativo.

A repetição só funciona com a caixa vazia. Se você já escreveu um rascunho, o botão envia esse rascunho.

No Roleplay Mode existe um atalho parecido. Pressione **Send** com a caixa vazia para pedir que a IA responda de novo, mesmo que ela já tenha respondido. Isso sempre começa uma resposta totalmente nova, sem continuar a anterior. Para estender a resposta anterior, use o comando `/continue`, explicado no guia de ações de mensagem no fim da página.

## Quando aparece um erro de geração

Se uma resposta falha, Marinara mostra uma notificação na parte de baixo da tela. Ela fica visível por cerca de 15 segundos, e o texto pode ser copiado. Uma resposta interrompida não conta como erro.

Em alguns problemas comuns, Marinara reescreve o erro bruto e indica o próximo passo com clareza:

- Se o modelo recusa um parâmetro sem suporte, a notificação diz como resolver. Abra **Chat Settings**, vá em **Advanced Parameters** e desative **Send** para aquele parâmetro.
- Se o modelo exige um parâmetro que está desativado, a notificação pede para ativá-lo de novo. Vá no mesmo lugar e ative **Send** para aquele parâmetro.
- Se a resposta volta completamente vazia, a notificação pede para enviar a mensagem outra vez.

Outros avisos claros que podem aparecer:

- Já existe uma resposta sendo gerada neste chat. Espere terminar ou interrompa com o botão de parar.
- Nenhuma conexão está configurada para este chat. Configure uma primeiro (veja o guia relacionado no fim da página).

Se o erro continuar acontecendo, o guia de solução de problemas no fim da página traz mais soluções para falhas de conexão e de geração.

## Conexões lentas e abas no celular

Uma resposta longa pode demorar, e isso é normal. Interrompa a resposta quando quiser, com o botão de parar.

No celular, o navegador pode pausar a aba do chat quando você sai dela. Se a resposta ainda estava em streaming, Marinara mostra o estado **Finishing in background...**. Em seguida, verifica se a resposta terminou no servidor. Se estiver demorando mais, aparece um aviso de que a resposta continua sendo finalizada em segundo plano. Nesse caso, atualize o chat daqui a pouco, caso ela ainda não tenha aparecido.

## Guias relacionados

- [Ações de mensagem: editar, excluir, swipe e regenerar](messages.md)
- [Conectando a um provedor de IA](../connections/connecting-to-a-provider.md)
- [Parâmetros de geração](../prompts/generation-parameters.md)
- [Solução de problemas do Marinara Engine](../TROUBLESHOOTING.md)
