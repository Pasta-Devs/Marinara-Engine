# Conectar um modelo local ou auto-hospedado

Este guia conecta Marinara Engine a um modelo de IA que roda no seu próprio computador ou servidor, por meio de um programa como Ollama, LM Studio, KoboldCpp ou llama.cpp. Para o modelo pequeno que Marinara roda sozinho, sem servidor separado, veja [Como configurar o Built-in model](local-model.md).

## Criar uma conexão Custom

No aplicativo, esse tipo de conta se chama **OpenAI-compatible** (compatível com OpenAI). Isso quer dizer que o servidor aceita o mesmo formato de requisição da API de chat da OpenAI. Ollama, LM Studio, KoboldCpp e llama.cpp aceitam.

Antes de começar, instale um servidor de modelo, inicie esse servidor e carregue um modelo nele. Por exemplo, baixe o Ollama em `ollama.com` e siga as etapas dele para baixar um modelo. Marinara se conecta ao servidor e não o inicia por você. O servidor responde às requisições em um endereço web no seu computador, chamado endpoint.

1. Clique em **Connections** (Conexões) na barra superior e depois em **Add** (adicionar). A janela **Add account** (adicionar conta) abre.
2. Em **Chat**, clique no seu servidor: **Ollama**, **LM Studio**, **KoboldCpp** ou **llama.cpp**. Esses cartões têm a etiqueta **Self-hosted** (auto-hospedado). Para qualquer outro servidor, clique em **OpenAI-compatible address** (endereço compatível com OpenAI).
3. Confira **Server address** (endereço do servidor). Nos quatro servidores citados, ele já vem preenchido. Para outro servidor, digite o endereço dele. Veja a tabela abaixo.
4. Deixe **API key (optional)** (chave de API, opcional) vazio. A maioria dos servidores locais não precisa de chave. Para dar um nome à conta, digite um **Name (optional)** (nome, opcional).
5. Clique em **Connect** (conectar). Marinara testa o endereço. **Connected** quer dizer que ele alcançou o servidor.
6. O que acontece depois depende de você já ter um modelo Main. Se não tem, ou se abriu o Add em um chat novo, a janela mostra os modelos que o servidor informa. Escolha um, ou digite o ID de um modelo em **Search or enter model ID…** (buscar ou digitar o ID do modelo), e clique em **Done** (concluir). Se você já tem um modelo Main, a janela fecha e uma mensagem diz que a conta foi adicionada. Depois clique em **⋯** na conta e escolha **Add model** (adicionar modelo).

O painel agora mostra a conta. Teste a conta antes de depender dela (veja [Teste a conexão](#test-the-connection)).

Se não funcionou:

- **Marinara could not reach** o endereço. Confira se o servidor está rodando e se o endereço e a porta batem. **Continue anyway** (continuar mesmo assim) salva a conta sem um teste aprovado.
- O endereço está em outro computador. Veja [Alcançar um servidor em outro computador](#reach-a-server-on-another-computer).

## Endereços dos servidores locais mais comuns

A porta é o canal numerado que o servidor usa no seu computador. `localhost` quer dizer este mesmo computador, então esses endereços funcionam do jeito que estão quando Marinara e o servidor rodam no mesmo computador.

| Servidor | Endereço |
| --- | --- |
| Ollama | `http://localhost:11434/v1` |
| LM Studio | `http://localhost:1234/v1` |
| KoboldCpp | `http://localhost:5001/v1` |
| llama.cpp | `http://localhost:8080/v1` |

Em **Edit model** (editar modelo), o campo de endereço avisa: "Only use URLs from providers you trust. A malicious endpoint could intercept your messages and API keys." Informe apenas um endereço que você mesmo configurou ou em que confia plenamente.

No Windows, um servidor em execução ainda pode ficar bloqueado. Se Marinara não o detecta, o Firewall do Windows Defender pode estar bloqueando o servidor. Abra **Windows Security → Firewall & network protection → Allow an app through firewall** (Segurança do Windows → Firewall e proteção de rede → Permitir um aplicativo pelo firewall) e adicione o Node.js ou o programa do seu servidor.

<a id="test-the-connection"></a>

## Teste a conexão

O **Connect** já verificou o endereço. O editor de modelo tem o cartão **Provider tests** (testes do provedor) para uma segunda verificação.

1. Clique no seu modelo no painel **Connections**. O editor de modelo abre.
2. Clique em **Test provider** (testar provedor). Ele verifica se o endereço está acessível e mostra quanto tempo levou.
3. Escolha um modelo, se ainda não escolheu, e clique em **Send test message** (enviar mensagem de teste). Ele envia uma mensagem curta e mostra a resposta.

Se os dois passarem, abra um chat e escolha a conta em **Model for this chat** (modelo para este chat). Veja [Como escolher um modelo para um chat](connecting-to-a-provider.md#choosing-a-model-for-one-chat).

Se um teste falhar, confira se o servidor está rodando com um modelo carregado e se o endereço e a porta batem exatamente. Para um servidor em outro computador, confira os passos abaixo.

<a id="reach-a-server-on-another-computer"></a>

## Alcançar um servidor em outro computador

Endereços como `localhost` e `127.0.0.1` sempre funcionam. Se o seu servidor de modelo está em outro computador da sua rede, Marinara bloqueia esse endereço privado por padrão. Quem administra o servidor do Marinara pode liberar esse endereço com uma variável de ambiente, uma configuração que o servidor lê ao iniciar.

1. Abra o arquivo `.env` do servidor. Numa instalação normal, ele fica na pasta do projeto Marinara. Para Docker e Podman, veja [Referência de configuração do servidor](../CONFIGURATION.md#edit-the-env-file).
2. Acrescente esta linha:

```
PROVIDER_LOCAL_URLS_ENABLED=true
```

3. Salve o arquivo e reinicie o servidor do Marinara.
4. Use o endereço do outro computador, como `http://192.168.1.50:11434/v1`.

No Android, essa configuração já vem ativada quando você não a define.

## Usar o modelo para decisões

O mesmo modelo pode responder às perguntas de decisão, como as verificações de ativação de agentes, sem carregar uma segunda cópia. Clique em **⋯** no modelo, no painel, e escolha **Use this model for decisions** (usar este modelo para decisões). Essa opção aparece para um modelo OpenAI-compatible que tem um nome de modelo. Veja [Modelos de decisão](decision-models.md#on-a-server-you-already-run).

## O botão Treat as local/custom endpoint

Em **Edit model**, um botão liga/desliga chamado **Treat as local/custom endpoint** (tratar como endpoint local ou personalizado) fica em **Local / custom endpoint**. Ele vem desativado por padrão. Ele só aparece em modelos antigos que não estão ligados a uma conta. Os modelos que você adiciona agora nunca o mostram.

Ative para um proxy ou um servidor auto-hospedado que não é um serviço conhecido. Ele faz Marinara sempre tentar as chamadas de ferramenta e permite que a Professor Mari use um método de ferramenta reserva (um protocolo de ferramentas em JSON) em vez de depender só das chamadas de ferramenta nativas. Ative se a Professor Mari parar depois de usar uma ferramenta, ou se o seu servidor diz ser compatível com a OpenAI mas não lida bem com chamadas de ferramenta. Se o seu modelo funciona sem ele, deixe desativado.

## Guias relacionados

- [Conectando a um provedor de IA](connecting-to-a-provider.md)
- [Como configurar o Built-in model](local-model.md)
- [Modelos de decisão](decision-models.md)
- [Referência de configuração do servidor](../CONFIGURATION.md)
