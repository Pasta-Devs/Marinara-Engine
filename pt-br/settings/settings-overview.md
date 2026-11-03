# Visão geral das configurações

Descubra qual parte de **Settings** (Configurações) guarda cada controle, configure a aba **General** e saiba como as suas configurações são sincronizadas entre dispositivos.

## O painel Settings e as suas seis abas

Abra **Settings** pelo ícone de engrenagem na barra superior. A caixa **Search settings** no topo encontra uma configuração pelo nome. Digite uma palavra como `delete`, `streaming` ou `quotes`, e o Marinara leva você direto para a seção correspondente. A busca encontra nomes no idioma da sua interface e em inglês.

O painel tem seis abas. Cada aba tem as suas próprias seções.

### O que você quer fazer

| O que você quer fazer | Vá para |
| --- | --- |
| Mudar o idioma | **Settings → General → App Behavior → Language** |
| Deixar o texto maior | **Settings → Appearance → App → Text & Scale** |
| Mudar o tema ou as cores | **Settings → Appearance → App → App Style** |
| Definir um som de notificação | **Settings → General → Notifications** |
| Parar a confirmação de exclusão | **Settings → General → App Behavior** |
| Adicionar respostas rápidas | **Settings → General → Input & Editing** |
| Fazer um backup | **Settings → Advanced → Backup & Export** |
| Excluir os meus dados | **Settings → Advanced → Danger Zone** |
| Atualizar o Marinara | **Settings → Advanced → Updates** |

### O que cada aba guarda

**General** (este guia)

- **App Behavior** (com uma linha **Search and Professor Mari settings**)
- **Notifications**
- **Responses**
- **Input & Editing**
- **Text Rules**
- **Game Playback**

**Appearance** tem quatro botões. Veja [Configurações de aparência](../appearance/appearance-settings.md).

- **App**: **App Style**, **Text & Scale**, **Atmosphere**, **Backgrounds**
- **Conversation**: **Conversation Display**, **Conversation Theme**
- **Roleplay**: **Tracker Panel**, **Roleplay Presentation**
- **Game**: **Game Presentation**

**Generations** tem **Overall Generations**, **Image Generation**, **Video Generation** e **Prompt Overrides**. Até você instalar o agente Illustrator, essa aba só mostra um convite para baixá-lo. Veja [Perfis de estilo](../media/style-profiles.md) e [Vídeo de cena](../media/scene-video.md).

**Addons** tem o histórico de revisões das extensões, **Personal Extensions**, **External Extensions** (só quando você as liberou) e **Theme Library**. Veja [Extensões pessoais](../extending/personal-extensions.md) e [Temas de CSS personalizados](../appearance/custom-css-themes.md).

**Imports** tem **Profile & Marinara**, **SillyTavern Import** e **Game Assets**. Veja [Fazer backup e restaurar o Marinara](../data/backup-and-restore.md) e [Importar do SillyTavern](../data/importing-from-sillytavern.md).

