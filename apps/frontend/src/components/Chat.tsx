import { useEffect, useState } from "react";
import {
  postFreeze,
  postGenerateChat,
  postMediation,
  postReport,
  type FreezeContent,
  type FreezeEvent,
  type GeneratedChat,
  type Mediation,
  type Mode,
  type Stage,
} from "../api";

const FREEZE_THRESHOLD = 3;
const FREEZE_DURATION_S = 20;
const STARTING_LIVES = 3;

const PERSONA_COLORS = ["#A079FF", "#DBF4A7", "#E7ADCA", "#FDD08E", "#C2E2FF", "#59E796"];
const TARGET_COLOR = "#FE592F";

// Vibe levels: HOT (full thermometer) → WARM → COOL → COLD (empty / ice)
type VibeLevel = "hot" | "warm" | "cool" | "cold";
const LEVELS_TOP_DOWN: VibeLevel[] = ["hot", "warm", "cool", "cold"];

function levelForFlagCount(n: number): VibeLevel {
  // n=0 → hot, n=1 → warm, n=2 → cool, n=3 → cold (and freeze)
  return LEVELS_TOP_DOWN[Math.min(n, LEVELS_TOP_DOWN.length - 1)];
}

// Pixel-art thermometer: maps vibe level to a designer-supplied SVG asset.
const THERMO_ASSET: Record<VibeLevel, string> = {
  hot: "/thermo-hot.svg",
  warm: "/thermo-medium.svg",
  cool: "/thermo-low.svg",
  cold: "/thermo-ice.svg",
};

function PixelThermometer({ level }: { level: VibeLevel }) {
  return (
    <img
      src={THERMO_ASSET[level]}
      alt=""
      className="thermo-img"
      aria-hidden
    />
  );
}

// Mood-coded eye blob centered above the chat — shifts with vibe level.
const EYES_ASSET: Record<VibeLevel, string> = {
  hot: "/eyes-happy.svg",
  warm: "/eyes-medium.svg",
  cool: "/eyes-low.svg",
  cold: "/eyes-ice.svg",
};

function colorFor(name: string, isTarget: boolean): string {
  if (isTarget) return TARGET_COLOR;
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0;
  return PERSONA_COLORS[Math.abs(h) % PERSONA_COLORS.length];
}

function fakeTime(i: number): string {
  const totalSec = 14 * 60 + 2 + i * 0.5;
  const h = Math.floor(totalSec / 60) % 24;
  const m = Math.floor(totalSec % 60);
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
}

