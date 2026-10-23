import { z } from 'zod';
import { LocalizedText, Piastres, Uuid } from './schemas';

/**
 * Slice 2-4 contracts: quotes, orders, sandbox payments, partner responses, deliveries.
 * Every amount is integer piastres computed by the server; clients never send prices.
 */
export const IngredientSourceSchema = z.enum(['CHEF', 'SUPPLIERS']);
export const AddressInput = z.object({
  addressText: z.string().trim().min(5).max(500),
  areaId: Uuid,
  label: z.string().trim().max(40).optional(),
  accessNotes: z.string().trim().max(300).optional(),
}).strict();

export const QuoteRequest = z.object({
  offerId: Uuid,
  servings: z.number().int().min(1).max(100),
  source: IngredientSourceSchema,
  slotId: Uuid,
  address: AddressInput.optional(),
  addressId: Uuid.optional(),
  /** Optional per-ingredient choice; otherwise the cheapest complete basket is chosen. */
  supplierChoices: z.array(z.object({ ingredientId: Uuid, productId: Uuid }).strict()).max(50).optional(),
}).strict().refine((b) => !!b.address !== !!b.addressId, { message: 'Give either a new address or a saved addressId' });
export type QuoteRequest = z.infer<typeof QuoteRequest>;

export const QuoteComponentSchema = z.enum(['LABOR', 'PACKAGING', 'INGREDIENTS', 'INGREDIENT_TRIP', 'FINAL_TRIP', 'SERVICE_FEE', 'TAX']);
export const RecipientTypeSchema = z.enum(['CHEF', 'SUPPLIER', 'DELIVERY_LEG', 'PLATFORM']);

export const QuoteLineDto = z.object({
  component: QuoteComponentSchema,
  recipientType: RecipientTypeSchema,
  recipientName: z.string(),
  amountPiastres: Piastres,
});
export const BasketOption = z.object({
  productId: Uuid, branchId: Uuid, branchName: z.string(), branchArea: LocalizedText,
  packQuantity: z.number(), packUnit: z.string(), packPricePiastres: Piastres, packs: z.number().int(),
  amountPiastres: Piastres, leftoverQuantity: z.number(), variableWeight: z.boolean(), availablePacks: z.number().int(),
});
export const BasketLine = z.object({
  ingredientId: Uuid, name: LocalizedText, requiredQuantity: z.number(), unit: z.string(),
  chosen: BasketOption.nullable(), options: z.array(BasketOption),
});
export const QuoteDto = z.object({
  id: Uuid,
  offerId: Uuid,
  dishTitle: LocalizedText,
  chef: z.object({ id: Uuid, publicName: z.string() }),
  source: IngredientSourceSchema,
  servings: z.number().int(),
  slot: z.object({ slotId: Uuid, startsAt: z.string(), endsAt: z.string() }),
  deliveryArea: LocalizedText,
  lines: z.array(QuoteLineDto),
  basket: z.array(BasketLine),
  pantryNote: z.array(LocalizedText),
  totalPiastres: Piastres,
  expiresAt: z.string(),
  illustrative: z.boolean(),
  sandbox: z.literal(true),
});
export type QuoteDto = z.infer<typeof QuoteDto>;

