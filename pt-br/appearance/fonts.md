# Fontes personalizadas e Google Fonts

Troque a fonte que Marinara usa em todo o aplicativo. Escolha a fonte que já vem com ele, adicione arquivos de fonte próprios ou baixe uma fonte do Google Fonts pelo nome.

## Como escolher a fonte do aplicativo

1. Abra **Settings** (Configurações) e clique na aba **Appearance** (aparência). Depois clique no botão **App** (aplicativo).
2. Localize a seção **Text & Scale** (texto e escala).
3. Abra o menu suspenso **Font** (fonte) e escolha uma fonte.

O jeito mais fácil de conseguir uma fonte nova é o [Google Fonts](#downloading-from-google-fonts). O padrão é **Default (Inter)**, uma fonte limpa, escolhida para leitura na tela. As fontes que você adiciona aparecem no mesmo menu suspenso, abaixo dela.

A fonte escolhida é sincronizada entre os dispositivos. Todo navegador conectado ao mesmo servidor Marinara passa a usá-la. Veja [Visão geral das configurações](../settings/settings-overview.md).

Os widgets do chat têm uma opção **Font** própria em **Chat widget style** (estilo dos widgets do chat). Ative **Apply preset font** (aplicar fonte do preset) ali para usá-la também nas mensagens, nos campos de entrada e nos controles do chat. Veja [Estilos prontos para janelas de chat](custom-css-themes.md#ready-made-chat-window-styles).

## Como adicionar fontes próprias

Antes de começar: as fontes ficam em uma pasta no servidor. O servidor é o computador que executa Marinara. Se você roda Marinara no seu próprio computador, ele é o servidor, e a pasta de dados é onde Marinara guarda os seus dados.

1. Clique em **Open Fonts Folder** (abrir a pasta de fontes), ao lado do menu suspenso **Font**, para abrir `data/fonts/` no servidor. Ou localize por conta própria a pasta `data/fonts/` dentro da pasta de dados do Marinara.
2. Copie o arquivo de fonte para ela.
3. Vá para **Settings → Appearance → App → Text & Scale**.
4. Abra o menu suspenso **Font**. A sua fonte está na lista.
5. Selecione-a. O texto do aplicativo muda na hora.

Marinara lê arquivos `.ttf`, `.otf`, `.woff` e `.woff2` e ignora outros tipos. O nome de exibição é montado a partir do nome do arquivo, então `OpenSans-Bold.ttf` aparece como "Open Sans". Dê nomes claros aos arquivos para manter a lista organizada.

Todo dispositivo que se conecta ao mesmo servidor pode usar as fontes de `data/fonts/`.

Se não funcionou: confira o tipo do arquivo e se ele está em `data/fonts/` no servidor, não no dispositivo pelo qual você está acessando.

<a id="downloading-from-google-fonts"></a>

## Como baixar do Google Fonts

O servidor precisa de acesso à internet para isso.

1. Vá para **Settings → Appearance → App → Text & Scale**.
2. No campo **Google Fonts**, digite o nome exato da fonte, por exemplo `Fira Code` ou `Lora`.
3. Clique em **Add** (adicionar).
4. Aguarde o download. A fonte então aparece no menu suspenso **Font**.

O link **Browse fonts at fonts.google.com →**, ao lado do campo, abre o site do Google Fonts para você consultar os nomes. O nome aceita apenas letras, números e espaços. Baixar a mesma fonte de novo substitui a cópia antiga.

Se não funcionou, leia a mensagem de erro.

- Se Marinara não conseguir alcançar o Google Fonts, verifique a sua conexão com a internet.
- Se a mensagem disser que a fonte não foi encontrada, confira a grafia e veja no site do Google Fonts se a fonte tem o estilo Regular (400). Marinara baixa só esse peso.

## O botão Open Fonts Folder

O botão **Open Fonts Folder**, ao lado do menu suspenso **Font**, abre `data/fonts/` no explorador de arquivos do computador do servidor, não no dispositivo que você está usando. Se você roda Marinara no seu próprio computador, ele abre a pasta para você. De um celular ou de um segundo computador, copie por conta própria os arquivos de fonte para a pasta `data/fonts/` do servidor.

Enquanto a fonte padrão está selecionada, os campos de prompt do editor de presets e o Example Dialogue de um personagem usam uma fonte monoespaçada. Qualquer outra fonte também vale para eles. Os outros campos de prompt, como o modelo de prompt de um agente, continuam monoespaçados.

## Guias relacionados

- [Configurações de aparência](appearance-settings.md)
