# HUD e trackers do Roleplay

Este guia explica o HUD do Roleplay e os pequenos widgets de tracker que ele mostra. Aqui você vê como editar e travar os valores, e como funciona o Tracker Panel, o painel maior. Vale para o Roleplay Mode no Marinara Engine.

## O que é o HUD

O HUD (heads-up display) é a faixa de informações no topo da área do chat, formada por widgets pequenos com ícones. Cada widget mostra um pedaço do estado atual da história: a hora, os seus atributos ou quem está presente na cena. Marinara mantém esses valores atualizados conforme a história avança.

Os valores vêm dos agentes de tracker. Um agente é um pequeno ajudante de IA que roda em segundo plano. Cada agente de tracker acompanha a história e atualiza uma parte do HUD depois de cada mensagem, sem você precisar pedir.

Um widget só aparece quando o agente de tracker dele está ativado no chat. Ative e desative os agentes em **Chat Settings** (configurações do chat), na seção **Agents**. Sem nenhum agente de tracker ativo, o HUD mostra apenas o botão **Agents & Actions** (agentes e ações) e nenhum widget.

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

Para mudar uma quantidade que agora é um, ative o modo de adição ou o modo de bloqueio: os dois revelam o controle de quantidade em todas as entradas.

O widget **Present Characters** mostra até três emojis de personagem, mais uma contagem "+N" para os demais. Os widgets **Inventory** e **Custom Tracker** alternam entre as entradas, uma de cada vez.

## Editar valores no popover

Clique em qualquer widget para abrir o popover dele. O popover é um painel pequeno que flutua sobre a tela. Todos os campos são editáveis, então corrija ali qualquer valor que a IA errou. Marinara salva a edição na hora.

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

Em **Chat Settings → Agents**, a opção **Manual Trackers** passa todos os trackers ativos para o controle manual. Outra opção: deixe essa chave desligada e marque como manuais apenas os agentes escolhidos, em **Individual tracker schedule**. Um botão de atualizar aparece na faixa do HUD sempre que pelo menos um tracker está manual; clique nele para executar o conjunto de trackers manuais no turno atual. O botão de atualizar dentro de cada popover continua executando aquele tracker individualmente.

O ícone de brilho no começo da faixa do HUD abre o menu **Agents & Actions**. Por ali você executa todos os trackers de novo, tenta novamente os agentes que falharam e usa **Clear Trackers** (limpar os trackers) para apagar todo o estado do mundo registrado no chat. **Clear Trackers** não pode ser desfeito, então use com cuidado.

## O Tracker Panel

O **Tracker Panel** (painel de trackers) é um painel lateral maior que mostra os mesmos dados dos widgets compactos do HUD. Ele dá mais espaço aos cards dos trackers e acrescenta os retratos e os pensamentos. A configuração fica em **Settings** (Configurações), na aba **Appearance**, na seção **Tracker Panel**.

Os controles no cabeçalho do painel também permitem mudar a estrutura dos trackers:

- Clique em **+** para entrar no modo de adição. A seção World ganha **Add world field**, e cada card de personagem presente ganha **Add custom field**. Os nomes dos campos continuam visíveis no modo normal, para que os valores sempre façam sentido.
- Clique no ícone de lixeira para entrar no modo de exclusão e remover campos personalizados de mundo ou de personagem. Ao excluir um campo, os bloqueios salvos dele também somem.
- Clique no ícone de cadeado para entrar no modo de bloqueio. Os valores dos campos personalizados seguem as mesmas regras de bloqueio dos valores nativos do tracker.
- Clique no ícone de olho riscado para entrar no modo de ocultação e escolha **Mood**, **Look**, **Outfit** ou **Thoughts** em um card de personagem. Os campos ocultos desaparecem do Tracker Panel e do HUD do Roleplay, são limpos e ficam bloqueados, para que os agentes de tracker não os preencham de novo. Entre no modo de ocultação outra vez para exibir um campo oculto como campo vazio.

Os nomes dos campos personalizados definem a estrutura e continuam estáveis entre as execuções dos trackers. Os agentes de tracker atualizam os valores quando a história muda alguma coisa, e o que o agente deixa de fora não apaga os campos que você criou.

Estas configurações controlam o painel:

- **Tracker Panel**: o botão liga/desliga principal. Vem ativado por padrão. Quando está ativo, o rótulo diz "Shown in the Roleplay HUD".
- **Replace tracker HUD icons**: esconde a faixa compacta de ícones, para que o painel possa se encaixar na borda da tela. O botão **Agents & Actions** continua visível.
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
