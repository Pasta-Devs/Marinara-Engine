# Narrative Director e Secret Plot

Este guia explica o agente Narrative Director no Marinara Engine. Aqui você vê o botão **Push Story**, os modos Natural e Random Event e o arco secreto do **Secret Plot**. Esses recursos funcionam no Roleplay Mode.

## O que é o Narrative Director

Um agente é um ajudante de IA que roda por trás do chat para cuidar de uma tarefa em segundo plano. O Narrative Director é um desses agentes. Ele escreve uma orientação única para a próxima resposta, e assim a história caminha do jeito que você quer. Para entender como os agentes funcionam de modo geral, veja a [Agentes: ajudantes de IA para os seus chats](../agents/agents-overview.md).

O Narrative Director só funciona no Roleplay Mode. Ele não age por conta própria. Ele entra em ação apenas quando você o arma (liga para uma única resposta) com o botão **Push Story**, ou quando você ativa o recurso **Secret Plot**.

Para usar, primeiro adicione o agente ao chat. Abra a seção **Chat Settings** (configurações do chat), vá até a seção **Agents** (agentes) e ative o agente **Narrative Director**. Com ele ativo, o botão **Push Story** aparece acima da caixa de mensagem, e um card de configurações do **Narrative Director** aparece na seção **Agents**.

## Push Story

O botão **Push Story** age uma vez só. Ele molda apenas a próxima resposta e depois se desliga. Use quando a cena estiver parada e você quiser que a IA faça a história andar.

Siga estes passos para usar:

1. Abra um chat de Roleplay que tenha o agente **Narrative Director** ativo.
2. Encontre o botão **Push Story** acima da caixa de mensagem.
3. Clique em **Push Story**. No modo Natural aparece a mensagem "The next time a character responds, they will push the story forward naturally!" No modo Random Event, a mensagem termina com "randomly!".
4. Envie a próxima mensagem ou gere uma nova resposta.
5. A IA escreve essa resposta com o empurrão na história aplicado.
6. Depois da resposta, **Push Story** se desliga sozinho.

Se você mudar de ideia antes de enviar, clique em **Push Story** de novo para desligar. Aparece a mensagem "Push Story disarmed."

O botão **Push Story** fica indisponível enquanto uma resposta está sendo gerada. Espere a resposta atual terminar e depois arme o botão.

## Modos Natural e Random Event

O botão **Push Story** tem dois modos. Você escolhe o modo no card **Narrative Director**, dentro de **Chat Settings**. O modo escolhido muda o tipo de empurrão que você recebe.

Os dois modos são:

- **Natural**: empurra o enredo existente para a frente. A IA avança as tramas que já estão na sua história.
- **Random Event**: acrescenta uma surpresa plausível. A IA cria uma reviravolta nova que ainda combina com a cena.

O modo **Natural** é o padrão. Para trocar de modo, abra **Chat Settings**, vá em **Agents**, encontre o card **Narrative Director** e clique no modo desejado.

A dica do botão **Push Story** mostra qual modo está armado. No modo **Natural**, ela diz "Arm a natural Narrative Director push for the next response." No modo **Random Event**, ela diz "Arm a random Narrative Director event for the next response."

## Secret Plot

O recurso **Secret Plot** é um arco de longo prazo escondido no seu roleplay. A IA mantém um plano secreto sobre o rumo da história. Esse plano entra no prompt, o texto que Marinara envia para a IA, mas fica escondido de você, a não ser que você decida revelá-lo. Vem desativado por padrão.

Diferente do **Push Story**, que age uma vez só, o **Secret Plot** funciona ao longo de várias respostas. Ele atualiza o plano escondido em intervalos definidos, conforme o chat continua.

### Como ativar o Secret Plot

1. Abra **Chat Settings** e vá até a seção **Agents**.
2. Encontre o card **Narrative Director**.
3. Ative o botão liga/desliga **Secret Plot**. O rótulo dele diz "Maintain a hidden long-term arc for this roleplay."

### Run Interval

Com o **Secret Plot** ativo, aparece o campo **Run Interval** (intervalo de execução). Ele define quantas mensagens do usuário e do assistente passam entre uma atualização e outra do arco escondido.

O padrão é 8. Você pode usar qualquer número inteiro de 1 a 100. Um número menor atualiza o plano com mais frequência. Um número maior atualiza com menos frequência.

### Revelar e editar o arco escondido

Abaixo do campo **Run Interval** fica o painel **Secret plot**. Use esse painel para ver e alterar o plano escondido.

Clique no botão de revelar para mostrar o arco. Ele aparece como **Reveal spoilers** quando já existe um arco, ou **Reveal empty arc** se a IA ainda não escreveu nenhum. Clique em **Hide spoilers** para esconder de novo. Enquanto o arco está escondido, o painel mostra "Spoilers hidden".

Com o arco revelado, você pode editar estes campos:

- **Arc description**: a linha geral da história escondida.
- **Protagonist arc**: para onde o seu personagem está caminhando.
- **Character arc**: para onde caminha um personagem selecionado do roleplay.
- **Completed**: uma caixa de seleção que você marca quando o arco termina.

Depois de editar um campo, use o botão de salvar para manter as alterações.

Para descartar o arco atual e pedir que a IA escreva um novo, clique em **Regenerate**. Uma janela chamada "Regenerate Secret Plot" pede a sua confirmação. Escolha **Regenerate** para substituir o arco, ou **Keep Current Arc** para cancelar.

### O arco fica guardado com o agente

O arco escondido fica guardado junto com o agente **Narrative Director**. Limpar as execuções de agentes e a memória do chat não exclui o arco. Ele só é excluído quando você remove o agente **Narrative Director** do chat. Ao remover o agente, um aviso informa que o arco escondido será excluído e que essa ação não pode ser desfeita.

### Prompt do Secret Plot

O **Secret Plot Prompt** (prompt do enredo secreto) guarda as instruções que o Narrative Director segue ao escrever e atualizar o arco escondido. O prompt embutido trata cada arco como um mistério a desvendar. Isso combina com aventura e intriga, mas pode não servir para uma história movida pelos personagens.

Para usar as suas próprias instruções, siga estes passos.

1. Abra **Agents** (agentes) e edite o **Narrative Director**.
2. Na seção **Secret Plot**, clique em **Copy default to edit** (copiar o padrão para editar).
3. Mude o texto e depois salve o agente.

Clique em **Reset to default** (voltar ao padrão) para voltar ao prompt embutido e depois salve o agente.

Mantenha o formato de resposta em JSON no fim do prompt: um objeto `overarchingArc` com `description`, `protagonistArc`, um `characterArc` opcional e `completed`. Sem ele, o arco não pode ser lido.

Esse prompt fica salvo no agente, então vale para todos os chats que usam esse Narrative Director.

## Guias relacionados

- [Referência dos agentes para download](../agents/built-in-agents.md)
- [Roleplay Mode: primeiros passos](getting-started.md)
- [Geração guiada e Impersonate](../chats/guided-and-impersonate.md)
