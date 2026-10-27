import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Voice input through the browser's own speech recognition (Chrome, Edge, Safari). Free, no key.
 * Where the browser has none (Firefox), `supported` is false and the mic button is hidden; the
 * phone keyboard's dictation key still works in the text box.
 */

interface RecognitionResult {
  isFinal: boolean;
  0: { transcript: string };
}
interface RecognitionEvent {
  resultIndex: number;
  results: ArrayLike<RecognitionResult>;
}
interface Recognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: RecognitionEvent) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
}
type RecognitionCtor = new () => Recognition;

const ctor = (): RecognitionCtor | undefined => {
  if (typeof window === "undefined") return undefined;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
};

export function useSpeech(onText: (text: string, final: boolean) => void) {
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const rec = useRef<Recognition | null>(null);
  const supported = Boolean(ctor());
  const onTextRef = useRef(onText);
  onTextRef.current = onText;

  const stop = useCallback(() => rec.current?.stop(), []);

  const start = useCallback(() => {
    const Ctor = ctor();
    if (!Ctor) return;
    setError(null);
    const r = new Ctor();
    r.lang = navigator.language || "en-US";
    r.continuous = true;
    r.interimResults = true;
    let finalText = "";
    r.onresult = (e) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        if (res.isFinal) finalText += `${res[0].transcript} `;
        else interim += res[0].transcript;
      }
      onTextRef.current((finalText + interim).trim(), false);
    };
    r.onerror = (e) => setError(e.error === "not-allowed" ? "Microphone permission was denied." : "Couldn't hear that. Try again or type it.");
    r.onend = () => {
      setListening(false);
      onTextRef.current(finalText.trim(), true);
    };
    rec.current = r;
    r.start();
    setListening(true);
  }, []);

  useEffect(() => () => rec.current?.stop(), []);
  return { supported, listening, error, start, stop };
}
