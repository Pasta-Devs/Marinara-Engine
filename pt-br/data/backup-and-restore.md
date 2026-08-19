# Fazer backup e restaurar Marinara

Neste guia você aprende as duas formas de salvar uma cópia de tudo o que existe no Marinara Engine, e como restaurar essa cópia depois. Vale a pena fazer isso antes de atualizar, de mudar para outro dispositivo ou de zerar os dados.

## Duas formas de salvar os dados

Marinara oferece duas opções de salvamento. Elas ficam em lugares diferentes e servem para coisas diferentes.

- O botão **Download Backup** (baixar o backup) gera um arquivo **.zip** completo com tudo o que está no disco. Um **.zip** é um único arquivo compactado que guarda vários arquivos dentro dele. Essa é a cópia mais completa e a melhor proteção contra perda de dados.
- O botão **Export Profile** (exportar o perfil) gera um arquivo mais leve, com os dados da conta (personagens, personas, chats, lorebooks, presets, agentes, temas e as Personal Extensions). O perfil é a cópia portátil da conta feita por Marinara. Ele pode ser restaurado depois dentro do Marinara.

Se você quer apenas uma cópia segura de tudo, use **Download Backup**. Use **Export Profile** quando precisar de um arquivo menor ou de uma versão que outras ferramentas de roleplay consigam ler.

As duas opções ficam em **Settings** (Configurações), na aba **Advanced**, na seção **Backup & Export**.

## Acesso no mesmo dispositivo ou em outro

No computador que roda Marinara, essas ferramentas funcionam de imediato. É o caso do loopback, ou seja, você abriu o aplicativo em `localhost` ou `127.0.0.1` na mesma máquina.

No celular, no tablet ou em qualquer outro dispositivo, o backup e a restauração exigem o segredo do **Admin Access** (acesso administrativo). Defina o segredo no servidor e cole o mesmo valor em **Settings**, na aba **Advanced**, na seção **Admin Access**. Veja o guia de acesso remoto indicado no fim da página.

## Download Backup

O botão **Download Backup** cria um único arquivo **.zip** com o banco de dados, as configurações e todas as pastas de mídia (avatares, sprites, planos de fundo, imagens da galeria, fontes, o som de notificação personalizado e mais).

1. Abra **Settings**.
2. Vá para a aba **Advanced**.
3. Localize a seção **Backup & Export**.
4. Clique em **Download Backup**.
5. Enquanto o backup é criado, o botão mostra **Creating backup…**.
6. Quando o arquivo compactado fica pronto, o Marinara o transmite direto para o navegador sem manter o arquivo inteiro na memória da página.
7. Dependendo das configurações de download, o navegador abre a janela **Save As** normal ou coloca o arquivo na pasta de downloads.

Esse passo é ainda mais importante no Android e no iOS. Nesses dispositivos, a pasta de dados do aplicativo costuma ficar fora de alcance. Por isso, **Download Backup** é o único jeito simples de tirar uma cópia do dispositivo. Salve o arquivo em um lugar seguro e privado, como o seu armazenamento em nuvem.

O **.zip** também traz um arquivo de texto simples chamado `RESTORE.txt`. Ele explica como recuperar os dados manualmente, caso um dia seja preciso. Trate o backup como material privado: ele pode conter arquivos secretos usados para desbloquear as chaves de API salvas. Para saber o que cada pasta guarda, veja o guia de localização dos dados indicado no fim da página.

## Backups automáticos

A seção **Backup & Export** também pode criar um backup completo automático e rotativo no dispositivo que roda Marinara.
Ative a opção **Automatic Backups** (backups automáticos), escolha **Daily**, **Weekly** ou **Monthly** e defina o campo **Automatic backups kept**
entre 1 e 9999. Marinara cria o primeiro backup logo depois da ativação. A cada execução bem-sucedida, ele mantém a
quantidade configurada de arquivos automáticos mais recentes e exclui o arquivo automático mais antigo que sobrar. Esse limite
nunca exclui backups manuais nem backups salvos com **Download Backup**.

Os backups automáticos ficam na pasta `backups/`, dentro da pasta de dados do Marinara. O arquivo mais recente é
`marinara-automatic-backup.zip`; os arquivos automáticos antigos que forem mantidos recebem nomes com data e hora. Eles usam o mesmo
formato de arquivo restaurável e transmitido em fluxo do **Download Backup**, incluindo as mídias enviadas e o arquivo da chave de criptografia, quando
existe um. Guarde uma cópia separada fora da pasta de dados do Marinara para se proteger contra um disco perdido, um armazenamento
do aplicativo apagado ou um dispositivo restaurado de fábrica.

## Export Profile

O botão **Export Profile** cria um arquivo menor, com os dados da conta. As mídias entram junto, então avatares, imagens e o som de notificação personalizado também vão no arquivo.

1. Abra **Settings**.
2. Vá para a aba **Advanced**.
3. Localize a seção **Backup & Export**.
4. Clique em **Export Profile**.
5. Abre-se a janela **Export Profile**, com duas opções.
6. Escolha um formato (explicado abaixo).
7. O arquivo é baixado no dispositivo.

A janela oferece dois formatos:

