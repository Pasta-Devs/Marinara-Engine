# Professor Mari, a assistente dentro do aplicativo

Professor Mari é a assistente que já vem no Marinara Engine, na tela inicial. Neste guia você vê onde encontrar a Professor Mari, o que ela faz, como as mudanças dela podem ser desfeitas e como resolver os problemas mais comuns.

## Onde encontrar a Professor Mari

Professor Mari fica na tela inicial. A tela inicial é o que aparece quando nenhum chat está aberto.

Procure o card com o desenho em pixel art dela e o título **Professor Mari**. Uma linha de status mostra **Ready to help** quando ela está parada, ou **Working on it...** enquanto ela trabalha. Clique no botão **Ask Prof. Mari** (falar com a Professor Mari) para abrir a janela de chat completa.

A conversa é em linguagem comum. Digite uma mensagem na caixa e pressione Enter para enviar. Pressione Shift e Enter juntos para quebrar a linha em vez de enviar.

A primeira mensagem enviada para ela desbloqueia a conquista **Hello World**.

Uma linha fina na borda inferior da barra superior do aplicativo também mostra o estado dela, em qualquer tela: a linha oscila enquanto ela trabalha, fica verde quando ela termina, dourada enquanto uma aprovação espera e vermelha se a última execução falhou. A linha some quando você abre o chat dela. (A linha fica desligada enquanto a opção **Ask Professor Mari from Search** (falar com a Professor Mari pela busca) estiver desativada.) Todas as opções dela ficam nas configurações da busca e da Professor Mari: a engrenagem da busca, ou **Settings** (Configurações) > **General** > **Search and Professor Mari settings** > **Open** (abrir).

## Falar com a Professor Mari a partir do que você está fazendo

Professor Mari é bem mais que uma caixa de perguntas. Ela explica o aplicativo, ajuda na configuração inicial e cria coisas quando você pede.

Você pode abrir a Professor Mari no lugar onde precisa de ajuda. Esses pontos de entrada criam um rascunho editável e anexam um pequeno resumo de contexto, identificado pelo tipo. O contexto anexado pode ser removido antes de você enviar a mensagem.

- Editores de **Character**, **Persona**, **Lorebook** e **Preset**: pergunte sobre o recurso aberto ou sobre um campo selecionado.
- Respostas do **FAQ**: use **Ask Prof. Mari** para incluir a pergunta encontrada e a resposta escrita como ponto de partida.
- **Search** (busca): pressione `Cmd/Ctrl+K`, selecione um resultado e use **Ask Prof. Mari** para incluir o resultado selecionado no rascunho. A busca não envia sozinha nenhuma requisição ao modelo, a menos que uma resposta rápida esteja ativada (veja **Quick answers in Search** abaixo).
- **Recent Chats** (chats recentes) e outros estados de erro: use **Ask Prof. Mari** ao lado de **Retry** (tentar novamente) para enviar a descrição do erro e a ação de reparo pedida.
- O chat normal com a personagem Professor Mari e o chat do espaço de trabalho da tela inicial usam o mesmo formato de encaminhamento.

Os itens anexados aparecem como chips **Aware of** (ciente de) acima da caixa de mensagem dela. Remova um item de contexto quando ele não for relevante. Depois que você envia a mensagem, a Professor Mari obtém no servidor o conteúdo mais extenso do recurso, dentro do orçamento de contexto. Ela não recebe um recurso inteiro só porque você abriu um editor.

Peça ajuda a ela em qualquer um destes casos:

