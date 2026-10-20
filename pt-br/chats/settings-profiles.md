# Perfis de configurações

O perfil de configurações é um pacote com nome que reúne configurações reutilizáveis do chat. Ele pode conter a conexão, o preset de prompt, os agentes, as ferramentas, a tradução, a Memory Recall, os parâmetros avançados e outras opções de cada chat. Aplique o perfil em outro chat em vez de configurar tudo de novo.

Os perfis ficam no topo da seção **Chat Settings** (configurações do chat). Eles funcionam nos modos Conversation e Roleplay. Game Mode não mostra esses controles.

## Perfis de configurações e presets de prompt

Marinara usa a palavra **preset** só para os modelos de prompt salvos:

- O **preset de prompt** define a estrutura do prompt de sistema e os parâmetros de geração. A edição acontece no painel Presets. Veja [Editor de presets e gerenciador de prompts](../prompts/presets.md).
- O **perfil de configurações** é a configuração reutilizável mais ampla. Ele pode incluir o preset de prompt escolhido junto com a conexão, os agentes e outras configurações do chat.

Ou seja, o preset de prompt pode ser apenas um dos itens dentro de um perfil de configurações.

## O que o perfil inclui

O perfil salva a forma como o chat conversa com a IA:

- Conexão
- Preset de prompt (chamado de fonte do prompt no Conversation Mode)
- Agentes e ferramentas
- Tradução
- Memory Recall
- Advanced Parameters
- Layout de janelas e botões: posições e tamanhos das janelas, fixações e travas, ferramentas dentro ou fora de Chat Settings, janelas de controles abertas e posições dos botões no computador e no celular. Perfis sem layout salvo, como **Default**, mantêm o layout do chat.
- Se as dicas de layout de Chat Settings estão ocultas. Aplicar **Default** ou um perfil antigo sem essa escolha mostra as dicas novamente.
- Outras opções reutilizáveis do chat

O perfil não substitui o conteúdo que pertence ao chat, como personagens, persona, lorebooks, sprites, resumo, tags ou prompt da cena. Ele também não salva o histórico da conversa nem o estado em andamento de um chat, como as variáveis de macro, os personagens que você desativou nele ou a sala multijogador dele.

## Como aplicar um perfil

O menu suspenso de perfis fica no topo da seção **Chat Settings**. A dica dele diz **Apply a settings profile to this chat**.

1. Abra o chat que você quer alterar.
2. Abra a seção **Chat Settings**.
3. Abra o menu suspenso **Profile**.
4. Escolha um perfil pelo nome.

O chat muda na hora. Se o perfil liga ou desliga **Hide summarised messages** (ocultar as mensagens resumidas), as mensagens resumidas do chat ficam ocultas para a IA, ou voltam a aparecer para ela, no mesmo momento. Quando os valores atuais não batem com nenhum perfil salvo, o menu mostra **Custom settings profile**. Se um perfil aplicado antes não existe mais, aparece **Missing profile - choose a profile**.

## Como salvar um perfil

A linha de ícones embaixo do menu suspenso traz estas ações:

| Botão | Dica | Resultado |
|---|---|---|
| Save | **Save current chat settings into this profile** | Substitui os valores salvos no perfil selecionado |
| Rename | **Rename profile** | Muda o nome do perfil selecionado |
| Save As | **Save current chat settings as a new profile** | Cria outro perfil a partir do chat atual |
| Import | **Import settings profile (.json)** | Carrega um arquivo de perfil |
| Export | **Export settings profile (.json)** | Baixa o perfil selecionado |
| Delete | **Delete profile** | Exclui o perfil selecionado de vez |

Para criar o primeiro perfil, ajuste um chat do jeito que você quer e escolha **Save current chat settings as a new profile**. Para atualizá-lo depois, aplique o perfil, mude o chat e escolha **Save current chat settings into this profile**.

### Como atualizar outros chats que usam o perfil

Cada chat guarda a própria cópia das configurações do perfil, então salvar um perfil não muda os outros chats por si só. Quando outros chats do mesmo modo usam o perfil, salvar pergunta o que fazer:

- **Save to this profile only** (salvar só neste perfil) salva o perfil e deixa os outros chats como estão.
- **Save and update** (salvar e atualizar), seguido do número de chats, como em **Save and update 3 other chats**, também copia para esses chats as configurações de Chat Settings do perfil. As mudanças que esses chats tinham nessas configurações são substituídas, e uma configuração que você deixou no padrão no chat de onde salva também volta ao padrão neles.

