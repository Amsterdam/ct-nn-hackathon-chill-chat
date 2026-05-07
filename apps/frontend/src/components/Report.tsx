import type { StoredReport } from "../api";

function load(): StoredReport | null {
  try {
    const raw = localStorage.getItem("chill-report");
    return raw ? (JSON.parse(raw) as StoredReport) : null;
  } catch {
    return null;
  }
}

function formatGeneratedAt(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("nl-NL", {
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function Report() {
  const data = load();

  if (!data) {
    return (
      <div className="report report-empty">
        <h1>Geen rapport beschikbaar</h1>
        <p className="muted">
          Speel eerst een ronde Chill totdat alle harten op zijn — dan
          verschijnt hier het rapport.
        </p>
        <a className="primary-btn" href="/">
          Terug naar de chat
        </a>
      </div>
    );
  }

  return (
    <div className="report">
      <header>
        <div className="room-eyebrow">CHILL</div>
        <h1>Rapport voor de leerkracht</h1>
        <p className="muted">
          Klas 6B · {data.freeze_count}× bevroren
          {data.generated_at && ` · gegenereerd ${formatGeneratedAt(data.generated_at)}`}
        </p>
      </header>

      <section>
        <h2>Wat er gebeurde</h2>
        <p>{data.summary}</p>
      </section>

      <section>
        <h2>Belangrijkste berichten</h2>
        <div className="report-messages">
          {(data.key_messages ?? []).length === 0 ? (
            <p className="muted">
              Geen berichten geëxtraheerd — speel een nieuwe ronde.
            </p>
          ) : (
            data.key_messages.map((m, i) => (
              <div key={i} className="report-msg">
                <span className="report-author">{m.author}:</span> {m.text}
              </div>
            ))
          )}
        </div>
      </section>

      <section>
        <h2>Bevries-momenten</h2>
        <p>{data.freeze_summary}</p>
      </section>

      <section>
        <h2>Bespreekpunten</h2>
        <ul>
          {data.talking_points.map((p, i) => (
            <li key={i}>{p}</li>
          ))}
        </ul>
      </section>

      <a className="primary-btn" href="/">
        Nieuwe ronde
      </a>
    </div>
  );
}
