import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  experimental: {
    ppr: true,
    // clientSegmentCache desativado: estava servindo dados velhos na navegação
    // (ex: lançamento novo não aparecia no dashboard até hard refresh).
    // Upload de PDF de contrato passa pelo Server Action; o padrão de 1 MB
    // estoura com qualquer contrato real. Eleva o limite do corpo da requisição.
    serverActions: {
      bodySizeLimit: '15mb',
    },
  },
};

export default nextConfig;
