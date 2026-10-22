# Rodar em contêiner (Docker / Podman)

Neste guia você aprende a rodar Marinara Engine dentro de um contêiner, com Docker ou Podman. Um contêiner é um pacote fechado que já traz o aplicativo e tudo de que ele precisa para funcionar. Não é preciso instalar Node.js nem outras ferramentas no seu computador. Se você está começando agora e só quer ver Marinara rodando, este é o caminho mais fácil.

## Pré-requisitos

Antes de começar, instale uma destas opções na máquina que vai rodar Marinara:

- Docker Desktop (Windows ou macOS) ou Docker Engine (Linux). Docker é a ferramenta de contêiner mais comum.
- Ou Podman. Podman substitui Docker sem mudar nada nos comandos. Ele funciona sem serviço em segundo plano e vai bem sem acesso de root.

Alguns termos que aparecem adiante:

- **Image** (imagem): um modelo somente leitura, baixado da internet, que contém Marinara Engine. Ao executar uma imagem, você cria um contêiner em funcionamento.
- **Volume** (volume): uma área de armazenamento gerenciada pela ferramenta de contêiner. O volume preserva os dados mesmo quando você exclui e recria o contêiner.
- **LAN**: a rede local (o Wi-Fi ou a rede cabeada da sua casa ou do escritório).

As imagens oficiais do Marinara ficam publicadas em `ghcr.io/pasta-devs/marinara-engine`.

## Baixar e rodar

O repositório já traz um arquivo `docker-compose.yml` pronto para uso, na raiz do projeto. O Compose lê esse arquivo e inicia o contêiner para você. Esta é a forma recomendada de rodar Marinara.

1. Consiga uma cópia do repositório. Se você já tem um checkout do Marinara Engine, abra um terminal nessa pasta. Se não tem, clone o repositório antes:

```bash
git clone https://github.com/Pasta-Devs/Marinara-Engine.git
```

2. Entre na pasta:

```bash
cd Marinara-Engine
```

3. Inicie o contêiner em segundo plano:

```bash
docker compose up -d
```

O arquivo `docker-compose.yml` usa a imagem `ghcr.io/pasta-devs/marinara-engine:latest` e baixa essa imagem na primeira vez que você roda o comando. Esse primeiro download pode levar alguns minutos.

## Confira se está funcionando

1. Abra o navegador.
2. Acesse este endereço:

```text
http://127.0.0.1:7860
```

A tela inicial do Marinara Engine deve aparecer. Se aparecer, o contêiner está rodando. O endereço `127.0.0.1` significa "este mesmo computador", e `7860` é a porta padrão em que Marinara escuta.

Se a página não carregar, veja a seção Solução de problemas mais adiante.

## Onde os dados ficam salvos

Os dados (chats, personagens, arquivos enviados, fontes e planos de fundo padrão) são salvos como arquivos comuns. Marinara usa armazenamento em arquivos, ou seja, os dados ficam em arquivos normais, e não dentro de um único arquivo de banco de dados. O Compose guarda esses arquivos em um volume nomeado chamado `marinara-data`.

O Compose coloca o nome da pasta do projeto na frente dos nomes de volume, então o nome real do volume segue o padrão `PROJECT_marinara-data`. Para descobrir o nome exato na sua máquina, liste os volumes:

```bash
docker volume ls --filter name=marinara-data
```

Depois inspecione o volume que apareceu na lista para ver onde ele fica:

```bash
docker volume inspect PROJECT_marinara-data
```

Troque `PROJECT_marinara-data` pelo nome que o comando anterior mostrou.

A cada início, o contêiner prepara a pasta de dados. Por padrão, o contêiner começa como root. Ele corrige o dono da pasta para que o aplicativo consiga escrever nela e, em seguida, troca para um usuário sem privilégios de root, por segurança. Esse reparo vale tanto para o volume nomeado quanto para uma pasta montada a partir do seu host. Com isso, instalações antigas migram para o armazenamento em arquivos sem que você precise rodar nenhum comando manual de permissão.

Marinara também cria um arquivo de configurações vazio em `/app/data/.env` dentro do volume no primeiro início. É nesse arquivo que você adiciona as configurações do servidor depois. Como ele fica no volume, as configurações sobrevivem a reinícios do contêiner e a atualizações de imagem. Veja a [Referência de configuração do servidor](../CONFIGURATION.md) para a lista completa de configurações.

## Abrir Marinara para a rede local (LAN)

Por padrão, o Compose só permite acessar Marinara a partir do mesmo computador. Esse padrão é o mais seguro. Se você quiser abrir Marinara no celular ou em outro computador da rede, precisa fazer duas coisas. Mudar o mapeamento de porta e ativar um login, para que estranhos não cheguem ao aplicativo.

Os outros dispositivos precisam de um login antes de usar Marinara. Nunca exponha Marinara à sua rede sem um.

