import { useEffect, useState } from "react";
import {
  postFreeze,
  postGenerateChat,
  postMediation,
  type FreezeContent,
  type GeneratedChat,
  type Mediation,
  type Mode,
  type Stage,
} from "../api";

const FREEZE_THRESHOLD = 3;
const FREEZE_DURATION_S = 20;

const PERSONA_COLORS = ["#A079FF", "#DBF4A7", "#E7ADCA", "#FDD08E", "#C2E2FF", "#59E796"];
const TARGET_COLOR = "#FE592F";

type VibeLevel = "hot" | "warm" | "cool" | "cold";

function vibeFor(chat: GeneratedChat | null): { temp: number; level: VibeLevel } {
  if (!chat || chat.messages.length === 0) return { temp: 30, level: "cool" };
  const total = chat.messages.length;
  const mocking = chat.messages.filter((m) => m.stage === "mocking").length;
  const teasing = chat.messages.filter((m) => m.stage === "teasing").length;
  const temp = Math.min(99, Math.round((teasing / total) * 35 + (mocking / total) * 95));
  const level: VibeLevel =
    temp >= 70 ? "hot" : temp >= 45 ? "warm" : temp >= 20 ? "cool" : "cold";
  return { temp, level };
}

function colorFor(name: string, isTarget: boolean): string {
  if (isTarget) return TARGET_COLOR;
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0;
  return PERSONA_COLORS[Math.abs(h) % PERSONA_COLORS.length];
}

function fakeTime(i: number): string {
  // pretend the chat happened starting at 14:02, ~30s apart
  const totalSec = 14 * 60 + 2 + i * 0.5;
  const h = Math.floor(totalSec / 60) % 24;
  const m = Math.floor(totalSec % 60);
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
}

const STAGE_DECORATION: Record<Stage, string> = {
  neutral: "",
  teasing: "🔥",
  mocking: "💀",
};

