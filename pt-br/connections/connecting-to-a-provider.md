# Conectando a um provedor de IA

Neste guia você aprende a conectar Marinara Engine a um provedor de IA para que os personagens consigam responder. Você adiciona uma conta, cola a chave dela e escolhe o modelo que responde aos seus chats.

## Contas e modelos

Uma **conta** é uma chave, um login ou um endereço de um provedor de IA. Ela guarda o provedor, a chave, o endereço e os limites dela. Se você usa duas chaves do mesmo provedor, tem duas contas.

Um **modelo** é um modelo de IA que você salvou a partir de uma conta, como o GPT ou o Claude. Cada modelo salvo guarda as próprias configurações. No painel **Connections** (Conexões), os modelos ficam abaixo da conta deles.

A chave de API é um código secreto fornecido pelo provedor de IA. Ela funciona como uma senha. Marinara guarda a chave no computador em que Marinara roda, e ela nunca entra em uma exportação.

Marinara Engine não vem com uma conta pronta nem com uma chave gratuita de teste. Adicione pelo menos uma conta antes de começar um chat. A única exceção é o **Built-in model** (modelo embutido), em **On your computer** (no seu computador): ele roda no seu próprio computador, sem conta (veja [Como configurar o Local Model](local-model.md)).

## O painel Connections

As contas ficam no painel **Connections**, no lado direito do aplicativo. De cima para baixo, ele mostra:

