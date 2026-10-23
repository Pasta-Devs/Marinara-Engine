# Área segura inferior no PWA do iOS (desenvolvedores)

Este guia para desenvolvedores explica uma faixa colorida que pode aparecer na parte de baixo da tela. Ela surge quando Marinara Engine roda como aplicativo na tela de início do iPhone. Aqui você vê a correção que Marinara adota, o preço que essa correção cobra e como diagnosticar a faixa se alguma mudança futura trouxer o problema de volta.

Um PWA (Progressive Web App) é um site que o usuário instala na tela de início e abre como se fosse um aplicativo nativo. Este material é de nível de código, voltado a quem contribui com o projeto, e não um guia para o usuário final.

## O problema

Nos iPhones com indicador de início (modelos com Face ID), a parte de baixo da tela é uma área segura reservada para o gesto de voltar ao início. O iOS trata essa faixa como algo em torno de 34px de altura. É o valor da variável CSS `env(safe-area-inset-bottom)`.

Quando o estilo da barra de status do PWA é `black-translucent`, o iOS impede que qualquer elemento com `position: fixed` pinte dentro dessa faixa. Todas as alternativas em CSS falham. O WebKit limita deslocamentos negativos na base, `calc(100dvh + env(safe-area-inset-bottom))` e sobrescritas de altura negativa.

O resultado é uma faixa visível abaixo da caixa de entrada do chat. Essa faixa, muitas vezes chamada de "chin" (queixo), fica com uma cor diferente do resto da interface.

## A correção que Marinara traz

Marinara define o estilo da barra de status como `black`, em vez de `black-translucent`. A meta tag fica no arquivo `packages/client/index.html`.

```html
<meta name="apple-mobile-web-app-status-bar-style" content="black" />
```

A meta tag de viewport mantém `viewport-fit=cover` e o comportamento padrão do teclado.

```html
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />
```

No modo `black`, o iOS não trava a faixa de baixo. O app shell (o contêiner que envolve todo o aplicativo) usa `fixed inset-0`, sem sobrescrever a altura da viewport, então ele pinta até o fim, dentro da área segura. O className do app shell, no arquivo `packages/client/src/components/layout/AppShell.tsx`, é:

```
mari-app mari-app-background-paint fixed inset-0 flex overflow-hidden
```

Não acrescente `interactive-widget=resizes-content` à meta tag de viewport. Em PWAs no celular, isso pode redimensionar todo o app shell do chat enquanto o teclado anima e deixar a rolagem das mensagens cortada.

## O preço da escolha

Não é possível ter ao mesmo tempo uma barra de status translúcida e a base preenchida. No modo `black`, a barra de status é uma barra escura sólida. O `black-translucent` deixa o topo transparente, mais bonito, mas torna impossível remover a faixa de baixo. Essa é uma limitação rígida do iOS.

<a id="landscape-the-cameras-side-insets"></a>

## Paisagem: margens laterais da câmera

Quando um iPhone é virado de lado, sua câmera (o recorte ou Dynamic Island) fica na borda esquerda ou direita. Com `viewport-fit=cover`, a página se estende por baixo dela, e o iOS informa esse espaço como `env(safe-area-inset-left)` e `env(safe-area-inset-right)`. Nos modelos com Dynamic Island, são cerca de 59px de cada lado, independentemente do sentido da rotação. O aplicativo Android do Marinara (SDK de destino 34, sem layout de ponta a ponta) fica fora do recorte, portanto as duas margens são 0. Outros navegadores Android podem informar margens diferentes de zero, por exemplo em tela cheia ou de ponta a ponta, e as mesmas variáveis cobrem esses casos.

O Marinara evita esse espaço da mesma forma que a faixa da barra de status em retrato:

- `packages/client/src/styles/globals.css` lê as duas margens uma vez e as coloca em `--mari-safe-area-inset-left` e `--mari-safe-area-inset-right`, em `:root`. Todo o restante lê essas variáveis, nunca `env()` diretamente. `scripts/regressions/mobile-safe-area-inset.regression.ts` garante essa regra. As caixas de diálogo, a omnibar, os editores de tela cheia e os controles da TopBar mantêm essa proteção contra a câmera e os cantos arredondados.
- No iPhone, `AppShell.tsx` identifica o lado da câmera a partir de `window.orientation` (ou `screen.orientation.angle`, quando o primeiro não está disponível). A 90°, a câmera fica à esquerda; a −90°/270°, à direita. Um atributo `data-mari-camera-side` em `<html>` permite que o CSS zere apenas a margem do **contêiner** no lado oposto, `--mari-shell-inset-left` ou `--mari-shell-inset-right`. Rotações desconhecidas, iPad e Android mantêm as margens do sistema.
- No contêiner do celular, `.mari-app` usa as variáveis do contêiner para definir `left` e `right`. O fundo da página do body aparece sobre a câmera, com a mesma cor da faixa da barra de status em retrato, sem uma margem espelhada na borda oposta.
- Os elementos fixos dentro do contêiner são posicionados em relação à tela, não ao contêiner, e por isso evitam esse espaço por conta própria. Os painéis do celular e seus fundos em `AppShell.tsx` usam `MOBILE_SHELL_PANEL_X_CLASS` com as variáveis do contêiner. Decorações como as estrelas são `absolute`, então ficam dentro do contêiner.

