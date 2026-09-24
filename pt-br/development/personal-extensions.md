# Arquitetura das Personal Extensions

As Personal Extensions vêm desativadas por padrão. São código aprovado por hash, com dois ambientes de execução isolados. Por padrão, só existe uma classe de extensão disponível: os rascunhos criados pela Professor Mari. Qualquer outra origem conta como External Extension e exige duas autorizações independentes do operador.

## Invariantes de segurança

Estas propriedades precisam continuar valendo:

1. Criar ou importar sempre gera um rascunho desativado e sem aprovação.
2. A aprovação exige o hash de conteúdo `sha256:` exato e atual, mais um reconhecimento explícito de que o código será executado. O acesso completo à página exige ainda outro reconhecimento explícito.
3. Qualquer mudança no código executável desativa a extensão e limpa o `approvedHash`.
4. A reversão restaura um rascunho desativado.
5. O backup e a importação de perfil limpam a aprovação e o estado de ativação.
6. A Professor Mari pode criar e atualizar rascunhos, mas não tem nenhuma ação que os aprove ou ative.
7. Toda origem diferente de `professor_mari` é externa, incluindo `external`, `local`, `legacy`, `profile_import` e valores desconhecidos, que são normalizados para `legacy`.
8. Registros externos não aparecem nas respostas de gerenciamento nem de execução, a menos que `ENABLE_EXTERNAL_EXTENSIONS=true` e a permissão salva na seção **Danger Zone** (zona de perigo) também esteja marcada.
9. Fechar qualquer uma das duas autorizações desativa os registros externos armazenados e encerra os processos ativos no servidor. A verificação periódica do ambiente do navegador remove os workers ativos no navegador.
10. Código de navegador em sandbox nunca é executado no documento do Marinara. Só uma Browser Extension externa com `full_page_access` aprovado por hash exato pode usar o ambiente de página separado. Código de servidor nunca é executado no processo do servidor do Marinara.
11. Não existe instalador por URL, catálogo remoto nem atualizador automático.
12. As contribuições ao host são descritores simples e validados. Marcação, estilos, URLs, componentes e callbacks da extensão nunca entram na árvore React do Marinara.
13. O registro, a ativação, os eventos, as atualizações e a remoção de contribuições continuam presos ao hash de conteúdo exato e aprovado da extensão ativada.
14. Os snapshots de contexto do navegador trazem, na base, apenas o ID do chat ativo e os IDs dos personagens. As permissões opcionais `read_active_characters` e `read_active_persona` podem acrescentar campos delimitados, que passam por lista de permissões, vindos só dos registros ativos naquele chat. Elas nunca expõem mensagens, bibliotecas inteiras, campos não declarados, metadados nem acesso ao aplicativo.
15. As permissões solicitadas fazem parte do hash executável. Qualquer mudança de permissão desativa a extensão e exige uma nova aprovação por hash exato.
16. A permissão `full_page_access` é exclusiva de extensões externas, exige as duas autorizações de External Extension e nunca fica disponível para os rascunhos da Professor Mari. Ela é um modo de confiança explícito, não uma promessa de sandbox.

As autorizações são aplicadas nas rotas e nos serviços de execução. Esconder controles não é uma barreira de segurança. Um registro externo adicionado manualmente, restaurado, herdado de versões antigas ou vindo por fora precisa continuar invisível e inexecutável enquanto qualquer uma das duas autorizações estiver fechada.

## Armazenamento e política

A tabela de arquivos `installed_extensions` guarda os metadados, o código executável, o `contentHash`, o `approvedHash`, a origem e até dez revisões anteriores do código executável. As configurações privadas de cada extensão usam chaves de `app_settings` com o prefixo `extension-storage:`. A permissão da seção **Danger Zone** usa `external-extensions-enabled`.

Na inicialização, Marinara executa `preparePersonalExtensionTrust`. Uma linha antiga sem hash é mantida, mas fica desativada e sem aprovação. Uma linha cujo hash armazenado não corresponde mais aos campos executáveis também é desativada e recebe uma nova impressão digital.

