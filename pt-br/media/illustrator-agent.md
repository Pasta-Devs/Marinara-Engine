# Agente Illustrator

Este guia explica o **Illustrator** (ilustrador), um ajudante embutido que desenha cenas do chat enquanto você conversa. Aqui você vê o que ele faz, como ativar, quais estilos de arte estão disponíveis e quais são as duas conexões necessárias.

## O que o agente Illustrator faz

Um agente é um pequeno ajudante de IA que roda automaticamente dentro de um chat. O **Illustrator** é um agente de pós-processamento, ou seja, entra em ação depois que a IA termina cada resposta. Ele lê a resposta mais recente e decide se aquele momento merece uma imagem. Quando merece, o Illustrator escreve um prompt de imagem (o texto que Marinara envia para a IA) e manda para o provedor de imagens. O prompt é a descrição em texto que diz ao modelo de imagem o que desenhar.

O Illustrator não desenha a cada mensagem. Por padrão, depois de criar uma imagem ele espera 5 mensagens aceitas, do usuário e da IA, antes de criar outra. Dar swipe (resposta alternativa) ou regenerar a mesma resposta não faz esse intervalo avançar. Se ele achar que o momento não vale uma ilustração, pula e não gera nada. Toda imagem criada vai para a galeria do chat, na seção **Gallery** (galeria).

O Illustrator funciona em chats de **Roleplay** e **Game Mode**, e instalar o agente também libera as selfies do Conversation Mode. A descrição curta dele no aplicativo diz: "Responsible for image and video generations." Os passos de configuração e as opções deste guia valem para os chats de Roleplay. Game Mode usa um único botão liga/desliga, explicado na seção de Game Mode mais abaixo.

## Antes de começar

O Illustrator escreve o prompt de imagem, mas precisa de uma conexão de imagem separada para desenhar de fato. Uma conexão de imagem é um vínculo salvo com um provedor de imagens, como OpenAI ou um servidor local do Stable Diffusion.

Configure primeiro uma conexão de imagem. Há dois jeitos de entregar uma ao Illustrator:

1. Marque uma conexão de imagem como padrão. Abra o painel **Connections** (conexões), expanda a seção **Defaults** (padrões) e escolha a conexão em **Images**.
2. Ou dê ao Illustrator uma conexão de imagem própria, na tela completa de configuração dele (veja o botão **Open Setup** mais adiante).

Sem nenhuma conexão de imagem disponível, a imagem falha e o aplicativo pede que você escolha uma. Veja [Provedores de geração de imagens e configuração](image-providers.md) para adicionar um provedor.

## Como ativar o Illustrator

O Illustrator vem desativado por padrão. Em um chat de **Roleplay**, adicione o agente assim:

1. Abra o chat que você quer ilustrar.
2. Abra **Chat Settings** (configurações do chat) pelo ícone de engrenagem.
3. Encontre a seção **Agents** e ative a opção **Enable Agents**.
4. No grupo **Misc Agents**, encontre o **Illustrator** e adicione com o botão de mais.

Agora aparece um card de configurações do **Illustrator**, com opções próprias. Adicionar um agente consome tokens extras (o token é um pedacinho de texto) e faz chamadas extras à IA a cada turno, então o painel mostra uma estimativa de custo em tempo real.

### Game Mode: o botão Game Illustrator

Game Mode não usa os passos acima e não mostra as opções **Prompt Mode** nem **Prompt Model**. Em vez disso, abra a seção **Chat Settings** do jogo e ative o botão liga/desliga **Game Illustrator**. A descrição dele diz: "Auto-generate scene illustrations, NPC portraits, and location backgrounds during gameplay."

## Modos de prompt

O seletor **Prompt Mode** define o estilo de arte que o Illustrator usa em todo prompt que escreve. No card do agente, esse seletor aparece com o nome **Prompt**. Logo abaixo há uma linha curta: "Prompt mode controls how Illustrator writes image prompts for this chat."

O seletor traz estes estilos:

- **Illustration**: uma única imagem de cena, bem acabada. É o estilo geral.
- **Comic Page**: uma página de quadrinhos com quadros, balões de fala, legendas e efeitos sonoros.
- **Colored Manga**: uma cena de mangá colorido, com balões estilizados e efeitos sonoros.
- **B&W Manga**: uma página de mangá em preto e branco, com traço a nanquim e sombreado em retícula.
- **Background**: um cenário ou plano de ambientação, sem personagens na imagem.
- **Selfie**: uma selfie feita pelo personagem ou um retrato informal.

Um agente Illustrator recém-adicionado começa no estilo **Background**. Mude o estilo quando quiser, pelo seletor. A aparência final da imagem também depende do perfil de estilo. Veja [Perfis de estilo de imagem](style-profiles.md) para configurar isso.

## Prompt Model e a conexão de imagem

O Illustrator usa duas conexões diferentes, e vale a pena não confundir uma com a outra.

