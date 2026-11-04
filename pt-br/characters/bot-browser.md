# Card Browser: encontrar e importar personagens

O **Card Browser** (navegador de cards) encontra cards de personagem em sites públicos e os importa para a sua biblioteca de dentro do Marinara, então você não precisa baixar e fazer upload de arquivos à mão. Versões antigas o chamavam de **Bot Browser** ou **Browser**.

O card de personagem é um arquivo que guarda o nome, a personalidade, a saudação e outros detalhes de um personagem. Nas configurações padrão, você não precisa de conta nem de chave de API para navegar e importar.

## Abra o Card Browser

1. Clique em **Characters** (personagens) ou **Personas** na barra de navegação superior. Se não os encontrar, abra **More** (mais) primeiro.
2. Clique no botão **Download** (baixar), no topo. A dica dele diz **Download character cards** (baixar cards de personagem).

O Card Browser ocupa toda a área de conteúdo, com o título **Browse character cards online**. Para sair, clique na seta para trás, no canto superior esquerdo.

Se você fechar e abrir de novo, a última busca, os filtros e o personagem selecionado continuam lá. Recarregar o aplicativo zera tudo isso.

## Escolha uma fonte

Clique no botão de fonte no cabeçalho. O menu lista, nesta ordem: **ChubAI**, **JannyAI**, **CharacterTavern**, **Pygmalion**, **Wyvern**, **DataCat**, **PlotLight** e **PlotLight Personas**. **ChubAI** vem selecionada na primeira vez. Trocar de fonte limpa o texto de busca, as tags e os filtros. Cada fonte guarda a própria configuração de conteúdo adulto e o próprio login.

