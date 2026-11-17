import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { PERSONAL_EXTENSION_UI_LIMITS, type PersonalExtensionUiElement } from "@marinara-engine/shared";
import { useUIStore } from "../../stores/ui.store";
import {
  dispatchPersonalExtensionContributionEvent,
  usePersonalExtensionContributions,
} from "../../lib/personal-extension-contributions";
import { Checkbox } from "../ui/Checkbox";
import { ColorField } from "../ui/ColorPicker";
import { Select } from "../ui/Select";

type InteractiveElement = Extract<PersonalExtensionUiElement, { id: string }>;

function inputDefaults(elements: readonly PersonalExtensionUiElement[]) {
  return Object.fromEntries(
    elements.flatMap((element) => {
      if (element.kind === "input") return [[element.id, element.value ?? ""]];
      if (element.kind === "select") return [[element.id, element.value ?? element.options[0]?.value ?? ""]];
      if (element.kind === "toggle") return [[element.id, String(Boolean(element.checked))]];
      if (element.kind === "slider") return [[element.id, String(element.value ?? element.min)]];
      if (element.kind === "color") return [[element.id, element.value ?? "#808080"]];
      return [];
    }),
  );
}

function isInteractiveElement(element: PersonalExtensionUiElement): element is InteractiveElement {
  return (
    element.kind === "button" ||
    element.kind === "input" ||
    element.kind === "select" ||
    element.kind === "toggle" ||
    element.kind === "slider" ||
    element.kind === "color"
  );
}

