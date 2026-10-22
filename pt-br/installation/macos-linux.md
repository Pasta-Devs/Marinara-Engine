# Guia de instalação no macOS / Linux

Neste guia você aprende a instalar e executar Marinara Engine no macOS ou no Linux. São três etapas: instalar duas ferramentas obrigatórias, iniciar o aplicativo pelo script de inicialização do shell e atualizar tudo mais tarde. Marinara Engine (chamado só de Marinara daqui em diante) roda inteiramente no seu próprio computador.

## Pré-requisitos

Duas ferramentas gratuitas precisam estar instaladas antes de começar:

- **Node.js**: o programa que executa Marinara. Instale a versão 24, 25 ou 26 (a 24 é a versão LTS recomendada).
- **Git**: a ferramenta que baixa Marinara e busca as atualizações.

Não é preciso instalar o pnpm por conta própria. O pnpm é o gerenciador de pacotes que Marinara usa para buscar seus componentes. O script de inicialização instala a versão correta do pnpm para você.

### Instalação no macOS

O caminho mais fácil é o Homebrew. Este comando instala as duas ferramentas de uma vez:

```bash
brew install node git
```

Se você não usa o Homebrew, baixe o instalador do Node.js em https://nodejs.org. Depois instale o Git junto com as ferramentas de linha de comando do Xcode:

```bash
xcode-select --install
```

### Instalação no Linux

Use o gerenciador de pacotes da sua distribuição. No Ubuntu e no Debian, o Node.js padrão costuma ser mais antigo que a versão 24. Adicione antes a versão mais nova do NodeSource:

```bash
curl -fsSL https://deb.nodesource.com/setup_24.x | sudo bash -
```

Depois instale o Node.js e o Git:

