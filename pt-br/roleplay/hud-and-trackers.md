# HUD e trackers do Roleplay

O HUD (heads-up display) mostra detalhes atuais da história em um chat de Roleplay: a hora, o clima, quem está presente, os seus atributos, os seus itens e as suas missões. Você pode corrigir qualquer valor na mão, bloquear um valor para que a IA pare de mudá-lo e executar um tracker de novo quando quiser.

Os valores vêm dos agentes de tracker. Um agente é um ajudante que roda junto com as respostas. Um agente de tracker acompanha a história e atualiza uma parte do HUD depois de cada mensagem. Um widget só aparece quando o agente dele está ativado no chat.

## Ativar o HUD

1. Abra **Chat Settings** (configurações do chat) pelo botão de controles deslizantes no chat.
2. Vá até **Agents** (agentes) e ative **Enable Agents** (ativar agentes).
3. Adicione os agentes pelas listas abaixo do botão liga/desliga. Para um HUD básico, adicione primeiro **World State**. Adicione **Persona Stats**, **Character Tracker** ou **Quest Tracker** para ter mais.
4. Envie uma mensagem.

Depois da resposta, o tracker aparece. No celular, você vê o botão **World State**. No computador, você vê o **Tracker Panel** ou a janela **Trackers** (veja abaixo). A tabela de widgets mostra qual agente alimenta cada widget.

Se não funcionou: sem nenhum agente de tracker ativado, o HUD não mostra widgets. Confira se **Enable Agents** está ativado.

## Onde o HUD aparece

No celular, os trackers são os botões móveis **World State** e **Player & Tracker**. Toque em um deles para abrir o painel e em **X** para fechá-lo. Assim que World State tem detalhes, o botão dele mostra um pequeno banner com o local, o dia, a hora, o clima e a temperatura. Arraste os botões para qualquer lugar. O seu chat lembra onde você os deixou. Eles seguem o **Chat widget style** (estilo dos widgets do chat) escolhido em **Settings → Appearance → App** (Configurações → Aparência → Aplicativo).

No computador, os mesmos trackers aparecem em um de dois lugares:

- O **Tracker Panel** (painel de trackers): um painel lateral ao lado das suas mensagens. Ele vem ativado por padrão. O botão do dado na barra de título de **Chat Settings** o liga e desliga.
- A janela **Trackers**: uma janela móvel que reúne os trackers quando o Tracker Panel está desligado.

