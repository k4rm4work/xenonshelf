/** Why a request to the server failed, as the app words it (apiError.<reason>): the server
    answers with one of these codes, never with text of its own, so the reader sees it in their
    language. Anything else comes out as `server`; no answer at all as `offline`. */
export const API_ERRORS = ['invalid', 'tooLarge', 'igdbKeys', 'igdbBusy', 'igdbDown', 'server', 'offline'] as const;

export type ApiError = (typeof API_ERRORS)[number];

export class ApiFailure extends Error {
  constructor(readonly reason: ApiError) {
    super(reason);
  }
}

/** The code a server's error names, if the app knows it. */
export const reasonFor = (code: unknown): ApiError => API_ERRORS.find((known) => known === code) ?? 'server';

/** The failure a refused request carries, read from its body. */
export async function failureOf(res: Response): Promise<ApiFailure> {
  const body = (await res.json().catch(() => null)) as { error?: unknown } | null;
  return new ApiFailure(reasonFor(body?.error));
}

/** The reason behind anything a request threw: fetch itself throws a TypeError when the
    server can't be reached. */
export function reasonOf(err: unknown): ApiError {
  if (err instanceof ApiFailure) return err.reason;
  return err instanceof TypeError ? 'offline' : 'server';
}
