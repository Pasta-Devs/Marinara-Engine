# Agentes: ajudantes de IA para os seus chats

Os agentes são pequenos ajudantes de IA que rodam em volta da resposta principal do chat. Um acompanha a hora e o clima, outro escolhe a expressão do personagem, outro desenha uma imagem para um momento importante. Este guia mostra como instalar agentes, ativá-los em um chat e conferir se eles rodaram.

## O que são os agentes

Os agentes são ativados por chat, não por personagem. Dois chats com o mesmo personagem podem rodar agentes diferentes.

Uma instalação nova não tem nenhum agente opcional. Instale-os pelo **Agent Organizer** (organizador de agentes), a loja dos pacotes oficiais instalados com um clique. O código-fonte e o catálogo são públicos em [Pasta-Devs/Marinara-Agents](https://github.com/Pasta-Devs/Marinara-Agents). Instale pelo **Agent Organizer**, para que Marinara possa verificar a compatibilidade, as permissões e os hashes dos arquivos. Para saber o que cada agente faz, veja [Referência dos agentes para download](built-in-agents.md). Para criar o seu, veja [Como criar agentes personalizados](custom-agents.md).

## Adicionar um agente a um chat

Antes de começar: instale o agente primeiro. Abra o painel **Agents** (o ícone de estrelinhas nas abas do lado direito), clique em **Agent Organizer**, abra a página do agente e clique em **Get** (obter). Veja [Instalar e atualizar agentes](#install-and-update-agents).

1. Abra o chat.
2. Abra **Chat Settings** (configurações do chat) e encontre a seção **Agents**.
3. Ative **Enable Agents** (ativar agentes). Esse é o botão liga/desliga principal: quando ele está desligado, nenhum agente roda neste chat.
4. Clique em **Add Agent** (adicionar agente), abra o grupo ao qual o agente pertence (como **Writer Agents** ou **Misc Agents**) e escolha-o.

Os agentes que você adicionou aparecem como ativos, cada um com um pequeno botão de remover. Você pode adicionar ou remover agentes a qualquer momento.

> **Observação:** cada modo de chat mostra só os agentes que funcionam nesse modo. No Conversation, os jogos instalados aparecem no seletor de jogos, e o **Calls** acrescenta controles à barra de ferramentas. No Game Mode, escolha os agentes ao criar o jogo ou adicione-os depois.

Se um agente não rodou, verifique se **Enable Agents** está ativado, se o agente está ativo neste chat e se o modo dele corresponde ao do seu chat.

### Mais controles na seção Agents

Estes controles ficam na mesma seção **Agents**.

- **Agent Menus** (menus dos agentes; só no Roleplay): clique no nome de um agente para ir direto às configurações dele.
- **Trackers Control** (controle dos trackers; só no Roleplay): um cartão fechado com as opções de tracker descritas abaixo.
- **Agent Suite**: abre um visualizador onde você lê e edita o que os agentes salvaram neste chat.
- **Review Agent Outputs** (revisar as saídas dos agentes): faz as mudanças em lorebooks, resumos e cards de personagem esperarem a sua aprovação. No Roleplay, essa opção fica dentro de **Trackers Control**. Veja [Aprovações de agentes e o Agent Suite](approvals-and-agent-suite.md).

Opções dentro de **Trackers Control**:

- **Attach chat summaries** (anexar resumos do chat): desativado por padrão. Acrescenta os resumos salvos do chat às solicitações dos agentes, inclusive nas novas tentativas. Não remove os resumos da resposta principal nem interrompe a geração de resumos. Agentes com acesso completo ao prompt principal ainda podem ler os resumos ali.
- **Attach Lorebooks to Trackers** (anexar lorebooks aos trackers): os agentes de tracker também recebem as entradas de lorebook usadas na resposta principal. Aparece quando o chat tem um agente de tracker.
- **Individual tracker schedule** (programação individual dos trackers): impede que um tracker rode depois de cada resposta. Você o aciona na mão pelo HUD (a sobreposição de status que aparece na tela no Roleplay).

### Dar a um agente um lorebook de referência

1. Em **Chat Settings**, abra **Agents** e depois as configurações do agente.
2. Ative **Attach lorebook for the specific agent** (anexar lorebook para este agente). Essa opção começa desligada.
3. Escolha um livro em **Reference lorebook** (lorebook de referência).

A escolha pertence a este agente neste chat. As entradas correspondentes seguem as regras normais de ativação de lorebooks e vão para este agente, inclusive nas novas tentativas manuais. Esta configuração não acrescenta o livro à resposta principal nem a agentes não relacionados, mas agentes que rodam juntos também podem ver as mesmas entradas. Livros excluídos ou indisponíveis não fornecem nada.

## Quando os agentes rodam

Cada agente roda em um ponto em volta da sua resposta, chamado de **pipeline phase** (fase da pipeline). Todo agente embutido tem um valor padrão. Você pode mudá-lo no editor do agente.

| Fase | Quando roda | Exemplos |
| --- | --- | --- |
| **Pre-Generation** | Antes da resposta. Pode acrescentar contexto ao prompt. | Consulta de conhecimento |
| **Parallel** | Ao mesmo tempo que a resposta. Não pode alterar a resposta. | Reações da plateia ao vivo |
| **Post-Processing** | Depois da resposta. Pode ler a resposta, e os agentes de reescrita podem editá-la. | A maioria dos trackers, limpeza da prosa, imagens |

<a id="tell-whether-an-agent-ran"></a>

## Como saber se um agente rodou

- Os agentes de tracker escrevem no HUD e nos painéis de tracker. Se a hora, o local, o humor ou os status mudaram, um tracker rodou.
- **Agent activity** (atividade dos agentes), em **Chat Settings**, lista notas curtas dos agentes. O ícone dele gira enquanto eles trabalham e mostra um ponto quando um deles falha. Veja [Agent activity](../roleplay/getting-started.md#agent-activity).
- **Prose Guardian** e **Continuity Checker** mudam o texto da resposta. Uma resposta mais limpa ou corrigida significa que eles rodaram.
- Para ver o rastro completo, ative o **Debug mode** (modo de depuração) em **Settings → Advanced → Message Tools** (Configurações → Avançado → Ferramentas de mensagem). Ele registra o prompt e a resposta de cada agente no console do servidor, e as entradas de depuração dos agentes também aparecem no console do navegador. As injeções de prompt guardadas em cache aparecem na aba **Injections** (injeções) de **Agent activity**.

## Fique de olho no custo

Cada agente acrescenta as próprias instruções e, muitas vezes, a própria chamada ao modelo. Marinara junta em uma única chamada os agentes que usam a mesma conexão, quando consegue.

Um indicador acima da lista de agentes estima os tokens e as chamadas extras por turno. Toque no ícone de ajuda ao lado dele para ver os detalhes. O indicador fica âmbar, com um ícone de aviso, quando a carga é pesada. O custo real é maior, porque o histórico do chat e os detalhes do personagem vão junto em cada chamada.

Se você vir o aviso, remova os agentes de que não precisa ou mova alguns para uma conexão mais barata ou local. Um **Reasoning Effort** (esforço de raciocínio) salvo em uma conexão também se aplica aos agentes que a usam. Veja [Parâmetros para agentes](../prompts/generation-parameters.md#parameters-for-agents).

<a id="install-and-update-agents"></a>

## Instalar e atualizar agentes

Abra o painel **Agents** (o ícone de estrelinhas nas abas do lado direito) e clique em **Agent Organizer**. Ele funciona no computador e no celular.

- A **Home** (início) mostra agentes em destaque e uma prateleira para cada seção: **Apps**, **Chat games**, **Trackers** e **Writing help**.
- **Updates** (atualizações) lista os agentes instalados que têm uma versão mais nova. **Installed** (instalados) lista tudo o que você tem, com a versão e o tamanho.
- A busca e o filtro de modo restringem todas as listas.
- Selecione um agente para ver a descrição, o tamanho do download, as permissões, a compatibilidade e o **Version history** (histórico de versões). Clique em **Get** para instalá-lo. O menu **⋯** traz **Uninstall**.
- O menu **⋯** ao lado do título traz **Update all** (atualizar tudo), **Install all**, **Refresh catalog** e **Uninstall all**.

Os agentes instalados ficam agrupados em **Apps**, **Writer Agents**, **Tracker Agents** e **Misc Agents**, mais **Custom Agents** para os que você cria. Os **Apps** são pacotes com uma aba própria da Home, como Noodle e Slurp. Você os usa de forma independente, em vez de adicioná-los a um chat.

Um pacote marcado **Rules** não é um agente. Ele acrescenta um conjunto de regras de Game Mode, como 5e (SRD 5.1), que você escolhe em **Rules** ao criar uma partida. Veja [Jogar com um conjunto de regras](../game/rulesets.md). O pacote 5e está em prévia, então só um Engine na branch `staging` o lista.

Desinstalar um pacote remove o código e as configurações dele, mas preserva as mensagens e o histórico do chat. Excluir um agente personalizado é definitivo.

### Atualizar agentes

Quando existe uma versão compatível mais nova de um pacote instalado, a janela **Agent updates available** (atualizações de agentes disponíveis) se abre. Ela lista cada atualização com a versão e informa se é preciso reiniciar.

1. Desmarque a caixa de qualquer atualização que você queira pular. Todas as atualizações começam selecionadas.
2. Leia **What's new** (novidades), se o pacote publicou notas. **More** (mais) mostra uma nota longa por inteiro. Um ponto marca uma mudança que você vai perceber.
3. Clique em **Update all** (ou **Update 2 of 3**, quando você desmarcou algumas). Cada linha mostra **Updated** (atualizado) ou **Failed** (falhou). Uma linha com falha mostra o motivo e **Retry** (tentar novamente).
4. Se uma atualização precisa de reinício, clique em **Restart now** (reiniciar agora) ou reinicie o Marinara depois.

Clique em **Not now** (agora não) para manter as suas versões. Marinara não pergunta de novo sobre uma versão que você pulou. Você pode atualizar pelo **Agent Organizer** a qualquer momento. Os pacotes instalados continuam funcionando na versão atual, mesmo quando o catálogo está inacessível. **See in Agent Organizer** (ver no organizador de agentes) abre a página do agente.

As atualizações valem só para os pacotes que você instalou. Os pacotes ficam no servidor Marinara, então os clientes de navegador usam o que o servidor tem instalado.

Ao atualizar de uma versão do Engine que trazia esses recursos embutidos, Marinara baixa os pacotes correspondentes uma vez e preserva as escolhas nos chats, as configurações e o histórico. Se não conseguir acessar o catálogo, ele tenta de novo na próxima inicialização.

## Guias relacionados

- [Referência dos agentes para download](built-in-agents.md)
- [Avatares 2D e 3D](avatars.md)
- [Como criar agentes personalizados](custom-agents.md)
- [Aprovações de agentes e o Agent Suite](approvals-and-agent-suite.md)
- [HUD e trackers do Roleplay](../roleplay/hud-and-trackers.md)
