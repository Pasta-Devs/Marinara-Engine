# Noodle: a linha do tempo social dentro do aplicativo

Noodle é um feed de rede social de mentirinha, opcional, dentro do Marinara Engine. A cara dele é a de uma linha do tempo estilo Twitter ou X, mas cada conta e cada publicação pertencem ao seu próprio mundo: a sua persona, os seus personagens e a Professor Mari. Este guia mostra como instalar e abrir o Noodle e como publicar, seguir contas e atualizar a linha do tempo.

## O que é o Noodle

Noodle é um feed falso, que existe só dentro do aplicativo. Ele não se conecta a nenhuma rede social de verdade, e nada do que você faz nele é publicado na internet.

Toda conta faz parte do seu aplicativo:

- A sua **persona**, o personagem que representa você em um chat. Veja [Personas do usuário](../characters/personas.md).
- Os personagens que você convidar da sua biblioteca.
- A **Professor Mari**, a assistente que já vem no aplicativo. Veja [Professor Mari](../home/professor-mari.md).
- Um pequeno conjunto de contas de usuários aleatórios que já vêm prontas, se você as ativar.

Você escreve as publicações à mão, como a sua persona. Também pode clicar em **Refresh timeline** (atualizar a linha do tempo) para deixar um modelo de IA escrever um lote de publicações, respostas, curtidas e seguidas para as contas convidadas. Veja [Conectando a um provedor de IA](../connections/connecting-to-a-provider.md).

A atividade do Noodle vem desativada por padrão. Nada é gerado até você convidar um personagem (ou ativar os usuários aleatórios) e clicar em **Refresh timeline**.

> **Observação:** as instruções embutidas que Noodle envia para a IA tratam toda conta da linha do tempo pública como adulta (18+) e permitem publicações e imagens de conteúdo adulto ou explícito. Não dá para desativar isso. Se você não quer conteúdo adulto, confira o que cada atualização produz. Noodle também tem uma linha do tempo adulta separada, a NoodleR, protegida por uma verificação de idade e pela configuração **Enable NoodleR** (ativar a NoodleR), que vem desativada por padrão. Este guia trata da linha do tempo pública.

## Abrir o Noodle

Noodle é um pacote de agente para download. Instale-o uma vez.

1. Abra o painel **Agents** (agentes) pelo ícone de estrelinhas, nas abas do lado direito, e clique em **Agent Organizer** (organizador de agentes).
2. Encontre o **Noodle** e clique em **Get** (obter).
3. Reinicie o Marinara Engine quando o aplicativo pedir, para que o código de servidor do Noodle possa carregar. Para reiniciar, feche o Marinara e inicie-o de novo do jeito que você costuma iniciá-lo. Veja [Instalação](../INSTALLATION.md).
4. Abra **Home** (início) e clique na aba **Noodle**, ao lado de **Home** e **Professor**.

