# Integração com o Home Assistant

Esta integração permite que os seus personagens de IA controlem dispositivos reais da casa inteligente a partir de um chat, como luzes, climatização, persianas e reprodutores de mídia. Ela também permite que automações do Home Assistant enviem mensagens para dentro do Marinara Engine. Home Assistant é uma plataforma gratuita e de código aberto para dispositivos de casa inteligente. Se você não o usa, não precisa deste guia.

## O que a integração acrescenta

A integração é um pequeno programa que se instala dentro do Home Assistant e o liga ao seu servidor Marinara. Na primeira configuração, ela cria o seguinte para você. Você nunca copia endereços de ferramentas nem configura ferramentas na mão.

- Ferramentas de casa inteligente na seção **Functions** (funções) do painel Presets. Veja [Ferramentas personalizadas](../extending/custom-tools.md).
- Um agente chamado **Home Assistant**, um ajudante de IA que roda junto com o seu chat. Veja [Agentes: ajudantes de IA para os seus chats](../agents/agents-overview.md).
- Entidades do Home Assistant (dispositivos, sensores e controles), para que você acompanhe e controle Marinara pelo Home Assistant.

## Antes de começar

- Home Assistant versão 2024.1.0 ou mais recente.
- HACS instalado no Home Assistant. HACS é a Home Assistant Community Store, uma ferramenta para instalar integrações personalizadas.
- Marinara em funcionamento e acessível a partir da máquina do Home Assistant. O endereço padrão é `localhost:7860`.
- `WEBHOOK_LOCAL_URLS_ENABLED=true` no arquivo `.env` do Marinara.

O arquivo `.env` é o arquivo de configurações em texto simples do servidor Marinara. Veja [Configuração do servidor](../CONFIGURATION.md) para saber onde ele fica. A integração usa um webhook, um endereço da web que permite a um aplicativo enviar dados a outro. O webhook do Home Assistant é um endereço `http` local e simples, e Marinara bloqueia esse tipo de endereço por padrão, por segurança. Esta configuração libera esses endereços. Acrescente esta linha e salve. Ela vale sem reiniciar, normalmente em poucos segundos (até cerca de 30 segundos):

```text
WEBHOOK_LOCAL_URLS_ENABLED=true
```

### Se o Home Assistant roda em outro dispositivo

A integração se conecta sem usuário e sem senha, e o formulário de configuração não tem onde informar esses dados.

- Mesma máquina: a conexão funciona de imediato.
- Outro dispositivo: Marinara bloqueia a conexão por padrão. Acrescente o endereço IP desse dispositivo (o número que o identifica na sua rede) a `IP_ALLOWLIST` no `.env`. Em uma rede doméstica de total confiança, você pode definir `ALLOW_UNAUTHENTICATED_PRIVATE_NETWORK=true` no lugar.
- Se Marinara usa `BASIC_AUTH_USER` e `BASIC_AUTH_PASS` (o login), a integração não consegue entrar. Nesse caso, ela só funciona a partir da mesma máquina ou de um dispositivo em `IP_ALLOWLIST`.

Veja [Acesso remoto](../REMOTE_ACCESS.md) para saber qual opção escolher.

## Instalar a integração

### Adicionar ao HACS

1. No Home Assistant, abra o **HACS**.
2. Abra o menu de três pontos e clique em **Custom repositories** (repositórios personalizados).
3. No campo do repositório, informe `https://github.com/Pasta-Devs/Marinara-Engine`.
4. Defina a categoria como **Integration** e clique em **Add**.
5. Busque por **Marinara Engine** e instale.
6. Reinicie o Home Assistant.

### Fazer a configuração

1. Vá em **Settings → Devices & Services** (Configurações → Dispositivos e serviços) e clique em **Add Integration** (adicionar integração).
2. Busque por **Marinara Engine**.
3. Informe o **Host** e a **Port** (porta) onde Marinara roda. Os padrões são `localhost` e `7860`.
4. Clique em **Submit**.

