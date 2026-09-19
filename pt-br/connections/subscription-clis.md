# Conexões por assinatura do Claude, do ChatGPT e do Grok

Este guia explica as três conexões que entram por uma conta, e não por uma chave de API: **Claude (Subscription)**, **OpenAI (ChatGPT)** e **Grok CLI (Subscription)**. Você instala um programinha de linha de comando, faz login uma vez e Marinara Engine usa essa conta para conversar. Um programa de linha de comando (CLI) é um programa que você executa digitando um comando em uma janela de terminal.

## O que são as conexões por assinatura

A maioria das conexões do Marinara Engine usa uma chave de API. A chave de API é um código secreto, parecido com uma senha, que você cola na conexão para o serviço de IA cobrar da sua conta.

Estas três conexões funcionam de outro jeito. Em vez da chave de API, elas usam um login local. Você entra em um CLI na sua própria máquina e Marinara reaproveita esse login. Nada é colado dentro do Marinara.

Use uma conexão por assinatura quando a sua conta já dá acesso por um destes CLIs:

- **Claude (Subscription)** usa a assinatura **Pro** ou **Max** da Anthropic.
- **OpenAI (ChatGPT)** usa a conta do ChatGPT.
- **Grok CLI (Subscription)** usa a conta **SuperGrok** ou **X Premium+**.

## O que você precisa ter antes

A exigência de conta muda conforme o provedor.

- **Claude (Subscription)** precisa de um plano Claude compatível com o login por assinatura do Claude Code.
- **OpenAI (ChatGPT)** funciona com planos Free e pagos elegíveis do ChatGPT. Os limites de uso variam conforme o plano.
- **Grok CLI (Subscription)** precisa de SuperGrok ou X Premium+.

Nos três provedores, o CLI precisa estar instalado e com login feito na mesma máquina que roda o servidor do Marinara. Não é o navegador nem o celular em que você abre o Marinara. Marinara executa o CLI localmente, então o login tem que ficar ao lado do servidor.

Se você roda Marinara no seu próprio computador, esse computador é o servidor. Se roda em outra máquina ou no Docker, instale e faça login do CLI por lá.

## Claude (Subscription)

Você precisa de uma assinatura Pro ou Max da Anthropic. É o mesmo login que o Visual Studio Code e outras ferramentas da Anthropic usam.

1. Na máquina que roda Marinara, instale o CLI do Claude Code:

```
npm i -g @anthropic-ai/claude-code
```

2. Faça login uma vez:

```
claude auth login
```

3. No Marinara, abra o painel **Connections** (Conexões) e clique em **New** (novo).
4. Na janela **Create Connection** (criar conexão), digite um nome, escolha o provedor **Claude (Subscription)** e clique em **Create**.
5. No editor, repare que não existe o campo **API Key** nem o campo **Base URL**. Um painel informativo confirma que eles não são necessários.
6. Escolha um modelo Claude, como um modelo Opus ou Sonnet, no menu suspenso **Model**.
7. Clique em **Save** (salvar) e depois em **Send Test Message** (enviar mensagem de teste). Uma resposta curta significa que o login está funcionando.

As conexões por assinatura do Claude só têm suporte a chat de texto. Esta conexão traz dois controles a mais, **Fast Mode** e **Diagnose Model Routing**, descritos abaixo.

## OpenAI (ChatGPT)

Você precisa de uma conta do ChatGPT. Marinara conduz o chat pelo login do CLI do Codex.

1. Na máquina que roda Marinara, instale o CLI do Codex:

```
npm i -g @openai/codex
```

2. Faça login uma vez:

```
codex login
```

3. No Marinara, abra o painel **Connections** e clique em **New**.
4. Na janela **Create Connection**, digite um nome, escolha o provedor **OpenAI (ChatGPT)** e clique em **Create**.
5. Escolha um modelo no menu suspenso **Model**. Quando possível, a lista vem da sua sessão do ChatGPT; caso contrário, vem de uma lista interna.
6. Clique em **Save** e depois em **Send Test Message** para confirmar que chega uma resposta.

Marinara lê o arquivo de login local do Codex e renova a sessão sempre que consegue.

## Grok CLI (Subscription)

Você precisa de uma conta SuperGrok ou X Premium+.

1. Na máquina que roda Marinara, instale o CLI do Grok:

```
curl -fsSL https://x.ai/cli/install.sh | bash
```

2. Faça login uma vez:

```
grok login
```

