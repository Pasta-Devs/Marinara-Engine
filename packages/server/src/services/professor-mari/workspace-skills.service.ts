import { rm, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { basename, join } from "node:path";
import type {
  MariWorkspaceSkillDetail,
  MariWorkspaceSkillSummary,
  MariWorkspaceSkillsResponse,
} from "@marinara-engine/shared";
import { DATA_DIR } from "../../utils/data-dir.js";
import { now } from "../../utils/id-generator.js";
import { logger } from "../../lib/logger.js";
import { BUILTIN_SKILL_ID_PREFIX, builtinSkillTimestamp, loadBuiltinSkills } from "./builtin-skills.js";
import {
  parseSkillFrontmatter as parseFrontmatter,
  skillInstructions,
  stripSkillFrontmatter as stripFrontmatter,
} from "./skill-frontmatter.js";

type SkillRecord = {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
};

type SkillDraft = {
  name?: string | null;
  description?: string | null;
  content: string;
  fileName?: string | null;
  enabled?: boolean;
};

type SkillUpdate = {
  name?: string | null;
  description?: string | null;
  content?: string | null;
  enabled?: boolean;
};

const MAX_SKILL_CONTENT_LENGTH = 200_000;
const MAX_SKILL_DESCRIPTION_LENGTH = 1024;
const SAFE_SKILL_ID_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/;

// Seeded once, disabled, on an install with no skill index yet. A normal user skill after that:
// editing or deleting it sticks, and nothing re-seeds or overrides it.
const EXAMPLE_SKILL = {
  id: "ask-before-building",
  description: "Example skill: ask a few short questions with quick-reply chips before creating or changing something.",
  content: `# Ask before building

This is an example skill. Turn it on if you want Professor Mari to check with you before she builds. Edit it or delete it as you like.

While this skill is on, ask before you create or change something whenever a missing detail would change the result (a name, a tone, a genre, which item to edit). This replaces the default of building first with your best guess.

- Ask one short question at a time. Give 2-5 likely answers as \`suggestions\`, one chip per answer, and make each chip's prompt the full answer. The user can still type their own.
- When a create request leaves several fields open, send one \`ask\` card with those fields and 2-4 options each, instead of asking turn by turn.
- Ask about three things at most. Fill in the rest with your best guess and say what you guessed.
- Skip the questions when the request already has what you need, or when the user says to just do it.
- Do not stage or apply changes while a question waits for an answer.`,
};

// One seed per process, so two first calls cannot both seed and the late one overwrite a user edit.
let seeding: Promise<void> | null = null;

function rootDir() {
  return join(DATA_DIR, ".mari-workspace", "skills");
}

function indexPath() {
  return join(rootDir(), "skills.json");
}

function skillDir(id: string) {
  return join(rootDir(), id);
}

function skillFilePath(id: string) {
  return join(skillDir(id), "SKILL.md");
}

function normalizeSkillName(value: string | null | undefined, fallback = "custom-skill") {
  const source = value?.trim() || fallback;
  const normalized = source
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-")
    .slice(0, 64)
    .replace(/^-+|-+$/g, "");
  return normalized || "custom-skill";
}

function normalizeSkillId(value: string | null | undefined, fallback = "skill") {
  return normalizeSkillName(value, fallback);
}

function assertSafeSkillId(id: string) {
  if (!SAFE_SKILL_ID_PATTERN.test(id)) {
    throw new Error("Invalid skill id");
  }
  return id;
}

function appendSkillIdSuffix(baseId: string, suffix: number) {
  const suffixText = `-${suffix}`;
  const prefix = baseId.slice(0, 64 - suffixText.length).replace(/-+$/g, "") || "skill";
  return `${prefix}${suffixText}`;
}

function titleFromFileName(fileName: string | null | undefined) {
  const base = fileName ? basename(fileName).replace(/\.[^.]+$/, "") : "";
  return base.replace(/[-_]+/g, " ").trim();
}

function titleFromBody(content: string) {
  const match = stripFrontmatter(content).match(/^#\s+(.+)$/m);
  return match?.[1]?.trim() ?? "";
}

function firstBodyLine(content: string) {
  return (
    stripFrontmatter(content)
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find((line) => line && !line.startsWith("#")) ?? ""
  );
}

function normalizeDescription(value: string | null | undefined, content: string) {
  const frontmatter = parseFrontmatter(content);
  const candidate =
    value?.trim() || frontmatter.description?.trim() || firstBodyLine(content) || "User-defined Professor Mari skill.";
  return candidate.slice(0, MAX_SKILL_DESCRIPTION_LENGTH);
}

function buildSkillContent(input: { name: string; description: string; content: string }) {
  const body = skillInstructions(input.content);
  const fallbackBody = `# ${input.name}

Add focused instructions for when Professor Mari should use this skill.`;
  return [
    "---",
    `name: ${JSON.stringify(input.name)}`,
    `description: ${JSON.stringify(input.description)}`,
    "---",
    "",
    body || fallbackBody,
    "",
  ].join("\n");
}

function summarizeRecord(record: SkillRecord, content: string): MariWorkspaceSkillSummary {
  return {
    id: record.id,
    name: record.name,
    description: record.description,
    enabled: record.enabled,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    size: Buffer.byteLength(content, "utf8"),
    filePath: skillFilePath(record.id),
    origin: "user",
  };
}

export class ProfessorMariWorkspaceSkillsService {
  async list(): Promise<MariWorkspaceSkillsResponse> {
    await this.ensureStorage();
    const records = await this.readRecords();
    const diagnostics: string[] = [];
    const skills: MariWorkspaceSkillDetail[] = [];

    // Shipped skills come first: the prompt index is capped, and a built-in is how
    // Mari knows a task has a procedure at all, so a long user list must not push
    // one out. They are read from the app's assets, never from DATA_DIR, so an
    // update replaces the text and a user cannot fork it by accident.
    const builtins = await loadBuiltinSkills();
    diagnostics.push(...builtins.diagnostics);
    const userIds = new Set(records.map((record) => record.id));
    for (const skill of builtins.skills) {
      if (userIds.has(skill.id)) {
        // Only reachable from a hand-edited or pre-existing index; say so instead of
        // letting one skill silently win.
        diagnostics.push(
          `Built-in skill ${skill.name} is hidden by one of your own skills with the same id (${skill.id}).`,
        );
        continue;
      }
      skills.push({
        id: skill.id,
        name: skill.name,
        description: skill.description,
        enabled: true,
        createdAt: builtinSkillTimestamp(),
        updatedAt: builtinSkillTimestamp(),
        size: Buffer.byteLength(skill.content, "utf8"),
        filePath: skill.filePath,
        origin: "builtin",
        content: skill.content,
      });
    }

    for (const record of records) {
      try {
        const content = await readFile(skillFilePath(record.id), "utf8");
        skills.push({ ...summarizeRecord(record, content), content: skillInstructions(content) });
      } catch (err) {
        diagnostics.push(`Skill ${record.name} could not be read: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    return { skills, diagnostics };
  }

  async listSummaries(): Promise<MariWorkspaceSkillSummary[]> {
    const response = await this.list();
    return response.skills.map(({ content: _content, ...summary }) => summary);
  }

  async create(input: SkillDraft): Promise<MariWorkspaceSkillDetail> {
    await this.ensureStorage();
    this.assertContent(input.content);
    const records = await this.readRecords();
    const frontmatter = parseFrontmatter(input.content);
    const name = normalizeSkillName(
      input.name ?? frontmatter.name,
      titleFromBody(input.content) || titleFromFileName(input.fileName),
    );
    const id = this.uniqueId(this.userSkillIdCandidate(name), records);
    const description = normalizeDescription(input.description, input.content);
    const timestamp = now();
    const record: SkillRecord = {
      id,
      name,
      description,
      enabled: input.enabled ?? true,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    const content = buildSkillContent({ name, description, content: input.content });
    await mkdir(skillDir(id), { recursive: true });
    await writeFile(skillFilePath(id), content, "utf8");
    await this.writeRecords([...records, record]);
    return { ...summarizeRecord(record, content), content: skillInstructions(content) };
  }

  async update(id: string, input: SkillUpdate): Promise<MariWorkspaceSkillDetail> {
    await this.ensureStorage();
    await this.assertNotBuiltin(id);
    const safeId = assertSafeSkillId(id);
    const records = await this.readRecords();
    const index = records.findIndex((record) => record.id === safeId);
    if (index < 0) throw new Error("Skill not found");
    const current = records[index]!;

    const previousContent = await readFile(skillFilePath(current.id), "utf8");
    const nextContentSource = input.content ?? skillInstructions(previousContent);
    if (input.content !== undefined && input.content !== null) this.assertContent(input.content);
    const name = normalizeSkillName(
      input.name ?? parseFrontmatter(nextContentSource).name ?? current.name,
      current.name,
    );
    const description = normalizeDescription(input.description ?? current.description, nextContentSource);
    const nextRecord: SkillRecord = {
      ...current,
      name,
      description,
      enabled: input.enabled ?? current.enabled,
      updatedAt: now(),
    };
    const nextContent = buildSkillContent({ name, description, content: nextContentSource });
    await writeFile(skillFilePath(current.id), nextContent, "utf8");
    const nextRecords = [...records];
    nextRecords[index] = nextRecord;
    await this.writeRecords(nextRecords);
    return { ...summarizeRecord(nextRecord, nextContent), content: skillInstructions(nextContent) };
  }

  async delete(id: string): Promise<void> {
    await this.ensureStorage();
    await this.assertNotBuiltin(id);
    const safeId = assertSafeSkillId(id);
    const records = await this.readRecords();
    const record = records.find((entry) => entry.id === safeId);
    if (!record) throw new Error("Skill not found");
    await rm(skillDir(record.id), { recursive: true, force: true });
    await this.writeRecords(records.filter((entry) => entry.id !== record.id));
  }

  private async ensureStorage() {
    seeding ??= this.seedExample().catch((err: unknown) => {
      seeding = null;
      throw err;
    });
    await seeding;
  }

  private async seedExample() {
    await mkdir(rootDir(), { recursive: true });
    if (existsSync(indexPath())) return;
    const { id, description, content } = EXAMPLE_SKILL;
    const timestamp = now();
    await mkdir(skillDir(id), { recursive: true });
    await writeFile(skillFilePath(id), buildSkillContent({ name: id, description, content }), "utf8");
    await this.writeRecords([
      { id, name: id, description, enabled: false, createdAt: timestamp, updatedAt: timestamp },
    ]);
  }

  /** A shipped skill is read-only unless a user record owns the id (a legacy squat must be repairable). */
  async isReadOnly(id: string): Promise<boolean> {
    await this.ensureStorage();
    const records = await this.readRecords();
    if (records.some((record) => record.id === id)) return false;
    return (await loadBuiltinSkills()).skills.some((skill) => skill.id === id);
  }

  private async assertNotBuiltin(id: string) {
    if (await this.isReadOnly(id)) {
      throw new Error("Built-in skills are read-only. Copy it into a new skill to change it.");
    }
  }

  /**
   * A user skill may not take the reserved `builtin-` prefix. The rewritten name is
   * re-capped at 64 characters, the id limit `assertSafeSkillId` enforces: without
   * this, a 64-character name becomes a 69-character id that update and delete reject.
   */
  private userSkillIdCandidate(name: string) {
    if (!name.startsWith(BUILTIN_SKILL_ID_PREFIX)) return name;
    return `user-${name}`.slice(0, 64).replace(/-+$/g, "");
  }

  private async readRecords(): Promise<SkillRecord[]> {
    if (!existsSync(indexPath())) return [];
    try {
      const parsed = JSON.parse(await readFile(indexPath(), "utf8")) as unknown;
      if (!Array.isArray(parsed)) return [];
      const records: SkillRecord[] = [];
      const usedIds = new Set<string>();
      for (const entry of parsed.filter(
        (entry): entry is Partial<SkillRecord> => !!entry && typeof entry === "object",
      )) {
        const baseId = normalizeSkillId(typeof entry.id === "string" ? entry.id : entry.name, "skill");
        let id = baseId;
        let suffix = 2;
        while (usedIds.has(id)) {
          id = appendSkillIdSuffix(baseId, suffix);
          suffix += 1;
        }
        usedIds.add(id);
        records.push({
          id,
          name: normalizeSkillName(entry.name, "skill"),
          description:
            typeof entry.description === "string" && entry.description.trim()
              ? entry.description.slice(0, MAX_SKILL_DESCRIPTION_LENGTH)
              : "User-defined Professor Mari skill.",
          enabled: entry.enabled !== false,
          createdAt: typeof entry.createdAt === "string" ? entry.createdAt : now(),
          updatedAt: typeof entry.updatedAt === "string" ? entry.updatedAt : now(),
        });
      }
      return records;
    } catch (err) {
      logger.warn(err, "[Professor Mari] failed to read workspace skill index");
      return [];
    }
  }

  private async writeRecords(records: SkillRecord[]) {
    await mkdir(rootDir(), { recursive: true });
    // Write then rename, so a crash never leaves a half-written index.
    const tempPath = `${indexPath()}.${randomUUID()}.tmp`;
    try {
      await writeFile(tempPath, JSON.stringify(records, null, 2), "utf8");
      await rename(tempPath, indexPath());
    } catch (err) {
      await rm(tempPath, { force: true });
      throw err;
    }
  }

  private uniqueId(baseName: string, records: SkillRecord[]) {
    const existing = new Set(records.map((record) => record.id));
    let id = baseName;
    let suffix = 2;
    while (existing.has(id)) {
      id = appendSkillIdSuffix(baseName, suffix);
      suffix += 1;
    }
    return id;
  }

  private assertContent(content: string) {
    if (!skillInstructions(content)) throw new Error("Skill instructions are required.");
    if (content.length > MAX_SKILL_CONTENT_LENGTH) {
      throw new Error(`Skill content must be ${MAX_SKILL_CONTENT_LENGTH} characters or fewer.`);
    }
  }
}

let singleton: ProfessorMariWorkspaceSkillsService | null = null;
export function getProfessorMariWorkspaceSkillsService() {
  if (!singleton) singleton = new ProfessorMariWorkspaceSkillsService();
  return singleton;
}
