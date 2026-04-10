// Safely get the message string — works for Error, string, or anything else
export function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  return String(err);
}

// Re-throw as a proper Error — callers always get an Error, never unknown
export function toError(err: unknown): Error {
  if (err instanceof Error) return err;
  return new Error(getErrorMessage(err));
}
