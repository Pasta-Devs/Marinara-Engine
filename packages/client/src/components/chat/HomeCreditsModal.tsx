import { ExternalLink } from "lucide-react";
import { Modal } from "../ui/Modal";

const CONTRIBUTORS = [
  { login: "SpicyMarinara", url: "https://github.com/SpicyMarinara", contributions: 497 },
  { login: "cha1latte", url: "https://github.com/cha1latte", contributions: 319 },
  { login: "LukaTheHero", url: "https://github.com/LukaTheHero", contributions: 86 },
  { login: "Romuromylus", url: "https://github.com/Romuromylus", contributions: 77 },
  { login: "TheLonelyDevil9", url: "https://github.com/TheLonelyDevil9", contributions: 66 },
  { login: "Xelvanis", url: "https://github.com/Xelvanis", contributions: 66 },
  { login: "Promansis", url: "https://github.com/Promansis", contributions: 64 },
  { login: "coxde", url: "https://github.com/coxde", contributions: 60 },
  { login: "kolacheee", url: "https://github.com/kolacheee", contributions: 15 },
  { login: "aeriondyseti", url: "https://github.com/aeriondyseti", contributions: 14 },
  { login: "Copilot", url: "https://github.com/apps/copilot-swe-agent", contributions: 13 },
  { login: "Minsklatte", url: "https://github.com/Minsklatte", contributions: 12 },
  { login: "JorgeLTE", url: "https://github.com/JorgeLTE", contributions: 11 },
  { login: "munimunigamer", url: "https://github.com/munimunigamer", contributions: 11 },
  { login: "loungemeister", url: "https://github.com/loungemeister", contributions: 9 },
  { login: "NeoKazuya", url: "https://github.com/NeoKazuya", contributions: 7 },
  { login: "felorhik", url: "https://github.com/felorhik", contributions: 6 },
  { login: "amauragis", url: "https://github.com/amauragis", contributions: 5 },
  { login: "mm14141", url: "https://github.com/mm14141", contributions: 5 },
  { login: "marysia", url: "https://github.com/marysia", contributions: 4 },
  { login: "jake9000", url: "https://github.com/jake9000", contributions: 4 },
  { login: "LightD31", url: "https://github.com/LightD31", contributions: 3 },
  { login: "Lochalan", url: "https://github.com/Lochalan", contributions: 2 },
  { login: "ailthrim", url: "https://github.com/ailthrim", contributions: 2 },
  { login: "adunato", url: "https://github.com/adunato", contributions: 2 },
  { login: "Trade-Mottoes", url: "https://github.com/Trade-Mottoes", contributions: 2 },
  { login: "RaynoldVanHeyningen", url: "https://github.com/RaynoldVanHeyningen", contributions: 2 },
  { login: "OnlyJimmy", url: "https://github.com/OnlyJimmy", contributions: 2 },
  { login: "MagicGoddess", url: "https://github.com/MagicGoddess", contributions: 2 },
  { login: "Javedz678", url: "https://github.com/Javedz678", contributions: 2 },
  { login: "Morgul", url: "https://github.com/Morgul", contributions: 2 },
  { login: "BahamutRU", url: "https://github.com/BahamutRU", contributions: 2 },
  { login: "Anarchistcowboy", url: "https://github.com/Anarchistcowboy", contributions: 1 },
  { login: "DarthTheMonster", url: "https://github.com/DarthTheMonster", contributions: 1 },
  { login: "Dinokin", url: "https://github.com/Dinokin", contributions: 1 },
  { login: "Gunterlie", url: "https://github.com/Gunterlie", contributions: 1 },
  { login: "Rafa-Ross", url: "https://github.com/Rafa-Ross", contributions: 1 },
  { login: "kevin-ho", url: "https://github.com/kevin-ho", contributions: 1 },
  { login: "pwildani", url: "https://github.com/pwildani", contributions: 1 },
  { login: "vanta-jack", url: "https://github.com/vanta-jack", contributions: 1 },
  { login: "Yasyasyasvil", url: "https://github.com/Yasyasyasvil", contributions: 1 },
  { login: "taiman724", url: "https://github.com/taiman724", contributions: 1 },
  { login: "smurfboyyessir", url: "https://github.com/smurfboyyessir", contributions: 1 },
];

const SPECIAL_THANKS = [
  "Xel",
  "Jorge",
  "Cha1latte",
  "Javedz678",
  "Teuku",
  "Shadota",
  "Romu",
  "Mm14141",
  "MagicGoddess",
  "John",
  "Pwildani",
  "Felor",
  "MuniMuni",
  "Guybrush01",
  "Joshellis625",
  "LukaTheHero",
  "Coxde",
  "JorgeLTE",
  "Seele The Seal King",
  "Loungemeister",
  "Kale",
  "Tabris",
  "GREGOR OVECH",
  "Coins",
  "Tacoman",
  "Promansis",
  "Kitsumiro",
  "Sheep",
  "Pod042",
  "Prolix",
  "PlutoMayhem",
  "Mezzeh",
  "Kuc0",
  "Exalted",
  "Yang Best Girl",
  "MidnightSleeper",
  "Geechan",
  "TheLonelyDevil",
  "Artus",
  "and you",
];

export function HomeCreditsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal open={open} onClose={onClose} title="Credits" width="max-w-2xl">
      <div className="space-y-5">
        <section className="space-y-2">
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
              GitHub Contributors
            </h3>
            <p className="mt-1 text-xs text-[var(--muted-foreground)]">
              Current contributors from the Marinara Engine GitHub repository.
            </p>
          </div>
          <div className="grid max-h-[18rem] grid-cols-1 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
            {CONTRIBUTORS.map((contributor) => (
              <a
                key={contributor.login}
                href={contributor.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex min-w-0 items-center justify-between gap-2 rounded-lg border border-[var(--border)] bg-[var(--secondary)]/35 px-3 py-2 text-xs transition-colors hover:border-[var(--primary)]/40 hover:bg-[var(--accent)]"
              >
                <span className="min-w-0 truncate font-medium text-[var(--foreground)]">{contributor.login}</span>
                <span className="inline-flex shrink-0 items-center gap-1 text-[0.6875rem] text-[var(--muted-foreground)] group-hover:text-[var(--primary)]">
                  {contributor.contributions}
                  <ExternalLink size="0.75rem" />
                </span>
              </a>
            ))}
          </div>
        </section>

        <section className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
            Special Thanks
          </h3>
          <p className="text-xs leading-relaxed text-[var(--muted-foreground)]">{SPECIAL_THANKS.join(", ")}.</p>
        </section>
      </div>
    </Modal>
  );
}
