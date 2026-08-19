# Configurações do Noodle e transferência para os chats

Neste guia você conhece o painel **Noodle settings** (configurações do Noodle) seção por seção, com todos os valores padrão e limites. Ele também explica como ligar Noodle aos chats. Dois recursos fazem isso: **Carryover to chats** (transferir para os chats) e o botão liga/desliga **Allow Noodle references** (permitir referências ao Noodle), que existe em cada chat. Os dois funcionam em direções opostas.

Noodle é a linha do tempo de rede social simulada dentro do Marinara Engine. Se você ainda não conhece o recurso, leia antes [Noodle: a linha do tempo social dentro do aplicativo](overview.md). A persona é o personagem que você interpreta no chat. A conexão é um acesso salvo a um provedor de IA que gera texto ou imagens. Veja [Conectando a um provedor de IA](../connections/connecting-to-a-provider.md).

## Abrir o painel de configurações do Noodle

1. Abra Noodle pela barra superior.
2. Na barra lateral esquerda, clique no botão **Settings** (Configurações), o ícone de engrenagem.
3. O cabeçalho do painel mostra **Noodle settings**.

Todas as configurações do Noodle são globais. Elas valem para todas as personas e todos os chats, não para um chat de cada vez. As mudanças são salvas assim que você as faz.

## NoodleR Access

- **Enable NoodleR**: um botão liga/desliga, padrão **off**. Ative para liberar a central de contas do NoodleR. Enquanto estiver desativado, abrir NoodleR mostra a tela de adesão, as consultas de conta do NoodleR ficam indisponíveis e os dados das contas do NoodleR continuam separados da linha do tempo do Noodle.

NoodleR e Noodle são dois aplicativos simulados diferentes, e cada conta pertence a apenas um deles. Essa separação mantém o conteúdo do NoodleR fora da linha do tempo do Noodle; ela **não** é um recurso de privacidade nem de segurança. Nos dois casos, tudo fica nesta máquina, e qualquer pessoa com acesso ao aplicativo ou à pasta de dados consegue ler. Quem pode ler um post específico do NoodleR é uma configuração à parte, definida post a post – veja **Assinaturas e acesso aos posts** mais adiante.

A tela **Manage stage profiles** (gerenciar perfis de palco), aberta em **Noodle Settings** > **NoodleR Access**, lista os perfis de palco disponíveis na instalação, incluindo os estados de carregamento, de falha e de lista vazia. Um perfil de palco pertence a uma persona pública ou a uma conta de personagem, mas apresenta nome, @, biografia, voz de palco e modo de revelação próprios. As contas do NoodleR criadas antes dos perfis de palco mostram **Setup needed** até que o perfil seja concluído.

### Revelação da identidade de palco

A revelação controla como a identidade pública vinculada pode aparecer no perfil de palco e nos posts gerados pela IA. Ela não decide quem pode ver um perfil ou um post.

- **Publicly connected (Open)**: o perfil de palco pode assumir abertamente que é a mesma pessoa. O texto gerado e os prompts de imagem podem usar o nome público vinculado, o @ e uma continuidade reconhecível.
- **Inspired alter ego (Hinted)**: a personalidade geral, os interesses e os temas podem ser aproveitados, mas o nome público exato e o @ são removidos do contexto de geração e filtrados do texto gerado e dos prompts de imagem antes de o post ser salvo. Traços marcantes ainda podem soar reconhecíveis. No perfil do criador, passe o mouse, dê foco ou toque no selo **Hinted** para revelar a identidade vinculada no Noodle.
- **Separate persona (Secret)**: a identidade vinculada é tratada apenas como inspiração confidencial para a escrita. A geração do perfil recebe um resumo reduzido e sem identificação, e evita ocupações, relações, lugares, bordões e detalhes marcantes do original. Os identificadores exatos também são filtrados do resultado gerado. Isso não é uma garantia formal de anonimato; revise o rascunho antes de salvar.

