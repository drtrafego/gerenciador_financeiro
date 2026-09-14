import { buildFirstBillingMessage } from './lib/wpp/send';

const casos = [
  {
    titulo: 'Gramado Plazza: cliente ANTIGO, serviço novo sozinho no dia',
    args: {
      saudacao: 'Will',
      data: '21/08/2026',
      items: [{ name: 'Implantação de Bot de Atendimento via WhatsApp', valor: 'R$ 750,00' }],
      total: 'R$ 750,00',
      postponed: false,
      firstNames: ['Implantação de Bot de Atendimento via WhatsApp'],
      clienteNovo: false,
    },
  },
  {
    titulo: 'Daruich: cliente NOVO de verdade, primeira mensagem',
    args: {
      saudacao: 'Daruich',
      data: '24/08/2026',
      items: [{ name: 'Gestão de Tráfego Pago e Estratégias Digitais', valor: 'R$ 1.500,00' }],
      total: 'R$ 1.500,00',
      postponed: false,
      firstNames: ['Gestão de Tráfego Pago e Estratégias Digitais'],
      clienteNovo: true,
    },
  },
  {
    titulo: 'Cliente antigo com serviço novo E contrato antigo no mesmo dia',
    args: {
      saudacao: 'Isabela',
      data: '24/08/2026',
      items: [
        { name: 'Gestão de tráfego', valor: 'R$ 1.500,00' },
        { name: 'Social media', valor: 'R$ 900,00' },
      ],
      total: 'R$ 2.400,00',
      postponed: false,
      firstNames: ['Social media'],
      clienteNovo: false,
    },
  },
];

for (const caso of casos) {
  console.log(`\n===== ${caso.titulo} =====`);
  console.log(buildFirstBillingMessage(caso.args));
}