Se não funcionou: o Home Assistant mostra um erro quando não consegue alcançar Marinara. Veja [Solução de problemas](#troubleshooting).

Quando dá certo, a integração registra um webhook privado no Home Assistant, cria as ferramentas na seção **Functions** do Marinara apontando para esse webhook, cria o agente **Home Assistant** com todas as ferramentas ativas na lista e cria as entidades descritas abaixo.

## Adicionar o agente a um chat

Criar o agente não o vincula a todos os chats. Adicione-o a cada chat onde você quer o controle da casa inteligente.

1. Abra o chat e clique em **Chat Settings** (configurações do chat).
2. Abra a seção **Agents**.
3. Adicione o agente **Home Assistant**.

Ele funciona em chats de Roleplay, Conversation e Game. Depois de adicionado, as ferramentas ficam disponíveis para a IA nesse chat. Não é preciso ativar mais nada.

### Conferir se funciona

1. Nesse chat, escreva um pedido comum, por exemplo `Turn on the office lights`, e envie.
2. A IA deve chamar uma ferramenta como `ha_turn_on`, as luzes devem acender, e a IA confirma.

Se nada acontecer, verifique se `WEBHOOK_LOCAL_URLS_ENABLED=true` está definido e veja [Solução de problemas](#troubleshooting).

## Escolher quais ferramentas a IA pode usar

As ferramentas ficam em oito categorias. Para escolher quais Marinara pode usar, abra **Settings → Devices & Services**, clique em **Marinara Engine** e depois em **Configure**. Há duas opções:

- **Primary Chat**: o chat padrão que os serviços do Home Assistant usam como alvo.
- **Exposed Tool Categories**: as categorias que Marinara pode usar.

| Categoria | Padrão | Ferramentas |
| --- | --- | --- |
| Lights & Switches | On | ha_turn_on, ha_turn_off, ha_toggle, ha_set_brightness, ha_set_color, ha_set_color_temp |
| Climate | On | ha_set_temperature, ha_set_hvac_mode |
| Covers (Blinds & Garage) | On | ha_open_cover, ha_close_cover, ha_set_cover_position |
| Locks | Off | ha_lock, ha_unlock |
| Media Players | On | ha_media_play, ha_media_pause, ha_set_volume |
| Scenes & Scripts | On | ha_activate_scene, ha_run_script |
| Query | On | ha_get_state, ha_list_areas, ha_list_entities, ha_notify |
| Generic Service Calls (Advanced) | Off | ha_call_service |

> **Aviso:** **Generic Service Calls (Advanced)** deixa a IA chamar qualquer serviço do Home Assistant. **Locks** deixa a IA trancar e destrancar portas. As duas vêm desativadas por padrão. Ative-as só se você quiser usá-las.

A maioria das ferramentas aceita um dispositivo ou o nome de um cômodo. Com o nome de um cômodo, a ferramenta age em todos os dispositivos correspondentes daquele cômodo. Mudanças nas categorias valem depois que você pressiona **Marinara Sync HA Tools** ou reinicia o Home Assistant.

## Entidades no Home Assistant

A integração cria estas entidades dentro de um dispositivo chamado **Marinara Engine**.

| Entidade | Tipo | O que faz |
| --- | --- | --- |
| Marinara Chat Count | Sensor | Número total de chats do Marinara |
| Marinara Active Agent Count | Sensor | Quantos agentes do Marinara estão ativos |
| Marinara Active Chat | Select | Escolhe qual chat os serviços usam como alvo |
| Marinara Agent: (nome) | Switch | Ativa ou desativa um agente, com um botão liga/desliga por agente |
| Marinara Abort Generation | Button | Cancela qualquer resposta de IA que esteja sendo gerada |
| Marinara Sync HA Tools | Button | Reenvia todas as ferramentas e remonta o agente Home Assistant |

A integração consulta Marinara em busca de novos chats e agentes a cada 30 segundos, então algo que você acabou de criar pode levar até 30 segundos para aparecer.

### Sincronizar depois de mudar as configurações

Pressione o botão **Marinara Sync HA Tools** na página do dispositivo **Marinara Engine**. Ele atualiza as ferramentas existentes no lugar, remonta o agente **Home Assistant** se você o excluiu e desativa (sem excluir) as ferramentas cuja categoria você desligou. Não edite na mão as ferramentas do Home Assistant no Marinara. A próxima sincronização sobrescreve as suas edições e reativa as ferramentas.

## Controlar Marinara a partir de automações

A integração acrescenta dois serviços do Home Assistant para automações. Eles rodam dentro do Home Assistant, não no Marinara. Os dois usam o seu **Primary Chat** como alvo por padrão.

### Send Message (marinara_engine.send_message)

- `message`: o texto da mensagem. Obrigatório.
- `chat_id`: para qual chat enviar. Em branco, usa o Primary Chat.
- `role`: `user`, `assistant`, `system` ou `narrator`. O padrão é `user`.
- `trigger_generation`: quando verdadeiro, a IA também responde. O padrão é falso.

Esta automação avisa a IA quando a porta da frente abre:

```yaml
automation:
  trigger:
    platform: state
    entity_id: binary_sensor.front_door
    to: "on"
  action:
    service: marinara_engine.send_message
    data:
      message: "Someone has arrived at the front door."
      trigger_generation: true
```

### Trigger Generation (marinara_engine.trigger_generation)

Isto inicia uma resposta da IA sem uma mensagem visível.

- `chat_id`: qual chat. Em branco, usa o Primary Chat.
- `user_message`: uma mensagem opcional para incluir no turno da resposta.

<a id="troubleshooting"></a>

## Solução de problemas

### O formulário de configuração diz que não consegue conectar

Verifique se Marinara está em funcionamento e se o **Host** e a **Port** correspondem a onde ele escuta (padrão `localhost` e `7860`). Se o Home Assistant está em outro dispositivo, Marinara bloqueia a conexão, a não ser que o dispositivo esteja em `IP_ALLOWLIST`. A integração não consegue enviar senha, então um Marinara protegido por login também a recusa. Veja [Acesso remoto](../REMOTE_ACCESS.md). Essas regras continuam valendo depois da configuração. Se Marinara passar a bloquear o dispositivo, os sensores e a lista de chats param de atualizar em silêncio.

### A IA tenta usar uma ferramenta de dispositivo e nada acontece

A chamada do webhook provavelmente está bloqueada. Acrescente `WEBHOOK_LOCAL_URLS_ENABLED=true` ao `.env` e salve. Sem essa configuração, as chamadas de ferramenta podem falhar com um aviso de que `http` não é permitido ou de que um endereço privado foi recusado. Se Marinara e Home Assistant estão na mesma máquina, a integração usa o endereço interno automaticamente. Se Marinara está em outro dispositivo, verifique se o endereço local do Home Assistant é alcançável a partir desse dispositivo.

### As ferramentas não aparecem em Functions

Pressione **Marinara Sync HA Tools** ou reinicie o Home Assistant e depois confira **Functions** no painel Presets.

### O agente Home Assistant não está no meu chat

Confirme se o agente existe no Marinara, em Agents. Se não existir, pressione **Marinara Sync HA Tools** para remontá-lo. Depois adicione-o em **Chat Settings → Agents**.

### Encontrar o endereço do webhook na mão

Raramente você precisa dele, já que cada ferramenta já tem o endereço. Abra **Settings → Devices & Services → Marinara Engine** no Home Assistant. O webhook segue este padrão, em que 8123 é a porta padrão do Home Assistant:

```text
http://<homeassistant-ip>:8123/api/webhook/<webhook-id>
```

## Desinstalar

Exclua a integração em **Settings → Devices & Services → Marinara Engine** no Home Assistant. Isso remove as entidades. As ferramentas na seção **Functions** do Marinara e o agente **Home Assistant** continuam lá. Exclua-os na mão no Marinara se não quiser mais usá-los.

## Guias relacionados

- [Ferramentas personalizadas](../extending/custom-tools.md)
- [Agentes: ajudantes de IA para os seus chats](../agents/agents-overview.md)
- [Configuração do servidor](../CONFIGURATION.md)
- [Acesso remoto](../REMOTE_ACCESS.md)