Use **New profile** (novo perfil) em **Manage stage profiles** para buscar e escolher um personagem ou uma persona elegível. A configuração então explica a revelação e pede que você escolha Open, Hinted ou Secret antes de mostrar o formulário editável do perfil de palco. Preencha o formulário você mesmo ou peça à IA para gerar um rascunho editável a partir do personagem de origem, da opção de revelação e de uma orientação opcional. A IA nunca salva o rascunho sozinha; revise os campos e selecione **Save stage profile** você mesmo. Abra um perfil existente e selecione **Edit profile** para mudar a apresentação ou usar a IA para preencher o rascunho atual de novo. Para quem vê, os perfis Hinted expõem apenas o nome de exibição e o @ da identidade vinculada, pelo selo que dá a dica de propósito; o ID da conta não é exposto. Para quem vê, os perfis Secret não expõem nenhum dado da identidade vinculada.

### Posts guiados no NoodleR

Cada perfil de palco tem um compositor recolhido, na própria tela, para os posts do NoodleR. Digite um título opcional e um corpo, depois selecione **Post** para publicar exatamente esses valores, sem acionar o provedor. É obrigatório ter corpo, imagem ou enquete, então uma imagem sozinha ou uma enquete de duas a quatro opções também podem ser publicadas. As imagens enviadas ficam no armazenamento de mídia do próprio NoodleR, e não na galeria do Noodle.

Selecione **Guide** para transformar o rascunho atual de título e corpo pelo gerador que o NoodleR já usa. Ele preserva a imagem, a enquete, o nível de acesso e o preço PPV que você escolheu, e o resultado gerado continua sendo só título e corpo; ele não gera nem substitui anexos. Os arquivos de imagem e as URLs ainda não publicados ficam no rascunho atual do cliente até **Post** ou **Guide** dar certo. Se **Post**, **Guide** ou a gravação da mídia falhar, o rascunho atual continua disponível para correção ou nova tentativa.

O nível de acesso do post protege o post inteiro. Os posts bloqueados para assinantes e os posts PPV não expõem a imagem, as opções da enquete nem os votos. Quem pode ler o post vota uma vez e depois pode mudar o voto; a persona vinculada ao criador não vota no post do próprio perfil de palco.

## Assinaturas e acesso aos posts

A central do NoodleR sempre mostra as páginas dos criadores pela persona selecionada globalmente no momento. As assinaturas e os desbloqueios de PPV pertencem a essa persona, então trocar a persona ativa pode mudar quais criadores e posts ficam disponíveis. Para criar, editar ou excluir os seus próprios perfis de palco, use **Noodle Settings** > **NoodleR Access** > **Manage stage profiles**.

Ao guiar um post, escolha um nível de acesso:

- **Public**: todas as personas que enxergam o perfil de palco podem ler o post.
- **Subscribers**: o post fica bloqueado até a persona que está vendo assinar aquele perfil de palco.
- **PPV**: o post tem um preço simulado e fica bloqueado até essa persona desbloqueá-lo. Nenhum pagamento real é processado.

Cada perfil de palco tem as próprias configurações em **Subscriber access** (acesso dos assinantes). Com **Subscriptions include PPV**, os assinantes leem os posts PPV daquele perfil sem desbloquear um por um. Essa opção vem desativada. Já **Hidden from personas** remove o perfil de palco e todos os posts dele das personas selecionadas, inclusive os pedidos diretos de assinatura e de desbloqueio. As configurações de ocultação valem só para o perfil de palco do NoodleR e não escondem a conta pública do Noodle vinculada a ele.

Use **Delete profile** em um perfil de palco gerenciado para remover aquele perfil, todos os posts publicados por ele, as assinaturas e os registros de desbloqueio de PPV. A conta pública do Noodle vinculada não é excluída e pode servir para criar um novo perfil de palco depois.

## Invites

