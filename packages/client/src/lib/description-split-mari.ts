import { requestProfessorMariOpen } from "./professor-mari-open";

/** Opens Professor Mari on a saved character with a request to split its description; nothing is sent until the user does. */
export function requestMariDescriptionSplit(character: { id: string; name: string }, draft: string) {
  requestProfessorMariOpen({
    destination: "omnibar",
    draft,
    context: {
      source: "character-editor",
      capability: "edit",
      resource: { kind: "character", id: character.id, label: character.name },
      field: "description",
    },
  });
}
