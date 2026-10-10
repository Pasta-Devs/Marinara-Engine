import { useState, type CSSProperties } from "react";
import { useMariAppearancePack } from "../../hooks/use-mari-appearance-pack";
import { useMariSpriteSource } from "../../lib/mari-sprite-ready";
import { MariHold } from "./mari/MariHold";
import type { MariStoryState } from "../../lib/mari-work-animations";
import "./mari-appearance.css";

/**
 * One story, then a resting pose. The surrounding UI supplies the status text. With `settleTo`, the
 * story plays once and then that one takes over (a finished run: success, then idle).
 *
 * M17: she is also the present Mari the pull-to-open circle morphs into (`mari-current`). Exactly one
 * Mari sprite is on screen at a time, by construction: the live-line `MariSprite` while a run is live
 * (the transcript's `latestTurnRestStory` is null then), else the one resting beside the newest reply
 * (only the latest turn gets a `restStory`), else the arrival/welcome one (only in an empty chat), else
 * (D1) an appended arrival at the bottom of an existing transcript — callers pass `pullTarget={false}`
 * on the other sprites while one is shown, so the marker still only ever sits on one element.
 */
export function MariStorySprite({
  state,
  settleTo,
  pullTarget = true,
}: {
  state: MariStoryState;
  settleTo?: MariStoryState;
  pullTarget?: boolean;
}) {
  const pack = useMariAppearancePack();
  const [settled, setSettled] = useState(false);
  const shown = settled && settleTo ? settleTo : state;
  const sheet = useMariSpriteSource(pack.stories[shown].src);
  return (
    <MariHold heldSrc={pack.portraits.drag} hopOnTap>
      <span
        className="mari-story-sprite"
        data-state={shown}
        data-appearance-pack={pack.id}
        data-mari-pull-target={pullTarget ? "mari-current" : undefined}
        data-mari-sheet={sheet.ready ? "ready" : "pending"}
        aria-hidden="true"
      >
        <span
          key={`${pack.id}:${shown}`}
          style={{ "--mari-work-sprite": `url(${sheet.src})` } as CSSProperties}
          onAnimationEnd={settleTo ? () => setSettled(true) : undefined}
        />
        {/* Slice 85 hover: the pointer rests on her, so her portrait takes the same 2:3 box (mouse only). */}
        <img className="mari-story-sprite__hover" src={pack.portraits.hover} alt="" draggable={false} />
      </span>
    </MariHold>
  );
}
