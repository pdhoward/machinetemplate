// /config/rate.ts
function num(v: string | undefined, dflt: number) {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : dflt;
}

export const rateCfg = {
  // minute windows
  ipPerMin:        num(process.env.RATE_IP_PER_MIN,        60),
  userPerMin:      num(process.env.RATE_USER_PER_MIN,      120),
  sessionPerMin:   num(process.env.RATE_SESSION_PER_MIN,   6),

  // daily user quotas
  maxDailyTokens:  num(process.env.USER_MAX_TOKENS_DAILY,  150000),
  maxDailyDollars: num(process.env.USER_MAX_DOLLARS_DAILY, 5),

  // realtime session bounds
  maxConcurrentPerUser: num(process.env.MAX_CONCURRENT_SESSIONS_PER_USER, 2),
  maxSessionMinutes:    num(process.env.MAX_SESSION_MINUTES, 15),
  maxSessionIdleSec:    num(process.env.MAX_SESSION_IDLE_SEC, 90),

  // edge limiter (upstash) is auto-detected by envs there
} as const;