O arquivo `personal-extension-policy.service.ts` combina a autorização ativa do arquivo `.env` com a permissão salva pelo usuário. O arquivo `personal-extension-storage.service.ts` consegue desativar todos os registros que não sejam da Professor Mari. O monitor do arquivo `.env` reaplica a política em cerca de dois segundos e pede que o servidor pare o código quando a autorização é fechada.

## API

A superfície de gerenciamento fica em `/api/personal-extensions`:

- `GET /policy` retorna o estado das duas autorizações e a disponibilidade da sandbox no servidor.
- `PATCH /policy/external` altera a permissão da seção **Danger Zone** e recusa o valor `true` enquanto a autorização do arquivo `.env` estiver fechada.
- `GET /` lista os rascunhos da Professor Mari e, apenas com as duas autorizações abertas, também os rascunhos externos.
- `POST /` importa uma External Extension e é rejeitado se as duas autorizações não estiverem abertas.
- `PATCH /:id` edita ou desativa um rascunho.
- `POST /:id/approve` aprova o hash exato e atual, aplica a autorização externa e recusa a aprovação de código de servidor sem uma sandbox de sistema operacional compatível.
- `POST /:id/rollback` restaura uma revisão anterior desativada.
- `DELETE /:id` exclui a extensão e as configurações privadas dela.

Os metadados do ambiente de navegador aprovado são lidos em `GET /runtime/client`. O código em sandbox é servido por `GET /:id/sandbox.html?hash=...`. O código e o CSS de página completa são servidos por `GET /:id/page-runtime.js?hash=...` e `GET /:id/page-style.css?hash=...`. Todas as rotas exigem que o hash exato continue ativado, aprovado e permitido pela política; as rotas de página exigem ainda uma origem externa e a permissão `full_page_access`.

## Ambiente de execução em sandbox no navegador

O arquivo `PersonalExtensionInjector.tsx` cria um iframe oculto com `sandbox="allow-scripts"` e sem `allow-same-origin`. Com isso, o iframe tem origem opaca e não consegue acessar o DOM, os cookies, o armazenamento nem as APIs de mesma origem do Marinara.

A resposta da sandbox troca a política normal da página por uma CSP restrita: nenhum recurso padrão, nenhuma conexão, nenhum formulário, nenhum objeto e nenhuma autoridade de navegação. O CSS da extensão fica dentro do iframe oculto. O JavaScript roda em um Worker dedicado, criado pelo bootstrap confiável do iframe. Os globais de rede e de workers aninhados são removidos como camada extra de defesa.

O worker recebe apenas:

- log com namespace próprio;
- armazenamento privado da extensão, intermediado pelo pai;
- temporizadores gerenciados;
- registro de limpeza;
- identificadores somente leitura do chat ativo e dos personagens, através de `marinara.context`;
- campos delimitados dos cards de personagem ativos e da persona selecionada, apenas através de capacidades aprovadas separadamente;
- uma janela de iframe restrita, através de `marinara.ui.showWindow(...)`;
- espaços confiáveis de contribuição ao host, através de `marinara.ui.registerContribution(...)`.

A versão 5 da API de Browser Extension acrescenta `marinara.context.get()` e `marinara.context.subscribe(listener)`. O snapshot é imutável e tem este formato:

```ts
{
  chatId: string | null;
  characterId: string | null;
  characterIds: readonly string[];
  personaId: string | null;
  characters: readonly PersonalExtensionCharacterSnapshot[];
  persona: PersonalExtensionPersonaSnapshot | null;
}
```

O cliente monta o snapshot a partir da store `useChatStore` e o envia quando muda o chat ativo, a lista de personagens dele ou a persona selecionada. Os IDs são strings não vazias, com no máximo 256 caracteres; a lista de personagens é deduplicada e limitada a 256 entradas. O iframe só aceita uma atualização de contexto vinda do pai e apenas quando o `contentHash` dele corresponde à revisão exata da extensão; depois disso, o Worker normaliza e congela a carga de novo. A inicialização da extensão espera pelo primeiro snapshot do host, com um recurso alternativo de contexto nulo após um segundo, para que uma ponte com falha não trave o Worker para sempre.

