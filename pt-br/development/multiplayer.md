# Multijogador opcional

Acompanhamento da implementação: [#6790](https://github.com/Pasta-Devs/Marinara-Engine/issues/6790). Este documento registra os limites da implementação e as provas exigidas. Não afirma que o multijogador esteja disponível nem que uma plataforma tenha passado nos testes.

<a id="smallest-architecture"></a>

## Arquitetura mínima

Um anfitrião é dono de um novo chat compartilhado, do estado salvo do jogo e das conexões de IA. Ele escolhe humanos e personagens de IA sem limite fixo de participantes ou cards. Conversation, Roleplay e Game preservam seus modos. Um convite nunca compartilha um histórico privado antigo.

O transporte escolhido é um servidor HTTPS dedicado, com pequenas ações JSON e consultas longas limitadas. Fastify, Node HTTPS e Zod já estão instalados. WebRTC acrescentaria sinalização, configuração ICE/TURN e problemas de duração da aba anfitriã móvel; WebSocket exigiria outra dependência de servidor e um parser de streaming. Chats privados compartilhados reutilizam HTTPS sem esses acréscimos. Esse é o único transporte da sala. O servidor registra apenas operações de sala, nunca a API normal do Engine. A conexão convidado-anfitrião é direta, sem retransmissor central. Um convite não dá acesso a arquivos, bibliotecas, configurações, credenciais ou outros chats do outro participante. Mantenha privada a porta administrativa do Engine; apenas a porta separada da sala pertence ao convite.

O Engine confiável do convidado conecta-se ao anfitrião. TLS deve validar cadeia do certificado e hostname; o convite também fixa a impressão digital do certificado do anfitrião. Verifique esse vínculo antes de enviar senha ou persona. Não siga redirecionamentos, recue para HTTP, desative a validação de certificados nem configure automaticamente encaminhamento no roteador. O anfitrião configura endereço HTTPS e certificado com os recursos TLS existentes.

A visualização do convidado é código confiável incluído no aplicativo, em um ambiente isolado de origem opaca, sem rede, downloads, navegação, armazenamento, ponte nativa ou acesso administrativo. Um MessageChannel autenticado transmite apenas projeções validadas da sala e um pequeno conjunto explícito de ações. O contêiner fornece preferências locais de apresentação; participantes não podem fornecer estilos, recursos, código, URLs a buscar ou chamadas arbitrárias de API. Texto recebido é renderizado como texto. Os renderizadores ricos de chat ficam fora desse limite. O wrapper Android injeta uma ponte nativa em cada frame e deve continuar indisponível a convidados até implementar um contexto sem ponte e verificá-lo em aparelho físico.

<a id="trust-boundaries"></a>

## Limites de confiança

| Limite | Aplicação |
| --- | --- |
| Administrador local ao controlador da sala | Basic Auth, CSRF, validação de host e autenticação local nativa existentes permanecem intactos. |
| Engine convidado ao servidor do participante | HTTPS, vínculo de impressão digital, senha separada, aprovação, sessões aleatórias com validade e solicitações limitadas. |
| Participante ao convidado confiável | Esquemas versionados estritos nos dois receptores, projeção de texto, isolamento opaco e CSP restritiva. |
| Participante ao estado do chat/jogo | Identidade e propriedade vêm da sessão autenticada; nunca aceitar papel, rota ou solicitação de geração escolhidos pelo participante. |
| Sala à geração e ferramentas | Mapeamento de operações controlado pelo anfitrião, trava de geração existente, políticas explícitas de comandos/ferramentas e barreira de prontidão do Game. |
| Estado compartilhado ao histórico | Lista permitida de campos visíveis; excluir credenciais, prompts de depuração, raciocínio, notas privadas, bibliotecas alheias e estado oculto do GM. |

Um participante autenticado continua não confiável. O texto do prompt é preservado literalmente; autorização é aplicada no código, não escapando prompts nem pedindo segurança ao modelo. O anfitrião e seus provedores de IA podem ler o conteúdo compartilhado. Como qualquer conexão direta, o projeto também revela ao anfitrião o IP do Engine conectado. Nenhum outro dado de biblioteca ou aparelho do convidado integra o protocolo. Não há promessa de proteção contra toda falha de navegador ou sistema operacional.

<a id="activation-and-lifetime"></a>

## Ativação e duração

`MULTIPLAYER_ENABLED=true` é um pré-requisito aplicado somente ao reiniciar. Valores ausentes, falsos ou inválidos desativam o multijogador. É necessária uma ativação separada em Settings; nenhum dos ajustes inicia a rede. Hospedar e entrar exigem ações explícitas. Reiniciar nunca restaura uma sala ativa. Stop, Kick e Leave revogam as credenciais correspondentes e impedem ações posteriores ou entregas atrasadas.

Enquanto qualquer autorização estiver desligada, não há buscas de sessões, verificações de disponibilidade de certificados, consultas de anfitrião/convidado ou tarefas autônomas de sala. O servidor lê os indicadores e o cliente guarda uma leitura de disponibilidade; ações explícitas de Settings podem atualizá-la. Solicitações diretas à API desativada continuam sendo recusadas com segurança. A limpeza de sessões salvas espera a ativação, sem retomar a rede.

<a id="proof-before-enabling-the-feature"></a>

## Provas antes de ativar

- Provar que texto malicioso de participantes não executa, busca recursos, navega, baixa arquivos, alcança APIs locais nem chama uma ponte nativa no contexto de convidado compatível.
- Provar que autorizações desativadas, admissão não autenticada, propriedade, projeção de estado privado, tráfego limitado e revogação recusam acessos indevidos.
- Reutilizar geração, comandos e autonomia em um único coordenador anfitrião. Publicar a matriz por comando com restrições explícitas.
- Provar que dois jogadores de Game produzem uma rodada apenas depois de ambos enviarem ou passarem explicitamente; tentativas, desconexões, cancelamento e reinício não podem aplicar estado duas vezes.
- Testar configuração, gaveta, barra lateral e campo de mensagem existentes em desktop e celular, com Leave/Stop e recuperação claros. Registrar lacunas em aparelhos físicos.

Etapas incompletas permanecem desativadas. Os três modos e seus limites de segurança são necessários antes de considerar #6790 concluída.

<a id="command-and-feature-compatibility"></a>

## Compatibilidade de comandos e recursos

Ações da sala passam pelo coordenador anfitrião autenticado. A tabela descreve esse limite, não permissão para executar comandos arbitrários no outro participante. Comandos recusados são explicados no campo de mensagem; o convidado nunca os executa.

| Recurso | Quem chama e execução | Resultado compartilhado e regra da rodada |
| --- | --- | --- |
| Mensagens humanas, `/send` | Participante admitido; o anfitrião cria uma mensagem de usuário atribuída. `/send` suprime a resposta automática. | Texto público. Conversation/Roleplay serializam envios aceitos com a geração; um remetente ocupado mantém o rascunho. Game envia apenas pelo coletor da rodada. |
| `/roll`, `/r`, `/dice` | Participante admitido; parser limitado e rolador de dados existentes do Engine executam no anfitrião. | Resultado textual atribuído. Em Game, a rolagem continua sendo a ação enviada do jogador até a rodada fechar. |
| Gerar, `/trigger` | Participante admitido; uma reserva persistida de geração do anfitrião e a trava existente. | Narração de IA gravada e filtrada. Game recusa disparos independentes; prontidão é o único disparador da resolução. |
| Outros comandos slash | Indisponíveis até auditar e adicionar explicitamente sua autorização de sala. | Sem inserção de papel de sistema, personificação, navegação/edição de chats privados, trabalho de galeria, ação no aparelho ou comando local arbitrário. |
| Respostas em grupo | Lista de IA aprovada escolhida pelo anfitrião e geração sequencial/Smart/manual existente. | Identidade de IA distinta dos snapshots de personas humanas. `{{user}}` usa a persona revisada do anfitrião, nunca a do último convidado a falar. |
| Agendas e autonomia de Conversation | Agendador do servidor, lógica de candidatos/intenções, esperas por intervalo e ocupação existentes; despacho pela mesma reserva da sala. | Sem agendador convidado. Salas paradas/pausadas e Game não geram por temporizadores. Sem visualização humana ou participante admitido visto por 45 segundos, a autonomia pausa. |
| Conversation `schedule_update`, `memory`, `react` | Handlers existentes do Engine sob a política da sala. | Mudanças de agenda/memória ficam na sala; reações devem mirar este chat e não conter imagem personalizada. Sem alterações globais de memória de personagem ou presença. |
| Notas, lembretes, rolagens e sussurros de Roleplay | Parser de comandos e handler do anfitrião existentes; IDs aprovados identificam destinatários. | Notas privadas continuam privadas. Sussurros aparecem apenas no snapshot filtrado do destinatário; os dados salvos ainda pertencem ao anfitrião. Os agentes da sala nunca leem sussurros, já que todos os participantes veem o que eles produzem. |
| Cenas entre chats e lembretes do navegador | Restritos porque o fluxo comum cria/abre chats privados vinculados ou usa temporizador local do navegador. | Descreva cenas no histórico compartilhado; use agendas Conversation coordenadas pelo anfitrião para mensagens autônomas. Nenhum comando recebido cria chat privado ou lembrete local. |
| Lorebooks e memórias | Livros anexados/da sala revisados pelo anfitrião e memórias de conversa locais à sala. | Apenas contexto de prompt, não exportação de biblioteca. Livros globais implícitos, chats privados vinculados e memórias globais de cards são excluídos. |
| Rastreadores Engine, dados, estado, resumos e variáveis | Listas permitidas explícitas no executor real de ferramentas/agentes, não apenas nos prompts. | Campos públicos seguros podem ser projetados; saídas brutas de agentes, raciocínio oculto, prompts de depuração e campos privados do GM são retidos. Efeitos Game dependem da reserva da rodada. |
| Ações, escolhas, testes, inventário e fichas de Game | Configuração/início pelo anfitrião e geração existente; efeitos deterministas pós-turno são gravados uma vez. | A propriedade da ação humana vem do participante autenticado. Escolhas preenchem um rascunho e nunca ignoram a prontidão das submissões. |
| Mídia, ferramentas personalizadas/de pacotes, Game Experiences e integrações de aparelhos | Indisponíveis para geração de sala. | Sem arquivos, imagens, áudio, vídeo, estilos remotos, downloads, comandos nativos ou interface de convidado fornecida por pacote. Exigem uma etapa de segurança separada. |

O Game compartilhado inicial é o fluxo sincronizado de narração/ações. Interfaces táticas/minijogos somente do cliente, Game Experiences personalizadas e apresentação de cenas/mídia não são anunciadas como capacidades de convidados. A configuração padrão de Game é reutilizada com essas opções explicitamente restritas. Nenhum renderizador fornecido pelo anfitrião cobre lacunas de compatibilidade.

<a id="recovery-and-limits"></a>

## Recuperação e limites

Cada participante autenticado tem uma sequência monotônica persistida de ações e recibos limitados de operações. Uma tentativa repetida retorna o resultado anterior; uma repetição continua obsoleta mesmo após seu recibo sair do cache de 128 entradas. Snapshots de persona nas mensagens nunca mudam quando o jogador troca de persona. Nomes de personas humanas e de IA devem ser inequívocos para sussurros/testes direcionados.

Os nomes de exibição e de persona são públicos, então nunca provam quem é dono de um lugar. Um jogador que sai ou fica em silêncio só recebe o lugar antigo de volta quando o Engine dele apresenta a chave privada de reentrada desse lugar: o token de sessão da admissão que o colocou ali pela primeira vez, enviado de novo como portador da nova solicitação de entrada. Sem ela, uma solicitação com os mesmos nomes recebe um conflito de nome, e as sessões desse lugar não são tocadas. Os dois Engines guardam a chave só na memória. Depois de reiniciar um Engine convidado, o anfitrião remove o lugar antigo antes que esse jogador possa usar a mesma persona de novo.

Mudanças de persona em Game valem no próximo limite de rodada. Fichas existentes, estatísticas atuais, propriedade do inventário e chaves de privacidade dos rastreadores seguem a identidade estável do participante; mensagens históricas mantêm a atribuição original. Se um NPC ocupar o nome solicitado antes desse limite, a persona antiga permanece e o jogador vê um conflito de nome. Passes, remoções, pausas e retomadas do anfitrião deixam eventos localizados no mesmo histórico.

Game salva participantes necessários, cada revisão de submissão e uma reserva única de resolução nos metadados existentes do chat. Coleta de submissões e gravação de mensagens atribuídas usam a fila de metadados seguida da transação de armazenamento. O trabalho do provedor ocorre fora dela. Stop cancela o sinal de operação confiável; escritas atrasadas devem continuar correspondendo à reserva ativa. Turnos interrompidos não são repetidos automaticamente. Retomar explicitamente avança ao próximo limite de coleta sem repetir efeitos gravados. Configuração com falha permanece no lobby para inspeção/reinício explícitos.

Não há limite fixo de humanos ou personagens de IA. O protocolo versão 1 limita cada ação a 16 KiB, snapshots a 256 KiB e 100 mensagens recentes, e mensagens de texto a 8.000 caracteres. Filas de aprovação, sockets, solicitações, consultas longas, sessões, derivações de senha e geração são limitados. Há uma consulta de participante ativa por sessão e uma consulta de conector por Engine convidado. Compressão e redirecionamentos não são aceitos. Senhas/tokens nunca aparecem em URLs ou snapshots compartilhados.

Salas maiores dependem de recursos do anfitrião, capacidade da conexão e contexto do modelo. Participantes nunca são removidos silenciosamente para caber numa atualização. Se ela exceder o limite de transporte, o convidado mantém o último estado válido e pode sair; o anfitrião continua administrando e pode reduzir os dados para recuperar as consultas.

<a id="verification-record"></a>

## Registro de verificação

Provas automatizadas usam armazenamento descartável, uma autoridade certificadora local de teste e provedores simulados. Não alteram certificados, dados ou conexões de IA do usuário.

- `multiplayer-peer-security.regression.ts`: cadeia TLS/hostname/impressão digital antes de divulgar dados por HTTP; respostas malformadas/excessivas/redirecionadas e cancelamento.
- `multiplayer-peer-server-security.regression.ts`: rotas só de sala, limites de corpo/cabeçalho/saída/frequência/concorrência e encerramento imediato da escuta.
- `multiplayer-seat-key-security.regression.ts`: nomes copiados ou uma chave de reentrada errada nunca tomam um lugar nem os sussurros dele; quem tem a chave volta ao mesmo lugar, e a chave nunca chega aos outros participantes nem aos dados salvos do chat.
- `multiplayer-room.regression.ts`: dois Engines, admissão, propriedade, histórico filtrado, revogação/repetição, geração serializada e rodadas/recuperação Game com dois jogadores.
- `multiplayer-session-flows.regression.ts`: dois Engines por HTTPS com geração e runtimes Game reais, provedor simulado e rodadas completas Conversation, Roleplay e Game.
- `multiplayer-generation-policy.regression.ts` e `generation-output.regression.ts`: restrições do executor, exclusão de bibliotecas privadas, identidades locais ao prompt, trava compartilhada e semântica de conclusão.
- `multiplayer-autonomy-security.regression.ts`: reutilização do agendador, relógio de atividade, autoridade única e disputas de Stop.
- `multiplayer-game-runtime.regression.ts`: configuração/início/introdução Game, efeitos deterministas, escritas obsoletas e configuração interrompida.
- `multiplayer-game-persona.regression.ts` e `multiplayer-game-projection.regression.ts`: migração da propriedade de persona, recuperação de colisões, filtragem por público e rastreadores públicos limitados.
- `e2e/multiplayer-guest-isolation.e2e.ts`: bundle de produção do convidado sob texto hostil e tentativas de acesso local/rede/nativo em Chromium desktop, Chromium móvel e WebKit móvel.
- Casos focados no navegador cobrem avisos de admissão, Players, lobby Game, layouts de toque, claro/escuro e rascunhos/tentativas.

Antes de mesclar, execute novamente `pnpm check`, regressões Node relevantes, `pnpm regression:prompt`, `pnpm smoke:ui` e a matriz focada de navegadores no candidato final. Registre resultados reais e revisão no PR, conclua CodeRabbit e uma revisão focada de segurança e verifique aparelhos físicos compatíveis. Emulação de navegador não prova funcionamento na tela inicial de iPhone/iPad físico nem em Android real. O wrapper nativo Android permanece desativado como convidado. Resultados físicos estão pendentes até serem registrados; não deduza suporte de um perfil de viewport.

O convidado é compilado como IIFE clássica porque módulos ES com origem opaca exigiriam relaxar CORS. O início de produção e desenvolvimento compila os recursos locais fixos do convidado; depois de editar seu código com o servidor de desenvolvimento em execução, rode `node packages/client/scripts/build-multiplayer-guest.mjs` e recarregue a visualização. A verificação de integridade do inicializador inclui os dois recursos isolados.

Acompanhamento das traduções: [#6854](https://github.com/Pasta-Devs/Marinara-Engine/issues/6854).
