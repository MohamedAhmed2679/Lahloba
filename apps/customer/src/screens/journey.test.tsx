import { describe, expect, it } from 'vitest';
import { currentStage, journeyStages } from './OrderJourney';

const o = (p: Partial<Parameters<typeof currentStage>[0]>) => ({ source: 'SUPPLIERS' as const, fulfillmentState: 'RESERVED' as const, fundingState: 'UNFUNDED' as const, chefAcceptance: 'PENDING' as const, ...p });

describe('order journey', () => {
  it('has an ingredient stage only when shops supply the ingredients', () => {
    expect(journeyStages({ source: 'SUPPLIERS' }).map((s) => s.key)).toEqual(['paid', 'accepted', 'ingredients', 'cooking', 'onTheWay', 'delivered']);
    expect(journeyStages({ source: 'CHEF' }).map((s) => s.key)).toEqual(['paid', 'accepted', 'cooking', 'onTheWay', 'delivered']);
  });
  it('follows the real order states, never ahead of them', () => {
    const keys = journeyStages({ source: 'SUPPLIERS' }).map((s) => s.key);
    const at = (x: Parameters<typeof currentStage>[0]) => keys[currentStage(x)] ?? 'all-done';
    expect(at(o({}))).toBe('paid');
    expect(at(o({ fundingState: 'PARTIALLY_FUNDED' }))).toBe('paid');
    expect(at(o({ fundingState: 'FUNDED' }))).toBe('accepted');
    expect(at(o({ fundingState: 'FUNDED', chefAcceptance: 'ACCEPTED' }))).toBe('ingredients');
    expect(at(o({ fulfillmentState: 'AWAITING_INGREDIENTS', fundingState: 'FUNDED', chefAcceptance: 'ACCEPTED' }))).toBe('ingredients');
    expect(at(o({ fulfillmentState: 'PREPARING', fundingState: 'FUNDED', chefAcceptance: 'ACCEPTED' }))).toBe('cooking');
    expect(at(o({ fulfillmentState: 'OUT_FOR_DELIVERY', fundingState: 'FUNDED', chefAcceptance: 'ACCEPTED' }))).toBe('onTheWay');
    expect(at(o({ fulfillmentState: 'DELIVERED', fundingState: 'FUNDED', chefAcceptance: 'ACCEPTED' }))).toBe('all-done');
    // Chef-supplied: after acceptance the next stage is cooking.
    expect(journeyStages({ source: 'CHEF' })[currentStage(o({ source: 'CHEF', fundingState: 'FUNDED', chefAcceptance: 'ACCEPTED' }))]!.key).toBe('cooking');
  });
});
