/** Lightweight API error - safe to import from services/tests without NextAuth. */
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public details?: unknown,
    public code?: string,
  ) {
    super(message);
  }
}