- Explicar uma configuração, um modo ou um conceito antes de você mudar qualquer coisa.
- Criar ou editar um personagem. O personagem é um card que dá nome, personalidade e voz à IA.
- Criar ou editar uma persona. A persona é a identidade que você interpreta no chat, o "você" da história.
- Criar ou editar um lorebook. O lorebook é um conjunto de anotações do seu mundo que a IA usa quando fazem sentido.
- Criar ou editar um tema, um agente, um preset de prompt ou um rascunho de Personal Extension. Professor Mari é a única autora de extensões que já vem no aplicativo. Os rascunhos dela ficam desativados até você inspecionar o código em ambiente isolado (sandbox), revisar as permissões ativas de card de personagem ou de persona que forem pedidas e aprovar o hash exato em **Settings** > **Addons**.
- Editar uma parte específica de um preset de prompt, sem mexer no resto. Ela lista as seções, os grupos de prompt e as variáveis de escolha do preset, lê qualquer um desses itens por inteiro e acrescenta, altera ou remove só aquele pedaço. É possível, por exemplo, acrescentar uma linha em uma seção específica, em vez de só criar ou substituir o preset inteiro.
- Comparar os 33 agentes e pacotes de recursos oficiais disponíveis para download, explicar quais modos cada um atende e indicar o que combina com o objetivo do usuário. Ela diferencia o que existe no catálogo do que está realmente instalado, encaminha o usuário para **Agents → Download Agents** quando é o caso, e sabe que os pacotes e o catálogo completo estão em [Pasta-Devs/Marinara-Agents](https://github.com/Pasta-Devs/Marinara-Agents).
- Gerar ou atribuir imagens, como avatares, sprites e planos de fundo. O sprite é a imagem do personagem, um retrato ou uma pose de corpo inteiro, que aparece durante o chat.
- Consultar páginas públicas de wikis do Fandom para pesquisar um personagem ou um mundo.
- Conduzir uma criação ou edição de várias etapas pelas sugestões rápidas acima da caixa de mensagem, com cores diferentes para cada tipo de item.

Ela lê um item antes de editar e pergunta o que falta quando o pedido está vago. Para tarefas com imagem, é preciso ter antes uma conexão de geração de imagens funcionando. Ela não cria essa conexão para você.

## Quick answers in Search

Quando você digita uma pergunta na busca e nenhum resultado corresponde, a Professor Mari pode escrever uma resposta curta. A resposta aparece como um card **Quick answer · Read-only** (resposta rápida · somente leitura) abaixo da linha **Ask Prof. Mari**.

- Uma resposta rápida tem até três frases tiradas da documentação do Marinara. A Professor Mari vê apenas o que você digitou, e a resposta não altera nada.
- O card cita as páginas da documentação que usou. Durante cinco minutos, repetir a mesma pergunta usa uma cópia salva.
- Abaixo da resposta ficam **Copy**, **Answer again** (responder de novo) e **Continue with Prof. Mari** (continuar com a Professor Mari). **Continue with Prof. Mari** abre a janela dela em um chat novo com o nome da sua pergunta, com a resposta rápida anexada. Use **Ask Prof. Mari more…** (perguntar mais à Professor Mari) para fazer uma pergunta de acompanhamento na janela dela. As respostas rápidas não têm acompanhamento próprio.
- Uma resposta rápida espera você parar de digitar. **Wait after typing** (espera depois de digitar) define quanto tempo a busca espera.
- Escolha quem responde em **Settings** > **General** > **Search and Professor Mari settings** > **Quick answers** > **Answer with** (responder com): um modelo local que você baixou, **Same as Prof. Mari** (igual à Professor Mari: a conexão que ela usa) ou outra conexão. Cada resposta é uma única requisição curta. Uma conexão paga pode gerar custos.
- Se uma resposta falhar, o card diz o motivo, por exemplo que o modelo não respondeu. **Try again** (tentar de novo) e **Continue with Prof. Mari** estão sempre ali. **Choose a model** (escolher um modelo) só aparece quando falta uma chave ou um modelo. A mensagem do próprio provedor fica em **Details** (detalhes).
- As respostas rápidas ficam desativadas até você ativá-las com **Quick answers in Search** (respostas rápidas na busca), no mesmo grupo.

## Sugestões guiadas

Em um chat vazio da Professor Mari, sugestões iniciais como **Create a Character**, **Create a Lorebook** e **Create a Persona** ajudam a começar as tarefas mais comuns. Durante uma criação ou edição guiada, as sugestões mudam de acordo com a próxima etapa. Ao clicar em uma sugestão, o texto vai para a caixa de mensagem; edite esse rascunho antes de enviar.

Os fluxos guiados fazem uma pergunta objetiva por vez, em vez de mostrar um formulário longo de uma só vez.

Para um pedido completo de criação ou edição, a Professor Mari pode devolver um plano guiado de tamanho limitado. Cada etapa tem um pequeno conjunto de sugestões. Escolher uma delas preenche o rascunho atual e avança o plano localmente. O seu texto continua no rascunho quando você troca de sugestão. O plano pertence ao chat atual da Professor Mari, então trocar de chat, recomeçar, interromper uma execução ou concluir o plano limpa as etapas desatualizadas. Sugestões malformadas ou em excesso são descartadas, e as sugestões ficam desativadas enquanto a Professor Mari trabalha.

As sugestões só existem nos chats da Professor Mari. Outros personagens não recebem as sugestões da Professor Mari.

## Ela também lê e edita os arquivos do próprio aplicativo

Professor Mari consegue olhar dentro dos arquivos de programa do Marinara, alterá-los e rodar comandos em ambiente isolado. Esse poder é real, então vale entender bem como funciona.

Veja o limite de confiança em palavras simples:

- As ferramentas de arquivo dela ficam dentro da pasta onde Marinara está instalado. Os comandos de terminal diretos leem o espaço de trabalho e os programas de sistema necessários, mas não leem os seus outros arquivos pessoais.
- Arquivos com segredos de ambiente, como o arquivo `.env`, o arquivo de chave que protege as suas chaves de API salvas e os arquivos internos do Git, ficam fora do alcance das ferramentas de arquivo e do terminal direto.
- Ela não escreve direto na pasta dos seus dados salvos, onde ficam os personagens e os chats, usando as ferramentas de arquivo ou o terminal direto. No lugar disso, ela usa o fluxo de revisão descrito abaixo.
- Os comandos de terminal diretos não têm acesso à rede, não herdam segredos do servidor e só escrevem arquivos comuns do espaço de trabalho e uma pasta temporária privada.
- Ela continua editando os arquivos de código normais direto. Já as mudanças em manifestos de dependência, arquivos de lock, inicializadores, instaladores e fluxos de CI ficam separadas e são mostradas a você antes que Marinara aplique.
- Ela pode ler os arquivos compilados do Marinara, as pastas `dist` de onde o aplicativo roda, mas não pode criar, editar, mover nem excluir esses arquivos. No lugar disso, ela altera os arquivos de código-fonte. Só o comando `mari code check` gera de novo os arquivos compilados, dentro do mesmo ambiente isolado.
- Se uma mudança de código precisa de uma biblioteca pública do npm, ela pede um pacote específico. Marinara converte `latest` em uma versão exata, mostra a integridade do registro em um card de revisão e só instala depois da sua aprovação. Os scripts de ciclo de vida do pacote continuam desativados.
- Se Marinara não conseguir oferecer o ambiente isolado de terminal do macOS ou do Linux, os comandos de terminal diretos e o `mari code check` ficam desativados. Ela ainda usa as ferramentas mais seguras de arquivo e de dados do aplicativo.
- Os comandos que ela roda param sozinhos depois de pouco tempo, então um comando travado não roda para sempre.

Quase ninguém precisa disso. O recurso existe para ela inspecionar ou consertar o próprio aplicativo quando algo quebra.

## Escolher uma conexão

Professor Mari precisa de uma conexão para pensar. A conexão liga Marinara a um provedor de IA por meio de uma chave de API. A chave de API é um código secreto desse provedor.

Clique no ícone de link ao lado do clipe de papel para abrir o menu suspenso **Connections** (Conexões). Escolha qualquer conexão de geração de texto já configurada. Se você baixou o modelo local que vem no aplicativo, ele também aparece aqui como **Local Model (sidecar)**. Quando o aplicativo conhece o nome do modelo, esse nome aparece entre parênteses. A escolha fica guardada no navegador.

Se ainda não houver nenhuma conexão, o menu suspenso mostra **Add a connection**. Se você tentar enviar uma mensagem sem conexão, o painel **Connections** abre sozinho. Aparece também esta mensagem na tela (chamada de toast):

> You haven't set up a connection yet! Click the link icon beside the paperclip to select one.

O passo a passo completo está no guia de conexão indicado no fim da página.

## Experimentar o ambiente de execução Pi (experimental)

A Professor Mari pode trabalhar de duas formas. **Classic** (clássico) é o padrão. **Pi** é um teste que a deixa pensar mais antes de agir e levar tarefas mais longas até o fim.

Para trocar, abra **Search and Professor Mari settings** e mude **Runtime** (ambiente de execução), abaixo de **Permissions mode** (modo de permissões). A mudança vale a partir da próxima resposta dela. Seu modo de permissões, os cards de mudança e o Undo funcionam igual nos dois.

O Pi funciona com todas as conexões, inclusive o modelo local. Se a Professor Mari se comportar de forma estranha no Pi, volte para o Classic.

## Anexar arquivos

Clique no botão do clipe de papel, chamado **Attach files** (anexar arquivos), para adicionar um arquivo à mensagem.

Ela aceita imagens, arquivos PDF e arquivos de texto comuns, como `.txt`, `.md`, `.json`, `.csv` e `.log`. Cada arquivo pode ter até 20 MB. Os arquivos anexados aparecem acima da caixa de mensagem antes do envio e podem ser removidos.

Para ela conseguir ler uma imagem, o modelo da conexão escolhida precisa aceitar imagens na entrada.

## Revisar as mudanças dela

Quando a Professor Mari muda alguma coisa, ela salva a mudança na hora e mostra um card de mudança abaixo da resposta. O card lista cada campo que mudou. Uma edição de texto mostra as palavras antigas e as novas, e um lorebook mostra as entradas dele. Abra **Show all** (mostrar tudo) para ver todos os campos. **Technical details** (detalhes técnicos) mostra o comando bruto.

O card tem uma ação:

- **Undo** (desfazer) traz de volta a versão salva anterior. Toda mudança pode ser desfeita, em qualquer modo de permissões. O modo de permissões só decide se ela pergunta antes.
- Uma mudança que não foi salva mostra **Not saved** (não salva) e o motivo. **Try again** pede a ela de novo.
- O card só mostra **Undo until** (desfazer até) nas últimas 24 horas. Uma cópia para desfazer dura até 14 dias, e só as 50 mais recentes são mantidas. Depois disso, a mudança fica e o card mostra **Undo closed** (não dá mais para desfazer).

Uma mudança que espera por você é diferente. Uma mudança retida (no modo Manual, ou uma mudança em um arquivo sensível ou em uma dependência) mostra **Apply** (aplicar) e **Don't apply** (não aplicar). Uma exclusão mostra **Delete** (excluir) e **Put back** (pôr de volta). A busca não lista as mudanças dela: abra a Professor Mari para ver, aplicar ou desfazer as mudanças.

- O card pertence ao chat da Professor Mari em que ela fez a alteração. Um chat novo começa sem os cards dos outros chats. Excluir um chat mantém suas alterações e remove seus cards. Uma alteração feita com o comando `mari` no terminal não pertence a nenhum chat, por isso seu card aparece em todos os chats da Professor Mari.
- Uma edição que deixaria tudo igual não é salva e não recebe card.
- Professor Mari não pode editar nem excluir o próprio card de personagem. Marinara o redefine para a versão integrada a cada inicialização.
- Personagens e personas também guardam o próprio histórico de versões dentro dos editores. Ali você restaura uma versão antiga, como uma segunda rede de proteção.

Quando a Professor Mari cria ou atualiza um personagem, uma persona, um lorebook ou um preset, o resultado pode mostrar **Open**. Use esse botão para abrir exatamente esse recurso depois que o aplicativo atualizar os dados. Um resultado atualizado também pode mostrar **Review** (revisar) quando há uma revisão pendente. **Review** abre os controles da mudança pendente. Itens novos normalmente não têm revisão, porque nenhum item existente foi sobrescrito.

Dois tipos de mudança de risco mais alto ficam esperando em vez de serem aplicados de cara:

- **Sensitive file changes** (mudanças em arquivos sensíveis) mostram o caminho e o conteúdo proposto, com os botões **Apply change** e **Discard**. Isso vale para arquivos de dependência, inicializadores, instaladores e fluxos de CI. As edições comuns de TypeScript, React, CSS, prompt, rota e documentação continuam liberadas sem essa trava extra.
- **Dependencies** (dependências) mostram o pacote público exato do npm, a versão, o espaço de trabalho de destino, o tipo de dependência, a integridade do registro e as dependências diretas declaradas, com os botões **Install** e **Not now**. Os comandos de instalação diretos com `npm`, `pnpm`, `yarn`, `pip` e parecidos ficam bloqueados no terminal dela, inclusive as instalações a partir do cache.

Aprovar uma biblioteca significa confiar no código dela quando Marinara importar ou executar esse código mais tarde. Desativar os scripts de ciclo de vida evita a execução durante a instalação, mas não torna a biblioteca inofensiva depois, em tempo de execução.

## Criar conteúdo com Decisions

Professor Mari pode escrever **Activation questions** (perguntas de ativação) para agentes, declarações **Decision** em entradas de lorebook e prompts condicionais em presets, cards, lorebooks e prompts de agentes. Ela verifica o Decision model selecionado antes de introduzir esses recursos. Um modelo selecionado informa a configuração; não prova que o provedor esteja acessível ou que um modelo local carregará corretamente.

Sem Decision model selecionado, ela mantém criações e edições comuns sem novas dependências de Decision. Conteúdo Decision existente permanece intacto em edições não relacionadas. Se você pedir explicitamente esse conteúdo, ela explica o comportamento alternativo e pergunta uma vez naquele chat da Professor Mari se deve continuar. O registro persiste ao reabrir o chat e em conversas maiores que a janela recente. Uma pergunta sem resposta ou uma recusa não é permissão.

Você pode dizer: **"Stop reminding me to set up a Decision model."** Ela para no chat atual e pode salvar a preferência como Memory. Use **Turn on** (ativar) para valer também em chats futuros. Desativar ou excluir essa Memory remove a preferência permanente. Suprimir lembretes de configuração não autoriza acrescentar Decisions a pedidos comuns.

Com um modelo selecionado, ela segue suas Memories e Skills pertinentes ativadas. Se elas não definem preferência de criação, pergunta se você quer usar Decisions e se deve lembrar a resposta. Você pode permitir, recusar ou aprovar apenas a tarefa atual. Uma Skill que só explica a sintaxe não vale como permissão. Um pedido direto como "add Decision activation to this entry" já autoriza essa tarefa.

O padrão é usar poucas decisões com um controle de tempo adequado: **Sticky** ou **Cooldown** para lorebooks, **Trigger Cadence** para ativação de agentes e `sticky`, `cooldown` ou `every` em condições de prompt. Sticky e Cooldown reduzem verificações repetidas após ativação positiva; não impedem repetições enquanto a declaração responde não. `every` pula verificações entre turnos programados e vale não nesses intervalos, então nem sempre serve para eventos breves.

Professor Mari também tenta manter estável o início do prompt montado. Pergunta antes de adicionar conteúdo variável no início ou contexto dentro do histórico, salvo quando suas instruções ou preferências ativadas já permitem esse posicionamento. Não existe regra universal de "seguro depois de 1.000 tokens": a reutilização depende do provedor, modelo e prefixo renderizado correspondente. Aprovar Decisions não aprova automaticamente esses posicionamentos.

Os controles normais do modo de permissões e de revisão continuam valendo. Memories salvas começam desativadas até você ativá-las. Para saber o que cada recurso Decision vê, seus comportamentos alternativos e exemplos, veja [Modelos de decisão](../connections/decision-models.md), [Prompts condicionais](../prompts/conditional-prompts.md), [Agentes personalizados](../agents/custom-agents.md#activation-questions) e [Entradas de lorebook](../lorebooks/entries.md#decision-activation).

## Skills personalizadas

A Skill é um documento curto de instruções que você escreve para mudar a forma como a Professor Mari trata um certo tipo de pedido.

Clique no botão **Skills** no cabeçalho do chat dela para abrir o painel **Professor Mari skills**. Ali você pode:

- Clicar em **New** para começar uma Skill a partir de um modelo pronto.
- Clicar em **Upload** para adicionar uma Skill de um arquivo `.md` ou `.txt`.
- Ativar ou desativar cada Skill. Uma Skill desativada continua existindo, mas não é usada.
- Selecionar uma Skill para editar os campos **Name**, **Description** e **Instructions** e clicar em **Save**. Clique em **Delete** para excluir a Skill.

Enquanto não houver nenhuma Skill, o painel mostra **No custom skills yet**.

## Lembranças salvas

Professor Mari guarda as suas preferências fixas, para você não repeti-las a cada conversa: o formato que você prefere nos lorebooks ou nos cards de personagem, as suas convenções de nomes, ou o jeito como ela deve se comportar.

Existem duas formas de dar uma lembrança a ela:

- **Conte para ela.** Diga algo como "lembre que eu sempre uso o nome e o apelido do personagem como chaves das entradas de lorebook". Ela salva a informação e mostra um card de mudança com o texto exato. Toda lembrança que ela salva começa **desativada**, então nada muda até você ativá-la. O card oferece **Turn on** para ativá-la na hora.
- **Crie você mesmo.** Clique no botão **Memories** (lembranças) no cabeçalho do chat dela para abrir o painel **Memories**. Ali você cria, edita, ativa, desativa e exclui as suas lembranças. Também é possível usar o botão **Upload** para enviar um arquivo `.md` ou de texto e transformar o conteúdo dele em uma lembrança.

Ela só salva ou altera uma lembrança quando **você** pede, nunca porque algo que ela leu (um personagem, um lorebook ou um arquivo) mandou.

Como ela usa as lembranças, e por que isso continua econômico:

- A cada turno ela vê um **índice** curto das lembranças *ativadas*, só com os títulos e uma descrição de uma linha, o que custa quase nada. Quando uma lembrança tem a ver com o que você está fazendo, ela consulta o texto completo e segue o que está ali. Assim o prompt dela continua pequeno conforme você acrescenta lembranças, porque só o índice curto está sempre presente. A exceção é a lembrança marcada como **Persistent** (veja abaixo): o texto completo dela entra em todo turno, então convém ter poucas assim, e curtas. Uma lembrança desativada continua salva, mas é ignorada. Desative uma para testar outro caminho e ative de novo depois.
- As lembranças salvas **têm prioridade sobre o comportamento padrão dela** quando há conflito. Por exemplo, uma lembrança que diz "quando eu perguntar como fazer algo, apenas faça" traz de volta a edição sem perguntar e passa por cima do hábito dela de confirmar antes.
- Uma orientação rara, que precisa valer em *todo* turno, pode ser marcada como **Persistent** (persistente), para o texto completo ficar sempre diante dela. Mantenha poucas lembranças persistentes, e curtas, porque cada uma ocupa espaço no prompt dela o tempo todo. Use esse recurso só para descrever um comportamento que deve valer sempre.

Para gerenciar as lembranças, use o painel **Memories** ou peça direto a ela: "o que você lembra?", "atualize a minha lembrança de formatação de lorebook para incluir também os títulos" ou "esqueça isso".

## Histórico de chats e Restart

Professor Mari guarda os chats dela em separado. Eles não aparecem na sua lista normal de chats.

Clique no botão **Chats** no cabeçalho dela para abrir os chats salvos da Professor Mari. O painel avisa: "Restart saves the current chat here." Clique em um chat salvo para abri-lo, renomeá-lo ou excluí-lo.

Clique no botão **Restart** (recomeçar) para iniciar uma conversa nova com ela. Antes disso, o Restart salva o chat atual na lista **Chats**. Você também pode digitar `/restart` na caixa de mensagem para fazer o mesmo. Aparece a mensagem "Professor Mari's previous chat was saved."

Enquanto ela trabalha, um botão **Stop** aparece no cabeçalho. Clique nele para cancelar a tarefa atual.

## A bolha flutuante do chat

Se você deixar a janela de chat dela aberta e for para outra página, Professor Mari acompanha você como uma pequena bolha flutuante.

No celular ou em telas estreitas, ela vira um avatar redondo pequeno que você arrasta pela tela. Toque nele para abrir o chat completo de novo. Em telas largas, aparece uma janelinha **Ask Prof. Mari** que também pode ser arrastada. As duas versões têm um controle para dispensar a bolha pelo resto da sessão.

## Status de confiança e de recuperação

Abra **Aware of** no cabeçalho da Professor Mari para ver o que vai junto com a sua próxima mensagem, o que fica neste chat da Professor Mari e como ela trabalha: o modelo com que ela responde, o orçamento de contexto e se os comandos de terminal dela rodam em ambiente isolado. O cabeçalho também mostra as aprovações pendentes, as Skills e as Memories. Confira esses itens antes de um pedido quando precisar saber o que a Professor Mari pode ler.

A Professor Mari mantém as mudanças importantes no espaço de trabalho sujeitas às regras de aprovação e de revisão que o servidor já aplica. **Aware of** não concede acesso extra. As mudanças em arquivos sensíveis, as mudanças de dependências, os limites do terminal e a validação dos dados do aplicativo continuam sendo aplicados pelo servidor.

Quando um pedido falha, o histórico do chat guarda o motivo da falha e mostra **Retry** quando o pedido pode ser enviado de novo. Corrija antes o problema indicado de conexão, de ambiente isolado, de capacidade ou de acesso remoto e depois tente novamente. Uma nova tentativa nunca começa sozinha a partir de uma busca, do FAQ ou de um estado de erro. Ela continua sendo uma ação sua.

## O FAQ dela é separado do chat

Ao lado do card de chat, a tela inicial mostra um painel **FAQ**. É uma lista fixa de perguntas e respostas já escritas. Não é o chat com a IA.

Digite na caixa **Search FAQ** para filtrar as perguntas. Cada pergunta tem uma tag de categoria colorida, como **Setup**, **Connections** ou **Game Mode**. Toque em uma pergunta para ler a resposta.

Como o FAQ está escrito dentro do aplicativo, ele não conhece a sua configuração atual. Para qualquer coisa sobre os seus próprios dados ou o estado atual, use o chat.

## Limites e segurança

Professor Mari é uma ajudante, não a documentação completa. Tenha estes limites em mente:

- Ela não garante que o conhecimento embutido dela corresponde à versão exata do seu aplicativo. Quando algo depende da versão ou mudou há pouco tempo, confie primeiro nos guias e nas notas de versão.
- Criar conteúdo novo costuma ser seguro, já que nada é sobrescrito. Editar conteúdo que já existe pede mais cuidado.
- Uma dependência aprovada é código de terceiros com o mesmo acesso, em tempo de execução, que o código do Marinara que a importa. Confira o nome do pacote, a versão exata, a finalidade e a integridade mostrados no card de aprovação.
- Nas edições, diga o item exato e o campo exato que devem mudar. Um pedido como "reescreva este personagem inteiro" é mais arriscado que "deixe a saudação inicial da Luna mais curta e mantenha a personalidade dela".
- Nas criações de várias etapas, use as sugestões para responder uma pergunta objetiva por vez, em vez de tentar informar todos os campos de uma vez.
- Se ela disser que terminou uma tarefa e o aplicativo não mostrar o resultado, confie no aplicativo. Termine a tarefa você mesmo pelo painel correspondente.
- Se você acessa Marinara de outro dispositivo, e não do mesmo computador, as ações de edição dela exigem o acesso remoto configurado. Veja o guia de acesso remoto.

## Solução de problemas

- Nenhuma resposta: confira a conexão mostrada em **Aware of** ou selecione uma no ícone de link. Se não houver nenhuma configurada, abra o painel **Connections** e adicione uma.
- Um encaminhamento trouxe o item errado: remova o item de contexto, recomece ou troque para o chat certo da Professor Mari e abra o encaminhamento de novo a partir do lugar de origem. O contexto vale só para o encaminhamento e para o chat atual da Professor Mari.
- Um resultado não aparece em um editor: use **Open** no card do resultado. A Professor Mari pode ter concluído o comando enquanto a lista de recursos estava desatualizada.
- Um pedido falha: leia o status da falha, corrija o problema de configuração indicado e use **Retry**. Peça de novo à Professor Mari a partir da origem só quando o próprio contexto não estiver mais correto.
- Mensagem "You haven't set up a connection yet": escolha uma conexão no menu suspenso do ícone de link ou adicione uma antes.
- Ela não consegue ler a imagem anexada: o modelo precisa aceitar imagens na entrada. Troque para uma conexão cujo modelo enxergue imagens.
- As consultas ao Fandom falham: elas precisam de internet, porque o Fandom é um site externo.
- As ações dela são bloqueadas com erro de permissão: você está acessando Marinara pela rede, e não do mesmo computador. Configure o acesso remoto antes.

## Guias relacionados

- [Primeiros passos com Marinara Engine](welcome.md)
- [O tutorial da primeira vez](tutorial.md)
- [Conectando a um provedor de IA](../connections/connecting-to-a-provider.md)
- [Criando e editando personagens](../characters/creating-and-editing-characters.md)
- [Referência dos agentes para download](../agents/built-in-agents.md)
- [Acesso remoto: Basic Auth e lista de IPs permitidos](../REMOTE_ACCESS.md)
