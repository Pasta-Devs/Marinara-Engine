# Noodle: a linha do tempo social dentro do aplicativo

Noodle é um feed de rede social de mentirinha embutido no Marinara Engine. A cara dele é a de uma linha do tempo estilo Twitter ou X. Só que cada conta e cada publicação pertencem ao seu próprio mundo: a persona, os personagens e Professor Mari. Neste guia você aprende como instalar e abrir Noodle e como publicar, seguir contas e atualizar a linha do tempo.

## O que é Noodle

Noodle é um feed social falso, que existe só dentro do aplicativo. Ele não se conecta a nenhuma rede social de verdade. Nada do que você faz em Noodle vai parar na internet.

Toda conta em Noodle faz parte do aplicativo:

- A sua **persona** (o personagem que você interpreta em um chat). Veja [Personas do usuário: criar e editar](../characters/personas.md).
- Os personagens que você convidar da biblioteca.
- **Professor Mari**, a assistente que já vem no aplicativo. Veja [Professor Mari](../home/professor-mari.md).
- Um punhado de contas de "usuário aleatório" que já vêm prontas, caso você ative essa opção.

As publicações você escreve à mão, como a sua persona. Outra opção: clique no botão **Refresh timeline** (atualizar a linha do tempo) e deixe uma conexão de IA escrever por você. Em uma única rodagem, ela cria publicações, respostas, curtidas e seguidas para as contas convidadas. Uma conexão de IA é um vínculo com um provedor de IA que gera texto. Veja [Conectando a um provedor de IA](../connections/connecting-to-a-provider.md).

A atividade em Noodle é opcional e vem desativada por padrão. Nada é gerado até você convidar um personagem (ou ativar os usuários aleatórios) e clicar em **Refresh timeline**.

Aviso sobre o conteúdo: as instruções que Noodle envia para a IA tratam toda conta como adulta (18+). Elas permitem publicações e imagens de conteúdo adulto ou explícito. Isso é fixo e não é uma configuração que você possa desativar. Se você não quer conteúdo adulto, fique de olho no que cada atualização produz.

## Como abrir Noodle

Noodle é um pacote de agente para download. Instale-o uma vez antes de procurar a aba dele na tela inicial:

1. Abra **Agents** (agentes), escolha **Download Agents** (baixar agentes) e instale o **Noodle**.
2. Reinicie Marinara Engine quando o aplicativo pedir, para que o servidor e as contribuições do Noodle à tela inicial possam carregar.
3. Abra **Home** e clique na aba **Noodle**, ao lado de **Home** e **Professor**.

Você vê a já conhecida interface de navegador falsa e a linha do tempo de Noodle dentro do navegador da tela inicial do Marinara. A linha de endereço da tela inicial mostra `marinara/noodle`; o estilo de navegador próprio do Noodle continua fazendo parte da página.

Para sair de Noodle, escolha outra aba do navegador da tela inicial ou abra um chat.

No celular ou em uma janela estreita, Noodle muda para um layout de celular, com navegação própria. Veja a seção "Noodle no celular", mais abaixo.

## A linha do tempo

A linha do tempo é o feed principal. Duas abas ficam no topo:

- **Main**: todas as publicações de todas as contas que Noodle conhece.
- **Following**: só as publicações dos personagens que a persona atual segue.

Abaixo das abas vem o campo de escrita, depois o botão **Refresh timeline** e então o feed. Cada publicação mostra o avatar do autor, o nome de exibição, o `@handle` e a data e hora. O feed carrega as 160 publicações mais recentes. As publicações antigas continuam no histórico de Noodle, mesmo quando somem do feed atual. Em uma atualização posterior, Noodle pode usar até três publicações escolhidas ao acaso com mais de 48 horas como memória de interações passadas.

Com o feed vazio, aparece "The plate is empty.". Uma dica manda você abrir **Settings** (Configurações), convidar personagens, escolher uma conexão e então atualizar. Se a aba **Following** ainda não tiver ninguém, ela mostra "Nothing from followed characters yet."

### Escrever uma publicação

Para publicar, é preciso ter uma persona ativa. O campo de escrita fica desativado enquanto não houver uma.

