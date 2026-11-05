# Avatares 2D e 3D

Dois agentes para download dão aos personagens e às personas um avatar animado que reage enquanto a resposta chega em streaming. **2D Avatars** (avatares 2D) mostra sprites no estilo PNGTuber ou avatares de malha. **3D Avatars** (avatares 3D) mostra modelos VRM, MMD PMX, GLB e FBX. Os rostos acompanham a resposta, e as bocas se mexem com o texto ou com a conversão de texto em voz.

Os modelos Live2D não têm suporte. A licença do Live2D exige um acordo separado mesmo para aplicativos gratuitos de código aberto, e o runtime dele não pode ser distribuído com Marinara Engine.

## Instalar os agentes de avatar

Os dois agentes estão em **Agent Organizer** (organizador de agentes) para todas as instalações, nos filtros **Roleplay** e **Game**. Eles exigem Marinara Engine 2.5.1 ou mais recente. Um Engine mais antigo recusa a instalação. São downloads separados, então instale só o que você quiser. Os dois funcionam para personagens e personas em chats de Roleplay e de Game e não enviam nenhuma solicitação extra aos seus modelos de IA durante o chat.

1. Abra **Agents → Agent Organizer** e instale **2D Avatars**, **3D Avatars** ou os dois. Nenhum deles exige reiniciar.
2. Configure cada avatar na página do agente (veja [Configurar um avatar](#set-up-an-avatar)).
3. Em um chat de Roleplay ou de Game, abra **Chat Settings → Agents → Misc Agents** (configurações do chat → agentes → agentes diversos) e adicione o agente.

Um avatar aparece em um chat de Roleplay, Visual Novel ou Game quando os agentes estão ativados e o agente correspondente foi adicionado. Ele funciona com ou sem o Expression Engine. O avatar não esconde o sprite de corpo inteiro, então desligue esse sprite você mesmo se o avatar for substituí-lo. Os avatares ficam onde o sprite de corpo inteiro ficaria e têm o mesmo tamanho dele.

<a id="set-up-an-avatar"></a>

## Configurar um avatar

Abra **Agents**, abra **2D Avatars** ou **3D Avatars** e use a seção **Avatars** perto do topo.

1. Em **Character or persona** (personagem ou persona), escolha quem recebe o avatar. Os nomes marcados com "(has an avatar)" já têm um.
2. Em **Avatar type** (tipo de avatar), escolha o tipo. 2D Avatars oferece **PNGTuber sprites** (sprites PNGTuber) e **Mesh avatar** (avatar de malha). 3D Avatars oferece **VRM model** (modelo VRM), **MMD PMX model** (modelo MMD PMX) e **GLB or FBX model** (modelo GLB ou FBX).
3. Configure o avatar na seção desse tipo, mais abaixo: use os seus sprites ou importe um arquivo, escolha o rosto de cada sentimento ou remova o avatar.
4. Use **Preview** (pré-visualização) para conferi-lo. **Try a face** (testar um rosto) troca o sentimento, e **Talk** (falar) mexe a boca. Quando ainda não há nada para mostrar, a pré-visualização mostra um avatar de exemplo.
5. Ligue **Show this avatar in chats** (mostrar este avatar nos chats).

**Show this avatar in chats** liga ou desliga um avatar configurado sem excluí-lo. A opção continua desligada até você configurar um avatar ou sprites utilizáveis. Uma foto de perfil sozinha não cria um avatar 2D.

**Movement** (movimento) tem três botões liga/desliga que valem para todos os tipos. **Lip sync** (sincronia labial) mexe a boca. **Blinking** (piscar) faz o avatar piscar a cada poucos segundos. **Idle motion** (movimento de espera) faz o avatar respirar e balançar enquanto espera. Se um personagem tem mais de um tipo de avatar, **Show this one** (mostrar este) escolhe o tipo que os chats usam. Quando o agente desse tipo está desligado em um chat, o chat mostra outro tipo cujo agente está ligado. Remover um tipo exclui os arquivos dele. Os seus sprites ficam.

### Redimensionar e mover os avatares em um chat

1. Abra **Chat Settings → Agents** e abra **Avatars**.
2. Escolha um avatar na lista e use o controle deslizante de tamanho dele.
3. Selecione **Arrange** (organizar) para mover os avatares. Arraste-os com o mouse ou com o dedo, ou foque um deles e use as setas do teclado (segure <kbd>Shift</kbd> para mover mais longe).
4. Selecione **Done** (concluir). Os avatares ficam onde você os colocou, e os cliques voltam a ir para o chat. **Reset** (redefinir) põe todos os avatares de volta no lugar.

Um avatar 3D também tem a opção **Framing** (enquadramento): **Portrait** (retrato) mostra a cabeça e os ombros (o padrão), **Half body** (meio corpo) mostra até os quadris, e **Full body** (corpo inteiro) mostra o modelo inteiro. O avatar mantém o tamanho, e um enquadramento mais alto mostra mais do modelo. Os avatares 2D não têm enquadramento.

O layout é salvo para aquele chat neste dispositivo. Ele não sincroniza com outros dispositivos. O botão **Arrange** do próprio Expression Engine também move os avatares.

### Onde ficam os arquivos de avatar

Os arquivos importados são verificados antes de serem armazenados. O único limite de tamanho é o limite normal de upload do servidor. Os arquivos ficam na pasta de dados, em `avatar-models/<character or persona>/<id>/`, ao lado de um `avatar.json` com as configurações. Os backups e as exportações de perfil incluem essa pasta. Excluir um personagem ou uma persona exclui o avatar correspondente, e o mesmo acontece quando você limpa toda a categoria **Characters**, **Personas** ou **Media & Assets** na Danger Zone (zona de perigo) das configurações. As exportações de card de personagem nunca incluem avatares.

### Chats em grupo

Os chats em grupo mostram todos os membros com um avatar salvo e ligado cujo agente esteja ligado, sem limite fixo. No modo **Individual**, o personagem que responde fala e expressa emoções. No modo **Merged (Narrator)**, as marcações de quem fala e os diálogos atribuídos pelo nome dirigem o personagem correspondente. Com as vozes ligadas, a sincronia labial segue o personagem cuja voz está tocando.

<a id="2d-avatars-pngtuber-sprites-and-mesh-avatars"></a>

## Avatares 2D: sprites PNGTuber e avatares de malha

**2D Avatars** mostra um de dois tipos de avatar. Os **sprites PNGTuber** são imagens planas que trocam de rosto, abrem a boca e piscam. Os **avatares de malha** são desenhos que mexem a cabeça, os olhos e a boca de forma suave. Configure os dois na página do agente depois de escolher um personagem ou uma persona.

<a id="pngtuber-sprites"></a>

### Sprites PNGTuber

Um personagem ou uma persona com sprites de expressão pode usá-los como avatar PNGTuber, com os sprites como rostos. Os sprites de retrato são usados quando existem e, caso contrário, os de corpo inteiro, então um avatar nunca mistura os dois. Confira-os na pré-visualização e depois ligue **Show this avatar in chats** ou salve-os com **Use my sprites** (usar os meus sprites).

- **Imagens de fala e de piscada.** Adicione sprites com o nome de um rosto mais `_talk` para a boca aberta e `_blink` para os olhos fechados, por exemplo `happy_talk`, `happy_blink` e `happy_blink_talk` para os dois. `_talking`, `_speak`, `_mouth_open`, `_blinking` e `_eyes_closed` também funcionam. Um rosto sem essas imagens ainda dá pulinhos enquanto fala.
- **Rosto de cada sentimento.** Escolha qual rosto aparece para Neutral, Happy, Angry, Sad, Relaxed e Surprised (neutro, feliz, bravo, triste, relaxado e surpreso). **Resting face** (rosto em repouso) usa o rosto Neutral. Todo sprite é oferecido, inclusive os adicionados depois, até 64 rostos. Uma importação do PNGTuber Plus oferece só os próprios rostos. Quando o Expression Engine ou o Game Master escolhe um sprite que você tem, esse rosto exato aparece.
- **Mais sentimentos.** Em **Face for each feeling** (rosto de cada sentimento), abra **More feelings** (mais sentimentos) para escolher um rosto para 23 sentimentos mais específicos, agrupados nos seis (tabela abaixo). Cada um usa o rosto do seu sentimento principal até você escolher outro. Um sprite com o nome de um deles, como `fear`, `amusement` ou uma palavra como `scared` ou `laughing`, é usado para esse sentimento sem nenhuma configuração.
- **Movimento.** **Hop while talking** (pular enquanto fala) e **Hop height** (altura do pulo) definem o pulinho. **Time between blinks** (tempo entre piscadas) é a média. Cada piscada vem um pouco antes ou um pouco depois. Com a redução de movimento ativada no seu dispositivo, o avatar não pula nem respira, mas o rosto e a boca continuam mudando.
- **Os sprites aparecem como são.** Um sprite desenhado sobre um fundo aparece com ele, e os seus arquivos nunca são alterados. Para rostos sem fundo, use [Rostos a partir do avatar](#faces-from-the-avatar).
- **Use my sprites** salva os sprites como os rostos. Escolher um rosto ou mudar o movimento também salva. **Update from sprites** (atualizar a partir dos sprites) pega os sprites que você adicionou depois e mantém os rostos que você escolheu. Depois de uma importação, escolha **Remove** (remover) para voltar aos seus sprites.

| Mais sentimentos, agrupados em | Sentimentos |
| --- | --- |
| Neutral | Curiosity (curiosidade) |
| Happy | Admiration (admiração), Amusement (diversão), Desire (desejo), Embarrassment (constrangimento), Excitement (empolgação), Gratitude (gratidão), Optimism (otimismo), Pride (orgulho) |
| Angry | Annoyance (irritação), Disapproval (desaprovação), Disgust (nojo) |
| Sad | Disappointment (decepção), Grief (luto), Nervousness (nervosismo), Remorse (remorso) |
| Relaxed | Approval (aprovação), Caring (carinho), Love (amor), Relief (alívio) |
| Surprised | Confusion (confusão), Fear (medo), Realization (percepção súbita) |

**Import PNGTuber Plus save** (importar save do PNGTuber Plus) lê um avatar salvo pelo [PNGTuber Plus](https://github.com/kaiakairos/PNGTuber-Plus) (um arquivo `.save`). Cada figurino vira um rosto, e as camadas de fala e de piscada dele viram as imagens de fala e de piscada. Os figurinos são associados aos sentimentos pelos nomes das imagens, como `angry eyes.png`. Escolha um rosto para qualquer sentimento que os nomes não cobriram. Algumas coisas não são trazidas:

- O balanço, o arrasto, a rotação e o esticamento não são importados. O avatar mostra cada camada em repouso.
- As camadas animadas mostram só o primeiro quadro.
- Saves muito antigos guardam só os caminhos das imagens no computador do autor. Antes, salve-os de novo em uma versão mais nova do PNGTuber Plus.
- Um avatar muito grande é reduzido para 2048 pixels, para que os celulares consigam guardar todas as imagens.

Importar um save precisa de processamento de imagem no servidor. Algumas instalações Android (Termux) não têm esse recurso, e a importação é recusada nelas com uma mensagem.

### Avatares de malha

Um avatar de malha é um arquivo `.mavatar`. Marinara pode criar um a partir de um sprite (veja [Avatar de malha](#mesh-avatar)), ou você pode criar um com o [Mesh Avatar Studio](https://github.com/shinshin86/mesh-avatar-studio) (veja [Mesh Avatar Studio](#mesh-avatar-studio)). Escolha **Import .mavatar file** (importar arquivo .mavatar) para adicionar um, ou **Replace file** (substituir arquivo) para trocá-lo. Com o movimento de espera ligado, o avatar respira e olha em volta sozinho. Ele pisca, e a boca dele acompanha a resposta. Os formatos de boca desenhados no arquivo são usados. Caso contrário, formatos simples são desenhados.

Em **Look for each feeling** (aparência de cada sentimento), escolha o que cada sentimento mostra: um dos seis sentimentos ou **Smile**, **Shy**, **Half-closed eyes** ou **Wink** (sorriso, tímido, olhos semicerrados ou piscadela).

Todo arquivo é verificado na importação. Um arquivo danificado, um arquivo detalhado demais para rodar com fluidez ou um que, ao ser descompactado, passa do limite de upload é recusado com um motivo curto. Só as partes de que o avatar precisa são guardadas, então a ilustração original dentro do arquivo não é armazenada. A arte pertence a quem a criou, então confira a licença dela antes de compartilhá-la.

Os avatares de malha precisam de WebGL2, que os navegadores atuais têm. Sem ele, ou quando o navegador interrompe os gráficos para economizar memória, o avatar mostra a sua configuração PNGTuber ou os seus sprites no lugar.

<a id="3d-avatars-vrm-models"></a>

## Avatares 3D: modelos VRM

**3D Avatars** mostra modelos VRM, o formato que o VRoid Studio, o add-on VRM para o Blender e o UniVRM para Unity exportam. Arquivos VRM 1.0 e 0.x funcionam. Se ainda não tiver um modelo, [crie um no VRoid Studio](#get-a-3d-model), um aplicativo gratuito.

1. Abra **3D Avatars** e escolha o personagem ou a persona.
2. Em **VRM model**, selecione **Import VRM** (importar VRM) e escolha um arquivo `.vrm`.
3. Leia **The author's terms** (os termos do autor). Eles vêm do arquivo do modelo e dizem quem pode usá-lo como avatar, se o uso comercial, as alterações e o conteúdo sexual ou muito violento são permitidos e, nos modelos VRM 1.0, se você precisa dar crédito ao autor e se pode compartilhar o arquivo. Abra também qualquer link de licença que o arquivo tiver. Marinara mostra os termos, mas não os aplica, então siga-os você mesmo.
4. Em **Faces and mouth shapes** (rostos e formatos de boca), confira qual expressão do modelo mostra cada rosto (Neutral, Happy, Angry, Sad, Relaxed, Surprised), cada formato de boca (A, I, U, E, O) e a piscada. **Set by the model** (definida pelo modelo) significa que o modelo tem a expressão VRM padrão. **Guessed from its name** (deduzida pelo nome) significa que uma das expressões próprias dele tem um nome correspondente. Uma expressão vazia não muda nada, então ela só é preenchida para Neutral. Escolha outra expressão, ou **None** (nenhuma), quando um palpite parecer errado.
5. Opcional: em **Idle animation** (animação de espera), adicione um arquivo `.vrma` para o modelo tocar enquanto espera. Sem ele, o modelo respira e balança de leve.

**Replace model** (substituir modelo) mantém a animação de espera, porque as animações VRM servem em qualquer modelo VRM. **Remove model** (remover modelo) exclui os dois.

Em um chat, o modelo olha para você, pisca sozinho quando tem uma expressão de piscada e inclina a cabeça enquanto pensa ou escuta. Alguns modelos VRM 1.0 mantêm a boca parada enquanto mostram um rosto. Enquanto um modelo assim fala, esse rosto aparece com intensidade parcial para que a boca possa se mexer. Com a redução de movimento ativada, o rosto e a boca continuam mudando, mas o modelo para de balançar, de respirar e de tocar a animação de espera.

Se não funcionou, a importação explica o motivo. As causas mais comuns:

- **Modelos com compressão.** A compressão Draco ou meshopt, ou as texturas KTX2, não carregam. Exporte o modelo de novo com a compressão desligada.
- **Modelos 3D comuns.** Um `.glb` ou `.gltf` sem dados VRM não tem expressões nem esqueleto humanoide. Importe um `.glb` com esqueleto como **GLB or FBX model** (veja [Avatares GLB e FBX](#glb-and-fbx-avatars-rigged-models)) ou converta-o para VRM (veja [Blender](#blender-with-the-vrm-add-on-for-blender)).
- **Modelos incompletos.** Um modelo é recusado se faltarem ossos de que o VRM precisa, ou se ele apontar para partes que não estão no arquivo ou para arquivos fora dele.

Modelos grandes demoram mais para carregar, principalmente nos celulares.

<a id="mmd-avatars-pmx-models-and-vmd-motions"></a>

## Avatares MMD: modelos PMX e animações VMD

1. Na página **3D Avatars**, escolha **MMD PMX model** em **Avatar type**.
2. Selecione **Import PMX or ZIP** (importar PMX ou ZIP). Escolha um ZIP com um modelo PMX e as imagens dele. Mantenha as pastas e os nomes de arquivo do modelo, inclusive nomes japoneses. Um modelo que não precisa de imagens pode ser um `.pmx` sozinho.
3. Em **Faces and mouth shapes**, escolha o rosto de cada sentimento, formato de boca e piscada. Nomes comuns em inglês e japonês são associados automaticamente. Confira a pré-visualização e corrija os palpites. Um modelo sem rostos adequados ainda pode aparecer e mover o corpo.
4. Opcional: em **VMD motion** (animação VMD), adicione um `.vmd` feito para esse modelo. Ele é reproduzido enquanto **Idle motion** está ligado, e os rostos escolhidos continuam acompanhando o chat. Sem um VMD, o modelo balança suavemente.

Imagens ausentes, caminhos inseguros e arquivos danificados são recusados antes de substituírem o seu modelo salvo. A configuração lista os primeiros 256 nomes de expressão e avisa se houver mais. Substituir um PMX remove o VMD antigo dele, então adicione uma animação para o novo modelo. Remover um modelo MMD exclui as imagens e a animação dele e não mexe nos outros tipos de avatar. A redução de movimento interrompe a animação, mas mantém os rostos e a sincronia labial.

Com suporte: modelos PMX 2.0 e modelos PMX 2.1 compatíveis, com imagens PNG, JPEG, BMP e TGA, inclusive `.sph` e `.spa`. Alguns recursos mais novos do PMX 2.1 não têm suporte, e a importação explica o motivo. Modelos PMD, poses VPD e animações de câmera ou de luz não têm suporte. A física não é simulada, então o cabelo e as roupas podem ficar diferentes do que no MikuMikuDance. Modelos com mais de 256 caminhos de imagem, caminhos muito longos, imagens que exigem memória demais ou esqueletos complexos demais são recusados. Teste o seu modelo, principalmente no celular.

Os avatares MMD precisam de WebGL2 e usam os mesmos controles de pausa, taxa de quadros e enquadramento dos outros avatares. Os modelos são carregados apenas do seu Engine. Respeite as licenças e os termos dos autores. Importar ou reproduzir um deles não envia nada a um serviço de IA.

<a id="glb-and-fbx-avatars-rigged-models"></a>

## Avatares GLB e FBX: modelos com esqueleto

1. Na página **3D Avatars**, escolha **GLB or FBX model** em **Avatar type**.
2. Selecione **Import GLB or FBX** (importar GLB ou FBX) e escolha um arquivo `.glb` ou `.fbx` de um personagem com esqueleto (rig).

Um modelo comum não tem dados VRM que digam qual osso é qual, então a importação associa os ossos pelo nome. Esqueletos do Mixamo, Unity, VRoid, Unreal, Blender, 3ds Max, Maya HumanIK, Character Creator e DAZ usam nomes que ela reconhece. A seção mostra quantos ossos do corpo foram associados. O modelo precisa ter pelo menos os quadris, a coluna, a cabeça e os dois braços e antebraços. Caso contrário, a importação o recusa e diz quais ossos faltam. Renomeie esses ossos no seu aplicativo 3D ou crie o esqueleto do modelo no Mixamo. Modelos na pose em A, virados de costas ou feitos em centímetros são endireitados, girados e redimensionados automaticamente.

Os rostos vêm das blend shapes do modelo (shape keys ou morph targets). Em **Faces and mouth shapes**, nomes comuns são associados: formatos de boca do VRoid, do VRChat e do Oculus (`aa`, `A`, `viseme_aa`, `Fcl_MTH_A`), a mandíbula aberta (`mouthOpen`, `jawOpen`), sentimentos (`happy`, `Joy`, `mouthSmile`) e a piscada (`blink`, ou um par esquerdo e direito, como `eyeBlinkLeft` e `eyeBlinkRight` do ARKit). Confira a pré-visualização e corrija os palpites. Um modelo sem blend shapes ainda mexe o corpo e acena com a cabeça enquanto fala.

Com suporte: glTF binário (`.glb`) com tudo embutido e FBX 2014 (7.4) ou mais recente, binário ou ASCII. Exporte o FBX com **Embed Media** (ou **Embed Textures**) ligado, ou o modelo aparece sem as imagens dele. A compressão Draco, meshopt e KTX2 não carrega, e um `.gltf` separado, com arquivos próprios, não pode ser usado. Um VRM salvo como `.glb` vai em **VRM model**. As animações próprias do modelo, a física e a edição de pose não têm suporte. Respeite os termos do autor. Importar ou reproduzir um deles não envia nada a um serviço de IA.

<a id="get-a-3d-model"></a>

## Obter um modelo 3D

Se o personagem ou a persona não tem um modelo VRM, crie um no VRoid Studio. É um aplicativo gratuito da pixiv para Windows, macOS e iPad. Os modelos que você cria nele são seus para usar, mas alguns itens embutidos e as texturas que você comprar têm termos próprios. Os modelos dele vêm com os seis rostos, os cinco formatos de boca e a piscada, então os rostos e a sincronia labial funcionam logo de cara.

Na página **3D Avatars**, escolha o personagem ou a persona. Em **Get a 3D model** (obter um modelo 3D), **Read the guide** (ler o guia) abre esta seção e **Copy prompt** (copiar prompt) copia uma descrição da aparência do personagem ou da persona.

1. Baixe e instale o [VRoid Studio](https://vroid.com/en/studio).
2. Opcional: selecione **Copy prompt**, cole o prompt em um gerador de imagens e use a imagem como referência. O VRoid Studio não tem uma caixa para prompt.
3. No VRoid Studio, crie um novo modelo. Escolha o cabelo, o rosto, os olhos, o corpo e a roupa mais parecidos com os do personagem e depois mude os formatos e as cores até ficarem iguais.
4. Exporte o modelo como VRM (1.0 ou 0.0). Preencha os detalhes e os termos do modelo quando for pedido.
5. Abra **3D Avatars** em **Agents**, escolha o personagem ou a persona e selecione **Import VRM** em **VRM model**. Um modelo do VRoid Studio já vem com todos os rostos, todos os formatos de boca e a piscada preenchidos.

O prompt descreve o personagem para ferramentas que criam uma imagem ou um modelo 3D a partir de texto: um personagem de corpo inteiro no estilo anime, na pose em T, visto de frente sobre um fundo liso. A aparência vem do campo **Appearance** (aparência), das tags de **Image Appearance Override** (aparência alternativa para imagens) quando elas estão ativadas, ou da descrição quando não há aparência. Ele traz só o nome e a aparência, nada mais do card e nada dos seus chats. Ele está em inglês. Mude-o como quiser.

Um VRM de outra ferramenta pode ter menos expressões ou nenhuma. **Faces and mouth shapes** mostra quais ele tem. Alguns sites dizem criar um VRM com expressões faciais a partir de uma imagem, mas nenhum pôde ser confirmado em outubro de 2026, então este guia não recomenda nenhum. Um modelo criado antes com o gerador do Tripo, que foi removido, ainda carrega e mexe o corpo, mas o rosto dele não se mexe.

## Como os rostos e as bocas acompanham a resposta

Os avatares reagem sozinhos. Não há nada para configurar aqui.

**Rostos no Roleplay.** Enquanto uma resposta chega em streaming, Marinara lê cada frase concluída e deduz o humor dela. Para evitar que o rosto fique trocando sem parar:

- O rosto só muda quando o novo humor é claramente mais forte que o atual.
- Um rosto fica pelo menos dois segundos.
- O rosto volta ao estado calmo depois de duas frases calmas seguidas e cerca de quatro segundos depois do fim da resposta.

Com o streaming desligado, cada frase continua tendo o seu próprio humor, e os rostos mudam em ordem durante o tempo de fala da resposta. Quando a conversão de texto em voz lê a resposta, os rostos acompanham a voz em vez disso (veja abaixo).

Um avatar PNGTuber com rostos para [mais sentimentos](#pngtuber-sprites) pode mostrar um sentimento mais específico, como Amusement quando o humor é alegre. Ele segue as mesmas regras, e um sentimento sem rosto próprio mostra o rosto do seu sentimento principal. As escolhas do Expression Engine e do Game Master funcionam do mesmo jeito: sem um rosto chamado `scared`, o avatar mostra Fear. Os avatares 3D e de malha mostram só os seis sentimentos.

**Como o humor é lido.** O seu modelo de chat não é consultado, e o texto do seu chat nunca é enviado a um serviço externo.

- Uma lista de palavras integrada responde na hora, em qualquer lugar, e conhece palavras comuns de humor em vários idiomas.
- Nos computadores que conseguem rodá-lo, um pequeno modelo de emoções, o leitor de humor, lê as frases no lugar da lista. Ele entende 36 idiomas. Ele é baixado uma única vez, com cerca de 300 MB, na primeira vez que você abre um chat de Roleplay com o 2D Avatars ou o 3D Avatars ativado. A página de cada agente de avatar em **Agents** mostra o progresso. Um download que falha tenta de novo cerca de 10 minutos depois. A lista de palavras responde até o leitor ficar pronto, e depois disso ele funciona offline. Ele usa cerca de 1 GB de memória enquanto está em uso e é descartado da memória depois de 10 minutos sem uso. As instalações Lite, o Android e os computadores com menos de 3 GB de memória continuam com a lista de palavras.

**Rostos no Game Mode.** Cada fala que o Game Master mostra vem com uma expressão, e o avatar do personagem que fala assume essa expressão, mesmo quando uma voz lê a fala. Os pensamentos internos mudam o rosto, mas não a boca.

**Expression Engine.** Quando ele está ativado, a escolha dele depois da resposta é o rosto final dessa resposta. Uma escolha que chega depois que você mandou a próxima mensagem fica com a resposta a que se refere. Com a conversão de texto em voz, a escolha aparece quando a voz termina.

**Bocas.** Pelo texto, a boca só se mexe nos diálogos (palavras entre aspas, linhas `[Name]:` e marcações de quem fala), não na narração, mais ou menos no ritmo da fala. Se o texto aparecer mais rápido do que alguém conseguiria falar, a boca acelera e depois pula adiante. Com o streaming desligado, o diálogo de uma resposta é falado em até oito segundos. Quando a conversão de texto em voz toca uma fala, é a voz que mexe a boca.

**Corpo.** Um avatar fica pensando desde o momento em que você envia até as primeiras palavras dele, fala enquanto a boca se mexe, escuta enquanto outro fala ou você digita e fica em repouso no resto do tempo.

**Chats em grupo.** Em um grupo Individual, quem fala é o membro que está respondendo, inclusive quando você dá swipe na mensagem de um membro. Em um grupo Merged, uma marcação de quem fala dirige o diálogo e o rosto desse personagem, mesmo em um parágrafo que cita outro. Os diálogos atribuídos pelo nome também seguem quem fala. A prosa sem marcação pertence ao primeiro personagem que ela cita ou ao personagem anterior. Enquanto um parágrafo que não cita ninguém ainda está aparecendo, o diálogo dele espera até que um nome ou o fim do parágrafo mostre quem fala. Com o streaming desligado em um grupo Individual, por enquanto só a resposta do último membro mexe um avatar.

<a id="lip-sync-with-text-to-speech"></a>

## Sincronia labial com a conversão de texto em voz

Quando a conversão de texto em voz lê uma resposta de Roleplay, o avatar do personagem que fala mexe a boca com a voz. A boca abre mais nos sons altos, fecha nas pausas, fica arredondada em sons como "u" e mostra os dentes em sons como "s". Para ativá-la, configure a conversão de texto em voz como explica o guia [Configuração de Text to Speech (TTS)](../media/tts-setup.md). Depois disso, ela funciona com **Auto-play** (leitura automática) e com o botão **Speak** (falar) de uma mensagem, inclusive no layout de visual novel.

Quando a resposta é lida em voz alta com **Auto-play** ligado, a voz costuma começar alguns segundos depois que o texto aparece, então o avatar espera por ela.

- Enquanto o texto aparece, o avatar pisca e se mexe como sempre, mas a boca fica fechada e o rosto ainda não muda.
- Quando a voz começa, a boca acompanha a voz, e o rosto muda à medida que a voz chega a cada frase, a menos que o Expression Engine já tenha escolhido o rosto.
- O rosto relaxa cerca de quatro segundos depois do fim da voz. Pausas curtas entre as falas não o fazem relaxar.
- Se a voz falhar ou não começar em poucos segundos, o avatar reproduz uma vez os rostos e a boca da resposta a partir do texto. Se ela falhar mais tarde, o avatar mostra o último humor e relaxa.
- Depois de 30 segundos sem voz, o avatar para de esperar. Uma voz que começa mais tarde ainda mexe a boca.

Detalhes:

- **Quem fala.** A boca que se mexe é a do personagem cuja voz lê a fala, aquele para quem a **Voice option** (opção de voz) escolhe uma voz. A boca de cada personagem só se mexe nas próprias falas. As falas na voz do narrador e os falantes que não são personagens do chat não mexem nenhuma boca. Com **Only read dialogues** (ler só os diálogos) desligado, a narração do próprio personagem é lida na voz dele e mexe a boca dele.
- **Pausar, parar e trocar de chat.** Pausar ou parar a voz para a boca. Se você trocar de chat enquanto uma resposta é lida, os avatares de lá ficam parados. Volte enquanto a voz ainda toca, e o avatar a retoma.
- **Volume.** **Line volume** (volume da fala) muda o volume, não o quanto a boca abre.
- **Personas.** A boca de uma persona não se mexe nas suas próprias mensagens.
- **Game Mode.** Com a conversão de texto em voz e o **Auto-play** ligados, as bocas esperam a voz do próprio personagem e a acompanham. As falas sem voz mantêm a animação pelo texto. As vozes do narrador e do jogador não mexem a boca de nenhum personagem. Os pensamentos internos não são lidos em voz alta.

A sincronia labial não muda a forma como a voz toca. Marinara lê uma cópia separada de cada clipe de voz para cronometrar a boca, então a reprodução funciona como antes, inclusive no Safari e no iPhone e no iPad. Se o primeiro clipe começar antes de a cronometragem estar pronta, o texto dele mexe a boca até a cronometragem pela voz assumir. Se o seu navegador não conseguir ler um clipe, a voz continua tocando e só a boca deixa de acompanhá-la.

<a id="making-an-avatar-from-a-sprite"></a>

## Criar um avatar a partir de um sprite

Na página **2D Avatars**, escolha um personagem ou uma persona e depois use **Make an avatar from a sprite** (criar um avatar a partir de um sprite). Esse recurso trabalha com os sprites que o personagem ou a persona já tem. O seu avatar continua igual até você salvar um resultado, então você pode tentar quantas vezes quiser.

<a id="faces-from-the-avatar"></a>

### Rostos a partir do avatar

**Make faces from the avatar** (criar rostos a partir do avatar) cria rostos sem fundo, inclusive para um personagem ou uma persona que ainda não tem sprites. É preciso ter um avatar e uma conta de geração de imagens. Ele abre a mesma geração de sprites dos editores de personagem e de persona, com o avatar como referência.

1. Escolha **All faces** (todos os 29 sentimentos), **Main faces** (os seis) ou escolha os rostos você mesmo. Cada sentimento extra fica na linha do rosto principal dele até ter um rosto próprio.
2. Os rostos são desenhados em lotes, primeiro os principais. Os modelos GPT Image mais antigos desenham um rosto por imagem. Uma imagem que falha é tentada mais uma vez. Se falhar de novo, a execução para com **Retry picture** (tentar a imagem novamente). **Cancel** (cancelar) mantém os rostos já criados.
3. Com **Expose media prompts before sending** (mostrar os prompts de mídia antes de enviar) ligado, você revisa todos os prompts de uma vez antes de o primeiro ser enviado. Todo rosto é desenhado com os olhos abertos e a boca fechada, para que as imagens de piscada e de fala tenham o que fechar e abrir.
4. Marinara desenha os rostos sobre uma cor lisa, remove essa cor e os salva como sprites do personagem ou da persona. Um sprite novo substitui o que tem o mesmo nome, então renomeie-o no último passo para manter o antigo.

Quando o avatar já está salvo, cada rosto novo vira o rosto do sentimento para o qual foi desenhado, mesmo que tenha sido renomeado. Os outros sprites continuam. Um rosto refeito começa sem imagens de piscada e de fala, porque as antigas não combinariam com ele. Crie novas em [Imagens de piscada e de fala](#blink-and-talk-pictures). Uma importação do PNGTuber Plus mantém os próprios rostos.

<a id="blink-and-talk-pictures"></a>

### Imagens de piscada e de fala

Cada rosto que o avatar mostra para um sentimento é uma linha, com as imagens **Eyes closed** (olhos fechados) e **Mouth open** (boca aberta) dele ao lado do **Face** (rosto). Elas são imagens que você salvou, sprites `_blink` e `_talk` que você adicionou ou imagens novas. Com sprites de retrato, só eles são usados, porque um avatar nunca mistura rostos de retrato e de corpo inteiro. Um rosto que não é um dos seus sprites, como um que veio de uma importação do PNGTuber Plus, mostra as imagens dele, mas não pode receber imagens novas.

1. Confira **Image model** (modelo de imagem); a sua conta de imagem padrão já vem escolhida.
2. Clique em **Make** (criar) para uma imagem que falta, ou no botão **Make N pictures** (criar N imagens) para todas. Cada imagem é uma solicitação de imagem. Com **Expose media prompts before sending** ligado (nas configurações), você vê e edita cada prompt antes.
3. As imagens novas aparecem uma de cada vez. Selecione **Keep** (manter) nas que ficaram boas e **Try again** (tentar de novo) nas outras. **Try again** também redesenha uma imagem que você já tem. A imagem que está sendo redesenhada fica esmaecida, com um indicador de carregamento. **Cancel** interrompe a criação, também no servidor. Se **Try again** falhar, a imagem antiga fica. Para refazer uma imagem mantida, selecione **Kept** (mantida) para liberá-la antes.
4. Selecione **Save kept pictures** (salvar as imagens mantidas). Elas viram as imagens de piscada e de fala do avatar, ao lado de uma cópia do sprite a partir do qual foram desenhadas, para ficarem sempre alinhadas. Se você substituir um sprite antes de salvar, crie as imagens dele de novo.

Com uma conta de imagem que aceita uma imagem de referência, o seu sprite é a única referência, no tamanho e no formato que o modelo aceita, com um prompt que pede para mudar só os olhos ou a boca. Os modelos movem, redimensionam ou acrescentam margens à imagem que devolvem, então ela primeiro é alinhada com o seu sprite. Só os olhos (para a piscada) ou a boca (para a fala) são aproveitados dela. Todo o resto continua com os pixels do próprio sprite, então o avatar não dá um salto. Se os olhos não fecharam, a boca não abriu ou a imagem ficou deslocada demais para ser alinhada, a imagem falha com uma mensagem. Tente de novo.

Algumas contas não conseguem editar imagens, como Pollinations, Together AI, Horde, DALL-E ou um fluxo de trabalho do ComfyUI sem espaço para referência. Com uma delas, **Make** desenha um rosto novo junto com as imagens de piscada e de fala dele em uma única imagem, para que as três combinem, como faz [Rostos a partir do avatar](#faces-from-the-avatar). A linha mostra **New face** (rosto novo). **Keep** mantém o rosto e as duas imagens juntos, e ao salvar, o rosto novo vira o rosto daquele sentimento. O seu sprite não muda. Isso exige uma aparência ou uma descrição no personagem ou na persona.

<a id="mesh-avatar"></a>

### Avatar de malha

1. Escolha um **Sprite to use** (sprite a usar). O sprite neutro de corpo inteiro já vem escolhido quando existe. Um sprite de frente, de corpo inteiro ou de busto, funciona melhor.
2. Escolha o **Chat provider that can see pictures** (provedor de chat que enxerga imagens). **The agent's provider** (o provedor do agente) usa o que está definido na página do 2D Avatars e, se não houver, a sua conta padrão de agentes. O modelo dele precisa aceitar imagens.
3. Selecione **Make mesh avatar** (criar avatar de malha). O modelo de chat encontra o rosto, e Marinara monta o avatar a partir do seu sprite como ele é. **Cancel** interrompe a criação.
4. Confira a pré-visualização: os contornos devem ficar sobre os olhos, as sobrancelhas e a boca. Selecione **Save as mesh avatar** (salvar como avatar de malha), ou **Discard** (descartar) e tente outro sprite ou outro modelo.

Um avatar de malha gerado mexe a cabeça, os olhos, as sobrancelhas e a boca, e pisca e fala com as próprias pálpebras e a própria boca. O cabelo se mexe junto com a cabeça. As mãos, as mechas soltas de cabelo e os acessórios pendurados não são articulados. Os sprites pequenos são montados a partir de uma cópia maior, para que a boca se encaixe no rosto. Quando o rosto ocupa a maior parte de um sprite grande, uma cópia menor é usada para a criação continuar rápida.

O seu sprite vai para a conta de imagem para as imagens de piscada e de fala (e para a conta de imagem de reserva dela, se houver uma definida e se ela aceitar uma referência), e para o modelo de chat para um avatar de malha. Uma conta que não consegue editar imagens recebe só o prompt, que inclui a aparência. Os prompts vêm com o agente 2D Avatars. Com **Expose media prompts before sending** ligado, você pode ler e mudar cada prompt. Com o modo de depuração ligado, todo prompt é gravado no log do servidor.

## Faça o seu próprio modelo

Um personagem ou uma persona pode usar os seus sprites de expressão como avatar PNGTuber sem desenhar nada. [Criar um avatar a partir de um sprite](#making-an-avatar-from-a-sprite) acrescenta imagens de piscada e de fala ou monta um avatar de malha para você. Para fazer o seu próprio modelo, use uma destas ferramentas. Importe todo arquivo na página do agente em **Agents** e ligue **Show this avatar in chats**.

| O que você quer | Ferramenta | O que você recebe |
| --- | --- | --- |
| Sprites PNGTuber | Qualquer aplicativo de desenho e depois a aba **Sprites** do personagem | Os sprites |
| Sprites PNGTuber com camadas e figurinos | [PNGTuber Plus](https://github.com/kaiakairos/PNGTuber-Plus) | Um arquivo `.save` |
| Um avatar de malha | [Mesh Avatar Studio](https://github.com/shinshin86/mesh-avatar-studio) | Um arquivo `.mavatar` |
| Um modelo 3D | [VRoid Studio](https://vroid.com/en/studio) ou o Blender com o [VRM Add-on for Blender](https://vrm-addon-for-blender.info/en-us/) | Um arquivo `.vrm` e, se quiser, uma animação de espera `.vrma` |

### Os seus próprios sprites

1. Desenhe uma imagem para cada sentimento, todas do mesmo tamanho e com o personagem no mesmo lugar. Dê a cada imagem o nome do sentimento dela: `neutral`, `happy`, `angry`, `sad`, `relaxed`, `surprised`. Nomes que contêm uma palavra de sentimento também funcionam, como `smile`, `cry`, `calm` ou `shock`. Para os [sentimentos extras](#pngtuber-sprites) opcionais, dê às imagens nomes como `amusement`, `fear` ou `gratitude`.
2. Para a boca se mexer, desenhe a mesma imagem com a boca aberta e acrescente `_talk`, por exemplo `happy_talk`. Para piscar, feche os olhos e acrescente `_blink`. Com os dois, acrescente `_blink_talk`.
3. Adicione as imagens na aba **Sprites**, em **Facial Expressions** (expressões faciais). O nome de cada arquivo vira o nome do sprite correspondente. Veja [Sprites de personagem](../characters/sprites.md#upload-your-own-sprites).
4. Abra **2D Avatars** em **Agents**, escolha o personagem ou a persona e ligue **Show this avatar in chats**.

### PNGTuber Plus

1. Monte o avatar com camadas separadas. Mostre a boca aberta só enquanto ele fala e a boca fechada só em silêncio. Mostre os olhos fechados só enquanto ele pisca e os olhos abertos só quando ele não está piscando.
2. Para cada sentimento, crie um figurino que troque os olhos ou a boca, e dê a essas imagens o nome do sentimento, por exemplo `angry eyes.png` ou `happy_mouth.png`. Os sentimentos específicos funcionam do mesmo jeito, como `fear eyes.png`. O figurino 1 é o rosto em repouso.
3. Salve o avatar para obter um arquivo `.save`.
4. Abra **2D Avatars** em **Agents**, escolha o personagem ou a persona e depois **PNGTuber sprites** e **Import PNGTuber Plus save**. Escolha um rosto para qualquer sentimento que os nomes não cobriram.

### Mesh Avatar Studio

1. Comece com uma imagem de frente, da cabeça e dos ombros, com fundo transparente. O Mesh Avatar Studio roda no seu computador com Node.js, e um agente de programação, como o Claude Code ou o Codex, prepara a imagem para se mexer. O README dele explica o passo a passo.
2. Opcional: adicione olhos e bocas desenhados em **Drawn variants**. Marinara usa os formatos de boca `mouth_a`, `mouth_i`, `mouth_o` e `mouth_a_half` e os olhos fechados `eyes_closed_0` e `eyes_closed_1`. Todo avatar de malha já tem os seis sentimentos embutidos, então não há nada para nomear.
3. Escolha **Export .mavatar**. Não compacte a pasta do projeto em ZIP você mesmo.
4. Abra **2D Avatars** em **Agents**, escolha o personagem ou a persona e depois **Mesh avatar** e **Import .mavatar file**.

### VRoid Studio

1. Crie o personagem no VRoid Studio. Os rostos, os formatos de boca e a piscada dele são expressões VRM padrão e são encontrados automaticamente.
2. Exporte como VRM (1.0 ou 0.0). Preencha os detalhes e os termos do modelo quando for pedido.
3. Abra **3D Avatars** em **Agents**, escolha o personagem ou a persona e selecione **Import VRM**.

<a id="blender-with-the-vrm-add-on-for-blender"></a>

### Blender com o VRM Add-on for Blender

1. Instale o VRM Add-on for Blender em **Get Extensions**, nas **Preferences** do Blender. No Blender anterior à 4.2, instale o arquivo ZIP do add-on em **Add-ons**.
2. Dê ao modelo um esqueleto humanoide (armature) e atribua os ossos VRM dele. O add-on pode atribuí-los automaticamente.
3. Configure as expressões no painel VRM do add-on: **Expressions** para VRM 1.0 ou **VRM 0.x Blend Shape Proxy** para VRM 0.x. Cada uma precisa mexer uma shape key ou um material: uma expressão vazia não muda nada, então a importação só a usa para Neutral. Expressões personalizadas com um nome claro, como `Smile` ou `Shock`, também são associadas.
   - Rostos: **Happy**, **Angry**, **Sad**, **Relaxed** e **Surprised**. O VRM 0.x chama os quatro primeiros de **Joy**, **Angry**, **Sorrow** e **Fun** e não tem um preset de surpresa, então adicione uma expressão personalizada chamada `Surprised`.
   - Formatos de boca: **Aa**, **Ih**, **Ou**, **Ee** e **Oh** (**A**, **I**, **U**, **E** e **O** no VRM 0.x).
   - Piscada: **Blink**.
4. Exporte com **File → Export → VRM (.vrm)**. Para uma animação de espera, anime o esqueleto e use **File → Export → VRM Animation (.vrma)**. O add-on só exporta uma animação a partir de um modelo definido como VRM 1.0, então escolha VRM 1.0 no passo 3 se quiser uma.
5. Abra **3D Avatars** em **Agents**, escolha o personagem ou a persona e selecione **Import VRM**. Adicione a animação com **Add animation** (adicionar animação) em **Idle animation**.

### O que evitar ao exportar

- **Compressão.** A compressão Draco ou meshopt e as texturas KTX2 não carregam. As exportações VRM acima nunca usam esses recursos, mas a exportação glTF comum do Blender oferece Draco, e otimizadores de modelo podem acrescentar os três. Exporte de novo com a compressão desligada.
- **glTF comum.** Um `.glb` comum não tem os dados VRM que nomeiam os rostos e o esqueleto. Importe-o como **GLB or FBX model** ou exporte um `.vrm`.
- **Arquivos separados.** Um modelo cujas texturas ou dados ficam em arquivos separados não pode ser usado. Exporte um único arquivo `.vrm`.
- **Extras do PNGTuber Plus.** O balanço, o arrasto e a animação não são trazidos. Cada camada aparece em repouso, e uma camada animada mostra o primeiro quadro.

## Desempenho e dispositivos

O código de desenho de cada tipo de avatar só é baixado na primeira vez que um avatar desse tipo aparece, então os chats sem avatares não carregam nada a mais.

| | Celulares | Computadores |
| --- | --- | --- |
| Avatares desenhados ao mesmo tempo | Sem limite fixo | Sem limite fixo |
| Quadros por segundo enquanto fala | 30 | 30 |
| Quadros por segundo em repouso | 20, ou 15 quando o celular está ocupado | 30 |
| Nitidez (proporção de pixels) | até 1,5× | até 2× |

Um chat mostra todos os avatares configurados e ligados na ordem dos personagens dele e depois a sua persona. Ajuste o tamanho e a posição do elenco à sua tela. Os avatares param de ser desenhados enquanto a aba está oculta, a janela está em segundo plano, as configurações de aparência estão abertas ou o chat está fora da tela ou coberto por um painel ou editor. Com **Reduce Ambient Animations & Effects** (reduzir animações e efeitos de ambiente) ou a redução de movimento do seu dispositivo ligada, os avatares ainda mudam de rosto e mexem a boca, mas deixam de respirar, de balançar e de fazer as poses de espera.

## Guias relacionados

- [Agentes: ajudantes de IA para os seus chats](agents-overview.md)
- [Referência dos agentes para download](built-in-agents.md)
