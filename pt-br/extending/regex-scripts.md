# Scripts de regex

Um script de regex é uma regra de localizar e substituir que reescreve o texto do chat automaticamente. Use um para limpar uma resposta da IA, reformular a sua própria mensagem ou mudar o texto que o modelo recebe. Você não precisa saber programar para usar um.

Regex é a abreviação de "regular expression" (expressão regular), um padrão de busca que encontra o texto que corresponde a uma regra. Você define o padrão uma vez, e ele roda em toda mensagem que corresponder.

Exemplo: alguns modelos colocam as ações entre asteriscos.

```text
*She smiles* Hello there.
```

Copie este padrão exatamente: `\*([^*]+)\*`. Use `$1` como substituição, e os asteriscos somem, mas o texto de dentro fica:

```text
She smiles Hello there.
```

`$1` significa "o texto capturado pelo primeiro par de parênteses". Outros usos comuns são excluir observações fora do personagem entre parênteses, censurar uma palavra e corrigir as manias de formatação de um personagem.

## Criar um script de regex

Os seus scripts globais ficam no painel **Presets**, na seção **Regexes**. Abra-o com o botão **Presets** na barra superior.

### Como criar um script de regex

1. Abra **Presets** e encontre **Regexes**.
2. Clique em **Create regex** (criar regex). O editor completo se abre.
3. Digite um nome no topo. Um script novo se chama "New Regex Script".
4. Em **Find Pattern (Regex)** (padrão de busca), digite `\*([^*]+)\*` (veja [Campos do editor](#editor-fields)).
5. Em **Replace With** (substituir por), digite `$1`.
6. Em **Apply To** (aplicar a), deixe **AI Output** selecionado. O modo de aplicação padrão, **Only Display**, é a escolha segura (veja [Escolher onde um script roda](#choose-where-a-script-runs)).
7. Cole `*She smiles* Hello there.` em **Live Test** (teste ao vivo). **Result:** deve mostrar `She smiles Hello there.`
8. Clique em **Save** (salvar). Um aviso verde **Saved** aparece por um instante.
9. Confira em um chat: quando uma resposta da IA tiver texto entre asteriscos, os asteriscos não aparecem mais.

Se não funcionou: um erro em vermelho abaixo de **Find Pattern (Regex)** bloqueia o salvamento. O padrão é inválido ou inseguro; veja [Segurança e desempenho](#safety-and-performance).

### Gerenciar os seus scripts

Cada linha da lista **Regexes** mostra o nome do script, uma etiqueta **AI** ou **User**, o padrão no formato `/pattern/flags`, um botão liga/desliga (com efeito imediato), **Edit regex** (editar regex, lápis) e **Delete regex** (excluir regex, lixeira). Sem scripts, a lista mostra "No regexes yet". Arraste uma linha pela alça para mudar a ordem de execução.

O cabeçalho da seção tem três botões de ícone: **Create regex**, **Import regexes from JSON** (importar regexes de JSON) e **Export regexes to JSON** (exportar regexes para JSON), que salva todos os seus scripts globais em um único arquivo. Os scripts ligados a um único personagem ficam separados; veja [Limitar um script a um personagem](#limit-a-script-to-one-character).

<a id="editor-fields"></a>

## Campos do editor

### Find Pattern (Regex)

O padrão de busca. Escreva só o padrão, sem barra no começo nem no fim. O texto provisório do campo traz um exemplo: `\*([^*]+)\*`.

### Replace With

O texto que substitui cada correspondência. Deixe vazio para excluir a correspondência. Reaproveite o texto capturado com `$1`, `$2` e assim por diante. Estas mudanças de caixa funcionam antes de uma captura:

| Escreva | Resultado |
| --- | --- |
| `\u$1` | Deixa a primeira letra da captura em maiúscula |
| `\U$1\E` | Deixa a captura inteira em maiúsculas |
| `\l$1` | Deixa a primeira letra da captura em minúscula |
| `\L$1\E` | Deixa a captura inteira em minúsculas |

Texto com barra invertida literal, como um caminho do Windows do tipo `C:\Users`, fica como foi escrito.

### Regex Flags

Botões liga/desliga que mudam a forma como o padrão encontra o texto. Um script novo começa com `g` e `i` ativados.

| Sinalizador | Significado |
| --- | --- |
| `g` | Global: substitui todas as correspondências, não só a primeira |
| `i` | Case-insensitive: não diferencia maiúsculas de minúsculas |
| `m` | Multiline: `^` e `$` valem nas quebras de linha |
| `s` | dotAll: `.` também corresponde aos caracteres de quebra de linha |
| `u`, `y`, `d` | Unicode, sticky e match indices, para casos especiais |

### Trim Strings

Uma lista opcional de textos simples removidos depois que a substituição roda. Clique em **Add trim string** (adicionar texto a remover) para incluir uma linha e no botão **X** para tirar uma. Use para um trecho fixo de texto que é mais fácil de digitar do que de encontrar com um padrão.

### Live Test

Cole um texto de exemplo, e o resultado aparece em **Result:**. O Live Test confere só a lógica de localizar, substituir e remover. O local de aplicação, o estado ligado ou desligado, o escopo de personagem e a profundidade são avaliados em um chat de verdade. Você pode usar macros como `{{user}}` e `{{char}}` no padrão, na substituição e nos textos a remover. No Live Test, elas usam valores de exemplo. Veja [Macros](../prompts/macros.md).

<a id="choose-where-a-script-runs"></a>

## Escolher onde um script roda

### Apply To

**Apply To** define qual lado do chat um script observa. Mantenha pelo menos uma opção marcada. Você pode escolher as duas.

- **AI Output**: roda nas respostas da IA antes de elas aparecerem.
- **User Input**: roda nas suas mensagens antes do envio.

### Apply Mode

**Apply Mode** (modo de aplicação) fica dentro de **Advanced Options** (opções avançadas). Ele define o que a reescrita muda. Um script novo começa em **Only Display**.

- **Only Display**: muda o que você vê no chat. A mensagem salva e o contexto que o modelo recebe depois continuam iguais. É a opção mais segura para arrumar a aparência de uma resposta.
- **Only Prompt**: muda o que o modelo recebe, o que também aparece na prévia do prompt. A exibição e a mensagem salva continuam iguais. Use para tirar algo que o modelo fica copiando.
- **Both**: muda a exibição e o texto do prompt.

Nas suas próprias mensagens, um script de **User Input** em **Only Display** ou **Both** reescreve a mensagem pouco antes do envio. A mensagem salva e enviada muda, não só a aparência. Não existe um modo só de exibição para as mensagens que você envia.

### Execution Order e Depth Range

As duas configurações ficam em **Advanced Options**.

- **Execution Order** (ordem de execução) é um número. Números menores rodam primeiro, o que importa quando vários scripts podem corresponder ao mesmo texto. Um script novo começa em 0, e o aplicativo atribui o próximo número livre quando você salva. Você também pode arrastar as linhas na lista **Regexes**.
- **Depth Range** (faixa de profundidade) limita até onde no passado um script roda, com **Min** e **Max**. A mensagem mais nova é a profundidade 0, a anterior é a profundidade 1, e assim por diante. Deixe os dois vazios para rodar em qualquer profundidade. O salvamento é bloqueado se **Min** for maior que **Max**.

### Chats em grupo

Isto vale para **Only Prompt** e **Both** em um chat **Roleplay** com o modo de grupo **Individual**.

- O local de aplicação segue o personagem que recebe o prompt.
- As suas mensagens e as dos outros personagens contam como **User Input**.
- As respostas do próprio personagem que vai responder contam como **AI Output**, incluindo as respostas anteriores do mesmo turno do grupo.
- As restrições por personagem continuam definindo quem recebe o prompt reescrito. Um narrador deixado de fora de um script que oculta pensamentos mantém os pensamentos originais.

<a id="limit-a-script-to-one-character"></a>

## Limitar um script a um personagem

Um script pode pertencer a personagens específicos em vez de rodar em todo lugar. Há duas maneiras.

- No editor, ative **Specific Characters** (personagens específicos) no cartão **Apply To** e escolha um ou mais personagens. Com o botão liga/desliga desativado, o script "Applies to all characters". Quando ele estiver ativado, escolha pelo menos um personagem.
- No personagem: abra o personagem, vá até a aba **Advanced** e procure o cartão **Regex Scripts**. Ele lista só os scripts daquele personagem e tem os seus próprios botões **Create regex**, de importação e de exportação. Salve o personagem antes, ou o cartão avisa que ainda não pode adicionar scripts.

Abrir o editor completo a partir desse cartão faz você sair do Character Editor. Se o personagem tiver alterações não salvas, o aplicativo avisa antes.

<a id="the-per-chat-scoped-regex-scripts-setting"></a>

### A configuração Scoped Regex Scripts, por chat

Os scripts limitados a personagens não rodam sozinhos em todo chat. Uma configuração de cada chat os controla. Abra **Chat Settings** (configurações do chat). A seção **Scoped Regex Scripts** só aparece quando pelo menos um personagem daquele chat tem scripts limitados.

| Modo | O que acontece |
| --- | --- |
| **Disabled** (padrão) | Os scripts limitados ficam desativados. Só os scripts globais rodam. |
| **Exclusive** | Cada script limitado muda só as mensagens do próprio personagem. |
| **Chat** | Todo script limitado muda todas as mensagens do chat. |

A opção **Use preset default** (usar o padrão do preset) segue o **Scoped regex default** (padrão de regex com escopo) do preset de prompt. Escolher um modo substitui esse padrão neste chat. Para começar os novos chats com um modo, use uma destas formas:

- Defina-o como o padrão do preset.
- Salve-o no seu [perfil de configurações padrão](../chats/settings-profiles.md#choosing-the-default-profile).
- Escolha-o e depois clique na estrela do layout favorito ao lado de **Reset View** (veja [Escolher um layout para novos chats](../chats/chat-settings.md#choosing-a-layout-for-new-chats)).

Abaixo dos modos, o painel lista os scripts limitados de cada personagem, com um botão liga/desliga para cada um. Esse botão é do próprio script, então ele muda o script em todos os chats. O modo controla os scripts do lado da exibição. Os scripts de prompt sempre acompanham o personagem que está gerando a resposta.

## Importar e substituir scripts

### Importar do SillyTavern

Marinara lê os scripts de regex que vêm dentro de um card de personagem do SillyTavern. Ao importar um card, uma seção **Imported regex scripts** (scripts de regex importados) oferece duas opções:

- **Character only** (o padrão): os scripts ficam limitados àquele personagem.
- **Global**: os scripts entram em **Presets** e rodam em todos os chats.

Essa escolha aparece na janela de importação de um personagem e no fluxo em lote **Import from SillyTavern Folder**. Scripts com o padrão vazio, ou com um padrão que não passa na verificação de segurança, são ignorados. Para importar um arquivo JSON simples de scripts, use **Import regexes from JSON** em **Regexes**. Veja [Importar do SillyTavern](../data/importing-from-sillytavern.md).

### Substituir um pacote de regex

1. Em **Presets → Regexes**, escolha **Select regex scripts** (selecionar scripts de regex).
2. Marque as entradas do pacote antigo ou escolha **Select all regex scripts** (selecionar todos os scripts de regex).
3. Use **Export** (exportar) ou **Delete** (excluir) na barra de ações. A exclusão pede uma única confirmação e não pode ser desfeita.
4. Importe o pacote atualizado.

As exclusões que falharem continuam selecionadas para você tentar de novo. Os scripts não selecionados ficam onde estão. As atribuições a presets continuam disponíveis no editor de regex.

<a id="safety-and-performance"></a>

## Segurança e desempenho

Todo padrão é verificado antes de poder ser salvo ou executado. Um padrão com chance de rodar devagar e travar o aplicativo é bloqueado com esta mensagem, e o salvamento fica impedido até você corrigi-lo:

```text
Regex pattern is unsafe: avoid nested quantifiers, ambiguous quantified alternatives, and oversized patterns.
```

Se você vir essa mensagem, deixe o padrão mais curto e mais simples. Evite estes formatos:

- Padrões com mais de 1.000 caracteres.
- Um grupo de repetição dentro de outro grupo de repetição, como `(a+)+`.
- Dois curingas amplos seguidos, como `.*.*` ou `\s*\w*`. Um curinga amplo é um token como `.*`, `\s*` ou `\w+`, capaz de corresponder a uma quantidade ilimitada de texto.
- Três ou mais curingas amplos em qualquer lugar do mesmo padrão, mesmo com outro texto entre eles.

Uma repetição simples como `a+` ou `(a+)`, ou um único curinga amplo, como um `.*` sozinho, não tem problema.

Mesmo um padrão seguro tem um tempo limite por substituição em uma mensagem longa. Se um script demorar demais em uma mensagem, o aplicativo pula esse script só naquela mensagem. O script continua ativado e tenta de novo na mensagem seguinte. Teste primeiro um padrão novo no **Live Test**, com um texto de exemplo curto.

## Guias relacionados

- [Macros](../prompts/macros.md)
- [Criando e editando personagens](../characters/creating-and-editing-characters.md)
- [Importar do SillyTavern](../data/importing-from-sillytavern.md)
