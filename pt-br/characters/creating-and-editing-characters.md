# Criando e editando personagens

Neste guia você aprende a criar um personagem no Marinara Engine. Ele também mostra como usar o Character Editor (editor de personagens) para escrever, salvar e controlar as versões do card. O texto cobre as abas **Metadata**, **Card** e **Advanced**, os avatares e o histórico de versões salvas.

## O que é um card de personagem

O card de personagem é o arquivo que define um personagem de IA. Ele guarda quem o personagem é, como fala, qual é a aparência dele e como começa um chat com ele. Esses detalhes são escritos no Character Editor. Monte um card do zero, importe um card de outro aplicativo ou exporte o seu para compartilhar.

Quase tudo o que você escreve vai parar em alguns poucos campos de texto. A IA lê esses campos a cada resposta, então um texto claro e específico deixa o personagem mais coerente.

## Criando um personagem

1. Abra o painel **Characters** (personagens) na barra lateral.
2. Clique no botão **New** (o ícone de mais). A janela **Create Character** abre.
3. Clique no círculo redondo do avatar para fazer upload de uma imagem. Essa etapa é opcional.
4. Digite um nome no campo **Name \***. O nome é obrigatório.
5. Clique em **Create**.

Marinara salva o novo card com os campos vazios. Em seguida, o Character Editor completo abre para você preencher o resto. Se já tiver um arquivo de card, comece pelo botão **Import** em vez do botão **New**. Veja [Importar e exportar cards de personagem](import-export.md).

## O Character Editor de relance

O Character Editor substitui a área do chat por um espaço de trabalho que ocupa a página inteira. O cabeçalho atravessa o topo e reúne as partes que você mais usa.

No canto superior esquerdo ficam a seta **Back**, o quadro do avatar, um campo de nome e um campo de título ou comentário. O campo de comentário serve para uma etiqueta curta, como `Modern AU version`. Logo abaixo, uma linha pequena mostra o criador e a versão.

No canto superior direito ficam estes botões:

- O botão **Save**. Ele fica desligado até você mudar alguma coisa. O texto dele mostra o estado atual: **Uploading…**, **Embedding…** ou **Saving…**.
- A estrela **Favorite**, que marca o card como favorito.
- O botão **Export character**.
- O botão **Import character as persona**, que copia este card para uma nova persona (o personagem que você interpreta).
- O botão **Duplicate character**.
- O botão **Delete character**.

Se você tentar sair com trabalho não salvo, aparece um aviso com o texto `You have unsaved changes. Close without saving?` Ele oferece as opções **Keep editing**, **Discard & close** e **Save & close**.

O editor é dividido em abas. Em tela larga, as abas descem pelo lado esquerdo. Em tela estreita, elas viram uma faixa rolável no topo. As abas, na ordem, são **Metadata**, **Card**, **Convo**, **Lorebook**, **Sprites**, **Gallery**, **Colors**, **Stats** e **Advanced**.

Este guia explica as abas **Metadata**, **Card** e **Advanced**, além dos avatares e do histórico de versões. As outras abas têm guias próprios:

- **Convo**: [Perfis do Conversation Mode](../conversation/profiles.md).
- **Lorebook**: [Vincular lorebooks a personagens e personas](../lorebooks/linking-to-characters.md).
- **Sprites**: [Sprites de personagem](sprites.md).
- **Gallery**: [Galerias de personagem e de persona](galleries.md).
- **Colors** e **Stats**: [Cores do personagem e status de RPG](colors-and-stats.md).

## A aba Metadata

A aba **Metadata** guarda os dados de identidade e organização. Eles ajudam a ordenar, compartilhar e acompanhar um card, mas quase nenhum deles vai para a IA.

- **Character ID**. Um valor somente leitura, exibido só depois que o card é salvo. Clique em **Copy** para copiá-lo.
- **Name**. O nome exibido. Ele é usado como `{{char}}` nos prompts, isto é, no texto que Marinara envia para a IA.
- **Phonetic name**. Uma grafia opcional, usada apenas para corrigir a pronúncia no text-to-speech (conversão de texto em voz). Deixe em branco para usar o nome normal.
- **Creator**. Quem fez o card, para dar os créditos quando você compartilhar.
- **Version**. Um número de versão definido por você, como `1.0`.
- **Talkativeness**. Um controle deslizante de 0 a 100 por cento. Ele define com que frequência este personagem fala nos chats em grupo. O padrão é 50 por cento.
- **Tags**. Digite uma ou mais tags no campo de adicionar tag e pressione Enter ou clique em **Add**. É possível adicionar várias de uma vez, separadas por vírgula. Remova uma tag pelo X dela ou limpe todas com o botão **Remove All**.
- **Creator Notes**. Anotações privadas que nunca são enviadas para a IA. Mesmo assim, elas aparecem como resumo na sua biblioteca.

