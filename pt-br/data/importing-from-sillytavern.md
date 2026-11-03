# Importar do SillyTavern

Traga os seus dados do SillyTavern para o Marinara Engine. Importe um arquivo por vez ou escaneie uma pasta inteira do SillyTavern e importe tudo de uma vez.

## O que você pode trazer

| Dados do SillyTavern | No Marinara |
| --- | --- |
| Characters | Personagens |
| Chats e chats em grupo | Chats |
| Presets | Presets (um conjunto salvo de configurações de geração) |
| World Info | Lorebooks (notas que a IA lê quando certas palavras aparecem) |
| Backgrounds | Planos de fundo de chat |
| Personas | Personas (o perfil que representa você) |

## Importações rápidas de um arquivo

1. Abra **Settings → Imports**.
2. Em **SillyTavern Import**, clique no botão do seu tipo de arquivo.
3. Escolha o arquivo.

| Botão | Arquivo |
| --- | --- |
| **Import Character (JSON/PNG)** | Um cartão de personagem `.json` ou `.png`. |
| **Import Chat (JSONL)** | Um registro de chat `.jsonl` (um registro JSON por linha, o formato em que o SillyTavern salva os chats). |
| **Import Preset (JSON)** | Um preset `.json`. |
| **Import Lorebook (JSON)** | Um arquivo de World Info `.json`. |

Os botões não têm opções. A importação de um personagem mantém todas as tags de origem e limita os scripts de regex a esse personagem. Um script de regex é uma regra de localizar e substituir em um texto. Para escolher essas opções, use **Import** no painel Characters. Veja [Importando e exportando cartões de personagem](../characters/import-export.md).

Se um cartão de personagem tem um lorebook dentro dele, o seu navegador pergunta se você quer importá-lo como um lorebook à parte. Clique em **OK** para mantê-lo como um lorebook que você pode reutilizar, ou em **Cancel** para importar só o personagem.

**Import Chat (JSONL)** cria um chat de Roleplay, a menos que o arquivo registre outro modo, e o abre.

### Importar um chat em um modo que você escolhe

Para escolher o modo, use o botão de importação no topo da lista de chats. A dica dele é **Import SillyTavern or Marinara chat JSONL**. Ele importa para a aba de modo que está aberta (Conversation, Roleplay ou Game). Veja [Exportando e importando chats](../chats/export-import.md).

## Importar uma pasta do SillyTavern

Antes de começar: o assistente lê arquivos no computador do servidor. Se o SillyTavern está em outro computador, copie primeiro a pasta dele (a pasta em que você instalou o SillyTavern) para o computador do Marinara. No computador do Marinara, o assistente funciona de imediato. Em outro dispositivo, defina o segredo de administrador e digite-o em **Settings → Advanced → Admin Access**. Veja [Fazer backup e restaurar o Marinara](backup-and-restore.md) e a seção "Privileged APIs (ADMIN_SECRET)" da [Referência de configuração do servidor](../CONFIGURATION.md).

1. Abra **Settings → Imports → SillyTavern Import**.
2. Clique em **Import from SillyTavern Folder**.
3. Escolha a sua pasta do SillyTavern. Escolha a pasta principal, normalmente a que contém uma pasta `data/` ou `public/`. Use uma destas formas:
   - Clique em **Browse** e escolha a pasta.
   - Se não houver um seletor de pastas (um servidor remoto), um navegador de pastas do aplicativo se abre. Ele lista só as pastas dentro da pasta pessoal do usuário que executa o servidor. Clique em **Select This Folder**.
   - Digite o caminho em **SillyTavern Folder Path**, por exemplo `/path/to/SillyTavern`. Um caminho digitado só funciona se a configuração `IMPORT_ALLOWED_ROOTS` do servidor listar uma pasta que o contenha.
4. Clique em **Scan Folder**. O Marinara mostra quantos itens encontrou em cada categoria.
5. Em **Choose exactly what to import**, marque os itens que você quer. Cada categoria tem os botões **All** e **None** e um botão **Show** ou **Hide** para os itens individuais.
6. Clique em **Import Selected**. Uma barra de progresso mostra o item atual e uma contagem por categoria.
7. Quando você vir **Import complete!**, leia a contagem de cada categoria e clique em **Done**.

A maioria dos itens começa selecionada. O Marinara deixa desmarcados os presets de fábrica do SillyTavern, como `deterministic`, `neutral` e os presets `universal-*`, e um aviso informa isso. Deixe-os desmarcados, a menos que você queira cópias.

Se o escaneamento encontrar personagens, mais duas opções aparecem:

**Imported character tags** (padrão **All tags**):

- **All tags** mantém as tags de origem.
- **No tags** as ignora.
- **Existing only** mantém só as tags que você já tem.

**Imported regex scripts** (padrão **Character only**):

- **Character only** aplica os scripts a cada personagem.
- **Global** os adiciona a **Presets → Regexes**, para todos os chats.

Se não funcionou:

- "Could not find SillyTavern data directory." significa que o Marinara não consegue ler essa pasta. Escolha a pasta principal do SillyTavern.
- "folderPath is not allowed" significa que o servidor recusou o caminho. Clique em **Browse** e escolha a pasta. O dono do servidor pode limitar quais pastas podem ser importadas com a configuração `IMPORT_ALLOWED_ROOTS`. Se ela estiver definida, até uma pasta escolhida precisa estar dentro de uma dessas pastas. Pergunte a quem executa o servidor, ou veja a [Referência de configuração do servidor](../CONFIGURATION.md).
- Se um item falhar, o Marinara o pula, continua e o lista em avisos na última etapa, por exemplo `Character "Foo": error message`.

## O que acontece com os seus dados

- Arquivos de chat que pertencem a um personagem são importados como ramificações de um só chat. Uma ramificação é uma cópia de um chat que você continua separadamente.
- Chats em grupo são importados como chats de Roleplay.
- Os itens importados mantêm a data da última alteração do arquivo de origem, não a data da importação.

## O que não é transferido

O assistente lê só as categorias da primeira tabela. Outros dados do SillyTavern, como as configurações globais do aplicativo e as respostas rápidas, não são importados.

## Guias relacionados

- [Importando e exportando cartões de personagem](../characters/import-export.md)
- [Importando e exportando lorebooks](../lorebooks/import-export.md)
- [Exportando e importando chats](../chats/export-import.md)
- [Scripts de regex](../extending/regex-scripts.md)