- **Search models and accounts** (buscar modelos e contas), que filtra a lista conforme você digita.
- **Add** (adicionar), que abre a janela **Add account** (adicionar conta), e **More actions** (mais ações, o botão de três pontos), com **Import account**, **Export all accounts** e as opções de recolher e de agrupar. Num painel largo, o menu suspenso de ordenação fica ao lado de **Search models and accounts**. Num painel estreito, a ordenação fica em **More actions**.
- A caixa **Jobs** (tarefas). Ela diz qual modelo faz cada tarefa, como **Main** (principal) para as respostas do chat ou **Images** (imagens) para as figuras. Veja [Como escolher o modelo de cada tarefa](#choosing-the-model-for-each-job).
- As suas contas, cada uma com os modelos salvos abaixo dela. Veja [Organizando as conexões](organizing-connections.md).

## Como adicionar uma conta

1. No painel **Connections**, clique em **Add**. A janela **Add account** lista os provedores em **Popular**, **Subscriptions** (assinaturas), **On your computer** e **All providers**. Digite em **Search providers** (buscar provedores) para encontrar um.
2. Clique em um provedor, como **OpenAI**, **Anthropic** ou **OpenRouter**.
3. Cole a chave em **API key**. **Where do I find my key?** (onde encontro a minha chave?) abre a página de chaves do provedor. O botão de olho mostra ou esconde a chave. Em **More options** (mais opções) ficam o campo opcional **Name** (nome) e os campos **Address** (endereço), **Requests per minute** e **Parallel jobs**.
4. Clique em **Connect** (conectar). Marinara testa a chave. Se falhar, a janela mostra o motivo e **Try again** (tentar de novo). Servidores no seu computador também oferecem **Continue anyway** (continuar mesmo assim).
5. Quando você adiciona a primeira conta sem ter um modelo Main, ou adiciona uma conta ao começar um chat, a janela segue para a seleção de modelo. Escolha um modelo. **Make … my Main** (definir como o meu modelo principal) torna esse modelo o Main quando essa opção aparece. Clique em **Done** (concluir) para terminar, ou em **Start chatting** (começar a conversar) se você começou por um chat novo. Se você já tem um Main e adiciona uma conta pelo painel, a janela fecha depois do Connect e o painel mostra a conta nova. Os serviços de imagem, vídeo e voz usam os próprios controles de configuração; o modelo embutido usa a tela de configuração local dele.

Depois, você pode trocar o modelo de cada tarefa na caixa **Jobs**.

Se você deixar **Name** vazio, Marinara dá à conta o nome do provedor. Uma segunda conta do mesmo provedor sem nome digitado recebe os 4 últimos caracteres da chave, por exemplo `OpenAI · …a1b2`. Um nome que você digita nunca é alterado.

Em geral não é preciso mexer em **Address**. Marinara preenche esse campo sozinho para os provedores conhecidos. Só altere se você usa um proxy ou um servidor no seu computador.

Alguns provedores usam um login no seu computador no lugar da chave. Eles ficam em **Subscriptions** e não têm campo de chave. Veja [Conexões por assinatura do Claude, do ChatGPT e do Grok](subscription-clis.md). Para conectar um modelo que roda no seu próprio computador, veja [Conectar um modelo local ou auto-hospedado](local-self-hosted.md). Para ver todos os provedores compatíveis e onde conseguir cada chave, veja [Provedores de IA compatíveis](providers-reference.md).

### Como começar um chat sem conta

Se você começar um chat antes de ter um modelo, Marinara abre primeiro a janela **Add account**. Depois do **Connect**, ela mostra os modelos do provedor. Clique em um e depois em **Start chatting**. O rodapé também pode tornar esse modelo o seu modelo **Main**.

<a id="choosing-the-model-for-each-job"></a>

## Como escolher o modelo de cada tarefa

A caixa **Jobs** lista todas as tarefas que um modelo pode fazer, em quatro grupos:

- **Chat**: **Main** escreve as respostas dos seus chats. **Agents** (agentes) roda os agentes auxiliares. **Impersonate** escreve como você.
- **Omnibar**: **Professor Mari** e **Quick answers** (respostas rápidas).
- **Pictures & sound** (imagens e som): **Images**, **Video** e **Voice (Text to Speech)** (voz: texto para fala).
- **Behind the scenes** (nos bastidores): **Decision**, **Embeddings** e **Image reading** (leitura de imagens).

Cada linha mostra o modelo que faz aquela tarefa e o provedor dele, ou o que a tarefa faz sem um modelo, como **Follows Main** ou **Off**. Uma tarefa que precisa de um modelo mostra **Choose a model**.

Clique em uma linha para abrir **Model for** (modelo para) aquela tarefa. A janela mostra o modelo que faz a tarefa em **Now** (agora), os seus modelos em **Starred** (com estrela) e, depois, os modelos salvos de cada conta. **All models** (todos os modelos), abaixo de uma conta, abre o catálogo completo dela. Digite em **Search all models or paste a model ID** (buscar em todos os modelos ou colar o ID de um modelo) para buscar em todos os catálogos ao mesmo tempo. Clique em qualquer modelo para dar a tarefa a ele; não é preciso salvá-lo antes. **If it fails** (se falhar), no topo da janela, escolhe um segundo modelo, que responde quando o primeiro falha. **Add account**, embaixo, abre a janela Add.

Clique em **Jobs** para recolher a caixa até o cabeçalho.

### Quando um recurso precisa de um modelo

Um agente ou recurso que não funciona sem um certo tipo de modelo avisa com o rótulo **Needs an image model** (ou o equivalente para vídeo, áudio, decisão ou chat). O rótulo aparece no card do agente no painel **Agents**, em **Chat Settings** (configurações do chat), no editor de agente e nas janelas de imagem e de vídeo. Clique em **Set up** (configurar) ao lado dele para abrir **Model for** daquela tarefa, onde você pode escolher um modelo ou clicar em **Add account**. O rótulo some quando a tarefa ganha um modelo. Quando uma resposta falha porque nenhum modelo de imagem foi definido, o **Set up** da mensagem abre o painel **Connections**.

## Como testar uma conta

O **Connect** já testa a chave. Para testar de novo depois, abra o menu **⋯** da conta no painel e clique em **Test** (testar). O editor da conta, **Edit account** (editar conta), tem **Test account** (testar conta), que verifica a chave e o endereço do jeito que você digitou, antes de salvar.

<a id="choosing-a-model-for-one-chat"></a>

## Como escolher um modelo para um chat

Um chat novo usa o seu modelo **Main**. Para dar a um chat um modelo diferente, abra o menu **Connections** na caixa de mensagem ou o campo **Model** (modelo) em **Chat Settings → Connection**. Os dois abrem **Model for this chat** (modelo para este chat):

- **Now** mostra o modelo que o chat usa. **This chat only** quer dizer que o chat tem uma escolha própria; **follows Main** quer dizer que ele usa o Main.
- **Recent** (recentes) e **Starred** listam os seus modelos por conta.
- **Search models or paste an ID…** (buscar modelos ou colar um ID) busca em todos os catálogos. **Browse** (navegar) abre a lista completa de uma conta.
- **Follow Main** (seguir o principal) desfaz a escolha própria do chat. **Shuffle** (sortear) escolhe um modelo diferente a cada vez.

Uma escolha muda só aquele chat. A mensagem que aparece depois de uma escolha oferece **Make it my Main model** (tornar este o meu modelo principal) e **Undo** (desfazer). No Game Mode, o campo aparece como **GM / Party Model**.

## Erros comuns

Se um teste ou uma mensagem falhar, comece verificando estes pontos:

- Uma chave errada ou vencida. Abra o menu **⋯** da conta, clique em **Replace key** (substituir a chave) e cole a chave de novo. Uma conta sem chave mostra **Needs key**.
- Uma conta desligada. Ela mostra **Off**; clique em **Turn on** (ativar) no menu **⋯** dela.
- Uma chave do provedor errado. Cada provedor precisa da própria chave.
- Um **Address** bloqueado ou fora do ar. Deixe o campo vazio para usar o endereço do próprio provedor, a não ser que você use um proxy ou um servidor no seu computador.

Para mais soluções, veja [Solução de problemas do Marinara Engine](../TROUBLESHOOTING.md).

## Guias relacionados

- [Organizando as conexões](organizing-connections.md)
- [Provedores de IA compatíveis](providers-reference.md)
- [Conexões por assinatura do Claude, do ChatGPT e do Grok](subscription-clis.md)
- [Conectar um modelo local ou auto-hospedado](local-self-hosted.md)
- [Solução de problemas do Marinara Engine](../TROUBLESHOOTING.md)
