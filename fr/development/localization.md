# Localisation de l'interface

Marinara Engine traduit le texte de l'interface, mais laisse intacts les prompts (le texte envoyé à l'IA), le contenu
écrit par l'utilisateur, le contenu généré dans les chats, les identifiants, les valeurs de protocole, les chemins de
fichiers et les valeurs machine enregistrées.

L'anglais est la langue de référence et le repli au moment de l'exécution. Quand une traduction communautaire manque,
l'interface affiche donc le texte anglais plutôt qu'une clé de traduction ou un contrôle vide.

La langue de l'interface se choisit dans **Settings** (Paramètres) > **General** > **App Behavior** > **Language**. Ce
choix change les contrôles et les explications de Marinara, pas les prompts, le contenu que tu as écrit ni les messages
des chats.

Choisir une langue autre que l'anglais télécharge son pack si nécessaire. **Refresh language pack** (actualiser le pack de langue) récupère les nouvelles traductions. Les packs téléchargés sont conservés dans `DATA_DIR/ui-packs` et fonctionnent hors ligne. Un échec de téléchargement laisse la langue actuelle et le pack installé inchangés. Aucun pack n'est téléchargé automatiquement au démarrage ou lors d'une mise à jour.

Lors de la première mise à jour depuis une version qui incluait les traductions, une langue autre que l'anglais sélectionnée auparavant revient à l'anglais. Sélectionne-la de nouveau pour la télécharger. Les contenus personnels et les autres réglages restent inchangés.

## Langues d'interface prises en charge

| Langue | Fichier de langue | Sens de lecture |
| --- | --- | --- |
| Arabe | `ar.json` | De droite à gauche |
| Chinois simplifié | `zh-Hans.json` | De gauche à droite |
| Anglais | `en.json` | De gauche à droite |
| Français | `fr.json` | De gauche à droite |
| Allemand | `de.json` | De gauche à droite |
| Hindi | `hi.json` | De gauche à droite |
| Japonais | `ja.json` | De gauche à droite |
| Coréen | `ko.json` | De gauche à droite |
| Polonais | `pl.json` | De gauche à droite |
| Portugais du Brésil | `pt-BR.json` | De gauche à droite |
| Russe | `ru.json` | De gauche à droite |
| Espagnol | `es.json` | De gauche à droite |

L'anglais est maintenu comme catalogue source. Les catalogues communautaires ont commencé par des traductions réalisées avec une assistance automatique et acceptent les corrections de personnes maîtrisant la langue. L'extraction des textes de l'interface est encore en cours ; le texte sans clé de traduction continue d'apparaître en anglais.

## Fichiers de langue

Le catalogue anglais canonique reste dans :

```text
packages/client/src/localization/locales/en.json
```

