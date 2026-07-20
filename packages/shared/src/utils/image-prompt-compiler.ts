import { findImageStyleProfile } from "../constants/image-style-profiles.js";
import type { ImageGenerationDefaultsProfile } from "../types/image-generation-defaults.js";
import type { ImagePromptKind, ImageStyleProfile, ImageStyleProfileSettings } from "../types/image-style-profile.js";

export interface CompiledImagePrompt {
  prompt: string;
  negativePrompt: string;
  profile: ImageStyleProfile;
  diagnostics: {
    removedPositiveDuplicates: string[];
    removedNegativeDuplicates: string[];
    movedNegativeFragments: string[];
  };
}

export interface CompileImagePromptInput {
  kind: ImagePromptKind;
  prompt: string;
  /** Additional provider-visible prompt text used only to suppress exact repeated inputs. */
  dedupeAgainstPrompt?: string | null;
  negativePrompt?: string | null;
  styleProfiles: ImageStyleProfileSettings;
  styleProfileId?: string | null;
  imageDefaults?: ImageGenerationDefaultsProfile | null;
  generatedStyle?: string | null;
  userPositive?: string | null;
  userNegative?: string | null;
  hardNegative?: string | null;
  /** Apply the selected grammar to generated prose that is normally preserved for review/readability. */
  applyPromptModeToSourcePrompt?: boolean;
}

export function compileImagePrompt(input: CompileImagePromptInput): CompiledImagePrompt {
  const initial = compileImagePromptPass(input, false, false);
  const generatedStyle = input.generatedStyle?.trim() ?? "";
  const userPositive = input.userPositive?.trim() ?? "";
  if (!generatedStyle && !userPositive) return initial;

  // Only trust deduplication after transformation and compaction. If they removed the
  // source copy, rebuild with explicit inputs protected from the compacting budget.
  const { fragmentMode } = resolveImagePromptCompilationMode(input, initial.profile);
  const providerVisiblePrompt = [initial.prompt, input.dedupeAgainstPrompt].filter(Boolean).join("\n");
  const protectGeneratedStyle =
    Boolean(generatedStyle) &&
    !promptContainsPositiveNormalizedValue(providerVisiblePrompt, generatedStyle, fragmentMode);
  const protectUserPositive =
    Boolean(userPositive) &&
    !promptContainsPositiveNormalizedValue(providerVisiblePrompt, userPositive, fragmentMode);
  if (!protectGeneratedStyle && !protectUserPositive) return initial;

  return compileImagePromptPass(input, protectGeneratedStyle, protectUserPositive);
}