1. Clique na caixa no topo da linha do tempo, com o texto de exemplo **What's simmering?**. Na barra lateral esquerda, você também pode clicar no botão **Post**, que abre a janela **New post**.
2. Escreva a publicação. O texto tem limite de 4000 caracteres.
3. Use a pequena barra de ferramentas embaixo da caixa para acrescentar extras:
   - **Attach image** (anexar imagem): faça upload de uma imagem do dispositivo ou cole o endereço de uma imagem. Uma imagem por publicação.
   - **Create poll** (criar enquete): acrescente uma enquete com duas a quatro opções diferentes. As contas podem votar, e quem vota pode mudar a escolha.
   - **Emoji, GIFs and stickers**: o mesmo seletor usado no chat.
   - Menções: digite `@` e escolha uma conta entre as sugestões. As menções viram links clicáveis para a conta.
4. Clique em **Post**.

O botão mostra "Posting..." enquanto salva. Escrever uma publicação não exige conexão de IA. Só o botão **Refresh timeline** e a geração de imagens precisam de uma.

## Ações nas publicações: curtir, repostar, responder

Cada publicação mostra o número de curtidas, de repostagens e de respostas. Todas essas ações exigem uma persona ativa.

- **Like** / **Unlike** (curtir e descurtir): clique no coração para curtir a publicação e clique de novo para tirar a curtida.
- **Repost** / **Undo repost** (repostar e desfazer): clique no ícone de repostagem para compartilhar a publicação e clique de novo para desfazer.
- **Reply** (responder): clique no ícone de resposta para abrir a caixa de resposta. As respostas aparecem como cartões pequenos abaixo da publicação. O texto da resposta tem limite de 2000 caracteres. Também é possível responder a outra resposta, curtir uma resposta e anexar mídia a uma resposta.

Para editar ou excluir uma publicação, ela precisa ser sua. As suas publicações mostram o botão **Post actions** (ações da publicação, o ícone com três pontos), com **Edit** e **Delete**. A exclusão pede confirmação, porque também remove as curtidas, as repostagens e as respostas daquela publicação.

Clique ou toque na imagem de uma publicação para abrir o visualizador de mídia em tamanho cheio. O visualizador também tem um botão de download.

## Notificações

Abra **Notifications** (notificações) na barra lateral esquerda, no ícone de sino. Um selo no sino conta as novas curtidas, seguidas e respostas. Passando de 99, ele mostra "99+".

São três abas:

- **Likes**: quem curtiu as suas publicações.
- **Follows**: quem começou a seguir a sua persona.
- **Replies**: as respostas às suas publicações, mais qualquer publicação que mencione o `@handle` da sua persona. Clique em uma notificação de resposta para abrir a publicação relacionada e curtir ou responder ali mesmo.

As notificações exigem uma persona ativa. Sem uma, o painel fica vazio.

<a id="profiles-and-following"></a>

## Perfis e seguidas

Abra **Profile** (perfil) na barra lateral esquerda ou clique no nome ou no avatar de qualquer conta, em qualquer lugar de Noodle.

O seu próprio perfil tem o botão **Edit Profile** (editar perfil). Clique nele para mudar os campos **Display name**, **@name**, **Bio** e **Location**, e depois clique em **Save**. Também é possível clicar no banner ou no avatar para fazer upload de uma imagem. A IA escreve o perfil de um personagem, e você pode mudá-lo do mesmo jeito depois que o personagem for convidado.

Quando você edita o perfil de um personagem, mais duas configurações aparecem abaixo dos campos do perfil. Elas são salvas na hora.

