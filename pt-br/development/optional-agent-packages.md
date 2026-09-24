# Pacotes opcionais de agentes e capacidades

Status: implementado no ciclo de desenvolvimento da v2.3.0, na issue #3612.

## Objetivo

A distribuição base do Marinara Engine não pode compilar nem incluir implementações opcionais de agentes e capacidades. Uma instalação nova começa sem nenhum pacote opcional. As atualizações preservam as capacidades que já existiam antes deste sistema de pacotes.

O catálogo oficial, o código dos pacotes, os artefatos reproduzíveis, os scripts de validação e o fluxo de contribuição ficam em [Pasta-Devs/Marinara-Agents](https://github.com/Pasta-Devs/Marinara-Agents). Os artefatos instalados ficam dentro da pasta de dados configurada do Marinara, para que uma atualização do aplicativo não sobrescreva nada.

## Modelo de pacote

Um pacote de agente pode entregar um ou mais agentes declarativos e, opcionalmente, capacidades executáveis confiáveis:

- pontos de entrada no servidor para rotas, hooks de ciclo de vida, provedores de prompt, tratadores de resultado e migrações de armazenamento;
- pontos de entrada no cliente para painéis, superfícies de chat, seções de configuração, escolhas de instalação e telas em tempo de execução;
- esquemas JSON compartilhados e contratos de comunicação estáveis;
- recursos, documentação e fragmentos de conhecimento da Professor Mari pertencentes ao pacote.

Cada pacote é feito para uma versão específica da API de capacidades do Marinara. Nenhum pacote pode importar caminhos internos do código do Engine.

Os elementos de capacidade do cliente recebem o idioma de interface escolhido no Engine pelos atributos `lang` e `dir` e pelo
objeto `capabilityProps.localization`. As interfaces do pacote mantêm os próprios arquivos de idioma e recorrem ao inglês
do pacote quando falta uma tradução; o Engine não traduz os prompts do pacote nem os valores de máquina definidos por ele. A troca de idioma reaproveita
o evento `marinara-capability-props` que já existe, então a interface instalada é redesenhada sem reiniciar o Engine.

### Entrega e cache

Os arquivos de pacotes instalados são servidos com validadores fortes derivados dos hashes SHA-256 de cada arquivo no manifesto, os mesmos valores que o Engine usa para verificar os bytes outra vez a cada leitura. O pacote do cliente (`/api/capability-packages/<id>/client`) e todos os recursos do pacote são sempre revalidados (`no-cache` junto com um `ETag`), então um arquivo sem mudanças responde `304 Not Modified` em vez de ser baixado novamente, enquanto um arquivo republicado é detectado de imediato. Nada é servido como `immutable`: a política de instalação permite republicar a mesma versão com bytes diferentes, por isso nenhuma URL de pacote é endereçada pelo conteúdo.

A API de capacidades 1.1 acrescenta uma fachada genérica de tempo de execução ao contexto
de ativação do servidor. O pacote consegue ler o estado efetivo de depuração do agente e
escrever pelo logger Pino do Engine, inclusive forçando o modo de depuração, sem importar
os módulos internos de logger e de configuração de execução. A fachada expõe operações,
não os objetos internos do Engine.

A API de capacidades 1.2 acrescenta operações de chat e mensagem com escopo de transação,
escritas restritas de metadados do chat, leituras de existência de entradas de lorebook e o
armazenamento de compatibilidade de snapshots espaciais. O pacote consegue validar mudanças de
domínio dentro de uma transação do Engine e salvar os metadados de forma atômica junto com a
mensagem de origem, o swipe ou o snapshot espacial, sem receber uma conexão de banco de dados
nem um objeto de tabela. O Engine continua responsável pelo rollback e pela compatibilidade com o
armazenamento histórico; o pacote continua responsável pela validação e pelas regras de domínio.
Essa mesma API expõe registros normalizados de chat e de personagem, a seleção de
entradas de lorebook elegíveis, a leitura de respostas em formato JSON ou parecido e chamadas resolvidas ao modelo de linguagem.
As credenciais de conexão, as implementações de provedor, as conexões de banco de dados e os objetos de armazenamento continuam internos ao Engine.

### Capability API 1.7: ramificações de chat

A Capability API 1.7 acrescenta metadados normalizados de ramificação ao `CapabilityChatRecord`:

```ts
branch: {
  title: string | null;
  parentChatId: string | null;
  parentMessageId: string | null;
  childMessageId: string | null;
} | null;
```

`title` é o nome persistido da ramificação sem espaços nas pontas. Chats raiz retornam `null`. Ramificações conhecidas criadas pelo Engine expõem o chat pai imediato, a mensagem de origem da bifurcação e a mensagem filha copiada. Ramificações vazias usam âncoras de mensagem null. Ramificações antigas, metadados inválidos e chats irmãos de grupo importados sem uma relação conhecida retornam campos de linhagem null; o Engine não deduz relações históricas. A exportação e a importação genéricas omitem os IDs do pai e das mensagens porque eles mudam entre instalações. Excluir o pai não altera a linhagem da ramificação filha.

### Capability API 1.8: experiências de Game

A Capability API 1.8 acrescenta experiências de Game fornecidas por pacotes, contexto de prompt por turno de Game e gravação de recursos.

Um pacote pode fornecer um Game Mode inteiro em vez de complementar o modo integrado. Ele declara o slot `game-surface` e é escolhido durante a criação do jogo, no bloco Experiences do assistente de configuração. A escolha fica registrada no jogo por toda a duração dele, então uma experiência nunca é ligada ou desligada no meio de uma partida. A superfície desenha o próprio HUD, os menus e o combate sobre a narração compartilhada, além de declarar quais sistemas integrados substitui. Tudo que não for declarado continua integrado, portanto a experiência só desativa o que realmente implementa. O campo opcional `contributions.gameSurface.surfaceClass` informa uma classe que o Engine aplica à área do jogo enquanto a superfície está montada, permitindo que a folha de estilos do pacote altere a interface compartilhada renderizada fora do próprio elemento.

Pacotes com a permissão `prompt-context` acrescentam texto ao prompt do sistema de cada turno de Game gerado. Assim, um pacote que controla um estado ativo mantém o modelo coerente com o que o jogador vê. Uma contribuição também pode declarar quais sistemas integrados substitui, e o Engine deixa de instruir o modelo a controlá-los. As contribuições são coletadas a cada turno e nunca são obrigatórias: uma contribuição vazia é ignorada; se ela gerar erro ou não terminar no prazo, o fato é registrado e ela é ignorada sem afetar a geração.

A fachada de recursos oferece gravações junto com leituras, então o fluxo de configuração do pacote pode localizar ou criar a Persona do jogador e o lorebook dela. Armazenamento, validação e identidade ficam com o Engine; o conteúdo do domínio fica com os pacotes.

### Capability API 1.10: recursos do pacote

A Capability API 1.10 acrescenta a entrega geral de recursos estáticos pertencentes ao pacote. Um manifesto pode declarar `contributions.assets.paths`, uma lista permitida de até 256 imagens (`png`/`webp`/`gif`/`jpg`/`jpeg`) e arquivos JSON enviados dentro do pacote. O Engine os serve em `/api/capability-packages/<id>/assets/<path>` pela mesma cadeia de verificação dos ícones de aba: contenção do caminho, presença do hash em `files[]`, lista permitida de tipos de conteúdo passivos e nova verificação de integridade a cada leitura. O esquema rejeita tipos de documento ativos (SVG, HTML e scripts); todo caminho declarado precisa ter o hash fixado em `files[]`; e o `manifest.json` interno do pacote nunca pode ser servido, mesmo se for declarado. Declarar `contributions.assets` exige um manifesto `schemaVersion` 2 com `capabilityApi` 1.10 ou mais recente; um manifesto v1 não pode declará-lo. Os recursos sempre são revalidados: assim como o pacote do cliente, carregam um `ETag` forte baseado no hash do manifesto e respondem a uma revalidação sem mudanças com `304 Not Modified` e sem corpo. Um conjunto de tiles só é baixado outra vez quando os bytes realmente mudam. As respostas nunca são `immutable` de propósito, pois a política de instalação permite republicar a mesma versão com bytes diferentes e uma URL com versão não é endereçada pelo conteúdo. Isso permite que uma experiência `game-surface` envie arte de verdade em vez de incorporá-la ao pacote do cliente.

Um manifesto que viole essas regras é recusado durante a instalação com uma destas mensagens: "A declared package asset must be listed in the package file manifest", "contributions.assets requires schemaVersion 2 and capabilityApi 1.10 or newer", o erro de extensão do esquema para um caminho que não seja imagem nem JSON, ou, no caso de arquivos cujos nomes só diferem entre maiúsculas e minúsculas e seriam mesclados em sistemas de arquivos que não fazem essa distinção, "Package contains duplicate file" / "Package manifest declares files that collide on case-insensitive filesystems".

Cada elemento de capacidade recebe a própria identidade para isso: `capabilityProps.packageId` e `capabilityProps.packageVersion` chegam junto com `localization`. O pacote monta as URLs de recursos como `/api/capability-packages/<packageId>/assets/<path>`, opcionalmente com `?v=<packageVersion>` para que uma nova versão invalide qualquer cache intermediário, sem baixar novamente a lista de pacotes instalados nem examinar a própria URL de importação.

### Capability API 1.11: interface de combate para experiências

A Capability API 1.11 acrescenta uma interface de combate às propriedades de capacidade `game-surface`. `combatActive` informa o instante em que a interface de combate integrada é realmente montada, ao contrário de `chatMeta.gameActiveState`, o estado narrativo da cena do GM, que demora a refletir a mudança e pode indicar "combat" sem existir um encontro. `combatStyle` leva o estilo efetivo (`classic` ou `tactical`). `requestCombat()` pede ao Engine que gere um encontro pelo mesmo processo do botão manual Start Combat, mas sem a confirmação, pois a interface da experiência já expressou a intenção. O processo de geração do Engine continua decidindo qual será o encontro. Não existe, de propósito, uma forma de o pacote fornecer combatentes ou o estado do combate diretamente: o combate continua sob responsabilidade do Engine.

`requestCombat()` tem identidade estável, não mostra mensagens no caminho do pacote e retorna um código que a experiência usa para renderizar o próprio retorno: `"started"` ou uma recusa, `"combat-active"`, `"pending"` (já existe uma geração em andamento), `"no-turn"` (o GM ainda não escreveu um turno) ou `"unavailable"` (sessão encerrada ou replay). `combatPending` e `combatError` refletem o andamento e a falha da geração para que o pacote não fique esperando `combatActive` depois de uma falha. Como as interfaces 1.7 e 1.8, mas ao contrário de `contributions.assets` da 1.10, que tem uma barreira rígida, essas propriedades são entregues a todo pacote `game-surface`, independentemente da `capabilityApi` declarada. O rótulo 1.11 marca quando surgiram; um pacote que depende delas declara 1.11, e Engines mais antigos o recusam corretamente.

### Capability API 1.12: eventos espaciais para a experiência proprietária

A Capability API 1.12 também endereça os eventos de capacidade espacial ao pacote da experiência proprietária do jogo. `spatial_transition_committed`, `spatial_transition_rejected` e o aviso sem tipo `spatial_context_refresh`, antes enviados apenas a `hierarchical-maps` no evento de janela `marinara-capability-server-event`, passam a ser enviados também com `packageId` igual ao `gameExperienceId` do chat. As cargas variam: um evento confirmado leva `{ chatId, commandId, currentLocationId, definitionRevision, travel? }`; um evento recusado leva `{ chatId, commandId, code?, message? }`, sem campos de localização porque o movimento não aconteceu; o aviso de atualização leva `data: null`. Uma experiência que enviou uma ordem de viagem pelo argumento `pendingSpatialTransition` de `sendMessage` pode confirmar ou limpar a viagem assim que o host conhece o resultado, em vez de deduzi-lo de leituras posteriores. A versão 1.12 também fecha uma lacuna que afetava o World Maps: transições recusadas por um dos dois caminhos HTTP silenciosos, a confirmação antes do streaming do turno proprietário dentro de uma geração ou a confirmação REST independente, antes não geravam evento. Agora os dois sintetizam `spatial_transition_rejected`, somente quando existe evidência definitiva: um código de erro `spatial_*` diferente de `already_applied`. Falhas inconclusivas, como um erro de rede que pode ter perdido uma confirmação bem-sucedida, enviam o aviso sem tipo `spatial_context_refresh`, para que os ouvintes se conciliem com o estado do servidor em vez de aceitar um resultado inventado. Um evento confirmado com `travel.mode` igual a `"step_by_step"` e `complete: false` significa que a viagem continua; mantenha o estado pendente até o evento final. É uma interface flexível como a 1.11: os eventos são entregues independentemente da `capabilityApi` declarada. Declare 1.12 apenas se o pacote precisar dela.

### Capability API 1.13: recolhimento temporário da narração

A Capability API 1.13 acrescenta `requestsCollapsedNarration` à declaração de interface que um pacote `game-surface` envia a `setExperienceChrome`. Enquanto o sinalizador for true, a caixa de narração do Game Mode se recolhe até a alça estreita, permitindo que uma experiência libere a tela para uma cena cinematográfica ou um momento em tela cheia.

Isso é uma SOLICITAÇÃO, não uma preferência. A configuração de recolhimento do jogador nunca é gravada, e o sinalizador só é respeitado enquanto a experiência é a superfície ativa. Remova o sinalizador ou deixe de ser a superfície ativa, e a caixa volta à escolha do jogador. Essa é a garantia de que ela sempre reabre depois; um pacote não pode tornar o recolhimento persistente.

As regras de segurança do Engine têm prioridade. A caixa é aberta à força sempre que o campo de texto do jogador está visível, inclusive no início da cena antes de existir qualquer segmento, e quando os controles de avanço do segmento estão ativos. Esses controles são a única forma de terminar um turno; um pacote capaz de escondê-los poderia prender o jogador para sempre. A alça também continua mostrando o indicador de atenção quando há uma nova tentativa pendente de análise da cena, geração ou geração de combate. Se o jogador abrir a caixa manualmente durante uma solicitação, ela fica aberta até a solicitação terminar. Assim como as interfaces 1.11 e 1.12, esta é flexível: o campo é respeitado independentemente da `capabilityApi` declarada. O rótulo 1.13 marca quando ele surgiu, então um pacote que depende dele declara 1.13.

### Capability API 1.14: superfícies de acompanhamento e ciclo de vida dos agentes

Capability API 1.14 adiciona dois valores de `contributions.slots` para pacotes de agentes Roleplay ativos e habilitados com ponto de entrada do cliente:

- `roleplay-tracker` monta a visualização `toolbar` do pacote no HUD Roleplay. As propriedades incluem `chatId`, `chatMode`, `mobileCompact`, `toolbarButtonClass` do host, `onRerunTracker`, `trackerRetryBusy`, `lockMode` e `onToggleLockMode`. Os callbacks são opcionais: confira se existem antes de usá-los.
- `tracker-panel` monta a visualização `tracker` dentro do Tracker Panel existente, com `chatId`, `chatMode` e `detached`. Reutilize essa superfície em vez de abrir outro painel. Ambos também recebem as propriedades normais de identidade e localização de capacidades.

Contribuições de contexto continuam registradas por `api.registerPromptContext` e exigem `prompt-context`. A solicitação agora expõe `targetCharacterIds`, `personaId` e `placedAgentTypes`, opcional por compatibilidade. Este último informa quais seções de dados de agentes o preset já posicionou, evitando duplicação. O host mantém a identidade do pacote de cada contribuição em `packageBlocks` para posicionar seu texto na seção de agente correspondente. Texto específico para um público deve respeitar os IDs de personagens destinatários recebidos.

Um ponto de entrada do servidor também pode registrar seu serviço de ciclo de vida de pós-processamento por `api.registerService("agent-runtime:<package-id>", service)`. Exige `agent-runtime`; registrar outro ID de pacote é recusado. Os hooks opcionais são:

```ts
const cleanup = api.registerService(`agent-runtime:${packageId}`, {
  prepareContext({ agent, context }) {
    // Return small, JSON-serializable context for this agent, or nothing.
    return { chatId: context.chatId };
  },
  finalizeResult({ agent, context, preparedContext, result }) {
    // Validate or enrich the result before the host publishes/applies it.
    return result;
  },
});
// Return cleanup from activate(), or include it in the activation cleanup.
```

`prepareContext` roda antes do pós-processamento; seu resultado não nulo pertence ao agente e entra no prompt como contexto de execução serializado. `finalizeResult` recebe esse valor e o resultado gerado, e retorna um `AgentResult`. A geração e as novas tentativas manuais esperam a finalização antes de publicar. Cada hook assíncrono tem dois segundos: uma preparação com falha é registrada e ignorada; uma finalização com falha transforma o resultado em falha, sem aplicar saída não validada. São hooks curtos do host, não um lugar para outra chamada lenta ao modelo.

Essas adições não têm controle de versão 1.14 por campo. Um pacote pode detectar propriedades opcionais e funcionar com menos recursos em motores antigos; se precisar dessas superfícies, posicionamento ou ciclo de vida, deve declarar `capabilityApi: { major: 1, minor: 14 }` no manifesto v2 para que um motor anterior recuse a instalação corretamente.

### Capability API 1.15: configuração atual de embeddings

`api.runtime.resolveEmbeddings()` retorna um novo `Promise<CapabilityEmbeddingHost>` com a configuração atual da conexão do agente do pacote. Chame-o ao iniciar cada operação de embeddings em vez de guardar `api.runtime.embeddings`, que é o instantâneo da ativação e não acompanha mudanças posteriores sem reativação.

```ts
const embeddings = await api.runtime.resolveEmbeddings();
const vectors = await embeddings.embed(texts, signal);
// Store/compare embeddings.spaceId with persisted vectors; do not mix embedding spaces.
```

O host retornado tem `spaceId`, `label` e `embed(texts, signal?)`. Usa a fonte de embeddings configurada e recorre ao gerador local MiniLM integrado se nenhuma estiver disponível ou se a resolução da configuração falhar. `embed` pode retornar `null`; lotes vazios, mais de 128 textos ou mais de 200.000 caracteres somados são recusados. Um novo host não recalcula vetores existentes: o pacote deve tratar mudanças de `spaceId` antes de comparar vetores novos e salvos.

O método está disponível nos motores atuais independentemente da versão API declarada. Declare API 1.15 se precisar acompanhar mudanças de conexão. Para aceitar motores antigos, você pode verificar `typeof api.runtime.resolveEmbeddings === "function"` e recorrer a `api.runtime.embeddings`, aceitando sua limitação ao estado da ativação.

### Capability API 1.16: verbos do Game Master declarados por pacotes

Capability API 1.16 permite que um pacote Experience declare uma lista curta e fechada de ações nomeadas do Game Master, chamadas verbos. O motor as apresenta no lembrete de formato do GM, extrai da narração concluída e executa em nome do pacote. Nenhum código de servidor do pacote roda para isso: uma Experience `game-surface` só com pontos de entrada `agents` e `client` pode fazer o GM mudar seu mundo pela prosa.

A integração está completa: esquema, nomes reservados e propriedade de chaves, leitor da tabela, renderização do prompt e executor. Um pacote que fornece a tabela e possui `chat-write` tem seus verbos no lembrete de cada turno Game do chat vinculado e eles são executados quando o GM os usa. Um chat sem pacote vinculado, ou com um pacote sem tabela, resolve zero verbos e mantém um turno idêntico byte a byte ao anterior à integração.

Declare a tabela como `gm-verbs.json`, incluída em `contributions.assets.paths` e fixada por hash em `files[]`, como qualquer recurso. Ela é descoberta por esse nome reservado, uma convenção nova: todos os demais arquivos são lidos por caminhos declarados (`entrypoints`, ícones, recursos), e nada mais é descoberto pelo formato. Um arquivo em `files[]` mas ausente de `contributions.assets.paths` não gera diagnóstico na instalação nem na construção do catálogo: o pacote simplesmente fica sem verbos. O recurso declarado é servido sem proteção em `/api/capability-packages/<id>/assets/gm-verbs.json`, pois essa rota não verifica acesso privilegiado; a tabela nunca deve conter informações sensíveis. Como 1.11–1.13, é uma integração opcional: motores antigos veem um recurso JSON comum e o ignoram. Você pode incluí-lo sem restringir versões; declare `capabilityApi` 1.16 somente se o pacote precisar dos verbos, pois isso recusa todos os motores anteriores.

O documento é `{ "schemaVersion": 1, "verbs": [ … ] }`, com 1–16 verbos. Cada verbo é estrito: chaves desconhecidas são recusadas. Campos desconhecidos ao lado de `schemaVersion` e `verbs` recebem deliberadamente outro tratamento: o motor os remove para aproveitar os verbos que entende de uma tabela mais nova, enquanto o esquema compartilhado de autoria é estrito e os recusa. A validação ao escrever é, portanto, mais rigorosa que a leitura em execução:

```json
{
  "schemaVersion": 1,
  "verbs": [
    {
      "name": "weather",
      "description": "Set the sky when the weather visibly changes.",
      "effect": "state",
      "metadataKey": "pixelforgeWeather",
      "args": [
        { "name": "word", "type": "string", "enum": ["fair", "overcast", "rain", "storm", "snow"] },
        { "name": "intensity", "type": "string", "enum": ["light", "heavy"], "optional": true }
      ]
    }
  ]
}
```

Um nome de verbo segue `[a-z][a-z0-9_]*`, tem no máximo 32 caracteres e não pode coincidir com as tags entre colchetes do GM próprias do motor. A verificação ignora maiúsculas: o lembrete escreve `[Note:` e `[Book:`, mas a expressão de análise não distingue o caso; `note` ocultaria a tag do diário. O conjunto reservado vem de todas as tags que os lembretes do GM e do grupo podem produzir em suas ramificações e dos cinco analisadores de narração: analisador de tags e formatador do cliente, editor de segmentos do servidor, analisador de cenas do sidecar e reescritor de diálogo da rota de geração. Seu vocabulário também inclui `main`, `side`, `extra`, `action`, `thought`, `whisper` e o par `qte_bonus` / `qte_result`, reconhecido só pelo formatador. Um verbo `whisper` removeria `[whisper:Tam]` de uma fala antes de salvar, e a linha deixaria permanentemente de ser diálogo.

As regressões também fixam os extratores: cada analisador com nomes exclusivos, como `party-chat` / `party-turn` ou o par QTE, precisa continuar fornecendo esses nomes. Se uma fonte deixar de ser varrida, a compilação falha em vez de reduzir o conjunto silenciosamente. Os outros três também são percorridos para detectar novas tags. Isso não garante completude: uma tag em arquivo não examinado ou escrita em formato que o extrator não entenda pode escapar; amplie o conjunto quando surgir outro analisador. Palavras comuns como `action`, `state`, `status` e `note` também são reservadas; a recusa geralmente vem dessa regra, não de erro de digitação.

`description` ocupa uma linha de 1–200 caracteres sem colchetes nem quebras, pois entra literalmente em `COMMANDS:`. Além de CR e LF, são proibidos `U+0085`, `U+2028`, `U+2029`, controles C0 e DEL, inclusive tabulações, que deformam o bloco. Depois, porém, as macros do lembrete inteiro são expandidas: `{{…}}` dentro da descrição é avaliado, inclusive `{{setvar::…}}`, que escreve variáveis do chat. Isso não concede mais acesso que `chat-write`, mas evite essas chaves se não forem intencionais. Um verbo aceita até seis argumentos `{ name, type, enum?, maxLength?, optional? }`, nomeados com `[a-z][a-zA-Z0-9_]*` em até 32 caracteres. Diferentemente do verbo, maiúsculas são permitidas porque são chaves JSON, não tags. Só strings aceitam `enum`, com 1–16 valores distintos; duplicatas são recusadas. Uma string sem enum deve declarar `maxLength` de 1–500: a análise delimitada do executor não herda outro teto e poderia aceitar um fragmento inteiro de narração. Declarar `enum` e `maxLength` juntos é recusado, pois o enum já limita o valor. As cargas são JSON plano de uma linha; um `}` aninhado encerra a correspondência antes da hora. Só uma instância de cada nome é analisada por mensagem, então um verbo repetido é aplicado uma vez.

Não é preciso explicar os argumentos na descrição. A tabela analisada produz uma carga esquemática, a descrição e um exemplo copiável:

```
- [weather:{"word":"fair|overcast|rain|storm|snow","intensity"?:"light|heavy"}] — Set the sky when the weather visibly changes. Example: [weather:{"word":"fair"}]
```

O esquema ensina o vocabulário: argumentos na ordem, opcionais marcados com `"name"?:` fora da string JSON, alternativas completas dos enums, limite das strings livres e números ou booleanos sem aspas. O validador recusa `"3"` como número em vez de converter. O exemplo só mostra um valor de enum; com apenas `{"word":"fair"}`, o GM pode escrever "sunny", recusado sem aviso visível. A tag é removida quando o nome corresponde, não quando a validação passa: a narração fica limpa, mas o mundo não muda. Derivar esquema e exemplo da mesma tabela evita divergências; os valores não ficam mais numa descrição que poderia prometer algo inválido. Use os 200 caracteres para explicar quando agir, não para repetir argumentos.

A degradação é por verbo. Um `effect` mais novo, formato impossível de representar, nome reservado ou chave alheia é ignorado com uma linha de registro; os demais continuam, como em `parseCapabilityCatalogWithCompat`. Se um verbo não aparece, leia o registro. Um documento inutilizável, com `schemaVersion` desconhecido, array `verbs` vazio ou raiz que não é objeto, produz tabela vazia e uma linha de registro. A tabela também é recusada antes da leitura se seu `files[].bytes` declarado exceder 64 KB; `files[]` aceita até 100 MB e nada mais limita um recurso antes de ler. Em qualquer falha, o turno sobrevive sem alterações.

Um verbo com `metadataKey` é um **verbo de estado**: grava todos os argumentos sob essa chave nos metadados do chat; o pacote vê a mudança pelas propriedades usuais. Sem `metadataKey`, é um **verbo de evento**, entregue ao vivo como evento de cliente de capacidade, sem gravação durável, fila, repetição nem confirmação. Um evento recusa `metadataKey` para não ocupar uma chave que não escreve; o estado a exige.

O estado é durável e nunca reverte: trocar a variante, editar ou excluir o turno mantém o valor. A última variante gerada vence, não a última exibida; prosa e mundo podem divergir sem reconciliação. Um evento não tem memória: um quadro, um despacho síncrono. É perdido silenciosamente se o turno for abortado, a aba fechar ou recarregar durante a transmissão, chegar antes da primeira montagem do pacote, o jogador mudar de chat ou a tela de carregamento do pacote estiver ativa. Nada o reenvia. Em troca, seu efeito pode reverter com a história se o pacote o guardar onde voltar no tempo reconstrói o estado; os metadados do chat não retrocedem. Um evento aplicado ao estado vivo e perdido numa recarga forçada antes do próximo salvamento não deixa vestígio em nenhum dos casos.

A semântica relativa é proibida por projeto nos dois tipos. O estado sobrescreve valores absolutos e não pode expressar "adicionar cinco moedas". Um evento relativo também é proibido: regenerar cria um índice de variante novo sem carregar as marcas da anterior, então acumularia uma vez por variante gerada. Deduplicar por `chatId:messageId:swipeIndex` evita reenvios, que esse canal não faz, mas não regenerações, que faz. Valores absolutos, não um registro de transações, tornam seguro aplicar um verbo duas vezes. Transforme qualquer vocabulário relativo em valores absolutos por mensagem.

Se um turno contém os dois tipos, o evento síncrono chega antes de terminar a busca assíncrona do estado atualizado. Seu manipulador não deve ler o efeito de um verbo de estado do mesmo turno esperando o valor novo.

O motor só valida o formato: nomes e tipos de argumentos, participação nos enums e limites de strings. A semântica pertence ao pacote: não se pode enumerar NPCs ao declarar um mundo compilado por chat. A recusa do pacote a um verbo de estado é apenas orientativa, pois os metadados já foram gravados ao recebê-lo. Para um evento, a recusa é efetiva: o motor não gravou nada e o pacote pode realmente rejeitar um nome desconhecido.

`metadataKey` deve pertencer ao pacote sob três regras: começa com seu ID normalizado em camelCase (`hierarchical-maps` → `hierarchicalMaps`), continua com um sufixo não vazio que começa em maiúscula, e o ID normalizado não pode ser um namespace do motor nem estendê-lo numa fronteira de maiúscula. Isso impede roubar o prefixo de outro pacote. A lista do motor deriva de todas as chaves superiores de `ChatMetadata`, de suas constantes e das chaves presentes só na assinatura de índice, como `encounterActive`, `internalAssistant` e `imageGenConnectionId`, invisíveis para as duas primeiras fontes.

Esse terceiro grupo exige sete fontes: os objetos passados a `patchMetadata`/`updateMetadata`; os retornados por callbacks de atualização, quase tão frequentes; a mutação `useUpdateChatMetadata()` e a propriedade `onMetadataChange` do cliente; chamadas diretas `PATCH /chats/:id/metadata`, usadas sem esse hook para chaves de combate, cena e narração; leituras `chatMetadata.key` e `chat.metadata.key`; leituras do resultado de `parseChatMetadata(…)`, a forma mais comum e a única que vê `scenario`; e a lista manual de chaves por chat dos perfis de configurações, que cobre chaves lidas e escritas através de limites entre funções.

As regressões fixam todas as fontes e extratores. Há dois limites deliberados. Uma escrita que recebe variável ou resultado de função, como `patchMetadata(id, hydratedMeta)` ou a mesma forma na rota de metadados, contém chaves invisíveis a uma varredura estática: existem vinte chamadas assim e a regressão fixa esse número; a vigésima primeira exige leitura manual. Uma leitura dentro de um auxiliar a partir de um parâmetro também fica fora do alcance: é o caso de `spatialContext`, escrito pelo cliente de `hierarchical-maps` distribuído no repositório Agents e lido aqui por um auxiliar e análise local ao arquivo. A lista manual cobre esse segundo ponto; por isso uma das sete fontes é selecionada à mão. Os limites são declarados em vez de negados. `persona` também é um mínimo adicionado manualmente que nenhuma fonte produz hoje.

A terceira regra recusa pacotes inteiros de propósito: `conversation-calls` vira `conversationCalls`, e `conversationCalls` + `Enabled` já é uma chave do motor. Esse pacote não pode possuir chaves sob seu ID; `noodle` e `background` estão na mesma situação, este último já sendo uma chave de metadados. Eles ainda podem declarar eventos, que não possuem chaves. As chaves são planas e no nível superior porque esse é o formato que o reconciliador do pacote já lê.

Comandos do modelo declarados por um pacote só são executados se ele declarar `chat-write`, estiver instalado e estiver pronto. Essa permissão também controla gravações pela API de persistência do pacote, incluindo mensagens, metadados do chat, eventos de roleplay e snapshots espaciais. `chat-read` controla leituras de chats, mensagens, estado do jogo e snapshots espaciais. As mesmas verificações se aplicam dentro de transações de persistência e bloqueios do chat; uma permissão de gravação não concede implicitamente permissão de leitura. Chamadas de persistência do próprio motor continuam sendo confiáveis.

Após a instalação, a visualização de detalhes de **Download Agents** (baixar agentes) mostra as permissões declaradas pela versão instalada. Quando a versão do catálogo solicita permissões diferentes, elas aparecem separadamente. Instalar ou atualizar código ainda exige a aprovação existente vinculada àquela versão e soma de verificação exatas; comandos do modelo não pedem aprovação separada a cada turno.

São verificações de API, não um ambiente isolado de JavaScript. Permissões de rede, armazenamento e interface são declarações de acesso. O código do pacote no navegador e no servidor continua sendo código confiável e pode acessar o ambiente do host; instale apenas pacotes em que você confia. A verificação considera se o pacote está pronto, e não apenas se pode ser servido: uma atualização que o deixe em `restart-required` interrompe a resolução de seus comandos até o motor reiniciar.

### Capability API 1.17: preparar uma Experience antes do primeiro turno

Um pacote `game-surface` pode declarar `contributions.gameSurface.prepareBeforeStart: true` com a versão 2 do esquema e Capability API 1.17. O Engine monta essa superfície quando o jogo está pronto, antes de habilitar **Start Game** (iniciar jogo). Jogos clássicos e pacotes sem essa marca mantêm o fluxo de inicialização atual.

A superfície principal que ativa essa opção recebe duas propriedades adicionais:

- `startup: boolean` permanece true até o jogador concluir a introdução do Engine com **Continue** (continuar). Pause a simulação do mundo e as ações do jogador enquanto o valor for true.
- `setStartupReady(context: string | null): void` informa o estado da preparação. Envie `null` durante o carregamento, o salvamento ou a recuperação de uma falha. Envie uma string somente quando o mundo real estiver salvo de forma persistente e utilizável; uma string vazia permite iniciar sem contexto adicional.

O host bloqueia **Start Game**, sua confirmação de preparação dos widgets e as novas tentativas do primeiro turno até receber uma string de prontidão. Durante o bloqueio, a interface de carregamento e de falha/nova tentativa do próprio pacote continua visível. Quando fica pronto, o pacote é ocultado atrás da introdução normal do Engine. **Continue** abre a superfície habitual, que pode ser montada novamente: mantenha a preparação do mundo idempotente e restaure o estado salvo em vez de gerá-lo outra vez. Retornar a um jogo cuja introdução já terminou não repete a preparação inicial.

O contexto de abertura tem um limite de **8.000 caracteres**. Um contexto inválido ou longo demais mantém a inicialização bloqueada e exibe um erro; o host não corta fatos do mundo. Forneça um relato compacto do local inicial preparado e dos personagens que realmente estão nele. O Engine acrescenta esse texto ao `generationGuide` existente do primeiro turno com a origem `game_start`, para que a abertura use o mundo que existe. Isso não registra contexto para os turnos seguintes; continue usando a contribuição normal do pacote ao prompt ou seu contexto de geração de turno.

Os callbacks de prontidão pertencem ao chat, ao jogo e ao pacote montados. Chamadas atrasadas de outro escopo são ignoradas. Uma falha do módulo ou do ambiente de execução bloqueia a inicialização em vez de tratar a falta de contexto do mundo como sucesso. Após recarregar, o pacote deve informar a prontidão a partir do mundo salvo. O provedor de contexto do prompt no servidor continua sendo somente leitura e sujeito ao seu prazo curto; não o use para gerar o mundo nem como uma barreira prolongada de inicialização.

### Capability API 1.19: ferramentas fornecidas por pacotes

A Capability API 1.16 permitia que um pacote fizesse o modelo _dizer_ algo sobre o qual pudesse agir. Esta versão permite que o modelo _chame_ algo. Um pacote com a nova permissão `tools` registra uma ferramenta com nome no ponto de entrada do servidor. O Engine a oferece junto das ferramentas integradas em cada turno de cada chat, valida a chamada com o JSON Schema do pacote e entrega os argumentos ao manipulador.

```ts
export async function activate({ api }) {
  api.registerTool({
    name: "set_time",
    description: "Move the world clock forward or back.",
    parameters: {
      type: "object",
      properties: {
        action: { type: "string", enum: ["advance", "rewind"] },
        minutes: { type: "integer", minimum: 0 },
      },
      required: ["action", "minutes"],
      additionalProperties: false,
    },
    handler: async (args, { chatId }) => {
      const clock = await moveClock(chatId, args.action, args.minutes);
      return { time: clock.label };
    },
  });
}
```

A escolha de chamadas de ferramentas em vez de um formato de resposta é intencional. Um formato ocupa a resposta inteira: a narração teria que ser um campo de um objeto JSON e não poderia chegar por streaming. Uma chamada pode acompanhar o texto enquanto o modelo escreve o turno. O pacote recebe argumentos já restringidos pelo provedor, em vez de extraí-los da narração pronta. Um esquema impõe regras; uma convenção apenas pede que o modelo as respeite.

As enumerações mostram a diferença. Um pacote que conhece doze lugares pode incluir os doze nomes no esquema. Um décimo terceiro nome é recusado antes de chegar ao manipulador. O validador de argumentos existente do Engine indica os valores aceitos para que o modelo possa corrigir a chamada. O retorno do manipulador é mostrado ao modelo como resultado da ferramenta.

Antes de escrever uma ferramenta, conheça estas regras:

- Os nomes usam `<packageId>_<name>`, trocando `-` por `_`: `set_time` de `world-clock` chega ao modelo como `world_clock_set_time`. Um nome já pertencente a outro pacote é recusado. Ferramentas integradas e ferramentas personalizadas ativadas mantêm os nomes em conflito; a definição do pacote é omitida. O nome completo aceita no máximo **64 caracteres**. Tanto as definições quanto a execução seguem esta ordem: integrada, personalizada, pacote.
- As ferramentas são anexadas enquanto o pacote estiver ativo. Não há um segundo controle por chat como nas ferramentas integradas: declarar a permissão e registrar a ferramenta é a decisão. O provedor selecionado precisa aceitar chamadas nativas de ferramentas.
- O esquema de parâmetros é copiado e compilado no registro. Se o Engine não conseguir compilá-lo, a ativação falha, tornando o problema visível durante o desenvolvimento em vez de no meio do turno.
- Se o manipulador lançar um erro, a chamada falha e o erro é registrado; sua mensagem não é encaminhada ao modelo. Após **10 segundos** sem resultado, o turno também deixa de esperar. O manipulador continua executando, mas não pode bloquear o turno inteiro.
- Os resultados precisam ser serializáveis em até **64 KiB**. Resultados maiores ou não serializáveis fazem a chamada falhar em vez de ocupar o espaço da conversa. Descrições e resultados são conteúdo confiável do pacote. Verifique `chatId` antes de ler ou alterar dados de um chat.
- Cada definição é serializada na solicitação ao provedor em cada turno e conta no ajuste de contexto. Os limites são **16 ferramentas por pacote**, **64 no total**, **512 caracteres** por descrição e **8 KiB** por esquema de parâmetros. Ultrapassá-los lança um erro e impede a ativação. Registrar novamente um nome do próprio pacote substitui a ferramenta sem ocupar outra vaga.
- O contexto de ativação para de funcionar quando ela termina. Se o pacote guardar `api` e chamar `registerTool` em um callback posterior, a chamada será recusada. Uma execução encerrada não pode registrar ferramentas nem substituir as de uma nova ativação.
- Desativar, atualizar ou remover um pacote libera suas ferramentas. O modelo não recebe ferramentas de um pacote que não pode mais responder. As ferramentas são removidas antes de aguardar a limpeza; cada callback de limpeza tem um prazo de 8 segundos.

Esses prazos limitam apenas a espera assíncrona. Os pacotes executam código confiável no processo do servidor; um temporizador não pode interromper trabalho síncrono que bloqueia o loop de eventos. O cancelamento forçado exigiria um worker ou processo separado, que esta API não oferece.

`api.registerTool` só existe a partir desta versão do Engine. Um pacote que dependa dele precisa declarar `capabilityApi` 1.19 e não será instalado em versões anteriores.

## Declarações de decisão e o modelo de decisão

O **Decision model** (Modelo de decisão) do usuário responde a declarações de sim/não e de opções sobre o chat recente. Veja [Modelos de decisão](../connections/decision-models.md) para entender sua função e configuração.

Um template de prompt de agente incluído num pacote pode usar `{{#if decision:"..."}}` e `{{#if decision_choice:"..." == "..."}}` como um agente personalizado. O motor encontra as declarações e pergunta antes de executar o agente (depois da resposta, para pós-processamento), resolvendo o template com as respostas. Nenhuma versão da API de capacidades está envolvida. Veja a sintaxe e a redação em [Prompts condicionais](../prompts/conditional-prompts.md#asking-the-decision-model) e as fases em [Criar agentes personalizados](../agents/custom-agents.md#decision-statements-in-the-agents-prompt).

O código de execução do pacote ainda não pode consultar diretamente o modelo de decisão. Isso exige um método da API de capacidades e seu próprio aumento de versão.

Projete cada uso para quem não tem modelo de decisão. Uma declaração sem resposta vale não: a ramificação `{{else}}`, ou nada, precisa ser um padrão sensato. Escreva para um modelo de decisão em geral, sem exigir Jev: modelos de chat locais e outros backends compatíveis usam a mesma sintaxe, mas podem responder diferente. Veja [Limiares](../connections/decision-models.md#thresholds) e [Limites e custo](../prompts/conditional-prompts.md#limits-and-cost) antes de depender de uma pontuação, quantidade de solicitações ou resposta em cache específica.

### Nota para desenvolvedores de Experiences de Game Mode

O combate do motor decide sozinho o que os inimigos comuns fazem. Cada inimigo não chefe do GM recebe uma função conforme suas habilidades e classe (bruiser, bulwark, skirmisher, marksman, spellcaster, supporter ou controller), proficiência conforme o nível, salvo se a definir (novice, trained, veteran ou master), e temperamento como reckless, cautious, opportunistic ou protective. Bestas e monstruosidades são sempre mindless. O código escolhe isso a partir de uma semente sem chamar o modelo; a dificuldade muda a consistência com que seguem seu tipo. Só chefes criados explicitamente são dirigidos pelo GM por uma chamada ao modelo. Veja [IA de combate de Game Mode](game-combat-ai-design.md).

Há mais melhorias de combate a caminho. Antes de introduzir decisões, confira se o combate padrão do motor já atende à necessidade. Para uma personalidade específica, atribua primeiro a proficiência e o temperamento correspondentes. Uma decisão por turno inimigo adicionaria trabalho do modelo e um prazo; um backend hospedado também adicionaria solicitações de rede e cobranças. A luta dependeria de um modelo que o usuário talvez não tenha configurado e precisaria de um comportamento sensato sem resposta.

## Pacotes iniciais

- todos os agentes hoje embutidos;
- mapas espaciais hierárquicos para Roleplay e Game;
- chamadas de áudio e vídeo no Conversation Mode;
- UNO;
- Chess;
- Poker;
- 8-Ball Pool;
- Tic-Tac-Toe;
- Rock-Paper-Scissors.

A base guarda o gerenciador de pacotes, o cliente do catálogo, os contratos genéricos do pipeline de agentes, os contratos genéricos de hospedagem de jogos por turno e as interfaces de hospedagem inertes. As implementações concretas pertencem aos pacotes.

## Confiança e instalação

O catálogo oficial é um documento JSON versionado e validado por esquema, obtido por HTTPS. Cada entrada de versão traz URLs de artefato imutáveis, digests SHA-256, tamanho em bytes, compatibilidade com o Engine, permissões e a informação de que o tempo de execução exige ou não reiniciar.

Quando o servidor inicia e há pelo menos um pacote oficial instalado, o host busca o catálogo uma vez, seleciona apenas as versões mais novas compatíveis com o Engine e com a API de capacidades em uso, verifica cada uma pelo fluxo normal de instalação e as instala antes de os pacotes entrarem em execução. Uma falha afeta só o pacote em que aconteceu. Os arquivos existentes e o estado do registro continuam utilizáveis se o catálogo estiver fora do ar ou se a verificação falhar, e falhas de prontidão do servidor usam o caminho de rollback para a versão anterior.

O instalador precisa:

1. exigir acesso privilegiado por loopback ou de administrador;
2. impor HTTPS, limites de download e tempo limite;
3. verificar a confiança do catálogo e o SHA-256 do artefato antes de extrair;
4. rejeitar caminhos absolutos, travessia de caminho, links, arquivos de dispositivo e arquivos não declarados;
5. validar o manifesto e a compatibilidade com o Engine;
6. extrair em uma pasta temporária vizinha;
7. ativar de forma atômica só depois que a validação passar;
8. manter a versão anterior até que o novo tempo de execução inicie sem erro;
9. desfazer a ativação em caso de falha;
10. nunca executar scripts de instalação, atualização ou desinstalação.

O catálogo oficial só habilita pacotes executáveis confiáveis produzidos pelo próprio projeto. Um fluxo futuro para pacotes de terceiros exige um modelo de confiança separado e explícito.

## Execução e comportamento de reinício

O servidor é dono do registro de pacotes instalados e informa aos clientes quais capacidades estão disponíveis. Os módulos declarativos e recarregáveis entram em uso na hora. A interface invalida as consultas de catálogo, de agentes, de capacidades de modo e do chat ativo depois da ativação.

O manifesto só pode declarar `restartRequired` quando o host não consegue recarregar aquele ponto de entrada com segurança. A ativação a quente bem-sucedida mostra `Agent installed. It is ready to use.` A ativação que exige reinício mostra `Agent installed. Restart Marinara Engine to finish setup.`

Os pacotes de jogo por turno são recarregáveis a quente: a instalação registra na hora o motor no servidor e o lançador manual por comando de barra, e a desinstalação desconecta o tempo de execução sem reiniciar o Engine. As configurações de Conversation Commands de cada chat controlam apenas se os personagens podem emitir o comando oculto do pacote; elas não bloqueiam o lançador por comando de barra do usuário. Os manifestos oficiais de jogo por turno ainda trazem a marca conservadora de reinício, herdada, por compatibilidade com o Engine 2.x; o Engine 3.x reconhece o tipo `turn-game`, faz a ativação a quente com segurança e devolve o pacote como ativo e pronto.

## Migração de compatibilidade

Na primeira vez que o aplicativo abre depois da atualização:

- os agentes personalizados ficam intactos;
- todo agente embutido antigo visível naquela instalação é registrado como instalado;
- os mapas, as chamadas do Conversation Mode e os jogos do Conversation Mode continuam disponíveis como antes;
- a configuração de cada chat, os snapshots, o estado do jogo, o histórico de chamadas e a memória dos agentes continuam onde estavam;
- a migração é idempotente e só registra sua conclusão depois que todas as entradas de disponibilidade antigas estão gravadas em disco.

Os artefatos dos pacotes antigos continuam no catálogo oficial como origem para a migração. Uma instalação nova não exibe nem ativa esses pacotes até o usuário instalá-los.

## Desinstalação

A desinstalação tira o pacote das seleções dos chats ativos, exclui a configuração do agente e os arquivos executáveis baixados, e desconecta o tempo de execução no próximo reinício, quando necessário. Os chats antigos, as mensagens, os snapshots de mapa, os resumos de chamadas e os registros de partidas concluídas continuam legíveis, então remover um pacote nunca destrói o trabalho do usuário. A remoção destrutiva dos dados históricos é uma ação separada e explícita do usuário.

Toda desinstalação pede confirmação. Os chats afetados voltam às telas comuns da base, sem corromper o histórico.

## Interface do catálogo

O painel **Agents** (agentes) tem um controle `Download Agents` equivalente ao `Download Cards` do painel **Card Browser** (navegador de cards). Ele abre uma biblioteca responsiva em tela cheia com busca, tipos de pacote, informações de compatibilidade, estado de instalação e atualização, permissões, espaço ocupado, documentação e controles de desinstalação.

No computador, aparece uma lista de navegação com uma área de detalhes ao lado. No celular, aparece um painel só, com navegação explícita para voltar e ações grandes o bastante para o toque. Os estados de lista vazia, sem conexão, incompatível, download corrompido, instalação interrompida, atualização, rollback e reinício necessário são tratados como estados de primeira classe.

## Critério de extração

Uma extração só está completa quando os bundles de produção do cliente e do servidor da base não contêm mais a implementação do pacote, quando uma instalação nova não consegue ativá-lo sem baixar o pacote, quando uma instalação atualizada continua com ele e quando instalar, atualizar e desinstalar o pacote funciona em computador, celular e sistemas de arquivos compatíveis com Termux.

### Capability API 1.20: conjuntos de regras de Game Mode

Um conjunto fornece dados validados: resolução de testes conhecida pelo Engine, ficha com elementos predefinidos, descansos e orientações para o GM. O recurso reservado `ruleset.json` é descoberto como `gm-verbs.json`, por `contributions.assets.paths` e um hash em `files[]`.

```json
{
  "schemaVersion": 2,
  "capabilityApi": { "major": 1, "minor": 20 },
  "id": "ruleset-5e-2014",
  "kind": ["ruleset"],
  "permissions": [],
  "entrypoints": {},
  "contributions": { "assets": { "paths": ["ruleset.json"] } },
  "files": [{ "path": "ruleset.json", "sha256": "<sha256 of the file>", "bytes": 25767 }]
}
```

O exemplo mostra apenas os campos relevantes; `name`, `version`, `description`, `engine` e `builtAgainst` continuam obrigatórios. Não exige permissões, agente nem pontos de entrada de cliente ou servidor. O tipo `ruleset` e `ruleset.json` exigem um ao outro. Não executa código nem expressões em texto; uma resolução nova exige mudanças no Engine. Veja formato e exemplo 5e em [`game-rulesets-and-sheets-implementation.md`](game-rulesets-and-sheets-implementation.md).

O manifesto deve declarar API 1.20; Engines antigos recusam a instalação. O Engine rejeita tamanho declarado acima de 256 KB antes da leitura, verifica novamente o hash instalado e aplica `packages/shared/src/schemas/ruleset.schema.ts`. Um arquivo inválido é ignorado com um registro identificando pacote e primeiros erros `path: message`. IDs repetidos favorecem o primeiro pacote na ordem de IDs de pacote; o outro é ignorado com registro. `engine-legacy` e `traditional` são reservados.

A escolha é salva uma vez em `chat.metadata.gameRuleset`. Sem escolha, valem as regras existentes. Pacote ausente ou definição antiga torna o conjunto indisponível sem substituí-lo. O vínculo verifica ID do conjunto e pacote fornecedor, impedindo que outro pacote assuma a partida com o mesmo ID.

### Capability API 1.21: catálogos

Catálogos oferecem magias, habilidades de classe e equipamentos no editor da ficha. O cabeçalho fica em `catalogs` dentro de `ruleset.json`; entradas podem ficar ali ou em recurso reservado:

```json
{
  "capabilityApi": { "major": 1, "minor": 21 },
  "kind": ["ruleset"],
  "contributions": { "assets": { "paths": ["ruleset.json", "catalogs/spells.json"] } },
  "files": [
    { "path": "ruleset.json", "sha256": "<sha256>", "bytes": 25767 },
    { "path": "catalogs/spells.json", "sha256": "<sha256>", "bytes": 418204 }
  ]
}
```

`catalogs/<id>.json` deve corresponder ao ID do catálogo, nunca a outro. Tem hash em `files[]` e exige o `ruleset.json` que o declara. Tamanho declarado acima de 1 MB é recusado antes da leitura. Entradas internas e externas são validadas contra a mesma ficha. Limites: 12 catálogos por conjunto, 2000 entradas por catálogo.

O cliente carrega o conteúdo ao abrir o seletor, por `GET /api/capability-packages/rulesets/catalog?rulesetId=&catalogId=&version=`. A lista instalada contém apenas contagens. O texto do catálogo não entra automaticamente no prompt; o GM só vê o que `gm.sheetSummary` seleciona. Recursos e o campo `catalogs` no arquivo verificado exigem API 1.21. Um esquema estrito antigo rejeitaria o arquivo inteiro. Sem permissões.

### Capability API 1.22: bloco battle

`battle` indica saúde, MP opcional, reservas de espaços e listas cujas linhas de catálogo viram `CombatSkill`. Depois da batalha, devolve valores pelas mesmas operações da ficha usadas nos controles do jogador.

```json
{
  "capabilityApi": { "major": 1, "minor": 22 },
  "kind": ["ruleset"],
  "contributions": { "assets": { "paths": ["ruleset.json"] } }
}
```

É uma ligação de dados ao combate do Engine, não um adaptador completo do sistema de mesa. O cálculo integrado não lê `attackRoll`, `save`, `concentration` nem `perCostStep`. Regras exatas pertencem a outra integração com adaptadores. `coverage.combat` mantém seu significado independente e não é lido nessa ligação. O conteúdo verificado de `ruleset.json` exige API 1.22 para `battle`, como 1.21 para `catalogs`. Sem permissões nem mudanças em conjuntos sem o bloco.

### Capability API 1.23: valores escalonados de catálogo

`scaled` permite que o conjunto mantenha até quatro colunas numéricas próprias de uma linha. Cada uma usa uma referência de valor existente e uma tabela de limites opcional, como recursos por nível ou usos por atributo, sem nova aritmética.

```json
{
  "capabilityApi": { "major": 1, "minor": 23 },
  "kind": ["ruleset"],
  "contributions": { "assets": { "paths": ["ruleset.json", "catalogs/spells.json"] } }
}
```

O recálculo acontece ao editar, não ao ler. Estado da partida, prompt do GM e combate leem o número salvo. As linhas podem estar em `ruleset.json` ou `catalogs/<id>.json`; o instalador verifica ambos e exige API 1.23 para `scaled`. Sem permissões ou mudanças em catálogos sem escalonamento.

`[sheet: op="use" name="..."]` paga `mechanics.cost` e um uso de cada reserva de linha criada pela entrada. Não exige outra declaração, pois usa catálogos já compatíveis.

### Capability API 1.24: paradas de dados

`resolution` aceita `"kind": "dice-pool"` em vez de `"dice-sum"`. O valor da ficha indica quantos dados rolar; resultados que atingem o limiar contam como sucessos. O conjunto pode definir sucessos duplos, explosões, cancelamentos, falhas críticas, sucessos excepcionais e limites para ajustes circunstanciais do GM.

```json
{
  "capabilityApi": { "major": 1, "minor": 24 },
  "kind": ["ruleset"],
  "contributions": { "assets": { "paths": ["ruleset.json"] } }
}
```

A ficha não muda: o modificador de soma passa a contar dados. Não há novos elementos, slots de editor nem código do pacote. O instalador exige API 1.24 para `dice-pool` no `ruleset.json` verificado; Engines antigos limitados a `dice-sum` rejeitariam tudo. Sem permissões nem mudanças em conjuntos de soma.

### Capability API 1.25: camadas e orientações do mundo

`layers` contém variantes nomeadas, escolhidas na criação e fixadas no vínculo da partida. O bloco base `gm` aceita a string opcional `worldGuidance`; `gm.worldGuidance` é lido uma vez ao gerar o mundo, para adaptá-lo às regras do grupo.

```json
{
  "capabilityApi": { "major": 1, "minor": 25 },
  "kind": ["ruleset"],
  "contributions": { "assets": { "paths": ["ruleset.json"] } }
}
```

Os efeitos permitidos acrescentam orientações depois das do conjunto, removem valores de enumeração, substituem a escala de dificuldade por outra do mesmo tipo de resolução e ocultam entradas de catálogo. Não adicionam elementos à ficha, que continua legível com qualquer camada. Sem código de pacote ou chamada extra ao modelo. Camadas de terceiros ficam para depois. Ambos os campos verificados exigem API 1.25. Sem permissões ou mudanças para conjuntos que não os usam.

### Capability API 1.30: ferimentos, gasto em testes e combate sobre uma trilha

Uma entrada `live.tracks` pode declarar `levels` e `kinds` para passar de inteiro limitado a TRILHA DE FERIMENTOS: casas com seus próprios rótulos e penalidades, sobre as quais ficam as marcas. `levels` tem 1–16 níveis, do melhor ao pior, cada um com `label` e `penalty` inteiro. `kinds` tem 1–6 tipos de dano, cada um com `id`, `label` curto e `severity` distinta. Eles andam juntos: `kinds` sem `levels` é recusado, pois não haveria onde marcar. `resolution.penaltyFrom` nomeia a trilha cuja penalidade afeta toda rolagem: em `dice-pool`, retira dados sem baixar de `pool.min`; em `dice-sum`, é um modificador fixo.

O restante da 1.30 inclui estas adições; um pacote que use qualquer uma deve declarar 1.30:

- `combat.health` pode nomear uma trilha de ferimentos em vez de uma reserva. `combat.damageKinds` informa o que cada tipo marca: `default`, um mapa `byType` opcional e `marks`, com `per-blow` para uma casa por golpe acertado ou `per-point` para contar níveis de saúde conforme o dano rolado. `damageKinds` é obrigatório com ferimentos e recusado com reservas.
- `resolution.spend`, só para `dice-pool`, define a reserva que pode ser gasta num teste, o custo de cada pagamento, se compra `successes` ou `dice` e `perCheck`, o teto por rolagem.
- `mechanics.check` numa entrada de catálogo define o que algo ESCOLHIDO pelo personagem faz no teste: `reroll` (`upTo` e `once` ou `until`), `dice`, `successes` ou `threshold`. Também exclusivo de reservas.

```json
{
  "capabilityApi": { "major": 1, "minor": 30 },
  "kind": ["ruleset"],
  "contributions": { "assets": { "paths": ["ruleset.json"] } }
}
```

O comprimento da trilha corresponde aos níveis: `min` deve ser 0 e `max`, `levels.length`. Um arquivo que diga outra coisa é recusado, não corrigido silenciosamente. `resolution.penaltyFrom` precisa nomear uma trilha de ferimentos; uma trilha comum não tem penalidade a aplicar.

Não é uma integração opcional, pelo mesmo motivo que 1.20–1.28: um motor que não entende `levels`, `kinds`, `penaltyFrom`, `damageKinds`, `resolution.spend` ou `mechanics.check` recusa o arquivo inteiro. A instalação lê os bytes verificados de `ruleset.json` e recusa o pacote sob uma declaração anterior. Nada muda para trilhas numéricas, saúde em reserva e regras sem gasto em testes.

### Capability API 1.29: o que um turno de combate do conjunto permite

Há cinco adições opcionais ao bloco `combat` e às entradas de catálogo usadas pela luta:

- Um golpe pode carregar até três quantidades A MAIS além da primeira. `mechanics.plus` de uma entrada e `damage.plus` de uma ação de criatura usam `{ dice?, flat?, type?, save?: { save,
difficulty?, onSuccess: "none" | "half" } }`: cada parte é rolada, tipada, dobrada por crítico e submetida a uma salvaguarda separadamente. O golpe inteiro mantém um único teste de concentração e um único teste para cair.
- `combat.attacks[].strikes` referencia um valor que informa quantos ataques um gasto do orçamento dessa lista compra. Os restantes ficam disponíveis até terminar o turno; enquanto houver algum, todas as linhas da lista não custam orçamento.
- `mechanics.free` não gasta orçamento; `mechanics.gives` o devolve apenas neste turno, respeitando o teto de destino; `mechanics.standard` permite comprar ações padrão com outro orçamento. Uma entrada `utility` com `gives` ou `standard` é oferecida em vez de descartada.
- O novo tipo `rider`, e os `riders` da própria criatura, adicionam uma cláusula de dano ao primeiro acerto válido de um turno ou rodada, passivamente e sem aparecer no menu.
- A lista fechada de efeitos de condições adiciona `own-saves-advantage`, `own-saves-disadvantage`, `resist-all`, `cannot-target-source` e `cannot-approach-source`. Uma condição pode restringir as salvaguardas afetadas (`saves`), valer só enquanto sua origem está visível (`whileSourceInSight`) ou terminar quando ela cai (`endsWhenSourceDown`).

```json
{
  "capabilityApi": { "major": 1, "minor": 29 },
  "kind": ["ruleset"],
  "contributions": { "assets": { "paths": ["ruleset.json"] } }
}
```

Não é uma integração opcional, pelo mesmo motivo que 1.20–1.28: um motor que não entende essas chaves recusa o conjunto inteiro ou o catálogo que as contém. A instalação lê os bytes verificados de `ruleset.json` e de cada `catalogs/<id>.json` declarado, e recusa qualquer um sob uma declaração anterior. Nenhuma permissão nova nem mudança para conjuntos que não as declaram.

### Capability API 1.28: combate do conjunto num tabuleiro

O bloco `combat` pode definir quanto vale uma casa em sua própria distância (`distance: { label, perCell }`); isso permite que o combate tenha posições. `ranged` define a penalidade de um disparo além do alcance normal ou com um inimigo na casa vizinha; `cover`, o que a cobertura acrescenta à defesa; `opportunity`, o orçamento que paga um ataque contra quem se afasta. Uma lista de ataques pode dar às linhas `reach` e `range`, lidos de uma coluna ou definidos uma vez para todas; o `range` de uma ação de criatura pode ser `{ "normal": 30, "long": 120 }` em vez de um número.

```json
{
  "capabilityApi": { "major": 1, "minor": 28 },
  "kind": ["ruleset"],
  "contributions": { "assets": { "paths": ["ruleset.json"] } }
}
```

Declarar `ranged`, `cover`, `opportunity` ou alcance de armas SEM `distance` é recusado na importação: nada disso faz sentido sem uma casa para medir. O tabuleiro reutiliza o gerador, terreno e posicionamento inicial do estilo tático existente, sem adicionar outro modelo de campo nem permissão.

Não é uma integração opcional, pelo mesmo motivo que 1.20–1.27: um motor que não entende essas chaves recusa o conjunto inteiro ou o catálogo que contém a criatura com um par como alcance. A instalação lê os bytes verificados de `ruleset.json` e cada `catalogs/<id>.json` declarado e recusa qualquer um sob uma declaração anterior. Nada muda para conjuntos que não definem distância.

### Capability API 1.26: formato de combate

API 1.26 adiciona `combat` para rolagens, alvos, economia de ações, ataques, habilidades, condições, concentração, saúde zero, tipos de dano e escala de inimigos. `mechanics` pode descrever alvos, acertos garantidos, condições, pontos temporários, escalonamento pela ficha e orçamento gasto.

```json
{
  "capabilityApi": { "major": 1, "minor": 26 },
  "kind": ["ruleset"],
  "contributions": { "assets": { "paths": ["ruleset.json"] } }
}
```

### Capability API 1.27: bestiários do conjunto

API 1.27 permite `"holds": "creatures"`. Os blocos usam `combat`: saúde fixa ou rolada no início, defesa, iniciativa, atributos e salvaguardas pelos IDs da ficha, resistências, vulnerabilidades, imunidades, ameaça e características para o GM. Ações podem atacar, exigir salvaguardas, aplicar condições, limitar usos, recarregar por rolagem, encadear ações com um orçamento ou gastar pontos especiais próprios.

```json
{
  "capabilityApi": { "major": 1, "minor": 27 },
  "kind": ["ruleset"],
  "contributions": { "assets": { "paths": ["ruleset.json", "catalogs/beasts.json"] } }
}
```

Um catálogo de criaturas não declara `feeds` nem aparece no seletor de fichas. Com o diretor de combate ativado, um jogo com `combat` usa essas regras e seu bestiário na tela de batalha e salva as fichas após cada ação. Esse é o estilo `ruleset`, sem exigir outro nível de Capability API. Sem `combat`, continuam valendo o bloco `battle` ou a preferência Classic/Tactical. A instalação confere os arquivos verificados `ruleset.json` e `catalogs/<id>.json`: `combat` e as novas chaves de `mechanics` exigem 1.26; `holds` e `creature`, 1.27. Um esquema estrito anterior rejeitaria o arquivo. Não há novas permissões nem mudanças nos conjuntos sem esses campos.

### Capability API 1.18: manter a configuração de Experience no assistente de Game

Um pacote `game-surface` pode declarar `contributions.gameSurface.setup` com a versão 2 do esquema e Capability API 1.18. O Engine mantém as sete etapas habituais de configuração, incluindo **Party** (grupo), objetivos, modelos e lorebooks. Apenas jogos novos oferecem Experiences; reabrir a configuração de um jogo existente preserva sua Experience e a configuração do pacote. Pacotes sem essa declaração mantêm o diálogo de configuração anterior.

```json
{
  "setup": {
    "seed": { "key": "seed", "label": "World seed" },
    "config": { "generate": true, "packWanted": true },
    "requires": { "enableCustomWidgets": false }
  }
}
```

Os três campos são opcionais. A semente declarada aparece abaixo da Experience selecionada com o botão **Randomize** (sortear). Uma entrada vazia ou sem valor numérico finito bloqueia **Start** (iniciar). O host grava a semente numérica e as constantes declaradas em `experienceConfig`; `config` não pode conter a chave da semente. As constantes devem ocupar no máximo 8.000 caracteres após a serialização. O rótulo da semente é texto de exibição escrito pelo pacote; omita-o para usar o rótulo localizado do Engine.

Um requisito declarado de widgets fornece o padrão apenas até o jogador alterar esse controle. Desativar a Experience restaura o padrão habitual, enquanto escolhas explícitas do jogador permanecem intactas. O controle explica o que a Experience espera e continua editável. Os controles de configuração de mapas espaciais ficam ocultos para essas Experiences, portanto nenhum rascunho, modelo ou criador de mapas separado é iniciado.

A etapa **Lorebooks** (lorebooks) permite selecionar até 100 entradas individuais habilitadas, incluindo entradas de livros não anexados. Livros e entradas desabilitados e exclusões do chat são respeitados. Esses IDs são enviados em `GameSetupConfig.activeLorebookEntryIds`. Em `/game/setup`, são entradas forçadas adicionais: ignoram as rolagens de probabilidade, mas mantêm os limites habituais de tokens. O lore global, vinculado a personagens e anexado continua participando da varredura normal. Os pacotes podem ler os mesmos IDs selecionados na configuração para sua própria solicitação de geração do mundo.

A importação de um arquivo de configuração restaura uma Experience instalada e compatível e sua semente numérica válida, mas descarta configurações arbitrárias do pacote. O manifesto atual fornece as constantes novamente. Jogos existentes ignoram importações de Experience com uma explicação. Os snapshots de criação preservam o nome da Experience e a semente para o resumo da configuração.

Use a declaração existente de prontidão para inicialização de forma independente quando o mundo precisar estar preparado antes do primeiro turno. Declare API 1.18 como mínimo do pacote; hosts anteriores não conseguem interpretar essa declaração de configuração.

### Capability API 1.36: conquistas dos pacotes

Um pacote com a nova permissão `achievements` pode adicionar medalhas ao painel **Achievements** (conquistas) da tela inicial, consultar se estão desbloqueadas e desbloqueá-las. O painel as mostra em uma seção com o nome do pacote como título, depois das medalhas do próprio Engine.

```ts
export async function activate({ api }) {
  api.registerAchievements([
    { id: "first_run", title: "First Run", description: "Ran the package once.", iconPath: "art/first-run.png" },
    {
      id: "ten_runs",
      title: "Regular",
      description: "Ran the package ten times.",
      target: 10,
      readProgress: () => runs,
    },
  ]);
  // Later, when the package decides a badge is earned:
  if (await api.runtime.achievements.unlock("first_run")) celebrate();
}
```

Regras que vale a pena conhecer:

- Os IDs usam o espaço de nomes `<packageId>.<id>`. Um ID integrado não contém ponto, então os dois não podem entrar em conflito. O host aceita o ID local ou o que inclui o espaço de nomes e recusa qualquer ID que o próprio pacote não tenha registrado.
- `unlock(id)` resolve com `true` apenas para a chamada que desbloqueou a medalha. `isUnlocked(id)` e `list()` leem o estado; `list()` retorna as medalhas do próprio pacote com o progresso.
- A contagem fica a cargo do pacote. Uma medalha graduada define `target` e um callback `readProgress`: ambos ou nenhum. Engine a desbloqueia na mesma passagem em que verifica suas próprias medalhas graduadas, assim que a contagem atinge a meta. Mantenha o contador no host de persistência. Se um callback lançar uma exceção ou não concluir em **2 segundos**, o valor informado será zero e o problema será registrado. Assim como nas ferramentas, isso limita apenas as esperas assíncronas: o trabalho síncrono que bloqueia o loop de eventos não pode ser interrompido.
- `iconPath` é um caminho dentro do diretório raiz de recursos do pacote, servido pela rota de recursos do pacote. Um card bloqueado continua mostrando o cadeado. Se a imagem não carregar, o card usa `icon` como alternativa (`trophy` por padrão).
- `title` e `description` são os textos exibidos. Um pacote de idioma pode substituí-los por meio de `capabilityAchievements.<packageId>.<id>.title` e `.description`.
- No máximo **32 medalhas por pacote**. Um lote com uma única entrada inválida não registra nada.
- Desativar ou remover o pacote oculta suas medalhas. Os desbloqueios são mantidos, como os das medalhas do próprio Engine, e voltam a aparecer quando o pacote retorna.

`api.registerAchievements` e `api.runtime.achievements` só existem em um Engine desta versão ou de uma versão mais recente, então um pacote que os utiliza declara `capabilityApi` 1.36.

### Capability API 1.34: uma criatura escrita nos termos do conjunto

Uma criatura de bestiário pode conter `sheet`: uma ficha nos termos do conjunto, tão parcial quanto necessário. A luta a constrói como a de um membro do grupo: saúde, defesa, salvaguardas, iniciativa, velocidade e habilidades das listas vêm das declarações do conjunto e são pagas com suas próprias reservas. Ela não declara também `health`, `defense`, `initiativeModifier`, `speed`, `abilities` nem `saves`, e pode não ter ações de bloco próprias:

```json
{
  "capabilityApi": { "major": 1, "minor": 34 },
  "kind": ["ruleset"],
  "contributions": { "assets": { "paths": ["ruleset.json", "catalogs/creatures.json"] } }
}
```

A verificação lê os bytes do conjunto e cada catálogo que a instalação possui, como na 1.27. Uma linha da ficha da criatura pode conter `_catalog: "<catalog>/<entry>"` para uma entrada de catálogo que alimenta essa lista; o motor carrega esses catálogos junto ao bestiário para a luta. Não é uma integração opcional, pelo mesmo motivo que 1.20–1.33: um motor que não entende a chave recusa o catálogo estrito inteiro. O pacote que a inclui declara 1.34. Nenhuma permissão nova.

### Capability API 1.33: o momento que uma reação espera

`mechanics.reaction` de uma entrada pode ser um objeto em vez de `true`. `on` nomeia o momento percebido pelo motor, `at` indica a quem a ação escolhida se dirige e `cancels` impede o que a janela deixou em espera de acontecer:

```json
{
  "capabilityApi": { "major": 1, "minor": 33 },
  "kind": ["ruleset"],
  "contributions": { "assets": { "paths": ["ruleset.json", "catalogs/spells.json"] } }
}
```

`on` é `aimed`, antes de algo atingir o portador, ou `harmed`, depois de ele sofrer dano; declarar um coloca a entrada no menu dessa janela. `at` é `source`, que preenche quem causou o momento, ou `chosen`, que mantém os alvos da entrada. Só uma entrada `aimed` pode `cancel`: não se cancela algo que já aconteceu. O custo de uma ação cancelada continua gasto, pois foi pago antes da pergunta.

Uma entrada que mantém `"reaction": true` só informa que não é usada num turno, o que não basta para oferecê-la numa janela; fica fora de todos os menus e não precisa de versão mais nova. Não é uma integração opcional, pelo mesmo motivo que 1.20–1.32: um motor que não entende o objeto recusa o catálogo estrito inteiro. O pacote que o inclui declara 1.33. Nenhuma permissão nova.

### Capability API 1.32: uma arma que limita seus próprios ataques

Uma fonte de ataques pode declarar `strikesCappedBy`, uma coluna booleana de sua lista. Se estiver ativa numa linha, essa linha compra um único ataque, independentemente de quantos `strikes` compra para a lista. Assim, uma arma que dispara uma vez por turno mantém esse limite enquanto o restante ataca tantas vezes quanto a ficha determina. Isso corresponde à propriedade Loading do SRD 5.1: "you can fire only one piece of ammunition when you use an action, bonus action, or reaction to fire it, regardless of the number of attacks you can normally make."

```json
{
  "capabilityApi": { "major": 1, "minor": 32 },
  "kind": ["ruleset"],
  "contributions": { "assets": { "paths": ["ruleset.json"] } }
}
```

Exige `strikes` e é recusado sem ele, pois uma lista que compra um ataque por gasto já limita cada linha a um. Não é uma integração opcional, pelo mesmo motivo que 1.20–1.31: um motor que não entende a chave recusa o arquivo de regras inteiro. O pacote que a inclui declara 1.32. Nenhuma permissão nova.

### Capability API 1.31: integrações de geração do host

Pacotes do servidor podem usar `api.runtime.integrations` para acessar os serviços atuais do motor de LLM, imagens e vídeo. Declare API de capacidades 1.31 no manifesto e verifique a disponibilidade do host de integração durante a ativação. Motores antigos recusam o requisito API antes de ativar. Operações com provedores exigem `network`; salvar, preparar e remover mídia exige `storage`.

- `llm.createProvider(...)` aceita as configurações de conexão da fábrica do motor, incluindo parâmetros de solicitação e cabeçalhos personalizados. O provedor tem suporte a `chat`, `chatComplete`, `embed`, `maxContextValue` e `maxTokensOverrideValue`. Não expõe propriedades de credenciais.
- `llm.localSidecar()` retorna o provedor sidecar local do host pela mesma fachada.
- `llm.withFallback(...)` envolve um provedor criado pelo mesmo host do pacote. Preserva a admissão, as notificações de fallback e a seleção de provedor do motor.
- `images.generate(...)` e `videos.generate(...)` usam as implementações ativas do motor, incluindo cancelamento, registro de solicitações, verificações de rede e filas de mídia. Encaminhe o `signal` e o `debugMode` da interface do chamador quando existirem.
- `images.save`, `images.remove`, `images.stage` e `images.sweepStaged` reutilizam as escritas seguras e o ciclo de arquivos preparados da galeria. `videos.save` e `videos.remove` reutilizam o caminho de armazenamento de vídeo. `images.resolveNovelAiRequestSize` reutiliza a normalização de tamanho NovelAI do host. Duração de vídeo e normalização de envio público de referências estão disponíveis em `videos.resolveDuration` e `videos.resolveReferenceUpload`.

`@marinara-engine/shared` exporta os tipos compartilhados de solicitação e resultado. Mantenha a construção de prompts e a orquestração específicas no pacote; use esses pontos do host para E/S de provedores em vez de copiar os serviços do motor. Tipos e auxiliares puros ainda podem ser incluídos no pacote.