function compileImagePromptPass(
  input: CompileImagePromptInput,
  protectGeneratedStyle: boolean,
  protectUserPositive: boolean,
): CompiledImagePrompt {
  const profile = findImageStyleProfile(
    input.styleProfiles,
    input.styleProfileId || input.imageDefaults?.styleProfileId || input.styleProfiles.defaultProfileId,
  );
  const promptMode = profile.promptMode;
  const positiveDiagnostics: string[] = [];
  const negativeDiagnostics: string[] = [];
  const movedNegativeFragments: string[] = [];

  const generatedStyle = input.generatedStyle?.trim() ?? "";
  const userPositive = input.userPositive?.trim() ?? "";
  const {
    preserveGeneratedPrompt,
    compactPrompt,
    fragmentMode,
  } = resolveImagePromptCompilationMode(input, profile);
  const duplicateComparisonPrompt = [input.prompt, input.dedupeAgainstPrompt].filter(Boolean).join("\n");
  const generatedStylePart = protectGeneratedStyle
    ? generatedStyle
    : omitPromptValueAlreadyPresent(generatedStyle, duplicateComparisonPrompt, fragmentMode, positiveDiagnostics);
  const userPositivePart = protectUserPositive
    ? userPositive
    : omitPromptValueAlreadyPresent(userPositive, duplicateComparisonPrompt, fragmentMode, positiveDiagnostics);
  const promptPrefix = imagePromptPrefixFromDefaults(input.imageDefaults);
  const negativePromptPrefix = imageNegativePromptPrefixFromDefaults(input.imageDefaults);
  const sourceCueText = [input.prompt, input.userPositive].filter(Boolean).join("\n");
  const sourceCues = compactPrompt ? deriveTaggedSourceCues(sourceCueText) : [];
  const profileSubjectTags = reconcileProfileSubjectTags(profile.subjectTags[input.kind] ?? "", sourceCues);
  const profileStyleText =
    compactPrompt || (profile.styleText && generatedStyle)
      ? ""
      : profile.styleText && profile.baseStyle !== "auto"
        ? profile.styleText
        : generatedStyle
          ? ""
          : profile.styleText;

  const positiveParts = compactPrompt
    ? [
        { value: promptPrefix, sourcePrompt: false, hardPrefix: true },
        { value: sourceCues.join(", "), sourcePrompt: false },
        {
          value: generatedStylePart,
          sourcePrompt: !protectGeneratedStyle,
          hardPrefix: protectGeneratedStyle,
        },
        { value: input.prompt, sourcePrompt: true },
        {
          value: userPositivePart,
          sourcePrompt: !protectUserPositive,
          hardPrefix: protectUserPositive,
        },
        { value: profileSubjectTags, sourcePrompt: false },
        { value: profile.positiveTags, sourcePrompt: false },
      ]
    : [
        { value: promptPrefix, sourcePrompt: false, hardPrefix: true },
        { value: profile.positiveTags, sourcePrompt: false },
        { value: profileSubjectTags, sourcePrompt: false },
        { value: profileStyleText, sourcePrompt: false },
        { value: generatedStylePart, sourcePrompt: false },
        { value: input.prompt, sourcePrompt: true },
        { value: userPositivePart, sourcePrompt: !protectUserPositive },
      ];
  const negativeParts = [
    negativePromptPrefix,
    profile.negativeTags,
    input.negativePrompt,
    input.userNegative,
    input.hardNegative,
  ];
  const positiveFragments: string[] = [];
  const hardPrefixFragments: string[] = [];
  const negativeFragments: string[] = [];

  for (const part of positiveParts) {
    const shouldDistill = part.sourcePrompt && !preserveGeneratedPrompt;
    for (const fragment of splitPromptFragments(part.value, fragmentMode, shouldDistill)) {
      const negative = extractNegativeFragment(fragment);
      if (negative) {
        negativeFragments.push(...splitNegativePromptItems(negative));
        movedNegativeFragments.push(fragment);
      } else if (hasAvoidInstructionPrefix(fragment)) {
        movedNegativeFragments.push(fragment);
      } else {
        const clean = cleanPromptFragment(fragment, promptMode);
        if (part.hardPrefix) {
          hardPrefixFragments.push(clean);
        } else {
          positiveFragments.push(clean);
        }
      }
    }
  }

  for (const part of negativeParts) {
    negativeFragments.push(
      ...splitPromptFragments(part, promptMode)
        .flatMap(splitNegativePromptItems)
        .map((fragment) => cleanPromptFragment(fragment, promptMode)),
    );
  }

  const hardPrefix = dedupeFragments(hardPrefixFragments, profile.rules.dedupeStrength, positiveDiagnostics);
  let positive = compactPromptFragments(
    dedupeFragments([...hardPrefix, ...positiveFragments], profile.rules.dedupeStrength, positiveDiagnostics),
    compactPrompt,
    hardPrefix.length,
  );
  if (positive.length === 0) {
    positive = fallbackPositiveFragments(
      [generatedStylePart, input.prompt, userPositivePart],
      promptMode,
      compactPrompt,
    );
  }
  const negative = dedupeFragments(negativeFragments, profile.rules.dedupeStrength, negativeDiagnostics);

  return {
    prompt: joinFragments(positive, compactPrompt ? "tagged" : promptMode),
    negativePrompt: joinFragments(negative, "tagged"),
    profile,
    diagnostics: {
      removedPositiveDuplicates: positiveDiagnostics,
      removedNegativeDuplicates: negativeDiagnostics,
      movedNegativeFragments,
    },
  };
}

function resolveImagePromptCompilationMode(input: CompileImagePromptInput, profile: ImageStyleProfile) {
  const promptMode = profile.promptMode;
  const taggedPromptMode = promptMode === "tagged" || promptMode === "danbooru";
  const applyPromptModeToSourcePrompt = input.applyPromptModeToSourcePrompt === true;
  const preserveGeneratedPrompt =
    !applyPromptModeToSourcePrompt &&
    (input.kind === "illustration" || input.kind === "background" || input.kind === "selfie");
  const compactTags = !applyPromptModeToSourcePrompt && !preserveGeneratedPrompt && taggedPromptMode;
  const compactVisualPrompt =
    profile.baseStyle !== "z_image_turbo" && ["avatar", "portrait", "sprite"].includes(input.kind);
  const compactPrompt = compactTags || compactVisualPrompt;
  return {
    preserveGeneratedPrompt,
    compactPrompt,
    fragmentMode: compactPrompt ? ("tagged" as const) : promptMode,
  };
}

function omitPromptValueAlreadyPresent(
  value: string,
  prompt: string,
  promptMode: ImageStyleProfile["promptMode"],
  diagnostics: string[],
): string {
  if (!value || !promptContainsPositiveNormalizedValue(prompt, value, promptMode)) return value;
  diagnostics.push(value);
  return "";
}

function promptContainsPositiveNormalizedValue(
  prompt: string,
  value: string,
  promptMode: ImageStyleProfile["promptMode"],
): boolean {
  const normalizedValue = normalizePromptContainmentText(value);
  if (!normalizedValue) return false;
  const positivePrompt = splitPromptFragments(prompt, promptMode)
    .filter((fragment) => !extractNegativeFragment(fragment) && !hasAvoidInstructionPrefix(fragment))
    .join(" ");
  return ` ${normalizePromptContainmentText(positivePrompt)} `.includes(` ${normalizedValue} `);
}

function normalizePromptContainmentText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function fallbackPositiveFragments(
  values: Array<string | null | undefined>,
  promptMode: ImageStyleProfile["promptMode"],
  compactPrompt: boolean,
): string[] {
  const fallbackFragments = values
    .flatMap((value) => splitPromptFragments(value, "natural"))
    .filter((fragment) => !extractNegativeFragment(fragment) && !hasAvoidInstructionPrefix(fragment))
    .map((fragment) => cleanPromptFragment(fragment, promptMode))
    .filter(Boolean);
  return compactPromptFragments(fallbackFragments, compactPrompt);
}

