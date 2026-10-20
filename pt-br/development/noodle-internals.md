# Detalhes internos dos prompts do Noodle (desenvolvedores)

Referência para quem desenvolve: onde ficam no código os prompts de geração do Noodle, como personalizá-los e como depurar o prompt final. O prompt é o texto que Marinara envia para a IA. Quem usa o aplicativo configura o Noodle pelo painel **Settings** (Configurações); veja os guias do Noodle em `docs/noodle/`.

O Noodle é um pacote para download. As rotas dele (`/api/noodle`, registradas quando o pacote é ativado) e o código de geração ficam no pacote Noodle em [Pasta-Devs/Marinara-Agents](https://github.com/Pasta-Devs/Marinara-Agents), dentro de `packages/noodle/src/engine/packages/server/src/`. Na tabela abaixo, uma fonte marcada como **package** (pacote) é relativa a essa pasta. O Engine mantém o schema e os tipos compartilhados do Noodle, o armazenamento do Noodle, as substituições de prompt registradas que Settings lista e o texto padrão do prompt da linha do tempo em `packages/server/src/services/noodle/noodle-prompt.ts`. O pacote mantém as próprias cópias de `services/prompt-overrides/registry/noodle.ts` e `services/noodle/noodle-prompt.ts`.

## Mapa das fontes dos prompts

O Noodle tem um prompt montado para a linha do tempo, um prompt de perfil embutido no código e três substituições de prompt registradas: duas para o prompt de sistema da linha do tempo e uma para as imagens dos posts.

| Finalidade | Fonte | Símbolo principal | Como personalizar |
| ----------------------------------------------------------- | ------------------------------------------------------------------ | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Posts, respostas, seguidas, enquetes, votos e resumos da linha do tempo | **package** `services/noodle/noodle-public-prompt.service.ts` | `buildRefreshPrompt()` | A mensagem de sistema é a substituição **Noodle Timeline Prompt** seguida da substituição **Noodle Timeline Voice & Tone** (as duas abaixo). As duas mensagens de usuário, o contexto (contas, persona, perfis, agendas, lore, contexto de chat autorizado, a linha do tempo, os recursos ativados e as cotas) e a mensagem `# JSON Output Format` são montados no código. |
| Prompt de sistema base da linha do tempo | `packages/server/src/services/prompt-overrides/registry/noodle.ts` | `NOODLE_TIMELINE_BASE` (`noodle.timelineBase`) | Edite em **Settings -> Generations -> Image Generation Prompt Overrides -> Noodle Timeline Prompt** ou altere no código `NOODLE_TIMELINE_BASE_DEFAULT_PROMPT`, em `noodle-prompt.ts`. O padrão traz as regras de plataforma adulta, de autoria das personas, de interação e de JSON, então uma reescrita pode quebrar a leitura de `noodleGeneratedRefreshSchema`. |
| Instruções de voz e tom da linha do tempo (acrescentadas depois da base) | `packages/server/src/services/prompt-overrides/registry/noodle.ts` | `NOODLE_TIMELINE_VOICE` (`noodle.timelineVoice`) | Edite em **Settings -> Generations -> Image Generation Prompt Overrides -> Noodle Timeline Voice & Tone** ou altere no código o padrão registrado (`noodleTimelineVoiceDefaultText(enhanced, allowRandomUsers)`, em `noodle-prompt.ts`). Sem edição, o padrão acompanha a configuração `enableEnhancedTimelineWriting` do Noodle (`ctx.enhanced`; desativada por padrão, ela reproduz a instrução de tom original de uma linha só) e se os usuários aleatórios estão permitidos; depois que o usuário salva o próprio texto de substituição, esse texto prevalece, independentemente dessas configurações. |
| Perfis das contas de personagem criados na primeira vez | **package** `services/noodle/noodle-public-profiles.service.ts` | `generateMissingNoodleProfiles()` | Edite no código as mensagens de sistema e de usuário embutidas. A seleção de participantes acontece antes, e só as contas de personagem selecionadas sem `profileGenerated` chegam a esse prompt. |
| Prompt da imagem gerada para o post | `packages/server/src/services/prompt-overrides/registry/noodle.ts` | `NOODLE_IMAGE_POST` (`noodle.imagePost`) | Edite em **Settings -> Generations -> Image Generation Prompt Overrides -> Noodle Post Image** ou altere no código o padrão registrado. |
| Instruções de imagem padrão específicas do Noodle | `packages/shared/src/schemas/noodle.schema.ts` | `DEFAULT_NOODLE_SETTINGS.imageGenerationPrompt` | Altere a configuração do Noodle pela interface ou o padrão do schema no código. |
| Contexto de chat autorizado que entra na geração da linha do tempo | **package** `services/noodle/noodle-public-prompt.service.ts` | `buildOptedInChatContext()` | Altere no código a montagem do contexto; a autorização continua nas configurações de cada chat. |
| Imagens de entrada dos posts e respostas da linha do tempo | **package** `services/noodle/noodle-vision.ts` | `prepareNoodleVisionAttachments()` | Altere no código a seleção de imagens, a normalização, os limites ou a alternativa somente texto para provedores incompatíveis. |
| Atividade do Noodle inserida nos prompts do chat | **package** `services/noodle/noodle-context.ts` | `buildRecentSocialMediaActivityBlock()` | O pacote registra isso como o serviço `noodle:prompt-context`. Altere no código a filtragem ou a montagem do bloco; quem usa o aplicativo controla os modos de destino e o limite de itens nas configurações do Noodle, e o bloco montado tem um teto rígido de 8.192 tokens (o token é um pedacinho de texto). |
| Contrato do JSON gerado | `packages/shared/src/schemas/noodle.schema.ts` | `noodleGeneratedRefreshSchema` | Altere apenas junto com o prompt, o processamento da rota, os tipos compartilhados e a cobertura de regressão. |
| Contexto de mundo e lore do lorebook inserido na geração da linha do tempo | **package** `services/noodle/noodle-public-prompt.service.ts` | `buildRefreshPrompt()` (chama `processLorebooks()`) | Depende da configuração **Lorebook context** do Noodle (`enableLorebookContext`, desativada por padrão). Reaproveita o mesmo `processLorebooks()` multipersonagem usado pelos chats em grupo, com um orçamento de tokens específico do Noodle vindo de `noodleLorebookTokenBudget()`, em `noodle-prompt.ts`, ajustado pela quantidade de personagens ativos e limitado a 8.192 tokens. Roda com `previewOnly: true`, já que o Noodle não tem um espaço por chat para salvar o estado de tempo de fixação e recarga. |

O prompt de perfil não aparece na interface de substituições de prompt. Os modelos **Noodle Timeline Prompt**, **Noodle Timeline Voice & Tone** e **Noodle Post Image** aparecem. Quando **Noodle image generation** (geração de imagens do Noodle) está ligada (`enableImagePrompts`), a configuração **Image instructions (sent to your LLM)** (instruções de imagem, enviadas ao seu LLM) do Noodle vai para o modelo da linha do tempo, que a segue ao escrever a ideia de imagem de cada post; o modelo padrão **Noodle Post Image** não a acrescenta mais, embora modelos personalizados ainda possam usá-la como `${userInstructions}`.

O serviço de imagem (**package** `services/noodle/noodle-public-images.service.ts`) carrega `NOODLE_IMAGE_POST` e passa o resultado por `compileImagePrompt()` antes de enviá-lo ao provedor de imagens. Ou seja, o perfil de estilo de imagem escolhido e os padrões da conexão também influenciam a requisição final.

## Como inspecionar o prompt final

Uma atualização manual feita com o **Debug Mode** (modo de depuração) ativado registra, pelo logger compartilhado do servidor, as mensagens finais de perfil e de linha do tempo enviadas ao modelo. Procure por:

```text
[debug/noodle] Profile prompt sent to model
[debug/noodle] Prompt sent to model
[debug/noodle] Attached N timeline image input(s) to the refresh prompt
```

As imagens da linha do tempo nunca vão em base64 para o log de depuração. O texto registrado traz as mesmas chaves de anexo de post e resposta enviadas ao modelo, mais a quantidade de imagens de entrada nativas. O Noodle normaliza e limita essas entradas em `noodle-vision.ts`. Se um provedor recusar explicitamente conteúdo de visão, o pacote registra o fato e envia a alternativa somente texto já montada.

No caso das imagens, ative **Expose media prompts before sending** em **Settings -> Generations -> Overall Generations** para inspecionar e editar os prompts positivo e negativo já compilados antes do envio.

## Como editar com segurança

A montagem do prompt é uma fronteira de compatibilidade de alto risco. Ao mexer nela, mantenha alinhados o prompt, `noodleGeneratedRefreshSchema`, o processamento da rota e as regressões de menção e de enquete do Noodle. No Engine, rode no mínimo:

```bash
pnpm check
pnpm regression:prompt
pnpm regression:noodle
```

As mudanças no código que pertence ao pacote são feitas e validadas no Marinara-Agents, na branch `staging` dele.

## Guias relacionados

- [Noodle: a linha do tempo social dentro do aplicativo](../noodle/overview.md)
- [Configurações do Noodle e transferência para os chats](../noodle/settings.md)
- [Pacotes opcionais de agentes e capacidades](optional-agent-packages.md)
- [Mapa da arquitetura (desenvolvedores)](architecture-map.md)
