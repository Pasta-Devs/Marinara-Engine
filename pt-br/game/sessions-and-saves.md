# Game Mode: sessões e saves

Game Mode divide a aventura em sessões numeradas, como as noites de um RPG de mesa. Este guia mostra como encerrar e iniciar uma sessão, ler as sessões anteriores, compartilhar a sua configuração, corrigir os dados salvos à mão e voltar a um momento anterior.

A primeira sessão é a **Session 1**. Encerrá-la e começar de novo cria a **Session 2**, e assim por diante. Ao encerrar uma sessão, o Game Master (GM, a IA que conduz o seu jogo) escreve um resumo que você pode reler depois.

## Salvar e continuar

Não existe botão de salvar. O jogo se salva sozinho enquanto você joga.

1. Para parar por enquanto, feche a aba ou o aplicativo.
2. Para continuar, abra o mesmo chat do jogo. Você volta para onde parou.
3. Para fechar um capítulo, encerre a sessão (veja [Encerrar uma sessão](#end-a-session)).

Para voltar a um momento anterior, veja [Como o jogo salva](#how-your-game-saves).

<a id="opening-session"></a>

## Abrir Session

Em **Session**, você encerra sessões, inicia novas e lê o histórico.

1. Abra um chat de Game Mode.
2. Clique ou toque no botão **Session** (a pena), perto do canto superior direito do chat. Você pode arrastá-lo para outro lugar (veja [Janelas de controles e seus botões](../chats/chat-settings.md#control-windows-and-their-buttons)).
3. **Session** abre como janela no computador ou como painel de largura total no celular. A primeira linha mostra o número e o status da sessão atual.
4. Ele tem duas abas: **Session History** (histórico de sessões) e **Journal** (diário). Fique em **Session History** para os controles de sessão.

Se você usou **Put back in Chat Settings** para mover essa janela, abra a seção **Session** em Chat Settings.

<a id="end-a-session"></a>

## Encerrar uma sessão

Encerre uma sessão quando quiser fechar um capítulo e deixar o GM resumi-lo.

1. Abra **Session** e fique em **Session History**.
2. Encontre a sessão atual no topo, com o rótulo **Session N (Current)**.
3. Nessa linha, clique no botão **End Session** (encerrar sessão), o ícone quadrado pequeno. A linha tem vários botões pequenos de ícone, então passe o ponteiro sobre eles para ler as dicas. Uma janela chamada **End Session** pede confirmação.
4. Opcional: escreva uma nota em **What do you want to happen in the next session (optional)?** (até 5.000 caracteres). Deixe a caixa vazia para que o GM conduza a história.
5. Clique em **End Session** na janela. Clique em **Cancel** (cancelar) para desistir.

O título da janela muda para **Ending Session** enquanto o GM escreve o resumo. Espere nesta tela até terminar. A sessão é então marcada como concluída e entra no histórico.

Se não funcionou, confira se o modelo do GM está acessível. O resumo é uma requisição ao modelo e pode falhar como qualquer outra. Tente de novo e veja [Solução de problemas do Marinara Engine](../TROUBLESHOOTING.md).

## Iniciar uma nova sessão

Depois que uma sessão é concluída, o mesmo botão na linha dela vira **New Session** (nova sessão).

1. Abra **Session** e vá para **Session History**.
2. Na linha da sessão atual, clique em **New Session** (o ícone de play).

O GM retoma a história a partir do último resumo e de qualquer nota que você escreveu ao encerrar a sessão. Em um jogo com mundo gerado, o mundo continua de onde parou: os dias que passaram, os feitos e a reputação da equipe, os lugares e grupos que a história acrescentou e os lugares por onde a equipe andou.

## Ler as sessões anteriores

**Session History** lista as sessões concluídas, da mais recente para a mais antiga. Antes de você concluir a primeira, ela mostra **No completed sessions yet**. Cada linha traz o número da sessão, a data e quantas descobertas foram registradas. Clique em uma linha para expandi-la. Estes campos podem aparecer:

| Campo | O que guarda |
| --- | --- |
| **Summary** | O que aconteceu. |
| **Resume Point** | Por onde a próxima sessão deve retomar. |
| **Party Dynamics** | Como os integrantes da equipe se relacionaram entre si. |
| **Key Discoveries** | Fatos importantes, reviravoltas e revelações. |
| **Character Moments** | Momentos marcantes. |
| **Little Details To Recall** | Manias, promessas ou detalhes pequenos. |
| **NPC Updates** | Mudanças nos NPCs (personagens não jogáveis, as pessoas que o GM controla). |
| **Next Session Request** | A nota que você deixou ao encerrar a sessão. |
| **Stats Snapshot**, **Party Status** | Números salvos e situação da equipe. |

### Reviver uma sessão

A repetição é somente leitura. Ela não chama o GM, não cria mensagens, não altera inventário nem atributos, não atualiza o diário e não restaura nenhum checkpoint.

1. Expanda uma sessão concluída.
2. Clique em **Replay Session**.
3. Use **Next** e **Next turn** para avançar pela narração e pelos diálogos originais.
4. Em uma escolha, só a opção que você selecionou originalmente fica ativa. Clique nela para seguir pelo caminho registrado.
5. Clique no botão de fechar no topo, ou em **Return to current session**, ao terminar.

Sessões de antes de a repetição existir continuam sendo revividas a partir do texto, dos efeitos, das escolhas e dos recursos salvos. Um turno antigo pode não ter um efeito de cena que não era salvo na época.

### Editar uma sessão anterior

Edite as anotações de uma sessão concluída para que as sessões seguintes as lembrem corretamente.

1. Expanda a sessão.
2. Clique em **Edit Details**.
3. Altere qualquer campo e clique em **Save Details**. Clique em **Cancel** para descartar as alterações.

Uma sessão expandida traz outros dois botões:

- **Regenerate** refaz a conclusão da IA. Ele reescreve o resumo e todos os outros campos, então as alterações feitas com **Edit Details** se perdem.
- **Update Plot Arcs** pede que a IA atualize os planos secretos de história do GM com base nos acontecimentos daquela sessão. Esses planos são o **Story Arc**, os **Plot Twists** e os **Party Arcs** da visualização **Show Spoilers**.

**Regenerate Lorebook** aparece só na sua última sessão concluída, e só com o recurso Lorebook Keeper ativado. Um lorebook é um conjunto de fatos do mundo que a IA pode consultar.

## Compartilhar a configuração que criou um jogo

Game Mode guarda um instantâneo da configuração usada para criar cada campanha nova. Jogue primeiro e compartilhe a combinação depois, se ela funcionar bem.

1. Abra a campanha e abra **Session**.
2. Em **Session History**, expanda **Initial Game Setup** (configuração inicial do jogo).
3. Confira a aventura, o elenco, o modelo, o prompt, os parâmetros de geração, o visual, o storyboard e as configurações das ferramentas de mundo que ficaram salvos.
4. Clique em **Copy setup** (copiar a configuração) para copiar o texto, ou em **Download setup** (baixar a configuração) para salvar um arquivo de texto.

> **Aviso:** o texto inclui as suas preferências longas de jogador e as instruções personalizadas do GM. Leia o texto antes de publicá-lo. Credenciais, URLs de servidor, chaves de API e IDs do banco de dados local nunca entram.

Cards de personagem, personas, lorebooks, modelos e contas aparecem citados, mas não vão junto, então outro jogador precisa ter os próprios equivalentes. Campanhas criadas antes de os instantâneos existirem não têm como recuperar configurações que nunca foram salvas, então **Initial Game Setup** só aparece quando existe um instantâneo confiável.

## Ver as anotações secretas do GM

**Show Spoilers** (mostrar spoilers), o ícone de olho na linha da sessão atual, revela as anotações privadas do GM para a sessão atual. Lê-las pode estragar as reviravoltas.

1. Abra **Session** e vá para **Session History**.
2. Na linha da sessão atual, clique em **Show Spoilers** (o ícone de olho).

A visualização pode mostrar **World Overview**, **Story Arc**, **Plot Twists**, **Party Arcs** e os **Maps**, **NPCs** e **Character Cards** salvos. Clique no mesmo botão, que agora mostra **Hide Spoilers** (esconder spoilers), para escondê-las.

Para mudar essas anotações, clique em **Edit Spoilers**, edite o texto e clique em **Save Spoilers**. Alguns campos são JSON, um formato de texto estruturado. Só edite esses campos se você conhecer o formato, porque um JSON inválido não é salvo.

<a id="editing-game-data-by-hand"></a>

## Editar os dados do jogo à mão

Quando o GM erra alguma coisa, como a reputação de um NPC ou uma missão que continua aberta, você mesmo pode corrigir os dados salvos.

1. Abra **Game controls** (controles do jogo) e escolha **Edit game data** (editar dados do jogo). No celular, **Game controls** fica no menu de três pontos **Chat tools** (ferramentas do chat).
2. A janela **Game Data** (dados do jogo) se abre. Um aviso diz: "Hand edits can break a game. Every change is checked before it saves, and names can't change here."
3. Escolha uma seção na lista (uma fileira de chips no celular). A caixa de busca acha um valor em todas as seções de uma vez.
4. Altere os valores em **Fields** (campos) ou mude para **JSON** para ver os dados brutos.
5. Clique em **Review changes** (revisar alterações) para ver exatamente o que muda e depois clique em **Save changes** (salvar alterações).

> **Aviso:** edições manuais podem corromper um jogo. Antes de cada salvamento, Marinara tenta criar um checkpoint marcado como **Before a State Editor save** (veja [Como o jogo salva](#how-your-game-saves)). Carregue esse checkpoint para desfazer uma edição ruim. Um jogo tão novo que ainda não tem o primeiro turno salvo ainda não tem nada para guardar em checkpoint.

Se não funcionou, o editor diz por quê e mantém o seu rascunho para você corrigi-lo. Se o jogo alterou os mesmos dados enquanto você editava, o salvamento é recusado para não desfazer a alteração do jogo. **Reload** (recarregar) mostra a versão do jogo e descarta os seus rascunhos.

Você pode alterar estas seções: **Party Cards**, **Party Sheet**, **NPCs**, **Journal**, **Player Notes**, **Inventory**, **Story**, **Session Summaries**, **World Edits**, **Story Script** e **HUD Widgets**. Uma seção só aparece quando o jogo tem esses dados, então um jogo sem mundo não tem **World Edits** (edições do mundo). Seções como **World**, **Maps & Position**, **Time, Weather & Morale**, **Combat** e **Settings** são marcadas como **Read-only** (somente leitura): você pode lê-las e buscar nelas, mas o próprio jogo cuida delas. Preferências de prompt, imagem, música e dados são alteradas em **Chat Settings** (configurações do chat).

Regras que as verificações aplicam:

- Os nomes não podem mudar, porque cards, NPCs, a equipe e as bolsas se encontram pelo nome. Não dá para adicionar nem remover integrantes da equipe aqui.
- A reputação de um NPC vai de -100 a 100.
- Em **Inventory**, você pode alterar a quantidade, o apelido e o portador de um item, e se ele está vestido, sintonizado ou ligado. Deixe uma pilha de fora para removê-la, ou adicione uma sem id para adicionar um item.
- Em **Session Summaries**, só o texto de uma sessão pode mudar.
- **World Edits** guarda as suas edições manuais sobre o mundo, como lugares renomeados ou pessoas adicionadas. O mundo em si nunca muda.

A janela funciona como o State Editor do Roleplay. Veja [O State Editor](../roleplay/hud-and-trackers.md#the-state-editor).

<a id="how-your-game-saves"></a>

## Como o jogo salva

Game Mode salva automaticamente. Mundo, equipe, mapa, inventário, tempo dentro do jogo e resumos de sessão ficam salvos enquanto você joga, sem botão de salvar.

Marinara também registra checkpoints automáticos no início da sessão, no fim da sessão, quando um combate começa ou termina, quando você chega a um lugar novo e em intervalos definidos. Ele mantém os cinco mais recentes de cada tipo e remove os mais antigos. O editor Game Data também tenta criar um antes de cada salvamento.

Para voltar:

1. Abra **Game controls → Checkpoints** (controles do jogo → checkpoints). Eles aparecem do mais recente para o mais antigo.
2. Clique em **Load** (carregar) no momento que você quer.

**Load** leva o jogo de volta àquele momento. O tracker, o mapa, as **World Edits**, a história, os cards e as fichas da equipe, os NPCs, o diário, as suas anotações, o inventário, os resumos de sessão, os planos de história do GM, os widgets do HUD, o tempo, o clima e o moral voltam todos. Uma mensagem de sistema marca o ponto em que o jogo voltou. As suas configurações continuam como estão. **Delete** (excluir) remove um checkpoint de vez.

Para desfazer só um turno ruim, use **Retry turn** (repetir o turno) em **Game controls**, ou dê swipe para outra versão da resposta.

Para manter a sua própria cópia dos dados, veja [Fazer backup e restaurar o Marinara](../data/backup-and-restore.md).

## Guias relacionados

- [Game Mode: primeiros passos](getting-started.md)
- [Fazer backup e restaurar o Marinara](../data/backup-and-restore.md)
