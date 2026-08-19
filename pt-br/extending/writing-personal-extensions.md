# Como escrever Personal Extensions

Este guia é para quem escreve suas próprias extensões do Marinara Engine. Para instalar, revisar e executar uma extensão com segurança, comece por [Personal Extensions](personal-extensions.md).

O código que você escreve e importa é tratado como uma **External Extension** (extensão externa). Ele começa desativado e só pode ser executado depois que você o inspeciona e aprova o hash SHA-256 exato.

## Antes de começar

As External Extensions ficam ocultas até que as duas barreiras de segurança sejam abertas:

1. Defina `ENABLE_EXTERNAL_EXTENSIONS=true` no arquivo `.env` do host do Marinara.
2. Abra **Settings** > **Advanced** > **Danger Zone** e ative **Allow third-party extension imports**.

Para importar e gerenciar extensões, também é necessário acessar por localhost ou ter o **Admin Access** configurado. Se você usa o Marinara pelo celular, por um endereço da LAN ou por um navegador remoto, defina `ADMIN_SECRET` no servidor e informe o mesmo valor em **Settings** > **Advanced** > **Admin Access**.

Escolha o ambiente menos poderoso que consiga realizar a tarefa:

| Ambiente | Use para | Limite importante |
| --- | --- | --- |
| Sandboxed Browser Extension | Estado privado, contexto do chat ativo, botões, ações de menu e painéis renderizados pelo Marinara | Sem acesso ao DOM do Marinara, cookies, armazenamento do navegador, rede ou HTML arbitrário |
| Server Extension | Lógica em segundo plano que precisa de temporizadores gerenciados e armazenamento privado da extensão | Sandbox separada do sistema operacional; sem acesso a arquivos ou segredos do Marinara, rede, processos filhos ou módulos nativos |
| Full-page External Extension | Código legado que realmente precisa da página do Marinara ou das APIs de mesma origem | Sem sandbox; use apenas para o código exato que você inspecionou e em que confia completamente |

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

1. Abra **Settings** > **Addons** > **External Extensions**.
2. Escolha **Import Folder** e selecione `Hello Panel`, ou compacte a pasta e importe o ZIP.
3. Abra o rascunho desativado e inspecione o manifesto e o JavaScript.
4. Escolha **Review and Run** e aprove o hash exato exibido.
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
| `setTimeout`, `setInterval`, `clearTimeout`, `clearInterval` | Temporizadores gerenciados que são removidos quando a extensão para |
| `onCleanup(callback)` | Registrar outra lógica de limpeza |

