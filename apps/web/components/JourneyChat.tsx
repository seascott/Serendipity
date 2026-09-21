"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { interpretJourney } from "../lib/intent";
import type { OriginKey } from "../lib/now";

type Message = { role: "user" | "guide"; title?: string; body: string };

export function JourneyChat({
  prompts,
  intro,
  current,
}: {
  prompts: string[];
  intro: string;
  current?: { mode: "plan" | "explore"; origin?: OriginKey };
}) {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [messages, setMessages] = useState<Message[]>([{ role: "guide", body: intro }]);

  function submit(text: string) {
    const trimmed = text.trim();
    if (!trimmed) return;
    const intent = interpretJourney(trimmed, current);
    setMessages((current) => [
      ...current,
      { role: "user", body: trimmed },
      { role: "guide", title: intent.title, body: intent.body },
    ]);
    setValue("");
    if (intent.href) {
      const stay = Boolean(current && intent.mode === current.mode);
      router.push(intent.href, { scroll: !stay });
    }
  }

  return (
    <section className="journey-chat" aria-label="Configure this journey">
      <p className="label">Ask Serendipity</p>
      <div className="chat-log">
        {messages.map((message, index) => (
          <div key={`${message.role}-${index}`} className={`chat-bubble ${message.role}`}>
            {message.title ? <strong>{message.title}</strong> : null}
            <p>{message.body}</p>
          </div>
        ))}
      </div>
      <div className="chat-prompts">
        {prompts.map((prompt) => (
          <button type="button" key={prompt} onClick={() => submit(prompt)}>
            {prompt}
          </button>
        ))}
      </div>
      <form
        className="chat-form"
        onSubmit={(event) => {
          event.preventDefault();
          submit(value);
        }}
      >
        <label className="sr-only" htmlFor="journey-chat-input">
          Describe the journey
        </label>
        <input
          id="journey-chat-input"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="Plan a year, or tell me where you’ll be…"
        />
        <button className="button" type="submit">
          Go
        </button>
      </form>
    </section>
  );
}
