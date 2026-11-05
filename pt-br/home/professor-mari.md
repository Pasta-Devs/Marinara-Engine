# Professor Mari, a assistente dentro do aplicativo

Professor Mari é a assistente integrada da tela inicial. Ela explica o aplicativo, ajuda você a configurá-lo e cria ou edita personagens, personas, lorebooks e presets para você. Você pode desfazer as mudanças dela pelo card de mudança durante um tempo limitado (veja [Revisar as mudanças dela](#reviewing-her-changes)).

<a id="where-to-find-her"></a>

## Onde encontrar a Professor Mari

1. Vá para a tela inicial. Ela aparece quando nenhum chat está aberto.
2. Clique em **Ask Professor Mari** (falar com a Professor Mari) no widget **Professor Mari**, ou clique na aba **Professor**.

A janela dela se abre. Você também chega até ela de qualquer tela: digite na busca e escolha **Ask Prof. Mari**, pressione <kbd>Ctrl</kbd>+<kbd>J</kbd> (<kbd>⌘</kbd>+<kbd>J</kbd> no Mac) ou, no celular, puxe a barra superior para baixo. O cabeçalho dela mostra **Ready to help** quando ela está parada e **Working on it...** enquanto ela trabalha.

Digite a sua mensagem em linguagem comum e pressione <kbd>Enter</kbd>. <kbd>Shift</kbd>+<kbd>Enter</kbd> quebra a linha. Se você desligar **Enter sends to Professor Mari** (Enter envia para a Professor Mari) nas configurações dela, <kbd>Enter</kbd> quebra a linha e <kbd>Ctrl</kbd>+<kbd>Enter</kbd> envia. A sua primeira mensagem desbloqueia a conquista **Hello World**.

Todas as configurações dela ficam em **Settings → General → Search and Professor Mari settings → Open** (Configurações → Geral → configurações da busca e da Professor Mari → abrir), ou na engrenagem da busca. No computador, os controles deslizantes **Height** (altura) e **Width** (largura), em **Professor Mari window** (janela da Professor Mari), mudam o tamanho da janela dela. No celular, a janela dela ocupa a tela inteira.

## Criar um personagem com a Mari

Antes de começar: adicione uma conta de geração de texto. Veja [Conectando a um provedor de IA](../connections/connecting-to-a-provider.md) e [Escolher uma conta para ela](#pick-an-account-for-her).

1. Abra a janela dela (veja acima).
2. Se o chat já tiver mensagens, clique antes em **New chat** (chat novo). O chat atual fica salvo em **Chats**.
3. Clique na sugestão **Create a character** (criar um personagem). A sugestão preenche a caixa de mensagem. Se nenhuma sugestão aparecer, digite o seu pedido.
4. Acrescente a sua ideia ao texto, por exemplo o nome e a personalidade, e pressione <kbd>Enter</kbd>.
5. Responda às perguntas dela. Escolha uma opção ou digite a sua e clique em **Submit** (enviar).
6. Quando ela terminar, clique em **Open** (abrir) no resultado para ver o personagem novo.
7. Se você não gostar de uma mudança, clique em **Undo** (desfazer) no card de mudança dela.

Se não funcionou: sem nenhuma conta adicionada, a lista **Connections** (Conexões) abre quando você pressiona enviar. Escolha ou adicione uma conta ali.

## O que ela pode fazer

Ela lê um item antes de editá-lo e pergunta quando o seu pedido está vago.

- Explicar uma configuração, um modo ou um conceito.
- Criar ou editar um personagem, uma persona ou um lorebook. O card de personagem dá à IA um nome, uma personalidade e uma voz. A persona é o card de personagem que representa você. O lorebook é um conjunto de fatos do mundo que a IA lê quando as palavras-chave deles aparecem.
- Escrever o [onboarding interativo](../characters/interactive-onboarding.md) de um personagem e preencher uma [ficha de conjunto de regras](../characters/colors-and-stats.md#ruleset-sheets) para um conjunto de regras de Game Mode instalado. A alteração dela é recusada, com o motivo, quando um valor não cabe no conjunto de regras.
- Criar ou editar um tema, um agente, um preset de prompt ou um rascunho de Personal Extension. O rascunho fica desativado até você ler o código dele e aprová-lo em **Settings → Addons** (Configurações → Complementos).
- Editar uma seção de um preset no próprio lugar, em vez de substituir o preset inteiro.
- Comparar os agentes disponíveis para download e dizer quais combinam com o seu objetivo. Ela encaminha você para **Agents → Agent Organizer** (agentes → Organizador de agentes) para instalá-los. Veja [Referência dos agentes para download](../agents/built-in-agents.md).
- Gerar ou atribuir imagens, como avatares, sprites e planos de fundo. Antes, você precisa de uma conta de geração de imagens. Ela não cria essa conta.
- Consultar páginas públicas de wikis do Fandom quando você pesquisa um personagem ou um mundo.

### Comece com uma sugestão

Em um chat vazio da Professor Mari, sugestões iniciais ajudam a começar: **Create a character**, **Create a lorebook** (criar um lorebook) e **Create a persona** (criar uma persona). Clique em uma sugestão para preencher a caixa de mensagem e edite o texto antes de enviar. Durante uma tarefa guiada, as sugestões mudam de acordo com a próxima etapa. As sugestões só aparecem nos chats da Professor Mari.

Quando o seu pedido deixa decisões reais em aberto, ela pode perguntar em um card de perguntas abaixo da resposta dela: até quatro perguntas, uma de cada vez, com opções e a recomendação dela marcada. Escolha uma opção ou digite a sua e clique em **Submit**. As suas respostas vão como a sua próxima mensagem. Você também pode ignorar o card e digitar uma mensagem. Nada do que ela propôs junto com a pergunta é executado até você responder.

### Pergunte a partir do lugar onde você está trabalhando

Estes lugares abrem a Professor Mari com um rascunho editável e um pequeno chip **Context** (contexto: uma etiqueta acima da caixa de mensagem) que você pode remover antes de enviar:

- Os editores **Character**, **Persona**, **Lorebook** e **Preset**.
- Respostas do **FAQ**: **Ask Prof. Mari about this** (perguntar à Professor Mari sobre isto).
- Search (busca): escolha um resultado e depois **Ask Prof. Mari**.
- Estados de erro, como **Try again** (tentar de novo): **Ask Professor Mari**.

Ela não recebe um item inteiro só porque você abriu o editor dele.

<a id="pick-an-account-for-her"></a>

## Escolher uma conta para ela

Antes de começar: adicione uma conta de geração de texto. Veja [Conectando a um provedor de IA](../connections/connecting-to-a-provider.md).

1. Clique no botão de conexão ao lado do clipe de papel. Ele mostra o nome da conta dela, ou **Select connection** (selecionar conexão) quando nenhuma foi escolhida.
2. Escolha uma conta de geração de texto na lista **Connections**. Se você baixou o **Built-in model** (modelo embutido), ele também aparece aqui.
3. Clique em um modelo da lista para usá-lo. O modelo fica salvo na conta, então os seus outros chats nessa conta também passam a usá-lo. O **Built-in model** não tem lista de modelos.

No celular, toque em uma conta para usá-la, ou toque na seta no fim da linha dela para ver primeiro os modelos. Se ainda não houver nenhuma conta, a lista mostra **Add a connection** (adicionar uma conexão).

<a id="reviewing-her-changes"></a>

## Revisar as mudanças dela

Quando ela muda alguma coisa, salva a mudança na hora e mostra um card de mudança abaixo da resposta. O card lista cada campo que mudou. Uma edição de texto mostra as palavras antigas e as novas. **Show all** (mostrar tudo) mostra todos os campos, e **Technical details** (detalhes técnicos) mostra o comando bruto.

O card tem uma ação: **Undo**. Essa ação traz de volta a versão salva anterior. Enquanto a cópia para desfazer for mantida, toda mudança pode ser desfeita, em qualquer modo de permissões. O modo de permissões só decide se ela pergunta antes.

- **Not saved** (não salva) com um motivo quer dizer que a mudança falhou. **Try again** pede a ela de novo.
- **Undo until** (desfazer até) só aparece nas últimas 24 horas. Uma cópia para desfazer dura até 14 dias, e só as 50 mais recentes são mantidas. Depois disso, o card mostra **Undo closed** (não dá mais para desfazer) e a mudança fica.
- Uma etapa na lista de trabalho dela que termina em **· not saved** (· não salva) foi só uma prévia. Nada mudou.
- Uma edição que não mudaria nada não é salva e não recebe card.
- Personagens e personas também guardam um histórico de versões nos editores deles, como um segundo caminho de volta.
- Ela não pode editar nem excluir o próprio card. Marinara o redefine a cada inicialização.

Um card pertence ao chat em que ela fez a mudança. Excluir um chat mantém as mudanças dele e remove os cards dele.

### Mudanças que esperam por você

Uma mudança retida espera, em vez de ser salva. Essa mudança mostra **Apply** (aplicar) e **Don't apply** (não aplicar). Uma exclusão mostra **Delete** (excluir) e **Put back** (pôr de volta). As mudanças ficam retidas no modo Manual e nos casos de arquivos sensíveis e de dependências (veja [Mudanças retidas em arquivos e bibliotecas](#held-changes-for-files-and-libraries)). A busca não lista as mudanças dela: abra a Professor Mari para aplicá-las ou desfazê-las.

Quando ela cria ou atualiza um personagem, uma persona, um lorebook ou um preset, o resultado pode mostrar **Open**, que abre esse item. Um resultado atualizado também pode mostrar **Review** (revisar) enquanto há uma revisão pendente.

## O menu do clipe de papel

Clique no botão do clipe de papel, chamado **Attach** (anexar). O menu tem três seções.

| Seção | Itens |
| --- | --- |
| **Attach** | **Attach files or photos** (anexar arquivos ou fotos), **Add chat history** (adicionar histórico de chat: compartilhe um dos seus chats anteriores), **View attached context** (ver contexto anexado) |
| **Reference** | **Link with @** (vincular com @) |
| **Mari** | **New chat**, **Chat history** (histórico de chats), **Skills**, **Memories** (lembranças), **Model** (modelo), **Permissions** (permissões). **Pending approvals** (aprovações pendentes) aparece enquanto uma mudança espera por você. |

Você pode digitar as mesmas ações com `/`. Veja [Comandos com /](#commands-with-).

### Anexar arquivos

Escolha **Attach files or photos**, ou digite `/attach`. Ela aceita imagens, arquivos PDF e arquivos de texto, como `.txt`, `.md`, `.json`, `.csv` e `.log`, de até 20 MB cada. Você também pode colar uma captura de tela ou um arquivo na caixa de mensagem. Para ela ler uma imagem, o modelo escolhido precisa aceitar imagens na entrada.

### Vincular itens com @

Digite `@` para apontar para ela algo da sua biblioteca. Uma lista se abre, agrupada em **Characters** (personagens), **Personas**, **Lorebooks**, **Presets**, **Skills**, **Memories**, **Chats**, **Agents** (agentes) e **Docs**. Continue digitando para reduzir a lista. Nomes com espaços não precisam de aspas.

- Use as setas para se mover, <kbd>Enter</kbd> ou <kbd>Tab</kbd> para escolher e <kbd>Escape</kbd> para fechar. Em um lorebook, a seta para a direita lista as **Entries** (entradas) dele, para você vincular uma única entrada.
- Ao lado de um editor, a primeira linha, **Open beside me** (abrir ao meu lado), vincula o que o editor tem aberto. Ao lado do editor de personagem, o › dessa linha (ou a seta para a direita) lista os **Fields** (campos). Escolher um campo troca o campo em que ela trabalha e substitui o chip do campo na linha de contexto dela.
- Um nome escolhido aparece como um chip acima da caixa de mensagem. Apague o nome e o vínculo some junto. O **×** do chip remove o vínculo e mantém o seu texto.
- Em texto comum, <kbd>Tab</kbd> completa um nome que ela sugere em cinza. Pressione <kbd>Tab</kbd> de novo para vinculá-lo. Em uma tela sensível ao toque, toque no nome cinza e depois em **Tap to link** (toque para vincular).

| Vínculo | O que ela recebe |
| --- | --- |
| Personagem, persona, preset | O item inteiro |
| Lorebook | As configurações dele e a lista das entradas |
| Entrada de lorebook | A entrada e o lorebook a que ela pertence |
| Skill | As instruções da sua skill. Uma skill integrada abre como o guia dela para aquela mensagem. |
| Lembrança | O texto completo da lembrança, mesmo quando ela está desativada |
| Chat | Os detalhes do chat e as 30 mensagens mais recentes |
| Agente | As configurações do agente |
| Página da documentação | A página inteira desta documentação |

Um vínculo é enviado uma única vez, com a mensagem em que você o adiciona. Depois disso, ela vê uma nota de uma linha e lê o item de novo se precisar. Uma mensagem leva até 8 vínculos. Se eles somarem mais de cerca de um quarto do contexto do modelo, no máximo 60.000 caracteres, os últimos não são enviados. No lugar deles, ela recebe uma nota e pode lê-los por conta própria. Itens vinculados contam como informação, nunca como instruções.

<a id="commands-with-"></a>

### Comandos com /

Digite `/` no início de uma linha para listar os comandos dela. Continue digitando para filtrar e pressione <kbd>Enter</kbd>. A lista também mostra as suas Skills e Memories. Escolher um desses itens o vincula, igual ao `@`.

| Comando | O que faz |
| --- | --- |
| `/new` | Inicia um chat novo e salva o atual (`/restart` também funciona) |
| `/history` | Abre os seus chats anteriores com ela |
| `/skills` | Abre o painel **Skills** |
| `/memories` | Abre o painel **Memories** |
| `/context` | Mostra o que está anexado a este chat |
| `/attach` | Escolhe arquivos ou fotos para enviar |
| `/model` | Escolhe a conta que ela usa |
| `/permissions` | Escolhe o que ela pode alterar |
| `/approvals` | Abre as mudanças que esperam por você (só enquanto houver uma pendente) |

<a id="sending-messages-while-she-works"></a>

## Enviar mensagens enquanto ela trabalha

A caixa de mensagem continua aberta enquanto ela trabalha. Você escolhe quando a sua mensagem chega até ela.

- **Send now** (enviar agora) entra no próximo passo dela, sem interrompê-la. A resposta dela até ali é salva, a sua mensagem aparece abaixo dela, e ela continua tendo a sua mensagem em mente.
- **Send after her answer** (enviar depois da resposta dela) espera em uma lista acima da caixa, marcada com **Sends when she finishes** (envia quando ela terminar). Quando ela termina sem problemas, pega as mensagens em espera uma de cada vez.

- **Enter sends** ligado (o padrão): <kbd>Enter</kbd> envia agora. <kbd>Ctrl</kbd>+<kbd>Enter</kbd> coloca na fila.
- **Enter sends** desligado: <kbd>Ctrl</kbd>+<kbd>Enter</kbd> envia agora. <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>Enter</kbd> coloca na fila.

No Mac, use <kbd>⌘</kbd> no lugar de <kbd>Ctrl</kbd>. Enquanto ela trabalha, uma caixa de mensagem vazia mostra só um botão **Stop** (parar), que cancela a tarefa atual. Quando você digita, **Stop** vira o botão de enviar. Clique nele para escolher **Send now** ou **Send after her answer**, o que ajuda no celular.

Send now serve só para texto. Uma mensagem com arquivos, links `@` ou um campo que você entregou a ela vai para a fila. O mesmo acontece com uma mensagem sobre outro assunto, ou com uma enviada depois de você mudar o modo de permissões. Um aviso curto informa isso. Clique no **X** de uma mensagem para removê-la. Um chat pode ter até 20 mensagens em espera.

As mensagens em espera não são enviadas por conta própria nestes casos:

- **Você pressiona Stop.** Elas voltam para a caixa de mensagem.
- **Ela está esperando por você** (uma aprovação ou uma resposta), **a execução falhou ou o aplicativo foi reiniciado.** Elas mostram **Held** (retida), com um botão **Send** (enviar). **Send** envia só aquela mensagem.

`/restart` e `/title` não fazem nada enquanto ela trabalha. Eles ficam na caixa até ela terminar.

Em um trabalho mais longo, ela mantém uma lista de tarefas abaixo da última mensagem dela, com uma contagem como **2 of 5**. Você não pode editá-la. Depois que você escreve uma mensagem nova, a lista aparece esmaecida como **Plan from before your last message** (plano de antes da sua última mensagem).

## Encontrar os seus chats com a Professor Mari

Os chats dela ficam separados da sua lista normal de chats.

1. Clique em **Chats** no cabeçalho dela.
2. Use **Search Prof. Mari chats** (buscar nos chats da Professor Mari) para encontrar um. Clique em um chat para abri-lo, renomeá-lo ou excluí-lo.

Clique em **New chat** ou digite `/new` para começar do zero. Antes, o chat atual é salvo, e aparece **Professor Mari's previous chat was saved.**

## Quick answers in Search

As respostas rápidas ficam desativadas até você ligar **Quick answers in Search** (respostas rápidas na busca) em **Search and Professor Mari settings**. Quando você digita uma pergunta na busca e nenhum resultado corresponde, ela escreve uma resposta curta, somente leitura, em um card **Quick answer · Read-only** (resposta rápida · somente leitura).

- A resposta tem até três frases tiradas da documentação do Marinara, cita as páginas que usou e não altera nada. Durante cinco minutos, a mesma pergunta usa uma cópia salva.
- Abaixo da resposta ficam **Copy** (copiar), **Answer again** (responder de novo) e **Continue with Prof. Mari** (continuar com a Professor Mari). Este último abre a janela dela em um chat novo com o nome da sua pergunta.
- **Wait after typing** (espera depois de digitar) define quanto tempo a busca espera. **Answer with** (responder com) escolhe quem responde: um modelo que você baixou, **Same as Prof. Mari** (igual à Professor Mari) ou outra conta. Cada resposta é uma única requisição curta, então uma conta paga pode gerar custos.
- Se uma resposta falhar, o card diz o motivo. **Choose a model** (escolher um modelo) só aparece quando falta uma chave ou um modelo. A mensagem do próprio serviço fica em **Details** (detalhes).

## Referência: configurações, skills e lembranças

### Linha de status e pílula da barra superior

Você pode fechar a janela dela enquanto ela trabalha. Uma linha fina na borda inferior da barra superior oscila enquanto ela trabalha, fica verde quando ela termina, dourada enquanto uma aprovação espera e vermelha se a última execução falhou. Enquanto a janela dela está fechada, uma pílula na barra superior mostra **Working** (trabalhando), **Needs you** (precisa de você), **Done** (pronto) ou **Failed** (falhou). Clique na pílula para voltar ao chat dela.

### Aparência

Em **Search and Professor Mari settings → Appearance** (configurações da busca e da Professor Mari → aparência), escolha um visual, como **Basic**, **Prof. Mari loves Dottore** ou **Safari Prof. Mari**. Ele aparece no chat dela, na busca, na tela inicial e na barra superior. Alguns visuais são desbloqueados depois de tempo suficiente de jogo, e um visual bloqueado mostra quantas horas você já jogou até agora.

### Skills

A Skill é um documento curto de instruções que muda a forma como ela trata um certo tipo de pedido.

1. Clique em **Skills** no cabeçalho dela. O painel **Professor Mari skills** (skills da Professor Mari) se abre.
2. Clique em **New** (novo) para começar a partir de um modelo pronto, ou em **Upload** (enviar) para adicionar um arquivo `.md` ou `.txt`.
3. Selecione uma Skill para editar os campos **Name**, **Description** e **Instructions** e clique em **Save** (salvar). Clique em **Delete** para removê-la.

Desative uma Skill para mantê-la sem usá-la. Sem nenhuma Skill, o painel mostra **No custom skills yet** (ainda não há skills personalizadas).

As skills integradas aparecem em **Always on** (sempre ativas), com a marca **Built-in** (integrada). São os guias dela para personagens, lorebooks, presets, temas, extensões, widgets da tela inicial e mais. Elas são somente leitura, e uma atualização do aplicativo as substitui. Para mudar uma, copie o texto dela para uma nova Skill sua.

### Lembranças

Uma lembrança é uma preferência fixa que ela guarda, como o jeito que você prefere definir as chaves das entradas de lorebook. Peça a ela ("lembre que eu sempre uso o nome do personagem como chave das entradas") ou abra **Memories** no cabeçalho dela para criar, editar, ativar ou desativar e excluir lembranças, ou use **Upload** para enviar um arquivo de texto.

- Uma lembrança que ela salva começa desativada. O card de mudança oferece **Turn on** (ativar). Ela só salva uma lembrança quando você pede, nunca porque algo que ela leu mandou.
- A cada turno, ela vê só um índice curto das suas lembranças ativadas e lê o texto completo quando uma delas é relevante. Uma lembrança **Persistent** (persistente) fica diante dela em todo turno, então mantenha poucas assim, e curtas.
- As lembranças têm prioridade sobre os hábitos padrão dela quando há conflito.

## Status de confiança e de recuperação

Abra **Context** no cabeçalho dela para ver o que vai junto com a sua próxima mensagem, o que fica neste chat e como ela trabalha: o modelo, o orçamento de contexto e se o terminal dela roda em ambiente isolado (sandbox). O cabeçalho também mostra as aprovações pendentes, as Skills e as Memories. **Context** não concede acesso extra.

Quando um pedido falha, o chat guarda o motivo e mostra **Retry** (tentar novamente) quando você pode enviá-lo de novo. Antes, corrija o problema indicado de conta, de ambiente isolado ou de acesso. Se a sua pergunta não foi salva, ela volta para a caixa de mensagem com os arquivos dela. **Retry** e **Retry with another model** (tentar novamente com outro modelo) então enviam o que está na caixa.

## Ler o FAQ

Clique no favorito **FAQ**, ou em **Read FAQ** (ler o FAQ) no widget **Learn the engine** (conhecer o Engine), para abrir o **Professor Mari's FAQ** (FAQ da Professor Mari). É uma lista fixa já escrita, não o chat com a IA, então ela não conhece a sua configuração. Digite em **Search FAQ** (buscar no FAQ) para filtrar. Cada pergunta tem uma tag de categoria, como **Setup**, **Connections** ou **Game Mode**. Toque em uma pergunta para ler a resposta.

## Limites e segurança

- Ela não garante que o conhecimento embutido dela corresponde à versão do seu aplicativo. Para qualquer coisa que dependa da versão, confie nos guias e nas notas de versão.
- Criar conteúdo novo costuma ser seguro. Editar conteúdo que já existe pede mais cuidado. Diga o item e o campo exatos: "deixe a saudação da Luna mais curta e mantenha a personalidade dela" é mais seguro que "reescreva este personagem".
- Se ela disser que terminou e o aplicativo não mostrar o resultado, confie no aplicativo e termine a tarefa no painel correspondente.
- Quando você acessa Marinara de outro dispositivo, as ações de edição dela exigem o acesso remoto configurado. Veja [Acesso remoto: login e lista de IPs permitidos](../REMOTE_ACCESS.md).

## Solução de problemas

| Sintoma | Solução |
| --- | --- |
| Nenhuma resposta | Confira a conta mostrada em **Context** ou escolha uma com o botão de conexão. Se não houver nenhuma, adicione uma em **Connections**. |
| A lista **Connections** abre quando você pressiona enviar | Nenhuma conta foi escolhida. Escolha uma ou clique em **Add a connection**. |
| Um encaminhamento trouxe o item errado | Remova o item de contexto, troque para o chat certo da Professor Mari e abra o encaminhamento de novo a partir do lugar de origem. |
| Um resultado não aparece em um editor | Clique em **Open** no card do resultado. A lista de itens podia estar desatualizada. |
| Um pedido falha | Leia a falha, corrija o problema indicado e clique em **Retry**. |
| Ela não consegue ler a sua imagem | Troque para uma conta cujo modelo aceite imagens na entrada. |
| As consultas ao Fandom falham | Elas precisam de conexão com a internet. |
| Ações bloqueadas com erro de permissão | Você acessa Marinara pela rede. Configure o acesso remoto antes. |

## Referência para usuários avançados

Estas partes são para quem edita os próprios arquivos do Marinara ou quer ajustar a forma como ela trabalha. Você pode pulá-las.

### Ambiente de execução

Em **Runtime** (ambiente de execução), você pode escolher **Pi (experimental)**, o padrão, ou **Classic** (clássico). Pi é um modo em que ela pensa mais antes de agir e leva tarefas mais longas até o fim. Se a sua conta não conseguir rodar o Pi, ela usa o Classic. A mudança vale a partir da próxima resposta dela, e o Undo funciona igual nos dois. Se ela se comportar de forma estranha no Pi, troque para o Classic.

**Read the handbook before the first write** (ler o guia antes da primeira alteração), também em **Runtime**, vem ativado por padrão. A primeira mudança dela em uma área com uma skill integrada é recusada até que ela leia essa skill. Isso ajuda modelos menores. Só você pode desligar essa opção.

### O que ela alcança no seu computador

Ela pode ler e alterar os próprios arquivos de programa do Marinara e rodar comandos em ambiente isolado, para conseguir consertar o aplicativo. Quase ninguém precisa disso.

- As ferramentas de arquivo dela ficam dentro da pasta onde Marinara está instalado. Os comandos de terminal diretos não conseguem ler os seus outros arquivos pessoais, não têm acesso à rede e não herdam segredos do servidor.
- O `.env`, o arquivo de chave que protege as suas chaves de API salvas e os arquivos internos do Git ficam fora do alcance dela.
- Ela não consegue escrever direto na sua pasta de dados, onde ficam os seus personagens e chats. Ela usa o fluxo de mudanças revisáveis descrito acima.
- Manifestos de dependência, arquivos de lock, inicializadores, instaladores e fluxos de CI ficam separados, esperando antes a sua aprovação. Os scripts de instalação de pacotes continuam desativados.
- Os comandos param sozinhos depois de pouco tempo.
- Se Marinara não conseguir oferecer o ambiente isolado de terminal do macOS ou do Linux, os comandos de terminal diretos e o `mari code check` ficam desativados. Ela ainda pode usar as ferramentas estruturadas de arquivo e de dados do aplicativo.

<a id="held-changes-for-files-and-libraries"></a>

### Mudanças retidas em arquivos e bibliotecas

- **Sensitive files** (arquivos sensíveis: arquivos de dependência, inicializadores, instaladores, fluxos de CI) mostram o caminho e o conteúdo novo, com **Apply change** (aplicar a mudança) e **Discard** (descartar).
- **Dependencies** (dependências) mostram o pacote do npm, a versão exata e a integridade do registro, com **Install** (instalar) e **Not now** (agora não). Os comandos de instalação ficam bloqueados no terminal dela. Aprovar uma biblioteca significa confiar no código dela quando Marinara executar esse código.

### Como ela lida com Decisions

Um modelo de decisão é um modelo pequeno que responde a perguntas de sim ou não. Para as **Activation questions** (perguntas de ativação) dos agentes, as declarações **Decision** dos lorebooks e os prompts condicionais, ela verifica antes qual modelo de decisão você escolheu.

- Ela pergunta antes de acrescentar conteúdo de Decision e, sem um modelo de decisão, mantém o trabalho novo sem Decisions, a menos que você peça.
- Ela prefere usar poucas decisões, com um controle de tempo: **Sticky** ou **Cooldown** para entradas de lorebook, **Trigger Cadence** para a ativação de agentes e `sticky`, `cooldown` ou `every` em condições de prompt.
- Ela pergunta antes de acrescentar conteúdo que muda no início de um prompt ou dentro do histórico do chat, para que o começo do prompt continue estável para o cache de prompt do serviço.
- Diga a ela "Stop reminding me to set up a Decision model" para parar os lembretes.

Veja [Modelos de decisão](../connections/decision-models.md), [Prompts condicionais](../prompts/conditional-prompts.md), [Agentes personalizados](../agents/custom-agents.md#activation-questions) e [Entradas de lorebook](../lorebooks/entries.md#decision-activation).

### O comando mari

Uma mudança feita com o comando `mari` em um terminal não pertence a nenhum chat, então o card de mudança dela aparece em todos os chats da Professor Mari.

## Guias relacionados

- [Primeiros passos com Marinara Engine](welcome.md)
- [O tutorial da primeira vez](tutorial.md)
- [Conectando a um provedor de IA](../connections/connecting-to-a-provider.md)
- [Criando e editando personagens](../characters/creating-and-editing-characters.md)
- [Referência dos agentes para download](../agents/built-in-agents.md)
- [Acesso remoto: login e lista de IPs permitidos](../REMOTE_ACCESS.md)
