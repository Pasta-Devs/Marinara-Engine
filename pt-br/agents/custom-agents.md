# Como criar agentes personalizados

Um agente personalizado é um ajudante que você mesmo escreve: as instruções são suas, assim como a decisão de quando ele roda e do que ele pode alterar. Crie um quando nenhum [agente para download](built-in-agents.md) fizer o que você quer. Se um agente instalado chegar perto, passe o mouse sobre o cartão dele no painel **Agents** (agentes) e clique em **Copy agent** (copiar agente) para ganhar uma cópia editável.

Antes de começar: leia [Agentes: ajudantes de IA para os seus chats](agents-overview.md). Criar um agente não faz ele rodar. Depois, você adiciona o agente a um chat. Os agentes personalizados funcionam em todos os modos de chat.

## Como criar um agente personalizado

1. Abra o painel **Agents**.
2. Clique em **New** (o ícone de mais), perto do topo. O editor de agentes abre em tela cheia.
3. Digite um nome no campo de título, por exemplo `Weather Reporter`.
4. Preencha **Description** (descrição) e **Author** (autor).
5. Escolha uma **Pipeline Phase** (veja [Pipeline Phase](#pipeline-phase)).
6. Ative os poderes de que ele precisa em **Custom Agent Abilities**.
7. Escolha um **Result Type** que combine com o que o agente produz. Se estiver em dúvida, escolha **Context Injection**. Ele não exige nenhuma habilidade nem um formato de saída rígido.
8. Escreva as instruções do agente em **Prompt Template** (modelo de prompt).
9. Clique em **Save** na barra superior. Um selo verde **Saved** aparece.

O agente passa a aparecer na seção **Custom Agents** do painel **Agents**. Para usar o agente, abra um chat, vá em **Chat Settings** (configurações do chat), ative **Enable Agents** e adicione o agente pela seção **Custom Agents**.

## Pipeline Phase

A **Pipeline Phase** (fase do fluxo) define quando o agente roda.

- **Pre-Generation**: antes da resposta. Pode acrescentar contexto ou alterar o prompt.
- **Parallel**: ao mesmo tempo que a resposta. Não enxerga a resposta pronta.
- **Post-Processing**: depois da resposta. Consegue ler a resposta e, em alguns tipos de resultado, editá-la.

Certos tipos de resultado forçam uma fase. **Text Rewrite** muda a fase para **Post-Processing**. **Prompt Patch** e **Character Activity** mudam a fase para **Pre-Generation**.

Os agentes de Post-Processing ganham também uma seção **Turn Data Access**, com dois botões liga/desliga: **Pre-generation injections** e **Parallel agent results**. Ative-os para que o agente leia o que os outros agentes produziram no mesmo turno.

## Custom Agent Abilities

As habilidades são poderes que você escolhe ativar. Cada uma fica bloqueada até você ligar o botão liga/desliga dela.

- **Create lorebooks**: criar um novo lorebook feito pelo agente quando a saída de lore dele não tem destino.
- **Edit lorebooks**: escrever entradas de lorebook ou devolver resultados de atualização de lorebook.
- **Edit messages**: substituir o texto da mensagem gerada ou acrescentar opções de continuação a ele.
- **Edit trackers**: atualizar o estado de trackers de jogo, de personagem, de persona ou personalizados.
- **Frontend styling**: aplicar um estilo visual temporário durante a geração.
- **Change chat backgrounds**: trocar e salvar o plano de fundo de um chat.
- **Change character sprites**: trocar as expressões de personagem e de persona mostradas no chat.
- **Control media playback**: controlar o Spotify, o YouTube ou a música local.
- **Control haptic devices**: enviar comandos limitados para um dispositivo háptico conectado.
- **Edit About Me details**: alterar o texto de About Me específico do chat. Mudanças no card público continuam exigindo a sua aprovação.
- **Image generation**: enviar um prompt de imagem para o gerador de imagens.
- **Vectors/embeddings**: usar contexto de vetores. Os vetores permitem que Marinara busque texto por significado.
- **Main prompt edits**: editar o prompt enviado ao modelo principal.
- **Create character cards**: propor um novo card de personagem. Ele só é salvo depois que você revisa e aceita.
- **Choose active chat characters**: escolher quais personagens anexados ficam ativos na resposta atual de Conversation ou de Roleplay.

Ao ativar **Edit lorebooks**, surge uma seção **Lorebook Writer**. Ative **Allow lorebook entry writes** e escolha um lorebook em **Target lorebook**. O agente só consegue escrever nesse lorebook.

## Result Type

O **Result Type** (tipo de resultado) diz a Marinara como interpretar a resposta do agente. A maioria dos tipos espera JSON, um formato de texto escrito com chaves e aspas. Um tipo fica acinzentado até você ativar a habilidade de que ele precisa.

Tipos que não exigem nenhuma habilidade:

- **Context Injection**: acrescenta texto antes da geração ou registra uma anotação depois dela. É o ponto de partida mais fácil.

Tipos que exigem **Edit messages**:

- **Text Rewrite**: substitui o texto da mensagem depois da resposta.
- **Interactive Choices**: acrescenta opções de continuação à mensagem.

Tipos que exigem **Edit trackers**:

- **Character Tracker**: atualiza os personagens presentes.
- **Persona Stats**: atualiza atributos, status e inventário da persona.
- **Custom Tracker**: substitui os campos do seu tracker personalizado.
- **Game State**: atualiza dados de jogo no estilo estado do mundo.

Outros tipos, cada um com a própria habilidade:

- **Lorebook Update** (Edit lorebooks): cria ou atualiza entradas de lorebook.
- **Image Prompt** (Image generation): pede ao gerador de imagens que desenhe uma cena.
- **Prompt Patch** (Main prompt edits): acrescenta, insere no início ou substitui seções do prompt.
- **Frontend Style** (Frontend styling): aplica um efeito visual temporário.
- **Background Change** (Change chat backgrounds): escolhe e salva um plano de fundo disponível.
- **Sprite Change** (Change character sprites): troca as expressões mostradas no chat.
- **Spotify Control**, **YouTube Control**, **Local Music Control** (Control media playback): controlam a reprodução.
- **Haptic Command** (Control haptic devices): envia um comando limitado a um dispositivo háptico.
- **About Me Update** (Edit About Me details): atualiza o texto de About Me específico do chat e propõe edições públicas.
- **Character Card Creation** (Create character cards): propõe um card de personagem editável para a sua aprovação.
- **Character Activity** (Choose active chat characters): seleciona os cards de personagem usados na resposta atual. Roda antes da resposta e precisa selecionar pelo menos um personagem anexado.

### Controles por chat para agentes de imagem

Um agente com a habilidade **Image generation** ganha dois controles extras em **Chat Settings → Agents → Custom Agents**.

- **Image model** (modelo de imagem): substitui a conexão de imagem deste agente apenas neste chat. Deixe em **Agent default** (padrão do agente) para manter a configuração do próprio agente. A opção **Image Style** do chat também vale para as imagens de agentes personalizados.
- **Camera button** (botão da câmera): cria uma imagem na hora, sem esperar pelas palavras-chave de ativação. Se o modelo de prompt do agente se recusar a escrever um prompt, você recebe uma notificação de erro em vez de uma imagem.

## Activation Keywords

Por padrão, um agente roda na cadência normal dele (a frequência com que ele roda). As **Activation Keywords** (palavras-chave de ativação) pulam o agente quando a cena não é relevante, o que economiza tokens.

1. Em **Activation Keywords**, digite uma palavra-chave ou frase por linha, como `tavern` ou `secret door`.
2. Ajuste **Scan Depth** para o número de mensagens recentes a pesquisar. O padrão é 5 e o máximo é 200.

A partir daí, o agente só roda quando uma palavra-chave aparece nessas mensagens. Deixe a caixa vazia para desativar o filtro. A cadência e qualquer pergunta de ativação continuam valendo.

## Como anexar ferramentas

Um agente pode chamar ferramentas: funções que a IA executa para buscar ou alterar alguma coisa e cujo resultado ela lê em seguida. Isso também se chama function calling.

1. No editor de agentes, abra **Tools / Function Calling** e ative cada ferramenta que você quiser. A lista traz as ferramentas nativas e as suas próprias. Para criar uma, veja [Ferramentas personalizadas](../extending/custom-tools.md).
2. Em **Chat Settings**, abra **Function Calling** e ative **Enable Tool Use**. Sem isso, as ferramentas do agente continuam desligadas.

Agentes importados nunca recebem acesso a ferramentas. Revise um agente importado e depois selecione você mesmo as ferramentas dele.

Um agente recebe no máximo 16 rodadas de chamadas de ferramenta por execução (menos, se o `MAX_TOOL_ROUNDS` do servidor for menor) e depois responde com o que tiver. Um modelo que chama uma ferramenta por vez gasta uma rodada em cada chamada, então um agente que salva muitas entradas deve fazer várias chamadas em uma mesma resposta. Uma execução de preenchimento retroativo de lorebook recebe até 64 rodadas.

## Named prompt options

Um agente pode guardar várias variações de prompt, para que cada chat escolha uma sem precisar editar o agente.

1. Em **Prompt Template**, localize **Named prompt options**.
2. Clique em **Add option** (adicionar opção).
3. Dê à opção um nome e uma descrição curta e depois escreva o prompt completo dela.

Quando alguém adiciona o agente a um chat, um menu suspenso **Prompt Mode** lista as suas opções. Sem nenhuma opção, só o prompt padrão aparece.

## Outras configurações

- **Model override**: usa um modelo diferente para este agente, por exemplo um mais barato. Deixe vazio para usar o modelo do chat. O agente envia os parâmetros de geração salvos nessa conexão. Veja [Parâmetros para agentes](../prompts/generation-parameters.md#parameters-for-agents).
- **Agent Budget**: **Context Size** é quantas mensagens recentes o agente lê (padrão 5). **Max Output Tokens** é o espaço de saída reservado (padrão 4096, de 128 a 32768).
- **Add as Prompt Section**: expõe a última saída do agente como uma seção que você pode posicionar em um preset de prompt.

Macros como `{{user}}` e `{{char}}` funcionam no **Prompt Template**. Veja [Macros](../prompts/macros.md).

## Um exemplo completo

Este agente reescreve cada resposta em inglês britânico.

1. Dê a ele o nome `British English Editor`.
2. Em **Custom Agent Abilities**, ative **Edit messages**.
3. Em **Result Type**, escolha **Text Rewrite**. A fase muda para **Post-Processing**.
4. Cole isto em **Prompt Template**:

   ```text
   You are a copy editor. Rewrite the latest reply into British English.
   Change spelling and vocabulary only. Do not change the meaning, tone, or events.
   Return JSON with an "editedText" field holding the full rewritten reply,
   and a "changes" array of short notes describing what you changed.
   ```

5. Clique em **Save**.
6. Abra um chat de Roleplay, ative **Enable Agents** em **Chat Settings** e adicione o agente pela seção **Custom Agents**.

Depois de cada resposta, o agente devolve um JSON como este:

```json
{"editedText":"The colour of the harbour caught her eye.","changes":[{"description":"color to colour, harbor to harbour"}]}
```

Marinara coloca o `editedText` no lugar da resposta. As anotações de `changes` aparecem como um resumo curto.

## Como importar e exportar agentes

Para exportar um agente, clique em **Export agent** (o ícone de upload) na barra superior do editor. O arquivo guarda o prompt e as configurações do agente, nunca definições de ferramentas personalizadas. Para exportar vários, use **Select agents** no painel **Agents**, escolha os agentes e exporte.

As importações externas vêm bloqueadas por padrão.

1. Abra **Settings → Advanced → Danger Zone** (Configurações → Avançado → Zona de perigo) e ative **Allow custom Agent imports**. Nenhuma alteração no `.env` é necessária.
2. No painel **Agents**, clique em **Import agents** e escolha arquivos de agente ou uma pasta.
3. Revise a lista de permissões que Marinara mostra. Aprove só o que o agente precisa. As capacidades não marcadas continuam bloqueadas.

Esse bloqueio afeta apenas agentes vindos de arquivos, pastas ou repositórios personalizados. Os agentes que você cria e os agentes oficiais do **Agent Organizer** (organizador de agentes) funcionam normalmente. Cada arquivo importado recebe uma nova identidade personalizada, então não consegue substituir um agente oficial.

Por segurança, Marinara ignora funções embutidas no pacote, limpa as ferramentas selecionadas, higieniza o CSS temporário e confere as capacidades aprovadas antes que um agente importado possa alterar mensagens, trackers, lorebooks, planos de fundo, sprites, mídia, dispositivos hápticos, dados de About Me, prompts ou imagens. Importe funções confiáveis separadamente, revise essas funções e anexe-as você mesmo ao agente. Desligar o botão da **Danger Zone** faz os agentes importados pararem de rodar.

<a id="activation-questions"></a>

## Perguntas de ativação

Uma pergunta de ativação pergunta se a cena recente precisa do seu agente. Ela reconhece paráfrases que as palavras-chave deixam passar. Ela exige um **Decision model** (modelo de decisão), um modelo pequeno que responde a perguntas de sim ou não. Escolha um no painel Connections. Veja [Modelos de decisão](../connections/decision-models.md). Com **Decision model** em **None** (nenhum), o padrão, os campos de pergunta ficam desativados, e um agente com pergunta roda como se não tivesse nenhuma.

1. Abra o agente personalizado.
2. Digite uma **Question** (pergunta) de até 500 caracteres. As macros `{{user}}` e `{{char}}` funcionam nela.
3. Ajuste **Run when probability is at least** (rodar quando a probabilidade for pelo menos) para o limiar deste agente. O agente roda quando a probabilidade de "sim" atinge esse limiar, então valores maiores pulam mais execuções. O editor mostra um valor recomendado para o seu modelo: 0,5 para modelos de chat locais e contas Decision, ou 0,1 para os modelos Open-Jev integrados. Confira esse valor nos seus próprios chats depois de trocar de modelo. Veja [Limiares](../connections/decision-models.md#thresholds).
4. Opcional: ajuste **Bypass the question after this many messages without a successful run** (ignorar a pergunta após este número de mensagens sem uma execução bem-sucedida). Depois desse número de mensagens, a pergunta é ignorada, então um modelo que continua respondendo "não" não consegue silenciar o agente para sempre. Palavras-chave e cadência continuam valendo.

Escreva a pergunta como uma declaração sobre a mensagem mais recente, como `The latest message moves the scene to a new place.` Um modelo pequeno respondeu a isso com mais confiabilidade do que a `Did the scene change?` Veja [Escrever declarações](../prompts/conditional-prompts.md#writing-statements).

Como funciona:

- Palavras-chave e cadência são verificadas primeiro, então um agente pulado não custa nenhuma solicitação de decisão. Perguntas com a mesma profundidade de busca são agrupadas por fase.
- **Scan Depth** define as mensagens usadas tanto pelas palavras-chave quanto pela pergunta.
- Agentes de pré-geração e paralelos usam o chat antes da resposta. Agentes de pós-processamento também veem a resposta concluída.
- Tempo esgotado, modelo indisponível ou resposta inválida deixam o agente rodar normalmente. O tempo limite depende do tipo de modelo e de o modelo precisar pensar antes. Veja [Tempos limite](../connections/decision-models.md#time-limits).
- Agentes importados com pergunta de ativação ou declarações de decisão mostram um aviso com link para o guia de modelos de decisão. Sem modelo de decisão, o agente roda sempre que as palavras-chave e a **Trigger Cadence** permitirem, e as declarações no prompt valem não.

As perguntas de ativação valem só para agentes personalizados.

<a id="decision-statements-in-the-agents-prompt"></a>

## Declarações de decisão no prompt do agente

Uma pergunta de ativação decide se o agente roda. Uma declaração de decisão no **Prompt Template** decide o que um agente em execução recebe como instrução. A sintaxe está em [Prompts condicionais](../prompts/conditional-prompts.md#asking-the-decision-model):

```text
{{#if decision:"In the latest message, the characters move to a different location"}}
Update the location field.
{{else}}
Leave the location as it is.
{{/if}}
```

Use-as para enviar um prompt menor nos turnos tranquilos. Um tracker pode atualizar o local só quando ele mudou. Um agente de imagens pode descrever uma nova imagem só quando a cena mudou. Um agente de música pode trocar de faixa só quando o clima mudou. Para escolher um entre vários conjuntos de instruções, use `{{#if decision_choice:"The kind of scene in the latest message" == "combat"}}`, depois `{{else if decision_choice:"The kind of scene in the latest message" == "dialogue"}}`, e assim por diante. Veja [Prompts condicionais](../prompts/conditional-prompts.md#asking-the-decision-model).

- Agentes de pré-geração e paralelos leem o chat antes da resposta e compartilham as respostas com o prompt principal. Agentes de pós-processamento leem a resposta concluída, e as declarações deles são perguntadas de novo com ela.
- Rodar um agente novamente reutiliza respostas bem-sucedidas ainda em cache para o mesmo turno, modelo e declarações. Veja [Reutilização de respostas](../prompts/conditional-prompts.md#answer-reuse).
- No prompt de um agente, `{{char}}` nomeia todos os personagens do chat, então, em um grupo, `{{char}} is angry` vira "Kaelen, Alyssa is angry". Nomeie o personagem ou escreva "a character".
- Sem resposta, uma declaração vale não. Deixe o ramo `{{else}}` sensato, porque muitos usuários não têm modelo de decisão.

Agentes instalados pelo Marinara-Agents processam os prompts da mesma forma.

## Guias relacionados

- [Agentes: ajudantes de IA para os seus chats](agents-overview.md)
- [Modelos de decisão](../connections/decision-models.md)
- [Referência dos agentes para download](built-in-agents.md)
- [Ferramentas personalizadas](../extending/custom-tools.md)
- [Macros](../prompts/macros.md)
