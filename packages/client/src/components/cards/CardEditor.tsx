import type { ChangeEventHandler, CSSProperties, ReactNode, RefObject } from "react";
import { ArrowDown, ArrowLeft, ArrowUp, Save, User } from "lucide-react";
import { cn } from "../../lib/utils";
import { EditorTabNavigation, type EditorTabItem } from "../ui/EditorTabNavigation";
import { useTranslation } from "react-i18next";

interface CardEditorProps<T extends string> {
  variant: "character" | "persona";

  onBack: () => void;
  busy?: boolean;

  name: string;
  onNameChange: (name: string) => void;
  comment: string;
  onCommentChange: (comment: string) => void;
  creator?: string | null;
  version?: string | null;

  avatarUrl?: string | null;
  avatarCropStyle?: CSSProperties;
  avatarActions?: ReactNode;
  fileInputRef: RefObject<HTMLInputElement | null>;
  onAvatarFileChange: ChangeEventHandler<HTMLInputElement>;

  tabs: readonly EditorTabItem<T>[];
  activeTab: T;
  onTabChange: (id: T) => void;

  saveLabel: string;
  saveDisabled?: boolean;
  saveButtonClassName: string;
  onSave: () => void;

  contentRef: RefObject<HTMLDivElement | null>;
  workingOffscreen?: "above" | "below" | null;
  onRevealWorkingField: () => void;
  children: ReactNode;

  actionsSlot?: ReactNode;
  wrapContent?: (content: ReactNode) => ReactNode;
}

export function CardEditor<T extends string>({
  variant,
  onBack,
  busy = false,
  name,
  onNameChange,
  comment,
  onCommentChange,
  creator,
  version,
  avatarUrl,
  avatarCropStyle,
  avatarActions,
  fileInputRef,
  onAvatarFileChange,
  tabs,
  activeTab,
  onTabChange,
  saveLabel,
  saveDisabled = false,
  saveButtonClassName,
  onSave,
  contentRef,
  workingOffscreen,
  onRevealWorkingField,
  children,
  actionsSlot,
  wrapContent,
}: CardEditorProps<T>) {
  const { t } = useTranslation();
  const character = variant === "character";
  const resolvedVersion = version || "1.0";
  const creatorText = creator
    ? t(character ? "ui.characters.charactereditor.byValue1" : "ui.personas.personaeditor.byValue1", {
        value1: creator,
      })
    : t(character ? "ui.characters.charactereditor.noCreator" : "ui.personas.personaeditor.noCreator");
  const versionText =
    t(character ? "ui.characters.charactereditor.v" : "ui.personas.personaeditor.v") + resolvedVersion;
  const bylineTitle = t(
    character ? "ui.characters.charactereditor.value1VValue2" : "ui.personas.personaeditor.value1VValue2",
    { value1: creatorText, value2: resolvedVersion },
  );
  const nameLabel = t(
    character ? "ui.characters.charactereditor.characterName" : "ui.personas.personaeditor.personaName",
  );
  const commentLabel = t(
    character
      ? "ui.characters.charactereditor.titleCommentEGModernAuVersion"
      : "ui.personas.personaeditor.titleCommentEGModernAuVersion",
  );
  const content = (
    <div ref={contentRef} className="mari-editor-content @max-5xl:p-4">
      <div className="mari-editor-content-inner">{children}</div>
    </div>
  );

  return (
    <>
      <div
        className={cn(
          "mari-editor-header mari-editor-header--with-nav mari-editor-header--card",
          variant === "character" && "mari-editor-header--dense",
        )}
      >
        <div className="mari-editor-header-main mari-editor-header-main--identity">
          <button
            type="button"
            onClick={onBack}
            disabled={busy}
            className="mari-editor-action inline-flex disabled:cursor-not-allowed disabled:opacity-50"
            title={t("ui.noodle.noodlerframe.back")}
            aria-label={t("ui.noodle.noodlerframe.back")}
          >
            <ArrowLeft size="1.125rem" />
          </button>

          {/* Avatar */}
          <div
            className={cn(
              "mari-editor-avatar-tile group relative",
              !avatarUrl && `mari-avatar-placeholder mari-avatar-placeholder--${variant}`,
              busy && "pointer-events-none opacity-60",
            )}
          >
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={busy}
              className="absolute inset-0 overflow-hidden rounded-[inherit]"
              aria-label={t("editor.avatar.upload")}
            >
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={name}
                  className="pointer-events-none h-full w-full object-cover"
                  style={avatarCropStyle}
                />
              ) : (
                <span className="flex h-full w-full items-center justify-center">
                  <User size="1.375rem" className="text-white" />
                </span>
              )}
            </button>
            {avatarActions}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="sr-only"
              tabIndex={-1}
              disabled={busy}
              onChange={onAvatarFileChange}
            />
          </div>

          <div className="min-w-0 flex-1">
            <div className="mari-editor-title-line">
              <input
                value={name}
                onChange={(event) => onNameChange(event.target.value)}
                onBlur={() => {
                  const trimmedName = name.trim();
                  if (character && trimmedName !== name) onNameChange(trimmedName);
                }}
                className="mari-editor-title-input"
                data-mari-field="name"
                title={name || undefined}
                aria-label={nameLabel}
                placeholder={nameLabel}
                size={Math.max(1, Math.min(name.length || (character ? 14 : 12), 80))}
              />
              <p className="mari-editor-meta mari-editor-byline" title={bylineTitle}>
                <span className="mari-editor-byline-creator">{creatorText}</span>
                <span aria-hidden="true">·</span>
                <span className="mari-editor-byline-version">{versionText}</span>
              </p>
            </div>
            <div className="mari-editor-secondary-line">
              <input
                value={comment}
                onChange={(event) => onCommentChange(event.target.value)}
                className="mari-editor-subtitle-input"
                aria-label={commentLabel}
                placeholder={commentLabel}
              />
            </div>
          </div>
        </div>

        <EditorTabNavigation tabs={tabs} activeId={activeTab} onChange={onTabChange} />

        <div className="mari-editor-actions flex">
          <button
            type="button"
            onClick={onSave}
            disabled={saveDisabled}
            className={saveButtonClassName}
            aria-label={saveLabel}
            title={saveLabel}
          >
            <Save size="0.9375rem" />
            <span className="mari-editor-save-label">{saveLabel}</span>
          </button>
          {actionsSlot}
        </div>
      </div>

      {/* Body */}
      <div className="mari-editor-body relative">
        {workingOffscreen && (
          <button
            type="button"
            className="mari-topbar-status mari-field-chip"
            data-state="working"
            data-edge={workingOffscreen}
            onClick={onRevealWorkingField}
          >
            {workingOffscreen === "above" ? (
              <ArrowUp size="0.75rem" aria-hidden="true" />
            ) : (
              <ArrowDown size="0.75rem" aria-hidden="true" />
            )}
            {t("ui.characters.charactereditor.mariIsHere")}
          </button>
        )}
        {wrapContent ? wrapContent(content) : content}
      </div>
    </>
  );
}
