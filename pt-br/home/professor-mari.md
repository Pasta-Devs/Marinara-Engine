# Professor Mari, a assistente dentro do aplicativo

Professor Mari é a assistente que já vem no Marinara Engine, na tela inicial. Neste guia você vê onde encontrar a Professor Mari, o que ela faz, como as mudanças dela podem ser desfeitas e como resolver os problemas mais comuns.

## Onde encontrar a Professor Mari

Professor Mari fica na tela inicial. A tela inicial é o que aparece quando nenhum chat está aberto.

Procure o card com o desenho em pixel art dela e o título **Professor Mari**. Uma linha de status mostra **Ready to help** quando ela está parada, ou **Working on it...** enquanto ela trabalha. Clique no botão **Ask Professor Mari** (falar com a Professor Mari) para abrir a janela de chat completa.

A conversa é em linguagem comum. Digite uma mensagem na caixa e pressione Enter para enviar. Pressione Shift e Enter juntos para quebrar a linha em vez de enviar.

A primeira mensagem enviada para ela desbloqueia a conquista **Hello World**.

O **indicador de presença da Professor Mari**, o chat normal com a personagem Professor Mari e o chat da área de trabalho da tela inicial usam o mesmo formato de encaminhamento.

## O que ela faz

Professor Mari é bem mais que uma caixa de perguntas. Ela explica o aplicativo, ajuda na configuração inicial e cria coisas quando você pede.

Peça ajuda a ela em qualquer um destes casos:

