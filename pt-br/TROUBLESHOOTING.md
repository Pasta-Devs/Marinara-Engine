# Solução de problemas do Marinara Engine

Encontre o seu sintoma e siga a solução. A maioria dos problemas some depois que você reinicia Marinara pelo inicializador (`start.bat`, `start.sh` ou `start-termux.sh`).

## Primeiras tentativas

1. Recarregue a página de forma forçada: <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>R</kbd> no Windows ou no Linux, <kbd>⌘</kbd>+<kbd>Shift</kbd>+<kbd>R</kbd> no Mac.
2. Olhe o console do servidor (a janela de terminal que roda Marinara) e procure linhas de erro em vermelho. Elas costumam apontar o problema de verdade.
3. Para pedir ajuda, ative antes o **Debug mode** (modo de depuração). Veja [Onde buscar mais ajuda](#get-more-help).

<a id="my-character-does-not-reply"></a>

## O meu personagem não responde

Confira estes pontos, nesta ordem.

1. Procure um aviso (uma mensagem curta na parte de baixo da tela). Ele costuma dizer qual é o problema. Veja [Erros de conexão e de geração](#connection-and-generation-errors).
2. Confira se o chat tem uma conta e um modelo: abra **Chat Settings** (configurações do chat) e olhe a conexão. Se não houver nenhuma, adicione uma conta em **Connections** (Conexões). Veja [Conectando a um provedor de IA](connections/connecting-to-a-provider.md).
3. Confira se a chave de API está correta e se a conta tem crédito. Uma chave errada ou um saldo zerado são causas comuns.
4. Confira o nome do modelo e, no caso de um servidor local como o Ollama ou o LM Studio, se o servidor está rodando.
5. Envie a mensagem de novo ou escolha outro modelo.

Se nada ajudar, ative o **Debug mode** e leia o console do servidor. Veja [Onde buscar mais ajuda](#get-more-help).

## O aplicativo não carrega no celular / em outro dispositivo

Não consegue abrir Marinara pelo celular, pelo tablet ou por outro computador?

Na maioria das vezes, é uma destas três coisas:

- **Endereço.** Por padrão, o servidor escuta em `127.0.0.1` (só este computador). Os inicializadores definem `HOST=0.0.0.0`. Se você iniciou com `pnpm start`, defina antes `HOST=0.0.0.0` no `.env`.
- **Rede.** Os dois dispositivos precisam estar na mesma rede Wi-Fi, e nenhum firewall pode bloquear a porta. A porta padrão é `7860`, ou o valor da sua `PORT`.
- **Login.** Defina um. No dispositivo bloqueado, digite o código de configuração de uso único do log do servidor, com um novo nome de usuário e uma nova senha. No Docker, encontre o código com `docker logs <container> 2>&1 | grep "setup code"`. Ou defina o login em **Settings → Advanced → Access** (Configurações → Avançado → Acesso) em um navegador que já está conectado. Em um servidor sem interface gráfica, execute `ssh -L 7860:127.0.0.1:7860 user@server`, abra `http://localhost:7860` e use **Settings**. Veja [Acesso remoto](REMOTE_ACCESS.md#option-1-login-recommended).

Outras causas:

- **Proxy ou túnel na mesma máquina.** Um proxy reverso ou um túnel na mesma máquina precisa do login. O tráfego direto do Tailscale é confiável por padrão. O Tailscale Serve ou Funnel e o `proxy_pass` padrão HTTP/1.0 do nginx contam como encaminhados e precisam do login. O tráfego da ponte Docker no mesmo host só é confiável enquanto nenhum login, `IP_ALLOWLIST` ou `TRUSTED_AUTH_PROXY` estiver definido.
- **Nome personalizado para este computador.** Um nome mapeado para `127.0.0.1` em `/etc/hosts` conta como encaminhado. Use `localhost`, `127.0.0.1`, o nome de host da máquina ou um nome `*.localhost`.
- **Senhas erradas demais.** Espere 15 minutos e depois entre. Esqueceu a senha? Execute `node scripts/reset-login.mjs` na pasta do Marinara, no computador que roda Marinara. No Docker, execute `docker exec <container> node scripts/reset-login.mjs`. Reiniciar o servidor também permite tentar de novo.
- **Host da requisição não confiável.** Para um domínio público ou de proxy reverso, adicione o nome de host exato a `TRUSTED_HOSTS` no `.env`. Endereços IP diretos continuam aceitos.
- **Ações arriscadas bloqueadas** (backups, limpeza de dados, atualizações) a partir daquele dispositivo. No próprio computador do servidor, abra **Settings → Advanced → Admin Access** (Configurações → Avançado → acesso de administrador) e clique em **Make admin secret** (criar segredo de administrador), ou defina `ADMIN_SECRET` no `.env` do servidor. Digite o segredo em **Admin Access** no outro dispositivo e clique em **Save** (salvar).

Veja [Acesso remoto](REMOTE_ACCESS.md) e as [Perguntas frequentes](FAQ.md). Se você ficou bloqueado depois de uma atualização, veja [Bloqueado depois de atualizar](REMOTE_ACCESS.md#locked-out-after-updating).

## Salvamento bloqueado ou configurações que não permanecem

Um salvamento parece funcionar, mas volta atrás quando você recarrega a página. A proteção contra requisições de outros sites (CSRF) está bloqueando o salvamento porque não confia neste endereço de navegador. Você vê uma faixa vermelha avisando que os salvamentos vão falhar em silêncio, ou um aviso com o título **Save blocked: missing CSRF header**, **Save blocked: cross-site request rejected** ou **Save blocked: origin not trusted**.

O loopback, os endereços de rede privada, o Tailscale e a ponte Docker são confiáveis automaticamente. Isso acontece principalmente em um IP público ou em um nome de domínio. Adicione o endereço a `CSRF_TRUSTED_ORIGINS` no `.env`, separando os endereços por vírgulas. A faixa tem um botão **Copy** (copiar) que preenche a linha. Não é preciso reiniciar.

```bash
CSRF_TRUSTED_ORIGINS=http://203.0.113.10:7831,https://chat.example.com
```

<a id="connection-and-generation-errors"></a>

## Erros de conexão e de geração

Os erros de geração aparecem como um aviso na parte de baixo da tela. Ele mostra o motivo e fica visível tempo suficiente para você copiar o texto.

| Mensagem ou sintoma | Solução |
| --- | --- |
| **No API connection configured for this chat** | O chat não tem conta. Adicione uma em **Connections** e depois escolha-a para o chat. Veja [Conectando a um provedor de IA](connections/connecting-to-a-provider.md). |
| O modelo não aceita um parâmetro | Abra **Chat Settings → Advanced Parameters** (configurações do chat → parâmetros avançados) e desligue o botão liga/desliga ao lado do parâmetro que o aviso indica. |
| O modelo diz que um parâmetro é obrigatório | Ligue o botão liga/desliga desse parâmetro. |
| **This model's chat template needs user and assistant messages to take turns** | Alguns modelos locais, como os modelos baseados no Mistral no llama.cpp, precisam de mensagens alternadas. Marinara junta as mensagens seguidas e tenta mais uma vez. Se o erro continuar, defina **Post-Processing Messages** (pós-processamento de mensagens) como **Single User Message** (uma única mensagem do usuário) em **Chat Settings → Advanced Parameters**, ou sirva o modelo com um template de chat menos rígido. |
| **The AI returned an empty response. Try sending your message again.** | Envie de novo. Se continuar acontecendo, teste outro modelo ou outra conta. |
| **A generation is already in progress for this chat** | Uma resposta ainda está em streaming. Espere ou clique em **Stop** (parar) e depois tente de novo. |
| **No connections are marked for the random pool** | O roteamento aleatório está ligado, mas nenhuma conta está no conjunto aleatório. Adicione uma ou desligue o roteamento aleatório. |
| Toda mensagem falha com um erro de rede, e o seu computador só chega à internet por um proxy | Informe o proxy a Marinara. Veja [Proxy HTTP de saída](CONFIGURATION.md#outbound-http-proxy). |

## Depois de uma atualização

Problemas logo depois de uma atualização, primeiro em palavras simples:

- A tela fica em branco ou parece antiga: veja [Tela em branco, desatualizada ou com aparência antiga](#blank-stale-or-old-looking-screen) e [Página em branco ou JavaScript servido como HTML depois de uma atualização](#blank-page-or-javascript-served-as-html-after-an-update).
- Chats ou presets parecem ter sumido: veja [Os dados parecem ter sumido depois de uma atualização](#data-seems-missing-after-an-update). Os seus dados quase sempre continuam no disco.
- Os chats parecem vazios depois que você voltou para uma versão anterior: veja [Os chats não mostram mensagens depois de trocar para uma versão anterior](#chats-show-no-messages-after-switching-to-an-older-version).

<a id="blank-stale-or-old-looking-screen"></a>

### Tela em branco, desatualizada ou com aparência antiga

O servidor está rodando, mas o navegador mostra uma página em branco, ou o aplicativo parece antigo depois de uma atualização. O navegador guarda uma cópia em cache do aplicativo web.

1. Recarregue a página de forma forçada.
2. Se isso não resolver, abra **Settings → Advanced → Updates** (Configurações → Avançado → Atualizações) e clique em **Refresh App** (atualizar o aplicativo).

O **Refresh App** limpa o service worker do navegador (um script em segundo plano que guarda o aplicativo em cache) e o cache, e depois recarrega a página. Ele não altera os seus dados nem atualiza o servidor. Para atualizar o próprio aplicativo, veja [Atualizando Marinara Engine](UPGRADING.md).

<a id="blank-page-or-javascript-served-as-html-after-an-update"></a>

### Página em branco ou JavaScript servido como HTML depois de uma atualização

Um erro como "Failed to load module script" com o tipo `text/html` significa que o navegador pediu um arquivo JavaScript que falta na compilação. Excluir os seus dados não resolve.

1. Pare o servidor.
2. Execute `start.bat`, `start.sh` ou `start-termux.sh` de novo. O inicializador recompila os arquivos incompletos do cliente antes de iniciar. Em uma instalação manual, execute antes `pnpm build` na raiz do repositório.
3. Se a página continuar em branco, faça uma recarga forçada ou tente uma janela anônima.

Se ainda falhar, informe a URL completa do arquivo que falhou, o status HTTP, o Content-Type e a primeira linha da resposta, junto com a saída do inicializador.

<a id="data-seems-missing-after-an-update"></a>

### Os dados parecem ter sumido depois de uma atualização

Não exclua nenhuma pasta de dados. Marinara guarda os dados ativos em uma pasta `storage` dentro da pasta de dados dele. Procure `storage` em `packages/server/data/` e em `data/`. O servidor mostra na inicialização as pastas que ele resolveu.

<a id="chats-show-no-messages-after-switching-to-an-older-version"></a>

### Os chats não mostram mensagens depois de trocar para uma versão anterior

As versões mais novas do Marinara armazenam os registros de cada chat (mensagens, swipes, memórias, imagens) em arquivos próprios, o que torna o salvamento de chats longos mais rápido. As versões antigas não conseguem ler esse layout, então os chats parecem vazios. Os dados continuam no disco.

Marinara bloqueia os downgrades evidentes. O inicializador pula uma atualização automática que levaria a uma versão incompatível, e o atualizador dentro do aplicativo mostra um erro que aponta para cá.

Se você atualizou e depois voltou para uma versão anterior, restaure o backup que fez antes da atualização. Veja [Como voltar para uma versão anterior](UPGRADING.md#downgrading-to-an-older-version). Os detalhes técnicos vêm a seguir.

Os seus dados estão agora no formato de armazenamento 10. Os formatos 8, 9 e 10 acrescentam configurações de avatares 3D (MMD, depois GLB e FBX) e vínculos entre conexões e contas que as versões antigas não conseguem ler com segurança. Se os seus dados chegaram ao formato 8 ou mais novo, restaure um backup completo feito antes dessa atualização para usar uma versão antiga. O comando abaixo só converte estruturas antigas de arquivos de chat. Não mude o número do formato manualmente. Veja [Como voltar para uma versão anterior](UPGRADING.md#downgrading-to-an-older-version).

Para dados abaixo do formato 8, converta a estrutura dos arquivos de chat:

1. Pare o servidor do Marinara.
2. Na pasta do Marinara, execute:

   ```bash
   node scripts/protect-launcher-data.mjs unshard
   ```

3. Troque para a versão anterior e inicie-a.

O comando reconstrói o layout de arquivo único a partir dos arquivos por chat. Nada é excluído. Os arquivos por chat ficam em pastas chamadas `<table>.post-unshard-<timestamp>`, e os originais `.pre-shard` que existirem também ficam. Quando você atualizar de novo, Marinara converte os seus dados de volta.

No Docker ou no Podman, os dados ficam no volume `marinara-data`. Pare o contêiner, execute o comando abaixo e depois inicie a imagem anterior:

```bash
docker compose run --rm marinara node scripts/protect-launcher-data.mjs unshard
```

## Problemas de instalação e de inicialização

### Termux: CANNOT LINK EXECUTABLE "node"

O Termux mostra `CANNOT LINK EXECUTABLE "node"` com `cannot locate symbol` ou `library ... not found`. O Node.js foi atualizado sem o resto do Termux. O aplicativo Android pode então parar com **Could not verify that this Marinara Android build can safely read your stored data**. Os seus dados não são a causa, e instalar o APK de novo não resolve.

1. No Termux, execute:

   ```bash
   pkg upgrade -y
   ```

2. Toque em **Install / Start Marinara** no aplicativo Android. Em uma instalação manual, execute `cd "$HOME/Marinara-Engine" && ./start-termux.sh`.

Se a atualização perguntar se você quer manter um arquivo de configuração, pressione Enter para manter o seu. Os inicializadores e os aplicativos Android atuais fazem essa atualização por conta própria.

### Termux: o heap do JavaScript fica sem memória ao compilar o cliente

O Vite para com `Reached heap limit` ou `JavaScript heap out of memory`. Atualize e execute `./start-termux.sh` de novo. As compilações do cliente usam um heap próprio de 1536 MiB, limitado à metade da RAM do aparelho, mas nunca abaixo de 1280 MiB. Um limite de heap que você definiu em `NODE_OPTIONS` tem prioridade, então remova uma configuração antiga de 1024 MiB. Feche outros aplicativos antes de tentar de novo. Celulares com menos de cerca de 3 GB de RAM ainda podem ficar sem memória. Não exclua os seus chats nem o perfil para corrigir uma falha de compilação.

### Desktop: o heap do JavaScript fica sem memória ao verificar os tipos do cliente

A compilação para e diz `The client type-check needs about 2.5 GiB of Node.js heap`. O limite no seu `NODE_OPTIONS` é pequeno demais, e a compilação mantém um limite que você definiu. Aumente `--max-old-space-size` para 2560 ou mais. Se `NODE_OPTIONS` tiver `--max-old-space-size-percentage`, aumente essa opção, porque ela tem prioridade sobre a outra. Ou remova as duas opções. Depois execute o inicializador de novo. Os seus dados não são afetados.

### Termux: arquivo do convidado multijogador ausente

A inicialização informa que falta `packages/client/dist/multiplayer/guest.js`. Atualize Marinara e execute `./start-termux.sh` de novo, que roda a compilação completa do cliente. Não é preciso ativar o multijogador.

### Termux: o servidor para quando você abre Marinara, ou o Sharp não carrega

O Sharp é a biblioteca de imagens que Marinara usa para miniaturas e sprites. No Android, ele roda por meio de uma alternativa em WebAssembly. Atualize Marinara e deixe o inicializador reinstalar as dependências. Se o servidor parar antes que você consiga atualizar, repare a instalação manualmente no Termux:

```bash
cd ~/Marinara-Engine
rm -f node_modules/.modules.yaml
SHARP_IGNORE_GLOBAL_LIBVIPS=1 pnpm --config.trustPolicy=off --config.confirmModulesPurge=false install --frozen-lockfile --prefer-offline
./start-termux.sh
```

Os seus chats e configurações não são alterados. Se o Sharp ainda não carregar, Marinara continua rodando com o processamento de imagens desligado. As miniaturas já criadas continuam aparecendo, as novas usam a imagem em tamanho original, e a geração de sprites e a remoção de plano de fundo integrada ficam indisponíveis. Não substitua o Sharp por outra versão. Guarde a saída completa do erro para o relato.

<a id="browser-opens-before-startup-finishes"></a>

### O navegador abre antes de a inicialização terminar

Atualize e reinicie pelo inicializador. Ele só abre o navegador depois que o servidor informa que está pronto. Se a inicialização falhar, nenhuma aba abre, então guarde o erro do terminal. Para abrir o aplicativo por conta própria, defina `AUTO_OPEN_BROWSER=false`.

### Windows: erro de EPERM ou de assinatura do corepack ao instalar o pnpm

O pnpm é o gerenciador de pacotes que Marinara usa para instalar o próprio código. `EPERM: operation not permitted` ou um erro de assinatura do corepack significa que o corepack não conseguiu escrever na pasta de instalação do Node. Tente uma solução e depois execute o inicializador de novo:

1. Clique com o botão direito no terminal, escolha **Run as administrator** (executar como administrador) e execute o inicializador.
2. Instale o pnpm por conta própria: `npm install -g pnpm@12.15.0`
3. Em um terminal de administrador, atualize o corepack: `npm install -g corepack`

### Erro de versão do pnpm, ou `'pnpm' is not recognized`

Marinara usa o pnpm 12.15.0. O inicializador obtém a versão certa para você, e não é preciso substituir antes um pnpm global mais antigo. Atualize Marinara (`git pull` na pasta dele, se o inicializador não conseguir) e depois execute o inicializador de novo. Se ainda falhar, instale a versão exata e execute o inicializador de novo:

```bash
npm install -g pnpm@12.15.0
```

### Linux: ERR_PNPM_ENAMETOOLONG durante a instalação

Uma instalação antiga deixou caminhos de pasta longos demais. Na pasta do Marinara, execute:

```bash
rm -rf node_modules .pnpm .pnpm-store
```

Depois execute `./start.sh` de novo. Em uma instalação manual, execute `pnpm install`.

### A instalação diz "Ignored build scripts: @google/genai"

O aviso é inofensivo. Não execute `pnpm approve-builds`, porque ele altera um arquivo que Marinara acompanha. Se o aviso continuar aparecendo depois de uma atualização, exclua `node_modules/.modules.yaml` na pasta do Marinara e execute o inicializador de novo.

### ERR_PNPM_TRUST_DOWNGRADE durante a instalação

Quase sempre é uma instalação que ficou pela metade. Execute o inicializador de novo. Em uma instalação manual, execute isto na pasta do Marinara:

```bash
pnpm --config.trustPolicy=off --config.confirmModulesPurge=false install --frozen-lockfile
```

## Problemas com o Built-in model

O **Built-in model** (modelo embutido) roda no seu computador, sem chave de API. Algumas mensagens de erro o chamam de sidecar. Para a configuração, veja [Como configurar o Built-in model](connections/local-model.md).

- **Sidecar runtime install is disabled.** No seu próprio computador, defina `SIDECAR_RUNTIME_INSTALL_ENABLED=true` no `.env`. A partir de outro dispositivo, salve antes o seu segredo de administrador em **Settings → Advanced → Admin Access**.
- **O download ou a configuração do modelo falha a partir de outro dispositivo** (um endereço de rede ou o Docker). Talvez o segredo de administrador também seja necessário. No seu próprio computador, não é.
- **Diferença de tamanho ou de SHA-256** em um arquivo integrado do llama.cpp, do MLX ou do uv. Marinara recusou o arquivo antes de usá-lo. Atualize ou reinstale Marinara e tente de novo. Não descompacte, edite nem contorne o arquivo.

## Memória e resumos

### O Memory Recall não recupera nada

O **Memory Recall** procura mensagens anteriores e insere as mais relevantes de volta no prompt.

1. Abra **Chat Settings → Memory Recall** e confirme que **Enable Memory Recall** está ligado.
2. Abra **Access memories for this chat**. Em **Memories for This Chat**, olhe o status de cada trecho.
3. **Waiting for vector** significa que a lembrança ainda está sendo processada. Espere e depois converse de novo.
4. **Embedding unavailable** significa que nenhuma fonte de embedding funciona. Configure uma conta de embedding ou deixe o modelo embutido carregar. Para usar uma mesma fonte em todos os chats, escolha-a em **Embeddings** na seção **Defaults** (padrões) de **Connections**.

Uma lembrança só é criada depois de pelo menos 5 mensagens novas. A recuperação mostra só as lembranças que combinam bem com a sua mensagem nova, então ela pode não retornar nada mesmo quando há lembranças.

<a id="advanced-memory-says-scenes-need-attention"></a>

### O Advanced Memory avisa que há cenas precisando de atenção

Um pontinho que não pisca no botão **Chat Settings**, ou um aviso de que o Advanced Memory encontrou problemas, significa que algumas memórias de cena estão pouco claras, desatualizadas ou faltando.

1. Abra **Chat Settings → Memory Recall** ou clique em **Fix** (corrigir) no aviso.
2. Clique em **Fix**. Ele conserta todas as cenas que puder com o Helper model (modelo auxiliar) e nunca altera resumos que você editou.
3. Selecione o número de cada cena em **need your review** (precisam da sua revisão), confira o texto e os personagens dela em **Access memories for this chat** e clique em **Save correction** (salvar correção).

Se o **Fix** parar com um erro, confira a conta do Helper model e depois clique em **Resume processing** (retomar o processamento) ou em **Fix** de novo. Veja [Corrigir problemas de memória](agents/memory.md#fixing-memory-problems).

### Os resumos não estão sendo gerados

Os resumos precisam de uma conta de texto funcionando.

- Roleplay: abra **Chat Settings → Chat Summary**, confirme que há uma conta definida e use **Backfill Summary** para colocar um chat antigo em dia.
- Conversation: abra **Automatic Summarization** e use **Backfill** para repetir os dias que falharam.
- Se o chat exige aprovação de escrita dos agentes, um resumo gerado por IA fica aguardando a sua revisão.
- Um resumo que falha sempre, por exemplo por causa de uma chave de API inválida, é repetido mais tarde. Conserte a conta e depois use **Backfill**.

## Problemas com agentes para download

- **Catálogo indisponível no Agent Organizer.** O computador que roda o servidor, e não apenas o seu navegador, precisa alcançar o catálogo [Pasta-Devs/Marinara-Agents](https://github.com/Pasta-Devs/Marinara-Agents) por HTTPS. Os agentes já instalados continuam funcionando offline. Restabeleça a conexão e depois clique em **Refresh** (atualizar) ou em **Try again** (tentar de novo).
- **Um mapa ou uma chamada instalada não aparece.** Feche Marinara por completo e inicie de novo. Esses pacotes ficam em **Restart required** até o próximo início. Os jogos do Conversation são ativados na hora. Se a instalação falhar, atualize o catálogo e confirme que o jogo aparece como pronto. Adicionar um jogo nas configurações de **Commands** de um chat só é necessário para que os personagens possam iniciá-lo por conta própria, não para o comando de barra manual dele.
- **A primeira migração de pacotes não consegue terminar.** Não exclua `data/capability-packages` nem os dados dos chats. Marinara tenta de novo na próxima inicialização, e as escolhas dos seus chats continuam salvas.
- **`data/capability-runtime-snapshots` ou `data/capability-packages/versions` grande.** Não é preciso limpar. Marinara remove as cópias antigas ao iniciar e mantém a versão atual e a anterior de cada agente.
- **O download de um pacote é recusado.** A soma de verificação, a lista de arquivos, a faixa de versões do Marinara ou os caminhos do arquivo compactado não batem com o catálogo oficial. Atualize Marinara, atualize o catálogo e tente de novo. Não extraia um artefato manualmente na pasta de dados.
- **Atualizações.** As atualizações de agentes nunca são aplicadas na inicialização. Marinara pergunta antes. **Not now** (agora não) mantém a versão instalada, e **Update** continua disponível em **Agents → Agent Organizer** (agentes → Organizador de agentes). Uma atualização que falha deixa a versão instalada no lugar. Um runtime do servidor que não passa na verificação de inicialização volta para a versão anterior.

## Problemas com o Card Browser

O **Card Browser** (navegador de cards) pesquisa em sites públicos de personagens. Abra-o pelo botão **Download** (baixar), no topo do painel **Characters** (personagens) ou **Personas**.

- **O JannyAI mostra um bloqueio da Cloudflare.** Visite o site do JannyAI uma vez no mesmo navegador para resolver o desafio e depois tente de novo.
- **O login no Pygmalion para depois de um reinício.** É esperado. Esse login fica apenas na memória do servidor. Abra a janela de login e cole o seu token de novo.
- **O CharacterTavern mostra um aviso no lugar dos resultados.** É esperado. O novo site dele não oferece mais a conexão que Marinara usava. Baixe o card em character-tavern.com e importe o arquivo.

## Problemas na geração de mídia

### A limpeza de plano de fundo do sprite não dá conta de uma cena complexa

Os sprites gerados normalmente usam transparência nativa ou um fundo liso que Marinara remove. Um quarto fotografado, um cenário cheio de detalhes, sombras fortes ou cores parecidas com as do plano de fundo podem exigir a alternativa opcional com IA:

```bash
pnpm backgroundremover:install
```

Depois reinicie Marinara e clique em **Reapply Cleanup** na janela de geração de sprites. Marinara tenta primeiro a limpeza integrada e só usa o modelo de IA quando a borda não parece uniforme. Se a instalação falhar:

- Confirme que há uma versão do Python entre a 3.9 e a 3.11 instalada. Versões mais novas podem forçar compilações nativas lentas.
- Execute `pnpm backgroundremover:reinstall`.
- Para pular a alternativa com IA enquanto você investiga, defina `SPRITE_BACKGROUND_REMOVAL_ENGINE=builtin` no `.env`.

### Os storyboards do Game Mode ou do Roleplay não aparecem

Os storyboards transformam uma narração concluída em imagens de quadro-chave e, se você quiser, em pequenos vídeos. Veja o [Guia do agente Storyboard](game/storyboard.md) e [Game Mode: primeiros passos](game/getting-started.md).

- Instale o **Storyboard** em **Agents → Agent Organizer** e depois ative **Enable Agents** e **Enable Storyboards** para o chat.
- Os quadros-chave precisam de uma conta de imagem. Os vídeos também precisam de uma conta de vídeo.
- Game, automático: abra **Chat Settings → Agents → Storyboards** e confirme que **Automatic Storyboard Illustrations** está ligado. Ligue **Automatic Storyboard Animations** para os vídeos.
- Vídeo de cena manual: abra **Chat Settings → Gallery**, gere ou envie uma imagem e depois use **Video** ou **Animate**. Confira a aba **Videos**.
- Roleplay: adicione o agente **Storyboard** ao chat. Escolha **Still images** ou **Animations**, defina **Messages per episode** e escolha a conta de imagem. **Manual only** roda pelo **Create storyboard**, na seção **Gallery** de **Chat Settings**.
- Se um prompt personalizado funciona melhor com todos os personagens juntos, desligue **Use NovelAI Character Prompts**.
- Serviços lentos podem estourar o tempo limite. Aumente `IMAGE_GEN_TIMEOUT_MS` ou `VIDEO_GEN_TIMEOUT_MS` no `.env` e depois reinicie Marinara.
- `Outbound response exceeded 31457280 bytes`: por padrão, uma resposta de imagem acima de 30 MiB falha. Os arquivos do ComfyUI que embutem o workflow e as imagens de referência podem chegar a esse tamanho. Aumente `IMAGE_GEN_MAX_RESPONSE_BYTES` no `.env` e reinicie, ou desligue os metadados no ComfyUI.

### A geração de mundo do Game Mode mostra um erro de JSON

Se o modelo devolve um JSON quebrado (texto estruturado), Marinara abre a janela **Repair JSON** em vez de descartar o turno.

1. Corrija as chaves, as vírgulas ou os campos no editor. A faixa mostra **JSON is valid.** quando o texto pode ser interpretado.
2. Clique em **Format** para organizar a formatação.
3. Clique em **Apply Repaired JSON** para usar o resultado sem gerar a resposta de novo.

## Voz, chamadas e TTS

- **Os personagens não falam em uma chamada.** O Text to Speech não está configurado. Abra **Connections → Text to Speech**, ative-o, escolha uma fonte, informe a sua chave, escolha uma voz e salve. Um personagem sem voz aparece só em texto.
- **A fala para com "No audio after N s".** O seu servidor de voz é mais lento do que o tempo que Marinara espera, o que é comum em um servidor local rodando num notebook. `N` é o seu tempo limite atual. Aumente **Request timeout (seconds)** (tempo limite da requisição, em segundos) em **Connections → Text to Speech** ou na conta de áudio que a mensagem indica. Veja [Tempo limite da requisição](media/tts-setup.md#request-timeout).
- **O microfone não funciona.** Instale o **Calls** em **Agents → Agent Organizer**. Depois abra **Connections → Speech to text**, encontre **Local speech model** em **On this device**, escolha um modelo Whisper e clique em **Download Whisper**. O Firefox precisa disso porque não tem reconhecimento de fala no navegador. Desinstalar o Calls exclui os modelos Whisper dele. Você também pode usar o seu próprio servidor: veja [Use o seu próprio servidor de speech-to-text](conversation/calls.md#use-your-own-speech-to-text-server).
- **Local Whisper is disabled in Lite mode.** A imagem lite não consegue rodar o modelo de fala local. Use uma instalação completa.

### O login do Spotify no Music DJ falha em uma instalação remota ou de rede

O modo Spotify do agente Music DJ usa OAuth, um login delegado no qual o Spotify devolve você a um endereço de retorno (a URI de redirecionamento). O Spotify só aceita endereços `https://` ou `http://127.0.0.1`, e recusa endereços IP comuns de rede.

- No localhost, o editor mostra um endereço de retorno em `127.0.0.1`. Registre-o no Spotify.
- Por HTTPS, o editor mostra o seu endereço de retorno HTTPS. Registre esse.
- Se o HTTPS termina antes do servidor e o host não bate, defina `SPOTIFY_REDIRECT_URI` no `.env` com o seu endereço de retorno público.
- Em uma instalação de rede com HTTP simples, a janela pop-up não carrega, mas a barra de endereços dela guarda um código válido. Copie a URL completa, expanda **Browser couldn't reach the callback?** abaixo do botão Connect e cole a URL ali. A URL vale por 10 minutos.

A solução mais limpa é servir Marinara por HTTPS.

## Armazenamento e dados

### O servidor não volta após Restart Server

Inicie Marinara com `start.bat`, `start-local.bat`, `start.sh`, `start-termux.sh` ou `pnpm start`. Esses comandos mantêm o servidor ligado ao inicializador e iniciam um substituto depois que o processo antigo termina. O reinício pelo aplicativo fecha as conexões que ficaram abertas após quatro segundos e força a saída após oito. Uma saída forçada pode interromper gravações pendentes. Execuções diretas com `node` e os processos que monitoram arquivos durante o desenvolvimento não são substituídos: pare e reinicie esses processos você mesmo. O Docker usa a política de reinício do contêiner. No Windows, pressione <kbd>Ctrl</kbd>+<kbd>C</kbd> no console do inicializador e espere **Shutdown complete** (desligamento concluído) antes de fechá-lo.

Não inicie um segundo servidor com a mesma pasta de dados enquanto o primeiro ainda estiver rodando. Pare antes um processo que tenha sobrado.

### A inicialização diz que outro processo pode estar usando a pasta de dados

Só um servidor pode gravar em uma pasta de dados local. Se a inicialização informar **Another Marinara Engine process ... may be using** a pasta, feche o outro processo do Marinara e inicie de novo.

Depois de uma falha ou de um volume do Docker movido, a inicialização pode informar **The storage writer lease ... is incomplete or invalid** ou citar um processo que já não existe.

1. Confirme que todos os processos e contêineres do Marinara que usam essa pasta de dados estão parados.
2. Remova somente a pasta `.writer-lease` indicada no erro.
3. Reinicie Marinara. Não remova a pasta `storage` nem qualquer arquivo de tabela.

Marinara limpa sozinho uma concessão de gravação (lease) deixada por um processo que caiu por falha, no Linux, no Android, em contêineres e no Windows, quando a pasta de dados fica em um disco local. A etapa manual é a opção de reserva para armazenamento em rede ou compartilhado, unidades removíveis e (no Windows) um computador renomeado depois da falha.

### O backup ou a exportação retorna 403

Sessões no mesmo computador fazem backup sem segredo de administrador. As requisições de outro dispositivo, de um endereço de rede, do Docker ou de um proxy ou túnel no mesmo computador precisam de um. Crie-o em **Settings → Advanced → Admin Access** no próprio computador do servidor, ou defina `ADMIN_SECRET` no servidor, e depois salve o mesmo valor em **Admin Access** no outro dispositivo. Para que o loopback também o exija, defina `MARINARA_REQUIRE_ADMIN_SECRET_ON_LOOPBACK=true`. Com `REQUIRE_AUTH_FOR_LOOPBACK_PROXY=false`, os visitantes encaminhados recebem a dispensa local. Mantenha essa proteção ligada para um proxy ou túnel público.

### A importação diz que o arquivo não é um ZIP legível

Marinara lê cards `.charx`, pacotes `.marinara`, pacotes de agente e repositórios personalizados de agentes como arquivos ZIP. Ele recusa um arquivo compactado danificado, ou cujo conteúdo não confere com a própria lista de arquivos, com **The file is not a readable ZIP archive** (ou **Could not read .marinara package**). A causa mais comum é um download incompleto: baixe o arquivo de novo. Se você mesmo criou o arquivo compactado, crie-o de novo com a opção de compactar do seu sistema, `zip` ou 7-Zip.

**Package contains too many files** significa que um pacote de agente ou um repositório tem mais de 8.192 arquivos. **.marinara package has too many entries** significa que um pacote `.marinara` tem mais de 8. Remova os arquivos a mais e tente de novo.

### As agendas do Conversation ou o Noodle usam o fuso horário errado, ou mostram `Etc/Unknown`

Para as agendas do Conversation, escolha **Schedule timezone** nas Chat Settings do Conversation ou no editor de agenda de um personagem. **Use device** redefine a escolha.

Para o Noodle ou outras tarefas do servidor, remova qualquer linha `TZ=` vazia do `.env` e reinicie Marinara, para que ele use o fuso horário do host. Para definir um fuso, use um nome IANA, como `TZ=Europe/Warsaw`.

## Problemas no Android

### O aplicativo Android trava em Connecting ou Waiting for Server

O aplicativo Android é uma casca pequena em volta do Termux, um aplicativo de terminal Linux para Android que roda o servidor Marinara de verdade.

1. Toque em **Install / Start Marinara**.
2. Se o Android pedir para instalar o Termux, aprove as solicitações.
3. Se o Android pedir permissão para rodar comandos no Termux, conceda.
4. Espere o inicializador iniciar o servidor e depois volte ao aplicativo.

O aplicativo cria a credencial privada do localhost e faz login automaticamente. Você nunca cola um segredo. Não adicione `null`, `http://null` nem o segredo do APK a `CSRF_TRUSTED_ORIGINS`.

Confirme também que o aplicativo e o Termux usam a mesma porta. O padrão é `7860`. Se você compilou o aplicativo com outra porta, defina a `PORT` correspondente no `.env` do Termux.

<a id="android-localhost-opens-the-login-page-or-returns-401503"></a>

### O localhost do Android abre a página de login ou retorna 401/503

As instalações do Termux gerenciadas pelo APK protegem o localhost com um segredo privado por instalação, e o aplicativo faz login automaticamente. Se a página de login aparecer dentro do aplicativo, instale o [APK mais recente](https://github.com/Pasta-Devs/Marinara-Engine/releases/latest/download/marinara-engine-android.apk), toque em **Install / Start Marinara** de novo e volte quando o Termux terminar.

Um erro que menciona a origem `null` indica uma combinação antiga de APK e servidor. Editar o `.env` não resolve. Atualize o APK e Marinara.

Para abrir um navegador no mesmo celular, toque em **Open in browser** (abrir no navegador) no inicializador Android e depois em **Retry connection** (tentar conectar novamente). Abra o navegador assim de novo depois de um reinício do servidor ou de uma sessão expirada. Para voltar ao inicializador, use **Settings → General → App Behavior → Open Android launcher (app or browser)** (Configurações → Geral → Comportamento do aplicativo → abrir o inicializador Android: aplicativo ou navegador).

Os APKs antigos entram em `/android-login` com o valor de `cat ~/.marinara-engine/android-secret`. Um link de navegador funciona uma única vez e expira após um minuto, então abra um novo pelo inicializador.

- **401:** o segredo colado ou o desafio foi rejeitado. Recarregue `/android-login` e cole o valor atual.
- **503:** o servidor recebeu um segredo em formato inválido. Reinicie com `./start-termux.sh`. Se o inicializador disser que o arquivo de segredo dele está inválido ou vazio, toque em **Install / Start Marinara** no aplicativo para criá-lo de novo.

O comando local `mari` lê o mesmo arquivo automaticamente. Não coloque o segredo em capturas de tela nem em relatos de problemas.

### A atualização no Android para com exit status 134

O Android ficou sem memória durante uma etapa de compilação. Execute o inicializador de novo:

```bash
./start-termux.sh
```

Se parar de novo, feche outros aplicativos, abra o Termux de novo e tente outra vez.

### O Termux fecha ou reinicia enquanto Marinara está rodando

O inicializador solicita um wake lock enquanto o servidor está rodando e salva cada sessão em `~/.marinara-engine/logs/`. Depois de um reinício inesperado, inclua no relato o `server-*.log` mais recente. Se ele terminar sem um erro do Marinara ou do Node, é muito provável que o Android ou o fabricante do celular tenha encerrado o Termux.

Nas configurações do Android, permita que o Termux rode em segundo plano e remova a otimização de bateria dele. `termux-wake-lock` e `termux-wake-unlock` já vêm com o Termux padrão. Essas configurações não evitam todos os encerramentos específicos do fabricante.

### Marinara para de responder até o Termux ser trazido para primeiro plano

Os chats travam em "Opening chat...", o aplicativo informa **Server unreachable** (servidor inacessível), o texto copiado do Support Diagnostics mostra **Unreachable (request timed out)** (inacessível: tempo da requisição esgotado) nos campos do servidor, e tudo se recupera assim que você abre o Termux. O mecanismo de congelamento de aplicativos em cache do Android suspendeu o processo do Termux. O celular aceita a conexão, mas o servidor congelado nunca responde. Um wake lock não evita isso. O log da sessão mostra uma lacuna nos horários durante o período congelado, e não um erro.

Isente o Termux da otimização de bateria, permita a atividade em segundo plano, fixe o Termux na tela de aplicativos recentes, se o seu celular permitir, e mantenha a notificação dele visível. Se os congelamentos continuarem, mantenha o Termux em primeiro plano ou a tela ligada enquanto você usa Marinara.

### A atualização no Android fica sem espaço ao instalar as dependências

Um consumo temporário grande durante uma atualização normalmente vem do repositório de dependências do pnpm, depois de várias versões ou de uma reinstalação interrompida. O inicializador atual remove os pacotes antigos, e as atualizações dentro do aplicativo instalam só os pacotes do Android. Se um inicializador antigo encheu o dispositivo, libere o espaço e tente de novo:

```bash
cd Marinara-Engine
git pull --ff-only
pnpm store prune
./start-termux.sh
```

Não exclua `data`, `storage` nem `marinara-engine.db`, porque eles podem conter os seus chats e configurações. Se ainda parar, copie as linhas a partir de `Installing dependencies` e inclua no relato o espaço livre e a memória do celular.

### A atualização dentro do aplicativo falha ao trocar entre Stable e Staging no Android

Trocar de canal força uma reinstalação quase completa das dependências, o que é lento no armazenamento do Termux. O atualizador dentro do aplicativo dá mais tempo para cada etapa. Se uma atualização ainda falhar, o erro informa qual etapa falhou e mostra o final da saída dela. Um erro real de dependência ou de lockfile aparece ali. Você também pode atualizar manualmente pelo Termux, com o comando da dica do erro, ou liberar espaço primeiro:

```bash
cd Marinara-Engine
pnpm store prune
./start-termux.sh
```

## Problemas no Docker

### Permissão negada no contêiner ao montar um volume

- Volume nomeado depois de uma atualização: execute `docker compose pull && docker compose up -d`. A imagem oficial corrige a propriedade dos arquivos na inicialização.
- Bind mount: dê permissão de escrita à pasta do host para o usuário e o grupo de ID `1000`, ou use um volume nomeado.
- Sistemas com SELinux, como Fedora ou RHEL: acrescente o sufixo `:Z` à montagem do volume.

### O contêiner Lite falha em um Raspberry Pi 4

Se a imagem lite reinicia sempre que envia uma requisição de IA em um Raspberry Pi 4 ou em um dispositivo ARM parecido, veja o código de saída. A saída 132 ou SIGILL (a CPU encontrou uma instrução que não consegue executar) aponta para um problema conhecido, vindo do projeto de origem, na compilação do Node da imagem lite em alguns chips ARM. Use a imagem comum nesse dispositivo.

<a id="a-server-extension-says-no-supported-sandbox-is-available"></a>

### Uma Server Extension diz que não há sandbox compatível

As Server Extensions e os comandos de shell brutos da Professor Mari só rodam com o Seatbelt do macOS ou o Bubblewrap do Linux. Em um host Linux nativo, instale o `bwrap` e reinicie Marinara. A imagem oficial do Docker inclui o Bubblewrap, mas o contêiner padrão não consegue criar os namespaces aninhados dele, então Marinara mantém esses recursos desligados.

Se você aceita privilégios mais amplos no contêiner, salve isto como `docker-compose.override.yml` ao lado de `docker-compose.yml` e depois recrie o contêiner:

```yaml
services:
  marinara:
    environment:
      MARINARA_DOCKER_USER: root
    cap_add:
      - SYS_ADMIN
    security_opt:
      - apparmor=unconfined
```

> **Aviso:** rodar o servidor como root com `SYS_ADMIN` e sem perfil AppArmor é uma ampliação grande de privilégios. Não ative isso só para esconder esta mensagem.

O perfil seccomp padrão do Docker se adapta às capacidades adicionadas, então você não deve precisar de `seccomp=unconfined` nas versões atuais do Docker.

Windows, Android e outros hosts sem suporte recusam a execução de Server Extensions. As Browser Extensions continuam rodando no sandbox delas.

## Problemas com extensões

### A seção External Extensions não aparece em Addons

A seção fica escondida até que as duas travas sejam abertas.

1. Defina `ENABLE_EXTERNAL_EXTENSIONS=true` no `.env` do host.
2. Espere um momento, depois abra **Settings → Advanced → Danger Zone** (Configurações → Avançado → Zona de perigo), role até abaixo dos controles de exclusão de dados e ative **Allow third-party extension imports**.

Se o botão liga/desliga estiver desativado, a variável do host ainda está como falsa ou o aplicativo ainda não percebeu a mudança. Confirme que você editou o `.env` ativo descrito em [Configuração do servidor](CONFIGURATION.md). No Docker, normalmente é `/app/data/.env`.

Enquanto uma das travas estiver fechada, os registros de extensões externas não aparecem nem podem rodar. Abrir as travas de novo não as reativa.

### Uma extensão de navegador importada aparece, mas não funciona

Abra-a em **Settings → Addons → External Extensions** e leia **Requested access** (acesso solicitado). Os pacotes antigos `marinara.extension` v1 sem declaração de capacidades mostram **Full page access**. Aprove apenas o hash exato que você inspecionou e em que confia.

Um pacote exportado de novo com uma lista de capacidades vazia é tratado como uma extensão segura de sandbox, e o código que precisa do DOM da página não funciona. Acrescente `full_page_access` ao manifesto dele só se você aceita que o código tenha acesso à página inteira, ao armazenamento do navegador, às APIs de rede e à sua sessão.

Depois de desativar uma extensão com acesso à página inteira, recarregue Marinara se sobrar algum item da barra de ferramentas, alguma sobreposição ou algum listener. A limpeza é feita da melhor forma possível, porque o código da página pode causar efeitos colaterais que Marinara não acompanha.

<a id="multiplayer-connection-or-turn-problems"></a>

## Problemas de conexão ou de turnos no multijogador

| Sintoma | Solução |
| --- | --- |
| Controles indisponíveis | Coloque `MULTIPLAYER_ENABLED=true` no `.env` do Marinara correto, reinicie-o e depois ative a configuração separadamente. O wrapper nativo do Android não pode entrar. |
| Anfitrião indisponível | Use uma porta HTTPS de sala separada e acessível, uma cadeia de certificados e um nome de host válidos e a impressão digital correspondente do convite. Não desative as verificações de TLS, não adicione `null` às origens confiáveis, não exponha a API normal nem abra um cliente fornecido pelo anfitrião. |
| Aguardando aprovação | O anfitrião precisa aprovar você em Players. Você não vê o histórico antes da aprovação. Peça um novo convite se ele expirou. |
| Desconectado | Mantenha o seu próprio Marinara rodando. Ele se reconecta ao mesmo anfitrião enquanto a sessão estiver ativa, e os rascunhos não enviados ficam. Depois de um reinício, entre de novo. Para manter o mesmo nome de persona, peça antes ao anfitrião que remova o seu lugar antigo. |
| Game aguardando | Abra Players. Os jogadores desconectados não são pulados automaticamente. O anfitrião pode usar **Pass**, **Kick** ou **Pause**. |
| Geração interrompida | Não reenvie a rodada. O anfitrião deve conferir a narração e o estado salvos e depois retomar ou parar a sala. O multijogador nunca repete uma solicitação de resultado incerto nem aplica os efeitos dela no mundo duas vezes. |
| Comando restrito ou mídia ausente | As salas só transmitem texto. Veja a [matriz de compatibilidade](development/multiplayer.md#command-and-feature-compatibility). Não instale um arquivo ou uma extensão fornecidos por outro participante. |

Ao relatar um erro de conexão, inclua o modo, a plataforma, o erro visível e se a aprovação funcionou. Não publique convites, senhas de sala, tokens de sessão, históricos privados nem chaves de API.

## A instalação como PWA no Chrome do Android falha atrás de um login

Use um endereço HTTPS, entre na conta e recarregue depois de atualizar Marinara. O aplicativo solicita o manifesto com credenciais, então o login pode continuar ativado. Se a instalação ainda estiver indisponível, confira se o proxy entrega `/manifest.json` como JSON, e não como uma página de login ou um erro.

<a id="get-more-help"></a>

## Onde buscar mais ajuda

1. Abra **Settings → Advanced → Message Tools** (Configurações → Avançado → Ferramentas de mensagem) e ative o **Debug mode**. Ele registra o prompt e a resposta no console do servidor.
2. Anote o sistema operacional, a versão do Node.js e o texto completo do erro no console.
3. Remova chaves de API, tokens de acesso, segredos de administrador e conteúdo privado dos chats antes de compartilhar qualquer coisa.

Depois procure a comunidade:

- Leia as [issues abertas](https://github.com/Pasta-Devs/Marinara-Engine/issues).
- Entre no [Discord](https://discord.com/invite/KdAkTg94ME).
- Abra um relato de bug nas mesmas issues do GitHub, com os detalhes acima.

## Guias relacionados

- [Perguntas frequentes](FAQ.md)
- [Referência de configuração do servidor](CONFIGURATION.md)
- [Acesso remoto](REMOTE_ACCESS.md)
- [Atualizando Marinara Engine](UPGRADING.md)
- [Conectando a um provedor de IA](connections/connecting-to-a-provider.md)
- [Como configurar o Built-in model](connections/local-model.md)
- [Game Mode: primeiros passos](game/getting-started.md)
- [Visão geral das configurações](settings/settings-overview.md)

<details>
<summary>Para mantenedores: como atualizar os runtimes locais fixados</summary>

Os arquivos compactados de código-fonte gerados pelo GitHub não têm garantia de continuar idênticos byte a byte, mesmo quando o conteúdo do commit não muda. Nunca "conserte" a diferença encontrada na máquina de um usuário aceitando os bytes que apareceram lá, nem enfraqueça a verificação. Refaça a fixação das entradas de runtime somente em uma alteração revisada do Engine:

1. Escolha uma revisão imutável do upstream ou um arquivo de release e revise as mudanças do upstream.
2. Baixe o artefato em uma pasta temporária, anote a contagem exata de bytes e calcule o digest SHA-256 por conta própria.
3. Atualize `runtime-integrity-manifest.ts` com a revisão, a URL, o tamanho e o digest. No caso do MLX, gere de novo o arquivo `packages/server/src/assets/mlx-runtime-requirements.lock` a partir do arquivo `.in` dele, com a versão fixada do uv em Apple Silicon/Python 3.12, revise cada mudança de dependência e atualize `requirementsLockSha256`.
4. Rode `pnpm regression:runtime-integrity`, `pnpm check` e uma instalação limpa de verdade do runtime na plataforma afetada.
5. Publique a atualização revisada do Engine antes de pedir que os usuários tentem de novo. Não ofereça uma forma manual de sobrepor a soma de verificação.

</details>
