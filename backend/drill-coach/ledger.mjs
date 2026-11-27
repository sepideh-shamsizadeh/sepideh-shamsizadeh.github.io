const localCalendar = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Zurich", year: "numeric", month: "2-digit", day: "2-digit"
});

export const MONTHLY_CAP = 3_000_000;
export const DAILY_CAP = 10;
export const MAX_CHALLENGES = 200;
export const DAILY_TRANSCRIPTIONS = 20;
const PENDING_MS = 120_000;
const DUPLICATE_MS = 15 * 60_000;
const MONTH_MS = 32 * 86_400_000;
const LATCH = "usage-bound";

export function period(now) {
  const date = localCalendar.formatToParts(now);
  const part = type => date.find(item => item.type === type).value;
  const month = part("year") + "-" + part("month");
  return [month + "-" + part("day"), month];
}

export class Ledger {
  constructor(query, transaction) {
    this.query = query;
    this.transaction = transaction;
    query("CREATE TABLE IF NOT EXISTS challenges (nonce TEXT PRIMARY KEY, expires INTEGER NOT NULL)");
    query("CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, owner TEXT NOT NULL, expires INTEGER NOT NULL)");
    query("CREATE TABLE IF NOT EXISTS throttle (bucket TEXT PRIMARY KEY, count INTEGER NOT NULL, expires INTEGER NOT NULL)");
    query(`CREATE TABLE IF NOT EXISTS evaluations (
      id TEXT PRIMARY KEY, fingerprint TEXT NOT NULL, created INTEGER NOT NULL,
      day TEXT NOT NULL, month TEXT NOT NULL, state TEXT NOT NULL, cost INTEGER NOT NULL,
      input INTEGER, output INTEGER
    )`);
    // Emergency latch: set automatically when reported usage exceeds a reservation.
    query("CREATE TABLE IF NOT EXISTS controls (name TEXT PRIMARY KEY, since INTEGER NOT NULL DEFAULT 0)");
    // Manual reconciliation: spend reported by OpenAI beyond the ledger's own estimate.
    query(`CREATE TABLE IF NOT EXISTS adjustments (
      id TEXT PRIMARY KEY, month TEXT NOT NULL, created INTEGER NOT NULL, cost INTEGER NOT NULL
    )`);
    // Audit trail of administrative recoveries. Amounts only; no request content or secrets.
    query(`CREATE TABLE IF NOT EXISTS recoveries (
      id TEXT PRIMARY KEY, created INTEGER NOT NULL, month TEXT NOT NULL, ledger INTEGER NOT NULL,
      reported INTEGER NOT NULL, adjustment INTEGER NOT NULL, latched INTEGER
    )`);
    // Transcription accounting: counts, audio seconds and estimated Workers AI Neurons only.
    query(`CREATE TABLE IF NOT EXISTS transcriptions (
      id TEXT PRIMARY KEY, fingerprint TEXT NOT NULL, created INTEGER NOT NULL,
      day TEXT NOT NULL, month TEXT NOT NULL, state TEXT NOT NULL, neurons INTEGER NOT NULL, seconds REAL
    )`);
    query("CREATE INDEX IF NOT EXISTS transcriptions_by_day ON transcriptions(day)");
    query("CREATE INDEX IF NOT EXISTS by_day ON evaluations(day)");
    query("CREATE INDEX IF NOT EXISTS by_month ON evaluations(month)");
    query("CREATE INDEX IF NOT EXISTS by_fingerprint ON evaluations(fingerprint, created)");
  }

  challenge(nonce, now, expires) {
    return this.transaction(() => {
      // Bound outstanding challenges so unauthenticated callers cannot grow storage without limit.
      if (this.query("SELECT COUNT(*) AS n FROM challenges WHERE expires > ?", now)[0].n >= MAX_CHALLENGES) return false;
      this.query("INSERT INTO challenges VALUES (?, ?)", nonce, expires);
      return true;
    });
  }

  useChallenge(nonce, now, token, owner, expires) {
    return this.transaction(() => {
      const used = this.query("DELETE FROM challenges WHERE nonce = ? AND expires > ? RETURNING nonce", nonce, now);
      if (used.length !== 1) return false;
      this.query("INSERT INTO sessions VALUES (?, ?, ?)", token, owner, expires);
      return true;
    });
  }

