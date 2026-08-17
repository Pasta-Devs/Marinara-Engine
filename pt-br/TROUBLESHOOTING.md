# Solução de problemas do Marinara Engine

Neste guia estão os problemas mais comuns no Marinara Engine e como resolver cada um. Procure a seção que corresponde ao sintoma e siga os passos. Se nada aqui resolver, veja a última seção, Onde buscar mais ajuda.

## Primeiras tentativas

Muitos problemas somem com dois passos rápidos.

1. Recarregue a página de forma forçada. Pressione **Ctrl+Shift+R** no Windows ou no Linux, ou **Cmd+Shift+R** no Mac.
2. Olhe o console do servidor (a janela de terminal onde Marinara está rodando) e procure linhas de erro em vermelho. Elas costumam apontar o problema de verdade.

Antes de pedir ajuda à equipe, ative o **Debug mode** (modo de depuração) para que o servidor registre o prompt (o texto que Marinara envia para a IA) e a resposta. Veja Onde buscar mais ajuda, no fim deste guia.

## Problemas de instalação e de inicialização

### Windows: erro de EPERM ou de assinatura do corepack ao instalar o pnpm

O pnpm é o gerenciador de pacotes que Marinara usa para instalar o próprio código. Se aparecer `EPERM: operation not permitted` ou uma falha de verificação de assinatura do corepack, o corepack não conseguiu escrever na pasta de instalação do Node.

Escolha uma das soluções:

1. Clique com o botão direito no terminal, escolha Run as administrator (executar como administrador) e rode o inicializador de novo.
2. Instale o pnpm por conta própria. Rode este comando e depois rode o inicializador de novo:

```bash
npm install -g pnpm
```

3. Atualize o corepack em um terminal de administrador e rode o inicializador de novo:

```bash
npm install -g corepack
```

### Windows: `'pnpm' is not recognized` durante a compilação do pacote compartilhado

Na versão 2.3.0, Marinara conseguia iniciar o pnpm pelo Corepack e depois falhava na compilação do pacote compartilhado, porque essa etapa tentava executar um segundo executável `pnpm` global. A versão 2.3.1 remove essa exigência aninhada. Feche o inicializador que falhou e rode `start.bat` outra vez, para que ele baixe o script de compilação corrigido antes de recompilar. Não é preciso remover nenhum dado.

Se o próprio checkout não conseguir atualizar, rode `git pull` na pasta do Marinara e inicie de novo. Como solução temporária na versão 2.3.0, instale globalmente a versão fixada do gerenciador de pacotes, rode o inicializador outra vez e depois atualize normalmente:

```bash
npm install -g pnpm@10.33.2
```

### Linux: ERR_PNPM_ENAMETOOLONG durante a instalação

Isso indica que uma instalação antiga deixou caminhos de pasta longos demais. Na pasta do Marinara, limpe a instalação incompleta e rode o inicializador de novo:

```bash
rm -rf node_modules .pnpm .pnpm-store
```

Depois inicie Marinara outra vez com `./start.sh`. Se você instala manualmente, rode `pnpm install` após remover essas pastas.

### ERR_PNPM_TRUST_DOWNGRADE durante a instalação

Quase sempre é uma instalação que ficou pela metade. Primeiro rode o inicializador de novo, para que ele conserte o workspace. Se você instala manualmente, rode este único comando na pasta do Marinara:

```bash
pnpm --config.trustPolicy=off --config.confirmModulesPurge=false install --frozen-lockfile
```

## Tela em branco, desatualizada ou com aparência antiga

Às vezes o servidor está rodando, mas o navegador mostra uma página em branco, ou o aplicativo parece uma versão antiga depois de uma atualização. Nesse caso, o navegador está guardando uma cópia em cache do aplicativo web.

1. Recarregue a página de forma forçada (**Ctrl+Shift+R** ou **Cmd+Shift+R**).
2. Se isso não resolver, abra **Settings** (Configurações), vá até a aba **Advanced**, depois até a seção **Updates**, e clique em **Refresh App**.

O botão **Refresh App** limpa o service worker do navegador (um script em segundo plano que guarda o aplicativo web em cache) e o cache do navegador, e depois recarrega a página. Os seus dados não mudam. Os chats, as configurações e os demais dados locais continuam intactos. O código do servidor também não é atualizado, então isso não substitui uma atualização de verdade. Veja [Atualizando Marinara Engine](UPGRADING.md) para atualizar o aplicativo em si.

