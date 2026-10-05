# Aprovações de agentes e o Agent Suite

Neste guia você aprende a revisar e controlar o que os agentes (pequenos ajudantes de IA que trabalham junto com as respostas) escrevem durante um chat. Aqui estão explicados o botão liga/desliga **Review Agent Outputs** (revisar as saídas dos agentes), as duas janelas de revisão, o editor **Agent Suite** (conjunto de agentes) e o painel **Cached prompt injections** (inserções de prompt em cache).

## Review Agent Outputs

Alguns agentes querem escrever dados novos no chat. Um agente de lorebook pode adicionar entradas ao lorebook. Um agente de resumo pode salvar um resumo do chat. Por padrão, parte dessas escritas é salva automaticamente. Com o botão liga/desliga **Review Agent Outputs**, você confere cada escrita antes.

Para achar essa opção:

1. Abra o chat que você quer controlar.
2. Abra **Chat Settings** (configurações do chat).
3. Desça até a seção **Agents**.
4. Ative **Review Agent Outputs**.

Com **Review Agent Outputs** ativado, as atualizações de lorebook, as atualizações de resumo e as demais saídas revisáveis dos agentes de escrita esperam a sua aprovação antes de serem salvas. Com a opção desativada, as atualizações de lorebook e de resumo podem ser salvas automaticamente.

As edições no card de personagem são um caso à parte. Elas sempre pedem a sua aprovação antes, mesmo com **Review Agent Outputs** desativado. Essa verificação de segurança não pode ser desligada.

## A janela Agent Write Approval

Quando **Review Agent Outputs** está ativado e um agente propõe uma escrita de lorebook ou de resumo, abre-se uma janela de revisão. O título dela é **Review Lorebook Update** ou **Review Summary Update**, de acordo com o tipo de escrita.

A janela mostra:

- O nome do agente que fez a proposta.
- Uma caixa **Proposed Text** (texto proposto), que você pode editar antes de salvar.
- Nas escritas de lorebook, um lembrete curto para manter cada entrada sob um título `###`.

Na parte de baixo da janela, há três opções:

- **Accept**: salva o texto no chat, com as edições que você tiver feito.
- **Regenerate**: roda de novo só aquele agente, para obter uma proposta nova.
- **Discard**: descarta a proposta sem salvar nada.

Se houver mais de uma proposta esperando, a janela mostra quantas ainda estão na fila. Assim que você resolve a atual, ela reabre com a próxima.

## Revisão de Character Card Update

O agente **Card Evolution Auditor** pode sugerir edições nos campos do card de personagem, de acordo com o que aconteceu durante o roleplay. A ferramenta interna `update_about_me` do Conversation Mode também pode propor uma mudança no About Me público. Nenhum dos dois caminhos edita o card por conta própria: os dois abrem a janela **Review Character Card Updates**, e quem decide é você.

A janela lista cada edição proposta. Em cada edição, você vê:

- O campo do card afetado (por exemplo, description, personality ou appearance).
- Um motivo curto para a mudança, quando o agente informa um.
- Um bloco **Before** com o texto atual.
- Uma caixa **After** com o texto novo. Esse texto pode ser editado antes da aprovação.

Você tem estas ações:

- **Approve**: aplica as edições. O número no botão mostra quantas edições serão aplicadas. A aprovação aumenta o número de versão do personagem e salva uma entrada no histórico de versões.
- **Regenerate**: roda o agente de novo, para obter um conjunto novo de propostas.
- **Reject**: descarta as propostas sem mexer no card.

Às vezes o card muda depois que o agente escreveu a proposta. Nesse caso, Marinara marca a edição como **stale** (desatualizada) e a deixa esmaecida. Havendo edições desatualizadas, aparece um botão **Override stale** com a contagem. Use esse botão só se você ainda quiser manter aquele texto. Marinara pede uma confirmação antes. Em seguida, o texto desatualizado é acrescentado ao campo, em vez de substituir um texto que já não corresponde.