A seção **Invites** escolhe quais personagens podem participar de uma atualização do Noodle. A atualização é o momento em que a IA escreve um lote de posts, respostas, reposts e curtidas para as contas convidadas.

- **Professor Mari participates**: um botão liga/desliga, padrão **on**. Desative para esconder Professor Mari da descoberta de contas do Noodle e tirá-la dos próximos posts, respostas, reações, menções, gerações de perfil e transferências para os chats. O histórico da linha do tempo é preservado, e reativar o botão restaura a conta dela.
- **Characters to Invite**: uma caixa de busca. Digite aqui para filtrar tanto a lista de pastas quanto a lista de personagens abaixo dela.
- **Add from Folder**: clique para abrir a lista das pastas de personagens. Marque uma ou mais pastas e clique no botão de convite lá embaixo. O texto do botão muda conforme a seleção:
  - **Select folders to invite** quando nada está marcado.
  - **Selected folder characters are invited** quando tudo já foi convidado.
  - **Invite N characters** quando há novos personagens a incluir.
- **Characters**: uma lista rolável com todos os personagens da biblioteca. Cada linha tem um botão para convidar ou remover. O status aparece como **Invited**, **Included by folder** ou **Not invited**.

Convidar a partir de uma pasta é uma ação em massa feita uma única vez. Não é uma sincronização contínua. Os personagens que você colocar naquela pasta depois não são convidados automaticamente.

## Refresh

A seção **Refresh** controla a conexão de IA com que Noodle escreve e a frequência com que Noodle atualiza sozinho.

- **Generation connection**: um menu suspenso. Escolha a conexão que Noodle usa para escrever posts, respostas, reposts, curtidas e o texto dos perfis. Ela começa vazia, com o texto **Choose connection**. Escolha uma antes de qualquer atualização rodar. Os modelos com visão também recebem até oito imagens recentes e relevantes de posts e comentários do Noodle. Os modelos só de texto que recusam essas imagens são chamados de novo, automaticamente, sem elas.
- **Refreshes/day**: um número de 0 a 24, padrão **2**. É a quantidade de atualizações automáticas que Marinara roda por dia. Use 0 para desligar as atualizações automáticas. Esse limite não afeta quantas vezes você atualiza manualmente.

### Programação automática

Quando **Refreshes/day** está acima de 0, Marinara divide o dia em janelas iguais e sorteia um horário dentro de cada uma. Os horários previstos, com o fuso, aparecem em **Automatic schedule**. Clique no lápis ao lado de um horário futuro para movê-lo para outra hora. Horários passados, já concluídos ou repetidos não podem ser escolhidos.

As atualizações automáticas rodam dentro do servidor Marinara. A página do Noodle não precisa ficar aberta, mas Marinara precisa estar em execução. Se uma atualização falhar, a programação mostra o erro e tenta de novo mais tarde, esperando mais a cada nova falha. Se vários horários previstos forem perdidos, uma única atualização de recuperação cobre todos eles, em vez de inundar a linha do tempo.

## Publicação automática do NoodleR

Este é um agendador separado de **Refresh**. **Refresh** controla a linha do tempo pública do Noodle; este controla os criadores do NoodleR. Ele aparece em **Noodle Settings** > **Publishing** quando **Enable NoodleR** está ativado.

Em vez de publicar na hora cheia, o NoodleR prepara posts com antecedência em uma pequena reserva e publica cada um no horário previsto. Por isso, um criador pode mostrar o horário do próximo post antes de o post existir.

