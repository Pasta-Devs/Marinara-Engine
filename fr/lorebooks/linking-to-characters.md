# Lier des lorebooks à des personnages et à des personas

Lie un lorebook à un personnage ou à un persona (le personnage que tu incarnes), et il s'active tout seul dans les bons chats. Tu peux aussi intégrer un lorebook dans une fiche de personnage, et gérer les lorebooks d'un seul chat. Tu débutes avec les lorebooks ? Commence par [Vue d'ensemble des lorebooks](overview.md).

## Lier ou intégrer

| Fonction | Lier (assigner) | Intégrer |
| --- | --- | --- |
| Ce qui se passe | Le personnage ou le persona pointe vers un lorebook de ta bibliothèque. | Le lorebook est écrit dans la fiche de personnage. |
| S'active | Dans les chats avec ce personnage ou ce persona. | Pareil, et il voyage avec la fiche. |
| S'exporte avec la fiche | Non | Oui |
| Disponible pour | Les personnages et les personas | Les personnages uniquement |

La plupart du temps, lie le lorebook. Ne l'intègre que si tu comptes partager la fiche avec son lorebook.

## L'onglet Lorebook dans l'éditeur

L'éditeur de personnage comme l'éditeur de persona ont un onglet **Lorebook**.

1. Ouvre un personnage ou un persona en édition.
2. Clique sur l'onglet **Lorebook**. La section **Lorebooks** a deux boutons, **New** (nouveau) et **Assign Lorebook** (assigner un lorebook).

**New** crée un lorebook déjà lié à ce personnage ou à ce persona, avec sa catégorie réglée sur **Character**. **Assign Lorebook** lie un lorebook que tu as déjà.

## Assigner un lorebook existant

Avant de commencer : le sélecteur n'affiche que les lorebooks dont le champ **Category** (catégorie) vaut **Character**, y compris pour les personas. S'il manque un lorebook, ouvre-le, règle **Category** sur **Character** dans l'onglet **Overview** (vue d'ensemble), puis réessaie.

1. Dans l'onglet **Lorebook**, clique sur **Assign Lorebook**.
2. Tape une partie du nom dans le champ de recherche.
3. Clique sur le lorebook. Une coche apparaît.
4. Laisse **Scope** (portée) sur **All chats with** suivi du nom, ou change-le (voir plus bas).
5. Clique sur **Assign** (assigner).

Le lorebook apparaît maintenant dans la liste des lorebooks assignés. Utilise le bouton **Scope** de sa ligne pour changer la portée, et l'icône de corbeille pour supprimer le lien. Clique sur le nom pour ouvrir le lorebook.

Un lorebook global ne peut pas être lié en plus. Voir [Vue d'ensemble des lorebooks](overview.md).

### Scope

**Scope** détermine quels chats peuvent utiliser le lorebook lié. Seuls les chats avec ce personnage, ou qui utilisent ce persona, sont pris en compte.

| Portée | Résultat |
| --- | --- |
| **All chats with** (le nom) | Le choix par défaut. Le lorebook s'active dans chacun de ces chats. |
| **Disabled for all chats** | Le lien reste, mais le lorebook ne s'active jamais. Sers-t'en pour le mettre en pause. |
| **Specific chats** | Seulement les chats que tu coches dans la liste. Coche-en au moins un pour pouvoir enregistrer. |

Pour changer la portée plus tard, clique sur **Scope** dans la ligne, ajuste-la et clique de nouveau sur **Assign**.

## Intégrer un lorebook dans une fiche de personnage

Avant de commencer : assigne d'abord le lorebook au personnage (voir plus haut).

1. Ouvre le personnage et clique sur l'onglet **Lorebook**.
2. Sur la ligne du lorebook, clique sur **Embed into card** (intégrer à la fiche).

Un badge **Embedded** apparaît sur la ligne, et les entrées s'exportent désormais avec la fiche.

Une fiche contient un seul lorebook intégré. Si elle en a déjà un, le bouton **Embed into card** est désactivé, et son infobulle indique de retirer d'abord le lorebook intégré actuel.

Après avoir modifié le lorebook lié, clique sur **Refresh** (actualiser) sur sa ligne pour réécrire la copie intégrée à partir des entrées actuelles.

### Gérer un lorebook intégré

Quand une fiche a un lorebook intégré, ces contrôles apparaissent sous la liste des lorebooks assignés, avec la liste de ses entrées en lecture seule.

- **Import Embedded Lorebook** (importer le lorebook intégré) transforme les entrées de la fiche en un lorebook normal dans ta bibliothèque, relié au personnage. Dès qu'une copie liée existe, le bouton affiche **Reimport Embedded Lorebook**.
- **Edit Embedded Lorebook** (modifier le lorebook intégré) ouvre ce lorebook lié. Tes modifications se répercutent dans la copie de la fiche.
- **Remove from card** (retirer de la fiche) supprime la copie intégrée. Un lorebook lié séparément n'est pas touché.

Beaucoup de fiches importées depuis d'autres outils arrivent avec un lorebook intégré. Clique sur **Import Embedded Lorebook** pour en obtenir une version modifiable.

## La section Lorebooks des Chat Settings

Chaque chat a ses propres contrôles de lorebooks.

1. Ouvre un chat.
2. Ouvre **Chat Settings** (réglages du chat).
3. Repère la section **Lorebooks**. Un badge indique combien de lorebooks sont actifs.

Chaque lorebook actif porte un badge qui indique pourquoi il est activé.

| Badge | Signification |
| --- | --- |
| **Chat** | Tu l'as ajouté à ce chat. |
| **Global** | C'est un lorebook global. |
| **Character** | Il est lié à un personnage de ce chat. |
| **Persona** | Il est lié au persona de ce chat. |

Tu peux changer ce qui est actif pour ce chat uniquement.

- **Add Lorebook** (ajouter un lorebook) ajoute un lorebook à ce chat. Il porte le badge **Chat**.
- L'icône de corbeille (**Remove from chat**, retirer du chat) retire un lorebook que tu as ajouté.
- L'icône d'œil barré (**Disable in this chat**, désactiver dans ce chat) masque ici un lorebook automatique sans supprimer son lien. Il affiche alors un nom barré et un badge **Disabled**.
- L'icône d'œil (**Enable in this chat**, activer dans ce chat) le réactive.

### Lorebook Token Budget

Le champ **Lorebook Token Budget** (budget de tokens des lorebooks) plafonne le nombre de tokens de texte de lorebook que ce chat peut ajouter. Un token est un petit morceau de texte. La valeur par défaut est 8192, et 0 signifie aucun plafond. Ce plafond s'applique en plus du réglage **Token Budget** propre à chaque lorebook. Voir [Budgets de tokens et récursivité des lorebooks](token-budgets.md).

## Guides associés

- [Vue d'ensemble des lorebooks](overview.md)
- [Budgets de tokens et récursivité des lorebooks](token-budgets.md)
- [Importer et exporter des lorebooks](import-export.md)
- [Créer et modifier des personnages](../characters/creating-and-editing-characters.md)
- [Vue d'ensemble des Chat Settings](../chats/chat-settings.md)
