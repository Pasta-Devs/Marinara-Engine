# Avaliação da integração de assinaturas com Antigravity CLI

Esta é uma nota de pesquisa para desenvolvedores sobre [#8143](https://github.com/Pasta-Devs/Marinara-Engine/issues/8143), verificada em 2026-10-23. O Marinara Engine **não** implementa uma conexão de assinatura com Antigravity. Ainda falta uma maneira com suporte oficial e verificável de impedir a execução das ferramentas e personalizações globais da CLI, incluindo hooks de ciclo de vida, durante uma solicitação de geração de texto do Engine.

## Interfaces oficiais confirmadas

A CLI oficial `agy` tem suporte a login na conta com credenciais armazenadas e geração de texto sem interface interativa. O protocolo documentado inclui os eventos `init`, `step_update` e `result`, com mensagens de usuário em JSON no stdin para entrada em streaming. `agy models` lista os modelos disponíveis, incluindo os exemplos documentados `gemini-4-argon-high` e `gemini-4-argon-medium`. A disponibilidade para a conta deve ser consultada na CLI instalada, em vez de deduzida desses exemplos. `--print-timeout 0` espera a conclusão, e `--disable-slash-commands` desativa a expansão de comandos no modo print. Veja o [modo sem interface interativa](https://www.antigravity.google/docs/cli/headless/) e a [referência de opções da CLI](https://www.antigravity.google/docs/cli/reference/).

O login da CLI usa o armazenamento de credenciais do sistema operacional. O modo separado com chave de API Gemini exige `modelProvider: "gemini"` e `GEMINI_API_KEY`; um adaptador de assinatura não deve escolher esse caminho de cobrança silenciosamente. Os métodos documentados de autenticação programática do SDK Python são chaves de API Gemini, credenciais Vertex/Google Cloud e modelos locais. Esses métodos não comprovam autenticação por assinatura de consumidor para uma alternativa baseada no SDK. Veja [Autenticação](https://www.antigravity.google/docs/install/#programmatic-authentication) e a [visão geral do SDK](https://www.antigravity.google/docs/sdk/overview/).

## Falta de garantia de isolamento da execução

As definições oficiais de agentes personalizados oferecem controles de ferramentas, MCP e personalizações. O histórico de alterações também documenta `inheritCustomizations`, `inheritMcp` e `excludeDefaultComponents`. No entanto, o anúncio de `excludeDefaultComponents: true` preserva explicitamente os hooks após a invocação. Portanto, essa opção, por si só, não comprova que uma solicitação de geração de texto exclua todos os hooks executáveis. Veja [Subagentes personalizados](https://www.antigravity.google/docs/subagents/) e o [histórico de alterações da CLI](https://www.antigravity.google/docs/changelog).

Os hooks podem vir de um espaço de trabalho, do arquivo global `~/.gemini/config/hooks.json` e de plugins instalados. Eles incluem eventos de sessão, invocação do modelo, ferramentas e parada. A documentação atual de configurações e o [esquema oficial de configurações](https://antigravity.google/schemas/v1/settings.json) dizem explicitamente que uma entrada `hooks` em `settings.json` não é carregada. Escrever uma entrada vazia ali não desativaria as fontes reais de hooks. Veja [Hooks](https://www.antigravity.google/docs/hooks) e as [configurações da CLI](https://www.antigravity.google/docs/settings?tab=cli).

As opções e configurações documentadas da CLI não oferecem uma opção para desativar hooks por solicitação nem um diretório isolado de configuração/perfil que preserve a autenticação da conta. O inventário somente leitura `/hooks` é uma evidência útil, mas sua documentação não garante que uma invocação posterior do modelo use uma configuração fixa e sem hooks. Mudar de diretório, deixar a lista `tools` vazia, instruir o modelo a evitar ferramentas ou abortar após a inicialização não basta para comprovar o isolamento da execução.

Relatos de integrações de terceiros são pistas para investigação. As afirmações sobre ferramentas inertes, logs de resolução de agentes ou herança de personalizações precisam ser reproduzidas com a versão oficial antes de virarem um contrato para o Engine.

## Verificação local da versão

O [instalador oficial](https://antigravity.google/cli/install.sh) e seu [manifesto de versão para Darwin ARM64](https://antigravity-cli-auto-updater-974169037036.us-central1.run.app/manifests/darwin_arm64.json) foram inspecionados sem executar o instalador. O manifesto selecionou o [arquivo versionado do `agy` 1.4.6 para Darwin ARM64](https://storage.googleapis.com/antigravity-public/antigravity-cli/1.4.6-4884751325200384/darwin-arm/cli_mac_arm64.tar.gz), com este SHA-512:

```text
25af49004dd6d6013e6231278e2711b95641c8e54b661be871b3519c0a850053d4e707f46b47aa66e84ff9480041b13908194b48b1a97f84f2a22071d9c9fd3f
```

A soma de verificação do arquivo conferiu. O binário foi extraído em um diretório temporário exclusivo da tarefa. Somente `--version` e `--help` foram executados, dentro de uma sandbox do macOS que negava acesso à rede, leitura/escrita no diretório pessoal e acesso ao serviço de chaves. Ambos terminaram com sucesso. A ajuda não listou nenhuma opção para desativar hooks, isolar um perfil ou definir um diretório de configuração.

Essa verificação **não** instalou nem autenticou a CLI, nem inspecionou credenciais, nem invocou um modelo, nem listou os modelos de uma conta conectada, nem testou a execução de hooks. Ela confirma o inventário público de opções; não comprova que o isolamento seja impossível nem valida a geração por assinatura.

## Evidências necessárias antes de lançar um adaptador

1. Estabeleça uma maneira com suporte oficial de excluir hooks globais e do espaço de trabalho, plugins, skills, regras, subagentes, servidores MCP e ferramentas capazes de agir antes que qualquer solicitação possa executá-los. Mantenha o login normal na CLI oficial; não extraia nem copie tokens.
2. Teste esse mecanismo com a CLI oficial real e simulações locais controladas de modelos. Configure marcadores observáveis em hooks globais e do espaço de trabalho, além de plugins/MCP, com regras e solicitações de ferramentas. Verifique tanto a execução isolada quanto controles negativos que demonstrem que os marcadores são observáveis sem isolamento.
3. Comprove que o agente personalizado selecionado é resolvido antes da execução. Recuse versões sem suporte, nomes de agentes não resolvidos, formatos de inventário desconhecidos e verificações de isolamento inconclusivas; não dependa do texto de logs internos nem de uma lista de ferramentas aparentemente vazia na inicialização.
4. Adicione limites à entrada/saída do subprocesso, arquivos temporários privados e limpeza, cancelamento, tratamento de códigos de saída diferentes de zero e erros de resultado, e testes de timeout que considerem a atividade, inclusive raciocínio longo sem texto visível. Consulte os modelos específicos da conta pelo comando oficial e preserve o modelo selecionado e o esforço com suporte.
5. Reutilize os contratos existentes de conexões/provedores. Opções do SDK do Claude, como `settingSources: []`, são específicas do provedor, não opções transferíveis para `agy`. Deixe explícitas as lacunas de validação de autenticação real, cobrança da assinatura e plataformas físicas.

Até que o limite de execução seja estabelecido, #8143 permanece aberta e nenhuma entrada de provedor deve ser adicionada em tempo de execução.
