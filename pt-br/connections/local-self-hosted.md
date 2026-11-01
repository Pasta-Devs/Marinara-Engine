# Conectar um modelo local ou auto-hospedado

Neste guia você aprende a conectar Marinara Engine a um modelo de IA que roda no seu próprio computador ou no seu próprio servidor. Ele explica os servidores de modelo local mais conhecidos, como Ollama, LM Studio e KoboldCpp, e as configurações que fazem tudo funcionar.

## O que significa auto-hospedado

Um modelo auto-hospedado é um modelo de IA que roda em um equipamento que você controla. Você instala um servidor de modelo local, esse servidor carrega um modelo e responde às requisições em um endereço web da sua máquina. Marinara Engine conversa com esse endereço em vez de usar um serviço de nuvem pago.

Entre os servidores de modelo local mais comuns estão Ollama, LM Studio e KoboldCpp. Cada um roda no seu computador e oferece um endpoint privado. O endpoint é o endereço web onde o servidor fica escutando as requisições.

Este guia trata dos servidores locais externos, que você mesmo instala e mantém rodando. Marinara também traz um modelo pequeno embutido, que dispensa qualquer servidor separado. Se você prefere essa opção, veja o guia [Como configurar o Local Model](local-model.md).

Antes de começar, verifique se o servidor de modelo local já está instalado, rodando e com um modelo carregado. Marinara não inicia esse servidor por você. Ele apenas se conecta.

## Criar uma conexão Custom

Marinara se conecta a servidores locais pelo provedor **Custom (OAI-Compatible)**. Compatível com OAI quer dizer que o servidor usa o mesmo formato de requisição da API Chat Completions da OpenAI. Ollama, LM Studio e KoboldCpp oferecem esse formato.

Siga estes passos para criar a conexão:

1. Abra o painel **Connections** (conexões) no lado direito do aplicativo.
2. Clique em **Add** (adicionar). A janela **Add account** (adicionar conta) abre.
3. Na etapa 1, escolha **Custom (OAI-Compatible)**. Ele aparece em **On your computer** (no seu computador).
4. Na etapa 2, preencha o campo **Address** (endereço) com o endereço do servidor local, conforme a tabela abaixo.
5. Deixe o campo **API key** vazio. A maioria dos servidores locais não precisa de chave. Para dar à conexão um nome como `Ollama Local`, abra **More options** (mais opções) e digite o nome em **Name (optional)**.
6. Clique em **Connect** (conectar).
7. Na etapa 3, escolha um modelo da lista que o servidor informa. Também é possível digitar o ID do modelo à mão. Clique em **Done** (concluir).

A conexão agora aparece no painel **Connections**, com o modelo agrupado abaixo dela. Teste antes de usar em um chat. Veja a seção "Teste a conexão", mais abaixo.

O campo **API Key** é opcional para servidores locais. No provedor **Custom (OAI-Compatible)**, o editor mostra um lembrete embaixo desse campo. Ele avisa que a chave pode ficar vazia em modelos locais como Ollama, LM Studio e KoboldCpp. Basta preencher o **Address**.

## Base URLs dos servidores locais mais comuns

O campo **Address** (também chamado de Base URL) diz a Marinara onde o servidor local está escutando. Cada servidor tem um endereço e uma porta padrão. A porta é o canal numerado que o servidor usa na sua máquina. Use o endereço do servidor que você roda.

| Servidor local | Endpoint |
|---|---|
| Ollama | `http://localhost:11434/v1` |
| LM Studio | `http://localhost:1234/v1` |
| KoboldCpp | `http://localhost:5001/v1` |

Aqui, `localhost` significa "este mesmo computador". Se Marinara roda no mesmo computador que o servidor de modelo, esses endereços funcionam do jeito que estão.

O campo **Address** mostra um aviso de segurança: "Only use URLs from providers you trust. A malicious endpoint could intercept your messages and API keys." Informe apenas um endereço que você mesmo configurou ou em que confia plenamente.

### Observação sobre o firewall do Windows