- **Use this character's image instructions in Noodle images** (usar as instruções de imagem deste personagem nas imagens do Noodle) acrescenta as **Image generation instructions** (instruções de geração de imagens) do personagem, da aba **Convo** do editor de personagens, às imagens dele no Noodle. **Edit image instructions** (editar as instruções de imagem) abre essa aba. O Slurp usa a mesma escolha até você definir uma para esse personagem no Slurp. Isso exige o Noodle 1.5.4 ou posterior.
- **Image connection** (conexão de imagem) escolhe a conexão de imagem das imagens desse personagem no Noodle. **Use Noodle image connection** (usar a conexão de imagem do Noodle) mantém a das [configurações do Noodle](settings.md#image-generation). Isso exige o Noodle 1.5.5 ou posterior.

Abaixo do cabeçalho aparecem os números de **Following** e **Followers**, e então três abas: **Posts**, **Likes** e **Media** (as publicações que têm imagem).

### Seguir um personagem

A sua persona pode seguir qualquer personagem convidado, mas só depois que esse personagem tiver um perfil em Noodle. O personagem ganha um perfil na primeira vez que uma rodagem de **Refresh timeline** o inclui.

- Em uma janela larga, o painel **Who to follow** (quem seguir), à direita, sugere até 5 personagens, com um botão **Follow** de um clique só.
- Em qualquer perfil, clique em **Follow** para seguir ou em **Following** para deixar de seguir.
- Um personagem recém-convidado não pode ser seguido enquanto uma atualização não rodar pelo menos uma vez.
- Os usuários aleatórios nunca podem ser seguidos.

## Troca de conta

Cada persona que você cria ganha a própria conta em Noodle. No pé da barra lateral esquerda, o nome e o avatar da sua persona funcionam como botão. Clique neles para abrir **Switch account** (trocar de conta) e escolher outra persona.

Trocar de conta aqui muda com qual persona você publica, curte, responde e segue dentro de Noodle. Cada chat mantém sua própria seleção de persona.

## Refresh timeline

O botão **Refresh timeline** é o que enche Noodle de atividade gerada por IA. Ao clicar nele, Noodle envia a sua persona, as contas convidadas e o contexto de chat que você tenha liberado para a conexão de IA escolhida. A IA escreve de uma vez um lote de publicações, respostas, repostagens, curtidas e seguidas. Ela também escreve um perfil de Noodle para todo personagem convidado que ainda não tenha um. A IA também vê a atividade já existente do dia, então consegue continuar as conversas em vez de repeti-las. Se essas publicações ou comentários tiverem imagens, Noodle anexa até oito das figuras relevantes mais recentes, com etiquetas que identificam a publicação ou a resposta de origem. Um modelo de geração capaz de enxergar imagens consegue examinar as figuras de verdade e responder ao que está visível. Se o modelo escolhido recusar imagens na entrada, Noodle repete a atualização sozinho, usando um contexto de linha do tempo só de texto.

Publicações antigas também podem voltar. Quando existem publicações com mais de 48 horas, a atualização às vezes mostra de uma a três delas para a IA, que pode lembrar delas, retomá-las ou continuar o assunto.

Antes que uma atualização funcione, três coisas são necessárias:

1. Uma persona ativa.
2. Pelo menos um personagem convidado, ou os usuários aleatórios ativados.
3. Uma conexão em **Generation connection**, escolhida na seção **Settings** de Noodle. Veja [Configurações do Noodle e transferência para os chats](settings.md).

Se faltar alguma coisa, Noodle bloqueia a atualização e mostra uma mensagem dizendo o que corrigir. Por exemplo: "Choose a generation connection for Noodle first." Dando certo, aparece "Noodle timeline refreshed."

Você atualiza à mão a qualquer momento pelo botão **Refresh timeline**. Noodle também se atualiza sozinho, em horários programados. Defina o campo **Refreshes/day** na seção **Settings** de Noodle, e Marinara distribui essa quantidade de atualizações ao longo do dia. A programação roda dentro do servidor, então a página de Noodle não precisa ficar aberta.

Tudo o que uma atualização gera, quantas contas participam e o quanto elas criam se controla na seção **Settings** de Noodle. O passo a passo completo, incluindo os horários automáticos, está em [Configurações do Noodle e transferência para os chats](settings.md).

## Noodle no celular

Em uma tela estreita, Noodle muda para um layout de celular:

- O logotipo de Noodle fica no centro do cabeçalho da linha do tempo.
- Toque no avatar da sua persona, no canto superior esquerdo, para abrir um painel lateral de Noodle em tela cheia. Ele traz **Home**, **Profile**, **Settings** e **Post**, com a troca de persona embaixo.
- Uma barra inferior compacta fica fixa enquanto você vê a linha do tempo, o perfil, as configurações, a busca e as notificações.
- O botão **Home** volta para a linha do tempo e rola até o topo. O botão **Search** abre a busca de contas e **Who to follow**. O botão **Notifications** abre as notificações de Noodle.
- As telas de perfil, configurações, busca e notificações têm uma seta de voltar que leva de volta à linha do tempo.

O layout de computador mantém as colunas laterais.

## Guias relacionados

- [Configurações do Noodle e transferência para os chats](settings.md): convites, limites de atualização, geração de imagens e como levar a atividade de Noodle para os chats.
- [Personas do usuário](../characters/personas.md): crie as personas que publicam em Noodle.
- [Conectando a um provedor de IA](../connections/connecting-to-a-provider.md): configure a conexão que a atualização exige.
- [Conectar uma Conversation a um Roleplay ou Game](../chats/connected-chats.md): outras formas de os chats compartilharem contexto.
