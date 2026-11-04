# Escrever conjuntos de regras de Game Mode

Um conjunto de regras informa ao Game Mode como funciona um sistema de mesa: quais dados um teste rola, o que há na ficha de personagem, quais recursos são gastos e o que um descanso recupera. Escreva um para trazer o seu próprio sistema para o Game Mode e compartilhá-lo. Para jogar com um conjunto de regras criado por outra pessoa, veja [Jogar com um conjunto de regras](../game/rulesets.md).

Um conjunto de regras é um arquivo JSON. São dados, não código, então nada nele é executado e importá-lo não pode prejudicar o seu computador. Leia o texto do Game Master antes de importar o arquivo de outra pessoa, porque esse texto é enviado ao modelo em toda partida que usa o conjunto de regras.

## Começar um conjunto de regras

1. Copie o arquivo de exemplo que corresponde ao jeito como o seu sistema rola os dados:
   - [`ember-roads.json`](https://github.com/Pasta-Devs/Marinara-Engine/blob/staging/docs/examples/rulesets/ember-roads.json) é um pequeno sistema de 2d6 com três atributos. Ele mostra que nada no formato pressupõe um d20 ou seis atributos.
   - [`gravewatch.json`](https://github.com/Pasta-Devs/Marinara-Engine/blob/staging/docs/examples/rulesets/gravewatch.json) é uma pequena reserva de dados de dez faces com três pontuações e seis ofícios.
   - O [pacote 5e (SRD 5.1)](https://github.com/Pasta-Devs/Marinara-Agents/tree/staging/packages/ruleset-5e-2014) oficial, um exemplo completo. O `ruleset.json` e os `catalogs/` dele são o que o Agent Organizer instala.
2. Troque `id` pelo seu. Um ID é feito de letras minúsculas, dígitos e hífens simples, como `ember-roads`.
3. Abra a sua cópia em um editor de texto, como o Bloco de Notas ou o VS Code, e salve-a com a terminação `.json`. Mude primeiro `name`, depois os nomes dos atributos em `sheet` e, por fim, `rests` e o texto de `gm`. [Partes do arquivo](#parts-of-the-file) lista cada chave, e [Páginas de referência](#reference-pages) traz os links para as páginas que as explicam.
4. Importe o arquivo (veja [Experimentar o seu conjunto de regras](#try-your-ruleset)). A importação verifica o arquivo inteiro e informa o que está errado, linha por linha, antes de salvar qualquer coisa.
5. Crie uma partida nova (veja [Game Mode: primeiros passos](../game/getting-started.md)), escolha o seu conjunto de regras em **Rules** (regras) e jogue alguns testes.

Se não funcionou, veja [Solução de problemas](#troubleshooting).

Para receber ajuda do editor enquanto digita, adicione isto como a primeira linha dentro das chaves externas do arquivo. Isso aponta o editor para o JSON Schema:

```json
"$schema": "https://raw.githubusercontent.com/Pasta-Devs/Marinara-Engine/staging/docs/extending/ruleset.schema.json",
```

O esquema detecta chaves mal escritas e tipos errados. Ele não consegue verificar se os nomes apontam para coisas que existem, como uma perícia que nomeia um atributo. A importação faz isso. Você pode adicionar uma linha `"$comment": "..."` a qualquer objeto para deixar uma nota para si mesmo. O Engine a ignora.

## O que um conjunto de regras pode e não pode fazer

Um conjunto de regras preenche as lacunas de uma mecânica que o Engine já conhece. O Engine conhece cinco formas de resolver um teste, e o seu arquivo escolhe uma com `resolution.kind`:

- **`dice-sum`**: rolar alguns dados, somar números da ficha e alcançar ou superar uma dificuldade. Isso cobre sistemas d20, sistemas de 2d6 mais atributo e muitos outros.
- **`dice-pool`**: rolar a quantidade de dados do próprio personagem e contar os que atingem um alvo. Isso cobre sistemas em que uma pontuação é um punhado de dados, e não um bônus.
- **`dice-highest`**: rolar uma reserva e ler o maior dado, ou somar os maiores. Isso cobre Blades in the Dark e Trophy Dark.
- **`roll-against`**: rolar igual ou abaixo (ou acima) do número da ficha. Isso cobre perícias percentuais e testes de GURPS.
- **`symbol-pool`**: montar e aprimorar dados narrativos e depois anular símbolos opostos. Isso cobre os testes de Genesys e, desde a Capability API 1.382, as lutas dele.

Os cinco são descritos por completo em [Tipos de resolução](ruleset-checks.md#resolution-kinds).

Uma mecânica que não se encaixa nessas formas, como reservas opostas, não pode ser escrita num arquivo de conjunto de regras. Ela precisa de um novo tipo de resolução dentro do Engine, o que é uma contribuição de código com testes. Se o seu sistema precisa de um, abra uma solicitação de recurso no repositório do Engine e descreva a mecânica com algumas rolagens resolvidas. Essas rolagens viram os testes.

O Game Mode resolve uma luta com o combate próprio do Marinara ou com as regras do seu conjunto de regras. Um bloco opcional `battle` empresta ao combate do Marinara os números das suas fichas de personagem: veja [Batalhas](ruleset-combat.md#battles-lending-the-sheet-to-marinaras-combat). Um bloco opcional `combat` define como o próprio conjunto de regras resolve a luta: veja [Combate](ruleset-combat.md#combat-a-fight-your-own-rules-resolve). A Combat Preference (preferência de combate) da partida escolhe a apresentação Classic ou, quando o conjunto de regras define distância, um campo de batalha Tactical. Um conjunto de regras pode limitar quais dessas opções as partidas dele usam com `combat.styles` (veja [Quais estilos uma partida pode usar](ruleset-combat.md#combat-a-fight-your-own-rules-resolve)).

<a id="parts-of-the-file"></a>

## Partes do arquivo

| Chave | Conteúdo |
| --- | --- |
| `schemaVersion` | Sempre `1`. |
| `id`, `version` | O nome do conjunto de regras para o Engine e um número inteiro que você aumenta a cada mudança publicada. |
| `name` | O que os jogadores veem no assistente de configuração. |
| `edition` | Opcional. Uma linha sobre a edição ou o rascunho. |
| `license` | Opcional. Um ID SPDX e o texto de atribuição que a sua fonte exige. |
| `coverage` | O que o conjunto de regras cobre e o resumo de uma linha exibido no assistente de configuração. |
| `resolution` | Como um teste ou uma salvaguarda é rolado. |
| `sheet` | Tudo o que há na ficha de personagem. |
| `rests` | O que cada tipo de descanso restaura e limpa. |
| `gm` | O texto fornecido ao modelo do Game Master e os valores da ficha que ele vê de cada personagem. |
| `catalogs` | Opcional. Entradas prontas que o editor de fichas oferece, para que os jogadores não digitem listas longas à mão. |
| `items` | Opcional. O vocabulário em que os seus itens são escritos: categorias, raridades, estatísticas, espaços, dinheiro. |
| `battle` | Opcional. O que uma batalha pode ler da ficha e o que ela grava de volta depois. |
| `combat` | Opcional. Como as suas próprias regras resolvem uma luta e o que a tela de batalha executa em seguida. |
| `layers` | Opcional. Variantes do seu conjunto de regras que um jogador ativa quando uma partida é criada. |

O arquivo pode ter até 512 KB (256 KB antes da Capability API 1.340). O texto que vai parar num prompt (nomes, rótulos, texto do Game Master) não pode conter quebras de linha, colchetes nem chaves duplas.

Os IDs dentro da ficha (atributos, perícias, campos, reservas etc.) usam letras minúsculas, dígitos e sublinhados, começando com uma letra, como `grit_max`.

<a id="reference-pages"></a>

## Páginas de referência

Esta página explica como começar, experimentar e compartilhar um conjunto de regras. Cada uma das outras páginas trata de um assunto:

- [Testes de conjuntos de regras](ruleset-checks.md): os cinco tipos de resolução, as faixas de resultado, os testes que rolam do próprio jeito e os gastos ou amuletos que mudam uma rolagem.
- [Fichas de conjuntos de regras](ruleset-sheets.md): atributos, perícias, campos e listas, estados vivos, trilhas de ferimentos, penalidades, descansos, o texto do Game Master, a ficha do grupo e os relógios de progresso.
- [Catálogos de conjuntos de regras](ruleset-catalogs.md): entradas prontas que o editor de fichas oferece num seletor.
- [Mecânicas de entradas de conjuntos de regras](ruleset-mechanics.md): o bloco `mechanics` de uma entrada de catálogo, lido por testes, descansos e lutas.
- [Construtor de personagens de conjuntos de regras](ruleset-character-builder.md): criar um personagem em etapas, de raça e classe a pontuações, proficiências, magias e equipamento.
- [Itens de conjuntos de regras](ruleset-items.md): categorias, armas, armaduras, munição, saque, dinheiro, equipamento inicial e mercados.
- [Combate de conjuntos de regras](ruleset-combat.md): o bloco `battle` e o bloco `combat`, com o bestiário, o tabuleiro, as reações e as disputas.
- [Camadas, traduções e migrações de conjuntos de regras](ruleset-layers-and-translations.md): variantes que um jogador ativa para uma partida, traduções e a transferência de valores para novos IDs quando uma ficha muda.

<a id="try-your-ruleset"></a>

## Experimentar o seu conjunto de regras

Antes de começar, ative **Allow custom Agent imports** (permitir importações de agentes personalizados) em **Settings → Advanced → Danger Zone** (Configurações → Avançado → Zona de perigo). Os conjuntos de regras importados usam o mesmo botão liga/desliga de segurança dos agentes importados, então ele fica desligado até você ativá-lo. A importação também precisa de acesso por localhost ou do segredo de administrador (em **Settings → Advanced → Admin Access**).

1. Abra o painel **Agents** (agentes) e escolha o botão **Import agents** (importar agentes), o ícone de download na fileira de botões no topo do painel.
2. Escolha **Game Mode ruleset** (conjunto de regras do Game Mode) e selecione o seu arquivo JSON, ou um arquivo de pacote de conjunto de regras terminado em `.ruleset.json` (veja [Compartilhar o seu conjunto de regras](#sharing-your-ruleset)).
3. Leia a revisão. Ela mostra o nome, a versão, a licença, o que o conjunto de regras cobre e o texto do Game Master. Escolha **Import** (importar).

O seu conjunto de regras aparece na seção **Rules** do painel e na opção **Rules** do assistente de configuração para novas partidas. Um conjunto de regras importado de um arquivo é classificado como `local/<your id>`, então ele nunca é confundido com um conjunto oficial ou com o de outra pessoa.

### Alterar um conjunto de regras já importado

Uma versão importada nunca é reescrita. Se você importar um arquivo alterado com a mesma `version`, a importação é recusada e pede que você aumente o número. Uma partida fica vinculada à versão exata em que foi criada, então uma campanha em andamento nunca muda os cálculos.

Enquanto você faz o rascunho, o ciclo é: editar, aumentar `version`, importar, iniciar uma partida nova. As versões antigas continuam instaladas ao lado da nova até você remover o conjunto de regras da seção **Rules**. Remover um conjunto de regras que uma partida ainda usa faz essa partida dizer que o conjunto de regras dela está ausente até você importá-lo de novo.

Se você mudar a estrutura da ficha (adicionar, remover ou renomear coisas), aumente também `sheet.version`. As fichas existentes são lidas com tolerância: os valores que a nova ficha não conhece são mantidos, e os que faltam recebem os seus padrões.

<a id="sharing-your-ruleset"></a>

## Compartilhar o seu conjunto de regras

Há cinco formas de compartilhar.

### Como arquivo

Envie o arquivo JSON para um amigo. Ele o importa do mesmo jeito que você.

### Como arquivo de pacote

Um conjunto de regras grande demais para um único arquivo, com catálogos em arquivos próprios, viaja como um único arquivo JSON simples chamado `<name>.ruleset.json`. Ele contém o manifesto do pacote e os documentos do conjunto de regras, cada um guardado em base64 (uma forma de escrever um arquivo como texto simples):

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

O manifesto lista `ruleset.json` e cada `catalogs/<id>.json` em `contributions.assets.paths` e em `files`, com o tamanho e o sha256 (uma impressão digital do arquivo) de cada um. Um editor de conjuntos de regras como o Pixelforge cria esse arquivo. **Import agents** → **Game Mode ruleset** recebe o arquivo e mostra a mesma revisão de um arquivo de conjunto de regras, com cada catálogo e o número de entradas dele.

O arquivo é lido como dados e nunca é instalado como pacote. Nada nele é compactado, então ele nunca contém mais que o próprio tamanho. Limites:

- Ele é classificado como `local/<its id>`, como um arquivo de conjunto de regras.
- Ele tem no máximo 132 MB, com no máximo 12 arquivos de catálogo de 2 MB cada e 40 traduções de 8 MB cada (veja abaixo).
- Uma versão é o conjunto de regras e os catálogos dele juntos, então um catálogo alterado também exige uma `version` maior.
- Pacotes de conjunto de regras não são aceitos como zip.

Ele é recusado, com o motivo, se:

- contiver outra chave ou qualquer outro arquivo, ou um documento que não seja base64 estrito ou não seja texto UTF-8
- o manifesto dele pedir mais do que um conjunto de regras precisa (qualquer código, permissão ou outra contribuição)
- um arquivo não for o que o manifesto lista
- um `$comment` passar de 2.000 caracteres, ou `$schema` nomear qualquer coisa além do esquema do próprio Engine
- o conjunto de regras ou um catálogo não puder ser lido

### Pelo catálogo oficial de agentes

Um conjunto de regras publicado no catálogo é um arquivo de pacote de conjunto de regras exatamente neste formato, `<id>.ruleset.json`, nunca um pacote zip. O manifesto dele declara Capability API 1.374 ou mais recente, então ele nunca é oferecido a um Engine mais antigo. O Engine o lê com o mesmo leitor e as mesmas verificações de um arquivo de pacote que você importa, exige que ele corresponda ao manifesto listado pelo catálogo e o instala como qualquer pacote do catálogo. Um conjunto de regras do catálogo cujo artefato é um zip é recusado antes de qualquer download; os conjuntos de regras já instalados continuam funcionando.

### De um repositório do GitHub

Se você mantém o seu trabalho em um repositório público do GitHub, coloque cada conjunto de regras em uma pasta `rulesets` na raiz do repositório, um arquivo por conjunto de regras:

```text
your-repository/
  agents.json        (optional, only if you also share agents)
  rulesets/
    ember-roads.json
    another-system.json
```

Um usuário adiciona o seu repositório uma vez, revisa o que ele contém e sincroniza depois para receber novas versões. A lista de repositórios personalizados é um recurso avançado. A pessoa que executa o servidor a ativa com `ENABLE_CUSTOM_AGENT_REPOS=true` e depois abre **Agents → Agent Organizer → Custom Sources** (Agentes → Organizador de agentes → Fontes personalizadas). Os conjuntos de regras de um repositório são classificados sob o nome do dono do repositório, como `alice/ember-roads`, para que dois autores possam publicar um conjunto de regras chamado `v20` sem conflito.

Dois limites se aplicam. Um repositório pode conter no máximo 32 arquivos JSON diretamente dentro de `rulesets`, e um que tenha mais é recusado. Uma conta chamada `local` não pode publicar conjuntos de regras, porque `local/` é reservado aos conjuntos de regras importados de um arquivo.

### No catálogo oficial

Um sistema muito jogado e com licenciamento claro pode ser oferecido a todos pelo **Agent Organizer**. Para propor um, abra um pull request no repositório [Marinara-Agents](https://github.com/Pasta-Devs/Marinara-Agents). Veja o pacote `ruleset-5e-2014` de lá para conferir a estrutura.

## Licenciamento

Publique apenas textos de regras que você tem o direito de compartilhar. Muitos sistemas publicam um documento de referência sob uma licença aberta, e é desse documento que você pode copiar. Coloque em `license` o ID da licença (um ID SPDX, um nome padrão curto como `CC-BY-4.0`) e o texto de atribuição que a licença pede. Não copie textos de livros de regras que não tenham licença aberta. Um conjunto de regras precisa principalmente de nomes e números. Escreva o texto do Game Master com as suas próprias palavras.

<a id="troubleshooting"></a>

## Solução de problemas

- **A importação diz que um nome não existe.** Algo no arquivo aponta para um ID que não foi declarado, como uma perícia que nomeia um atributo que você removeu. A mensagem informa o caminho até a linha.
- **A importação diz que uma versão já está instalada com conteúdo diferente.** Aumente `version` e importe de novo.
- **O meu conjunto de regras não aparece no assistente de configuração.** Confira se **Allow custom Agent imports** está ativado. Enquanto estiver desativado, os conjuntos de regras importados ficam fora das partidas novas, e as partidas que já usam um continuam funcionando.
- **Uma partida diz que o conjunto de regras dela está ausente.** A versão exata em que a partida foi criada não está instalada. Importe essa versão do arquivo de novo.