| Formato | O que é | Restaurável no Marinara? |
| --- | --- | --- |
| **Marinara Native** | Preserva os campos do Marinara, as pastas de lorebooks, os dados de personagens e personas, os presets, os agentes, os temas, os rascunhos de Personal Extension e as mídias embutidas. | Sim |
| **Compatible JSON** | Arquivos simples de personagem, persona e lorebook para outras ferramentas de roleplay. | Não |

Escolha **Marinara Native** para ter uma cópia restaurável no Marinara depois. Perfis menores são baixados como
`marinara-profile.json`; perfis maiores são oferecidos como um `marinara-profile.zip` transmitido em fluxo, cujos dados são divididos em
arquivos de tabela de tamanho limitado, para que uma biblioteca grande não precise caber em um único texto JSON na memória.

O código das Personal Extensions é preservado no perfil nativo, mas o estado de ativação e a aprovação de execução não. Toda extensão restaurada chega desativada e precisa passar por uma nova revisão em **Settings** > **Addons**.

Escolha **Compatible JSON** apenas para levar personagens ou lorebooks para outra ferramenta. O download é um **.zip** de arquivos simples. Esse arquivo não pode ser restaurado no Marinara com o **Import Profile** (importar o perfil).

## Restaurar com o Import Profile

Para trazer de volta um perfil salvo ou um arquivo gerado pelo **Download Backup**, use o botão **Import Profile**. Ele fica em outra aba, separado das ferramentas de salvamento.

1. Abra **Settings**.
2. Vá para a aba **Imports**.
3. Localize a seção **Profile & Marinara**.
4. Clique em **Import Profile (JSON/ZIP)**.
5. Escolha o arquivo. Pode ser um `marinara-profile.json`, um `marinara-profile.zip` ou um **.zip** completo do **Download Backup**.
6. Marinara analisa o arquivo primeiro. O botão mostra **Scanning Profile...**.
7. Aparece a janela **Import Profile**, com a lista do que foi encontrado, por exemplo a quantidade de personagens e personas.
8. A janela avisa que a importação não pode ser desfeita. Leia o aviso e clique em **Import** para seguir, ou em **Cancel** para parar.
9. A importação é executada e mostra **Importing Profile...** com uma barra de progresso.

Um perfil recente do Marinara é restaurado pela identidade própria de cada item, não pelo nome. Por isso, ao importar o mesmo perfil duas vezes, os itens existentes são atualizados no lugar, sem virar duplicatas.

Arquivos de perfil muito antigos (de versões bem mais velhas) não têm esse comportamento. Reimportar um deles pode criar personagens, personas e lorebooks duplicados. Quem só restaura exportações recentes não passa por isso.

Se você escolher o arquivo e alterá-lo no disco antes de confirmar, a importação para e mostra um aviso. Basta escolher o arquivo de novo.

Se faltarem alguns arquivos de mídia dentro do **.zip**, a importação termina mesmo assim. Aparece um aviso em âmbar com a lista dos arquivos que faltam, e todo o resto é importado.

## Depois de restaurar: informe as chaves de novo

O botão **Export Profile** remove os valores secretos do arquivo de perfil. As chaves de API e os links de webhook salvos ficam em branco lá dentro. Assim o arquivo de perfil pode ser guardado e compartilhado com segurança. A chave de API é a senha que conecta Marinara a um provedor de IA.

Um arquivo do **Download Backup** é diferente. Marinara não remove os segredos dele. O **.zip** do backup é uma cópia bruta dos dados. Ele contém as chaves salvas e o arquivo secreto capaz de desbloqueá-las. Nunca compartilhe o **.zip** de um backup. Guarde-o em local privado.

O **Import Profile** restaura a partir do arquivo de perfil, mesmo quando você escolhe o **.zip** de um backup. O arquivo compactado guarda uma cópia do perfil dentro dele, e é essa cópia que a importação lê. Por isso, os itens criados pela importação chegam com as chaves e os links de webhook em branco.

Depois de importar um perfil, faça o seguinte:

1. Abra **Settings**.
2. Vá para a aba **Connections**.
3. Informe de novo a chave de API de cada provedor que você usa.

Se você usa ferramentas personalizadas que chamam um link de webhook, informe esse link de novo em cada ferramenta.

A importação não apaga as chaves já configuradas. Ao reimportar um perfil antigo, Marinara preserva as chaves e os links de webhook ativos nos itens que ainda existem. A reimportação não deixa esses campos em branco.

## A lista Existing backups

A seção **Backup & Export** pode mostrar uma lista **Existing backups** (backups existentes) com um botão para excluir. No uso normal, essa lista fica vazia. O **Download Backup** salva o arquivo direto no dispositivo. Ele não deixa cópia nessa lista, e o único arquivo automático rotativo é controlado pela opção Automatic Backups. Essa lista não é necessária para criar nem para manter um backup baixado.

## Guias relacionados

- [Onde Marinara salva os seus dados](where-data-is-stored.md)
- [Limpar ou zerar os seus dados](clearing-data.md)
- [Atualizando Marinara Engine](../UPGRADING.md)
- [Conectando a um provedor de IA](../connections/connecting-to-a-provider.md)
- [Acesso remoto: Basic Auth e lista de IPs permitidos](../REMOTE_ACCESS.md)
