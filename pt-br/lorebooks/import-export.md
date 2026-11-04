# Importar e exportar lorebooks

Importe lorebooks para trazer fatos do mundo a partir de arquivos, e exporte-os para compartilhar ou fazer backup. Este guia trata de um arquivo, de vários arquivos de uma vez e dos quatro formatos de exportação. Um lorebook é um conjunto de anotações acionadas por palavras-chave, que Marinara acrescenta ao prompt quando uma palavra correspondente aparece. Outras ferramentas chamam esse recurso de World Info.

## O que você pode importar

Marinara reconhece o tipo de arquivo sozinho. Os dois tipos são arquivos `.json`, e você não precisa de conta nem de chave de API.

- Um lorebook exportado do Marinara. Esse formato preserva todos os campos e todas as pastas.
- Um arquivo World Info de outra ferramenta, como o World Info do SillyTavern ou o formato "character-book" do card de personagem V2. Marinara converte os campos para os seus próprios.

## Importar um lorebook

1. Abra o painel **Lorebooks**.
2. Clique no ícone de seta para baixo na linha do topo, o do meio entre três ícones. A dica dele é **Import** (importar). O ícone de mais é **New** e o ícone de visto é **Select**.
3. Na janela **Import Lorebook**, toque ou clique na caixa com o texto **Drop one or more lorebook files here or click to browse** e escolha os seus arquivos `.json`. No computador, também dá para soltar os arquivos sobre a caixa. Você pode escolher vários de uma vez e misturar arquivos do Marinara e World Info.
4. Espere os resultados. Cada arquivo mostra um visto verde com **Imported lorebook** ou uma marca vermelha com um erro. Com vários arquivos, uma linha de resumo mostra quantos deram certo e quantos falharam.
5. Clique em **Close** (fechar). Os novos lorebooks ficam no painel **Lorebooks**.

Marinara mantém a data do próprio arquivo como data de criação.

Se não funcionou: leia o erro ao lado do arquivo. Um arquivo que não é um lorebook, ou que está danificado, falha sozinho enquanto os outros arquivos são importados.

## Depois da importação

Um lorebook importado funciona com palavras-chave de imediato. Se você usa a busca semântica, gere os vetores dele de novo. Veja [Busca semântica para lorebooks](semantic-search.md).

## Exportar um lorebook

1. No painel **Lorebooks**, clique em um lorebook para abri-lo.
2. Clique no ícone de exportar no cabeçalho do editor, perto do canto superior direito. A dica dele é **Export lorebook** (exportar lorebook).
3. Na janela **Export Lorebook**, escolha um formato. O navegador baixa o arquivo.

| Formato | O que você recebe | Para que usar |
| --- | --- | --- |
| **Marinara Native** | Todos os campos das entradas e todas as pastas. O arquivo termina em `.marinara.json`. | Levar um lorebook para outra instalação do Marinara. |
| **Compatible JSON** | Um arquivo World Info sem pastas, terminado em `.json`. Alguns detalhes exclusivos do Marinara são descartados. | Outras ferramentas de roleplay. |
| **Markdown** | Um título `## Name` por entrada, com uma linha `Keys:`. | Ler e editar em um editor de texto. |
| **CSV** | Uma planilha com as colunas name, keys, content, folder, enabled, constant e probability. | Editar muitas entradas em uma planilha. |

## Exportar vários lorebooks de uma vez

1. No painel **Lorebooks**, clique no ícone de visto (**Select**).
2. Marque cada lorebook que você quer.
3. Clique em **Export** (exportar) na barra da parte de baixo.

O navegador baixa `marinara-lorebooks.zip`. A exportação em lote sempre usa **Marinara Native**, então tudo volta quando você importa o arquivo.

## Importar entradas de Markdown ou CSV

Você pode acrescentar entradas a um lorebook a partir de um arquivo de texto Markdown ou CSV, por exemplo um que você editou depois de exportar.

1. Abra o lorebook e clique em **Import entries from Markdown or CSV** (importar entradas de Markdown ou CSV) no cabeçalho do editor.
2. Na janela **Import entries**, clique em **Choose file** (escolher arquivo) ou cole o texto na caixa.
3. Confira **Format** (formato). Marinara o deduz a partir do texto.
4. Leia a prévia. No Markdown, use um título `## Name` por entrada, uma linha `Keys: a, b` opcional e depois o texto. No CSV, use uma linha de cabeçalho com name, keys e content, e as colunas opcionais folder, enabled, constant e probability. A prévia mostra quantas entradas estão prontas e lista os erros e avisos por linha.
5. Em **Import into** (importar para), escolha **This lorebook** ou **New lorebook**. Para um novo, digite um nome em **New lorebook name**.
6. Em **When an entry name already exists** (quando já existe uma entrada com esse nome), escolha **Skip the imported entry**, **Import as a renamed copy** ou **Overwrite the existing entry**.
7. Clique no botão **Import**, que mostra a quantidade de entradas.

Uma notificação mostra quantas entradas foram acrescentadas, substituídas e puladas.

Se não funcionou: o botão continua desativado quando o arquivo tem um erro que afeta o arquivo inteiro, como colunas obrigatórias ausentes, ou quando nenhuma entrada é válida. Corrija as linhas que a prévia lista.

## Importar uma pasta inteira do SillyTavern

Para importar de uma pasta completa do SillyTavern, com personagens, chats e presets, veja [Importar do SillyTavern](../data/importing-from-sillytavern.md).

## Guias relacionados

- [Visão geral dos lorebooks](overview.md)
- [Vincular lorebooks a personagens e personas](linking-to-characters.md)
- [Busca semântica para lorebooks](semantic-search.md)
- [Importar do SillyTavern](../data/importing-from-sillytavern.md)
