# Onde Marinara salva os seus dados

Este guia explica onde Marinara Engine salva os seus dados no seu próprio computador. Aqui você vê a pasta de dados principal, as pastas `storage` e de arquivos de mídia que ficam dentro dela, e o arquivo de chave de criptografia que protege as chaves de API salvas.

Marinara Engine (chamado só de "Marinara" daqui em diante) roda na sua própria máquina. Marinara salva os personagens, os chats e as configurações apenas no seu computador. Lembre-se de um detalhe: quando você gera uma resposta, Marinara ainda envia o conteúdo do chat para o provedor de IA ao qual você se conectou.

## A pasta de dados (DATA_DIR)

Tudo o que você cria no Marinara fica dentro de uma única pasta, na máquina que roda o servidor. Essa pasta se chama pasta de dados. A variável de ambiente que aponta para ela se chama `DATA_DIR`. Uma variável de ambiente é um valor definido no servidor, fora do aplicativo. Ou seja, ela não aparece no painel **Settings** (Configurações) do aplicativo.

Por padrão, a pasta de dados é uma pasta chamada `data`, que Marinara cria ao lado dos arquivos do servidor. Se você roda Marinara em um contêiner Docker oficial, a pasta de dados é `/app/data`, dentro do contêiner.

Na dúvida sobre onde a pasta de dados está, consulte o log de inicialização do servidor (o registro do servidor). Ao iniciar, Marinara imprime uma linha que começa com `[storage] DATA_DIR=`, seguida do caminho completo da sua pasta de dados.

A pasta de dados pode ficar em outro lugar: basta você mesmo definir a variável `DATA_DIR`. Para saber como definir essa variável, veja a [Referência de configuração do servidor](../CONFIGURATION.md). Marinara precisa ser reiniciado para o novo valor de `DATA_DIR` valer.

## A pasta storage e as pastas de mídia

Dentro da pasta de dados, os seus dados ficam divididos entre uma pasta `storage` e várias pastas de mídia.

A pasta `storage` contém os dados em texto: personagens, chats, mensagens, lorebooks, presets e conexões. Marinara salva cada tabela em arquivos menores agrupados por proprietário — por exemplo, as mensagens de um chat ou as entradas de um lorebook — para que a alteração de um item não regrave um arquivo JSON global cada vez maior. Durante a atualização única de um armazenamento antigo, Marinara preserva os arquivos de tabela originais ao lado das novas pastas com o sufixo `.pre-shard`.

As imagens, os áudios e os outros arquivos de mídia ficam em pastas próprias, cada uma com o nome do que contém. As principais pastas de mídia são:

| Pasta | O que contém |
| --- | --- |
| `avatars` | Avatares de personagens e personas |
| `sprites` | Arte dos sprites dos personagens (a imagem do personagem no palco) |
| `backgrounds` | Planos de fundo de chat que você enviou |
| `gallery` | Imagens da galeria |
| `fonts` | Fontes personalizadas que você adicionou |
| `knowledge-sources` | Arquivos que você enviou para os agentes de conhecimento |
| `game-assets` | Arquivos de mídia do Game Mode |
| `custom-emojis` | Imagens de emoji personalizadas |
| `custom-stickers` | Imagens de figurinha personalizadas |

Quem desenvolve e quer uma explicação técnica mais profunda sobre o funcionamento da pasta `storage` pode ler [Armazenamento nativo em arquivos](../development/file-storage.md).

## O arquivo da chave de criptografia

Marinara criptografa as chaves de API que você salva, para elas não ficarem salvas em texto simples. A chave usada nessa criptografia fica em um arquivo chamado `.encryption-key`, dentro da sua pasta de dados.

Esse arquivo faz diferença na hora de mover ou restaurar os seus dados. Imagine que você copie a pasta de dados para uma máquina nova, mas deixe o arquivo `.encryption-key` para trás. Marinara não consegue mais descriptografar as chaves de API salvas, e você tem que digitar todas de novo. Mantenha sempre esse arquivo junto do resto dos seus dados.

Algumas configurações avançadas fornecem a chave pela variável de ambiente `ENCRYPTION_KEY`, em vez do arquivo. Se você usa essa variável, mantenha o valor dela em segurança à parte. Nesse caso, não existe arquivo `.encryption-key` para copiar. Veja a [Referência de configuração do servidor](../CONFIGURATION.md) para mais detalhes.

## Onde ficam os meus dados no Android

No Android, a pasta de dados do servidor costuma ficar em uma área de armazenamento do aplicativo que você não alcança sem acesso root. Ou seja, não é possível simplesmente copiar a pasta para fora do celular.

Para obter uma cópia dos seus dados no Android, use o botão **Download Backup** (baixar o backup). Ele fica em **Settings**, na aba **Advanced**, na seção **Backup & Export**. Assim você gera um único arquivo zip com os seus dados. O zip inclui o arquivo `.encryption-key`, quando ele existe. Essa é a forma mais confiável de salvar os seus dados a partir de um celular.

Essa mesma seção pode manter de 1 a 9999 backups automáticos rotativos, diários, semanais ou mensais, na pasta `backups/` dentro da
pasta de dados. O mais recente é o `marinara-automatic-backup.zip`, e os backups automáticos antigos que ficam salvos levam data e hora no nome.
Esse limite vale apenas para os backups automáticos. Copie os backups importantes também para algum lugar fora do armazenamento do aplicativo, porque
desinstalar ou redefinir o aplicativo pode remover tanto os dados em uso quanto os backups automáticos locais.

Para ver o passo a passo completo de backup e restauração em todas as plataformas, veja [Fazer backup e restaurar Marinara](backup-and-restore.md).

## Guias relacionados

- [Fazer backup e restaurar Marinara](backup-and-restore.md)
- [Referência de configuração do servidor](../CONFIGURATION.md)
- [Armazenamento nativo em arquivos](../development/file-storage.md)
