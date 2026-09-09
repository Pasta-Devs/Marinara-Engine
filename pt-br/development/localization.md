# Localização da interface

Marinara Engine traduz o texto da interface do aplicativo. Ficam intactos os prompts enviados ao modelo, o conteúdo
criado por você, o conteúdo gerado no chat, os identificadores, os valores de protocolo, os caminhos de arquivo e os valores gravados para uso interno.

O inglês é o idioma canônico e também a alternativa usada em tempo de execução. Quando falta uma tradução da comunidade, a tela mostra o
texto em inglês, e não a chave de tradução nem um controle vazio.

O idioma da interface se escolhe na seção **Settings > General > App Behavior > Language** (Configurações). A escolha muda
os controles e as explicações do Marinara, não os prompts enviados ao modelo, o conteúdo criado por você nem as mensagens do chat.

Ao selecionar um idioma diferente do inglês, o pacote é baixado se necessário. **Refresh language pack** (atualizar o pacote de idioma) busca novas traduções. Os pacotes baixados ficam em `DATA_DIR/ui-packs` e funcionam offline. Se um download falhar, o idioma atual e o pacote instalado permanecem intactos. Os pacotes nunca são baixados automaticamente na inicialização ou atualização.

Na primeira atualização de uma versão que incluía as traduções, um idioma diferente do inglês selecionado antes volta ao inglês. Selecione o idioma novamente para baixá-lo. Nenhum conteúdo do usuário ou outro ajuste é alterado.

## Idiomas de interface com suporte

| Idioma | Arquivo de locale | Direção |
| --- | --- | --- |
| Árabe | `ar.json` | Da direita para a esquerda |
| Chinês simplificado | `zh-Hans.json` | Da esquerda para a direita |
| Inglês | `en.json` | Da esquerda para a direita |
| Francês | `fr.json` | Da esquerda para a direita |
| Alemão | `de.json` | Da esquerda para a direita |
| Híndi | `hi.json` | Da esquerda para a direita |
| Japonês | `ja.json` | Da esquerda para a direita |
| Coreano | `ko.json` | Da esquerda para a direita |
| Polonês | `pl.json` | Da esquerda para a direita |
| Português do Brasil | `pt-BR.json` | Da esquerda para a direita |
| Russo | `ru.json` | Da esquerda para a direita |
| Espanhol | `es.json` | Da esquerda para a direita |

O inglês é mantido como catálogo de origem. Os catálogos da comunidade começaram como traduções com assistência de máquina e aceitam correções de pessoas fluentes. A extração de textos da interface ainda está em andamento; textos sem chave de tradução continuam aparecendo em inglês.

## Arquivos de locale

O catálogo canônico em inglês continua em:

```text
packages/client/src/localization/locales/en.json
```

