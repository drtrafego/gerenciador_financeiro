// Paginação padrão de toda lista da API do agente: offset/limit na query string,
// resposta sempre no formato { data, count }, onde count é o total de linhas que
// batem com os filtros (não só o tamanho da página).
export const DEFAULT_LIMIT = 50;
export const MAX_LIMIT = 200;

export function parsePagination(url: URL): { limit: number; offset: number } {
  const limitParam = Number(url.searchParams.get('limit') ?? DEFAULT_LIMIT);
  const offsetParam = Number(url.searchParams.get('offset') ?? 0);

  const limit = Number.isFinite(limitParam) && limitParam > 0
    ? Math.min(Math.floor(limitParam), MAX_LIMIT)
    : DEFAULT_LIMIT;
  const offset = Number.isFinite(offsetParam) && offsetParam >= 0 ? Math.floor(offsetParam) : 0;

  return { limit, offset };
}