| Fonte | Conteúdo adulto (NSFW) |
| --- | --- |
| **ChubAI** | A caixa de seleção **NSFW** funciona. Vem desmarcada por padrão. |
| **JannyAI** | A caixa de seleção **NSFW** funciona. Vem desmarcada por padrão. |
| **Pygmalion** | Fica esmaecida até você [fazer login](#log-in-to-pygmalion). Depois, segue as configurações da sua conta no Pygmalion. |
| **Wyvern** | Sempre esmaecida. Em vez disso, escolha a ordenação **🔞 Popular NSFW**. |
| **DataCat** | Todo card tem marcação adulta, então a caixa fica travada como marcada. |
| **PlotLight** e **PlotLight Personas** | Sempre esmaecida. PlotLight aplica as próprias regras. Os resultados com marcação adulta recebem o selo **NSFW**. |

Não sabe por onde começar? Use **ChubAI**, a primeira fonte. Cada fonte começa com a própria ordenação, e você pode mudá-la no menu suspenso de ordenação.

Os cards adultos exibem um pequeno selo vermelho **NSFW** na miniatura. O menu diz **ChubAI**, mas o link externo de um card diz **View on Chub**, que é o nome que o próprio site usa.

### DataCat

Na primeira vez que você escolhe **DataCat**, aparece uma janela chamada **DataCat is NSFW only**. Clique em **Continue to DataCat** para navegar, ou em **Don't continue to DataCat** para voltar. A ordenação **Fresh** dessa fonte só mostra resultados recentes quando não há filtro de tag nem texto de busca.

### CharacterTavern

CharacterTavern reformulou o site e não oferece mais a conexão que Marinara usava. Quando você escolhe essa fonte, um aviso aparece no lugar dos resultados. A navegação pode voltar se CharacterTavern passar a oferecer acesso à API. Até lá, importe os cards de lá à mão:

1. Clique em **Open CharacterTavern** (abrir CharacterTavern) no aviso. O site abre em uma nova aba.
2. Baixe o arquivo do card em character-tavern.com.
3. Clique em **Import Character** (importar personagem) no aviso e escolha o arquivo. Veja [Importar e exportar cards de personagem](import-export.md).

Os personagens que você já importou de lá continuam na sua biblioteca.

### PlotLight

PlotLight compartilha personagens e personas públicos. **PlotLight** lista cards de personagem. **PlotLight Personas** lista personas, os personagens que representam você nos chats. Você não precisa de uma conta no PlotLight. A tela de detalhes tem um link **View on PlotLight** para a página original.

Marinara baixa o arquivo que PlotLight oferece. Um card de personagem normalmente vem como PNG, com o retrato e qualquer lorebook que o criador permita. Uma persona vem como arquivo de texto, e Marinara copia a imagem dela separadamente. Você pode importar qualquer um dos dois como personagem ou como persona.

PlotLight limita a frequência com que os aplicativos podem fazer pedidos a ele. Se você for rápido demais, Marinara mostra **PlotLight is busy** com um número de segundos e espera esse tempo. Busca e importação têm limites separados.

Alguns cards não podem ser baixados, por exemplo quando o criador não permite. Marinara então mostra **PlotLight doesn't offer this for download.** Você não consegue importar esse card nem ver os detalhes dele, mas a imagem, o criador e o link **View on PlotLight** continuam lá.

## Busca, ordenação e páginas

Digite em **Search characters**. Não precisa apertar <kbd>Enter</kbd>. Marinara busca um instante depois que você para de digitar, e de novo quando você limpa a caixa ou muda um filtro. Cada fonte tem o próprio menu suspenso de ordenação. Clique no botão **Refresh** (atualizar), com a seta circular, para rodar a busca de novo.

Abaixo dos resultados ficam **Previous** (anterior) e **Next** (próxima), com uma etiqueta como **Page 2**. Quando a fonte não consegue informar um total, aparece só a página atual. **PlotLight** nunca informa um total, então o cabeçalho mostra **Browsing PlotLight**. Uma página do PlotLight pode ter poucos cards, ou nenhum, e ainda ter mais páginas. **Next** continua ativado, para você poder seguir em frente.

## Filtre por tags

1. Clique em **Tags** na barra de ferramentas.
2. Digite em **Search tags** para reduzir a lista.
3. Clique no visto verde ao lado de uma tag para incluí-la, ou no menos vermelho para excluí-la. Uma tag não pode ser as duas coisas.
4. Clique em uma etiqueta para remover aquela tag, ou em **Clear** (limpar) para remover todas.

Na maioria das fontes, a lista é montada a partir dos personagens das suas buscas recentes. Antes da primeira busca, o painel diz **Tags will appear after searching**. Se a tag que você quer não estiver na lista, digite o nome dela. Aparecem dois botões: um a adiciona como filtro, o outro a bloqueia. **DataCat** carrega as tags mais populares logo de cara, e você ainda pode digitar outras. Em **PlotLight**, Marinara procura uma tag digitada na própria lista de tags do PlotLight, e uma tag que PlotLight não tem não corresponde a nada.

## Mais filtros

A maioria das fontes acrescenta um botão **Filters** (filtros), com um selo que conta os filtros ativos. Ele não aparece em **DataCat** nem em **PlotLight**. O painel pode ter:

- Caixas de seleção de conteúdo, como **Lorebook** ou **Alt Greetings**, que mantêm só os personagens com esse recurso. O lorebook é um conjunto de informações de fundo que o personagem carrega.
- **Sort Direction** (direção da ordenação), **Descending** ou **Ascending**, em **ChubAI** e **Pygmalion**.
- As caixas **Min Tokens** e **Max Output Tokens**, que limitam os resultados por tamanho. Deixe-as em branco para usar o padrão da fonte.
- Um botão liga/desliga **Show Low Quality** em **JannyAI**. Ele vem desativado, o que esconde os cards que JannyAI marcou como de baixa qualidade.

Em **Wyvern**, as caixas de seleção **Lorebook** e **Alt Greetings** e as caixas de tokens aparecem, mas não mudam os resultados. Use o menu suspenso de ordenação e as tags.

## Confira um personagem

Clique em um resultado para abrir a tela de detalhes dele. **Back to results** (voltar aos resultados) retorna à lista.

A tela de detalhes mostra o avatar, o nome, o criador, uma frase curta de apresentação, até vinte etiquetas de tag e um link **View on** para a página original. Abaixo disso vêm os detalhes completos, quando a fonte os fornece, sob títulos como **Creator's Notes**, **Personality**, **Scenario**, **First Message** e **Alternate Greetings**. Um selo âmbar **Has embedded lorebook** aparece quando o card carrega um lorebook. Se uma fonte não devolver detalhes, a tela avisa que você ainda pode importar com as informações básicas.

## Importe um personagem

Antes de começar: para conversar com o personagem, você vai precisar de uma conexão de texto que funcione. Veja [Conectando a um provedor de IA](../connections/connecting-to-a-provider.md).

1. Abra a tela de detalhes de um personagem.
2. Escolha uma opção em **Imported tags** (tags importadas), ao lado do avatar. O padrão é **All tags**. Veja [Opções de importação](import-export.md#import-options).
3. Clique em **Import** (importar). A janela **Import Card** abre e pergunta **Where should this card live?**
4. Se quiser, marque **Split description into fields** (dividir a descrição em campos). Veja [Opções de importação](import-export.md#import-options).
5. Clique em **Import as Character** para adicioná-lo a **Characters**, ou em **Import as Persona** para adicioná-lo a **Personas**.
6. Se o card tiver um lorebook embutido, um painel **Embedded lorebook found** mostra quantas entradas ele tem. Clique em **Import Lorebook** para criar também um lorebook independente, ou em **No Import** para mantê-lo só dentro do card. **Back** volta para o passo 5.
7. Espere enquanto o botão mostra **Importing...**. Uma mensagem diz `Imported "Name" successfully!`
8. Abra **Characters** (ou **Personas**) para encontrá-lo.

Se não funcionou: leia a mensagem de erro no aviso que aparece na tela. Em **JannyAI**, um bloqueio da Cloudflare é a causa mais comum (veja Solução de problemas, abaixo).

### Download as PNG

Clique em **Download as PNG** (baixar como PNG) na tela de detalhes para salvar o card como um card de personagem PNG comum no seu dispositivo, sem adicioná-lo à sua biblioteca. O botão mostra **Building PNG...** enquanto trabalha. Isso funciona em todas as fontes, e o arquivo leva o nome do personagem, como `Some_Character.png`. O card PNG é uma imagem com os dados do personagem guardados dentro dela. Você pode compartilhá-lo ou importá-lo em outro aplicativo.

## Solução de problemas

| Problema | Solução |
| --- | --- |
| A busca ou os detalhes de **JannyAI** falham com um erro que menciona a Cloudflare (uma verificação de segurança que bloqueia requisições automáticas), ou a definição completa do card é bloqueada. | Visite jannyai.com uma vez no mesmo navegador e passe pela verificação que aparecer. Depois, busque de novo. Se o card continuar bloqueado, abra-o no JannyAI, baixe o PNG dele e importe esse arquivo. |
| O meu login do Pygmalion parou de funcionar. | Reiniciar o servidor limpa o login. Faça login de novo com um token novo. |
| **CharacterTavern** só mostra um aviso. | Isso é esperado. Veja [CharacterTavern](#charactertavern). |
| **PlotLight is busy.** | Espere o número de segundos indicado na mensagem e tente de novo. |
| **PlotLight doesn't offer this for download.** | O criador pode não permitir downloads, ou o card não é mais público. Use **View on PlotLight** para conferir. |
| Uma busca falha ou uma fonte para de funcionar. | Os sites públicos podem mudar ou bloquear o acesso a qualquer momento. Tente mais tarde, ou baixe o card do site e use a importação normal. Veja [Importar e exportar cards de personagem](import-export.md). |

<a id="log-in-to-pygmalion"></a>

## Faça login no Pygmalion

Pygmalion esconde o conteúdo adulto atrás de um login. Os personagens públicos não precisam de login. Marinara nunca pede a sua senha. Você cola um valor copiado da sua própria conta.

1. Clique em **Log In** (entrar) na barra de ferramentas. A janela **Pygmalion Authentication** abre.
2. Acesse pygmalion.chat no navegador e entre na sua conta.
3. Abra as ferramentas de desenvolvedor do navegador, um painel embutido para usuários avançados. Na maioria dos navegadores de computador, pressione <kbd>F12</kbd>. Os navegadores de celular normalmente não têm essas ferramentas, então use um computador nesta etapa.
4. Abra a aba **Application** e depois **Local Storage**.
5. Encontre a entrada chamada `authn` e copie o valor dela.
6. Cole o valor em **Auth Token** no Marinara. A caixa esconde o que você colar.
7. Clique em **Save & Connect**. Uma mensagem avisa que o conteúdo NSFW foi ativado.

A janela tem uma seção de ajuda que repete esses passos e um link **Website** para pygmalion.chat.

Marinara verifica o token com Pygmalion primeiro. Se Pygmalion recusar o token, nada é salvo e uma mensagem explica o motivo. Se Pygmalion deixar de aceitá-lo mais tarde, Marinara tira você da conta e pede um novo login.

O login fica guardado apenas na memória do servidor. Ele nunca é salvo em arquivo, então reiniciar o servidor do Marinara tira você da conta. Para sair por conta própria, abra a janela de novo e clique em **Log Out**. Para sair por completo, saia também da conta em pygmalion.chat.

## Guias relacionados

- [Importar e exportar cards de personagem](import-export.md)
- [Conectando a um provedor de IA](../connections/connecting-to-a-provider.md)
- [Solução de problemas](../TROUBLESHOOTING.md)
