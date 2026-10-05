# HUD e trackers do Roleplay

Este guia explica os trackers do Roleplay: os widgets pequenos no celular, a janela **Trackers** e Tracker Panel no computador. Você aprende a editar e travar os valores. Vale para o Roleplay Mode no Marinara Engine.

## O que é o HUD

No celular, o HUD (heads-up display) é uma fileira de widgets pequenos no topo do chat. Cada um mostra uma parte do estado da história, como a hora, seus atributos ou quem está presente. Marinara atualiza esses valores conforme a história avança.

No computador, os trackers não ficam na fileira do HUD. Eles aparecem em **Tracker Panel** enquanto o painel está visível, ou na janela **Trackers** descrita abaixo.

Os valores vêm dos agentes de tracker. Um agente é um pequeno ajudante de IA que roda em segundo plano. Cada agente de tracker acompanha a história e atualiza uma parte do HUD depois de cada mensagem, sem você precisar pedir.

Um widget só aparece quando o agente de tracker dele está ativado no chat. Ative e desative os agentes em **Chat Settings** (configurações do chat), na seção **Agents**. Sem nenhum agente de tracker ativo, o HUD não mostra widgets.

## Os widgets do HUD

São sete widgets de tracker. Cada um precisa do agente correspondente ativado para aparecer.

| Widget                 | Precisa deste agente | Mostra                                                                           |
| ---------------------- | ----------------- | -------------------------------------------------------------------------------- |
| **World State**        | World State       | Local, data, hora, clima, temperatura e os campos de mundo que você criou        |
| **Persona Stats**      | Persona Stats     | As barras de status da sua persona e uma linha de status                         |
| **Present Characters** | Character Tracker | Quem está na cena, com humor, aparência e campos próprios de cada personagem     |
| **Inventory**          | Persona Stats     | Os itens que você carrega, com as quantidades                                    |
| **Inventory Tracker**  | Inventory Tracker | Listas separadas para moedas, equipamento em uso e itens carregados              |
| **Active Quests**      | Quest Tracker     | O seu objetivo atual                                                             |
| **Custom Tracker**     | Custom Tracker    | Campos com nomes definidos por você, como contadores ou moeda                    |

Repare que o widget **Inventory** é alimentado pelo mesmo agente **Persona Stats** que abastece o widget **Persona Stats**. Ative **Persona Stats** para ter os dois.

O **Inventory Tracker** dedicado é separado do inventário do Persona Stats. Ele mantém entradas enxutas de nome e quantidade em três grupos, **Currencies**, **Equipped** e **Inventory**, e impede que o equipamento em uso apareça também entre os itens carregados.

Cada entrada é uma pequena pílula. As pílulas seguem pela largura do painel e quebram para a linha seguinte, então uma lista longa de itens continua legível em vez de esticar numa coluna alta. A quantidade só aparece quando é maior que um, escrita como `×4` depois do nome; um item sozinho mostra apenas o nome. Num painel estreito, as pílulas ficam uma por linha.

Para mudar uma quantidade que agora é um, ative **add mode** (modo de adição) ou **lock mode** (modo de bloqueio): os dois revelam o controle de quantidade em todas as entradas.

O widget **Present Characters** mostra até três emojis de personagem, mais uma contagem "+N" para os demais. Os widgets **Inventory** e **Custom Tracker** alternam entre as entradas, uma de cada vez.

<a id="the-trackers-window"></a>

## A janela Trackers

No computador, quando **Tracker Panel** não está visível, os trackers do Roleplay usam a janela **Trackers**. Se houver espaço ao lado das mensagens, ela abre à esquerda. Caso contrário, começa como um pequeno botão **Trackers** no canto superior esquerdo do chat. Clique nele para abrir. Um chat com layout salvo mantém a disposição escolhida.

Ao atualizar um chat antigo, os widgets de trackers do computador ficam juntos nessa janela. As outras ferramentas mantêm seus ícones como botões móveis.

Você pode mover a janela pela barra de título, redimensionar pelas bordas e usar os botões no canto superior direito:

- **Pin** a mantém aberta ao clicar fora. Ela começa fixada.
- **Lock** impede mover ou redimensionar e trava a posição do botão. O botão continua abrindo a janela, onde você pode destravá-la.
- **Close** a reduz ao botão móvel **Trackers**. Clique nele para reabrir onde você a deixou.

Para usar Tracker Panel, clique no dado da barra de título de Chat Settings. Quando o painel está oculto, os trackers continuam acessíveis pela janela ou pelo botão. **Reset View** em Chat Settings limpa a disposição salva e escolhe a janela ou o botão inicial conforme o espaço disponível.

