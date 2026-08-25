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
  // A tela /transactions era uma versão pobre do fluxo de caixa, sem seletor de
  // período, sem honorário de contrato e sem filtro de cliente de teste. Ficou
  // órfã de menu e foi aposentada: quem chegar por link antigo cai no fluxo de
  // caixa.
  //
  // permanent: false de propósito. O 308 fica gravado no navegador de quem
  // acessou e a decisão viraria irreversível na prática, mesmo removendo o
  // redirect depois.
  async redirects() {
    return [
      { source: '/transactions', destination: '/cash-flow', permanent: false },
      { source: '/transactions/:path*', destination: '/cash-flow', permanent: false },
    ];
  },
};

export default nextConfig;
