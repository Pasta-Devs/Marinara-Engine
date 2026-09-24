# Guia do PWA para iOS / iPadOS

Neste guia você aprende a usar Marinara Engine no iPhone ou no iPad. iOS e iPadOS não conseguem rodar o servidor do Marinara. Em vez disso, você se conecta a um servidor que roda em outro dispositivo e salva o endereço na Tela de Início como um aplicativo web.

## No iOS, o servidor roda em outro dispositivo

Marinara Engine tem duas partes: um servidor, que faz o trabalho pesado, e um aplicativo web, que você abre no navegador. No iPhone e no iPad, a Apple não deixa o servidor rodar no próprio dispositivo. Então o servidor fica em outro lugar e você o abre pelo Safari do iPhone ou do iPad.

O servidor pode rodar em qualquer uma destas máquinas:

- Um PC com Windows (veja o [Guia de instalação no Windows](windows.md)).
- Um Mac ou uma máquina Linux (veja o [Guia de instalação no macOS / Linux](macos-linux.md)).
- Um celular Android com Termux (veja o [Guia de instalação no Android (Termux)](android-termux.md)).
- Um contêiner Docker ou Podman (veja [Rodar em contêiner](containers.md)).

O iPhone ou o iPad chega até esse servidor pela rede. A ideia é a mesma de abrir qualquer site, só que o site é o seu próprio servidor do Marinara.

## Conectar pelo Safari

Siga estes passos com o servidor já rodando no dispositivo anfitrião.

1. Verifique se o dispositivo anfitrião e o iPhone ou iPad estão na mesma rede, ou os dois na mesma rede Tailscale. LAN é a sua rede local, como o Wi-Fi de casa. Tailscale é uma ferramenta gratuita que liga os seus dispositivos em uma rede privada pela internet.
2. Descubra o endereço do servidor anfitrião. Ele se parece com o exemplo abaixo. Troque `<host-ip>` pelo endereço IP do dispositivo anfitrião na LAN ou no Tailscale. A porta padrão é `7860`.

```
http://<host-ip>:7860
```

3. Abra o **Safari** no iPhone ou no iPad.
4. Digite esse endereço na barra de endereços do Safari e acesse.
5. A tela inicial do Marinara deve carregar no navegador.

Se a página não carregar, ou se aparecer um pedido de senha, veja a seção Solução de problemas mais abaixo. Quem controla o acesso pela rede e as senhas é o dono do servidor. Essas configurações do servidor estão no guia [Acesso remoto](../REMOTE_ACCESS.md), não no iPhone nem no iPad.

## Adicionar à Tela de Início

Marinara pode ser salvo como um PWA e abrir feito um aplicativo comum. PWA quer dizer Progressive Web App: um site que roda na própria janela, com um ícone próprio na Tela de Início.

1. Abra o seu servidor do Marinara no **Safari** (veja os passos acima).
2. Toque no botão de compartilhamento. É o ícone quadrado com uma seta para cima.
3. Role a folha de compartilhamento e toque em **Add to Home Screen** (adicionar à Tela de Início).
4. Mude o nome se quiser e toque em **Add**.
5. Agora deve aparecer um ícone do Marinara na Tela de Início.

Toque nesse ícone para abrir Marinara na própria janela, sem a barra de endereços do Safari.

## Observação sobre HTTPS

O PWA funciona de forma mais confiável em HTTPS. HTTPS é uma conexão web segura e criptografada, indicada pelo `https://` no começo do endereço.

O HTTP simples pela LAN continua funcionando no Safari para o uso normal. Só que algumas versões do iOS e do iPadOS limitam o comportamento do PWA em janela própria quando o endereço é `http://`. Se isso acontecer, sirva Marinara por HTTPS.

O Tailscale dá a cada dispositivo um endereço privado estável e melhora o alcance, mas sozinho ele não transforma um endereço `http://` em HTTPS. Use uma configuração do Tailscale que sirva HTTPS de forma explícita, ou peça ao dono do servidor para colocar Marinara atrás de HTTPS.