export default function Chat() {
  const [chat, setChat] = useState<GeneratedChat | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [topic, setTopic] = useState("");
  const [mode, setMode] = useState<Mode>("bullying");

  const [flagCount, setFlagCount] = useState(0);
  const [mediation, setMediation] = useState<Mediation | null>(null);
  const [freeze, setFreeze] = useState<FreezeContent | null>(null);
  const [freezeRemaining, setFreezeRemaining] = useState(0);
  const [glowing, setGlowing] = useState(false);

  useEffect(() => {
    if (!freeze) return;
    if (freezeRemaining <= 0) {
      setFreeze(null);
      setFlagCount(0);
      return;
    }
    const t = setTimeout(() => setFreezeRemaining((r) => r - 1), 1000);
    return () => clearTimeout(t);
  }, [freeze, freezeRemaining]);

  async function loadChat() {
    setLoading(true);
    setError(null);
    setFlagCount(0);
    setMediation(null);
    setFreeze(null);
    try {
      setChat(await postGenerateChat({ topic: topic.trim() || undefined, mode }));
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  async function handleFlag() {
    if (!chat || freeze) return;
    setGlowing(true);
    setTimeout(() => setGlowing(false), 700);
    const next = flagCount + 1;
    setFlagCount(next);

    const messages = chat.messages.map(({ author, text }) => ({ author, text }));

    try {
      if (next >= FREEZE_THRESHOLD) {
        const data = await postFreeze(messages);
        setFreeze(data);
        setFreezeRemaining(FREEZE_DURATION_S);
        setMediation(null);
      } else {
        setMediation(await postMediation(messages, next));
      }
    } catch (e) {
      setError(String(e));
    }
  }

  function thawNow() {
    setFreeze(null);
    setFlagCount(0);
    setFreezeRemaining(0);
  }

  const { temp, level } = vibeFor(chat);

  return (
    <div className="room" data-vibe={level}>
      <header className="room-header">
        <div className="room-id">
          <div className="room-avatar">
            <div className="eye" />
            <div className="eye" />
          </div>
          <div>
            <div className="room-eyebrow">GROEPSCHAT</div>
            <div className="room-name">vibe kamer</div>
            <div className="room-sub">5 online · {temp}° vibe</div>
          </div>
        </div>

        <div className="room-stats">
          <div className="hearts" aria-label="lives">
            <span>❤</span>
            <span>❤</span>
            <span>❤</span>
          </div>
          <div className="temp-meter">
            <div className="temp-labels">
              <span className={level === "hot" ? "active" : ""}>HOT</span>
              <span className={level === "warm" ? "active" : ""}>WARM</span>
              <span className={level === "cool" ? "active" : ""}>COOL</span>
              <span className={level === "cold" ? "active" : ""}>COLD</span>
            </div>
            <div className="temp-bar">
              <div className="temp-marker" style={{ bottom: `${temp}%` }} />
            </div>
          </div>
        </div>
      </header>

      <main className="room-body">
        {!chat && !loading && (
          <div className="empty-state">
            <h1>Chill</h1>
            <p className="muted">Genereer een nep-groepschat om te demonstreren.</p>

            <input
              className="topic-input"
              type="text"
              placeholder="Onderwerp (optioneel) — bv. schoolfeest"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
            />

            <div className="segmented">
              <button
                className={mode === "teasing" ? "active" : ""}
                onClick={() => setMode("teasing")}
              >
                Plagen
              </button>
              <button
                className={mode === "bullying" ? "active" : ""}
                onClick={() => setMode("bullying")}
              >
                Pesten
              </button>
            </div>

            <button className="primary-btn" onClick={loadChat}>
              Genereer een chat
            </button>
          </div>
        )}

        {loading && <p className="muted center">Even geduld...</p>}
        {error && <p className="error">{error}</p>}

        {chat?.messages.map((m, i) => {
          const prev = chat.messages[i - 1];
          const showHead = !prev || prev.author !== m.author;
          const isTarget = !!chat.target && chat.target !== "geen" && m.author === chat.target;
          const sideClass = isTarget ? "right" : "left";
          const initial = m.author[0]?.toUpperCase() ?? "?";
          const dec = STAGE_DECORATION[m.stage];
          return (
            <div key={i} className={`msg-row ${sideClass}`}>
              <div
                className="msg-avatar"
                style={{
                  background: colorFor(m.author, isTarget),
                  visibility: showHead ? "visible" : "hidden",
                }}
              >
                {initial}
              </div>
              <div className="msg-stack">
                {showHead && (
                  <div className="msg-meta">
                    <span className="msg-author">{isTarget ? "Jij" : m.author}</span>
                    <span className="msg-time">{fakeTime(i)}</span>
                  </div>
                )}
                <div className={`msg-bubble stage-${m.stage}`}>
                  {m.text}
                  {dec && <span className="msg-decoration">{dec}</span>}
                </div>
              </div>
            </div>
          );
        })}

        {mediation && (
          <div className="med-popup">
            <button className="med-close" onClick={() => setMediation(null)} aria-label="sluit">
              ×
            </button>
            <div className="med-icon">🐤</div>
            <div className="med-content">
              <div className="med-title">{mediation.title}</div>
              <p className="med-body">{mediation.body}</p>
              <p className="med-tip">
                <strong>tip:</strong> {mediation.suggestion}
              </p>
            </div>
          </div>
        )}
      </main>

      <footer className="room-footer">
        <button className="round-btn" disabled aria-label="bijlage">
          +
        </button>
        <div className="input-wrap">
          <input className="chat-input" placeholder="zeg iets..." disabled />
          <button className="send-btn" disabled aria-label="verstuur">
            ➤
          </button>
        </div>
        <button
          className={`snowflake-btn ${glowing ? "glowing" : ""}`}
          onClick={handleFlag}
          disabled={!chat || !!freeze}
          title="Bevries de vibe"
        >
          <span aria-hidden>❄</span>
          {flagCount > 0 && <span className="flag-count">{flagCount}</span>}
        </button>
      </footer>

      {freeze && (
        <div className="freeze-overlay">
          <div className="freeze-card">
            <div className="freeze-icons">🔒 ❄️</div>
            <h2 className="freeze-title">chat bevroren</h2>
            <p className="freeze-summary">{freeze.summary}</p>
            <p className="freeze-redirect">{freeze.redirect_prompt}</p>
            <div className="freeze-thaw">
              <div className="auto-thaw-label">AUTO-ONTDOOIT IN</div>
              <div className="freeze-countdown">{freezeRemaining}s</div>
            </div>
            <button className="thaw-btn" onClick={thawNow}>
              ONTDOOI NU
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