Os pacotes da comunidade ficam em [`ui/` na branch `docs-i18n`](https://github.com/Pasta-Devs/Marinara-Engine/tree/docs-i18n/ui), separados das pastas de idiomas da documentação. Cada idioma BCP-47 usa um arquivo JSON, como `ui/pl.json`, `ui/ko.json` ou `ui/pt-BR.json`, além do arquivo compartilhado e gerado `ui/manifest.json`, que contém tamanhos e hashes SHA-256. Preserve exatamente as maiúsculas e minúsculas do código de idioma. A interface em árabe funciona mesmo sem um pacote de documentação em árabe. O inglês carrega com o aplicativo; os pacotes da comunidade são baixados explicitamente e lidos pelo servidor local.

```json
{
  "_meta": {
    "locale": "pl",
    "direction": "ltr"
  },
  "chat.input.placeholder": "Napisz odpowiedź…",
  "common.actions.save": "Zapisz"
}
```

Use chaves semânticas, organizadas por área da interface. Não use uma frase em inglês como chave: qualquer ajuste comum de
redação invalidaria todas as traduções.

## Regras de tradução

- Traduza apenas os valores. Não renomeie as chaves semânticas.
- Preserve os marcadores de interpolação, como `{{name}}`, e as tags de texto formatado, como `<strong>`.
- Mantenha as chaves de tradução em ordem alfabética.
- Mantenha os nomes de produto, como Marinara Engine, sem tradução, a menos que o projeto adote um nome oficial traduzido.
- Acompanhe o sentido e o tom do arquivo `en.json`. Não acrescente comportamentos nem promessas que o texto em inglês não faz.
- Confira se as etiquetas traduzidas cabem na tela do computador e do celular.

Os pacotes da comunidade podem omitir chaves temporariamente durante a preparação de uma tradução por área. Chaves ausentes usam o inglês. O validador de pacotes informa a cobertura e as chaves obsoletas, que Engine ignora. Traduções vazias (exceto as exceções existentes de sufixos intencionalmente vazios), metadados inválidos e alterações em tokens de interpolação ou texto formatado falham na validação. Replique renomeações e remoções de chaves nos pacotes ou acompanhe essas mudanças em uma issue `[ui-i18n]`.

PRs de funcionalidades precisam adicionar ou atualizar a chave canônica em inglês, mas não precisam modificar os pacotes da comunidade. Traduza um valor da comunidade apenas quando puder oferecer uma tradução útil. Não copie o inglês em todos os arquivos só para igualar as listas de chaves: o fallback já fornece esse texto, e deixar a chave ausente evita conflitos de merge desnecessários para quem traduz.

Traduções feitas por máquina são bem-vindas como rascunho inicial, desde que o PR diga que é esse o caso. Antes de descrever um locale como revisado,
alguém com fluência no idioma precisa revisar a terminologia, o tom, os textos cortados e o layout no celular.

## Enviar uma correção para uma tradução existente

Para uma pequena correção de redação, o editor web do GitHub já resolve:

1. Abra o locale em
   [`ui/`](https://github.com/Pasta-Devs/Marinara-Engine/tree/docs-i18n/ui).
2. Clique no ícone de lápis para editar o arquivo. Se precisar, o GitHub oferece a criação de um fork.
3. Mude apenas o valor traduzido. Preserve a chave, os marcadores sensíveis à pontuação, como `{{name}}`, e a sintaxe
   JSON.
4. Faça o commit da mudança em uma branch focada dentro do seu fork.
5. Atualize o manifesto e valide o pacote com o comando abaixo. Depois abra um pull request para **`docs-i18n`**, não para `staging` ou `main`. ([`validate-packs.mjs`](#enviar-uma-localiza%C3%A7%C3%A3o-nova))
6. Na descrição do PR, diga qual é o idioma, explique o sentido corrigido e informe se você tem fluência no idioma
   ou usou ajuda de máquina.

Use um título como `Improve French UI translation`. Várias correções relacionadas ao mesmo locale podem ir em um só PR.
Deixe mudanças de código não relacionadas em outro lugar.

## Enviar uma localização nova

Para um idioma novo, mantenha um checkout de Engine em `staging` como fonte em inglês e trabalhe em `docs-i18n`:

```bash
git clone https://github.com/YOUR-NAME/Marinara-Engine.git
cd Marinara-Engine
git checkout docs-i18n
git pull
git checkout -b translation/LOCALE
```

Depois:

1. Copie o `en.json` canônico do checkout de Engine para `ui/<locale>.json`, por exemplo `ui/it.json` ou `ui/pt-PT.json`.
2. Mantenha o campo `_meta.locale` igual ao nome do arquivo sem o `.json`.
3. Defina o campo `_meta.direction` como `ltr` ou `rtl`.
4. Traduza os valores seguindo as regras acima. Para um locale novo, o melhor é copiar o catálogo completo em inglês,
   mesmo que um catálogo incompleto possa cair para o inglês.
5. Gere o manifesto e execute o validador de pacotes (somente Node.js, sem dependências). Ele informa a cobertura em relação ao catálogo inglês do seu checkout de Engine:

   ```bash
   node scripts/ui-i18n/validate-packs.mjs /path/to/Engine/packages/client/src/localization/locales/en.json --write-manifest
   node scripts/ui-i18n/validate-packs.mjs /path/to/Engine/packages/client/src/localization/locales/en.json
   ```

6. Idiomas novos também precisam de um pequeno PR de Engine adicionando seu código a `UI_LANGUAGE_CODES` em `packages/shared/src/utils/ui-locales.ts`; atualizar pacotes existentes não exige mudanças em Engine. Depois da publicação, selecione o idioma em **Settings > General** e confira no computador e no celular. Verifique rótulos longos, dicas, estados de carregamento e erro e a direção do texto.
7. Envie a branch para o seu fork e
   [abra um pull request](https://github.com/Pasta-Devs/Marinara-Engine/compare), escolhendo
   `Pasta-Devs/Marinara-Engine:docs-i18n` como base.

A descrição do PR deve identificar o locale, a origem da tradução, o nível de fluência ou revisão, os comandos de validação e
qualquer parte que ainda precise da revisão de um falante nativo. Preencha o template do PR com honestidade e marque apenas os itens manuais que
você mesmo verificou.

## Usar as traduções no código do cliente

Os componentes React usam `useTranslation`:

```tsx
import { useTranslation } from "react-i18next";

const { t } = useTranslation();
return <button>{t("common.actions.save")}</button>;
```

Na configuração de interface no nível do módulo, guarde as chaves de tradução, não os valores já traduzidos. Assim a troca de idioma acontece
na hora, sem recarregar a página. Os auxiliares de cliente fora do React podem usar a função `translate` exportada por
`packages/client/src/localization/i18n.ts`.

Traduza todo texto visível, incluindo etiquetas, textos de exemplo, dicas, nomes de acessibilidade, texto alternativo, estados de carregamento e
de vazio, avisos, confirmações e tutoriais estáticos. Não passe prompts nem conteúdo criado por você pelo tradutor da interface.

Alguns componentes antigos compartilhados, como os controles de Settings, as dicas de ajuda e os títulos de janela, também reconhecem valores
exatos do catálogo canônico em inglês, enquanto os pontos de chamada mais antigos são migrados. Isso é uma ponte de compatibilidade, e não a
API preferida: componentes novos ou bastante editados ainda precisam usar chaves semânticas `t("area.control.label")`
diretamente. Uma frase em inglês que não está no arquivo `en.json` não é traduzível.

A verificação de localização do repositório também audita o TSX do cliente em busca de texto de interface sem tradução:

```bash
pnpm localization:ui-check
```

Ela cobre o JSX visível, as etiquetas e os avisos interpolados diretamente, os nomes acessíveis, os textos de exemplo, os estados de carregamento e de
vazio, os avisos e as confirmações. O conteúdo literal dentro dos elementos `code`, `pre`, `script` e `style` fica de fora de
propósito, para que comandos, configuração, URLs, macros e outros exemplos voltados à máquina continuem exatos.
Valores dinâmicos criados por você, gerados, gravados, de prompt e de protocolo também precisam ficar fora do
tradutor da interface.

## Interfaces de Agentes que você baixa

As telas de agentes pertencentes a Engine usam o inglês canônico e os pacotes baixados de `docs-i18n/ui`. Clientes de capacidades baixáveis mantêm suas próprias traduções no repositório Marinara-Agents.

Todo elemento personalizado de capacidade recebe o locale selecionado pelos atributos `lang` e `dir` e também por:

```ts
capabilityProps.localization = {
  locale: "pl",
  direction: "ltr",
};
```

O evento `marinara-capability-props`, que já existe, dispara quando o locale muda. A interface do pacote deve selecionar o locale
que vem embutido nele, cair para o inglês do pacote e renderizar de novo depois desse evento.
