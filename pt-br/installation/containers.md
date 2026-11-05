# Rodar em contêiner (Docker / Podman)

Rode Marinara Engine em um contêiner, com Docker ou Podman. Um contêiner é um pacote que traz o aplicativo e tudo de que ele precisa, então você não instala o Node.js. Se você quer ver Marinara rodando com o mínimo de configuração, comece por aqui.

## Antes de começar

Instale uma destas opções no computador que vai rodar Marinara:

- Docker Desktop (Windows ou macOS) ou Docker Engine (Linux).
- Podman, um substituto do Docker que não precisa de serviço em segundo plano e funciona sem acesso de root.

Termos usados adiante:

- **Imagem:** uma cópia do Marinara, somente leitura, que você baixa. Você executa uma imagem para criar um contêiner.
- **Volume:** uma área de armazenamento que a ferramenta de contêiner gerencia. Ela preserva os seus dados quando você exclui e recria o contêiner.

As imagens oficiais ficam em `ghcr.io/pasta-devs/marinara-engine`.

<a id="start-marinara"></a>

## Iniciar Marinara

O projeto traz um arquivo `docker-compose.yml` pronto para uso. O Compose é a parte do Docker que lê esse arquivo e inicia o contêiner. Esta é a forma recomendada.

1. Abra um terminal, uma janela onde você digita comandos. Se você já tem um checkout do Marinara, abra o terminal nessa pasta e pule os dois próximos passos.
2. Baixe os arquivos do projeto.

   ```bash
   git clone https://github.com/Pasta-Devs/Marinara-Engine.git
   ```

3. Entre na nova pasta.

   ```bash
   cd Marinara-Engine
   ```

4. Inicie o contêiner em segundo plano.

   ```bash
   docker compose up -d
   ```

   A primeira execução baixa a imagem `ghcr.io/pasta-devs/marinara-engine:latest`, o que pode levar alguns minutos. Quando termina, o terminal mostra o contêiner como `Started`.

5. Abra `http://127.0.0.1:7860` no navegador. A tela inicial do Marinara carrega.

