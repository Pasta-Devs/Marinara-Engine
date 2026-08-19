# Extensões pessoais

As extensões pessoais são rascunhos de código privados que a Professor Mari cria para você. Abra a seção **Settings** (Configurações) > **Addons** > **Personal Extensions**.

A mensagem padrão é:

> Ask Professor Mari to create an extension for you. Nothing runs until you enable it and approve the exact code hash.

Nesta seção não existe a ação New Draft nem controles de importação. Peça à Professor Mari para criar ou revisar um rascunho. Ela consegue salvar o código, mas não consegue aprová-lo nem ativá-lo.

Para escrever e importar seu próprio pacote, use o [guia de criação de extensões pessoais](writing-personal-extensions.md). Pacotes criados por você passam pelo fluxo External Extensions, que tem uma autorização separada.

## Revisar e ativar

Todo rascunho começa desativado. Marinara gera uma impressão digital SHA-256 do código executável exato. Abra o rascunho, examine o código, compare o hash exibido e só então escolha **Review and Run** (revisar e executar), se você aceitar aquela versão exata. Qualquer alteração no código executável, ou a restauração de uma revisão, desativa a extensão e exige uma nova aprovação.

O sandbox reduz os poderes do código, mas não torna confiável um código qualquer. Uma extensão maliciosa ainda pode consumir CPU até o watchdog interrompê-la, encher o próprio armazenamento dentro dos limites impostos ou agir de forma enganosa nos logs. As extensões de página inteira abrem mão desse isolamento de propósito. Revise o código sempre antes de ativar.

## Isolamento em execução

Uma Browser Extension roda em um Worker dedicado, dentro de um iframe em sandbox com origem opaca. Ela não tem acesso à página do Marinara, ao DOM, aos cookies, ao armazenamento do navegador, às APIs da origem nem à rede. Os recursos dela são: armazenamento privado da extensão, logs, temporizadores gerenciados, registro de limpeza, janelas restritas, pontos seguros de contribuição para a interface e uma cópia somente leitura do chat ativo e dos IDs de personagem. Ela só recebe campos selecionados dos cards de personagem ativos ou da persona escolhida quando as permissões correspondentes são declaradas e aprovadas.

As extensões podem acrescentar ações na barra superior, itens no menu Extensions e painéis fixos do lado direito com `marinara.ui.registerContribution(...)`. Marinara desenha essas superfícies com o tema ativo e um conjunto fixo de controles: títulos, texto, saída pré-formatada, botões, campos de texto, listas de seleção, botões liga/desliga, controles deslizantes, controles de cor e espaçadores. A extensão fornece conteúdo e estado, nunca HTML, CSS, URLs, componentes React ou manipuladores de evento do aplicativo.

Esses recursos e regras de interface são idênticos para toda Browser Extension em sandbox, venha ela de onde vier. Uma External Extension importada de terceiros usa esse ambiente seguro, a menos que o pacote dela peça explicitamente a permissão **Full page access** (acesso à página inteira) ou use o formato `marinara.extension` anterior ao sandbox, descrito mais abaixo.

### Adicionar um painel desenhado por Marinara

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

Use `kind: "button"` para uma ação compacta e `kind: "menu-item"` para uma ação no menu Extensions. Os botões usam `surface: "top-bar"` por padrão. Eles também podem apontar para `chats`, `bots`, `characters`, `personas`, `lorebooks`, `presets`, `connections`, `agents` ou `settings`, com `position` definido como `header`, `before-content` ou `after-content`. `icon` aceita qualquer nome Lucide em kebab-case compatível com o Marinara. Os dois tipos de ação chamam `onActivate`. Um `panel` chama `onActivate` ao abrir; seus botões chamam `onEvent` com os valores atuais dos controles. O identificador permite atualizações específicas por tipo: `button` aceita `label`, `description`, `icon`, `surface` e `position`; `menu-item` aceita `label`, `description` e `icon`; `panel` aceita `label`, `description`, `icon` e `elements`. Todos aceitam `remove()`. Os IDs podem conter letras, números, `.`, `_` e `-`.

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

Ferramentas complexas montam interfaces de várias etapas atualizando os elementos do painel depois de um evento. Mantenha o estado da aplicação em `marinara.storage`; não o codifique na marcação.

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

A função `marinara.context.get()` devolve a mesma cópia atual, sem assinar as atualizações. O valor de `chatId` é `null` e `characterIds` fica vazio quando nenhum chat está ativo. O valor de `characterId` só é preenchido quando exatamente um personagem participa; os chats em grupo mostram todos os participantes em `characterIds` e deixam `characterId` como `null`. O valor de `personaId` só é preenchido quando a permissão `read_active_persona` está aprovada.