3. No Marinara, abra o painel **Connections** e clique em **New**.
4. Na janela **Create Connection**, digite um nome, escolha o provedor **Grok CLI (Subscription)** e clique em **Create**.
5. Escolha um modelo ou deixe o campo **Model** em branco para usar o padrão do CLI. Para roleplay, o modelo mais seguro costuma ser `grok-composer-2.5-fast`.
6. Clique em **Save** e depois em **Send Test Message**. Esta conexão consegue fazer o teste mesmo sem nenhum modelo definido.

Duas coisas são especiais no Grok CLI. Ele não faz streaming, ou seja, a resposta aparece de uma vez só, e não palavra por palavra. E a janela de contexto vem com 32000 tokens por padrão, menos que a dos outros provedores, porque prompts muito grandes podem estourar o limite de turno do próprio CLI.

Para carregar os modelos do Grok, use o botão **Fetch Models from Grok CLI** na seção **Model**.

## Duração do cache de prompts do Claude

No editor de conexões do Claude, **Prompt Caching → Extended token caching (1 hour)** solicita um cache de uma hora para permitir pausas maiores entre mensagens. É necessário usar Claude Code **2.1.242 ou mais recente**. O Marinara passa a configuração para aquela solicitação sem alterar suas configurações salvas do Claude.

Com a opção desligada, as conversas principais e as solicitações do Agent SDK seguem o padrão do Claude: atualmente uma hora para o uso por assinatura dentro dos limites do plano e cinco minutos para uso extra, créditos ou cobrança por API. Os subagentes do próprio Claude Code usam cinco minutos, salvo configuração separada; algumas solicitações auxiliares controladas pelo servidor podem usar uma hora. As variáveis de ambiente do CLI que substituem esse valor continuam tendo prioridade. Veja [o cache de prompts do Claude Code](https://code.claude.com/docs/en/prompt-caching).

Os logs de depuração separam as gravações de cache de cinco minutos e de uma hora com base no uso informado pelo SDK. Os custos equivalentes usam os multiplicadores padrão de tokens da API, não a sua fatura de assinatura. Quando o SDK não informa a divisão por duração, a estimativa fica desconhecida.

## Por que não existe campo de chave de API

Nos três provedores por assinatura, os campos **API Key** e **Base URL** ficam escondidos. Isso é de propósito. O login mora dentro do CLI, na máquina do servidor, então não há nada para você digitar no Marinara.

Se você escolheu o provedor errado sem querer e não vê o campo da chave, volte ao provedor certo na grade de provedores. Nos provedores baseados em chave de API, o campo reaparece.

## Fast Mode (só no Claude)

O editor do **Claude (Subscription)** tem uma seção **Fast Mode** com um único botão liga/desliga, **Use Claude Code fast-mode routing**. Ele vem desativado por padrão.

Deixe desativado. O próprio aplicativo avisa que o recurso hoje não faz nada. Ele pede ao Claude Code um nível de modelo mais rápido, mas os modelos Claude atuais não oferecem mais isso. Ativar não traz nenhum ganho e ainda pode gerar processamento extra. O controle continua na interface só para o caso de a Anthropic trazer o recurso de volta.

Se você tentar ativar, aparece uma caixa de diálogo de confirmação com o título **YOU DON'T WANT THIS SETTING ON!**. Escolha **Keep it off**.

## Diagnose Model Routing (só no Claude)

O editor do **Claude (Subscription)** tem um botão **Diagnose Model Routing** na área de testes. Use quando você pedir um modelo Claude e desconfiar de ter recebido um menor.

1. Escolha um modelo e clique em **Save**. O botão fica desativado enquanto nenhum modelo estiver selecionado.
2. Clique em **Diagnose Model Routing**.
3. Leia o resultado. Marinara envia um prompt de verdade pelo login do Claude Code. Depois informa qual modelo foi realmente cobrado da sua conta.

Assim você descobre um rebaixamento silencioso, quando você pede um modelo maior, como o Opus, e recebe Sonnet ou Haiku sem aviso.

## Limitações que vale conhecer

- Estas conexões exigem uma assinatura paga e o CLI com login feito na máquina do servidor.
- Nenhuma das três oferece embeddings. A busca semântica dos lorebooks e a memória precisam de uma conexão separada para os embeddings.
- **Claude (Subscription)** só tem suporte a chat de texto.
- **Grok CLI (Subscription)** não faz streaming e começa com uma janela de contexto menor.
- **Send Test Message** exige um modelo escolhido antes, com exceção do Grok CLI, que testa sem nenhum.

## Guias relacionados

- [Conectando a um provedor de IA](connecting-to-a-provider.md)
- [Provedores de IA compatíveis](providers-reference.md)
