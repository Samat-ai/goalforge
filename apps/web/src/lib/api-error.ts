export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public data?: unknown,
  ) {
    super(message)
    this.name = 'ApiError'
  }

  get isProRequired() { return this.status === 402 }
  get isNotFound() { return this.status === 404 }
  get isUnauthorized() { return this.status === 401 }
}

/**
 * Parse an axios-style response body into an ApiError.
 * Handles:
 *   {"error": {"message": "...", "code": "..."}}  — our API shape
 *   {"error": "some string"}                       — simple string error
 *   {"detail": "..."}                              — FastAPI default
 */
export function parseApiError(status: number, body: unknown): ApiError {
  const detail = (body as any)?.error ?? (body as any)?.detail

  let message: string
  let code: string

  if (typeof detail === 'string') {
    message = detail
    code = 'http_error'
  } else if (detail && typeof detail === 'object') {
    message = typeof detail.message === 'string' ? detail.message : String(detail.message ?? 'Unknown error')
    code = typeof detail.code === 'string' ? detail.code : 'http_error'
  } else {
    message = 'Something went wrong'
    code = 'http_error'
  }

  return new ApiError(status, code, message, body)
}
