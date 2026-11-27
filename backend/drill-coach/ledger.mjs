const localCalendar = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Zurich", year: "numeric", month: "2-digit", day: "2-digit"
});

export const MONTHLY_CAP = 3_000_000;
export const DAILY_CAP = 10;
const PENDING_MS = 120_000;
const DUPLICATE_MS = 15 * 60_000;
const MONTH_MS = 32 * 86_400_000;

function period(now) {
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
    query("CREATE TABLE IF NOT EXISTS controls (name TEXT PRIMARY KEY)");
    query("CREATE INDEX IF NOT EXISTS by_day ON evaluations(day)");
    query("CREATE INDEX IF NOT EXISTS by_month ON evaluations(month)");
    query("CREATE INDEX IF NOT EXISTS by_fingerprint ON evaluations(fingerprint, created)");
  }

  challenge(nonce, expires) {
    this.query("INSERT INTO challenges VALUES (?, ?)", nonce, expires);
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
    return {
      day, month, evaluationsToday: dayRow.used, remainingToday: Math.max(0, DAILY_CAP - dayRow.used),
      inputTokensToday: dayRow.input, outputTokensToday: dayRow.output,
      estimatedDailyMicros: dayRow.cost, estimatedMonthlyMicros: monthRow.cost,
      reservedMonthlyMicros: monthRow.reserved, remainingMonthlyMicros: Math.max(0, MONTHLY_CAP - monthRow.cost)
    };
  }

  reserve(id, fingerprint, now, cost) {
    if (!Number.isSafeInteger(cost) || cost <= 0 || cost > MONTHLY_CAP) return "budget";
    return this.transaction(() => {
      if (this.query("SELECT 1 FROM controls WHERE name = 'usage-bound'").length) return "disabled";
      const [day, month] = period(now);
      this.query("UPDATE evaluations SET state = 'held' WHERE state = 'pending' AND created <= ?", now - PENDING_MS);
      // Retain the active and preceding accounting periods; no raw request data is retained.
      this.query("DELETE FROM evaluations WHERE month < ? AND created < ?", month, now - MONTH_MS);
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

  settle(id, usage) {
    if (!usage) {
      this.query("UPDATE evaluations SET state = 'held' WHERE id = ? AND state = 'pending'", id);
      return;
    }
    this.transaction(() => {
      this.query(`UPDATE evaluations SET state='settled', cost=?, input=?, output=?
        WHERE id=? AND state IN ('pending','held')`, usage.cost, usage.input, usage.output, id);
      if (usage.exceeded) this.query("INSERT OR IGNORE INTO controls VALUES ('usage-bound')");
    });
  }
}