No Windows, um servidor local pode ficar bloqueado mesmo estando em execução. O editor mostra este aviso no provedor **Custom (OAI-Compatible)**: se o proxy ou o servidor local não for detectado, o Firewall do Windows Defender pode estar bloqueando a conexão. Para resolver, abra a Segurança do Windows, depois Firewall e proteção de rede, depois Permitir um aplicativo pelo firewall, e adicione o Node.js ou o aplicativo do seu servidor.

## O botão Treat as local/custom endpoint

O editor de conexão tem uma seção **Local / Custom Endpoint** com o botão liga/desliga **Treat as local/custom endpoint** (tratar como endpoint local ou personalizado). Ele vem desativado por padrão. Ative para endpoints auto-hospedados ou atrás de proxy, principalmente quando o endereço web personalizado aponta para um servidor de modelo na sua rede local.

Com esse botão desativado, Marinara age com cautela nas chamadas de ferramenta em modelos que não reconhece. Ao ativar, Marinara passa a sempre tentar as chamadas de ferramenta. A Professor Mari também passa a usar um método de ferramenta reserva (um protocolo de ferramentas em JSON), em vez de depender só das chamadas nativas. Professor Mari é a assistente dentro do aplicativo.

Ative esse botão se a Professor Mari parar depois de usar uma ferramenta. Ative também se o endpoint diz ser compatível com a OpenAI, mas não suporta chamadas de ferramenta de forma confiável. Se o modelo local funciona bem sem isso, pode deixar desativado.

## Alcançar um servidor em outro computador

Marinara sempre permite conexões com o seu próprio computador. Endereços como `localhost` e `127.0.0.1` são chamados de endereços de loopback, ou seja, "esta mesma máquina". Eles sempre funcionam em uma conexão, sem configuração extra.

Se o servidor de modelo roda em outro computador da rede de casa ou do trabalho, o endereço é de rede privada. Por segurança, Marinara bloqueia endereços de rede privada por padrão. Para liberar, quem administra o servidor Marinara precisa definir uma variável de ambiente. A variável de ambiente é uma configuração que o servidor lê ao iniciar.

Acrescente esta linha ao arquivo `.env` do servidor:

```
PROVIDER_LOCAL_URLS_ENABLED=true
```

Salve o arquivo e reinicie o servidor Marinara para a mudança valer. Depois disso, a Base URL pode apontar para outra máquina da rede, como `http://192.168.1.50:11434/v1`.

No Android, essa configuração já vem ativada quando você não define nada. Para saber mais sobre o arquivo `.env` e as configurações do servidor, veja a [Referência de configuração do servidor](../CONFIGURATION.md).

## Teste a conexão

O **Connect** do fluxo de adição já verificou a conexão. O editor de modelo tem o cartão **Connection Tests** (testes de conexão) na parte de baixo, para uma segunda verificação. Use antes de depender da conexão em um chat.

1. Clique no modelo dentro do painel **Connections**. O editor de modelo abre.
2. Clique em **Test Connection**. Isso verifica se a Base URL e a configuração estão acessíveis e informa quanto tempo levou.
3. Escolha um modelo, caso ainda não tenha escolhido.
4. Clique em **Send Test Message**. Isso envia a palavra "hi" ao modelo escolhido e mostra a resposta.

Se os dois testes passarem, o modelo local está pronto para uso em um chat. Abra um chat, abra as configurações dele e escolha esta conexão, ou use o menu **Connections** na caixa de mensagem.

O mesmo modelo também pode responder decisões, como perguntas de ativação de agentes, sem que Marinara carregue uma segunda cópia. Clique em **Use this model for decisions** (usar este modelo para decisões) nas configurações da conexão; veja [Modelos de decisão](decision-models.md#on-a-server-you-already-run).

Se um teste falhar, confira primeiro se o servidor local continua rodando e se o modelo está carregado. Depois, confira se o campo **Address** bate exatamente com o endereço e a porta do servidor. No caso de um servidor em outro computador, confirme se a variável `PROVIDER_LOCAL_URLS_ENABLED` está definida e se você reiniciou o servidor Marinara.

## Guias relacionados

- [Conectando a um provedor de IA](connecting-to-a-provider.md)
- [Como configurar o Local Model](local-model.md)
- [Modelos de decisão](decision-models.md)
- [Referência de configuração do servidor](../CONFIGURATION.md)
