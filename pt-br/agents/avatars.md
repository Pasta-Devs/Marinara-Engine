# Avatares 2D e 3D

Dois agentes para download dão aos seus personagens e às suas personas um avatar animado que reage enquanto a resposta chega em streaming. **2D Avatars** (avatares 2D) mostra sprites no estilo PNGTuber ou avatares de malha, e **3D Avatars** (avatares 3D) mostra modelos VRM. Os rostos acompanham a resposta, e as bocas se mexem com o texto ou com a conversão de texto em voz.

Marinara Engine não tem suporte a modelos Live2D. A licença do Live2D exige um acordo separado com a Live2D mesmo para aplicativos gratuitos de código aberto, e o runtime do Live2D não pode ser distribuído com Marinara Engine.

## Baixar os agentes

Os dois agentes estão em **Download Agents** (baixar agentes) para todas as instalações, nos filtros **Roleplay** e **Game**. Exigem Marinara Engine 2.5.1 ou mais recente.

**2D Avatars** e **3D Avatars** são downloads separados, então você pode instalar só o que quiser. Os dois funcionam para personagens e personas em chats de Roleplay e de Game.

1. Abra **Agents → Download Agents** e instale **2D Avatars**, **3D Avatars** ou os dois. Nenhum deles exige reiniciar.
2. Configure cada avatar na página do agente em **Agents**. Veja [Configurar um avatar](#setting-up-an-avatar).
3. Em um chat de Roleplay ou de Game, abra **Chat Settings → Agents → Misc Agents** (configurações do chat → agentes → agentes diversos) e adicione o agente.

Os agentes não enviam nenhuma solicitação extra às suas conexões de IA durante o chat. Eles precisam de um Engine com Capability API 1.73, e um Engine mais antigo recusa a instalação.

<a id="setting-up-an-avatar"></a>

## Configurar um avatar

Os avatares são configurados na página de cada agente. Abra **Agents**, abra **2D Avatars** ou **3D Avatars** e use a seção **Avatars** perto do topo.

1. Em **Character or persona** (personagem ou persona), escolha quem recebe o avatar. Os nomes marcados com "(has an avatar)" já têm um avatar salvo.
2. Em **Avatar type** (tipo de avatar), escolha o tipo que vai configurar. 2D Avatars oferece **PNGTuber sprites** (sprites PNGTuber) e **Mesh avatar** (avatar de malha). 3D Avatars oferece **VRM model** (modelo VRM).
3. Configure o avatar na seção própria desse tipo, abaixo dos seletores: use os seus sprites ou importe um arquivo, escolha o rosto de cada sentimento ou remova o avatar. Veja [Avatares 2D](#2d-avatars-pngtuber-sprites-and-mesh-avatars) e [Avatares 3D](#3d-avatars-vrm-models).
4. Use **Preview** (pré-visualização) para ver o avatar. **Try a face** (testar um rosto) troca o sentimento, e **Talk** (falar) mexe a boca. Quando ainda não há nada para mostrar, a pré-visualização mostra um avatar de exemplo.

Um personagem ou uma persona com sprites de expressão pode vê-los na prévia como um avatar PNGTuber na página de 2D Avatars. **Show this avatar in chats** (mostrar este avatar nos chats) começa desligado quando a configuração ainda não foi salva. Ligue para salvar os sprites como uma configuração PNGTuber e exibi-la nos chats. Uma foto de perfil sozinha não cria um avatar 2D.

**Show this avatar in chats** liga ou desliga um avatar configurado sem apagá-lo. Sem um avatar ou sprites utilizáveis, a opção continua desligada até você configurar um. **Movement** (movimento) tem três botões liga/desliga que valem para todos os tipos. **Lip sync** (sincronia labial) mexe a boca. **Blinking** (piscar) faz o avatar piscar a cada poucos segundos. **Idle motion** (movimento de espera) faz o avatar respirar e balançar enquanto espera. Se um personagem tem mais de um tipo de avatar, **Show this one** (mostrar este) escolhe o tipo que os chats usam. Quando o agente desse tipo está desligado em um chat, o chat mostra outro tipo cujo agente está ligado. Remover um tipo exclui os arquivos dele; os seus sprites ficam, e um avatar que você desligou continua desligado.

Um avatar aparece em um chat de Roleplay, Visual Novel ou Game quando o chat tem os agentes ativados e o agente correspondente adicionado. Ele funciona com ou sem o Expression Engine. O avatar não esconde o sprite de corpo inteiro, então desligue esse sprite você mesmo se o avatar for substituí-lo. Os avatares ficam onde o sprite de corpo inteiro ficaria e têm o mesmo tamanho dele.

Para mover ou redimensionar os avatares, abra **Chat Settings** (configurações do chat), vá até **Agents** e abra **Avatars**. Escolha um avatar na lista e use o controle deslizante de tamanho dele para deixá-lo maior ou menor. Selecione **Arrange** (organizar) para mover os avatares: enquanto essa opção está ligada, arraste-os para qualquer lugar do chat com o mouse ou com o dedo, ou foque um deles e use as setas do teclado (segure Shift para mover mais longe). Selecione **Done** (concluído) quando terminar; os avatares ficam onde você os colocou, e os cliques voltam a ir para o chat. **Reset** (redefinir) devolve todos os avatares ao lugar de sempre.

Um avatar 3D também tem a opção **Framing** (enquadramento): **Portrait** (retrato) mostra a cabeça e os ombros (o padrão), **Half body** (meio corpo) mostra até os quadris, e **Full body** (corpo inteiro) mostra o modelo inteiro, da cabeça aos pés. O avatar mantém o tamanho; um enquadramento mais alto mostra mais do modelo no mesmo espaço. Os avatares 2D não têm enquadramento.

Isso funciona sem o Expression Engine em Roleplay, Visual Novel e Game. O layout é salvo para aquele chat neste dispositivo e continua depois de recarregar a página; ele não sincroniza com outros dispositivos. O botão **Arrange** do próprio Expression Engine também move os avatares.

Os arquivos importados são verificados antes de serem armazenados, e não há um limite de tamanho específico para avatares abaixo do limite normal de upload do servidor. Os arquivos de avatar ficam na pasta de dados, em `avatar-models/<character or persona>/<id>/`, ao lado de um `avatar.json` com as configurações. Os backups e as exportações de perfil incluem essa pasta. Excluir um personagem ou uma persona exclui o avatar correspondente, inclusive quando a Danger Zone (zona de perigo) das configurações limpa a categoria **Characters** ou **Personas** inteira, e limpar a categoria **Media & Assets** ali esvazia a pasta. As exportações de card de personagem nunca incluem avatares.

Os chats em grupo mostram todos os participantes com um avatar salvo e ligado cujo agente esteja ligado, sem limite fixo de integrantes. Use **Chat Settings → Agents → Avatars** para ajustar o tamanho e a posição. No modo **Individual**, o personagem que responde fala e expressa emoções. No modo **Merged (Narrator)**, as marcações de quem fala e os diálogos atribuídos pelo nome dirigem o personagem correspondente; com as vozes ligadas, a sincronização labial segue o personagem cuja voz está tocando.

<a id="2d-avatars-pngtuber-sprites-and-mesh-avatars"></a>

## Avatares 2D: sprites PNGTuber e avatares de malha

**2D Avatars** mostra um de dois tipos de avatar: **sprites PNGTuber**, imagens planas que trocam de rosto, abrem a boca e piscam, e **avatares de malha**, desenhos que mexem a cabeça, os olhos e a boca de forma suave. Configure os dois na página do agente, no editor de agentes, depois de escolher um personagem ou uma persona.

<a id="pngtuber-sprites"></a>

### Sprites PNGTuber

Um personagem ou uma persona com sprites de expressão pode usá-los como avatar PNGTuber: os sprites são os rostos. Confira a prévia e depois ligue **Show this avatar in chats** ou salve com **Use my sprites** (usar os meus sprites). Os sprites de retrato são usados quando existem e, caso contrário, os de corpo inteiro; um avatar nunca mistura os dois.

- **Imagens de fala e de piscada.** Adicione sprites com o nome de um rosto mais `_talk` para a boca aberta e `_blink` para os olhos fechados, por exemplo `happy_talk` e `happy_blink`, e `happy_blink_talk` para os dois. `_talking`, `_speak`, `_mouth_open`, `_blinking` e `_eyes_closed` também funcionam. Um rosto sem essas imagens ainda dá pulinhos enquanto fala.
- **Rosto de cada sentimento.** Escolha qual rosto aparece para Neutral, Happy, Angry, Sad, Relaxed e Surprised (neutro, feliz, bravo, triste, relaxado e surpreso). **Resting face** (rosto em repouso) usa o rosto Neutral. Todo sprite é oferecido, inclusive os adicionados depois que você salvou o avatar, até 64 rostos. Uma importação do PNGTuber Plus oferece só os próprios rostos. Quando o Expression Engine ou o Game Master escolhe um sprite que você tem, esse rosto exato aparece.
- **Mais sentimentos.** Em **Face for each feeling** (rosto de cada sentimento), abra **More feelings** (mais sentimentos) para escolher um rosto para 23 sentimentos mais específicos, agrupados nos seis: Curiosity (curiosidade) em Neutral; Admiration (admiração), Amusement (diversão), Desire (desejo), Embarrassment (constrangimento), Excitement (empolgação), Gratitude (gratidão), Optimism (otimismo) e Pride (orgulho) em Happy; Annoyance (irritação), Disapproval (desaprovação) e Disgust (nojo) em Angry; Disappointment (decepção), Grief (luto), Nervousness (nervosismo) e Remorse (remorso) em Sad; Approval (aprovação), Caring (carinho), Love (amor) e Relief (alívio) em Relaxed; e Confusion (confusão), Fear (medo) e Realization (percepção súbita) em Surprised. Eles são opcionais. Cada um usa o rosto do seu sentimento principal até você escolher outro. Um sprite com o nome de um deles, como `fear`, `amusement` ou uma palavra como `scared` ou `laughing`, é usado para esse sentimento sem nenhuma configuração.
- **Movimento.** **Hop while talking** (pular enquanto fala) e **Hop height** (altura do pulo) definem o pulinho no estilo PNGTuber. **Time between blinks** (tempo entre piscadas) é a média; cada piscada vem um pouco antes ou um pouco depois, para nunca parecer mecânica. Com a redução de movimento ativada no seu dispositivo, o avatar não pula nem respira, mas o rosto e a boca continuam mudando.
- **Os sprites aparecem como são.** Um sprite desenhado sobre um fundo aparece com ele, e os seus arquivos de sprite nunca são alterados. Para rostos sem fundo, use [Rostos a partir do avatar](#faces-from-the-avatar).
- **Use my sprites** salva os sprites como os rostos do avatar. Escolher um rosto ou mudar o movimento também salva. **Update from sprites** (atualizar a partir dos sprites) pega os sprites que você adicionou depois e mantém os rostos que você escolheu para cada sentimento. Depois de uma importação, escolha **Remove** (remover) para voltar aos seus sprites.

**Import PNGTuber Plus save** (importar save do PNGTuber Plus) lê um avatar salvo pelo [PNGTuber Plus](https://github.com/kaiakairos/PNGTuber-Plus) (um arquivo `.save`). Cada figurino vira um rosto, e as camadas de fala e de piscada dele viram as imagens de fala e de piscada. As imagens chegam como são, com o fundo que tiverem. Os figurinos são associados aos sentimentos pelos nomes das imagens que mostram, como `angry eyes.png`. Escolha um rosto para qualquer sentimento que os nomes não cobriram. Algumas coisas não são trazidas:

- O balanço, o arrasto, a rotação e o esticamento não são importados; o avatar mostra cada camada em repouso.
- As camadas animadas mostram só o primeiro quadro.
- Saves muito antigos guardam só os caminhos das imagens no computador do autor. Antes, salve esses arquivos de novo em uma versão mais nova do PNGTuber Plus.
- Um avatar muito grande é reduzido para 2048 pixels, para que os celulares consigam guardar todas as imagens.

Importar um save precisa de processamento de imagem no servidor. Algumas instalações Android (Termux) não têm esse recurso, então a importação é recusada nelas com uma mensagem que explica isso.

### Avatares de malha

Um avatar de malha é um arquivo `.mavatar`. Marinara Engine pode criar um a partir de um dos seus sprites (veja [Criar um avatar a partir de um sprite](#mesh-avatar)), ou você pode criar um com o [Mesh Avatar Studio](https://github.com/shinshin86/mesh-avatar-studio) (veja [Faça o seu próprio modelo](#mesh-avatar-studio)). Escolha **Import .mavatar file** (importar arquivo .mavatar) para adicionar um, ou **Replace file** (substituir arquivo) para trocá-lo. Com o movimento de espera ligado, o avatar respira e olha em volta sozinho. Ele pisca, e a boca dele acompanha a resposta. Se o arquivo tiver formatos de boca desenhados, eles são usados; caso contrário, formatos simples são desenhados para ele.

Em **Look for each feeling** (aparência de cada sentimento), escolha o que cada sentimento mostra. Pode ser um dos seis sentimentos ou **Smile**, **Shy**, **Half-closed eyes** ou **Wink** (sorriso, tímido, olhos semicerrados ou piscadela).

Todo arquivo é verificado quando você o importa, e um arquivo danificado é recusado com um motivo curto. O mesmo vale para um arquivo detalhado demais para rodar com fluidez, ou para um que, ao ser descompactado, passa do limite de upload. Só as partes de que o avatar precisa são guardadas, então a ilustração original dentro do arquivo não é armazenada. A arte pertence a quem a criou; confira a licença dela antes de compartilhá-la.

Os avatares de malha precisam de WebGL2, que os navegadores atuais têm. Sem ele, ou quando o navegador interrompe os gráficos do avatar para economizar memória, o avatar mostra a sua configuração PNGTuber ou os seus sprites no lugar.

<a id="3d-avatars-vrm-models"></a>

## Avatares 3D: modelos VRM

**3D Avatars** mostra modelos VRM, o formato que o VRoid Studio, o add-on VRM para o Blender e o UniVRM para Unity exportam. Arquivos VRM 1.0 e VRM 0.x funcionam.

Ainda não tem um modelo? [Crie um no VRoid Studio](#get-a-3d-model), um aplicativo gratuito, e importe-o.

1. Abra **3D Avatars** no editor de agentes e escolha o personagem ou a persona.
2. Em **VRM model**, selecione **Import VRM** (importar VRM) e escolha um arquivo `.vrm`.
3. Leia **The author's terms** (os termos do autor). Eles vêm do arquivo do modelo e dizem quem pode usar o modelo como avatar, se o uso comercial é permitido, se você pode alterar o modelo, se conteúdo sexual ou muito violento é permitido e, nos modelos VRM 1.0, se você precisa dar crédito ao autor e se pode compartilhar o arquivo. Quando o arquivo tiver um link para uma licença ou para os termos próprios do autor, abra esses links também. Marinara Engine mostra os termos, mas não os aplica, então siga-os você mesmo.
4. Em **Faces and mouth shapes** (rostos e formatos de boca), confira qual expressão do modelo mostra cada rosto (Neutral, Happy, Angry, Sad, Relaxed e Surprised), cada formato de boca (A, I, U, E e O) e a piscada. A maioria já vem preenchida: **Set by the model** (definida pelo modelo) significa que o modelo tem a expressão VRM padrão, e **Guessed from its name** (deduzida pelo nome) significa que uma das expressões próprias do modelo tem um nome correspondente. Uma expressão que o modelo deixou vazia não muda nada, então ela nunca é preenchida para nenhum rosto além de Neutral, que é o modelo em repouso, e a importação avisa quando pulou uma. Escolha outra expressão, ou **None** (nenhuma), sempre que um palpite parecer errado.
5. Se quiser, em **Idle animation** (animação de espera), adicione um arquivo `.vrma` para o modelo tocar enquanto espera. Sem ele, o modelo respira e balança de leve.

**Replace model** (substituir modelo) mantém a animação de espera, porque as animações VRM servem em qualquer modelo VRM. **Remove model** (remover modelo) exclui o modelo e a animação de espera dele.

Enquanto um chat roda, o modelo olha para você, pisca sozinho quando tem uma expressão de piscada e inclina a cabeça enquanto pensa ou escuta. Com o enquadramento padrão **Portrait**, a cabeça fica perto do topo do espaço reservado ao modelo: um espaço largo mostra a cabeça e os ombros, e um mais estreito mostra mais do corpo. Os enquadramentos **Half body** e **Full body**, nas configurações de Avatars do chat, mostram mais do modelo. Alguns modelos VRM 1.0 mantêm a boca parada enquanto mostram um rosto; enquanto um modelo assim fala, esse rosto aparece com intensidade parcial para que a boca ainda possa se mexer. Com a redução de movimento ativada, o rosto e a boca continuam mudando, mas o modelo para de balançar, de respirar e de tocar a animação de espera.

Alguns arquivos não podem ser usados, e a importação explica o motivo:

- **Modelos com compressão.** Arquivos salvos com compressão Draco ou meshopt, ou com texturas KTX2, não carregam. Exporte o modelo de novo com a compressão desligada.
- **Modelos 3D comuns.** Um modelo `.glb` ou `.gltf` sem dados VRM não tem expressões faciais nem esqueleto humanoide. Antes, converta o modelo para VRM, por exemplo com o add-on VRM para o Blender (veja [Faça o seu próprio modelo](#blender-with-the-vrm-add-on-for-blender)).
- **Modelos incompletos.** Um modelo é recusado se faltarem no esqueleto ossos de que o VRM precisa, se o esqueleto apontar para partes que não estão no arquivo ou se o modelo apontar para arquivos fora dele.

Não há limite de tamanho além do limite normal de upload do aplicativo, mas modelos grandes demoram mais para carregar, principalmente nos celulares.

<a id="get-a-3d-model"></a>

## Obter um modelo 3D

Se o personagem ou a persona ainda não tem um modelo VRM, crie um com o VRoid Studio. É um aplicativo gratuito da pixiv para Windows, macOS e iPad, e os modelos que você cria nele são seus para usar. Alguns dos itens embutidos dele e as texturas que você comprar têm termos próprios, então confira esses termos antes. Os modelos dele vêm com os seis rostos, os cinco formatos de boca e a piscada, então os rostos e a sincronia labial funcionam logo de cara.

Na página do **3D Avatars**, escolha o personagem ou a persona. Em **Get a 3D model** (obter um modelo 3D), **Read the guide** (ler o guia) abre esta seção e **Copy prompt** (copiar prompt) copia uma descrição da aparência do personagem ou da persona.

1. Baixe o [VRoid Studio](https://vroid.com/en/studio) e instale-o.
2. Se quiser, crie uma imagem para usar de referência: selecione **Copy prompt** e cole o prompt em um gerador de imagens. O VRoid Studio não tem uma caixa para prompt, então a imagem serve só para você olhar enquanto monta o modelo.
3. No VRoid Studio, crie um novo modelo. Escolha o cabelo, o rosto, os olhos, o corpo e a roupa mais parecidos com os do personagem e depois mude os formatos e as cores até ficarem iguais.
4. Exporte o modelo como VRM. VRM 1.0 e VRM 0.0 funcionam. Preencha os detalhes e os termos do modelo quando o VRoid Studio pedir.
5. Abra **3D Avatars** em **Agents**, escolha o personagem ou a persona e selecione **Import VRM** em **VRM model**. Em **Faces and mouth shapes**, todos os rostos, todos os formatos de boca e a piscada de um modelo do VRoid Studio já vêm preenchidos.

**Para que serve o prompt.** Ele descreve o personagem para ferramentas que criam uma imagem ou um modelo 3D a partir de texto: um personagem de corpo inteiro no estilo anime, em pé na pose em T, visto de frente sobre um fundo liso, com a aparência dele. A aparência vem do campo **Appearance** (aparência), das tags de **Image Appearance Override** (aparência alternativa para imagens) quando elas estão ativadas, ou da descrição quando não há aparência. O prompt traz só o nome e a aparência: nada mais do card e nada dos seus chats. Ele está em inglês; mude-o como quiser antes de usar.

**O que se mexe.** O rosto acompanha a resposta, e a boca se mexe com o texto ou com a voz quando o modelo tem expressões para isso. Um VRM de outra ferramenta pode ter menos expressões ou nenhuma, e **Faces and mouth shapes** mostra quais ele tem. Alguns sites dizem criar um VRM com expressões faciais a partir de uma imagem ou de uma descrição, mas nenhum pôde ser confirmado quando este guia foi escrito (outubro de 2026), então este guia não recomenda nenhum.

Um modelo criado antes com o gerador do Tripo, que foi removido, ainda carrega e mexe o corpo, mas o rosto dele não se mexe.

## Como os rostos e as bocas acompanham a resposta

Os avatares reagem sozinhos; não há nada para configurar nesta parte.

**Rostos no Roleplay.** Enquanto uma resposta chega em streaming, Marinara Engine lê cada frase concluída e deduz o humor dela. Para evitar que o rosto fique trocando sem parar:

- O rosto só muda quando o novo humor é claramente mais forte que o atual.
- Um rosto fica pelo menos dois segundos.
- O rosto só volta ao estado calmo depois de duas frases calmas seguidas.
- Cerca de quatro segundos depois do fim da resposta, o rosto relaxa e volta ao estado calmo.

Quando a conversão de texto em voz lê a resposta em voz alta, os rostos acompanham a voz; veja **Quando a resposta é lida em voz alta** abaixo.

Com o streaming desligado, cada frase continua tendo seu próprio humor. Os rostos mudam em ordem durante o tempo de fala da resposta, em vez de reduzir toda a resposta a um único humor médio.

Um avatar PNGTuber com rostos para [mais sentimentos](#pngtuber-sprites) também pode mostrar o sentimento mais específico que uma frase transmite, como Amusement quando a frase é alegre. Esse rosto segue as mesmas regras: precisa de uma leitura clara e fica pelo menos dois segundos, e um sentimento sem rosto próprio mostra o rosto do seu sentimento principal. As escolhas do Expression Engine e do Game Master funcionam do mesmo jeito: quando o avatar não tem um rosto com o nome escolhido, como `scared`, ele mostra o rosto desse sentimento, aqui Fear. Os avatares 3D e de malha mostram só os seis sentimentos.

**Como o humor é lido.** A sua conexão de chat não é consultada. O texto do seu chat fica no seu próprio Marinara Engine e nunca é enviado a um serviço externo.

- Uma lista de palavras integrada responde na hora, em qualquer lugar, e conhece palavras comuns de humor em vários idiomas.
- Nos computadores que conseguem rodá-lo, Marinara Engine lê as frases com um pequeno modelo de emoções no lugar da lista, o leitor de humor. Ele entende 36 idiomas. Ele é baixado uma única vez, com cerca de 300 MB, na primeira vez que você abre um chat de Roleplay com o 2D Avatars ou o 3D Avatars ativado. Ele não é baixado enquanto os dois agentes estão desligados. A página de cada agente de avatar em **Agents** mostra o progresso do download, e um download que falha tenta de novo sozinho cerca de 10 minutos depois. A lista de palavras responde até o leitor de humor ficar pronto, e depois do download o leitor funciona offline. Ele usa cerca de 1 GB de memória enquanto está em uso e é descartado da memória depois de 10 minutos sem uso. As instalações Lite, o Android e os computadores com menos de 3 GB de memória continuam com a lista de palavras.

**Rostos no Game Mode.** Cada fala que o Game Master mostra vem com uma expressão, e o avatar do personagem que fala assume essa expressão. O Game Master escolhe o rosto mesmo quando uma voz lê a fala. Os pensamentos internos de um personagem mudam o rosto, mas não a boca.

**O Expression Engine.** Quando ele está ativado no chat, a escolha dele depois da resposta é o rosto final dessa resposta. Uma escolha que chega depois que você mandou a próxima mensagem fica com a resposta a que se referia. Quando a conversão de texto em voz lê a resposta em voz alta, a escolha aparece quando a voz termina. Os avatares também funcionam sem ele.

**Bocas.** Pelo texto, a boca só se mexe nos diálogos (palavras entre aspas, linhas `[Name]:` e marcações de quem fala), não na narração, mais ou menos no ritmo da fala. Se o texto aparecer mais rápido do que alguém conseguiria falar, a boca acelera e depois pula adiante para acompanhar as palavras na tela. Com o streaming desligado, o diálogo de uma resposta é falado em até oito segundos. Quando a conversão de texto em voz lê uma fala, é a voz que mexe a boca, então a narração de um personagem lida na voz dele também mexe a boca dele.

**Quando a resposta é lida em voz alta.** Com a conversão de texto em voz e o **Auto-play** (leitura automática) ligados no Roleplay, a voz costuma começar alguns segundos depois que a resposta apareceu, então o avatar espera por ela:

- Enquanto a resposta aparece, o avatar pisca e se mexe como sempre, mas a boca fica fechada e o rosto ainda não muda.
- Quando a voz começa, a boca se mexe com a voz, e o rosto muda à medida que a voz chega a cada frase.
- O rosto relaxa cerca de quatro segundos depois do fim da voz, não do texto. Pausas curtas entre as falas não o fazem relaxar.
- Se a voz falhar ou não começar poucos segundos depois da resposta, o avatar reproduz uma vez os rostos e a boca da resposta a partir do texto. Se ela falhar mais tarde, o avatar só mostra o último humor da resposta e depois relaxa.
- Depois de 30 segundos sem a voz, o avatar para de esperar. Uma voz que começa mais tarde ainda mexe a boca.

**Corpo.** Um avatar fica pensando desde o momento em que você envia até as primeiras palavras dele, fala enquanto a boca se mexe, escuta enquanto outro fala ou enquanto você digita e fica em repouso no resto do tempo.

**Chats em grupo.** Em um grupo Individual, quem fala é o membro que está respondendo, inclusive quando você dá swipe na mensagem de um membro. Em um grupo Merged, uma marcação de quem fala dirige o diálogo e o rosto desse personagem, mesmo dentro de um parágrafo que cita outro. Diálogos atribuídos pelo nome também seguem quem fala. Falantes desconhecidos não usam o avatar de outro personagem. A prosa sem marcação pertence ao primeiro personagem que ela cita ou ao personagem do parágrafo anterior. Enquanto um parágrafo que não cita ninguém ainda está aparecendo, o diálogo dele espera até que um nome ou o fim do parágrafo mostre quem fala. Com o streaming desligado em um grupo Individual, por enquanto só a resposta do último membro mexe um avatar.

<a id="lip-sync-with-text-to-speech"></a>

## Sincronia labial com a conversão de texto em voz

Quando a conversão de texto em voz lê uma resposta de Roleplay, o avatar do personagem que está falando mexe a boca com a voz. A boca abre mais nos sons altos e fecha nas pausas. Ela também muda de formato: fica arredondada em sons escuros como "u" e mostra os dentes em sons como "s". Não há nada extra para configurar. Ative a conversão de texto em voz como explica o guia [Configuração de Text to Speech (TTS)](../media/tts-setup.md), e a sincronia labial funciona com **Auto-play** e com o botão **Speak** (falar) de uma mensagem, inclusive no layout de visual novel.

- **Quem fala:** a boca que se mexe é a do personagem cuja voz lê a fala, o mesmo personagem para quem a **Voice Option** (opção de voz) escolhe uma voz. Quando uma resposta tem vários falantes, a boca de cada personagem só se mexe nas próprias falas. As falas lidas na voz do narrador, e os falantes que não são personagens do chat, não mexem nenhuma boca. Com **Only read dialogues** (ler só os diálogos) desligado, a narração do próprio personagem é lida na voz dele, então a boca dele também se mexe nela.
- **Pausar, parar e trocar de chat:** pausar ou parar a voz para a boca. Se você trocar para outro chat enquanto uma resposta ainda está sendo lida, os avatares de lá ficam parados. Volte ao primeiro chat enquanto a voz ainda toca, e o avatar dele retoma a voz.
- **Rostos:** o rosto muda à medida que a voz chega a cada frase, com **Auto-play** e com o botão **Speak**, a menos que o Expression Engine já tenha escolhido o rosto dessa resposta.
- **Volume:** o controle deslizante **Line volume** (volume da fala) muda o volume da voz, não o quanto a boca abre.
- **Personas:** a boca de uma persona não se mexe nas suas próprias mensagens, com ou sem conversão de texto em voz.
- **Game Mode:** com a conversão de texto em voz e o **Auto-play** ligados, as bocas dos avatares esperam a voz do próprio personagem e a acompanham. Pausar, parar ou trocar de chat para a boca. Falas sem voz mantêm a animação pelo texto, e, se uma voz falha ou nunca começa, a boca acompanha o texto uma vez. As vozes do narrador e do jogador não mexem a boca de nenhum personagem; os pensamentos internos não são lidos em voz alta.

A sincronia labial não muda a forma como a voz toca. Marinara Engine lê uma cópia separada de cada clipe de voz para cronometrar a boca, então a reprodução funciona como antes, inclusive no Safari e no iPhone e no iPad. Ele prepara a sincronia da boca à medida que os clipes chegam, enquanto há um avatar presente. Se o primeiro clipe começar antes de essa sincronia estar pronta, o texto dele mexe a boca até a sincronia com a voz assumir. Se o seu navegador não conseguir ler um clipe, a voz continua tocando e só a boca deixa de acompanhá-la.

<a id="making-an-avatar-from-a-sprite"></a>

## Criar um avatar a partir de um sprite

Na página do agente **2D Avatars** no editor de agentes, escolha um personagem ou uma persona e use **Make an avatar from a sprite** (criar um avatar a partir de um sprite). Esse recurso trabalha com os sprites que o personagem ou a persona já tem. O seu avatar continua igual até você salvar um resultado, então você pode tentar quantas vezes quiser.

<a id="faces-from-the-avatar"></a>

### Rostos a partir do avatar

**Make faces from the avatar** (criar rostos a partir do avatar) cria rostos sem fundo, inclusive para um personagem ou uma persona que ainda não tem sprites. Ele abre a geração de sprites, a mesma dos editores de personagem e de persona, com o avatar marcado como referência.

1. Ele começa pelos seis rostos principais, Neutral, Happy, Angry, Sad, Relaxed e Surprised, e oferece mais 23 sentimentos, como Pride, Grief e Realization. Cada sentimento extra fica na linha do rosto principal que ele mostra até ter um rosto próprio. Escolha **All faces** (todos os rostos) para os 29, **Main faces** (rostos principais) para os seis, ou os rostos que quiser.
2. Os rostos são desenhados em lotes, primeiro os principais, com tantos rostos em cada imagem quanto a grade comporta; os modelos GPT Image mais antigos desenham um rosto por imagem. Uma imagem que falha é tentada de novo uma vez; se falhar de novo, a execução para com **Retry picture** (tentar a imagem novamente), e **Cancel** mantém os rostos já criados.
3. Com **Expose media prompts before sending** ligado, você revisa os prompts de todas as imagens de uma vez antes de a primeira ser enviada. Todo rosto é desenhado com os olhos abertos e a boca fechada, para que as imagens de piscada e de fala dele tenham o que fechar e abrir.
4. Ele desenha novos sprites de expressão a partir do avatar sobre uma cor lisa, remove essa cor e os salva como os sprites do personagem ou da persona. Um sprite novo substitui o que tem o mesmo nome, então renomeie-o no último passo para manter o antigo. Quando o avatar já está salvo, cada rosto novo vira o rosto do sentimento para o qual foi desenhado, mesmo que você o tenha renomeado; os seus outros sprites continuam, e você pode escolhê-los de novo em **Face for each feeling**. Um rosto refeito começa sem imagens de piscada e de fala, porque as antigas não combinariam com ele; crie novas em [Imagens de piscada e de fala](#blink-and-talk-pictures). Uma importação do PNGTuber Plus mantém os próprios rostos. É preciso ter um avatar e uma conexão de geração de imagens.

<a id="blink-and-talk-pictures"></a>

### Imagens de piscada e de fala

1. Cada rosto que o avatar mostra para um sentimento é uma linha, com o nome dos sentimentos que o mostram. Ao lado do **Face** (rosto) ficam as imagens **Eyes closed** (olhos fechados) e **Mouth open** (boca aberta) dele: as que você salvou, os sprites `_blink` e `_talk` que você adicionou ou imagens novas. Quando o personagem ou a persona tem sprites de retrato, só eles são usados, porque o avatar nunca mistura rostos de retrato e de corpo inteiro. Um rosto que não é um dos seus sprites, como um que veio de uma importação do PNGTuber Plus, mostra as imagens dele, mas não é possível desenhar imagens novas para ele.
2. Confira a **Image connection** (conexão de imagem); a sua conexão de imagem padrão já vem escolhida. **Make** (criar) desenha uma imagem que falta, e **Make pictures** (criar imagens) desenha todas. Cada imagem é uma solicitação de imagem; uma conexão que não consegue editar imagens desenha as duas imagens de um rosto em uma única solicitação (veja abaixo). Com a opção **Expose media prompts before sending** ligada em **Settings** (Configurações), você vê cada prompt antes e pode editá-lo.
3. As imagens novas aparecem uma de cada vez. Selecione **Keep** (manter) nas que ficaram boas e **Try again** (tentar de novo) nas outras; **Try again** também redesenha uma imagem que você já tem. A imagem que está sendo redesenhada fica esmaecida, com um indicador de carregamento, até a nova chegar. **Cancel** interrompe a imagem que está sendo criada, também no servidor, e descarta as imagens que ainda não foram criadas. Se **Try again** falhar, a imagem antiga fica. Para refazer uma imagem mantida, selecione **Kept** (mantida) para liberá-la antes.
4. Selecione **Save kept pictures** (salvar as imagens mantidas). Elas viram as imagens de piscada e de fala do avatar PNGTuber para essas expressões, ao lado de uma cópia do sprite a partir do qual foram desenhadas, ou do rosto novo desenhado junto com elas, para ficarem sempre alinhadas. Se o avatar ainda mostrava os seus sprites como estão, ele mantém todos e ganha as imagens novas. Se você substituir um sprite antes de salvar, crie as imagens dele de novo.

Com uma conexão de imagem que aceita uma imagem de referência, o seu sprite é enviado como a única referência, no tamanho e no formato que o modelo aceita (um recorte sobre um fundo branco), com um prompt que pede para mudar só os olhos ou a boca. Os modelos movem, redimensionam ou acrescentam margens à imagem que devolvem, então ela primeiro é alinhada com o seu sprite, e depois só os olhos (para a piscada) ou a boca (para a fala) são aproveitados dela. Todo o resto, inclusive o contorno, as roupas e um busto cortado na borda de baixo, continua com os pixels do próprio sprite, então o avatar não dá um salto quando pisca ou fala. Se o modelo não fechou os olhos ou não abriu a boca, ou moveu a imagem demais para que ela pudesse ser alinhada, a imagem falha com uma mensagem que explica isso; tente de novo.

Algumas conexões não conseguem editar imagens, como Pollinations, Together AI, Horde, DALL-E ou um fluxo de trabalho do ComfyUI sem espaço para uma imagem de referência. Com uma delas, **Make** desenha um rosto novo a partir da aparência do personagem ou da persona junto com as imagens de piscada e de fala dele, em uma única imagem para que as três combinem, sobre uma cor lisa que depois é removida, como faz [Rostos a partir do avatar](#faces-from-the-avatar). A linha mostra esse resultado como **New face** (rosto novo). **Keep** mantém o rosto novo e as duas imagens dele juntos, e ao salvar, o rosto novo vira o rosto daquele sentimento no avatar; o seu sprite em si não muda. Isso exige uma aparência ou uma descrição no personagem ou na persona.

<a id="mesh-avatar"></a>

### Avatar de malha

1. Escolha um sprite. O sprite neutro de corpo inteiro já vem escolhido quando o personagem tem um; caso contrário, vem o sprite neutro. Você pode escolher outro. Um sprite de frente, de corpo inteiro ou de busto, funciona melhor.
2. Escolha a **Chat connection that can see pictures** (conexão de chat que enxerga imagens). **The agent's connection** (a conexão do agente) usa a conexão definida na página do 2D Avatars ou, se não houver, a sua conexão padrão de agentes. O modelo dela precisa aceitar imagens.
3. Selecione **Make mesh avatar** (criar avatar de malha). O modelo de chat encontra o rosto, e Marinara Engine monta o avatar a partir do seu sprite como ele é. **Cancel** interrompe a criação.
4. Confira a pré-visualização: os contornos devem ficar sobre os olhos, as sobrancelhas e a boca. Selecione **Save as mesh avatar** (salvar como avatar de malha) ou **Discard** e tente outro sprite ou outro modelo.

Um avatar de malha gerado mexe a cabeça, os olhos, as sobrancelhas e a boca, e pisca e fala com as próprias pálpebras e a própria boca. O cabelo se mexe junto com a cabeça; as mãos, as mechas soltas de cabelo e os acessórios pendurados não são articulados. Para sprites pequenos, o avatar é montado a partir de uma cópia maior, para que a boca se encaixe no rosto. Quando o rosto ocupa a maior parte de um sprite grande, o avatar é montado a partir de uma cópia menor, para a criação continuar rápida.

O seu sprite é enviado à conexão de imagem para as imagens de piscada e de fala (e à conexão de imagem de reserva dessa conexão, se ela falhar, se houver uma definida e se ela aceitar uma imagem de referência), e à conexão de chat para um avatar de malha. Uma conexão que não consegue editar imagens recebe só o prompt, que inclui a aparência. Os prompts vêm com o agente 2D Avatars. Com **Expose media prompts before sending** ligado, você pode ler e mudar o prompt de cada imagem antes do envio. Com o modo de depuração ligado, todo prompt é gravado no log do servidor.

## Faça o seu próprio modelo

Você não precisa desenhar nada para começar. Um personagem ou uma persona pode usar seus sprites de expressão como avatar PNGTuber, e [Criar um avatar a partir de um sprite](#making-an-avatar-from-a-sprite) acrescenta imagens de piscada e de fala ou monta um avatar de malha para você. Se preferir fazer o seu próprio modelo, use uma destas ferramentas. Salve a configuração de sprites e ligue **Show this avatar in chats** para exibi-la. Todo arquivo é importado na página do agente em **Agents**.

| O que você quer | Ferramenta | O que você recebe |
| --- | --- | --- |
| Sprites PNGTuber | Qualquer aplicativo de desenho e depois a aba **Sprites** do personagem | Os sprites |
| Sprites PNGTuber com camadas e figurinos | [PNGTuber Plus](https://github.com/kaiakairos/PNGTuber-Plus) | Um arquivo `.save` |
| Um avatar de malha | [Mesh Avatar Studio](https://github.com/shinshin86/mesh-avatar-studio) | Um arquivo `.mavatar` |
| Um modelo 3D | [VRoid Studio](https://vroid.com/en/studio) ou o Blender com o [VRM Add-on for Blender](https://vrm-addon-for-blender.info/en-us/) | Um arquivo `.vrm` e, se quiser, uma animação de espera `.vrma` |

### Os seus próprios sprites

1. Desenhe uma imagem para cada sentimento, todas do mesmo tamanho e com o personagem no mesmo lugar. Dê a cada imagem o nome do sentimento dela: `neutral`, `happy`, `angry`, `sad`, `relaxed` e `surprised`. Nomes que contêm uma palavra de sentimento também funcionam, como `smile`, `cry`, `calm` ou `shock`. Para os [sentimentos extras](#pngtuber-sprites) opcionais, adicione também imagens com o nome deles, como `amusement`, `fear` ou `gratitude`.
2. Para a boca se mexer, desenhe a mesma imagem só com a boca aberta e acrescente `_talk` ao nome dela, por exemplo `happy_talk`. Para piscar, feche só os olhos e acrescente `_blink`; com os dois, acrescente `_blink_talk`. Um sentimento sem essas imagens ainda dá pulinhos enquanto fala.
3. Adicione as imagens na aba **Sprites** do personagem ou da persona, em **Facial Expressions** (expressões faciais). **Upload Folder** (enviar pasta) adiciona uma pasta inteira e dá a cada sprite o nome do arquivo dele. Veja [Sprites de personagem](../characters/sprites.md).
4. Abra **2D Avatars** em **Agents**, escolha o personagem ou a persona e ligue **Show this avatar in chats** para salvar os sprites como avatar. Os chats com 2D Avatars ligado passam a exibi-lo. Para mudar o rosto de uma emoção ou o movimento, veja [Sprites PNGTuber](#pngtuber-sprites).

### PNGTuber Plus

1. Monte o avatar com camadas separadas. Configure a boca aberta para aparecer só enquanto o avatar fala e a boca fechada só em silêncio. Configure os olhos fechados para aparecer só enquanto o avatar pisca e os olhos abertos só quando ele não está piscando.
2. Para cada sentimento, crie um figurino que troque os olhos ou a boca, e dê a essas imagens o nome do sentimento, por exemplo `angry eyes.png` ou `happy_mouth.png`. Os sentimentos mais específicos funcionam do mesmo jeito, por exemplo `fear eyes.png`. O figurino 1 é o rosto em repouso.
3. Salve o avatar para obter um arquivo `.save`.
4. Abra **2D Avatars** em **Agents**, escolha o personagem ou a persona e depois **PNGTuber sprites** e **Import PNGTuber Plus save**. Escolha um rosto para qualquer sentimento que os nomes não cobriram.

### Mesh Avatar Studio

1. Comece com uma imagem de frente, da cabeça e dos ombros, com fundo transparente. O Mesh Avatar Studio roda no seu computador com Node.js, e um agente de programação, como o Claude Code ou o Codex, prepara a imagem para se mexer. O README dele explica o passo a passo.
2. Se quiser, adicione olhos e bocas desenhados em **Drawn variants**. Marinara Engine usa esses formatos de boca (`mouth_a`, `mouth_i`, `mouth_o` e `mouth_a_half`) e olhos fechados (`eyes_closed_0` e `eyes_closed_1`) automaticamente. Todo avatar de malha já tem os seis sentimentos embutidos, então não há nada para nomear.
3. Escolha **Export .mavatar**. Não compacte a pasta do projeto em ZIP por conta própria.
4. Abra **2D Avatars** em **Agents**, escolha o personagem ou a persona e depois **Mesh avatar** e **Import .mavatar file**.

### VRoid Studio

1. Crie o personagem no VRoid Studio. Os rostos, os formatos de boca e a piscada dele são expressões VRM padrão, então são encontrados automaticamente.
2. Exporte o personagem como VRM. VRM 1.0 e VRM 0.0 funcionam. Preencha os detalhes e os termos do modelo quando o VRoid Studio pedir.
3. Abra **3D Avatars** em **Agents**, escolha o personagem ou a persona e selecione **Import VRM**.

<a id="blender-with-the-vrm-add-on-for-blender"></a>

### Blender com o VRM Add-on for Blender

1. Instale o VRM Add-on for Blender em **Get Extensions**, nas **Preferences** do Blender. Em versões do Blender anteriores à 4.2, instale o arquivo ZIP do add-on em **Add-ons**.
2. Dê ao modelo um esqueleto humanoide (armature) e atribua os ossos VRM dele. O add-on pode atribuir os ossos automaticamente.
3. Configure as expressões no painel VRM do add-on: **Expressions** para VRM 1.0 ou **VRM 0.x Blend Shape Proxy** para VRM 0.x. Cada uma precisa mexer uma shape key ou um material: uma expressão vazia não muda nada, então a importação só a usa para Neutral. Expressões personalizadas com um nome claro, como `Smile` ou `Shock`, também são associadas.
   - Rostos: **Happy**, **Angry**, **Sad**, **Relaxed** e **Surprised**. O VRM 0.x chama os quatro primeiros de **Joy**, **Angry**, **Sorrow** e **Fun** e não tem um preset de surpresa, então adicione uma expressão personalizada chamada `Surprised`.
   - Formatos de boca: **Aa**, **Ih**, **Ou**, **Ee** e **Oh** (**A**, **I**, **U**, **E** e **O** no VRM 0.x).
   - Piscada: **Blink**.
4. Exporte com **File → Export → VRM (.vrm)**. Para uma animação de espera, anime o esqueleto e use **File → Export → VRM Animation (.vrma)**. O add-on só exporta uma animação a partir de um modelo definido como VRM 1.0, então escolha VRM 1.0 no passo 3 se quiser uma.
5. Abra **3D Avatars** em **Agents**, escolha o personagem ou a persona e selecione **Import VRM**. Adicione a animação com **Add animation** (adicionar animação) em **Idle animation**.

### O que evitar ao exportar

- **Compressão.** A compressão de malha Draco ou meshopt e as texturas KTX2 não carregam. As exportações VRM acima nunca usam esses recursos, mas a exportação glTF comum do Blender oferece Draco, e otimizadores de modelo podem acrescentar os três. Exporte de novo com a compressão desligada.
- **glTF comum.** Um arquivo `.glb` ou `.gltf` comum não tem os dados VRM que nomeiam os rostos e o esqueleto. Exporte um `.vrm` no lugar.
- **Arquivos separados.** Um modelo cujas texturas ou dados ficam em arquivos separados não pode ser usado. Exporte um único arquivo `.vrm`.
- **Extras do PNGTuber Plus.** O balanço, o arrasto e a animação não são trazidos: cada camada aparece em repouso, e uma camada animada mostra o primeiro quadro.

## Desempenho e dispositivos

O código de desenho de cada tipo de avatar só é baixado na primeira vez que um avatar desse tipo aparece, então os chats sem avatares não carregam nada a mais.

| | Celulares | Computadores |
| --- | --- | --- |
| Avatares desenhados ao mesmo tempo | Sem limite fixo | Sem limite fixo |
| Quadros por segundo enquanto fala | 30 | 30 |
| Quadros por segundo em repouso | 20, ou 15 quando o celular está ocupado | 30 |
| Nitidez (proporção de pixels) | até 1,5× | até 2× |

Um chat mostra todos os avatares 2D ou 3D configurados e ligados na ordem dos personagens e depois a sua persona. Não há limite fixo de quantidade; ajuste o tamanho e a posição dos integrantes à tela e ao dispositivo. Os avatares param de ser desenhados por completo enquanto a aba está oculta, a janela está em segundo plano, as configurações de aparência estão abertas ou o chat está fora da tela ou coberto por um painel ou editor. Com **Reduce Ambient Animations & Effects** (reduzir animações e efeitos de ambiente) ou a redução de movimento do seu dispositivo ligada, os avatares ainda mudam de rosto e mexem a boca, mas deixam de respirar, de balançar e de fazer as poses de espera.

## Guias relacionados

- [Agentes: ajudantes de IA para os seus chats](agents-overview.md)
- [Referência dos agentes para download](built-in-agents.md)