Les packs communautaires se trouvent sous [`ui/` sur `docs-i18n`](https://github.com/Pasta-Devs/Marinara-Engine/tree/docs-i18n/ui), séparément des dossiers de langues de la documentation. Chaque langue BCP-47 utilise un fichier JSON, comme `ui/pl.json`, `ui/ko.json` ou `ui/pt-BR.json`, ainsi qu'un fichier partagé généré `ui/manifest.json` contenant les tailles et les empreintes SHA-256. Respecte exactement la casse du code de langue. L'interface arabe est prise en charge même sans pack de documentation arabe. L'anglais se charge avec l'application ; les packs communautaires sont téléchargés explicitement et lus depuis le serveur local.

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

Utilise des clés sémantiques, organisées par zone de l'interface. N'emploie jamais une phrase anglaise comme clé :
la moindre retouche de formulation invaliderait alors toutes les traductions.

## Règles de traduction

- Ne traduis que les valeurs. Ne renomme pas les clés sémantiques.
- Conserve les jetons d'interpolation comme `{{name}}` et les balises de texte enrichi comme `<strong>`.
- Garde les clés de traduction triées par ordre alphabétique.
- Laisse les noms de produits comme Marinara Engine inchangés, sauf si le projet adopte un nom localisé officiel.
- Respecte le sens et le ton du fichier `en.json` ; n'ajoute ni comportement ni promesse absents de la source anglaise.
- Vérifie que les étiquettes traduites tiennent à l'écran, sur ordinateur comme sur téléphone.

Les packs communautaires peuvent omettre temporairement des clés pendant la préparation d'une traduction par domaine. Les clés absentes utilisent l'anglais. Le validateur de packs indique la couverture et les clés obsolètes, qu'Engine ignore. Les traductions vides (sauf les exceptions existantes pour des suffixes volontairement vides), les métadonnées incorrectes et les modifications des jetons d'interpolation ou de texte enrichi échouent à la validation. Répercute les clés renommées ou supprimées dans les packs, ou suis ces changements dans une issue `[ui-i18n]`.

Les PR de fonctionnalités doivent ajouter ou mettre à jour la clé anglaise canonique, sans devoir modifier les packs communautaires. Traduis une valeur communautaire uniquement si tu peux fournir une traduction utile. Ne copie pas l'anglais dans tous les fichiers pour égaliser leurs listes de clés : le mécanisme de repli fournit déjà ce texte, et laisser une clé absente évite des conflits de fusion inutiles aux traducteurs.

Les traductions automatiques sont acceptées comme première version, à condition que la PR le précise. Une personne qui
parle couramment la langue doit ensuite vérifier la terminologie, le ton, les textes tronqués et la mise en page mobile
avant que la langue soit annoncée comme relue.

## Proposer une correction sur une traduction existante

Pour une petite correction de formulation, l'éditeur web de GitHub suffit :

1. Ouvre le fichier de langue dans
   [`ui/`](https://github.com/Pasta-Devs/Marinara-Engine/tree/docs-i18n/ui).
2. Clique sur l'icône en forme de crayon pour éditer le fichier. GitHub te propose de créer un fork si nécessaire.
3. Ne modifie que la valeur traduite. Conserve sa clé, les jetons sensibles à la ponctuation comme `{{name}}` et la
   syntaxe JSON.
4. Enregistre le commit sur une branche dédiée dans ton fork.
5. Actualise le manifeste et valide le pack avec la commande ci-dessous, puis ouvre un pull request vers **`docs-i18n`**, pas vers `staging` ni `main`.
6. Dans la description de la PR, indique la langue, explique le sens corrigé et précise si tu parles couramment la
   langue ou si tu as utilisé une aide automatique.

Choisis un titre du style `Improve French UI translation`. Plusieurs corrections liées sur une même langue peuvent
tenir dans une seule PR. Garde à part les modifications de code sans rapport.

## Proposer une nouvelle langue

Pour une nouvelle langue, conserve une copie de travail d'Engine sur `staging` comme source anglaise et travaille sur `docs-i18n` :

```bash
git clone https://github.com/YOUR-NAME/Marinara-Engine.git
cd Marinara-Engine
git checkout docs-i18n
git pull
git checkout -b translation/LOCALE
```

Ensuite :

1. Copie le `en.json` canonique de la copie de travail d'Engine vers `ui/<locale>.json`, par exemple `ui/it.json` ou `ui/pt-PT.json`.
2. Garde `_meta.locale` identique au nom du fichier, sans `.json`.
3. Définis `_meta.direction` sur `ltr` ou `rtl`.
4. Traduis les valeurs en suivant les règles ci-dessus. Mieux vaut reprendre le catalogue anglais complet pour une
   nouvelle langue, même si un catalogue incomplet peut retomber sur l'anglais.
5. Génère le manifeste et lance le validateur de packs (Node.js uniquement, sans dépendances). Il indique la couverture par rapport au catalogue anglais de ta copie de travail d'Engine :

   ```bash
   node scripts/ui-i18n/validate-packs.mjs /path/to/Engine/packages/client/src/localization/locales/en.json --write-manifest
   node scripts/ui-i18n/validate-packs.mjs /path/to/Engine/packages/client/src/localization/locales/en.json
   ```

6. Une nouvelle langue nécessite aussi un petit PR d'Engine ajoutant son code à `UI_LANGUAGE_CODES` dans `packages/shared/src/utils/ui-locales.ts`. Les mises à jour de packs existants ne nécessitent aucune modification d'Engine. Après publication, sélectionne la langue dans **Settings > General** et vérifie-la sur ordinateur et mobile : libellés longs, infobulles, états de chargement et d'erreur, ainsi que sens de lecture.
7. Pousse la branche vers ton fork, puis
   [ouvre une pull request](https://github.com/Pasta-Devs/Marinara-Engine/compare) en choisissant
   `Pasta-Devs/Marinara-Engine:docs-i18n` comme base.

La description de la PR doit préciser la langue, la source de la traduction, ton niveau de maîtrise ou de relecture, les
commandes de validation lancées et les zones qui attendent encore la relecture d'une personne native. Remplis le modèle
de PR honnêtement et ne coche que les points manuels que tu as vérifiés toi-même.

## Utiliser les traductions dans le code client

Les composants React passent par `useTranslation` :

```tsx
import { useTranslation } from "react-i18next";

const { t } = useTranslation();
return <button>{t("common.actions.save")}</button>;
```

Dans les configurations d'interface définies au niveau du module, stocke les clés de traduction plutôt que les valeurs
traduites. Le changement de langue reste ainsi immédiat, sans recharger la page. Les fonctions utilitaires du client
hors React peuvent appeler la fonction `translate` exportée par
`packages/client/src/localization/i18n.ts`.

Traduis tout le texte visible : étiquettes, textes indicatifs, infobulles, noms d'accessibilité, textes alternatifs,
états de chargement et états vides, notifications, confirmations et tutoriels statiques. En revanche, ne fais jamais
passer les prompts ni le contenu rédigé par l'utilisateur dans le traducteur d'interface.

Certains composants partagés hérités, comme les contrôles des Settings, les infobulles d'aide et les titres de fenêtres,
reconnaissent aussi les valeurs anglaises canoniques exactes du catalogue, le temps que les anciens appels soient
migrés. C'est une passerelle de compatibilité, pas l'API à privilégier : les composants nouveaux ou largement retouchés
doivent utiliser directement des clés sémantiques `t("area.control.label")`. Une phrase anglaise absente de `en.json`
n'est pas traduisible.

La vérification de localisation du dépôt inspecte également le TSX du client à la recherche de textes d'interface non
traduits :

```bash
pnpm localization:ui-check
```

Elle couvre le JSX visible, les étiquettes et messages interpolés directement, les noms d'accessibilité, les textes
indicatifs, les états de chargement et les états vides, les notifications et les confirmations. Le contenu littéral
placé dans les éléments `code`, `pre`, `script` et `style` est volontairement exclu, pour que les commandes, la
configuration, les URL, les macros et les autres exemples destinés à la machine restent exacts. Les valeurs dynamiques –
contenu écrit par l'utilisateur, contenu généré, données enregistrées, prompts et valeurs de protocole – doivent elles
aussi rester en dehors du traducteur d'interface.

## Interfaces des Agents téléchargeables

Les écrans d'agents appartenant à Engine utilisent l'anglais canonique et les packs téléchargés de `docs-i18n/ui`. Les clients de capacités téléchargeables conservent leurs propres traductions dans le dépôt Marinara-Agents.

Chaque élément personnalisé de capacité reçoit la langue sélectionnée via ses attributs `lang` et `dir`, ainsi que par :

```ts
capabilityProps.localization = {
  locale: "pl",
  direction: "ltr",
};
```

L'événement `marinara-capability-props` existant se déclenche à chaque changement de langue. L'interface d'un paquet
doit sélectionner la langue qu'elle embarque, retomber sur l'anglais du paquet, puis se réafficher après cet événement.
