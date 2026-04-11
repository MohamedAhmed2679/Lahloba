export interface EventEnvelope<T = unknown> {
  id: string; type: string; version: string; created_at: string;
  tenant: string; environment: string; correlation_id?: string;
  actor?: { actor_type: 'SYSTEM' | 'USER' | 'ADMIN'; actor_id?: string; role?: string };
  data: T;
}

export type OrderEvent = 'order.created' | 'order.confirmed' | 'order.status_changed' | 'order.cancelled' | 'order.refunded';
export type PaymentEvent = 'payment.intent_created' | 'payment.succeeded' | 'payment.failed';
export type FulfillmentEvent = 'store_fulfillment.created' | 'store_fulfillment.packing_started' | 'store_fulfillment.ready_for_pickup' | 'store_fulfillment.picked_up';
export type DeliveryEvent = 'delivery_task.created' | 'delivery_task.assigned' | 'delivery_task.status_changed' | 'delivery_task.completed' | 'delivery_stop.confirmed';
export type SubstitutionEvent = 'substitution.proposed' | 'substitution.approved_by_customer' | 'substitution.approved_by_chef' | 'substitution.rejected';
export type ChatEvent = 'chat_room.created' | 'chat_message.created';
export type AllEvents = OrderEvent | PaymentEvent | FulfillmentEvent | DeliveryEvent | SubstitutionEvent | ChatEvent | 'payout.created' | 'payout.completed' | 'support_ticket.created';

export interface Money { amount_minor: number; currency: string; }
export interface OrderPricing {
  chef_service_fee: Money; ingredients_total: Money;
  delivery_fees: { ingredients_run_fee: Money; meal_run_fee: Money };
  platform_fee: Money; tips?: { chef_tip?: Money; delivery_tip?: Money }; total: Money;
}
