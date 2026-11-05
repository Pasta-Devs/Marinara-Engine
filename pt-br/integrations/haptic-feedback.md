# Configuração do Haptic Feedback

Com o feedback tátil, um personagem de IA envia estímulos de toque para um dispositivo tátil conectado (um brinquedo íntimo) durante um chat. Este guia mostra como instalar o aplicativo auxiliar, adicionar o agente **Haptic Feedback** (feedback tátil) a um chat, conectar o dispositivo e ajustar as configurações de toque.

Marinara Engine não fala diretamente com o dispositivo. Ele envia comandos para um aplicativo companheiro gratuito, o **Intiface Central**, que fala com o dispositivo. Intiface Central usa o **Buttplug.io**, um padrão aberto com suporte em muitos brinquedos e aplicativos. Marinara se conecta a ele por um endereço de rede. O feedback tátil é um agente de chat (um ajudante de IA que você adiciona a um chat). Ele funciona nos modos Conversation, Roleplay e Game.

## Antes de começar

1. Instale o **Intiface Central** a partir de `https://intiface.com/central/`.
2. Abra o aplicativo e inicie o servidor dele com o botão de iniciar o servidor.
3. Pareie o dispositivo dentro do Intiface Central, para que o aplicativo consiga enxergá-lo.

Sem o Intiface Central aberto e com o servidor iniciado, Marinara não consegue enviar estímulos de toque. Você também precisa ter o agente **Haptic Feedback** instalado. Veja [Agentes: ajudantes de IA para os seus chats](../agents/agents-overview.md).

## Adicione o agente Haptic Feedback

1. Abra um chat de Conversation, Roleplay ou Game.
2. Abra **Chat Settings** (configurações do chat) e vá até **Agents**.
3. Adicione o agente **Haptic Feedback**. Um cartão **Haptic Feedback** aparece na lista **Agents**.
4. Ative o botão liga/desliga **Haptic Feedback** no topo do cartão.

Por padrão, o botão vem desativado. Desativado, a descrição diz "Allow this agent to send touch cues during the chat." Ativado, ela diz "Touch cues are enabled for this chat." Com o botão ativado, a IA envia estímulos de toque ocultos enquanto escreve. Eles não aparecem como texto no chat. Eles vão para todos os dispositivos conectados.

## Conecte e procure dispositivos

Ao abrir o cartão, Marinara tenta se conectar ao Intiface Central usando o endereço salvo. A linha de status mostra um ponto verde quando está conectado e um ponto vermelho quando não está. Ao lado fica **Connect** (conectar) quando você está desconectado e **Disconnect** (desconectar) quando está conectado.

1. Clique em **Connect**. Se der certo, a linha mostra "Connected" com o endereço do servidor.
2. Clique em **Scan for devices** (procurar dispositivos) para buscar de novo. Durante a busca, o botão diz "Scanning...".

O cartão mostra "No devices found" ou o número de dispositivos, e lista cada um com o nome exato no Intiface e as ações compatíveis. Marinara também passa ao Haptic Agent esse nome, um tipo de brinquedo deduzido das capacidades do dispositivo e as ações dele. Assim o agente escolhe o dispositivo e a ação certos, em vez de presumir que todo brinquedo vibra.

Se não funcionou: uma conexão que falha mostra uma mensagem pedindo que você confira se o Intiface Central está aberto e com o servidor iniciado, com um link para o site dele.

## Ações e padrões compatíveis

Marinara usa todos os tipos de saída que o Intiface informa para um dispositivo: vibração, rotação, oscilação, constrição, inflação, posição linear, temperatura, spray e iluminação. A posição linear controla dispositivos de carícias, impulsos ou bombeamento. A inflação controla dispositivos com bombeamento por pressão de ar.

O agente pode aplicar os padrões **Steady**, **Tap**, **Pulse**, **Wave**, **Ramp** ou **Impact** a qualquer ação que não seja parar. Padrões posicionais alternam alvos reais de movimento, então um padrão de bombeamento ou de carícias acontece ao longo do tempo, em vez de enviar vários movimentos de uma vez.