1. Abra o arquivo `docker-compose.yml` em um editor de texto.

2. Localize a linha da porta. Ela é assim:

```yaml
ports:
  - "127.0.0.1:${PORT:-7860}:7860"
```

3. Remova o trecho `127.0.0.1:` para que o aplicativo fique acessível a partir de outros dispositivos:

```yaml
ports:
  - "${PORT:-7860}:7860"
```

4. No mesmo arquivo, adicione um segredo de administrador à lista `environment:`. Use o seu próprio valor:

```yaml
environment:
  - ADMIN_SECRET=another-long-random-value
```

5. Salve o arquivo e reinicie o contêiner:

```bash
docker compose up -d
```

Agora os outros dispositivos da rede alcançam Marinara em `http://YOUR_COMPUTER_IP:7860`, desde que a variável `PORT` não esteja definida. Se você definir a variável `PORT`, troque `7860` por essa porta do host. Eles veem uma página que pede um login. Para defini-lo, encontre o código de configuração de uso único com `docker logs <container> 2>&1 | grep "setup code"`. Digite o código nessa página com um novo nome de usuário e uma nova senha. Depois, você pode mudar o login em **Settings → Advanced → Access** em um navegador conectado. Se esquecer a senha, execute `docker exec <container> node scripts/reset-login.mjs`. Isso não muda um login vindo de `BASIC_AUTH_USER` e `BASIC_AUTH_PASS`; edite essas variáveis no arquivo compose e recrie o contêiner. Você também pode definir um login no arquivo compose com `BASIC_AUTH_USER` e `BASIC_AUTH_PASS` na lista `environment:`.

No Docker Desktop, no OrbStack e no Docker sem root, todo dispositivo chega ao contêiner pelo mesmo endereço, inclusive o seu próprio navegador. Por isso, depois que o login é definido, este computador também passa a pedi-lo, e uma lista de IPs permitidos não consegue diferenciar os dispositivos. Defina o login antes de remover `127.0.0.1:`. Nesses ambientes, abra Marinara neste computador em `http://localhost:7860` e use **Settings**, ou defina `BASIC_AUTH_USER` e `BASIC_AUTH_PASS` no arquivo compose. Nunca remova `127.0.0.1:` sem o login: nesses ambientes, Marinara não consegue diferenciar os outros dispositivos deste computador. Para conhecer boas formas de liberar apenas certos dispositivos e entender para que serve o segredo de administrador, leia [Acesso remoto: login e lista de IPs permitidos](../REMOTE_ACCESS.md).

## Escolher a imagem: latest, staging ou lite

Marinara publica várias tags de imagem. Escolha a que atende à sua necessidade.

- `latest` é a versão estável recomendada. O arquivo `docker-compose.yml` usa essa tag por padrão.
- `X.Y.Z` é uma versão fixa, como `ghcr.io/pasta-devs/marinara-engine:2.0.6`. Use quando quiser travar uma versão exata.
- `staging` é uma build de teste instável, feita a partir do código de desenvolvimento mais recente. Use apenas para experimentar mudanças ainda não lançadas. Ela pode quebrar, pode mudar de comportamento sem aviso e pode impedir a volta dos dados para uma build estável.
- `lite` é uma imagem menor. A próxima seção explica essa imagem.

Se você rodar a imagem `staging`, use um volume separado, para que uma build instável não altere os dados estáveis:

```bash
docker run -d --name marinara-staging -p 127.0.0.1:7860:7860 -v marinara-staging-data:/app/data ghcr.io/pasta-devs/marinara-engine:staging
```

### A imagem lite

A imagem lite é uma variante reduzida: ela abre mão de alguns recursos offline em troca de um download bem menor. Ela é construída sobre o Wolfi, uma base Linux mínima feita para contêineres.

A imagem lite remove os recursos que dependem de arquivos locais grandes:

| Removido na lite | O que você perde |
| --- | --- |
| Modelo local (Gemma, roda na sua máquina) | Não é possível rodar um modelo de IA no seu próprio hardware. |
| Modelo local de embedding | Sem embeddings de texto no dispositivo. |
| Memory Recall (busca semântica) | Depende do modelo local de embedding. |
| Entrada de voz com Whisper local | A conversão de fala em texto nas chamadas de Conversation deixa de existir. |
| Leitor de humor dos avatares | Os 2D Avatars e 3D Avatars escolhem os rostos por uma lista de palavras, em vez do pequeno modelo local de emoções. |

Todo o resto funciona igual: chat, roleplay, Game Mode, agentes, lorebooks, personagens e conexões com provedores de IA remotos. Para usar qualquer recurso de IA com a imagem lite, você precisa conectar um provedor externo (por exemplo OpenRouter, OpenAI ou um modelo hospedado por você). Veja [Conectando a um provedor de IA](../connections/connecting-to-a-provider.md).

