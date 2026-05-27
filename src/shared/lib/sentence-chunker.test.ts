import { describe, expect, it } from "vitest";
import { createChunkerState, extractNewSentences, extractRemainder } from "./sentence-chunker";

describe("streaming TTS sentence chunker", () => {
  it("emits completed sentences and flushes the remaining tail", () => {
    const state = createChunkerState();

    expect(extractNewSentences("Hello there", state)).toBe("");
    expect(extractNewSentences("Hello there. How are", state)).toBe("Hello there.");
    expect(extractRemainder("Hello there. How are you", state)).toBe("How are you");
  });

  it("does not treat ellipses or common abbreviations as sentence boundaries", () => {
    const state = createChunkerState();

    expect(extractNewSentences("But tell me... what did Dr. Vale say? Fine.", state)).toBe(
      "But tell me... what did Dr. Vale say? Fine.",
    );
  });

  it("does not replay content after a stream buffer rewind", () => {
    const state = createChunkerState();

    expect(extractNewSentences("First sentence. Second sentence.", state)).toBe("First sentence. Second sentence.");
    expect(extractNewSentences("First sentence. Cleaned", state)).toBe("");
    expect(extractNewSentences("First sentence. Cleaned ending.", state)).toBe("");
  });

  it("strips closed thinking blocks and pauses at unclosed ones", () => {
    const state = createChunkerState();

    expect(extractNewSentences("Visible. <thought type=\"cot\">secret.</thought> Spoken.", state)).toBe(
      "Visible. Spoken.",
    );
    const unclosedState = createChunkerState();
    expect(extractNewSentences("Visible. <thought>still thinking. Hidden", unclosedState)).toBe("Visible.");
    expect(extractRemainder("Visible. <thought>still thinking. Hidden", unclosedState)).toBe("");
  });

  it("waits for quoted dialogue to close before emitting mid-quote sentence punctuation", () => {
    const state = createChunkerState();

    expect(extractNewSentences('She says, "Hello. How are', state)).toBe("");
    expect(extractNewSentences('She says, "Hello. How are you." Then nods.', state)).toBe(
      'She says, "Hello. How are you." Then nods.',
    );
  });

  it("treats doubled ASCII quotes as balanced dialogue delimiters", () => {
    const state = createChunkerState();

    expect(extractNewSentences('She says, ""Hello. How are', state)).toBe("");
    expect(extractNewSentences('She says, ""Hello. How are you."" Then nods.', state)).toBe(
      'She says, ""Hello. How are you."" Then nods.',
    );

    const terminalState = createChunkerState();
    expect(extractNewSentences('She says, ""Hello.""', terminalState)).toBe('She says, ""Hello.""');
  });

  it("emits sentence ends after guillemet and Japanese quote closers", () => {
    const state = createChunkerState();

    expect(extractNewSentences("\u00abHello. How are you?\u00bb \u300cFine.\u300d", state)).toBe(
      "\u00abHello. How are you?\u00bb \u300cFine.\u300d",
    );
  });
});
