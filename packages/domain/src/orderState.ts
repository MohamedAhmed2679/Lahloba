// Ported from the reference starter. Fulfillment state only; payment/settlement/refund states
// are independent machines (Slice 3). Actor authorization and context derivation belong in a
// trusted application service, never in client input.
import { fail } from './errors';
import { integer } from './money';
import type { IngredientSource } from './quote';

export type FulfillmentState =
  | 'RESERVED' | 'AWAITING_INGREDIENTS' | 'READY_TO_PREPARE' | 'PREPARING'
  | 'READY_FOR_PICKUP' | 'OUT_FOR_DELIVERY' | 'DELIVERED' | 'CANCELLED';

export type FulfillmentEvent =
  | 'CONFIRM' | 'ACCEPT_INGREDIENTS' | 'START_PREPARATION' | 'MARK_READY'
  | 'FINAL_PICKUP' | 'DELIVER' | 'CANCEL_RESERVED';

export interface OrderAggregate {
  state: FulfillmentState;
  source: IngredientSource;
  version: number;
  ingredientsAccepted?: boolean;
}

export interface TransitionContext {
  expectedVersion?: number;
  partnersConfirmed?: boolean;
  fundingConfirmed?: boolean;
  allRequiredAccepted?: boolean;
  handoffVerified?: boolean;
  capacityConfirmed?: boolean;
  chefIngredientsChecked?: boolean;
  packed?: boolean;
  instructionsAttached?: boolean;
  assignedCourier?: boolean;
  recipientProofVerified?: boolean;
}

export function transition<T extends OrderAggregate>(order: T, event: FulfillmentEvent, ctx: TransitionContext = {}): T {
  const next: T = { ...order, version: integer(order.version, 'version') + 1 };
  if (ctx.expectedVersion !== order.version) fail('VERSION_CONFLICT', 'Order changed; refresh before retrying');
  const require = (ok: boolean, code: Parameters<typeof fail>[0], message: string) => {
    if (!ok) fail(code, message);
  };
  switch (event) {
    case 'CONFIRM':
      require(order.state === 'RESERVED', 'INVALID_TRANSITION', 'Only reserved orders can confirm');
      require(ctx.partnersConfirmed === true && ctx.fundingConfirmed === true, 'NOT_CONFIRMED', 'Partners and funding must confirm');
      next.state = order.source === 'SUPPLIERS' ? 'AWAITING_INGREDIENTS' : 'READY_TO_PREPARE';
      break;
    case 'ACCEPT_INGREDIENTS':
      require(order.state === 'AWAITING_INGREDIENTS', 'INVALID_TRANSITION', 'Ingredients are not awaited');
      require(ctx.allRequiredAccepted === true && ctx.handoffVerified === true, 'INGREDIENTS_NOT_ACCEPTED', 'Required ingredients and handoff must be accepted');
      next.ingredientsAccepted = true;
      next.state = 'READY_TO_PREPARE';
      break;
    case 'START_PREPARATION':
      require(order.state === 'READY_TO_PREPARE', 'INVALID_TRANSITION', 'Order is not ready to prepare');
      require(ctx.fundingConfirmed === true && ctx.capacityConfirmed === true, 'PREP_BLOCKED', 'Funding and capacity required');
      require(
        order.source === 'CHEF' ? ctx.chefIngredientsChecked === true : order.ingredientsAccepted === true,
        'INGREDIENTS_NOT_ACCEPTED', 'Ingredients must be checked',
      );
      next.state = 'PREPARING';
      break;
    case 'MARK_READY':
      require(order.state === 'PREPARING', 'INVALID_TRANSITION', 'Order is not preparing');
      require(ctx.packed === true && ctx.instructionsAttached === true, 'NOT_PACKED', 'Packaging and instructions required');
      next.state = 'READY_FOR_PICKUP';
      break;
    case 'FINAL_PICKUP':
      require(order.state === 'READY_FOR_PICKUP', 'INVALID_TRANSITION', 'Meal not ready');
      require(ctx.assignedCourier === true && ctx.handoffVerified === true, 'HANDOFF_REQUIRED', 'Assigned courier and proof required');
      next.state = 'OUT_FOR_DELIVERY';
      break;
    case 'DELIVER':
      require(order.state === 'OUT_FOR_DELIVERY', 'INVALID_TRANSITION', 'Order not out for delivery');
      require(ctx.recipientProofVerified === true, 'HANDOFF_REQUIRED', 'Recipient proof required');
      next.state = 'DELIVERED';
      break;
    case 'CANCEL_RESERVED':
      require(order.state === 'RESERVED', 'INVALID_TRANSITION', 'Only unconfirmed reserved cancellation is supported');
      next.state = 'CANCELLED';
      break;
    default:
      fail('UNKNOWN_EVENT', 'Event not supported');
  }
  return next;
}