- **Automatic posting schedule**: botão, padrão **on**. Desligar interrompe toda publicação automática do NoodleR. Posts preparados cujo horário passe enquanto estiver desligado são retirados, em vez de publicados com atraso.
- **Posts/day**: número de 1 a 24, padrão **4**. É o limite diário de tentativas automáticas de texto; o mesmo limite vale para tentativas de imagem. Posts manuais e **Refresh NoodleR now** não contam.
- **Night quiet**: botão, padrão **on**. Criadores vinculados a um **personagem** não recebem horários entre 23:00 e 07:00 no fuso local. Criadores vinculados a uma persona não são afetados.
- **Text attempts** e **Image attempts**: contadores somente leitura das tentativas usadas hoje diante do limite de **Posts/day**.
- **Prepared posts**: somente leitura; mostra quantos posts estão na reserva e o último horário previsto.
- **Refresh all now**: escreve imediatamente um post para cada criador com **Automatic** ligado. Os que estão desligados não são incluídos nem informados; criadores ocupados são ignorados. Esse post retira qualquer post preparado para o mesmo criador na próxima hora.
- **Per creator**: cada linha tem os botões **Automatic** e **Images**. Ambos começam em **off** para criadores feitos fora da configuração guiada; os criados nela usam suas escolhas. Desligar **Automatic** deixa o criador apenas manual.

As respostas automáticas de criadores têm um limite separado de 10 por período móvel de 24 horas para toda a instalação, compartilhado entre todos os criadores, não 10 por criador.

A publicação automática roda no servidor Marinara. O Marinara precisa estar em execução, mas a página do NoodleR não precisa ficar aberta.

## Active Accounts

A seção **Active Accounts** define quantas contas elegíveis participam de uma atualização. São elegíveis os personagens convidados, os personagens incluídos por pasta e os usuários aleatórios, se você os tiver ativado.

- **Active selection**: um menu suspenso, padrão **Random range**. As opções são **Random range**, **Exact count** e **All invited**.
- Com **Random range**, aparecem dois campos: **Min active** (1 a 100, padrão **2**) e **Max active** (1 a 100, padrão **5**). Cada atualização sorteia um número entre os dois.
- Com **Exact count**, aparece um campo: **Active count** (1 a 100). Ele fixa a quantidade de contas.
- Com **All invited**, todas as contas elegíveis participam, sem limite.

A persona ativa é sempre elegível, além dessas contas. Professor Mari é elegível enquanto **Professor Mari participates** estiver ativado.

Noodle escolhe as contas ativas antes de preparar os perfis de estreia. Só os personagens ativos que ainda não têm um perfil de Noodle gerado recebem um pedido de geração de perfil; os personagens convidados que estão inativos ficam de fora. O pedido de escrita da linha do tempo também recebe os cards de personagem apenas das contas escolhidas para aquela atualização.

## Activity

A seção **Activity** limita quanto uma única atualização pode criar. Cada campo é um teto por atualização.

| Campo | Padrão | Faixa |
|---|---|---|
| **Posts** | 8 | 0 a 100 |
| **Replies** | 12 | 0 a 200 |
| **Reposts** | 4 | 0 a 100 |
| **Likes** | 18 | 0 a 500 |

Use 0 em um campo para impedir que a IA crie aquele tipo de atividade.

## Image Generation

A seção **Image Generation** deixa Noodle anexar imagens feitas por IA a alguns posts. Isso exige uma conexão de geração de imagens, ou seja, uma conexão configurada para criar imagens. Veja [Provedores de IA compatíveis](../connections/providers-reference.md).

- **Image generation**: um botão liga/desliga, padrão **off**. Ative para a IA gerar imagens dos posts.
- Com ele ativado, aparecem mais controles:
  - **Image generation connection**: um menu suspenso, padrão **Default image generation connection**. Deixando em Default, Noodle usa a conexão marcada como padrão para geração de imagens no painel **Connections** (Conexões).
  - **Prompt instructions**: uma caixa de texto com um conteúdo padrão embutido, de até 4000 caracteres. Essas observações extras entram no prompt de imagem, o texto que Marinara envia para a IA.
  - **Use avatar references**: um botão liga/desliga, padrão **on**. Envia o avatar ou as imagens de referência do personagem para o modelo de imagem.
  - **Include descriptions**: um botão liga/desliga, padrão **on**. Acrescenta ao prompt de imagem as anotações escritas sobre a aparência do personagem.
  - **Images/refresh**: um número de 0 a 50, padrão **3**. Ele limita as imagens de post geradas em cada atualização, manual ou automática.
