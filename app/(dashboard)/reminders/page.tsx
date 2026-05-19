export const dynamic = 'force-dynamic';

import { db } from '@/lib/db';
import { reminders, messageTemplates, clients, systemSettings } from '@/lib/db/schema';
import { desc, eq } from 'drizzle-orm';
import RemindersClient from '@/components/reminders/RemindersClient';

export default async function RemindersPage() {
  const [reminderRows, templates, clientRows, alertPhoneSetting] = await Promise.all([
    db
      .select({
        reminder: reminders,
        clientName: clients.name,
        templateName: messageTemplates.name,
      })
      .from(reminders)
      .leftJoin(clients, eq(reminders.clientId, clients.id))
      .leftJoin(messageTemplates, eq(reminders.templateId, messageTemplates.id))
      .orderBy(desc(reminders.triggerDate))
      .limit(100),

    db.select().from(messageTemplates).orderBy(desc(messageTemplates.createdAt)),

    db.select().from(clients).where(eq(clients.status, 'active')).orderBy(clients.name),

    db.select().from(systemSettings).where(eq(systemSettings.key, 'alert_phone')).limit(1),
  ]);

  return (
    <RemindersClient
      reminders={reminderRows}
      templates={templates}
      clients={clientRows}
      alertPhone={alertPhoneSetting[0]?.value ?? ''}
    />
  );
}
