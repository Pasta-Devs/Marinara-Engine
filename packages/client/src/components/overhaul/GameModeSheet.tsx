// ──────────────────────────────────────────────
// UI overhaul: the Game Mode sheet (persona and character editors)
//
// Attributes as a grid of small tiles, pools and tracker stat bars as dense
// tables with a live bar preview. Shows today's fields only; Game Mode stats
// are being reworked in the app.
// ──────────────────────────────────────────────
import type { ReactNode } from "react";
import { Plus, X } from "lucide-react";
import { useLocalizedUiText } from "../../localization/use-localized-ui-text";
import { cn } from "../../lib/utils";

type Attr = { name: string; value: number };
type Meter = { name: string; value: number; max: number; color: string };

export function OvSwitch({ on, onChange, label }: { on: boolean; onChange: (next: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      className={cn("ov-switch", on && "is-on")}
      onClick={(event) => {
        event.stopPropagation();
        onChange(!on);
      }}
    >
      <span />
    </button>
  );
}

function num(value: string, min: number) {
  const parsed = parseInt(value, 10);
  return Number.isFinite(parsed) ? Math.max(min, parsed) : min;
}

function MeterBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  return (
    <span className="ov-meter" aria-hidden="true">
      <span style={{ width: `${pct}%`, background: color }} />
    </span>
  );
}

function Eyebrow({
  title,
  note,
  on,
  onToggle,
}: {
  title: string;
  note?: string;
  on?: boolean;
  onToggle?: (next: boolean) => void;
}) {
  const localize = useLocalizedUiText();
  return (
    <div className="ov-sheet__eyebrow">
      {onToggle ? <OvSwitch on={!!on} onChange={onToggle} label={localize(title)} /> : null}
      <span>{localize(title)}</span>
      {note ? <small>· {localize(note)}</small> : null}
    </div>
  );
}