- **Attach gallery images**: um botão liga/desliga separado, padrão **off**. Ele continua visível mesmo com **Image generation** desativado. Em vez de criar uma imagem nova, ele permite que um post reaproveite uma imagem da galeria daquele personagem ou de um chat em que ele aparece.

Se você ativar **Image generation** sem ter uma conexão de imagem utilizável, a atualização é bloqueada. Aparece a mensagem "Choose an image generation connection for Noodle first." Uma imagem que falha é tentada mais uma vez. Se a segunda tentativa também falhar, a atualização segue e publica um post limpo, só com texto, em vez de expor o prompt de imagem não usado.

O modelo que Noodle usa para escrever esses prompts de imagem se chama **Noodle Post Image**. Você o edita em **Settings** > **Generations** > **Image Generation Prompt Overrides**. O texto de **Prompt instructions** entra nesse modelo, e o resultado passa depois pelo perfil de estilo de imagem que você usa normalmente. Veja [Prompt Overrides para imagem e vídeo](../prompts/prompt-overrides.md) e [Perfis de estilo de imagem](../media/style-profiles.md). Professor Mari não tem card de personagem, então as imagens dos posts dela usam o avatar e a arte de referência embutidos.

## Timeline Writing

A seção **Timeline Writing** ajusta o tom de quem escreve a atualização e o comportamento da memória de longo prazo.

- **Enhanced tone & continuity**: um botão liga/desliga, padrão **off**. Ativado, a voz de cada conta se apoia com mais força na Personalidade/Descrição/História dela, em vez de um tom animado padrão; as contas são incentivadas a reagir, citar ou discordar dos posts umas das outras dentro da mesma atualização; posts antigos são retomados com mais frequência (e a preferência vai para os posts relevantes às contas ativas no momento, em vez de uma escolha totalmente aleatória); e a instrução de retomada passa a permitir as referências, em vez de desencorajá-las. Desativado, o tom e o comportamento de retomada originais do Noodle são reproduzidos exatamente, então ativar essa opção é a única forma de mudar as linhas do tempo.
- **Use generated character schedules**: um botão liga/desliga, padrão **off**. Ativado, Noodle inclui a agenda de Conversation já gerada para hoje de cada personagem participante, quando ela existir. Noodle não gera nem atualiza agendas por conta própria. A data e a hora locais do usuário entram em toda atualização da linha do tempo, com essa opção ativada ou não.

## Personalizar a voz de quem escreve a linha do tempo

Quem escreve a atualização do Noodle segue um conjunto embutido de instruções de tom e de liberdade criativa: quanta personalidade os posts de cada conta devem carregar e o quanto as contas podem brincar, provocar ou brigar entre si. Reescreva esse texto em **Settings** > **Generations** > **Image Generation Prompt Overrides** > **Noodle Timeline Voice & Tone** (o título da seção diz "Image", mas essa lista reúne todos os prompts de texto personalizáveis do Noodle e do Conversation, não só os de imagem). O texto padrão mostrado ali acompanha o botão **Enhanced tone & continuity** descrito acima até você personalizá-lo; depois que você salva um texto próprio, ele passa a valer independentemente desse botão.

Essa substituição cobre apenas a voz e o tom. As regras que mantêm o resultado da atualização válido (quais ações estruturadas são permitidas, como as interações devem ser direcionadas e assim por diante) não fazem parte desse texto e continuam sempre em vigor, então uma voz reescrita não quebra a atualização.

## World / Lore

A seção **World / Lore** permite que uma atualização puxe entradas de lorebook, o mesmo sistema de lorebooks usado na geração dos chats. O lorebook é um conjunto de fatos do seu mundo.