## O campo Intiface URL

**Intiface URL** é o endereço WebSocket do servidor do Intiface Central. Um endereço WebSocket é um link que os dois aplicativos usam para conversar. O padrão é:

```text
ws://127.0.0.1:12345
```

`127.0.0.1` significa este mesmo computador. Se você deixar o campo em branco, Marinara usa o padrão do servidor, que você pode mudar com a variável de ambiente `INTIFACE_URL` no `.env`. Veja a [Referência de configuração do servidor](../CONFIGURATION.md). Marinara salva o endereço com o chat e o memoriza neste navegador, então os outros chats que você abre aqui começam com ele.

O endereço fica nesta instalação do Marinara. As exportações de chat, os perfis de configurações exportados e os arquivos do **Export Profile** (exportar perfil) o deixam de fora, e importar qualquer um deles nunca o define. Digite-o de novo depois de levar um chat para outra instalação.

Se você roda Marinara no Docker, ou o abre no navegador de outro dispositivo, `127.0.0.1` não chega até o Intiface Central. Informe o endereço do computador que roda o Intiface Central, trocando os números pelo endereço real desse computador:

```text
ws://192.168.1.50:12345
```

## Sensibilidade ao toque

O cartão mostra o controle **Touch sensitivity** (sensibilidade ao toque) em todos os modos de chat. Ele orienta a facilidade com que o agente escolhe uma saída suave ou forte. Não é um limite máximo: todas as opções podem usar a faixa completa de intensidade, `0.0-1.0`, quando a ação exigir. Marinara valida todo comando contra a faixa física do Intiface.

| Opção | Sensação |
| --- | --- |
| **Subtle** | Favorece um feedback mais suave. |
| **Standard** | Feedback equilibrado para a maioria das cenas. É o padrão. |
| **Intense** | Escolhe feedback mais forte com mais facilidade. |

## Contato incidental

O botão liga/desliga **Incidental contact** (contato incidental), que diz "Tiny taps for accidental brushes and bumps.", vem desativado por padrão. Desativado, a IA ignora pequenos toques acidentais e só envia estímulos para contatos deliberados ou firmes. Ative-o para receber também toques leves em roçadas e esbarrões.

<a id="use-it-from-another-device"></a>

## Usar de outro dispositivo

Por padrão, Marinara só aceita comandos táteis do computador que roda o servidor do Marinara. Isso mantém o controle do dispositivo privado. Por isso, o feedback tátil não funciona quando você abre Marinara pelo celular ou por outro dispositivo que acessa um servidor em outro lugar. As ações de conectar, procurar e comandar são recusadas.

Para liberar isso, ative a configuração de servidor `HAPTICS_ALLOW_REMOTE` e configure uma proteção de acesso: um login ou um segredo de administrador. Veja a [Referência de configuração do servidor](../CONFIGURATION.md) e o guia [Acesso remoto](../REMOTE_ACCESS.md). O acesso de administrador é informado em **Settings → Advanced → Admin Access** (Configurações → Avançado → acesso de administrador).

## Se algo não estiver funcionando

Se a IA nunca aciona o dispositivo, confira nesta ordem:

1. O Intiface Central está aberto e com o servidor iniciado.
2. O dispositivo está pareado e aparece na lista depois de **Scan for devices**.
3. O ponto de status está verde e o botão liga/desliga **Haptic Feedback** está ativado.
4. Se você estiver no celular ou em um dispositivo remoto, veja [Usar de outro dispositivo](#use-it-from-another-device).

Quando o Intiface Central não está conectado, ou nenhum dispositivo está ligado, Marinara pula o estímulo em silêncio e não mostra nenhum erro no chat.

## Guias relacionados

- [Agentes: ajudantes de IA para os seus chats](../agents/agents-overview.md)
- [Referência dos agentes para download](../agents/built-in-agents.md)
- [Acesso remoto: login e lista de IPs permitidos](../REMOTE_ACCESS.md)