**Save and update** copia:

- Opções de geração e de contexto
- Opções de chat em grupo
- Botões liga/desliga de recursos e de comandos
- Agentes e as opções deles
- Configurações de memória e de resumo
- Tradução
- O layout das janelas

Todo o resto continua como cada chat tem, inclusive:

- A conexão, o preset de prompt e o prompt personalizado
- A história e os personagens
- Os lorebooks e o plano de fundo
- As notas e o progresso
- Quais comandos de Roleplay só o narrador do chat pode usar
- Se o Noodle pode usar as mensagens do chat

Advanced Parameters e a descrição de imagens (ligada ou desligada, e qual conexão descreve as imagens) só mudam nos chats que usam a conexão do perfil, porque são definidos para essa conexão. As agendas de personagem só mudam se foram ligadas ou desligadas no chat de onde você salva; caso contrário, cada chat mantém a própria escolha. Knowledge Retrieval, Knowledge Router, Lorebook Keeper e Expression Engine continuam ligados ou desligados, com os seus modelos de prompt, como cada chat os tem. Cada chat escolhe por conta própria as fontes, o lorebook ou os sprites deles.

As salas multijogador nunca são atualizadas dessa forma. Quando nenhum outro chat usa o perfil, **Save** (salvar) funciona sem perguntar.

## Como escolher o perfil padrão

A estrela ao lado do menu suspenso marca o perfil usado automaticamente nos chats novos daquele modo. Cada modo tem um único perfil padrão.

As dicas da estrela descrevem o estado atual:

- **Mark this profile as default for new chats in this mode**
- **This profile is the default for new chats in this mode**
- **Select a profile to mark it as default**

## Layouts de janelas favoritos

A estrela ao lado de **Reset View** na barra de título de Chat Settings salva um layout favorito para novos chats no modo atual. Ela também lembra se você ocultou as dicas de layout. Você pode usá-la em Conversation, Roleplay e Game. A estrela ao lado do menu **Profile** continua escolhendo o perfil de configurações padrão.

Ao atualizar uma instalação existente, a disposição conhecida dos botões de ferramentas vira o favorito para novos chats nos três modos. Isso acontece uma vez e respeita qualquer favorito que você já tenha salvo ou limpado. O layout continua sendo o padrão até você mudá-lo. Uma instalação nova começa com as ferramentas dentro de Chat Settings e sem layout favorito.

Organize as janelas e os botões e clique na estrela da barra de título para salvar. Ela fica preenchida quando a disposição e as dicas atuais correspondem ao favorito. Se você mover uma janela ou mudar a disposição, clique na estrela novamente para substituir o favorito. Clique na estrela preenchida para limpar e usar o layout padrão nos próximos chats. Essas mudanças não alteram os chats existentes.

Quando um novo chat usa um perfil de configurações padrão, o layout salvo nesse perfil tem prioridade sobre o favorito. Perfis sem layout salvo mantêm a disposição do chat, inclusive a fornecida por um favorito. Um perfil ainda aplica sua própria configuração de dicas; perfis antigos sem essa configuração mostram as dicas.

Veja os passos em [Escolher um layout para novos chats](chat-settings.md#choosing-a-layout-for-new-chats).

## Importação e exportação de perfis

A ação **Export settings profile (.json)** baixa um arquivo `.marinara-settings-profile.json`, que serve como backup ou para compartilhar. A ação **Import settings profile (.json)** cria um perfil novo a partir de um arquivo compatível, sem sobrescrever nenhum perfil existente. Os perfis exportados em versões antigas ainda podem ser importados.

Os perfis salvam configurações, nunca os segredos do provedor. Um perfil exportado ou importado também deixa de fora o webhook do espelhamento no Discord, o endereço do DeepLX, a chave do DeepL e o endereço do Intiface. Os perfis que você salva nesta instalação mantêm esses dados.

## O perfil Default

Os modos Conversation e Roleplay têm, cada um, um perfil **Default** embutido. Ao aplicá-lo, as configurações controladas pelo perfil voltam ao padrão do Marinara para aquele modo.

O perfil Default não pode ser renomeado, sobrescrito nem excluído. Os controles desativados explicam isso com **Cannot save into the Default profile**, **Cannot rename the Default profile** e **Cannot delete the Default profile**.

## Guias relacionados

- [Visão geral do painel Chat Settings](chat-settings.md)
- [Editor de presets e gerenciador de prompts](../prompts/presets.md)
- [Parâmetros de geração](../prompts/generation-parameters.md)