O **Prompt Model** é o modelo de texto que escreve o prompt de imagem. Não é o modelo que desenha a imagem. Escolha no menu suspenso **Prompt Model**, no card do Illustrator. O padrão é **Main chat model**, que reaproveita a mesma conexão já usada pelo chat. Escolha outra conexão de texto se preferir que outro modelo escreva os prompts.

A conexão de imagem é o provedor de imagens que desenha a imagem final. Você define essa conexão como descrito em **Antes de começar**: em **Defaults → Images** ou na tela de configuração do próprio agente.

## Attach Card Appearance e Send Avatar References

Dois botões liga/desliga no card do Illustrator ajudam os personagens a ficarem coerentes. Os dois vêm desativados por padrão.

**Attach Card Appearance** acrescenta ao prompt de imagem o texto de aparência salvo de cada personagem visível. O texto de ajuda diz: "Append matched character appearance lines to image prompts, using only visible/generated names." Ative quando quiser que a imagem corresponda à descrição escrita do personagem.

**Send Avatar References** envia ao provedor de imagens os avatares de personagens e personas, ou os sprites deles (o sprite é a imagem do personagem no palco), como imagens de referência. O texto de ajuda diz: "Send matching character and persona avatars or sprites as reference images when the provider supports them." Isso ajuda o modelo de imagem a copiar um rosto ou uma roupa. Nem todo provedor aceita imagens de referência, então o resultado depende do provedor escolhido.

## Vários personagens na NovelAI

Quando a conexão de imagem do Illustrator usa a NovelAI com um modelo V4, V4.5 ou V5, o modelo que escreve o prompt recebe a instrução de criar uma descrição extra para cada personagem visível. Cada descrição contém a aparência, a expressão, a pose e a posição aproximada daquele personagem no quadro. Marinara compara as descrições com a lista de personagens da cena, descarta as que não consegue associar e envia as demais à NovelAI como prompts nativos de personagem, junto com o prompt principal da cena. Isso evita que cabelo, roupas e outros traços se misturem entre os personagens nas cenas em grupo.

A quantidade de descrições depende do modelo. O V5 aceita até 22 personagens, e o V4 ou V4.5 até 6. Cenas com mais personagens visíveis mantêm os mais importantes e tratam os demais como figuras de fundo sem nome.

O modelo que escreve o prompt também recebe instruções sobre a origem dos detalhes de cada descrição. Os traços fixos vêm do campo **Appearance** (aparência) do personagem ou da persona: quando o campo já contém tags Danbooru, elas são copiadas como estão; quando contém prosa, o modelo a converte em tags. As roupas vêm do traje atual no tracker de personagens, quando ele está em execução, e também são convertidas em tags.

Com **Attach Card Appearance** (anexar aparência do card) ativado, o modelo também recebe como referência o texto completo de Appearance de cada card e persona do chat, para que cards longos ou com vários personagens não sejam cortados. Cards que descrevem vários personagens em um único campo Appearance no formato `[NAME] tags | [NAME] tags` são separados por personagem. O modelo decide o que usar: copia os traços fixos para a descrição correspondente, trata as tags de roupas do card como um padrão que o tracker ou a cena pode substituir e ignora personagens que não estão na cena. Quando o modelo retorna descrições de personagens, Marinara não acrescenta mais nada ao prompt. Quando ele não retorna nenhuma, como acontece nas cenas de um só personagem, a linha habitual de aparência é acrescentada ao prompt principal como antes.

Não é preciso configurar nada. As descrições só são usadas em uma conexão com o próprio servidor da NovelAI, então proxies e outros provedores não são afetados. Com **Review image prompts before sending** (revisar prompts de imagem antes de enviar) ativado, a janela de revisão lista as descrições abaixo do prompt principal para você ver o que será enviado. Nela, as descrições são somente leitura; edite o prompt principal como de costume.

## Mais configurações e execução manual

O card do Illustrator tem um botão **Open Setup** (abrir a configuração). Ele abre a tela completa de configuração do agente, onde você define com que frequência o agente roda e dá a ele uma conexão de imagem própria.

Defina **Run Interval** (intervalo de execução) como **0** para gerar apenas manualmente. Isso interrompe as execuções automáticas do Illustrator, inclusive os fundos automáticos de cena, mas mantém o agente instalado e disponível nas ações da Gallery. O padrão continua sendo **5**; escolha um intervalo positivo para retomar as execuções automáticas. Você também pode escolher 0 ao adicionar Illustrator a um chat.

Também é possível criar uma imagem na hora, sem esperar. Abra a seção **Gallery** do chat e use o botão **Illustrate**. O Illustrator roda uma vez imediatamente, e o botão mostra **Generating...** enquanto trabalha. Isso é útil quando você quer uma imagem do momento atual e o agente ainda não desenhou nenhuma.

## Guias relacionados

- [Provedores de geração de imagens e configuração](image-providers.md)
- [Perfis de estilo de imagem](style-profiles.md)
- [Planos de fundo de cena e a galeria](scene-backgrounds.md)
- [Agentes: ajudantes de IA para os seus chats](../agents/agents-overview.md)
- [Conectando a um provedor de IA](../connections/connecting-to-a-provider.md)