O campo `characterId` é uma conveniência para chats individuais e continua `null` em chats em grupo; o campo `characterIds` traz todos os participantes ativos. O campo `personaId` só fica disponível com a permissão `read_active_persona`. Sem chat ativo, os campos `chatId`, `characterId`, `personaId` e `persona` ficam `null`, enquanto `characterIds` e `characters` ficam vazios. As extensões podem usar os identificadores com segurança como chaves no próprio armazenamento privado.

A permissão `read_active_characters` deixa o campo `characters` conter apenas os valores `id`, `name`, `description`, `personality`, `scenario`, `firstMessage`, `exampleDialogue`, `creator`, `characterVersion`, `tags`, `backstory`, `appearance`, `aboutMe` e `conversationDisplayName` dos cards ativos. A permissão `read_active_persona` deixa o campo `persona` conter apenas `id`, `name`, `description`, `personality`, `scenario`, `backstory`, `appearance`, `tags`, `aboutMe` e `conversationDisplayName`. O servidor monta os dois conjuntos a partir do chat ativo, aplica limites por campo e no total, e nunca aceita um ID de registro enviado pelo cliente como prova de escopo.

As capacidades são declaradas na carga da extensão, salvas em toda revisão, exibidas na seção **Settings** (Configurações) e na caixa de diálogo de aprovação, e incluídas no hash executável. O host envia primeiro o snapshot só com IDs e depois o enriquece através do intermediário aprovado para aquela extensão. O Worker, por conta própria, descarta registros não declarados, recusa registros de personagem cujos IDs não estejam em `characterIds`, aplica os limites de novo e congela o resultado.

A chamada `marinara.ui.showWindow({ title, elements, onEvent, onClose })` devolve um handle com `update({ title?, elements? })` e `close()`. O worker só envia descritores; o bootstrap confiável do iframe monta cada elemento com APIs de DOM e `textContent` (nunca `innerHTML`). O host revela o iframe da sandbox, normalmente oculto, apenas enquanto uma janela está aberta, e volta a escondê-lo quando ela fecha.

`marinara.ui.registerContribution({ id, kind, label, description?, icon?, surface?, position?, elements?, onActivate?, onEvent? })` retorna um identificador congelado com `update(patch)` e `remove()`. Tem suporte a estes locais confiáveis do host:

- `button`: uma ação compacta na barra superior por padrão, ou uma ação renderizada pelo host na superfície `chats`, `bots`, `characters`, `personas`, `lorebooks`, `presets`, `connections`, `agents` ou `settings`;
- `menu-item`: uma ação no menu **Extensions**;
- `panel`: um item que abre o painel lateral confiável **Extensions** do Marinara.

Botões do painel lateral aceitam `position: "header"`, `"before-content"` ou `"after-content"`. Botões da barra superior omitem `position`. Os ícones são nomes kebab-case limitados do catálogo Lucide do Marinara; nomes sem suporte usam o ícone de quebra-cabeça.

Os elementos do painel usam o mesmo vocabulário declarativo das janelas restritas: `heading`, `text`, `pre`, `button`, `input`, `select`, `toggle`, `slider`, `color` e `spacer`. Controles interativos precisam de IDs únicos. Um botão do painel envia `{ contributionId, elementId, values }` para `onEvent`; o campo `values` traz o valor de texto atual de cada controle. O `onActivate` roda dentro do Worker da extensão quando o usuário abre ou aciona a contribuição. Depois de uma mudança de estado, a extensão pode chamar `handle.update(...)` para trocar o próprio rótulo, a descrição, o ícone ou os elementos do painel.

O cliente valida cada descritor por conta própria antes de adicioná-lo ao armazenamento de execução. Tipos de contribuição, superfícies, posições, controles, IDs, listas de opções, sintaxe dos nomes de ícones, comprimentos de texto, texto total do painel, quantidade de elementos e quantidade de contribuições por extensão são validados e limitados. React renderiza o texto da extensão como texto. Nenhum HTML, CSS, URL, componente React ou callback do host controlado pela extensão é aceito. O host remove todas as contribuições quando o worker é encerrado, quando o hash dele muda ou quando ele some da resposta de execução aprovada. Os eventos só são entregues ao worker registrado com o mesmo ID de extensão e o mesmo hash de conteúdo.

