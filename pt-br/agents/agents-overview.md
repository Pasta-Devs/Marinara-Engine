# Agentes: ajudantes de IA para os seus chats

Este guia explica o que são os agentes no Marinara Engine, como baixar cada um, quando eles rodam e como ativá-los em um chat. Aqui você vê o painel **Agents** (Agentes), o catálogo oficial, as configurações de cada chat e como perceber que um agente rodou. O catálogo oficial completo está nos guias relacionados, no fim da página.

## O que são os agentes

Os agentes são pequenos ajudantes de IA que rodam automaticamente em volta da resposta principal do chat. Eles fazem tarefas bem específicas enquanto você conversa com o personagem. Um agente pode acompanhar a hora e o clima ou escolher a expressão do personagem, por exemplo. Outro reescreve a resposta para tirar palavras repetidas. Outros geram uma imagem para um momento importante.

Os agentes são ativados por chat, não por personagem. O card de personagem não tem botão liga/desliga de agentes. Dois chats com o mesmo personagem podem rodar agentes completamente diferentes. Você escolhe quais agentes rodam nas configurações de cada chat.

Uma instalação nova do Marinara Engine começa sem nenhum agente opcional. Isso deixa o aplicativo base e a instalação no Termux menores. O catálogo oficial da versão 2.3.0 em diante tem 30 pacotes de um clique: 6 Writer Agents, 8 Tracker Agents e 16 Misc Agents, incluindo Long-Term Memory, Maps, Calls e os seis jogos de Conversation. O código-fonte, os manifestos, os arquivos para download e o catálogo do repositório são públicos em [Pasta-Devs/Marinara-Agents](https://github.com/Pasta-Devs/Marinara-Agents). O guia completo de cada agente está em [Referência dos agentes para download](built-in-agents.md). Para criar o seu, veja [Como criar agentes personalizados](custom-agents.md).

## As três fases

Cada agente roda em um de três pontos em volta da resposta. Esse ponto se chama **pipeline phase** (a fase do agente na pipeline). Você define isso no editor do agente, e cada agente oficial já vem com um valor adequado.

- **Pre-Generation**: roda antes de a IA escrever a resposta. Pode acrescentar contexto útil ao prompt (o texto que Marinara envia para a IA) antes disso. Os agentes de consulta de conhecimento rodam aqui.
- **Parallel**: roda ao mesmo tempo que a resposta. Não espera pela resposta e não pode alterá-la. Um agente de reação da plateia ao vivo roda aqui.
- **Post-Processing**: roda depois que a resposta termina. Pode ler a resposta e, no caso dos agentes de reescrita, editá-la. A maioria dos trackers, o agente de limpeza da prosa e o agente de imagens rodam aqui.

## O painel **Agents**

Abra o painel **Agents** pelas abas do painel lateral direito (o ícone de estrelinhas). Ali você navega, cria e organiza agentes. Essa é a sua biblioteca. Não é o liga/desliga de um chat específico.

Clique em **Download Agents** (baixar agentes), no topo, para abrir o catálogo oficial em tela cheia. Ele funciona no computador e no celular. Selecione um item para ler a descrição, o tipo de recurso compatível, o tamanho do download, as permissões, a compatibilidade de versão e a documentação. Clique em **Install** para adicionar o pacote; a mesma tela permite atualizar na hora e traz **Uninstall** para os pacotes que você já tem. Marinara também verifica cada pacote oficial instalado quando o servidor inicia e atualiza esse pacote para a versão compatível mais nova do catálogo, antes de o runtime dele ser ativado. Quando o servidor de origem está fora do ar ou a atualização não pode ser verificada, os pacotes continuam funcionando na versão atual.

O catálogo dentro do aplicativo vem do [repositório público Marinara-Agents](https://github.com/Pasta-Devs/Marinara-Agents). Você pode inspecionar cada pacote e cada arquivo por lá, mas o normal é instalar pela tela **Download Agents**, para que Marinara valide compatibilidade, permissões, hashes, conteúdo do pacote e necessidade de reinício.

O catálogo traz os agentes de chat oficiais, o World Maps, as chamadas de áudio e vídeo do Conversation e todos os jogos opcionais do Conversation. Os agentes instalados ficam agrupados em **Writer Agents**, **Tracker Agents** e **Misc Agents**, mais uma seção **Custom Agents** para os que você cria. Desinstalar um pacote do catálogo remove o código e as configurações dele da Engine, mas preserva as mensagens e o histórico do chat. Excluir um agente personalizado é definitivo.

Ao atualizar de uma versão da Engine que já trazia esses recursos embutidos, Marinara baixa os pacotes correspondentes uma vez e preserva as escolhas de agentes nos chats, as configurações dos agentes, os dados de runtime salvos e o histórico. Se essa migração não conseguir acessar o catálogo, ela tenta de novo na inicialização seguinte, em vez de descartar qualquer coisa.

As atualizações automáticas de inicialização nunca instalam um pacote que você não selecionou. As instalações no computador, em Docker e no Android/Termux atualizam os pacotes salvos pelo servidor local. Clientes em iOS, iPadOS e outros navegadores usam os pacotes instalados e atualizados pelo servidor Marinara ao qual se conectam.

## Como ativar agentes em um chat

Os agentes são ativados dentro de cada chat, no painel lateral **Chat Settings** (configurações do chat).

1. Abra o chat que você quer.
2. Abra o painel **Chat Settings** (a engrenagem).
3. Encontre a seção **Agents**.
4. Ative a opção **Enable Agents** (ativar agentes). Esse é o interruptor principal. Quando ele está desligado, nenhum agente roda nesse chat.
5. Adicione os agentes que você quer nas listas abaixo do interruptor, ou remova os que não quer.

Os agentes adicionados aparecem na lista como ativos, cada um com um pequeno botão de remover.

A seção **Agents** tem mais alguns controles:

- **Review Agent Outputs** (revisar o que os agentes produzem): quando está ativado, as mudanças em lorebooks, resumos e cards de personagem esperam a sua aprovação antes de serem salvas. Quando está desativado, as mudanças em lorebooks e resumos podem ser salvas sozinhas, mas as edições no card de personagem continuam pedindo a sua confirmação. Veja [Aprovações de agentes e o Agent Suite](approvals-and-agent-suite.md).
- **Manual Trackers** (trackers manuais; só em chats de Roleplay): quando está ativado, os tracker agents não rodam depois de cada resposta. Você aciona esses agentes na mão, por um botão no HUD. HUD quer dizer heads-up display, a faixa de status que aparece sobre a tela no Roleplay.
- **Agent Suite**: abre um visualizador onde você lê e edita tudo o que os agentes salvaram nesse chat.

### O aviso de custo

Os agentes custam tokens extras (o token é um pedacinho de texto) e chamadas extras ao modelo. Cada agente acrescenta as próprias instruções e, muitas vezes, a própria chamada ao modelo. Marinara junta em uma única chamada os agentes que usam a mesma conexão, quando isso é possível. Acima da lista de agentes, um indicador estima a carga da configuração atual. Ele mostra mais ou menos quantos tokens de instruções de agente você acrescentou e quantas chamadas extras acontecem por turno.

Esse indicador fica âmbar, com um ícone de aviso, quando a carga fica pesada. O custo real por turno é maior do que o número mostrado. O histórico do chat e os detalhes do personagem vão junto em cada chamada. Se o aviso aparecer, remova os agentes de que você não precisa ou mova alguns para uma conexão mais barata ou local.

## Com quais agentes cada modo começa

Uma instalação nova começa sem nenhum agente opcional instalado ou ativo. Cada modo de chat mostra apenas os pacotes compatíveis que você tem instalados.

- **Roleplay**: instale os agentes de Roleplay pelo catálogo e depois adicione-os em Chat Settings. O World Maps aparece ali como qualquer outro agente compatível.
- **Conversation**: instale o Calls ou jogos de mesa avulsos pelo catálogo. Os jogos aparecem no seletor de jogos e registram os comandos de barra deles; as chamadas acrescentam a barra de ferramentas própria e controles em Chat Settings.
- **Game Mode**: os agentes compatíveis com Game que você instalou podem ser selecionados durante a criação do jogo ou adicionados depois. O World Maps só contribui com a área de trabalho de mapas e a visão do mapa-múndi quando está ativo naquele jogo.

Agentes compatíveis podem ser adicionados ou removidos a qualquer momento.

## Como saber se um agente rodou

Alguns agentes mudam algo que você vê na hora. Outros trabalham em silêncio. Veja como conferir.

- Os tracker agents escrevem no HUD e nos painéis de tracker. Se a hora, o local, o humor ou os status mudaram, um tracker rodou.
- Uma faixa de status flutuante mostra mensagens curtas dos agentes enquanto eles trabalham, então você acompanha tudo em tempo real.
- Os agentes **Prose Guardian** e **Continuity Checker** mudam o próprio texto da resposta. Uma resposta mais limpa ou corrigida é sinal de que eles rodaram.
- Para ver o rastro completo, ative o **Debug mode** (modo de depuração) em **Settings** (Configurações), depois **Advanced**, depois **Message Tools**. Ele registra o prompt e a resposta de cada agente no console do servidor. Também mostra uma sobreposição **Agent Debug** com as chamadas, os tokens e o tempo de cada agente.

Um agente que você esperava não rodou? Verifique se a opção **Enable Agents** está ativada. Verifique se o agente está ativo nesse chat. Verifique se o modo do chat permite esse agente.

## Guias relacionados

- [Referência dos agentes para download](built-in-agents.md)
- [Repositório oficial Marinara Agents](https://github.com/Pasta-Devs/Marinara-Agents)
- [Como criar agentes personalizados](custom-agents.md)
- [Aprovações de agentes e o Agent Suite](approvals-and-agent-suite.md)
- [HUD e trackers do Roleplay](../roleplay/hud-and-trackers.md)