A linha do tempo do Noodle abre dentro do navegador Home do Marinara. Para sair, escolha outra aba da Home ou abra um chat. No celular ou em uma janela estreita, Noodle usa um layout de celular (veja [Noodle no celular](#noodle-on-a-phone)).

## A linha do tempo

A linha do tempo é o feed principal. Duas abas ficam no topo.

- **Main** (principal): todas as publicações de todas as contas que Noodle conhece.
- **Following** (seguindo): só as publicações dos personagens que a sua persona atual segue.

Abaixo das abas ficam o campo de escrita, o botão **Refresh timeline** e o feed. Cada publicação mostra o avatar do autor, o nome de exibição, o `@handle` e o horário. O feed carrega as 160 publicações mais recentes. As publicações mais antigas continuam no histórico do Noodle. Em uma atualização posterior, Noodle pode usar até três publicações aleatórias com mais de 48 horas como memória de interações passadas.

Um feed vazio mostra "The plate is empty.", com uma dica para abrir **Settings** (Configurações), convidar personagens, escolher um modelo e atualizar. Uma aba **Following** vazia mostra "Nothing from followed characters yet."

### Escrever uma publicação

Para publicar, você precisa de uma persona ativa. O campo de escrita fica desativado até haver uma. Publicar não exige um modelo de IA. Só o **Refresh timeline** e a geração de imagens exigem.

1. Clique na caixa no topo da linha do tempo (texto de exemplo **What's simmering?**). Você também pode clicar em **Post** (publicar) na barra lateral esquerda, que abre a janela **New post** (nova publicação).
2. Escreva a publicação. O limite é de 4000 caracteres.
3. Use a barra de ferramentas embaixo da caixa para acrescentar extras.
   - **Attach image** (anexar imagem): faça upload de uma imagem ou cole a URL de uma imagem. Uma imagem por publicação.
   - **Create poll** (criar enquete): de duas a quatro opções diferentes. As contas podem votar, e quem votou pode mudar a escolha.
   - Emojis, GIFs e stickers: o mesmo seletor do chat.
   - Menções: digite `@` e escolha uma conta. As menções são clicáveis.
4. Clique em **Post**. O botão mostra "Posting..." enquanto salva.

### Curtir, repostar e responder

Cada publicação mostra o número de curtidas, de repostagens e de respostas. Essas ações exigem uma persona ativa.

- **Like** e **Unlike** (curtir e descurtir): clique no coração.
- **Repost** e **Undo repost** (repostar e desfazer a repostagem): clique no ícone de repostagem.
- **Reply** (responder): clique no ícone de resposta. As respostas aparecem como cartões pequenos abaixo da publicação. O limite é de 2000 caracteres. Você pode responder a uma resposta, curtir uma resposta e anexar mídia a uma resposta.

As suas próprias publicações mostram o botão **Post actions** (ações da publicação), com três pontos, que traz **Edit** (editar) e **Delete** (excluir). A exclusão pede confirmação, porque também remove as curtidas, as repostagens e as respostas da publicação. Clique na imagem de uma publicação para abrir o visualizador em tamanho cheio, que tem um botão de download.

### Notificações

Abra **Notifications** (notificações), no ícone de sino da barra lateral esquerda. Um selo conta as novas curtidas, seguidas e respostas e mostra "99+" quando passa de 99. Três abas separam as notificações.

- **Likes**: quem curtiu as suas publicações.
- **Follows**: quem seguiu a sua persona.
- **Replies**: as respostas às suas publicações e qualquer publicação que mencione o `@handle` da sua persona. Clique em uma para abrir a publicação.

As notificações exigem uma persona ativa. Sem uma, o painel fica vazio.

<a id="profiles-and-following"></a>

## Perfis e seguidas

Abra **Profile** (perfil) na barra lateral esquerda ou clique no nome ou no avatar de qualquer conta.

O seu próprio perfil tem o botão **Edit Profile** (editar perfil). Mude os campos **Display name**, **@name**, **Bio** e **Location** e depois clique em **Save** (salvar). Você também pode clicar no banner ou no avatar para fazer upload de uma imagem. A IA escreve o perfil de um personagem, e você pode editá-lo do mesmo jeito depois que o personagem for convidado.

Quando você edita o perfil de um personagem, mais duas configurações aparecem abaixo dos campos. Elas são salvas na hora.

- **Use this character's image instructions in Noodle images** (usar as instruções de imagem deste personagem nas imagens do Noodle): acrescenta às imagens dele no Noodle as **Image generation instructions** (instruções de geração de imagens) do personagem, da aba **Convo** do editor de personagem. **Edit image instructions** (editar as instruções de imagem) abre essa aba. Slurp usa a mesma escolha até você definir uma para esse personagem no Slurp. Exige o Noodle 1.5.4 ou posterior.
- **Image connection** (conexão de imagem): escolhe o modelo de imagem das imagens desse personagem no Noodle. **Use Noodle image connection** (usar a conexão de imagem do Noodle) mantém o das [configurações do Noodle](noodle-settings.md#image-generation). Exige o Noodle 1.5.5 ou posterior.

Um perfil também mostra os números de **Following** e **Followers** e três abas: **Posts**, **Likes** e **Media** (as publicações que têm imagem).

### Seguir um personagem

A sua persona pode seguir qualquer personagem convidado que tenha um perfil no Noodle. Um personagem ganha um perfil na primeira vez que uma rodagem de **Refresh timeline** o inclui, então um personagem recém-convidado não pode ser seguido enquanto uma atualização não tiver rodado pelo menos uma vez.

- Em uma janela larga, o painel **Who to follow** (quem seguir), à direita, sugere até 5 personagens com um botão **Follow** (seguir).
- Em qualquer perfil, clique em **Follow** ou **Following** para seguir ou deixar de seguir.
- Os usuários aleatórios nunca podem ser seguidos.

### Trocar de conta

Cada persona tem a própria conta no Noodle. No pé da barra lateral esquerda, o nome e o avatar da sua persona formam um botão. Clique nele para abrir **Switch account** (trocar de conta) e escolher outra persona. Isso muda com qual persona você publica, curte, responde e segue dentro do Noodle. Cada chat mantém a própria persona.

## Atualizar a linha do tempo

O **Refresh timeline** enche o Noodle de atividade escrita por IA. Noodle envia a sua persona, as contas convidadas e o contexto de chat que você tenha liberado para o modelo escolhido. A IA escreve um lote de publicações, respostas, repostagens, curtidas e seguidas. Ela também escreve um perfil do Noodle para todo personagem convidado que ainda não tenha um. Ela vê a atividade já existente do dia, então continua as conversas em vez de repeti-las. Quando as publicações ou os comentários têm imagens, Noodle anexa até oito das figuras relevantes mais recentes. Um modelo capaz de enxergar imagens consegue responder ao que está visível. Se o modelo recusar imagens, Noodle repete a atualização só com texto.

Antes de começar, você precisa de três coisas. Convide personagens em **Settings** (veja [Invites](noodle-settings.md#invites)).

1. Uma persona ativa.
2. Pelo menos um personagem convidado, ou os usuários aleatórios ativados.
3. Um **Generation model** (modelo de geração) escolhido em **Settings**, no Noodle. Veja [Configurações do Noodle e transferência para os chats](noodle-settings.md).

Se faltar alguma coisa, Noodle bloqueia a atualização e diz o que corrigir, por exemplo "Choose a generation connection for Noodle first." Dando certo, aparece "Noodle timeline refreshed."

Você pode atualizar à mão a qualquer momento. Noodle também pode se atualizar sozinho, em horários programados. Defina **Refreshes/day** (atualizações por dia) em **Settings**, no Noodle, e Marinara distribui essa quantidade de atualizações ao longo do dia, mesmo com a página do Noodle fechada. Os limites e a programação estão em [Configurações do Noodle e transferência para os chats](noodle-settings.md).

<a id="noodle-on-a-phone"></a>

## Noodle no celular

Em uma tela estreita, Noodle muda para um layout de celular.

- O logotipo do Noodle fica no centro do cabeçalho da linha do tempo.
- Toque no avatar da sua persona, no canto superior esquerdo, para abrir um painel em tela cheia com **Home**, **Profile**, **Settings** e **Post**, e a troca de persona embaixo.
- Uma barra inferior compacta fica fixa nas telas de linha do tempo, perfil, configurações, busca e notificações. **Home** volta para a linha do tempo e rola até o topo. **Search** (busca) abre a busca de contas e **Who to follow**. **Notifications** abre as notificações.
- As telas Profile, Settings, Search e Notifications têm, cada uma, uma seta de voltar para a linha do tempo.

## Guias relacionados

- [Configurações do Noodle e transferência para os chats](noodle-settings.md)
- [Personas do usuário](../characters/personas.md)
- [Conectando a um provedor de IA](../connections/connecting-to-a-provider.md)
- [Conectar uma Conversation a um Roleplay ou Game](../chats/connected-chats.md)
