# Ferramentas personalizadas e chamada de funções

Uma ferramenta personalizada (também chamada de função) permite que a IA execute uma pequena ação durante um chat. A ação pode devolver um texto fixo, chamar um endereço web ou rodar um script curto no servidor. Use uma quando quiser que a IA consulte ou calcule algo em vez de chutar.

A chamada de funções significa que a IA pede ao aplicativo que execute uma ação e depois usa o resultado na resposta. Marinara já vem com ferramentas integradas, como rolagens de dados, busca em lorebook e atualizações do estado do jogo. As suas ferramentas personalizadas funcionam ao lado delas. Uma ferramenta personalizada não fica presa a um card de personagem. Você a ativa em um chat ou a anexa a um agente (um ajudante que roda junto com o seu chat).

> **Observação:** as ferramentas precisam de uma conexão que tenha suporte a elas. As conexões de assinatura do Claude e do Grok ignoram definições de ferramentas, então **Chat Settings** (configurações do chat) mostra um aviso e desativa os controles de ferramentas para elas. Os comandos de texto e as tags de dados continuam funcionando.

## Criar uma ferramenta

Antes de começar, abra o painel **Presets** pela barra superior. As ferramentas ficam na seção **Functions** (funções) dele, com o ícone de chave inglesa. Se você abrir Marinara de outro dispositivo, primeiro salve o segredo de administrador em **Settings → Advanced → Admin Access** (Configurações → Avançado → acesso de administrador). Ele precisa coincidir com o `ADMIN_SECRET` do servidor; veja a [Referência de configuração do servidor](../CONFIGURATION.md).

Para uma primeira tentativa, escolha **Static Result** (resultado estático): ele não precisa de mais nada.

### Como criar uma ferramenta

