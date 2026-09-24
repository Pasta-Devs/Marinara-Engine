# Scripts de regex

Este guia explica os scripts de regex no Marinara Engine. Um script de regex é uma regra de localizar e substituir que reescreve o texto do chat automaticamente. Aqui você vê o que esses scripts fazem, como criar um, onde eles rodam e como limitar um script a um único personagem.

## O que é um script de regex

Regex é a abreviação de "regular expression", ou expressão regular. Uma expressão regular é um padrão de busca. Ela encontra o texto que corresponde a uma regra, e o script de regex troca esse texto por outro. Não é preciso saber programar para usar um.

Um script de regex roda sozinho toda vez que uma mensagem passa por um chat. Ele pode limpar uma resposta da IA antes de você ver. Pode mudar a sua própria mensagem antes do envio. E pode mudar também o texto que chega ao modelo. Você define o padrão uma vez, e ele continua funcionando em toda mensagem que corresponder.

Veja um exemplo simples de antes e depois. Alguns modelos colocam as ações entre asteriscos, assim:

```
*She smiles* Hello there.
```

Se você localizar o padrão `\*([^*]+)\*` e substituir por `$1`, os asteriscos somem e o texto entre eles fica:

```
She smiles Hello there.
```

O `$1` na substituição significa "o texto que o padrão capturou no primeiro par de parênteses". Você vai usar `$1`, `$2` e outros tokens parecidos com frequência.

Entre os usos mais comuns estão remover asteriscos, excluir observações fora do personagem entre parênteses, censurar uma palavra e corrigir manias de formatação que se repetem em um personagem.

## Onde encontrar os scripts de regex

Os scripts de regex globais ficam no painel **Presets** (presets salvos). Abra o painel com o botão **Presets** na barra superior e procure a seção chamada **Regexes**. A observação da seção diz **Find/replace patterns applied to AI output or user input**.

Cada linha da lista mostra:

- O nome do script.
- Uma pequena etiqueta **AI** ou **User**, indicando onde o script roda.
- O padrão, no formato `/pattern/flags`.
- Um botão liga/desliga para ativar ou desativar o script. O efeito é imediato, sem precisar abrir o editor.
- Um botão **Edit regex** (editar a regex, ícone de lápis).
- Um botão **Delete regex** (excluir a regex, ícone de lixeira).

Enquanto não houver nenhum script, a lista mostra "No regexes yet". Arraste uma linha pela alça para mudar a ordem de execução. Essa lista mostra apenas os scripts globais. Os scripts ligados a um único personagem ficam separados. Veja "Scripts de regex por personagem" mais adiante.

O cabeçalho da seção também traz três botões de ícone:

- **Create regex** (criar uma regex): abre um script novo, em branco.
- **Import regexes from JSON** (importar regexes de JSON): lê os scripts de um arquivo.
- **Export regexes to JSON** (exportar regexes para JSON): salva todos os scripts globais em um único arquivo.

## Como criar um script de regex

Para criar um script global:

1. Abra o painel **Presets** e localize a seção **Regexes**.
2. Clique em **Create regex**. O editor completo de scripts de regex abre.
3. Digite um nome no campo do topo. Um script novo começa com o nome "New Regex Script".
4. Preencha os campos descritos abaixo.
5. Clique em **Save** (salvar). Aparece por um instante um aviso verde **Saved**.

O editor tem os campos a seguir.

### Find Pattern (Regex)

O campo **Find Pattern (Regex)** (padrão de busca) guarda o padrão de busca. Escreva o padrão sem as barras delimitadoras. O texto de exemplo mostra `\*([^*]+)\*`. Se o padrão for inválido ou inseguro, aparece um erro em vermelho abaixo do campo e o script não pode ser salvo. Veja "Segurança e desempenho" mais adiante.

### Replace With

O campo **Replace With** (substituir por) guarda o texto que entra no lugar de cada correspondência. Deixe o campo vazio para excluir o texto encontrado. O texto capturado pode ser reaproveitado com `$1`, `$2` e assim por diante. Transformações de caixa antes de uma captura mudam as letras dela:

- `\u$1` deixa a primeira letra da captura em maiúscula.
- `\U$1\E` deixa a captura inteira em maiúsculas.
- `\l$1` deixa a primeira letra da captura em minúscula.
- `\L$1\E` deixa a captura inteira em minúsculas.

Texto com barra invertida literal, como o caminho do Windows `C:\Users`, fica exatamente como foi escrito.

### Regex Flags

Os **Regex Flags** (sinalizadores da regex) são botões liga/desliga que mudam a forma como o padrão encontra o texto. Um script novo começa com `g` e `i` ativados:

