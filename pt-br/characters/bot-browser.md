# Card Browser: encontrar e importar personagens

Este guia explica o **Card Browser** (navegador de cards), a ferramenta integrada do Marinara Engine para encontrar cards de personagem em sites públicos e trazê-los para a sua biblioteca. Aqui você vê as fontes disponíveis, como buscar e filtrar, e como o conteúdo adulto funciona em cada fonte. O guia também mostra como importar um personagem ou salvá-lo como arquivo. Em versões antigas, esta aba se chamava **Bot Browser** ou **Browser**.

O card de personagem é um arquivo que guarda o nome, a personalidade, a saudação inicial e outros detalhes de um personagem. Normalmente você baixaria o card de um site e depois faria upload dele no Marinara. O **Card Browser** faz as duas etapas para você, em um lugar só.

## O que é o Card Browser

O **Card Browser** busca em vários sites públicos de cards de personagem sem sair do Marinara. Ele tem suporte a cinco fontes: **ChubAI**, **JannyAI**, **Pygmalion**, **Wyvern** e **DataCat**. **CharacterTavern** continua na lista, mas por enquanto não é possível navegar nessa fonte (veja [CharacterTavern](#charactertavern)). Escolha uma fonte, filtre os resultados e veja os detalhes completos de um personagem. Depois, importe esse personagem para a biblioteca ou salve como arquivo PNG. Nas configurações padrão, não é preciso ter conta nem chave de API para navegar e importar cards de personagem.

## Como abrir o Card Browser

Existem duas formas de abrir o **Card Browser**.

1. Clique no ícone **Card Browser** na barra superior. Ele fica na fileira de botões de painel, do lado direito.
2. Ou abra o painel **Card Browser** na barra lateral direita e clique no botão **Download Cards** (baixar cards) no topo desse painel.

De qualquer uma das formas, toda a área de conteúdo passa a mostrar a tela completa do **Card Browser**. Essa tela substitui a área do chat. Não é uma janelinha pop-up.

Para sair, clique no botão de seta para trás, no canto superior esquerdo do cabeçalho do **Card Browser**. Você volta para a tela de onde veio.

O **Card Browser** continua carregado enquanto o aplicativo estiver aberto. Se você fechar e abrir de novo, a última busca, os filtros e o personagem selecionado continuam lá. Recarregar o aplicativo inteiro zera tudo.

## Escolher uma fonte

Clique no botão de fonte no cabeçalho. Ele mostra o nome da fonte atual e uma setinha. Abre um menu com as fontes nesta ordem: **ChubAI**, **JannyAI**, **CharacterTavern**, **Pygmalion**, **Wyvern** e **DataCat**. **CharacterTavern** aparece com o selo **Unavailable** (indisponível).

**ChubAI** vem selecionada na primeira vez que você abre o **Card Browser**. Ao trocar de fonte, o texto de busca, as tags e os filtros são limpos. Cada fonte guarda separadamente a própria configuração de conteúdo adulto e o próprio login, então mudar uma coisa em uma fonte não afeta as outras.

Uma observação sobre nomes: o menu lista **ChubAI**, mas na página de detalhes de um personagem o link externo diz **View on Chub**. É assim que o site chama a si mesmo. As outras fontes usam o mesmo nome nos dois lugares.

## CharacterTavern

CharacterTavern reformulou o site e não oferece mais a conexão que Marinara usava para buscar e baixar cards. Quando você escolhe **CharacterTavern**, o **Card Browser** mostra um aviso curto no lugar dos resultados de busca. A navegação pode voltar se CharacterTavern passar a oferecer acesso à API.

Até lá, você ainda pode trazer personagens do CharacterTavern para Marinara à mão:

1. Clique em **Open CharacterTavern** (abrir CharacterTavern) no aviso. O site abre em uma nova aba.
2. Baixe o arquivo do card de personagem em character-tavern.com.
3. Clique em **Import Character** (importar personagem) no aviso e escolha o arquivo baixado. Veja [Importar e exportar cards de personagem](import-export.md).

Os personagens que você já importou do CharacterTavern continuam na sua biblioteca.

## Busca, ordenação e páginas

Digite na caixa **Search characters...** para buscar. Não precisa apertar Enter. Marinara espera um instante (cerca de meio segundo) depois que você para de digitar e busca sozinho. Limpar a caixa ou mudar um filtro também refaz a busca.

Ao lado da caixa de busca fica um menu suspenso de ordenação. As opções mudam conforme a fonte, e cada fonte começa com a própria ordenação padrão:

| Fonte     | Ordenação padrão |
| --------- | --------------- |
| ChubAI    | Most Downloaded |
| JannyAI   | Newest          |
| Pygmalion | Downloads       |
| Wyvern    | Popular         |
| DataCat   | Relevance       |

Clique no botão **Refresh** (atualizar), com o ícone de seta circular, para rodar a busca atual de novo.

Abaixo dos resultados ficam os botões **Previous** (anterior) e **Next** (próxima), com uma etiqueta de página como **Page 2**. Quando a fonte não consegue informar o total exato, aparece só o número da página atual.

Uma observação sobre **DataCat**: a ordenação **Fresh** só mostra resultados recentes quando não há filtro de tag nem texto de busca. Assim que você digita uma busca ou escolhe uma tag, **DataCat** volta aos resultados normais por relevância.

## Filtrar por tags

Clique no botão **Tags** na barra de ferramentas para abrir o painel de tags.

- Digite na caixa **Search tags...** para reduzir a lista de tags.
- Clique no visto verde ao lado de uma tag para incluí-la. Clique no menos vermelho para excluí-la dos resultados. Uma tag pode ser incluída ou excluída, nunca as duas coisas.
- As tags incluídas viram uma etiqueta verde. As excluídas viram uma etiqueta vermelha. Clique em qualquer etiqueta para removê-la.
- O botão **Clear** (limpar) remove todas as tags ativas.

Na maioria das fontes, a lista de tags é montada a partir dos personagens das suas buscas recentes. Antes da primeira busca, o painel diz **Tags will appear after searching**. Se a tag que você quer não estiver na lista, digite o nome dela. Aparecem dois botões: um para usá-la como filtro e outro para bloqueá-la nos resultados.

**DataCat** funciona de outro jeito. Ele carrega as tags mais populares logo de cara, porque a lista de tags é enorme. Mesmo assim, você pode digitar qualquer outra tag à mão.

## Mais filtros

Algumas fontes acrescentam um botão **Filters** (filtros) na barra de ferramentas. Ele só aparece quando a fonte tem filtros a oferecer, então não aparece em **DataCat**. Um selo pequeno mostra quantos filtros estão ativos.

O painel de filtros pode ter:

- Caixas de seleção de conteúdo, como **Lorebook** ou **Alt Greetings**, que mantêm só os personagens com esse recurso. O lorebook é um conjunto de informações de fundo que o personagem pode carregar consigo.
- **Sort Direction** (direção da ordenação), com as opções **Descending** ou **Ascending**, em **ChubAI** e **Pygmalion**.
- As caixas numéricas **Min Tokens** e **Max Output Tokens**, que limitam os resultados por tamanho. Se você deixar em branco, a fonte usa o próprio padrão.
- **JannyAI** tem o botão liga/desliga **Show Low Quality**. Ele vem desativado, o que esconde os personagens que **JannyAI** marcou como de baixa qualidade. Ative para incluí-los.

Observação sobre **Wyvern**: as caixas de seleção **Lorebook** e **Alt Greetings** aparecem, assim como as caixas **Min Tokens** e **Max Output Tokens**. Nenhuma delas muda os resultados de **Wyvern**. Para refinar os resultados de **Wyvern**, use o menu suspenso de ordenação e as tags.

## Conteúdo adulto (NSFW) em cada fonte

O conteúdo adulto aparece com a etiqueta **NSFW** no aplicativo. Existe uma única caixa de seleção **NSFW** na barra de ferramentas, mas cada fonte trata isso de um jeito. Essa é a dúvida mais comum, então leia com atenção.

- **ChubAI** e **JannyAI**: a caixa **NSFW** funciona na hora. Não precisa de login. Ela vem desmarcada.
- **Pygmalion**: a caixa **NSFW** fica esmaecida até você entrar na conta. A dica manda fazer login primeiro. Depois do login, o aplicativo segue as configurações da sua conta no Pygmalion. A caixa passa a dizer **NSFW depends on your account settings**. Não existe um liga/desliga separado depois do login.
- **Wyvern**: a caixa **NSFW** fica sempre esmaecida. Um aviso diz **Use "🔞 Popular NSFW" sort for NSFW content**. Para ver conteúdo adulto em **Wyvern**, escolha a opção **🔞 Popular NSFW** no menu suspenso de ordenação.
- **DataCat**: todo personagem tem marcação adulta, então a caixa fica travada como ativa. Na primeira vez que você escolhe **DataCat**, aparece uma janela chamada **DataCat is NSFW only**. Clique em **Continue to DataCat** para navegar por lá, ou em **Don't continue to DataCat** para voltar.

Os personagens adultos exibem um pequeno selo vermelho **NSFW** no canto da miniatura.

## Login em Pygmalion

**Pygmalion** esconde o conteúdo adulto atrás de um login. Para os personagens públicos comuns, não é preciso fazer login. O login só libera o conteúdo adulto.

Para entrar, clique no botão **Log In** (entrar) na barra de ferramentas. Abre uma janela de login. Você cola nela um valor copiado da sua própria conta do Pygmalion. Marinara não pede a sua senha.

Em **Pygmalion**, a janela se chama **Pygmalion Authentication** e pede um **Auth Token**:

1. Acesse pygmalion.chat e entre na sua conta.
2. Abra as ferramentas de desenvolvedor do navegador. Na maioria dos navegadores, basta apertar a tecla F12. As ferramentas de desenvolvedor são um painel do próprio navegador, voltado para usuários avançados.
3. Abra a aba **Application** e depois **Local Storage**.
4. Encontre a entrada chamada `authn` e copie o valor dela.
5. Cole o valor na caixa **Auth Token** no Marinara. A caixa esconde o que você colar.
6. Clique em **Save & Connect**. Aparece uma mensagem avisando que o conteúdo NSFW foi ativado.

A janela tem uma seção de ajuda que repete esses passos e um link **Website** que abre pygmalion.chat.

Esse é o login da sua conta do Pygmalion. Marinara o mantém na memória até reiniciar ou até você clicar em **Log Out**. Para sair da conta, abra a janela de login de novo e clique em **Log Out**. Para sair por completo, saia também da conta em pygmalion.chat.

Marinara verifica o token com Pygmalion antes de mantê-lo. Se Pygmalion não aceitar o token, nada é salvo e uma mensagem explica o motivo. Se Pygmalion deixar de aceitá-lo mais tarde, Marinara tira você da conta e pede um novo login.

Importante: esse login fica guardado apenas na memória do servidor. Marinara nunca o salva em arquivo. Se você reiniciar o servidor do Marinara, sai da conta e precisa colar o token outra vez. Quando isso acontece, Marinara mostra uma mensagem pedindo um novo login.

## Conferir um personagem antes de importar

Clique em qualquer card de resultado para abrir a tela de detalhes. Use **Back to results** (voltar aos resultados) para retornar.

A tela de detalhes mostra o avatar, o nome, o criador, uma frase curta de apresentação e até vinte etiquetas de tag do personagem. Ela também tem um link **View on**, que abre a página original do personagem em uma nova aba.

Logo abaixo vêm os detalhes completos do personagem, exibidos apenas quando a fonte os fornece. Essas seções usam títulos como **Creator's Notes**, **Personality**, **Scenario**, **First Message** e **Alternate Greetings**. Um selo âmbar **Has embedded lorebook** aparece quando o personagem carrega um lorebook.

Algumas fontes nem sempre devolvem os detalhes completos. Se nada carregar, a tela avisa que você ainda pode importar o personagem com as informações básicas.

## Importar ou baixar um personagem

A tela de detalhes traz dois botões. **Import** (importar) adiciona o personagem à sua biblioteca do Marinara. **Download as PNG** (baixar como PNG) salva o personagem como arquivo no seu dispositivo, sem adicioná-lo à biblioteca.

Para importar cards de personagem para a biblioteca:

1. Abra a tela de detalhes de um personagem.
2. Escolha uma opção em **Imported tags** (tags importadas), conforme a tabela abaixo.
3. Clique em **Import**. Durante o processo, o botão mostra **Importing...**.
4. Espere a mensagem de sucesso. Aparece um aviso confirmando que o personagem foi importado.
5. Abra o painel **Characters** para encontrar o personagem importado antes de começar um chat.

O personagem importado se comporta como qualquer outro. Para conversar com ele de verdade, ainda é preciso ter uma conexão de provedor funcionando. Veja [Conectando a um provedor de IA](../connections/connecting-to-a-provider.md).

### Imported tags

O painel **Imported tags**, ao lado do avatar, controla quais tags vêm junto com o personagem. O padrão é **All tags**.

| Opção         | O que faz                                    |
| ------------- | -------------------------------------------- |
| All tags      | Mantém as tags da fonte.                     |
| No tags       | Ignora as tags da fonte.                     |
| Existing only | Mantém só as tags que você já usa no Marinara. |

### Aviso de lorebook embutido

Se o personagem carrega um lorebook embutido, a importação abre uma pequena caixa de confirmação do navegador. Ela pergunta se você também quer salvar esse lorebook como um lorebook independente do Marinara. Clique em **OK** para criar o lorebook separado, além da cópia anexada ao personagem. Clique em **Cancel** para manter o lorebook só anexado ao personagem.

### Download as PNG

Clique em **Download as PNG** para salvar o personagem como um arquivo PNG de card de personagem no formato comum. Durante o processo, o botão mostra **Building PNG...**. Isso funciona em todas as fontes. O arquivo salvo leva o nome do personagem, por exemplo `Some_Character.png`. Você pode compartilhar esse arquivo ou importá-lo em outro aplicativo depois.

JSON e PNG são dois formatos comuns para os mesmos dados de personagem. JSON é um formato de texto simples. O card PNG é um arquivo de imagem com os dados do personagem guardados dentro dele. Os dois carregam o personagem completo.

## Os personagens que você importou

O painel **Card Browser** na barra lateral direita mantém uma lista separada dos personagens que você importou pelo **Card Browser**. Os personagens que você criou à mão ou importou de outro jeito não aparecem aqui. Todos eles continuam aparecendo na biblioteca principal, em **Characters**.

- O botão **Download Cards** abre a tela completa do **Card Browser**.
- A caixa **Search imported...** filtra essa lista.
- O menu suspenso de ordenação oferece **A-Z**, **Z-A**, **Newest** e **Oldest**.
- Clique com o botão direito em uma linha, ou use os botões dela, para chegar a **Quick Start Roleplay** e **Quick Start Conversation**. Esses comandos abrem um novo chat com aquele personagem. Aqui também é possível excluir o personagem da lista.

## Solução de problemas

**A busca ou os detalhes de JannyAI falham com um erro da Cloudflare.** Alguns sites bloqueiam requisições automatizadas. Visite jannyai.com uma vez no mesmo navegador, passe pela verificação que aparecer e volte a Marinara para buscar de novo.

**Meu login de Pygmalion parou de funcionar.** Reiniciar o servidor do Marinara limpa esse login. Abra a janela **Log In** de novo e cole o token mais uma vez.

**CharacterTavern só mostra um aviso.** Isso é esperado. Veja [CharacterTavern](#charactertavern) para saber como importar os cards de lá como arquivos.

**Uma busca falha ou uma fonte para de funcionar.** Os sites públicos podem mudar as páginas ou bloquear o acesso a qualquer momento. Tente mais tarde. Se uma fonte continuar falhando, abra o personagem direto no site e baixe o card você mesmo. Depois, traga o arquivo pelo fluxo normal de importação. Veja [Importar e exportar cards de personagem](import-export.md).

## Guias relacionados

- [Importar e exportar cards de personagem](import-export.md)
- [Conectando a um provedor de IA](../connections/connecting-to-a-provider.md)
- [Solução de problemas do Marinara Engine](../TROUBLESHOOTING.md)
