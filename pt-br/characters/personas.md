# Personas

A persona é o card de personagem que representa você em um chat: o seu nome, a sua descrição e outros detalhes opcionais. Marinara envia esses dados em todo prompt para que a IA saiba com quem está falando. Você pode manter muitas personas e escolher uma por chat. Para usar uma, veja [Escolhendo a persona de um chat](choosing-your-persona.md).

## Criar uma persona

1. Clique em **Personas** na barra de navegação superior. Se não aparecer, abra **More** (mais) primeiro.
2. Clique em **New** (novo). A janela **Create Persona** abre.
3. Digite um nome em **Name**. Esse é o único campo obrigatório.
4. Clique em **Create**.

A persona é criada com a descrição vazia e abre no Persona Editor (editor de persona).

5. Abra a aba **Card** e escreva a sua **Description**: o seu nome, a sua aparência e o seu jeito de agir.
6. Clique em **Save** (salvar) no cabeçalho.

Depois, escolha a persona no chat em que quiser usá-la. Veja [Escolhendo a persona de um chat](choosing-your-persona.md).

## O que uma persona faz

Marinara envia a sua persona para a IA em todo prompt. Escolha **None** (nenhuma) em um chat para não enviar nenhuma persona. Sem persona, a IA chama você de "User".

A macro `{{user}}` é um marcador. Marinara troca esse marcador pelo nome da persona antes de enviar o prompt. Se a sua persona se chama Alex, `{{user}}` vira Alex. Veja [Macros](../prompts/macros.md).

## O painel Personas

O painel **Personas** é a sua biblioteca de personas. Clique em uma linha para abrir essa persona no Persona Editor.

