# Ferramentas personalizadas e chamada de funções

Este guia explica as ferramentas personalizadas, também chamadas de Functions, no Marinara Engine. Uma ferramenta personalizada ensina a IA a executar uma pequena ação durante um chat. Ela pode devolver um texto fixo, chamar um endereço web externo ou rodar um script curto no servidor. Aqui você vê como criar uma ferramenta, como ativar o uso de ferramentas em um chat e como manter os scripts seguros.

## O que é a chamada de funções

Com a chamada de funções, a IA pede que o aplicativo execute uma ação e depois usa o resultado na resposta. O aplicativo já vem com ferramentas integradas, como rolagem de dados, busca em lorebook e atualização do estado do mundo no jogo. As ferramentas personalizadas ficam ao lado dessas ferramentas integradas, dentro do mesmo sistema **Function Calling** (chamada de funções).

Alguns usos comuns de uma ferramenta personalizada:

- Devolver um fato fixo, como o horário de funcionamento da sua loja ou um conjunto de regras da casa.
- Consultar um serviço externo em busca de dados ao vivo, como a previsão do tempo ou um dispositivo de casa inteligente.
- Fazer uma conta rápida, como somar números ou gerar um resultado personalizado.

Uma ferramenta personalizada não fica presa a um card de personagem. Em vez disso, você a ativa em um chat ou a anexa a um agente. Um agente é um ajudante que roda junto com o chat. Os dois caminhos aparecem abaixo.

