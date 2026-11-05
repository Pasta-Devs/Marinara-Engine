# Aprovações de agentes e o Agent Suite

Os agentes podem escrever no seu chat: entradas de lorebook, resumos e edições de card de personagem. Este guia mostra como revisar essas escritas antes que elas sejam salvas e como ler e corrigir o que os agentes salvaram, com o **Agent Suite** (conjunto de agentes).

## Revise as escritas dos agentes antes de salvar

Por padrão, algumas escritas dos agentes são salvas sozinhas. **Review Agent Outputs** (revisar as saídas dos agentes) faz cada uma delas esperar a sua aprovação.

1. Abra o chat e clique em **Chat Settings** (configurações do chat).
2. Desça até a seção **Agents**.
3. Em um chat de Roleplay, abra **Trackers Control** (controle dos trackers). No Game Mode, pule esta etapa.
4. Ative **Review Agent Outputs**.

Com a opção ativada, as atualizações de lorebook, as atualizações de resumo e as demais saídas revisáveis dos agentes de escrita esperam por você. Com ela desativada, as atualizações de lorebook e de resumo podem ser salvas automaticamente.

As edições no card de personagem sempre pedem a sua aprovação antes, mesmo com **Review Agent Outputs** desativado. Essa verificação não pode ser desligada.

### Revise uma atualização de lorebook ou de resumo

Quando um agente propõe uma escrita, abre-se uma janela com o título **Review Lorebook Update** ou **Review Summary Update**. Ela mostra o nome do agente e uma caixa **Proposed Text** (texto proposto) que você pode editar. Nas escritas de lorebook, ela também lembra você de manter cada entrada sob um título `###`.

- **Accept** salva o texto, com as suas edições.
- **Regenerate** roda de novo só aquele agente, para obter uma proposta nova.
- **Discard** descarta a proposta sem salvar.

Se houver mais propostas esperando, a janela mostra quantas. Quando você termina a atual, ela reabre com a próxima.

Um agente com a habilidade **Create character cards** (criar cards de personagem) também pode propor um card de personagem novo. Ele abre uma janela de revisão com o texto do card. Nada é salvo até você aceitar.

### Revise uma atualização do card de personagem

O agente **Card Evolution Auditor** sugere edições em um card de personagem de acordo com o que aconteceu no roleplay. No Conversation, a ferramenta interna `update_about_me` também pode propor uma mudança no About Me público. Nenhum dos dois edita o card por conta própria. Os dois abrem a janela **Review Character Card Updates**.

Em cada edição proposta, a janela mostra o campo do card afetado, um motivo curto quando o agente informa um, um bloco **Before** com o texto atual e uma caixa **After** que você pode editar.

- **Approve** aplica as edições. O número no botão é quantas serão aplicadas. A aprovação aumenta o número de versão do personagem e salva uma entrada no histórico de versões.
- **Regenerate** roda o agente de novo, para obter propostas novas.
- **Reject** descarta as propostas sem mexer no card.

Se o card mudou depois que o agente escreveu a proposta, a edição fica marcada como desatualizada e esmaecida. Aparece então um botão **Override stale** com a contagem. Use-o só se você ainda quiser aquele texto. Marinara pede uma confirmação e depois acrescenta o texto desatualizado ao campo, em vez de substituir um texto que já não corresponde.

## Veja e edite o que os agentes salvaram

O **Agent Suite** mostra tudo o que os agentes deste chat salvaram: os dados dos trackers, como a cena atual, os personagens presentes e os atributos da persona, além da saída salva dos agentes personalizados. Use-o para corrigir um nome errado, ajustar um atributo ou organizar um texto bagunçado.

1. Abra **Chat Settings** e desça até **Agents**.
2. Clique em **Agent Suite**.
3. Escolha um agente na lista à esquerda.

O lado direito mostra blocos editáveis em até três grupos: **Stored Memory**, **Tracker Data** (só para agentes tracker) e **Recent Outputs** (só para agentes personalizados). Os agentes que não acompanham dados mostram apenas **Stored Memory**.

Cada bloco é um editor de texto ou de JSON. Os blocos JSON mostram números de linha e avisam na hora quando o JSON é inválido. **Save** (salvar) fica desativado até o JSON poder ser lido. Para buscar em todos os dados do tracker ou editá-los como campos, clique em **Open in State Editor** no cabeçalho de **Tracker Data**. Veja [O State Editor](../roleplay/hud-and-trackers.md#the-state-editor).

Depois de alterar um bloco, clique em **Save** para manter a alteração ou em **Reset** para voltar ao valor salvo.

### Deixe a IA reescrever um bloco

1. Clique em **AI Edit** no bloco.
2. Para mudar só uma parte dele, selecione esse texto antes. Sem nenhuma seleção, o bloco inteiro é reescrito.
3. Digite uma instrução, por exemplo "corrija os nomes de personagem embaralhados, ela se chama Mira".
4. Opcional: clique em **Add Context** para anexar cards de personagem ou entradas de lorebook, para que a IA saiba o que os dados significam.
5. Escolha a conexão (o serviço de IA e o modelo) que faz a reescrita.
6. Clique em **Rewrite**.

O resultado entra no bloco como rascunho não salvo. Revise e depois use **Save** ou **Reset**.

- Enquanto ainda houver agentes rodando neste chat, o salvamento espera até eles terminarem.
- **Clear memory** (limpar a memória) só aparece em **Stored Memory** quando o agente tem dados salvos. Ele exclui de uma vez tudo o que aquele agente salvou neste chat e não pode ser desfeito. Marinara pede uma confirmação antes.
- No **Narrative Director**, os spoilers salvos ficam ocultos. Use **Reveal spoilers** para vê-los e editá-los.

## Veja as inserções de prompt em cache

Antes de uma resposta ser gerada, alguns agentes de escrita acrescentam texto ao prompt. Isso é comum em **Prose Guardian**, **Narrative Director** e nos agentes de inserção personalizados. O painel **Cached prompt injections** (inserções de prompt em cache) mostra esse texto para a resposta mais recente. É uma tela de diagnóstico.

Antes de começar: ative o **Debug mode** (modo de depuração). Veja [Agentes: ajudantes de IA para os seus chats](agents-overview.md#tell-whether-an-agent-ran). Em um chat de Roleplay, abra a aba **Injections** de **Agent activity**. Veja [Agent activity](../roleplay/getting-started.md#agent-activity).

Em cada inserção, você pode expandi-la para ler e editar o texto, clicar no ícone **Save** para manter a edição ou clicar no ícone **Re-run** para que aquele agente escreva uma nova.

As inserções de **Knowledge Retrieval** e **Knowledge Router** não podem ser executadas de novo aqui. As edições e as novas execuções só têm efeito se você regenerar aquela mesma resposta. Uma nova execução usa o histórico do chat daquele ponto, e não mensagens mais recentes.

## Guias relacionados

- [Agentes: ajudantes de IA para os seus chats](agents-overview.md)
- [Referência dos agentes para download](built-in-agents.md)
- [Criando e editando personagens](../characters/creating-and-editing-characters.md)
