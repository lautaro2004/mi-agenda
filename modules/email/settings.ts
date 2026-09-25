import { prisma } from "@/lib/prisma";

export const EMAIL_SETTINGS_DEFAULTS = {
  bookingConfirmationEnabled: true,
  reminderEnabled: false,
  reminderLeadMinutes: 60,
  dailySummaryEnabled: false,
  dailySummaryHour: 8,
} as const;

export interface EmailSettingsValues {
  bookingConfirmationEnabled: boolean;
  reminderEnabled: boolean;
  reminderLeadMinutes: number;
  dailySummaryEnabled: boolean;
  dailySummaryHour: number;
}

export async function getEmailSettings(businessId: string): Promise<EmailSettingsValues> {
  const row = await prisma.emailNotificationSettings.findUnique({ where: { businessId } });
  if (!row) return { ...EMAIL_SETTINGS_DEFAULTS };
  return {
    bookingConfirmationEnabled: row.bookingConfirmationEnabled,
    reminderEnabled: row.reminderEnabled,
    reminderLeadMinutes: row.reminderLeadMinutes,
    dailySummaryEnabled: row.dailySummaryEnabled,
    dailySummaryHour: row.dailySummaryHour,
  };
}

export async function updateEmailSettings(businessId: string, values: EmailSettingsValues): Promise<EmailSettingsValues> {
  await prisma.emailNotificationSettings.upsert({
    where: { businessId },
    create: { businessId, ...values },
    update: values,
  });
  return values;
}
