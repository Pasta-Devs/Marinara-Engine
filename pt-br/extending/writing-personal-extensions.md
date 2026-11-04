# Como escrever Personal Extensions

Este guia mostra como escrever uma Browser Extension ou uma Server Extension, empacotá-la e importá-la. Ele é para quem sabe escrever JavaScript. Para revisar e executar uma extensão, veja [Personal Extensions](personal-extensions.md).

O código que você mesmo escreve e importa é tratado como uma **External Extension** (extensão externa). Ele começa desativado e só pode ser executado depois que você o inspeciona e aprova o hash SHA-256 exato dele.

## Antes de começar

As External Extensions ficam ocultas até você abrir as duas etapas de segurança de [Permitir importações de terceiros](personal-extensions.md#allow-third-party-imports): `ENABLE_EXTERNAL_EXTENSIONS=true` no `.env` e **Allow third-party extension imports** (permitir a importação de extensões de terceiros) em **Settings → Advanced → Danger Zone** (Configurações → Avançado → Zona de perigo).

Para importar e gerenciar extensões, também é necessário ter acesso por localhost ou o segredo de administrador. Pelo celular, por um endereço da LAN ou por um navegador remoto, defina `ADMIN_SECRET` no servidor e informe o mesmo valor em **Settings → Advanced → Admin Access** (Configurações → Avançado → acesso de administrador).

Escolha o ambiente menos poderoso que dê conta da tarefa:

| Ambiente | Use para | Limite importante |
| --- | --- | --- |
| Sandboxed Browser Extension | Estado privado, contexto do chat ativo, botões, ações de menu e painéis renderizados pelo Marinara | Sem DOM do Marinara, cookies, armazenamento do navegador, rede nem HTML arbitrário |
| Server Extension | Lógica em segundo plano que precisa de temporizadores gerenciados e armazenamento privado da extensão | Sandbox separada do sistema operacional; sem arquivos ou segredos do Marinara, rede, processos filhos nem módulos nativos |
| Full-page External Extension | Código legado que precisa da página do Marinara ou das APIs de mesma origem | Sem sandbox; use apenas para o código exato em que você confia totalmente |

As Browser Extensions funcionam em todas as plataformas compatíveis. As Server Extensions exigem o Seatbelt do macOS ou o Bubblewrap do Linux. Consulte a [tabela de plataformas](personal-extensions.md#platform-support) antes de escolher uma Server Extension.

## Início rápido de uma Browser Extension

Crie uma pasta com esta estrutura:

```text
Hello Panel/
  manifest.json
  extension.js
  extension.css
```

Use este `manifest.json`:

```json
{
  "kind": "marinara.personal-extension",
  "version": 1,
  "config": {
    "name": "Hello Panel",
    "version": "1.0.0",
    "description": "A minimal sandboxed Browser Extension.",
    "runtime": "client",
    "capabilities": [],
    "jsPath": "extension.js",
    "cssPath": "extension.css"
  }
}
```

Use este `extension.js`:

```js
const saved = await marinara.storage.get();
let count = Number(saved.count) || 0;

const statusElement = () => ({
  kind: "text",
  text: `Button pressed ${count} time${count === 1 ? "" : "s"}.`,
});
const elements = () => [
  statusElement(),
  { kind: "button", id: "increment", label: "Count one" },
];

const panel = marinara.ui.registerContribution({
  id: "hello-panel",
  kind: "panel",
  label: "Hello Panel",
  description: "Minimal Personal Extension example",
  icon: "hand",
  elements: elements(),
  onEvent: async ({ elementId }) => {
    if (elementId !== "increment") return;
    count += 1;
    await marinara.storage.patch({ count });
    panel.update({ elements: elements() });
    marinara.ui.showWindow({ title: "Hello Panel", elements: [statusElement()] });
  },
});

marinara.log.info("Hello Panel loaded");
marinara.onCleanup(() => panel.remove());
```

Use este `extension.css` para estilizar a janela iframe restrita que o botão abre:

```css
[data-ext-root] {
  font-size: 16px;
}
```

Depois, importe e execute a extensão:

1. Abra **Settings → Addons → External Extensions** (Configurações → Complementos → extensões externas).
2. Escolha **Import Extension Folder** (importar pasta de extensão) e selecione `Hello Panel`, ou compacte a pasta e importe o ZIP com **Import Extension File** (importar arquivo de extensão).
3. Abra o rascunho desativado e inspecione o manifesto e o JavaScript dele.
4. Escolha **Review and Run** (revisar e executar) e aprove o hash exato exibido.
5. Abra o menu Extensions e selecione **Hello Panel**.

O mesmo exemplo executável está em `docs/examples/personal-extensions/browser-minimal/` no repositório.

## Referência da Browser API

As Browser Extensions em sandbox recebem um único objeto global congelado chamado `marinara`:

| API | Finalidade |
| --- | --- |
| `runtime`, `version` | Nome do ambiente (`client`) e versão atual da Browser API |
| `extensionId`, `extensionName`, `capabilities` | Identidade e capacidades aprovadas para esta revisão exata da extensão |
| `log.debug/info/warn/error(...)` | Gravar uma entrada identificada no console do navegador |
| `storage.get()` | Ler o objeto JSON privado desta extensão |
| `storage.patch(object)` | Mesclar valores no armazenamento privado e retornar o novo objeto |
| `storage.delete()` | Limpar o armazenamento privado |
| `context.get()` | Ler o instantâneo atual do chat ativo |
| `context.subscribe(listener)` | Receber mudanças de contexto; retorna uma função para cancelar a inscrição |
| `ui.registerContribution(options)` | Adicionar um botão seguro, um item do menu Extensions ou um painel renderizado pelo Marinara |
| `ui.showWindow(options)` | Abrir uma janela iframe restrita |
| `dice.registerFormat(options)` | Ensinar uma notação ao `/roll`; Marinara rola os dados que ela indica |
| `setTimeout`, `setInterval`, `clearTimeout`, `clearInterval` | Temporizadores gerenciados que são removidos quando a extensão para |
| `onCleanup(callback)` | Registrar outra lógica de limpeza |

Use os [painéis renderizados pelo Marinara](#add-a-marinara-rendered-panel) para a interface normal, o [contexto do chat ativo](#use-active-chat-context) para um comportamento que leve o chat em conta e os [formatos de dados](#add-a-dice-format) para uma notação personalizada do `/roll`. O estado da extensão fica em `marinara.storage`, não no armazenamento do navegador.

`showWindow({ title, elements, onEvent, onClose })` retorna um identificador com `update({ title?, elements? })` e `close()`. O CSS do pacote estiliza essas janelas iframe em sandbox; as contribuições renderizadas pelo host sempre usam o tema e os controles do próprio Marinara.

O ambiente Browser seguro não tem API de DOM nem de rede. Não contorne esse limite. Se faltar uma capacidade útil, peça uma capacidade limitada ao host em vez de passar por padrão para o acesso à página inteira.

### Capacidades de contexto

Declare o acesso opcional aos registros em `config.capabilities`:

```json
{
  "capabilities": ["read_active_characters", "read_active_persona"]
}
```

- `read_active_characters` preenche campos limitados dos cards de personagem no chat ativo.
- `read_active_persona` preenche campos limitados da persona selecionada.
- `full_page_access` seleciona o ambiente de compatibilidade sem sandbox e só está disponível para External Extensions.

Alterar as capacidades muda o hash do executável, desativa a extensão e exige uma nova revisão.

<a id="what-a-browser-extension-can-do"></a>

### O que uma Browser Extension pode fazer

Uma Browser Extension roda em um Worker dedicado, dentro de um iframe em sandbox com origem opaca. Ela não tem acesso à página do Marinara, ao DOM, aos cookies, ao armazenamento do navegador, às APIs da origem nem à rede. As capacidades dela são o armazenamento privado da extensão, os logs, os temporizadores gerenciados, o registro de limpeza, as janelas restritas, os pontos seguros de contribuição no host e um instantâneo somente leitura do chat ativo e dos IDs de personagem. Ela só recebe campos selecionados dos cards de personagem ativos ou da persona selecionada quando as permissões correspondentes são declaradas e aprovadas.

As extensões podem acrescentar ações na barra superior ou no painel lateral, itens no menu Extensions e painéis persistentes do lado direito com `marinara.ui.registerContribution(...)`. Marinara renderiza essas superfícies com o tema ativo e um conjunto fixo de controles: títulos, texto, saída pré-formatada, botões, campos de texto, menus suspensos, botões liga/desliga, controles deslizantes, controles de cor e espaçadores. A extensão fornece conteúdo e estado, nunca HTML, CSS, URLs, componentes React ou manipuladores de evento do host.

Essas capacidades e regras de interface são idênticas para toda Browser Extension em sandbox, venha ela de onde vier. Uma extensão de terceiros importada (External Extension) usa esse ambiente seguro, a menos que o pacote dela peça explicitamente **Full page access** (acesso à página inteira) ou use o formato `marinara.extension` anterior à sandbox, descrito abaixo.

### Estimar os tokens de um texto

As Personal Extensions de Browser, Full page access e Server podem usar o estimador de tokens de texto integrado ao Marinara:

```js
const tokens = marinara.estimateTextTokens(text);
```

A assinatura é `estimateTextTokens(text: string): number`, também descrita pelo tipo `PersonalExtensionTokenApi`, exportado de `@marinara-engine/shared`. A chamada é síncrona, não exige nenhuma capacidade adicional e retorna a contagem estimada de tokens do Marinara, independente do modelo, em vez do resultado exato de um tokenizador. Em versões antigas do Engine, verifique `typeof marinara.estimateTextTokens === "function"` antes de chamar a função.

<a id="add-a-marinara-rendered-panel"></a>

### Adicionar um painel renderizado pelo Marinara

```js
const panel = marinara.ui.registerContribution({
  id: "weather-settings",
  kind: "panel",
  label: "Weather controls",
  description: "Tune a weather scene without leaving Marinara.",
  icon: "sparkles",
  elements: [
    { kind: "heading", text: "Atmosphere" },
    {
      kind: "select",
      id: "weather",
      label: "Weather",
      value: "rain",
      options: [
        { value: "rain", label: "Rain" },
        { value: "snow", label: "Snow" },
        { value: "aurora", label: "Aurora" },
      ],
    },
    { kind: "slider", id: "intensity", label: "Intensity", min: 0, max: 100, value: 60 },
    { kind: "toggle", id: "lightning", label: "Lightning", checked: false },
    { kind: "color", id: "tint", label: "Tint", value: "#6d8cff" },
    { kind: "button", id: "apply", label: "Apply" },
  ],
  onActivate: async () => {
    const settings = await marinara.storage.get();
    // Update the panel when stored state should be reflected in the controls.
  },
  onEvent: async ({ elementId, values }) => {
    if (elementId !== "apply") return;
    await marinara.storage.patch(values);
  },
});

marinara.onCleanup(() => panel.remove());
```

Use `kind: "button"` para uma ação compacta e `kind: "menu-item"` para uma ação no menu Extensions. Use `kind: "command"` para um item do Command Center (central de comandos) que aciona uma contribuição existente da mesma revisão da extensão. Um comando exige `targetContributionId` e não pode usar `onActivate` nem `onEvent`.

```js
marinara.ui.registerContribution({
  id: "open-weather",
  kind: "command",
  label: "Open weather controls",
  targetContributionId: "weather-settings",
});
```

O host só resolve um comando quando o destino tem o mesmo ID de extensão e o mesmo hash de conteúdo. Destinos ausentes, de outra extensão ou de uma revisão desatualizada falham de forma fechada. Os botões usam `surface: "top-bar"` por padrão. Em vez disso, eles podem apontar para `chats`, `bots`, `characters`, `personas`, `lorebooks`, `presets`, `connections`, `agents` ou `settings`, com `position` definido como `header`, `before-content` ou `after-content`. O `icon` aceita qualquer nome de ícone Lucide em kebab-case que Marinara aceite. Os dois tipos de ação chamam `onActivate`. Um `panel` chama `onActivate` ao ser aberto; os botões dele chamam `onEvent` com os valores atuais de todos os controles do painel. O identificador retornado aceita atualizações específicas de cada tipo: `button` aceita `label`, `description`, `icon`, `surface` e `position`; `menu-item` aceita `label`, `description` e `icon`; `panel` aceita `label`, `description`, `icon` e `elements`. Todos os identificadores aceitam `remove()`. Os IDs podem conter letras, números, `.`, `_` e `-`.

Por exemplo, isto coloca uma ação nativa acima do conteúdo do painel Presets:

```js
marinara.ui.registerContribution({
  id: "preset-helper",
  kind: "button",
  label: "Preset helper",
  description: "Run the preset helper",
  icon: "list-sparkles",
  surface: "presets",
  position: "before-content",
  onActivate: () => {
    // Run extension behavior here.
  },
});
```

Ferramentas complexas podem montar interfaces de várias etapas atualizando os elementos do painel depois de um evento. Mantenha o estado do aplicativo em `marinara.storage`; não o codifique na marcação.

<a id="use-active-chat-context"></a>

### Usar o contexto do chat ativo

A versão 5 da API de Browser Extension expõe identificadores opacos do chat que Marinara mostra no momento:

```js
const renderForContext = async ({ chatId, characterId, characterIds, personaId, characters, persona }) => {
  if (!chatId) return; // Home, a library, or another surface without an active chat.

  const storage = await marinara.storage.get();
  const tab = storage.tabsByChat?.[chatId];

  // characterId is available only for a single-Character chat.
  // Use characterIds for group chats.
  marinara.log.debug("Loaded Notepad tab", {
    chatId,
    characterId,
    characterIds,
    personaId,
    characterNames: characters.map((character) => character.name),
    personaName: persona?.name ?? null,
    tab,
  });
};

const unsubscribe = marinara.context.subscribe(renderForContext);
marinara.onCleanup(unsubscribe);
```

`marinara.context.get()` retorna o mesmo instantâneo atual, sem fazer a inscrição. O valor de `chatId` é `null` e `characterIds` fica vazio quando nenhum chat está ativo. O valor de `characterId` só é preenchido quando exatamente um personagem participa; os chats em grupo expõem todos os participantes por `characterIds` e deixam `characterId` como `null`. O valor de `personaId` só é preenchido quando a permissão `read_active_persona` está aprovada.

Os IDs de chat e de personagem estão sempre disponíveis e permitem que a extensão os use como namespace do próprio armazenamento privado. Os campos dos registros exigem uma das permissões opcionais no manifesto da extensão, ou as duas:

```json
{
  "runtime": "client",
  "capabilities": ["read_active_characters", "read_active_persona"]
}
```

- `read_active_characters` preenche `characters` com os cards que participam do chat ativo.
- `read_active_persona` preenche `persona` com a persona selecionada pelo chat ativo.

Sem a permissão, o valor correspondente continua sendo `[]` ou `null`. Marinara mostra cada permissão solicitada em **Requested access** (acesso solicitado) e de novo na janela de aprovação por hash exato. Acrescentar ou remover uma permissão muda o hash do executável, desativa a extensão e exige uma nova aprovação.

Os instantâneos de personagem contêm apenas `id`, `name`, `description`, `personality`, `scenario`, `firstMessage`, `exampleDialogue`, `creator`, `characterVersion`, `tags`, `backstory`, `appearance`, `aboutMe` e `conversationDisplayName`. Os instantâneos de persona contêm apenas `id`, `name`, `description`, `personality`, `scenario`, `backstory`, `appearance`, `tags`, `aboutMe` e `conversationDisplayName`. O texto tem limite de tamanho antes de atravessar a ponte da sandbox.

Marinara nunca envia mensagens, notas do criador, prompts de sistema, instruções pós-histórico, comentários, caminhos de avatar, bibliotecas completas de personagens ou personas, campos não declarados, metadados do chat, identificadores de banco de dados, acesso à rede nem operações de alteração. As atualizações de contexto continuam presas ao hash de código aprovado e são entregues quando o chat ativo, a lista de personagens dele ou a persona selecionada nele muda.

<a id="add-a-dice-format"></a>

### Adicionar um formato de dados

A versão 6 da API de Browser Extension permite que uma extensão ensine ao `/roll` uma notação própria, como uma parada de dados narrativos. A extensão lê a notação e indica os dados a rolar; Marinara os rola com o próprio rolador seguro e devolve as faces. Uma extensão pode dizer o que uma rolagem significa, nunca o que foi rolado.

```js
const SYMBOLS = { boost: [0, 0, 1, 1, 2, 1], setback: [0, 0, -1, -1, 0, 0] };

const format = marinara.dice.registerFormat({
  id: "narrative",
  label: "Narrative dice",
  // Return null for notation this format does not read.
  parse(notation) {
    const terms = [...notation.matchAll(/(\d+)\s*(boost|setback)/g)];
    if (!terms.length) return null;
    const kinds = terms.flatMap(([, count, kind]) => Array(Number(count)).fill(kind));
    return { dice: kinds.map(() => 6), kinds };
  },
  // rolls[i] is the face Marinara threw for dice[i]; plan is what parse returned.
  read({ notation, dice, rolls, plan }) {
    const net = rolls.reduce((sum, face, i) => sum + SYMBOLS[plan.kinds[i]][face - 1], 0);
    return { total: net, text: net > 0 ? `${net} success` : "failure" };
  },
});
marinara.onCleanup(() => format.remove());
```

Assim, `/roll 2 boost 1 setback` publica as faces, o total e o texto da extensão, identificados pelo nome do formato. Uma notação comum, como `2d6` ou `4d6kh3`, sempre rola como antes e nunca chega a uma extensão. Outras notações passam por cada formato registrado, em sequência, e o primeiro cujo `parse` retorna dados faz a rolagem.

- `parse(notation)` retorna `null` ou `{ dice: [sides, ...] }` com 1 a 100 dados de 2 a 1.000 lados. Qualquer outra coisa no objeto fica na sandbox e é devolvida a `read` como `plan`.
- `read(...)` retorna `{ total, text?, kept? }`: um número finito, no máximo 200 caracteres de texto simples e, opcionalmente, as posições dos dados que contaram, em ordem crescente. O `/roll` risca os demais.
- Cada extensão pode registrar 4 formatos. A notação tem no máximo 100 caracteres. `parse` e `read` podem ser assíncronos, mas cada um precisa responder em até 2 segundos.
- O texto aparece como texto simples: links, imagens, formatação e HTML são escapados.

Os formatos de dados valem para o `/roll` no navegador. A ferramenta `roll_dice` do Game Master e outras rolagens do lado do servidor continuam usando a notação integrada e os dados do conjunto de regras. Verifique `typeof marinara.dice?.registerFormat === "function"` antes de chamar a função em versões antigas do Engine.

### Extensões legadas e de página inteira

Controladores de clima, editores de prompt e outros fluxos de trabalho substanciais são casos de uso válidos para contribuições. As versões seguras deles podem usar um ponto de entrada no menu ou na barra superior, mais painéis atualizados aos poucos. Pacotes existentes que inserem sobreposições no DOM, consultam seletores CSS do Marinara, percorrem os detalhes internos do React ou chamam rotas `/api` da mesma origem não podem ser importados sem alteração para o ambiente seguro.

As contribuições de interface fornecem a interface, não poderes gerais. A API de contexto sempre expõe os IDs do chat ativo e dos personagens e só pode expor os campos declarados dos registros ativos listados acima. Recursos que precisam de mensagens, presets, lorebooks, dados não declarados de personagem ou persona, ou efeitos visuais de cena ainda precisam de uma capacidade intermediária separada e de escopo estreito, exposta pelo Marinara. Uma extensão não deve simular essa capacidade com acesso ao DOM do host nem com requisições de rede sem restrição.

Se uma External Extension depender do acesso ao DOM do host, ela pode pedir:

```json
{
  "runtime": "client",
  "capabilities": ["full_page_access"]
}
```

**A permissão Full page access não é uma capacidade da sandbox.** O JavaScript e o CSS aprovados rodam dentro da página do Marinara. O código pode ler ou alterar qualquer coisa visível na sessão atual do navegador, inspecionar chats e cards, usar o armazenamento do navegador, fazer requisições de rede e chamar as APIs do Marinara na mesma origem. Na prática, ele tem a mesma autoridade sobre a página que um código colado no console do navegador. Os rascunhos da Professor Mari não podem pedir essa permissão.

As extensões de página inteira devem usar `marinara.fetch(...)` para as requisições de rede. A função tem a mesma assinatura e o mesmo resultado que `window.fetch` e, além disso, permite que **Settings > Addons > External Extensions** mostre a contagem de requisições dessa extensão na sessão, os bytes transferidos informados pelas respostas, a taxa recente de requisições e o aviso de tráfego alto contínuo. O `window.fetch` direto continua disponível porque o acesso à página inteira é código de página confiável, mas essas requisições não podem ser atribuídas à extensão.

Marinara reconhece o envelope v1 mais antigo `kind: "marinara.extension"` sem um campo `capabilities` explícito como um pacote anterior à sandbox e atribui **Full page access** durante a importação. Assim, pacotes legados como o WeatherTweaker chegam ao fluxo de revisão correto, em vez de falhar em silêncio dentro de um Worker. Um pacote moderno que usa esse envelope mas quer o ambiente seguro precisa incluir `"capabilities": []`.

As duas barreiras das External Extensions e a aprovação por hash exato continuam valendo. Uma mudança de código, CSS ou permissão desativa a extensão e exige uma nova aprovação. Desativar remove os nós de script e de folha de estilo do Marinara, cancela os temporizadores criados pela API de compatibilidade e executa os callbacks registrados com `marinara.onCleanup(...)`. Como o código da página pode criar ouvintes, temporizadores, variáveis globais ou mudanças no DOM sem registro, a limpeza é feita na medida do possível; recarregue a página depois de desativar uma extensão se algo continuar.

A API mais antiga `marinara.ui.showWindow(...)` continua disponível para uma janela temporária dentro do iframe de origem opaca. Ela usa os mesmos controles fixos e devolve os identificadores `update(...)` e `close()`. Prefira as contribuições quando a ferramenta precisar estar ao alcance da navegação normal do Marinara.

## Início rápido de uma Server Extension

Crie esta pasta:

```text
Server Counter/
  manifest.json
  server-extension.js
```

Use este `manifest.json`:

```json
{
  "kind": "marinara.personal-server-extension",
  "version": 1,
  "config": {
    "name": "Server Counter",
    "version": "1.0.0",
    "description": "A minimal sandboxed Server Extension.",
    "runtime": "server",
    "capabilities": [],
    "serverJsPath": "server-extension.js"
  }
}
```

Use este `server-extension.js`:

```js
const saved = await marinara.storage.get();
const starts = (Number(saved.starts) || 0) + 1;
await marinara.storage.patch({ starts });

marinara.log.info(`Server Counter started ${starts} time${starts === 1 ? "" : "s"}`);

const timer = marinara.setInterval(() => {
  marinara.log.debug("Server Counter heartbeat");
}, 60_000);

marinara.onCleanup(() => marinara.clearInterval(timer));
```

O mesmo pacote executável está disponível em `docs/examples/personal-extensions/server-minimal/`.

O código do servidor recebe `marinara.runtime`, `marinara.version`, a identidade da extensão, `log`, `storage`, temporizadores gerenciados e `onCleanup`. Ele não recebe acesso ao sistema de arquivos, a processos, à rede, ao carregamento de módulos nem ao banco de dados do Marinara.

As Server Extensions continuam desativadas quando o host não consegue estabelecer o Seatbelt ou o Bubblewrap. Isso é uma restrição da plataforma, não um erro da extensão.

## Referência do pacote e do manifesto

| Campo | Observações |
| --- | --- |
| `kind` | `marinara.personal-extension` ou `marinara.personal-server-extension` |
| `version` de nível superior | Versão do envelope do pacote; atualmente `1` |
| `config.name` | Nome de exibição obrigatório, de 1 a 200 caracteres |
| `config.version` | Versão opcional da extensão, como `1.2.0`; versões numéricas separadas por pontos permitem avisos de downgrade |
| `config.description` | Descrição opcional, com até 2.000 caracteres |
| `config.runtime` | `client` ou `server`; o padrão é `client` |
| `config.capabilities` | Capacidades de Browser solicitadas; as Server Extensions devem usar uma lista vazia |
| `config.jsPath` / `config.serverJsPath` | Caminho do arquivo JavaScript ou matriz ordenada de caminhos, relativo ao manifesto |
| `config.cssPath` | Caminho opcional do arquivo CSS ou matriz ordenada; o CSS do ambiente seguro fica no iframe em sandbox |
| `config.js`, `config.serverJs`, `config.css` | Alternativas embutidas quando arquivos separados não são necessários |

Use JavaScript puro. Marinara não compila TypeScript nem instala dependências de extensões. Quando necessário, empacote as dependências no seu JavaScript antes de importar.

Arquivos avulsos `.js`, `.mjs`, `.cjs`, `.server.js`, `.server.mjs`, `.server.cjs` e `.css` também podem ser importados diretamente. É melhor usar um manifesto, porque ele registra de forma explícita a identidade, o ambiente, a versão, as capacidades e a ordem dos arquivos.

### Limites de validação

| Conteúdo | Limite atual |
| --- | --- |
| Nome / versão / descrição | 200 caracteres / 64 caracteres / 2.000 caracteres |
| JS de Browser ou Server | Sem limite de código por campo; o limite do arquivo, do arquivo compactado ou da requisição que o contém continua valendo |
| CSS | 256 KiB |
| ZIP importado | 32 MiB compactados, 2 MiB por entrada de texto e 16 MiB de texto extraído no total |
| Armazenamento privado | 1.000.000 bytes de JSON serializado por extensão |

Os limites do ZIP, da requisição, da mensagem da sandbox e do armazenamento protegem limites separados de transporte ou de ambiente; eles não são uma política para o código-fonte executável.

## Ciclo de atualização e recuperação

- Toda nova importação começa desativada e não aprovada.
- Editar o código, o CSS, o ambiente ou as capacidades remove a aprovação e desativa a extensão.
- Reimportar o mesmo nome atualiza o registro existente após a confirmação. Uma reimportação idêntica byte por byte mantém o hash e a aprovação atuais; uma mudança no conteúdo executável remove a aprovação. Marinara avisa quando versões numéricas indicam um downgrade.
- **Export** (exportar) grava o manifesto e os arquivos-fonte atuais em um pacote portátil. A aprovação nunca é exportada.
- Restaurar uma revisão, importar um perfil ou restaurar um backup deixa a extensão desativada até uma nova revisão.
- **Disable** (desativar) para o ambiente e a limpeza registrada. O código de página inteira pode exigir que a página seja recarregada se tiver criado efeitos colaterais não registrados.
- **Delete** (excluir) remove o registro instalado. Exporte antes se você ainda puder precisar do código-fonte.

## Depuração

| Sintoma | Verifique |
| --- | --- |
| Os controles de importação externa não aparecem | Abra as duas barreiras de External Extension descritas acima |
| O gerenciamento diz que é necessário localhost ou Admin Access | Configure `ADMIN_SECRET` e salve-o em **Admin Access** |
| A importação não encontra nenhuma extensão | Verifique `manifest.json` e os caminhos relativos dele; Server precisa de JS, enquanto Browser precisa de CSS ou JS |
| A extensão é desativada após uma edição | Isso é esperado: inspecione e aprove o novo hash exato |
| O código Browser não pode usar `document`, `window`, `fetch` ou o armazenamento local | Isso é esperado na sandbox segura; use as APIs intermediárias documentadas |
| A Server Extension não está disponível | Use o Seatbelt do macOS ou Linux com Bubblewrap, ou passe para uma Browser Extension |
| A Browser Extension lança uma exceção | Abra as ferramentas de desenvolvimento do navegador; `marinara.log` e os erros de inicialização são identificados com o nome da extensão |
| A Server Extension lança uma exceção | Verifique o status dela em **Settings → Addons** e o log do servidor do Marinara |

O CSS, o armazenamento privado, os arquivos de importação e as mensagens do ambiente mantêm limites de segurança separados. Marinara deve informar o limite que rejeitou um pacote, em vez de apresentá-lo como uma falha de execução.

## Guias relacionados

- [Personal Extensions](personal-extensions.md)
- [Configuração do servidor](../CONFIGURATION.md)
- [Solução de problemas](../TROUBLESHOOTING.md)
- [Arquitetura das Personal Extensions](../development/personal-extensions.md)