```bash
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

Verifique se as duas ferramentas estão prontas. Execute este comando:

```bash
node -v
```

O resultado deve ser `v24` ou um número maior. Depois execute este comando:

```bash
git --version
```

O resultado deve ser algo como `git version 2.40` ou uma versão superior. Se algum dos comandos responder "command not found", a ferramenta não foi instalada corretamente.

## Início rápido com o script de inicialização

O script `start.sh` é a forma recomendada de executar Marinara. Ele instala tudo, compila o aplicativo e o abre no navegador.

1. Baixe Marinara. Execute este comando:

```bash
git clone https://github.com/Pasta-Devs/Marinara-Engine.git
```

2. Entre na pasta recém-criada. Execute este comando:

```bash
cd Marinara-Engine
```

3. Torne o script executável. Execute este comando:

```bash
chmod +x start.sh
```

4. Inicie Marinara. Execute este comando:

```bash
./start.sh
```

A primeira execução leva alguns minutos, porque tudo é baixado e compilado. No fim, Marinara abre no navegador no endereço http://127.0.0.1:7860. O número 7860 é a porta padrão, ou seja, a porta de entrada que o aplicativo usa no seu computador.

Se o navegador não abrir sozinho, abra você mesmo e vá para esse mesmo endereço.

### O que o script faz a cada execução

Sempre que você executa `./start.sh` a partir de uma cópia baixada com o Git, o script:

1. Procura uma versão mais nova e se atualiza caso encontre alguma.
2. Confirma que o Node.js e a versão correta do pnpm estão prontos.
3. Instala os componentes que estiverem faltando.
4. Recompila o aplicativo quando o código mudou.
5. Prepara o armazenamento local dos seus dados.
6. Inicia o servidor e abre o aplicativo no navegador.

### Como desligar a abertura automática do navegador

Por padrão, o script abre o navegador para você. Para impedir isso, crie um arquivo chamado `.env` na pasta do Marinara e acrescente esta linha:

```bash
AUTO_OPEN_BROWSER=false
```

O arquivo `.env` é um arquivo de texto simples que guarda as configurações, uma por linha. Um `.env` inicial pequeno fica assim:

```bash
PORT=7860
AUTO_OPEN_BROWSER=true
```

A variável `PORT` define a porta do endereço (7860 por padrão). Por padrão, o script também deixa que outros dispositivos da sua LAN alcancem o servidor. LAN quer dizer rede local, a rede da sua casa ou do escritório. Ainda assim, Marinara bloqueia esses dispositivos até você configurar uma senha ou outra forma de acesso. O guia [Acesso remoto: login e lista de IPs permitidos](../REMOTE_ACCESS.md) mostra como fazer isso.

## Instalação manual

A maioria dos usuários deve usar o script apresentado acima. Se você prefere executar cada etapa por conta própria, use os comandos a seguir. Para a instalação manual, o pnpm precisa estar disponível. O Node.js 24 já inclui o Corepack, mas o Node.js 25 não.

1. No Node.js 24, ative o pnpm pelo Corepack:

```bash
corepack enable pnpm
```

No Node.js 25 ou 26, instale antes o pacote Corepack distribuído à parte e só então ative o pnpm:

```bash
npm install --global corepack
corepack enable pnpm
```

2. Baixe Marinara. Execute este comando:

```bash
git clone https://github.com/Pasta-Devs/Marinara-Engine.git
```

3. Entre na pasta. Execute este comando:

```bash
cd Marinara-Engine
```

4. Instale os componentes. Execute este comando:

```bash
pnpm install --force
```

5. Compile o aplicativo. Execute este comando:

```bash
pnpm build
```

6. Inicie o servidor. Execute este comando:

```bash
pnpm start
```

Agora abra http://127.0.0.1:7860 no navegador. Com o comando `pnpm start`, o servidor escuta apenas no seu próprio computador por padrão. Tudo roda localmente, e o armazenamento dos dados é preparado já na primeira inicialização.

### Se a instalação falhar no Linux

Alguns sistemas Linux rejeitam caminhos de arquivo muito longos durante a instalação. Se aparecer um erro com a mensagem `ERR_PNPM_ENAMETOOLONG`, remova as pastas que ficaram pela metade e recomece pelo script. Execute este comando:

```bash
rm -rf node_modules .pnpm .pnpm-store
```

Depois execute este comando:

```bash
./start.sh
```

## Removedor de plano de fundo opcional

Marinara consegue remover o plano de fundo das imagens de sprite dos personagens. O sprite é a imagem do personagem usada nos modos Roleplay e Game. A transparência nativa e a limpeza adaptativa de recorte já embutida funcionam sem esse download. Instale o removedor extra com IA só se você também precisar de uma alternativa para sprites feitos sobre cenários detalhados, sombras ou outros fundos que não sejam lisos; ele baixa arquivos grandes.

Essa ferramenta extra é um programa em Python. A instalação cria um venv do Python (um ambiente virtual, uma pasta separada que guarda os pacotes Python). Ela também baixa o PyTorch, uma biblioteca de aprendizado de máquina. Por último, baixa os modelos U2Net, os arquivos que identificam o objeto principal de uma imagem.

Para instalar tudo isso uma única vez, execute este comando a partir da pasta do Marinara:

```bash
pnpm backgroundremover:install
```

No macOS, o Python versão 3.11 é a escolha mais confiável. Instale-o antes com o Homebrew:

```bash
brew install python@3.11
```

Depois execute o comando de instalação de novo:

```bash
pnpm backgroundremover:install
```

Para que o script instale essa ferramenta na próxima inicialização, acrescente esta linha ao arquivo `.env`:

```bash
BACKGROUNDREMOVER_AUTO_INSTALL=true
```

## Atualização

Quando você inicia Marinara com `./start.sh` a partir de uma cópia baixada com o Git, o script procura uma versão mais nova. Ele se atualiza automaticamente antes de iniciar. Os chats, os personagens e as configurações são mantidos.

Execute `./start.sh --skip-update` para pular uma verificação. Para manter a versão instalada do Engine entre as inicializações, acrescente `AUTO_UPDATE_ENABLED=false` ao arquivo `.env`. A verificação e a atualização manuais continuam disponíveis em **Settings → Advanced → Updates** ou por comandos do Git.

A verificação também pode ser feita dentro do aplicativo. Abra o painel **Settings** (Configurações), vá até a aba **Advanced** e encontre a seção **Updates**. Clique em **Check for Updates** (verificar atualizações) para saber se existe uma versão mais recente. O botão **Apply Update** (aplicar a atualização) vem desativado por padrão. Para ativá-lo, defina algumas opções do servidor. Depois salve um segredo de administrador em **Settings**, **Advanced**, **Admin Access**. Se você não ativar esse botão, basta reiniciar com `./start.sh` para atualizar.

Para conhecer todas as etapas da atualização, incluindo como fazer backup antes e como trocar de canal de versão, veja o guia de atualização indicado abaixo.

## Termos importantes

- **pnpm**: o gerenciador de pacotes que Marinara usa para baixar e organizar seus componentes.
- **Corepack**: um utilitário que vem junto com o Node.js e ativa o pnpm.
- **LAN**: rede local, a rede privada da sua casa ou do escritório.
- **.env**: um arquivo de texto simples com as configurações, guardado na pasta do Marinara, com uma configuração por linha.
- **venv**: um ambiente virtual do Python, uma pasta separada que guarda os pacotes Python.
- **PyTorch**: uma biblioteca de aprendizado de máquina usada pelo removedor de plano de fundo opcional.
- **U2Net**: os arquivos de modelo que o removedor de plano de fundo usa para identificar o objeto principal de uma imagem.

## Guias relacionados

- [Instalação do Marinara Engine](../INSTALLATION.md): escolha o método de instalação certo para o seu dispositivo.
- [Atualizando Marinara Engine](../UPGRADING.md): as etapas completas de atualização e backup em todas as plataformas.
- [Acesso remoto: login e lista de IPs permitidos](../REMOTE_ACCESS.md): configure uma senha para que outros dispositivos alcancem Marinara.
- [Solução de problemas do Marinara Engine](../TROUBLESHOOTING.md): correções para problemas de instalação e de inicialização.