  session(token, owner, now) {
    return this.query("SELECT 1 FROM sessions WHERE token = ? AND owner = ? AND expires > ?", token, owner, now).length === 1;
  }

  revoke(token) {
    this.query("DELETE FROM sessions WHERE token = ?", token);
  }

  authenticateRate(bucket, now, limit = 30) {
    return this.transaction(() => {
      this.query("DELETE FROM throttle WHERE expires <= ?", now);
      this.query("DELETE FROM challenges WHERE expires <= ?", now);
      this.query("DELETE FROM sessions WHERE expires <= ?", now);
      const rows = this.query(`INSERT INTO throttle VALUES (?, 1, ?)
        ON CONFLICT(bucket) DO UPDATE SET count=count+1 WHERE count < ? RETURNING count`,
        bucket, now + 120_000, limit);
      return rows.length === 1;
    });
  }

  totals(now) {
    const [day, month] = period(now);
    const dayRow = this.query(`SELECT COUNT(*) AS used, COALESCE(SUM(cost),0) AS cost,
      COALESCE(SUM(input),0) AS input, COALESCE(SUM(output),0) AS output
      FROM evaluations WHERE day = ?`, day)[0];
    const monthRow = this.query(`SELECT COALESCE(SUM(cost),0) AS cost,
      COALESCE(SUM(CASE WHEN state != 'settled' THEN cost ELSE 0 END),0) AS reserved
      FROM evaluations WHERE month = ?`, month)[0];
    const adjusted = this.query("SELECT COALESCE(SUM(cost),0) AS cost FROM adjustments WHERE month = ?", month)[0].cost;
    const monthly = monthRow.cost + adjusted;
    const speech = this.query(`SELECT COUNT(*) AS used, COALESCE(SUM(neurons),0) AS neurons,
      COALESCE(SUM(seconds),0) AS seconds FROM transcriptions WHERE day = ?`, day)[0];
    return {
      day, month, evaluationsToday: dayRow.used, remainingToday: Math.max(0, DAILY_CAP - dayRow.used),
      inputTokensToday: dayRow.input, outputTokensToday: dayRow.output,
      estimatedDailyMicros: dayRow.cost, estimatedMonthlyMicros: monthly,
      reservedMonthlyMicros: monthRow.reserved, remainingMonthlyMicros: Math.max(0, MONTHLY_CAP - monthly),
      transcriptionsToday: speech.used, remainingTranscriptionsToday: Math.max(0, DAILY_TRANSCRIPTIONS - speech.used),
      audioSecondsToday: Math.round(speech.seconds), estimatedNeuronsToday: speech.neurons
    };
  }

  // Transcriptions are free (Workers AI Free allocation); the count cap keeps the reserved maximum
  // (20 × 5 minutes) well inside the daily allocation. One request runs at a time.
  reserveTranscription(id, fingerprint, now, neurons) {
    return this.transaction(() => {
      const [day, month] = period(now);
      this.query("UPDATE transcriptions SET state = 'held' WHERE state = 'pending' AND created <= ?", now - PENDING_MS);
      this.query("DELETE FROM transcriptions WHERE month < ? AND created < ?", month, now - MONTH_MS);
      if (this.query("SELECT 1 FROM transcriptions WHERE id = ? OR (fingerprint = ? AND created > ?) LIMIT 1",
        id, fingerprint, now - DUPLICATE_MS).length) return "duplicate";
      if (this.query("SELECT 1 FROM transcriptions WHERE state = 'pending' OR created > ? LIMIT 1",
        now - 2_000).length) return "rate";
      if (!this.totals(now).remainingTranscriptionsToday) return "transcription_daily";
      this.query("INSERT INTO transcriptions VALUES (?, ?, ?, ?, ?, 'pending', ?, NULL)",
        id, fingerprint, now, day, month, neurons);
      return "accepted";
    });
  }

  // Without a reported duration the full reservation is kept.
  settleTranscription(id, seconds, neurons) {
    if (seconds === null) {
      this.query("UPDATE transcriptions SET state = 'held' WHERE id = ? AND state = 'pending'", id);
      return;
    }
    this.query(`UPDATE transcriptions SET state = 'settled', seconds = ?, neurons = ?
      WHERE id = ? AND state IN ('pending','held')`, seconds, neurons, id);
  }

