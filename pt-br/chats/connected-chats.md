# Conectar uma Conversation a um Roleplay ou Game

Neste guia você aprende a ligar um chat de Conversation a um chat de Roleplay ou Game para que os dois compartilhem contexto. O texto também explica o recurso **Cross-Chat Awareness** (consciência entre chats), as tags especiais que passam informação de um lado para o outro e como pular de um chat ligado para o outro.

Marinara Engine (daqui em diante, Marinara) tem dois recursos diferentes que fazem um chat saber do outro. Um é automático. O outro é uma ligação um para um que você mesmo cria. Este guia trata os dois separadamente, porque funcionam de formas diferentes.

## Para que serve o Connected Chats

O recurso **Connected Chats** (chats conectados) junta um chat de Conversation a um chat de Roleplay ou Game. A ligação é um para um. Cada chat só pode estar conectado a um outro chat por vez.

Feita a ligação, o lado da Conversation lê automaticamente as mensagens recentes do chat de história. Ele puxa essas mensagens para o próprio contexto a cada turno. Essa é a direção automática da ligação.

O chat de história (o Roleplay ou o Game) não lê de volta as mensagens da Conversation automaticamente. Para mandar informação no sentido contrário, o personagem usa tags especiais. Elas estão descritas mais adiante.

Um uso comum: você conduz um Roleplay ou Game imersivo em um chat e mantém uma conversa paralela fora do personagem (OOC, out-of-character) em uma mensagem direta de Conversation. O chat OOC continua a par da história, então você pode comentar tudo enquanto acontece.

## Cross-Chat Awareness não é a mesma coisa que uma ligação

Dois recursos se confundem com facilidade. Leia esta seção antes de configurar qualquer coisa.

O recurso **Cross-Chat Awareness** é automático. É uma configuração do Conversation Mode. Quando o mesmo personagem está em mais de um chat de Conversation, ele consegue lembrar e citar o que aconteceu nesses outros chats. Você não liga nada manualmente. A configuração vem ativada por padrão.

Ela fica na seção **Cross-Chat Awareness** de **Chat Settings** (configurações do chat). O texto de ajuda diz: "Characters remember and reference conversations from other chats they're in. Pulls recent messages from sibling chats and injects them as context." Marinara identifica esses chats irmãos pelo personagem em comum, não pelo usuário em comum.

Uma ligação de **Connected Chats** é outra coisa. Ela é criada por você, de propósito. Junta exatamente uma Conversation a um chat de Roleplay ou Game. E leva consigo o contexto da história e as tags especiais descritas abaixo.

Resumindo: **Cross-Chat Awareness** conecta um personagem entre os chats de Conversation dele, sozinho. Uma ligação de **Connected Chats** junta uma Conversation a um chat de história, manualmente.

## Ligar uma Conversation a um chat de Roleplay ou Game

A ligação começa pelo chat de Conversation ou por um chat de Game. Siga estes passos para começar pelo lado da Conversation.

1. Abra o chat de Conversation que você quer ligar.
2. Abra **Chat Settings** (configurações do chat) pelo botão no chat. Ele começa no canto superior direito, a menos que você o tenha movido.
3. Localize a seção **Connected Chats**.
4. Clique em **Link to Roleplay or Game**.
5. Procure o chat de Roleplay ou Game no seletor e clique nele.

Agora o nome do chat ligado e o modo dele aparecem dentro da seção **Connected Chats**. Ao lado, fica um pequeno botão para desfazer a ligação.

Para começar por um chat de Game, abra **Chat Settings** desse chat, localize a seção **Connected Chats** e clique em **Link to Conversation**. Depois escolha a Conversation.

O chat de Roleplay não tem botão de ligação próprio. Ele mostra a ligação depois que ela existe, mas quem cria é o lado da Conversation.

Só aparecem no seletor os chats que ainda não estão ligados. Cada chat comporta uma ligação por vez.

### Desfazer uma ligação