Essas opções estão explicadas no guia [Acesso remoto](../REMOTE_ACCESS.md). Se o endereço HTTP simples der problema como aplicativo da Tela de Início, deixe o endereço apenas como favorito do Safari.

## Limpar e reinstalar o PWA

Às vezes o Safari insiste em mostrar uma versão antiga do aplicativo, ou o aplicativo web salvo trava. Reinstalar o aplicativo da Tela de Início costuma resolver.

1. Toque e segure o ícone do Marinara na Tela de Início.
2. Toque na opção de remover ou excluir o aplicativo e confirme.
3. Abra o aplicativo **Settings** (Configurações) no iPhone ou no iPad.
4. Toque em **Safari**. Em versões mais novas do iOS e do iPadOS, ele pode estar em **Apps** e depois **Safari**.
5. Toque em **Advanced** e depois em **Website Data**.
6. Procure a entrada do endereço do seu servidor do Marinara. Se ela não aparecer, toque em **Show All Sites**.
7. Deslize essa entrada para a esquerda e toque em **Delete**. Isso remove os arquivos antigos salvos daquele servidor.
8. Abra Marinara de novo no **Safari**, seguindo os passos da seção Conectar pelo Safari.
9. Adicione o endereço à Tela de Início outra vez, seguindo os passos da seção Adicionar à Tela de Início.

Os chats, os personagens e as configurações ficam guardados no servidor, não no iPhone nem no iPad. Reinstalar o aplicativo da Tela de Início não exclui nada disso.

## Solução de problemas

**A página não carrega no Safari.** Confira se o servidor continua rodando no dispositivo anfitrião. Confira se os dois dispositivos estão na mesma rede ou no mesmo Tailscale. Confirme se o endereço IP e a porta `7860` estão certos. Para uma ajuda mais a fundo com a rede, veja o guia [Acesso remoto](../REMOTE_ACCESS.md) e a [Solução de problemas do Marinara Engine](../TROUBLESHOOTING.md).

**O Safari pede nome de usuário e senha.** O dono do servidor ativou a proteção por senha para dispositivos remotos. Peça o nome de usuário e a senha a quem cuida do servidor. Essa configuração está no guia [Acesso remoto](../REMOTE_ACCESS.md).

**O Safari continua mostrando uma versão antiga.** Recarregue a página primeiro. Se ela ainda parecer antiga, siga os passos da seção Limpar e reinstalar o PWA, acima.

**O aplicativo da Tela de Início fecha ou fica em branco durante a geração.** Abra novamente e volte ao chat. Não é preciso reiniciar um servidor saudável. Respostas automáticas e solicitações de imagem manuais ou repetidas exclusivas do Illustrator continuam no servidor após perder a conexão do navegador. O chat reaberto verifica trabalho pendente e atualiza mensagens salvas e imagens da galeria ao terminar. **Stop** continua cancelando a geração do chat selecionado. Se a tela branca voltar, informe seus Support Diagnostics e se reabrir restaura o chat; essa recuperação não diagnostica nem impede todas as falhas do navegador iOS.

**Uma faixa vermelha avisa que os saves vão falhar em silêncio.** Esse é um aviso de confiança de rede vindo do servidor, não um problema do iPhone ou do iPad. O dono do servidor precisa marcar o seu endereço como confiável. Veja o guia [Acesso remoto](../REMOTE_ACCESS.md) e a [Solução de problemas do Marinara Engine](../TROUBLESHOOTING.md).

**As ações privilegiadas estão bloqueadas.** Algumas ações de manutenção exigem um segredo de administrador, que vem do dono do servidor. No iPhone ou no iPad, esse valor é salvo em **Settings**, depois **Advanced**, depois **Admin Access**. O guia [Acesso remoto](../REMOTE_ACCESS.md) explica o que é esse segredo de administrador e como consegui-lo.

## Guias relacionados

- [Acesso remoto: Basic Auth e lista de IPs permitidos](../REMOTE_ACCESS.md)
- [Perguntas frequentes](../FAQ.md)
- [Solução de problemas do Marinara Engine](../TROUBLESHOOTING.md)
- [Guia de instalação no Android (Termux)](android-termux.md)
