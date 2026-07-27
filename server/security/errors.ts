export class AppError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export const forbidden = (message = 'Accès refusé.') => new AppError('FORBIDDEN', 403, message);
export const unauthorized = (message = 'Authentification requise.') =>
  new AppError('UNAUTHORIZED', 401, message);
export const conflict = (message: string) => new AppError('CONFLICT', 409, message);
export const validationError = (message: string) => new AppError('VALIDATION_ERROR', 422, message);
