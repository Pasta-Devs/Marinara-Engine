# Conectando a um provedor de IA

Para conversar, Marinara Engine precisa de um modelo de IA. Você pode adicionar uma conta de um serviço de IA, colar a chave de API dela e escolher um modelo. A chave de API é um código secreto do serviço que deixa Marinara usar a sua conta naquele serviço. Trate a chave como uma senha. Você também pode usar o [Built-in model](local-model.md) (modelo embutido), um modelo pequeno que roda no seu computador sem chave.

## Como adicionar uma conta

Antes de começar, consiga uma chave de API de um serviço que você quer usar. A janela **Add account** (adicionar conta) tem um link **Where do I find my key?** (onde encontro a minha chave?) para cada serviço. Estas são as páginas que ele abre para os serviços mais comuns.

- OpenRouter (tem modelos gratuitos): `openrouter.ai/keys`
- NanoGPT: `nano-gpt.com/api`
- OpenAI: `platform.openai.com/api-keys`
- Anthropic: `console.anthropic.com/settings/keys`
- Google Gemini: `aistudio.google.com/apikey`

A maioria dos serviços pede que você se cadastre, e alguns pedem que você adicione crédito, antes de a chave funcionar. Para outros serviços, veja [Provedores de IA compatíveis](providers-reference.md). Para usar um modelo no seu próprio computador sem chave, veja [Como configurar o Built-in model](local-model.md).

1. Clique em **Connections** (Conexões) na barra superior. O painel abre à direita. Se você ainda não tem contas, ele pergunta **Where do your models come from?** (de onde vêm os seus modelos?) e mostra alguns serviços. Clique em um serviço (não em **Built-in model**). A janela **Add account** abre na etapa da chave. Vá para o passo 4.
2. Clique em **Add** (adicionar). A janela **Add account** abre.
3. Clique no serviço que você quer. Digite na caixa **Search providers** (buscar provedores) para encontrá-lo. A lista tem as seções **Chat**, **Images & video**, **Voice** e **Decisions** (chat, imagens e vídeo, voz e decisões). Para um modelo de chat normal, procure em **Chat**.
4. Clique em **API key** (chave de API) e cole a sua chave. Clique no botão de olho para conferir se você colou a chave inteira.
5. Clique em **Connect** (conectar). Marinara testa a chave. Quando ela funciona, aparece **Connected** com o número de modelos encontrados.
6. O que acontece depois depende de você já ter um modelo Main. Main (principal) é a tarefa de escrever as respostas dos seus chats.
   - **Ainda não há modelo Main, ou você abriu o Add em um chat novo:** a janela mostra os modelos do serviço. Os modelos **Recommended** (recomendados) ficam no topo. Clique em um modelo para adicioná-lo, ou digite um nome em **Search or enter model ID…** (buscar ou digitar o ID do modelo). Se você não sabe qual escolher, fique com um **Recommended**. Dá para trocar depois. Deixe **Make … my Main model** (definir como o meu modelo principal) marcado. Essa opção só aparece quando você não tem um modelo Main. Quando você abriu o Add em um chat novo e já tem um modelo Main, aparece no lugar dela um botão **Set … as Main** (definir como principal). Depois clique em **Done** (concluir), ou em **Start chatting** (começar a conversar) se você veio de um chat novo.
   - **Você já tem um modelo Main:** a janela fecha e uma mensagem diz que a conta foi adicionada, com o número de modelos dela. Para adicionar mais modelos, clique em **⋯** na conta e escolha **Add model** (adicionar modelo).

