// Stripe não é utilizado neste projeto (DR.TRÁFEGO Financeiro)
// Este arquivo é mantido para compatibilidade com imports do repo base

import { redirect } from 'next/navigation';
import { Team } from '@/lib/db/schema';

export const stripe = null as any;

export async function createCheckoutSession(_: { team: Team | null; priceId: string }) {
  redirect('/dashboard');
}

export async function createCustomerPortalSession(_: Team) {
  redirect('/dashboard');
}

export async function handleSubscriptionChange(_: any) {}

export async function getStripePrices() {
  return [];
}

export async function getStripeProducts() {
  return [];
}