- `g` (global): substitui todas as correspondências, não só a primeira.
- `i` (case-insensitive): encontra o texto tanto em maiúsculas quanto em minúsculas.
- `m` (multiline): faz `^` e `$` valerem também nas quebras de linha.
- `s` (dotAll): faz `.` corresponder também aos caracteres de quebra de linha.
- `u` (unicode), `y` (sticky) e `d` (match indices) são sinalizadores avançados, para casos especiais.

### Trim Strings

O campo **Trim Strings** (textos a remover) é uma lista opcional de textos simples que saem depois que a substituição roda. Clique em **Add trim string** (adicionar um texto a remover) para incluir uma linha, e no botão **X** para tirar uma. Isso ajuda a excluir um trecho fixo que é mais fácil de digitar do que de descrever em um padrão.

### Live Test

O campo **Live Test** (teste ao vivo) permite conferir o padrão antes de salvar. Cole um texto de exemplo no campo e o resultado aparece logo abaixo, em **Result:**. O Live Test comprova apenas a lógica de localizar, substituir e remover. Ele não verifica o local de aplicação, o estado ligado ou desligado, o escopo de personagem nem a profundidade. A observação abaixo do campo avisa isso: "Pattern preview only: placement, enabled state, character scope, and depth are evaluated at runtime".

Você pode usar macros como `{{user}}` e `{{char}}` no padrão, na substituição e nos textos a remover. No Live Test, elas viram valores de exemplo. Em um chat de verdade, viram os nomes e os textos reais. Para saber mais sobre as macros, veja [Macros](../prompts/macros.md).

## Local de aplicação: AI Output ou User Input

O campo **Apply To** (aplicar a) define qual lado do chat o script observa. Pelo menos uma opção precisa continuar marcada. Você pode escolher as duas.

- **AI Output**: o script roda nas respostas da IA antes de elas aparecerem.
- **User Input**: o script roda nas suas mensagens antes do envio.

Use **AI Output** para limpar o que o modelo escreve. Use **User Input** para corrigir ou reformular o seu próprio texto.

Com **Only Prompt** ou **Both**, em um chat **Roleplay** com o modo de grupo **Individual** (respostas individuais), a aplicação depende do personagem que recebe o prompt: suas mensagens e as dos outros personagens usam **User Input**, enquanto as respostas anteriores do próprio personagem que vai responder usam **AI Output**. Isso também vale para as respostas anteriores do mesmo turno do grupo. As restrições por personagem continuam definindo quem recebe o prompt reescrito, então um narrador excluído de um script que oculta pensamentos recebe os pensamentos originais. Use **Only Prompt** para manter intacto o texto salvo do chat.

## Apply Mode: Only Display, Only Prompt ou Both

O seletor **Apply Mode** (modo de aplicação) fica dentro de **Advanced Options** (opções avançadas). Ele define quando a reescrita entra em vigor, e isso é diferente do local de aplicação. Um script novo começa em **Only Display**.

- **Only Display**: muda só o que você vê no chat. A mensagem salva e o texto que o modelo recebe nos turnos seguintes continuam iguais.
- **Only Prompt**: muda só o que o modelo recebe. A exibição no chat e a mensagem salva continuam iguais. É também o que aparece na prévia do prompt do aplicativo.
- **Both**: muda a exibição e o texto do prompt.

### Qual modo de aplicação escolher

Use este guia rápido:

- Você só quer ajustar a aparência de uma resposta na tela: escolha **Only Display**. É a opção mais segura para correções estéticas.
- Você quer mudar o que o modelo lê, por exemplo para tirar uma tag que o modelo fica copiando: escolha **Only Prompt**.
- Você quer que a mudança valha na tela e no contexto do modelo: escolha **Both**.

Vale saber uma coisa sobre as suas próprias mensagens. Quando um script de **User Input** está em **Only Display** ou **Both**, a reescrita acontece pouco antes do envio da mensagem. Ou seja, ela muda a mensagem que é realmente salva e enviada, não só a aparência depois. Não existe um modo só de exibição para as mensagens que você envia.

## Execution Order e Depth

As duas configurações ficam em **Advanced Options**.

O campo **Execution Order** (ordem de execução) recebe um número. Números menores rodam primeiro. Isso importa quando mais de um script pode corresponder ao mesmo texto. Um script novo começa em 0, e o aplicativo atribui o próximo número livre ao salvar, então scripts recém-criados não se chocam. Você também pode arrastar as linhas da lista **Regexes** para reordená-las.

