# Guia de instalação no Windows

Instale Marinara Engine em um PC com Windows, pelo instalador (o caminho com menos passos) ou a partir do código-fonte. Depois disso, Marinara roda no seu próprio PC.

## Antes de começar

Você precisa do Windows 10 ou do Windows 11 (64 bits), de alguns gigabytes livres no disco e de uma conexão com a internet durante a instalação. O instalador recomenda cerca de 2,5 GB livres.

Você também precisa de duas ferramentas:

- **Node.js** 24, 25 ou 26. É o Node.js que executa o aplicativo. A versão 24 é a versão LTS (Long Term Support, suporte de longo prazo) recomendada.
- **Git**. O Git baixa o código e permite que Marinara se atualize sozinho.

Se você usar o instalador, não precisa instalá-las: ele busca as duas para você. Se instalar a partir do código-fonte, você mesmo as instala. Você não precisa instalar o pnpm (a ferramenta que instala as partes do aplicativo). O instalador e o `start.bat` cuidam disso.

## Instalar com o instalador do Windows

1. Abra a [página de versões do Marinara Engine](https://github.com/Pasta-Devs/Marinara-Engine/releases).
2. Baixe o instalador para Windows mais recente. O nome dele é `Marinara-Engine-Installer-` seguido da versão.
3. Execute o instalador. Se o Windows mostrar "Windows protected your PC", escolha **More info** (mais informações) e depois **Run anyway** (executar assim mesmo), mas só para um arquivo da página de versões.
4. Siga as instruções na tela. Se o Node.js ou o Git estiver faltando, deixe o instalador instalá-lo.
5. Escolha a pasta de instalação, ou aceite a padrão (`%LOCALAPPDATA%\Marinara-Engine`).
6. Espere enquanto ele baixa e compila o aplicativo. Uma lista de progresso mostra cada etapa. Isso leva alguns minutos.
7. Quando ele disser que a instalação terminou, clique duas vezes no atalho **Marinara Engine** da área de trabalho.

Uma janela de console (uma janela preta de texto) se abre e mostra o progresso. Depois o navegador abre Marinara. Se isso não acontecer, vá para `http://127.0.0.1:7860`.

O instalador prepara uma instalação via Git da versão estável mais recente, para que Marinara consiga se atualizar sozinho a cada inicialização.

> **Dica:** alguns antivírus marcam o instalador como suspeito porque ele baixa o Node.js e o Git. Só execute o instalador se você o obteve na página de versões indicada acima.

## Iniciar e parar Marinara

- **Iniciar:** clique duas vezes no atalho da área de trabalho ou na entrada do Menu Iniciar. Em uma instalação a partir do código-fonte, execute `start.bat` na pasta do Marinara.
- **Parar:** o atalho abre uma janela de console. Pressione <kbd>Ctrl</kbd>+<kbd>C</kbd> nela.

Se Marinara já estiver rodando, o atalho o abre de novo no navegador.

## Instalar a partir do código-fonte

Use este método se você prefere rodar os comandos por conta própria, ou se quer a versão staging (de teste).

1. Instale o [Node.js](https://nodejs.org/en/download) e o [Git for Windows](https://git-scm.com/download/win).
2. Abra uma nova janela do Prompt de Comando (uma janela de texto onde você digita comandos).
3. Verifique as duas ferramentas. `node -v` precisa mostrar a versão 24, 25 ou 26.

   ```bat
   node -v
   git --version
   ```

   Se algum comando não for encontrado, feche e abra o Prompt de Comando de novo, ou reinstale a ferramenta que está faltando.

4. Baixe o código.

   ```bat
   git clone https://github.com/Pasta-Devs/Marinara-Engine.git
   ```

5. Entre na pasta dele.

   ```bat
   cd Marinara-Engine
   ```

6. Opcional: mude para a versão staging antes da primeira inicialização. Pule este passo para ficar na versão estável. Faça backup dos seus dados antes de usar a staging.

   ```bat
   git checkout staging
   ```

   Depois disso, o inicializador mantém você na staging quando atualiza.

7. Execute o inicializador, o script que prepara e inicia Marinara.

   ```bat
   start.bat
   ```

A primeira inicialização leva alguns minutos, enquanto tudo é instalado e compilado. Uma janela de console mostra o progresso. O navegador abre Marinara quando estiver pronto. Para iniciar de novo depois, execute `start.bat` na mesma pasta.

Se não funcionou: `[ERROR] Node.js 24 LTS or newer is required` significa que o seu Node.js está velho demais. Instale o Node.js 24 ou mais novo pelo [nodejs.org](https://nodejs.org) e execute `start.bat` de novo.

### Instalação manual sem o inicializador

Este caminho precisa do comando `pnpm`. Execute estes comandos de dentro da pasta `Marinara-Engine`.

1. Instale o pnpm uma vez.

   ```bat
   npm install -g pnpm
   ```

2. Instale as dependências (as partes de que o aplicativo precisa), compile o aplicativo e inicie o servidor.

   ```bat
   pnpm install --force
   pnpm build
   pnpm start
   ```

3. Abra `http://127.0.0.1:7860`.

Com `pnpm start`, só este PC consegue acessar Marinara. Para deixar outros dispositivos se conectarem, crie um arquivo chamado `.env` na pasta `Marinara-Engine`, adicione esta linha e reinicie o servidor.

```env
HOST=0.0.0.0
```

## Abrir Marinara em outro dispositivo

O instalador, o atalho dele e o `start.bat` deixam outros dispositivos da sua rede acessarem Marinara, mas Marinara os bloqueia até você definir um login. Para ver os passos, consulte [Acesso remoto](../REMOTE_ACCESS.md) e as [Perguntas frequentes](../FAQ.md#how-do-i-access-marinara-engine-from-my-phone-or-another-device).

## Atualizar Marinara

Toda vez que você inicia Marinara pelo atalho ou pelo `start.bat`, o inicializador procura atualizações, instala, recompila e inicia. Os seus chats, personagens e configurações continuam no lugar. Se você mesmo alterou o código, o inicializador deixa as suas alterações de lado e as devolve depois da atualização. Se não conseguir, ele mantém a versão atual e mostra um aviso. Para o botão **Apply Update** (aplicar a atualização) dentro do aplicativo, para pular uma atualização e para os comandos manuais, veja [Atualizando Marinara Engine](../UPGRADING.md#windows).

## Encontrar os dados ou desinstalar

Os seus dados ficam na pasta `packages\server\data`, dentro da pasta do Marinara. Para desinstalar, abra a entrada **Uninstall Marinara Engine** (desinstalar o Marinara Engine) do Menu Iniciar. O desinstalador pergunta se também deve excluir os seus dados. Escolha **No** (não) para mantê-los para uma reinstalação futura. Veja [Fazer backup e restaurar o Marinara](../data/backup-and-restore.md).

## Opcional: remoção de plano de fundo dos sprites com IA

Marinara pede planos de fundo transparentes nos sprites gerados e limpa sozinho os planos de fundo lisos. Como alternativa para cenários detalhados, você pode instalar a ferramenta opcional `backgroundremover`. Ela baixa arquivos grandes de aprendizado de máquina, por isso vem desligada por padrão.

1. Instale o Python 3.11 pelo [python.org](https://www.python.org/downloads/windows/). As versões 3.9 a 3.11 do Python funcionam.
2. Execute isto na pasta `Marinara-Engine`.

   ```bat
   pnpm backgroundremover:install
   ```

Isso cria uma pasta privada do Python (um venv) dentro da pasta de dados. Marinara a usa automaticamente.

Para deixar o `start.bat` instalar a ferramenta na próxima inicialização, adicione esta linha ao seu arquivo `.env`:

```env
BACKGROUNDREMOVER_AUTO_INSTALL=true
```

## Se alguma coisa der errado

Verifique se o Node.js está na versão 24, 25 ou 26 e se o Git está instalado. Para mais soluções, veja [Solução de problemas do Marinara Engine](../TROUBLESHOOTING.md).

## Guias relacionados

- [Instalação do Marinara Engine](../INSTALLATION.md)
- [Atualizando Marinara Engine](../UPGRADING.md)
- [Solução de problemas do Marinara Engine](../TROUBLESHOOTING.md)
- [Perguntas frequentes](../FAQ.md)
