export class ApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status = 500,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export const toPublicError = (error: unknown) => {
  if (error instanceof ApiError) {
    return {
      status: error.status,
      body: {
        error: error.code,
        message: error.message,
        ...(error.details ? { details: error.details } : {}),
      },
    };
  }

  return {
    status: 500,
    body: {
      error: "INTERNAL_SERVER_ERROR",
      message: "Une erreur inattendue est survenue cote serveur.",
    },
  };
};
