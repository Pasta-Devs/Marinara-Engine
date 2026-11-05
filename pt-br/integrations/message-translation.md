# Tradução de mensagens

Marinara Engine pode traduzir as mensagens do chat entre idiomas. Este guia mostra como escolher um serviço de tradução, definir os idiomas, ativar a tradução automática e traduzir uma única mensagem.

A tradução é configurada por chat. Cada chat guarda o próprio serviço, os próprios idiomas e as próprias chaves. Para começar chats novos com as mesmas configurações, salve-as como [padrões do tradutor](#translator-defaults-for-new-chats).

## Onde ficam as configurações de tradução

1. Abra um chat em qualquer modo (Conversation, Roleplay ou Game).
2. Abra **Chat Settings** (configurações do chat).
3. Localize a seção **Translation**.

Todas as configurações abaixo ficam nessa seção.

## Como escolher o provedor

A lista **Provider** (provedor) tem quatro opções.

| Provedor | O que exige | Observações |
| --- | --- | --- |
| **Google Translate** | Nada | O padrão. Gratuito, sem chave. Até 5000 caracteres por requisição. |
| **DeepL API** | Uma chave de API do DeepL | Qualidade melhor. Funciona com chave gratuita ou paga. |
| **DeepLX (self-hosted)** | A URL de um servidor DeepLX | Para um servidor DeepLX que você mesmo roda. |
| **AI (via connection)** | Uma conta de IA | Usa um dos seus modelos de IA para traduzir. |

O Google Translate funciona sem configuração. Escolha outro só se precisar do que ele oferece.

### Definir os idiomas

Dois campos definem os idiomas. Os dois têm `en` (inglês) como padrão.

- **Model Language** (idioma do modelo) é o idioma que o modelo de IA entende e no qual responde. Quando você digita no seu próprio idioma, a sua mensagem é traduzida para esse idioma antes de a IA lê-la. **Translate My Messages** e **Translate draft** usam esse campo.
- **My Language** (meu idioma) é o idioma que você lê. As respostas da IA são traduzidas para esse idioma. **Auto-Translate Responses** e o botão **Translate** de cada mensagem usam esse campo.

Por exemplo, se você escreve em espanhol e a IA funciona melhor em inglês, defina **Model Language** como `en` e **My Language** como `es`.

Para Google Translate, DeepL API e DeepLX, digite um código curto, como `en`, `ja`, `es`, `de`, `fr`, `zh` ou `ko`. Para AI (via connection), digite o nome de um idioma, como `English`, `Japanese` ou `Spanish`.

Se não funcionou: um código ou nome errado gera um erro ou deixa o texto sem mudança. Confira o formato do seu provedor.

### DeepL API

Escolha **DeepL API** e cole a chave da sua conta DeepL em **DeepL API Key**. Uma chave terminada em `:fx` é do plano gratuito, e Marinara a envia para o serviço gratuito do DeepL. Qualquer outra chave é tratada como paga.

```text
xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx:fx
```

### DeepLX

DeepLX é um servidor de tradução gratuito que você mesmo roda. Escolha **DeepLX (self-hosted)** e informe o endereço do seu servidor em **DeepLX URL**, por exemplo `http://localhost:1188`.

Um servidor DeepLX no seu próprio computador ou na rede local tem um endereço local. Por segurança, Marinara bloqueia endereços locais por padrão. Para liberá-los, acrescente esta linha ao arquivo `.env` e salve. Não é preciso reiniciar. A mudança costuma valer em poucos segundos, até cerca de 30 segundos. A [Referência de configuração do servidor](../CONFIGURATION.md) mostra onde fica o arquivo.

```text
DEEPLX_LOCAL_URLS_ENABLED=true
```

Um servidor DeepLX em um endereço público da internet não precisa dessa configuração.

### AI (via connection)

Escolha **AI (via connection)** para usar um dos seus modelos de IA. Aparecem três campos.

- **Connection** (conexão): qual conta de IA faz a tradução. É obrigatório. Se ficar sem definir, a tradução falha com "Connection ID is required for AI translation". Veja [Conectando a um provedor de IA](../connections/connecting-to-a-provider.md).
- **Outgoing Message Prompt** (prompt das mensagens enviadas) e **Incoming Response Prompt** (prompt das respostas recebidas): as instruções que a IA recebe quando traduz as suas mensagens e as próprias respostas. Os dois começam com um texto padrão embutido, que você pode editar para este chat. `{{targetLanguage}}` vira **Model Language** ou **My Language**. Depois que você muda um prompt, **Restore** (restaurar) o devolve ao padrão. O prompt padrão é:

```text
You are a translator. Translate the given text accurately into {{targetLanguage}},
preserving formatting, markdown, and any special characters like *asterisks* for actions.
Output ONLY the translated text, nothing else -- no explanations, no extra commentary.
```

## Ativar a tradução automática

Quatro botões liga/desliga ficam abaixo das configurações do provedor. Todos começam desativados.

- **Auto-Translate Responses** (traduzir as respostas automaticamente): traduz toda resposta da IA logo depois que ela é gerada. No modo Game, Marinara primeiro remove da narração as marcações exclusivas do Game Master.
- **Translate My Messages** (traduzir minhas mensagens): traduz a sua mensagem para o **Model Language** pouco antes de ela ir para a IA, substituindo o texto que você digitou. Se a tradução falhar, Marinara envia o texto original e mostra um erro.
- **Show Draft Translate Button** (mostrar o botão de traduzir o rascunho): acrescenta um botão **Translate draft** ao lado de **Send**, para você revisar e editar a tradução antes de enviar. É a alternativa manual ao **Translate My Messages**.
- **Show Only Translation** (mostrar só a tradução): mostra a tradução de uma mensagem traduzida no lugar do original, em vez dos dois juntos.

No Conversation, você sempre pode traduzir um rascunho não enviado pelo botão de carinha do campo de mensagem e depois **Tools → Translate draft** (ferramentas → traduzir rascunho), no computador ou no celular. Você não precisa de nenhum dos dois botões liga/desliga. A ação usa as configurações de tradução de entrada deste chat e substitui o rascunho para você revisar. Ela não envia nada. Uma tradução que falha deixa o rascunho como estava.

<a id="translator-defaults-for-new-chats"></a>

## Padrões do tradutor para chats novos

**Save translator defaults** (salvar padrões do tradutor), abaixo dos botões liga/desliga, salva as configurações de tradução deste chat para os chats novos de todos os modos. As configurações do assistente de configuração e de um perfil de configurações têm prioridade. Os chats existentes mantêm as próprias configurações. **Forget saved defaults** (esquecer os padrões salvos) os apaga. O [Noodle](../agents/noodle-settings.md#translation) usa os mesmos padrões.

A chave de API do DeepL e a URL do DeepLX ficam nesta instalação do Marinara. As exportações de chat, os perfis de configurações exportados e os arquivos do **Export Profile** (exportar perfil) as deixam de fora, e importar qualquer um deles nunca as define. Informe-as de novo depois de levar um chat para outra instalação.

## Traduzir uma mensagem

Toda mensagem, sua ou da IA, tem um botão **Translate** (traduzir), com um ícone de idiomas, na barra de ações. Ele funciona sem nenhum dos botões liga/desliga acima.

1. Passe o ponteiro sobre a mensagem, ou toque nela no celular, para mostrar a barra de ações.
2. Clique em **Translate**.
3. A tradução aparece embaixo da mensagem, ou no lugar dela com **Show Only Translation** ligado.
4. Clique no botão de novo para ocultar a tradução. O rótulo dele passa a dizer **Hide translation**.

A tradução é salva junto com a mensagem e sobrevive a uma atualização da página e à troca de chats. Ela usa o mesmo provedor e o mesmo **My Language** da seção acima.

## Limites de cada provedor

- **Google Translate** recusa textos com mais de 5000 caracteres com "Text too long for Google Translate (max 5000 characters). Use DeepL or AI provider for longer texts."
- **DeepL API**, **DeepLX (self-hosted)** e **AI (via connection)** aceitam textos maiores, até o limite do servidor de 50000 caracteres por requisição.
- **Google Translate**, **DeepL API** e **DeepLX (self-hosted)** param com um erro depois de 15 segundos.
- **AI (via connection)** segue o tempo limite do seu próprio modelo de IA, não o limite de 15 segundos.
- **DeepLX (self-hosted)** em um endereço local fica bloqueado, a não ser que `DEEPLX_LOCAL_URLS_ENABLED=true` esteja definido.

## Guias relacionados

- [Ações de mensagem: editar, excluir, swipe e regenerar](../chats/messages.md)
- [Visão geral do painel Chat Settings](../chats/chat-settings.md)
- [Conectando a um provedor de IA](../connections/connecting-to-a-provider.md)
- [Referência de configuração do servidor](../CONFIGURATION.md)