| Controle | O que faz |
| --- | --- |
| **Download** (baixar) | Abre o [Card Browser](bot-browser.md), onde você também encontra personas no PlotLight. |
| **Open Library** (abrir a biblioteca) | Abre a Persona Library em página inteira, com a mesma grade e a mesma prévia da Character Library. |
| **New** | Cria uma persona. |
| **Import** (importar) | Abre a janela **Import Persona**. |
| **Select** (selecionar) | Liga o modo de seleção para excluir e exportar em massa. |
| Caixa de busca | Texto de exemplo **Search personas/tags** (buscar personas/tags). Procura no nome, na descrição, no comentário e nas tags. Para buscas por tag, veja [Busca](library-organization.md#search). |
| Menu suspenso de ordenação | **Manual order** (ordem manual), **A-Z**, **Z-A**, **Newest**, **Oldest** ou **Tokens** (tamanho estimado do prompt). |
| **New Folder** (nova pasta) | Cria uma pasta. |
| **Tags** | Expande a lista de tags para filtrar. |

Em **Manual order**, arraste uma linha ou pressione <kbd>Alt</kbd>+<kbd>Up</kbd> ou <kbd>Alt</kbd>+<kbd>Down</kbd> em uma linha com foco. Em uma tela sensível ao toque, mantenha uma linha pressionada para pegá-la. Passe o mouse sobre uma linha para ver **Duplicate** (duplicar) e **Delete** (excluir). Um botão **Load more** (carregar mais) aparece quando há mais personas do que cabe em uma página. Sem nenhuma persona, o painel mostra **No personas yet**.

## O Persona Editor

Abrir uma persona troca a área do chat pelo Persona Editor em página inteira. O cabeçalho tem:

- Uma seta **Back** (voltar).
- O quadro do avatar. Clique nele para fazer upload de uma imagem. Com uma conexão de geração de imagens configurada, um botão de varinha também gera uma.
- O campo de nome e um campo de comentário, para um rótulo curto como `Modern AU version`.
- **Save**, que fica desativado até você mudar alguma coisa.
- **Export persona** (exportar a persona), **Add persona as character** (adicionar a persona como personagem), **Duplicate persona** (duplicar a persona) e **Delete persona** (excluir a persona).

Sair do editor salva as suas mudanças antes. Se o salvamento falhar, o editor continua aberto com o seu rascunho.

As abas, nesta ordem, são **Metadata**, **Card**, **Convo**, **Lorebook**, **Sprites**, **Gallery**, **Colors** e **Stats**. Cada aba leva à sua seção de um único formulário longo.

O editor de persona funciona como o [Character Editor](creating-and-editing-characters.md). As observações abaixo tratam do que é diferente.

| Aba | Observações específicas da persona |
| --- | --- |
| **Metadata** | Detalhes de identidade e de biblioteca. Veja a lista abaixo desta tabela. |
| **Card** | Veja [Aba Card](#card-tab) abaixo. |
| **Convo** | Campos usados só no modo Conversation. Veja [Perfis do Conversation Mode](../conversation/profiles.md). |
| **Lorebook** | Anexe entradas de lorebook que são ativadas quando esta persona está no chat. Veja [Visão geral dos lorebooks](../lorebooks/overview.md). |
| **Sprites** | Imagens da persona em pé no palco, para Game e Roleplay. Tem **Facial Expressions**, **Full-body** e **Clips**, além de **Upload Folder**. Veja [Sprites de personagem](sprites.md). |
| **Gallery** | Imagens e vídeos de referência, com **Upload Persona Images** e **Upload Persona Videos**. Veja [Galerias de personagem e de persona](galleries.md). |
| **Colors** | Cores do nome, do diálogo e da caixa de mensagem. Veja [Cores do personagem e Status de Roleplay](colors-and-stats.md). |
| **Stats** | Barras de status e Status de Roleplay. Veja [Aba Stats](#stats-tab) abaixo. |

A aba **Metadata** mostra:

- **Persona ID**, com **Copy** (copiar).
- O recorte do avatar.
- **Name** e **Creator**.
- **Phonetic name**, usado só quando o Text to Speech (TTS) lê o seu nome em voz alta.
- **Title / Comment**, um rótulo curto.
- **Version**, com padrão `1.0`, e um botão liga/desliga **Automatic versioning** (versionamento automático).
- **Tags**.
- **Creator Notes**, que nunca são enviadas à IA.

<a id="card-tab"></a>

### Aba Card

A aba **Card** guarda os campos que descrevem você para a IA. Cada um tem uma estimativa de tokens ao vivo.

| Campo | O que escrever | Enviado à IA |
| --- | --- | --- |
| **Summary** (resumo) | Uma visão geral para a biblioteca e as prévias. | Não |
| **Description** | A sua identidade e o seu papel em termos gerais. | Em todo prompt |
| **Personality** | Temperamento, comportamento, jeitos de falar. | Sim |
| **Backstory** | História, origem, relações. | Sim |
| **Appearance** | Aparência, roupas, detalhes visuais. | Sim |
| **Scenario** | A sua situação padrão nos roleplays. | Sim |
| **Example Dialogue** (diálogo de exemplo) | Trocas de mensagens de exemplo. Separe-as com `<START>`. Use `{{user}}` para a sua persona e `{{char}}` para o outro personagem. | Sim |

**Image Appearance Override** (aparência alternativa para imagens), abaixo de **Appearance**, funciona como nos personagens. Veja [A aba Card](creating-and-editing-characters.md#card-tab). As caixas de texto aceitam macros.

Estes recursos funcionam como nos personagens, com a persona como assunto:

- O botão de varinha acima de cada campo escreve o campo para você. Veja [Escreva um campo do card com a varinha](creating-and-editing-characters.md#write-a-card-field-with-the-wand).
- **Add Alternative Field** (adicionar campo alternativo), abaixo de cada campo, dá a chats selecionados uma versão diferente. A lista **Active in** (ativo em) mostra só os chats que usam esta persona, e as atribuições ficam suspensas quando um chat escolhe outra persona. Você pode dar um nome a cada alternativa e trocar entre elas em **Chat Settings → Card Field Alternatives** (configurações do chat → alternativas dos campos do card). Veja [Use um campo alternativo em chats selecionados](creating-and-editing-characters.md#use-an-alternative-field-in-selected-chats).
- **Version history** (histórico de versões) fica na aba **Metadata**. Antes da sua primeira edição, ele mostra `Previous persona states will appear here after the next edit.` **Reset** exclui todos os instantâneos e define a versão como 1.0. Veja [Histórico de versões](creating-and-editing-characters.md#version-history).

<a id="stats-tab"></a>

### Aba Stats

A aba **Stats** tem dois blocos separados. Os dois alimentam o HUD, o painel de status mostrado na tela durante um chat.

- **Enable Persona Stats** liga as barras de status, medidores de necessidades como fome e humor. Ao ativar do zero, você recebe Satiety, Energy, Hygiene e Mood, cada uma em 100 de 100. O agente **Persona Stats** ajusta esses valores conforme a história avança.
- **Enable Roleplay Stats** (Ativar Status de Roleplay) liga os Pools (barras como HP e MP) e os Attributes (números como força). Os dois são explicados em [Cores do personagem e Status de Roleplay](colors-and-stats.md). Ao ativar do zero, você recebe HP e MP em 100 de 100 e STR, DEX, CON, INT, WIS e CHA em 10. Esses valores são enviados com a persona para o combate e o Game Mode, e para as rolagens opcionais. Os agentes não os atualizam.

Um bloco **Game Mode Icon** (ícone de Game Mode) define a imagem do seu token em um combate de Game Mode. Veja [Ícone de Game Mode](colors-and-stats.md#game-mode-icon). Quando há um conjunto de regras de Game Mode (as regras de um jogo no estilo RPG de mesa) instalado, um bloco **Ruleset sheets** (fichas de conjuntos de regras) guarda a sua configuração inicial para ele. Veja [Fichas de conjuntos de regras](colors-and-stats.md#ruleset-sheets). Os valores que você define são o ponto de partida padrão dos chats novos.

## Importar e exportar personas

Para importar, clique em **Import** no painel **Personas**. A janela **Import Persona** aceita arquivos `.marinara` e `.json`, inclusive vários de uma vez. Um arquivo do Marinara restaura todos os detalhes, os sprites e a estrutura da galeria. Um arquivo JSON genérico, vindo de outra ferramenta, é mapeado campo a campo para uma persona nova. O nome é obrigatório. Cada arquivo mostra uma marca de sucesso ou de falha.

Para exportar, clique em **Export persona** no editor ou use **Export** (exportar) no modo de seleção. A janela **Export Persona** oferece dois formatos:

| Formato | O que você recebe |
| --- | --- |
| **Marinara Native** | Todos os detalhes da persona no Marinara, os sprites e os lorebooks anexados. Use este formato para levar uma persona de uma instalação do Marinara para outra. |
| **Compatible JSON** | Só os campos simples da persona, para outras ferramentas. |

A exportação em massa baixa um único zip, com um arquivo por persona.

## Duplicar ou excluir uma persona

Para duplicar, clique em **Duplicate** em uma linha ou em **Duplicate persona** no editor. A cópia recebe o nome "{original name} (Copy)" e mantém todos os campos do card, as cores, os stats e os campos de Convo. Nenhum chat muda de persona.

Para excluir, clique em **Delete** em uma linha ou em **Delete persona** no editor e confirme. Não é possível desfazer. Para excluir várias, clique em **Select**, marque as personas e use **Delete** na barra de seleção. Se uma exclusão falhar, essas personas continuam selecionadas para você tentar de novo.

## Adicionar a persona como personagem

**Add persona as character**, no cabeçalho do editor, cria um card novo entre os seus personagens. Ele copia o nome, a descrição, a personalidade, o cenário, a história de fundo, a aparência, as tags, o criador, a versão e o avatar. A persona continua como estava. Para editar o card novo, veja [Criando e editando personagens](creating-and-editing-characters.md).

## Guias relacionados

- [Escolhendo a persona de um chat](choosing-your-persona.md)
- [Cores do personagem e Status de Roleplay](colors-and-stats.md)
- [Criando e editando personagens](creating-and-editing-characters.md)
- [Perfis do Conversation Mode](../conversation/profiles.md)
- [Macros](../prompts/macros.md)