Use os [painéis renderizados pelo Marinara](personal-extensions.md#add-a-marinara-rendered-panel) para a interface normal e o [contexto do chat ativo](personal-extensions.md#use-active-chat-context) para um comportamento que leve o chat em conta. O estado da extensão deve ficar em `marinara.storage`, não no armazenamento do navegador.

`showWindow({ title, elements, onEvent, onClose })` retorna um identificador com `update({ title?, elements? })` e `close()`. O CSS do pacote estiliza essas janelas iframe em sandbox; as contribuições renderizadas pelo host sempre usam o tema e os controles do próprio Marinara.

O ambiente Browser seguro não tem API de DOM nem de rede. Não contorne esse limite. Se faltar uma capacidade útil, peça uma capacidade limitada no host em vez de mudar por padrão para o acesso à página inteira.

### Capacidades de contexto

Declare o acesso opcional aos registros em `config.capabilities`:

```json
{
  "capabilities": ["read_active_characters", "read_active_persona"]
}
```

- `read_active_characters` preenche campos limitados dos cartões Character no chat ativo.
- `read_active_persona` preenche campos limitados da Persona selecionada.
- `full_page_access` seleciona o ambiente de compatibilidade sem sandbox e só está disponível para External Extensions.

Alterar as capacidades muda o hash do executável, desativa a extensão e exige uma nova revisão.

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

O código do servidor recebe `marinara.runtime`, `marinara.version`, a identidade da extensão, `log`, `storage`, temporizadores gerenciados e `onCleanup`. Ele não recebe acesso ao sistema de arquivos, processos, rede, carregamento de módulos ou banco de dados do Marinara.

As Server Extensions continuam desativadas quando o host não consegue estabelecer o Seatbelt ou o Bubblewrap. Isso é uma restrição da plataforma, não um erro da extensão.

## Referência do pacote e do manifesto

| Campo | Observações |
| --- | --- |
| `kind` | `marinara.personal-extension` ou `marinara.personal-server-extension` |
| top-level `version` | Versão do envelope do pacote; atualmente `1` |
| `config.name` | Nome de exibição obrigatório, de 1 a 200 caracteres |
| `config.version` | Versão opcional da extensão, como `1.2.0`; versões numéricas separadas por pontos permitem avisos de downgrade |
| `config.description` | Descrição opcional, com até 2.000 caracteres |
| `config.runtime` | `client` ou `server`; o padrão é `client` |
| `config.capabilities` | Capacidades Browser solicitadas; as Server Extensions devem usar uma lista vazia |
| `config.jsPath` / `config.serverJsPath` | Caminho do arquivo JavaScript ou matriz ordenada de caminhos, relativo ao manifesto |
| `config.cssPath` | Caminho opcional do arquivo CSS ou matriz ordenada; o CSS do ambiente seguro permanece no iframe em sandbox |
| `config.js`, `config.serverJs`, `config.css` | Alternativas embutidas quando arquivos separados não são necessários |

Use JavaScript puro. O Marinara não compila TypeScript nem instala dependências de extensões. Quando necessário, empacote as dependências no JavaScript antes de importar.

Arquivos avulsos `.js`, `.mjs`, `.cjs`, `.server.js`, `.server.mjs`, `.server.cjs` e `.css` também podem ser importados diretamente. É melhor usar um manifesto porque ele registra de forma explícita a identidade, o ambiente, a versão, as capacidades e a ordem dos arquivos.

### Limites de validação

| Conteúdo | Limite atual |
| --- | --- |
| Nome / versão / descrição | 200 caracteres / 64 caracteres / 2.000 caracteres |
| JS de Browser ou Server | Sem limite de código por campo; o limite do arquivo, arquivo compactado ou pedido que o contém ainda se aplica |
| CSS | 256 KiB |
| ZIP importado | 32 MiB compactados, 2 MiB por entrada de texto e 16 MiB de texto extraído no total |
| Armazenamento privado | 1.000.000 bytes de JSON serializado por extensão |

Os limites do ZIP, pedido, mensagem da sandbox e armazenamento protegem limites diferentes de transporte ou ambiente; eles não são uma política para o código-fonte executável.

## Ciclo de atualização e recuperação

- Toda nova importação começa desativada e não aprovada.
- Editar o código, o CSS, o ambiente ou as capacidades remove a aprovação e desativa a extensão.
- Reimportar o mesmo nome atualiza o registro existente após a confirmação. Uma reimportação idêntica byte por byte mantém o hash e a aprovação atuais; uma mudança no conteúdo executável remove a aprovação. O Marinara avisa quando versões numéricas indicam downgrade.
- **Export** grava o manifesto e os arquivos-fonte atuais em um pacote portátil. A aprovação nunca é exportada.
- Restaurar uma revisão, importar um perfil ou restaurar um backup deixa a extensão desativada até uma nova revisão.
- **Disable** para o ambiente e a limpeza registrada. O código de página inteira pode exigir que a página seja recarregada se ele criou efeitos colaterais não registrados.
- **Delete** remove o registro instalado. Exporte primeiro se você ainda puder precisar do código-fonte.

## Depuração

| Sintoma | Verifique |
| --- | --- |
| Os controles de importação externa não aparecem | Abra as duas barreiras de External Extension descritas acima |
| O gerenciamento diz que localhost ou Admin Access é necessário | Configure `ADMIN_SECRET` e salve em **Admin Access** |
| A importação não encontra uma extensão | Verifique `manifest.json` e os caminhos relativos; Server precisa de JS, enquanto Browser precisa de CSS ou JS |
| A extensão é desativada após uma edição | Isso é esperado: inspecione e aprove o novo hash exato |
| O código Browser não pode usar `document`, `window`, `fetch` ou armazenamento local | Isso é esperado na sandbox segura; use as APIs intermediárias documentadas |
| Server Extension não está disponível | Use o Seatbelt do macOS ou Linux com Bubblewrap, ou mude para uma Browser Extension |
| Browser Extension lança uma exceção | Abra as ferramentas de desenvolvimento do navegador; `marinara.log` e os erros de inicialização são identificados com o nome da extensão |
| Server Extension lança uma exceção | Verifique o status em **Settings** > **Addons** e o log do servidor Marinara |

O CSS, o armazenamento privado, os arquivos de importação e as mensagens do ambiente mantêm limites de segurança separados. O Marinara deve informar o limite que rejeitou um pacote em vez de apresentar o problema como falha de execução.

## Guias relacionados

- [Personal Extensions](personal-extensions.md)
- [Configuração do servidor](../CONFIGURATION.md)
- [Solução de problemas](../TROUBLESHOOTING.md)
- [Arquitetura de Personal Extensions](../development/personal-extensions.md)