- **Lorebook context**: um botão liga/desliga, padrão **off**. Ativado, cada atualização varre o texto recente dos posts e das respostas do Noodle, mais os perfis dos personagens ativos, procurando palavras-chave dos lorebooks, e inclui as entradas correspondentes como contexto de mundo para as contas que participam daquela atualização. Só os lorebooks ligados a um personagem ativo (ou marcados como globais) podem ser acionados. O conteúdo de mundo acionado tem um teto fixo de 8.192 tokens por atualização. Isso vem desativado, então as linhas do tempo existentes não mudam até você ativar.

## Carryover

A seção **Carryover** empurra a atividade recente do Noodle para os chats. Com ela ativada, o prompt do chat ganha um bloco "Recent Social Media Activity" que descreve o que os personagens andaram fazendo no Noodle.

- **Carryover to chats**: três botões liga/desliga independentes, todos **off** por padrão: **Conversations**, **Roleplays** e **Games**. Ative os modos que devem receber a atividade do Noodle.
- **Carry hours**: um número de 1 a 720, padrão **48**. É até quantas horas atrás Noodle procura atividade para transferir.
- **Carry items**: um número de 1 a 50, padrão **8**. É o máximo de resumos de atividade acrescentados a um turno do chat.

A transferência só puxa a atividade dos personagens convidados no Noodle, mais a persona ativa do chat. Estar incluído apenas por pasta não basta aqui.
O bloco completo da transferência tem um teto fixo próprio de 8.192 tokens por geração do chat. Se o limite de itens ultrapassar esse teto, Marinara mantém os resumos mais novos que couberem e os exibe em ordem cronológica.

## Reset Noodle

A seção **Reset Noodle** limpa a linha do tempo e mantém as contas e as configurações.

1. Clique no botão **Reset Noodle Timeline**.
2. Aparece uma caixa de diálogo chamada **Reset Noodle Timeline**. Ela diz "This removes all posts, replies, likes, reposts, activity digests, and refresh records. Profiles, follows, invites, and settings stay."
3. Clique em **Reset timeline** para confirmar.

Isso exclui apenas o conteúdo da linha do tempo. As contas, os @, as biografias, quem cada conta segue, os convites e todas as configurações do Noodle continuam como estavam.

## Usuários aleatórios

Os usuários aleatórios são seis contas de ambiente embutidas, que não vêm da sua biblioteca: Thread Countess, Packet Soup, Orbit Notice, Glass Bulletin, Moth Hour e Brine Index. Cada uma tem uma bio curta e de fantasia.

Você as ativa na linha **Random users**, no topo da lista **Characters**, dentro da seção **Invites**. Ela vem **off** por padrão. O subtítulo mostra **Enabled** quando está ativada, ou **Ambient fake profiles** quando está desativada. Ativadas, essas contas podem postar, curtir, repostar, responder e seguir durante uma atualização. Elas nunca podem ser seguidas a partir de um perfil.

## Ligar Noodle aos seus chats

Noodle e os chats compartilham contexto nas duas direções. São dois recursos separados. Ativar um não ativa o outro.

**Carryover to chats** (definido nas configurações do Noodle) manda a atividade do Noodle para o chat. Ele acrescenta o bloco "Recent Social Media Activity" ao prompt daquele chat, como descrito na seção **Carryover** acima.

**Allow Noodle references** é um botão liga/desliga de cada chat. Ele manda a atividade no sentido contrário, do chat para o Noodle. Você o encontra nas configurações do próprio chat, perto da área **Connected Chats**. Veja [Visão geral do painel Chat Settings](../chats/chat-settings.md). Ele vem **off** por padrão em todos os chats. A descrição diz "Timeline refreshes may include recent messages from this chat, with the chat name, mode, and participants stated in the prompt." Se aquele chat também tiver [agendas de personagem](../conversation/schedules.md) em execução, o status e a atividade atuais do personagem naquela história (por exemplo, "currently dnd (At the office)") entram junto com as mensagens dele, limitados àquele chat.

