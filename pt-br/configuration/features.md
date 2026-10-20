# Chaves de recursos

Alguns comportamentos do servidor são opcionais. Ative-os em **Settings > Advanced > Features** (configurações > avançado > recursos). Todas as chaves começam desligadas, então um servidor onde ninguém abre essa seção funciona exatamente como antes.

As alterações valem imediatamente, sem reiniciar o servidor nem recarregar a página.

<a id="overview"></a>

## Visão geral

| Chave | Identificador da configuração | Padrão | Variável de ambiente |
| --- | --- | --- | --- |
| **Stable lorebook picks** (seleções estáveis de lorebook) | `stableLorebookGroupPicks` | Desligada | `LOREBOOK_STABLE_GROUP_WINNERS` |
| **Retry failed provider calls** (repetir chamadas de provedor que falharam) | `providerRetry` | Desligada | `PROVIDER_RETRY_TRANSIENT_ERRORS` |
| **Lorebook activation stats** (estatísticas de ativação de lorebook) | `usageAndActivationStats` | Desligada | nenhuma |
| **Recover deleted chat messages** (recuperar mensagens de chat excluídas) | `messageTrash` | Desligada | nenhuma |

Pesquisar `features` nas configurações leva à seção.

<a id="where-the-settings-are-stored"></a>

## Onde as configurações ficam

As chaves são salvas juntas na configuração de aplicativo `features`, um objeto JSON de booleanos. Só valores diferentes do padrão são armazenados. Uma chave ausente, um objeto vazio ou um valor ilegível significam o padrão: tudo desligado.

O servidor mantém uma cópia em memória para que verificar chaves não acrescente leituras em caminhos frequentes, como chamadas a provedores e varreduras de lorebook. Salvar em Settings, ou qualquer escrita na linha `features`, atualiza a cópia imediatamente.

A API é `GET` e `PUT /api/app-settings/features`. `PUT` substitui o objeto inteiro e recusa chaves desconhecidas ou valores que não sejam booleanos.

<a id="switches"></a>

## Chaves

<a id="stable-lorebook-picks"></a>

### Seleções estáveis de lorebook

Identificador: `stableLorebookGroupPicks`. Variável de ambiente: `LOREBOOK_STABLE_GROUP_WINNERS`.

Ligada: um grupo de inclusão de lorebook mantém o mesmo vencedor no chat enquanto os candidatos correspondentes não mudarem. Outros chats e conjuntos de candidatos podem escolher de outra forma.

Desligada: o vencedor é sorteado novamente a cada geração.

<a id="retry-failed-provider-calls"></a>

### Repetir chamadas de provedor que falharam

Identificador: `providerRetry`. Variável de ambiente: `PROVIDER_RETRY_TRANSIENT_ERRORS`.

Ligada: conexão recusada ou inacessível, ou erro de gateway 502/503, é repetido até duas vezes após breve espera com variação aleatória, somente antes de qualquer texto chegar. Um 504 ou conexão interrompida nunca é repetido. Se a conexão tem fallback, ele é tentado imediatamente em vez disso.

Desligada: apenas limites de taxa são repetidos, como antes.

<a id="lorebook-activation-stats"></a>

### Estatísticas de ativação de lorebook

Identificador: `usageAndActivationStats`. Sem variável de ambiente.

Ligada: depois que uma resposta é salva com sucesso, Marinara registra quais entradas de lorebook foram ativadas, para você poder ordenar e filtrar as entradas pelo uso no editor de lorebooks. Os trechos de Continue não acrescentam registros de ativação.

Desligada: nada é registrado, e o editor de lorebooks esconde as estatísticas de ativação.

<a id="recover-deleted-chat-messages"></a>

### Recuperar mensagens de chat excluídas

Identificador: `messageTrash`. Sem variável de ambiente.

Ligada: as mensagens de chat excluídas vão para a aba **Trash** (lixeira) da busca do chat. Use **Restore** (restaurar) ali em até 30 dias; depois disso, elas são removidas de vez. As mensagens de Game e as exclusões por rollback continuam permanentes.

Desligada: as mensagens excluídas são removidas na hora.

<a id="precedence"></a>

## Precedência

1. **Variável de ambiente.** Quando definida, prevalece sobre a chave salva, tanto para ligar quanto desligar. Settings mostra a chave bloqueada com o nome da variável. Um valor vazio conta como não definido.
2. **Chave salva.** O valor em Settings > Advanced > Features.
3. **Padrão.** Desligada.

| Variável | Controla | Valores |
| --- | --- | --- |
| `LOREBOOK_STABLE_GROUP_WINNERS` | Seleções estáveis de lorebook | `true`, `1`, `yes` ou `on` ligam. Qualquer outro valor desliga. |
| `PROVIDER_RETRY_TRANSIENT_ERRORS` | Repetição de chamadas de provedor que falharam | `true`, `1`, `yes` ou `on` ligam. Qualquer outro valor desliga. |

As variáveis são lidas em cada verificação, portanto mudanças no `.env` não exigem reinício.

<a id="for-developers"></a>

## Para desenvolvedores

O registro é `packages/shared/src/schemas/feature-settings.schema.ts`: nomes e padrões. Adicione a chave em `FEATURE_SWITCH_NAMES`, `FEATURE_SWITCH_DEFAULTS` e `featureSettingsSchema`, forneça rótulo e ajuda em `settings.features.<key>` no catálogo inglês e inclua em `SERVER_SWITCHES` de `packages/client/src/components/panels/settings/FeatureSwitchesSettings.tsx` para aparecer em Settings. No servidor, verifique com `isFeatureEnabled("<key>")` de `packages/server/src/services/features/feature-settings.ts`. No cliente, use `useFeatureEnabled("<key>")` de `packages/client/src/hooks/use-feature-settings.ts`.