Os IDs de chat e de personagem estão sempre disponíveis e permitem que a extensão separe o próprio armazenamento privado. Os campos dos registros exigem uma das permissões opcionais no manifesto da extensão, ou as duas:

```json
{
  "runtime": "client",
  "capabilities": ["read_active_characters", "read_active_persona"]
}
```

- A permissão `read_active_characters` preenche `characters` com os cards que participam do chat ativo.
- A permissão `read_active_persona` preenche `persona` com a persona escolhida no chat ativo.

Sem a permissão, o valor continua sendo `[]` ou `null`. Marinara mostra cada permissão pedida na seção **Requested access** (acesso solicitado) e de novo na janela de aprovação por hash exato. Acrescentar ou remover uma permissão muda o hash do código executável, desativa a extensão e exige uma nova aprovação.

As cópias de personagem trazem apenas `id`, `name`, `description`, `personality`, `scenario`, `firstMessage`, `exampleDialogue`, `creator`, `characterVersion`, `tags`, `backstory`, `appearance`, `aboutMe` e `conversationDisplayName`. As cópias de persona trazem apenas `id`, `name`, `description`, `personality`, `scenario`, `backstory`, `appearance`, `tags`, `aboutMe` e `conversationDisplayName`. O texto tem limite de tamanho antes de atravessar a ponte do sandbox.

Marinara nunca envia mensagens, notas do criador, prompts de sistema, instruções pós-histórico, comentários, caminhos de avatar, bibliotecas completas de personagens ou personas, campos não declarados, metadados do chat, identificadores de banco de dados, acesso à rede nem operações de alteração. As atualizações de contexto continuam presas ao hash de código aprovado e chegam quando o chat ativo, a lista de personagens dele ou a persona escolhida mudam.

### Extensões antigas e de página inteira

Controladores de clima, editores de prompt e outros fluxos de trabalho robustos são casos de uso válidos para contribuições. Os portes seguros deles podem usar um item de menu ou um botão na barra superior, mais painéis atualizados aos poucos. Pacotes existentes que inserem sobreposições no DOM, consultam seletores CSS do Marinara, percorrem as entranhas do React ou chamam rotas `/api` da mesma origem não podem ser importados sem alteração para o ambiente seguro.

As contribuições de interface dão a interface, não poderes gerais. A API de contexto sempre expõe os IDs do chat ativo e dos personagens, e pode expor apenas os campos declarados dos registros ativos listados acima. Recursos que precisam de mensagens, presets, lorebooks, dados não declarados de personagem ou persona, ou efeitos visuais de cena ainda precisam de um intermediário separado e de escopo estreito, exposto por Marinara. A extensão não pode simular esse intermediário com acesso ao DOM do aplicativo nem com requisições de rede sem restrição.

Se uma External Extension realmente depender do acesso ao DOM do aplicativo, ela pode pedir:

```json
{
  "runtime": "client",
  "capabilities": ["full_page_access"]
}
```

**A permissão Full page access não é um recurso do sandbox.** O JavaScript e o CSS aprovados rodam dentro da página do Marinara. O código consegue ler ou alterar qualquer coisa visível na sessão atual do navegador, inspecionar chats e cards, usar o armazenamento do navegador, fazer requisições de rede e chamar as APIs do Marinara na mesma origem. Na prática, ele tem o mesmo poder sobre a página que um código colado no console do navegador. Os rascunhos da Professor Mari não podem pedir esse acesso.

Marinara reconhece o envelope v1 mais antigo `kind: "marinara.extension"` sem um campo `capabilities` explícito como um pacote anterior ao sandbox e atribui a permissão **Full page access** durante a importação. Assim, pacotes antigos como o WeatherTweaker chegam ao fluxo de revisão correto, em vez de falhar em silêncio dentro de um Worker. Um pacote moderno que use esse envelope mas queira o ambiente seguro precisa incluir `"capabilities": []`.

As duas travas das External Extensions e a aprovação por hash exato continuam valendo. Uma mudança de código, de CSS ou de permissão desativa a extensão e exige uma nova aprovação. Ao desativar, Marinara remove os nós de script e de folha de estilo, cancela os temporizadores criados pela API de compatibilidade e executa os retornos registrados em `marinara.onCleanup(...)`. Como o código da página pode criar ouvintes, temporizadores, variáveis globais ou mudanças no DOM sem registro, a limpeza é feita na medida do possível; recarregue a página depois de desativar uma extensão se algo permanecer.

A API mais antiga `marinara.ui.showWindow(...)` continua disponível para abrir uma janela temporária dentro do iframe de origem opaca. Ela usa os mesmos controles fixos e devolve os identificadores `update(...)` e `close()`. Prefira as contribuições quando a ferramenta precisar estar ao alcance da navegação normal do Marinara.

