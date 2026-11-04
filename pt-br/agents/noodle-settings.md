# Configurações do Noodle e transferência para os chats

Use o painel **Noodle settings** (configurações do Noodle) para escolher quem participa da linha do tempo, quanto as contas postam e como o Noodle compartilha contexto com os seus chats. Dois recursos compartilham contexto em direções opostas: **Carryover to chats** (transferir para os chats) e o botão liga/desliga **Allow Noodle references** (permitir referências ao Noodle), que existe em cada chat.

Se você ainda não conhece o Noodle, leia antes [Noodle: a linha do tempo social dentro do aplicativo](noodle.md). A persona é o personagem que você interpreta em um chat. Para as contas de IA, veja [Conectando a um provedor de IA](../connections/connecting-to-a-provider.md).

## Abrir as configurações

1. Abra o Noodle pela **Home** (início).
2. Na barra lateral esquerda, clique em **Settings** (Configurações), no ícone de engrenagem. O cabeçalho mostra **Noodle settings**.
3. Escolha uma página com os botões abaixo do cabeçalho.

| Página | Seções |
|---|---|
| **General** (geral) | [Refresh](#refresh), [Translation](#translation) |
| **Timeline** (linha do tempo) | [Activity](#activity), [Image Generation](#image-generation) |
| **Participants** (participantes) | [Invites](#invites), [Usuários aleatórios](#random-users) (**Ambient Profiles**), [Active Accounts](#active-accounts) |
| **Advanced** (avançado) | **Noodle Prompt**, [Image Understanding](#image-understanding), [Timeline Writing](#timeline-writing), [World / Lore](#world--lore), [Carryover](#carryover), [Reset Noodle](#reset-noodle) |

Todas as configurações do Noodle são globais. Elas valem para todas as personas e todos os chats. As mudanças são salvas assim que você as faz. A lista completa dos valores padrão está em [Configurações e valores padrão](#settings-and-defaults).

## Refresh

A atualização é o momento em que a IA escreve um lote de posts, respostas, reposts e curtidas para as contas convidadas. Esta seção define o modelo com que Noodle escreve e a frequência com que ele se atualiza sozinho.

- **Generation model** (modelo de geração): o modelo que Noodle usa para escrever posts, respostas, reposts, curtidas e o texto dos perfis. Ele começa não definido, com o texto de exemplo **Choose connection**. Você precisa escolher um antes de qualquer atualização rodar. Um modelo capaz de ver imagens também recebe até oito imagens recentes e relevantes de posts e comentários. Um modelo só de texto que recuse essas imagens é chamado de novo sem elas.
- **Refreshes/day** (atualizações por dia): de 0 a 24, padrão **2**. Quantas atualizações automáticas rodam por dia. 0 as desliga. Isso não limita as atualizações manuais.

### Programação automática

Quando **Refreshes/day** está acima de 0, Marinara divide o dia em janelas iguais e sorteia um horário dentro de cada uma. Os horários previstos, com o fuso horário, aparecem em **Automatic schedule** (programação automática). Clique no lápis ao lado de um horário futuro para movê-lo para outra hora. Horários passados, já concluídos ou repetidos não podem ser escolhidos.

As atualizações automáticas rodam dentro do servidor, então a página do Noodle pode ficar fechada, mas Marinara precisa estar em execução. Se uma atualização falhar, a programação mostra o erro e tenta de novo mais tarde, esperando mais depois de falhas repetidas. Se vários horários previstos forem perdidos, uma única atualização de recuperação bem-sucedida cobre todos eles.

## Translation

**Translate posts automatically** (traduzir posts automaticamente) vem **off** por padrão e exige o Noodle 1.5.0 ou mais recente. Ele mostra uma tradução abaixo de cada post e comentário que não foi escrito pelas suas personas, sem precisar clicar em **Translate** (traduzir) em cada um. Noodle usa os padrões do tradutor salvos nas configurações de **Translation** de um chat, com **Save translator defaults** (salvar padrões do tradutor). Sem padrões salvos, ele traduz para o inglês com o Google Translate. Veja [Tradução de mensagens](../integrations/message-translation.md). Um texto que já está no idioma de destino não ganha uma cópia extra, uma tradução que você oculta continua oculta, e desativar o botão interrompe as traduções que ainda estão na fila.

As traduções ficam guardadas neste navegador, tanto as automáticas quanto as feitas com **Translate**. Elas voltam depois de uma atualização, de sair do Noodle ou de recarregar a página. Outro dispositivo, ou um navegador cujos dados foram limpos, traduz tudo de novo. O botão **Reset Noodle Timeline** também esquece essas traduções.

## Invites

A seção **Invites** (convites) escolhe quais personagens podem participar de uma atualização.

- **Professor Mari participates** (a Professor Mari participa): padrão **on**. Desative para esconder a Professor Mari da descoberta de contas e tirá-la dos próximos posts, respostas, reações, menções, gerações de perfil e transferências para os chats. O histórico existente continua, e reativar a opção restaura a conta dela.
- **Characters to Invite** (personagens a convidar): uma caixa de busca que filtra tanto a lista de pastas quanto a lista de personagens.
- **Add from Folder** (adicionar a partir de uma pasta): abre a lista das suas pastas de personagens. Marque uma ou mais e clique no botão de convite lá embaixo. O texto do botão mostra **Select folders to invite** quando nada está marcado, **Selected folder characters are invited** quando todos já foram convidados e **Invite N characters** quando há novos personagens.
- **Characters** (personagens): todos os personagens da sua biblioteca. Cada linha tem um botão para convidar ou remover e um status: **Invited**, **Included by folder** ou **Not invited**.

Convidar a partir de uma pasta é uma ação em massa feita uma única vez, não uma sincronização contínua. Os personagens que você colocar na pasta depois não são convidados automaticamente.

<a id="random-users"></a>

## Usuários aleatórios

Os usuários aleatórios são seis contas de ambiente embutidas, que não vêm da sua biblioteca: Thread Countess, Packet Soup, Orbit Notice, Glass Bulletin, Moth Hour e Brine Index. Cada uma tem uma bio curta.

Ative-as na linha **Random users** (usuários aleatórios), no topo da lista **Characters**, em **Invites**. Ela vem **off** por padrão e mostra **Ambient fake profiles** quando desativada e **Enabled** quando ativada. Ativadas, essas contas podem postar, curtir, repostar, responder e seguir durante uma atualização. Elas nunca podem ser seguidas.

**Ambient Profiles** (perfis de ambiente), na página **Participants**, permite editar essas identidades ou gerar um conjunto diferente. Sortear de novo mantém os posts e as relações, mas remove as imagens de perfil.

## Active Accounts

A seção **Active Accounts** (contas ativas) define quantas contas elegíveis participam de uma atualização. São elegíveis os seus personagens convidados, os personagens incluídos por pasta e os usuários aleatórios, se estiverem ativados. A sua persona ativa é sempre elegível, além dessas contas, e a Professor Mari também, enquanto ela participar.

- **Active selection** (seleção de contas ativas), padrão **Random range**: **Random range**, **Exact count** ou **All invited**.
- **Random range** mostra **Min active** (de 1 a 100, padrão 2) e **Max active** (de 1 a 100, padrão 5). Cada atualização sorteia um número entre os dois.
- **Exact count** mostra **Active count** (de 1 a 100).
- **All invited**: todas as contas elegíveis participam, sem limite.

Noodle escolhe as contas ativas antes de preparar os perfis de estreia. Só os personagens ativos que ainda não têm um perfil gerado recebem um pedido de perfil. O pedido de escrita da linha do tempo recebe os cards de personagem apenas das contas escolhidas para aquela atualização.

## Activity

Cada campo limita o que uma única atualização pode criar. Use 0 em um campo para impedir aquele tipo de atividade.

| Campo | Padrão | Faixa |
|---|---|---|
| **Posts** | 8 | 0 a 100 |
| **Replies** | 12 | 0 a 200 |
| **Reposts** | 4 | 0 a 100 |
| **Likes** | 18 | 0 a 500 |

## Image Generation

Esta seção deixa o Noodle anexar imagens feitas por IA a alguns posts. Ela exige um modelo de imagem. Veja [Provedores de IA compatíveis](../connections/providers-reference.md) e [Provedores de geração de imagens e configuração](../media/image-providers.md).

- **Image generation** (geração de imagens): padrão **off**. Ative para deixar a IA criar imagens dos posts. Então aparecem mais controles.
- **Image width** (largura da imagem) e **Image height** (altura da imagem): de 64 a 4096 pixels, padrão **1024** por **1536**.
- **Image generation connection** (conexão de geração de imagens): padrão **Default image generation connection**, que usa o modelo marcado como padrão para imagens em **Connections** (Conexões). Um personagem pode usar o próprio (veja [Perfis e seguidas](noodle.md#profiles-and-following)).
- **Image instructions (sent to your LLM)** (instruções de imagem, enviadas ao seu LLM): um texto embutido, de até 4000 caracteres. O modelo da linha do tempo segue esse texto ao escrever a descrição de imagem de cada post, então escreva orientações, não tags de imagem. Para tags de estilo enviadas direto ao modelo de imagem, use um perfil de estilo.
- **Use avatar references** (usar referências de avatar): padrão **on**. Envia o avatar ou as imagens de referência do personagem para o modelo de imagem.
- **Interpret image prompts** (interpretar prompts de imagem): padrão **on**. Um modelo de texto reescreve cada prompt de imagem, seguindo as **Image prompting instructions** (instruções de prompt de imagem) do seu modelo de imagem e o Style text do seu perfil de estilo. Desligado, as instruções não são usadas e o Style text é acrescentado tal como foi escrito.
- **Include descriptions** (incluir descrições): padrão **on**. Acrescenta ao prompt de imagem as anotações escritas sobre a aparência do personagem. Com **Interpret image prompts** ligado, o modelo de texto incorpora essas anotações em vez de colá-las.
- **Images/refresh** (imagens por atualização): de 0 a 50, padrão **3**. Limita as imagens de post geradas em cada atualização, manual ou automática.

**Attach gallery images** (anexar imagens da galeria) é um botão liga/desliga separado, padrão **off**, que continua visível mesmo com a geração de imagens desativada. Em vez de criar uma imagem nova, um post pode reaproveitar uma imagem da galeria daquele personagem ou de um chat em que ele aparece.

Se não funcionou: com a geração de imagens ativada, mas sem um modelo de imagem utilizável, a atualização é bloqueada com "Choose an image generation connection for Noodle first." Uma imagem que falha é tentada mais uma vez. Se falhar de novo, a atualização segue e publica um post limpo, só com texto.

O modelo desses prompts de imagem se chama **Noodle Post Image**. Edite-o em **Settings → Generations → Image Generation Prompt Overrides** (Configurações → Gerações → substituições de prompt de geração de imagens). As suas instruções de imagem entram nesse modelo, e o resultado passa pelo seu perfil de estilo. Veja [Prompt Overrides para imagem e vídeo](../prompts/prompt-overrides.md) e [Perfis de estilo de imagem](../media/style-profiles.md). A Professor Mari não tem card de personagem, então as imagens dos posts dela usam o avatar e a arte de referência embutidos.

## Image Understanding

Esta seção decide como quem escreve a linha do tempo vê as imagens que já estão nela.

- **Show images to the writer** (mostrar as imagens a quem escreve): padrão **on**. Quem escreve recebe até oito imagens recentes da linha do tempo, quando o modelo dele aceita imagens. Desligado, não recebe nenhuma.
- **Image captioning** (descrição automática de imagens): um modelo com visão descreve as imagens da linha do tempo, para que um modelo de escrita só de texto também consiga acompanhá-las. Até você mudar essa opção, ela segue a configuração de descrição automática do **Generation model**. **Use connection default** (usar o padrão da conexão) volta para ela.
- **Captioning model** (modelo de descrição): aparece quando a descrição automática está ligada. **Use Noodle generation connection** (usar a conexão de geração do Noodle) usa o **Generation model**. Escolha outro quando esse modelo não conseguir ver imagens.

A descrição automática continua enviando as imagens da linha do tempo para o modelo de descrição quando **Show images to the writer** está desligado.

## Timeline Writing

Esta seção ajusta o tom e a memória de quem escreve a atualização.

- **Enhanced tone & continuity** (tom e continuidade aprimorados): padrão **off**. Ativado, a voz de cada conta se apoia mais na Personalidade, na Descrição e na História dela, em vez de um tom animado padrão. As contas são incentivadas a reagir, citar ou discordar dos posts umas das outras na mesma atualização. A retomada de posts antigos acontece com mais frequência e prefere os posts relevantes às contas ativas. A instrução de retomada permite as referências, em vez de desencorajá-las. Desativado, o tom e a retomada originais do Noodle continuam exatamente como eram.
- **Use generated character schedules** (usar as agendas de personagem geradas): padrão **off**. Ativado, Noodle inclui a agenda de Conversation já gerada para hoje de cada personagem participante, quando ela existir. Noodle não gera nem atualiza agendas por conta própria. A data e a hora locais atuais entram em toda atualização, com a opção ativada ou não.

### Personalizar a voz de quem escreve

Você pode reescrever as instruções embutidas de tom e de liberdade criativa de quem escreve em **Settings → Generations → Image Generation Prompt Overrides → Noodle Timeline Voice & Tone**. O título da seção diz "Image", mas a lista reúne todos os prompts de texto personalizáveis do Noodle e do Conversation. O texto padrão ali acompanha **Enhanced tone & continuity** até você salvar um texto próprio; depois disso, o seu é usado de qualquer jeito.

Essa substituição cobre apenas a voz e o tom. As regras que mantêm uma atualização válida, como quais ações estruturadas são permitidas, continuam sempre em vigor.

## World / Lore

**Lorebook context** (contexto de lorebook), padrão **off**, permite que uma atualização use entradas de lorebook. Ativado, cada atualização varre o texto recente dos posts e das respostas do Noodle, mais os perfis dos personagens ativos, procurando palavras-chave dos lorebooks. As entradas correspondentes entram como contexto de mundo para as contas daquela atualização. Só os lorebooks ligados a um personagem ativo, ou marcados como globais, podem ser acionados. O conteúdo acionado tem um teto fixo de 8.192 tokens por atualização.

## Carryover

A seção **Carryover** (transferência) empurra a atividade recente do Noodle para os seus chats. Com ela ativada, o prompt do chat ganha um bloco "Recent Social Media Activity" sobre o que os seus personagens fizeram no Noodle.

- **Carryover to chats**: três botões liga/desliga, todos **off** por padrão: **Conversations**, **Roleplays** e **Games**. Ative os modos que devem receber a atividade do Noodle.
- **Carry hours** (horas transferidas): de 1 a 720, padrão **48**. Até quantas horas atrás Noodle procura atividade.
- **Carry items** (itens transferidos): de 1 a 50, padrão **8**. O máximo de resumos acrescentados a um turno do chat.

A transferência só puxa a atividade dos personagens convidados no Noodle, mais a persona ativa do chat. Estar incluído apenas por pasta não basta. O bloco completo da transferência tem um teto fixo de 8.192 tokens por geração do chat. Se o limite de itens ultrapassar esse teto, Marinara mantém os resumos mais novos que couberem e os mostra em ordem cronológica.

## Reset Noodle

Isso limpa a linha do tempo e mantém as suas contas e configurações.

1. Clique em **Reset Noodle Timeline**.
2. Leia a caixa de diálogo: "This removes all posts, replies, likes, reposts, activity digests, and refresh records. Profiles, follows, invites, and settings stay."
3. Clique em **Reset timeline** para confirmar.

Só o conteúdo da linha do tempo é excluído. As contas, os handles, as bios, as seguidas, os convites e todas as configurações continuam.

## Ligar o Noodle aos seus chats

O Noodle e os chats podem compartilhar contexto em duas direções. Ativar um dos recursos não ativa o outro.

- **Carryover to chats** (nas configurações do Noodle) manda a atividade do Noodle para um chat. Veja [Carryover](#carryover).
- **Allow Noodle references** é um botão liga/desliga de cada chat que manda a atividade do chat para o Noodle. Você o encontra nas configurações do próprio chat, perto de **Connected Chats**. Veja [Visão geral do painel Chat Settings](../chats/chat-settings.md). Ele vem **off** por padrão. A descrição dele diz "Timeline refreshes may include recent messages from this chat, with the chat name, mode, and participants stated in the prompt." Se o chat também rodar uma [agenda de personagem de Conversation](../conversation/schedules.md), o status e a atividade atuais de um personagem naquela história, como "currently dnd (At the office)", entram junto, limitados àquele chat.

Use um dos dois sozinho ou os dois juntos.

## Resolução de problemas

- **Uma atualização não gera nada**: escolha um **Generation model**, convide pelo menos um personagem (ou ative os usuários aleatórios) e leia o erro na seção **Refresh**.
- **As atualizações automáticas não acontecem**: coloque **Refreshes/day** acima de 0, mantenha Marinara em execução e confira os horários previstos e o fuso horário em **Automatic schedule**. Se aparecer um erro, resolva o problema da conta ou do limite de requisições e deixe a nova tentativa rodar.
- **Os posts não citam um chat recente**: ative **Allow Noodle references** naquele chat e confira se o personagem está convidado. O contexto do chat é uma orientação para a IA, não uma garantia.
- **A atividade do Noodle não aparece nos chats**: ative o modo correspondente em **Carryover to chats** e aumente **Carry hours** se a atividade for antiga demais.
- **Os posts não têm imagens**: ative **Image generation**, escolha um modelo de imagem que funcione e confira **Images/refresh**.

<a id="settings-and-defaults"></a>

## Configurações e valores padrão

| Configuração | Padrão | Faixa ou opções |
|---|---|---|
| **Generation model** | nenhum | qualquer modelo de texto (obrigatório para a atualização) |
| **Professor Mari participates** | on | on ou off |
| **Refreshes/day** | 2 | 0 a 24 (0 desliga as atualizações automáticas) |
| **Translate posts automatically** | off | on ou off |
| **Active selection** | Random range | Random range, Exact count, All invited |
| **Min active** | 2 | 1 a 100 (só em Random range) |
| **Max active** | 5 | 1 a 100 (só em Random range) |
| **Active count** | igual a Max active | 1 a 100 (só em Exact count) |
| **Posts** | 8 | 0 a 100 |
| **Replies** | 12 | 0 a 200 |
| **Reposts** | 4 | 0 a 100 |
| **Likes** | 18 | 0 a 500 |
| **Image generation** | off | on ou off |
| **Image width** | 1024 | 64 a 4096 |
| **Image height** | 1536 | 64 a 4096 |
| **Image generation connection** | Default | qualquer modelo de imagem |
| **Image instructions (sent to your LLM)** | texto embutido | até 4000 caracteres |
| **Use avatar references** | on | on ou off |
| **Interpret image prompts** | on | on ou off |
| **Include descriptions** | on | on ou off |
| **Images/refresh** | 3 | 0 a 50 |
| **Attach gallery images** | off | on ou off |
| **Show images to the writer** | on | on ou off |
| **Image captioning** | segue o Generation model | on ou off |
| **Captioning model** | Use Noodle generation connection | qualquer modelo capaz de ver imagens |
| **Use connection default** | on | on ou off; restaura a configuração de descrição automática do Generation model |
| **Lorebook context** | off | on ou off |
| **Enhanced tone & continuity** | off | on ou off |
| **Use generated character schedules** | off | on ou off |
| **Carryover: Conversations** | off | on ou off |
| **Carryover: Roleplays** | off | on ou off |
| **Carryover: Games** | off | on ou off |
| **Carry hours** | 48 | 1 a 720 |
| **Carry items** | 8 | 1 a 50 |
| **Allow Noodle references** (por chat) | off | on ou off |

## Guias relacionados

- [Noodle: a linha do tempo social dentro do aplicativo](noodle.md)
- [Visão geral do painel Chat Settings](../chats/chat-settings.md)
- [Conectando a um provedor de IA](../connections/connecting-to-a-provider.md)
- [Provedores de IA compatíveis](../connections/providers-reference.md)
