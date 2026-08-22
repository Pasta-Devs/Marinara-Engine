# Referência dos agentes para download

Este guia lista os 36 pacotes oficiais da equipe do projeto disponíveis em **Agents → Download Agents** (agentes → baixar agentes), organizados por categoria. Os agentes não vêm junto com uma instalação nova do Marinara Engine. O código-fonte dos pacotes, os manifestos, os artefatos e o catálogo legível por máquina ficam publicados em [Pasta-Devs/Marinara-Agents](https://github.com/Pasta-Devs/Marinara-Agents). Para cada agente, este guia explica o que ele faz, quando ele roda ou como se integra ao aplicativo, em quais modos de chat ele pode ser usado e quais são as principais configurações. Antes de instalar e ativar qualquer um, leia o guia [Agentes: ajudantes de IA para os seus chats](agents-overview.md).

## Como usar esta referência

Um agente é um pequeno ajudante de IA que roda automaticamente junto com a resposta principal do chat. Primeiro instale o agente pelo catálogo, depois ative e configure o agente por chat, e não por card de personagem. Veja o guia [Agentes: ajudantes de IA para os seus chats](agents-overview.md) para baixar, atualizar, desinstalar, configurar por chat e entender o aviso sobre custo.

Cada agente abaixo traz três informações rápidas.

- **Fase ou integração**: quando um agente comum do pipeline roda. **Pre-Generation** roda antes da resposta e pode acrescentar texto ao prompt (o texto que Marinara envia para a IA). **Parallel** roda ao mesmo tempo que a resposta e não enxerga o texto pronto. **Post-Processing** roda depois que a resposta termina e consegue lê-la (alguns também reescrevem). Já os pacotes de recurso, como Maps, Calls e os jogos de Conversation, se integram direto à tela do chat em vez de rodar como agente.
- **Onde funciona**: os modos de chat que permitem adicionar o agente. A maioria funciona em chats de **Roleplay**. Alguns funcionam em outros modos, e cada item diz quais.
- **Configurações principais**: as configurações que você tem mais chance de mexer. Defina essas opções na hora de adicionar o agente, ou depois, no card de configuração do agente em **Chat Settings** (configurações do chat).

Marinara separa os agentes em três categorias no painel **Agents**: **Writer Agents**, **Tracker Agents** e **Misc Agents**. Esta referência usa a mesma divisão.

Um intervalo de execução faz o agente rodar uma vez a cada tantas mensagens do usuário e do assistente, em vez de rodar depois de cada mensagem. O intervalo pode ser alterado na configuração do agente, até o limite de 100.

## Writer agents

Os agentes de escrita moldam a história ou o texto. Eles acrescentam orientações antes da resposta ou dão um polimento na resposta depois de pronta.

### Prose Guardian

Reescreve a última resposta para tirar palavras banidas e repetições, sem mudar o sentido. Use quando o modelo fica repetindo frases ou abusando de alguma palavra.

- **Fase**: Post-Processing.
- **Onde funciona**: Roleplay.
- **Configurações principais**: as caixas de texto **Banned Words** (o padrão é `ozone`), **Prefer In Writing** e **Remove From Writing**. O botão liga/desliga **Hold Message Until Rewrite** (ativado por padrão) esconde a resposta até a limpeza terminar. Sem ele, a resposta bruta aparece primeiro e é trocada em seguida.

### Continuity Checker

Corrige erros concretos de lógica na última resposta, como um personagem estar em dois lugares ao mesmo tempo ou uma linha do tempo furada. Quando encontra problemas, mostra tudo em forma de lista para você escolher quais correções aplicar.

- **Fase**: Post-Processing.
- **Onde funciona**: Roleplay.
- **Configurações principais**: o botão liga/desliga **Hold Message Until Rewrite**.

### Card Evolution Auditor

Observa como um personagem muda durante o jogo e sugere edições no card desse personagem. Ele nunca edita sozinho. Cada sugestão abre a janela **Review Character Card Updates** para você aprovar ou recusar.

- **Fase**: Post-Processing.
- **Onde funciona**: Roleplay.
- **Configurações principais**: por padrão, roda uma vez a cada 8 mensagens do usuário e do assistente. Veja [Aprovações de agentes e o Agent Suite](approvals-and-agent-suite.md).

### Narrative Director

Cria um empurrãozinho pontual na história, só quando você pede. Com esse agente ativo em um chat de Roleplay, o botão **Push Story** aparece acima da caixa de mensagem. Clique nele para preparar a próxima resposta, que então avança a trama ou traz uma surpresa.

- **Fase**: Pre-Generation.
- **Onde funciona**: só em Roleplay.
- **Configurações principais**: o menu suspenso **Story Push Mode** (**Natural** para avançar os fios já abertos, ou **Random Event** para acrescentar uma surpresa plausível). Ele também guarda, se você quiser, um arco de longo prazo escondido chamado **Secret Plot**. O passo a passo completo está em [Narrative Director e Secret Plot](../roleplay/narrative-director.md).

### Knowledge Retrieval

Antes da resposta, verifica os lorebooks que você escolher (um lorebook é um conjunto de fatos de fundo sobre o seu mundo e os seus personagens) e também os arquivos enviados. Ele resume as partes que importam e acrescenta esse resumo ao prompt. É uma busca leve, então não precisa de banco de dados separado.

- **Fase**: Pre-Generation.
- **Onde funciona**: Roleplay.
- **Configurações principais**: o botão liga/desliga **Use chat-active lorebooks**, o seletor **Fixed Source Lorebooks** e um campo de upload para os formatos com suporte. Não use este agente junto com o Knowledge Router, porque as funções se sobrepõem. Para configurar, veja [Fontes de conhecimento](knowledge-sources.md).

### Knowledge Router

Uma alternativa mais barata ao Knowledge Retrieval. Em vez de resumir, ele lê as descrições curtas das entradas do lorebook. Depois, acrescenta as entradas que combinam, palavra por palavra. Funciona melhor quando as entradas têm boas descrições.

- **Fase**: Pre-Generation.
- **Onde funciona**: Roleplay.
- **Configurações principais**: o botão liga/desliga **Use chat-active lorebooks** e o seletor **Fixed Source Lorebooks**. Um selo de cobertura mostra a porcentagem de entradas de origem que já têm descrição escrita. Para configurar, veja [Fontes de conhecimento](knowledge-sources.md).

## Tracker agents

Os trackers (agentes de acompanhamento) mantêm um registro contínuo da cena, dos personagens e dos seus atributos. O resultado mais recente deles pode ser acrescentado ao prompt como uma seção, o que ajuda o modelo a manter a coerência. World State, Quest Tracker, Character Tracker, Persona Stats, Custom Tracker, Inventory Tracker e Beholder já vêm com **Add as Prompt Section** ativado. Expression Engine e Background são as exceções.

### World State

Acompanha a data, a hora, o clima, o local e quais personagens estão presentes. Isso mantém a cena no lugar, para o modelo não esquecer onde e quando a história acontece.

- **Fase**: Post-Processing.
- **Onde funciona**: Roleplay.
- **Configurações principais**: **Add as Prompt Section** (ativado por padrão).

### Expression Engine

Lê a emoção da última resposta e escolhe, para o personagem, um sprite ou uma expressão que combine com essa emoção. O sprite é a imagem do personagem mostrada na cena. Use para a arte do personagem em pé, que muda conforme o clima da história.

- **Fase**: Post-Processing.
- **Onde funciona**: Roleplay.
- **Configurações principais**: o menu suspenso **Sprite Source** (**Expressions**, **Full-body** ou os dois), o botão liga/desliga **Expression Avatars**, o seletor **Sprite Owners** e os controles deslizantes de tamanho e opacidade. Veja [Sprites de personagem](../characters/sprites.md).

### Quest Tracker

Cuida dos objetivos das missões, da conclusão e das recompensas. Use em partidas estilo aventura, quando você quer uma lista de tarefas visível.

- **Fase**: Post-Processing.
- **Onde funciona**: Roleplay.
- **Configurações principais**: **Add as Prompt Section** (ativado por padrão).

### Background

Escolhe, entre os planos de fundo que você enviou, a imagem que melhor combina com a cena atual. Ele não gera imagens; para gerar planos de fundo de cena automaticamente, use o Illustrator.

- **Fase**: Post-Processing.
- **Onde funciona**: Roleplay.
- **Configurações principais**: os controles padrão de conexão e contexto do agente. A escolha do plano de fundo usa apenas imagens que já estão na sua biblioteca de planos de fundo.

### Character Tracker

Acompanha os personagens presentes, além do humor, das ações, da aparência, da roupa, dos pensamentos e dos atributos de cada um, como o HP. Ele também cria imagens de retrato para personagens novos que ainda não têm nenhuma.

Quando um personagem recorrente volta depois de sair de cena, o Character Tracker reaproveita os atributos e os campos personalizados salvos mais recentemente, para manter a continuidade. Os personagens que têm card também recebem, como base, os medidores e os atributos de RPG configurados, e sempre mantêm o avatar e o recorte do card. Os retratos gerados automaticamente continuam limitados aos NPCs (personagens não jogáveis) sem card de personagem correspondente.

- **Fase**: Post-Processing.
- **Onde funciona**: Roleplay.
- **Configurações principais**: **Add as Prompt Section** (ativado por padrão) e a configuração opcional **Auto-Generate NPC Avatars**, com seletor próprio de conexão de imagem.

### Beholder

Acompanha a roupa atual de cada personagem por parte do corpo, os itens que ele segura, ferimentos, partes do corpo ausentes, partes explicitamente descobertas e espécies não humanas. O instantâneo validado mais recente aparece na gaveta de Roleplay Chat Settings do Beholder e é enviado tanto para a próxima chamada de acompanhamento do Beholder quanto para a próxima resposta principal de Roleplay.

- **Fase**: Post-Processing.
- **Onde funciona**: somente em Roleplay.
- **Configurações principais**: adicione ou remova em **Chat Settings → Agents → Tracker Agents**; abra **Configure Beholder** no mesmo lugar para escolher conexão, modelo, prompt, contexto e limites de saída. **Add as Prompt Section** fica ativado por padrão.
- **Modelo recomendado**: use um modelo SOTA, como OpenAI GPT-5.5+, Claude Opus 4.8+ ou Kimi K3+, para acompanhar o estado completo com confiança.
- **Origem**: adaptado para o ambiente Agent nativo do Engine com base em [GetBeholder/Beholder-ME](https://github.com/GetBeholder/Beholder-ME), sob a licença AGPL-3.0-only. O pacote oficial não carrega o DOM, a sondagem nem o ambiente de armazenamento local da extensão legada.

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

Acompanha dinheiro, equipamentos em uso e itens carregados em três listas estruturadas, sem reaproveitar o inventário de Persona Stats nem comprimir os dados em textos do Custom Tracker. Nomes duplicados são mesclados, quantidades de um ficam visualmente compactas e linhas bloqueadas sobrevivem inalteradas às próximas execuções do tracker.

- **Fase**: Post-Processing (pós-processamento).
- **Onde funciona**: Roleplay.
- **Configurações principais**: **Add as Prompt Section** (ativado por padrão). O HUD e o Tracker Panel permitem editar e bloquear cada nome e quantidade.

### Memory Nag

Mantém um cofre curto e editável de memórias para cada chat de Roleplay. Ele examina a conversa em lotes com pontos de controle, organiza as memórias por personagens atuais e anteriores e move memórias claramente resolvidas para uma lista Resolved que pode ser restaurada. Uma memória pode preservar uma fala curta palavra por palavra quando a formulação exata importa.

Depois de cada resposta, uma correspondência determinística de palavras fornece ao tracker apenas as memórias ativas mais relevantes para os personagens envolvidos. O tracker decide então se a situação atual realmente pede uma lembrança e só pode escolher entre as memórias fornecidas; ele não pode criar uma nova memória durante a recordação.

- **Fase**: Post-Processing.
- **Onde funciona**: somente Roleplay.
- **Configurações principais**: uma **Vault scan connection** separada (por padrão, a conexão do Agent), **Messages per batch** (20), **Maximum memories created per character** (10), **Maximum memories considered per character** (5) e **Maximum memories injected** (3). Use **Scan chat** para a varredura inicial e **Open vault** para pesquisar, filtrar, adicionar, editar, resolver, restaurar ou excluir memórias.
- **Posição no prompt**: sem um marcador do preset, as memórias selecionadas entram na próxima resposta dentro de `<context><memory_nags>…</memory_nags></context>`. Adicione uma seção do Agent Memory Nag para posicioná-las explicitamente.
- **Ciclo de vida dos dados**: o cofre pertence a um único chat e permanece salvo se o pacote for desativado ou desinstalado, portanto uma reinstalação pode continuar do último ponto de controle. Excluir uma memória é permanente e sempre pede confirmação.

### World Maps

Acrescenta à história locais aninhados permanentes e relações espaciais. Você pode criar regiões, áreas, salas e ligações, mover-se entre os locais e deixar que a posição atual contribua com contexto espacial para a geração. O Game Mode ganha também a visão de mapa-múndi do pacote.

- **Integração**: pacote de recurso; ele acrescenta a interface de mapa e contexto de execução ao chat, em vez de rodar como um agente comum de fase de geração.
- **Onde funciona**: Roleplay e Game.
- **Configurações principais**: ative o pacote para o chat de Roleplay em **Chat Settings → Agents**, ou selecione o pacote durante a criação do Game e cuide dele depois nas configurações daquele jogo. Instalar ou remover o pacote exige reiniciar Marinara.
- **Guia completo**: [World Maps: instalação, criação e viagem](hierarchical-maps.md).

## Misc agents

Os agentes diversos acrescentam extras como imagens, música, reações do público e atualizações de card.

### Echo Chamber

Simula uma plateia ao vivo reagindo à sua cena, mostrada como um widget flutuante **Echo** na área do chat. Ele revela uma reação nova a cada 30 segundos.

- **Fase**: Parallel.
- **Onde funciona**: Roleplay.
- **Configurações principais**: você escolhe um estilo entre as opções com nome, como **AO3 / Wattpad**, **Twitter / Reddit**, **4chan**, **Constructive**, **Hype Squad** e **Harbingers**. Entre os controles do widget estão **Re-run Echo Chamber** e **Clear messages**.

### Noodle

Acrescenta um mundo social local opcional com a linha do tempo pública do Noodle e o feed de roleplay entre criadores e fãs do NoodleR. Ele abre em uma aba própria da Home, em vez de rodar no fluxo normal de agentes do chat.

- **Integração**: pacote de recursos; oferece a aba Home, rotas locais, fluxos de geração e mídia e agendadores em segundo plano.
- **Onde funciona**: Home, com contexto opcional trazido de chats de Conversation, Roleplay e Game.
- **Configurações principais**: instale em **Agents → Download Agents** e reinicie o Marinara Engine quando solicitado. Dentro do Noodle, você pode configurar contas convidadas, conexões de texto e imagem, atualizações da linha do tempo, perfis NoodleR Creator, acesso a posts simulados e atividade do público.
- **Ciclo de vida dos dados**: desinstalar remove a aba Home e interrompe as rotas e os agendadores do pacote depois da reinicialização, preservando os dados existentes do Noodle e NoodleR para uma reinstalação futura.
- **Guia completo**: [Noodle: a linha do tempo social do aplicativo](../noodle/overview.md).

### Long-Term Memory

Extrai lembranças duradouras de resumos de chat, registros de personagem e lorebooks para um cofre do próprio pacote e, antes da resposta principal, recupera o contexto relevante. Ele permite navegar pelo cofre por escopo, importar fontes, revisar rascunhos pendentes e posicionar o contexto recuperado por marcador de preset.

- **Integração**: pacote de recurso; ele acrescenta contexto de pré-geração e uma interface de gerenciamento de memória, em vez de rodar como um tracker comum de pós-processamento.
- **Onde funciona**: Conversation, Roleplay e Game.
- **Configurações principais**: ativação, orçamento de tokens da recuperação (128-16.384), número máximo de trechos recuperados (1-100), limiar de pontuação, contexto de mensagens recentes (1-20), estilo de recuperação e pesos semântico, lexical, de grafo e de palavras-chave, inclusão de lembranças já resolvidas, preâmbulo da recuperação, raciocínio e nível de detalhe da extração, limites de geração, limites de fonte, modelos de prompt, extração de palavras-chave por IA e extração no Game Mode.
- **Ciclo de vida dos dados**: use os controles de backup em Memory Settings para exportar ou substituir o cofre, os rascunhos e as configurações. A opção de excluir todos os dados remove em definitivo as lembranças, os rascunhos, a atividade e os índices derivados, mas mantém as configurações. Se você desinstalar o pacote, o cofre do Long-Term Memory continua guardado para uma reinstalação futura. Instalar, atualizar ou remover o pacote exige reiniciar Marinara.
- **Compatibilidade**: Engine `2.3.5` até antes da versão `4.0.0`. O pacote usa as permissões `agent-runtime`, `chat-read`, `chat-write`, `routes`, `storage` e `ui`.

### Illustrator

Responsável pela geração de imagens e de vídeos. Ele escreve prompts visuais para os momentos importantes e envia esses prompts para o provedor de mídia configurado.

- **Fase**: Post-Processing.
- **Onde funciona**: Roleplay.
- **Configurações principais**: por padrão, roda uma vez a cada 5 mensagens do usuário e do assistente. Entre as configurações estão **Prompt Model**, **Image Style**, **Attach Card Appearance** e **Send Avatar References**. Para configurar tudo, veja [Agente Illustrator](../media/illustrator-agent.md).

### Lorebook Keeper

Cria e atualiza entradas de lorebook a partir dos fatos importantes do seu chat, para as anotações do seu mundo crescerem conforme você joga.

- **Fase**: Post-Processing.
- **Onde funciona**: Roleplay. No Game Mode, uma variante de fim de sessão chamada **Game Session Keeper** faz o mesmo trabalho no encerramento da sessão.
- **Configurações principais**: por padrão, roda uma vez a cada 8 mensagens do usuário e do assistente. O seletor **Target Lorebook** define para onde vão as entradas, com uma opção de escolha automática. Configurações avançadas de prompt podem retornar o nome exato de um lorebook gravável ou um alias configurado, como `world`, `npc`, `scene` ou `player`; destinos de alias ausentes são criados e vinculados automaticamente ao chat atual. Omitir o destino preserva o comportamento existente de um único lorebook.

### Combat

Cuida do combate, incluindo iniciativa, HP e ordem dos turnos. Com ele ativo, o botão **Encounter** aparece acima da caixa de mensagem.

- **Fase**: Parallel.
- **Onde funciona**: Roleplay.
- **Configurações principais**: ele já vem com uma ferramenta de rolagem de dados para resolver os turnos.

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
- **Configurações principais**: **Edit** para reescrever as opções e **Re-roll** para gerar opções novas.

### Storyboard

Planeja storyboards visuais, estáticos ou animados, a partir de trocas já concluídas do Roleplay e da narração do Game. O planejamento separado e a formatação que leva em conta o provedor preservam a cronologia da origem, a identidade dos personagens e o estilo visual escolhido nos quadros-chave e nos vídeos gerados.

- **Integração**: pacote de agente; o Game e o Roleplay usam os modelos de prompt e as configurações do pacote instalado por meio da integração de host do Storyboard no Engine.
- **Onde funciona**: Roleplay e Game.
- **Configurações principais**: a escolha entre os planejadores de imagem estática ou de animação, as conexões de imagem e de vídeo, o número de quadros-chave, a duração, o modo de exibição, o tratamento das referências de personagem, os modelos de episódio e de estilo do Roleplay e os modelos de ilustração e de vídeo do Game.
- **Compatibilidade**: Engine `2.3.5` até antes da versão `3.0.0`. O pacote usa as permissões `agent-runtime`, `chat-read`, `prompt-context`, `storage` e `ui`, e não exige reiniciar Marinara.
- **Guia completo**: [Agente Storyboard: Roleplay e Game Mode](../game/storyboard.md).

### Calls

Acrescenta chamadas de áudio e de vídeo ao vivo com os personagens de Conversation, incluindo chamadas iniciadas por você e chamadas recebidas, transcrições só da chamada, conversão de texto em voz, entrada de microfone e clipes de vídeo do personagem.

- **Integração**: pacote de recurso do Conversation; ele acrescenta controles à barra de ferramentas, à tela do chat e à seção Chat Settings, em vez de rodar como um agente comum de fase de geração.
- **Onde funciona**: Conversation.
- **Configurações principais**: abra **Chat Settings → Agents → Calls** para ativar as chamadas e definir o comportamento da fala, do microfone, do toque de chamada e do vídeo. Veja [Chamadas de áudio e vídeo no Conversation Mode](../conversation/calls.md). Instalar ou remover o pacote exige reiniciar Marinara.

### UNO

Acrescenta uma mesa de UNO com as regras aplicadas automaticamente, para você e os personagens de Conversation, com regras da casa configuráveis e suporte para dois a dez jogadores no total.

- **Integração**: pacote de jogo do Conversation.
- **Onde funciona**: Conversation.
- **Configurações principais**: inicie pelo seletor de jogos ou com `/uno`; a configuração define os jogadores e as regras da casa. Instalar ou remover o pacote exige reiniciar Marinara.

### Chess

Acrescenta um tabuleiro de xadrez para dois jogadores, com validação de lances legais, detecção de xeque e xeque-mate, peças capturadas e turnos do oponente feitos dentro do personagem.

- **Integração**: pacote de jogo do Conversation.
- **Onde funciona**: Conversation.
- **Configurações principais**: inicie pelo seletor de jogos ou com `/chess` e depois escolha o oponente e de que lado você joga. Instalar ou remover o pacote exige reiniciar Marinara.

### Poker

Acrescenta uma mesa de Texas Hold'em para dois a oito jogadores no total, com blinds, rodadas de aposta, side pots, avaliação do showdown e oponentes dentro do personagem.

- **Integração**: pacote de jogo do Conversation.
- **Onde funciona**: Conversation.
- **Configurações principais**: inicie pelo seletor de jogos ou com `/poker` e depois escolha os jogadores, as fichas iniciais e os valores dos blinds. Instalar ou remover o pacote exige reiniciar Marinara.

### 8-Ball Pool

Acrescenta uma mesa de sinuca para dois jogadores, com bolas lisas e listradas, mira e força da tacada, faltas, bola na mão e tacadas do oponente feitas dentro do personagem.

- **Integração**: pacote de jogo do Conversation.
- **Onde funciona**: Conversation.
- **Configurações principais**: inicie pelo seletor de jogos ou com `/8ball` e depois escolha o oponente. Instalar ou remover o pacote exige reiniciar Marinara.

### Tic-Tac-Toe

Acrescenta um tabuleiro de jogo da velha para dois jogadores, com marca escolhida ou sorteada, controle dos turnos válidos e detecção de vitória e de empate.

- **Integração**: pacote de jogo do Conversation.
- **Onde funciona**: Conversation.
- **Configurações principais**: inicie pelo seletor de jogos ou com `/tictactoe` (atalho `/ttt`) e depois escolha o oponente e a marca. Instalar ou remover o pacote exige reiniciar Marinara.

### Rock-Paper-Scissors

Acrescenta uma partida de pedra, papel e tesoura para dois jogadores, em que as duas escolhas ficam escondidas até a revelação.

- **Integração**: pacote de jogo do Conversation.
- **Onde funciona**: Conversation.
- **Configurações principais**: inicie pelo seletor de jogos ou com `/rps` e depois escolha o oponente e se a partida é melhor de três, de cinco ou de sete. Instalar ou remover o pacote exige reiniciar Marinara.

## Guias relacionados

- [Agentes: ajudantes de IA para os seus chats](agents-overview.md)
- [Agente Illustrator](../media/illustrator-agent.md)
- [Music DJ](../media/music.md)
- [Configuração do Haptic Feedback](../integrations/haptic-feedback.md)
- [Fontes de conhecimento](knowledge-sources.md)
- [Narrative Director e Secret Plot](../roleplay/narrative-director.md)
- [Chamadas de áudio e vídeo no Conversation Mode](../conversation/calls.md)
- [Jogos de mesa no Conversation Mode](../conversation/table-games.md)
