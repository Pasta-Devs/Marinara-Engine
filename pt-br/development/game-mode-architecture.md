# Arquitetura de Game Mode: conjuntos de regras, testes e combate

Este é o mapa para quem vai alterar o código de regras de Game Mode: onde um conjunto de regras é lido, como um teste e uma luta são resolvidos, onde o estado é mantido e do que uma nova chave de conjunto de regras precisa. A documentação para jogadores está em `docs/game/`, o guia para autores de conjuntos de regras começa em [`docs/extending/writing-rulesets.md`](../extending/writing-rulesets.md), e a IA de combate tem sua própria página, [IA de combate de Game Mode](game-combat-ai.md).

## Onde cada coisa fica

| Área | Código |
| --- | --- |
| O formato do conjunto de regras | `packages/shared/src/schemas/ruleset.schema.ts`: o esquema zod, `RulesetRef` (o vínculo) e as verificações cruzadas executadas por uma importação. O JSON Schema do editor, `docs/extending/ruleset.schema.json`, é gerado a partir dele com `pnpm ruleset:schema`. |
| Capability API | `supportedCapabilityApi` em `packages/shared/src/schemas/capability-package.schema.ts`, com uma linha de comentário por versão secundária dizendo o que ela acrescentou. |
| Cálculos da ficha e estado vivo | `packages/shared/src/features/rulesets/`: `sheet-math.ts`, `live-state.ts` (as operações `[sheet:]`), `sheet-commands.ts`, `sheet-builder.ts`, `layers.ts`, `item-*.ts`, `loot.ts`, `market.ts`, `combat-bridge.ts` (o bloco `battle`). |
| Lutas de conjunto de regras | `packages/shared/src/features/ruleset-combat/`: `resolve.ts`, `options.ts` (o que está no menu), `grid.ts`, `sight.ts`, `zones.ts`, `creatures.ts`, `pool.ts`, `symbols.ts`, `dice.ts`. Todas são funções puras sobre `(definition, state)`. |
| Combate do próprio Marinara | `packages/shared/src/features/tactical-combat/` (motor Tactical, geração da grade, IA), `combat-director.ts`, `combat-conditions.ts`. |
| IA de combate | `packages/shared/src/features/combat-ai.ts`, `combat-minds.ts`; veja [IA de combate de Game Mode](game-combat-ai.md). |
| Servidor: conjuntos de regras | `packages/server/src/services/game/ruleset-registry.service.ts` (lê conjuntos de regras instalados e importados, resolve o vínculo de um jogo), `ruleset-catalog.service.ts`, `ruleset-sheet-turn.service.ts` (aplica os comandos `[sheet:]` de um turno), `game-ruleset-version.service.ts`, `routes/game-rulesets.routes.ts`. |
| Servidor: testes e dados | `skill-check-resolution.service.ts`, `skill-check.service.ts`, `dice.service.ts`, `dice-pool.service.ts`, `one-request-dice.ts`, `dice-rng.ts`. |
| Servidor: lutas | `combat-director.service.ts` (Classic e Tactical), `combat.service.ts` (os cálculos de rodada de Classic, `resolveCombatRound`), `ruleset-combat-director.service.ts` (uma luta resolvida pelo conjunto de regras), `combat-ai.service.ts`, `combat-boss.service.ts`, `tactical-battlefield.service.ts`, `made-battlefield.service.ts`. Rotas: `routes/combat-director.routes.ts` (início, estado e comando do diretor), `routes/encounter.routes.ts`, e as mais antigas `POST /game/combat/round`, `/game/combat/tactical/start` e `/game/combat/tactical/action` em `routes/game.routes.ts`. |
| Prompt | `gm-prompts.ts` (`buildGmFormatReminder`, os blocos da ficha e as marcações ensinadas). |
| Cliente | `packages/client/src/components/game/`: `GameRulesetSheet.tsx`, `GameSetupRulesChooser.tsx`, `RulesetCombatScreen.tsx` e os demais `RulesetCombat*.tsx`, `TacticalCombatUI.tsx`, `GameCombatUI.tsx`, `DirectedCombatUI.tsx`. |

## Um conjunto de regras, do pacote ao jogo

