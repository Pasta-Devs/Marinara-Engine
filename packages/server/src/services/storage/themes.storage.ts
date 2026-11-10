// ──────────────────────────────────────────────
// Storage: Synced Custom Themes
// ──────────────────────────────────────────────
import { desc, eq } from "../../db/file-query.js";
import type { DB } from "../../db/connection.js";
import { customThemes } from "../../db/schema/index.js";
import { newId, now } from "../../utils/id-generator.js";
import { normalizeThemeCss } from "../../utils/theme-css.js";
import {
  themeMetaSchema,
  type CreateThemeInput,
  type Theme,
  type ThemeMeta,
  type UpdateThemeInput,
} from "@marinara-engine/shared";
import { isStarterThemeId } from "./starter-themes.js";

type ThemeRow = typeof customThemes.$inferSelect;

function parseMeta(raw: string | null | undefined): ThemeMeta | null {
  if (!raw) return null;
  try {
    const parsed = themeMetaSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

function serializeMeta(meta: ThemeMeta | null | undefined) {
  return meta ? JSON.stringify(meta) : "";
}

function mapTheme(row: ThemeRow): Theme {
  return {
    id: row.id,
    name: row.name,
    css: normalizeThemeCss(row.css),
    installedAt: row.installedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    isActive: row.isActive === "true",
    meta: parseMeta(row.meta),
    builtIn: isStarterThemeId(row.id) || undefined,
  };
}

export function createThemesStorage(db: DB) {
  return {
    async list() {
      const rows = await db.select().from(customThemes).orderBy(desc(customThemes.updatedAt));
      return rows.map(mapTheme);
    },

    /** A starter theme downloaded from the theme gallery: added, or replaced in place by a newer version
     *  (it keeps being the active theme if it was). */
    async saveStarter(starter: { id: string; name: string; css: string; meta: ThemeMeta }) {
      if (!isStarterThemeId(starter.id)) throw new Error("Not a starter theme id");
      const meta = serializeMeta(starter.meta);
      const css = normalizeThemeCss(starter.css);
      const rows = await db.select().from(customThemes).where(eq(customThemes.id, starter.id));
      if (rows[0]) {
        await db.update(customThemes).set({ name: starter.name, css, meta }).where(eq(customThemes.id, starter.id));
      } else {
        const timestamp = now();
        await db.insert(customThemes).values({
          id: starter.id,
          name: starter.name,
          css,
          installedAt: timestamp,
          createdAt: timestamp,
          // Oldest first in a list sorted by last change, so the person's own themes lead.
          updatedAt: "1970-01-01T00:00:00.000Z",
          isActive: "false",
          meta,
        });
      }
      return this.getById(starter.id);
    },

    async getById(id: string) {
      const rows = await db.select().from(customThemes).where(eq(customThemes.id, id));
      const row = rows[0];
      return row ? mapTheme(row) : null;
    },

    async getActive() {
      const rows = await db.select().from(customThemes).where(eq(customThemes.isActive, "true"));
      const row = rows[0];
      return row ? mapTheme(row) : null;
    },

    async findDuplicate(name: string, css: string) {
      const rows = await db.select().from(customThemes);
      const row = rows.find((candidate) => candidate.name === name && candidate.css === css);
      return row ? mapTheme(row) : null;
    },

    async create(input: CreateThemeInput) {
      const id = newId();
      const timestamp = now();
      await db.insert(customThemes).values({
        id,
        name: input.name,
        css: normalizeThemeCss(input.css ?? ""),
        installedAt: input.installedAt ?? timestamp,
        createdAt: timestamp,
        updatedAt: timestamp,
        isActive: "false",
        meta: serializeMeta(input.meta),
      });
      return this.getById(id);
    },

    async update(id: string, data: UpdateThemeInput) {
      const updateFields: Partial<typeof customThemes.$inferInsert> = {
        updatedAt: now(),
      };
      if (data.name !== undefined) updateFields.name = data.name;
      if (data.css !== undefined) updateFields.css = normalizeThemeCss(data.css);
      if (data.meta !== undefined) updateFields.meta = serializeMeta(data.meta);
      await db.update(customThemes).set(updateFields).where(eq(customThemes.id, id));
      return this.getById(id);
    },

    async setActive(id: string | null) {
      const activeTheme = await this.getActive();
      if (activeTheme) {
        await db.update(customThemes).set({ isActive: "false" }).where(eq(customThemes.id, activeTheme.id));
      }
      if (!id) return null;
      await db.update(customThemes).set({ isActive: "true" }).where(eq(customThemes.id, id));
      return this.getById(id);
    },

    async remove(id: string) {
      await db.delete(customThemes).where(eq(customThemes.id, id));
    },
  };
}
