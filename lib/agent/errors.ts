// Erro de negócio da API do agente. Toda rota deve lançar isso (nunca Error genérico)
// para controlar o status HTTP e o código de erro devolvido no envelope padrão.
export class AgentApiError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function notFound(resource: string): AgentApiError {
  return new AgentApiError(404, 'NOT_FOUND', `${resource} não encontrado`);
}

export function badRequest(message: string): AgentApiError {
  return new AgentApiError(400, 'VALIDATION_ERROR', message);
}

// Envelope de erro padrão de toda resposta não-2xx da API do agente.
export function errorEnvelope(code: string, message: string) {
  return { error: { code, message } };
}