1. Abra **Presets** e encontre **Functions**.
2. Clique em **Create function** (criar função, ícone de mais). Um editor de ferramenta em branco se abre.
3. Digite um nome em snake_case minúsculo, como `check_weather`. Esse é exatamente o nome que a IA chama. Ele começa com uma letra minúscula e depois usa letras minúsculas, números e sublinhados.
4. Preencha **Description** (descrição). Escreva o texto como uma instrução para a IA, porque a IA o lê para decidir quando chamar a ferramenta. Exemplo: `Get the current weather for a city the user names.`
5. Adicione os parâmetros de que a ferramenta precisa (veja [Adicionar parâmetros](#add-parameters)).
6. Escolha um **Execution Type** (tipo de execução): **Static Result**, **Webhook** ou **Script**.
7. Preencha o campo desse tipo (veja [Escolher um tipo de execução](#choose-an-execution-type)).
8. Clique em **Save** (salvar). Um aviso verde **Saved** pisca perto do botão.

Regras para nomes e descrições:

- O nome tem de 1 a 100 caracteres. A descrição tem de 1 a 500 caracteres.
- Duas ferramentas não podem ter o mesmo nome, e uma ferramenta não pode usar um nome integrado, como `roll_dice`, `update_game_state`, `set_expression`, `trigger_event`, `search_lorebook`, `web_search` ou `update_about_me`. Um conflito mostra uma mensagem como `"your_name" is a reserved built-in tool name.`
- Se você sair do editor com alterações não salvas, uma faixa oferece **Keep editing** (continuar editando), **Discard** (descartar) ou **Save & close** (salvar e fechar).

O cabeçalho de **Functions** tem três botões de ícone:

- **Create function** (ícone de mais)
- **Import functions from ZIP or JSON** (importar funções de ZIP ou JSON)
- **Export functions to ZIP** (exportar funções para ZIP), esmaecido quando você não tem ferramentas

Cada ferramenta da lista mostra:

- o nome, o tipo, a quantidade de parâmetros e a descrição
- um botão liga/desliga
- **Edit function** (editar função) e **Delete Function** (excluir função)

Arraste uma ferramenta pela alça para reordenar a lista. A ordem serve só para exibição. Sem ferramentas, a lista mostra **No functions yet**.

<a id="add-parameters"></a>

## Adicionar parâmetros

Os parâmetros são os valores de entrada que a IA envia quando chama a sua ferramenta. Cada um tem um nome, um tipo, uma marcação de obrigatório e uma descrição.

1. No grupo **Parameters** (parâmetros), clique em **Add Parameter** (adicionar parâmetro).
2. Digite um nome, como `city`.
3. Escolha um tipo: `string`, `number`, `boolean`, `array` ou `object`.
4. Ative **Required** (obrigatório) se a IA sempre precisar enviar esse valor.
5. Escreva uma descrição que diga à IA o que o valor significa, como `The city name to look up, such as Tokyo.`

Adicione mais linhas com **Add Parameter** ou remova uma linha com o botão de menos dela. Uma linha com o nome vazio é descartada quando você salva.

Se a IA parece nunca chamar uma ferramenta importada, os parâmetros dela podem ser inválidos, e então o aplicativo ignora a ferramenta sem avisar você. Exclua os parâmetros e adicione-os de novo à mão.

<a id="choose-an-execution-type"></a>

## Escolher um tipo de execução

### Static Result

Uma ferramenta **Static Result** devolve o mesmo texto toda vez. Ela não precisa de nenhum serviço externo. O cartão dela diz **Returns a fixed string when called.**

O único campo é **Static Result**, uma caixa de várias linhas. Se você deixá-la vazia, a ferramenta devolve `OK`.

Exemplo: uma ferramenta chamada `store_hours`, sem parâmetros, com este **Static Result**:

```text
We are open Monday to Friday, 9am to 5pm. We are closed on weekends.
```

Quando a IA chama `store_hours`, ela recebe esse texto junto com o nome da ferramenta e os argumentos que enviou, e pode informar o seu horário ao usuário.

### Webhook

Uma ferramenta **Webhook** envia a chamada para um endereço web e devolve a resposta desse serviço à IA. Um webhook é um endereço que recebe dados e devolve dados. O cartão dela diz **Sends a POST request to an external URL.**

O único campo é **Webhook URL**. O aplicativo envia uma requisição POST, que é uma forma de mandar dados para um serviço web. O corpo é JSON, um formato de texto simples para dados estruturados, com este formato:

```json
{ "tool": "your_tool_name", "arguments": { ... } }
```

Se você ativar **Include hidden chat context** (incluir o contexto oculto do chat), o corpo também traz um valor `context`. O serviço responde com JSON ou texto simples, e essa resposta volta para a IA.

Exemplo: uma ferramenta chamada `check_weather` com um parâmetro obrigatório do tipo string, `city`, e este **Webhook URL**:

```text
https://api.example.com/weather
```

Quando a IA a chama com `city` valendo Tokyo, o seu serviço consulta a previsão do tempo e responde, e a IA usa a resposta na mensagem dela.

Limites:

- A resposta tem limite de 512 KB.
- Cada chamada tem um tempo limite. O padrão é 60 segundos (`CUSTOM_TOOL_TIMEOUT_MS`).
- Por padrão, só endereços `https://` são aceitos. Endereços privados e locais, como `localhost` ou um endereço da rede doméstica, ficam bloqueados até que um administrador do servidor os libere. Veja a [Referência de configuração do servidor](../CONFIGURATION.md).
- Se a chamada falhar ou estourar o tempo limite, a IA recebe um resultado de erro e o chat continua.

Se não funcionou: confira se o endereço começa com `https://` e se está acessível. Um endereço local continua bloqueado, a menos que o administrador o libere. Um serviço lento pode bater no limite de 60 segundos.

### Script

Uma ferramenta **Script** roda um trecho curto de JavaScript no servidor e devolve o resultado. JavaScript é uma linguagem de programação comum. O cartão dela diz **Runs a JavaScript expression server-side.**

As ferramentas de script vêm desativadas por padrão. Se o seu servidor não as ativou, o cartão **Script** fica esmaecido e aparece uma etiqueta âmbar **Script disabled**. Para ativá-las, o administrador do servidor adiciona esta linha ao arquivo `.env` do servidor e reinicia Marinara:

```text
CUSTOM_TOOL_SCRIPT_ENABLED=true
```

O único campo é **Script Body** (corpo do script). O script lê `args` (os valores que a IA enviou) e precisa devolver um resultado com `return`. `JSON`, `Math` e `Date` estão disponíveis.

Exemplo: uma ferramenta chamada `add_numbers` com dois parâmetros obrigatórios do tipo number, `x` e `y`, e este **Script Body**:

```js
const result = args.x + args.y;
return { sum: result };
```

Quando a IA a chama com `x` valendo 2 e `y` valendo 3, a ferramenta devolve a soma 5. Se o script lançar um erro, a IA recebe um resultado de erro.

Um script roda código de verdade no seu servidor, dentro de uma sandbox (uma área isolada que limita o que o código pode fazer):

- Sem acesso à rede e sem acesso a arquivos.
- Sem acesso a variáveis de ambiente nem a segredos do servidor.
- Um tempo limite. O padrão é 60 segundos.

A sandbox não é um isolamento completo do sistema operacional. Quem consegue criar ferramentas ainda pode escrever um script que desperdiça CPU ou memória. Ative as ferramentas de script apenas em servidores de confiança e tenha cuidado com scripts escritos por outras pessoas.

Se não funcionou: quando o cartão **Script** estiver esmaecido, peça ao administrador para definir `CUSTOM_TOOL_SCRIPT_ENABLED=true` e reiniciar.

### Incluir o contexto oculto do chat

As ferramentas **Webhook** e **Script** podem receber dados extras do chat que a IA não vê como entradas da ferramenta. Ative **Include hidden chat context** no editor da ferramenta (desativado por padrão). A sua ferramenta então recebe um valor `context` que pode incluir:

- o modo do chat
- o nome da persona ativa e os nomes dos personagens
- as variáveis salvas do chat
- no Game Mode, o estado do jogo

Assim, uma ferramenta personaliza o resultado sem que a IA precise passar todos esses dados.

## Ativar ferramentas em um chat

Criar uma ferramenta não faz a IA usá-la. Você também precisa ativar o uso de ferramentas no chat.

1. Abra um chat e depois abra **Chat Settings**.
2. Abra a seção **Function Calling** (chamada de funções), que tem o ícone de chave inglesa.
3. Ative **Enable Tool Use** (permitir o uso de ferramentas). A descrição dela diz **Allow AI to call functions (dice rolls, game state, etc.)**. Em um chat novo, ela vem desativada.
4. Confira se funciona: pergunte à IA algo que a sua ferramenta responde, como "What are your store hours?" no exemplo de `store_hours`. A resposta deve usar o texto da ferramenta.

Com **Enable Tool Use** ativado e nada adicionado abaixo dele, o chat pode usar todas as ferramentas ativadas globalmente que sejam compatíveis com ele: as ferramentas integradas e cada ferramenta personalizada cujo botão liga/desliga está ativado em **Functions**. Os chats de Game também precisam de **Let the GM search lore** (permitir que o GM busque lore) para `search_lorebook`.

Para limitar um chat a um conjunto escolhido:

1. Clique em **Add Functions** (adicionar funções). Abre-se um seletor com um campo de busca que procura só pelo nome das ferramentas.
2. Marque as ferramentas que quiser. A lista mistura ferramentas integradas e personalizadas.
3. Clique em **Add Selected** (adicionar selecionadas).

Depois que você adiciona qualquer ferramenta, só essas ferramentas funcionam naquele chat. **New Custom Function** (nova função personalizada), no seletor, leva direto ao editor de ferramentas.

Os chats de Game podem usar uma conexão separada para o planejamento de ferramentas. Veja [Planejamento opcional de ferramentas e buscas de lore](../game/getting-started.md#optional-tool-planning-and-lore-searches) para saber o custo e o funcionamento.

Se não funcionou: confirme que **Enable Tool Use** está ativado, que a ferramenta está na lista do chat, se você adicionou ferramentas específicas, e que o botão liga/desliga da ferramenta em **Functions** está ativado. Uma **Description** mais clara e descrições de parâmetros mais claras ajudam a IA a decidir quando chamá-la.

## Anexar ferramentas a um agente

Você também pode dar uma ferramenta a um agente, em vez de a um chat.

1. Abra o painel **Agents** (agentes) e abra um agente.
2. Abra o grupo **Tools / Function Calling** dele.
3. Ative as ferramentas que esse agente pode usar.

Você ainda precisa ativar **Enable Tool Use** na seção **Function Calling** do chat. O rodapé do editor de agentes lembra você disso. Para agentes em geral, veja [Como criar agentes personalizados](../agents/custom-agents.md).

## Exportar e importar ferramentas

- Para exportar uma ferramenta, abra-a e clique em **Export function** (exportar função). Isso salva um arquivo `.json`.
- Para exportar todas as ferramentas, clique em **Export functions to ZIP**.
- Para importar, clique em **Import functions from ZIP or JSON** e escolha um arquivo `.json` ou `.zip`. Uma mensagem informa quantas ferramentas foram importadas.

As ferramentas de webhook e de script importadas são sempre salvas desativadas, com **Include hidden chat context** desligado, mesmo que o arquivo peça um dos dois. Marinara então mostra o tipo, o endereço do webhook e as permissões que o arquivo pediu. Abra cada ferramenta importada, inspecione-a e ative-a só se confiar nela. As ferramentas estáticas mantêm o estado de ativação importado.

Uma importação ignora qualquer ferramenta cujo nome conflite com uma ferramenta existente ou integrada. Os pacotes de agente não incluem ferramentas personalizadas: exporte-as e revise-as separadamente e anexe-as depois de importar o agente.

## Guias relacionados

- [Como criar agentes personalizados](../agents/custom-agents.md)
- [Integração com o Home Assistant](../integrations/home-assistant.md)
- [Referência de configuração do servidor](../CONFIGURATION.md)