- Explicar uma configuração, um modo ou um conceito antes de você mudar qualquer coisa.
- Criar ou editar um personagem. O personagem é um card que dá nome, personalidade e voz à IA.
- Criar ou editar uma persona. A persona é a identidade que você interpreta no chat, o "você" da história.
- Criar ou editar um lorebook. O lorebook é um conjunto de anotações do seu mundo que a IA usa quando fazem sentido.
- Criar ou editar um tema, um agente, um preset de prompt ou um rascunho de Personal Extension. Professor Mari é a única autora de extensões que já vem no aplicativo. Os rascunhos dela ficam desativados até você inspecionar o código em ambiente isolado (sandbox), revisar as permissões ativas de card de personagem ou de persona que forem pedidas e aprovar o hash exato em **Settings** (Configurações) > **Addons**.
- Editar uma parte específica de um preset de prompt, sem mexer no resto. Ela lista as seções, os grupos de prompt e as variáveis de escolha do preset, lê qualquer um desses itens por inteiro e acrescenta, altera ou remove só aquele pedaço. É possível, por exemplo, acrescentar uma linha em uma seção específica, em vez de só criar ou substituir o preset inteiro.
- Comparar os 33 agentes e pacotes de recursos oficiais disponíveis para download, explicar quais modos cada um atende e indicar o que combina com o objetivo do usuário. Ela diferencia o que existe no catálogo do que está realmente instalado, encaminha o usuário para **Agents → Download Agents** quando é o caso, e sabe que os pacotes e o catálogo completo estão em [Pasta-Devs/Marinara-Agents](https://github.com/Pasta-Devs/Marinara-Agents).
- Gerar ou atribuir imagens, como avatares, sprites e planos de fundo. O sprite é a imagem do personagem, um retrato ou uma pose de corpo inteiro, que aparece durante o chat.
- Consultar páginas públicas de wikis do Fandom para pesquisar um personagem ou um mundo.
- Conduzir uma criação ou edição de várias etapas pelas sugestões rápidas acima da caixa de mensagem, com cores diferentes para cada tipo de item.

Ela lê um item antes de editar e pergunta o que falta quando o pedido está vago. Para tarefas com imagem, é preciso ter antes uma conexão de geração de imagens funcionando. Ela não cria essa conexão para você.

## Sugestões guiadas

Em um chat vazio da Professor Mari, sugestões iniciais como **Create a Character**, **Create a Lorebook** e **Create a Persona** ajudam a começar as tarefas mais comuns. Durante uma criação ou edição guiada, as sugestões mudam de acordo com a próxima etapa. Ao clicar em uma sugestão, o texto vai para a caixa de mensagem; edite esse rascunho antes de enviar.

Os fluxos guiados fazem uma pergunta objetiva por vez, em vez de mostrar um formulário longo de uma só vez.

## Ela também lê e edita os arquivos do próprio aplicativo

Professor Mari consegue olhar dentro dos arquivos de programa do Marinara, alterá-los e rodar comandos em ambiente isolado. Esse poder é real, então vale entender bem como funciona.

Veja o limite de confiança em palavras simples:

- As ferramentas de arquivo dela ficam dentro da pasta onde Marinara está instalado. Os comandos de terminal diretos leem o espaço de trabalho e os programas de sistema necessários, mas não leem os seus outros arquivos pessoais.
- Arquivos com segredos de ambiente, como o arquivo `.env` e os arquivos internos do Git, ficam fora do alcance das ferramentas de arquivo e do terminal direto.
- Ela não escreve direto na pasta dos seus dados salvos, onde ficam os personagens e os chats. No lugar disso, ela usa o fluxo de revisão descrito abaixo.
- Os comandos de terminal diretos não têm acesso à rede, não herdam segredos do servidor e só escrevem arquivos comuns do espaço de trabalho e uma pasta temporária privada.
- Ela continua editando os arquivos de código normais direto. Já as mudanças em manifestos de dependência, arquivos de lock, inicializadores, instaladores e fluxos de CI ficam separadas e são mostradas a você antes que Marinara aplique.
- Se uma mudança de código precisa de uma biblioteca pública do npm, ela pede um pacote específico. Marinara converte `latest` em uma versão exata, mostra a integridade do registro em um card de revisão e só instala depois da sua aprovação. Os scripts de ciclo de vida do pacote continuam desativados.
- Se Marinara não conseguir oferecer o ambiente isolado de terminal do macOS ou do Linux, os comandos de terminal diretos ficam desativados. Ela ainda usa as ferramentas mais seguras de arquivo e de dados do aplicativo.
- Os comandos que ela roda param sozinhos depois de pouco tempo, então um comando travado não roda para sempre.

Quase ninguém precisa disso. O recurso existe para ela inspecionar ou consertar o próprio aplicativo quando algo quebra.

## Escolher uma conexão

Professor Mari precisa de uma conexão para pensar. A conexão liga Marinara a um provedor de IA por meio de uma chave de API. A chave de API é um código secreto desse provedor.

Clique no ícone de link ao lado do clipe de papel para abrir o menu suspenso **Connections** (Conexões). Escolha qualquer conexão de geração de texto já configurada. Se você baixou o modelo local que vem no aplicativo, ele também aparece aqui como **Local Model (sidecar)**. Quando o aplicativo conhece o nome do modelo, esse nome aparece entre parênteses. A escolha fica guardada no navegador.

Se ainda não houver nenhuma conexão, o menu suspenso mostra **Add a connection**. Se você tentar enviar uma mensagem sem conexão, o painel **Connections** abre sozinho. Aparece também esta mensagem na tela (chamada de toast):

> You haven't set up a connection yet! Click the link icon beside the paperclip to select one.

O passo a passo completo está no guia de conexão indicado no fim da página.

## Anexar arquivos

Clique no botão do clipe de papel, chamado **Attach files** (anexar arquivos), para adicionar um arquivo à mensagem.

Ela aceita imagens, arquivos PDF e arquivos de texto comuns, como `.txt`, `.md`, `.json`, `.csv` e `.log`. Cada arquivo pode ter até 20 MB. Os arquivos anexados aparecem acima da caixa de mensagem antes do envio e podem ser removidos.

Para ela conseguir ler uma imagem, o modelo da conexão escolhida precisa aceitar imagens na entrada.

## Revisar as mudanças dela

Quando Professor Mari edita algo que já existe, ela salva a mudança na hora e depois mostra um card de revisão. Com isso, você desfaz o resultado caso não goste.

O card se chama **Review Mari's changes**. Ele mostra o que ela fez e quais dados foram afetados. São dois botões:

- **Keep** (manter) confirma a mudança. Aparece a mensagem "Kept Mari's workspace change."
- **Restore** (restaurar) traz de volta a versão salva anterior. Aparece a mensagem "Restored the previous app data snapshot."

Alguns pontos importantes:

- Itens novos em folha, como um personagem ou um lorebook recém-criado, costumam pular essa etapa. Nada existente foi sobrescrito, então não há o que desfazer.
- O card de revisão expira sozinho depois de 10 minutos se você não responder.
- Personagens e personas também guardam o próprio histórico de versões dentro dos editores. Ali você restaura uma versão antiga, como uma segunda rede de proteção.

Dois tipos de mudança de risco mais alto ficam esperando em vez de serem aplicados de cara:

- **Sensitive file changes** (mudanças em arquivos sensíveis) mostram o caminho e o conteúdo proposto, com os botões **Apply change** e **Discard**. Isso vale para arquivos de dependência, inicializadores, instaladores e fluxos de CI. As edições comuns de TypeScript, React, CSS, prompt, rota e documentação continuam liberadas sem essa trava extra.
- **Dependencies** (dependências) mostram o pacote público exato do npm, a versão, o espaço de trabalho de destino, o tipo de dependência, a integridade do registro e as dependências diretas declaradas, com os botões **Install** e **Not now**. Os comandos de instalação diretos com `npm`, `pnpm`, `yarn`, `pip` e parecidos ficam bloqueados no terminal dela, inclusive as instalações a partir do cache.

Aprovar uma biblioteca significa confiar no código dela quando Marinara importar ou executar esse código mais tarde. Desativar os scripts de ciclo de vida evita a execução durante a instalação, mas não torna a biblioteca inofensiva depois, em tempo de execução.

## Skills personalizadas

A Skill é um documento curto de instruções que você escreve para mudar a forma como a Professor Mari trata um certo tipo de pedido.

Clique no botão **Skills** no cabeçalho do chat dela para abrir o painel **Professor Mari Skills**. Ali você pode:

- Clicar em **New** para começar uma Skill a partir de um modelo pronto.
- Clicar em **Upload** para adicionar uma Skill de um arquivo `.md` ou `.txt`.
- Ativar ou desativar cada Skill. Uma Skill desativada continua existindo, mas não é usada.
- Selecionar uma Skill para editar os campos **Name**, **Description** e **Instructions** e clicar em **Save**. Clique em **Delete** para excluir a Skill.

Enquanto não houver nenhuma Skill, o painel mostra **No custom skills yet**.

## Lembranças salvas

Professor Mari guarda as suas preferências fixas, para você não repeti-las a cada conversa: o formato que você prefere nos lorebooks ou nos cards de personagem, as suas convenções de nomes, ou o jeito como ela deve se comportar.

Existem duas formas de dar uma lembrança a ela:

- **Conte para ela.** Diga algo como "lembre que eu sempre uso o nome e o apelido do personagem como chaves das entradas de lorebook". Ela salva a informação e mostra um card de revisão **Keep/Restore** com o texto exato. Toda lembrança que ela salva começa **desativada**, então nada muda até você ativá-la. O card traz um terceiro botão, **Keep & Enable** (manter e ativar), para salvar e ativar na hora.
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

No celular ou em telas estreitas, ela vira um avatar redondo pequeno que você arrasta pela tela. Toque nele para abrir o chat completo de novo. Em telas largas, aparece uma janelinha **Ask Professor Mari** que também pode ser arrastada. As duas versões têm um controle para dispensar a bolha pelo resto da sessão.

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

- Nenhuma resposta: verifique se há uma conexão selecionada no ícone de link. Se não houver nenhuma configurada, abra o painel **Connections** e adicione uma.
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
