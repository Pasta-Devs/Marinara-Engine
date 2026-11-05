# Referência dos agentes para download

Este guia lista os agentes oficiais da equipe do projeto em **Agents → Agent Organizer** (agentes → Organizador de agentes), por grupo. Os agentes não vêm com uma instalação nova. O código-fonte e o catálogo deles são públicos em [Pasta-Devs/Marinara-Agents](https://github.com/Pasta-Devs/Marinara-Agents). Cada entrada diz o que o agente faz, quando ele roda, onde funciona e quais são as principais configurações. Para instalar e ativar agentes, leia primeiro [Agentes: ajudantes de IA para os seus chats](agents-overview.md). As entradas marcadas como **staging only** (somente staging) ficam disponíveis para quem usa o Engine em staging; quem usa a versão estável passa a vê-las depois que o pacote é promovido.

## Como usar esta referência

Instale um agente pelo **Agent Organizer** e depois adicione-o a cada chat em que você quiser usá-lo. Os agentes são configurados por chat, e não por card de personagem. O guia [Agentes: ajudantes de IA para os seus chats](agents-overview.md) explica a instalação, a atualização, a configuração por chat e o custo.

Cada entrada traz as mesmas informações rápidas.

- **Fase** ou **Integração**: quando um agente do pipeline roda. **Pre-Generation** roda antes da resposta e pode acrescentar texto ao prompt. **Parallel** roda ao mesmo tempo que a resposta e não enxerga o texto pronto. **Post-Processing** roda depois da resposta e consegue lê-la. Alguns conseguem reescrevê-la. Já os pacotes de recurso, como World Maps, Calls e os jogos de Conversation, se encaixam na tela do chat em vez disso. Os Apps abrem na própria aba da **Home**.
- **Onde funciona**: os modos de chat que aceitam o agente. A maioria dos agentes funciona em Roleplay.
- **Configurações principais**: as configurações que você tem mais chance de mudar, no card do agente em **Chat Settings** (configurações do chat).

Um intervalo de execução faz o agente rodar uma vez a cada tantas mensagens do usuário e do assistente, em vez de rodar depois de cada mensagem. Você pode defini-lo até 100.

No Roleplay, o intervalo de execução do Illustrator é definido por chat, no card dele em **Chat Settings**. O valor da configuração do agente é o padrão para os chats que não têm um valor próprio. Illustrator também aceita **0**: ele nunca roda automaticamente e continua disponível nas ações da Gallery.

## Apps

Os Apps têm uma aba própria na **Home**. Você usa cada um de forma independente, em vez de adicioná-lo a um chat. Cada um pede para reiniciar depois da instalação.

### Noodle

Adiciona a linha do tempo pública local e opcional do Noodle, em uma aba própria da **Home**. Ele não roda no pipeline de agentes do chat.

- **Integração**: pacote de recurso com rotas locais, fluxos de geração e de mídia e agendadores em segundo plano.
- **Onde funciona**: Home, com contexto opcional trazido de chats de Conversation, Roleplay e Game.
- **Configurações principais**: instale em **Agents → Agent Organizer** e reinicie quando solicitado. Dentro do Noodle, você define as contas convidadas, as conexões de texto e de imagem, as atualizações da linha do tempo, os usuários aleatórios e a transferência de contexto para os chats.
- **Dados**: desinstalar remove a aba e interrompe os agendadores depois de reiniciar. Os seus dados do Noodle continuam guardados para uma reinstalação futura.
- **Guia completo**: [Noodle: a linha do tempo social dentro do aplicativo](noodle.md).

### Slurp

Um aplicativo social privado para os seus personagens. Transforme personagens e personas em Creators, publique fotos públicas ou bloqueadas e veja uma plateia simulada seguir, assinar, comprar, comentar e mandar mensagens. Por padrão, ele é ajustado para conteúdo adulto. É tudo faz de conta: os preços são fictícios e nenhum pagamento real acontece.

- **Integração**: App na própria aba **Slurp** da **Home**.
- **Onde funciona**: Home.
- **Configurações principais**: instale, reinicie quando solicitado e depois abra **Home → Slurp**. Para que os personagens de um chat se lembrem dos posts e das mensagens recentes do Slurp, ative **Include Slurp activity** (incluir atividade do Slurp) nas **Chat Settings** desse chat, em **Connected Chats** (chats conectados). A transferência de contexto também precisa estar ativada para esse modo de chat nas configurações do Slurp. **Slurp Settings → Autopurge** (configurações do Slurp → limpeza automática) remove mídias antigas do Slurp para economizar espaço. Vem desativado por padrão.
- **Nomes antigos**: catálogos antigos mostram o pacote como **Slurp Remastered**, ao lado do aposentado **Slurp Legacy**, que não recebe mais atualizações.
- **Guia completo**: [guia do pacote Slurp](https://github.com/Pasta-Devs/Marinara-Agents/blob/main/packages/slurp2/README.md).

### Gacha Forge

Um jogo gacha construído a partir de um mundo que você descreve: banners para girar, um elenco que o modelo escreve e desenha, capítulos de história contados por um narrador de visual novel, além de batalhas, equipamentos e eventos. Os seus lorebooks podem alimentar o mundo, mas um cenário escrito à mão já basta.

- **Integração**: App na própria aba **Gacha Forge** da **Home**.
- **Onde funciona**: Home.
- **Configurações principais**: instale, reinicie quando solicitado e depois abra **Home → Gacha Forge**. Desinstalar remove a aba depois de reiniciar.
- **Guia completo**: [guia do pacote Gacha Forge](https://github.com/Pasta-Devs/Marinara-Agents/blob/main/packages/gacha-forge/README.md).

### Modern Life Sim

Uma simulação de vida. Você vive em uma cidadezinha com o relógio correndo, com um emprego para manter, contas para pagar e energia e fome para cuidar. As pessoas ao seu redor vêm dos seus cards de personagem, e um narrador de visual novel conta as cenas que importam.

- **Integração**: App na própria aba **Life Sim** da **Home**.
- **Onde funciona**: Home.
- **Disponibilidade**: **Staging only**, com Engine **2.4.4+** (abaixo de 4.0.0). É uma versão alfa. Se uma atualização mudar algo de que um save antigo depende, o Life Sim avisa quando você abre esse save. Você pode começar uma vida nova ou continuar por sua conta e risco.
- **Configurações principais**: instale, reinicie quando solicitado e depois abra **Home → Life Sim**. Ele precisa de uma conexão de texto. Uma conexão de imagem é opcional: sem ela, os lugares mostram cartões ilustrados. Os módulos opcionais ficam desligados até você ativá-los para uma vida. O módulo **Adult** (adulto) pede que você confirme que é maior de idade.
- **Guia completo**: [guia do pacote Modern Life Sim](https://github.com/Pasta-Devs/Marinara-Agents/blob/staging/packages/modern-life-sim/README.md).

### Story Writer

Um livro que você escreve junto com o modelo. Configure a história, o elenco e os lorebooks em uma barra lateral, deixe instruções de autor em uma nota adesiva e o modelo escreve o próximo capítulo quando você pedir. Você pode clicar em qualquer parte do texto para alterá-la ou escrever o primeiro capítulo por conta própria.

- **Integração**: App na própria aba **Story Writer** da **Home**.
- **Onde funciona**: Home.
- **Disponibilidade**: precisa de uma versão do Marinara Engine mais recente que **v2.5.1** (a próxima versão ou uma compilação atual de staging).
- **Configurações principais**: instale, reinicie quando solicitado, depois abra **Home → Story Writer** e escolha uma conexão de texto na barra lateral dele. As histórias são salvas no seu servidor do Marinara. Você pode começar novas, voltar às antigas e baixá-las em Markdown ou texto simples.
- **Guia completo**: [guia do pacote Story Writer](https://github.com/Pasta-Devs/Marinara-Agents/blob/staging/packages/story-writer/README.md).

## Writer agents

Os agentes de escrita moldam a história ou o texto. Eles acrescentam orientações antes da resposta ou dão um polimento na resposta depois dela.

### Prose Guardian

Reescreve a última resposta para tirar palavras banidas e repetições sem mudar o sentido. Use para impedir que o modelo fique repetindo frases ou abusando de alguma palavra.

- **Fase**: Post-Processing.
- **Onde funciona**: Roleplay.
- **Configurações principais**: as caixas de texto **Banned Words** (padrão `ozone`), **Prefer In Writing** e **Remove From Writing**. A opção **Hold Message Until Rewrite** (ativada por padrão) esconde a resposta até a limpeza terminar. Sem ela, a resposta bruta aparece primeiro e é trocada em seguida.

### Continuity Checker

Corrige erros concretos de lógica na última resposta, como um personagem em dois lugares ao mesmo tempo ou uma linha do tempo furada. Quando encontra problemas, mostra uma lista de verificação para você escolher quais correções aplicar.

- **Fase**: Post-Processing.
- **Onde funciona**: Roleplay.
- **Configurações principais**: o botão liga/desliga **Hold Message Until Rewrite**.

### Card Evolution Auditor

Observa como um personagem muda durante o jogo e sugere edições no card desse personagem. Ele nunca edita automaticamente. Cada sugestão abre a janela **Review Character Card Updates** para você aprovar ou recusar.

- **Fase**: Post-Processing.
- **Onde funciona**: Roleplay.
- **Configurações principais**: por padrão, roda uma vez a cada 8 mensagens do usuário e do assistente. Veja [Aprovações de agentes e o Agent Suite](approvals-and-agent-suite.md).

### Narrative Director

Cria um empurrãozinho pontual na história quando você pede. Com esse agente ativo em um chat de Roleplay, aparece o botão **Push Story**. Clique nele para preparar a próxima resposta, que então avança a trama ou traz uma surpresa.

- **Fase**: Pre-Generation.
- **Onde funciona**: só em Roleplay.
- **Configurações principais**: a opção **Story Push Mode** (**Natural** avança os fios já abertos, **Random Event** acrescenta uma surpresa plausível). Ele também pode manter um arco de longo prazo escondido chamado **Secret Plot**. Veja [Narrative Director e Secret Plot](../roleplay/narrative-director.md).

### Knowledge Retrieval

Antes da resposta, verifica os lorebooks que você escolher e os arquivos que você enviar. Ele resume as partes que importam e acrescenta esse resumo ao prompt. Um lorebook é um conjunto de fatos de fundo sobre o seu mundo. É uma busca leve e não precisa de banco de dados separado.

- **Fase**: Pre-Generation.
- **Onde funciona**: Roleplay.
- **Configurações principais**: **Use chat-active lorebooks**, o seletor **Fixed Source Lorebooks** e o envio de arquivos. Não use este agente junto com o Knowledge Router, porque as funções se sobrepõem. Veja [Fontes de conhecimento](knowledge-sources.md).

### Knowledge Router

Uma alternativa mais barata ao Knowledge Retrieval. Ele lê descrições curtas das entradas do seu lorebook e acrescenta as entradas que combinam, palavra por palavra. Funciona melhor quando as entradas têm boas descrições.

- **Fase**: Pre-Generation.
- **Onde funciona**: Roleplay.
- **Configurações principais**: **Use chat-active lorebooks** e o seletor **Fixed Source Lorebooks**. Um selo de cobertura mostra a porcentagem de entradas de origem que têm descrição. Veja [Fontes de conhecimento](knowledge-sources.md).

## Tracker agents

Os trackers (agentes de acompanhamento) mantêm um registro contínuo da cena, dos personagens e dos seus atributos. **Add as Prompt Section** acrescenta ao prompt o resultado mais recente de um agente, para o modelo manter a coerência. Vem ativado por padrão em todos os trackers, exceto Expression Engine e Background.

### World State

Acompanha a data, a hora, o clima, o local e quais personagens estão presentes. Isso mantém a cena no lugar, para o modelo não esquecer onde e quando a história acontece.

- **Fase**: Post-Processing.
- **Onde funciona**: Roleplay.
- **Configurações principais**: **Add as Prompt Section** (ativado por padrão).

### Expression Engine

Lê a emoção da última resposta e escolhe, para o personagem, um sprite ou uma expressão que combine com essa emoção. O sprite é a imagem do personagem mostrada na cena. Use para a arte do personagem em pé, que muda conforme o clima da história.

- **Fase**: Post-Processing.
- **Onde funciona**: Roleplay.
- **Configurações principais**: a opção **Sprite Source** (**Expressions**, **Full-body** ou os dois), o botão liga/desliga **Expression Avatars**, o seletor **Sprite Owners** e os controles deslizantes de tamanho e opacidade. Veja [Sprites de personagem](../characters/sprites.md).

### Quest Tracker

Cuida dos objetivos das missões, da conclusão e das recompensas. Use em partidas estilo aventura, quando você quer uma lista de tarefas visível.

- **Fase**: Post-Processing.
- **Onde funciona**: Roleplay.
- **Configurações principais**: **Add as Prompt Section** (ativado por padrão).

### Background

Escolhe, entre os planos de fundo que você enviou, o melhor para a cena atual. Ele não gera imagens. Para planos de fundo de cena gerados, use o Illustrator.

- **Fase**: Post-Processing.
- **Onde funciona**: Roleplay.
- **Configurações principais**: os controles padrão de conexão e contexto do agente. Ele escolhe apenas entre imagens que já estão na sua biblioteca de planos de fundo.

### Character Tracker

Acompanha os personagens presentes, com o humor, as ações, a aparência, a roupa, os pensamentos e os atributos de cada um, como o HP. Ele também pode criar retratos para personagens novos que ainda não têm nenhum.

Um card que descreve várias pessoas, como um card de cenário com um elenco, pode ser acompanhado pessoa por pessoa. Marque cada pessoa no texto do card com um cabeçalho `[CHARACTER: Name]` ou um campo `Name:`. Cada membro mantém o próprio nome, humor, roupa, pensamentos e retrato. Eles não compartilham o retrato do card. Uma entrada antiga com o nome do card permanece até o tracker informar um membro individual para substituí-la. Personagens adicionados manualmente mantêm a identidade manual deles.

Quando um personagem volta depois de sair da cena, o tracker reutiliza as últimas estatísticas e os campos personalizados salvos dele. Personagens vinculados a cards também recebem as reservas e os atributos de RPG configurados. Em um grupo de Roleplay no modo Merged, os personagens presentes também podem definir quais cards de personagem ficam ativos na próxima resposta. Veja [Automate active characters](../chats/group-chats.md#automate-active-characters-merged-only).

- **Fase**: Post-Processing.
- **Onde funciona**: Roleplay.
- **Configurações principais**: **Add as Prompt Section** (ativado por padrão) e a configuração opcional **Auto-Generate NPC Avatars**, com seletor próprio de conexão de imagem. A opção **Include the outfit in portraits** (incluir a roupa nos retratos) vem ativada por padrão. Desative-a para desenhar os retratos só a partir da aparência.

### Beholder

Acompanha a roupa de cada personagem por parte do corpo, os itens que ele segura, ferimentos, partes do corpo ausentes, partes explicitamente descobertas e espécies não humanas. O instantâneo validado mais recente aparece na gaveta do Beholder nas **Chat Settings** do Roleplay. Ele vai para a próxima chamada de acompanhamento do Beholder e para a próxima resposta principal.

- **Fase**: Post-Processing.
- **Onde funciona**: só em Roleplay.
- **Configurações principais**: adicione em **Chat Settings → Agents → Tracker Agents** (configurações do chat → agentes → agentes de acompanhamento) e depois abra **Configure Beholder** para escolher a conexão, o modelo, o prompt, o contexto e os limites de saída. **Add as Prompt Section** vem ativado por padrão.
- **Modelo de prompt**: escolha o modelo de prompt que corresponde ao modelo por trás da conexão do Beholder. Marinara não consegue detectar o modelo, então essa escolha é manual. Uma escolha errada não é fatal, mas dá resultados piores.
  - **SOTA model — one prompt** (modelo SOTA – um prompt, padrão): uma chamada que abrange todos os campos acompanhados. Use um modelo geral forte.
  - **Beholder local model — five passes** (modelo local Beholder – cinco passagens): cinco chamadas específicas, uma por categoria acompanhada, para o extrator [Beholder](https://huggingface.co/GetBeholder/Beholder-GGUF) treinado para essa tarefa e servido no seu computador (por exemplo, `Beholder-Q8_0.gguf` por koboldcpp ou llama.cpp). Esse modelo responde uma categoria de cada vez, então o modelo de prompt único retorna um estado parcial. Ele roda offline e sem custo.
- **Origem**: adaptado de [GetBeholder/Beholder-ME](https://github.com/GetBeholder/Beholder-ME), sob a licença AGPL-3.0-only. O pacote oficial não carrega o DOM, a sondagem nem o ambiente de armazenamento local da extensão antiga.

### Persona Stats

Acompanha as barras de status da persona (o personagem que você interpreta), como Satiety, Energy e Hygiene, além das barras personalizadas que você criar. Use em partidas estilo sobrevivência ou simulação de vida.

- **Fase**: Post-Processing.
- **Onde funciona**: Roleplay.
- **Configurações principais**: **Add as Prompt Section** (ativado por padrão). Veja [Cores do personagem e status de RPG](../characters/colors-and-stats.md).

### Custom Tracker

Acompanha campos definidos por você, como moedas, contadores ou marcadores. Use quando os trackers prontos não cobrem algo de que a sua história precisa.

- **Fase**: Post-Processing.
- **Onde funciona**: Roleplay.
- **Configurações principais**: **Add as Prompt Section** (ativado por padrão).

### Inventory Tracker

Acompanha dinheiro, equipamentos em uso e itens carregados em três listas estruturadas. Nomes duplicados são mesclados, e as linhas bloqueadas continuam inalteradas nas próximas execuções do tracker.

- **Fase**: Post-Processing.
- **Onde funciona**: Roleplay.
- **Configurações principais**: **Add as Prompt Section** (ativado por padrão). O HUD e o Tracker Panel permitem editar e bloquear cada nome e quantidade.

### Quartermaster

Gerencia o inventário da persona ativa, os espaços de equipamento, as quantidades de itens, os locais de armazenamento e os trajes salvos. Ele lê a história depois das respostas e aplica as mudanças nos itens. Um painel flutuante e o Tracker Panel permitem editar o mesmo inventário manualmente. As imagens dos itens e dos trajes são opcionais.

- **Fase**: Post-Processing, com o contexto do inventário enviado às respostas seguintes.
- **Onde funciona**: Roleplay. Ele acompanha a persona ativa, não os membros do grupo nem os NPCs.
- **Disponibilidade**: requer Engine **2.4.6+**.
- **Configuração inicial**: instale e reinicie quando solicitado. Em cada chat de Roleplay, ative os agentes em **Chat Settings → Agents**, adicione Quartermaster em **Tracker Agents** e escolha a conexão de modelo dele. Abra o painel flutuante pelo botão acima do Tracker Panel.
- **Controles principais**: equipar e guardar itens, salvar trajes, restaurar o inventário ou reverter mudanças recentes do tracker e exportar ou importar a configuração de um chat. A geração de imagens usa uma conexão de imagem própria. Leia o [guia do pacote Quartermaster](https://github.com/Pasta-Devs/Marinara-Agents/blob/main/packages/quartermaster/README.md) antes de ativar a macro de aparência ou a substituição do avatar.

### Relationship Tracker

Mantém uma rede editável de relações entre os cards de personagem de um chat de Roleplay em grupo, além da visão que cada personagem tem da persona ativa. As relações são positivas, neutras, negativas ou complicadas. Os bloqueios manuais protegem as suas edições contra mudanças automáticas.

- **Fase**: Post-Processing, com o contexto das relações enviado às respostas seguintes.
- **Onde funciona**: chats de Roleplay em grupo.
- **Disponibilidade**: requer Engine **2.4.4+** (abaixo de 4.0.0).
- **Configuração inicial**: instale e reinicie quando solicitado. Em cada chat de Roleplay, ative os agentes em **Chat Settings → Agents**, adicione-o em **Tracker Agents** e escolha a conexão de modelo dele. A rede aparece no Tracker Panel. Selecione ali **All relationships** (todas as relações) ou **Scene-only relationships** (somente relações da cena) uma vez para iniciar o chat.
- **Controles principais**: **All relationships** ou **Scene-only relationships** para o contexto do prompt, **Update from History** (atualizar pelo histórico) para analisar as mensagens recentes, edição e bloqueio manuais e **Resume automatic updates** (retomar atualizações automáticas). **Context Size** (tamanho do contexto; padrão de 5 mensagens), **Presence lookback** (histórico de presença; padrão de 15) e a quantidade de mensagens da análise do histórico são controles separados. Consulte o [guia do pacote Relationship Tracker](https://github.com/Pasta-Devs/Marinara-Agents/blob/main/packages/relationship-tracker/README.md).

### Memory Nag

Mantém um cofre de memórias curto e editável para cada chat de Roleplay. Ele examina o chat em lotes, organiza as memórias por participantes atuais e anteriores e move as memórias resolvidas para uma lista Resolved que pode ser restaurada. Uma memória pode guardar uma fala curta palavra por palavra quando a formulação exata importa.

Depois de cada resposta, uma correspondência de palavras entrega ao tracker só as memórias ativas mais relevantes. O tracker decide se a cena pede um lembrete e só pode escolher entre essas memórias. Ele não pode criar uma memória nova durante a recordação.

- **Fase**: Post-Processing.
- **Onde funciona**: só em Roleplay.
- **Configurações principais**: **Vault scan connection** (padrão: a conexão do Agent), **Messages per batch** (20), **Maximum memories created per character** (10), **Maximum memories considered per character** (5) e **Maximum memories injected** (3). Use **Scan chat** para o primeiro preenchimento e **Open vault** para pesquisar, adicionar, editar, resolver, restaurar ou excluir memórias.
- **Posição no prompt**: sem um marcador do preset, os lembretes escolhidos entram na próxima resposta dentro de `<context><memory_nags>…</memory_nags></context>`. Adicione uma seção Memory Nag Agent para posicioná-los você mesmo.
- **Dados**: o cofre pertence a um único chat e continua salvo se o pacote for desativado ou desinstalado. Excluir uma memória é permanente e sempre pede confirmação antes.

### World Maps

Acrescenta à história locais aninhados e ligações espaciais. Você cria regiões, áreas, salas e ligações, se move entre os locais, e a posição atual acrescenta contexto espacial à geração. O Game Mode também ganha uma visão de mapa-múndi.

- **Integração**: pacote de recurso com interface de mapa e contexto de chat, em vez de um agente de fase de geração.
- **Onde funciona**: Roleplay e Game.
- **Configurações principais**: ative o pacote para um chat de Roleplay em **Chat Settings → Agents**, ou escolha-o quando criar um jogo e gerencie-o nas configurações desse jogo. Instalar ou remover o pacote exige reiniciar.
- **Guia completo**: [World Maps: instalação, criação e viagem](hierarchical-maps.md).

## Misc agents

Os agentes diversos acrescentam extras como imagens, música, reações do público e atualizações de card.

### Echo Chamber

Simula uma plateia ao vivo reagindo à sua cena, em um widget flutuante **Echo** na área do chat. Ele revela uma reação nova a cada 30 segundos.

- **Fase**: Parallel.
- **Onde funciona**: Roleplay.
- **Configurações principais**: escolha um estilo, como **AO3 / Wattpad**, **Twitter / Reddit**, **4chan**, **Constructive**, **Hype Squad** ou **Harbingers**. O widget tem **Re-run Echo Chamber** e **Clear messages**.

### Long-Term Memory

Extrai lembranças duradouras de resumos de chat, registros de personagem e lorebooks para um cofre do próprio pacote e, antes da resposta principal, recupera o contexto relevante. Ele tem navegação pelo cofre, importação de fontes, revisão de rascunhos pendentes e posicionamento por marcador de preset.

- **Integração**: pacote de recurso com contexto de pré-geração e interface de gerenciamento de memória.
- **Onde funciona**: Conversation, Roleplay e Game.
- **Configurações principais**: orçamento de tokens da recuperação (128-16.384), número máximo de trechos recuperados (1-100), limiar de pontuação, contexto de mensagens recentes (1-20), estilo de recuperação, pesos da busca, inclusão de lembranças já resolvidas, preâmbulo da recuperação, configurações de extração, limites de fonte, modelos de prompt, extração de palavras-chave por IA e extração no Game Mode.
- **Dados**: use os controles de backup em Memory Settings para exportar ou substituir o cofre, os rascunhos e as configurações. **Delete all data** (excluir todos os dados) remove em definitivo as lembranças, os rascunhos, a atividade e os índices, mas mantém as configurações. Desinstalar mantém o cofre para uma reinstalação futura. Instalar, atualizar ou remover o pacote exige reiniciar.
- **Compatibilidade**: Engine `2.3.5` até antes da versão `4.0.0`. Permissões: `agent-runtime`, `chat-read`, `chat-write`, `routes`, `storage`, `ui`.

### Illustrator

Cria imagens e vídeos. Ele escreve prompts visuais para os momentos importantes e os envia ao seu serviço de imagem ou de vídeo.

- **Fase**: Post-Processing.
- **Onde funciona**: Roleplay.
- **Configurações principais**: por padrão, Illustrator roda uma vez a cada 5 mensagens do usuário e do assistente. Mude isso com **Image Run Interval** (intervalo de execução de imagens) no card de cada chat de Roleplay. Os clipes automáticos usam **Video Run Interval** (intervalo de execução de vídeos) quando **Illustrator makes** está em **Pictures and clips** ou **Clips only**. Defina **Video Run Interval** como **0** para desligar os clipes automáticos. Entre as configurações estão **Prompt Model**, **Image Style**, **Attach Card Appearance** e **Send Avatar References**. Para configurar tudo, veja [Agente Illustrator](../media/illustrator-agent.md).

### Lorebook Keeper

Cria e atualiza entradas de lorebook a partir dos fatos importantes do seu chat, para as anotações do seu mundo crescerem conforme você joga.

- **Fase**: Post-Processing.
- **Onde funciona**: Roleplay. No Game Mode, uma variante de fim de sessão chamada **Game Session Keeper** faz o mesmo trabalho.
- **Configurações principais**: por padrão, roda uma vez a cada 8 mensagens do usuário e do assistente. **Target Lorebook** define para onde vão as entradas, com uma opção de escolha automática. Prompts avançados podem retornar o nome de um lorebook gravável ou um alias, como `world`, `npc`, `scene` ou `player`. Os destinos de alias ausentes são criados e vinculados ao chat. Sem destino, continua valendo o comportamento de um único lorebook.

### Combat

Cuida do combate: iniciativa, HP e ordem dos turnos. Com ele ativo, o botão **Encounter** aparece acima da caixa de mensagem.

- **Fase**: Parallel.
- **Onde funciona**: Roleplay.
- **Configurações principais**: ele inclui uma ferramenta de rolagem de dados para resolver os turnos.

### Immersive HTML

Acrescenta à última resposta elementos visuais que fazem parte do mundo da história, como um bilhete ou uma tela estilizada, sem mudar o enredo.

- **Fase**: Post-Processing.
- **Onde funciona**: só em Roleplay.
- **Configurações principais**: o botão liga/desliga **Hold Message Until Rewrite**.

### Music DJ

Lê o clima da cena e toca a música que combina. Ele pode usar Spotify, YouTube ou arquivos de áudio locais.

- **Fase**: Post-Processing.
- **Onde funciona**: Roleplay e Game.
- **Configurações principais**: a configuração **Music Player** escolhe o provedor, e cada provedor precisa da sua própria configuração. Para o passo a passo completo do Spotify, do YouTube e da música local, veja [Music DJ](../media/music.md).

### Haptic Feedback

Lê a narrativa e controla em tempo real os brinquedos íntimos conectados, via Intiface Central. O Intiface Central já precisa estar rodando, com um brinquedo conectado, antes de você ativar este agente.

- **Fase**: Post-Processing.
- **Onde funciona**: Conversation, Roleplay e Game.
- **Configurações principais**: a opção **Touch Sensitivity** (**Subtle**, **Standard** ou **Intense**) e o campo **Intiface URL**. A sensibilidade orienta as escolhas do agente sem limitar a faixa de intensidade disponível de `0.0-1.0`. Para configurar tudo, veja [Configuração do Haptic Feedback](../integrations/haptic-feedback.md).

### CYOA Choices

Acrescenta botões de escolha clicáveis, no estilo "What will you do?", depois de cada resposta, para dar aquele clima de aventura em que você decide o rumo. Cada botão guarda uma ação completa que você envia com um clique.

- **Fase**: Post-Processing.
- **Onde funciona**: Roleplay.
- **Configurações principais**: **Edit** para reescrever as opções e **Re-roll** para gerar opções novas. Ative **Add CYOA choices to the message box instead of sending them** (adicionar as escolhas CYOA à caixa de mensagem em vez de enviá-las) em **Settings → General → Input & Editing** (Configurações → Geral → Entrada e edição) para que as escolhas clicadas vão para a sua caixa de mensagem.

### Storyboard

Planeja storyboards, estáticos ou animados, a partir de trocas já concluídas do Roleplay e da narração do Game. O planejamento separado e a formatação que leva em conta o provedor preservam a ordem da história, a identidade dos personagens e o estilo escolhido nos quadros-chave e nos vídeos.

- **Integração**: pacote de agente; o Game e o Roleplay usam os modelos de prompt e as configurações dele por meio da integração do Storyboard no Engine.
- **Onde funciona**: Roleplay e Game.
- **Configurações principais**: os planejadores de imagem estática ou de animação, as conexões de imagem e de vídeo, o número de quadros-chave, a duração, o modo de exibição, o tratamento das referências de personagem, os modelos de episódio e de estilo do Roleplay e os modelos de ilustração e de vídeo do Game.
- **Compatibilidade**: Engine `2.3.5` até antes da versão `3.0.0`. Permissões: `agent-runtime`, `chat-read`, `prompt-context`, `storage`, `ui`. Não exige reiniciar.
- **Guia completo**: [Agente Storyboard: Roleplay e Game Mode](../game/storyboard.md).

### 2D Avatars

Mostra personagens e personas como avatares 2D animados, que piscam, falam e mudam de rosto a cada resposta. Um avatar é feito de sprites no estilo PNGTuber (os seus sprites de expressão, com imagens de piscada e de fala) ou de um arquivo de avatar de malha (`.mavatar`).

- **Integração**: pacote de agente. O Engine desenha os avatares. Ele não envia nenhuma solicitação extra às suas conexões de IA durante o chat.
- **Onde funciona**: Roleplay e Game, para personagens e personas.
- **Disponibilidade**: em **Agent Organizer** para todas as instalações. Exige Marinara Engine 2.5.1 ou mais recente.
- **Configurações principais**: configure cada avatar na página do agente em **Agents**. O agente também traz os prompts que criam as imagens de piscada e de fala e um avatar de malha a partir de um sprite.
- **Compatibilidade**: Engine `2.5.0` até antes da versão `4.0.0`, Capability API 1.73. Permissões: `agent-runtime`, `chat-read`, `storage`, `ui`. Não exige reiniciar.
- **Guia completo**: [Avatares 2D e 3D](avatars.md).

### 3D Avatars

Mostra personagens e personas como modelos 3D animados, que piscam, falam e mudam de rosto a cada resposta. Ele tem suporte a modelos VRM (`.vrm`, versões 0.x e 1.0) com uma animação de espera opcional (`.vrma`), modelos MMD PMX e modelos GLB e FBX com esqueleto, cujos ossos são associados pelo nome.

- **Integração**: pacote de agente. O Engine desenha os avatares. Ele não envia nenhuma solicitação extra às suas conexões de IA durante o chat.
- **Onde funciona**: Roleplay e Game, para personagens e personas.
- **Disponibilidade**: em **Agent Organizer** para todas as instalações. Exige Marinara Engine 2.5.1 ou mais recente.
- **Configurações principais**: configure cada avatar na página do agente em **Agents**.
- **Compatibilidade**: a mesma do 2D Avatars.
- **Guia completo**: [Avatares 2D e 3D](avatars.md).

### Calls

Acrescenta chamadas de áudio e de vídeo ao vivo com os personagens de Conversation: chamadas que você inicia, chamadas recebidas, transcrições só da chamada, conversão de texto em voz, entrada de microfone e clipes de vídeo do personagem.

- **Integração**: pacote de recurso do Conversation com controles na barra de ferramentas, no chat e em Chat Settings.
- **Onde funciona**: Conversation.
- **Configurações principais**: abra **Chat Settings → Agents → Calls** para ativar as chamadas e escolher o comportamento da fala, do microfone, do toque e do vídeo. Veja [Chamadas de áudio e vídeo no Conversation](../conversation/calls.md). Instalar ou remover o pacote exige reiniciar.

### UNO

Acrescenta uma mesa de UNO com as regras aplicadas automaticamente, para você e os personagens de Conversation, com regras da casa e de dois a dez jogadores.

- **Integração**: pacote de jogo do Conversation.
- **Onde funciona**: Conversation.
- **Configurações principais**: inicie pelo seletor de jogos ou com `/uno` e depois escolha os jogadores e as regras da casa. Instalar ou remover o pacote exige reiniciar.

### Chess

Acrescenta um tabuleiro de xadrez para dois jogadores, com verificação de lances legais, detecção de xeque e xeque-mate, peças capturadas e turnos do oponente feitos dentro do personagem.

- **Integração**: pacote de jogo do Conversation.
- **Onde funciona**: Conversation.
- **Configurações principais**: inicie pelo seletor de jogos ou com `/chess` e depois escolha o oponente e o seu lado. Instalar ou remover o pacote exige reiniciar.

### Poker

Acrescenta uma mesa de Texas Hold'em para dois a oito jogadores, com blinds, rodadas de aposta, side pots, showdowns e oponentes dentro do personagem.

- **Integração**: pacote de jogo do Conversation.
- **Onde funciona**: Conversation.
- **Configurações principais**: inicie pelo seletor de jogos ou com `/poker` e depois escolha os jogadores, as fichas iniciais e os blinds. Instalar ou remover o pacote exige reiniciar.

### 8-Ball Pool

Acrescenta uma mesa de sinuca para dois jogadores, com bolas lisas e listradas, mira e força da tacada, faltas, bola na mão e tacadas do oponente feitas dentro do personagem.

- **Integração**: pacote de jogo do Conversation.
- **Onde funciona**: Conversation.
- **Configurações principais**: inicie pelo seletor de jogos ou com `/8ball` e depois escolha o oponente. Instalar ou remover o pacote exige reiniciar.

### Tic-Tac-Toe

Acrescenta um tabuleiro de jogo da velha para dois jogadores, com marca escolhida ou sorteada, controle dos turnos e detecção de vitória e de empate.

- **Integração**: pacote de jogo do Conversation.
- **Onde funciona**: Conversation.
- **Configurações principais**: inicie pelo seletor de jogos ou com `/tictactoe` (atalho `/ttt`) e depois escolha o oponente e a marca. Instalar ou remover o pacote exige reiniciar.

### Rock-Paper-Scissors

Acrescenta uma partida para dois jogadores em que as duas escolhas ficam escondidas até a revelação.

- **Integração**: pacote de jogo do Conversation.
- **Onde funciona**: Conversation.
- **Configurações principais**: inicie pelo seletor de jogos ou com `/rps` e depois escolha o oponente e se a partida é melhor de três, de cinco ou de sete. Instalar ou remover o pacote exige reiniciar.

## Guias relacionados

- [Agentes: ajudantes de IA para os seus chats](agents-overview.md)
- [Agente Illustrator](../media/illustrator-agent.md)
- [Music DJ](../media/music.md)
- [Configuração do Haptic Feedback](../integrations/haptic-feedback.md)
- [Fontes de conhecimento](knowledge-sources.md)
- [Narrative Director e Secret Plot](../roleplay/narrative-director.md)
- [Chamadas de áudio e vídeo no Conversation](../conversation/calls.md)
- [Jogos de mesa no Conversation](../conversation/table-games.md)