**Advanced** tem estas seções, nesta ordem. Veja [A aba Advanced](#the-advanced-tab).

- **Multiplayer WIP**
- **Access**
- **Admin Access**
- **Features**
- **Updates**
- **Support Diagnostics**
- **Request timeouts**
- **Parameters**
- **Message Tools**
- **Backup & Export**
- **Storage Optimization**
- **Danger Zone**

## A aba General

Cada seção da aba **General** fica em **Settings → General**.

| Seção | O que ela controla |
| --- | --- |
| **App Behavior** | Idioma, proteção contra exclusão, botões que mostram e escondem recursos e a linha **Search and Professor Mari settings**. Veja [App Behavior](#app-behavior). |
| **Notifications** | Sons de notificação e notificações do navegador e do Android. Veja [Notifications](#notifications). |
| **Responses** | Streaming, corte de texto e **Messages per page**. Veja [Enviar mensagens e streaming](../chats/sending-and-streaming.md). |
| **Input & Editing** | **Send on Enter**, **Quick replies** e atalhos de swipe e de edição. Veja [Input & Editing](#input-and-editing). |
| **Text Rules** | Como o texto do chat é formatado. Veja [Text Rules](#text-rules). |
| **Game Playback** | Leitura e navegação no Game Mode. Veja [Game Mode: primeiros passos](../game/getting-started.md). |

### App Behavior

| Configuração | O que ela faz |
| --- | --- |
| **Language** | Define o idioma da interface. Ela não muda os prompts do modelo nem o conteúdo do chat. O texto ainda não traduzido aparece em inglês. O árabe usa um layout da direita para a esquerda. Padrão: inglês. |
| **Documentation Language** | Define o idioma dos guias internos. Veja abaixo. Padrão: inglês. |
| **Confirm before deleting** | Pergunta antes de o Marinara excluir para sempre um chat, um personagem ou outro item. Padrão: ativado. |
| **Hide chat Help button** | Esconde o botão **Help** nos chats de Conversation, Roleplay e Game. Padrão: desativado. |
| **Show Android status bar** | Mantém a hora, a bateria e os ícones de notificação visíveis acima do Marinara. Funciona só no aplicativo Android. Padrão: desativado. |
| **Achievements** | Acompanha as conquistas, mostra os avisos de desbloqueio e o favorito e o widget da tela inicial. Veja [Conquistas](../home/achievements.md). Padrão: ativado. |
| **Disable seasonal ME themes** | Desliga os temas sazonais do Marinara. Padrão: desativado. |
| **Music Player** | Mostra o Music Player compacto. Ele precisa do agente **Music DJ**, de **Agents → Agent Organizer**, e fica esmaecido até você instalá-lo. Veja [Música](../media/music.md). Padrão: ativado. |

**Search and Professor Mari settings** é uma linha no fim de **App Behavior**. Selecione **Open** para ir à página de configurações da busca, das respostas rápidas e da Professor Mari. Veja [Professor Mari](../home/professor-mari.md).

Os idiomas da interface são árabe, chinês simplificado, inglês, francês, alemão, hindi, japonês, coreano, polonês, português do Brasil, russo e espanhol. Para melhorar uma tradução ou adicionar um idioma, veja [Localização da interface](../development/localization.md).

Em **Documentation Language**, o inglês já vem embutido. Escolha outro idioma e clique em **Download & Replace**. O Marinara baixa esse pacote de idioma uma vez e remove o anterior, então guarda um só idioma baixado. Os guias ainda não traduzidos abrem em inglês, com um pequeno selo `EN`. A busca da documentação funciona no idioma ativo. A sua escolha continua valendo depois das atualizações, e o pacote se renova depois de uma atualização quando as traduções dele mudaram. Se os guias baixados sumirem ou ficarem danificados, aparece o botão **Fix documentation**. Ele baixa o pacote de novo, ou devolve os guias ao inglês se a fonte do download não puder ser acessada.

### Notifications

O Marinara toca um som embutido nas notificações. Para usar o seu próprio som:

1. Abra **Settings → General → Notifications**.
2. Envie um **Custom sound**: MP3, WAV, OGG, M4A, MP4 ou WebM, de até 10 MB.

O som toca em todos os dispositivos conectados a este servidor. Você pode ouvir, trocar ou remover o som. Se o arquivo não puder ser lido, o Marinara toca o som embutido. O arquivo faz parte dos backups e das exportações de perfil.

**Background Notifications** cobrem as mensagens de Conversation que os personagens enviam por conta própria. **Generation Completion Notifications** cobrem as respostas que você mesmo inicia em Conversation, Roleplay e Game Mode. As duas funcionam enquanto o Marinara está aberto, mas sem o foco da tela. Elas nunca mostram o conteúdo das mensagens.

<a id="input-and-editing"></a>

### Input & Editing

Configurações em **Settings → General → Input & Editing**:

| Configuração | O que ela faz |
| --- | --- |
| **Send on Enter** | Escolhe em quais modos a tecla Enter envia a mensagem. |
| **Keep guidance after regenerating** | Deixa a sua direção na caixa de mensagem depois de uma regeneração guiada. Ativado por padrão. |
| **Add CYOA choices to the message box instead of sending them** | Coloca uma escolha clicada na sua caixa de mensagem, para você poder editá-la antes. |
| **Quick replies** | Adiciona ações de rascunho ao lado do botão Send. Veja [Geração guiada e Impersonate](../chats/guided-and-impersonate.md). |
| **Speech-to-text microphone** | Mostra um botão de microfone nos campos de mensagem. |
| **Intuitive swipe navigation** | Alterna entre os swipes (várias respostas guardadas em uma mensagem) com as setas do teclado ou com um toque deslizante. |
| **Reroll past the newest swipe** | Gera uma resposta nova quando você passa do swipe mais recente. |
| **Up Arrow edits last message** | Pressione Up Arrow em um campo vazio para editar a sua última mensagem. |
| **Double-click edits messages** | Dê um duplo clique em uma mensagem de Roleplay para editá-la. |

A seção **Responses** tem **Enable streaming**, **Streaming speed**, **Trim incomplete sentences from the response**, **Add a new line before /continue text** (ativado por padrão) e **Messages per page**. Veja [Enviar mensagens e streaming](../chats/sending-and-streaming.md). Para as ações de mensagem, veja [Ações de mensagem](../chats/messages.md).

### Text Rules

Essas regras mudam o tratamento do texto do chat em **Settings → General → Text Rules**. **Bold dialogue in quotes** e **Convert LaTeX symbols** mudam só a aparência do texto, então as suas mensagens salvas continuam iguais. **Quote style** reescreve as aspas no texto que você digita e salva.

| Configuração | O que ela faz |
| --- | --- |
| **Bold dialogue in quotes** | Mostra em negrito o texto entre aspas. Ativado por padrão. |
| **Convert LaTeX symbols** | Mostra os comandos de matemática LaTeX como símbolos. O código fica intacto. Ativado por padrão. |
| **Quote style** | **Straight** mantém as aspas simples (padrão). **Typographic** as reescreve como aspas e apóstrofos curvos. |
| **Load images from other websites in messages** | Controla as imagens hospedadas em outros sites. Desativado por padrão. |

#### Bold dialogue in quotes

Com esta opção ativada, as palavras entre aspas em `"I missed you," she said.` aparecem em negrito. Desative para manter a cor do diálogo sem o negrito.

#### Convert LaTeX symbols

Alguns modelos escrevem matemática como comandos LaTeX. Com esta opção ativada, `\rightarrow`, `\neq`, `\times` e `\alpha` aparecem como `→`, `≠`, `×` e `α`.

#### Load images from other websites in messages

Com esta opção desativada, uma imagem de outro site em uma mensagem, em uma saudação ou na prévia de um card mostra o nome do site e um botão **Load image**. Isso impede que uma mensagem contate outros sites sozinha. Selecione **Load image** para mostrar essa imagem. O Marinara se lembra da sua escolha em todos os seus dispositivos. Ative a configuração para mostrar todas as imagens na hora. As imagens guardadas no Marinara, como as fotos da galeria, os avatares e os sprites, sempre aparecem.

<a id="the-advanced-tab"></a>

## A aba Advanced

| Seção | Leia mais |
| --- | --- |
| **Admin Access** | [Acesso remoto](../REMOTE_ACCESS.md) |
| **Features** | [Chaves de recursos](../configuration/features.md) |
| **Updates** | [Atualizando o Marinara Engine](../UPGRADING.md) |
| **Message Tools** | [Message Tools](#message-tools) |
| **Backup & Export** | [Fazer backup e restaurar o Marinara](../data/backup-and-restore.md) |
| **Danger Zone** | [Limpar ou redefinir os seus dados](../data/clearing-data.md) |

### Message Tools

Estes botões ficam em **Settings → Advanced → Message Tools**. Todos vêm desativados por padrão, exceto **Show context usage** e **Show "older messages not sent" note**.

| Botão | O que ele faz |
| --- | --- |
| **Show message timestamps** | Mostra a data e a hora em cada mensagem. |
| **Show characters in Persona pickers** | Lista os seus personagens nos seletores de persona, para você poder jogar como um deles. |
| **Show model name on messages** | Mostra qual modelo escreveu cada resposta. |
| **Show token usage on messages** | Mostra a contagem de tokens de prompt e de resposta por mensagem. |
| **Show context usage** | Mostra o quanto a janela de contexto estava cheia na última requisição medida, nos seletores de conexão e nas configurações do chat de Game. |
| **Show message numbers** | Mostra um número em cada mensagem. |
| **Show "older messages not sent" note** | Mostra um aviso abaixo da resposta mais recente quando as mensagens mais antigas não couberam no prompt. Uma resposta cortada ou vazia continua mostrando o próprio aviso. |
| **Guide swipes/regens with chat input** | Usa o seu rascunho como direção quando você regenera. |
| **Include reasoning in exports** | Inclui o raciocínio oculto do modelo nas exportações de chat. |
| **Include private notes in exports** | Inclui as suas notas privadas de mensagem nas exportações em JSONL e em texto. Mantenha desativado quando for compartilhar uma transcrição. |
| **Debug mode** | Registra no console do servidor o que é enviado ao modelo, para dar suporte. |

Para saber mais, veja [Ações de mensagem](../chats/messages.md), [Personas](../characters/personas.md), [Como escolher um modelo para um chat](../connections/connecting-to-a-provider.md#choosing-a-model-for-one-chat), [Peek Prompt](../chats/peek-prompt.md), [Geração guiada e Impersonate](../chats/guided-and-impersonate.md), [Exportando e importando chats](../chats/export-import.md) e [Solução de problemas](../TROUBLESHOOTING.md).

## Como as configurações são sincronizadas entre dispositivos

O Marinara guarda a maior parte das configurações no servidor, então elas acompanham você entre navegadores e dispositivos.

1. Você muda uma configuração em **Settings**.
2. Cerca de um segundo depois, o Marinara a salva no servidor.
3. Outro navegador que abre o mesmo servidor carrega essas configurações.

A mudança mais recente vence. Se você abrir o Marinara em um segundo dispositivo logo depois de uma mudança, a cópia mais antiga dele pode substituir a sua mudança. Espere um momento antes de trocar de dispositivo.

Duas configurações nunca são sincronizadas. Defina-as de novo em cada dispositivo, em **Settings → Appearance → App → Text & Scale**:

- **Display Size**, o tamanho do texto da interface
- **Chat Font Size**, o tamanho do texto do chat

Veja [Configurações de aparência](../appearance/appearance-settings.md). Se o servidor não puder ser acessado, o aplicativo continua funcionando com as suas configurações locais e tenta de novo na próxima mudança.

## Guias relacionados

- [Configurações de aparência](../appearance/appearance-settings.md)
- [Ações de mensagem](../chats/messages.md)
- [Onde o Marinara guarda os seus dados](../data/where-data-is-stored.md)
- [Solução de problemas](../TROUBLESHOOTING.md)
