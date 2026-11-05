# Espelhamento de mensagens no Discord

O espelhamento de mensagens no Discord copia as mensagens do chat para um canal do Discord enquanto você conversa. Ele funciona nos modos Conversation, Roleplay e Game.

É uma retransmissão de mão única. Marinara envia as mensagens, e o Discord não consegue mandar nada de volta, então isso não é um bot bidirecional. O espelho usa um webhook do Discord, uma URL especial que permite a um aplicativo publicar mensagens em um canal do Discord. O espelho é configurado por chat. Cada chat tem a própria URL de webhook, e os outros chats continuam desligados até você colar uma URL em cada um.

## Crie uma URL de webhook do Discord

O webhook é criado dentro do Discord, não dentro do Marinara. Você precisa de permissão para gerenciar o canal do Discord que quer usar.

1. Abra o servidor do Discord e escolha o canal onde as mensagens devem aparecer.
2. Abra as configurações desse canal, depois a seção **Integrations** (integrações) e então **Webhooks**.
3. Crie um webhook novo e copie a URL dele.

Uma URL de webhook do Discord se parece com esta:

```text
https://discord.com/api/webhooks/123456789012345678/AbCdEf-example-token
```

Guarde essa URL em segredo. Qualquer pessoa que tenha a URL consegue publicar mensagens no seu canal do Discord.

## Ligue o espelho

A caixa do webhook fica nas configurações de cada chat, dentro de **Connected Chats** (chats conectados). Ela se chama **Discord Mirror**, e o texto de exemplo dela é `https://discord.com/api/webhooks/...`.

1. Abra o chat que você quer espelhar.
2. Abra **Chat Settings** (configurações do chat).
3. Localize a seção **Connected Chats**.
4. Cole a URL de webhook na caixa de digitação perto do fim dessa seção.

Pronto, o espelho está ligado para esse chat. Para desligar, apague o conteúdo da caixa.

Se não funcionou: uma URL que não é um webhook válido do Discord mostra o texto em vermelho "Invalid webhook URL format" embaixo da caixa. Corrija a URL e o espelho é salvo. Marinara confere a URL de novo no servidor no momento de salvar.

A URL do webhook fica nesta instalação do Marinara. As exportações de chat, os perfis de configurações exportados e os arquivos do **Export Profile** (exportar perfil) a deixam de fora, e importar qualquer um deles nunca liga um espelho. Para espelhar um chat que você levou para outra instalação, cole a URL de novo lá. Um perfil de configurações que você salvou nesta instalação continua definindo o seu espelho quando você o aplica.

## O que é enviado

Marinara espelha as suas mensagens e as respostas da IA conforme elas são geradas.

- Nome do remetente: as suas mensagens usam o nome da persona ativa. As mensagens da IA usam o nome do personagem.
- Em Game Mode, os turnos dos membros da equipe ou dos NPCs (personagens não jogáveis) vão com o nome "Party". A narração da história vai com o nome "Narrator". Se o jogo usa a opção **Character GM**, as respostas do game master saem com o nome daquele personagem.
- Nenhuma imagem é enviada. O Discord mostra apenas o nome do remetente e o texto.
- Mensagens longas: o Discord limita cada mensagem a 2000 caracteres. Uma mensagem com mais de 1997 caracteres é encurtada, e a cópia espelhada termina com "...".
- Menções como @everyone ou @here dentro do texto não notificam ninguém no seu canal do Discord.

## O que não é enviado

- Respostas regeneradas e swipes não são espelhados de novo. Um swipe é outra resposta guardada na mesma mensagem. Só a primeira resposta de cada turno é enviada.
- Mensagens do recurso Impersonate não são espelhadas. Impersonate é o recurso em que a IA escreve uma mensagem no seu lugar.
- Um envio que falha não é reenviado. Um envio que o Discord responde com um limite de velocidade (429) também não é reenviado; veja abaixo. Um envio que falha não mostra nenhum erro no chat. As falhas que não são limite de velocidade ficam registradas apenas no servidor.

## Limite de velocidade

O Discord limita a velocidade com que um aplicativo pode publicar. Marinara envia no máximo uma mensagem a cada 1,2 segundo por webhook, ou seja, cerca de 50 mensagens por minuto. As mensagens excedentes esperam em uma fila e saem na ordem. Se o Discord responder a um envio com 429 (vá mais devagar), essa mensagem não é reenviada. Marinara espera o tempo de Retry-After que o Discord informar e depois continua com a próxima mensagem da fila.

## Guias relacionados

- [Conectar uma Conversation a um Roleplay ou Game](../chats/connected-chats.md)
