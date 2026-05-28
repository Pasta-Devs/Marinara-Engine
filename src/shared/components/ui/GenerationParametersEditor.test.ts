import { describe, expect, it } from "vitest";
import {
  getEditableGenerationParameterOverrides,
  getEditableGenerationParameters,
  parseGenerationParameterRecord,
  ROLEPLAY_PARAMETER_DEFAULTS,
} from "./GenerationParametersEditor";

describe("GenerationParametersEditor parameter overrides", () => {
  it("omits values inherited from connection and prompt preset defaults", () => {
    const connectionDefaults = getEditableGenerationParameters(ROLEPLAY_PARAMETER_DEFAULTS, {
      temperature: 0.2,
      maxTokens: 4096,
      customParameters: { provider: { connection: true } },
    });
    const promptDefaults = getEditableGenerationParameters(connectionDefaults, {
      temperature: 0.8,
      topP: 0.7,
      assistantPrefill: "<assistant>",
      customParameters: { provider: { preset: true } },
    });

    expect(promptDefaults.customParameters).toEqual({ provider: { connection: true, preset: true } });
    expect(getEditableGenerationParameterOverrides(promptDefaults, promptDefaults)).toBeNull();
    expect(
      getEditableGenerationParameterOverrides(promptDefaults, {
        ...promptDefaults,
        maxTokens: 1200,
      }),
    ).toEqual({ maxTokens: 1200 });
  });

  it("projects chat overrides onto connection defaults without prompt preset values", () => {
    const connectionDefaults = getEditableGenerationParameters(ROLEPLAY_PARAMETER_DEFAULTS, {
      temperature: 0.2,
      maxTokens: 4096,
    });
    const promptDefaults = getEditableGenerationParameters(connectionDefaults, {
      temperature: 0.8,
      topP: 0.7,
    });
    const chatEffectiveParams = getEditableGenerationParameters(promptDefaults, {
      maxTokens: 1200,
    });
    const chatOverrides = getEditableGenerationParameterOverrides(promptDefaults, chatEffectiveParams);

    expect(chatOverrides).toEqual({ maxTokens: 1200 });
    expect(getEditableGenerationParameters(connectionDefaults, chatOverrides)).toMatchObject({
      temperature: 0.2,
      topP: ROLEPLAY_PARAMETER_DEFAULTS.topP,
      maxTokens: 1200,
    });
  });

  it("compares custom parameters by value instead of object key order", () => {
    const defaults = getEditableGenerationParameters(ROLEPLAY_PARAMETER_DEFAULTS, {
      customParameters: { provider: { b: 2, a: 1 } },
    });

    expect(
      getEditableGenerationParameterOverrides(defaults, {
        ...defaults,
        customParameters: { provider: { a: 1, b: 2 } },
      }),
    ).toBeNull();
    expect(
      getEditableGenerationParameterOverrides(defaults, {
        ...defaults,
        customParameters: { provider: { a: 1, b: 2, c: true } },
      }),
    ).toEqual({ customParameters: { provider: { a: 1, b: 2, c: true } } });
  });

  it("parses string-encoded parameter records without accepting invalid shapes", () => {
    expect(parseGenerationParameterRecord('{"temperature":0.7,"legacyFlag":true}')).toEqual({
      temperature: 0.7,
      legacyFlag: true,
    });
    expect(parseGenerationParameterRecord("[1,2,3]")).toBeNull();
    expect(parseGenerationParameterRecord("{nope")).toBeNull();
  });
});
