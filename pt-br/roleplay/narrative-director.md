# Narrative Director e Secret Plot

O Narrative Director é um agente (um ajudante que roda junto com as respostas) que conduz o enredo de um chat de Roleplay. **Push Story** (empurrar a história) dá um empurrão em uma resposta quando a cena parece parada. **Secret Plot** (enredo secreto) mantém um arco de longo prazo escondido que molda muitas respostas. Ele funciona só no Roleplay. Para entender como os agentes funcionam de modo geral, veja [Agentes: ajudantes de IA para os seus chats](../agents/agents-overview.md).

## Adicionar o Narrative Director a um chat

1. Abra **Chat Settings** (configurações do chat) pelo botão de controles deslizantes no chat e vá até **Agents** (agentes).
2. Ative **Enable Agents** (ativar agentes) e depois adicione o agente **Narrative Director**.

Agora um botão **Push Story** aparece acima da caixa de mensagem, e um cartão **Narrative Director** aparece em **Agents**. O agente não faz nada até você usar **Push Story** ou ativar **Secret Plot**.

## Empurrar a história para a frente

**Push Story** age uma vez só. Ele molda apenas a próxima resposta e depois se desliga. Adicione primeiro o Narrative Director ao chat (veja acima).

1. Clique em **Push Story** acima da caixa de mensagem. Um menu pergunta como empurrar:
   - **Naturally** (naturalmente): empurra o enredo existente para a frente. A IA avança as tramas que já estão na sua história.
   - **Randomly** (aleatoriamente): acrescenta uma surpresa plausível à cena.
2. Escolha uma opção. Aparece a mensagem "The next time a character responds, they will push the story forward naturally!" (ou "randomly!"). Agora o botão diz **Push Story: Naturally** ou **Push Story: Randomly**.
3. Envie a próxima mensagem ou gere uma nova resposta. A IA escreve essa resposta com o empurrão aplicado.
4. Depois da resposta, **Push Story** se desliga sozinho.

Você escolhe o modo nesse menu toda vez. Não existe modo padrão nem configuração de modo em **Chat Settings**.

Para cancelar antes de enviar, clique de novo no botão armado. Aparece a mensagem "Push Story disarmed."

Se não funcionou: **Push Story** não responde enquanto uma resposta está sendo gerada. Espere a resposta terminar e depois clique nele.

## Ativar o Secret Plot

**Secret Plot** é um arco de longo prazo escondido. A IA mantém um plano secreto sobre o rumo da história. O plano é acrescentado ao prompt, mas fica escondido de você, a não ser que você o revele. Vem desativado por padrão. Diferente do **Push Story**, ele funciona ao longo de várias respostas e atualiza o plano em intervalos definidos.

1. Abra **Chat Settings → Agents** e encontre o cartão **Narrative Director**.
2. Ative o botão liga/desliga **Secret Plot**. O rótulo dele diz "Maintain a hidden long-term arc for this roleplay."
3. Se quiser, defina **Run Interval** (intervalo de execução). É quantas mensagens (as suas e as da IA) passam entre uma atualização do arco e outra. O padrão é 8. Você pode usar qualquer número inteiro de 1 a 100. Um número menor atualiza o plano com mais frequência.

## Revelar e editar o arco escondido

O painel **Secret plot** fica abaixo de **Run Interval**.

1. Clique em **Reveal spoilers** (revelar spoilers). O botão diz **Reveal empty arc** se a IA ainda não escreveu um arco. Enquanto o arco está escondido, o painel mostra "Spoilers hidden". Clique em **Hide spoilers** (esconder spoilers) para escondê-lo de novo.
2. Edite os campos que quiser:
   - **Arc description**: a linha geral da história escondida.
   - **Protagonist arc**: para onde o seu personagem está caminhando.
   - **Character arc**: para onde caminha um personagem escolhido.
   - **Completed**: marque quando o arco terminar.
3. Use o botão de salvar para manter as alterações.

Para descartar o arco e fazer a IA escrever um novo, clique em **Regenerate** (gerar de novo). Uma janela com o título "Regenerate Secret Plot" pede a sua confirmação. Escolha **Regenerate** para substituir o arco, ou **Keep Current Arc** (manter o arco atual) para cancelar.

O arco fica guardado com o agente **Narrative Director**. Limpar os resultados dos agentes do chat não o exclui. Ele só é excluído quando você remove o agente do chat, e um aviso informa isso antes.

## Mudar o prompt do Secret Plot

O **Secret Plot Prompt** (prompt do enredo secreto) guarda as instruções que o Narrative Director segue ao escrever e atualizar o arco. O prompt embutido trata cada arco como um mistério a desvendar. Isso combina com aventura e intriga, mas pode não servir para uma história movida pelos personagens.

1. Abra **Agents** e edite o **Narrative Director**.
2. Na seção **Secret Plot**, clique em **Copy default to edit** (copiar o padrão para editar).
3. Mude o texto e depois salve o agente.

Clique em **Reset to default** (voltar ao padrão) para voltar ao prompt embutido e depois salve o agente.

> **Observação:** não exclua a última parte do prompt. Ela descreve o formato da resposta, e sem ela Marinara não consegue ler o arco.

O prompt fica salvo no agente, então vale para todos os chats que usam esse Narrative Director.

## Guias relacionados

- [Referência dos agentes para download](../agents/built-in-agents.md)
- [Roleplay Mode: primeiros passos](getting-started.md)
- [Geração guiada e Impersonate](../chats/guided-and-impersonate.md)