export const FulfillmentStateSchema = z.enum(['RESERVED', 'AWAITING_INGREDIENTS', 'READY_TO_PREPARE', 'PREPARING', 'READY_FOR_PICKUP', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED', 'ON_HOLD']);
export const FundingStateSchema = z.enum(['UNFUNDED', 'PARTIALLY_FUNDED', 'FUNDED', 'COMPENSATING', 'COMPENSATED']);
export const AttemptStateSchema = z.enum(['PENDING', 'SUCCEEDED', 'FAILED', 'UNKNOWN', 'VOIDED']);
export const LegStateSchema = z.enum(['WAITING', 'OPEN', 'ASSIGNED', 'PICKED_UP', 'DELIVERED', 'CANCELLED']);
export const LegKindSchema = z.enum(['INGREDIENT_TO_CHEF', 'MEAL_TO_CUSTOMER']);

export const MapPoint = z.object({ lat: z.number(), lng: z.number(), label: LocalizedText, approximate: z.literal(true) });
export const LegTracking = z.object({
  legId: Uuid, kind: LegKindSchema, state: LegStateSchema, feePiastres: Piastres,
  courierName: z.string().nullable(),
  from: MapPoint.nullable(), to: MapPoint.nullable(),
});

export const PaymentAllocationDto = z.object({
  allocationId: Uuid, recipientType: RecipientTypeSchema, recipientName: z.string(), components: z.array(QuoteComponentSchema),
  amountPiastres: Piastres, state: z.enum(['UNPAID', 'PENDING', 'PAID', 'FAILED', 'UNKNOWN', 'REFUNDED', 'PARTIALLY_REFUNDED']),
  refundedPiastres: Piastres,
});
export const OrderEventDto = z.object({ kind: z.string(), at: z.string() });

export const OrderDto = z.object({
  id: Uuid,
  reference: z.string(),
  dishTitle: LocalizedText,
  chef: z.object({ id: Uuid, publicName: z.string() }),
  source: IngredientSourceSchema,
  servings: z.number().int(),
  slot: z.object({ startsAt: z.string(), endsAt: z.string() }),
  fulfillmentState: FulfillmentStateSchema,
  fundingState: FundingStateSchema,
  chefAcceptance: z.enum(['PENDING', 'ACCEPTED', 'REJECTED']),
  suppliers: z.array(z.object({ branchName: z.string(), state: z.enum(['PENDING', 'CONFIRMED', 'REJECTED', 'HANDED_OVER', 'CANCELLED']) })),
  totalPiastres: Piastres,
  lines: z.array(QuoteLineDto),
  allocations: z.array(PaymentAllocationDto),
  payBy: z.string().nullable(),
  /** The customer shows this code to the courier at the door. Only present for the customer. */
  dropoffCode: z.string().nullable(),
  legs: z.array(LegTracking),
  cancelReason: z.string().nullable(),
  events: z.array(OrderEventDto),
  version: z.number().int(),
  createdAt: z.string(),
  sandbox: z.literal(true),
});
export type OrderDto = z.infer<typeof OrderDto>;
export const OrderSummary = OrderDto.pick({ id: true, reference: true, dishTitle: true, fulfillmentState: true, fundingState: true, totalPiastres: true, createdAt: true, servings: true });
export const OrderList = z.object({ items: z.array(OrderSummary) });

export const CreateOrderRequest = z.object({ quoteId: Uuid }).strict();
export const CancelOrderRequest = z.object({ reason: z.string().trim().min(3).max(300), expectedVersion: z.number().int().positive() }).strict();

// ---------- Sandbox payments (simulator; no real money) ----------
export const PaymentSessionDto = z.object({
  sessionId: z.string(),
  orderId: Uuid,
  attempts: z.array(z.object({ attemptId: Uuid, recipientName: z.string(), amountPiastres: Piastres, state: AttemptStateSchema })),
  totalPiastres: Piastres,
  provider: z.literal('simulator'),
  sandbox: z.literal(true),
});
export const SimulatorOutcome = z.enum(['SUCCEED', 'DECLINE', 'TIMEOUT']);
export const SimulatorCompleteRequest = z.object({
  outcome: SimulatorOutcome,
  /** Optional: fail only this attempt (tests split payments where one recipient fails). */
  attemptId: Uuid.optional(),
}).strict();

// ---------- Partner views ----------
export const ChefOrderDto = z.object({
  id: Uuid, reference: z.string(), dishTitle: LocalizedText, serviceMode: z.enum(['EAT_NOW', 'HEAT_AT_HOME', 'COOK_AT_HOME']),
  servings: z.number().int(), source: IngredientSourceSchema,
  slot: z.object({ startsAt: z.string(), endsAt: z.string() }),
  fulfillmentState: FulfillmentStateSchema, fundingState: FundingStateSchema,
  chefAcceptance: z.enum(['PENDING', 'ACCEPTED', 'REJECTED']), respondBy: z.string(),
  ingredientsAccepted: z.boolean(),
  ingredients: z.array(z.object({ ingredientId: Uuid, name: LocalizedText, quantity: z.number(), unit: z.string(), weightBasis: z.string(), isPantry: z.boolean() })),
  chefEarningsPiastres: Piastres,
  /** Code the chef shows: to the ingredient courier on arrival, and to the meal courier at pickup. */
  ingredientDropoffCode: z.string().nullable(),
  mealPickupCode: z.string().nullable(),
  legs: z.array(LegTracking),
  version: z.number().int(),
});
export const ChefOrderList = z.object({ items: z.array(ChefOrderDto) });
export const ChefRespondRequest = z.object({
  accept: z.boolean(), reason: z.string().trim().min(3).max(300).optional(), expectedVersion: z.number().int().positive(),
}).strict().refine((b) => b.accept || !!b.reason, { message: 'A reason is required to decline' });
export const ChefIngredientCheckRequest = z.object({
  accepted: z.boolean(),
  lines: z.array(z.object({ ingredientId: Uuid, ok: z.boolean(), note: z.string().trim().max(200).optional() }).strict()).min(1).max(50),
  note: z.string().trim().min(3).max(300).optional(),
  expectedVersion: z.number().int().positive(),
}).strict().refine((b) => b.accepted || !!b.note, { message: 'Explain what is wrong with the ingredients' });
export const ChefStepRequest = z.object({ expectedVersion: z.number().int().positive() }).strict();

export const SupplierSuborderDto = z.object({
  id: Uuid, orderReference: z.string(), state: z.enum(['PENDING', 'CONFIRMED', 'REJECTED', 'HANDED_OVER', 'CANCELLED']),
  lines: z.array(z.object({ productId: Uuid, sku: z.string(), name: LocalizedText, packs: z.number().int(), packQuantity: z.number(), packUnit: z.string(), amountPiastres: Piastres })),
  totalPiastres: Piastres, respondBy: z.string(), funded: z.boolean(),
  /** Shown to the courier at collection. */
  pickupCode: z.string().nullable(),
  courierName: z.string().nullable(),
  version: z.number().int(),
});
export const SupplierSuborderList = z.object({ items: z.array(SupplierSuborderDto) });
export const SupplierRespondRequest = z.object({
  confirm: z.boolean(), reason: z.string().trim().min(3).max(300).optional(), expectedVersion: z.number().int().positive(),
}).strict().refine((b) => b.confirm || !!b.reason, { message: 'A reason is required to reject' });

export const CourierStopDto = z.object({
  stopId: Uuid, seq: z.number().int(), partyType: z.enum(['SUPPLIER_BRANCH', 'CHEF']), partyName: z.string(),
  area: LocalizedText,
  /** Exact address only after the courier has claimed the leg. */
  addressText: z.string().nullable(),
  state: z.enum(['PENDING', 'COLLECTED']),
});
export const CourierLegDto = z.object({
  legId: Uuid, kind: LegKindSchema, state: LegStateSchema, feePiastres: Piastres, requiredEquipment: z.array(z.string()),
  fromArea: LocalizedText, toArea: LocalizedText,
  stops: z.array(CourierStopDto),
  dropoff: z.object({ partyName: z.string(), addressText: z.string().nullable(), accessNotes: z.string().nullable() }),
  from: MapPoint.nullable(), to: MapPoint.nullable(),
  version: z.number().int(),
  canClaim: z.boolean(),
});
export const CourierLegList = z.object({ items: z.array(CourierLegDto) });
export const CourierCodeRequest = z.object({ code: z.string().trim().regex(/^\d{4,8}$/), expectedVersion: z.number().int().positive() }).strict();
export const CourierClaimRequest = z.object({ expectedVersion: z.number().int().positive() }).strict();
export type ChefOrderDto = z.infer<typeof ChefOrderDto>;
export type SupplierSuborderDto = z.infer<typeof SupplierSuborderDto>;
export type CourierLegDto = z.infer<typeof CourierLegDto>;
export type PaymentSessionDto = z.infer<typeof PaymentSessionDto>;
export type OrderSummary = z.infer<typeof OrderSummary>;
export type BasketLine = z.infer<typeof BasketLine>;