export function GameModeSheet({
  rpgEnabled,
  onRpgEnabled,
  attributes,
  onAttributeChange,
  onAddAttribute,
  onRemoveAttribute,
  pools,
  onPoolChange,
  onAddPool,
  onRemovePool,
  barsEnabled,
  onBarsEnabled,
  bars,
  onBarChange,
  onAddBar,
  onRemoveBar,
  renderBarIcon,
  renderPoolIcon,
  barsNote = "shown on your Tracker Panel card",
  footer,
}: {
  rpgEnabled: boolean;
  onRpgEnabled: (next: boolean) => void;
  attributes: Attr[];
  onAttributeChange: (index: number, patch: Partial<Attr>) => void;
  onAddAttribute: () => void;
  onRemoveAttribute: (index: number) => void;
  pools: Meter[];
  onPoolChange: (index: number, patch: Partial<Meter>) => void;
  onAddPool: () => void;
  onRemovePool: (index: number) => void;
  barsEnabled?: boolean;
  onBarsEnabled?: (next: boolean) => void;
  bars?: Meter[];
  onBarChange?: (index: number, patch: Partial<Meter>) => void;
  onAddBar?: () => void;
  onRemoveBar?: (index: number) => void;
  renderBarIcon?: (index: number) => ReactNode;
  renderPoolIcon?: (index: number) => ReactNode;
  barsNote?: string;
  footer?: ReactNode;
}) {
  const localize = useLocalizedUiText();

  return (
    <div className="ov-sheet" data-component="OverhaulGameModeSheet">
      <div className="ov-sheet__top">
        <div>
          <Eyebrow title="Attributes" on={rpgEnabled} onToggle={onRpgEnabled} />
          {rpgEnabled ? (
            <>
              <div className="ov-attrs">
                {attributes.map((attr, index) => (
                  <div key={index} className="ov-attr">
                    <input
                      className="ov-attr__name"
                      value={attr.name}
                      onChange={(event) => onAttributeChange(index, { name: event.target.value })}
                      aria-label={localize("Attribute name")}
                    />
                    <input
                      className="ov-attr__value"
                      type="number"
                      value={attr.value}
                      onChange={(event) => onAttributeChange(index, { value: parseInt(event.target.value, 10) || 0 })}
                      aria-label={localize("Value")}
                    />
                    <button
                      type="button"
                      className="ov-attr__x"
                      onClick={() => onRemoveAttribute(index)}
                      aria-label={localize("Remove")}
                    >
                      <X size={11} />
                    </button>
                  </div>
                ))}
              </div>
              <button type="button" className="ov-sheet__add" onClick={onAddAttribute}>
                <Plus size={13} aria-hidden="true" /> {localize("Attribute")}
              </button>
            </>
          ) : (
            <p className="ov-sheet__off">{localize("Off. Turn on to give attributes and pools.")}</p>
          )}
        </div>
        <div>
          <Eyebrow title="Pools" />
          {rpgEnabled ? (
            <>
              <div className="ov-sheet__table">
                <table>
                  <thead>
                    <tr>
                      {renderPoolIcon ? <th className="w-10" /> : null}
                      <th>{localize("Name")}</th>
                      <th className="w-16">{localize("Value")}</th>
                      <th className="w-16">{localize("Max")}</th>
                      <th className="w-10" />
                      <th />
                      <th className="w-8" />
                    </tr>
                  </thead>
                  <tbody>
                    {pools.map((pool, index) => (
                      <tr key={index}>
                        {renderPoolIcon ? <td>{renderPoolIcon(index)}</td> : null}
                        <td>
                          <input
                            value={pool.name}
                            onChange={(event) => onPoolChange(index, { name: event.target.value })}
                            aria-label={localize("Name")}
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            value={pool.value}
                            onChange={(event) => onPoolChange(index, { value: num(event.target.value, 0) })}
                            aria-label={localize("Value")}
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            value={pool.max}
                            onChange={(event) => onPoolChange(index, { max: num(event.target.value, 1) })}
                            aria-label={localize("Max")}
                          />
                        </td>
                        <td>
                          <input
                            type="color"
                            className="ov-swatch"
                            value={pool.color || "#a78bfa"}
                            onChange={(event) => onPoolChange(index, { color: event.target.value })}
                            aria-label={localize("Color")}
                          />
                        </td>
                        <td>
                          <MeterBar value={pool.value} max={pool.max} color={pool.color || "#a78bfa"} />
                        </td>
                        <td>
                          <button
                            type="button"
                            className="ov-sheet__x"
                            onClick={() => onRemovePool(index)}
                            aria-label={localize("Remove")}
                          >
                            <X size={12} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button type="button" className="ov-sheet__add" onClick={onAddPool}>
                <Plus size={13} aria-hidden="true" /> {localize("Pool")}
              </button>
            </>
          ) : null}
        </div>
      </div>

      {bars && onBarChange && onAddBar && onRemoveBar && onBarsEnabled ? (
        <div>
          <Eyebrow title="Tracker stat bars" note={barsNote} on={barsEnabled} onToggle={onBarsEnabled} />
          {barsEnabled ? (
            <>
              <div className="ov-sheet__table">
                <table>
                  <thead>
                    <tr>
                      {renderBarIcon ? <th className="w-10" /> : null}
                      <th>{localize("Bar")}</th>
                      <th className="w-16">{localize("Value")}</th>
                      <th className="w-16">{localize("Max")}</th>
                      <th className="w-28">{localize("Color")}</th>
                      <th />
                      <th className="w-8" />
                    </tr>
                  </thead>
                  <tbody>
                    {bars.map((bar, index) => (
                      <tr key={index}>
                        {renderBarIcon ? <td>{renderBarIcon(index)}</td> : null}
                        <td>
                          <input
                            value={bar.name}
                            onChange={(event) => onBarChange(index, { name: event.target.value })}
                            aria-label={localize("Bar")}
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            value={bar.value}
                            onChange={(event) => onBarChange(index, { value: num(event.target.value, 0) })}
                            aria-label={localize("Value")}
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            value={bar.max}
                            onChange={(event) => onBarChange(index, { max: num(event.target.value, 1) })}
                            aria-label={localize("Max")}
                          />
                        </td>
                        <td>
                          <label className="ov-sheet__color">
                            <input
                              type="color"
                              className="ov-swatch"
                              value={bar.color}
                              onChange={(event) => onBarChange(index, { color: event.target.value })}
                              aria-label={localize("Color")}
                            />
                            <code>{bar.color}</code>
                          </label>
                        </td>
                        <td>
                          <MeterBar value={bar.value} max={bar.max} color={bar.color} />
                        </td>
                        <td>
                          <button
                            type="button"
                            className="ov-sheet__x"
                            onClick={() => onRemoveBar(index)}
                            aria-label={localize("Remove")}
                          >
                            <X size={12} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="ov-sheet__foot">
                <button type="button" className="ov-sheet__add" onClick={onAddBar}>
                  <Plus size={13} aria-hidden="true" /> {localize("Bar")}
                </button>
                <span>{localize("Game Mode stats are getting an overhaul. This shows today's fields.")}</span>
              </div>
            </>
          ) : (
            <p className="ov-sheet__off">{localize("Off. Turn on to track bars like hunger or stress.")}</p>
          )}
        </div>
      ) : null}
      {footer}
    </div>
  );
}