A tag lite é `ghcr.io/pasta-devs/marinara-engine:lite`, e cada versão também publica uma tag lite presa à versão, como `ghcr.io/pasta-devs/marinara-engine:X.Y.Z-lite`. Para rodar:

```bash
docker run -d --name marinara-lite -p 127.0.0.1:7860:7860 -v marinara-data:/app/data ghcr.io/pasta-devs/marinara-engine:lite
```

Algumas imagens lite mais antigas travam no Raspberry Pi 4 e em computadores ARM parecidos. A falha mostra um erro `SIGILL` (erro de instrução ilegal, vindo do processador) durante as chamadas de saída ao provedor de IA. Se você usa um desses dispositivos, rode a imagem `latest` comum. Veja [Solução de problemas do Marinara Engine](../TROUBLESHOOTING.md) para os detalhes atuais.

## Atualizar

As imagens de contêiner não se atualizam sozinhas. Você baixa uma imagem mais nova e reinicia o contêiner na mão. Faça um backup antes, para poder voltar exatamente ao ponto em que estava. Veja [Fazer backup e restaurar Marinara](../data/backup-and-restore.md).

No Docker Compose, rode este único comando:

```bash
docker compose pull && docker compose up -d
```

No Podman Compose, rode este único comando:

```bash
podman compose pull && podman compose up -d
```

A versão também pode ser conferida dentro do aplicativo. Abra **Settings** (Configurações), vá até a aba **Advanced** e localize a seção **Updates**. Clique em **Check for Updates**. Em instalações por contêiner, Marinara percebe que está rodando no Docker e mostra a tag da imagem de lançamento junto com o comando a rodar no host. A atualização não pode ser aplicada pelo navegador, então você ainda roda o comando acima no host.

Para voltar a uma versão anterior, coloque a tag dessa versão na linha `image:` do `docker-compose.yml`, por exemplo `ghcr.io/pasta-devs/marinara-engine:2.5.0`, e depois rode `docker compose up -d`. Voltar para a 2.5.0 funciona e os seus chats abrem normalmente, mas a 2.5.0 não conhece as configurações e os dados de jogo que os recursos mais novos acrescentaram. Todo chat ou conexão que a 2.5.0 salvar perde esses dados, e atualizar de novo não os traz de volta. Veja [Voltar para a 2.5.0](../UPGRADING.md#going-back-to-250).

## Podman

Podman roda as mesmas imagens que o Docker. Na maioria dos casos, basta trocar `docker` por `podman` nos comandos acima.

Para começar com o Compose:

```bash
podman compose up -d
```

Para rodar um único contêiner sem o Compose:

```bash
podman run -d -p 127.0.0.1:7860:7860 -v marinara-data:/app/data ghcr.io/pasta-devs/marinara-engine:latest
```

O comando `podman compose` precisa do auxiliar `podman-compose`. Instale esse auxiliar com o comando do seu sistema.

No Fedora:

```bash
sudo dnf install podman-compose
```

No Debian ou Ubuntu:

```bash
sudo apt install podman-compose
```

Com o pip:

```bash
pip install podman-compose
```

## Construir a imagem por conta própria

Se você prefere construir a imagem a partir do código-fonte em vez de baixá-la:

```bash
docker build -t marinara-engine .
```

Depois rode a sua própria build:

```bash
docker run -d -p 127.0.0.1:7860:7860 -v marinara-data:/app/data marinara-engine
```

Para construir a imagem lite a partir do código-fonte, aponte o Docker para o arquivo de build da lite:

```bash
docker build -f Dockerfile.lite -t marinara-engine:lite .
```

## Solução de problemas

**A página não carrega, ou a porta já está em uso.** Outro programa pode já estar usando a porta `7860`. Mude o mapeamento de porta para uma porta livre, como `8080:7860` na lista `ports:`. Depois reinicie com o comando `docker compose up -d` e abra `http://127.0.0.1:8080`.

**Marinara não consegue escrever arquivos, ou aparecem erros de permissão.** O contêiner corrige o dono da pasta de dados a cada início. Isso vale para volumes nomeados e para pastas montadas a partir do seu host. O reparo pode falhar em alguns sistemas de arquivos do host, e ele é ignorado se você definir `MARINARA_SKIP_DATA_CHOWN=true`. Se os erros continuarem, use o volume nomeado padrão `marinara-data`. Ele é a opção mais confiável.

**A imagem lite trava em um Raspberry Pi 4.** Veja a observação sobre a imagem lite mais acima. Use a imagem `latest` comum nesse hardware.

Para mais ajuda, leia [Solução de problemas do Marinara Engine](../TROUBLESHOOTING.md).

## Guias relacionados

- [Referência de configuração do servidor](../CONFIGURATION.md)
- [Acesso remoto: login e lista de IPs permitidos](../REMOTE_ACCESS.md)
- [Solução de problemas do Marinara Engine](../TROUBLESHOOTING.md)