Chamadas nativas de função exigem uma conexão compatível com ferramentas. Os transportes de assinatura Claude e Grok ignoram definições nativas de ferramentas; por isso, Chat Settings mostra um aviso de disponibilidade e desativa os controles de ferramentas para essas conexões. Seus comandos de texto e tags de dados continuam disponíveis. Chats Game podem selecionar uma conexão separada de planejamento de ferramentas; veja o custo e o funcionamento em [Planejamento opcional de ferramentas e buscas de lore](../game/getting-started.md#optional-tool-planning-and-lore-searches).

As buscas em lorebooks usam classificação semântica quando as entradas ativadas têm vetores compatíveis. Conversation e Roleplay mantêm a correspondência por texto quando a busca semântica não está disponível. A busca de lore de Game tem ativação própria e informa vetores ausentes ou incompatíveis; ela nunca vetoriza um livro automaticamente.

## A seção Functions

As ferramentas personalizadas são criadas e gerenciadas no painel **Presets** (presets).

1. Abra a barra superior e clique em **Presets**.
2. Encontre a seção **Functions** (funções). O ícone dela é uma chave inglesa.
3. Abaixo do cabeçalho aparece a legenda **Custom function calls available from Chat Settings**.

O cabeçalho da seção tem três botões de ícone:

- **Create function** (criar função, ícone de mais) abre um editor de ferramenta em branco.
- **Import functions from ZIP or JSON** (importar funções, ícone de download) abre um seletor de arquivos.
- **Export functions to ZIP** (exportar funções, ícone de upload) salva todas as suas ferramentas em um único arquivo. Fica esmaecido enquanto não houver nenhuma ferramenta.

Cada ferramenta da lista mostra o nome e duas etiquetas pequenas: o tipo e a quantidade de parâmetros. Mostra também uma descrição curta, um botão liga/desliga, um botão **Edit function** (editar função) e um botão **Delete function** (excluir função). Uma ferramenta do tipo **Script** ainda exibe uma etiqueta âmbar **Script disabled** quando os scripts estão desativados no servidor. A seção Tipo de execução: Script, mais adiante, explica como ativá-los. Arraste uma ferramenta pela alça para reordenar a lista. A ordem serve só para exibição e não muda o comportamento. Enquanto não houver nenhuma ferramenta, a lista mostra **No functions yet**.

O gerenciamento das ferramentas (criar, editar, excluir, reordenar e usar o botão liga/desliga) faz parte de uma área protegida do aplicativo. Se você gerenciar as ferramentas de outro dispositivo, e não do computador que roda o servidor, primeiro é preciso salvar um segredo de administrador. Veja a [Referência de configuração do servidor](../CONFIGURATION.md) e a observação em Segurança dos scripts, mais adiante.

## Como criar uma ferramenta

Siga estes passos para criar uma ferramenta.

1. Na seção **Functions**, clique em **Create function**. O editor completo da ferramenta abre.
2. No campo de nome, no topo, digite um nome em snake_case minúsculo. Esse é exatamente o nome que a IA usa para chamar a ferramenta. Um nome válido começa com letra minúscula e depois usa apenas letras minúsculas, números e sublinhados. Exemplo: `check_weather`.
3. Preencha o campo **Description** (descrição). Escreva o texto como uma instrução para a IA, porque é ele que a IA lê para decidir quando chamar a ferramenta. Exemplo: `Get the current weather for a city the user names.`
4. Adicione os **Parameters** (parâmetros) de que a ferramenta precisa. Veja a próxima seção.
5. Escolha um **Execution Type** (tipo de execução): **Static Result**, **Webhook** ou **Script**.
6. Preencha o campo do tipo escolhido.
7. Clique em **Save**. Um aviso verde **Saved** pisca perto do botão.

Algumas regras importantes:

- O nome precisa ter de 1 a 100 caracteres. A descrição precisa ter de 1 a 500 caracteres.
- Duas ferramentas não podem ter o mesmo nome. Também não é possível usar o nome de uma ferramenta integrada. Veja Nomes reservados, mais adiante.
- Se você sair do editor com alterações não salvas, uma faixa oferece **Keep editing**, **Discard** ou **Save & close**.

## O construtor de parâmetros

Os parâmetros são os valores de entrada que a IA envia ao chamar a ferramenta. Cada parâmetro tem um nome, um tipo, uma marcação de obrigatório e uma descrição.

1. No grupo **Parameters**, clique em **Add Parameter** (adicionar parâmetro).
2. Digite um nome de parâmetro, como `city`.
3. Escolha um tipo no menu suspenso: `string`, `number`, `boolean`, `array` ou `object`.
4. Ative a opção **Required** se a IA sempre precisar enviar esse valor.
5. Escreva uma descrição que explique para a IA o que o valor significa. Exemplo: `The city name to look up, such as Tokyo.`

Você adiciona mais linhas com o botão **Add Parameter** e remove uma linha com o botão de menos. Uma linha que ficar com o nome vazio é descartada ao salvar. Descrições boas nos parâmetros fazem diferença, porque é assim que a IA descobre o que enviar.

Quando uma ferramenta nunca parece ser chamada, um parâmetro mal configurado costuma ser a causa. Isso acontece principalmente ao importar uma ferramenta de um arquivo editado à mão com parâmetros inválidos. Nesse caso, o aplicativo ignora a ferramenta em silêncio durante a geração e apenas escreve uma anotação no log do servidor.

## Tipo de execução: Static Result

Uma ferramenta **Static Result** devolve um texto fixo toda vez que a IA a chama. Não precisa de nenhum serviço externo e funciona na hora para qualquer pessoa. O card dela diz **Returns a fixed string when called.**

O único campo é **Static Result**, uma caixa de várias linhas. O que você digitar ali é devolvido à IA quando ela chamar a ferramenta. Se deixar em branco, a ferramenta devolve `OK`.

Exemplo prático. Crie uma ferramenta chamada `store_hours` com a lista de parâmetros vazia. Na caixa **Static Result**, digite isto:

```
We are open Monday to Friday, 9am to 5pm. We are closed on weekends.
```

Agora, quando a IA chamar `store_hours`, ela recebe esse texto de volta e pode informar o horário ao usuário. A IA vê o seu texto junto com o nome da ferramenta e os argumentos enviados, não a linha solta.

## Tipo de execução: Webhook

Uma ferramenta **Webhook** envia a chamada da ferramenta para um endereço web externo e devolve a resposta desse serviço à IA. Um webhook é um endereço web que recebe dados e devolve dados. O card dela diz **Sends a POST request to an external URL.**

O único campo é **Webhook URL**. O aplicativo envia uma requisição POST para esse endereço. A requisição POST é uma forma de mandar dados para um serviço web. O corpo da requisição é JSON, um formato de texto simples para dados estruturados, com este formato:

```
{ "tool": "your_tool_name", "arguments": { ... } }
```

O serviço deve responder com JSON ou texto simples. Essa resposta é devolvida à IA.

Exemplo prático. Crie uma ferramenta chamada `check_weather` com um parâmetro obrigatório do tipo string chamado `city`. No campo **Webhook URL**, coloque o endereço do seu próprio serviço:

```
https://api.example.com/weather
```

Quando a IA chamar `check_weather` com `city` valendo Tokyo, o seu serviço recebe a requisição, consulta a previsão do tempo e responde. A IA então usa essa resposta na mensagem.

O que você precisa saber sobre webhooks:

- A resposta tem limite de 512 KB.
- Cada chamada tem um tempo limite definido pelo servidor. O padrão é 60 segundos.
- Por padrão, só endereços `https://` são aceitos. Endereços privados e locais, como `localhost` ou um endereço da rede doméstica, ficam bloqueados. Um administrador do servidor precisa ativar uma configuração para liberar os endereços locais. Veja a [Referência de configuração do servidor](../CONFIGURATION.md).
- Se a chamada falhar ou estourar o tempo limite, a IA recebe um resultado de erro em vez de derrubar o chat.

## Tipo de execução: Script

Uma ferramenta **Script** roda um trecho curto de JavaScript no servidor e devolve o resultado. JavaScript é uma linguagem de programação bastante comum. O card dela diz **Runs a JavaScript expression server-side.**

Por segurança, as ferramentas de script vêm desativadas por padrão. Se o seu servidor não as ativou, o card **Script** fica esmaecido e um aviso aparece. Para ativar os scripts, o administrador do servidor coloca esta linha no arquivo `.env` do servidor e reinicia o aplicativo:

```
CUSTOM_TOOL_SCRIPT_ENABLED=true
```

O único campo é **Script Body**. O seu script pode ler `args`, ou seja, os valores enviados pela IA, e precisa devolver um resultado com `return`. Você também tem acesso a `JSON`, `Math` e `Date`.

Exemplo prático. Crie uma ferramenta chamada `add_numbers` com dois parâmetros obrigatórios do tipo number chamados `x` e `y`. Na caixa **Script Body**, digite isto:

```
const result = args.x + args.y;
return { sum: result };
```

Quando a IA chamar `add_numbers` com `x` valendo 2 e `y` valendo 3, a ferramenta devolve a soma 5. Se o script lançar um erro, a IA recebe um resultado de erro em vez de uma queda. Leia a seção Segurança dos scripts, mais adiante, antes de ativar os scripts.

## Incluir o contexto oculto do chat

As ferramentas **Webhook** e **Script** podem receber um objeto de contexto oculto. São dados extras do chat que a IA não enxerga como entradas da ferramenta. Ative o botão liga/desliga chamado **Include hidden chat context** no editor da ferramenta. O padrão é desativado.

Com a opção ativada, o seu webhook ou script recebe um valor `context` ao lado dos argumentos. Esse valor pode incluir o modo do chat, o nome da persona ativa e os nomes dos personagens presentes no chat. Pode incluir também as variáveis salvas do chat e, no Game Mode, o estado do mundo. Assim, a sua ferramenta personaliza o resultado sem que a IA precise mandar todos esses dados.

## Como ativar o uso de ferramentas em um chat

Criar uma ferramenta não faz a IA usá-la. Também é preciso ativar o uso de ferramentas no chat.

1. Abra um chat e clique na engrenagem para abrir **Chat Settings** (configurações do chat).
2. Abra a seção **Function Calling**. O ícone dela é uma chave inglesa.
3. Ative a opção **Enable Tool Use** (permitir o uso de ferramentas). A descrição dela diz **Allow AI to call functions (dice rolls, game state, etc.)**. Em um chat novo, ela vem desativada.

Com a opção **Enable Tool Use** ativada e nenhuma ferramenta adicionada abaixo, o chat pode usar todas as ferramentas ativadas globalmente. Ou seja, as ferramentas integradas, como rolagem de dados e busca em lorebook, mais todas as ferramentas personalizadas que você deixou ativadas na seção **Functions**. Para limitar o chat a um conjunto escolhido, adicione ferramentas específicas:

1. Clique em **Add Functions** (adicionar funções). Uma janela de seleção abre com um campo de busca.
2. Marque as ferramentas que quiser. A lista mistura as ferramentas integradas e as suas ferramentas personalizadas.
3. Clique em **Add Selected** para adicioná-las.

Depois que você adiciona uma ou mais ferramentas, só elas funcionam naquele chat. Nessa janela, o botão **New Custom Function** leva direto para o editor de ferramentas. O campo de busca da janela procura só pelo nome das ferramentas, não pela descrição.

## Como anexar ferramentas a um agente

Você também pode dar uma ferramenta a um agente, em vez de a um chat. Um agente é um ajudante semiautônomo, como um cuidador de lorebook ou um seletor de músicas, que roda durante a geração.

1. Abra o painel **Agents** (agentes) e abra um agente.
2. Abra o grupo **Tools / Function Calling** dele.
3. Ative as ferramentas que aquele agente deve usar.

Mesmo com um agente configurado, ainda é preciso ativar a opção **Enable Tool Use** na seção **Function Calling** do chat. Uma observação sobre o texto da interface: o rodapé do editor de agentes pede para ativar "Enable Function Calling". O botão que você realmente clica se chama **Enable Tool Use**. Os dois se referem ao mesmo controle. Para um passo a passo mais completo sobre agentes, veja [Como criar agentes personalizados](../agents/custom-agents.md).

## Segurança dos scripts

Uma ferramenta **Script** roda código de verdade no seu servidor, então trate isso com cuidado. O aplicativo executa cada script em uma sandbox. A sandbox é uma área isolada que limita o que o código pode fazer. Os limites são:

- Sem acesso à rede. Um script não pode chamar a internet nem nenhum endereço web.
- Sem acesso a arquivos. Um script não pode ler nem escrever arquivos no servidor.
- Sem acesso a variáveis de ambiente nem a segredos do servidor.
- Um tempo limite. Um script demorado é interrompido. O limite padrão é 60 segundos.

Isso protege contra acidentes e bloqueia o acesso à rede e aos arquivos. Não é um isolamento completo do sistema operacional. Quem consegue criar ferramentas ainda pode escrever um script que desperdiça CPU ou memória do servidor. Ative as ferramentas de script apenas em servidores de confiança. Tenha cuidado ao importar ferramentas de script escritas por outras pessoas.

Gerenciar as ferramentas de outro dispositivo também é protegido. Se você não estiver no computador que roda o servidor, salve um segredo de administrador em **Settings** (Configurações), depois **Advanced**, depois **Admin Access**. Esse segredo precisa coincidir com a configuração do servidor. Veja a [Referência de configuração do servidor](../CONFIGURATION.md) para o lado do servidor.

## Exportação e importação

As ferramentas podem ser movidas de uma instalação para outra.

- Para exportar uma ferramenta, abra-a e clique em **Export function**. Isso salva um arquivo `.json`.
- Para exportar todas as ferramentas, clique em **Export functions to ZIP** na seção **Functions**.
- Para importar, clique em **Import functions from ZIP or JSON** e escolha um arquivo `.json` ou `.zip`. Uma mensagem informa quantas ferramentas foram importadas.

As ferramentas importadas do tipo **Webhook** e **Script** são sempre salvas desativadas e com a opção **Include hidden chat context** desligada, mesmo que o arquivo peça uma dessas permissões. Depois da importação, o Marinara mostra o tipo de execução, o destino do webhook quando aplicável e as permissões solicitadas pelo arquivo. Abra cada ferramenta executável importada, confira seu conteúdo e só a ative se você confiar nela. As ferramentas Static mantêm o estado de ativação que veio na importação.

A importação ignora qualquer ferramenta cujo nome conflite com uma ferramenta existente ou com o nome de uma ferramenta integrada. Os pacotes de agente não levam nem importam ferramentas personalizadas junto: exporte as funções confiáveis separadamente, revise-as em **Function Calls** e anexe-as explicitamente depois de importar o agente.

## Nomes reservados

O nome da sua ferramenta personalizada não pode coincidir com o nome de uma ferramenta integrada. Entre os nomes integrados estão `roll_dice`, `update_game_state`, `set_expression`, `trigger_event`, `search_lorebook`, `web_search` e `update_about_me`, entre outros. Se você tentar salvar um deles, esta mensagem aparece:

```
"your_name" is a reserved built-in tool name.
```

Duas ferramentas personalizadas também não podem ter o mesmo nome. Ao repetir um nome, uma mensagem avisa que já existe uma ferramenta com esse nome.

## Solução de problemas

A IA nunca chama a minha ferramenta.

- Confira se a opção **Enable Tool Use** está ativada na seção **Function Calling** do chat.
- Se você adicionou ferramentas específicas ao chat, confira se a sua ferramenta está nessa lista.
- Confira se o botão liga/desliga da ferramenta está ativado na seção **Functions**.
- Deixe o campo **Description** e as descrições dos parâmetros mais claros, para a IA saber quando chamar a ferramenta.
- Se a ferramenta veio de uma importação, parâmetros mal configurados podem fazer o aplicativo ignorá-la. Refaça os parâmetros à mão.

O card Script está esmaecido.

- Os scripts estão desativados neste servidor. Peça ao administrador para definir `CUSTOM_TOOL_SCRIPT_ENABLED=true` e reiniciar. Veja a [Referência de configuração do servidor](../CONFIGURATION.md).

O meu webhook falha ou estoura o tempo limite.

- Confira se o endereço começa com `https://` e se está acessível.
- Um endereço local fica bloqueado, a menos que o administrador libere os endereços locais. Veja a [Referência de configuração do servidor](../CONFIGURATION.md).
- Serviços lentos podem bater no tempo limite de 60 segundos.

Não consigo criar nem editar ferramentas pelo celular ou por outro dispositivo.

- Salve um segredo de administrador equivalente em **Settings**, depois **Advanced**, depois **Admin Access**.

## Guias relacionados

- [Como criar agentes personalizados](../agents/custom-agents.md)
- [Integração com o Home Assistant](../integrations/home-assistant.md)
- [Referência de configuração do servidor](../CONFIGURATION.md)