Para desfazer a ligação, abra **Chat Settings**, localize a seção **Connected Chats** e clique no botão de desconectar (a dica dele diz **Disconnect**). Ao desconectar, Marinara também descarta as influências pendentes e as notas salvas ligadas àquela conexão.

Excluir um chat também o desconecta do chat ligado.

## Passar informação de um lado para o outro

A Conversation lê o chat de história automaticamente. Os outros sentidos usam tags. Essas tags aparecem dentro das mensagens do personagem. Quem escreve elas é a IA. Normalmente você não digita nada disso, mas entender o que cada uma faz ajuda a compreender a ponte entre os chats.

Escreva essas tags como texto literal caso precise citá-las. Cada uma aparece aqui em código, para ser exibida exatamente assim.

- `<influence>` manda um direcionamento único da Conversation para o chat de história ligado. Vale para o próximo turno do chat ligado e depois se esgota.
- `<note>` salva um fato duradouro da Conversation no chat de história ligado. Ele fica no prompt do chat de história em todos os turnos, até você limpar.
- `<ooc>` deixa o personagem de Roleplay sair da história e responder direto na Conversation ligada. Marinara publica esse texto no chat de mensagem direta ligado.

Ou seja: o personagem da Conversation pode moldar ou informar a história discretamente com `<influence>` e `<note>`. E o personagem de Roleplay pode responder à Conversation com `<ooc>`.

## Conversation Notes

Quando o personagem da Conversation salva um `<note>` duradouro, ele aparece do lado da história. O chat de Roleplay ou Game ganha uma seção **Conversation Notes** (notas da conversa) em **Chat Settings**.

Essa seção lista todas as notas salvas. Cada nota tem um botão para excluir. Para remover todas de uma vez, use o botão **Clear all notes**. Marinara pede confirmação antes de limpar, e não há como desfazer.

Se nenhum personagem salvou nota ainda, a seção explica que as notas envolvidas por uma tag `<note>` vão aparecer ali depois de salvas.

<a id="switching-between-connected-chats"></a>

## Alternar entre chats conectados

Quando um chat tem outro ligado a ele, aparece um botão móvel **Connected chat**, com uma seta dupla, inicialmente no canto superior direito. Você pode arrastá-lo no computador ou no celular. Clique ou toque nele para abrir uma pequena janela e escolha **Switch to** seguido do nome do outro chat.

A ação leva direto ao chat conectado, sem precisar procurá-lo na lista. O botão aparece nos dois lados da ligação, em Conversation e em Roleplay.

Se preferir mantê-lo dentro de Chat Settings, escolha **Put back in Chat Settings** na janela. Ele vira a seção **Connected chat**. O botão para destacar essa seção abre uma janela própria novamente.

## Outros controles nesta seção

A seção **Connected Chats** também guarda dois controles extras que pertencem a outros recursos. Eles ficam aqui por comodidade.

- A caixa **Discord webhook URL**. Ela não tem rótulo visível, só um texto de exemplo que começa com `https://discord.com/api/webhooks/`. Ao colar ali uma URL de webhook do Discord, as mensagens do chat são espelhadas em um canal do Discord. Isso faz parte do recurso de espelhamento de mensagens no Discord, que tem guia própria.
- O botão liga/desliga **Allow Noodle references** (desativado por padrão). Com ele, a linha do tempo do Noodle dentro do aplicativo puxa as mensagens recentes deste chat. Noodle tem guia própria.

Do lado do Roleplay, aparece também o botão liga/desliga **Allow character DMs** (desativado por padrão). Quando está ativado, o personagem de Roleplay pode abrir uma nova mensagem direta de Conversation com você de dentro da história. Isso funciona mesmo sem nenhuma Conversation ligada.

## Guias relacionados

- [Conversation Mode: primeiros passos](../conversation/getting-started.md)
- [Roleplay Mode: primeiros passos](../roleplay/getting-started.md)
