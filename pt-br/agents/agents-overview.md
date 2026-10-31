# Agentes: ajudantes de IA para os seus chats

Este guia explica o que são os agentes no Marinara Engine, como baixar cada um, quando eles rodam e como ativá-los em um chat. Aqui você vê o painel **Agents** (Agentes), o catálogo oficial, as configurações de cada chat e como perceber que um agente rodou. O catálogo oficial completo está nos guias relacionados, no fim da página.

## O que são os agentes

Os agentes são pequenos ajudantes de IA que rodam automaticamente em volta da resposta principal do chat. Eles fazem tarefas bem específicas enquanto você conversa com o personagem. Um agente pode acompanhar a hora e o clima ou escolher a expressão do personagem, por exemplo. Outro reescreve a resposta para tirar palavras repetidas. Outros geram uma imagem para um momento importante.

Os agentes são ativados por chat, não por personagem. O card de personagem não tem botão liga/desliga de agentes. Dois chats com o mesmo personagem podem rodar agentes completamente diferentes. Você escolhe quais agentes rodam nas configurações de cada chat.

Uma instalação nova do Marinara Engine começa sem nenhum agente opcional. Isso deixa o aplicativo base e a instalação no Termux menores. **Agent Organizer** (organizador de agentes) é a loja dos pacotes oficiais instalados com um clique. A Home mostra agentes em destaque, kits iniciais e seções, e cada agente tem uma página própria com capturas de tela e instruções de uso. O catálogo inclui Long-Term Memory, World Maps, Calls, Inventory Tracker e os seis jogos de Conversation. O código-fonte, os manifestos, os arquivos para download e o catálogo do repositório são públicos em [Pasta-Devs/Marinara-Agents](https://github.com/Pasta-Devs/Marinara-Agents). O guia completo de cada agente está em [Referência dos agentes para download](built-in-agents.md). Para criar o seu, veja [Como criar agentes personalizados](custom-agents.md).

## As três fases

Cada agente roda em um de três pontos em volta da resposta. Esse ponto se chama **pipeline phase** (a fase do agente na pipeline). Você define isso no editor do agente, e cada agente oficial já vem com um valor adequado.

- **Pre-Generation**: roda antes de a IA escrever a resposta. Pode acrescentar contexto útil ao prompt (o texto que Marinara envia para a IA) antes disso. Os agentes de consulta de conhecimento rodam aqui.
- **Parallel**: roda ao mesmo tempo que a resposta. Não espera pela resposta e não pode alterá-la. Um agente de reação da plateia ao vivo roda aqui.
- **Post-Processing**: roda depois que a resposta termina. Pode ler a resposta e, no caso dos agentes de reescrita, editá-la. A maioria dos trackers, o agente de limpeza da prosa e o agente de imagens rodam aqui.

## O painel **Agents**

Abra o painel **Agents** pelas abas do painel lateral direito (o ícone de estrelinhas). Ali você navega, cria e organiza agentes. Essa é a sua biblioteca. Não é o liga/desliga de um chat específico.

Clique em **Agent Organizer (organizador de agentes)**, no topo, para abrir o catálogo oficial em tela cheia. Ele funciona no computador e no celular. A **Home** (início) mostra agentes em destaque e uma prateleira para cada seção, como **Apps**, **Chat games**, **Writing help** e **Trackers**. **Updates** (atualizações) lista os agentes instalados que têm uma versão mais nova, e **Installed** (instalados) lista tudo o que você tem, com a versão e o tamanho. A busca e o filtro de modo restringem todas as listas. Selecione um agente para abrir a página dele: descrição, tipo de recurso compatível, tamanho do download, permissões, compatibilidade de versão e documentação. Clique em **Get** (obter) para adicioná-lo; a mesma página permite atualizar manualmente, e o menu **⋯** traz **Uninstall** para os pacotes que você já tem. Quando o pacote publica notas de versão, a seção **Version history** (histórico de versões) lista o que mudou em cada versão. O menu **⋯** ao lado do título traz **Update all** (atualizar tudo), **Install all**, **Refresh catalog** e **Uninstall all**.

O catálogo dentro do aplicativo vem do [repositório público Marinara-Agents](https://github.com/Pasta-Devs/Marinara-Agents). Você pode inspecionar cada pacote e cada arquivo por lá, mas o normal é instalar pela tela **Agent Organizer (organizador de agentes)**, para que Marinara valide compatibilidade, permissões, hashes, conteúdo do pacote e necessidade de reinício.

O catálogo traz os agentes de chat oficiais, o World Maps, as chamadas de áudio e vídeo do Conversation e todos os jogos opcionais do Conversation. Os agentes instalados ficam agrupados em **Apps**, **Writer Agents**, **Tracker Agents** e **Misc Agents**, mais uma seção **Custom Agents** para os que você cria. Os **Apps** são pacotes com uma aba própria da Home, como Noodle e Slurp, que você usa de forma independente, em vez de adicioná-los a um chat. Desinstalar um pacote do catálogo remove o código e as configurações dele da Engine, mas preserva as mensagens e o histórico do chat. Excluir um agente personalizado é definitivo.

O catálogo traz os agentes de chat oficiais, o World Maps, as chamadas de áudio e vídeo do Conversation e todos os jogos opcionais do Conversation. Os agentes instalados ficam agrupados em **Apps**, **Writer Agents**, **Tracker Agents** e **Misc Agents**, mais uma seção **Custom Agents** para os que você cria. Os **Apps** são pacotes com uma aba própria da Home, como Noodle e Slurp, que você usa de forma independente, em vez de adicioná-los a um chat. Um pacote marcado **Rules** fornece um conjunto de regras de Game Mode, como 5e (SRD 5.1), e não um agente. Escolha-o em **Rules** ao criar uma partida; veja [Jogar com um conjunto de regras](../game/rulesets.md). Não há controle de ativação por chat. O pacote 5e é uma prévia e aparece apenas no catálogo do Engine na branch `staging`. Desinstalar um pacote do catálogo remove o código e as configurações dele do Engine, mas preserva as mensagens e o histórico do chat. Excluir um agente personalizado é definitivo.

Ao atualizar de uma versão da Engine que já trazia esses recursos embutidos, Marinara baixa os pacotes correspondentes uma vez e preserva as escolhas de agentes nos chats, as configurações dos agentes, os dados de runtime salvos e o histórico. Se essa migração não conseguir acessar o catálogo, ela tenta de novo na inicialização seguinte, em vez de descartar qualquer coisa.

<a id="updating-packages"></a>

### Como atualizar pacotes

Marinara pergunta antes de atualizar um pacote. Quando há uma versão compatível mais nova de um pacote que você instalou, aparece a janela **Agent updates available** (atualizações de agentes disponíveis). Ela lista cada atualização com a nova versão e informa se é preciso reiniciar. Todas as atualizações vêm selecionadas; desmarque a caixa das que você quer pular. Quando o pacote publica notas de versão, **What's new** (novidades) mostra essas notas. Se a atualização pula versões, lista as notas de todas as versões desde a sua, da mais nova para a mais antiga. Uma nota longa aparece cortada; selecione **More** (mais) para ler a nota inteira. Um ponto marca uma mudança que você vai perceber; as atualizações sem ponto são correções de rotina. **See in Agent Organizer** (ver no organizador de agentes) abre a página do agente.

- Clique em **Update all** (ou **Update 2 of 3**, quando você desmarcou algumas caixas) para instalar as atualizações selecionadas. Cada linha passa a mostrar **Updated** (atualizado) ou **Failed** (falhou). Uma linha com falha mostra o motivo e um botão **Retry** (tentar novamente). Quando uma atualização precisa de reinício, clique em **Restart now** (reiniciar agora) ou reinicie o Marinara Engine depois.
- Clique em **Not now** (agora não) para manter as versões atuais. As atualizações que você desmarcou também contam como **Not now**. Marinara não pergunta de novo sobre uma versão que você pulou.

Você ainda pode atualizar qualquer pacote depois, pela tela **Agent Organizer (organizador de agentes)**. Os pacotes instalados continuam funcionando na versão atual até você atualizá-los, mesmo quando o catálogo está inacessível.

As atualizações valem só para os pacotes que você já instalou. As instalações no computador, em Docker e no Android/Termux mantêm os pacotes no servidor local. Clientes em iOS, iPadOS e outros navegadores usam os pacotes instalados no servidor Marinara ao qual se conectam.

## Como ativar agentes em um chat

Os agentes são ativados dentro de cada chat, no painel lateral **Chat Settings** (configurações do chat).

1. Abra o chat que você quer.
2. Abra **Chat Settings**.
3. Encontre a seção **Agents**.
4. Ative a opção **Enable Agents** (ativar agentes). Esse é o interruptor principal. Quando ele está desligado, nenhum agente roda nesse chat.
5. Adicione os agentes que você quer nas listas abaixo do interruptor, ou remova os que não quer.

Os agentes adicionados aparecem na lista como ativos, cada um com um pequeno botão de remover.

A seção **Agents** tem mais alguns controles:

- **Agent Menus** (menus dos agentes; só em chats de Roleplay): fica logo abaixo de **Enable Agents**. Clique no nome de um agente para ir direto às configurações dele.
- **Trackers Control** (controle dos trackers; só em chats de Roleplay): um cartão que começa fechado. Clique nele para abrir estas configurações:
  - **Attach chat summaries** (anexar resumos do chat): desativado por padrão, inclusive em chats existentes sem uma escolha salva. Ative para incluir resumos salvos nas solicitações dos agentes, também no processamento após a resposta e nas novas tentativas manuais. Isso não remove os resumos do contexto da resposta principal nem interrompe a geração de resumos. Agentes com acesso explícito ao prompt principal completo ainda podem ler os resumos que ele contém.
  - **Attach Lorebooks to Trackers** (anexar lorebooks aos trackers): quando está ativado, os tracker agents também recebem as entradas de lorebook usadas na resposta principal. Aparece quando o chat tem um tracker agent.
  - **Review Agent Outputs** (revisar o que os agentes produzem): explicado no próprio item, logo depois desta lista.
  - **Individual tracker schedule** (programação individual dos trackers): ative um tracker para ele não rodar mais depois de cada resposta. Depois você aciona esse tracker na mão, por um botão no HUD. HUD quer dizer heads-up display, a faixa de status que aparece sobre a tela no Roleplay. Aparece quando o chat tem um tracker agent.
- **Review Agent Outputs**: quando está ativado, as mudanças em lorebooks, resumos e cards de personagem esperam a sua aprovação antes de serem salvas. Quando está desativado, as mudanças em lorebooks e resumos podem ser salvas sozinhas, mas as edições no card de personagem continuam pedindo a sua confirmação. Veja [Aprovações de agentes e o Agent Suite](approvals-and-agent-suite.md). Nos chats de Roleplay, essa opção fica dentro de **Trackers Control**.
- **Agent Suite**: abre um visualizador onde você lê e edita tudo o que os agentes salvaram nesse chat.

<a id="a-reference-lorebook-for-one-agent"></a>

### Um lorebook de referência para um agente

Em **Chat Settings**, abra **Agents** e depois as configurações do agente de escrita, de rastreamento ou personalizado. **Attach lorebook for the specific agent** (anexar lorebook para este agente) começa desligado. Ligue para mostrar **Reference lorebook** (lorebook de referência) e escolher um livro. A seleção pertence a este agente neste chat; não muda a definição global do agente nem outros chats.

Recursos de pacotes baixáveis, como World Maps, também precisam da atualização correspondente do pacote junto com a atualização do Engine.

As entradas correspondentes seguem as regras normais de ativação de lorebooks e são fornecidas como contexto de referência para esse agente, inclusive nas novas tentativas manuais. Anexar o livro não o ativa para a resposta principal nem para outros agentes. Agentes executados juntos também podem ver as mesmas entradas de referência. Desligar a opção interrompe o envio das entradas; livros indisponíveis ou excluídos não fornecem nenhuma. As configurações de fontes que já existem nos agentes personalizados continuam disponíveis de forma independente.

Mensagens antigas ou importadas podem não ter informações suficientes para distinguir uma resposta em grupo de uma continuação; nesses casos, os gatilhos usam um fallback conservador.

### O aviso de custo

Os agentes custam tokens extras (o token é um pedacinho de texto) e chamadas extras ao modelo. Cada agente acrescenta as próprias instruções e, muitas vezes, a própria chamada ao modelo. Marinara junta em uma única chamada os agentes que usam a mesma conexão, quando isso é possível. Acima da lista de agentes, um indicador estima a carga da configuração atual. Ele mostra mais ou menos quantos tokens de instruções de agente você acrescentou e quantas chamadas extras acontecem por turno.

Clique ou toque no ícone de ajuda ao lado do indicador para abrir a explicação no computador ou no celular. Esse indicador fica âmbar, com um ícone de aviso, quando a carga fica pesada. O custo real por turno é maior do que o número mostrado. O histórico do chat e os detalhes do personagem vão junto em cada chamada. Se o aviso aparecer, remova os agentes de que você não precisa ou mova alguns para uma conexão mais barata ou local. O limite de mensagens recentes só controla as mensagens do chat; instruções dos agentes, detalhes dos personagens e resumos anexados são contexto adicional. Um **Reasoning Effort** (esforço de raciocínio) salvo na conexão também se aplica aos agentes que a usam, então um nível alto torna cada chamada deles mais lenta e cara. Veja [Parâmetros para agentes](../prompts/generation-parameters.md#parameters-for-agents).

## Com quais agentes cada modo começa

Uma instalação nova começa sem nenhum agente opcional instalado ou ativo. Cada modo de chat mostra apenas os pacotes compatíveis que você tem instalados.

- **Roleplay**: instale os agentes de Roleplay pelo catálogo e depois adicione-os em Chat Settings. O World Maps aparece ali como qualquer outro agente compatível.
- **Conversation**: instale o Calls ou jogos de mesa avulsos pelo catálogo. Os jogos aparecem no seletor de jogos e registram os comandos de barra deles; as chamadas acrescentam a barra de ferramentas própria e controles em Chat Settings.
- **Game Mode**: os agentes compatíveis com Game que você instalou podem ser selecionados durante a criação do jogo ou adicionados depois. O World Maps só contribui com a área de trabalho de mapas e a visão do mapa-múndi quando está ativo naquele jogo.

Agentes compatíveis podem ser adicionados ou removidos a qualquer momento.

## Como saber se um agente rodou

Alguns agentes mudam algo que você vê na hora. Outros trabalham em silêncio. Veja como conferir.

- Os tracker agents escrevem no HUD e nos painéis de tracker. Se a hora, o local, o humor ou os status mudaram, um tracker rodou.
- **Agent activity** (atividade dos agentes), em **Chat Settings**, lista notas curtas dos agentes. Enquanto eles trabalham, o ícone vira um indicador giratório, e aparece um ponto nele quando um agente falha. Veja [Agent activity](../roleplay/getting-started.md#agent-activity).
- Os agentes **Prose Guardian** e **Continuity Checker** mudam o próprio texto da resposta. Uma resposta mais limpa ou corrigida é sinal de que eles rodaram.
- Para ver o rastro completo, ative o **Debug mode** (modo de depuração) em **Settings** (Configurações), depois **Advanced**, depois **Message Tools**. Ele registra o prompt e a resposta de cada agente no console do servidor. Também mostra uma sobreposição **Agent Debug** com as chamadas, os tokens e o tempo de cada agente.

Um agente que você esperava não rodou? Verifique se a opção **Enable Agents** está ativada. Verifique se o agente está ativo nesse chat. Verifique se o modo do chat permite esse agente.

## Guias relacionados

- [Referência dos agentes para download](built-in-agents.md)
- [Avatares 2D e 3D](avatars.md)
- [Repositório oficial Marinara Agents](https://github.com/Pasta-Devs/Marinara-Agents)
- [Como criar agentes personalizados](custom-agents.md)
- [Aprovações de agentes e o Agent Suite](approvals-and-agent-suite.md)
- [HUD e trackers do Roleplay](../roleplay/hud-and-trackers.md)
