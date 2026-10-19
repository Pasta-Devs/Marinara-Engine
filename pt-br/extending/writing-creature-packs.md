# Escrever pacotes de criaturas

Um **pacote de criaturas** traz a arte das criaturas que você enfrenta nas lutas do Game Mode. Quando um pacote é escolhido, um inimigo que tem arte no pacote é desenhado com essa arte no tabuleiro de batalha, em vez de um marcador redondo. A arte fica virada para a direção em que o inimigo se moveu por último e é desenhada no tamanho da própria criatura. Um inimigo sem arte no pacote continua com o marcador. Veja [Batalhas táticas e terreno](../game/combat.md#tactical-battles-and-terrain) para saber como isso aparece durante o jogo.

Um pacote é um único arquivo JSON (`.creatures.json`). O jeito mais fácil de criar um é a aba **Creatures** (criaturas) do Pixelforge, que monta o arquivo a partir de uma imagem por criatura. Esta página descreve o próprio arquivo, para quem monta pacotes de outra forma.

## O arquivo

```json
{
  "creaturePackVersion": 1,
  "id": "my-monsters",
  "name": "My monsters",
  "version": 1,
  "author": "Robin",
  "tileSize": 48,
  "sheets": [{ "id": "s1", "png": "data:image/png;base64,iVBORw0KGgo...", "width": 2048, "height": 1536 }],
  "creatures": [
    {
      "id": "goblin",
      "match": ["5e-2014/creatures/goblin", "Goblin"],
      "size": "small",
      "w": 1,
      "h": 2,
      "frames": 1,
      "variants": [
        { "sheet": "s1", "x": 0, "y": 0 },
        { "sheet": "s1", "x": 1, "y": 0 }
      ]
    }
  ]
}
```

| Campo | O que é |
| --- | --- |
| `creaturePackVersion` | Sempre `1`. |
| `id` | Letras minúsculas, dígitos, `_` e `-`. A biblioteca guarda um pacote importado sob `local/<id>`. |
| `name`, `author` | Exibidos na biblioteca. `author` é opcional. |
| `version` | Um número inteiro. Uma versão nunca é reescrita: para mudar um pacote, aumente a versão dele. Importar o mesmo arquivo de novo não muda nada. |
| `tileSize` | O tamanho de uma casa da grade em pixels: um múltiplo de 16, de 16 a 96. A grade do Game Mode é de 48. |
| `sheets` | Até 64 imagens, cada uma com no máximo 8.192 pixels de lado. |
| `creatures` | Até 2.000 criaturas. |

## Folhas

O `png` de uma folha (a imagem que reúne os quadros) precisa ser uma **data URL** de PNG: `data:image/png;base64,` seguido de base64 e mais nada. Um link para uma imagem hospedada em outro lugar é recusado, assim como qualquer coisa depois do base64. Assim, um pacote só consegue mostrar as próprias imagens. `width` e `height` precisam ser o tamanho real do PNG; o Engine lê esses valores do cabeçalho da imagem e recusa um pacote cujas folhas informem outra coisa.

## Uma criatura

| Campo | O que é |
| --- | --- |
| `id` | O ID da criatura no pacote, único. |
| `match` | Para o que é a arte, de 1 a 16 entradas. Uma entrada é uma criatura de um conjunto de regras ou um nome, e os dois tipos podem ficar lado a lado. |
| `size` | `tiny`, `small`, `medium`, `large`, `huge` ou `gargantuan`. Isso muda só a aparência; toda unidade continua ocupando uma casa. |
| `w`, `h` | O tamanho de um quadro em casas, de 1 a 6 cada. |
| `frames` | `1` para uma criatura parada, `3` para uma que anda (passo, parada, passo). |
| `variants` | As **aparências** dela, de 1 a 8, cada uma indicando onde o seu bloco começa numa folha: `sheet` e a casa superior esquerda `x`, `y`. |

### O que `match` nomeia

- **Uma criatura de conjunto de regras:** `<catalog>/<entry>` (por exemplo, `creatures/goblin`) corresponde a essa entrada do bestiário em qualquer conjunto de regras. `<ruleset>/<catalog>/<entry>` (por exemplo, `5e-2014/creatures/goblin`) corresponde a ela só nesse conjunto de regras.
- **Um nome:** corresponde a um inimigo pelo nome. Maiúsculas, minúsculas e pontuação são ignoradas, assim como um número no final, então "Goblin 2" é um goblin.

Um combatente vindo do bestiário de um conjunto de regras é reconhecido primeiro pela entrada e depois pelo nome. Se duas criaturas corresponderem à mesma coisa, vale a que aparece primeiro no pacote; o Engine avisa sobre isso quando o pacote é importado.

### Tamanhos

Os quadros são contados em casas, e uma criatura é desenhada em pé sobre a borda de baixo da sua casa, centralizada, então uma criatura grande se ergue sobre as casas ao redor. Estes tamanhos ficam bons na grade de 48 pixels:

| Criatura | Quadro (`w` por `h`) |
| --- | --- |
| Miúda, ou uma criatura pequena ou média de quatro patas | 1 por 1 |
| Pequena ou média, de pé | 1 por 2 |
| Grande | 2 por 2, ou 2 por 3 se ficar de pé (um ogro, um golem) |
| Enorme | 3 por 3, ou 3 por 4 de pé (um gigante) |
| Imensa | 4 por 4 |

### O bloco: linhas e quadros

Cada aparência é um **bloco** na sua folha. Um bloco tem `frames` quadros na horizontal e 4 linhas na vertical, e cada quadro tem `w` por `h` casas. As linhas são as direções para as quais a criatura está virada, nesta ordem:

1. para baixo (de frente para quem olha)
2. para a esquerda
3. para a direita
4. para cima (vista de costas)

Uma criatura parada (`frames: 1`) é uma coluna com as quatro direções. Uma que anda (`frames: 3`) tem passo, parada e passo ao longo de cada linha, como um personagem andando no RPG Maker. Todo bloco precisa ficar inteiro dentro da sua folha; o Engine aponta qualquer bloco que passe da borda.

### Aparências

Uma criatura com várias aparências (outras roupas, cores ou armas) dá uma delas a cada um dos seus combatentes. Um combatente mantém a mesma aparência toda vez que é desenhado, e dois goblins na mesma luta podem ser diferentes. Todas as aparências de uma criatura têm o mesmo tamanho.

Na aba **Creatures** do Pixelforge, **Add looks** (adicionar aparências), ao lado de uma criatura, acrescenta mais imagens do mesmo tamanho da primeira, até oito no total.

## Usar um pacote

Na aba **Creatures** do Pixelforge, use **Import a creature pack file** (importar um arquivo de pacote de criaturas) ou, para um pacote feito ali, **Save to the library** (salvar na biblioteca). Depois, escolha **Use for fights** (usar nas lutas). Um único pacote desenha todas as lutas. Remover o pacote escolhido, ou usar **Use tokens instead** (usar marcadores em vez disso), volta para os marcadores.
