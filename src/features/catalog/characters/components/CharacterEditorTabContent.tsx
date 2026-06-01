import type { CharacterData } from "../../../../engine/contracts/types/character";
import type { ImageGenerationConnectionOption } from "../../../../shared/types/image-generation";
import { CharacterAdvancedTab } from "./CharacterAdvancedTab";
import { CharacterColorsTab } from "./CharacterColorsTab";
import { CharacterDescriptionTab } from "./CharacterDescriptionTab";
import { CharacterDialogueTab } from "./CharacterDialogueTab";
import { CharacterGalleryTab } from "./CharacterGalleryTab";
import { CharacterLorebookTab } from "./CharacterLorebookTab";
import { CharacterMetadataTab } from "./CharacterMetadataTab";
import { CharacterSpritesTab } from "./CharacterSpritesTab";
import { CharacterStatsTab } from "./CharacterStatsTab";
import { CharacterTextareaTab } from "./CharacterTextareaTab";
import type { CharacterEditorTabId } from "./CharacterEditorTabRail";

type CharacterUpdateField = <K extends keyof CharacterData>(key: K, value: CharacterData[K]) => void;

type CharacterEditorTabContentProps = {
  activeTab: CharacterEditorTabId;
  characterId: string | null;
  formData: CharacterData;
  characterComment: string;
  updateField: CharacterUpdateField;
  updateExtension: (key: string, value: unknown) => void;
  newTag: string;
  setNewTag: (tag: string) => void;
  addTag: () => void;
  removeTag: (tag: string) => void;
  removeAllTags: () => void;
  avatarPreview: string | null;
  imageConnections: ImageGenerationConnectionOption[];
};

export function CharacterEditorTabContent({
  activeTab,
  characterId,
  formData,
  characterComment,
  updateField,
  updateExtension,
  newTag,
  setNewTag,
  addTag,
  removeTag,
  removeAllTags,
  avatarPreview,
  imageConnections,
}: CharacterEditorTabContentProps) {
  return (
    <div className="flex-1 overflow-y-auto p-6 @max-5xl:p-4">
      <div className="mx-auto max-w-2xl">
        {activeTab === "metadata" && (
          <CharacterMetadataTab
            characterId={characterId}
            formData={formData}
            characterComment={characterComment}
            updateField={updateField}
            updateExtension={updateExtension}
            newTag={newTag}
            setNewTag={setNewTag}
            addTag={addTag}
            removeTag={removeTag}
            removeAllTags={removeAllTags}
            avatarPreview={avatarPreview}
          />
        )}
        {activeTab === "description" && (
          <CharacterDescriptionTab formData={formData} updateField={updateField} updateExtension={updateExtension} />
        )}
        {activeTab === "personality" && (
          <CharacterTextareaTab
            title="Personality"
            subtitle="A concise summary of the character's personality traits, temperament, and behavioral patterns."
            value={formData.personality}
            onChange={(v) => updateField("personality", v)}
            placeholder="Energetic, curious, and fiercely loyal. Speaks in short bursts. Has a habit of…"
            rows={8}
          />
        )}
        {activeTab === "backstory" && (
          <CharacterTextareaTab
            title="Backstory"
            subtitle="The character's history, origin story, and formative life events."
            value={(formData.extensions.backstory as string) ?? ""}
            onChange={(v) => updateExtension("backstory", v)}
            placeholder="Born in a small village on the outskirts of the empire…"
            rows={12}
          />
        )}
        {activeTab === "appearance" && (
          <CharacterTextareaTab
            title="Appearance"
            subtitle="Detailed physical description — height, build, hair, eyes, clothing, distinguishing features."
            value={(formData.extensions.appearance as string) ?? ""}
            onChange={(v) => updateExtension("appearance", v)}
            placeholder="Tall and willowy with silver-streaked dark hair. Wears a battered leather coat over…"
            rows={8}
          />
        )}
        {activeTab === "scenario" && (
          <CharacterTextareaTab
            title="Scenario"
            subtitle="The default setting or situation where interactions take place."
            value={formData.scenario}
            onChange={(v) => updateField("scenario", v)}
            placeholder="A bustling port city during a trade festival. The streets are alive with merchants and performers…"
            rows={8}
          />
        )}
        {activeTab === "dialogue" && <CharacterDialogueTab formData={formData} updateField={updateField} />}
        {activeTab === "advanced" && (
          <CharacterAdvancedTab formData={formData} updateField={updateField} updateExtension={updateExtension} />
        )}
        {activeTab === "sprites" && characterId && (
          <CharacterSpritesTab
            characterId={characterId}
            defaultAppearance={(formData.extensions.appearance as string) ?? formData.description}
            defaultAvatarUrl={avatarPreview}
            imageConnections={imageConnections}
          />
        )}
        {activeTab === "gallery" && characterId && (
          <CharacterGalleryTab characterId={characterId} characterName={formData.name} />
        )}
        {activeTab === "colors" && (
          <CharacterColorsTab formData={formData} updateExtension={updateExtension} avatarUrl={avatarPreview} />
        )}
        {activeTab === "stats" && <CharacterStatsTab formData={formData} updateExtension={updateExtension} />}
        {activeTab === "lorebook" && <CharacterLorebookTab characterId={characterId} formData={formData} />}
      </div>
    </div>
  );
}