function imagePromptPrefixFromDefaults(defaults: ImageGenerationDefaultsProfile | null | undefined): string {
  if (!defaults) return "";
  if (defaults.service === "automatic1111") return defaults.automatic1111?.promptPrefix ?? "";
  if (defaults.service === "comfyui") return defaults.comfyui?.promptPrefix ?? "";
  if (defaults.service === "novelai") return defaults.novelai?.promptPrefix ?? "";
  return "";
}

function imageNegativePromptPrefixFromDefaults(defaults: ImageGenerationDefaultsProfile | null | undefined): string {
  if (!defaults) return "";
  if (defaults.service === "automatic1111") return defaults.automatic1111?.negativePromptPrefix ?? "";
  if (defaults.service === "comfyui") return defaults.comfyui?.negativePromptPrefix ?? "";
  if (defaults.service === "novelai") return defaults.novelai?.negativePromptPrefix ?? "";
  return "";
}

function splitPromptListItems(value: string): string[] {
  const parts: string[] = [];
  let current = "";
  let parenDepth = 0;
  let bracketDepth = 0;
  let braceDepth = 0;
  let quote: '"' | null = null;
  let escaped = false;

  const pushCurrent = () => {
    const clean = current.trim();
    if (clean) parts.push(clean);
    current = "";
  };

  for (const char of value) {
    if (escaped) {
      current += char;
      escaped = false;
      continue;
    }

    if (char === "\\") {
      current += char;
      escaped = true;
      continue;
    }

    if (quote) {
      current += char;
      if (char === quote) quote = null;
      continue;
    }

    if (char === '"') {
      current += char;
      quote = char;
      continue;
    }

    if (char === "(") parenDepth += 1;
    else if (char === ")" && parenDepth > 0) parenDepth -= 1;
    else if (char === "[") bracketDepth += 1;
    else if (char === "]" && bracketDepth > 0) bracketDepth -= 1;
    else if (char === "{") braceDepth += 1;
    else if (char === "}" && braceDepth > 0) braceDepth -= 1;

    const insideGroup = parenDepth > 0 || bracketDepth > 0 || braceDepth > 0;
    if (!insideGroup && (char === "," || char === ";" || char === "\n")) {
      pushCurrent();
      continue;
    }

    current += char;
  }

  pushCurrent();
  return parts;
}

function splitNaturalPromptClauses(value: string): string[] {
  const parts: string[] = [];
  let current = "";
  let parenDepth = 0;
  let bracketDepth = 0;
  let braceDepth = 0;
  let quote: '"' | null = null;
  let escaped = false;

  const pushCurrent = () => {
    const clean = current.trim();
    if (clean) parts.push(clean);
    current = "";
  };

  for (let index = 0; index < value.length; index += 1) {
    const char = value[index]!;

    if (escaped) {
      current += char;
      escaped = false;
      continue;
    }

    if (char === "\\") {
      current += char;
      escaped = true;
      continue;
    }

    if (quote) {
      current += char;
      if (char === quote) quote = null;
      continue;
    }

    if (char === '"') {
      current += char;
      quote = char;
      continue;
    }

    if (char === "(") parenDepth += 1;
    else if (char === ")" && parenDepth > 0) parenDepth -= 1;
    else if (char === "[") bracketDepth += 1;
    else if (char === "]" && bracketDepth > 0) bracketDepth -= 1;
    else if (char === "{") braceDepth += 1;
    else if (char === "}" && braceDepth > 0) braceDepth -= 1;

    const insideGroup = parenDepth > 0 || bracketDepth > 0 || braceDepth > 0;
    const startsNegativeClause = /^\s*(?:avoid|no|without)\b/i.test(value.slice(index + 1));
    if (!insideGroup && (char === "\n" || (char === "," && startsNegativeClause))) {
      pushCurrent();
      continue;
    }

    current += char;
  }

  pushCurrent();
  return parts;
}

export function mergeCompiledPromptMeta(
  meta: Record<string, unknown> | undefined,
  compiled: Pick<CompiledImagePrompt, "profile" | "diagnostics">,
): Record<string, unknown> {
  const diagnostics = compiled.diagnostics;
  const removed =
    diagnostics.removedPositiveDuplicates.length +
    diagnostics.removedNegativeDuplicates.length +
    diagnostics.movedNegativeFragments.length;
  return {
    ...(meta ?? {}),
    imageStyleProfileId: compiled.profile.id,
    imageStyleProfileName: compiled.profile.name,
    imagePromptCleanup:
      removed > 0
        ? {
            removedPositiveDuplicates: diagnostics.removedPositiveDuplicates,
            removedNegativeDuplicates: diagnostics.removedNegativeDuplicates,
            movedNegativeFragments: diagnostics.movedNegativeFragments,
          }
        : undefined,
  };
}

