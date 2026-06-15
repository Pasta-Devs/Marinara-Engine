// ──────────────────────────────────────────────
// Storage: Synced Custom Themes
// ──────────────────────────────────────────────
import { desc, eq } from "drizzle-orm";
import type { DB } from "../../db/connection.js";
import { customThemes } from "../../db/schema/index.js";
import { newId, now } from "../../utils/id-generator.js";
import { normalizeThemeCss } from "../../utils/theme-css.js";
import type { CreateThemeInput, Theme, UpdateThemeInput } from "@marinara-engine/shared";

type ThemeRow = typeof customThemes.$inferSelect;

function mapTheme(row: ThemeRow): Theme {
  return {
    id: row.id,
    name: row.name,
    css: normalizeThemeCss(row.css),
    installedAt: row.installedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    isActive: row.isActive === "true",
  };
}

export function createThemesStorage(db: DB) {
  return {
    async list() {
      const rows = await db.select().from(customThemes).orderBy(desc(customThemes.updatedAt));
      return rows.map(mapTheme);
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
      });
      return this.getById(id);
    },

    async update(id: string, data: UpdateThemeInput) {
      const updateFields: Partial<typeof customThemes.$inferInsert> = {
        updatedAt: now(),
      };
      if (data.name !== undefined) updateFields.name = data.name;
      if (data.css !== undefined) updateFields.css = normalizeThemeCss(data.css);
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
