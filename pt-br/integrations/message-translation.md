# Tradução de mensagens

Marinara Engine traduz as mensagens do chat entre idiomas. Este guia explica os quatro provedores de tradução, os botões liga/desliga de tradução automática, o botão **Translate** de cada mensagem e os limites de cada provedor.

A tradução é configurada por chat. Cada chat guarda o próprio provedor, os próprios idiomas e as próprias chaves. Para começar chats novos com as mesmas configurações, salve-as como [padrões do tradutor](#translator-defaults-for-new-chats).

## Onde ficam as configurações de tradução

1. Abra um chat em qualquer modo (Conversation, Roleplay ou Game).
2. Abra o painel **Chat Settings** (configurações do chat) desse chat.
3. Localize a seção **Translation**.

Todas as configurações de provedor e todos os botões liga/desliga descritos abaixo ficam nessa seção **Translation**.

## Como escolher o provedor

O menu suspenso **Provider** tem quatro opções:

| Provedor | O que exige | Observações |
|---|---|---|
| **Google Translate** | Nada | Padrão. Gratuito, sem chave. Limite de 5000 caracteres por requisição. |
| **DeepL API** | Uma chave de API do DeepL | Qualidade melhor. Funciona com chave gratuita ou paga. |
| **DeepLX (self-hosted)** | A URL de um servidor DeepLX | Para uma instância DeepLX que você mesmo hospeda. |
| **AI (via connection)** | Uma conexão de IA | Usa um dos provedores de IA já configurados para traduzir. |

**Google Translate** já vem selecionado e não exige configuração. Escolha outro provedor só se precisar de algum dos recursos abaixo.

### Model Language e My Language

Dois campos definem os idiomas. Os dois têm `en` (inglês) como padrão.

- **Model Language** (idioma do modelo): as suas próprias mensagens são traduzidas para esse idioma antes de a IA lê-las. **Translate My Messages** e **Translate draft** usam esse campo.
- **My Language** (meu idioma): as respostas da IA são traduzidas para esse idioma. **Auto-Translate Responses** e o botão **Translate** de cada mensagem usam esse campo.

O formato muda conforme o provedor:

- Para **Google Translate**, **DeepL API** e **DeepLX (self-hosted)**, digite um código curto de idioma. Exemplos: `en`, `ja`, `es`, `de`, `fr`, `zh`, `ko`.
- Para **AI (via connection)**, digite o nome do idioma. Exemplos: `English`, `Japanese`, `Spanish`.

### Configuração do DeepL API

Ao escolher **DeepL API**, aparece o campo **DeepL API Key**. Cole ali a chave da sua conta DeepL. As chaves do DeepL têm este formato:

```
xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx:fx
```

Uma chave terminada em `:fx` é do plano gratuito. Marinara a envia para o serviço gratuito do DeepL. Qualquer outra chave é tratada como chave paga.

### Configuração do DeepLX

DeepLX é um servidor de tradução gratuito que você mesmo hospeda. Ao escolher **DeepLX (self-hosted)**, aparece o campo **DeepLX URL**. Informe o endereço do seu servidor DeepLX, por exemplo:

```
http://localhost:1188
```

Se o servidor DeepLX roda na sua própria máquina ou na rede local, o endereço é um endereço local. Por segurança, Marinara bloqueia requisições para endereços locais por padrão. Para liberar, inclua esta linha no arquivo `.env` e salve o arquivo:

```
DEEPLX_LOCAL_URLS_ENABLED=true
```

O arquivo `.env` é o arquivo de configurações do servidor. A [Referência de configuração do servidor](../CONFIGURATION.md) mostra onde encontrá-lo. Não precisa reiniciar o servidor: ele detecta a mudança em poucos segundos.

Um servidor DeepLX em um endereço público da internet dispensa essa configuração. Só os endereços locais e de rede privada são bloqueados por padrão.

### Configuração da tradução por IA

Ao escolher **AI (via connection)**, Marinara usa um dos seus provedores de IA para traduzir. Aparecem três campos extras.

O menu suspenso **Connection** define qual conexão de IA faz a tradução. Esse campo é obrigatório. Se ficar vazio, a tradução falha com a mensagem "Connection ID is required for AI translation". Uma conexão é um vínculo salvo com um provedor de IA. Veja o guia de conexões no fim da página para criar uma.

Os campos **Outgoing Message Prompt** (prompt das mensagens enviadas) e **Incoming Response Prompt** (prompt das respostas recebidas) são as instruções enviadas à IA quando ela traduz as suas mensagens e as respostas da IA. Os dois já vêm preenchidos com um texto padrão, e você pode editar cada um para este chat. `{{targetLanguage}}` em um prompt vira **Model Language** ou **My Language**. Depois que você muda um prompt, aparece o botão **Restore** (restaurar), que o devolve ao texto padrão. O prompt padrão é:

```
You are a translator. Translate the given text accurately into {{targetLanguage}}, preserving formatting, markdown, and any special characters like *asterisks* for actions. Output ONLY the translated text, nothing else -- no explanations, no extra commentary.
```

## Os botões liga/desliga de tradução automática

Abaixo das configurações de provedor ficam quatro botões liga/desliga. Os quatro vêm desativados.

**Auto-Translate Responses** (traduzir as respostas automaticamente) traduz toda resposta da IA logo depois que ela é gerada. No Game Mode, Marinara remove da narração as marcações exclusivas do Game Master antes de traduzir.

**Translate My Messages** (traduzir minhas mensagens) traduz a sua mensagem para o **Model Language** pouco antes de enviá-la à IA. A tradução substitui o texto que você digitou. Se a tradução falhar, Marinara envia o texto original e mostra uma mensagem de erro.

**Show Draft Translate Button** (mostrar o botão de traduzir o rascunho) acrescenta o botão **Translate draft** ao lado do botão **Send**. Com ele, você traduz a mensagem e revisa ou edita o resultado antes de enviar. É a alternativa manual ao **Translate My Messages**, que traduz no envio e não dá chance de revisão.

**Show Only Translation** (mostrar só a tradução) mostra a tradução de uma mensagem traduzida no lugar dela, em vez do original e da tradução juntos.

Em **Conversation**, você sempre pode traduzir um rascunho não enviado pelo botão de carinha do campo de mensagem → **Tools → Translate draft** (ferramentas → traduzir rascunho), no computador ou celular. Não é preciso ativar **Show Draft Translate Button** nem a tradução automática. A ação usa as configurações de tradução das mensagens que você envia nesse chat e substitui o rascunho para revisão; ela não envia uma mensagem. Se a tradução falhar, o rascunho permanece intacto.

<a id="translator-defaults-for-new-chats"></a>

## Padrões do tradutor para chats novos

Abaixo dos botões liga/desliga, **Save translator defaults** (salvar padrões do tradutor) salva as configurações de tradução deste chat para os chats novos de todos os modos. As configurações do assistente de configuração e de um perfil de configurações têm prioridade. Os chats existentes mantêm as próprias configurações. **Forget saved defaults** (esquecer os padrões salvos) os apaga. O [Noodle](../noodle/settings.md#translation) usa os mesmos padrões.

A chave de API do DeepL e a URL do DeepLX ficam nesta instalação do Marinara. As exportações de chat, os perfis de configurações exportados e os arquivos do **Export Profile** (exportar perfil) as deixam de fora, e importar qualquer um deles nunca as define. Digite-as de novo depois de levar um chat para outra instalação.

## O botão Translate de cada mensagem

Toda mensagem do chat, sua ou da IA, tem um botão **Translate** (traduzir) na barra de ações que aparece ao passar o mouse. O botão usa o ícone de idiomas. Ele funciona sozinho e não depende de nenhum dos botões liga/desliga acima.

1. Passe o ponteiro sobre a mensagem para exibir a barra de ações.
2. Clique no botão **Translate**.
3. A tradução aparece embaixo da mensagem, ou no lugar dela com **Show Only Translation** ligado.
4. Clique no mesmo botão de novo para ocultar a tradução. A dica dele passa a dizer **Hide translation**.

A tradução feita assim é salva junto com a mensagem. Ela sobrevive a uma atualização da página e continua lá quando você troca de chat e volta.

O botão de cada mensagem usa o mesmo provedor e o mesmo **My Language** definidos na seção **Translation**.

## Limites de cada provedor

Leve estes limites em conta na hora de escolher o provedor.

- **Google Translate** recusa textos com mais de 5000 caracteres. Aparece o erro "Text too long for Google Translate (max 5000 characters). Use DeepL or AI provider for longer texts." Para textos maiores, mude para DeepL ou IA.
- **DeepL API**, **DeepLX (self-hosted)** e **AI (via connection)** aceitam textos maiores, até o limite do servidor de 50000 caracteres por requisição.
- **Google Translate**, **DeepL API** e **DeepLX (self-hosted)** param e mostram um erro se demorarem mais de 15 segundos.
- **AI (via connection)** segue o modelo e o tempo limite da própria conexão, não o limite de 15 segundos.
- **DeepLX (self-hosted)** apontando para um endereço local fica bloqueado enquanto você não definir `DEEPLX_LOCAL_URLS_ENABLED=true`, como descrito acima.

## Guias relacionados

- [Ações de mensagem: editar, excluir, swipe e regenerar](../chats/messages.md)
- [Visão geral do painel Chat Settings](../chats/chat-settings.md)
- [Conectando a um provedor de IA](../connections/connecting-to-a-provider.md)
- [Referência de configuração do servidor](../CONFIGURATION.md)
