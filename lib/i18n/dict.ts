export type Language = 'pt' | 'es';
export type Currency = 'ARS' | 'BRL' | 'USD';

export const DICTIONARY = {
  pt: {
    appName: "Gestor Financeiro Pessoal",
    appSubtitle: "Controle de despesas familiares, filhos e estilo de vida (Brasil & Argentina)",
    nav: {
      dashboard: "Visão Geral",
      scan: "Escanear Comprovante (IA)",
      transactions: "Transações",
      categories: "Categorias & Metas",
      creditCards: "Cartões de Crédito",
      settings: "Configurações"
    },
    currencies: {
      ARS: "Peso Argentino ($)",
      BRL: "Real Brasileiro (R$)",
      USD: "Dólar ($)"
    },
    dashboard: {
      title: "Resumo Financeiro Pessoal",
      subtitle: "Consolidado em",
      totalIncome: "Receitas do Mês",
      totalExpenses: "Gastos do Mês",
      balance: "Saldo Líquido",
      scanQuickBtn: "Escanear Foto / Print",
      expensesByCategory: "Gastos por Categoria",
      recentTransactions: "Últimas Transações Pessoais",
      budgetProgress: "Progresso das Metas Mensais",
      childExpenses: "Gastos com Filhos & Família",
      exchangeRates: "Cotações do Dia"
    },
    scan: {
      title: "Escanear Comprovante ou Print com IA",
      subtitle: "Envie fotos de tickets, prints do Mercado Pago, PedidosYa, iFood, Coto, etc.",
      dragDropTitle: "Arraste e solte o comprovante aqui ou clique para selecionar",
      supportedFormats: "Suporta imagens (PNG, JPG, WebP) e faturas em PDF (Português e Espanhol)",
      analyzing: "A IA está lendo o comprovante...",
      detectingFields: "Identificando data, valor, moeda, estabelecimento e categoria...",
      successTitle: "Dados Identificados com Sucesso!",
      date: "Data do Gasto",
      amount: "Valor Original",
      currency: "Moeda Detectada",
      merchant: "Estabelecimento / Local",
      category: "Categoria Sugerida",
      description: "Descrição / Detalhes",
      childTag: "Vincular a Filho/Dependente?",
      saveTransaction: "Confirmar e Salvar Transação Pessoal",
      sampleReceiptsTitle: "Ou testar com comprovantes de exemplo:"
    }
  },
  es: {
    appName: "Gestor Financiero Personal",
    appSubtitle: "Control de gastos familiares, hijos y estilo de vida (Brasil y Argentina)",
    nav: {
      dashboard: "Resumen General",
      scan: "Escanear Comprobante (IA)",
      transactions: "Transacciones",
      categories: "Categorías y Metas",
      creditCards: "Tarjetas de Crédito",
      settings: "Configuración"
    },
    currencies: {
      ARS: "Peso Argentino ($)",
      BRL: "Real Brasileño (R$)",
      USD: "Dólar ($)"
    },
    dashboard: {
      title: "Resumen Financiero Personal",
      subtitle: "Consolidado en",
      totalIncome: "Ingresos del Mes",
      totalExpenses: "Gastos del Mes",
      balance: "Saldo Neto",
      scanQuickBtn: "Escanear Foto / Captura",
      expensesByCategory: "Gastos por Categoría",
      recentTransactions: "Últimas Transacciones Personales",
      budgetProgress: "Progreso de Presupuesto Mensual",
      childExpenses: "Gastos con Hijos y Familia",
      exchangeRates: "Cotizaciones del Día"
    },
    scan: {
      title: "Escanear Comprobante o Captura con IA",
      subtitle: "Sube fotos de tickets, capturas de Mercado Pago, PedidosYa, iFood, Coto, etc.",
      dragDropTitle: "Arrastra y suelta el comprobante aquí o haz clic para seleccionar",
      supportedFormats: "Soporta imágenes (PNG, JPG, WebP) y facturas en PDF (Portugués y Español)",
      analyzing: "La IA está leyendo el comprobante...",
      detectingFields: "Identificando fecha, monto, moneda, comercio y categoría...",
      successTitle: "¡Datos Identificados con Éxito!",
      date: "Fecha del Gasto",
      amount: "Monto Original",
      currency: "Moneda Detectada",
      merchant: "Establecimiento / Comercio",
      category: "Categoría Sugerida",
      description: "Descripción / Detalles",
      childTag: "¿Vincular a Hijo/Dependiente?",
      saveTransaction: "Confirmar y Guardar Transacción Personal",
      sampleReceiptsTitle: "O probar con comprobantes de ejemplo:"
    }
  }
};