## Problemas com agentes para download

Se **Agents → Download Agents** avisar que o catálogo está indisponível, verifique a conexão da máquina que roda o servidor Marinara, e não apenas a do navegador: ela precisa alcançar o catálogo oficial [Pasta-Devs/Marinara-Agents](https://github.com/Pasta-Devs/Marinara-Agents) por HTTPS no GitHub. Os agentes já instalados continuam funcionando offline, na versão atual. Restabeleça a conexão do servidor e clique em **Refresh** ou **Try again** para navegar pelo catálogo e procurar atualizações.

Se um mapa ou uma chamada recém-instalada não aparecer, feche Marinara Engine por completo e inicie de novo. Esses pacotes trazem rotas próprias e ficam no estado **Restart required** até o próximo início do processo. Com os jogos do Conversation Mode é diferente: as versões atuais do Engine os ativam na hora. Atualize o catálogo se a instalação falhar e confirme que o jogo aparece como pronto. Adicioná-lo nas configurações de **Commands** de um chat só é necessário quando você quer que os personagens iniciem o jogo por conta própria, não para o comando de barra manual.

Se uma instalação antiga não conseguir concluir a primeira migração de pacotes, não exclua a pasta `data/capability-packages` nem os dados dos chats. Marinara deixa a migração incompleta e tenta de novo na próxima inicialização. As escolhas e as configurações de chat já existentes continuam salvas enquanto o catálogo estiver inacessível.

Marinara recusa o download de um pacote quando a soma de verificação, a lista de arquivos declarada, a faixa de versões do Engine ou os caminhos do arquivo compactado não batem com o catálogo oficial. Atualize Marinara Engine primeiro, atualize o catálogo e tente de novo. Nunca extraia um pacote manualmente dentro da pasta de dados.

Atualizações de agentes nunca são aplicadas na inicialização. Quando existe uma versão mais nova e compatível, Marinara pergunta se você quer aplicá-la. Escolha **No** para ficar com a versão instalada; o botão **Update** continua disponível em **Agents → Download Agents**. Uma atualização que falha também mantém a versão instalada registrada, e um servidor recém-atualizado que não passa na autoverificação de inicialização volta para a versão anterior.

## Acessar o Marinara a partir de outro dispositivo

Se você não consegue acessar o Marinara pelo celular, pelo tablet ou por outro computador da rede, siga estas verificações.

- Vincule o servidor a um endereço acessível. Por padrão, o servidor escuta em `127.0.0.1` (loopback, ou seja, só a própria máquina). Os inicializadores de shell já definem `HOST=0.0.0.0` para você. Se você iniciou manualmente com `pnpm start`, defina antes `HOST=0.0.0.0` no arquivo `.env`.
- Confirme que os dois dispositivos estão na mesma rede Wi-Fi.
- Confirme que nenhum firewall está bloqueando a porta. A porta padrão é `7860`, ou o valor definido na variável `PORT`.
- Configure o controle de acesso. Para clientes comuns da rede ou públicos, defina `BASIC_AUTH_USER` e `BASIC_AUTH_PASS` no arquivo `.env`. O loopback continua sem senha. Marinara confia por padrão no tráfego direto que vem do Tailscale e da ponte Docker do mesmo host, ou de um gateway de contêiner detectado. Já o tráfego Docker encaminhado por proxy exige a autorização normal, a menos que você defina explicitamente `REQUIRE_AUTH_FOR_DOCKER_PROXY=false`.
- Para ações privilegiadas a partir daquele dispositivo (backups, limpeza de dados, atualizações), defina `ADMIN_SECRET` no arquivo `.env` do servidor. Depois cole o mesmo valor em **Settings** > **Advanced** > **Admin Access** no dispositivo e clique em **Save**.
- Se você usa um domínio público ou um proxy reverso e vê a mensagem **Untrusted request host**, adicione o nome de host exato à variável `TRUSTED_HOSTS` no arquivo `.env`. Endereços IP diretos usados por celulares, computadores da rede local e pares do Tailscale continuam aceitos automaticamente.

Para o passo a passo completo, veja [Acesso remoto](REMOTE_ACCESS.md) e as [Perguntas frequentes](FAQ.md).

## Salvamento bloqueado ou configurações que não permanecem

Se um salvamento parece funcionar, mas volta atrás quando você recarrega a página, a proteção contra requisições de outros sites está bloqueando a ação. A proteção CSRF (cross-site request forgery) protege tudo o que altera dados e só confia em determinadas origens de navegador.

Você vê um destes sinais, ou os dois:

- Uma faixa vermelha no topo da tela avisando que os salvamentos vão falhar em silêncio porque a origem não é confiável.
- Um aviso com o título **Save blocked: missing CSRF header**, **Save blocked: cross-site request rejected** ou **Save blocked: origin not trusted**.

Marinara confia automaticamente no loopback, nos endereços de rede privada, no Tailscale e na ponte Docker. Isso normalmente só acontece quando você acessa Marinara por um endereço IP público ou por um nome de domínio. Adicione esse endereço à variável `CSRF_TRUSTED_ORIGINS` no arquivo `.env`. Para mais de um, use uma lista separada por vírgulas, por exemplo:

```bash
CSRF_TRUSTED_ORIGINS=http://203.0.113.10:7831,https://chat.example.com
```

Não é preciso reiniciar. A faixa tem um botão Copy que já monta a linha exata para você. Veja [Acesso remoto](REMOTE_ACCESS.md) para saber mais.

## Erros de conexão e de geração

Os erros de geração aparecem como um aviso na parte de baixo da tela. Quando uma conexão falha, o aviso mostra o motivo e fica visível tempo suficiente para você ler e copiar o texto.

- **No API connection configured for this chat**: o chat está sem conexão selecionada. Abra o painel **Connections**, crie uma conexão e depois escolha-a para o chat. Veja [Conectando a um provedor de IA](connections/connecting-to-a-provider.md). A chave de API é um código secreto do provedor, parecido com uma senha, que autoriza Marinara a usar os modelos dele.
- O modelo não aceita um parâmetro: o aviso diz qual é. Abra **Chat Settings** (configurações do chat) > **Advanced Parameters** e procure esse parâmetro. Desligue o botão liga/desliga ao lado do nome dele (a dica diz "This parameter is sent to the model").
- O modelo diz que um parâmetro é obrigatório: faça a mesma coisa, mas ligue o botão ao lado desse parâmetro.
- **The AI returned an empty response. Try sending your message again.**: envie a mensagem de novo. Se continuar acontecendo, teste outro modelo ou outra conexão.
- **A generation is already in progress for this chat**: ainda há uma resposta em streaming, ou seja, aparecendo conforme é escrita. Espere terminar ou clique no botão Stop e tente de novo.
- **No connections are marked for the random pool**: você ativou o roteamento aleatório de conexões, mas não marcou nenhuma conexão para o sorteio. Marque pelo menos uma conexão ou desative o roteamento aleatório.

## Problemas com o Local Model

O **Local Model** (modelo local) é um modelo de IA que roda na sua própria máquina, sem chave de API. Algumas mensagens de erro chamam esse recurso de sidecar.

- Se a instalação de um runtime falhar com **Sidecar runtime install is disabled**, o servidor está com essa ação desativada por segurança. Na sua própria máquina, defina `SIDECAR_RUNTIME_INSTALL_ENABLED=true` no arquivo `.env`. A partir de outro dispositivo, cole antes o segredo de administrador em **Settings** > **Advanced** > **Admin Access**.
- Se o download ou a configuração do modelo falhar a partir de outro dispositivo (um endereço de rede ou o Docker), o segredo de administrador também pode ser necessário. Na sua própria máquina, ele não é exigido. Veja no item anterior onde colar o segredo.
- Se a verificação do llama.cpp, do MLX ou do uv integrados, ou do arquivo de dependências fixadas do MLX, apontar diferença de tamanho de arquivo ou de SHA-256, Marinara já descartou ou recusou o arquivo antes de extrair ou instalar. Atualize ou reinstale o Marinara e tente de novo. Nunca execute, descompacte, edite nem contorne o artefato recusado por conta própria.

### Para mantenedores: como atualizar os runtimes locais fixados

Os arquivos compactados de código-fonte gerados pelo GitHub não têm estabilidade garantida byte a byte, mesmo quando o conteúdo do commit não muda. Nunca "conserte" a diferença encontrada na máquina de um usuário aceitando os bytes que apareceram lá, nem enfraqueça a verificação. Refaça a fixação das entradas de runtime somente em uma alteração revisada do Engine:

1. Escolha uma revisão imutável do upstream ou um arquivo de release e revise as mudanças do upstream.
2. Baixe o artefato em uma pasta temporária, anote a contagem exata de bytes e calcule o digest SHA-256 por conta própria.
3. Atualize `runtime-integrity-manifest.ts` com a revisão, a URL, o tamanho e o digest. No caso do MLX, gere de novo o arquivo `packages/server/src/assets/mlx-runtime-requirements.lock` a partir do arquivo `.in` dele, com a versão fixada do uv em Apple Silicon/Python 3.12. Revise cada mudança de dependência e atualize `requirementsLockSha256`.
4. Rode `pnpm regression:runtime-integrity`, `pnpm check` e uma instalação limpa de verdade do runtime na plataforma afetada.
5. Publique a atualização revisada do Engine antes de pedir que os usuários tentem de novo. Não ofereça uma forma manual de sobrepor a soma de verificação.

Para a configuração completa, veja [Como configurar o Local Model](connections/local-model.md).

## Memória e resumos

### O Memory Recall não recupera nada

O **Memory Recall** procura mensagens anteriores e insere as mais relevantes de volta no prompt, sem alarde. Se parecer que ele não lembra de nada, confira estes pontos.

1. Abra **Chat Settings** > **Memory Recall** e confirme que a opção **Enable Memory Recall** está ligada.
2. Abra **Access memories for this chat**. Na janela **Memories for This Chat**, olhe o status de cada trecho.
3. O status **Waiting for vector** significa que a lembrança ainda está sendo processada. Espere um pouco e converse de novo.
4. O status **Embedding unavailable** significa que nenhuma fonte de embedding está funcionando. O embedding é a representação numérica do texto. Configure uma conexão de embedding ou deixe o modelo local integrado carregar. Veja [Como configurar o Local Model](connections/local-model.md).

Uma lembrança só é criada depois de pelo menos 5 mensagens novas. A recuperação também mostra apenas as lembranças que combinam bem com a mensagem nova, então ela pode não retornar nada mesmo havendo lembranças salvas.

### Os resumos não estão sendo gerados

Os resumos do chat precisam de uma conexão de texto funcionando para serem escritos.

- No Roleplay Mode, abra o pop-up **Chat Summary** e confirme que há uma conexão definida. Use **Backfill Summary** para colocar um chat antigo em dia.
- No Conversation Mode, abra **Automatic Summarization** e use **Backfill** para repetir os dias que falharam.
- Se o chat exige aprovação de escrita dos agentes, um resumo gerado por IA fica aguardando a sua revisão antes de valer.
- Um resumo que falha sempre (por causa de uma chave de API inválida, por exemplo) é repetido depois de um intervalo. Conserte a conexão e use **Backfill**.

## Problemas com o Card Browser

O **Card Browser** (navegador de cards) permite pesquisar em sites públicos de personagens e importar personagens. Abra-o pelo ícone **Card Browser** na barra superior e clique em **Download Cards**.

- Se a busca no JannyAI ou a página de um personagem falhar com um bloqueio da Cloudflare, Marinara mostra uma mensagem pedindo que você visite o site do JannyAI uma vez no mesmo navegador, para resolver o desafio, e depois tente de novo.
- Se o login no CharacterTavern ou no Pygmalion parar de funcionar depois que você reinicia o servidor, isso é esperado. Esses logins ficam apenas na memória do servidor e somem no reinício. Abra a janela de login e cole o cookie ou o token de novo.

## Problemas na geração de mídia

### A limpeza de plano de fundo do sprite não dá conta de uma cena complexa

Os sprites estáticos gerados (o sprite é a imagem do personagem no palco) normalmente usam transparência nativa ou um fundo chroma liso adaptativo. A limpeza integrada também reconhece fundos brancos antigos, preserva detalhes internos do personagem, suaviza a borda do alfa e remove o vazamento da cor do fundo. Mesmo assim, um quarto fotografado, um cenário cheio de detalhes, sombras fortes ou um personagem com cores parecidas com as do plano de fundo ainda podem exigir a alternativa opcional com IA:

```bash
pnpm backgroundremover:install
```

Depois reinicie Marinara e clique em **Reapply Cleanup** na janela de geração de sprites. Marinara continua tentando primeiro o caminho integrado e só usa o modelo de IA quando a borda não parece uniforme. Se a instalação falhar:

- Confirme que há uma versão do Python entre a 3.9 e a 3.11 instalada. Versões mais novas do Python podem forçar compilações nativas lentas.
- Recompile a ferramenta com `pnpm backgroundremover:reinstall`.
- Para forçar a limpeza automática sem a alternativa com IA enquanto você investiga, defina `SPRITE_BACKGROUND_REMOVAL_ENGINE=builtin` no arquivo `.env`.

### Os storyboards do Game Mode ou do Roleplay não aparecem

Os storyboards do Game Mode transformam uma narração concluída do GM em imagens de quadro-chave e, se você quiser, em pequenos vídeos. Os storyboards do Roleplay reúnem trocas de mensagens já concluídas e mostram o resultado logo abaixo da resposta do assistente.

- Confirme que o agente **Storyboard** foi instalado em **Agents** > **Download Agents** e depois ative **Enable Agents** e **Enable Storyboards** para o chat.
- Para um vídeo de cena manual, gere ou faça upload de uma imagem na **Gallery** e depois use a ação **Video** ou **Animate** dessa imagem. A **Gallery** separa **Images** e **Videos** em abas, então confira a aba **Videos**.
- Para os storyboards automáticos do Game Mode, abra **Chat Settings** > **Agents** > **Storyboards** e confirme que a opção **Automatic Storyboard Illustrations** está ligada. Ligue também **Automatic Storyboard Animations** se quiser os vídeos.
- No Roleplay, adicione o agente **Storyboard** ao chat. Escolha **Still images** ou **Animations**, defina o campo **Messages per episode** e selecione a conexão de imagem do Storyboard. A opção **Manual only** roda pelo botão **Create storyboard** da Gallery.
- As imagens de quadro-chave precisam de uma conexão de imagem. Os vídeos precisam ainda de uma conexão de vídeo.
- Se um prompt personalizado funciona melhor com todos os personagens juntos, desligue a opção **Use NovelAI Character Prompts**.
- Provedores lentos podem estourar o tempo limite. Aumente `IMAGE_GEN_TIMEOUT_MS` ou `VIDEO_GEN_TIMEOUT_MS` no arquivo `.env` e reinicie Marinara. O servidor só lê esses valores na inicialização.

Veja o [Guia do agente Storyboard](game/storyboard.md) para os dois fluxos de trabalho e [Game Mode: primeiros passos](game/getting-started.md) para a configuração do Game.

### A geração de mundo do Game Mode mostra um erro de JSON

Se o início de um jogo falha porque o modelo devolveu um JSON quebrado, Marinara abre a janela **Repair JSON** em vez de descartar o turno inteiro. JSON é o formato de texto estruturado que o modelo precisa devolver.

1. Corrija as chaves, as vírgulas ou os campos no editor. A faixa mostra **JSON is valid.** assim que o texto passa a ser interpretável.
2. Clique em **Format** para organizar a formatação.
3. Clique em **Apply Repaired JSON** para usar o resultado sem gerar a resposta inteira de novo.

## Voz, chamadas e TTS

- Se os personagens não falam durante uma chamada, o Text to Speech (conversão de texto em voz) não está configurado. Abra **Connections** > **Text to Speech**, ative o recurso, escolha uma fonte, informe a chave, escolha uma voz e salve. Um personagem sem voz aparece só em texto.
- Se o microfone não funciona, talvez você precise do modelo de fala local. Instale **Calls** em **Agents > Download Agents**, depois abra **Connections** > **Local Model**, expanda o card, encontre **Local Speech Model**, escolha um modelo Whisper e clique em **Download Whisper**. O Firefox, em especial, precisa disso, porque não tem reconhecimento de fala no navegador. Desinstalar o Calls exclui os modelos Whisper dele para liberar espaço em disco.
- Em uma versão Lite, a mensagem **Local Whisper is disabled in Lite mode** indica que essa versão reduzida não roda o modelo de fala local. Prefira uma instalação completa do Marinara.

### O login do Spotify no Music DJ falha em uma instalação remota ou de rede

O modo Spotify do agente Music DJ usa OAuth. OAuth é um login delegado no qual o Spotify devolve você a um endereço de retorno. A URI de redirecionamento é esse endereço de retorno, e o Spotify só aceita endereços `https://` ou o endereço de loopback `http://127.0.0.1`. Ele recusa endereços IP comuns de rede.

- Se você acessa Marinara pelo localhost, o editor mostra um endereço de retorno em `127.0.0.1`. Registre-o no Spotify e o login se completa.
- Se você acessa Marinara por HTTPS, o editor mostra o endereço de retorno HTTPS. Registre esse.
- Se o HTTPS termina antes do servidor e o host não bate, defina `SPOTIFY_REDIRECT_URI` no arquivo `.env` com o endereço de retorno público.
- Em uma instalação de rede com HTTP simples, a janela pop-up não carrega, mas a barra de endereços ainda guarda um código válido. Copie a URL completa da janela pop-up. Depois expanda **Browser couldn't reach the callback?**, abaixo do botão Connect, e cole a URL ali. A URL colada vale por 10 minutos.

A solução mais limpa a longo prazo é colocar o servidor atrás de HTTPS. Última verificação feita com Marinara Engine 2.2.0. O Spotify endureceu essas regras em fevereiro de 2025.

## Armazenamento e dados

### Os dados parecem ter sumido depois de uma atualização

Se os chats ou os presets parecem ter sumido depois de uma atualização, não exclua nenhuma pasta de dados ainda. Marinara guarda os dados ativos em uma pasta `storage` dentro da pasta de dados dele.

Procure uma pasta `storage` nestes dois locais:

1. `packages/server/data/`
2. `data/`

O servidor mostra na inicialização quais pastas de dados e de armazenamento ele resolveu.

### O backup ou a exportação retorna 403

Sessões de loopback fazem backups sem segredo de administrador. A partir de outro dispositivo, de um endereço de rede ou do Docker, os backups e as exportações de perfil exigem mais. Defina `ADMIN_SECRET` no servidor e salve o mesmo valor em **Settings** > **Advanced** > **Admin Access**. Se você quiser que o loopback também exija o segredo, defina `MARINARA_REQUIRE_ADMIN_SECRET_ON_LOOPBACK=true`.

## Android e Docker

### O aplicativo Android trava em Connecting ou Waiting for Server

O aplicativo Android é uma casca fina em volta do Termux. O Termux é um aplicativo de terminal Linux para Android, e é ele que roda o servidor Marinara de verdade.

1. Toque em **Install / Start Marinara**.
2. Se o Android pedir para instalar o Termux, aprove as solicitações.
3. Se o Android pedir permissão para rodar comandos no Termux, conceda.
4. Espere o inicializador terminar e iniciar o servidor, depois volte ao aplicativo.

Confirme também que o aplicativo e o Termux usam a mesma porta. O padrão é `7860`. Se você compilou o aplicativo com outra porta, defina o mesmo valor na variável `PORT` do arquivo `.env` do Termux.

### Android localhost abre a página de login ou retorna 401/503

As instalações do Termux gerenciadas pelo APK protegem o localhost com um segredo privado por instalação. O aplicativo Android se autentica automaticamente. Em outro navegador no mesmo celular, abra `/android-login` e cole o valor exibido por este comando do Termux:

```bash
cat ~/.marinara-engine/android-secret
```

A CLI local `mari` lê o mesmo arquivo automaticamente. Um erro 401 significa que o segredo colado ou um desafio de autenticação foi rejeitado; recarregue `/android-login` e cole o valor atual. Um erro 503 significa que o servidor recebeu um segredo configurado em formato inválido. Reinicie pelo `./start-termux.sh`; se o inicializador informar que o arquivo de segredo está inválido ou vazio, volte ao aplicativo Android e toque em **Install / Start Marinara** para o APK criá-lo de novo. Não coloque esse segredo em capturas de tela nem em relatos de problemas.

### A atualização no Android para com exit status 134

O código 134 normalmente significa que o Android ficou sem memória durante uma etapa de compilação. Atualize de novo pelo inicializador mais recente:

```bash
./start-termux.sh
```

Se ainda parar, feche outros aplicativos do Android, abra o Termux de novo e rode o comando outra vez.

### O Termux fecha ou reinicia enquanto o Marinara está em execução

O inicializador solicita um wake lock do Android enquanto o servidor está em execução e salva cada sessão do servidor em `~/.marinara-engine/logs/`. Depois de uma reinicialização inesperada, anexe ao relato o arquivo `server-*.log` mais recente. Se o arquivo terminar sem um erro do Marinara ou do Node, é muito provável que o Android ou o fabricante do celular tenha encerrado o Termux fora do processo do servidor.

Permita que o Termux rode em segundo plano e remova a otimização de bateria dele nas configurações do Android. Nos dispositivos compatíveis com o complemento Termux:API, instale esse complemento e o pacote `termux-api` para disponibilizar o `termux-wake-lock`. Essas configurações não evitam todos os encerramentos de processo específicos do fabricante, mas removem a causa comum de suspensão por inatividade, enquanto o log persistente preserva indícios das falhas no nível do aplicativo.

### A atualização no Android fica sem espaço ao instalar as dependências

O aplicativo Marinara compilado não tem vários gigabytes, e o Noodle não baixa modelos de IA próprios. Um consumo temporário grande durante a atualização normalmente vem do repositório de dependências e do repositório virtual do pnpm, principalmente depois de várias versões ou de uma reinstalação forçada interrompida.

O inicializador atual remove os pacotes que sobraram de versões antigas e evita reconstruir o repositório de dependências mais de uma vez na mesma atualização. Se um inicializador antigo já encheu o dispositivo, atualize o inicializador e libere o cache sem referências antes de tentar de novo:

```bash
cd Marinara-Engine
git pull --ff-only
pnpm store prune
./start-termux.sh
```

Não exclua `data`, `storage` nem `marinara-engine.db`; esses locais podem conter os seus chats e configurações. Se o comando ainda parar, copie as linhas a partir de `Installing dependencies` e inclua no relato os números de espaço livre e de memória do celular.

### A atualização dentro do aplicativo falha ao trocar entre Stable e Staging no Android

Trocar de canal (Stable ↔ Staging) força uma reinstalação quase completa das dependências, o que no armazenamento mais lento do Termux pode demorar muito mais do que uma atualização comum. O atualizador dentro do aplicativo agora dá mais tempo para cada etapa no Android, então uma troca de canal que antes parava com um seco `Update failed: Command failed: corepack pnpm ... install` deve chegar ao fim.

Se a atualização ainda falhar, o erro agora informa qual etapa falhou e mostra o final da saída dela. Leia essa mensagem: um erro real de dependência ou de lockfile aparece ali. Você também pode rodar a atualização manualmente pelo Termux, com o comando indicado na dica do erro, ou liberar espaço primeiro:

```bash
cd Marinara-Engine
pnpm store prune
./start-termux.sh
```

### O Noodle mostra `Etc/Unknown` ou as agendas usam o fuso horário errado

Para as agendas do Conversation Mode, abra as Chat Settings do Conversation ou o editor de agenda de um personagem e escolha a opção **Schedule timezone**. Essa escolha global vale para todos os chats do Conversation, inclusive para as mensagens autônomas em segundo plano, e pode ser desfeita com **Use device**.

Para o Noodle ou para tarefas do servidor sem uma escolha própria no Conversation, remova qualquer linha `TZ=` vazia do arquivo `.env` e reinicie Marinara, para que o servidor herde o fuso horário do host. Para definir explicitamente um fuso de reserva do host, use um nome IANA válido, como `TZ=Europe/Warsaw` ou `TZ=America/New_York`. As versões atuais tratam um valor vazio como não definido, mas o reinício continua necessário para que o estado de fuso horário do Node e as tarefas agendadas sejam reconstruídos de forma coerente.

### Permissão negada no contêiner ao montar um volume

Se um contêiner Docker ou Podman falha com erros de permissão no volume de dados:

- Para volumes nomeados depois de uma atualização, baixe a imagem mais recente e reinicie com `docker compose pull && docker compose up -d`. A imagem oficial corrige a propriedade dos arquivos na inicialização.
- Para bind mounts, dê permissão de escrita à pasta do host para o usuário e o grupo de ID `1000`, ou use um volume nomeado.
- Em sistemas com SELinux, como Fedora ou RHEL, acrescente o sufixo `:Z` à montagem do volume.

### O contêiner Lite trava em um Raspberry Pi 4

Se o contêiner lite reinicia sempre que envia uma requisição de IA em um Raspberry Pi 4 ou em outro dispositivo ARM parecido, veja o código de saída. Os códigos 132 ou SIGILL apontam para um problema conhecido, vindo do projeto de origem, na compilação do Node da imagem lite em alguns chips ARM. SIGILL significa que o programa encontrou uma instrução que a CPU não consegue executar.

A imagem comum (não lite) não é afetada. Até a correção do projeto de origem chegar, use a imagem comum nesse dispositivo. Entre as imagens lite afetadas conhecidas estão `1.5.7-lite` e `1.5.8-lite`. Última verificação feita com Marinara Engine 2.2.0.

### A seção External Extensions não aparece em Addons

A seção fica escondida de propósito até que as duas travas de segurança sejam abertas:

1. Defina `ENABLE_EXTERNAL_EXTENSIONS=true` no arquivo `.env` do host.
2. Espere cerca de dois segundos, o tempo do observador de configuração, depois abra **Settings → Advanced → Danger Zone**, role até abaixo dos controles de exclusão de dados e ative a opção **Allow third-party extension imports**.

Se o botão liga/desliga da Danger Zone estiver desativado, a variável do host ainda está como falsa ou o aplicativo ainda não percebeu a mudança. Confirme que você editou o arquivo `.env` ativo, no caminho descrito em [Configuração do servidor](CONFIGURATION.md). No Docker, esse caminho normalmente é `/app/data/.env`.

Enquanto uma das travas estiver fechada, os registros de extensões externas, legadas, importadas de perfil, guardadas manualmente e de origem desconhecida não aparecem nem podem rodar. Abrir as travas de novo não reativa essas extensões automaticamente.

### Uma Browser Extension importada aparece, mas não funciona

Abra a extensão em **Settings → Addons → External Extensions** e veja o campo **Requested access** (acesso solicitado). Pacotes antigos, no formato `marinara.extension` v1 e sem declaração de capacidades, devem mostrar **Full page access**. Aprove apenas o hash exato que você inspecionou e considera confiável.

Se um pacote antigo foi exportado de novo com uma lista de capacidades explicitamente vazia, Marinara o trata como uma extensão segura de sandbox. Nesse caso, o código que depende do DOM não funciona. Acrescente `full_page_access` ao manifesto dele só se você entende que o código passa a ter acesso à página inteira do Marinara, ao armazenamento do navegador, às APIs de rede e à sessão da mesma origem.

Depois de desativar uma extensão com acesso à página inteira, recarregue o Marinara se sobrar algum item da barra de ferramentas, alguma sobreposição, algum listener ou alguma mudança visual. A limpeza é feita da melhor forma possível, porque o código da página pode criar efeitos colaterais fora da API de compatibilidade que Marinara acompanha.

### Uma Server Extension diz que não há sandbox compatível

As Server Extensions só rodam com o Seatbelt do macOS ou o Bubblewrap do Linux. Instale o `bwrap` no host Linux e reinicie Marinara. Windows, Android e outros hosts sem suporte recusam de propósito a execução de Server Extensions, em vez de cair de volta no processo principal do servidor. As Browser Extensions continuam podendo usar o sandbox de Worker com origem opaca.

## Onde buscar mais ajuda

Se você ainda precisa de ajuda, reúna antes bons detalhes.

1. Abra **Settings** > **Advanced** > **Message Tools** e ative o **Debug mode**. Assim o servidor registra no console os dados do prompt e da resposta, e você pode compartilhá-los.
2. Anote o sistema operacional, a versão do Node.js e o texto completo do erro que aparece no console do servidor.

Antes de compartilhar a saída de depuração, remova as chaves de API, os tokens de acesso, os segredos de administrador, os prompts privados e o conteúdo privado dos chats.

Depois procure a comunidade:

- Leia as issues abertas em https://github.com/Pasta-Devs/Marinara-Engine/issues
- Entre no Discord para receber ajuda da comunidade em https://discord.com/invite/KdAkTg94ME
- Abra um relato de bug em https://github.com/Pasta-Devs/Marinara-Engine/issues com os detalhes acima.

## Guias relacionados

- [Perguntas frequentes](FAQ.md)
- [Referência de configuração do servidor](CONFIGURATION.md)
- [Acesso remoto](REMOTE_ACCESS.md)
- [Atualizando Marinara Engine](UPGRADING.md)
- [Conectando a um provedor de IA](connections/connecting-to-a-provider.md)
- [Como configurar o Local Model](connections/local-model.md)
- [Game Mode: primeiros passos](game/getting-started.md)
- [Visão geral das configurações](settings/settings-overview.md)
