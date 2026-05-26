import { useEffect, useState } from "react";
import { dictationSettings, setDictationStyle } from "../../lib/tauri";
import type { DictationStyle } from "../../lib/tauri";

const STYLE_OPTIONS: {
  value: DictationStyle;
  title: string;
  description: string;
  sample: string;
}[] = [
  {
    value: "standard",
    title: "Standard",
    description: "Clean dictation that keeps your natural tone and casing.",
    sample: "Thanks, I will take a look after lunch.",
  },
  {
    value: "casualLowercase",
    title: "Casual lowercase",
    description: "Relaxed messages with lowercase sentence starts.",
    sample: "thanks, i'll take a look after lunch.",
  },
  {
    value: "formal",
    title: "Formal",
    description: "Polished wording with conventional capitalization.",
    sample: "Thank you. I will review this after lunch.",
  },
];

export function StylesWorkspace() {
  const [style, setStyle] = useState<DictationStyle>("standard");
  const [status, setStatus] = useState<string>();

  useEffect(() => {
    let cancelled = false;
    dictationSettings()
      .then((response) => {
        if (!cancelled) setStyle(response.settings.style);
      })
      .catch((error: unknown) => {
        if (!cancelled) setStatus(messageFromError(error));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function selectStyle(nextStyle: DictationStyle) {
    setStyle(nextStyle);
    try {
      const next = await setDictationStyle(nextStyle);
      setStyle(next.style);
      setStatus(undefined);
    } catch (error) {
      setStatus(messageFromError(error));
    }
  }

  return (
    <section className="folders-workspace styles-workspace" aria-label="Styles">
      <header className="folders-header">
        <div className="folders-heading">
          <h1>Styles</h1>
          <p className="folders-subtitle">
            Choose how dictation should shape text before it is pasted.
          </p>
        </div>
        {status ? <p className="settings-status">{status}</p> : null}
      </header>

      <section className="styles-section" aria-labelledby="dictation-style">
        <h2 id="dictation-style" className="settings-group-heading">
          Dictation style
        </h2>
        <div
          className="style-options"
          role="radiogroup"
          aria-labelledby="dictation-style"
        >
          {STYLE_OPTIONS.map((option) => {
            const selected = option.value === style;
            return (
              <button
                key={option.value}
                type="button"
                className="style-option"
                role="radio"
                aria-checked={selected}
                data-selected={selected}
                onClick={() => void selectStyle(option.value)}
              >
                <span className="style-option-copy">
                  <span className="style-option-title">{option.title}</span>
                  <span className="style-option-description">
                    {option.description}
                  </span>
                </span>
                <span className="style-option-sample">{option.sample}</span>
              </button>
            );
          })}
        </div>
      </section>
    </section>
  );
}

function messageFromError(error: unknown) {
  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message: unknown }).message);
  }
  return String(error);
}
