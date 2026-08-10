import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { isValidAgentToken, getAgentActor } from './auth';
import { logAgentCall } from './audit';
import { isRateLimited } from './rateLimit';
import { AgentApiError, errorEnvelope } from './errors';

export type AgentContext<TParams extends Record<string, string> = Record<string, string>> = {
  request: Request;
  actor: string;
  params: TParams;
};

export type AgentHandlerResult = {
  status: number;
  body: unknown;
  resourceType?: string;
  resourceId?: string;
  requestBody?: unknown;
  beforeData?: unknown;
  afterData?: unknown;
};

type Handler<TParams extends Record<string, string> = Record<string, string>> = (
  ctx: AgentContext<TParams>
) => Promise<AgentHandlerResult>;

type RouteContext<TParams extends Record<string, string>> = {
  params: Promise<TParams>;
};

function zodMessage(err: ZodError): string {
  return err.issues.map((i) => `${i.path.join('.') || 'body'}: ${i.message}`).join('; ');
}

// Helper central que envolve todo handler de rota da API do agente.
// Faz: medir tempo, validar Bearer, checar rate limit, rodar o handler,
// capturar erro não tratado e gravar exatamente uma linha de auditoria por chamada.
export function withAgentAuth<TParams extends Record<string, string> = Record<string, string>>(
  handler: Handler<TParams>
) {
  return async function routeHandler(request: Request, routeContext?: RouteContext<TParams>) {
    const start = Date.now();
    const url = new URL(request.url);
    const endpoint = url.pathname;
    const method = request.method;
    const ip = request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip') ?? null;
    const userAgent = request.headers.get('user-agent');

    if (!isValidAgentToken(request.headers.get('authorization'))) {
      const status = 401;
      await logAgentCall({
        actor: 'unknown',
        method,
        endpoint,
        statusCode: status,
        success: false,
        errorMessage: 'Token inválido ou ausente',
        ip,
        userAgent,
        durationMs: Date.now() - start,
      });
      return NextResponse.json(errorEnvelope('UNAUTHORIZED', 'Token inválido ou ausente'), { status });
    }

    const actor = getAgentActor(request);

    if (await isRateLimited(actor)) {
      const status = 429;
      await logAgentCall({
        actor,
        method,
        endpoint,
        statusCode: status,
        success: false,
        errorMessage: 'Limite de chamadas por minuto excedido',
        ip,
        userAgent,
        durationMs: Date.now() - start,
      });
      return NextResponse.json(
        errorEnvelope('RATE_LIMITED', 'Limite de chamadas por minuto excedido'),
        { status }
      );
    }

    const params = routeContext?.params ? await routeContext.params : ({} as TParams);

    try {
      const result = await handler({ request, actor, params });
      await logAgentCall({
        actor,
        method,
        endpoint,
        resourceType: result.resourceType,
        resourceId: result.resourceId,
        requestBody: result.requestBody,
        beforeData: result.beforeData,
        afterData: result.afterData,
        statusCode: result.status,
        success: result.status < 400,
        ip,
        userAgent,
        durationMs: Date.now() - start,
      });
      return NextResponse.json(result.body, { status: result.status });
    } catch (err) {
      if (err instanceof AgentApiError) {
        await logAgentCall({
          actor,
          method,
          endpoint,
          statusCode: err.status,
          success: false,
          errorMessage: err.message,
          ip,
          userAgent,
          durationMs: Date.now() - start,
        });
        return NextResponse.json(errorEnvelope(err.code, err.message), { status: err.status });
      }

      if (err instanceof ZodError) {
        const message = zodMessage(err);
        await logAgentCall({
          actor,
          method,
          endpoint,
          statusCode: 400,
          success: false,
          errorMessage: message,
          ip,
          userAgent,
          durationMs: Date.now() - start,
        });
        return NextResponse.json(errorEnvelope('VALIDATION_ERROR', message), { status: 400 });
      }

      // request.json() com corpo malformado (JSON quebrado ou vazio) lança
      // SyntaxError: é erro de requisição do chamador (400), não falha do servidor.
      if (err instanceof SyntaxError) {
        const message = 'Body inválido: JSON malformado';
        await logAgentCall({
          actor,
          method,
          endpoint,
          statusCode: 400,
          success: false,
          errorMessage: message,
          ip,
          userAgent,
          durationMs: Date.now() - start,
        });
        return NextResponse.json(errorEnvelope('VALIDATION_ERROR', message), { status: 400 });
      }

      // Erro inesperado: nunca vaza stack trace nem connection string na resposta,
      // só no log do servidor e no campo errorMessage do audit log.
      console.error(`[agent-api] erro não tratado em ${method} ${endpoint}:`, err);
      const message = err instanceof Error ? err.message : 'Erro desconhecido';
      await logAgentCall({
        actor,
        method,
        endpoint,
        statusCode: 500,
        success: false,
        errorMessage: message,
        ip,
        userAgent,
        durationMs: Date.now() - start,
      });
      return NextResponse.json(errorEnvelope('INTERNAL_ERROR', 'Erro interno do servidor'), { status: 500 });
    }
  };
}
