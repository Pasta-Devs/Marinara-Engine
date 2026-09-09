# Oberflächen-Lokalisierung

Marinara Engine übersetzt den Text der Oberfläche. Unangetastet bleiben dagegen die Prompts an das Modell (der
Text, den Marinara an die KI schickt), eigene Inhalte, generierte Chat-Inhalte, Bezeichner, Protokollwerte,
Dateipfade und gespeicherte Maschinenwerte.

Englisch ist das kanonische Locale und zugleich der Fallback zur Laufzeit. Fehlt eine Übersetzung aus der Community,
erscheint deshalb der englische Text – und nicht ein Schlüsselname oder ein leeres Bedienelement.

Die Oberflächensprache wählst du unter **Settings > General > App Behavior > Language** (Einstellungen > Allgemein >
App-Verhalten > Sprache). Die Auswahl wirkt sich auf Marinaras Bedienelemente und Hinweistexte aus, nicht auf
Prompts, selbst verfasste Inhalte oder Chat-Nachrichten.

Wählst du eine andere Sprache als Englisch, wird ihr Paket bei Bedarf heruntergeladen. **Refresh language pack** (Sprachpaket aktualisieren) lädt neue Übersetzungen. Heruntergeladene Pakete liegen unter `DATA_DIR/ui-packs` und funktionieren offline. Schlägt der Download fehl, bleiben die aktuelle Sprache und das installierte Paket unverändert. Beim Start oder Update werden Pakete nie automatisch heruntergeladen.

Beim ersten Update von einer Version mit mitgelieferten Übersetzungen fällt eine zuvor gewählte andere Sprache auf Englisch zurück. Wähle die Sprache erneut, um sie herunterzuladen. Eigene Inhalte und andere Einstellungen bleiben unverändert.

## Unterstützte Oberflächensprachen

| Sprache | Locale-Datei | Schreibrichtung |
| --- | --- | --- |
| Arabisch | `ar.json` | Von rechts nach links |
| Chinesisch (vereinfacht) | `zh-Hans.json` | Von links nach rechts |
| Englisch | `en.json` | Von links nach rechts |
| Französisch | `fr.json` | Von links nach rechts |
| Deutsch | `de.json` | Von links nach rechts |
| Hindi | `hi.json` | Von links nach rechts |
| Japanisch | `ja.json` | Von links nach rechts |
| Koreanisch | `ko.json` | Von links nach rechts |
| Polnisch | `pl.json` | Von links nach rechts |
| Portugiesisch (Brasilien) | `pt-BR.json` | Von links nach rechts |
| Russisch | `ru.json` | Von links nach rechts |
| Spanisch | `es.json` | Von links nach rechts |

Englisch wird als Quellkatalog gepflegt. Die Community-Kataloge entstanden mit maschineller Unterstützung und können von sprachkundigen Personen korrigiert werden. Die Erfassung der Oberflächentexte läuft noch; Text ohne Übersetzungsschlüssel erscheint weiterhin auf Englisch.

## Locale-Dateien

Der kanonische englische Katalog bleibt hier:

```text
packages/client/src/localization/locales/en.json
```