## O editor Agent Suite e a reescrita com ajuda da IA

Com o **Agent Suite**, você vê e edita tudo o que os agentes deste chat salvaram. Isso inclui os dados dos trackers (agentes de acompanhamento), como a cena atual, os personagens presentes e os atributos da persona, além da saída salva dos seus agentes personalizados. Corrija um nome errado, ajuste um atributo ou organize um texto salvo bagunçado, na mão ou com ajuda da IA.

Para abrir:

1. Abra **Chat Settings**.
2. Desça até a seção **Agents**.
3. Clique em **Agent Suite**.

À esquerda fica a lista dos agentes ativos neste chat. Escolha um para ver o que ele salvou. O lado direito mostra blocos editáveis, reunidos em **Stored Memory** (memória salva), **Tracker Data** (dados do tracker, só para agentes tracker) e **Recent Outputs** (saídas recentes, só para agentes personalizados). Os agentes que não acompanham dados mostram apenas **Stored Memory**.

Cada bloco é um editor de texto ou de JSON. Depois de alterar um bloco:

- Clique em **Save** para manter a edição.
- Clique em **Reset** para desfazer a alteração não salva e voltar ao valor salvo.

A IA também pode reescrever um bloco para você:

1. Clique em **AI Edit** no bloco que você quer mudar.
2. Para atuar só sobre uma parte do texto, selecione essa parte no editor antes. Sem nenhuma seleção, o bloco inteiro é reescrito.
3. Digite uma instrução, por exemplo "corrija os nomes de personagem embaralhados, ela se chama Mira".
4. Opcional: clique em **Add Context** para anexar cards de personagem ou entradas de lorebook. Isso ajuda a IA a entender o que os dados significam.
5. Escolha a conexão (o provedor de IA e o modelo) que fará a reescrita.
6. Clique em **Rewrite**.

O texto reescrito entra no bloco como rascunho não salvo. Revise e depois clique em **Save** para mantê-lo ou em **Reset** para descartá-lo.

Algumas observações:

- Se ainda houver agentes rodando neste chat, o salvamento fica pausado até eles terminarem.
- A seção **Stored Memory** tem um botão **Clear memory** (limpar a memória). Ele só aparece quando o agente tem dados salvos. Esse botão exclui de uma vez tudo o que aquele agente salvou neste chat, sem volta. Marinara pede uma confirmação antes.
- No **Narrative Director**, os spoilers salvos ficam ocultos. Use **Reveal spoilers** para vê-los e editá-los.

## Painel Cached prompt injections

Antes de a resposta ser gerada, alguns agentes de escrita acrescentam texto ao prompt (o texto que Marinara envia para a IA). Isso é comum em **Prose Guardian**, **Narrative Director** e nos agentes de inserção personalizados. O painel **Cached prompt injections** é uma tela de diagnóstico desse texto acrescentado. Ele fica na aba **Injections** de [Agent activity](../roleplay/getting-started.md#agent-activity) no Roleplay, quando **Debug mode** está ativado. Ele cobre a resposta mais recente.

Em cada inserção em cache, você pode:

- Expandir a inserção para ler e editar o texto.
- Clicar no ícone **Save** para manter a edição.
- Clicar no ícone **Re-run** para que aquele agente escreva uma inserção nova.

As inserções de **Knowledge Retrieval** e **Knowledge Router** não podem ser refeitas por esse painel. As suas edições e execuções novas só têm efeito se você regenerar aquela mesma resposta. Uma execução nova usa o histórico do chat daquele ponto, e não as mensagens mais recentes.

## Guias relacionados

- [Agentes: ajudantes de IA para os seus chats](agents-overview.md)
- [Referência dos agentes para download](built-in-agents.md)
- [Criando e editando personagens](../characters/creating-and-editing-characters.md)
