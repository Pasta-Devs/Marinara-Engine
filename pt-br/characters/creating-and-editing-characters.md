# Criando e editando personagens

O card de personagem é o arquivo que define um personagem de IA: quem ele é, como fala, qual é a aparência dele e como começa um chat com ele. Você escreve o card no Character Editor (editor de personagem). A IA lê os campos do card a cada resposta, então um texto claro e específico deixa o personagem mais coerente.

## Crie um personagem

1. Clique em **Characters** (personagens) na barra de navegação superior. Se não encontrar esse item, abra **More** (mais) primeiro.
2. Clique em **New** (o ícone de mais). A janela **Create Character** abre.
3. Digite um nome em **Name \***. O nome é obrigatório.
4. Clique no círculo redondo do avatar para adicionar uma imagem. Essa etapa é opcional.
5. Clique em **Create**.

O card é salvo com os campos vazios, e o Character Editor abre.

6. Abra a aba **Card** e escreva a **Description**: quem o personagem é. Adicione uma **First Message** em **Dialogue & Greetings**. É com ela que um chat de Roleplay começa.
7. Clique em **Save** no cabeçalho.

Se você já tem um arquivo de card, clique em **Import** em vez disso. Veja [Importar e exportar cards de personagem](import-export.md).

### Comece um chat com o seu personagem

Escolha o personagem quando começar um chat. Veja [Roleplay Mode: primeiros passos](../roleplay/getting-started.md) ou [Conversation Mode: primeiros passos](../conversation/getting-started.md).

## O Character Editor de relance

O Character Editor substitui a área do chat por um espaço de trabalho que ocupa a página inteira. Em tela larga, as abas descem pelo lado esquerdo. Em tela estreita, elas viram uma faixa rolável no topo. As abas, na ordem, são **Metadata**, **Card**, **Onboarding**, **Convo**, **Lorebook**, **Sprites**, **Gallery**, **Colors**, **Voice**, **Stats** e **Advanced**. Cada aba leva à sua seção de um único formulário longo, então você também pode rolar a página.

O cabeçalho reúne as partes que você mais usa:

- A seta **Back**, o quadro do avatar, um campo de nome e um campo de título ou comentário para uma etiqueta curta, como `Modern AU version`. Uma linha logo abaixo mostra o criador e a versão.
- **Save**. O botão fica desligado até você mudar alguma coisa. Enquanto trabalha, ele mostra **Uploading…** (um avatar está sendo enviado), **Embedding…** (um lorebook está sendo adicionado ao card) ou **Saving…**.
- A estrela **Favorite**.
- **Export character**. Veja [Importar e exportar cards de personagem](import-export.md).
- **Import character as persona**, que copia este card para uma nova persona. Veja [Personas](personas.md).
- **Duplicate character**.
- **Delete character**.

Ao sair do editor, as suas mudanças são salvas antes. Se o salvamento falhar, o editor continua aberto com o seu rascunho para você tentar de novo.

Abas que têm guia próprio:

| Aba | Guia |
| --- | --- |
| **Onboarding** | [Onboarding interativo](interactive-onboarding.md) |
| **Convo** | [Perfis do Conversation Mode](../conversation/profiles.md) |
| **Lorebook** | [Vincular lorebooks a personagens](../lorebooks/linking-to-characters.md) |
| **Sprites** | [Sprites de personagem](sprites.md) |
| **Gallery** | [Galerias de personagem e de persona](galleries.md) |
| **Colors** e **Stats** | [Cores do personagem e Status de Roleplay](colors-and-stats.md) |

As seções abaixo explicam **Metadata**, **Card**, **Voice** e **Advanced**, além dos avatares e do histórico de versões.

<a id="metadata-tab"></a>

## A aba Metadata

A aba **Metadata** guarda os dados de identidade e organização. Eles ajudam a ordenar, compartilhar e acompanhar um card. A maioria deles não é enviada para a IA.

- **Character ID**. Somente leitura. Aparece depois que o card é salvo. Clique em **Copy** para copiá-lo.
- **Name**. O nome exibido. Nos prompts, ele é `{{char}}`, um marcador que Marinara substitui pelo nome do personagem.
- **Creator**. Quem fez o card, para dar os créditos quando você compartilhar.
- **Version**. Um número de versão definido por você, como `1.0`. O botão liga/desliga **Automatic versioning** (versionamento automático), ao lado, guarda as versões anteriores e aumenta esse número quando o card muda. O histórico de versões só salva instantâneos enquanto esse botão liga/desliga estiver ativado.
- **Talkativeness**. Um controle deslizante de 0 a 100 por cento. Ele define com que frequência este personagem fala nos chats em grupo. O padrão é 50 por cento.
- **Tags**. Digite as tags no campo de adicionar tag e pressione <kbd>Enter</kbd> ou clique em **Add**. Separe várias tags com vírgulas. O campo sugere as tags que a sua biblioteca já usa, das mais usadas para as menos usadas. Remova uma tag pelo X dela, ou todas com **Remove All**.
- **Creator Notes**. Anotações privadas que nunca são enviadas para a IA.

