# Extensões pessoais

Uma Personal Extension (extensão pessoal) é um pequeno trecho de código que acrescenta um botão, um painel ou um recurso auxiliar ao Marinara. A Professor Mari pode escrever uma para você, e você decide se ela vai rodar algum dia. Este guia explica como revisar, ativar, exportar e recuperar extensões. Para escrever a sua, veja [Como escrever Personal Extensions](writing-personal-extensions.md).

## Qual tipo é qual

| Nome | O que é |
| --- | --- |
| Personal Extension | Uma extensão que a Professor Mari escreveu para você. Ela aparece como rascunho em **Settings → Addons** (Configurações → Complementos). |
| External Extension | Uma extensão de outra pessoa, ou uma que você mesmo escreveu. Ela exige os passos extras de [Permitir importações de terceiros](#allow-third-party-imports). |
| Browser Extension | Roda dentro do seu navegador, em um sandbox. É segura por padrão. |
| Server Extension | Roda no computador que executa o Marinara, em um sandbox do sistema operacional. Exige uma plataforma compatível. |
| Full page access | Uma permissão que remove o sandbox. Só para código em que você confia totalmente. |

## Instalar uma extensão que alguém compartilhou

Antes de começar, faça os dois passos de [Permitir importações de terceiros](#allow-third-party-imports). Sem eles, os botões de importação ficam ocultos.

1. Abra **Settings → Addons**. Em **External Extensions** (extensões externas), escolha **Import Extension File** (importar arquivo de extensão) para um arquivo `.zip`, `.json`, `.css` ou `.js`. Para uma pasta, escolha **Import Extension Folder** (importar pasta de extensão).
2. Abra o rascunho novo. Ele fica desativado e mostra o código e um hash, uma impressão digital curta daquele código exato (Marinara usa SHA-256).
3. Leia o código e a lista **Requested access** (acesso solicitado).
4. Escolha **Review and Run** (revisar e executar) só se você aceitar aquela versão exata. A extensão então aparece como ativada.

Se não funcionou: se os botões de importação não aparecem, um dos dois passos não foi feito. Lembre-se de reiniciar o Marinara depois de mudar o `.env`.

## Revisar uma extensão da Professor Mari

Antes de começar, peça à [Professor Mari](../home/professor-mari.md) para criar uma extensão. Ela consegue salvar o código, mas não consegue aprová-lo nem ativá-lo. Esta seção não tem botão New Draft nem controle de importação.

1. Abra **Settings → Addons → Personal Extensions**. Sem rascunhos, a seção mostra: "Ask Professor Mari to create an extension for you. Nothing runs until you enable it and approve the exact code hash."
2. Abra o rascunho e leia o código. Confira o hash e a lista **Requested access**.
3. Escolha **Review and Run** só se você aceitar aquela versão exata.

Todo rascunho começa desativado. Qualquer edição no código, mudança de permissão ou revisão restaurada desativa a extensão e exige uma nova aprovação.

> **Aviso:** um sandbox limita o que o código pode fazer, mas não torna o código confiável. Uma extensão nociva ainda pode desperdiçar tempo de processador até que um watchdog (um temporizador que interrompe código descontrolado) a encerre, encher o próprio armazenamento até o limite ou enganar você por meio dos logs. As extensões de página inteira abrem mão do sandbox de propósito. Leia o código antes de ativá-lo e examine cada linha de código de terceiros.

Se não funcionou: as edições da Professor Mari e qualquer revisão restaurada fazem o rascunho voltar a ficar desativado. Revise-o de novo e confira se o hash na janela é o mesmo que você leu.

## O que uma extensão pode fazer

Uma Browser Extension roda em um sandbox (uma área isolada) dentro do seu navegador. Ela não consegue alcançar a página do Marinara, os cookies, o armazenamento do navegador nem a rede. Ela pode:

- manter armazenamento privado e escrever logs
- acrescentar botões, itens de menu e painéis que Marinara desenha no seu tema
- ler os IDs do chat aberto
- ler campos selecionados dos personagens ativos ou da persona, só quando você aprova essas permissões

A lista completa está em [Como escrever Personal Extensions](writing-personal-extensions.md#what-a-browser-extension-can-do).

Uma Server Extension roda em um processo Node separado (um programa no computador do servidor), dentro de um sandbox do sistema operacional. Ela não consegue alcançar os arquivos do Marinara, os seus arquivos, os segredos do servidor, a rede, processos filhos, workers nem addons nativos.

<a id="platform-support"></a>

### Plataformas compatíveis

As Browser Extensions são isoladas pelo navegador, então funcionam em qualquer lugar. As Server Extensions precisam de um sandbox do sistema operacional compatível. Onde não existe um, elas ficam desativadas, e Marinara nunca as executa sem ele.

| Plataforma | Server Extensions |
| --- | --- |
| macOS | Em sandbox com o Seatbelt, o sandbox do macOS |
| Linux com Bubblewrap | Em sandbox com o Bubblewrap, uma ferramenta de sandbox do Linux |
| Linux sem `bwrap` | Desativadas: instale o `bwrap` |
| Docker (padrão) | Desativadas: privilégios do contêiner |
| Windows | Desativadas: use uma Browser Extension |
| Android | Desativadas: use uma Browser Extension |

As Browser Extensions ficam em sandbox em todas as plataformas. As External Extensions de página inteira não ficam em sandbox em nenhuma delas e sempre exigem a sua confiança explícita.

A imagem oficial do Docker contém o Bubblewrap, mas o contêiner padrão dela não consegue criar os espaços de nomes aninhados e as montagens de que o Bubblewrap precisa. Marinara testa o sandbox durante a execução e deixa as Server Extensions desativadas quando o contêiner o bloqueia. Veja [Solução de problemas](../TROUBLESHOOTING.md#a-server-extension-says-no-supported-sandbox-is-available) para conhecer a liberação das permissões do Docker e o que ela custa em segurança.

No Windows e no Android não existe sandbox de processo compatível, então as Server Extensions ficam indisponíveis. Use uma Browser Extension ou rode o servidor do Marinara no macOS ou no Linux com `bwrap`.

<a id="allow-third-party-imports"></a>

## Permitir importações de terceiros

As importações de terceiros ficam bloqueadas e ocultas por padrão, porque executam código escrito por outras pessoas. Dois passos as liberam:

1. No computador que executa o Marinara, defina `ENABLE_EXTERNAL_EXTENSIONS=true` no arquivo `.env` e depois reinicie o Marinara. Veja a [Referência de configuração do servidor](../CONFIGURATION.md).
2. Abra **Settings → Advanced → Danger Zone** (Configurações → Avançado → Zona de perigo), role para baixo até passar dos controles de exclusão de dados, leia o aviso e ative **Allow third-party extension imports** (permitir a importação de extensões de terceiros).

Então **Settings → Addons** mostra **External Extensions** com os controles de importação de arquivo e de pasta. Formatos compatíveis:

- `.personal-extension.zip` e pacotes `.zip` compatíveis
- manifestos `.json`
- `.css`
- `.js`, `.mjs` e `.cjs`
- `.server.js`, `.server.mjs` e `.server.cjs`

Uma importação nunca traz aprovação junto e não consegue se ativar sozinha. A maioria das Browser Extensions deve continuar no sandbox seguro. Um pacote marcado com **Full page access** (acesso à página inteira) é diferente:

- O código dele roda na página do Marinara, sem sandbox.
- Ele consegue ler chats e cards, usar o armazenamento do navegador, fazer requisições de rede e chamar as APIs do próprio Marinara.
- Ative-o só depois de inspecionar aquela versão exata e confiar nela.
- Os rascunhos da Professor Mari não podem pedir esse acesso.

Registros antigos, importados de um perfil, guardados manualmente ou de origem desconhecida também contam como externos. Eles ficam ocultos, não podem ser aprovados e não rodam até que os dois passos estejam feitos.

Desligar qualquer um dos passos desativa todas as extensões importadas. Ligá-lo de novo não as faz rodar outra vez. Recarregue a página se uma extensão de página inteira tiver deixado alterações para trás.

Se não funcionou: se os controles de importação não aparecem, confira se os dois passos estão feitos e se você está no computador do servidor ou salvou o segredo de administrador em **Settings → Advanced → Admin Access** (Configurações → Avançado → acesso de administrador).

## Exportação, revisões e recuperação

Use a ação de exportação da extensão para baixar um pacote portátil. Pacotes exportados e restaurados continuam desativados. Restaurar uma revisão também devolve a extensão à condição de rascunho desativado.

**Settings → Addons → Extension revision history** (Configurações → Complementos → histórico de revisões de extensões) define quantas versões anteriores do código são mantidas para todas as extensões pessoais e externas. O padrão é **10**. Escolha de **0** a **10**, em que **0** desativa o histórico. Reduzir o limite pede confirmação antes de remover permanentemente as revisões antigas. O código atual, as aprovações, o estado de ativação e os dados salvos da extensão são mantidos. As edições feitas pela Professor Mari seguem o mesmo limite.

Se uma extensão se comportar mal, escolha **Disable** (desativar). Se a interface não estiver disponível, pare o Marinara e mude para `"false"` o valor de `enabled` do registro correspondente em `installed_extensions`. Nunca defina `approvedHash` na mão.

## Guias relacionados

- [Como escrever Personal Extensions](writing-personal-extensions.md)
- [Professor Mari](../home/professor-mari.md)
- [Configuração do servidor](../CONFIGURATION.md)
- [Fazer backup e restaurar o Marinara](../data/backup-and-restore.md)
- [Acesso remoto](../REMOTE_ACCESS.md)
