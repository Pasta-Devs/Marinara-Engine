# Importar e exportar cards de personagem

Neste guia você aprende a importar cards de personagem para Marinara Engine e a exportar os personagens que você criou. Ele explica quais tipos de arquivo Marinara aceita, as opções da janela de importação e os três formatos de exportação.

Um card de personagem é um único arquivo que guarda um personagem: nome, descrição, personalidade, saudações iniciais e, quase sempre, uma imagem de avatar. Com o card, o personagem viaja entre Marinara e outros aplicativos de roleplay.

## Formatos de importação

A janela **Import Character** (importar personagem) aceita quatro tipos de arquivo. Solte vários arquivos de uma vez, inclusive de tipos diferentes.

| Tipo de arquivo | O que é |
| --- | --- |
| **.json** | Um card de personagem simples, em forma de texto (Chara Card V2). |
| **.png** | Uma imagem de card de personagem com os dados do card escondidos dentro da figura. |
| **.charx** | Um pacote Character Card V3 (CharX), o formato baseado em zip que o RisuAI usa. |
| **.marinara** | Uma exportação nativa do Marinara (aparece também como `.marinara.json`). |

O arquivo **.marinara** preserva o máximo de detalhes, porque é o formato do próprio Marinara. Os outros três vêm de SillyTavern, Chub, Risu e ferramentas parecidas.

## Como importar um personagem

Siga estes passos para trazer um ou mais cards para a biblioteca.

1. Abra o painel **Characters** (personagens).
2. Clique no botão **Import** (importar) na barra de ferramentas. É um botão de ícone com uma seta de download. A janela **Import Character** abre.
3. Arraste os arquivos até a janela ou clique nela para procurar. Você deve ver a mensagem "Drop one or more files here or click to browse".
4. Defina as duas opções de importação (explicadas abaixo). Elas valem para todos os arquivos deste lote.
5. Espere a lista de resultados. Cada arquivo aparece com um visto verde e "Imported" mais o nome, ou com uma marca vermelha e um erro.

### Escolher quais tags manter

A opção **Imported card tags** (tags do card importado) define o que acontece com as tags do card que está entrando. É o chamado modo de importação de tags. Há três escolhas:

- **All tags**: mantém todas as tags do card de origem. É o padrão.
- **No tags**: ignora as tags do card de origem.
- **Existing only**: mantém apenas as tags que já existem na sua biblioteca.

### Escolher o alcance dos scripts de regex

Alguns cards trazem scripts de regex, pequenas regras de substituição de texto. A opção **Imported regex scripts** (scripts de regex importados) controla o alcance deles:

- **Character only**: os scripts valem só para este personagem. É o padrão.
- **Global**: os scripts entram na seção **Regexes**, dentro de **Presets**, e valem em todos os chats.

Escolha **Character only**, a não ser que você tenha certeza de querer as regras em todo lugar.

### Cards com lorebook embutido

Um lorebook é um conjunto de fatos do seu mundo que a IA consulta durante o chat. Se um card que você está importando já traz um lorebook embutido, a importação faz uma pausa e mostra o painel **Embedded lorebook found**. Ele lista cada arquivo e quantas entradas o arquivo tem. Escolha uma opção para o lote inteiro:

- **Import Lorebook**: cria também um lorebook independente no Marinara, ligado ao personagem.
- **No Import**: mantém o lorebook apenas dentro do card.

### Importar vários cards de uma vez

A mesma janela **Import Character** dá conta da importação em lote. Selecione vários arquivos e Marinara importa um depois do outro. A lista de resultados traz uma linha por arquivo, então você vê quais cards deram certo e quais falharam.

## Como exportar um personagem

Abra um personagem no editor e clique em **Export character** (exportar personagem), na barra de ferramentas superior. A janela **Export Character** oferece três formatos.

| Formato | O que você recebe | Melhor para |
| --- | --- | --- |
| **Marinara Native** | Um arquivo `.marinara.json` que preserva os metadados do Marinara, os sprites, as imagens da galeria e os lorebooks anexados. | Levar um personagem de uma instalação do Marinara para outra com todos os detalhes. |
| **Compatible JSON** | JSON puro no padrão Chara Card V2, sem o empacotamento do Marinara. | Compartilhar com outros aplicativos que leem cards em JSON. |
| **Compatible PNG Card** | Uma imagem Chara Card V2 com os dados do card gravados dentro da figura. | Aplicativos e sites que esperam um card em PNG, como SillyTavern, Chub e Risu. |

Escolha **Marinara Native** quando quiser preservar tudo. Escolha um dos formatos **Compatible** quando o arquivo for para outra ferramenta. Os dois formatos compatíveis descartam os extras exclusivos do Marinara, como sprites e imagens da galeria. Eles acrescentam os campos **Backstory** (história do personagem) e **Appearance** (aparência) que não estejam vazios à Description padrão, para que outros leitores de V2 preservem essas informações de identidade. Esses campos saem das extensões exportadas para evitar duplicação ao reimportar. O card salvo permanece intacto; **Marinara Native** mantém os campos separados.

## Como exportar vários personagens de uma vez

Um lote de personagens pode ser exportado como um único arquivo zip.

1. Abra o painel **Characters**.
2. Clique no botão **Select** (selecionar) na barra de ferramentas para entrar no modo de seleção. É um botão de ícone com um visto.
3. Marque os personagens que você quer.
4. Clique em **Export** na barra de ações, embaixo. Marinara baixa um zip chamado `marinara-characters.zip`.

O zip contém um arquivo **Marinara Native** por personagem. A exportação em lote não tem opção de PNG nem de JSON compatível, então use a exportação de um personagem por vez quando precisar desses formatos.

## Importar uma pasta inteira do SillyTavern

Os passos acima valem para cards escolhidos manualmente. Para trazer uma instalação inteira do SillyTavern de uma vez, use o importador de pastas em lote. Ele traz personagens, chats, presets e lorebooks juntos. Fica em **Settings** (Configurações), na aba **Imports**. Veja [Importando do SillyTavern](../data/importing-from-sillytavern.md) para o passo a passo completo.

## Guias relacionados

- [Criando e editando personagens](creating-and-editing-characters.md)
- [Card Browser: encontrar e importar personagens](bot-browser.md)
- [Importando do SillyTavern](../data/importing-from-sillytavern.md)
