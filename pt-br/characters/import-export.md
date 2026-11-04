# Importar e exportar cards de personagem

Um card de personagem é um arquivo que guarda um personagem: nome, descrição, personalidade, saudações iniciais e, muitas vezes, uma imagem de avatar. Importe cards para adicionar personagens de outros aplicativos e sites. Exporte os seus próprios personagens para fazer backup deles ou compartilhá-los.

## Como importar um personagem

Antes de começar: tenha um arquivo de card de personagem no seu dispositivo. Se preferir encontrar cards na internet, veja [Card Browser](bot-browser.md).

1. Clique em **Characters** (personagens) na barra de navegação superior. Se não encontrar esse item, abra **More** (mais) primeiro.
2. Clique em **Import** (importar, o ícone com uma seta de download) na barra de ferramentas. A janela **Import Character** (importar personagem) abre.
3. Defina as opções de importação abaixo. Elas valem para todos os arquivos deste lote.
4. Solte os arquivos na janela, ou toque ou clique nela para abrir o seletor de arquivos do dispositivo. Você pode escolher vários arquivos, inclusive de tipos diferentes.
5. Espere a lista de resultados. Cada arquivo aparece com um visto verde ou com uma marca vermelha e um erro. O texto é `Imported "Name"`, `Imported "Name" with its embedded lorebook` ou `Imported "Name" without creating the embedded lorebook`.
6. Encontre o novo personagem em **Characters**.

Marinara aceita quatro tipos de arquivo:

| Tipo de arquivo | O que é |
| --- | --- |
| **.json** | Um card salvo como texto. As exportações do Marinara (`.marinara.json`) também são arquivos .json. |
| **.png** | Uma imagem de card com os dados do card escondidos dentro da figura. |
| **.charx** | Um pacote de card salvo como arquivo zip. |
| **.marinara** | Um arquivo de exportação do Marinara. |

Uma exportação do Marinara preserva o máximo de detalhes. Os outros tipos vêm de SillyTavern, Chub, Risu e ferramentas parecidas.

Se não funcionou: leia a mensagem vermelha ao lado do arquivo. Os outros arquivos do lote são importados mesmo assim.

<a id="import-options"></a>

### Opções de importação

| Opção | Escolhas |
| --- | --- |
| **Imported card tags** (tags do card importado) | **All tags** (padrão): mantém todas as tags. |
| | **No tags**: ignora as tags. |
| | **Existing only**: mantém as tags que já existem na sua biblioteca. |
| **Imported regex scripts** (scripts de regex importados) | **Character only** (padrão): as regras valem para este personagem. |
| | **Global**: as regras vão para **Presets → Regexes** e valem em todos os chats. |
| **Split description into fields** (dividir a descrição em campos) | Desligada por padrão. Marque a opção para tirar de **Description** (descrição) o texto rotulado de personalidade, aparência e similares e colocá-lo nos campos próprios. |

Os scripts de regex são pequenas regras de substituição de texto. Mantenha **Character only**, a não ser que você queira as regras em todo lugar. A divisão deixa como estão os cards de narrador, de mundo e de vários personagens.

### Cards com lorebook embutido

Um lorebook é um conjunto de fatos de fundo que a IA consulta durante o chat. Se um card traz um lorebook embutido, a importação faz uma pausa e mostra **Embedded lorebook found** (lorebook embutido encontrado). Ali aparecem cada arquivo e quantas entradas ele tem. Escolha uma opção para o lote inteiro:

- **Import Lorebook** (importar lorebook) cria também um lorebook independente no Marinara, ligado ao personagem.
- **No Import** (não importar) mantém o lorebook apenas dentro do card.

### Importar uma pasta inteira do SillyTavern

Para trazer uma instalação inteira do SillyTavern, use o importador em lote em **Settings** (Configurações), na aba **Imports**. Ele traz personagens, chats, presets e lorebooks juntos. Veja [Importar do SillyTavern](../data/importing-from-sillytavern.md).

## Exportar um personagem

1. Abra o personagem no editor.
2. Clique em **Export character** (exportar personagem) no cabeçalho. A janela **Export Character** abre.
3. Escolha um formato. Marinara baixa o arquivo.

| Formato | O que você recebe | Melhor para |
| --- | --- | --- |
| **Marinara Native** | Um arquivo `.marinara.json` com os metadados do Marinara, os sprites, as imagens da galeria e os lorebooks anexados. | Levar um personagem de uma instalação do Marinara para outra com todos os detalhes. |
| **Compatible JSON** | Um arquivo de card simples que outros aplicativos conseguem ler. Ele descarta os extras exclusivos do Marinara, como sprites e imagens da galeria. | Outros aplicativos que leem cards em JSON. |
| **Compatible PNG Card** | Uma imagem de card com os dados dentro da figura. Ela leva os seus sprites, mas não as imagens da galeria. | Aplicativos e sites que esperam um card em PNG, como SillyTavern, Chub e Risu. |

Os dois formatos **Compatible** acrescentam os campos **Backstory** (história do personagem) e **Appearance** (aparência) que não estejam vazios à **Description** padrão, para que outros aplicativos mantenham essas informações. O card salvo não muda.

O [onboarding interativo](interactive-onboarding.md) de um card é mantido por **Marinara Native** e **Compatible PNG Card**, então o card continua fazendo as perguntas quando alguém o importa no Marinara. **Compatible JSON** deixa o onboarding de fora.

## Exportar vários personagens de uma vez

1. Clique em **Characters** na barra de navegação superior (ou em **More** primeiro, se esse item não aparecer).
2. Clique em **Select** (selecionar, o ícone de visto) na barra de ferramentas e marque os personagens que você quer.
3. Clique em **Export** (exportar) na barra de baixo. Marinara baixa `marinara-characters.zip`.

O zip contém um arquivo **Marinara Native** por personagem. A exportação em lote não tem opção de PNG nem de JSON. Para esses formatos, use a exportação de um personagem por vez. Para conhecer outras formas de selecionar personagens, veja [Organizando a biblioteca de personagens](library-organization.md#export-or-delete-many-characters).

## Guias relacionados

- [Criando e editando personagens](creating-and-editing-characters.md)
- [Card Browser: encontrar e importar personagens](bot-browser.md)
- [Importar do SillyTavern](../data/importing-from-sillytavern.md)