  reserve(id, fingerprint, now, cost) {
    if (!Number.isSafeInteger(cost) || cost <= 0 || cost > MONTHLY_CAP) return "budget";
    return this.transaction(() => {
      if (this.latched()) return "disabled";
      const [day, month] = period(now);
      this.query("UPDATE evaluations SET state = 'held' WHERE state = 'pending' AND created <= ?", now - PENDING_MS);
      // Retain the active and preceding accounting periods; no raw request data is retained.
      this.query("DELETE FROM evaluations WHERE month < ? AND created < ?", month, now - MONTH_MS);
      this.query("DELETE FROM adjustments WHERE month < ? AND created < ?", month, now - MONTH_MS);
      if (this.query("SELECT 1 FROM evaluations WHERE id = ? OR (fingerprint = ? AND created > ?) LIMIT 1",
        id, fingerprint, now - DUPLICATE_MS).length) return "duplicate";
      if (this.query("SELECT 1 FROM evaluations WHERE state = 'pending' OR (created > ? AND state != 'pending') LIMIT 1",
        now - 2_000).length) return "rate";
      const totals = this.totals(now);
      if (!totals.remainingToday) return "daily";
      if (cost > totals.remainingMonthlyMicros) return "budget";
      this.query("INSERT INTO evaluations VALUES (?, ?, ?, ?, ?, 'pending', ?, NULL, NULL)",
        id, fingerprint, now, day, month, cost);
      return "accepted";
    });
  }

  settle(id, usage, now = Date.now()) {
    if (!usage) {
      this.query("UPDATE evaluations SET state = 'held' WHERE id = ? AND state = 'pending'", id);
      return;
    }
    this.transaction(() => {
      this.query(`UPDATE evaluations SET state='settled', cost=?, input=?, output=?
        WHERE id=? AND state IN ('pending','held')`, usage.cost, usage.input, usage.output, id);
      if (usage.exceeded) this.query("INSERT OR IGNORE INTO controls VALUES (?, ?)", LATCH, now);
    });
  }

  latched() {
    return this.query("SELECT since FROM controls WHERE name = ?", LATCH)[0]?.since ?? null;
  }

  status(now) {
    const [, month] = period(now);
    const held = this.query(`SELECT COUNT(*) AS count, COALESCE(SUM(cost),0) AS micros
      FROM evaluations WHERE month = ? AND state IN ('pending','held')`, month)[0];
    const recoveries = this.query(`SELECT id, created, month, ledger, reported, adjustment, latched
      FROM recoveries ORDER BY created DESC LIMIT 5`);
    const latched = this.latched();
    return { latched: latched !== null, latchedSince: latched, totals: this.totals(now), held, recoveries };
  }

  // Administrative recovery: reconcile the month against the spend OpenAI reports, then clear the latch.
  // The ledger never lowers its own estimate; it only raises it to the reported figure.
  recover(id, now, month, reported) {
    return this.transaction(() => {
      const [, current] = period(now);
      if (month !== current) return { error: "month" };
      if (this.query("SELECT 1 FROM recoveries WHERE id = ?", id).length) return { error: "duplicate" };
      if (this.query("SELECT 1 FROM evaluations WHERE state = 'pending' AND created > ?", now - PENDING_MS).length) {
        return { error: "busy" };
      }
      const ledger = this.totals(now).estimatedMonthlyMicros;
      const adjustment = Math.max(0, reported - ledger);
      if (adjustment) this.query("INSERT INTO adjustments VALUES (?, ?, ?, ?)", id, month, now, adjustment);
      const latched = this.latched();
      this.query("DELETE FROM controls WHERE name = ?", LATCH);
      this.query("INSERT INTO recoveries VALUES (?, ?, ?, ?, ?, ?, ?)", id, now, month, ledger, reported, adjustment, latched);
      return {
        recovered: true, month, ledgerMicros: ledger, reportedMicros: reported, adjustmentMicros: adjustment,
        wasLatched: latched !== null, totals: this.totals(now)
      };
    });
  }
}