Para verificar sem celular, abra uma área de visualização sensível ao toque de 874×402 e defina as duas variáveis como `59px` em uma regra `:root` da folha de estilos (estilos inline prevalecem sobre o seletor do lado da câmera). No Chromium, você também pode emular as margens reais com o comando do DevTools Protocol `Emulation.setSafeAreaInsetsOverride`. `e2e/phone-camera-side.e2e.ts` verifica os dois sentidos de rotação, as APIs de orientação antiga e nova, rotações desconhecidas e outros dispositivos. O teste e2e "a phone turned sideways keeps the app out from under its camera" verifica a alternativa que preserva as duas margens.

## Como o diagnóstico foi feito

A faixa foi rastreada colorindo cada camada e reabrindo o aplicativo. Insira os estilos de diagnóstico no arquivo `packages/client/dist/index.html`, dentro do bloco `<style>` embutido. O service worker não guarda esse arquivo em cache, então ele sempre é servido novo. As mudanças aparecem na próxima abertura, sem precisar limpar o cache.

```
html, body { background-color: #ff0000 !important; }
.mari-chat-input-box { background-color: #00ff00 !important; }
.mari-app { background: #0000ff !important; }
```

Leia o resultado assim:

- Se o chin aparecer vermelho, quem pinta ali é o canvas do html. Nenhum elemento fixo consegue cobrir isso no modo `black-translucent`.
- Se o chin aparecer azul, a caixa do app shell chega até a base. Esse é o estado correto.
- Se o chin aparecer verde, a própria caixa de entrada preenche até a borda.

## Se uma atualização quebrar isso

### Sintoma: a faixa do chin volta a aparecer abaixo da caixa de entrada

Verificação 1. Confirme que `apple-mobile-web-app-status-bar-style` continua como `black` no arquivo `packages/client/index.html`. Se voltou para `black-translucent`, mude de novo para `black`.

Verificação 2. Confirme que o className do AppShell, no arquivo `packages/client/src/components/layout/AppShell.tsx`, continua sendo `mari-app mari-app-background-paint fixed inset-0 flex overflow-hidden`. Não combine `inset-0` com `h-screen`, `h-dvh` ou `max-h-screen`. Isso restringe demais o contêiner fixo e permite que o teclado do celular empurre a interface para todo lado.

Verificação 3. Rode o diagnóstico de cores acima para ver qual camada pinta o chin. Force o fechamento do aplicativo e abra de novo. Não é preciso limpar o cache, porque o arquivo `dist/index.html` não entra no precache.

- Se o chin aparecer vermelho e o resto estiver azul, a caixa do app shell não chega até a base. Confirme se o estilo da barra de status é `black`.
- Se o chin continuar vermelho com o app shell azul, o app shell não está cobrindo a área. Confirme se `fixed inset-0` está intacto.
- Se o chin aparecer azul, o app shell cobre a área, mas a caixa de entrada não preenche até embaixo. Verifique o padding do wrapper da entrada, descrito abaixo.

### Sintoma: a caixa de entrada fica colada na borda da tela

Os três componentes de entrada precisam de `pb-3` no wrapper externo, para o espaçamento flutuante natural, e não de `pb-0`.

- `packages/client/src/components/chat/ChatInput.tsx`: o wrapper é `mari-chat-input chat-input-container px-3 pb-3`.
- `packages/client/src/components/chat/ConversationInput.tsx`: o wrapper é `mari-chat-input chat-input-container relative px-2 sm:px-3 pb-3`.
- `packages/client/src/components/game/GameInput.tsx`: o wrapper é `px-3 pt-2 pb-3`.

## Recompilação

O servidor entrega o cliente já compilado a partir de `packages/client/dist`, então qualquer mudança no código-fonte exige uma nova compilação.

```
pnpm build:client
```

Depois, limpe os dados do site no dispositivo e abra o PWA de novo. No celular, abra **Settings** (Configurações), depois **Safari**, depois **Advanced** (avançado) e então **Website Data** (dados de sites). O service worker guarda em cache o JS e o CSS pelo hash do conteúdo, então um hash diferente só carrega os novos chunks depois que você limpa os dados do site.

O service worker não guarda o arquivo `dist/index.html` em cache, então ele sempre é servido novo. Use esse arquivo para inserir estilos de diagnóstico rapidamente, sem uma recompilação completa.

## Fatos importantes

- O `black-translucent` deixa a barra de status transparente, mas trava a área segura de baixo. Não existe alternativa em CSS.
- O `black` e o `default` deixam a barra de status sólida e permitem que elementos fixos alcancem a área segura de baixo.
- `env(safe-area-inset-bottom)` fica em torno de 34px nos iPhones com Face ID. Use esse valor para afastar o conteúdo interativo do indicador de início quando for preciso.
- No modo `black-translucent`, as unidades de viewport `dvh` e `lvh` valem a altura do conteúdo seguro, não a altura física da tela. Não use essas unidades para estender o app shell além desse limite.
- `interactive-widget=resizes-content` pode fazer o app shell fixo do chat redimensionar enquanto o teclado abre. Prefira o comportamento padrão da viewport.

## Guias relacionados

- [Arquitetura do frontend (Desenvolvedores)](frontend.md)
- [Guia do PWA para iOS / iPadOS](../installation/ios-pwa.md)
