# Pacotes opcionais de agentes e capacidades

Status: implementado no ciclo de desenvolvimento da v2.3.0, na issue #3612.

## Objetivo

A distribuição base do Marinara Engine não pode compilar nem incluir implementações opcionais de agentes e capacidades. Uma instalação nova começa sem nenhum pacote opcional. As atualizações preservam as capacidades que já existiam antes deste sistema de pacotes.

O catálogo oficial, o código dos pacotes, os artefatos reproduzíveis, os scripts de validação e o fluxo de contribuição ficam em [Pasta-Devs/Marinara-Agents](https://github.com/Pasta-Devs/Marinara-Agents). Os artefatos instalados ficam dentro da pasta de dados configurada do Marinara, para que uma atualização do aplicativo não sobrescreva nada.

## Modelo de pacote

Um pacote de agente pode entregar um ou mais agentes declarativos e, opcionalmente, capacidades executáveis confiáveis:

- pontos de entrada no servidor para rotas, hooks de ciclo de vida, provedores de prompt, tratadores de resultado e migrações de armazenamento;
- pontos de entrada no cliente para painéis, superfícies de chat, seções de configuração, escolhas de instalação e telas em tempo de execução;
- esquemas JSON compartilhados e contratos de comunicação estáveis;
- recursos, documentação e fragmentos de conhecimento da Professor Mari pertencentes ao pacote.

Cada pacote é feito para uma versão específica da API de capacidades do Marinara. Nenhum pacote pode importar caminhos internos do código do Engine.

Os elementos de capacidade do cliente recebem o idioma de interface escolhido no Engine pelos atributos `lang` e `dir` e pelo
objeto `capabilityProps.localization`. As interfaces do pacote mantêm os próprios arquivos de idioma e recorrem ao inglês
do pacote quando falta uma tradução; o Engine não traduz os prompts do pacote nem os valores de máquina definidos por ele. A troca de idioma reaproveita
o evento `marinara-capability-props` que já existe, então a interface instalada é redesenhada sem reiniciar o Engine.

### Entrega e cache

Os arquivos de pacotes instalados são servidos com validadores fortes derivados dos hashes SHA-256 de cada arquivo no manifesto, os mesmos valores que o Engine usa para verificar os bytes outra vez a cada leitura. O pacote do cliente (`/api/capability-packages/<id>/client`) e todos os recursos do pacote são sempre revalidados (`no-cache` junto com um `ETag`), então um arquivo sem mudanças responde `304 Not Modified` em vez de ser baixado novamente, enquanto um arquivo republicado é detectado de imediato. Nada é servido como `immutable`: a política de instalação permite republicar a mesma versão com bytes diferentes, por isso nenhuma URL de pacote é endereçada pelo conteúdo.

A API de capacidades 1.1 acrescenta uma fachada genérica de tempo de execução ao contexto
de ativação do servidor. O pacote consegue ler o estado efetivo de depuração do agente e
escrever pelo logger Pino do Engine, inclusive forçando o modo de depuração, sem importar
os módulos internos de logger e de configuração de execução. A fachada expõe operações,
não os objetos internos do Engine.

A API de capacidades 1.2 acrescenta operações de chat e mensagem com escopo de transação,
escritas restritas de metadados do chat, leituras de existência de entradas de lorebook e o
armazenamento de compatibilidade de snapshots espaciais. O pacote consegue validar mudanças de
domínio dentro de uma transação do Engine e salvar os metadados de forma atômica junto com a
mensagem de origem, o swipe ou o snapshot espacial, sem receber uma conexão de banco de dados
nem um objeto de tabela. O Engine continua responsável pelo rollback e pela compatibilidade com o
armazenamento histórico; o pacote continua responsável pela validação e pelas regras de domínio.
Essa mesma API expõe registros normalizados de chat e de personagem, a seleção de
entradas de lorebook elegíveis, a leitura de respostas em formato JSON ou parecido e chamadas resolvidas ao modelo de linguagem.
As credenciais de conexão, as implementações de provedor, as conexões de banco de dados e os objetos de armazenamento continuam internos ao Engine.

### Capability API 1.7: ramificações de chat

A Capability API 1.7 acrescenta metadados normalizados de ramificação ao `CapabilityChatRecord`:

```ts
branch: {
  title: string | null;
  parentChatId: string | null;
  parentMessageId: string | null;
  childMessageId: string | null;
} | null;
```

`title` é o nome persistido da ramificação sem espaços nas pontas. Chats raiz retornam `null`. Ramificações conhecidas criadas pelo Engine expõem o chat pai imediato, a mensagem de origem da bifurcação e a mensagem filha copiada. Ramificações vazias usam âncoras de mensagem null. Ramificações antigas, metadados inválidos e chats irmãos de grupo importados sem uma relação conhecida retornam campos de linhagem null; o Engine não deduz relações históricas. A exportação e a importação genéricas omitem os IDs do pai e das mensagens porque eles mudam entre instalações. Excluir o pai não altera a linhagem da ramificação filha.

### Capability API 1.8: experiências de Game

A Capability API 1.8 acrescenta experiências de Game fornecidas por pacotes, contexto de prompt por turno de Game e gravação de recursos.

Um pacote pode fornecer um Game Mode inteiro em vez de complementar o modo integrado. Ele declara o slot `game-surface` e é escolhido durante a criação do jogo, no bloco Experiences do assistente de configuração. A escolha fica registrada no jogo por toda a duração dele, então uma experiência nunca é ligada ou desligada no meio de uma partida. A superfície desenha o próprio HUD, os menus e o combate sobre a narração compartilhada, além de declarar quais sistemas integrados substitui. Tudo que não for declarado continua integrado, portanto a experiência só desativa o que realmente implementa. O campo opcional `contributions.gameSurface.surfaceClass` informa uma classe que o Engine aplica à área do jogo enquanto a superfície está montada, permitindo que a folha de estilos do pacote altere a interface compartilhada renderizada fora do próprio elemento.

Pacotes com a permissão `prompt-context` acrescentam texto ao prompt do sistema de cada turno de Game gerado. Assim, um pacote que controla um estado ativo mantém o modelo coerente com o que o jogador vê. Uma contribuição também pode declarar quais sistemas integrados substitui, e o Engine deixa de instruir o modelo a controlá-los. As contribuições são coletadas a cada turno e nunca são obrigatórias: uma contribuição vazia é ignorada; se ela gerar erro ou não terminar no prazo, o fato é registrado e ela é ignorada sem afetar a geração.

A fachada de recursos oferece gravações junto com leituras, então o fluxo de configuração do pacote pode localizar ou criar a Persona do jogador e o lorebook dela. Armazenamento, validação e identidade ficam com o Engine; o conteúdo do domínio fica com os pacotes.

### Capability API 1.10: recursos do pacote

A Capability API 1.10 acrescenta a entrega geral de recursos estáticos pertencentes ao pacote. Um manifesto pode declarar `contributions.assets.paths`, uma lista permitida de até 256 imagens (`png`/`webp`/`gif`/`jpg`/`jpeg`) e arquivos JSON enviados dentro do pacote. O Engine os serve em `/api/capability-packages/<id>/assets/<path>` pela mesma cadeia de verificação dos ícones de aba: contenção do caminho, presença do hash em `files[]`, lista permitida de tipos de conteúdo passivos e nova verificação de integridade a cada leitura. O esquema rejeita tipos de documento ativos (SVG, HTML e scripts); todo caminho declarado precisa ter o hash fixado em `files[]`; e o `manifest.json` interno do pacote nunca pode ser servido, mesmo se for declarado. Declarar `contributions.assets` exige um manifesto `schemaVersion` 2 com `capabilityApi` 1.10 ou mais recente; um manifesto v1 não pode declará-lo. Os recursos sempre são revalidados: assim como o pacote do cliente, carregam um `ETag` forte baseado no hash do manifesto e respondem a uma revalidação sem mudanças com `304 Not Modified` e sem corpo. Um conjunto de tiles só é baixado outra vez quando os bytes realmente mudam. As respostas nunca são `immutable` de propósito, pois a política de instalação permite republicar a mesma versão com bytes diferentes e uma URL com versão não é endereçada pelo conteúdo. Isso permite que uma experiência `game-surface` envie arte de verdade em vez de incorporá-la ao pacote do cliente.

Um manifesto que viole essas regras é recusado durante a instalação com uma destas mensagens: "A declared package asset must be listed in the package file manifest", "contributions.assets requires schemaVersion 2 and capabilityApi 1.10 or newer", o erro de extensão do esquema para um caminho que não seja imagem nem JSON, ou, no caso de arquivos cujos nomes só diferem entre maiúsculas e minúsculas e seriam mesclados em sistemas de arquivos que não fazem essa distinção, "Package contains duplicate file" / "Package manifest declares files that collide on case-insensitive filesystems".

Cada elemento de capacidade recebe a própria identidade para isso: `capabilityProps.packageId` e `capabilityProps.packageVersion` chegam junto com `localization`. O pacote monta as URLs de recursos como `/api/capability-packages/<packageId>/assets/<path>`, opcionalmente com `?v=<packageVersion>` para que uma nova versão invalide qualquer cache intermediário, sem baixar novamente a lista de pacotes instalados nem examinar a própria URL de importação.

### Capability API 1.11: interface de combate para experiências

A Capability API 1.11 acrescenta uma interface de combate às propriedades de capacidade `game-surface`. `combatActive` informa o instante em que a interface de combate integrada é realmente montada, ao contrário de `chatMeta.gameActiveState`, o estado narrativo da cena do GM, que demora a refletir a mudança e pode indicar "combat" sem existir um encontro. `combatStyle` leva o estilo efetivo (`classic` ou `tactical`). `requestCombat()` pede ao Engine que gere um encontro pelo mesmo processo do botão manual Start Combat, mas sem a confirmação, pois a interface da experiência já expressou a intenção. O processo de geração do Engine continua decidindo qual será o encontro. Não existe, de propósito, uma forma de o pacote fornecer combatentes ou o estado do combate diretamente: o combate continua sob responsabilidade do Engine.

`requestCombat()` tem identidade estável, não mostra mensagens no caminho do pacote e retorna um código que a experiência usa para renderizar o próprio retorno: `"started"` ou uma recusa, `"combat-active"`, `"pending"` (já existe uma geração em andamento), `"no-turn"` (o GM ainda não escreveu um turno) ou `"unavailable"` (sessão encerrada ou replay). `combatPending` e `combatError` refletem o andamento e a falha da geração para que o pacote não fique esperando `combatActive` depois de uma falha. Como as interfaces 1.7 e 1.8, mas ao contrário de `contributions.assets` da 1.10, que tem uma barreira rígida, essas propriedades são entregues a todo pacote `game-surface`, independentemente da `capabilityApi` declarada. O rótulo 1.11 marca quando surgiram; um pacote que depende delas declara 1.11, e Engines mais antigos o recusam corretamente.

### Capability API 1.12: eventos espaciais para a experiência proprietária

A Capability API 1.12 também endereça os eventos de capacidade espacial ao pacote da experiência proprietária do jogo. `spatial_transition_committed`, `spatial_transition_rejected` e o aviso sem tipo `spatial_context_refresh`, antes enviados apenas a `hierarchical-maps` no evento de janela `marinara-capability-server-event`, passam a ser enviados também com `packageId` igual ao `gameExperienceId` do chat. As cargas variam: um evento confirmado leva `{ chatId, commandId, currentLocationId, definitionRevision, travel? }`; um evento recusado leva `{ chatId, commandId, code?, message? }`, sem campos de localização porque o movimento não aconteceu; o aviso de atualização leva `data: null`. Uma experiência que enviou uma ordem de viagem pelo argumento `pendingSpatialTransition` de `sendMessage` pode confirmar ou limpar a viagem assim que o host conhece o resultado, em vez de deduzi-lo de leituras posteriores. A versão 1.12 também fecha uma lacuna que afetava o World Maps: transições recusadas por um dos dois caminhos HTTP silenciosos, a confirmação antes do streaming do turno proprietário dentro de uma geração ou a confirmação REST independente, antes não geravam evento. Agora os dois sintetizam `spatial_transition_rejected`, somente quando existe evidência definitiva: um código de erro `spatial_*` diferente de `already_applied`. Falhas inconclusivas, como um erro de rede que pode ter perdido uma confirmação bem-sucedida, enviam o aviso sem tipo `spatial_context_refresh`, para que os ouvintes se conciliem com o estado do servidor em vez de aceitar um resultado inventado. Um evento confirmado com `travel.mode` igual a `"step_by_step"` e `complete: false` significa que a viagem continua; mantenha o estado pendente até o evento final. É uma interface flexível como a 1.11: os eventos são entregues independentemente da `capabilityApi` declarada. Declare 1.12 apenas se o pacote precisar dela.

### Capability API 1.13: recolhimento temporário da narração

A Capability API 1.13 acrescenta `requestsCollapsedNarration` à declaração de interface que um pacote `game-surface` envia a `setExperienceChrome`. Enquanto o sinalizador for true, a caixa de narração do Game Mode se recolhe até a alça estreita, permitindo que uma experiência libere a tela para uma cena cinematográfica ou um momento em tela cheia.

Isso é uma SOLICITAÇÃO, não uma preferência. A configuração de recolhimento do jogador nunca é gravada, e o sinalizador só é respeitado enquanto a experiência é a superfície ativa. Remova o sinalizador ou deixe de ser a superfície ativa, e a caixa volta à escolha do jogador. Essa é a garantia de que ela sempre reabre depois; um pacote não pode tornar o recolhimento persistente.

As regras de segurança do Engine têm prioridade. A caixa é aberta à força sempre que o campo de texto do jogador está visível, inclusive no início da cena antes de existir qualquer segmento, e quando os controles de avanço do segmento estão ativos. Esses controles são a única forma de terminar um turno; um pacote capaz de escondê-los poderia prender o jogador para sempre. A alça também continua mostrando o indicador de atenção quando há uma nova tentativa pendente de análise da cena, geração ou geração de combate. Se o jogador abrir a caixa manualmente durante uma solicitação, ela fica aberta até a solicitação terminar. Assim como as interfaces 1.11 e 1.12, esta é flexível: o campo é respeitado independentemente da `capabilityApi` declarada. O rótulo 1.13 marca quando ele surgiu, então um pacote que depende dele declara 1.13.

## Pacotes iniciais

- todos os agentes hoje embutidos;
- mapas espaciais hierárquicos para Roleplay e Game;
- chamadas de áudio e vídeo no Conversation Mode;
- UNO;
- Chess;
- Poker;
- 8-Ball Pool;
- Tic-Tac-Toe;
- Rock-Paper-Scissors.

A base guarda o gerenciador de pacotes, o cliente do catálogo, os contratos genéricos do pipeline de agentes, os contratos genéricos de hospedagem de jogos por turno e as interfaces de hospedagem inertes. As implementações concretas pertencem aos pacotes.

## Confiança e instalação

O catálogo oficial é um documento JSON versionado e validado por esquema, obtido por HTTPS. Cada entrada de versão traz URLs de artefato imutáveis, digests SHA-256, tamanho em bytes, compatibilidade com o Engine, permissões e a informação de que o tempo de execução exige ou não reiniciar.

Quando o servidor inicia e há pelo menos um pacote oficial instalado, o host busca o catálogo uma vez, seleciona apenas as versões mais novas compatíveis com o Engine e com a API de capacidades em uso, verifica cada uma pelo fluxo normal de instalação e as instala antes de os pacotes entrarem em execução. Uma falha afeta só o pacote em que aconteceu. Os arquivos existentes e o estado do registro continuam utilizáveis se o catálogo estiver fora do ar ou se a verificação falhar, e falhas de prontidão do servidor usam o caminho de rollback para a versão anterior.

O instalador precisa:

1. exigir acesso privilegiado por loopback ou de administrador;
2. impor HTTPS, limites de download e tempo limite;
3. verificar a confiança do catálogo e o SHA-256 do artefato antes de extrair;
4. rejeitar caminhos absolutos, travessia de caminho, links, arquivos de dispositivo e arquivos não declarados;
5. validar o manifesto e a compatibilidade com o Engine;
6. extrair em uma pasta temporária vizinha;
7. ativar de forma atômica só depois que a validação passar;
8. manter a versão anterior até que o novo tempo de execução inicie sem erro;
9. desfazer a ativação em caso de falha;
10. nunca executar scripts de instalação, atualização ou desinstalação.

O catálogo oficial só habilita pacotes executáveis confiáveis produzidos pelo próprio projeto. Um fluxo futuro para pacotes de terceiros exige um modelo de confiança separado e explícito.

## Execução e comportamento de reinício

O servidor é dono do registro de pacotes instalados e informa aos clientes quais capacidades estão disponíveis. Os módulos declarativos e recarregáveis entram em uso na hora. A interface invalida as consultas de catálogo, de agentes, de capacidades de modo e do chat ativo depois da ativação.

O manifesto só pode declarar `restartRequired` quando o host não consegue recarregar aquele ponto de entrada com segurança. A ativação a quente bem-sucedida mostra `Agent installed. It is ready to use.` A ativação que exige reinício mostra `Agent installed. Restart Marinara Engine to finish setup.`

Os pacotes de jogo por turno são recarregáveis a quente: a instalação registra na hora o motor no servidor e o lançador manual por comando de barra, e a desinstalação desconecta o tempo de execução sem reiniciar o Engine. As configurações de Conversation Commands de cada chat controlam apenas se os personagens podem emitir o comando oculto do pacote; elas não bloqueiam o lançador por comando de barra do usuário. Os manifestos oficiais de jogo por turno ainda trazem a marca conservadora de reinício, herdada, por compatibilidade com o Engine 2.x; o Engine 3.x reconhece o tipo `turn-game`, faz a ativação a quente com segurança e devolve o pacote como ativo e pronto.

## Migração de compatibilidade

Na primeira vez que o aplicativo abre depois da atualização:

- os agentes personalizados ficam intactos;
- todo agente embutido antigo visível naquela instalação é registrado como instalado;
- os mapas, as chamadas do Conversation Mode e os jogos do Conversation Mode continuam disponíveis como antes;
- a configuração de cada chat, os snapshots, o estado do jogo, o histórico de chamadas e a memória dos agentes continuam onde estavam;
- a migração é idempotente e só registra sua conclusão depois que todas as entradas de disponibilidade antigas estão gravadas em disco.

Os artefatos dos pacotes antigos continuam no catálogo oficial como origem para a migração. Uma instalação nova não exibe nem ativa esses pacotes até o usuário instalá-los.

## Desinstalação

A desinstalação tira o pacote das seleções dos chats ativos, exclui a configuração do agente e os arquivos executáveis baixados, e desconecta o tempo de execução no próximo reinício, quando necessário. Os chats antigos, as mensagens, os snapshots de mapa, os resumos de chamadas e os registros de partidas concluídas continuam legíveis, então remover um pacote nunca destrói o trabalho do usuário. A remoção destrutiva dos dados históricos é uma ação separada e explícita do usuário.

Toda desinstalação pede confirmação. Os chats afetados voltam às telas comuns da base, sem corromper o histórico.

## Interface do catálogo

O painel **Agents** (agentes) tem um controle `Download Agents` equivalente ao `Download Cards` do painel **Card Browser** (navegador de cards). Ele abre uma biblioteca responsiva em tela cheia com busca, tipos de pacote, informações de compatibilidade, estado de instalação e atualização, permissões, espaço ocupado, documentação e controles de desinstalação.

No computador, aparece uma lista de navegação com uma área de detalhes ao lado. No celular, aparece um painel só, com navegação explícita para voltar e ações grandes o bastante para o toque. Os estados de lista vazia, sem conexão, incompatível, download corrompido, instalação interrompida, atualização, rollback e reinício necessário são tratados como estados de primeira classe.

## Critério de extração

Uma extração só está completa quando os bundles de produção do cliente e do servidor da base não contêm mais a implementação do pacote, quando uma instalação nova não consegue ativá-lo sem baixar o pacote, quando uma instalação atualizada continua com ele e quando instalar, atualizar e desinstalar o pacote funciona em computador, celular e sistemas de arquivos compatíveis com Termux.
