# Fazer backup e restaurar o Marinara

Salve uma cópia dos dados do seu Marinara Engine e restaure-a depois. Faça isso antes de atualizar, de mudar para outro dispositivo ou de [apagar os seus dados](clearing-data.md).

## Qual opção usar

| Opção | O que ela gera | Use para |
| --- | --- | --- |
| **Download Backup** | Um `.zip` com todos os seus dados e arquivos. | Uma cópia completa de tudo. |
| **Export Profile** | Um arquivo menor com os dados da sua conta (personagens, chats, lorebooks e mais). | Uma cópia sem segredos, ou arquivos para outras ferramentas. |

Um `.zip` é um único arquivo que guarda vários arquivos. As duas opções ficam em **Settings → Advanced → Backup & Export**. A restauração fica em **Settings → Imports → Profile & Marinara**.

**Antes de começar:** no computador que executa o Marinara, essas ferramentas funcionam de imediato. Em um celular, um tablet ou qualquer outro dispositivo, defina o segredo de administrador no servidor e digite o mesmo valor em **Settings → Advanced → Admin Access**. O segredo de administrador é uma senha no arquivo `.env` do servidor, com o nome `ADMIN_SECRET`. Veja a seção "Privileged APIs (ADMIN_SECRET)" da [Referência de configuração do servidor](../CONFIGURATION.md) e o guia de [Acesso remoto](../REMOTE_ACCESS.md).

## Download Backup

1. Abra **Settings → Advanced**.
2. Em **Backup & Export**, clique em **Download Backup**. O botão mostra **Creating backup...**.
3. Salve o arquivo quando o navegador pedir, ou encontre-o na sua pasta de downloads.

O `.zip` contém:

- os seus dados de texto salvos (personagens, chats, lorebooks, presets, conexões, configurações);
- os seus arquivos enviados e gerados, como avatares, sprites, planos de fundo, imagens da galeria, fontes, emojis e stickers personalizados e o seu som de notificação personalizado;
- o arquivo `.encryption-key`, quando ele existe;
- uma nota `RESTORE.txt` sobre como restaurar os arquivos à mão (veja [Restaurar à mão](#restore-by-hand)).

Para saber os nomes das pastas, veja [Onde o Marinara guarda os seus dados](where-data-is-stored.md).

> **Aviso:** um backup contém as suas chaves de API salvas e o arquivo `.encryption-key` que as desbloqueia. Nunca o compartilhe. Guarde-o em um lugar privado.

No Android, você não consegue acessar a pasta de dados do aplicativo. Por isso, **Download Backup** é a forma de tirar uma cópia do dispositivo. Se ele não funcionar: caso você veja "Backup preparation timed out after one hour.", tente de novo. Se outro dispositivo não conseguir baixar, confira o **Admin Access** (veja acima).

<a id="automatic-backups"></a>

## Backups automáticos

O Marinara pode fazer um backup completo em uma agenda, no computador que o executa.

1. Abra **Settings → Advanced → Backup & Export**.
2. Ative **Automatic backups**.
3. Escolha **Daily**, **Weekly** ou **Monthly**.
4. Defina **Automatic backups kept** de 1 a 9999.

O Marinara faz o primeiro backup logo depois que você ativa a opção. Depois de cada execução, ele mantém os backups mais novos, até o seu número, e exclui os backups automáticos mais antigos. Ele nunca exclui os backups que você fez com **Download Backup**.

Os backups automáticos ficam na pasta `backups/`, dentro da pasta de dados. O mais novo é `marinara-automatic-backup.zip`. Os mais antigos têm uma data e uma hora no nome. Eles usam o mesmo formato do **Download Backup**.

Cada execução precisa de espaço livre para mais um arquivo completo, porque o backup antigo fica até o novo terminar. Se não houver espaço suficiente, o Marinara pula a execução e mostra o motivo ao lado da configuração. Ele tenta de novo quando houver espaço livre.

> **Dica:** guarde uma segunda cópia fora da pasta de dados. Um disco perdido ou um aplicativo apagado também remove os backups automáticos.

<a id="export-a-profile"></a>

## Exportar um perfil

1. Abra **Settings → Advanced → Backup & Export**.
2. Clique em **Export Profile**. Uma janela com o mesmo título se abre.
3. Escolha um formato.
4. O seu navegador baixa o arquivo.

- **Marinara Native** mantém os seus personagens, personas, chats, lorebooks, presets, agentes, temas, o código de Personal Extension e a mídia. Ele não restaura chaves de API, links de webhook nem algumas configurações de chat (veja [Informe as suas chaves de novo](#enter-your-keys-again)). Você pode restaurá-lo no Marinara.
- **Compatible JSON** gera um `.zip` de arquivos simples de personagens, personas e lorebooks, para outras ferramentas. Você não pode restaurá-lo no Marinara.

Um perfil nativo é baixado como `marinara-profile.json`. Se ele for grande demais, o Marinara oferece um arquivo ZIP no lugar. Clique em **Export ZIP** para baixar `marinara-profile.zip`.

O perfil nativo guarda os scripts de regex, suas pastas e a configuração de pausa de cada pasta. Para compartilhar scripts individuais como JSON, veja [Scripts de regex](../extending/regex-scripts.md#import-and-replace-scripts).

Um perfil nativo mantém o código de Personal Extension, mas não mantém o estado ligado ou aprovado. Toda extensão restaurada chega desativada. Revise-a de novo em **Settings → Addons**.

## Restaurar com Import Profile

**Import Profile** carrega um arquivo de perfil ou um `.zip` de **Download Backup**.

1. Abra **Settings → Imports**.
2. Em **Profile & Marinara**, clique em **Import Profile (JSON/ZIP)**.
3. Escolha `marinara-profile.json`, `marinara-profile.zip` ou um `.zip` de backup. O botão mostra **Scanning Profile...**.
4. Leia a janela **Import Profile**. Ela lista o que o Marinara encontrou. Os itens que já estão no Marinara são substituídos pelas versões do arquivo, a menos que você [só adicione o que falta](#only-add-whats-missing).
5. Clique em **Import**, ou em **Cancel** para parar. O botão mostra **Importing Profile...**. Primeiro, o Marinara salva uma cópia de proteção dos seus dados, e depois uma barra de progresso aparece. Quando a importação termina, uma mensagem diz que o perfil foi importado.

Se não funcionou:

- A menos que você abra o Marinara em `localhost`, `127.0.0.1` ou `[::1]`, a importação de perfil precisa de HTTPS. O erro é "Profile import requires HTTPS outside local development." Abra o Marinara por um endereço HTTPS.
- Se faltarem alguns arquivos de mídia no `.zip`, a importação termina mesmo assim. Um aviso lista o que falta, e o Marinara importa o resto.
- Se o disco estiver cheio demais para a cópia de proteção, nada é importado. O erro começa com "Nothing was imported, because a safety copy could not be saved first." Libere mais ou menos o espaço que um backup completo ocupa e importe de novo.

Se você importar o mesmo perfil duas vezes, o Marinara atualiza os seus itens e não os copia. Perfis de versões muito antigas podem gerar duplicatas.

<a id="only-add-whats-missing"></a>

### Só adicionar o que falta

Para recuperar algo que você excluiu sem perder as mudanças que fez desde então, ative **Keep my current versions, only add what's missing** (manter as minhas versões atuais e só adicionar o que falta) acima de **Import Profile (JSON/ZIP)** e importe como descrito acima. Todo item e arquivo que já está no Marinara fica como está, e só é adicionado o que o Marinara não tem. Isso inclui tudo o que você excluiu desde que o arquivo foi salvo, como mensagens avulsas ou entradas de lorebook, e não só o item que você queria de volta. A memória de longo prazo conta como um único item: se o Marinara já tem alguma, a do arquivo não é adicionada.

Nada é substituído, então o Marinara não salva nenhuma cópia de proteção, e **Undo Last Import** (desfazer a última importação) continua desfazendo a importação anterior a esta.

Perfis de versões muito antigas não conseguem fazer isso: eles sempre adicionam os itens deles ao lado dos seus, e a janela **Import Profile** informa isso.

### Desfazer uma importação

Antes de cada importação que substitui itens, o Marinara salva uma cópia completa dos seus dados na pasta `backups/` da pasta de dados, em um arquivo cujo nome começa com `marinara-before-import-` seguido da data e da hora. Quando a importação termina, a cópia da importação anterior é excluída, então só a mais recente é mantida.

1. Abra **Settings → Imports**.
2. Em **Profile & Marinara**, clique em **Undo Last Import**. A linha abaixo dele mostra quando a cópia de proteção foi salva.
3. Clique em **Undo Last Import** na janela para confirmar.

Desfazer devolve as suas versões dos itens e arquivos que a última importação substituiu. Se você alterou um desses itens depois da importação, essa alteração se perde. Todo o resto fica como está, inclusive os itens que a importação adicionou. Você pode desfazer uma importação uma vez, e depois a cópia de proteção é excluída.

Desfazer não reativa o que a importação desativou por segurança. Reative estes itens à mão:

- o seu tema ativo;
- as Personal Extensions (revise-as de novo em **Settings → Addons**);
- as ferramentas personalizadas que executam um script ou um webhook;
- as lembranças da Professor Mari.

Se a importação deixou em branco a chave de API de uma conexão, informe a chave de novo (veja [Informe as suas chaves de novo](#enter-your-keys-again)). Se ela era a sua conexão padrão ou de reserva, defina-a de novo como tal.

Os chats ramificados que a importação substituiu continuam desvinculados do chat de onde foram ramificados. A importação já removeu esse vínculo, e Desfazer não consegue trazê-lo de volta.

Perfis de versões muito antigas só adicionam itens, então o Marinara não salva nenhuma cópia de proteção para eles e não há nada para desfazer.

A cópia de proteção ocupa tanto espaço quanto um backup completo. Para liberar esse espaço sem desfazer a importação, clique em **Delete Safety Copy** (excluir a cópia de proteção) em **Profile & Marinara** e confirme. Os seus dados ficam como estão, mas você não consegue mais desfazer essa importação. Se uma importação foi interrompida, **Delete Safety Copy** pode aparecer sozinho; nesse caso, a cópia não pode ser usada para desfazer, mas você ainda pode excluí-la.

<a id="enter-your-keys-again"></a>

## Informe as suas chaves de novo

**Import Profile** nunca traz de volta chaves de API nem links de webhook, nem mesmo de um `.zip` de **Download Backup**. Uma chave de API é o código secreto que um serviço dá a você. O perfil e o perfil dentro de um backup têm esses valores em branco. Por isso, depois de importar em um computador novo, você precisa informá-los de novo:

1. Abra **Connections** na barra superior.
2. Abra cada conta que você usa, informe a chave de API e salve. Veja [Conectando a um provedor de IA](../connections/connecting-to-a-provider.md).
3. Informe o link de webhook em cada ferramenta personalizada que usa um.

Algumas configurações de chat com endereços ou chaves (Discord, DeepL, Intiface) também voltam em branco. Informe-as de novo em **Chat Settings**, em cada chat.

Importar nunca apaga chaves que você já tem na mesma instalação.

## Mudar para um novo computador

1. Instale o Marinara no novo computador e inicie-o. Veja [Instalação](../INSTALLATION.md).
2. Abra **Settings → Imports → Profile & Marinara** e clique em **Import Profile (JSON/ZIP)**.
3. Escolha o seu **Download Backup** `.zip` ou o seu arquivo de perfil e clique em **Import**.
4. Informe as suas chaves de API de novo, como descrito acima.

O arquivo de chave de um backup só ajuda se você copiar a pasta de dados inteira à mão, como abaixo.

<a id="restore-by-hand"></a>

## Restaurar à mão

Use isto só se **Import Profile** não puder ser usado. O `.zip` tem uma pasta dentro, por exemplo `marinara-backup-...`, com uma nota `RESTORE.txt`.

1. Pare o Marinara.
2. Descompacte o backup.
3. Copie as pastas e o arquivo `.encryption-key` da pasta descompactada para a sua pasta de dados. Veja [Onde o Marinara guarda os seus dados](where-data-is-stored.md).
4. Inicie o Marinara.

Mantenha o arquivo `.encryption-key` na pasta `storage`, ou as chaves de API salvas não podem ser lidas.

A lista **Existing backups** em **Backup & Export** normalmente fica vazia. Você não precisa dela.

## Guias relacionados

- [Onde o Marinara guarda os seus dados](where-data-is-stored.md)
- [Limpar ou redefinir os seus dados](clearing-data.md)
- [Atualizando o Marinara Engine](../UPGRADING.md)
- [Conectando a um provedor de IA](../connections/connecting-to-a-provider.md)
- [Acesso remoto: login e lista de IPs permitidos](../REMOTE_ACCESS.md)
