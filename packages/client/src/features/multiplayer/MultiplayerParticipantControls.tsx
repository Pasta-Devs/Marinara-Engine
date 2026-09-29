import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  MULTIPLAYER_LIMITS,
  type MultiplayerAction,
  type MultiplayerHostAction,
  type MultiplayerPersona,
  type MultiplayerSnapshot,
} from "@marinara-engine/shared";
import { useCharacters } from "../../hooks/use-characters";
import { useMultiplayerMutation } from "../../hooks/use-multiplayer";
import { parseCharacterDisplayData } from "../../lib/character-display";
import { generateClientId } from "../../lib/utils";
import { MultiplayerPersonaFields, MULTIPLAYER_BUTTON_CLASS, MULTIPLAYER_INPUT_CLASS } from "./MultiplayerFields";
import { multiplayerGuestErrorLabelKey } from "./multiplayer-guest-labels";

/** Explicit local library selection; never mounted inside the isolated guest frame. */
export function MultiplayerParticipantControls({
  snapshot,
  onAction,
  host = false,
}: {
  snapshot: MultiplayerSnapshot;
  onAction: (action: MultiplayerAction) => Promise<boolean>;
  /** Local role, supplied by the trusted chat controller, never by peer player flags. */
  host?: boolean;
}) {
  const { t } = useTranslation();
  const { data: rawCharacters = [] } = useCharacters();
  const characters = rawCharacters.filter(
    (row): row is { id: string; data: unknown } => typeof row.id === "string" && "data" in row,
  );
  const [persona, setPersona] = useState<MultiplayerPersona>({ name: "", description: "" });
  const [character, setCharacter] = useState<MultiplayerPersona>({ name: "", description: "" });
  const [characterId, setCharacterId] = useState("");
  const hostAction = useMultiplayerMutation<unknown, MultiplayerHostAction>("/multiplayer/host/actions");
  const [gm, setGm] = useState(false);
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<"saved" | "failed" | null>(null);
  const run = async (action: MultiplayerAction) => {
    if (pending) return;
    setPending(true);
    setResult(null);
    try {
      setResult((await onAction(action)) ? "saved" : "failed");
    } catch {
      setResult("failed");
    } finally {
      setPending(false);
    }
  };
  return (
    <div className="space-y-4 p-3">
      <h2 className="text-sm font-semibold">{t("multiplayer.persona.change")}</h2>
      {snapshot.players.find((player) => player.id === snapshot.selfId)?.personaChangeRejected && (
        <p role="alert" className="text-xs text-[var(--destructive)]">
          {t(multiplayerGuestErrorLabelKey("identity-conflict"))}
        </p>
      )}
      <MultiplayerPersonaFields value={persona} onChange={setPersona} />
      <button
        type="button"
        className={MULTIPLAYER_BUTTON_CLASS}
        disabled={pending || !persona.name.trim()}
        onClick={() =>
          void run({ type: "set-persona", operationId: generateClientId(), sequence: snapshot.nextSequence, persona })
        }
      >
        {t("multiplayer.persona.share")}
      </button>
      <h2 className="border-t border-[var(--border)] pt-4 text-sm font-semibold">
        {t(host ? "multiplayer.character.add" : "multiplayer.character.propose")}
      </h2>
      <select
        className={MULTIPLAYER_INPUT_CLASS}
        defaultValue=""
        aria-label={t("multiplayer.character.choose")}
        onChange={(event) => {
          setCharacterId(event.target.value);
          const selected = characters.find((item) => item.id === event.target.value);
          if (!selected) return;
          const data = parseCharacterDisplayData(selected);
          setCharacter({
            name: typeof data.name === "string" ? data.name.slice(0, 80) : "",
            description:
              typeof data.description === "string" ? data.description.slice(0, MULTIPLAYER_LIMITS.description) : "",
          });
        }}
      >
        <option value="">{t("multiplayer.character.choose")}</option>
        {characters.map((item) => (
          <option key={item.id} value={item.id}>
            {parseCharacterDisplayData(item).name}
          </option>
        ))}
      </select>
      <label className="block space-y-1 text-xs">
        <span>{t("multiplayer.persona.name")}</span>
        <input
          value={character.name}
          readOnly={host}
          maxLength={80}
          className={MULTIPLAYER_INPUT_CLASS}
          onChange={(event) => setCharacter({ ...character, name: event.target.value })}
        />
      </label>
      <label className="block space-y-1 text-xs">
        <span>{t("multiplayer.persona.description")}</span>
        <textarea
          value={character.description}
          readOnly={host}
          maxLength={MULTIPLAYER_LIMITS.description}
          rows={4}
          className={MULTIPLAYER_INPUT_CLASS}
          onChange={(event) => setCharacter({ ...character, description: event.target.value })}
        />
      </label>
      <label className="flex items-center gap-2 text-xs">
        <input type="checkbox" checked={gm} onChange={(event) => setGm(event.target.checked)} />
        {t("multiplayer.guest.gm")}
      </label>
      <p className="text-xs leading-relaxed text-[var(--muted-foreground)]">
        {t(host ? "multiplayer.character.hostDisclosure" : "multiplayer.character.disclosure")}
      </p>
      <button
        type="button"
        className={MULTIPLAYER_BUTTON_CLASS}
        disabled={
          pending ||
          hostAction.isPending ||
          !character.name.trim() ||
          (host &&
            (!characterId ||
              snapshot.generation === "running" ||
              snapshot.characters.some((item) => item.id === characterId)))
        }
        onClick={() =>
          host
            ? hostAction.mutate({ type: "add-character", characterId, role: gm ? "gm" : "character" })
            : void run({
                type: "propose-character",
                operationId: generateClientId(),
                sequence: snapshot.nextSequence,
                character: { ...character, role: gm ? "gm" : "character" },
              })
        }
      >
        {t(host ? "multiplayer.character.add" : "multiplayer.character.submit")}
      </button>
      {(hostAction.isSuccess || hostAction.isError) && (
        <p role="status" className="text-xs">
          {t(hostAction.isError ? "multiplayer.actionFailed" : "multiplayer.character.added")}
        </p>
      )}
      {result && (
        <p role="status" className="text-xs">
          {t(result === "saved" ? "multiplayer.participant.saved" : "multiplayer.actionFailed")}
        </p>
      )}
    </div>
  );
}
