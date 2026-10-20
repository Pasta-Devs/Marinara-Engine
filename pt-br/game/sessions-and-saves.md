# Game Mode: sessões e saves

Este guia explica como Marinara Engine acompanha seu progresso no Game Mode ao longo das sessões de jogo. Aqui você vê como encerrar e iniciar uma sessão e como ler as sessões anteriores em **Session History** (histórico de sessões). O guia também explica a visualização **Show Spoilers** (mostrar spoilers), como corrigir os dados do jogo à mão e como o jogo salva os dados.

## O que é uma sessão

Game Mode divide a aventura em sessões numeradas. Uma sessão é um trecho contínuo de jogo, como uma única noite de RPG de mesa. Quem narra cada sessão é o Game Master (GM, o mestre do jogo – a IA que conduz a partida). Ao encerrar uma sessão, o GM escreve um resumo que você pode reler depois.

A primeira sessão é a **Session 1**. Quando você encerra e começa de novo, surge a **Session 2**, e assim por diante.

<a id="opening-session"></a>

## Abrir Session

Em **Session**, você encerra sessões, inicia novas e lê o histórico.

1. Inicie ou abra um chat de Game Mode para ver a tela do jogo.
2. Clique ou toque no botão **Session** (a pena). Ele começa perto do canto superior direito do chat. Você pode arrastá-lo para outro lugar; veja [Janelas de controles e seus botões](../chats/chat-settings.md#control-windows-and-their-buttons).
3. **Session** abre como janela no computador ou painel de largura total no celular. A primeira linha mostra **Session** com o número e o status atuais.
4. Ele tem duas abas: **Session History** e **Journal**. Fique em **Session History** para os controles de sessão e o compartilhamento da configuração.

Se você usou **Put back in Chat Settings** para guardar essa janela, abra a seção **Session** dentro de Chat Settings.

## Compartilhar a configuração que criou um jogo

Game Mode guarda um retrato imutável da configuração usada para criar cada campanha nova. Assim você joga primeiro, decide que a combinação funciona bem e compartilha depois, sem precisar anotar cada campo à mão antes de começar.

1. Abra a campanha de Game Mode que você quer compartilhar.
2. Abra **Session** (o botão com a pena).
3. Fique na aba **Session History** e expanda a seção **Initial Game Setup** (configuração inicial do jogo).
4. Confira o que ficou salvo: aventura, elenco, modelo, prompt, parâmetros de geração em vigor, visual, storyboard e configurações das ferramentas de mundo.
5. Clique em **Copy setup** para copiar o texto para a área de transferência, ou em **Download .txt** para salvar um arquivo de texto pronto para compartilhar.

O texto copiado inclui as preferências longas do jogador e as instruções personalizadas do GM. Leia antes de publicar em algum lugar público, caso esses campos tenham conteúdo privado. Credenciais de conexão, URLs de servidor, chaves de API e IDs do banco de dados local nunca entram. Cards de personagem, personas, lorebooks, modelos e contas de provedor aparecem citados como referência, mas não vão junto no pacote, então quem receber precisa ter ou escolher os equivalentes locais.

Campanhas criadas antes da chegada dos retratos de configuração não têm como recuperar preferências que nunca foram salvas. Por isso, a seção **Initial Game Setup** aparece somente quando existe um retrato de criação confiável.

## Encerrar uma sessão

Encerre a sessão quando quiser fechar o capítulo atual e deixar o GM resumi-lo.

1. Abra **Session** e fique na aba **Session History**.
2. No topo você vê a sessão atual, com o rótulo **Session N (Current)**.
3. Nessa linha, clique no botão **End Session** (encerrar sessão), o ícone quadrado pequeno ao lado de **Show Spoilers**.
4. Abre uma janela chamada **End Session** pedindo confirmação.
5. Se quiser, escreva algo na caixa **What do you want to happen in the next session (optional)?**. O limite é de 5000 caracteres.
6. Deixe a caixa vazia para que o GM conduza a história do jeito dele.
7. Clique em **End Session** na janela para confirmar, ou em **Cancel** para desistir.

Depois da confirmação, o motor gera um resumo. Espere nesta tela até terminar. Durante o processo, o título da janela muda para **Ending Session**. No fim, a sessão é marcada como concluída e entra no histórico.

## Iniciar uma nova sessão

Assim que a sessão atual está concluída, o mesmo botão vira **New Session** (nova sessão).

1. Abra **Session** e vá para a aba **Session History**.
2. Na linha da sessão atual, clique no botão **New Session** (o ícone de play).
3. O GM retoma a história. Ele usa o resumo da sessão anterior e a nota para a próxima sessão que você escreveu ao encerrá-la.

Em um jogo com mundo gerado, o mundo continua de onde a última sessão o deixou: os dias que passaram, os feitos e a reputação da equipe, os lugares e grupos que a história acrescentou e os lugares por onde a equipe andou seguem todos para a nova sessão.

## Ler as sessões anteriores

A aba **Session History** lista as sessões concluídas, da mais recente para a mais antiga. Antes de você concluir a primeira, ela mostra **No completed sessions yet**.

Cada linha traz o número da sessão, a data e quantas descobertas foram registradas. Clique em uma linha para expandi-la. Uma sessão expandida pode mostrar estes campos:

- **Summary**: o que aconteceu durante a sessão.
- **Resume Point**: por onde a próxima sessão deve retomar.
- **Party Dynamics**: como os integrantes da equipe se relacionaram entre si.
- **Key Discoveries**: fatos importantes, reviravoltas e revelações.
- **Character Moments**: momentos marcantes dos personagens.
- **Little Details To Recall**: manias, promessas ou detalhes pequenos.
- **NPC Updates**: mudanças nos NPCs (personagens não jogáveis, controlados pelo GM).
- **Next Session Request**: a nota que você deixou ao encerrar a sessão.
- **Stats Snapshot** e **Party Status**: números salvos e situação da equipe.

### Reviver uma sessão concluída

Sessões concluídas podem ser revividas sem alterar a campanha.

1. Expanda uma sessão concluída em **Session History**.
2. Clique em **Replay Session**.
3. Use os botões **Next** e **Next turn** para avançar pela narração e pelos diálogos originais.
4. Quando a repetição chega a uma escolha, só a opção que você selecionou na sessão original fica ativa. Clique nela para seguir pelo caminho registrado.
5. Clique no botão de fechar no topo da repetição ou em **Return to current session** ao terminar.

A repetição é somente leitura. Ela não chama o GM, não cria mensagens, não altera inventário nem atributos, não atualiza o diário e não restaura nenhum checkpoint. Sessões criadas antes do suporte à repetição continuam usando o texto salvo, os efeitos embutidos, as escolhas e os recursos disponíveis. Um turno antigo pode não ter algum efeito de cena que não foi salvo quando aquele turno foi jogado.

### Editar uma sessão anterior

Você pode editar à mão as anotações de uma sessão concluída para que as sessões seguintes as lembrem corretamente.

1. Expanda a sessão que você quer alterar.
2. Clique em **Edit Details**.
3. Altere qualquer campo e clique em **Save Details**. Clique em **Cancel** para descartar as alterações.

Uma sessão expandida traz outros dois botões:

- **Regenerate**: refaz a conclusão gerada pela IA para aquela sessão. Isso reescreve o resumo e todos os outros campos da entrada. Tudo o que você alterou com **Edit Details** se perde.
- **Update Plot Arcs**: pede que a IA atualize os planos secretos de história do GM com base nos acontecimentos daquela sessão. Esses planos são o **Story Arc**, os **Plot Twists** e os **Party Arcs** exibidos na visualização **Show Spoilers**.

O botão **Regenerate Lorebook** aparece só na sua última sessão concluída, e só com o recurso opcional Lorebook Keeper ativado. Um lorebook é um conjunto de fatos do seu mundo que a IA pode consultar.

## A visualização Show Spoilers

A opção **Show Spoilers** revela as anotações secretas do GM para a sessão atual. Normalmente elas ficam escondidas de você durante o jogo. Ler esse conteúdo pode estragar as reviravoltas.

1. Abra **Session** e vá para a aba **Session History**.
2. Na linha da sessão atual, clique em **Show Spoilers** (o ícone de olho).
3. O estado privado do GM aparece.

A visualização de spoilers pode mostrar estas seções:

- **World Overview**: o panorama geral do cenário.
- **Story Arc**: o rumo planejado para a história.
- **Plot Twists**: as surpresas que o GM está guardando.
- **Party Arcs**: as jornadas planejadas para a equipe.
- **Maps**, **NPCs** e **Character Cards**: os dados salvos do jogo.

Para esconder as anotações de novo, clique no mesmo botão. Agora ele mostra **Hide Spoilers**.

Esses segredos também podem ser editados, o que funciona como um painel de trapaça do mestre. Clique em **Edit Spoilers**, altere o texto e clique em **Save Spoilers**. Alguns campos aparecem em JSON, um formato de texto estruturado. Só edite campos em JSON se você conhecer o formato, porque um JSON inválido não é salvo.

<a id="editing-game-data-by-hand"></a>

## Editar os dados do jogo à mão

Quando o Game Master erra alguma coisa, como a reputação de um NPC ou uma missão que continua aberta, você mesmo pode corrigir os dados salvos do jogo.

1. Abra **Game controls** (controles do jogo) e escolha **Edit game data** (editar dados do jogo). No celular, **Game controls** fica no menu de três pontos **Chat tools** (ferramentas do chat).
2. A janela **Game Data** (dados do jogo) se abre. Um aviso no topo diz: "Hand edits can break a game. Every change is checked before it saves, and names can't change here."
3. Escolha uma seção na lista, ou na fileira de chips no celular. Você também pode digitar na caixa de busca para achar um valor em todas as seções de uma vez.
4. Altere os valores em **Fields** (campos) ou mude para **JSON** para editar os dados brutos.
5. Clique em **Review changes** (revisar alterações) para ver exatamente o que muda e depois clique em **Save changes** (salvar alterações).

Você pode alterar **Party Cards**, **Party Sheet**, **NPCs**, **Journal**, **Player Notes**, **Inventory**, **Story**, **Session Summaries**, **World Edits**, **Story Script** e **HUD Widgets**. Uma seção só aparece quando o jogo tem esses dados, então um jogo sem mundo não tem **World Edits** (edições do mundo). As outras seções, como **World**, **Maps & Position**, **Time, Weather & Morale**, **Combat** e **Settings**, são marcadas como **Read-only** (somente leitura). Você pode lê-las e buscar nelas, mas o próprio jogo cuida delas. Preferências de prompt, imagem, música e rolagem de dados são alteradas em **Chat Settings** (configurações do chat).

Toda alteração é verificada antes de ser salva:

- Os nomes não podem mudar, porque cards, NPCs, a equipe e as bolsas se encontram pelo nome. Não dá para adicionar nem remover integrantes da equipe aqui.
- A reputação de um NPC vai de -100 a 100.
- Em **Inventory**, você pode alterar a quantidade, o apelido e o portador de um item, e se ele está vestido, sintonizado ou ligado. Deixe uma pilha de fora para removê-la, ou adicione uma sem id para adicionar um item.
- Em **Session Summaries**, só o texto de uma sessão pode mudar.
- **World Edits** guarda as suas edições manuais sobre o mundo, como lugares renomeados ou pessoas adicionadas. O mundo em si nunca é alterado.

Quando uma alteração não pode ser salva, o editor diz por quê, e aquela seção mantém o seu rascunho para você corrigi-lo. Se o jogo alterou os mesmos dados enquanto você editava, o salvamento é recusado para não desfazer a alteração do jogo. **Reload** (recarregar) mostra a versão do jogo e descarta os seus rascunhos.

Antes de cada salvamento, o jogo tenta criar um checkpoint, marcado como **Before a State Editor save** (antes de salvar no State Editor) em **Checkpoints**. Se uma edição der errado, carregue esse checkpoint para desfazê-la (veja abaixo).

A janela funciona como o State Editor do Roleplay. Veja [O State Editor](../roleplay/hud-and-trackers.md#the-state-editor).

<a id="how-your-game-saves"></a>

## Como o jogo salva

Game Mode salva o progresso automaticamente. Não existe botão de salvar para apertar. Mundo, equipe, mapa, inventário, tempo dentro do jogo e resumos de sessão ficam todos salvos enquanto você joga.

O aplicativo também registra checkpoints automáticos nos bastidores. Ele captura um checkpoint no início da sessão, no fim da sessão, quando um combate começa ou termina, quando você chega a um lugar novo e em intervalos automáticos. O [editor Game data](#editing-game-data-by-hand) também tenta criar um antes de cada salvamento, mas um jogo tão novo que ainda não teve o primeiro turno salvo ainda não tem nada para guardar em checkpoint. Abra **Game controls → Checkpoints** (controles do jogo → checkpoints) para vê-los, do mais recente para o mais antigo. **Load** (carregar) leva o jogo de volta àquele momento: o tracker, o mapa, as **World Edits** feitas no editor Game data e a história posterior a esse momento são restaurados, e uma mensagem de sistema marca o ponto em que o jogo voltou. Os cards e as fichas da equipe, os NPCs, o diário, as suas anotações, o inventário, os resumos de sessão, os planos de história do GM, os widgets do HUD e o tempo, o clima e o moral também voltam àquele momento. As suas configurações continuam como estão. **Delete** (excluir) remove o checkpoint de vez.

Os checkpoints automáticos ficam limitados aos cinco mais recentes de cada tipo, então os mais antigos vão sendo removidos conforme você joga.

Para desfazer um único turno ruim, use **Retry turn** (repetir o turno) em **Game controls** ou um swipe. Carregar um checkpoint também restaura a história àquele momento.

Para manter sua própria cópia dos dados, use as ferramentas de backup do aplicativo. Veja [Fazer backup e restaurar Marinara](../data/backup-and-restore.md).

## Guias relacionados

- [Game Mode: primeiros passos](getting-started.md)
- [Fazer backup e restaurar Marinara](../data/backup-and-restore.md)
