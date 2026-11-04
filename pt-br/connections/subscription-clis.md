# Conexões por assinatura do Claude, do ChatGPT e do Grok

Três serviços deixam você conversar com um plano que você já paga, em vez de uma chave de API: **Claude (Subscription)**, **OpenAI (ChatGPT)** e **Grok CLI (Subscription)**. Você instala um pequeno programa de linha de comando (CLI) e faz login uma vez. Depois disso, Marinara Engine reaproveita esse login. Nada é colado no Marinara.

O plano de que você precisa:

- **Claude (Subscription)**: Anthropic Pro ou Max, ou outro plano que o Claude Code aceite.
- **OpenAI (ChatGPT)**: uma conta do ChatGPT. Os limites de uso dependem do plano.
- **Grok CLI (Subscription)**: SuperGrok ou X Premium+.

## Como adicionar uma conta por assinatura

Antes de começar, saiba que o CLI precisa estar instalado e com login feito no computador que roda o servidor do Marinara. Não é o celular nem o navegador em que você abre o Marinara. Se Marinara roda em outro computador ou no Docker, faça os passos 1 e 2 lá. Os comandos `npm` precisam do Node.js, que você já tem se instalou Marinara a partir do código-fonte. Veja [Instalação](../INSTALLATION.md).

1. Abra um terminal no computador que roda Marinara. O terminal é a janela em que você digita comandos. No Windows, abra o PowerShell. No macOS, abra o Terminal.
2. Execute o comando de instalação do seu serviço e depois o comando de login dele. A ferramenta mostra as próprias etapas de login, em geral uma página da web em que você entra na sua conta.

| Serviço | Instalação | Login |
| --- | --- | --- |
| Claude | `npm i -g @anthropic-ai/claude-code` | `claude login` |
| ChatGPT | `npm i -g @openai/codex` | `codex login` |
| Grok | veja abaixo | `grok login` |

No Grok, o aplicativo mostra este comando de instalação. Se ele não funcionar no seu sistema, siga as instruções da própria x.ai para o Grok CLI.

```bash
curl -fsSL https://x.ai/cli/install.sh | bash
```