1. **Origem.** Um conjunto de regras oficial é um pacote de capacidades do tipo `ruleset` que lista `ruleset.json` (e quaisquer `catalogs/<id>.json`) em `contributions.assets.paths`, fixados por hash em `files[]`. Um conjunto de regras da comunidade é importado como um único arquivo, um arquivo de pacote `<name>.ruleset.json`, ou da pasta `rulesets/` de um repositório, e é armazenado sob um ID com namespace (`local/<id>`, `<owner>/<id>`), de modo que nunca possa se sobrepor a um oficial.
2. **Idioma.** As traduções de um conjunto de regras oficial são pacotes por idioma listados na entrada dele no catálogo; o gerenciador de pacotes mantém apenas o idioma do Engine (`syncRulesetLocalePack` em `package-manager.service.ts`). Um arquivo de pacote importado mantém apenas o idioma ativo no momento da importação.
3. **Registro.** `ruleset-registry.service.ts` analisa cada definição com o esquema compartilhado e descarta uma inutilizável com uma linha de registro. As definições são armazenadas por ID e versão; a mesma versão com bytes diferentes é recusada.
4. **O vínculo.** A criação do jogo escreve `chat.metadata.gameRuleset` uma vez: `{ id, version, packageId, source?, options }`, em que `options` contém as camadas escolhidas. Sem vínculo, valem as regras do próprio Marinara. Um vínculo que esta instalação não consegue honrar (o conjunto de regras está ausente ou a versão instalada é mais antiga que a fixada) é informado e os testes do jogo continuam pendentes; nunca se resolve isso pelas regras de outro sistema.

## Estado

| Parte | Conteúdo | Onde | Retrocede com swipes |
| --- | --- | --- | --- |
| Configuração inicial | A ficha que um jogador preenche em um card ou persona | No card, `data.extensions.rulesetSheets[rulesetId]`; na persona, `personaStats.rulesetSheets[rulesetId]` | Não se aplica |
| Configuração do jogo | Uma cópia feita na configuração, editada por **Edit sheet** (editar a ficha) e subidas de nível | `chat.metadata.gameCharacterCards[].rulesetSheet` | Não |
| Estado vivo | Reservas, trilhas, condições, estados, notas | `game_state_snapshots.ruleset_live` | Sim |
| Uma luta | O encontro, sua semente e cursor de dados, de quem é o turno | A linha de armazenamento do diretor de combate, uma por chat | Restaurada com o turno que a iniciou |

O estado vivo pertence ao instantâneo para que um turno regenerado nunca gaste duas vezes. Uma ficha armazenada é `{ v, build }`, limitada a 64 KB e lida com tolerância: campos desconhecidos são mantidos e os ausentes recebem os valores padrão. Um layout que move valores para novos IDs declara `sheet.migrations`, aplicadas na leitura por `readRulesetSheetEnvelope` e `readStoredLiveState`. Uma ficha de um conjunto de regras que não está instalado é mantida inativa, nunca descartada.

## Um teste, do início ao fim

1. O Game Master escreve `[skill_check: …]`, opcionalmente com `who=`, `with=`, o nome de uma etapa da escala, um encanto ou um gasto. Com os dados em uma única requisição ativados, ele pode escrever um bloco de ramificação ou um marcador `[[roll: …]]` em vez disso (`one-request-dice.ts`).
2. `skill-check-resolution.service.ts` lê o conjunto de regras fixado e encaminha conforme `resolution.kind`: `dice-sum`, `dice-pool`, `dice-highest`, `roll-against` ou `symbol-pool`. Os números escritos pelo modelo são auditados e substituídos, a menos que o conjunto de regras os ateste; reservas, dados mantidos e resultados por faixas nunca são atestados.
3. Dados: um teste rola com `rollDieSecurely` (Web Crypto, em `packages/shared/src/utils/dice-notation.ts`). Uma luta de conjunto de regras, seus usos de itens, saques e mercados rolam com `seededDieRoller(seed, cursor)` do mesmo módulo, de modo que uma luta possa ser reproduzida a partir da semente. Desde #8608 não há outro rolador.
4. O resultado é escrito de volta como uma marcação completa e um cartão de dados, e registrado em **Logs** (registros).

## Comandos da ficha