function pickRandomBystander(chat: GeneratedChat): string {
  const all = Array.from(new Set(chat.messages.map((m) => m.author)));
  const bystanders = all.filter((a) => a !== chat.target);
  const pool = bystanders.length > 0 ? bystanders : all;
  return pool[Math.floor(Math.random() * pool.length)] ?? "Iemand";
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
  const [lives, setLives] = useState(STARTING_LIVES);
  const [freezeEvents, setFreezeEvents] = useState<FreezeEvent[]>([]);
  const [gameOver, setGameOver] = useState(false);

  const [mediation, setMediation] = useState<Mediation | null>(null);
  const [freeze, setFreeze] = useState<FreezeContent | null>(null);
  const [freezeRemaining, setFreezeRemaining] = useState(0);
  const [glowing, setGlowing] = useState(false);

  const level: VibeLevel = freeze ? "cold" : levelForFlagCount(flagCount);

  // Freeze countdown + auto-thaw OR game-over transition
  useEffect(() => {
    if (!freeze) return;
    if (freezeRemaining <= 0) {
      if (lives <= 0) {
        // Save report and switch to game-over
        if (chat) {
          postReport(
            chat.messages.map(({ author, text }) => ({ author, text })),
            chat.target ?? null,
            freezeEvents,
          )
            .then((r) => {
            const stored = {
              ...r,
              generated_at: new Date().toISOString(),
              target: chat?.target ?? null,
              freeze_count: freezeEvents.length,
            };
            localStorage.setItem("chill-report", JSON.stringify(stored));
          })
            .catch((e) => setError(String(e)));
        }
        setFreeze(null);
        setGameOver(true);
      } else {
        // Normal thaw — back to HOT
        setFreeze(null);
        setFlagCount(0);
      }
      return;
    }
    const t = setTimeout(() => setFreezeRemaining((r) => r - 1), 1000);
    return () => clearTimeout(t);
  }, [freeze, freezeRemaining, lives, chat, freezeEvents]);

  async function loadChat() {
    setLoading(true);
    setError(null);
    setFlagCount(0);
    setLives(STARTING_LIVES);
    setFreezeEvents([]);
    setGameOver(false);
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
    if (!chat || freeze || gameOver) return;
    setGlowing(true);
    setTimeout(() => setGlowing(false), 700);

    const next = flagCount + 1;
    setFlagCount(next);

    const messages = chat.messages.map(({ author, text }) => ({ author, text }));

    try {
      if (next >= FREEZE_THRESHOLD) {
        const data = await postFreeze(messages);
        const presser = pickRandomBystander(chat);
        setFreezeEvents((events) => [
          ...events,
          { by: presser, at_message_count: chat.messages.length },
        ]);
        setLives((l) => l - 1);
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
    if (lives <= 0) {
      if (chat) {
        postReport(
          chat.messages.map(({ author, text }) => ({ author, text })),
          chat.target ?? null,
          freezeEvents,
        )
          .then((r) => {
            const stored = {
              ...r,
              generated_at: new Date().toISOString(),
              target: chat?.target ?? null,
              freeze_count: freezeEvents.length,
            };
            localStorage.setItem("chill-report", JSON.stringify(stored));
          })
          .catch((e) => setError(String(e)));
      }
      setFreeze(null);
      setGameOver(true);
    } else {
      setFreeze(null);
      setFlagCount(0);
      setFreezeRemaining(0);
    }
  }

  const isFrozen = !!freeze;

  return (
    <div className="room" data-vibe={level}>
      <header className="room-header">
        <div className="room-title-line">
          <button className="back-btn" aria-label="terug" disabled>
            ‹
          </button>
          <div className="room-title">Groepschat</div>
        </div>

        <div className="room-stats">
          <div className="hearts" aria-label="lives">
            {[0, 1, 2].map((i) => (
              <img
                key={i}
                src="/heart.svg"
                alt=""
                className={i < lives ? "" : "dead"}
              />
            ))}
          </div>

          <div className={`thermometer ${level === "cold" ? "frosted" : ""}`}>
            <PixelThermometer level={level} />
          </div>
        </div>
      </header>

      {chat && (
        <div className="eye-banner" data-vibe={level}>
          <img src={EYES_ASSET[level]} alt="" />
        </div>
      )}

      <main className="room-body">
        {chat && <div className="day-label">Vandaag</div>}

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
          const isTarget =
            !!chat.target && chat.target !== "geen" && m.author === chat.target;
          const sideClass = isTarget ? "right" : "left";
          const initial = m.author[0]?.toUpperCase() ?? "?";
          // Decorate roughly every 3rd non-neutral message so the chat doesn't drown in 🔥/💀
          const dec =
            m.stage !== "neutral" && i % 3 === 0
              ? STAGE_DECORATION[m.stage]
              : "";
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

      </main>

      <footer className="room-footer">
        <button className="icon-btn plus" disabled aria-label="bijlage">
          +
        </button>
        <div className="input-wrap">
          <input className="chat-input" placeholder="" disabled />
          <button className="icon-btn inline" disabled aria-label="sticker">
            🗒
          </button>
        </div>
        <button className="icon-btn" disabled aria-label="camera">
          📷
        </button>
        <button className="icon-btn" disabled aria-label="microfoon">
          🎙
        </button>
      </footer>

      {chat && (
        <button
          className={`snowflake-floating ${glowing ? "glowing" : ""}`}
          onClick={handleFlag}
          disabled={isFrozen || gameOver || !!mediation}
          title="Bevries de vibe"
        >
          <span aria-hidden>❄</span>
          {flagCount > 0 && <span className="flag-count">{flagCount}</span>}
        </button>
      )}

      {mediation && !isFrozen && !gameOver && (
        <div className="med-popup">
          <button
            className="med-close"
            onClick={() => setMediation(null)}
            aria-label="sluit"
          >
            ×
          </button>
          <div className="med-content">
            <div className="med-title">{mediation.title}</div>
            <p className="med-body">{mediation.body}</p>
            <p className="med-tip">
              <strong>tip:</strong> {mediation.suggestion}
            </p>
          </div>
        </div>
      )}

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

      {gameOver && (
        <div className="freeze-overlay gameover">
          <div className="freeze-card">
            <div className="freeze-icons">💔</div>
            <h2 className="freeze-title">game over</h2>
            <p className="freeze-summary">
              De groep heeft drie keer moeten chillen. Het rapport voor de
              leerkracht is opgeslagen.
            </p>
            <a className="thaw-btn" href="/report">
              BEKIJK RAPPORT
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