Enquanto os agentes trabalham, um pontinho aparece ao lado do título da janela e no botão **Chat Settings**.

Cada tracker tem uma seção recolhível, chamada gaveta. Clique no cabeçalho para recolher até a prévia do widget pequeno e clique novamente para ver o tracker completo. Marinara lembra quais gavetas você recolheu.

Um tracker também pode ter uma janela própria: clique no botão para destacar ao lado da seta ou arraste o título para fora de Trackers. A nova janela começa sem fixação. Fixe a janela para mantê-la aberta quando clicar fora ou fechar Trackers. O **X** a reduz a um botão com o ícone do tracker, que reabre a janela onde você a deixou. Clique em **Put back in Trackers** (a seta curva à esquerda do **X**) ou arraste de volta sobre Trackers para guardar. Cada chat lembra quais trackers estão fora e onde.

No fim, **Agent activity** mostra o que os agentes fizeram. Por ali você pode executar trackers novamente, tentar de novo os agentes que falharam, parar os que estão rodando e usar **Clear Trackers**. Tracker Panel tem a mesma seção no fim.

## Editar valores no popover

No celular, toque em um widget para abrir seu popover. No computador, os mesmos editores ficam nas gavetas da janela Trackers. Um popover é um pequeno painel flutuante. Todos os campos são editáveis para você corrigir erros da IA. As mudanças são salvas na hora.

Veja o que cada popover permite editar:

- **World State**: os campos **Location**, **Date**, **Time**, **Weather**, **Temperature** e as linhas dos campos de mundo personalizados.
- **Persona Stats**: uma linha **Status**, mais barras de atributo com nome, valor atual e valor máximo. Adicione ou remova barras.
- **Present Characters**: adicione ou remova personagens e edite o emoji, o nome, **Mood** (humor), **Look** (aparência), **Outfit** (roupa), **Thinks** (pensamentos particulares) e os valores dos campos personalizados de cada um. Faça upload de um avatar por personagem. O botão **Auto** alterna entre "Auto-generate avatars: ON" e "Auto-generate avatars: OFF".
- **Inventory**: adicione ou remova itens e edite o nome e a quantidade de cada um.
- **Inventory Tracker**: adicione ou remova entradas em **Currencies**, **Equipped** e **Inventory**, e edite o nome ou a quantidade de cada uma. Mover um item de um grupo para outro ainda não é uma ação única: remova de um grupo e adicione no outro.
- **Active Quests**: adicione ou remova missões. Cada missão tem objetivos com nome e caixas de seleção para marcar o que foi concluído.
- **Custom Tracker**: adicione, remova ou edite os campos de nome e valor.

## Modo de bloqueio

Os agentes de tracker sobrescrevem os valores do HUD a cada turno. Isso ajuda, mas às vezes um valor insiste em sair errado e você quer fixá-lo na mão. O modo de bloqueio serve para isso.

Com o campo bloqueado, a próxima execução automática do tracker não mexe nele. Os campos bloqueados ficam marcados, então você identifica todos de relance.

Para bloquear um campo:

1. Abra o popover do widget.
2. Clique no botão liga/desliga de bloqueio, perto do topo do popover. A dica dele diz **Enter lock mode**.
3. Um pequeno botão de cadeado aparece ao lado de cada valor editável.
4. Clique no cadeado ao lado do valor que você quer fixar. A dica dele diz **Lock field**.

Para desbloquear, clique no mesmo botão de novo (dica **Unlock field**). Para sair do modo de bloqueio, clique outra vez no botão liga/desliga do topo (dica **Exit lock mode**). O modo de bloqueio vale para o HUD inteiro: ao ativá-lo em um popover, os cadeados aparecem em todos os outros.

## Executar um tracker de novo

Você pode forçar a atualização de um tracker em vez de esperar a próxima mensagem.

Dentro de cada popover há um pequeno botão de atualizar (a seta circular). Clique nele para executar só aquele tracker no turno mais recente. As dicas trazem o nome do tracker, por exemplo **Re-run world state tracker only** ou **Re-run quest tracker only**.

Em **Chat Settings → Agents**, **Manual Trackers** passa todos os trackers ativos para controle manual. Você também pode deixar a opção desligada e escolher só alguns agentes em **Individual tracker schedule**. Quando há pelo menos um tracker manual, aparece um botão de atualizar: na fileira do HUD no celular e ao lado do título de Trackers no computador. Clique nele para executar os trackers manuais no turno atual. O botão dentro de cada tracker continua executando apenas aquele tracker.

**Agent activity** tem sua própria seção abaixo de **Agents** em **Chat Settings**, no fim de Tracker Panel e, no computador, no fim da janela Trackers. Por ali você pode executar todos os trackers novamente, repetir agentes que falharam e usar **Clear Trackers** para apagar todo o estado do mundo registrado no chat. **Clear Trackers** não pode ser desfeito; use com cuidado.

