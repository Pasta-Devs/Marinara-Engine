# Escrever conjuntos de regras de Game Mode

Um conjunto de regras informa ao Game Mode como funciona um sistema de mesa: quais dados um teste rola, o que há na ficha, quais recursos são gastos e o que um descanso recupera. Este guia é para quem quer escrever seu próprio conjunto e compartilhá-lo. Para jogar com um criado por outra pessoa, comece por [Jogar com um conjunto de regras](../game/rulesets.md).

Um conjunto é um arquivo JSON. São dados, não código. Nada nele é executado, então importá-lo não pode fazer nada no seu computador. Antes de importar um arquivo alheio, leia com atenção o texto do Game Master: ele é enviado ao modelo em toda partida que usa o conjunto.

## Leia primeiro: o que um conjunto pode e não pode fazer

Um conjunto só pode preencher os parâmetros de uma mecânica que o Engine já conhece. Hoje ele conhece cinco formas de resolver um teste; o arquivo escolhe uma com `resolution.kind`:

- **`dice-sum`**: rolar dados, adicionar números da ficha e alcançar ou superar uma dificuldade. Isso cobre sistemas d20, sistemas de 2d6 mais atributo e muitos outros.
- **`dice-pool`**: rolar a quantidade de dados do personagem e contar os que atingem um alvo. Isso cobre sistemas em que uma pontuação representa um punhado de dados, não um bônus.

- **`dice-highest`**: rolar uma reserva e ler o maior dado, ou somar os maiores. Isso cobre Blades in the Dark e Trophy Dark.
- **`roll-against`**: rolar igual ou abaixo (ou acima) do número da ficha. Isso cobre perícias percentuais e testes de GURPS.
- **`symbol-pool`**: montar e aprimorar dados narrativos e depois anular símbolos opostos. Isso cobre os testes de Genesys e, desde a Capability API 1.382, suas lutas.

