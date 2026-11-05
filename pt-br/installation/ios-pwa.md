# Guia do PWA para iOS / iPadOS

Use Marinara Engine no iPhone ou no iPad. A Apple não deixa o servidor do Marinara rodar nesses dispositivos, então você abre no Safari um servidor que roda em outro dispositivo. Depois, você pode salvá-lo na Tela de Início como um PWA. Um PWA (Progressive Web App) é um site que abre na própria janela, como um aplicativo.

## Caminho rápido

1. Instale e inicie Marinara em um computador, em um servidor doméstico ou em um celular Android (veja a lista abaixo). Deixe-o rodando.
2. Defina um login nesse computador. Veja [Acesso remoto](../REMOTE_ACCESS.md#option-1-login-recommended).
3. Descubra o endereço IP do computador (veja abaixo).
4. No iPhone ou no iPad, abra o **Safari** e vá para `http://` seguido desse endereço IP e de `:7860`.

Não use `127.0.0.1` no iPhone ou no iPad. Esse endereço significa o próprio iPhone.

## Onde o servidor roda

O servidor pode rodar em:

- Um PC com Windows: [Guia de instalação no Windows](windows.md).
- Um Mac ou um computador Linux: [Guia de instalação no macOS / Linux](macos-linux.md).
- Um celular Android com Termux: [Guia de instalação no Android (Termux)](android-termux.md).
- Um contêiner Docker ou Podman: [Rodar em contêiner](containers.md).

## Conectar pelo Safari

Antes de começar: o servidor precisa estar rodando e deixar o seu dispositivo entrar, normalmente com um login. Veja [Acesso remoto](../REMOTE_ACCESS.md).

1. Coloque o dispositivo servidor e o iPhone ou iPad na mesma rede, como o Wi-Fi de casa. Para se conectar de outro lugar, use o Tailscale, uma ferramenta gratuita que liga os seus dispositivos em uma rede privada pela internet.
2. Descubra o endereço IP do dispositivo servidor. No computador servidor, execute um comando em um terminal (uma janela onde você digita comandos) e leia o endereço, que se parece com `192.168.1.42`.

   - Windows (Prompt de Comando): `ipconfig`. Leia o **IPv4 Address** (endereço IPv4).
   - Linux: `hostname -I`.
   - macOS: `ipconfig getifaddr en0`.

3. Abra o **Safari** e vá para este endereço. Troque `<host-ip>` por esse endereço IP. A porta padrão é `7860`.

```text
http://<host-ip>:7860
```

4. A tela inicial do Marinara carrega.

Se aparecer uma página de login, entre com o nome de usuário e a senha do servidor. Se aparecer uma página de configuração, digite o código de configuração de uso único do log do servidor e escolha um nome de usuário e uma senha. Veja [Acesso remoto](../REMOTE_ACCESS.md).

Se não funcionou: confira se o servidor continua rodando e se os dois dispositivos estão na mesma rede ou no mesmo Tailscale. Confira o endereço IP e a porta. Veja [Solução de problemas do Marinara Engine](../TROUBLESHOOTING.md).

## Adicionar à Tela de Início

1. Abra o seu servidor do Marinara no **Safari**.
2. Toque no botão de compartilhamento, o ícone quadrado com uma seta para cima.
3. Role a folha de compartilhamento para baixo e toque em **Add to Home Screen** (adicionar à Tela de Início).
4. Mude o nome se quiser e depois toque em **Add** (adicionar).

Um ícone do Marinara aparece na Tela de Início. Toque nele para abrir Marinara na própria janela, sem a barra de endereços do Safari.

## Use HTTPS se o aplicativo se comportar mal

Um PWA funciona melhor em HTTPS, uma conexão segura que começa com `https://`. Um endereço `http://` simples funciona no Safari. Algumas versões do iOS e do iPadOS limitam um aplicativo da Tela de Início em um endereço `http://` simples. Se isso acontecer, sirva Marinara por HTTPS, ou deixe o endereço como favorito do Safari.

O Tailscale sozinho não transforma um endereço em HTTPS. Use uma configuração do Tailscale que sirva HTTPS, ou peça ao dono do servidor para colocar Marinara atrás de HTTPS. Veja [Acesso remoto](../REMOTE_ACCESS.md#serving-over-https).

<a id="clearing-and-reinstalling-the-pwa"></a>

## Como limpar e reinstalar o PWA

Às vezes o Safari mantém uma versão antiga do aplicativo, ou o aplicativo salvo trava. Reinstalar costuma resolver. Os seus chats, personagens e configurações ficam no servidor, então reinstalar não os exclui.

1. Toque e segure o ícone do Marinara na Tela de Início.
2. Toque na opção de remover o aplicativo e confirme.
3. Abra o aplicativo **Settings** (Ajustes) no iPhone ou no iPad.
4. Toque em **Safari**. Em versões mais novas do iOS e do iPadOS, ele pode estar em **Apps** e depois **Safari**.
5. Toque em **Advanced** (avançado) e depois em **Website Data** (dados de sites).
6. Procure a entrada do endereço do seu Marinara. Se ela não aparecer, toque em **Show All Sites** (mostrar todos os sites).
7. Deslize a entrada para a esquerda e toque em **Delete** (apagar).
8. Abra Marinara de novo no **Safari** e adicione-o outra vez à Tela de Início, seguindo os passos acima.

## Solução de problemas

**A página não carrega no Safari.** Confira se o servidor está rodando, se os dois dispositivos estão na mesma rede ou no mesmo Tailscale e se o endereço IP e a porta `7860` estão certos. Veja [Acesso remoto](../REMOTE_ACCESS.md) e [Solução de problemas do Marinara Engine](../TROUBLESHOOTING.md).

**O Safari mostra uma página de login ou de configuração depois de uma atualização.**

- Entre em `/login` com o nome de usuário e a senha do servidor.
- Se não houver login, digite na página de configuração o código de configuração de uso único do log do servidor.
- Se o servidor não mostrar nenhum código, defina o login no dispositivo servidor em **Settings → Advanced → Access** (Configurações → Avançado → Acesso).
- Um **403** pode significar que o seu iPhone não está em `IP_ALLOWLIST`. Quem altera essa lista é o dono do servidor.
- O PWA não consegue redefinir o login do servidor. O dono do servidor executa `node scripts/reset-login.mjs` na pasta do Marinara, no servidor (no Docker: `docker exec <container> node scripts/reset-login.mjs`), ou altera um login definido no `.env`.

Veja [Bloqueado depois de atualizar](../REMOTE_ACCESS.md#locked-out-after-updating).

**O Safari continua mostrando uma compilação antiga.** Recarregue a página. Se ela ainda parecer antiga, reinstale o PWA com os passos acima.

**O aplicativo da Tela de Início fecha ou fica em branco durante a geração.** Abra-o de novo e volte ao chat. Um servidor saudável continua trabalhando: as respostas do chat e as solicitações de imagem do Illustrator continuam rodando no servidor, e o chat reaberto se atualiza quando elas terminam. **Stop** (parar) continua cancelando a geração no chat selecionado. Se a tela em branco continuar voltando, informe o problema junto com os seus Support Diagnostics.

**Uma faixa vermelha avisa que os salvamentos vão falhar em silêncio.** Esse é um aviso de confiança de rede vindo do servidor, e não um problema do seu iPhone ou iPad. O dono do servidor precisa confiar no seu endereço. Veja [Acesso remoto](../REMOTE_ACCESS.md#why-is-my-save-blocked-csrf).

**As ações privilegiadas estão bloqueadas.** Algumas ações de manutenção precisam do segredo de administrador (uma segunda senha), que vem do dono do servidor. Salve-o no iPhone ou no iPad em **Settings → Advanced → Admin Access**. Veja [Acesso remoto](../REMOTE_ACCESS.md#admin-access-and-privileged-actions).

## Guias relacionados

- [Acesso remoto: login e lista de IPs permitidos](../REMOTE_ACCESS.md)
- [Perguntas frequentes](../FAQ.md)
- [Solução de problemas do Marinara Engine](../TROUBLESHOOTING.md)
- [Guia de instalação no Android (Termux)](android-termux.md)
