# Ações de mensagem: editar, excluir, swipe e regenerar

Neste guia você aprende o que é possível fazer com uma única mensagem dentro de um chat. Ele explica a barra de ferramentas da mensagem, como editar e excluir uma mensagem e como funcionam os swipes (respostas alternativas) e a regeneração. Também mostra os botões liga/desliga que exibem a contagem de tokens e o número das mensagens.

Toda mensagem no Marinara Engine, escrita por você ou pela IA, tem uma pequena barra de ferramentas. Ela aparece quando você passa o mouse sobre a mensagem no computador, ou quando toca na mensagem no celular ou no tablet.

## A barra de ferramentas da mensagem

Os botões abaixo aparecem nas mensagens. Alguns só surgem em situações específicas, indicadas na tabela. Cada botão tem uma dica (o texto que aparece ao passar o mouse) igual ao nome mostrado aqui.

| Botão | O que faz | Quando aparece |
| --- | --- | --- |
| **Copy** (copiar) | Copia o texto da mensagem. O ícone vira um sinal de confirmação por um instante. | Sempre |
| **Add reaction** (adicionar reação) | Abre um seletor de emoji e ativa ou desativa a sua reação na mensagem. | Só no Conversation Mode |
| **Translate** / **Hide translation** (traduzir / ocultar a tradução) | Traduz a mensagem para o seu idioma e depois esconde a tradução de novo. | Sempre |
| **Edit** (editar) | Abre a mensagem para edição. Veja abaixo. | Sempre |
| **Regenerate** (regenerar) | Cria uma nova resposta alternativa, ou seja, um swipe. Veja abaixo. | Mensagens da IA. No Roleplay Mode, também nas suas mensagens. No Conversation Mode, também nas suas mensagens criadas pelo Impersonate |
| **Show original before rewrite** / **Show rewritten version** (mostrar o original antes da reescrita / mostrar a versão reescrita) | Alterna entre o texto original e o reescrito. As duas versões continuam disponíveis, então você pode compará-las ou ficar com a que preferir. | Só depois que um agente reescreve a mensagem |
| **Hide from AI** / **Unhide from AI** (ocultar da IA / mostrar para a IA) | Interrompe ou retoma o envio desta mensagem para a IA nos turnos seguintes. Em um chat em grupo de Roleplay, abre um seletor de personagens. | Sempre |
| **Peek prompt** (espiar o prompt) | Mostra o prompt exato que a IA recebeu para esta resposta. | Só na mensagem mais recente da IA |
| **Stored guidance** (orientação salva) | Mostra a direção que guiou esta resposta. | Só se a resposta usou uma direção guiada ou veio do Impersonate |
| **Branch from here** (ramificar a partir daqui) | Copia o chat até esta mensagem para uma nova ramificação. | Sempre |
| **View model thoughts** (ver o raciocínio do modelo) | Abre o texto de raciocínio oculto do modelo. | Só se o modelo devolveu o raciocínio |
| **Delete** (excluir) | Exclui a mensagem. Veja abaixo. | Sempre |
| **Pause speaking** / **Resume speaking** / **Restart speaking** (pausar / retomar / reiniciar a fala) | Controla o áudio falado de uma mensagem. | Só quando Text to Speech está ativado e falando |

Sobre o visualizador do **Peek prompt**, veja [Peek Prompt](peek-prompt.md). Sobre **Branch from here**, veja [Ramificações de chat](branches.md). Sobre **Translate**, veja [Tradução de mensagens](../integrations/message-translation.md). Sobre os controles de fala, veja [Configuração de Text to Speech (TTS)](../media/tts-setup.md). Sobre direções guiadas, **Stored guidance** e Impersonate, veja [Geração guiada e Impersonate](guided-and-impersonate.md).

## Como editar uma mensagem

O texto de qualquer mensagem pode ser editado, seja ela sua ou da IA.

1. Clique em **Edit** na mensagem. O texto vira uma caixa editável.
2. Altere o texto.
3. Clique em **Save** (salvar) ou pressione Ctrl e Enter juntos (Cmd e Enter no Mac). A dica do botão diz **Save (Cmd+Enter)**.
4. Para sair sem salvar, clique em **Cancel** (cancelar) ou pressione a tecla Esc. A dica do botão diz **Cancel (Esc)**.