O painel **Version history** também fica nesta aba. Ele é explicado na seção sobre salvamento e histórico de versões, mais abaixo.

## A aba Card

A aba **Card** é o espaço principal de escrita. Ela reúne os campos que a IA lê para interpretar o personagem. Os atalhos no topo levam direto a qualquer seção. Cada campo tem um contador de caracteres em tempo real.

- **Description**. A identidade geral e o papel do personagem. Este texto vai em todo prompt.
- **Personality**. Um resumo curto do temperamento, dos hábitos de fala e dos padrões de comportamento.
- **Backstory**. História, origem e relações importantes.
- **Appearance**. Descrição física, roupas e detalhes visuais. Marinara também usa este texto como base para o prompt de avatar gerado por IA.
- **Scenario**. O cenário padrão dos chats novos com este personagem.

A seção **Dialogue & Greetings** define como o chat começa e como o personagem soa:

- **First Message**. A mensagem de abertura mostrada quando um chat novo começa.
- **Alternate Greetings**. Mensagens de abertura extras. Ao começar um chat, você escolhe qual delas usar. Use os controles de subir e descer para reordená-las e o X para remover uma.
- **Example Dialogue**. Trocas de exemplo que ensinam a voz do personagem. Use `<START>` para separar as trocas. Use `{{user}}` e `{{char}}` como marcadores.

