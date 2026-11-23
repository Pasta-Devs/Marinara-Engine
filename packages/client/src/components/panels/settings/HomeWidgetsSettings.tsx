// ──────────────────────────────────────────────
// Settings › General › Home: which widgets show on Home (new layout).
//
// Plain switch rows: built-in widgets, then each agent's widgets folded under its name, then personal
// widgets with an inline Edit and Delete. Home reads the same store, so a switch here changes Home at once.
// ──────────────────────────────────────────────
import { useState, type FormEvent } from "react";
import { ChevronRight, Pencil, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { HomeCustomWidget } from "@marinara-engine/shared";
import { showConfirmDialog } from "../../../lib/app-dialogs";
import { useUIStore } from "../../../stores/ui.store";
import {
  HOME_WIDGET_IDS,
  HOME_WIDGET_MANAGER_LABEL_KEYS,
  useHomeWidgetsStore,
  type HomeWidgetId,
} from "../../../stores/home-widgets.store";
import { useHomeWidgetCatalog } from "../../chat/use-home-widget-catalog";
import { Select } from "../../ui/Select";
import { ToggleSetting } from "./SettingControls";

export function HomeWidgetsSettings({ anchorId }: { anchorId?: string }) {
  const { t } = useTranslation();
  const visible = useHomeWidgetsStore((state) => state.visible);
  const setVisible = useHomeWidgetsStore((state) => state.setVisible);
  const achievementsEnabled = useUIStore((state) => state.achievementsEnabled);
  const { customWidgets, agentWidgetGroups, deleteCustomWidgetMutation, updateCustomWidgetMutation } =
    useHomeWidgetCatalog();
  const [editing, setEditing] = useState<HomeCustomWidget | null>(null);

  const toggle = (id: HomeWidgetId, on: boolean) =>
    setVisible((current) =>
      on ? (current.includes(id) ? current : [...current, id]) : current.filter((x) => x !== id),
    );

  const builtIn = HOME_WIDGET_IDS.filter((id) => achievementsEnabled || id !== "achievements");

  const deleteWidget = async (widget: HomeCustomWidget) => {
    const confirmed = await showConfirmDialog({
      title: t("home.widgets.deleteTitle", { widget: widget.title }),
      message: t("home.widgets.deleteDescription"),
      confirmLabel: t("home.widgets.delete"),
      cancelLabel: t("chat.delete.dialog.cancel"),
      tone: "destructive",
    });
    if (!confirmed) return;
    await deleteCustomWidgetMutation.mutateAsync(widget.id);
    if (editing?.id === widget.id) setEditing(null);
  };

  const saveEdit = (event: FormEvent) => {
    event.preventDefault();
    if (!editing) return;
    void updateCustomWidgetMutation
      .mutateAsync(editing)
      .then(() => setEditing(null))
      .catch(() => {});
  };

  return (
    <div id={anchorId} className="ov-homew flex scroll-mt-3 flex-col">
      <p className="ov-homew__group">{t("home.widgets.builtInGroup")}</p>
      {builtIn.map((id) => {
        const keys = HOME_WIDGET_MANAGER_LABEL_KEYS[id];
        return (
          <ToggleSetting
            key={id}
            label={t(keys.name)}
            help={t(keys.purpose)}
            checked={visible.includes(id)}
            onChange={(on) => toggle(id, on)}
          />
        );
      })}

      {agentWidgetGroups.length > 0 ? (
        <>
          <p className="ov-homew__group">{t("home.widgets.agentsGroup")}</p>
          {agentWidgetGroups.map((group) =>
            group.widgets.length === 1 ? (
              <ToggleSetting
                key={group.id}
                label={t("home.widgets.managerLabel", { name: group.name, purpose: group.widgets[0]!.label })}
                checked={visible.includes(group.widgets[0]!.id)}
                onChange={(on) => toggle(group.widgets[0]!.id, on)}
              />
            ) : (
              <details key={group.id} className="ov-homew__agent">
                <summary className="ov-homew__summary">
                  <ChevronRight size="0.875rem" className="ov-homew__chev" aria-hidden="true" />
                  <span className="min-w-0 flex-1 truncate">{group.name}</span>
                  <span className="ov-homew__count">
                    {t("settings.homeWidgets.shownCount", {
                      shown: group.widgets.filter((widget) => visible.includes(widget.id)).length,
                      count: group.widgets.length,
                    })}
                  </span>
                </summary>
                <div className="ov-homew__agent-body">
                  {group.widgets.map((widget) => (
                    <ToggleSetting
                      key={widget.id}
                      label={widget.label}
                      checked={visible.includes(widget.id)}
                      onChange={(on) => toggle(widget.id, on)}
                    />
                  ))}
                </div>
              </details>
            ),
          )}
        </>
      ) : null}

      {customWidgets.length > 0 ? (
        <>
          <p className="ov-homew__group">{t("home.widgets.personalGroup")}</p>
          {customWidgets.map((widget) => {
            const id = `custom:${widget.id}` as HomeWidgetId;
            const open = editing?.id === widget.id;
            return (
              <div key={widget.id} className="ov-homew__personal">
                <ToggleSetting
                  label={widget.title}
                  checked={visible.includes(id)}
                  onChange={(on) => toggle(id, on)}
                  endAction={
                    <span className="flex items-center gap-1">
                      <button
                        type="button"
                        className="ov-btn ov-btn--icon"
                        aria-expanded={open}
                        aria-label={t("home.widgets.editLabel", { widget: widget.title })}
                        title={t("home.widgets.editLabel", { widget: widget.title })}
                        onClick={() => {
                          updateCustomWidgetMutation.reset();
                          setEditing(open ? null : widget);
                        }}
                      >
                        <Pencil size="0.8125rem" aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        className="ov-btn ov-btn--icon ov-btn--danger"
                        disabled={deleteCustomWidgetMutation.isPending}
                        aria-label={t("home.widgets.deleteLabel", { widget: widget.title })}
                        title={t("home.widgets.deleteLabel", { widget: widget.title })}
                        onClick={() => void deleteWidget(widget)}
                      >
                        <Trash2 size="0.8125rem" aria-hidden="true" />
                      </button>
                    </span>
                  }
                />
                {open && editing ? (
                  <form className="ov-homew__edit" onSubmit={saveEdit}>
                    <label className="ov-homew__field">
                      <span>{t("home.widgets.editName")}</span>
                      <input
                        required
                        maxLength={80}
                        value={editing.title}
                        onChange={(event) => setEditing({ ...editing, title: event.target.value })}
                      />
                    </label>
                    <label className="ov-homew__field">
                      <span>{t("home.widgets.editDescription")}</span>
                      <textarea
                        required
                        maxLength={500}
                        rows={3}
                        value={editing.description}
                        onChange={(event) => setEditing({ ...editing, description: event.target.value })}
                      />
                    </label>
                    <div className="ov-homew__pair">
                      <div className="ov-homew__field">
                        <span>{t("home.widgets.editAccent")}</span>
                        <Select<HomeCustomWidget["accent"]>
                          label={t("home.widgets.editAccent")}
                          value={editing.accent}
                          options={(["cyan", "orange", "pink", "violet"] as const).map((accent) => ({
                            value: accent,
                            label: t(`home.widgets.accent.${accent}`),
                          }))}
                          onChange={(accent) => setEditing({ ...editing, accent })}
                        />
                      </div>
                      <div className="ov-homew__field">
                        <span>{t("home.widgets.editIcon")}</span>
                        <Select<HomeCustomWidget["icon"]>
                          label={t("home.widgets.editIcon")}
                          value={editing.icon}
                          options={(["sparkles", "note", "heart", "star", "book", "compass"] as const).map((icon) => ({
                            value: icon,
                            label: t(`home.widgets.icon.${icon}`),
                          }))}
                          onChange={(icon) => setEditing({ ...editing, icon })}
                        />
                      </div>
                    </div>
                    {updateCustomWidgetMutation.isError ? (
                      <p role="alert" className="text-xs text-[var(--destructive)]">
                        {t("home.widgets.editFailed")}
                      </p>
                    ) : null}
                    <div className="ov-homew__actions">
                      <button type="button" className="ov-btn is-quiet" onClick={() => setEditing(null)}>
                        {t("chat.delete.dialog.cancel")}
                      </button>
                      <button
                        type="submit"
                        className="ov-btn ov-btn--primary"
                        disabled={updateCustomWidgetMutation.isPending}
                      >
                        {t("home.widgets.save")}
                      </button>
                    </div>
                  </form>
                ) : null}
              </div>
            );
          })}
        </>
      ) : null}
    </div>
  );
}