Duas configurações abrem a edição mais rápido. As duas ficam em **Settings** (Configurações), na aba **General**, dentro de **Input & Editing**.

- **Up Arrow edits last message** (ativado por padrão): pressione a tecla Up Arrow com a caixa de entrada vazia. Isso abre a mensagem mais recente para edição.
- **Double-click edits messages** (ativado por padrão): dê um clique duplo ou um toque duplo em uma mensagem de Roleplay para abri-la para edição.

## Como excluir uma mensagem

Ao excluir uma mensagem, aparece uma caixa de diálogo chamada **How to proceed?**. As opções de exclusão são:

- **Delete only this swipe (1/3)**: remove apenas a resposta alternativa que você está vendo. Essa opção só aparece quando a mensagem tem mais de um swipe. Os números mostram qual swipe está ativo e quantos existem.
- **Delete this message**: remove a mensagem inteira e todos os swipes dela.
- **Delete more**: seleciona esta mensagem e todas as que estão abaixo, e ativa a seleção múltipla de mensagens para você ajustar a seleção antes de excluir.
- **Cancel**: fecha a caixa de diálogo sem excluir nada.

Mensagens do sistema, como a linha "joined the chat", têm um botão de exclusão simples, sem caixa de diálogo.

## Swipes: respostas alternativas

Um swipe é uma versão de uma resposta da IA. Uma mesma mensagem guarda vários swipes, então você compara respostas diferentes para o mesmo turno e escolhe a que preferir.

O controle de swipe aparece na mensagem assim que ela tem dois ou mais swipes. Ele mostra o swipe ativo e o total, por exemplo "2/4", com estes controles:

- **Previous swipe** (swipe anterior) e **Next swipe** (próximo swipe): voltam ou avançam entre os swipes.
- Uma caixa numérica: digite o número de um swipe e pressione Enter para ir direto até ele. A dica diz **Jump to swipe 1-N**, em que N é o total.
- **Generate next swipe** (gerar o próximo swipe): quando você está no swipe mais novo, o botão de avançar muda para este e cria um swipe inédito.

O último swipe de uma mensagem não pode ser excluído. Se você tentar, o aplicativo avisa "Cannot delete the last remaining swipe". Use **Delete this message** para remover a mensagem inteira.

## Regenerar, continuar e tentar de novo

Estas três ações parecem iguais, mas fazem coisas diferentes. Escolha a que corresponde ao que você quer.

**Regenerate** cria um novo swipe. Clique em **Regenerate** em uma mensagem da IA para gerar outra versão daquela resposta. O swipe original é mantido. Em tela sensível ao toque, o aplicativo primeiro pergunta "Regenerate this message as a new swipe?", assim você não aciona a opção sem querer. Quando há uma direção guiada preparada, o botão passa a dizer **Regenerate (guided)**.

O comando **/continue** estende a mesma mensagem. Digite `/continue` (ou a forma curta `/cont`) na caixa de entrada e envie. A IA retoma de onde a última resposta parou e acrescenta mais texto naquela mesma mensagem, em vez de criar um novo swipe.

Por padrão, Marinara insere uma linha em branco antes do texto acrescentado. Para que a continuação comece grudada no último caractere da resposta anterior, desative a opção **Settings → General → Responses → Add a new line before /continue text**. Marinara então instrui o modelo a continuar exatamente do ponto de corte, sem separador.

```
/continue
```

O reenvio com a caixa vazia começa uma resposta nova. Se a última mensagem do chat for sua e a caixa de entrada estiver vazia, o mesmo botão **Send** (enviar) tenta de novo em vez de enviar. A aparência dele não muda. Clique nele, ou pressione Enter, para receber uma resposta sem redigitar a mensagem. No Roleplay Mode, um **Send** com a caixa vazia também estimula a IA a continuar a cena com um novo turno. Isso não é a mesma coisa que **/continue**: o envio vazio sempre cria uma resposta nova, enquanto **/continue** acrescenta texto à resposta que já existe.

## Como ocultar uma mensagem da IA

O contexto da IA é o conjunto de mensagens que o aplicativo envia para a IA a cada turno. Clique em **Hide from AI** para deixar uma mensagem fora desse contexto nos turnos seguintes. A mensagem continua visível para você e ganha a etiqueta **Hidden from AI**. Clique em **Unhide from AI** para voltar a enviá-la.

