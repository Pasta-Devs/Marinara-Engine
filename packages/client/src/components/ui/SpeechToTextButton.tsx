import { useCallback, useEffect, useRef, useState } from "react";
import { Mic, MicOff } from "lucide-react";
import { toast } from "sonner";
import { cn } from "../../lib/utils";

type SpeechRecognitionAlternativeLike = {
  transcript?: string;
};

type SpeechRecognitionResultLike = {
  readonly isFinal: boolean;
  readonly length: number;
  item(index: number): SpeechRecognitionAlternativeLike;
  [index: number]: SpeechRecognitionAlternativeLike | undefined;
};

type SpeechRecognitionResultListLike = {
  readonly length: number;
  item(index: number): SpeechRecognitionResultLike;
  [index: number]: SpeechRecognitionResultLike | undefined;
};

type SpeechRecognitionEventLike = Event & {
  readonly resultIndex: number;
  readonly results: SpeechRecognitionResultListLike;
};

type SpeechRecognitionErrorEventLike = Event & {
  readonly error?: string;
};

type SpeechRecognitionLike = EventTarget & {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

type SpeechRecognitionWindow = Window & {
  SpeechRecognition?: SpeechRecognitionConstructor;
  webkitSpeechRecognition?: SpeechRecognitionConstructor;
};

interface SpeechToTextButtonProps {
  disabled?: boolean;
  onTranscript: (text: string) => void;
  className?: string;
  iconSize?: number;
}

function getSpeechRecognitionCtor(): SpeechRecognitionConstructor | null {
  if (typeof window === "undefined") return null;
  const speechWindow = window as SpeechRecognitionWindow;
  return speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition ?? null;
}

function readTranscript(result: SpeechRecognitionResultLike | undefined): string {
  return result?.[0]?.transcript ?? result?.item(0)?.transcript ?? "";
}

export function SpeechToTextButton({ disabled, onTranscript, className, iconSize = 16 }: SpeechToTextButtonProps) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  useEffect(() => {
    setSupported(Boolean(getSpeechRecognitionCtor()));
    return () => {
      recognitionRef.current?.abort();
      recognitionRef.current = null;
    };
  }, []);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
  }, []);

  const startListening = useCallback(() => {
    if (disabled) return;
    if (listening) {
      stopListening();
      return;
    }

    const Recognition = getSpeechRecognitionCtor();
    if (!Recognition) {
      toast.error("Speech recognition is not supported in this browser.");
      return;
    }

    const recognition = new Recognition();
    let finalTranscript = "";
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = navigator.language || "en-US";
    recognition.onresult = (event) => {
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index] ?? event.results.item(index);
        const transcript = readTranscript(result);
        if (result?.isFinal && transcript.trim()) {
          finalTranscript = `${finalTranscript} ${transcript}`.trim();
        }
      }
    };
    recognition.onerror = (event) => {
      const error = event.error ?? "unknown";
      setListening(false);
      if (!["aborted", "no-speech"].includes(error)) {
        toast.error(`Speech recognition failed: ${error}`);
      }
    };
    recognition.onend = () => {
      recognitionRef.current = null;
      setListening(false);
      if (finalTranscript.trim()) {
        onTranscript(finalTranscript.trim());
      }
    };

    recognitionRef.current = recognition;
    setListening(true);
    try {
      recognition.start();
    } catch {
      recognitionRef.current = null;
      setListening(false);
      toast.error("Could not start speech recognition.");
    }
  }, [disabled, listening, onTranscript, stopListening]);

  return (
    <button
      type="button"
      onClick={startListening}
      disabled={disabled}
      className={cn(
        "flex h-8 w-8 shrink-0 items-center justify-center rounded-xl transition-all duration-200 active:scale-90",
        listening
          ? "bg-[var(--primary)]/15 text-[var(--primary)] ring-1 ring-[var(--primary)]/30"
          : supported
            ? "text-foreground/50 hover:bg-foreground/10 hover:text-foreground/75"
            : "text-foreground/25",
        disabled && "cursor-not-allowed opacity-50",
        className,
      )}
      title={
        listening
          ? "Stop dictation"
          : supported
            ? "Dictate message"
            : "Speech recognition is not supported in this browser"
      }
      aria-pressed={listening}
      aria-label={listening ? "Stop dictation" : "Dictate message"}
    >
      {supported ? <Mic size={iconSize} /> : <MicOff size={iconSize} />}
    </button>
  );
}
