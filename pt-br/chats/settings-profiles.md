# Perfis de configurações

Um perfil de configurações é um pacote com nome de configurações de chat reutilizáveis: a conexão, o preset de prompt, os agentes, as ferramentas, a tradução, a Memory Recall, os parâmetros avançados e mais. Aplique o perfil em outro chat em vez de configurar essas opções de novo.

Os perfis ficam no topo de **Chat Settings** (configurações do chat). Eles funcionam em Conversation e em Roleplay. Os chats de Game não mostram os controles de perfil.

O **preset de prompt** é outra coisa. Ele controla a estrutura do prompt de sistema e os valores de geração, e você o edita no painel Presets. Veja [Editor de presets e gerenciador de prompts](../prompts/presets.md). O perfil de configurações é o pacote mais amplo, e pode incluir um preset de prompt como um dos itens.

## Aplique um perfil

1. Abra o chat que você quer alterar e depois abra **Chat Settings**. Veja [Chat Settings](chat-settings.md).
2. Abra o menu suspenso **Profile** (perfil), identificado como **Apply a settings profile to this chat**.
3. Escolha um perfil pelo nome.

O chat muda na hora. Se o perfil liga ou desliga **Hide summarised messages** (ocultar as mensagens resumidas), as mensagens resumidas do chat ficam ocultas para o modelo, ou voltam a aparecer para ele, no mesmo momento.

Se não funcionou: quando os valores do chat não correspondem a nenhum perfil salvo, o menu suspenso mostra **Custom settings profile**. Se o perfil aplicado foi excluído, ele mostra **Missing profile - choose a profile**. Escolha outro perfil.

## Crie ou edite um perfil

1. Ao lado do menu suspenso, toque em **New** (novo), cuja dica diz "New profile from this chat's settings". O criador de perfis abre com as configurações deste chat nos espaços. Para alterar um perfil salvo, selecione-o e clique em **Edit** (editar). O perfil Default não pode ser editado.
2. Digite um **Profile name** (nome do perfil).
3. Preencha os espaços (veja a lista abaixo).
4. Toque em **Save and choose chats…** (salvar e escolher os chats).
5. Para usar o perfil nos chats novos, marque **Make this the default** (tornar este o padrão). A lista começa com **New conversation chats** ou **New roleplay chats**.
6. Marque os chats existentes que devem receber o perfil agora.
7. Toque em **Apply to N chats** (aplicar a N chats) ou em **Save** (salvar) se nenhum estiver marcado.

O criador agrupa os espaços em **Chat**, **Story**, **Pictures** e **Behind the scenes** (chat, história, imagens e nos bastidores). Os espaços são:

- **Connection**, **Prompt preset** e **Parameters** (conexão, preset de prompt e parâmetros)
- **Agents**, **Tools** e **Memory & summary** (agentes, ferramentas e memória e resumo)
- **Persona**, **Lorebooks** e **Background** (plano de fundo)
- **Image style** e **Translation** (estilo de imagem e tradução)

Como preencher os espaços:

- Escolha os itens na lista de cada espaço. **Agents**, **Tools** e **Lorebooks** aceitam mais de uma escolha. Use as caixas de seleção em **Tools** para ligar ou desligar cada ferramenta. Em um espaço de item único, escolha **None** (nenhum) para limpá-lo.
- Nas listas de agentes e de lorebooks, no computador, segure <kbd>Ctrl</kbd> (<kbd>Command</kbd> no macOS) para escolher vários itens. No celular, use os controles de seleção. **Clear selection** (limpar a seleção) esvazia uma lista.
- No computador, você pode abrir uma barra lateral de biblioteca com o editor ainda aberto e arrastar um item até o campo correspondente.
- **Parameters**, **Memory & summary** e **Translation** só mostram se o perfil inclui essas configurações. Altere-as em Chat Settings e depois salve no perfil.

No assistente de configuração de novo chat, a etapa **Use a Profile** (usar um perfil) também tem **New profile…** no topo da lista e **Edit** ao lado de um perfil salvo. Depois que você salva, o assistente seleciona esse perfil.

## Salve as configurações do chat em um perfil

Para atualizar um perfil a partir de um chat, aplique-o, mude o chat e depois use a linha de ícones abaixo do menu suspenso.

| Botão | Rótulo | Resultado |
|---|---|---|
| Save | **Save current chat settings into this profile** | Substitui os valores salvos no perfil. |
| Rename | **Rename profile** | Muda o nome. |
| Import | **Import settings profile (.json)** | Carrega um arquivo de perfil. |
| Export | **Export settings profile (.json)** | Baixa o perfil. |
| Delete | **Delete profile** | Exclui o perfil de vez. |

### Atualize outros chats que usam o perfil

Cada chat guarda a própria cópia das configurações de um perfil, então salvar um perfil não muda os outros chats por si só. Quando outros chats do mesmo modo usam o perfil, a janela **Other chats use this profile** (outros chats usam este perfil) pergunta:

- **Save to this profile only** (salvar só neste perfil) salva o perfil e deixa os outros chats como estão.
- **Save and update N other chats** (salvar e atualizar N outros chats) também copia para esses chats as configurações de Chat Settings do perfil. Isso substitui as mudanças próprias deles nessas configurações, e uma configuração que você deixou no padrão no chat de onde salva também volta ao padrão neles.