Community-Pakete liegen unter [`ui/` auf `docs-i18n`](https://github.com/Pasta-Devs/Marinara-Engine/tree/docs-i18n/ui), getrennt von den Sprachordnern der Dokumentation. Jede BCP-47-Sprache hat eine JSON-Datei, etwa `ui/pl.json`, `ui/ko.json` oder `ui/pt-BR.json`. Die gemeinsam generierte Datei `ui/manifest.json` enthält Dateigrößen und SHA-256-Hashes. Behalte die Groß- und Kleinschreibung des Sprachcodes exakt bei. Die arabische Oberfläche wird auch ohne arabisches Dokumentationspaket unterstützt. Englisch lädt mit der Anwendung; Community-Pakete werden ausdrücklich heruntergeladen und vom lokalen Server gelesen.

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

Verwende sprechende Schlüssel, geordnet nach Bereich der Oberfläche. Ein englischer Satz taugt nicht als Schlüssel:
Schon eine gewöhnliche Textkorrektur würde sonst sämtliche Übersetzungen entwerten.

## Übersetzungsregeln

- Übersetze ausschließlich die Werte. Benenne die sprechenden Schlüssel nicht um.
- Erhalte Platzhalter wie `{{name}}` und Auszeichnungs-Tags wie `<strong>`.
- Halte die Übersetzungsschlüssel alphabetisch sortiert.
- Produktnamen wie Marinara Engine bleiben unverändert, solange das Projekt keinen offiziellen übersetzten Namen einführt.
- Triff Bedeutung und Ton von `en.json`; ergänze kein Verhalten und keine Zusagen, die das englische Original nicht macht.
- Prüfe, ob die übersetzten Beschriftungen am Desktop und auf dem Handy passen.

Community-Pakete dürfen vorübergehend Schlüssel auslassen, während eine Bereichsübersetzung entsteht. Fehlende Schlüssel fallen auf Englisch zurück. Der Paketvalidator meldet Abdeckung und veraltete Schlüssel, die die Engine ignoriert. Leere Übersetzungen (außer den vorhandenen absichtlich leeren Suffixen), ungültige Metadaten und veränderte Interpolations- oder Rich-Text-Tokens bestehen die Validierung nicht. Benenne Schlüssel auch in den Paketen um oder entferne sie dort; alternativ verfolge dies in einem `[ui-i18n]`-Folge-Issue.

Feature-PRs müssen den kanonischen englischen Schlüssel ergänzen oder aktualisieren, aber keine Community-Pakete ändern. Übersetze einen Community-Wert nur, wenn du eine brauchbare Übersetzung liefern kannst. Kopiere englische Werte nicht in alle Sprachdateien, nur um identische Schlüssellisten zu erhalten: Der Fallback liefert diesen Text bereits, und fehlende Schlüssel ersparen Übersetzenden unnötige Merge-Konflikte.

Maschinell erzeugte Übersetzungen sind als erster Entwurf willkommen, wenn der PR sie als solche kennzeichnet. Bevor
ein Locale als geprüft gilt, sollte eine sprachkundige Person Terminologie, Ton, abgeschnittene Texte und das Layout
auf dem Handy durchsehen.

## Korrektur an einer bestehenden Übersetzung einreichen

Für eine kleine Formulierungskorrektur genügt der Web-Editor von GitHub:

1. Öffne das Locale unter
   [`ui/`](https://github.com/Pasta-Devs/Marinara-Engine/tree/docs-i18n/ui).
2. Klick auf das Stiftsymbol, um die Datei zu bearbeiten. GitHub bietet dir bei Bedarf an, einen Fork anzulegen.
3. Ändere nur den übersetzten Wert. Der Schlüssel, zeichengenaue Platzhalter wie `{{name}}` und die JSON-Syntax
   bleiben erhalten.
4. Committe die Änderung in deinem Fork auf einen eng umrissenen Branch.
5. Aktualisiere das Paketmanifest und validiere es mit dem folgenden Befehl. Öffne dann einen Pull Request gegen **`docs-i18n`**, nicht gegen `staging` oder `main`. ([`validate-packs.mjs`](#eine-neue-lokalisierung-einreichen))
6. Nenne in der PR-Beschreibung die Sprache, erläutere die korrigierte Bedeutung und gib an, ob du die Sprache
   fließend beherrschst oder maschinell nachgeholfen hast.

Wähle einen Titel wie `Improve French UI translation`. Mehrere zusammenhängende Korrekturen an einem Locale dürfen
sich einen PR teilen. Unabhängige Codeänderungen gehören separat.

## Eine neue Lokalisierung einreichen

Behalte für eine neue Sprache einen Engine-Checkout von `staging` als englische Quelle und arbeite auf `docs-i18n`:

```bash
git clone https://github.com/YOUR-NAME/Marinara-Engine.git
cd Marinara-Engine
git checkout docs-i18n
git pull
git checkout -b translation/LOCALE
```

Danach:

1. Kopiere die kanonische `en.json` aus dem Engine-Checkout nach `ui/<locale>.json`, etwa `ui/it.json` oder `ui/pt-PT.json`.
2. Halte `_meta.locale` identisch zum Dateinamen ohne `.json`.
3. Setze `_meta.direction` auf `ltr` oder `rtl`.
4. Übersetze die Werte nach den obigen Regeln. Für ein neues Locale ist ein vollständig übersetzter englischer
   Katalog die bessere Wahl, auch wenn ein unvollständiger Katalog auf Englisch zurückfallen kann.
5. Erzeuge das Manifest und führe den Paketvalidator aus (nur Node.js, keine Abhängigkeiten). Er meldet die Abdeckung gegenüber dem englischen Katalog deines Engine-Checkouts:

   ```bash
   node scripts/ui-i18n/validate-packs.mjs /path/to/Engine/packages/client/src/localization/locales/en.json --write-manifest
   node scripts/ui-i18n/validate-packs.mjs /path/to/Engine/packages/client/src/localization/locales/en.json
   ```

6. Für neue Sprachen ist zusätzlich ein kleiner Engine-PR nötig, der ihren Code zu `UI_LANGUAGE_CODES` in `packages/shared/src/utils/ui-locales.ts` hinzufügt. Aktualisierungen vorhandener Pakete benötigen keine Engine-Änderung. Wähle die Sprache nach der Veröffentlichung unter **Settings > General** und prüfe sie auf Desktop und Mobilgerät: lange Beschriftungen, Tooltips, Lade- und Fehlerzustände sowie die Schreibrichtung.
7. Schieb den Branch in deinen Fork und
   [öffne einen Pull Request](https://github.com/Pasta-Devs/Marinara-Engine/compare); wähle dabei
   `Pasta-Devs/Marinara-Engine:docs-i18n` als Basis.

Die PR-Beschreibung nennt das Locale, die Quelle der Übersetzung, das Sprach- oder Prüfniveau, die ausgeführten
Prüfbefehle und alle Stellen, die noch eine muttersprachliche Durchsicht brauchen. Fülle die PR-Vorlage ehrlich aus
und hake nur die manuellen Punkte ab, die du selbst überprüft hast.

## Übersetzungen im Client-Code nutzen

React-Komponenten greifen auf `useTranslation` zurück:

```tsx
import { useTranslation } from "react-i18next";

const { t } = useTranslation();
return <button>{t("common.actions.save")}</button>;
```

Hinterlege in Oberflächen-Konfigurationen auf Modulebene die Übersetzungsschlüssel statt der übersetzten Werte. So
greift ein Sprachwechsel sofort, ganz ohne Neuladen der Seite. Client-Helfer außerhalb von React nutzen die
exportierte Funktion `translate` aus `packages/client/src/localization/i18n.ts`.

Übersetze jeden sichtbaren Text: Beschriftungen, Platzhalter, Tooltips, Barrierefreiheitsnamen, Alternativtexte,
Lade- und Leerzustände, Toasts, Bestätigungen und feste Tutorials. Prompts und selbst verfasste Inhalte laufen
niemals über den Oberflächen-Übersetzer.

Gemeinsam genutzte Altbausteine wie Settings-Bedienelemente, Hilfe-Tooltips und Fenstertitel erkennen zusätzlich
exakte kanonisch-englische Katalogwerte, solange ältere Aufrufstellen noch migriert werden. Das ist eine
Kompatibilitätsbrücke, keine bevorzugte Schnittstelle: Neue und stark überarbeitete Komponenten müssen weiterhin
direkt sprechende Schlüssel im Format `t("area.control.label")` verwenden. Ein englischer Satz, der nicht in
`en.json` steht, lässt sich nicht übersetzen.

Die Lokalisierungsprüfung des Repositorys durchsucht außerdem das TSX des Clients nach unübersetztem
Oberflächentext:

```bash
pnpm localization:ui-check
```

Sie erfasst sichtbares JSX, direkt eingesetzte Beschriftungen und Hinweise, Barrierefreiheitsnamen, Platzhalter,
Lade- und Leerzustände, Toasts sowie Bestätigungen. Literale Inhalte in den Elementen `code`, `pre`, `script` und
`style` bleiben bewusst außen vor, damit Befehle, Konfigurationen, URLs, Makros und andere maschinennahe Beispiele
exakt erhalten bleiben. Dynamische Werte aus Nutzerhand, generierte, gespeicherte, Prompt- und Protokollwerte
gehören ebenfalls nicht in den Oberflächen-Übersetzer.

## Oberflächen herunterladbarer Agenten

Engine-eigene Agentenansichten verwenden kanonisches Englisch und die heruntergeladenen Pakete aus `docs-i18n/ui`. Herunterladbare Capability-Clients verwalten ihre eigenen Übersetzungen im Repository Marinara-Agents.

Jedes Capability-Custom-Element bekommt das gewählte Locale über die Attribute `lang` und `dir` – und zusätzlich
darüber:

```ts
capabilityProps.localization = {
  locale: "pl",
  direction: "ltr",
};
```

Das bestehende Event `marinara-capability-props` feuert bei jedem Sprachwechsel. Die Oberfläche eines Pakets sollte
daraufhin ihr mitgeliefertes Locale wählen, notfalls auf das Englisch des Pakets zurückfallen und neu rendern.
