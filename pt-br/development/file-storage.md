# Armazenamento nativo em arquivos

Este guia explica a arquitetura de persistência local do Marinara Engine. Para ver a organização das pastas do ponto de vista do usuário, veja [Onde Marinara salva os seus dados](../data/where-data-is-stored.md).

## Fonte da verdade

Marinara salva as linhas do aplicativo como snapshots JSON dentro da pasta `DATA_DIR/storage`:

```text
storage/
├── manifest.json
└── tables/
    ├── chats.json
    ├── characters.json
    ├── messages/
    │   ├── <encoded-chat-id>.json
    │   └── ...
    ├── message_swipes/
    │   └── <encoded-chat-id>.json
    └── ...
```

A variável `FILE_STORAGE_DIR` permite trocar a pasta `storage` por outra. Cada arquivo de tabela contém um array JSON. O arquivo `manifest.json` registra a versão do formato de armazenamento, a hora em que os dados foram salvos, o identificador do backend e a contagem de linhas de cada tabela registrada.

### Tabelas fragmentadas

As tabelas vinculadas a chats que recebem gravações a cada turno são armazenadas como **um arquivo por chat**, em vez de um único arquivo grande. Em um arquivo monolítico, cada linha salva serializaria e regravaria todo o histórico de todos os chats. O formato de armazenamento 3 fragmentou `messages` e `message_swipes`; o formato 4 estende o mesmo layout a `memory_chunks`, `chat_images`, `agent_runs`, `agent_memory`, `conversation_call_sessions`, `conversation_call_messages`, `game_state_snapshots`, `game_engine_state`, `game_checkpoints`, `game_turn_storyboards`, `game_scene_videos`, `spatial_context_snapshots`, `ooc_influences` e `conversation_notes`. A lista oficial é `SHARDED_TABLES` em `file-backed-store.ts`, espelhada pelo comando offline `unshard` em `scripts/protect-launcher-data.mjs`; um teste de regressão mantém as duas listas em sintonia. Cada tabela resolve seu fragmento pela própria coluna `chatId`, com duas exceções: `message_swipes` passa pela mensagem pai, e influências e notas usam `targetChatId`. `lorebooks` e `game_turn_storyboard_keyframes` permanecem monolíticas de propósito.

O rastreamento de alterações funciona por arquivo de chat, então uma descarga só toca nos chats modificados. Um fragmento cuja contagem de linhas chega a zero é apagado, em vez de ser gravado como uma matriz vazia. Os nomes de arquivo são codificados em porcentagem a partir do id do chat, com alternativas por hash para nomes longos demais ou reservados. Essa codificação é um limite de segurança, pois perfis importados podem conter ids arbitrários. Os arquivos são apenas contêineres; as linhas mantêm suas próprias chaves.

Na primeira inicialização de uma compilação com tabelas recém-fragmentadas, os arquivos monolíticos existentes migram automaticamente: as linhas são agrupadas por chat e gravadas em fragmentos; depois, o arquivo monolítico **e seu `.bak`** são renomeados para `.pre-shard`. Esses arquivos são o backup automático anterior à migração e o Engine nunca os apaga. Um marcador `.migrating` torna a recuperação após falha determinística. Se uma compilação antiga recriar depois um arquivo monolítico ao lado dos fragmentos, os fragmentos prevalecem e o arquivo conflitante é isolado com um sufixo `.post-downgrade-` com data e hora, sem jamais ser mesclado. Linhas filhas órfãs vão para o fragmento `orphaned-rows` em vez de serem descartadas. Um manifesto escrito por um formato de armazenamento mais novo se recusa a carregar.

## Modelo de execução

O arquivo `packages/server/src/db/file-backed-store.ts` carrega os snapshots das tabelas na memória durante a inicialização. O servidor lê e altera essas linhas pelas operações nativas de arquivo que o arquivo `db/file-query.ts` expõe. O arquivo `db/file-schema.ts` fornece metadados de tabela e de coluna à prova de colisão para as definições da pasta `db/schema/`.

A API fluente de `select`, `insert`, `update` e `delete` mantém os serviços de armazenamento enxutos, sem depender de um banco de dados externo nem de um ORM. Os filtros e as ordenações com suporte são objetos de expressão explícitos. Assim, a camada de armazenamento nunca faz parsing de strings de consulta.

As tabelas declaram chaves naturais com `fileTable(..., { uniqueBy: [...] })`. As inserções e as atualizações validam as chaves primárias e as chaves naturais declaradas contra a mudança candidata completa antes de alterar as linhas em memória. Se alguma restrição falhar, a tabela fica intacta. Uma regra pode incluir um predicado `when` quando a unicidade vale só para parte das linhas.

Os capability packages baixados podem trazer as próprias instâncias de tabela de arquivo. A camada de armazenamento resolve essas instâncias pelo nome de tabela registrado, depois de verificar a identidade dos objetos. Com isso, o código de armazenamento de um pacote usa as tabelas do Engine com segurança.

## Persistência e recuperação

As escritas marcam como sujas as tabelas afetadas. Um debounce curto agrupa as mudanças próximas, e um timer de segurança salva periodicamente o que ficou pendente. No desligamento controlado, Marinara espera as escritas ativas terminarem e depois persiste as linhas que mudaram durante essa escrita.

Marinara escreve cada snapshot em um arquivo temporário, força a gravação em disco e renomeia o arquivo de forma atômica. Antes da substituição, o snapshot íntegro anterior é atualizado como um arquivo `.bak`. Na inicialização, se o arquivo principal estiver ilegível, Marinara o recupera a partir do backup sempre que possível. Se nenhuma das duas cópias servir, Marinara põe os arquivos corrompidos em quarentena com um sufixo de data e hora e inicia vazia apenas aquela tabela, para que a interface continue acessível e a recuperação seja possível.

## Transações

As transações usam snapshots copy-on-write delimitados por `AsyncLocalStorage`. A tabela só é clonada quando a transação a altera pela primeira vez. Se o callback lançar um erro, apenas as tabelas alteradas por aquela transação são restauradas; as escritas concorrentes de outras partes continuam valendo.

## Como adicionar uma tabela

Ao adicionar dados persistentes:

1. Defina a tabela em `packages/server/src/db/schema/` com `fileTable` e os construtores de coluna nativos de arquivo.
2. Exporte a tabela no arquivo `db/schema/index.ts`.
3. Declare as chaves naturais com a opção de tabela `uniqueBy`.
4. Registre o nome da tabela em `FILE_BACKED_TABLES`.
5. Defina as relações em cascata ou de set-null no arquivo `file-backed-store.ts` quando for necessário.
6. Inclua os metadados de coluna JSON no arquivo `services/mari-db/mari-db.service.ts` quando um campo de texto contiver JSON estruturado.
7. Confirme o comportamento de backup e de restauração do perfil.
8. Execute `pnpm check` e as regressões de armazenamento relevantes.

Mantenha as definições de tabela, os metadados de relação, a portabilidade do perfil e a validação do Mari DB alinhados na mesma alteração.
