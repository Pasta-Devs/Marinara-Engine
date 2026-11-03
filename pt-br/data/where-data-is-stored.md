# Onde o Marinara guarda os seus dados

Encontre a pasta em que o Marinara Engine mantém os seus dados e saiba quais partes manter quando você mover ou copiar essa pasta.

O Marinara roda no seu próprio computador e salva ali os seus personagens, chats e configurações. Quando você gera uma resposta, o Marinara ainda envia o conteúdo do seu chat ao serviço de IA que você conectou.

## Encontre a pasta de dados

Tudo o que você cria fica em uma pasta no computador que executa o servidor. Essa é a pasta de dados. A configuração dela é `DATA_DIR`, um valor que você dá ao servidor antes de ele iniciar (uma variável de ambiente). Ela não está em **Settings**.

- Por padrão, é uma pasta chamada `data`, ao lado dos arquivos do servidor.
- No contêiner oficial do Docker, é `/app/data`.
- Para ver o caminho exato, olhe a janela em que você iniciou o Marinara (o terminal ou console). Ao iniciar, ele imprime uma linha que começa com `[storage] DATA_DIR=` seguida do caminho. Se você não encontra essa janela, procure uma pasta chamada `data` dentro da pasta do Marinara.

Para mover a pasta, defina `DATA_DIR` e reinicie o Marinara. Veja a [Referência de configuração do servidor](../CONFIGURATION.md).

## O que há dentro

Os seus dados de texto ficam na pasta `storage`: personagens, chats, mensagens, lorebooks, presets e conexões. O Marinara os salva como muitos arquivos pequenos. Depois de uma atualização a partir do layout antigo, você pode ver cópias antigas em `storage/tables/` com nomes que terminam em `.pre-shard`. O Marinara nunca as exclui. Você mesmo pode excluí-las para liberar espaço quando tudo estiver funcionando.

As suas imagens, áudios e outros arquivos ficam em pastas próprias, ao lado de `storage`. Os nomes das pastas são:

| Pasta | O que ela guarda |
| --- | --- |
| `avatars` | Avatares de personagens e personas |
| `sprites` | Arte de sprites de personagens |
| `avatar-models` | Arquivos dos agentes **2D Avatars** e **3D Avatars**, como imagens de PNGTuber e modelos 3D |
| `backgrounds` | Planos de fundo de chat que você enviou |
| `gallery` | Imagens da galeria |
| `fonts` | Fontes personalizadas que você adicionou |
| `knowledge-sources` | Arquivos que você enviou para os agentes de conhecimento |
| `game-assets` | Recursos do Game Mode |
| `game-scene-videos` | Vídeos de cena do Game Mode |
| `conversation-call-character-videos` | Vídeos de personagens para as chamadas de Conversation |
| `custom-emojis` | Imagens de emojis personalizados |
| `custom-stickers` | Imagens de stickers personalizados |
| `notification-sounds` | O seu som de notificação personalizado |
| `long-term-memory` | Dados do agente de memória de longo prazo |
| `lorebooks/images`, `prompts/images`, `agents/images`, `connections/images` | Imagens anexadas a lorebooks, presets, agentes e contas |

A pasta de dados também guarda `backups/` (os seus [backups automáticos](backup-and-restore.md#automatic-backups)) e o arquivo da chave de criptografia. **Download Backup** inclui todas as pastas da tabela, `storage` e o arquivo da chave. Desenvolvedores podem ler [File-Native Storage](../development/file-storage.md).

## Mantenha o arquivo da chave de criptografia

O Marinara criptografa as suas chaves de API salvas. A chave usada para isso é o arquivo `.encryption-key`, na pasta de dados.

Se você copiar os seus dados para um computador novo sem esse arquivo, o Marinara não consegue ler as suas chaves de API salvas. Você precisa informá-las de novo. Copie-o junto com o resto da pasta de dados.

Algumas configurações dão a chave pela variável de ambiente `ENCRYPTION_KEY`. Nesse caso, não há arquivo para copiar. Guarde esse valor em segurança, à parte. Veja a [Referência de configuração do servidor](../CONFIGURATION.md).

## Copie os seus dados do Android

No Android, a pasta de dados fica no armazenamento do aplicativo, que você não alcança sem acesso root, então você não consegue copiá-la. Use **Settings → Advanced → Backup & Export → Download Backup**. O `.zip` inclui o arquivo `.encryption-key` quando ele existe. Veja [Fazer backup e restaurar o Marinara](backup-and-restore.md).

Os backups automáticos são salvos no mesmo armazenamento do aplicativo. Desinstalar ou redefinir o aplicativo pode removê-los junto com os dados ativos, então guarde uma cópia em outro lugar.

## Guias relacionados

- [Fazer backup e restaurar o Marinara](backup-and-restore.md)
- [Limpar ou redefinir os seus dados](clearing-data.md)
- [Referência de configuração do servidor](../CONFIGURATION.md)
- [File-Native Storage](../development/file-storage.md)
