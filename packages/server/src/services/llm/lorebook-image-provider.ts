import { logger } from "../../lib/logger.js";
import { BaseLLMProvider, LLMHttpError, type ChatMessage, type ChatOptions, type LLMUsage } from "./base-provider.js";

/** Retry only explicit image-input incompatibility, before any output has been delivered. */
export function isImageInputUnsupported(error: unknown): boolean {
  if (!(error instanceof LLMHttpError) || ![400, 415, 422, 500].includes(error.status)) return false;
  return (
    /(?:image(?:_url|s)?|vision|multimodal)/iu.test(error.message) &&
    /(?:not support|unsupported|does not accept|only support(?:s)? text|only supported by|not (?:a )?(?:multimodal|vision)|image input.*not allowed)/iu.test(
      error.message,
    )
  );
}

export function withLorebookImageCompatibility(
  provider: BaseLLMProvider,
  referenceImages: ReadonlySet<string>,
  onSkipped: () => void,
  chatImages: ReadonlySet<string> = new Set(),
): BaseLLMProvider {
  class LorebookImageProvider extends BaseLLMProvider {
    private imagesRejected = false;
    constructor() {
      super("", "", provider.maxContextValue ?? undefined, null, provider.maxTokensOverrideValue);
    }

    private withoutReferences(messages: ChatMessage[]): ChatMessage[] {
      return messages.map((message) => {
        if (!message.images?.some((image) => referenceImages.has(image) && !chatImages.has(image))) return message;
        const images = message.images.filter((image) => !referenceImages.has(image) || chatImages.has(image));
        const { images: _images, ...rest } = message;
        return { ...rest, ...(images.length ? { images } : {}) };
      });
    }

    async *chat(messages: ChatMessage[], options: ChatOptions): AsyncGenerator<string, LLMUsage | void, unknown> {
      const textOnly = this.withoutReferences(messages);
      const hasReferences = messages.some((message, index) => message !== textOnly[index]);
      if (this.imagesRejected && hasReferences) {
        onSkipped();
        return yield* provider.chat(textOnly, options);
      }
      let started = false;
      try {
        const stream = provider.chat(messages, options);
        try {
          while (true) {
            const chunk = await stream.next();
            if (chunk.done) return chunk.value;
            started = true;
            yield chunk.value;
          }
        } finally {
          await stream.return(undefined).catch((error: unknown) => {
            logger.warn(error, "Failed to close the lorebook image generation stream");
          });
        }
      } catch (error) {
        if (started || options.signal?.aborted || !hasReferences || !isImageInputUnsupported(error)) throw error;
        this.imagesRejected = true;
        onSkipped();
        return yield* provider.chat(textOnly, options);
      }
    }

    override async chatComplete(messages: ChatMessage[], options: ChatOptions) {
      const textOnly = this.withoutReferences(messages);
      const hasReferences = messages.some((message, index) => message !== textOnly[index]);
      if (this.imagesRejected && hasReferences) {
        onSkipped();
        return provider.chatComplete(textOnly, options);
      }
      let started = false;
      try {
        return await provider.chatComplete(messages, {
          ...options,
          ...(options.onToken
            ? {
                onToken: (token: string) => {
                  started = true;
                  return options.onToken!(token);
                },
              }
            : {}),
        });
      } catch (error) {
        if (started || options.signal?.aborted || !hasReferences || !isImageInputUnsupported(error)) throw error;
        this.imagesRejected = true;
        onSkipped();
        return provider.chatComplete(textOnly, options);
      }
    }

    override embed(texts: string[], model: string, signal?: AbortSignal) {
      return provider.embed(texts, model, signal);
    }
  }
  return new LorebookImageProvider();
}