Você usa só um dos dois de cada vez. Veja [O Tracker Panel](#the-tracker-panel) e [A janela Trackers](#the-trackers-window).

## Os widgets do HUD

| Widget | Precisa deste agente | Mostra |
| --- | --- | --- |
| **World State** | World State | Local, data, hora, clima, temperatura e os seus campos de mundo personalizados |
| **Persona Stats** | Persona Stats | As barras de status da sua persona e uma linha de status |
| **Present Characters** | Character Tracker | Quem está na cena, com humor, aparência e campos personalizados |
| **Inventory** | Persona Stats | Os itens que você carrega, com as quantidades |
| **Inventory Tracker** | Inventory Tracker | Listas separadas para moedas, equipamento em uso e itens carregados |
| **Active Quests** | Quest Tracker | O seu objetivo atual |
| **Custom Tracker** | Custom Tracker | Os seus próprios campos com nome, como contadores ou moeda |

O widget **Inventory** vem do agente **Persona Stats**, então ative esse agente para ter os dois. O **Inventory Tracker** é separado. Ele mantém as entradas em três grupos, **Currencies**, **Equipped** e **Inventory**, e nunca lista o equipamento em uso duas vezes.

Cada entrada é uma pequena pílula. A quantidade só aparece, como `×4`, quando é maior que um. Para mudar uma quantidade que é um, ative o modo de adição ou o modo de bloqueio: os dois mostram o controle de quantidade em todas as entradas. O modo de adição é o botão **+** no cabeçalho do Tracker Panel. O [modo de bloqueio](#lock-mode) é explicado abaixo.

**Present Characters** mostra até três emojis de personagem, mais uma contagem "+N". **Inventory** e **Custom Tracker** mostram as entradas uma de cada vez.

## Editar o valor de um tracker

Todos os campos são editáveis, então você pode corrigir um valor que a IA errou. A sua edição é salva na hora. A próxima resposta parte do valor que você corrigiu, inclusive quando você regenera ou dá swipe na resposta corrigida.

1. Abra o tracker: toque no botão dele no celular, ou abra a seção dele no Tracker Panel ou na janela Trackers no computador.
2. Clique no valor e digite o novo.

- **World State**: **Location**, **Date**, **Time**, **Weather**, **Temperature** e os campos de mundo personalizados.
- **Persona Stats**: uma linha **Status** e barras com nome, com valor atual e valor máximo. Adicione ou remova barras.
- **Present Characters**: adicione ou remova personagens. Edite o emoji, o nome, **Mood**, **Look**, **Outfit**, **Thinks** (pensamentos particulares) e os campos personalizados de cada um. Você pode enviar um avatar para cada um. O botão **Auto** liga ou desliga "Auto-generate avatars".
- **Inventory**: adicione ou remova itens. Edite os nomes e as quantidades.
- **Inventory Tracker**: adicione ou remova entradas em **Currencies**, **Equipped** e **Inventory**. Para mover um item para outro grupo, remova-o e adicione-o lá.
- **Active Quests**: adicione ou remova missões. Cada missão tem objetivos com caixas de seleção.
- **Custom Tracker**: adicione, remova ou edite os campos de nome e valor.

Para corrigir muitos valores de uma vez, use o [State Editor](#the-state-editor).

<a id="lock-mode"></a>

## Modo de bloqueio

Os agentes de tracker sobrescrevem os valores do HUD depois de cada turno. O modo de bloqueio permite fixar um valor. Quando um campo está bloqueado, a próxima execução automática não mexe nele. Use quando um valor insiste em sair errado.

1. Abra o tracker.
2. Clique no botão liga/desliga de bloqueio perto do topo do tracker (dica **Enter lock mode**). Um pequeno botão de cadeado aparece ao lado de cada valor editável.
3. Clique no cadeado ao lado do valor (dica **Lock field**). Os campos bloqueados ficam marcados.

Para desbloquear, clique no mesmo botão de novo (**Unlock field**). Para sair do modo de bloqueio, clique de novo no botão liga/desliga do topo (**Exit lock mode**). O modo de bloqueio vale para o HUD inteiro, então ativá-lo em um tracker mostra os cadeados em todos.

## Executar um tracker de novo

Para atualizar um tracker agora em vez de esperar a próxima mensagem, clique no botão de seta circular dentro dele. Ele executa de novo só aquele tracker no turno mais recente. A dica traz o nome do tracker, por exemplo **Re-run world state tracker only**.

Para que um tracker rode só quando você pedir, abra **Chat Settings → Agents → Trackers Control** e ative o tracker em **Individual tracker schedule** (programação individual dos trackers). Um tracker manual não roda depois de cada resposta. Um chat que estava com a antiga opção **Manual Trackers** ativada mostra ali todos os trackers ativados.

Enquanto pelo menos um tracker for manual, aparece um botão de atualizar: na fileira do HUD no celular e ao lado do título da janela Trackers no computador. Clique nele para executar os trackers manuais no turno atual.

**Agent activity** (atividade dos agentes) é onde você executa todos os trackers de novo, tenta novamente os agentes que falharam e usa **Clear Trackers**. Veja [Agent activity](getting-started.md#agent-activity).

> **Aviso:** **Clear Trackers** apaga todo o estado do mundo registrado no chat e não pode ser desfeito.

<a id="the-trackers-window"></a>

## A janela Trackers

No computador, os trackers usam a janela **Trackers** quando o Tracker Panel está desligado. Se houver espaço ao lado das suas mensagens, ela abre à esquerda. Caso contrário, começa como um pequeno botão **Trackers** no canto superior esquerdo do chat. Clique no botão para abri-la. Um chat com layout salvo mantém a sua disposição.

Mova a janela pela barra de título e redimensione-a pelas bordas. Os botões no canto superior direito são:

- **Pin** (fixar): mantém a janela aberta quando você clica fora. Ela começa fixada.
- **Lock** (travar): impede que ela seja movida ou redimensionada e prende o botão dela no lugar. O botão continua abrindo a janela.
- **Close** (fechar): reduz a janela ao botão móvel **Trackers**.

**Reset View** (redefinir a visualização), em Chat Settings, limpa a disposição salva e escolhe a janela ou o botão inicial de acordo com o espaço.

Cada tracker tem uma seção recolhível. Clique no cabeçalho dela para recolhê-la até uma pequena prévia, e clique de novo para abri-la. Marinara lembra quais você recolheu.

Para dar a um tracker uma janela própria, clique no botão de destacar ao lado da seta dele, ou arraste o título dele para fora da janela Trackers. A nova janela começa sem fixação. Fixe-a para mantê-la aberta. O **X** a reduz a um pequeno botão com o ícone do tracker. Já **World State** vira um banner, com o mesmo local, data, hora e clima do celular, para que você possa arrastá-lo para qualquer lugar, como o centro do topo do chat. Para devolvê-lo, clique em **Put back in Trackers** (a seta curva à esquerda do **X**) ou arraste-o sobre a janela Trackers. Cada chat lembra quais trackers estão fora e onde.

<a id="the-tracker-panel"></a>

## O Tracker Panel

O **Tracker Panel** é um painel lateral maior, com os mesmos dados. Ele também mostra os retratos e os pensamentos dos personagens.

1. Abra **Chat Settings**.
2. Clique no botão **Tracker Panel** (o dado) na barra de título, ao lado de fixar e travar. Ele fica destacado enquanto o painel está ativado.
3. Clique nele de novo para ocultar o painel. No computador, os trackers passam a aparecer na janela Trackers.

No computador, o painel cabe ao lado das suas mensagens, até a largura definida em **Desktop size** (tamanho no computador). Quando a janela é estreita demais para os dois, por exemplo com a barra lateral de chats aberta, as suas mensagens e a caixa de mensagem ficam um pouco mais estreitas. No celular ou no tablet, ativar o painel acrescenta um botão Tracker Panel que você pode arrastar. Toque nele para abrir o painel e toque de novo para fechá-lo. Enquanto o painel ou outra tela cobre o chat, os botões móveis do chat ficam ocultos e voltam aos mesmos lugares.

### Personalizar os campos dos trackers

Os botões no cabeçalho do painel mudam a estrutura do tracker:

- **+** entra no modo de adição. A seção World ganha **Add world field** (adicionar campo de mundo), e cada cartão de personagem presente ganha **Add custom field** (adicionar campo personalizado). Os nomes dos campos continuam visíveis no modo normal.
- O ícone de lixeira entra no modo de exclusão, em que você remove campos personalizados de mundo ou de personagem. Remover um campo também remove os bloqueios dele.
- O ícone de cadeado entra no modo de bloqueio. Os campos personalizados seguem o mesmo comportamento de bloqueio dos campos nativos.
- O ícone de olho riscado entra no modo de ocultação. Escolha **Mood**, **Look**, **Outfit** ou **Thoughts** em um cartão de personagem. Um campo oculto desaparece do Tracker Panel e do HUD, é limpo e continua bloqueado, para que os agentes não o preencham de novo. Entre de novo no modo de ocultação para mostrá-lo como um campo vazio.

Os agentes atualizam os valores dos seus campos personalizados. Eles nunca excluem um campo que você criou.

### Criar um retrato novo

O cartão grande de um personagem pode criar um retrato novo assim que o Character Tracker tiver uma conexão de imagem. Em um cartão compacto, clique em **Feature character card** (destacar o cartão do personagem) para abrir o grande. A janela Trackers sempre mostra cartões grandes. Passe o mouse sobre o retrato e clique no botão de olho para criar um a partir do **Look** (aparência), ou no botão de camisa para usar o **Look** e o **Outfit** (roupa). O botão de camisa só aparece quando o personagem tem uma roupa. O retrato antigo continua até o novo ficar pronto. Se a criação falhar, você fica com o antigo. Personagens exibidos com o avatar do card ou com um sprite de expressão não têm esses botões.

### Configurações do Tracker Panel

Abra **Settings → Appearance**, abra o grupo **Roleplay** e encontre a seção **Tracker Panel**.

| Configuração | O que faz |
| --- | --- |
| **Tracker Panel** | O botão liga/desliga, o mesmo que o dado aciona. Vem ativado por padrão. Quando ativado, o rótulo diz "Shown in the Roleplay HUD". |
| **Dock Tracker Panel to edge** | Encosta o painel na borda da tela e mantém os controles do chat próximos fora do caminho dele. |
| **Use expression sprites for tracker portraits** | Usa o sprite de expressão atual do personagem em vez do avatar simples, quando existe um. Veja [Sprites de personagem](../characters/sprites.md). |
| **Panel background** | Uma cor ou um gradiente para o painel. |
| **Desktop size** | A largura do painel: **Compact**, **Standard** ou **Expanded**. |
| **Thought display mode** | **Docked** abre os pensamentos dentro do cartão do personagem. **Floating** os abre como um balão ao lado do retrato. |
| **Always show Docked thoughts** | Com **Docked**, mantém visível o pensamento de cada personagem em destaque, em vez de deixá-lo atrás de um botão. |
| **Stat display mode** | Mostra os atributos como barras ou como medidores circulares. |
| **Temperature unit** | **°C** (padrão) ou **°F**. Isso muda só a exibição, não o valor salvo. |

<a id="the-state-editor"></a>

## O State Editor

O **State Editor** mostra todos os trackers do turno atual em uma só janela, para você achar um valor e corrigi-lo sem abrir cada tracker. Ele também funciona no celular.

Abra o editor por qualquer um destes caminhos:

- A engrenagem (**Tracker panel settings**) no cabeçalho do Tracker Panel e depois o botão **{ }** (**Open in State Editor**).
- O botão **{ }** na barra de título da janela **Trackers**, ou de um tracker que você destacou.
- No celular, o botão **{ }** nos painéis **World State** e **Player & Tracker**.
- O link **Open in State Editor** em **Tracker Data**, no **Agent Suite**.

Ele abre na seção do tracker de onde você veio. World State abre em **Scene**, por exemplo.

- **Linha do turno**: abaixo da caixa de busca. Ela indica a mensagem e o swipe que você está editando, por exemplo "Editing message #12 · swipe 2 of 3". **Latest** (mais recente) marca o turno mais novo. Cada swipe tem o próprio estado, então dê swipe primeiro para editar outro.
- **Seções**: **Scene**, **Present Characters**, **Persona Stats**, **Inventory Tracker**, **Custom Tracker Fields** e **Active Quests**. No celular, elas são chips acima do editor. Um ponto marca a seção alterada.
- **Busca**: digite uma chave ou um valor, como `mood`. Clique em um resultado para ir até ele.
- **Fields** (campos): cada seção abre como **Fields**, com caixas para texto, números e valores de liga/desliga.
- **No value** (sem valor): um campo vazio mostra uma escolha entre **Text**, **Number** ou **On/off**.
- **Add item** (adicionar item): adiciona uma entrada, copiando a de cima.
- **Add** (adicionar): adiciona um campo com nome a uma seção ou a um cartão vazio.
- **×**: remove uma entrada ou limpa um valor.
- **JSON**: edite os dados brutos. **Format** (formatar) organiza o JSON. Uma seção com JSON quebrado não pode ser salva até você corrigi-lo.
- **Revert** (reverter): desfaz as suas alterações em uma seção.

Personagens e missões pertencem à história, então você não pode adicionar os cartões deles aqui. Você pode editar as listas dentro deles, como os atributos de um personagem.

Para salvar:

1. Clique em **Review changes** (revisar alterações) para ver cada mudança, linha por linha.
2. Clique em **Save changes** (salvar alterações). Isso grava todas as seções de uma vez no turno que você estava editando.

Até lá, os seus rascunhos ficam na janela, e fechá-la pede confirmação antes de descartá-los.

Se não funcionou: se a história avançou enquanto você editava, o editor não a sobrescreve. Uma resposta ou um swipe novo, ou uma atualização de tracker em uma seção que você alterou, faz o salvamento ser recusado com um botão **Reload** (recarregar). **Reload** mostra o estado mais recente e descarta os seus rascunhos.

## Guias relacionados

- [Referência dos agentes para download](../agents/built-in-agents.md)
- [Agentes: ajudantes de IA para os seus chats](../agents/agents-overview.md)
- [Cores do personagem e status da história](../characters/colors-and-stats.md): a aba **Stats** define as barras e os atributos com que uma persona ou um personagem começa.
- [Roleplay Mode: primeiros passos](getting-started.md)
- [Game Mode: widgets do HUD](../game/hud-widgets.md)
