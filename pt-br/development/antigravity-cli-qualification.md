# Avaliação da integração de assinaturas com Antigravity CLI

Esta é uma nota de pesquisa para desenvolvedores sobre [#8143](https://github.com/Pasta-Devs/Marinara-Engine/issues/8143), verificada pela primeira vez em 2026-10-23 e novamente em 2026-11-19 com as versões oficiais 1.5.11 e 1.5.12 de `agy` para Windows. O Marinara Engine **não** implementa uma conexão de assinatura com Antigravity, e a issue continua fechada como não planejada. As exclusões do agente personalizado suprimiram os hooks testados, mas o subprocesso MCP de um plugin descoberto globalmente ainda iniciou nas duas versões. O isolamento da execução continua sem qualificação.

## Interfaces oficiais confirmadas

A CLI oficial `agy` tem suporte a login na conta com credenciais armazenadas e geração de texto sem interface interativa. O protocolo documentado inclui os eventos `init`, `step_update` e `result`, com mensagens de usuário em JSON no stdin para entrada em streaming. Na nova verificação no Windows, `agy models` listou `gemini-4-neon-high`. Solicitações com limites para esse modelo funcionaram com o login existente do usuário no Google AI Pro. Consulte a CLI instalada para saber quais modelos a conta oferece. O exemplo não determina a disponibilidade. `--print-timeout 0` espera a conclusão, e `--disable-slash-commands` desativa a expansão de comandos no modo print. Veja o [modo sem interface interativa](https://antigravity.google/docs/cli/headless/) e a [referência de opções da CLI](https://antigravity.google/docs/cli/reference/).

O login da CLI usa o armazenamento de credenciais do sistema operacional. O modo separado com chave de API Gemini exige `modelProvider: "gemini"` e `GEMINI_API_KEY`; um adaptador de assinatura não deve escolher esse caminho de cobrança silenciosamente. Os métodos documentados de autenticação programática do SDK Python são chaves de API Gemini, credenciais Vertex/Google Cloud e modelos locais. Esses métodos não comprovam autenticação por assinatura de consumidor para uma alternativa baseada no SDK. Veja [Autenticação](https://antigravity.google/docs/install/#programmatic-authentication) e a [visão geral do SDK](https://antigravity.google/docs/sdk/overview/).

## Resultado atual do isolamento da execução

As definições oficiais de agentes personalizados oferecem controles de ferramentas, MCP e personalizações. O guia de plugins descreve `inheritCustomizations` como controle de skills, regras e hooks herdados, e `inheritMcp` como controle de servidores MCP herdados do espaço de trabalho. O anúncio original de `excludeDefaultComponents: true` preserva hooks pós-invocação, então só essa opção não comprova isolamento. A configuração combinada abaixo suprimiu os hooks de teste na 1.5.11, mas não impediu a inicialização de todos os subprocessos MCP. Veja [Subagentes personalizados](https://antigravity.google/docs/subagents/), [Criar plugins](https://antigravity.google/docs/build-plugins/) e [histórico de mudanças da CLI](https://antigravity.google/docs/changelog).

Os hooks podem vir de um espaço de trabalho, do arquivo global `~/.gemini/config/hooks.json` e de plugins instalados. Eles incluem eventos de sessão, invocação do modelo, ferramentas e parada. A documentação atual de configurações e o [esquema oficial de configurações](https://antigravity.google/schemas/v1/settings.json) dizem explicitamente que uma entrada `hooks` em `settings.json` não é carregada. Escrever uma entrada vazia ali não desativaria as fontes reais de hooks. Veja [Hooks](https://antigravity.google/docs/hooks) e as [configurações da CLI](https://antigravity.google/docs/settings?tab=cli).

A ajuda da versão 1.5.11 instalada descreve `--settings` como substituições de chaves de `settings.json` válidas só na sessão, passadas diretamente ou em arquivo. Isso permite ajustar temporariamente a confiança no espaço de trabalho e as permissões sem regravar as preferências persistentes. Não é um perfil de configuração separado: `--settings '{"hooks":{}}'` sai com código 1 e `unknown setting "hooks"`. A ajuda instalada não apresentou nenhuma opção para desativar hooks ou isolar um perfil autenticado.

A documentação atual diz que `/hooks` permite adicionar, editar e alternar hooks, salvando as mudanças em arquivos de configuração. Na nova verificação, `-p "/hooks" --output-format json` sem interface retornou um inventário estruturado. O inventário e os controles salvos não garantem que uma invocação posterior exclua personalizações executáveis. Trocar de diretório, esvaziar a lista `tools`, instruir a evitar ferramentas ou abortar depois da inicialização não comprova isolamento da execução.

Relatos de integrações de terceiros são pistas para investigação. As afirmações sobre ferramentas inertes, logs de resolução de agentes ou herança de personalizações precisam ser reproduzidas com a versão oficial antes de virarem um contrato para o Engine.

## Verificação da versão de outubro de 2026

O [instalador oficial](https://antigravity.google/cli/install.sh) e seu [manifesto de versão para Darwin ARM64](https://antigravity-cli-auto-updater-974169037036.us-central1.run.app/manifests/darwin_arm64.json) foram inspecionados sem executar o instalador. O manifesto selecionou o [arquivo versionado do `agy` 1.4.6 para Darwin ARM64](https://storage.googleapis.com/antigravity-public/antigravity-cli/1.4.6-4884751325200384/darwin-arm/cli_mac_arm64.tar.gz), com este SHA-512:

```text
25af49004dd6d6013e6231278e2711b95641c8e54b661be871b3519c0a850053d4e707f46b47aa66e84ff9480041b13908194b48b1a97f84f2a22071d9c9fd3f
```

A soma de verificação do arquivo conferiu. O binário foi extraído em um diretório temporário exclusivo da tarefa. Somente `--version` e `--help` foram executados, dentro de uma sandbox do macOS que negava acesso à rede, leitura/escrita no diretório pessoal e acesso ao serviço de chaves. Ambos terminaram com sucesso. A ajuda não listou nenhuma opção para desativar hooks, isolar um perfil ou definir um diretório de configuração.

Essa verificação **não** instalou nem autenticou a CLI, nem inspecionou credenciais, nem invocou um modelo, nem listou os modelos de uma conta conectada, nem testou a execução de hooks. Ela confirma o inventário público de opções; não comprova que o isolamento seja impossível nem valida a geração por assinatura.
## Verificação no Windows de novembro de 2026

O `agy` instalado informou a versão 1.5.11. Seu SHA-512 coincidiu com a soma vista no [manifesto oficial do Windows AMD64](https://antigravity-cli-auto-updater-974169037036.us-central1.run.app/manifests/windows_amd64.json), mas a resposta original do manifesto não foi guardada. O manifesto com atualização contínua depois passou para 1.5.12. Na revisão, o [executável versionado 1.5.11 para Windows](https://storage.googleapis.com/antigravity-public/antigravity-cli/1.5.11-6132547114106880/windows-x64/cli_windows_x64.exe) foi baixado de forma independente e teve o hash calculado sem ser executado. O arquivo de 234.827.416 bytes apresentou o mesmo SHA-512 do executável instalado:

```text
7de2a90b3a351c5c1d089b50a773d4fc455062870fa62fc4d50ee2779d7b9f1b630a7025c31163671f6c82ae0426aeda838f98f67270a50fdd2c7de2f2d7eb3f
```

Os testes rodaram em um espaço de trabalho temporário exclusivo da tarefa, com o seguinte frontmatter em `.agents/agents/me-isolation-probe.md`:

```yaml
name: me-isolation-probe
description: Harmless execution-isolation qualification fixture.
mainAgent: true
subagent: false
tools: []
inheritCustomizations: false
inheritMcp: false
excludeDefaultComponents: true
commandExecutionPolicy: off
```

A [referência do frontmatter de agentes personalizados](https://antigravity.google/docs/subagents/) oficial documenta `mainAgent`, `subagent`, `tools` e `commandExecutionPolicy`. O guia de plugins e o histórico já citados descrevem os controles de herança e exclusão. A configuração foi testada em conjunto. Selecionar o agente com sucesso não comprova que cada campo foi aplicado de forma independente.

As gerações usaram `--settings <session-settings-json> --agent me-isolation-probe --model gemini-4-neon-high --disable-slash-commands --print-timeout 40s --output-format stream-json -p <prompt>`, com um limite independente de 55 segundos para o subprocesso. O JSON passado diretamente definiu o espaço de trabalho temporário como confiável, selecionou o modo padrão do agente, desativou scripts personalizados de status e título e selecionou o modo de permissão indicado abaixo. Nenhuma permissão foi ignorada.

O objeto de configuração tinha esta estrutura, com `<temporary-workspace>` substituído pelo diretório de teste e `toolPermission` definido de acordo com a linha da tabela:

```json
{
  "trustedWorkspaces": ["<temporary-workspace>"],
  "agentMode": "",
  "toolPermission": "strict",
  "statusLine": { "enabled": false },
  "title": { "enabled": false }
}
```

As variáveis de ambiente que selecionam chave de API e ADC foram removidas do ambiente do subprocesso de teste. Nenhuma credencial foi extraída ou copiada.

Os hooks de teste acrescentavam os nomes de `SessionStart`, `PreInvocation`, `PostInvocation` e `Stop` a arquivos marcadores separados. Simulações locais de MCP em Python gravavam um marcador de início antes de responder a `initialize` e `tools/list` por stdio. O MCP do espaço de trabalho usava `.agents/mcp_config.json`. Os plugins continham `plugin.json`, `hooks.json` e `mcp_config.json`. A descoberta usou um manifesto `entries` em `.agents/plugins.json` ou `~/.gemini/config/plugins.json`, conforme a [documentação de descoberta de personalizações](https://antigravity.google/docs/customization-discovery/). Os controles de hooks, MCP e leitura de arquivos omitiram `--agent`, com as mesmas simulações e configurações de sessão. O teste de nome inexistente comparou um `--agent me-isolation-probe` válido a um nome de agente não encontrado.

| Verificação | Controle | Agente personalizado |
| --- | --- | --- |
| Hooks do espaço de trabalho, globais e de plugin descoberto no espaço de trabalho (permissões `strict`) | Os quatro eventos gravaram marcadores em cada origem | Nenhum marcador de hook |
| MCP do espaço de trabalho e de plugin descoberto no espaço de trabalho (permissões `strict`) | Os dois subprocessos gravaram marcadores de início | Nenhum dos marcadores de início apareceu |
| Hooks do plugin descoberto globalmente (permissões `request-review`) | Os quatro eventos gravaram marcadores | Nenhum marcador de hook |
| MCP do plugin descoberto globalmente (permissões `request-review`) | O subprocesso gravou o marcador de início | O subprocesso ainda gravou o marcador de início |
| Solicitação explícita de `view_file` para um valor de teste imprevisível (permissões `request-review`) | Retornou o valor de teste | Retornou `FILE_UNAVAILABLE` sem o valor de teste |
| Nome inexistente em `--agent` (permissões `strict`) | `--agent me-isolation-probe` concluiu a geração | O nome inválido saiu com código 1, resultado de erro, uso zero e nenhum marcador de hook ou MCP |

O resultado do MCP do plugin descoberto globalmente foi repetido duas vezes com permissões `strict` e um caminho novo para o marcador de início em cada invocação. As duas solicitações com o agente personalizado saíram com código 0, e os dois subprocessos gravaram seu marcador. Uma gravação atrasada do controle anterior não poderia atingir os novos caminhos. Esse é o bloqueio de execução que permanece, mesmo sem a resposta usar uma ferramenta MCP.

O prompt de leitura de arquivo foi `Use view_file to read <fixture-path> and reply with its exact contents. Do not guess.`, substituindo o caminho pelo caminho absoluto do arquivo temporário de teste. O corpo Markdown do agente personalizado mandava responder `FILE_UNAVAILABLE` se ele não conseguisse ler o arquivo.

Quando o manifesto oficial avançou durante a investigação, o [executável 1.5.12 para Windows](https://storage.googleapis.com/antigravity-public/antigravity-cli/1.5.12-5281398513336320/windows-x64/cli_windows_x64.exe) foi baixado no diretório de teste da tarefa sem substituir a CLI instalada. Seu SHA-512 foi comparado com esta resposta guardada do manifesto:

```json
{
  "version": "1.5.12",
  "url": "https://storage.googleapis.com/antigravity-public/antigravity-cli/1.5.12-5281398513336320/windows-x64/cli_windows_x64.exe",
  "sha512": "64603ba45b2783587edc62fd9effa9228091593b440ed54368e098bb5fb3ee034bada58c4125e3c0e509ed460b327e454dc99971d04d47c7aee417f00f56d801"
}
```

O par de testes de controle e de agente personalizado para o plugin descoberto globalmente e para a leitura de arquivo foi repetido na 1.5.12 com o mesmo login e permissões `request-review`. O controle executou todos os eventos de hook do plugin, iniciou o subprocesso MCP e retornou o valor de teste. O agente personalizado retornou `FILE_UNAVAILABLE` e suprimiu esses hooks, mas ainda iniciou o subprocesso MCP. As duas solicitações de geração saíram com código 0. As demais linhas da tabela só foram testadas na 1.5.11.

O `init.agent` do fluxo identificou o agente personalizado selecionado, e outro prompt na 1.5.11 retornou um marcador presente apenas no corpo Markdown desse agente. No entanto, `init.tools` listou as mesmas ferramentas integradas para o controle e para o agente personalizado, inclusive `run_command` e `view_file`. O inventário não é conclusivo sobre o acesso efetivo às ferramentas. A verificação de leitura mostra o comportamento observado para uma ferramenta. As demais ainda precisam de qualificação.

Os arquivos globais de teste foram criados apenas em caminhos de hooks e manifesto que ainda não existiam, com criação exclusiva e limpeza que conferiu o conteúdo antes de removê-los. Os dois arquivos globais temporários foram removidos, e os hashes das configurações persistentes da CLI coincidiram com os anteriores ao teste. A CLI manteve seu estado normal de conversa. Os testes não substituíram nenhuma configuração global existente.

Os testes não inspecionaram o conteúdo das credenciais. A autenticação ficou dentro da CLI oficial.

Os resultados ao vivo no Windows comprovam a geração autenticada por assinatura e delimitam o problema original com hooks. O adaptador ainda não está qualificado, pois o MCP descoberto globalmente continua iniciando. Ainda faltam testes de servidores MCP globais independentes, skills, regras e subagentes herdados, todas as ferramentas capazes de agir, cancelamento, períodos longos de silêncio e execução real no Linux e no macOS. As correções mais recentes de políticas de plugins e sandbox no histórico da CLI não demonstram que uma solicitação comum de assinatura de consumidor exclui toda personalização executável.

## Evidências necessárias antes de lançar um adaptador

1. Estabeleça uma maneira com suporte oficial de excluir hooks globais e do espaço de trabalho, plugins, skills, regras, subagentes, servidores MCP e ferramentas capazes de agir antes que qualquer solicitação possa executá-los. Mantenha o login normal na CLI oficial; não extraia nem copie tokens.
2. Teste esse mecanismo com a CLI oficial real e simulações locais controladas de modelos. Configure marcadores observáveis em hooks globais e do espaço de trabalho, além de plugins/MCP, com regras e solicitações de ferramentas. Verifique tanto a execução isolada quanto controles negativos que demonstrem que os marcadores são observáveis sem isolamento.
3. Comprove que o agente personalizado selecionado é resolvido antes da execução. Recuse versões sem suporte, nomes de agentes não resolvidos, formatos de inventário desconhecidos e verificações de isolamento inconclusivas; não dependa do texto de logs internos nem de uma lista de ferramentas aparentemente vazia na inicialização.
4. Adicione limites à entrada/saída do subprocesso, arquivos temporários privados e limpeza, cancelamento, tratamento de códigos de saída diferentes de zero e erros de resultado, e testes de timeout que considerem a atividade, inclusive raciocínio longo sem texto visível. Consulte os modelos específicos da conta pelo comando oficial e preserve o modelo selecionado e o esforço com suporte.
5. Reutilize os contratos existentes de conexões/provedores. Opções do SDK do Claude, como `settingSources: []`, são específicas do provedor, não opções transferíveis para `agy`. Deixe explícitas as lacunas de validação de autenticação real, cobrança da assinatura e plataformas físicas.

Os resultados da 1.5.11 e da 1.5.12 no Windows atendem a alguns requisitos, mas a inicialização indevida do subprocesso ainda é reproduzível. A issue #8143 continua fechada como não planejada. Esta verificação não a reabre nem autoriza trabalho no runtime. Uma entrada de provedor no runtime só deve ser adicionada depois de uma decisão de quem mantém o projeto e da conclusão da qualificação.