function splitPromptFragments(
  value: string | null | undefined,
  promptMode: ImageStyleProfile["promptMode"],
  sourcePrompt = false,
): string[] {
  const text = (value ?? "").trim();
  if (!text) return [];

  const normalized = text
    .replace(/\r\n?/g, "\n")
    .replace(/[.!?]\s+(?=(?:avoid|no|without|exclude|do not include|don't include)\b)/gi, "\n")
    .replace(/\b(?:avoid|negative prompt|undesired content)\s*:/gi, "\navoid ")
    .replace(/\b(?:SD|Stable Diffusion)\/Illustrious\s+tags?\s*:/gi, "\n")
    .replace(/\b(?:positive prompt|tags?)\s*:/gi, "\n");

  if (promptMode === "natural") {
    const fragments: string[] = [];
    for (const part of splitNaturalPromptClauses(normalized)) {
      const clean = part.trim();
      if (!clean) continue;
      if (hasAvoidInstructionPrefix(clean)) {
        fragments.push(...splitPromptListItems(clean));
      } else {
        fragments.push(clean);
      }
    }
    return fragments;
  }

  const prepared = sourcePrompt ? distillTaggedPromptSource(normalized) : normalized;

  return splitPromptListItems(prepared);
}

function splitNegativePromptItems(value: string): string[] {
  return splitPromptListItems(value);
}

function distillTaggedPromptSource(value: string): string {
  const fragments: string[] = [];
  for (const raw of value.split(/\n+|(?<=[.!?])\s+/g)) {
    let sentence = raw.trim();
    if (!sentence) continue;
    const negative = extractNegativeFragment(sentence);
    if (negative) {
      for (const item of splitNegativePromptItems(negative)) {
        const cleanNegative = item.trim();
        if (cleanNegative) fragments.push(`avoid ${cleanNegative}`);
      }
      sentence = stripLeadingNegativeClause(sentence);
      if (!sentence) continue;
    }
    if (hasAvoidInstructionPrefix(sentence)) continue;

    const labeled = sentence.match(/^([A-Za-z][A-Za-z ]{1,32}):\s*(.+)$/);
    if (labeled?.[1] && labeled[2]) {
      fragments.push(...distillLabeledPromptValue(labeled[1], labeled[2]));
      continue;
    }

    const clean = sentence
      .replace(/^(?:npc|character)?\s*portrait\s+(?:of|for)\s+[A-Z][\p{L}\p{N}'_-]{0,40}\b\.?/iu, "")
      .replace(/^(?:npc|character)\s+portrait\b\.?/i, "")
      .replace(
        /^(?:create|generate|make|draw|depict|render)\s+(?:an?\s+)?(?:polished\s+)?(?:character\s+)?(?:avatar\s+)?(?:portrait|image|picture|illustration|scene)\s+(?:of|for)?\s*/i,
        "",
      )
      .replace(/\bfor\s+[A-Z][\p{L}\p{N}'_-]{0,40}\b/gu, "")
      .replace(/[.!?]+$/g, "")
      .trim();
    if (!clean) continue;
    const distilled = distillVisualPhrases(clean);
    if (distilled.length > 0) {
      fragments.push(...distilled);
    }
    for (const item of splitPromptListItems(clean)) {
      const cleanItem = item.trim();
      if (hasAvoidInstructionPrefix(cleanItem)) {
        fragments.push(cleanItem);
        continue;
      }
      if (looksLikeNameOnly(cleanItem)) continue;
      const distilledItem = distillVisualPhrases(cleanItem);
      if (distilledItem.length > 0) {
        fragments.push(...distilledItem);
      } else if (shouldKeepTaggedSourceFragment(cleanItem, true) && looksLikeTagPhrase(cleanItem)) {
        fragments.push(cleanItem);
      }
    }
  }
  if (fragments.length === 0) {
    fragments.push(...fallbackTaggedSourceFragments(value));
  }
  return fragments.join(", ");
}

function deriveTaggedSourceCues(value: string): string[] {
  const cues: string[] = [];
  const text = value.toLowerCase();
  const genderCue = deriveGenderCue(text);
  if (genderCue) cues.push(genderCue);
  if (/\bhuman(?:oid)?\s+person\b|\bhuman or humanoid\b/.test(text)) {
    cues.push("human");
  }
  const ageCue = deriveAgeCue(text);
  if (ageCue) cues.push(ageCue);
  return cues;
}

function reconcileProfileSubjectTags(tags: string, sourceCues: string[]): string {
  const genderCue = sourceCues.find((cue) => /^(?:female|male|androgynous)$/.test(cue));
  if (!tags.trim() || !genderCue) return tags;

  return splitPromptListItems(tags)
    .map((tag) => tag.trim())
    .filter(Boolean)
    .flatMap((tag) => reconcileGenderedTag(tag, genderCue))
    .join(", ");
}

function reconcileGenderedTag(tag: string, genderCue: string): string[] {
  const clean = tag.trim();
  const normalized = clean.toLowerCase().replace(/[_-]+/g, " ");
  const isFemale = /^(?:1girl|female|woman|girl|lady)$/.test(normalized);
  const isMale = /^(?:1boy|male|man|boy|gentleman)$/.test(normalized);
  if (genderCue === "female") {
    if (normalized === "1boy") return ["1girl"];
    return isMale ? [] : [clean];
  }
  if (genderCue === "male") {
    if (normalized === "1girl") return ["1boy"];
    return isFemale ? [] : [clean];
  }
  if (isFemale || isMale) return [];
  return [clean];
}

function deriveGenderCue(text: string): string | null {
  if (/\b(?:non[-\s]?binary|enby|androgynous|genderless|agender|they\/them)\b/.test(text)) {
    return "androgynous";
  }

  const subjectWindow = text.slice(0, 480);
  const maleExplicit = countPattern(subjectWindow, /\b(?:man|male|boy|gentleman|bearded|father|king|prince)\b/g);
  const femaleExplicit = countPattern(subjectWindow, /\b(?:woman|female|girl|lady|mother|queen|princess)\b/g);
  if (maleExplicit > femaleExplicit) return "male";
  if (femaleExplicit > maleExplicit) return "female";
  if (maleExplicit > 0 || femaleExplicit > 0) return null;

  const pronounText = subjectWindow.replace(/\bher\s+majesty\b/g, "").replace(/\bhis\s+majesty\b/g, "");
  const malePronouns = countPattern(pronounText, /\b(?:he|him|his)\b/g);
  const femalePronouns = countPattern(pronounText, /\b(?:she|her|hers)\b/g);
  if (malePronouns >= 2 && malePronouns > femalePronouns) return "male";
  if (femalePronouns >= 2 && femalePronouns > malePronouns) return "female";
  return null;
}

function countPattern(value: string, pattern: RegExp): number {
  return value.match(pattern)?.length ?? 0;
}

function fallbackTaggedSourceFragments(value: string): string[] {
  return value
    .split(/\n+|(?<=[.!?])\s+/g)
    .map((fragment) => cleanPromptFragment(fragment, "tagged"))
    .filter((fragment) => {
      if (!fragment || looksLikeNameOnly(fragment)) return false;
      if (extractNegativeFragment(fragment) || hasAvoidInstructionPrefix(fragment)) return false;
      return shouldKeepTaggedSourceFragment(fragment);
    });
}

function deriveAgeCue(text: string): string | null {
  if (/\b(?:early|mid|late)\s+(?:twenties|thirties|forties|fifties|sixties)\b/.test(text)) return null;
  if (/\b(?:young adult|adult|middle-aged|middle aged|elderly|senior)\b/.test(text)) return null;
  if (/\b(?:child|kid|teen|teenager|minor)\b/.test(text)) return null;

  const adultMilestones = [
    /\b(?:owner|employee|business|agency|rent|debt|pay off|mercenary work|adventuring guilds?)\b/,
    /\b(?:joined the army|basic training|deployed|shipped off|fight in the war|crew)\b/,
    /\b(?:high\s*school dropout|expelled|academy|final exam)\b/,
    /\b(?:refugee|moved to|save enough money|opened)\b/,
  ];
  const score = adultMilestones.reduce((count, pattern) => count + (pattern.test(text) ? 1 : 0), 0);
  return score >= 2 ? "young adult" : null;
}

function distillLabeledPromptValue(label: string, value: string): string[] {
  const normalizedLabel = label.trim().toLowerCase();
  const cleanValue = value.replace(/[.!?]+$/g, "").trim();
  if (!cleanValue) return [];

  if (/^(?:background|goal|personality|traits|occupation|skills|known spells?|type|name)$/i.test(normalizedLabel)) {
    return [];
  }

  if (/^canonical appearance$/i.test(normalizedLabel) && looksLikeNameOnly(cleanValue)) {
    return [];
  }

  if (/^(?:appearance|canonical appearance|species|equipment|composition)$/i.test(normalizedLabel)) {
    return splitPromptListItems(cleanValue)
      .map((part) => part.trim())
      .filter((part) => shouldKeepTaggedSourceFragment(part));
  }

  return shouldKeepTaggedSourceFragment(cleanValue, true) ? [cleanValue] : [];
}

function looksLikeNameOnly(value: string): boolean {
  return /^[A-Z][\p{L}\p{N}'_-]{1,40}(?:\s+[A-Z][\p{L}\p{N}'_-]{1,40})?$/u.test(value.trim());
}

function distillVisualPhrases(value: string): string[] {
  const clean = value.replace(/\s+/g, " ").trim();
  if (!clean) return [];

  const fragments: string[] = [];
  const text = clean.replace(/\u2013|\u2014/g, ", ");

  const age = text.match(
    /\bin\s+(?:her|his|their)\s+((?:early|mid|late)\s+(?:twenties|thirties|forties|fifties|sixties))\b/i,
  );
  if (age?.[1]) fragments.push(age[1]);

  if (/\btall\b/i.test(text)) fragments.push("tall");
  if (/\bstatuesque\b/i.test(text)) fragments.push("statuesque");

  const hair = text.match(/\b(?:her|his|their)\s+([^,.;]+?\bhair)\b/i);
  if (hair?.[1]) fragments.push(cleanVisualPhrase(hair[1]));
  const updo = text.match(/\b(?:elegant\s+)?updo\b/i);
  if (updo?.[0]) fragments.push(cleanVisualPhrase(updo[0]));

  const eyes = text.match(/\b(?:her|his|their)\s+eyes?\s+(?:are|is)\s+(?:an?\s+)?([^,.;]+)/i);
  if (eyes?.[1]) {
    const eyeDescription = cleanVisualPhrase(eyes[1].replace(/\b(?:piercing|framed by|subtle)\b/gi, ""));
    if (eyeDescription) fragments.push(`${eyeDescription} eyes`);
  }
  const tagLikeEyes = text.match(/\b([a-z][a-z -]{1,30})\s+eyes?\b/i);
  if (!eyes && tagLikeEyes?.[0]) fragments.push(cleanVisualPhrase(tagLikeEyes[0]));

  addIfPresent(fragments, text, /\bsharp cheekbones\b/i, "sharp cheekbones");
  addIfPresent(fragments, text, /\bsmoky makeup\b/i, "smoky makeup");
  addIfPresent(fragments, text, /\bblack blazer\b/i, "black blazer");
  addIfPresent(fragments, text, /\bburgundy blouse\b/i, "burgundy blouse");
  addIfPresent(fragments, text, /\bslim trousers\b/i, "slim trousers");
  addIfPresent(fragments, text, /\bheeled boots\b/i, "heeled boots");
  addIfPresent(fragments, text, /\breading glasses\b/i, "reading glasses");
  addIfPresent(fragments, text, /\bstatement ring\b/i, "statement ring");
  addIfPresent(fragments, text, /\bdark red nails\b/i, "dark red nails");
  addIfPresent(fragments, text, /\b(?:fox|kitsune|wolf|cat|rabbit|deer|lizard|dragon|bird|serpent)[-\s](?:woman|man|girl|boy|person|humanoid|creature)\b/i);
  addIfPresent(fragments, text, /\b(?:silver|white|black|brown|red|golden|blue|grey|gray|orange)[-\s]furred\b/i);
  addIfPresent(fragments, text, /\b(?:silver|white|black|brown|red|golden|blue|grey|gray|orange)\s+fur\b/i);
  addIfPresent(fragments, text, /\b(?:fox|wolf|cat|rabbit|deer|lizard|dragon|bird|serpent)\s+(?:ears?|tail|tails?|horns?|wings?)\b/i);
  addIfPresent(fragments, text, /\b(?:persimmon|red|blue|black|white|gold|golden|green|purple|pink|silver|grey|gray|brown)\s+kimono\b/i);
  addIfPresent(fragments, text, /\b(?:kimono|sari|hanfu|cheongsam|qipao|cloak|cape|mantle|hood|veil|mask|visor|goggles)\b/i);
  addIfPresent(fragments, text, /\b(?:scroll|debt[-\s]scroll|book|tome|lantern|fan|parasol|satchel|pouch)\b/i);
  addIfPresent(fragments, text, /\btucked in (?:her|his|their|a|the)?\s*sleeve\b/i);

  if (fragments.length > 0) return fragments.filter((fragment) => shouldKeepTaggedSourceFragment(fragment));
  return [];
}

function addIfPresent(fragments: string[], text: string, pattern: RegExp, fragment?: string): void {
  const match = text.match(pattern);
  if (match?.[0]) fragments.push(fragment ?? cleanVisualPhrase(match[0]));
}

function cleanVisualPhrase(value: string): string {
  return value
    .replace(/\b(?:a|an|the|is|are|with|into|and|her|his|their)\b/gi, " ")
    .replace(/\s+/g, " ")
    .replace(/^[, ]+|[, ]+$/g, "")
    .trim();
}

function looksLikeTagPhrase(value: string): boolean {
  const clean = value.trim();
  if (/\b(?:is|are|was|were|has|have|favors|moves|holds|lends|perches|framing|aware)\b/i.test(clean)) return false;
  return clean.split(/\s+/g).length <= 5;
}

function shouldKeepTaggedSourceFragment(value: string, requireVisualCue = false): boolean {
  const clean = value.trim();
  if (!clean) return false;
  if (clean.length > 120) return false;
  if (
    /\b(?:childhood|academy|army|airship|country|refugee|business|district|background|universe|agency|determined|goal|dream|survived|moved|born|build|hoped|hope|better|spells?|uncertain|terms?|eventually|struggles?|managed|opened|enrolled|expelled|tracked)\b/i.test(
      clean,
    )
  ) {
    return false;
  }
  if (/^(?:well|right|and|or|but|yet)$/i.test(clean)) return false;
  if (requireVisualCue && !hasVisualCue(clean)) return false;
  if (/^(?:suitable as a chat avatar|main character|owner|sole employee)$/i.test(clean)) return false;
  return true;
}

function hasVisualCue(value: string): boolean {
  return /\b(?:female|male|woman|man|girl|boy|non[-\s]?binary|androgynous|genderless|adult|young adult|middle-aged|middle aged|elderly|senior|human|humanoid|elf|dwarf|orc|fae|fairy|demon|angel|vampire|mermaid|harpy|centaur|kobold|kitsune|fox|wolf|cat|rabbit|deer|lizard|dragon|serpent|fur|furred|tail|tails?|ears?|horns?|wings?|android|robot|twenties|thirties|forties|fifties|sixties|statuesque|hair|eyes?|skin|face|body|petite|tall|short|slim|muscular|scar|freckles|beard|makeup|cheekbones|nails|smil(?:e|ing)|flowers?|ring|armor|armour|dress|shirt|blouse|trousers|coat|jacket|blazer|robe|uniform|kimono|sari|hanfu|cheongsam|qipao|cloak|cape|mantle|hood|veil|mask|visor|goggles|sword|staff|scroll|book|tome|lantern|fan|parasol|satchel|pouch|hat|glasses|boots|sleeve|portrait|close-up|upper body|face-and-shoulders|full body|centered|looking at viewer|expression|silhouette|fantasy|medieval|kingdom|castle|village|tavern|dungeon|forest|field|farm|road|market|city|urban|street|alley|temple|church|ruins?|graveyard|cave|mountain|river|lake|desert|snow|rain|storm|fog|night|dawn|morning|noon|afternoon|evening|sci-fi|scifi|cyberpunk|space|futuristic|modern|contemporary|western|victorian|steampunk|environment|landscape|scenery|location|interior|exterior)\b/i.test(
    value,
  );
}

function compactPromptFragments(
  fragments: string[],
  compactPrompt: boolean,
  protectedCount = 0,
  maxTokens = 75,
): string[] {
  if (!compactPrompt) return fragments;

  const separator = ", ";
  const protectedFragments = fragments.slice(0, protectedCount);
  const ranked = fragments
    .slice(protectedCount)
    .map((fragment, index) => ({ fragment, index, priority: compactTagPriority(fragment) }))
    .sort((a, b) => a.priority - b.priority || a.index - b.index);
  const result: string[] = [...protectedFragments];
  let tokens = estimatedPromptTokens(result, separator);

  for (const { fragment } of ranked) {
    if (isLowPriorityCompactTag(fragment) && tokens > Math.floor(maxTokens * 0.8)) continue;
    const nextTokens =
      tokens + (result.length ? estimatedPromptTokenCount(separator) : 0) + estimatedPromptTokenCount(fragment);
    if (nextTokens > maxTokens) continue;
    result.push(fragment);
    tokens = nextTokens;
  }

  return result;
}

function estimatedPromptTokens(fragments: string[], separator: string): number {
  if (fragments.length === 0) return 0;
  return (
    fragments.reduce((count, fragment) => count + estimatedPromptTokenCount(fragment), 0) +
    (fragments.length - 1) * estimatedPromptTokenCount(separator)
  );
}

function estimatedPromptTokenCount(value: string): number {
  const clean = value.trim();
  if (!clean) return 0;
  const lexicalTokens = clean.match(/<[^>]+>|[\p{L}\p{N}_'-]+|[^\s\p{L}\p{N}]/gu) ?? [];
  return lexicalTokens.reduce((count, token) => count + Math.max(1, Math.ceil(token.length / 8)), 0);
}

function compactTagPriority(value: string): number {
  const tag = value.trim().toLowerCase();
  if (
    /\b(?:fantasy|medieval|kingdom|castle|village|tavern|dungeon|forest|field|farm|road|market|city|urban|street|alley|temple|church|ruins?|graveyard|cave|mountain|river|lake|desert|snow|rain|storm|fog|night|dawn|morning|noon|afternoon|evening|sci-fi|scifi|cyberpunk|space|futuristic|modern|contemporary|western|victorian|steampunk|environment|landscape|scenery|location|interior|exterior)\b/.test(
      tag,
    )
  ) {
    return 1;
  }
  if (
    /^(?:female|male|woman|man|girl|boy|non[-\s]?binary|androgynous|genderless|human|elf|dwarf|orc|android|robot|person)$/.test(
      tag,
    )
  )
    return 0;
  if (/^(?:readable expression|clear silhouette|readable face|natural expression)$/.test(tag)) return 7;
  if (/\b(?:avatar|face-and-shoulders portrait|shoulders-up composition|centered portrait)\b/.test(tag)) {
    return 1;
  }
  if (/\b(?:hair|eyes?)\b/.test(tag)) {
    return 2;
  }
  if (
    /\b(?:armor|armour|dress|shirt|blouse|trousers|coat|jacket|blazer|robe|uniform|sword|staff|hat|glasses|boots|ring)\b/.test(
      tag,
    )
  ) {
    return 3;
  }
  if (
    /\b(?:adult|young adult|middle-aged|middle aged|elderly|senior|twenties|thirties|forties|fifties|sixties|skin|body|petite|tall|short|slim|muscular|statuesque|scar|freckles|beard|makeup|cheekbones|nails)\b/.test(
      tag,
    )
  ) {
    return 4;
  }
  if (/\b(?:portrait|close-up|upper body|face-and-shoulders|full body|centered|looking at viewer)\b/.test(tag)) {
    return 5;
  }
  if (/\b(?:photorealistic|anime|cinematic|digital painting|painterly|illustration|realistic)\b/.test(tag)) return 6;
  if (
    /^(?:masterpiece|best quality|high quality|sharp focus|natural lighting|detailed textures|absurdres)$/.test(tag)
  ) {
    return 7;
  }
  return 3;
}

function isLowPriorityCompactTag(value: string): boolean {
  return /^(?:single subject|centered composition|readable expression|clear silhouette|readable face|natural expression|photorealistic|realistic|anime style|cinematic|digital painting|painterly|illustration|high quality|sharp focus|natural lighting|detailed textures|best quality|masterpiece|absurdres)$/i.test(
    value.trim(),
  );
}

function extractNegativeFragment(fragment: string): string | null {
  const clean = fragment.trim();
  const match = clean.match(/^(?:avoid|no|without|exclude|do not include|don't include)\s+(.+)/i);
  if (!match?.[1]) return null;
  const negative = (splitPromptListItems(match[1])[0] ?? "")
    .replace(/[.]+$/g, "")
    .replace(/^(?:any|all)\s+/i, "")
    .trim();
  if (!negative || looksLikeNonImageNegativeFragment(negative)) return null;
  return negative;
}

function stripLeadingNegativeClause(fragment: string): string {
  const clean = fragment.trim();
  const match = clean.match(/^(?:avoid|no|without|exclude|do not include|don't include)\s+(.+)/i);
  if (!match?.[1]) return clean;
  return splitPromptListItems(match[1]).slice(1).join(", ").trim();
}

function hasAvoidInstructionPrefix(fragment: string): boolean {
  return /^(?:avoid|no|without|exclude|do not include|don't include)\b/i.test(fragment.trim());
}

function looksLikeNonImageNegativeFragment(value: string): boolean {
  const clean = value.trim();
  return /^(?:matter|actual talents?|talents?|skills?|known spells?)\b/i.test(clean);
}

function cleanPromptFragment(fragment: string, promptMode: ImageStyleProfile["promptMode"]): string {
  let clean = fragment
    .replace(/\s+/g, " ")
    .replace(
      /\b(?:major character moment|key emotional moment|major reveal|dramatic action scene|important scene|scene moment|narrative purpose)\s*[-:]\s*/gi,
      "",
    )
    .replace(
      /^\s*(?:major character moment|key emotional moment|major reveal|dramatic action scene|important scene|scene moment)\s*[-:]?\s*/i,
      "",
    )
    .replace(
      /^(?:create|generate|make|draw|depict|render)\s+(?:an?\s+)?(?:image|picture|illustration|portrait|scene)\s+(?:of|for)?\s*/i,
      "",
    )
    .replace(/^(?:image|picture|illustration|portrait|scene)\s+(?:of|for)\s+/i, "")
    .replace(/[.]+$/g, "")
    .trim();

  if (promptMode === "danbooru") {
    clean = clean.replace(/\s+style$/i, " style");
  }

  return clean;
}

function dedupeFragments(
  fragments: string[],
  strength: ImageStyleProfile["rules"]["dedupeStrength"],
  diagnostics: string[],
): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const raw of fragments) {
    const fragment = raw.trim();
    if (!fragment) continue;
    const key = fragmentKey(fragment, strength);
    if (!key) continue;
    if (seen.has(key)) {
      diagnostics.push(fragment);
      continue;
    }
    seen.add(key);
    result.push(fragment);
  }

  return result;
}

function fragmentKey(fragment: string, strength: ImageStyleProfile["rules"]["dedupeStrength"]): string {
  const base = stripPromptWeight(fragment)
    .replace(/[_-]+/g, " ")
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
  if (!base) return "";
  if (strength === "light") return base;

  const alias = tagAlias(base);
  if (alias) return alias;
  if (strength === "strict") return strictAlias(base) ?? base;
  return base;
}

function stripPromptWeight(value: string): string {
  let clean = value.trim();
  let changed = true;
  while (changed) {
    changed = false;
    const wrapped = clean.match(/^[([{]\s*(.+?)\s*[)\]}]$/);
    if (wrapped?.[1]) {
      clean = wrapped[1].trim();
      changed = true;
    }
  }
  return clean.replace(/: ?[+-]?\d+(?:\.\d+)?$/g, "").trim();
}

function tagAlias(value: string): string | null {
  if (/^(?:best|high|good|excellent) quality$/.test(value)) return "quality_high";
  if (/^(?:low|bad|poor) quality$/.test(value)) return "quality_low";
  if (/^(?:text|letters|caption|captions|subtitle|subtitles)$/.test(value)) return "text_artifacts";
  if (/^(?:watermark|logo|signature)$/.test(value)) return value;
  if (/^(?:blurry|blur|out of focus)$/.test(value)) return "blurry";
  if (/^(?:solo|single subject|one subject)$/.test(value)) return "solo_subject";
  if (/^(?:centered|centered composition|centre composition)$/.test(value)) return "centered_composition";
  if (
    /^(?:centered\s+)?(?:realistic\s+)?(?:avatar\s+)?portrait$/.test(value) ||
    /^(?:centered\s+)?face\s+and\s+shoulders\s+portrait$/.test(value) ||
    /^(?:centered\s+)?shoulders\s+up\s+(?:portrait|composition)$/.test(value) ||
    /^(?:centered\s+)?upper\s+body\s+portrait$/.test(value)
  ) {
    return "centered_portrait_composition";
  }
  return null;
}

function strictAlias(value: string): string | null {
  if (/^(?:masterpiece|best quality|high quality|absurdres|highres)$/.test(value)) return "quality_cluster";
  if (/^(?:portrait|avatar portrait|character portrait)$/.test(value)) return "portrait";
  if (/^(?:upper body|bust shot|shoulders up|shoulders-up composition)$/.test(value)) return "upper_body";
  if (/^(?:looking at viewer|facing viewer|looking toward viewer)$/.test(value)) return "looking_at_viewer";
  return null;
}

function joinFragments(fragments: string[], promptMode: ImageStyleProfile["promptMode"]): string {
  if (promptMode === "natural") return fragments.join(". ");
  return fragments.join(", ");
}
