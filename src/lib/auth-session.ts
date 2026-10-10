const DURATION_PATTERN = /^(\d+(?:\.\d+)?)(s|m|h|d)$/i;

/** Parse strings like `8h`, `30d`, `15m` into seconds. Falls back when invalid. */
export function parseDurationToSeconds(
  value: string | undefined,
  fallbackSeconds: number,
): number {
  const trimmed = value?.trim();
  if (!trimmed) return fallbackSeconds;

  const match = trimmed.match(DURATION_PATTERN);
  if (!match) return fallbackSeconds;

  const amount = Number(match[1]);
  if (!Number.isFinite(amount) || amount <= 0) return fallbackSeconds;

  const unit = match[2].toLowerCase();
  const multipliers: Record<string, number> = {
    s: 1,
    m: 60,
    h: 60 * 60,
    d: 24 * 60 * 60,
  };
  return Math.round(amount * multipliers[unit]!);
}

const DEFAULT_SHIFT_SECONDS = 8 * 60 * 60;
const DEFAULT_REMEMBER_SECONDS = 30 * 24 * 60 * 60;
const DEFAULT_UPDATE_AGE_SECONDS = 24 * 60 * 60;

/** Work-shift session when “Keep me signed in” is off. */
export const SESSION_MAX_AGE_SECONDS = parseDurationToSeconds(
  process.env.JWT_EXPIRY,
  DEFAULT_SHIFT_SECONDS,
);

/** Extended session when “Keep me signed in” is on. */
export const SESSION_REMEMBER_MAX_AGE_SECONDS = parseDurationToSeconds(
  process.env.JWT_REMEMBER_EXPIRY,
  DEFAULT_REMEMBER_SECONDS,
);

/** Sliding refresh window (active use extends session up to remember max). */
export const SESSION_UPDATE_AGE_SECONDS = parseDurationToSeconds(
  process.env.JWT_UPDATE_AGE,
  DEFAULT_UPDATE_AGE_SECONDS,
);

export function sessionMaxAgeForRemember(rememberMe: boolean): number {
  return rememberMe ? SESSION_REMEMBER_MAX_AGE_SECONDS : SESSION_MAX_AGE_SECONDS;
}