O painel mostra a sua conta. O **Connected** do passo 5 já quer dizer que a chave funciona. Se o modelo novo é o seu modelo Main, comece um chat e envie uma mensagem: uma resposta quer dizer que tudo funciona. Se você já tinha um modelo Main, os chats novos continuam usando esse modelo. Para usar a conta nova, adicione um modelo a ela (**⋯** → **Add model**) e escolha esse modelo para um chat ou uma tarefa (veja [Como escolher o modelo de cada tarefa](#choosing-the-model-for-each-job)).

Se não funcionou:

- **The key was not accepted. Check that you copied all of it.** Cole a chave de novo e clique em **Try again** (tentar de novo). A chave precisa vir do serviço que você escolheu.
- **The service is busy, or your credit is used up.** Adicione crédito no site do serviço, ou espere e tente de novo.
- **Marinara could not reach** o serviço. Confira a sua conexão com a internet e clique em **Try again**.

### Campos opcionais da conta

A etapa da chave também mostra estes campos. Deixe-os vazios, a não ser que você precise deles.

- **Name (optional)** (nome, opcional): o nome mostrado no painel. Vazio, fica o nome do serviço. Uma segunda conta do mesmo serviço recebe os 4 últimos caracteres da chave, como `OpenAI · …a1b2`.
- **Address** (endereço): para onde Marinara envia as requisições. Quando ele está vazio, Marinara usa o endereço do próprio serviço. Preencha só para um proxy, um gateway ou um servidor que você roda. Os serviços que fazem login no seu computador não mostram esse campo.
- **Requests per minute** (requisições por minuto): reduz o ritmo do Marinara nesta conta. Vazio quer dizer sem limite. Os valores permitidos vão de 1 a 600.
- **Parallel jobs** (tarefas em paralelo): quantas requisições rodam ao mesmo tempo. Vazio quer dizer sem limite. Os valores permitidos vão de 1 a 16. Em **Edit account** (editar conta), a mesma configuração se chama **Parallel requests** (requisições em paralelo).

Alguns serviços usam um login no seu computador no lugar da chave. Eles mostram a etiqueta **Sign in** (entrar) e não têm campo de chave. Veja [Conexões por assinatura do Claude, do ChatGPT e do Grok](subscription-clis.md). Para um servidor no seu próprio computador, veja [Conectar um modelo local ou auto-hospedado](local-self-hosted.md). Depois de um teste que falhou, aparece **Continue anyway** (continuar mesmo assim). Ele salva a conta sem um teste aprovado.

### Como começar um chat sem conta

Se você começar um chat antes de ter um modelo, Marinara abre primeiro a janela **Add account**. Depois do **Connect**, clique em um modelo e depois em **Start chatting**.

## O painel Connections

Você gerencia as contas no painel **Connections**. De cima para baixo, ele mostra:

- Uma caixa de busca que filtra a lista conforme você digita. O rótulo dela é **Search models and accounts** (buscar modelos e contas).
- **Add**, que abre **Add account**, e **More actions** (mais ações, o botão de três pontos), com **Import account**, **Export all accounts**, o recolhimento e o agrupamento. Num painel largo, o menu suspenso de ordenação fica ao lado da busca. Num painel estreito, a ordenação fica em **More actions**.
- A caixa **Jobs** (tarefas). Ela diz qual modelo faz cada tarefa.
- O card **Built-in model**. Veja [Como configurar o Built-in model](local-model.md).
- As suas contas, cada uma com os modelos salvos abaixo dela. Veja [Organizando as conexões](organizing-connections.md).

Uma **conta** é uma chave, um login ou um endereço salvo para um serviço. Se você usa duas chaves do mesmo serviço, tem duas contas. Um **modelo** é um modelo de IA que você salvou a partir de uma conta. Cada modelo salvo guarda as próprias configurações.

<a id="choosing-the-model-for-each-job"></a>

## Como escolher o modelo de cada tarefa

Uma tarefa é algo que um modelo faz por você. A caixa **Jobs** lista as tarefas em quatro grupos:

| Grupo | Tarefas |
| --- | --- |
| **Chat** | **Main** escreve as respostas dos seus chats. **Agents** (agentes) roda os agentes auxiliares. **Impersonate** escreve como você. |
| **Omnibar** | **Professor Mari** e **Quick answers** (respostas rápidas). |
| **Pictures & sound** (imagens e som) | **Images**, **Video**, **Voice (Text to Speech)** (voz: texto para fala) e **Dictation (Speech to Text)** (ditado: fala para texto), quando disponível. |
| **Behind the scenes** (nos bastidores) | **Decision**, **Embeddings** e **Image reading** (leitura de imagens). |

Cada linha mostra o modelo que faz aquela tarefa, ou o que a tarefa faz sem um modelo, como **Follows Main** ou **Off**. Uma tarefa que precisa de um modelo mostra **Choose a model**. Clique em **Jobs** para recolher a caixa.

Para trocar o modelo de uma tarefa, clique na linha dela. Abre **Model for** (modelo para) aquela tarefa, exceto em três linhas. **Decision** e **Embeddings** abrem os próprios controles (veja [Modelos de decisão](decision-models.md) e [Provedores de IA compatíveis](providers-reference.md#embeddings)). **Dictation (Speech to Text)** abre a configuração de fala.

Em **Model for**:

1. Olhe a lista.
2. Clique em um modelo. A lista mostra esse modelo em **Now** (agora), depois os seus modelos em **Starred** (com estrela) e depois os seus modelos salvos por conta. **All models** (todos os modelos), abaixo de uma conta, abre a lista completa dela. Digite em **Search all models or paste a model ID** (buscar em todos os modelos ou colar o ID de um modelo) para buscar em todas as contas ao mesmo tempo. Não é preciso salvar um modelo antes.

**If it fails** (se falhar), no topo da janela, escolhe um segundo modelo, que responde quando o primeiro falha. **Add account**, embaixo, abre a janela Add.

### Quando um recurso precisa de um modelo

Um recurso que não funciona sem um certo tipo de modelo mostra o rótulo **Needs an image model** (ou o equivalente para vídeo, áudio, decisão ou chat). Você vê o rótulo no card do agente no painel **Agents**, em **Chat Settings** (configurações do chat), no editor de agente e nas janelas de imagem e de vídeo. Clique em **Set up** (configurar) ao lado dele e escolha um modelo ou clique em **Add account**. O rótulo some quando a tarefa ganha um modelo.

## Como testar uma conta

O **Connect** já testa a chave. Para testar de novo depois, abra o menu **⋯** da conta no painel e clique em **Test** (testar). O editor da conta (**Edit account**) tem **Test account** (testar conta), que verifica a chave e o endereço do jeito que você digitou, antes de salvar.

<a id="choosing-a-model-for-one-chat"></a>

## Como escolher um modelo para um chat

Um chat novo usa o seu modelo **Main**. Para dar a um chat um modelo diferente, clique no botão de modelo na caixa de mensagem (o ícone de link, com o nome do modelo atual), ou use o campo **Model** (modelo) em **Chat Settings → Connection**. Os dois abrem **Model for this chat** (modelo para este chat):

- **Now** mostra o modelo que o chat usa. **This chat only** quer dizer que o chat tem uma escolha própria. **follows Main** quer dizer que ele usa o Main.
- **Recent** (recentes) e **Starred** listam os seus modelos por conta.
- **Search models or paste an ID…** (buscar modelos ou colar um ID) busca em todas as contas. **Browse** (navegar) abre a lista completa de uma conta.
- **Follow Main** (seguir o principal) desfaz a escolha própria do chat. **Shuffle** (sortear) escolhe um modelo diferente a cada vez.

Uma escolha muda só aquele chat. A mensagem que aparece depois de uma escolha oferece **Make it my Main model** (tornar este o meu modelo principal) e **Undo** (desfazer). No Game Mode, o campo aparece como **Game Master model**.

## Erros comuns

Se um teste ou uma mensagem falhar, comece verificando estes pontos:

- Uma chave errada ou vencida. Clique em **⋯** na conta, escolha **Replace key** (substituir a chave) e cole a chave de novo. Uma conta sem chave mostra **Needs key**.
- Uma conta desligada. Ela mostra **Off**. Clique em **Turn on** (ativar) no menu **⋯** dela.
- Uma chave de outro serviço. Cada serviço precisa da própria chave.
- Um **Address** bloqueado. Vazio, o campo usa o endereço do próprio serviço.

Para mais soluções, veja [Solução de problemas do Marinara Engine](../TROUBLESHOOTING.md).

## Guias relacionados

- [Organizando as conexões](organizing-connections.md)
- [Provedores de IA compatíveis](providers-reference.md)
- [Conexões por assinatura do Claude, do ChatGPT e do Grok](subscription-clis.md)
- [Conectar um modelo local ou auto-hospedado](local-self-hosted.md)