Os cinco são descritos por completo em [Tipos de resolução](ruleset-checks.md#resolution-kinds).

Uma mecânica que não se encaixa nessas formas não pode ser escrita no arquivo. Reservas opostas são um exemplo. Cada uma precisa de um novo tipo de resolução no Engine: uma contribuição de código com testes, não um JSON. Se seu sistema precisa disso, abra uma solicitação de recurso no repositório do Engine e descreva a mecânica com algumas rolagens resolvidas. Esses exemplos viram os testes.

Game Mode pode resolver uma luta com o combate próprio do Marinara ou com as regras do conjunto. O bloco opcional `battle` empresta ao combate do Marinara os números das fichas: veja [Batalhas](ruleset-combat.md#battles-lending-the-sheet-to-marinaras-combat). O bloco opcional `combat` define como o conjunto resolve a luta: veja [Combate](ruleset-combat.md#combat-a-fight-your-own-rules-resolve). O Engine já aplica essas regras. Combat Preference (Preferência de combate) escolhe a apresentação Classic ou, quando o conjunto define distância, um campo Tactical. Um conjunto pode limitar quais dessas opções suas partidas usam com `combat.styles` (veja [Quais estilos uma partida pode usar](ruleset-combat.md#combat-a-fight-your-own-rules-resolve)).

## Início rápido

1. Copie o exemplo que corresponde às rolagens do seu sistema. [`ember-roads.json`](https://github.com/Pasta-Devs/Marinara-Engine/blob/staging/docs/examples/rulesets/ember-roads.json) é um pequeno sistema de 2d6 com três atributos que mostra que o formato não pressupõe d20 nem seis atributos. [`gravewatch.json`](https://github.com/Pasta-Devs/Marinara-Engine/blob/staging/docs/examples/rulesets/gravewatch.json) é uma pequena reserva de dados de dez faces com três pontuações e seis ofícios. Como exemplo completo, veja o [pacote 5e (SRD 5.1)](https://github.com/Pasta-Devs/Marinara-Agents/tree/staging/packages/ruleset-5e-2014) oficial: seu `ruleset.json` e seus `catalogs/` são o que o Agent Organizer instala.
2. Troque `id` pelo seu. Use letras minúsculas, dígitos e hífens simples, como `ember-roads`.
3. Edite a ficha, os descansos e o texto do Game Master.
4. Importe o arquivo; veja [Experimentar seu conjunto](#trying-your-ruleset). A importação verifica o arquivo inteiro e informa os erros linha por linha antes de salvar qualquer coisa.
5. Crie uma partida, escolha seu conjunto em **Rules** (Regras) e jogue alguns testes.

Para receber ajuda enquanto escreve, indique o JSON Schema ao editor adicionando esta primeira linha dentro das chaves externas do arquivo:

```json
"$schema": "https://raw.githubusercontent.com/Pasta-Devs/Marinara-Engine/staging/docs/extending/ruleset.schema.json",
```

O esquema detecta chaves mal escritas e tipos incorretos durante a digitação. Ele não verifica se os nomes apontam para elementos existentes, como uma perícia que nomeia um atributo. A importação faz isso.

Você pode adicionar uma linha `"$comment": "..."` a qualquer objeto para deixar uma nota. O Engine a ignora.

## As partes do arquivo

| Chave | Conteúdo |
| --- | --- |
| `schemaVersion` | Sempre `1`. |
| `id`, `version` | O nome do conjunto para o Engine e um inteiro que você aumenta a cada mudança publicada. |
| `name` | O que os jogadores veem no assistente. |
| `edition` | Opcional. Uma linha sobre a edição ou o rascunho. |
| `license` | Opcional. Um ID SPDX e a atribuição exigida pela fonte. |
| `coverage` | O que o conjunto cobre e o resumo de uma linha exibido no assistente. |
| `resolution` | Como um teste ou salvaguarda é rolado. |
| `sheet` | Tudo que há na ficha. |
| `rests` | O que cada descanso restaura e limpa. |
| `gm` | O texto fornecido ao modelo do Game Master e os valores de ficha que ele vê por personagem. |
| `catalogs` | Opcional. Entradas prontas oferecidas pelo editor para evitar listas longas digitadas à mão. |
| `items` | Opcional. O vocabulário em que seus itens são escritos: categorias, raridades, estatísticas, espaços, dinheiro. |
| `battle` | Opcional. O que uma batalha lê da ficha e grava de volta depois. |
| `combat` | Opcional. Como suas regras resolvem uma luta e o que a tela de batalha executa. |
| `layers` | Opcional. Variantes do conjunto ativadas na criação de uma partida. |

O arquivo pode ter até 512 KB (256 KB antes da Capability API 1.340). Texto que entra num prompt (nomes, rótulos, texto do Game Master) não pode conter quebras de linha, colchetes nem chaves duplas.

IDs dentro da ficha (atributos, perícias, campos, reservas etc.) usam letras minúsculas, dígitos e sublinhados, começando com uma letra, como `grit_max`.

## As páginas deste guia

Esta página explica o que é um conjunto de regras, como começar um e como experimentá-lo e compartilhá-lo. O restante do guia é dividido por assunto:

- [Testes de conjuntos de regras](ruleset-checks.md): Como um conjunto de regras rola um teste ou uma salvaguarda: os cinco tipos de resolução, faixas de resultado, testes que rolam do próprio jeito e gastos ou amuletos que mudam uma rolagem
- [Fichas de conjuntos de regras](ruleset-sheets.md): O que vai na ficha de personagem de um conjunto de regras: atributos, perícias, campos e listas, estados vivos, trilhas de ferimentos, penalidades, descansos e o texto do Game Master, além da ficha do grupo e dos relógios de progresso
- [Catálogos de conjuntos de regras](ruleset-catalogs.md): Entradas prontas que o editor de fichas oferece num seletor: o cabeçalho do catálogo, entradas, valores que o conjunto de regras mantém, comandos de ficha e o comando de uso
- [Mecânicas de entradas de conjuntos de regras](ruleset-mechanics.md): O que uma entrada de catálogo faz em números: o bloco `mechanics` de uma entrada, lido por testes, descansos e lutas
- [Construtor de personagens de conjuntos de regras](ruleset-character-builder.md): O construtor guiado: criar um personagem em etapas, de raça e classe a pontuações, proficiências, magias e equipamento
- [Itens de conjuntos de regras](ruleset-items.md): O que um grupo carrega: categorias, armas, armaduras, munição, saque, dinheiro, equipamento inicial e mercados
- [Combate de conjuntos de regras](ruleset-combat.md): Como um conjunto de regras participa de uma luta: o bloco `battle`, que empresta a ficha ao combate do Marinara, e o bloco `combat`, que resolve a luta inteira pelas próprias regras do conjunto, com seu bestiário, tabuleiro, reações e disputas
- [Camadas, traduções e migrações de conjuntos de regras](ruleset-layers-and-translations.md): Variantes que um jogador ativa para uma partida, traduções do texto de um conjunto de regras e a transferência de valores para novos IDs quando uma ficha muda

<a id="trying-your-ruleset"></a>

## Testar seu conjunto de regras

Conjuntos de regras da comunidade usam o mesmo interruptor dos agentes importados. Abra **Settings** (configurações) > **Advanced** (avançado) > **Danger Zone** (zona de perigo) e confirme que **Allow custom Agent imports** (permitir importações de agentes personalizados) esteja ativado. A importação também precisa de acesso por localhost ou de **Admin Access** (acesso de administrador) configurado.

1. Abra o painel **Agents** (agentes) e escolha o botão **Import agents** (importar agentes), o ícone de download na fileira de botões no topo do painel.
2. Escolha **Game Mode ruleset** (conjunto de regras do modo de jogo) e selecione seu arquivo JSON, ou um arquivo de pacote de conjunto terminado em `.ruleset.json` (veja [Compartilhar seu conjunto de regras](#sharing-your-ruleset)).
3. Leia a revisão. Ela mostra nome, versão, licença, o que o conjunto de regras cobre e o texto do Game Master. Escolha **Import** (importar).

Seu conjunto aparece na seção **Rules** (regras) do painel e na escolha **Rules** do assistente de configuração para novas partidas. Um conjunto importado de um arquivo é classificado como `local/<your id>`, para que nunca seja confundido com um conjunto oficial ou de outra pessoa.

### Alterar um conjunto de regras já importado

Uma versão importada nunca é reescrita. Se você alterar o arquivo e importá-lo novamente com a mesma `version`, a importação será recusada e pedirá que aumente o número. Isso é intencional: uma partida fica vinculada à versão exata em que foi criada, para que uma campanha em andamento nunca acorde com cálculos diferentes.

Portanto, o ciclo durante a elaboração é: editar, aumentar `version`, importar, iniciar uma nova partida. As versões antigas continuam instaladas ao lado da nova até você remover o conjunto de regras da seção **Rules**. Remover um conjunto ainda usado por uma partida faz com que ela informe que o conjunto está ausente até você importá-lo novamente.

Se mudar a estrutura da ficha (adicionar, remover ou renomear elementos), aumente também `sheet.version`. As fichas existentes são lidas com tolerância: valores que a nova ficha desconhece são mantidos, e os ausentes recebem seus padrões.

<a id="sharing-your-ruleset"></a>

## Compartilhar seu conjunto de regras

**Como arquivo.** Envie o arquivo JSON a um amigo. Ele o importa como você fez.

**Como arquivo de pacote.** Um conjunto grande demais para um único arquivo, com catálogos em arquivos próprios, viaja como um único arquivo JSON simples chamado `<name>.ruleset.json`. Ele contém o manifesto do pacote e os documentos do conjunto, cada um com seus bytes exatos em base64:

```json
{
  "format": "marinara-ruleset",
  "version": 1,
  "manifest": { "kind": ["ruleset"], "…": "the package manifest" },
  "files": {
    "ruleset.json": "<base64>",
    "catalogs/spells.json": "<base64>"
  }
}
```

O manifesto lista `ruleset.json` e cada `catalogs/<id>.json` em `contributions.assets.paths` e em `files`, com o tamanho e o sha256 de cada um. Um editor de conjuntos como o Pixelforge cria um. **Import agents** → **Game Mode ruleset** recebe o arquivo e mostra a mesma revisão de um arquivo de conjunto, com cada catálogo e seu número de entradas. Nada nele é compactado, então ele nunca contém mais que o próprio tamanho. Ele é lido como dados e nunca instalado como pacote: é recusado, com o motivo, se contiver qualquer outra coisa (outra chave, qualquer outro arquivo, um documento que não seja base64 estrito ou não seja texto UTF-8), se o manifesto dele for mais que o de um conjunto (qualquer código, permissão ou outra contribuição), se um arquivo não for o que o manifesto lista, se um `$comment` passar de 2,000 caracteres ou `$schema` nomear qualquer coisa além do esquema do próprio Engine, ou se o conjunto ou um catálogo não puder ser lido. Ele é classificado como `local/<its id>`, como um arquivo de conjunto, com no máximo 132 MB e no máximo 12 arquivos de catálogo de 2 MB cada e 40 traduções de 8 MB cada (veja abaixo). Uma versão é o conjunto e os catálogos juntos, então um catálogo alterado também exige uma `version` maior. Pacotes de conjunto não são aceitos como zip.

**Pelo catálogo oficial de agentes.** Um conjunto publicado no catálogo é um arquivo de pacote de conjunto de regras exatamente neste formato, `<id>.ruleset.json`, nunca um pacote zip (Capability API 1.374). Seu manifesto declara Capability API 1.374 ou mais recente, para que ele nunca seja oferecido a um Engine mais antigo. O Engine o lê com o mesmo leitor e as mesmas verificações de um arquivo de pacote que você importa, exige que corresponda ao manifesto listado pelo catálogo e o instala como qualquer pacote do catálogo. Um conjunto do catálogo cujo artefato é um zip é recusado antes de qualquer download; os conjuntos já instalados continuam funcionando.

**De um repositório do GitHub.** Se você mantém seu trabalho em um repositório público do GitHub, coloque cada conjunto de regras em uma pasta `rulesets` na raiz do repositório, um arquivo por conjunto:

```text
your-repository/
  agents.json        (optional, only if you also share agents)
  rulesets/
    ember-roads.json
    another-system.json
```

Um usuário adiciona seu repositório uma vez pela lista de repositórios de agentes personalizados, revisa o conteúdo e pode sincronizar depois para receber novas versões. A lista de repositórios personalizados é um recurso avançado que a pessoa responsável pelo servidor precisa ativar com `ENABLE_CUSTOM_AGENT_REPOS=true`. Conjuntos de regras de um repositório são classificados sob o nome do proprietário, como `alice/ember-roads`, para que dois autores possam publicar um conjunto chamado `v20` sem conflitos.

Dois limites se aplicam. Um repositório pode conter no máximo 32 arquivos JSON diretamente em `rulesets`; se tiver mais, será recusado. Uma conta chamada `local` não pode publicar conjuntos de regras, pois `local/` é reservado aos importados de arquivos.

**No catálogo oficial.** Um sistema muito jogado e com licenciamento claro pode ser oferecido a todos por **Agent Organizer** (organizador de agentes). Isso exige um pull request para o repositório [Marinara-Agents](https://github.com/Pasta-Devs/Marinara-Agents). Veja o pacote `ruleset-5e-2014` para conferir a estrutura.

## Licenciamento

Publique apenas textos de regras que você tem o direito de compartilhar. Muitos sistemas publicam um documento de referência com licença aberta, e é desse documento que você pode copiar. Coloque o identificador da licença e o texto de atribuição exigido em `license`. Não copie textos de livros de regras sem licença aberta. Um conjunto de regras precisa principalmente de nomes e números, e o texto do Game Master deve ser escrito com suas próprias palavras.

## Solução de problemas

- **A importação diz que um nome não existe.** Algo no arquivo aponta para um identificador não declarado, como uma perícia que nomeia um atributo removido. A mensagem informa o caminho até a linha.
- **A importação diz que uma versão já está instalada com conteúdo diferente.** Aumente `version` e importe novamente.
- **Meu conjunto de regras não aparece no assistente de configuração.** Confira se **Allow custom Agent imports** está ativado. Enquanto estiver desativado, conjuntos importados ficam fora de novas partidas. Partidas que já usam um continuam funcionando.
- **Uma partida diz que seu conjunto de regras está ausente.** A versão exata em que a partida foi criada não está instalada. Importe novamente essa versão do arquivo.