As saudações e mensagens de exemplo também podem mostrar imagens da Gallery do personagem; veja [Galerias de personagens → Reutilizar uma imagem da galeria em mensagens e saudações](galleries.md#reuse-a-gallery-image-in-messages-and-greetings).

Uma entrada curta de Example Dialogue fica assim:

```
<START>
{{user}}: Hello!
{{char}}: *waves excitedly* Hey there!
```

## Adicionando um avatar

O avatar é a imagem exibida para o personagem no chat e na sua biblioteca. Você pode fazer upload de uma imagem, ajustar o enquadramento dela ou gerar uma com IA.

### Fazer upload de uma imagem

1. Clique no quadro do avatar, no cabeçalho do editor.
2. Escolha um arquivo de imagem. A nova imagem aparece na hora.

Assim que o personagem tem um avatar, uma ferramenta de recorte aparece na aba **Metadata**. Use essa ferramenta para reposicionar ou ampliar a imagem dentro do círculo, sem precisar enviar o arquivo de novo. A ferramenta de recorte também tem um controle para remover o avatar.

### Gerar um avatar com IA

A opção de avatar por IA só aparece quando existe pelo menos uma conexão de geração de imagens configurada. Veja [Conectando a um provedor de IA](../connections/connecting-to-a-provider.md).

1. Passe o mouse sobre o quadro do avatar e clique no pequeno botão de varinha **Generate avatar**.
2. A janela **Generate Character Avatar** abre.
3. Escolha uma conexão em **Image Generation Connection**.
4. Revise ou edite o campo **Avatar Prompt**. Ele vem preenchido a partir do texto de Appearance. Se Appearance estiver vazio, Marinara usa Description e depois Personality.
5. Se o card já tiver um avatar, marque a caixa de seleção **Use current avatar as a reference**.
6. Clique em **Generate**. Para tentar de novo, clique em **Regenerate**.
7. Quando gostar do resultado, clique em **Use Avatar**.

O tamanho da imagem vem da configuração de tamanho **Portraits**, nas configurações de geração de imagens, cujo padrão é 1024 por 1024. Se a opção **Expose media prompts before sending** estiver ativada, uma etapa de revisão do prompt aparece antes de cada pedido.

## A aba Advanced

A aba **Advanced** reúne controles de prompt para usuários avançados. Em um personagem comum, todos esses campos podem ficar vazios.

Esses controles de prompt escritos no personagem valem nos modos Conversation, Roleplay e Game. Um preset de Conversation ou de Game selecionado muda o prompt ao redor, mas não desativa o Post-History Instructions nem o Depth Prompt do personagem.

- **System Prompt**. Instruções específicas do personagem, acrescentadas pelo bloco de personagem do preset ativo, pelo contexto de personagem de Conversation ou pelo card de personagem/GM de Game, conforme o caso. Isso não substitui o prompt de sistema principal do chat.
- **Post-History Instructions**. Texto colocado perto do fim do prompt, próximo da geração. Um uso comum é um lembrete curto, como "Stay in character".
- **Depth Prompt**. Texto inserido em um ponto escolhido do histórico do chat. O campo **Depth** define quantas mensagens atrás ele entra. A profundidade 0 fica logo depois da mensagem mais recente, e a profundidade 4 fica quatro mensagens atrás. A profundidade padrão é 4. O campo **Role** define se o texto entra como **System**, **User** ou **Assistant**. O papel padrão é System.

A seção **Regex Scripts** desta aba guarda os scripts de busca e substituição limitados a este personagem. Eles usam o mesmo motor de regex compartilhado. Veja [Scripts de regex](../extending/regex-scripts.md) para entender como funcionam.

## Salvamento e histórico de versões

Clique no botão **Save**, no cabeçalho, para salvar as mudanças. O botão fica desligado até você editar algo e então liga.

Cada salvamento pode acrescentar um instantâneo ao painel **Version history**, na aba **Metadata**. Antes da sua primeira edição extra, o painel mostra `Previous card states will appear here after the next edit.` Um contador indica quantos instantâneos você já salvou.

Para comparar uma versão salva com o card atual:

1. Abra a aba **Metadata**.
2. Em **Version history**, clique em uma versão salva.
3. A janela **Compare** abre. Ela lista lado a lado campos como Name, Description, Personality, Scenario, First Message e Example Dialogue. Cada campo alterado fica marcado.

Para voltar a uma versão mais antiga:

1. Abra a janela **Compare** da versão desejada ou clique no ícone de restauração dela na lista.
2. Clique em **Restore this version** e confirme.

A restauração substitui o card atual por aquele instantâneo. Ela não cria uma nova entrada no histórico. Use o ícone de lápis para corrigir a etiqueta de versão de um instantâneo salvo sem restaurá-lo. Também é possível excluir um instantâneo salvo da lista; isso não altera o card atual.

Use o botão **Reset**, no cabeçalho do painel **Version history**, quando quiser recomeçar o versionamento do card. Depois da confirmação, Marinara exclui todos os instantâneos salvos e define a versão atual do card como `0.0`. Essa ação não tem volta.

## Revisando as atualizações de card propostas por um agente

Durante um chat de Roleplay, um agente opcional pode sugerir pequenas edições nos campos do card, com base no que aconteceu na cena. Quando isso acontece, a janela **Review Character Card Updates** aparece para que o controle continue com você. Você decide o que fica.

Para cada edição proposta, as opções são:

- **Approve**. Aplica a mudança. Isso também aumenta o número de versão e cria uma entrada no histórico de versões.
- **Regenerate**. Pede ao agente que tente de novo.
- **Reject**. Descarta a proposta.

Se o texto original mudou depois que a proposta foi criada, o aplicativo avisa antes de deixar você forçar a edição. Para saber como ativar ou desativar esses agentes, veja [Agentes: ajudantes de IA para os seus chats](../agents/agents-overview.md).

## Uma observação sobre a Professor Mari

**Professor Mari** é um personagem assistente embutido, que já vem com Marinara. Ela não pode ser excluída. Se você tentar, o aplicativo bloqueia a ação e avisa que ela é um personagem embutido. Para saber o que ela faz, veja [Professor Mari, a assistente dentro do aplicativo](../home/professor-mari.md).

## Guias relacionados

- [Personas do usuário: criar e editar](personas.md)
- [Sprites de personagem](sprites.md)
- [Galerias de personagem e de persona](galleries.md)
- [Importar e exportar cards de personagem](import-export.md)
- [Cores do personagem e status de RPG](colors-and-stats.md)
- [Perfis do Conversation Mode](../conversation/profiles.md)
- [Vincular lorebooks a personagens e personas](../lorebooks/linking-to-characters.md)
