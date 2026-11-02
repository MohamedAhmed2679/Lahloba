import type { Handler } from './outbox';

/**
 * Slice 1 event handlers. No notification provider (SMS/push/email) is connected yet, so the
 * handlers record that delivery was NOT attempted. Replace NotificationPort with a real adapter
 * in a later slice; do not change these outcomes to imply delivery.
 */
export interface NotificationPort {
  readonly enabled: boolean;
  send(input: { template: string; aggregateId: string; correlationId: string }): Promise<void>;
}

export const disabledNotifications: NotificationPort = {
  enabled: false,
  async send() {
    throw new Error('Notification adapter is disabled');
  },
};

export function createHandlers(notifications: NotificationPort = disabledNotifications): Record<string, Handler> {
  const notify = (template: string): Handler => async (e) => {
    if (!notifications.enabled) return 'NOTIFICATION_ADAPTER_DISABLED';
    await notifications.send({ template, aggregateId: e.aggregateId, correlationId: e.correlationId });
    return `NOTIFICATION_SENT:${template}`;
  };
  return {
    PartnerApplicationSubmitted: notify('partner_application_received'),
    PartnerApplicationDecided: notify('partner_application_decided'),
    DishPublished: async () => 'NO_ACTION_REQUIRED',
  };
}