Uma Server Extension roda em um processo Node separado, com permissões restritas, dentro do Seatbelt no macOS ou do Bubblewrap no Linux. Ela não tem acesso aos arquivos do Marinara, aos arquivos do usuário, aos segredos herdados do servidor, à rede, a processos filhos, a workers nem a addons nativos. Se Marinara não conseguir estabelecer um sandbox de sistema compatível, as Server Extensions ficam desativadas.

### Plataformas compatíveis

As Browser Extensions são isoladas pelo próprio navegador, então funcionam em qualquer lugar. As Server Extensions precisam de um sandbox de sistema compatível; onde não houver um, elas ficam desativadas e não podem ser ativadas – Marinara nunca recorre a executá-las fora do sandbox.

| Plataforma              | Browser Extensions em sandbox | External Extensions de página inteira | Server Extensions                     |
| ----------------------- | ----------------------------- | ------------------------------------- | ------------------------------------- |
| macOS                   | ✅ Em sandbox                  | ⚠️ Exige confiança explícita           | ✅ Em sandbox (Seatbelt)               |
| Linux (com Bubblewrap) | ✅ Em sandbox                  | ⚠️ Exige confiança explícita           | ✅ Em sandbox (Bubblewrap)             |
| Linux (sem `bwrap`) | ✅ Em sandbox                  | ⚠️ Exige confiança explícita           | ⛔ Desativadas – instale o `bwrap`         |
| Windows                 | ✅ Em sandbox                  | ⚠️ Exige confiança explícita           | ⛔ Desativadas – use uma Browser Extension |
| Android                 | ✅ Em sandbox                  | ⚠️ Exige confiança explícita           | ⛔ Desativadas – use uma Browser Extension |

No Windows e no Android não existe sandbox de processo compatível no sistema, então as Server Extensions ficam indisponíveis por decisão de projeto. Use uma Browser Extension no lugar delas, ou rode o servidor do Marinara no macOS ou no Linux (com `bwrap`) se você precisar de uma Server Extension.

## External Extensions

As importações de terceiros ficam bloqueadas e ocultas por padrão. São necessários dois passos:

1. No computador que hospeda Marinara, defina `ENABLE_EXTERNAL_EXTENSIONS=true` no arquivo `.env`.
2. Abra a seção **Settings** > **Advanced** > **Danger Zone**, role para baixo dos controles de exclusão de dados, leia o aviso e ative a opção **Allow third-party extension imports** (permitir a importação de extensões de terceiros).

Só então a seção **Settings** > **Addons** mostra **External Extensions** com os controles de importação de arquivo e de pasta. Os formatos compatíveis sempre são expandidos:

- `.personal-extension.zip` e pacotes `.zip` compatíveis;
- manifestos `.json`;
- `.css`;
- `.js`, `.mjs` e `.cjs`;
- `.server.js`, `.server.mjs` e `.server.cjs`.

Uma importação nunca traz aprovação junto e não consegue se ativar sozinha. Registros antigos, importados de um perfil, guardados manualmente ou de origem desconhecida também contam como externos. Eles ficam ocultos, não podem ser aprovados e ficam de fora dos dois ambientes de execução até que as duas travas sejam abertas.

Confira a lista **Requested access** antes de aprovar um hash exato. A maioria das Browser Extensions deve continuar no sandbox seguro. Um pacote marcado com **Full page access** não fica isolado de propósito e só deve ser ativado depois que você inspecionar e confiar naquela versão exata.

Ao desligar qualquer uma das travas, Marinara encerra os processos externos ativos no servidor, remove os workers do navegador e os nós de execução de página inteira, e desativa os registros externos guardados. Reabrir as travas não faz tudo voltar a rodar automaticamente. Recarregue a página se uma extensão de página inteira tiver deixado para trás alterações que não registrou para limpeza.

Extensões de terceiros podem conter código malicioso ou perigoso. Examine cada linha antes de baixar, importar ou ativar. A responsabilidade é inteiramente sua.

## Exportação, revisões e recuperação

Use a ação de exportação da extensão para baixar um pacote portátil. Pacotes exportados e restaurados continuam desativados. Restaurar uma revisão também devolve a extensão à condição de rascunho desativado.

Se uma extensão se comportar mal, escolha **Disable** (desativar). Se a interface não estiver disponível, pare Marinara e mude o valor de `enabled` do registro correspondente em `installed_extensions` para `"false"`. Nunca defina `approvedHash` na mão.

## Guias relacionados

- [Como escrever extensões pessoais](writing-personal-extensions.md)
- [Professor Mari](../home/professor-mari.md)
- [Configuração do servidor](../CONFIGURATION.md)
- [Fazer backup e restaurar Marinara](../data/backup-and-restore.md)
- [Acesso remoto](../REMOTE_ACCESS.md)
