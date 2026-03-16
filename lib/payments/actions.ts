'use server';

import { redirect } from 'next/navigation';
import { withTeam } from '@/lib/auth/middleware';

// Stripe não utilizado neste projeto
export const checkoutAction = withTeam(async () => {
  redirect('/dashboard');
});

export const customerPortalAction = withTeam(async () => {
  redirect('/dashboard');
});
