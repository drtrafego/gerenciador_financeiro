'use server';

import { revalidatePath } from 'next/cache';
import { setSetting } from '@/lib/db/queries';

export async function updateSettingsAction(formData: FormData) {
  const agencyName = formData.get('agency_name') as string;
  const agencyEmail = formData.get('agency_email') as string;
  const displayCurrency = formData.get('display_currency') as string;

  await Promise.all([
    agencyName && setSetting('agency_name', agencyName),
    agencyEmail && setSetting('agency_email', agencyEmail),
    displayCurrency && setSetting('display_currency', displayCurrency),
  ]);

  revalidatePath('/settings');
  revalidatePath('/dashboard');
}
