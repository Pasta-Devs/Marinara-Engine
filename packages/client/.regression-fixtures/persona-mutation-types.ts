import type { PersonaUpdateInput, TrackerCardColorConfig } from "@marinara-engine/shared";
import { useUpdatePersona, useUpdatePersonaTrackerCard } from "../src/hooks/use-characters";

declare const sharedUpdate: PersonaUpdateInput;
declare const paint: TrackerCardColorConfig;

type Generic = Parameters<ReturnType<typeof useUpdatePersona>["mutate"]>[0];
type Shared = Pick<Generic, keyof PersonaUpdateInput>;
type Assert<T extends true> = T;
type Assignable<A, B> = [A] extends [B] ? true : false;

export function useMutationTypeContract() {
  const equivalent: [Assert<Assignable<Shared, PersonaUpdateInput>>, Assert<Assignable<PersonaUpdateInput, Shared>>] = [
    true,
    true,
  ];
  void equivalent;

  const generic = useUpdatePersona();
  generic.mutate({ id: "persona", ...sharedUpdate, characterSheetImageId: null, useCharacterSheetAsReference: true });

  const tracker = useUpdatePersonaTrackerCard();
  tracker.mutate({ id: "persona", trackerCardPaint: paint });
  tracker.mutate({
    id: "persona",
    keepalive: true,
    trackerCardPortrait: { portraitFocusX: 0.5, portraitFocusY: 0.5, portraitZoom: 1 },
  });

  // @ts-expect-error paint and portrait are XOR
  tracker.mutate({
    id: "persona",
    trackerCardPaint: paint,
    trackerCardPortrait: { portraitFocusX: 0.5, portraitFocusY: 0.5, portraitZoom: 1 },
  });
  // @ts-expect-error generic endpoint excludes tracker fields
  generic.mutate({ id: "persona", trackerCardPaint: paint });
  // @ts-expect-error tracker endpoint excludes generic fields
  tracker.mutate({ id: "persona", name: "Mari", trackerCardPaint: paint });
}
