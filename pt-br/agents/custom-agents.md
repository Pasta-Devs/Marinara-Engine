# Como criar agentes personalizados

Neste guia você aprende a montar o seu próprio agente no Marinara Engine. Um agente é um pequeno ajudante de IA que roda sozinho, junto com o chat. Aqui você vê como definir a fase, os poderes, o tipo de resultado, as palavras-chave de ativação, as ferramentas e o prompt (o texto que Marinara envia para a IA), com um exemplo completo no final.

Nunca mexeu com agentes? Leia antes [Agentes: ajudantes de IA para os seus chats](agents-overview.md) para pegar o básico e depois volte para cá.

## Quando vale a pena criar um agente personalizado

Marinara Engine oferece vários agentes oficiais prontos para baixar. Confira a [Referência dos agentes para download](built-in-agents.md) e o repositório público de pacotes [Pasta-Devs/Marinara-Agents](https://github.com/Pasta-Devs/Marinara-Agents) antes de criar o seu. Talvez um agente do catálogo já faça o que você quer, e os manifestos oficiais servem de exemplo funcional de pacote.

Crie um agente personalizado quando precisar de algo que os agentes prontos não cobrem. Alguns bons motivos:

- Você quer um ajudante com instruções e voz próprias.
- Você quer inserir uma anotação específica em todo prompt.
- Você quer reescrever cada resposta em um estilo determinado.
- Você quer que um agente chame uma ferramenta feita por você.

Se algum agente oficial já instalado chegar perto, copie ele. No painel **Agents** (agentes), passe o mouse sobre o card e clique em **Copy agent**. Assim você ganha uma cópia personalizada e editável.

## Antes de começar

Dois pontos importam antes da montagem:

1. Os agentes são definidos por chat, não por personagem. Criar um agente na biblioteca não coloca ele para rodar. É preciso adicionar o agente a um chat e ativar a opção **Enable Agents** em **Chat Settings** (configurações do chat).
2. Os agentes personalizados funcionam em todos os modos de chat: Roleplay, Game Mode e Conversation. Os pacotes oficiais aparecem só nos modos compatíveis, enquanto os seus agentes personalizados ficam disponíveis em qualquer lugar.

## Como criar um agente personalizado

Siga estes passos para criar um agente personalizado do zero.

1. Abra o painel **Agents**.
2. Clique no botão **New** (o ícone de mais) perto do topo.
3. O editor de agentes abre em tela cheia, com um agente personalizado em branco.
4. Digite um nome no campo de título, no topo. Por exemplo, `Weather Reporter`.
5. Preencha os campos **Description** (descrição) e **Author** (autor) para lembrar o que o agente faz.
6. Escolha uma **Pipeline Phase** (fase do fluxo), explicada mais adiante.
7. Ative os poderes necessários na seção **Custom Agent Abilities**.
8. Escolha um **Result Type** (tipo de resultado) que combine com o que o agente deve produzir.
9. Escreva as instruções do agente no campo **Prompt Template**.
10. Clique em **Save** na barra superior. Um selo verde escrito **Saved** deve aparecer.

O novo agente passa a aparecer na seção **Custom Agents** do painel **Agents**. Para usar o agente, abra um chat, vá em **Chat Settings**, ative a opção **Enable Agents** e adicione o agente pela seção **Custom Agents** de lá.

## Pipeline Phase

A **Pipeline Phase** define quando o agente roda. Escolha um dos três botões:

- **Pre-Generation**: roda antes da resposta da IA. Pode acrescentar contexto ou alterar o prompt.
- **Parallel**: roda ao mesmo tempo que a resposta. Não enxerga a resposta pronta.
- **Post-Processing**: roda depois que a resposta termina. Consegue ler a resposta e, em alguns tipos de resultado, editar ela.

Certos tipos de resultado forçam uma fase. Se você escolher **Text Rewrite**, a fase muda para **Post-Processing**. Se escolher **Prompt Patch**, a fase muda para **Pre-Generation**. Isso acontece porque essas tarefas só fazem sentido naquela fase.

Os agentes personalizados de Post-Processing ganham também uma seção **Turn Data Access**. Ela traz dois botões liga/desliga opcionais: **Pre-generation injections** e **Parallel agent results**. Ative os dois para que o agente leia o que os outros agentes produziram no mesmo turno. Deixe desativados para manter o agente isolado.

## Custom Agent Abilities

**Custom Agent Abilities** são poderes que você precisa ativar. Cada poder fica bloqueado até você ligar o botão correspondente. Com isso, um agente personalizado nasce seguro. Os poderes disponíveis são:

| Poder | O que o agente passa a fazer |
|---|---|
| **Create lorebooks** | Criar um lorebook (um conjunto de fatos do seu mundo) feito pelo próprio agente quando a saída de lore não tem destino. |
| **Edit lorebooks** | Escrever entradas de lorebook ou gerar resultados de atualização de lorebook. |
| **Edit messages** | Substituir o texto da mensagem gerada por um texto reescrito, ou acrescentar opções de continuação a ele. |
| **Edit trackers** | Atualizar o estado dos trackers (agentes de acompanhamento) de jogo, de personagem, de persona ou personalizados. |
| **Frontend styling** | Aplicar um efeito visual temporário durante a geração. |
| **Change chat backgrounds** | Trocar e manter salvo o plano de fundo escolhido para um chat. |
| **Change character sprites** | Trocar as expressões de personagem e de persona mostradas no chat. |
| **Control media playback** | Controlar a reprodução no Spotify, no YouTube ou da música local. |
| **Control haptic devices** | Enviar comandos limitados para um dispositivo háptico conectado. |
| **Edit About Me details** | Alterar o texto de About Me específico do chat. Mudanças no card público continuam exigindo aprovação separada. |
| **Image generation** | Acionar o gerador de imagens com um prompt de imagem. |
| **Vectors/embeddings** | Usar contexto de vetores ou embeddings. Vetores são uma forma de buscar texto por significado. |
| **Main prompt edits** | Editar o prompt enviado ao modelo principal de IA. |

Um lorebook é um conjunto de anotações de fundo que a IA pode puxar para dentro de uma cena. Um tracker é um painel ao vivo que guarda fatos como atributos, humor ou local.

Ao ativar **Edit lorebooks**, surge uma seção **Lorebook Writer**. Ative a opção **Allow lorebook entry writes** e escolha um lorebook no menu suspenso **Target lorebook**. O agente só consegue escrever naquele lorebook.

## Result Type

O **Result Type** diz a Marinara como interpretar a saída do agente. A maioria dos tipos de resultado espera que o agente devolva JSON. JSON é um formato de texto simples, escrito com chaves e aspas. Cada tipo de resultado exige o poder correspondente da tabela acima.

| Result Type | O que faz | Poder necessário |
|---|---|---|
| **Context Injection** | Acrescenta texto antes da geração ou registra uma anotação depois dela. | Nenhum |
| **Text Rewrite** | Roda depois da resposta e substitui o texto da mensagem. | Edit messages |
| **Lorebook Update** | Cria ou atualiza entradas de lorebook. | Edit lorebooks |
| **Character Tracker** | Atualiza o tracker de personagem (personagens presentes). | Edit trackers |
| **Persona Stats** | Atualiza atributos, status e inventário da persona. | Edit trackers |
| **Custom Tracker** | Substitui os campos do seu tracker personalizado. | Edit trackers |
| **Game State** | Atualiza dados de jogo no estilo estado do mundo. | Edit trackers |
| **Image Prompt** | Pede ao gerador de imagens que desenhe uma cena. | Image generation |
| **Prompt Patch** | Acrescenta, insere no início ou substitui seções do prompt. | Main prompt edits |
| **Frontend Style** | Aplica um efeito visual temporário. | Frontend styling |
| **Background Change** | Escolhe e mantém salvo um plano de fundo de chat disponível. | Change chat backgrounds |
| **Sprite Change** | Troca as expressões de personagem e de persona mostradas no chat. | Change character sprites |
| **Spotify Control** | Controla a reprodução no Spotify. | Control media playback |
| **YouTube Control** | Controla a reprodução no YouTube. | Control media playback |
| **Local Music Control** | Controla a reprodução da sua coleção de música local. | Control media playback |
| **Haptic Command** | Envia um comando limitado a um dispositivo háptico conectado. | Control haptic devices |
| **About Me Update** | Atualiza o texto de About Me específico do chat e propõe edições públicas. | Edit About Me details |
| **Interactive Choices** | Acrescenta opções de continuação à mensagem gerada. | Edit messages |

**Context Injection** é o ponto de partida mais tranquilo. Não exige nenhum poder ativado nem um formato de saída rígido. Use quando quiser apenas que o agente acrescente uma anotação curta ao prompt ou registre um resumo.

Um tipo de resultado acinzentado indica que o poder dele ainda não foi ativado. Ligue o botão correspondente em **Custom Agent Abilities** e o tipo de resultado fica clicável.

### Controles por chat para agentes de imagem

Um agente com a capacidade **Image generation** recebe dois controles adicionais em seu cartão em **Chat Settings → Agents → Custom Agents**, junto ao seletor de modelo de prompt que todo agente personalizado possui:

- **Image Connection** — substitui apenas neste chat a conexão de imagem usada pelo agente. Deixe em **Agent default** para manter a conexão das configurações do próprio agente. A seleção **Image Style** do chat também vale para imagens de agentes personalizados, permitindo que o mesmo agente renderize de forma diferente em cada chat sem ser duplicado.
- **Camera button** — gera uma imagem com o agente imediatamente, sem esperar pelas palavras de ativação. O agente ainda escreve o próprio prompt; se o modelo dele decidir não produzir um, uma notificação de erro aparece no lugar da imagem.

## Activation Keywords

Por padrão, um agente personalizado roda no ritmo normal dele. A seção **Activation Keywords** permite pular o agente quando a cena não é relevante. Isso economiza tokens e dinheiro. Um token é um pedacinho de texto que a IA conta.

Para configurar:

1. Na seção **Activation Keywords**, digite uma palavra-chave ou frase por linha. Por exemplo:

```
tavern
secret door
moonlit ritual
```

2. Ajuste a opção **Scan Depth** para a quantidade de mensagens recentes a pesquisar. O padrão é 5. O máximo é 200.
3. A partir daí, o agente roda só quando pelo menos uma palavra-chave aparece nessas mensagens recentes.

Deixe a caixa de palavras-chave vazia para rodar o agente sempre, no ritmo normal dele.

## Como anexar ferramentas (Function Calling)

O agente pode chamar ferramentas. Uma ferramenta é uma função que a IA executa para buscar ou alterar alguma coisa e depois ler o resultado. Isso também se chama function calling.

Para anexar ferramentas, abra a seção **Tools / Function Calling** e ative ou desative cada ferramenta. A lista traz as ferramentas nativas e todas as ferramentas personalizadas que você criou. Para aprender a criar as suas, leia [Ferramentas personalizadas](../extending/custom-tools.md).

As ferramentas só funcionam se o próprio chat permitir. Em **Chat Settings**, abra a seção **Function Calling** e ative a opção **Enable Tool Use**. Sem essa configuração no chat, as ferramentas do agente continuam desligadas mesmo que você ative elas aqui.

Arquivos de agente importados não concedem acesso a ferramentas. Depois de importar um agente, examine o prompt e as configurações dele e então selecione você mesmo as ferramentas que quer liberar.

## Named prompt options

Um único agente pode guardar várias variações de prompt. É o recurso **Named prompt options**. Assim, cada chat escolhe uma variação sem que você precise editar o agente para todo mundo.

Para acrescentar uma variação:

1. Em **Prompt Template**, localize a seção **Named prompt options**.
2. Clique em **Add option**.
3. Dê à opção um nome e uma descrição curta.
4. Escreva o corpo completo do prompt dessa opção.

Quando alguém adicionar o seu agente a um chat, aparece um menu suspenso **Prompt Mode** com as opções nomeadas. Se você não criar nenhuma, o menu do chat mostra só o prompt padrão.

## Outras configurações que você pode ajustar

Os agentes personalizados compartilham algumas configurações com os agentes prontos:

- **Connection Override**: escolhe uma conexão de IA diferente para este agente. Por exemplo, use um modelo mais barato para o trabalho de bastidor. Deixe vazio para usar a conexão do chat.
- **Agent Budget**: define **Context Size** (quantas mensagens recentes o agente lê; o padrão é 5). Define também **Max Output Tokens** (o espaço de saída reservado; o padrão é 4096, de 128 a 32768).
- **Add as Prompt Section**: ative para expor a última saída do agente como uma seção que você pode inserir em um preset de prompt.

Macros como `{{user}}` e `{{char}}` funcionam dentro do campo **Prompt Template**. Veja a lista completa em [Macros](../prompts/macros.md).

## Um exemplo completo

Este é um agente personalizado inteiro, que reescreve cada resposta em inglês britânico.

Configuração no editor:

1. Dê a ele o nome `British English Editor`.
2. Em **Custom Agent Abilities**, ative a opção **Edit messages**.
3. Em **Result Type**, escolha **Text Rewrite**. A fase muda sozinha para **Post-Processing**.
4. Cole isto no campo **Prompt Template**:

```
You are a copy editor. Rewrite the latest reply into British English.
Change spelling and vocabulary only. Do not change the meaning, tone, or events.
Return JSON with an "editedText" field holding the full rewritten reply,
and a "changes" array of short notes describing what you changed.
```

5. Clique em **Save**.
6. Abra um chat de Roleplay, vá em **Chat Settings**, ative a opção **Enable Agents** e adicione `British English Editor` pela seção **Custom Agents**.

Depois de cada resposta, o agente devolve um JSON parecido com este:

```
{"editedText":"The colour of the harbour caught her eye.","changes":[{"description":"color to colour, harbor to harbour"}]}
```

Marinara lê o campo `editedText` e coloca ele no lugar da resposta. A mensagem aparece em inglês britânico. As anotações de `changes` viram um resumo curto do que o agente ajustou.

## Como importar e exportar agentes

Um agente personalizado pode ser compartilhado em forma de arquivo.

Para exportar pelo editor, clique no botão **Export agent** (o ícone de upload) na barra superior. Isso salva o prompt e a configuração do agente como um pacote. Os pacotes de agente nunca incluem definições de ferramentas personalizadas.

Para exportar vários agentes de uma vez, use a opção **Select agents** no painel **Agents**, escolha os agentes desejados e exporte o conjunto.

A importação de agentes externos vem bloqueada por padrão. Abra **Settings → Advanced → Danger Zone** e ative antes a opção **Allow custom Agent imports**. Esse botão não exige nenhuma alteração no arquivo `.env`. Ele afeta apenas os agentes vindos de arquivos, pastas ou repositórios personalizados: os agentes que você cria no Marinara e os agentes oficiais instalados por **Download Agents** continuam disponíveis normalmente.

Para importar, abra o painel **Agents** e clique em **Import agents** para um arquivo único, ou em **Import agent folder** para escolher uma pasta inteira. Marinara mostra uma revisão de permissões antes de guardar qualquer coisa. Aprove só os poderes de que o agente precisa; os poderes não marcados continuam bloqueados. Cada arquivo importado recebe uma nova identidade personalizada, então não consegue substituir um agente curado do mesmo tipo interno.

Por segurança, Marinara ignora funções embutidas no pacote, limpa as ferramentas selecionadas nas configurações importadas, higieniza o CSS temporário antes de aplicar e confere os poderes aprovados antes que um agente importado altere mensagens, trackers, lorebooks, planos de fundo, sprites, mídia, dispositivos hápticos, dados de About Me, prompts ou imagens geradas. Importe funções confiáveis separadamente, pela seção **Function Calls**, revise essas funções e só depois anexe elas ao agente de forma explícita. Ao desligar de novo o botão da Danger Zone, os agentes importados de fora param de rodar; os agentes criados localmente e os oficiais não são afetados.

## Guias relacionados

- [Agentes: ajudantes de IA para os seus chats](agents-overview.md)
- [Referência dos agentes para download](built-in-agents.md)
- [Ferramentas personalizadas](../extending/custom-tools.md)
- [Macros](../prompts/macros.md)
