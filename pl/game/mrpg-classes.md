# Game Mode: klasy MRPG

Każda nowa gra korzysta z klas **MRPG** (Marinara RPG), również gra utworzona z Experience. Każdy członek drużyny ma klasę, zdobywa poziomy za walki i w miarę rozwoju odblokowuje nowe klasy. Gry utworzone przed wprowadzeniem klas MRPG zachowują arkusze **Legacy**, dopóki nie zdecydujesz się ich przenieść (zobacz [Przenoszenie gry Legacy do MRPG](#move-a-legacy-game-to-mrpg)).

Gra rozgrywana z zestawem zasad, na przykład 5e (SRD 5.1), korzysta zamiast tego z własnych arkuszy zestawu zasad i klasy MRPG jej nie dotyczą.

## Klasy i drzewka

Istnieje osiem drzewek: **Blade**, **Guard**, **Scout**, **Marksman**, **Channeler**, **Hexer**, **Mender** i **Herald**. Każda postać szkoli się w dwóch z nich:

- **Główne drzewko.** Jest wybierane na podstawie arkusza postaci. Można je wskazać w sekcji **Game Mode** karty postaci lub persony z biblioteki. W przeciwnym razie jest odczytywane z klasy i zdolności postaci.
- **Drugie drzewko.** Otwiera je temperament, z którym postać rozpoczyna grę. Postać, której temperament wskazuje jej własne główne drzewko, szkoli się tylko w nim i może uzyskać dostęp do klas dostępnych wyłącznie dla kogoś, kto pozostaje przy jednym drzewku.

Każde drzewko zaczyna się od klasy podstawowej. Klasa awansuje na poziomie klasy 10, a potem ponownie na poziomie 20; najwyższy poziom to 30. Postać może korzystać z maksymalnie czterech umiejętności innych klas, w których się szkoliła. Klasy przełącza się poza walką, na arkuszu postaci. Statystyki wynikają z aktywnej klasy.

## Arkusz postaci

Otwórz arkusz członka drużyny z listy drużyny. Ma cztery zakładki: **Status** (stan), **Classes** (klasy), **Skills** (umiejętności) i **Gear** (wyposażenie). Tempo rozwoju jest ukryte. Po włączeniu opcji **Debug** (debugowanie) wyświetlają się dokładne wartości procentowe rozwoju.

Drużyna zdobywa poziomy za wygrane walki. Przegrana walka lub ucieczka nie daje doświadczenia. Gdy opcja **Permadeath** (trwała śmierć; opcja konfiguracji) jest włączona, członek drużyny, który padnie w walce i nie zostanie uratowany przed jej końcem, przepada na zawsze.

## Testy umiejętności

Testy poza walką odczytują statystyki MRPG postaci. Informacje o tym, z której statystyki korzysta każda umiejętność, znajdziesz w przewodniku [Rzuty kośćmi i testy umiejętności](dice-and-skill-checks.md#how-the-result-is-decided).

<a id="newcomers-to-the-party"></a>

## Nowi członkowie drużyny

Osoba, która dołącza po rozpoczęciu gry, wchodzi do niej na poziomie nadanym przez Game Master. Większość nowych członków zaczyna na niskim poziomie, ale doświadczony wojownik może zacząć blisko poziomu drużyny. Game Master może też dać nowej osobie:

- **Szybszy rozwój** niektórych statystyk, jeśli ma surowy talent i szybko nadrobi zaległości.
- **Lepsze statystyki początkowe**, jeśli już ma pewne doświadczenie.

Game Master decyduje o tym w chwili dołączenia postaci. Nowa osoba, o której nic nie powie, zaczyna na poziomie 1.

## Gra z innymi osobami

W grze współdzielonej każdy gość tworzy własną postać, gdy dołącza do pokoju: nadaje jej nazwę, opisuje ją, podaje **koncepcję postaci** dla mistrza gry oraz dokonuje tych samych wyborów w sekcji **Game Mode** co dla persony (drzewko początkowe, mocne statystyki i słaba statystyka). Wybranie jednej ze swoich person uzupełnia te pola jej danymi. W koncepcji mówisz mistrzowi gry, kim jest twoja postać i jak ma wejść do historii.

Następnie mistrz gry wpisuje postać w historię i wybiera jej siostrzane drzewko.

- **Nowa gra.** Wszyscy – gospodarz i goście – zaczynają na poziomie 1.
- **Gra już trwa.** Mistrz gry wybiera także poziom początkowy gościa i może dać mu szybszy rozwój lub lepsze statystyki, tak jak każdemu [nowemu członkowi drużyny](#newcomers-to-the-party).
- **Powracający gość.** Po wyjściu gościa jego postać pozostaje w grze wraz ze swoim poziomem, wyposażeniem i oswojonymi bestiami. Pod nieobecność gracza postać nie bierze udziału w walkach i nie zdobywa doświadczenia, a Game Master pomija ją w scenach. Po powrocie gość gra tą samą postacią na poziomie, na którym ją zostawił.

<a id="move-a-legacy-game-to-mrpg"></a>

## Przenoszenie gry Legacy do MRPG

Gra Legacy zachowuje swoje arkusze Legacy tak długo, jak chcesz. Aby ją przenieść, otwórz **Journal** (dziennik), a na zakładce **All** (wszystko) znajdź kartę **MRPG classes** (klasy MRPG). Wybierz **Upgrade** (ulepszenie).

Dla każdego członka drużyny karta pokazuje:

- **Class** (klasa). Drzewko początkowe, uzupełnione na podstawie wyboru na karcie z biblioteki albo, jeśli go nie ma, klasy Legacy. Możesz je zmienić.
- **Sister tree** (siostrzane drzewko). Drugie drzewko otwierane przez temperament postaci. Postać, która nie ma jeszcze temperamentu, podczas ulepszania otrzymuje temperament odczytany ze swojego opisu.
- **Gear** (wyposażenie). Każda broń i część pancerza Legacy noszona przez postać oraz element MRPG, w który się zmieni. Wyczyść pole wyboru, aby pozostawić dany element bez zmian.

Po potwierdzeniu przyciskiem **Upgrade the party** (ulepszenie drużyny):

- Każdy członek drużyny zaczyna na poziomie 10, czyli najwyższym poziomie swojej klasy początkowej, ze statystykami z każdego poziomu wylosowanymi tak jak przy zdobywaniu poziomu.
- Klasa na jego karcie zmienia się w klasę MRPG. Klasa i zdolności Legacy trafiają do notatki **Before the upgrade** (przed ulepszeniem) na karcie, dzięki czemu fabuła nadal je zna. Statystyki Legacy także pozostają na karcie.
- Każda zaakceptowana broń lub część pancerza zmienia się w swój odpowiednik MRPG i zachowuje nazwę, a postać zakłada ją, jeśli pozwala na to jej klasa.

> **Ostrzeżenie:** Ulepszenie jest jednokierunkowe. Gra przeniesiona do klas MRPG nie może wrócić do arkuszy Legacy.

Ulepszenie nie jest dostępne podczas walki. Najpierw zakończ walkę. Gry rozgrywanej z zestawem zasad nie można ulepszyć: zachowuje arkusze swojego zestawu zasad.

## Powiązane przewodniki

- [Game Mode: walka](combat.md)
- [Game Mode: drużyna i postacie NPC](party-and-npcs.md)
- [Game Mode: rzuty kośćmi i testy umiejętności](dice-and-skill-checks.md)