3. No Marinara, clique em **Connections** (Conexões) na barra superior e depois em **Add** (adicionar).
4. Em **Chat**, clique no seu serviço. Esses serviços têm a etiqueta **Sign in** (entrar).
5. A janela diz **Sign in first** (faça login primeiro) e mostra o comando. Não existe campo de chave. Clique em **Connect** (conectar). Marinara testa o login. **Connected** quer dizer que funciona.
6. Escolha um modelo da lista e clique em **Done** (concluir). No Grok CLI você também pode deixar o modelo vazio, o que usa o padrão do próprio CLI (veja [Grok CLI (Subscription)](#grok-cli-subscription)).

Envie uma mensagem em um chat para confirmar. Uma resposta quer dizer que funciona.

Se não funcionou:

- **Marinara could not use the login on this computer.** O CLI não está instalado ou não tem login feito no computador do Marinara. Execute o comando de login lá e clique em **Try again** (tentar de novo).

## Claude (Subscription)

As seções daqui em diante são configurações opcionais. Você não precisa delas para conversar.

Este serviço usa o seu plano do Claude por meio do Claude Code. Ele tem três controles a mais no editor do modelo (**Edit model**): o cache de prompts, **Fast mode** e **Diagnose model routing** (diagnosticar o roteamento do modelo).

### Cache de tokens estendido

O cache de prompts permite que o Claude reaproveite o início do seu prompt, para que as requisições repetidas gastem menos do seu limite. **Prompt caching → Extended token caching (1 hour)** (cache de prompts → cache de tokens estendido: 1 hora) pede um cache de uma hora, o que ajuda quando você faz pausas entre as mensagens. Isso exige o Claude Code 2.1.242 ou mais recente. Marinara envia a configuração com a requisição e não altera as suas configurações salvas do Claude.

Quando a opção está desligada, o Claude usa o próprio padrão para a sua conta. Veja [o cache de prompts do Claude Code](https://code.claude.com/docs/en/prompt-caching).

### Fast mode

**Fast mode → Use Claude Code fast-mode routing** (modo rápido → usar o roteamento de modo rápido do Claude Code) vem desativado por padrão. Deixe desativado. Ele pede ao Claude Code um nível de modelo mais rápido, mas o aplicativo diz que os modelos atuais não oferecem mais isso, então ativar não traz nenhum ganho e pode gerar processamento extra. Se você tentar ativar, aparece uma caixa de diálogo com o título **Turn on fast mode?** (ativar o modo rápido?). Clique em **Keep it off** (manter desativado).

### Diagnose model routing

Use **Diagnose model routing** quando você pediu um modelo grande, como o Opus, mas desconfia de ter recebido um menor.

1. Escolha um modelo. O botão fica desativado enquanto não houver um modelo definido.
2. Clique em **Diagnose model routing**. Marinara salva antes as mudanças não salvas.
3. Leia o resultado. Marinara envia um prompt de verdade pelo seu login do Claude Code e informa qual modelo foi cobrado da sua conta.

## OpenAI (ChatGPT)

Este serviço usa a sua conta do ChatGPT por meio do CLI do Codex. Marinara lê o arquivo de login local do Codex e renova a sessão sempre que consegue.

Para definir quanto tempo o Codex pensa antes de responder, abra **Edit model**, ative **Use custom defaults for this model** (usar padrões personalizados para este modelo) e escolha um nível em **Reasoning Effort** (esforço de raciocínio). O ajuste começa em **Default**, que mantém o nível próprio do Codex para o modelo. Um chat pode escolher o próprio nível em **Advanced Parameters** (parâmetros avançados). O nível definido em um preset não muda isso. Um modelo Codex usado como reserva segue apenas o próprio nível, e os agentes que usam o modelo seguem o nível do modelo. Os níveis que você vê correspondem aos disponíveis para o modelo escolhido.

## Grok CLI (Subscription)

Este serviço roda o Grok CLI no computador do Marinara. Duas coisas são diferentes dos outros serviços:

- Ele não faz streaming. A resposta aparece de uma vez só, e não palavra por palavra.
- A janela de contexto dele vem com 32.000 tokens por padrão. Os tokens são pedacinhos de texto que os modelos contam. Prompts grandes podem estourar o limite de turno do próprio CLI, por isso o padrão fica baixo. Você pode definir um **Max Context Window** (janela de contexto máxima) maior no modelo.

No editor do modelo, **Use the Grok CLI default** (usar o padrão do Grok CLI) deixa o modelo vazio para que o CLI escolha o próprio. O editor indica `grok-composer-2.5-fast` como, em geral, o modelo mais seguro para roleplay, porque Marinara roda o CLI sem interface, com as ferramentas, a memória, a busca na web, os planos e os subagentes do próprio Grok desativados.

## Uso do plano

As contas Claude (Subscription) e OpenAI (ChatGPT) podem mostrar quanto dos limites do seu plano você já usou.

1. Clique em **⋯** na linha da conta, escolha **Edit account** (editar conta) e abra **Usage and balance** (uso e saldo).
2. Se as leituras externas estiverem desativadas, clique em **Turn on** (ativar).
3. Ative **Show the usage meter on the card** (mostrar o medidor de uso no card) e salve.

Cada período de limite ganha uma barra com a porcentagem usada e quando ele é renovado, por exemplo `58% · resets in 2h`. As mesmas barras aparecem no seletor de conexão de um chat e nas configurações **Connection** do chat enquanto essa conta está ativa. Elas não aparecem no **Shuffle**.

- As barras contam tudo no seu plano, não só o Marinara. No Claude, isso inclui o Claude Code e o claude.ai. No ChatGPT, inclui todo uso do Codex, como o CLI do Codex. Os chats no chatgpt.com têm limites próprios e não entram na conta.
- Os serviços informam uma porcentagem para cada período, sem contagem de tokens.
- Uma leitura pede ao CLI no computador do Marinara os mesmos dados que o próprio comando de uso dele mostra. Ela não envia nenhuma mensagem a um modelo e não gasta nada do seu plano. O botão de atualizar faz a leitura de novo.
- Um plano com um só período mostra uma barra só.
- O Claude Code marca os dados de uso como experimentais. Se uma versão nova mudar esses dados, as barras mostram um erro e um botão de tentar de novo, em vez de um número errado.

## Limitações destes serviços

- Eles precisam de um plano pago (ou de um plano elegível do ChatGPT) e do CLI com login feito no computador do Marinara.
- Nenhum deles oferece embeddings. A busca semântica dos lorebooks e o Memory Recall precisam de uma conta separada para os embeddings.
- **Send test message** (enviar mensagem de teste) exige um modelo escolhido antes, exceto no Grok CLI.

## Guias relacionados

- [Conectando a um provedor de IA](connecting-to-a-provider.md)
- [Provedores de IA compatíveis](providers-reference.md)