Quando nenhum outro chat usa o perfil, **Save** funciona sem perguntar. As salas multijogador nunca são atualizadas dessa forma.

<a id="choosing-the-default-profile"></a>

## Como escolher o perfil padrão

A estrela ao lado do menu suspenso marca o perfil usado automaticamente nos chats novos daquele modo. Só um perfil por modo pode ser o padrão. Os rótulos são **Mark this profile as default for new chats in this mode**, **This profile is the default for new chats in this mode** e **Select a profile to mark it as default**. Você também pode marcar **Make this the default** no criador.

## Importe e exporte um perfil

**Export settings profile (.json)** baixa um arquivo `.marinara-settings-profile.json` que você pode guardar como backup ou compartilhar. **Import settings profile (.json)** cria um perfil novo a partir de um arquivo compatível e nunca sobrescreve um perfil existente. As exportações antigas ainda podem ser importadas. Uma importação que falha mostra **Import failed**.

Os perfis guardam configurações, não os segredos do provedor. Um perfil exportado ou importado também deixa de fora o webhook do espelhamento no Discord, o endereço do DeepLX, a chave do DeepL e o endereço do Intiface. Os perfis que você salva nesta instalação mantêm esses dados. Os arquivos exportados deixam de fora a persona e os lorebooks, porque eles só existem nesta instalação.

## O perfil Default

Conversation e Roleplay têm, cada um, um perfil **Default** embutido. Aplicá-lo devolve as configurações controladas pelo perfil aos padrões do Marinara para aquele modo. Ele não pode ser renomeado, sobrescrito nem excluído. Os controles desativados dizem **Cannot save into the Default profile**, **Cannot rename the Default profile** e **Cannot delete the Default profile**.

<a id="favorite-window-layouts"></a>

## Layouts de janelas favoritos

A estrela ao lado de **Reset View** na barra de título de Chat Settings salva um layout de janelas favorito para novos chats. Já a estrela ao lado do menu suspenso **Profile** escolhe o perfil padrão. Veja os passos em [Escolher um layout para novos chats](chat-settings.md#choosing-a-layout-for-new-chats).

Quando um novo chat usa um perfil padrão que tem um layout salvo, esse layout tem prioridade sobre o layout favorito. Um perfil sem layout salvo mantém a disposição do chat, inclusive a que vem de um favorito. Um perfil ainda aplica a própria configuração de dicas de layout (perfis antigos sem essa configuração mostram as dicas) e o próprio modo de Scoped Regex Scripts, ou o padrão do preset de prompt quando não tem um.

## O que o perfil inclui

O perfil salva a forma como o chat conversa com o modelo:

- A conexão.
- O preset de prompt (chamado de fonte do prompt em Conversation).
- Os agentes e as ferramentas.
- A tradução, a Memory Recall e os Advanced Parameters.
- O layout de janelas e botões: posições, tamanhos, fixações, travas, quais ferramentas estão dentro de Chat Settings ou destacadas, janelas de controles abertas e posições dos botões no computador e no celular. Perfis sem layout salvo, como **Default**, deixam o layout do chat como está.
- Se as dicas de layout estão ocultas. Aplicar **Default**, ou um perfil antigo sem essa escolha, mostra as dicas de novo.
- Outras opções reutilizáveis do chat.

Um perfil também pode guardar **escolhas iniciais**: uma persona, lorebooks para ativar e um plano de fundo.

- Aplicar o perfil copia as escolhas para o chat. Se o perfil deixar uma delas vazia, o chat mantém a sua.
- As outras configurações do perfil ainda substituem as do chat.
- As escolhas não ficam vinculadas. Uma mudança posterior no chat fica naquele chat.
- **Save current chat settings into this profile** mantém a persona, os lorebooks e o plano de fundo do próprio perfil. Um perfil sem plano de fundo recebe o plano de fundo do chat quando você salva nele.
- Atualizar outros chats nunca muda a persona, os lorebooks nem o plano de fundo deles.

O perfil não substitui o conteúdo que pertence ao chat: personagens, sprites, resumo, tags e prompt da cena. Ele também não guarda o histórico da conversa nem estado em andamento, como as variáveis de macro, os personagens que você desativou ou uma sala multijogador.

### O que Save and update copia

**Save and update** copia isto para os outros chats:

- As opções de geração e de contexto.
- As opções de chat em grupo.
- Os botões liga/desliga de recursos e de comandos.
- Os agentes e as opções deles.
- As configurações de memória e de resumo.
- A tradução.
- O layout das janelas.

Todo o resto continua como cada chat tem:

- A conexão, o preset de prompt e o prompt personalizado.
- A história e os personagens.
- Os lorebooks e o plano de fundo.
- As notas e o progresso.
- Quais comandos de Roleplay só o narrador do chat pode usar.
- Se o Noodle pode usar as mensagens do chat.

Advanced Parameters e a descrição de imagens (ligada ou desligada, e qual conexão descreve as imagens) só mudam nos chats que usam a conexão do perfil, porque são definidos para essa conexão. As agendas de personagem só mudam se foram ligadas ou desligadas no chat de onde você salva. Knowledge Retrieval, Knowledge Router, Lorebook Keeper e Expression Engine continuam ligados ou desligados, com os seus modelos de prompt, como cada chat os tem. Cada chat escolhe por conta própria as fontes, o lorebook ou os sprites deles.