## O Tracker Panel

O **Tracker Panel** (painel de trackers) é um painel lateral maior que mostra os mesmos dados dos widgets compactos do HUD. Ele dá mais espaço aos cards dos trackers e acrescenta os retratos e os pensamentos. A configuração fica em **Settings** (Configurações), na aba **Appearance**, na seção **Tracker Panel**.

Para ativar em um chat de Roleplay, abra **Chat Settings** e clique em **Tracker Panel** (o dado) na barra de título, perto de fixar e travar. Ele fica destacado enquanto o painel está ativo, e o painel aparece ao lado do chat. Clique novamente para desativar e ocultar. No computador, os trackers passam para a janela Trackers.

No celular, ativar adiciona ao chat um botão Tracker Panel que você pode arrastar para qualquer lugar. Toque nele para abrir o painel; fechar devolve o botão. Com o painel desligado, a fileira do HUD mantém os widgets.

Os controles no cabeçalho do painel também permitem mudar a estrutura dos trackers:

- Clique em **+** para entrar no modo de adição. A seção World ganha **Add world field**, e cada card de personagem presente ganha **Add custom field**. Os nomes dos campos continuam visíveis no modo normal, para que os valores sempre façam sentido.
- Clique no ícone de lixeira para entrar no modo de exclusão e remover campos personalizados de mundo ou de personagem. Ao excluir um campo, os bloqueios salvos dele também somem.
- Clique no ícone de cadeado para entrar no modo de bloqueio. Os valores dos campos personalizados seguem as mesmas regras de bloqueio dos valores nativos do tracker.
- Clique no ícone de olho riscado para entrar no modo de ocultação e escolha **Mood**, **Look**, **Outfit** ou **Thoughts** em um card de personagem. Os campos ocultos desaparecem do Tracker Panel e do HUD do Roleplay, são limpos e ficam bloqueados, para que os agentes de tracker não os preencham de novo. Entre no modo de ocultação outra vez para exibir um campo oculto como campo vazio.

Os nomes dos campos personalizados definem a estrutura e continuam estáveis entre as execuções dos trackers. Os agentes de tracker atualizam os valores quando a história muda alguma coisa, e o que o agente deixa de fora não apaga os campos que você criou.

Estas configurações controlam o painel:

- **Tracker Panel**: o botão liga/desliga principal, o mesmo controlado pelo dado de Chat Settings. Vem ativado por padrão. Quando ativo, o rótulo diz "Shown in the Roleplay HUD". Quando desligado, os trackers do computador aparecem na janela Trackers.
- **Replace tracker HUD icons**: oculta a faixa compacta de ícones no celular e permite encaixar o painel na borda da tela.
- **Use expression sprites for tracker portraits**: faz os retratos do tracker usarem o sprite de expressão do personagem (o retrato da emoção atual) em vez do avatar simples, quando existe um. Os sprites de expressão são explicados em [Sprites de personagem](../characters/sprites.md).
- **Panel background**: um seletor de cor ou gradiente para o plano de fundo do painel.
- **Desktop size**: escolha a largura do painel. As opções são **Compact**, **Standard** e **Expanded**.
- **Thought display mode**: escolha como os pensamentos do personagem aparecem. **Docked** abre os pensamentos dentro do card do personagem. **Floating** abre os pensamentos como um balão ao lado do retrato.
- **Always show Docked thoughts**: com **Thought display mode** em **Docked**, mantém visível o pensamento de cada personagem em destaque, em vez de escondê-lo atrás de um botão.
- **Temperature unit**: alterna a exibição da temperatura entre **Celsius** e **Fahrenheit**. O padrão é Celsius. Isso muda só a exibição, não o valor salvo no estado do mundo.

## Quais agentes abastecem o HUD

Todo widget do HUD é preenchido por um agente de tracker que roda depois de cada turno. A tabela de widgets no começo deste guia mostra qual agente alimenta cada widget.

Para definir com quais barras de atributo e atributos de RPG uma persona ou um personagem começa, use a aba **Stats** no editor de personagem ou de persona. Depois disso, os agentes de tracker ajustam esses valores conforme a história se desenrola.

## Guias relacionados

- [Referência dos agentes para download](../agents/built-in-agents.md)
- [Agentes: ajudantes de IA para os seus chats](../agents/agents-overview.md)
- [Cores do personagem e status de RPG](../characters/colors-and-stats.md)
- [Roleplay Mode: primeiros passos](getting-started.md)
- [Game Mode: widgets do HUD](../game/hud-widgets.md)