O campo **Depth Range** (faixa de profundidade) limita até onde no passado do chat um script roda, com dois campos numéricos: **Min** e **Max**. A profundidade conta de trás para frente, a partir da mensagem mais nova. A mensagem mais nova é a profundidade 0, a anterior é a profundidade 1, e assim por diante. Deixe os dois campos vazios para rodar em qualquer profundidade. Se o valor mínimo for maior que o máximo, o script não pode ser salvo.

## Scripts de regex por personagem

Um script de regex pode pertencer a um ou mais personagens específicos, em vez de rodar em todo lugar. Existem duas maneiras de limitar um script a um personagem.

A primeira é dentro do editor. Ative o botão liga/desliga **Specific Characters** (personagens específicos) no cartão **Apply To** e escolha um ou mais personagens na grade. Com o botão desligado, o script "Applies to all characters". Com o botão ligado, é obrigatório escolher pelo menos um personagem.

A segunda maneira é pelo próprio personagem. Abra um personagem, vá até a aba **Advanced** e procure o cartão chamado **Regex Scripts**. Esse cartão lista apenas os scripts ligados àquele personagem e tem os seus próprios botões **Create regex**, de importação e de exportação. É preciso salvar o personagem antes de adicionar scripts limitados a ele. Se o personagem ainda não foi salvo, o cartão avisa.

Abrir o editor completo a partir desse cartão faz você sair do Character Editor. Se o personagem tiver alterações não salvas, o aplicativo avisa antes, para nada se perder.

### A configuração Scoped Regex Scripts, por chat

Os scripts limitados a personagens não rodam automaticamente em todo chat. Quem controla isso é uma configuração de cada chat. Abra o painel **Chat Settings** (configurações do chat) de um chat. A seção chamada **Scoped Regex Scripts** só aparece quando pelo menos um personagem daquele chat tem scripts limitados a ele. São três modos:

- **Disabled** (o padrão): os scripts limitados a personagens ficam desativados, e só os scripts globais rodam.
- **Exclusive**: cada script limitado só muda as mensagens do personagem a que pertence.
- **Chat**: todo script limitado muda todas as mensagens do chat.

Abaixo dos botões de modo, o painel lista cada personagem com scripts limitados e permite ativar ou desativar cada script naquele chat. Essa configuração controla os scripts do lado da exibição. Os scripts de prompt sempre acompanham o personagem que está gerando a resposta.

## Como importar scripts de regex do SillyTavern

Marinara consegue ler os scripts de regex que vêm dentro de um card de personagem do SillyTavern. Ao importar um card, aparece uma seção chamada **Imported regex scripts** com duas opções:

- **Character only** (o padrão): os scripts ficam limitados àquele personagem.
- **Global**: os scripts entram em **Presets** e rodam em todos os chats.

Essa escolha aparece tanto na janela de importação de um personagem quanto no fluxo em lote **Import from SillyTavern Folder**. Scripts que vêm com o padrão vazio, ou com um padrão que não passa na verificação de segurança, são ignorados na importação. Você também pode importar um arquivo JSON simples de scripts com o botão **Import regexes from JSON** na seção **Regexes**. Para o passo a passo completo da importação, veja [Importando do SillyTavern](../data/importing-from-sillytavern.md).

## Segurança e desempenho

Todo padrão passa por uma verificação antes de ser salvo ou executado. Marinara bloqueia os padrões que têm grande chance de rodar devagar e travar o aplicativo. Um padrão bloqueado mostra esta mensagem: "Regex pattern is unsafe: avoid nested quantifiers, ambiguous quantified alternatives, and oversized patterns." O script não pode ser salvo até você corrigir isso.

Em outras palavras, evite estes formatos:

- Padrões com mais de 1000 caracteres.
- Um grupo de repetição dentro de outro grupo de repetição, como `(a+)+`.
- Dois curingas amplos seguidos, como `.*.*` ou `\s*\w*`. Curinga amplo é um token como `.*`, `\s*` ou `\w+`, capaz de corresponder a uma quantidade ilimitada de texto.
- Três ou mais curingas amplos no mesmo padrão, mesmo com outro texto entre eles.

Uma repetição simples como `a+` ou `(a+)` não tem problema. Um curinga amplo sozinho, como um único `.*`, também não.

Mesmo com um padrão seguro, o aplicativo limita quanto tempo uma substituição pode levar em uma mensagem mais longa. Se um script demora demais em uma mensagem, o aplicativo pula esse script só naquela mensagem e segue em frente. O script não é desativado e tenta de novo na mensagem seguinte. Por segurança, teste sempre um padrão novo no **Live Test**, com um texto de exemplo curto, antes de ativá-lo.

## Guias relacionados

- [Macros](../prompts/macros.md)
- [Criando e Editando Personagens](../characters/creating-and-editing-characters.md)
- [Importando do SillyTavern](../data/importing-from-sillytavern.md)