Se não funcionou: outro programa pode estar usando a porta `7860`. Escolha uma porta livre, como `8080`. Crie um arquivo chamado `.env` na mesma pasta do `docker-compose.yml`, com a linha `PORT=8080`, e execute `docker compose up -d` de novo. O Compose lê esse arquivo toda vez, então as próximas atualizações mantêm a porta nova. Depois abra `http://127.0.0.1:8080`. Outras soluções estão em [Solução de problemas](#troubleshooting).

## Parar Marinara

Execute isto na mesma pasta. O comando para e remove o contêiner. Os seus dados continuam no volume.

```bash
docker compose down
```

No Podman, use `podman compose down`.

## Onde os dados ficam salvos

Marinara salva os seus chats, personagens, arquivos enviados, fontes e planos de fundo padrão como arquivos comuns, em um volume do Compose chamado `marinara-data`. O Compose coloca o nome da pasta do projeto na frente, então o nome real fica parecido com `PROJECT_marinara-data`. Para descobrir o nome exato e onde o volume fica:

```bash
docker volume ls --filter name=marinara-data
docker volume inspect PROJECT_marinara-data
```

Troque `PROJECT_marinara-data` pelo nome que o primeiro comando mostrou.

Marinara também cria um arquivo de configurações vazio em `/app/data/.env`, dentro do volume, na primeira inicialização. Adicione as configurações do servidor nesse arquivo. Elas sobrevivem a reinícios e a atualizações de imagem. Veja a [Referência de configuração do servidor](../CONFIGURATION.md).

A cada inicialização, o contêiner corrige o dono da pasta de dados para que o aplicativo consiga escrever nela. Ele começa como root, corrige o dono e depois troca para um usuário sem privilégios de root. Isso funciona para o volume e para uma pasta que você monta a partir do seu computador.

<a id="open-marinara-from-another-device"></a>

## Abrir Marinara em outro dispositivo

Por padrão, o Compose só deixa este computador acessar Marinara. Para abrir no celular ou em outro computador, publique a porta em todas as interfaces e defina um login antes. Nunca exponha Marinara à sua rede sem um login.

O Docker Desktop, o OrbStack e o Docker sem root (rootless) mostram todos os dispositivos como um único endereço de gateway. Sem um login, uma porta publicada em todas as interfaces deixa todo mundo entrar. Depois que um login é definido, este computador também precisa informá-lo. Veja [Liberação para Tailscale e Docker](../REMOTE_ACCESS.md#tailscale-and-docker-bypass).

1. Abra o `docker-compose.yml`, que fica na pasta do Marinara, em um editor de texto.
2. Na lista `ports:`, remova `127.0.0.1:`.

   ```yaml
   ports:
     - "${PORT:-7860}:7860"
   ```

3. Na lista `environment:`, adicione um segredo de administrador. Use o seu próprio valor, longo e aleatório.

   ```yaml
   environment:
     - ADMIN_SECRET=another-long-random-value
   ```

4. Na mesma lista, adicione um login. Use o seu próprio nome de usuário e uma senha longa e aleatória.

   ```yaml
   - BASIC_AUTH_USER=your-username
   - BASIC_AUTH_PASS=another-long-random-password
   ```

5. Salve o arquivo e reinicie o contêiner.

   ```bash
   docker compose up -d
   ```

6. No outro dispositivo, abra `http://YOUR_COMPUTER_IP:7860`. Se você definiu `PORT`, use essa porta. A página pede o seu login.

Se você deixar de fora `BASIC_AUTH_USER` e `BASIC_AUTH_PASS`, a página pede um código de configuração de uso único no lugar. Encontre o código nos logs e depois digite-o na página com um novo nome de usuário e uma nova senha.

```bash
docker logs <container> 2>&1 | grep "setup code"
```

Depois, você pode mudar um login do aplicativo em **Settings → Advanced → Access** (Configurações → Avançado → Acesso), em um navegador conectado. Se esquecer a senha, execute `docker exec <container> node scripts/reset-login.mjs`. Esse comando não muda um login vindo de `BASIC_AUTH_USER` e `BASIC_AUTH_PASS`. Edite essas variáveis no arquivo compose e recrie o contêiner.

No Docker Desktop, no OrbStack e no Docker sem root, abra Marinara neste computador em `http://localhost:7860` para definir o login em **Settings**. Nesses ambientes, uma lista de IPs permitidos não consegue diferenciar os dispositivos, então use um login. Para outras formas de limitar o acesso, e para saber o que o segredo de administrador faz, veja [Acesso remoto: login e lista de IPs permitidos](../REMOTE_ACCESS.md).

## Atualizar Marinara

Os contêineres não se atualizam sozinhos. Faça um backup antes (veja [Fazer backup e restaurar o Marinara](../data/backup-and-restore.md)) e depois baixe a nova imagem e reinicie. Execute isto na pasta que contém o `docker-compose.yml`:

```bash
docker compose pull && docker compose up -d
```

No Podman, use `podman compose` no lugar. No aplicativo, **Settings → Advanced → Updates → Check for Updates** mostra a tag da imagem e esse comando. O aplicativo não consegue aplicar a atualização sozinho em um contêiner.

Para voltar a uma versão mais antiga, coloque a tag dela na linha `image:` do `docker-compose.yml` e depois execute `docker compose up -d`. Antes, veja [Como voltar para uma versão anterior](../UPGRADING.md#downgrading-to-an-older-version). As compilações mais antigas não conseguem abrir dados que as compilações mais novas salvaram.

## Escolher uma tag de imagem

| Tag | O que é |
| --- | --- |
| `latest` | A versão estável. O `docker-compose.yml` usa essa tag. |
| `X.Y.Z` | Uma versão fixa, como `ghcr.io/pasta-devs/marinara-engine:2.5.1`. |
| `staging` | Uma compilação de teste instável, com código ainda não lançado. Ela pode quebrar, e talvez você não consiga levar os seus dados de volta para uma compilação estável. |
| `lite` | Uma imagem menor. Veja abaixo. |
| `X.Y.Z-lite` | Uma versão fixa da imagem lite. |

Se você rodar `staging`, use um volume separado, para que ela não altere os seus dados estáveis:

```bash
docker run -d --name marinara-staging \
  -p 127.0.0.1:7860:7860 \
  -v marinara-staging-data:/app/data \
  ghcr.io/pasta-devs/marinara-engine:staging
```

### A imagem lite

A imagem lite é um download menor, construído sobre o Wolfi, uma base Linux mínima para contêineres. Ela deixa de fora os recursos que precisam de arquivos locais grandes:

| Fora da lite | O que você perde |
| --- | --- |
| Built-in model (modelo embutido) | Não é possível rodar um modelo de IA no seu próprio hardware. |
| Modelo local de embedding | Sem embeddings de texto no dispositivo. |
| Memory Recall (busca semântica) | Depende do modelo local de embedding. |
| Entrada de voz com o Local Whisper | Sem conversão de fala em texto nas chamadas de Conversation. |
| Leitor de humor dos avatares | Os 2D Avatars e 3D Avatars escolhem os rostos por uma lista de palavras, e não pelo pequeno modelo local de emoções. |

Todo o resto funciona: chat, roleplay, Game Mode, agentes, lorebooks, personagens e serviços de IA remotos. Para os recursos de IA, você precisa adicionar uma conta de um serviço externo. Veja [Conectando a um provedor de IA](../connections/connecting-to-a-provider.md).

```bash
docker run -d --name marinara-lite \
  -p 127.0.0.1:7860:7860 \
  -v marinara-data:/app/data \
  ghcr.io/pasta-devs/marinara-engine:lite
```

Algumas imagens lite mais antigas falham no Raspberry Pi 4 e em computadores ARM parecidos, com um erro `SIGILL` (erro de instrução ilegal), durante as chamadas de saída para a IA. Nesses dispositivos, use a imagem `latest` comum. Veja [Solução de problemas do Marinara Engine](../TROUBLESHOOTING.md) para os detalhes atuais.

## Podman

O Podman roda as mesmas imagens. Na maioria dos comandos, troque `docker` por `podman`.

```bash
podman compose up -d
```

Para rodar um único contêiner sem o Compose:

```bash
podman run -d \
  -p 127.0.0.1:7860:7860 \
  -v marinara-data:/app/data \
  ghcr.io/pasta-devs/marinara-engine:latest
```

O `podman compose` precisa do auxiliar `podman-compose`. Instale-o com um destes comandos:

```bash
sudo dnf install podman-compose
sudo apt install podman-compose
pip install podman-compose
```

A primeira linha é para o Fedora, a segunda para o Debian ou o Ubuntu, e a terceira funciona em qualquer sistema que tenha o pip.

## Construir a imagem por conta própria

Para construir a partir do código-fonte em vez de baixar:

```bash
docker build -t marinara-engine .
docker run -d -p 127.0.0.1:7860:7860 -v marinara-data:/app/data marinara-engine
```

Para construir a imagem lite, use o arquivo de build da lite:

```bash
docker build -f Dockerfile.lite -t marinara-engine:lite .
```

<a id="troubleshooting"></a>

## Solução de problemas

**A página não carrega, ou a porta já está em uso.** Veja a solução da porta em [Iniciar Marinara](#start-marinara).

**Marinara não consegue escrever arquivos, ou aparecem erros de permissão.** O contêiner corrige o dono da pasta a cada inicialização. A correção pode falhar em alguns sistemas de arquivos do host, e ela é ignorada se você definir `MARINARA_SKIP_DATA_CHOWN=true`. Se os erros continuarem, use o volume padrão `marinara-data`. Ele é o mais confiável.

**A imagem lite falha em um Raspberry Pi 4.** Use a imagem `latest` comum.

Para mais ajuda, veja [Solução de problemas do Marinara Engine](../TROUBLESHOOTING.md).

## Guias relacionados

- [Referência de configuração do servidor](../CONFIGURATION.md)
- [Acesso remoto: login e lista de IPs permitidos](../REMOTE_ACCESS.md)
- [Solução de problemas do Marinara Engine](../TROUBLESHOOTING.md)