**Split description into fields** (dividir a descrição em campos) é um botão abaixo de **Version**. Ele tira de **Description** o texto marcado com rótulos (personalidade, aparência, história, cenário, regras, diálogo de exemplo) e o coloca nos campos próprios. Primeiro você vê um resumo curto, e aplicar a divisão salva o card como uma nova versão. O botão fica desligado enquanto **Description** estiver vazio.

O painel **Version history** também fica nesta aba. Veja [Histórico de versões](#version-history).

<a id="card-tab"></a>

## A aba Card

A aba **Card** é o espaço principal de escrita. Os links no topo levam a qualquer seção, e cada campo tem um contador de caracteres atualizado em tempo real.

| Campo | O que escrever | Enviado para a IA |
| --- | --- | --- |
| **Summary** | Uma visão geral curta para a sua biblioteca e para a prévia do card. | Não |
| **Description** | A identidade geral e o papel do personagem. | Em todo prompt |
| **Personality** | Temperamento, hábitos de fala, padrões de comportamento. | Sim |
| **Backstory** | História, origem, relações importantes. | Sim |
| **Appearance** | Aparência física, roupas, detalhes visuais. Também serve de base para o prompt de avatar gerado por IA. | Sim |
| **Scenario** | O cenário padrão dos chats novos com este personagem. | Sim |

A opção **Image Appearance Override** (aparência alternativa para imagens) fica abaixo de **Appearance** e vem desativada por padrão. Ative-a para mostrar uma segunda caixa para tags curtas de imagem, como a palavra-gatilho de uma LoRA (uma palavra-chave que ativa um estilo de imagem personalizado). Enquanto a opção estiver ativada e a caixa estiver preenchida, os prompts de imagem usam essas tags exatamente como estão escritas, com **Appearance** mantido como contexto. O prompt de avatar gerado por IA também parte dessas tags. O narrador sempre vê o texto completo de **Appearance**.

A seção **Dialogue & Greetings** define como um chat começa e como o personagem soa:

- **First Message**. A mensagem de abertura de um chat novo de Roleplay. Os chats de Conversation e de Game não começam com uma saudação.
- **Alternate Greetings**. Mensagens de abertura extras. Quando você começa um chat de Roleplay, pode escolher qual delas usar. Use os controles de subir e descer para reordená-las e o X para remover uma.
- **Example Dialogue**. Trocas de exemplo que ensinam a voz do personagem. Use `<START>` para separar as trocas, e `{{user}}` e `{{char}}` como marcadores.

```text
<START>
{{user}}: Hello!
{{char}}: *waves excitedly* Hey there!
```

As saudações e as mensagens de exemplo podem mostrar imagens da Gallery do personagem. Veja [Reutilizar uma imagem da galeria em mensagens e saudações](galleries.md#reuse-a-gallery-image-in-messages-and-greetings). Quando as saudações mostram imagens de outros sites, **Save images locally** (salvar imagens localmente) guarda uma cópia delas na Gallery. Veja [Salvar imagens da web das saudações](galleries.md#save-web-images-from-greetings).

<a id="write-a-card-field-with-the-wand"></a>

### Escreva um campo do card com a varinha

**Summary**, **Description**, **Personality**, **Backstory**, **Appearance**, **Scenario**, **Example Dialogue**, **First Message** e cada **Alternate Greeting** têm um botão só com o ícone de varinha acima do campo. A dica do botão mostra o nome do campo que ele escreve.

Antes de começar: configure uma conexão de texto que funcione. Veja [Conectando a um provedor de IA](../connections/connecting-to-a-provider.md).

1. Escreva no campo as ideias que deseja manter, como `smart, scientist, handsome`, ou deixe-o vazio.
2. Preencha os outros campos do card que a IA deve usar como referência. Você não precisa salvar antes.
3. Clique na varinha do campo. Marinara pede de 100 a 300 palavras para esse campo, usando o seu texto como ponto de partida. Example Dialogue pede trocas de exemplo. **First Message** e cada **Alternate Greeting** pedem uma mensagem de abertura que deixa a sua resposta em aberto.
4. Edite o resultado e clique em **Save**.

A varinha usa a sua conexão de texto padrão para agentes ou, se não houver uma, a sua conexão de texto padrão. Uma conexão de reserva de agentes configurada continua valendo.

A varinha substitui apenas o campo escolhido no seu rascunho não salvo. Se a geração falhar, o seu texto continua lá. Se você editar esse campo enquanto espera, ou mudar para outro card, um resultado atrasado não sobrescreve o seu trabalho. Você não precisa da Professor Mari para usar a varinha.

## Adicione um avatar

O avatar é a imagem exibida para o personagem no chat e na sua biblioteca.

### Faça upload de uma imagem

1. Clique no quadro do avatar, no cabeçalho do editor.
2. Escolha um arquivo de imagem. A nova imagem aparece na hora.

Assim que o personagem tem um avatar, uma ferramenta de recorte do avatar aparece na aba **Metadata**. Use-a para mover ou ampliar a imagem dentro do círculo, ou para remover o avatar.

### Gere um avatar com IA

Antes de começar: adicione uma conexão de geração de imagens. O botão de avatar por IA só aparece quando você tem uma. Veja [Conectando a um provedor de IA](../connections/connecting-to-a-provider.md).

1. Passe o mouse sobre o quadro do avatar e clique no botão de varinha. A janela **Generate Character Avatar** abre.
2. Escolha uma **Image Generation Connection** (conexão de geração de imagens).
3. Confira ou edite o **Avatar Prompt**. Ele parte de **Image Appearance Override** quando essa opção está ativada e preenchida. Caso contrário, usa **Appearance**, depois **Description** e depois **Personality**, o primeiro que tiver texto.
4. Se o card já tiver um avatar, você pode marcar **Use current avatar as a reference**.
5. Clique em **Generate**. Para tentar de novo, clique em **Regenerate**.
6. Clique em **Use Avatar** quando gostar do resultado.

O tamanho da imagem vem do tamanho de imagem **Portraits**, nas configurações de geração de imagens. O padrão é 1024 por 1024. Se **Expose media prompts before sending** estiver ativado, uma etapa de revisão do prompt aparece antes de cada pedido.

## A aba Voice

A aba **Voice** define como o personagem soa quando o Text to Speech lê as falas dele em voz alta.

- **Voice**. A voz deste personagem. Uma mudança é salva na hora, sem **Save**. É a mesma configuração da linha deste personagem em **Connections → Text to Speech** (Conexões → Text to Speech). Deixe em branco para usar a voz padrão. Quando um card com nome correspondente tem uma voz, como o original de uma cópia AU, o campo vazio mostra o nome dessa voz, porque este card também a usa.
- **Preview** (ouvir). Toca uma frase curta com essa voz. A frase diz o nome do personagem, ou o **Phonetic name**, quando houver um definido.
- **Phonetic name**. Uma grafia opcional, usada apenas para corrigir a pronúncia. Ele faz parte do card, então clique em **Save** para mantê-lo.

Se o Text to Speech estiver desligado, ou se todos os personagens compartilharem uma única voz, uma observação curta substitui o campo **Voice**. Com uma única voz compartilhada, a observação oferece **Use a voice per character** (usar uma voz por personagem). **Open Text to Speech settings** (abrir as configurações de Text to Speech) abre Connections. Veja [Configuração de Text to Speech (TTS)](../media/tts-setup.md).

## A aba Advanced

A aba **Advanced** reúne controles de prompt. Deixe-os vazios em um personagem comum. Eles valem nos modos Conversation, Roleplay e Game. Um preset de Conversation ou de Game muda o prompt ao redor, mas não desativa o Post-History Instructions nem o Depth Prompt do personagem.

- **System Prompt**. Instruções específicas do personagem, acrescentadas pelo bloco de personagem do preset ativo, pelo contexto de personagem de Conversation ou pelo card de personagem de Game. Isso não substitui o prompt de sistema principal do chat.
- **Post-History Instructions**. Texto colocado depois do histórico do chat, logo antes de a IA escrever, como "Stay in character".
- **Depth Prompt**. Texto inserido no histórico do chat. **Depth** é quantas mensagens para trás: 0 fica logo depois da mensagem mais recente. O padrão é 4. **Role** é **System**, **User** ou **Assistant**. O padrão é System.

A seção **Regex Scripts** guarda scripts de busca e substituição só deste personagem. Veja [Scripts de regex](../extending/regex-scripts.md).

<a id="use-an-alternative-field-in-selected-chats"></a>

## Use um campo alternativo em chats selecionados

Um campo alternativo dá ao mesmo personagem outra descrição, aparência, história ou outro detalhe nos chats escolhidos, enquanto todos os outros mantêm o original. Cada um dos sete campos do card tem **Add Alternative Field** (adicionar campo alternativo) abaixo dele.

1. Clique em **Add Alternative Field** abaixo do campo que deseja variar. Marinara copia o texto do campo para uma nova alternativa.
2. Edite a alternativa. Ela tem a própria varinha, que usa o texto da alternativa como ponto de partida e não muda o campo original.
3. Abra **Active in 0 chats** (ativo em 0 chats) e marque os chats que devem usá-la. Só aparecem os chats que incluem este personagem.
4. Clique em **Save**.

Regras:

- Um chat só pode usar uma alternativa por campo. Marcar um chat em outra alternativa move o chat para lá.
- Sem chats marcados, a alternativa fica inativa para depois.
- Uma alternativa vazia limpa esse campo nos chats dela.
- As substituições de cenário e de aparência para imagens específicas do chat continuam tendo prioridade.
- Alternativas de **Summary** continuam sendo metadados e não são enviadas para a IA.
- Se o personagem sair de um chat, a atribuição naquele chat fica suspensa e volta a valer quando você adicionar o personagem de novo.
- Exportar, importar e duplicar cards e converter entre personagens e personas mantém o texto alternativo, mas limpa as marcações de chats. Backups do perfil completo mantêm as marcações.

Para remover uma alternativa, clique no botão de lixeira dela, confirme com **Delete** e depois clique em **Save**. Os chats dela voltam ao campo original. O campo original nunca é excluído junto com uma alternativa.

<a id="version-history"></a>

## Histórico de versões

Enquanto **Automatic versioning** estiver ativado, cada salvamento pode acrescentar um instantâneo ao painel **Version history** da aba **Metadata**. Até lá, o painel mostra `Previous card states will appear here after the next edit.` Um contador mostra quantos instantâneos estão salvos.

Para comparar uma versão salva com o card atual:

1. Abra a aba **Metadata**.
2. Em **Version history**, clique em uma versão salva. Uma janela de comparação lista os campos do card lado a lado e marca cada um que mudou.

Para voltar a uma versão mais antiga:

1. Abra a janela de comparação dessa versão ou clique no ícone de restauração dela na lista.
2. Clique em **Restore this version** e confirme.

Marinara salva primeiro o seu card atual no histórico de versões (a não ser que ele já seja igual àquela versão), para você poder voltar a ele depois.

Outros controles do painel:

- O ícone de lápis muda o número de versão do card em um instantâneo, sem restaurá-lo.
- O ícone de lixeira exclui um instantâneo. O seu card atual não muda.
- **Reset** exclui todos os instantâneos salvos e define a versão do card como 1.0. Marinara pede confirmação, e não é possível desfazer. **Reset** fica desligado enquanto houver edições não salvas.

## Revise as atualizações de card propostas por um agente

Em um chat de Roleplay, um agente opcional pode sugerir pequenas edições nos campos do card com base na cena. A janela **Review Character Card Updates** abre para você decidir o que fica. Para cada edição proposta:

- **Approve** aplica a edição, aumenta o número de versão e acrescenta uma entrada ao histórico de versões.
- **Regenerate** pede ao agente que tente de novo.
- **Reject** descarta a edição.

Se o texto mudou depois que a proposta foi feita, o aplicativo avisa antes de deixar você forçar a edição. Para ativar ou desativar esses agentes, veja [Agentes: ajudantes de IA para os seus chats](../agents/agents-overview.md).

## Se não funcionou

- **A varinha não faz nada ou falha.** Confira se você tem uma conexão de texto que funcione. O seu rascunho nunca é sobrescrito quando há falha.
- **Não aparece o botão de avatar por IA.** Adicione primeiro uma conexão de geração de imagens.
- **A Professor Mari não pode ser excluída.** Ela é uma personagem embutida que Marinara restaura a cada inicialização. Veja [Professor Mari, a assistente dentro do aplicativo](../home/professor-mari.md).

## Guias relacionados

- [Personas](personas.md)
- [Importar e exportar cards de personagem](import-export.md)
- [Organizando a biblioteca de personagens](library-organization.md)
