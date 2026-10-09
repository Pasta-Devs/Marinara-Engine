# Limpar ou zerar os seus dados

Neste guia você aprende a excluir os seus dados do Marinara Engine de forma permanente, pela seção **Danger Zone** (zona de perigo). Você pode limpar algumas categorias ou apagar tudo de uma vez. Não existe desfazer, então leia os avisos antes.

## Onde fica a Danger Zone

As ferramentas de limpeza de dados ficam todas no mesmo lugar.

1. Abra **Settings** (Configurações).
2. Vá até a aba **Advanced**.
3. Role até a seção **Danger Zone**, lá embaixo.

A descrição da seção **Danger Zone** diz: "Permanently clear selected categories of local data. Professor Mari is always preserved."

Se você usa Marinara de outro dispositivo, e não do computador que roda o aplicativo, a limpeza de dados exige acesso de administrador. Veja [Acesso remoto](../REMOTE_ACCESS.md) para configurar isso.

## Faça backup antes de limpar

A limpeza de dados não pode ser desfeita. Não há lixeira nem cesto de reciclagem. Depois que você confirma, os dados somem.

Faça um backup antes, para poder restaurar caso mude de ideia. Veja [Fazer backup e restaurar Marinara](backup-and-restore.md).

## As oito categorias de dados

A seção **Danger Zone** mostra uma lista com oito categorias. Cada uma tem seu próprio alcance. Marcar uma categoria não mexe nas outras.

| Categoria | O que a limpeza remove |
|---|---|
| **Chats & Messages** | Chats, pastas, mensagens, dados de cena e de OOC, e o estado de execução do chat. |
| **Characters** | Personagens e grupos de personagens. Professor Mari é sempre preservada. |
| **Personas** | Personas e grupos de personas. |
| **Lorebooks** | Lorebooks e entradas de lorebook. |
| **Presets** | Presets de prompt, grupos, seções e variáveis. |
| **Connections** | Conexões de API e endpoints de modelo. |
| **Automation & Addons** | Agentes, ferramentas, scripts de regex, temas sincronizados e o estado da automação. |
| **Media & Assets** | Planos de fundo, avatares, sprites, itens da galeria, fontes e arquivos de fontes de conhecimento. |

Algumas categorias removem mais do que registros do banco de dados. A categoria **Chats & Messages** também exclui a pasta inteira da galeria em disco e todos os arquivos de vídeo de cena. Isso inclui as imagens de galeria de personagens e personas, mesmo que você não tenha marcado **Characters** nem **Personas**. A categoria **Media & Assets** exclui as pastas em disco de planos de fundo, avatares, sprites, galerias, arquivos de vídeo de cena, fontes e arquivos de fontes de conhecimento. A categoria **Connections** também limpa as configurações salvas de Text to Speech (TTS, conversão de texto em voz) e de Speech to Text (conversão de fala em texto), porque elas ficam vinculadas a uma conexão.

## Limpar apenas algumas categorias

Use este caminho quando quiser apagar parte dos dados e manter o resto.

1. Marque a caixa de seleção ao lado de cada categoria que você quer excluir.
2. Para marcar todas as caixas de uma vez, use o botão **Select All** (selecionar tudo). Com todas marcadas, esse mesmo botão vira **Clear Selection**, para desmarcar todas.
3. Clique em **Clear Selected Data**. Esse botão fica desativado enquanto nenhuma categoria estiver marcada.
4. Aparece uma caixa de aviso. Ela informa quantas categorias você escolheu e lembra que não existe desfazer.
5. Clique em **Cancel** para parar, ou em **Confirm Delete** para excluir. Nada é excluído até você clicar em **Confirm Delete**.

Quando a limpeza dá certo, aparece uma mensagem de confirmação. Ela diz que os dados selecionados foram limpos e que os caches de execução foram zerados na hora.

## Limpar tudo

Use este caminho para apagar as oito categorias em um passo só.

1. Clique em **Clear All Data**. Não precisa marcar nenhuma caixa antes.
2. Uma caixa de aviso pergunta: "Delete all supported data categories except Professor Mari? There is no undo."
3. Clique em **Cancel** para parar, ou em **Confirm Delete** para excluir tudo.

O resultado é o mesmo de marcar todas as caixas e limpá-las juntas.

## Professor Mari fica sempre

Professor Mari é a personagem de ajuda que já vem com o aplicativo. Esse recurso nunca exclui ela. Mesmo que você limpe a categoria **Characters** ou use **Clear All Data**, Professor Mari continua no lugar. Não é possível removê-la pela seção **Danger Zone**.

## Guias relacionados

- [Fazer backup e restaurar Marinara](backup-and-restore.md)
- [Acesso remoto](../REMOTE_ACCESS.md)