Para a atividade do Noodle aparecer em um chat, ative o modo correspondente em **Carryover to chats**. Para uma atualização do Noodle ler um chat, ative **Allow Noodle references** naquele chat. Use um dos dois sozinho ou os dois juntos.

## Resolução de problemas

- **Refresh now não gera nada**: escolha uma **Generation connection**, convide pelo menos um personagem (ou ative os usuários aleatórios) e veja o erro mostrado na seção **Refresh**.
- **As atualizações automáticas não acontecem**: coloque **Refreshes/day** acima de 0, mantenha o servidor Marinara em execução e confira os horários previstos e o fuso em **Automatic schedule**. Se a programação mostrar um erro, resolva o problema de conexão ou de limite de requisições e deixe a nova tentativa rodar.
- **Os posts não citam um chat recente**: ative **Allow Noodle references** nas configurações daquele chat e verifique se o personagem está convidado. O contexto do chat é uma orientação para a IA, não uma garantia.
- **A atividade do Noodle não aparece nos chats**: ative o modo correspondente em **Carryover to chats** e aumente **Carry hours** se a atividade for antiga demais.
- **Os posts não têm imagens**: ative **Image generation**, escolha uma conexão de imagem que funcione e confira o limite de **Images/refresh**.

## Configurações e valores padrão

Esta tabela lista todas as configurações do Noodle com o valor padrão e a faixa aceita.

| Configuração | Padrão | Faixa ou opções |
|---|---|---|
| **Enable NoodleR** | off | on ou off |
| **Generation connection** | nenhuma | qualquer conexão de texto (obrigatória para a atualização) |
| **Professor Mari participates** | on | on ou off |
| **Refreshes/day** | 2 | 0 a 24 (0 desliga as atualizações automáticas) |
| **Automatic posting schedule** | on | on ou off |
| **Posts/day** | 4 | 1 a 24 |
| **Night quiet** | on | criadores-personagens ignoram 23:00–07:00 |
| **Automatic** por criador | off | a configuração guiada pode ativar |
| **Images** por criador | off | a configuração guiada pode ativar |
| Respostas automáticas de criadores | 10 por 24 horas | para toda a instalação, não por criador |
| **Active selection** | Random range | Random range, Exact count, All invited |
| **Min active** | 2 | 1 a 100 (só em Random range) |
| **Max active** | 5 | 1 a 100 (só em Random range) |
| **Active count** | igual a **Max active** | 1 a 100 (só em Exact count) |
| **Posts** | 8 | 0 a 100 |
| **Replies** | 12 | 0 a 200 |
| **Reposts** | 4 | 0 a 100 |
| **Likes** | 18 | 0 a 500 |
| **Image generation** | off | on ou off |
| **Image generation connection** | Default | qualquer conexão de geração de imagens |
| **Prompt instructions** | texto embutido | até 4000 caracteres |
| **Use avatar references** | on | on ou off |
| **Include descriptions** | on | on ou off |
| **Images/refresh** | 3 | 0 a 50 |
| **Attach gallery images** | off | on ou off |
| **Lorebook context** | off | on ou off |
| **Enhanced tone & continuity** | off | on ou off |
| **Carryover: Conversations** | off | on ou off |
| **Carryover: Roleplays** | off | on ou off |
| **Carryover: Games** | off | on ou off |
| **Carry hours** | 48 | 1 a 720 |
| **Carry items** | 8 | 1 a 50 |
| **Allow Noodle references** (por chat) | off | on ou off |

## Guias relacionados

- [Noodle: a linha do tempo social dentro do aplicativo](overview.md)
- [Visão geral do painel Chat Settings](../chats/chat-settings.md)
- [Conectando a um provedor de IA](../connections/connecting-to-a-provider.md)
- [Provedores de IA compatíveis](../connections/providers-reference.md)
