import { or, eq, isNull } from 'drizzle-orm';
import { clients } from './schema';

// Exclui clientes de teste, mas mantém linhas sem cliente (custos da agência).
export const notTestClient = or(isNull(clients.isTest), eq(clients.isTest, false));
