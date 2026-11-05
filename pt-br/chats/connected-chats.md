# Conectar uma Conversation a um Roleplay ou Game

Ligue um chat de Conversation a um chat de Roleplay ou Game para que os dois compartilhem contexto. Um uso comum: você conduz uma história em um chat e conversa sobre ela fora do personagem (OOC, out-of-character) em uma Conversation que continua a par da história.

A seção **Connected Chats** (chats conectados) de **Chat Settings** (configurações do chat) reúne dois recursos diferentes. Uma ligação de **Connected Chats** é um para um, e você a cria manualmente. **Cross-Chat Awareness** (consciência entre chats) é um botão liga/desliga que funciona por conta própria e deixa um personagem lembrar os outros chats de Conversation dele.

## Como uma ligação funciona

Uma ligação junta uma Conversation a um chat de Roleplay ou Game. Cada chat só pode ter uma ligação por vez.

- A Conversation lê automaticamente as mensagens recentes do chat de história ligado, a cada turno.
- O chat de história não lê a Conversation de volta. Os personagens passam informação no sentido contrário com tags, descritas abaixo.

## Ligar uma Conversation a um chat de Roleplay ou Game

Antes de começar: deixe os dois chats prontos. Veja [Como gerenciar a lista de chats](managing-chats.md).

1. Abra o chat de Conversation e abra **Chat Settings**. Veja [Visão geral do painel Chat Settings](chat-settings.md).
2. Abra a seção **Connected Chats**.
3. Clique em **Link to Roleplay or Game** (ligar a um Roleplay ou Game).
4. Procure o chat no seletor e clique nele.

Agora a seção mostra o nome e o modo do chat ligado, com um pequeno botão para desfazer a ligação.

Se não funcionou: só aparecem no seletor os chats que ainda não estão ligados. Desfaça primeiro a ligação do outro chat.

Para começar por um chat de Game, abra **Chat Settings → Connected Chats** desse chat, clique em **Link to Conversation** (ligar a uma Conversation) e escolha a Conversation. O chat de Roleplay não tem botão de ligação. Ele mostra a ligação depois que ela existe, então crie-a pelo lado da Conversation.

### Desfazer uma ligação

Abra **Chat Settings → Connected Chats** e clique no botão de desfazer a ligação (o rótulo dele é **Disconnect**). Isso também limpa as influências pendentes e as notas salvas vinculadas a essa ligação. Excluir um chat também o desconecta.

## Cross-Chat Awareness

**Cross-Chat Awareness** é um botão liga/desliga na seção **Connected Chats** de uma Conversation. A descrição dele diz "Characters know what happens in their other chats". Quando um personagem está em mais de um chat de Conversation, ele consegue lembrar e citar o que aconteceu nos outros. Marinara identifica esses chats pelo personagem em comum, não pelo usuário em comum. A opção vem ativada por padrão e não precisa de ligação.

## Passar informação pela ligação

Os personagens escrevem estas tags dentro das mensagens deles. Você não precisa fazer nada. É assim que os dois chats conversam entre si.

| Tag | O que faz |
| --- | --- |
| `<influence>` | Um direcionamento único da Conversation para o chat de história ligado. Vale para o próximo turno do chat ligado e depois se esgota. |
| `<note>` | Salva um fato duradouro da Conversation no chat de história. Ele fica no prompt do chat de história em todos os turnos, até você limpá-lo. |
| `<ooc>` | Deixa um personagem de Roleplay sair da história e responder à Conversation ligada. Marinara publica o texto lá. |

### Conversation Notes

Os fatos salvos com `<note>` aparecem em uma seção **Conversation Notes** (notas da conversa), no painel **Chat Settings** do chat de história. Cada nota tem um botão para excluir. **Clear all notes** (limpar todas as notas) remove todas elas depois que você confirma, e não há como desfazer. Sem notas, a seção diz que as notas envolvidas por uma tag `<note>` vão aparecer ali.

<a id="switching-between-connected-chats"></a>

## Alternar entre chats conectados

Com uma ligação feita, aparece nos dois chats um botão **Connected chat** (chat conectado), que é um ícone de seta dupla. No computador, ele começa no canto superior direito, e você pode arrastá-lo. No celular, abra o menu de três pontos **Chat tools** (ferramentas do chat), abra **Connected chat** e escolha **Switch to** (alternar para) e o nome do outro chat.

Para manter o controle dentro de Chat Settings, escolha **Put back in Chat Settings** (devolver para as configurações do chat). Ele passa a aparecer como uma seção própria, **Connected chat**. Use o botão de destacar dessa seção para transformá-lo de novo em uma janela separada.

## Outros controles nesta seção

- **Discord webhook URL**: uma caixa sem rótulo, só com um texto de exemplo que começa com `https://discord.com/api/webhooks/`. Cole uma URL de webhook para espelhar as mensagens do chat em um canal do Discord. Esse recurso tem um guia próprio.
- **Allow Noodle references** (permitir referências ao Noodle): deixa a linha do tempo do Noodle puxar as mensagens recentes deste chat. Vem desativado por padrão e só aparece quando o Noodle está instalado.
- **Allow character DMs** (Roleplay): deixa um personagem de Roleplay abrir com você uma nova mensagem direta de Conversation de dentro da história. Vem desativado por padrão e funciona mesmo sem ligação.