Em um chat em grupo de Roleplay com mais de um personagem, **Hide from AI** abre um seletor compacto de avatares. Selecione o avatar do grupo para ocultar a mensagem de todo mundo, ou selecione um ou mais avatares de personagem para ocultá-la só desses personagens. Selecionar todos limpa as seleções individuais; selecionar um personagem específico desativa a opção de todos. O marcador de olho riscado na mensagem mostra os avatares dos personagens que não conseguem vê-la. Em um chat com um só personagem, o botão continua ocultando ou mostrando a mensagem diretamente.

Um sussurro dentro de uma mensagem ainda chega ao destinatário quando você oculta a mensagem só desse personagem. Ele recebe o sussurro, mas nada do restante da mensagem. Ocultar a mensagem de todo mundo também remove os sussurros dela. Veja [Sussurros e segredos](../roleplay/getting-started.md#whispers-and-secrets).

Você também pode ocultar mensagens com `/hide [range] [name (optional)]`, por exemplo `/hide 3-8`. No Roleplay, `/hide 3-8 Maukie` as oculta apenas de Maukie; sem o nome, elas ficam ocultas para todos. `/unhide [range]` restaura as mensagens ocultas globalmente. Para desfazer a ocultação por personagem, use o seletor de avatares em um chat de grupo Roleplay ou a ação **Unhide from AI** da mensagem em um chat Roleplay com apenas um personagem. A numeração começa em 1, a partir da primeira mensagem do chat. Consulte a [Referência de comandos de barra](slash-commands.md) para ver formatos e exemplos.

Quando a opção **Decide who sees new messages** (decidir quem vê as novas mensagens) do Advanced Memory está ativada, as novas mensagens de um chat em grupo em que os personagens respondem um de cada vez ficam ocultas automaticamente para os personagens ausentes, com o mesmo marcador. Se você mesmo mudar a escolha de uma mensagem, a sua escolha sempre prevalece; veja [Decidir quem vê as novas mensagens](../agents/memory.md#deciding-who-sees-new-messages).

## Botões de exibição das mensagens

Dois botões liga/desliga mudam os detalhes extras exibidos nas mensagens. Os dois ficam em **Settings**, na aba **Advanced**, dentro da seção **Message Tools**. Ambos vêm desativados por padrão.

- **Show message numbers**: mostra um número em cada mensagem. A numeração começa em 1, a partir da primeira mensagem do chat. São os mesmos números usados pelos comandos `/goto`, `/hide` e `/unhide`. Ative essa opção quando precisar descobrir o número de uma mensagem.
- **Show token usage on messages**: acrescenta a contagem de tokens de cada resposta da IA. Um token é um pedacinho de texto que a IA lê e escreve. A contagem mostra os tokens do prompt e os tokens da resposta. Quando a informação existe, ela também mostra os acertos de cache e quanto tempo a resposta levou.

Há ainda um botão liga/desliga relacionado na mesma seção **Message Tools**, o **Show model name on messages**, que acrescenta o nome do modelo de IA que escreveu cada resposta. Ele também vem desativado por padrão.

Quando foi preciso deixar mensagens antigas fora do prompt para ele caber, um aviso curto abaixo da resposta diz quantas, por exemplo "1109 older messages not sent". Para esconder esse aviso abaixo da resposta, desligue **Show "older messages not sent" note** (mostrar o aviso de mensagens antigas não enviadas) na mesma seção. O Checkup ainda pode mostrá-lo quando é aberto. A opção vem ligada por padrão. Os avisos sobre uma resposta que foi cortada ou que voltou vazia continuam aparecendo.

## Guias relacionados

- [Enviar mensagens e streaming](sending-and-streaming.md)
- [Geração guiada e Impersonate](guided-and-impersonate.md)
- [Peek Prompt](peek-prompt.md)
- [Ramificações de chat](branches.md)
- [Configuração de Text to Speech (TTS)](../media/tts-setup.md)
- [Tradução de mensagens](../integrations/message-translation.md)
- [Visão geral das configurações](../settings/settings-overview.md)
- [Solução de problemas do Marinara Engine](../TROUBLESHOOTING.md)
