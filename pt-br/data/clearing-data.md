# Limpar ou redefinir os seus dados

Exclua de forma permanente alguns dos seus dados ou todos eles com a **Danger Zone**. Não há como desfazer. Para excluir um chat ou um personagem, use o botão de excluir próprio dele. Veja [Gerenciando chats](../chats/managing-chats.md) e [Criando e editando personagens](../characters/creating-and-editing-characters.md).

**Antes de começar:** faça um backup. Não existe lixeira. Veja [Fazer backup e restaurar o Marinara](backup-and-restore.md). Se você usa o Marinara a partir de outro dispositivo, você também precisa do segredo de administrador. Veja [Acesso remoto](../REMOTE_ACCESS.md).

## Limpar algumas categorias

1. Abra **Settings → Advanced** e role até **Danger Zone**.
2. Marque cada categoria que você quer excluir. **Select All** marca todas as caixas. Quando todas estão marcadas, o mesmo botão mostra **Clear Selection** e desmarca todas.
3. Clique em **Clear Selected Data**. Ele fica desativado até você marcar uma categoria.
4. Leia o aviso. Ele mostra quantas categorias você escolheu.
5. Clique em **Confirm Delete**, ou em **Cancel** para parar. Nada é excluído até você confirmar.

Quando funciona, uma mensagem diz que os dados selecionados foram limpos. Se a requisição falhar, aparece uma mensagem de erro ("Failed to clear selected data."). Alguns dados já podem ter sido limpos, então confira o que sobrou. Confira se você tem acesso de administrador.

## Limpar tudo

1. Em **Danger Zone**, clique em **Clear All Data**. Você não precisa marcar nenhuma caixa.
2. O aviso pergunta: "Delete all supported data categories except Professor Mari? There is no undo."
3. Clique em **Confirm Delete**, ou em **Cancel** para parar.

Isso faz o mesmo que marcar todas as oito categorias.

## As oito categorias de dados

Cada categoria exclui só o que a sua linha lista, exceto a pasta da galeria, indicada abaixo da tabela.

| Categoria | O que ela exclui |
| --- | --- |
| **Chats & Messages** | Todos os chats e o conteúdo deles, a pasta `gallery` inteira e os vídeos de cena de jogo. |
| **Characters** | Todos os personagens e grupos, exceto a Professor Mari, com os seus avatares. |
| **Personas** | Todas as personas e grupos, com os seus avatares. |
| **Lorebooks** | Todos os lorebooks, entradas e pastas. |
| **Presets** | Todos os presets de prompt e pastas de presets, exceto o preset de fábrica embutido. |
| **Connections** | Todas as contas salvas e as escolhas de modelo e de voz ligadas a elas. |
| **Automation & Addons** | Todas as configurações de agentes, ferramentas personalizadas, scripts de regex e temas sincronizados. Não inclui Personal Extensions nem External Extensions. |
| **Media & Assets** | Planos de fundo, avatares, sprites, galeria, vídeos de cena, fontes e arquivos de fontes de conhecimento. |

Mais detalhes:

- **Chats & Messages** também exclui swipes (várias respostas guardadas em uma mensagem), memórias, resultados de agentes, estado de jogo e imagens de chat.
- **Characters** e **Personas** também excluem os modelos de avatar 2D e 3D.
- **Presets** também exclui os seus grupos, seções e variáveis. Se outro preset era o padrão, o preset de fábrica se torna o padrão.
- **Connections** também limpa as configurações de texto para fala e de fala para texto, os modelos que você escolheu para recursos e uma chave de API do Tripo salva na página **3D Avatars**.
- **Automation & Addons** também exclui resultados de agentes, memória de agentes, pastas de agentes e widgets de agentes na tela inicial.
- **Media & Assets** também exclui a lista de recursos e as imagens de chat.
- Arquivos de fontes de conhecimento são arquivos que você enviou para agentes de conhecimento. Temas sincronizados são os seus temas personalizados salvos no Marinara.

Algumas categorias alcançam arquivos fora da sua própria pasta. **Chats & Messages** exclui a pasta `gallery` inteira, incluindo as imagens de galeria de personagens e personas, mesmo que você não tenha marcado **Characters** nem **Personas**.

Limpar não toca nas suas outras configurações, na pasta `backups/` nem no arquivo `.encryption-key`. Também deixa intactos as Personal Extensions, os recursos do Game Mode, os emojis e stickers personalizados, o seu som de notificação, as imagens de lorebooks, presets, agentes e contas e os arquivos de memória de longo prazo. Veja [Onde o Marinara guarda os seus dados](where-data-is-stored.md).

## A Professor Mari permanece

A Professor Mari é a assistente embutida na tela inicial. A **Danger Zone** nunca a exclui, nem mesmo com **Clear All Data**.

## Guias relacionados

- [Fazer backup e restaurar o Marinara](backup-and-restore.md)
- [Onde o Marinara guarda os seus dados](where-data-is-stored.md)
- [Acesso remoto](../REMOTE_ACCESS.md)
