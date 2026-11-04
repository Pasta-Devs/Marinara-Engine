# Guia de instalação no macOS / Linux

Instale Marinara Engine em um Mac ou em um computador Linux e inicie-o com o inicializador `start.sh`. Depois disso, Marinara roda no seu próprio computador.

## Antes de começar

Você precisa de duas ferramentas:

- **Node.js** 24, 25 ou 26. É o Node.js que executa Marinara. A versão 24 é a versão LTS (Long Term Support, suporte de longo prazo) recomendada.
- **Git**. O Git baixa Marinara e busca as atualizações.

Você não precisa instalar o pnpm (a ferramenta que instala as partes do aplicativo). O inicializador prepara a versão correta.

### Instalar o Node.js e o Git no macOS

Com o Homebrew, um único comando instala os dois:

```bash
brew install node git
```

Sem o Homebrew, baixe o instalador do Node.js pelo [nodejs.org](https://nodejs.org). Depois instale o Git junto com as ferramentas de linha de comando do Xcode:

```bash
xcode-select --install
```

### Instalar o Node.js e o Git no Linux

Use o gerenciador de pacotes da sua distribuição. No Ubuntu ou no Debian, o Node.js padrão costuma ser mais antigo que a versão 24, então adicione antes a versão do NodeSource:

```bash
curl -fsSL https://deb.nodesource.com/setup_24.x | sudo bash -
sudo apt install -y nodejs git
```

No Fedora:

```bash
sudo dnf install -y nodejs git
```

No Arch:

```bash
sudo pacman -S nodejs npm git
```

### Confira as ferramentas

```bash
node -v
git --version
```

`node -v` precisa mostrar `v24` ou um número maior. Se algum dos comandos responder "command not found", a ferramenta não foi instalada corretamente.

## Instalar e iniciar Marinara

1. Abra um terminal, uma janela onde você digita comandos. No Mac, pressione <kbd>Cmd</kbd>+<kbd>Space</kbd>, digite Terminal e pressione Enter. No Linux, abra o seu aplicativo de terminal.
2. Baixe Marinara.

   ```bash
   git clone https://github.com/Pasta-Devs/Marinara-Engine.git
   ```

3. Entre na nova pasta.

   ```bash
   cd Marinara-Engine
   ```

4. Inicie Marinara com o inicializador, o script que prepara e inicia o aplicativo.

   ```bash
   ./start.sh
   ```

A primeira execução leva alguns minutos, enquanto tudo é baixado e compilado. O terminal mostra o progresso e depois `Press Ctrl+C to stop`. Marinara abre no navegador em `http://127.0.0.1:7860`. Se o navegador não abrir, vá você mesmo para esse endereço.

Se não funcionou:

- `permission denied`: execute `chmod +x start.sh` e depois `./start.sh` de novo.
- `[ERROR] Node.js 24 LTS or newer is required`: o seu Node.js está velho demais. Instale uma versão mais nova e execute `./start.sh` de novo.

## Iniciar e parar Marinara

- **Iniciar de novo:** execute `./start.sh` na pasta do Marinara. Se Marinara já estiver rodando, o script o abre de novo no navegador.
- **Parar:** pressione <kbd>Ctrl</kbd>+<kbd>C</kbd> no terminal.

Sempre que você executa `./start.sh` em uma cópia baixada com o Git, o inicializador:

1. Procura uma versão mais nova e atualiza Marinara se encontrar uma.
2. Confere o Node.js e a versão correta do pnpm.
3. Instala as partes que faltam e recompila o aplicativo se o código mudou.
4. Inicia o servidor e abre o navegador.

## Mudar as configurações do inicializador

As configurações do inicializador ficam em um arquivo `.env` na pasta do Marinara. Um arquivo `.env` é um arquivo de texto simples, com uma configuração por linha. Para impedir que o inicializador abra o navegador, acrescente esta linha:

```bash
AUTO_OPEN_BROWSER=false
```

`PORT` define a porta, o número depois dos dois-pontos no endereço (7860 por padrão). O inicializador deixa outros dispositivos da sua rede local acessarem Marinara, mas os bloqueia até você definir um login. Veja [Acesso remoto](../REMOTE_ACCESS.md).

## Atualizar Marinara

Executar `./start.sh` atualiza Marinara antes de iniciar. Os seus chats, personagens e configurações continuam no lugar. Se você mesmo alterou o código, o inicializador deixa as suas alterações de lado e as devolve depois da atualização. Para pular uma atualização, para o botão **Apply Update** (aplicar a atualização) dentro do aplicativo e para os comandos manuais, veja [Atualizando Marinara Engine](../UPGRADING.md#macos-and-linux).

## Instalação manual sem o inicializador

A maioria das pessoas deve usar o inicializador. Para executar cada etapa por conta própria, você precisa do pnpm. O Node.js 24 inclui o Corepack, uma ferramenta que ativa o pnpm. O Node.js 25 não inclui.

1. No Node.js 24, ative o pnpm:

   ```bash
   corepack enable pnpm
   ```

   No Node.js 25 ou 26, instale antes o Corepack:

   ```bash
   npm install --global corepack
   corepack enable pnpm
   ```

2. Baixe Marinara.

   ```bash
   git clone https://github.com/Pasta-Devs/Marinara-Engine.git
   ```

3. Entre na pasta dele.

   ```bash
   cd Marinara-Engine
   ```

4. Instale as partes, compile o aplicativo e inicie o servidor.

   ```bash
   pnpm install --force
   pnpm build
   pnpm start
   ```

5. Abra `http://127.0.0.1:7860`.

Com `pnpm start`, o servidor escuta apenas no seu próprio computador. Para deixar outros dispositivos se conectarem, acrescente `HOST=0.0.0.0` ao `.env` e reinicie.

## Opcional: removedor de plano de fundo

Marinara pede planos de fundo transparentes nos sprites gerados (as imagens dos personagens) e limpa sozinho os planos de fundo lisos. Como alternativa para cenários detalhados ou sombras, você pode instalar o removedor de plano de fundo opcional com IA. Ele prepara um venv do Python (uma pasta privada para pacotes Python) e baixa arquivos grandes: o PyTorch (uma biblioteca de aprendizado de máquina) e os modelos U2Net (arquivos que encontram o objeto principal de uma imagem).

1. No macOS, o Python 3.11 funciona melhor. Instale-o antes. As versões 3.9 a 3.11 do Python funcionam.

   ```bash
   brew install python@3.11
   ```

2. Na pasta do Marinara, execute:

   ```bash
   pnpm backgroundremover:install
   ```

Para deixar o inicializador instalar a ferramenta na próxima inicialização, acrescente esta linha ao `.env`:

```bash
BACKGROUNDREMOVER_AUTO_INSTALL=true
```

## Se alguma coisa der errado

Em alguns sistemas Linux, a instalação falha com um erro que contém `ERR_PNPM_ENAMETOOLONG` (caminhos de arquivo longos demais). Remova as pastas que ficaram pela metade e execute o inicializador de novo:

```bash
rm -rf node_modules .pnpm .pnpm-store
./start.sh
```

Para mais soluções, veja [Solução de problemas do Marinara Engine](../TROUBLESHOOTING.md).

## Guias relacionados

- [Instalação do Marinara Engine](../INSTALLATION.md)
- [Atualizando Marinara Engine](../UPGRADING.md)
- [Acesso remoto: login e lista de IPs permitidos](../REMOTE_ACCESS.md)
- [Solução de problemas do Marinara Engine](../TROUBLESHOOTING.md)