export function PersonalExtensionPanel() {
  const { t } = useTranslation();
  const closeRightPanel = useUIStore((state) => state.closeRightPanel);
  const { contributions, activePanelKey } = usePersonalExtensionContributions();
  const contribution = contributions.find(
    (candidate) => candidate.key === activePanelKey && candidate.kind === "panel",
  );
  const elements = useMemo(() => contribution?.elements ?? [], [contribution?.elements]);
  const defaults = useMemo(() => inputDefaults(elements), [elements]);
  const defaultsKey = JSON.stringify(defaults);
  const defaultsRef = useRef(defaults);
  defaultsRef.current = defaults;
  const [values, setValues] = useState<Record<string, string>>(() => defaults);

  useEffect(() => {
    setValues(defaultsRef.current);
  }, [activePanelKey, defaultsKey]);

  useEffect(() => {
    if (!activePanelKey || contribution) return;
    closeRightPanel();
  }, [activePanelKey, closeRightPanel, contribution]);

  if (!contribution) {
    return (
      <div className="flex h-full items-center justify-center px-6 text-center text-sm text-[var(--muted-foreground)]">
        {t("extensions.contributions.panelUnavailable")}
      </div>
    );
  }

  return (
    <div className="flex min-h-full flex-col gap-3 p-4">
      {contribution.description && (
        <p className="max-w-[70ch] text-xs leading-5 text-[var(--muted-foreground)]">{contribution.description}</p>
      )}
      <div className="flex flex-col gap-3">
        {elements.map((element, index) => {
          const key = isInteractiveElement(element) ? element.id : `${element.kind}-${index}`;
          if (element.kind === "spacer") return <div key={key} aria-hidden="true" className="h-1" />;
          if (element.kind === "heading") {
            return (
              <h3 key={key} className="text-base font-semibold leading-snug text-[var(--foreground)]">
                {element.text}
              </h3>
            );
          }
          if (element.kind === "text") {
            return (
              <p key={key} className="whitespace-pre-wrap break-words text-sm leading-5 text-[var(--foreground)]">
                {element.text}
              </p>
            );
          }
          if (element.kind === "pre") {
            return (
              <pre
                key={key}
                className="max-h-72 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-[var(--secondary)] p-3 font-mono text-xs leading-5 text-[var(--foreground)]"
              >
                {element.text}
              </pre>
            );
          }
          if (element.kind === "input") {
            const fieldClass =
              "min-h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--input)] px-3 py-2 text-sm text-[var(--foreground)] outline-none transition-colors placeholder:text-[var(--muted-foreground)] focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/25";
            return (
              <label key={key} className="flex flex-col gap-1.5 text-xs font-semibold text-[var(--foreground)]">
                {element.label && <span>{element.label}</span>}
                {element.multiline ? (
                  <textarea
                    rows={5}
                    maxLength={PERSONAL_EXTENSION_UI_LIMITS.textLength}
                    placeholder={element.placeholder}
                    aria-label={element.label ? undefined : (element.placeholder ?? element.id)}
                    value={values[element.id] ?? ""}
                    onChange={(event) =>
                      setValues((current) => ({ ...current, [element.id]: event.currentTarget.value }))
                    }
                    className={fieldClass}
                  />
                ) : (
                  <input
                    type="text"
                    maxLength={PERSONAL_EXTENSION_UI_LIMITS.textLength}
                    placeholder={element.placeholder}
                    aria-label={element.label ? undefined : (element.placeholder ?? element.id)}
                    value={values[element.id] ?? ""}
                    onChange={(event) =>
                      setValues((current) => ({ ...current, [element.id]: event.currentTarget.value }))
                    }
                    className={fieldClass}
                  />
                )}
              </label>
            );
          }
          if (element.kind === "select") {
            return (
              <div key={key} className="flex flex-col gap-1.5 text-xs font-semibold text-[var(--foreground)]">
                {element.label && <label htmlFor={`extension-field-${element.id}`}>{element.label}</label>}
                <Select
                  id={`extension-field-${element.id}`}
                  label={element.label || element.id}
                  value={values[element.id] ?? element.options[0]?.value ?? ""}
                  onChange={(next) => setValues((current) => ({ ...current, [element.id]: next }))}
                  className="min-h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--input)] px-3 py-2 text-sm text-[var(--foreground)] outline-none transition-colors focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/25"
                  options={element.options.map((option) => ({ value: option.value, label: option.label }))}
                />
              </div>
            );
          }
          if (element.kind === "toggle") {
            return (
              <label
                key={key}
                className="flex min-h-10 items-center justify-between gap-3 rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm text-[var(--foreground)]"
              >
                <span>{element.label}</span>
                <Checkbox
                  checked={values[element.id] === "true"}
                  onChange={(event) =>
                    setValues((current) => ({ ...current, [element.id]: String(event.currentTarget.checked) }))
                  }
                  className="h-5 w-5 shrink-0 accent-[var(--primary)]"
                />
              </label>
            );
          }
          if (element.kind === "slider") {
            return (
              <label key={key} className="flex flex-col gap-1.5 text-xs font-semibold text-[var(--foreground)]">
                <span className="flex items-center justify-between gap-3">
                  <span>{element.label}</span>
                  <output className="font-mono text-[var(--muted-foreground)]">{values[element.id]}</output>
                </span>
                <input
                  type="range"
                  min={element.min}
                  max={element.max}
                  step={element.step}
                  value={values[element.id] ?? element.min}
                  onChange={(event) =>
                    setValues((current) => ({ ...current, [element.id]: event.currentTarget.value }))
                  }
                  className="min-h-10 w-full accent-[var(--primary)]"
                />
              </label>
            );
          }
          if (element.kind === "color") {
            return (
              <div
                key={key}
                className="flex min-h-10 items-center justify-between gap-3 rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm font-semibold text-[var(--foreground)]"
              >
                <span>{element.label}</span>
                <ColorField
                  value={values[element.id] ?? "#808080"}
                  onChange={(color) => setValues((current) => ({ ...current, [element.id]: color }))}
                  label={element.label ?? element.id}
                />
              </div>
            );
          }
          if (element.kind === "button") {
            return (
              <button
                key={key}
                type="button"
                onClick={() => dispatchPersonalExtensionContributionEvent(contribution.key, element.id, values)}
                className="min-h-10 self-start rounded-lg bg-[var(--primary)] px-4 py-2 text-xs font-semibold text-[var(--primary-foreground)] transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)] active:scale-[0.98]"
              >
                {element.label}
              </button>
            );
          }
          return null;
        })}
      </div>
      <p className="mt-auto border-t border-[var(--border)] pt-3 text-[0.6875rem] text-[var(--muted-foreground)]">
        {t("extensions.contributions.sandboxed", { name: contribution.extensionName })}
      </p>
    </div>
  );
}
