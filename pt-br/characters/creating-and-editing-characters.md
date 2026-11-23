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

O Character Editor substitui a área do chat por um espaço de trabalho que ocupa a página inteira. Em uma tela larga, as abas ficam em uma fileira de botões no cabeçalho. Em algumas larguras intermediárias, os botões exibem só os ícones. Passe o ponteiro sobre um botão para ver o nome dele. Em uma tela estreita, elas ficam em um menu abaixo do nome. As abas, na ordem, são **Metadata**, **Card**, **Onboarding**, **Convo**, **Lorebook**, **Images** (imagens), **Colors**, **Voice**, **Stats** e **Advanced**. Cada aba leva à sua seção de um único formulário longo, então você também pode rolar a página.

O cabeçalho reúne as partes que você mais usa:

- A seta **Back**, o quadro do avatar, um campo de nome e um campo de título ou comentário para uma etiqueta curta, como `Modern AU version`. Uma linha logo abaixo mostra o criador e a versão.
- **Save**. O botão fica desligado até você mudar alguma coisa. Enquanto trabalha, ele mostra **Uploading…** (um avatar está sendo enviado), **Embedding…** (um lorebook está sendo adicionado ao card) ou **Saving…**.
- A estrela **Favorite**.
- O menu **…** (**More actions**, mais ações) reúne:
  - **Ask Professor Mari** (falar com a Professor Mari) abre uma conversa sobre este card.
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
| **Images** | [Sprites de personagem](sprites.md) e [Galerias de personagem e de persona](galleries.md). Veja [A aba Images](#images-tab) abaixo. |
| **Colors** e **Stats** | [Cores do personagem e Status de Roleplay](colors-and-stats.md) |

As seções abaixo explicam **Metadata**, **Card**, **Images**, **Voice** e **Advanced**, além dos avatares e do histórico de versões.


<a id="images-tab"></a>

## A aba Images

A aba **Images** reúne as opções de aparência do personagem nas imagens. Os botões no topo levam a cada seção.

- **Character Sheet** (ficha do personagem) é uma imagem de referência do personagem. Clique em **Manage** (gerenciar) para criar, enviar ou escolher uma ficha. Ative **Use as reference image** (usar como imagem de referência) para dar preferência à ficha sobre o avatar na geração de imagens. Veja [Ficha do personagem](sprites.md#character-sheet).
- **Selfie instructions** (instruções para selfies) são orientações opcionais para as selfies do personagem no modo Conversation, como o estilo da câmera ou as expressões. Noodle e Slurp também podem usá-las se você ativar a opção nas configurações deles. Veja [Selfies](../conversation/selfies.md).
- **Sprites** reúne expressões, sprites de corpo inteiro e clipes de chamadas. Veja [Sprites de personagem](sprites.md).
- **Gallery** (galeria) guarda imagens e vídeos vinculados ao personagem. Veja [Galerias de personagem e de persona](galleries.md).

A aba **Images** da persona tem as mesmas seções, exceto **Selfie instructions**.

<a id="metadata-tab"></a>

## A aba Metadata

A aba **Metadata** guarda os dados de identidade e organização. Eles ajudam a ordenar, compartilhar e acompanhar um card. A maioria deles não é enviada para a IA.

- **Character ID**. Somente leitura. Aparece depois que o card é salvo. Clique em **Copy** para copiá-lo.
- **Name**. O nome exibido. Nos prompts, ele é `{{char}}`, um marcador que Marinara substitui pelo nome do personagem.
- **Other names** (outros nomes). Apelidos, nomes completos ou títulos pelos quais o personagem também é conhecido, como `Clark Kent, Kal-El, Mr. Kent`. Separe os nomes por vírgulas e pressione <kbd>Enter</kbd> ou clique em **Add** (adicionar). Nos chats de Roleplay, eles podem aparecer na cor do nome. O Character Tracker também vincula ao card um personagem que acompanha por um desses nomes. Veja [Cores do personagem](colors-and-stats.md#the-three-colors).
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
| **Public Face** (face pública) | O card sem as partes privadas. | Só quando uma macro ou configuração pedir |

**Public Face** é o que os outros personagens podem ver ou saber sobre o personagem: aparência, jeito, papel, reputação e relacionamentos que não são segredo. Deixe de fora segredos, pensamentos íntimos, histórico privado e instruções de interpretação. Esse campo nunca é enviado como parte do card. Um prompt só o lê onde você coloca a macro `{{publicFace}}`, ou `{{personaPublicFace}}` para a sua persona. Veja [Macros de prompt](../prompts/macros.md#identity-character-and-persona-macros). Em um chat de grupo de Roleplay no modo Individual, **Others' Public Faces** envia o conteúdo aos turnos dos outros personagens. Veja [Mais configurações de Individual](../chats/group-chats.md#more-individual-settings). Um agente cuja fonte **Characters** ou **Persona** está definida como **Public Face** lê o campo no lugar do card. Veja [Outras configurações](../agents/custom-agents.md#other-settings). Com **Send Public Faces** ativado, o Impersonate em Roleplay lê esse campo no lugar do card. Veja [Configurações do Impersonate](../chats/guided-and-impersonate.md#the-impersonate-settings).

**Aparência** tem duas abas, **Prosa** e **Tags de imagem**. **Prosa** é o texto da aparência em si. **Tags de imagem** guarda tags curtas para prompts de imagem, como uma palavra de ativação de LoRA (uma palavra-chave que ativa um estilo de imagem personalizado). Digitar tags marca **Usar nos prompts de imagem**, e um ponto na aba indica que elas estão em uso. Enquanto a opção está marcada e as tags estão preenchidas, os prompts de imagem usam essas tags exatamente como foram escritas, mantendo a prosa como contexto. Desmarque a opção para manter as tags sem usá-las: os prompts de imagem passam a usar **Prosa**. O prompt de avatar por IA também parte das tags. O narrador sempre vê o texto de **Prosa**. A aba **Imagens** leva até aqui com **Ir para Aparência**. A aba tem sua própria varinha. Veja [Tags de imagem pela varinha](#image-tags-from-the-wand).

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

**Summary**, **Description**, **Personality**, **Backstory**, **Appearance** (nas duas abas), **Scenario**, **Public Face**, **Example Dialogue**, **First Message** e cada **Alternate Greeting** têm um botão só com o ícone de varinha acima do campo. A dica do botão mostra o nome do campo que ele escreve.

Antes de começar: configure uma conexão de texto que funcione. Veja [Conectando a um provedor de IA](../connections/connecting-to-a-provider.md).

1. Escreva no campo as ideias que deseja manter, como `smart, scientist, handsome`, ou deixe-o vazio.
2. Preencha os outros campos do card que a IA deve usar como referência. Você não precisa salvar antes.
3. Clique na varinha do campo. Marinara pede de 100 a 300 palavras para esse campo, usando o seu texto como ponto de partida. Example Dialogue pede trocas de exemplo. **First Message** e cada **Alternate Greeting** pedem uma mensagem de abertura que deixa a sua resposta em aberto. O **Public Face** não tem faixa de palavras: a varinha reescreve o restante do card sem as partes privadas, então o tamanho depende do card. Na aba **Tags de imagem** de **Aparência**, a varinha transforma a aparência do card em uma linha de tags de imagem. Veja [Tags de imagem pela varinha](#image-tags-from-the-wand).
4. Edite o resultado e clique em **Save**.

A varinha usa a sua conexão de texto padrão para agentes ou, se não houver uma, a sua conexão de texto padrão. Uma conexão de reserva de agentes configurada continua valendo.

A varinha substitui apenas o campo escolhido no seu rascunho não salvo. Se a geração falhar, o seu texto continua lá. Se você editar esse campo enquanto espera, ou mudar para outro card, um resultado atrasado não sobrescreve o seu trabalho. Você não precisa da Professor Mari para usar a varinha.

<a id="image-tags-from-the-wand"></a>

#### Tags de imagem pela varinha

A varinha na aba **Tags de imagem** de **Aparência** escreve as tags a partir do texto de aparência do card, principalmente do próprio campo **Aparência**. Ela marca **Usar nos prompts de imagem**.

- As tags que já estão na caixa e que o texto de aparência não explica, como uma palavra de ativação de LoRA, ficam exatamente como você as escreveu, no início da linha.
- Depois vêm as novas tags: `1girl`, `1boy` ou `1other`, seguidas dos traços permanentes: corpo, cabelo, olhos, pele, rosto e marcas. Sem tags mantidas, a linha começa com `1girl`, `1boy` ou `1other`.
- As novas tags são em inglês, em minúsculas, no estilo que os modelos de imagem conhecem do Danbooru (um site de imagens de anime cujas tags muitos modelos aprenderam), separadas por vírgulas.
- As novas tags usam apenas traços que o card informa. Roupas, expressões, poses e lugares ficam de fora, porque mudam de cena para cena.

As tags vêm do modelo, não de uma lista de tags reais do Danbooru, então uma tag pode ser escrita de um jeito que o seu modelo de imagem não conhece. Confira a linha e edite antes de salvar.

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
3. Confira ou edite o **Avatar Prompt**. Ele parte das **Tags de imagem** de **Appearance** quando **Usar nos prompts de imagem** está marcado e elas estão preenchidas. Caso contrário, usa **Appearance**, depois **Description** e depois **Personality**, o primeiro que tiver texto.
4. Se o card já tiver um avatar, você pode marcar **Use current avatar as a reference**.
5. Clique em **Generate**. Para tentar de novo, clique em **Regenerate**.
6. Clique em **Use Avatar** quando gostar do resultado.

O tamanho da imagem vem do tamanho de imagem **Portraits**, nas configurações de geração de imagens. O padrão é 1024 por 1024. Se **Expose media prompts before sending** estiver ativado, uma etapa de revisão do prompt aparece antes de cada pedido.

## A aba Voice

A aba **Voice** define como o personagem soa quando o Text to Speech lê as falas dele em voz alta.

- **Voice**. A voz deste personagem. Uma mudança é salva na hora, sem **Save**. É a mesma configuração da linha deste personagem nas configurações da tarefa **Voice** em **Connections**. Deixe em branco para usar a voz padrão. Quando um card com nome correspondente tem uma voz, como o original de uma cópia AU, o campo vazio mostra o nome dessa voz, porque este card também a usa.
- **Preview** (ouvir). Toca uma frase curta com essa voz. A frase diz o nome do personagem, ou o **Phonetic name**, quando houver um definido.
- **Phonetic name**. Uma grafia opcional, usada apenas para corrigir a pronúncia. Ele faz parte do card, então clique em **Save** para mantê-lo.

Se o Text to Speech estiver desligado, ou se todos os personagens compartilharem uma única voz, uma observação curta substitui o campo **Voice**. Com uma única voz compartilhada, a observação oferece **Use a voice per character** (usar uma voz por personagem). **Open Text to Speech settings** (abrir as configurações de Text to Speech) abre as configurações da tarefa **Voice** em **Connections**. Veja [Configuração de Text to Speech (TTS)](../media/tts-setup.md).

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
2. Opcional: clique no título dela, como **Backstory alternative 1** (Alternativa 1 de História do personagem), e digite um nome, como `Young`. Os nomes têm até 60 caracteres. Deixe o nome vazio para manter o título numerado.
3. Edite a alternativa. Ela tem a própria varinha, que usa o texto da alternativa como ponto de partida e não muda o campo original.
4. Abra **Active in 0 chats** (ativo em 0 chats) e marque os chats que devem usá-la. Só aparecem os chats que incluem este personagem.
5. Clique em **Save**.

Você também pode escolher de dentro de um chat. Abra **Chat Settings** (configurações do chat) e expanda **Card Field Alternatives** (alternativas dos campos do card). A seção lista a persona do chat e cada personagem do chat que tenha alternativas, com um menu por campo. Escolha **Original** ou uma alternativa pelo nome. O card é salvo na hora, e a escolha vale a partir da próxima resposta. A seção fica escondida quando nada no chat tem alternativas.

Regras:

- Um chat só pode usar uma alternativa por campo. Marcar um chat em outra alternativa, ou escolher outra em Chat Settings, move o chat para lá.
- Sem chats marcados, a alternativa fica inativa para depois.
- Uma alternativa vazia limpa esse campo nos chats dela.
- Uma alternativa de **Aparência** tem suas próprias abas **Prosa** e **Tags de imagem**. Nos chats dela, suas tags substituem as do card. Com as tags vazias ou desmarcadas, os prompts de imagem usam a prosa da alternativa, nunca as tags do card. Uma nova alternativa também copia as tags do card. Sua aba **Tags de imagem** tem uma varinha própria, que lê a prosa e as tags da alternativa.
- As substituições de cenário e de aparência para imagens específicas do chat continuam tendo prioridade.
- Alternativas de **Summary** continuam sendo metadados e não são enviadas para a IA.
- Se o personagem sair de um chat, a atribuição naquele chat fica suspensa e volta a valer quando você adicionar o personagem de novo.
- Exportar, importar e duplicar cards e converter entre personagens e personas mantém o texto alternativo, mas limpa as marcações de chats. Backups do perfil completo mantêm as marcações.

Para remover uma alternativa, clique no botão de lixeira dela, confirme com **Delete** e depois clique em **Save**. Os chats dela voltam ao campo original. O campo original nunca é excluído junto com uma alternativa.

<a id="version-history"></a>

## Histórico de versões

Enquanto **Automatic versioning** estiver ativado, cada salvamento pode acrescentar um instantâneo ao painel **Version history** da aba **Metadata**. Até lá, o painel mostra `Previous card states will appear here after the next edit.` Um contador mostra quantos instantâneos estão salvos. Atualizar o personagem a partir de um card mais novo sempre salva um instantâneo antes, mesmo com o botão desligado. Veja [Atualizar um personagem que você já tem](import-export.md#update-a-character-you-already-have).

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