O Game Master altera uma ficha com `[sheet: who="Name" op="…"]`. As operações que uma marcação pode indicar são `spend`, `restore` (alias `heal`), `damage`, `temp`, `track`, `condition`, `state`, `note`, `rest`, `use` (alias `cast`), `pass`, `advance`, `dismiss`, `prepare` e `unprepare` (`RULESET_SHEET_OP_NAMES` e `RulesetSheetOp` em `live-state.ts`). `ruleset-sheet-turn.service.ts` valida cada uma em relação à ficha viva; uma que não possa acontecer, como uma conjuração sem espaço restante, é recusada, registrada e exibida uma vez por turno, e nada é aplicado pela metade. `sheet` é uma marcação reservada do GM.

## Uma luta, do início ao fim

Uma luta do jogo é disputada em um de três estilos, escolhidos pelo conjunto de regras e pela **Combat Preference** (Preferência de combate) do jogo:

| Conjunto de regras | Estilo | Servidor |
| --- | --- | --- |
| Nenhum, ou sem bloco `battle`/`combat` | Combate Classic ou Tactical do Marinara | `combat-director.service.ts` |
| Bloco `battle` | Combate do Marinara, que recebe as reservas, espaços e perícias de catálogo da ficha; a saúde é transferida como proporção do máximo e escrita de volta | `combat-director.service.ts` com `combat-bridge.ts` |
| Bloco `combat` | A luta do próprio conjunto de regras, em um tabuleiro quando `combat` fornece a distância de um quadrado e o jogo é Tactical | `ruleset-combat-director.service.ts` |

Os três compartilham o registro do diretor: uma linha de armazenamento por chat, uma revisão, uma proteção por ID de requisição e uma fila por chat. O registro cobre apenas lutas gerenciadas pelo diretor. As rotas mais antigas em `game.routes.ts`, `POST /game/combat/round` (que chama `resolveCombatRound` com os combatentes que recebe), `/game/combat/tactical/start` e `/game/combat/tactical/action`, não mantêm registro: o cliente guarda o estado da luta e o envia de volta a cada chamada. Em uma luta de conjunto de regras, o menu decide a legalidade (`options.ts`), o resolutor aplica uma escolha (`resolve.ts`), os dados vêm da semente e do cursor da luta, e tudo que um membro da equipe gasta ou perde é escrito pelas próprias regras da ficha, de modo que fechar a aba no meio da luta não cause perda alguma. Oponentes que ninguém criou são construídos a partir do bestiário e do orçamento de encontro do conjunto de regras; o Game Master pode jogar com oponentes nomeados e chefes, escolhendo entre as sugestões ordenadas do Engine.

## Acrescentar uma chave de conjunto de regras

1. Acrescente-a a `ruleset.schema.ts`, com suas verificações cruzadas, e aos tipos TypeScript que o resolutor lê.
2. Aumente `supportedCapabilityApi` em uma versão secundária e acrescente sua linha de comentário. Restrinja a chave de modo que um conjunto de regras que a use precise declarar essa versão secundária ou uma mais nova.
3. Implemente-a primeiro no código puro compartilhado, depois conecte o servidor e, em seguida, o cliente.
4. Execute `pnpm ruleset:schema` para gerar novamente `docs/extending/ruleset.schema.json`.
5. Documente-a na página correspondente do guia para autores (`docs/extending/ruleset-*.md`) e na documentação para jogadores se eles forem vê-la.
6. Acrescente um `scripts/regressions/*.regression.ts` que a exercite pelo código puro, incluindo uma entrada recusada.
7. Liste as páginas em inglês alteradas na issue `[docs-i18n]` aberta.

`docs/development/ruleset-5e-2014.example.json` é um rascunho reduzido de 5e que centenas de regressões e testes de ponta a ponta leem como massa de teste. Ele não é o pacote SRD distribuído, que fica no Marinara-Agents em `packages/ruleset-5e-2014/`.

## Trabalho em aberto

- Voar sobre obstáculos em um tabuleiro de conjunto de regras: uma criatura voadora é movida como qualquer outra.
- Invocação no combate Classic e Tactical do próprio Marinara (lutas de conjunto de regras já invocam). O design está em [IA de combate de Game Mode](game-combat-ai.md#summoning-design-extension).
- Um agente Battlefield Scout que prepara o resumo do terreno de uma luta, descrito em [IA de combate de Game Mode](game-combat-ai.md#encounter-environment-agent-handoff).