Não existe auxiliar de DOM, requisição à API do Marinara, acesso a eventos do pai nem capacidade de rede arbitrária. O iframe valida as mensagens e limita a frequência delas. Um watchdog de heartbeat encerra o worker que não responde ou que entra em laço infinito.

## Ambiente de compatibilidade de página completa

O protocolo de contribuições continua sendo o caminho preferido para ferramentas cheias de configurações e para fluxos com várias etapas. Uma extensão complexa pode substituir os elementos de um painel aos poucos e manter o próprio estado no armazenamento privado da extensão.

Pacotes antigos que inserem botões usando seletores do host, percorrem as estruturas internas do React, escrevem sobreposições arbitrárias ou chamam rotas `/api` de mesma origem não funcionam sem alterações no ambiente seguro. Prefira fazer a portabilidade deles para descritores de contribuição e capacidades intermediárias restritas.

Quando a compatibilidade realmente exigir a página do host, uma External Extension pode solicitar a permissão `full_page_access`. O arquivo `PersonalExtensionInjector.tsx` carrega aquela revisão aprovada exata através de um elemento de script de mesma origem e de uma folha de estilo opcional. O código roda dentro de uma função assíncrona, com um pequeno objeto `marinara` de compatibilidade para identidade, log, armazenamento privado, temporizadores gerenciados e registro de limpeza. Os globais da página continuam disponíveis, porque é exatamente essa a autoridade solicitada.

O carregador de página confere o `id`, o nome e o hash de conteúdo contra os metadados de execução antes de invocar o código. O servidor verifica separadamente o hash exato, o estado de ativação, a origem externa, a permissão e a política das duas autorizações a cada requisição de script ou de folha de estilo. Fechar uma autorização desativa o registro; a verificação periódica remove então os nós inseridos e faz uma limpeza de melhor esforço. Isso não desfaz os efeitos colaterais arbitrários que o código de página com confiança total já criou, então o fluxo mostrado ao usuário avisa que pode ser necessário recarregar a página.

Importações antigas com `kind: "marinara.extension"` e sem declaração explícita de `capabilities` recebem a permissão `full_page_access`. As exportações modernas sempre gravam o campo de capacidades, mesmo vazio, para que pacotes seguros não sejam reclassificados ao serem importados de novo.

## Ambiente de execução no servidor

O código de servidor roda em um processo Node separado, nunca por importação dentro do processo. O modelo de permissões do Node nega o acesso ao sistema de arquivos, à rede, a processos filhos, a workers, a complementos nativos, ao WASI e ao inspetor. O processo filho também roda dentro de:

- Seatbelt no macOS; ou
- Bubblewrap no Linux, com namespaces separados de PID, rede, IPC e montagem.

A sandbox recebe um ambiente mínimo, um heap pequeno do V8, nenhum arquivo do aplicativo, nenhum segredo do servidor e arquivos de protocolo delimitados por linha, com tamanho limitado, dentro da pasta temporária privada dela. Ela recebe apenas log, armazenamento privado da extensão, temporizadores gerenciados e registro de limpeza. Cotas de mensagens e um arquivo de heartbeat separado contêm o excesso de tráfego no protocolo e os laços infinitos.

As permissões do Node e o `node:vm` são camadas extras de defesa, não a barreira de segurança. A sandbox separada do sistema operacional é obrigatória. Windows, Android, Linux sem o `bwrap` e qualquer outra plataforma sem suporte recusam a ativação de extensões de servidor.

## Validação

Execute:

```bash
pnpm check
pnpm regression:extensions-security
pnpm regression:professor-mari-shell-sandbox
pnpm smoke:ui
```

A regressão de segurança precisa comprovar a autorização em duas etapas, a invalidação por hash exato, o formato de worker com origem opaca, os snapshots de contexto delimitados e presos ao hash, a validação e a limpeza das contribuições ao host, o roteamento de página completa exclusivo para extensões externas e o respectivo reconhecimento, a classificação dos pacotes antigos, a limpeza do ambiente, a negação de sistema de arquivos e rede, o armazenamento privado e a disponibilidade da sandbox com falha segura.
