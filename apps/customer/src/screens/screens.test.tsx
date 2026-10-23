import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, NetworkError, type ApiClient, type Area, type OfferDetail, type OfferSearchResponse } from '@lahloba/contracts';
import type { Locale } from '@lahloba/i18n';
import { AuthContextProvider, KEYS, memoryStore, type AuthPort } from '@lahloba/app-shell';
import { AppProviders, useApp, type LocationPort, type Nav } from '../AppContext';
import { AreaSelectScreen } from './AreaSelectScreen';
import { HomeScreen } from './HomeScreen';
import { OfferDetailScreen } from './OfferDetailScreen';
import { ResultsScreen } from './ResultsScreen';
import { CheckoutScreen } from './CheckoutScreen';
import { OrderScreen } from './OrderScreens';

afterEach(cleanup);

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const maadi: Area = { id: id(1), slug: 'maadi', label: { en: 'Maadi', ar: 'المعادي' }, status: 'ACTIVE', physicalOrderingEnabled: true };
const zamalek: Area = { id: id(2), slug: 'zamalek', label: { en: 'Zamalek', ar: 'الزمالك' }, status: 'COMING_SOON', physicalOrderingEnabled: false };

export const signedOutAuth: AuthPort = {
  provider: 'clerk', status: 'signedOut', label: null, getToken: async () => null,
  startCode: async () => ({ error: null }), verifyCode: async () => ({ error: null }), signOut: async () => undefined,
};

function setup(opts: { api: Partial<ApiClient>; location?: LocationPort; area?: Area | null; locale?: Locale; auth?: AuthPort }, ui: React.ReactNode) {
  const nav: Nav = { push: vi.fn(), replace: vi.fn(), back: vi.fn() };
  const location = opts.location ?? { requestApproximate: vi.fn(async () => ({ status: 'denied' as const })) };
  render(
    <AuthContextProvider value={opts.auth ?? signedOutAuth}>
      <AppProviders api={opts.api as ApiClient} nav={nav} location={location} store={memoryStore()} initialArea={opts.area ?? null} initialLocale={opts.locale ?? 'en'}>
        {ui}
      </AppProviders>
    </AuthContextProvider>,
  );
  return { nav, location };
}

describe('C01 area selection', () => {
  it('denied location permission leaves manual selection usable', async () => {
    const { nav, location } = setup({ api: { areas: vi.fn(async () => ({ items: [maadi, zamalek] })) } }, <AreaSelectScreen />);
    await screen.findByTestId('area-maadi');
    await act(async () => { fireEvent.click(screen.getByTestId('use-location')); });
    expect(location.requestApproximate).toHaveBeenCalled();
    expect(screen.getByTestId('location-denied').textContent).toMatch(/not granted/);
    fireEvent.click(screen.getByTestId('area-maadi'));
    expect(nav.replace).toHaveBeenCalledWith('/home');
  });

  it('a granted location only hints; it never silently picks an area', async () => {
    const loc: LocationPort = { requestApproximate: async () => ({ status: 'granted', latitude: 30, longitude: 31 }) };
    const { nav } = setup({ api: { areas: async () => ({ items: [maadi] }) }, location: loc }, <AreaSelectScreen />);
    await screen.findByTestId('area-maadi');
    await act(async () => { fireEvent.click(screen.getByTestId('use-location')); });
    expect(screen.getByTestId('location-detected')).toBeTruthy();
    expect(nav.replace).not.toHaveBeenCalled();
  });

  it('coming-soon areas are labelled; network failure shows a retryable error', async () => {
    let fail = true;
    setup({ api: { areas: vi.fn(async () => { if (fail) throw new NetworkError(); return { items: [zamalek] }; }) } }, <AreaSelectScreen />);
    expect((await screen.findByTestId('error-state')).textContent).toMatch(/couldn’t reach/);
    fail = false;
    fireEvent.click(screen.getByText('Try again'));
    expect((await screen.findByTestId('area-zamalek')).textContent).toMatch(/Coming soon/);
  });

  it('cards render as native, focusable <button> elements (browser provides Enter/Space activation)', async () => {
    setup({ api: { areas: async () => ({ items: [maadi] }) } }, <AreaSelectScreen />);
    const card = await screen.findByTestId('area-maadi');
    expect(card.tagName).toBe('BUTTON');
    expect(card.getAttribute('tabindex')).toBe('0');
    card.focus();
    expect(document.activeElement).toBe(card);
  });
});

describe('C02 entry points', () => {
  it('shows five entry cards; Learn needs no area; physical modes ask for an area first', () => {
    const { nav } = setup({ api: {} }, <HomeScreen />);
    for (const e of ['EAT_NOW', 'HEAT_AT_HOME', 'COOK_AT_HOME', 'GROCERIES', 'LEARN']) expect(screen.getByTestId(`entry-${e}`)).toBeTruthy();
    fireEvent.click(screen.getByTestId('entry-LEARN'));
    expect(nav.push).toHaveBeenLastCalledWith('/learn');
    fireEvent.click(screen.getByTestId('entry-EAT_NOW'));
    expect(nav.push).toHaveBeenLastCalledWith('/location');
  });

  it('routes groceries and meals separately and warns for unsupported areas', () => {
    const { nav } = setup({ api: {}, area: zamalek }, <HomeScreen />);
    expect(screen.getByTestId('unsupported-area')).toBeTruthy();
    fireEvent.click(screen.getByTestId('entry-GROCERIES'));
    expect(nav.push).toHaveBeenLastCalledWith('/groceries');
    fireEvent.click(screen.getByTestId('entry-HEAT_AT_HOME'));
    expect(nav.push).toHaveBeenLastCalledWith('/explore/HEAT_AT_HOME');
  });

  it('renders Arabic copy right-to-left', () => {
    setup({ api: {}, area: maadi, locale: 'ar' }, <HomeScreen />);
    expect(document.documentElement.dir).toBe('rtl');
    expect(screen.getByTestId('entry-GROCERIES').textContent).toContain('البقالة');
  });
});

const card = (n: number, title: string) => ({
  offerId: id(100 + n), dishId: id(200 + n), title: { en: title, ar: title }, serviceMode: 'EAT_NOW' as const,
  chef: { id: id(300), publicName: 'Sample Kitchen A (sample)', area: { en: 'Maadi', ar: 'المعادي' } },
  laborPerPersonPiastres: 1000, leadTimeMinutes: 90, minServings: 1, cuisines: [], illustrative: true,
});
const facet = (slug: string, count: number) => ({ facetId: id(400 + count + slug.length), slug, label: { en: slug, ar: slug }, count });

describe('C03/C04 results', () => {
  it('filters by cuisine independently, shows counts and resets', async () => {
    const searchOffers = vi.fn(async (q: { cuisine?: string[] }): Promise<OfferSearchResponse> => ({
      serviceability: 'SERVICEABLE',
      items: q.cuisine?.includes('italian') ? [] : [card(1, 'Koshari')],
      facetCounts: { cuisine: [facet('egyptian', 2), facet('italian', 1)], dishType: [facet('pasta', 1)] },
      nextCursor: null,
    }));
    setup({ api: { searchOffers } as Partial<ApiClient>, area: maadi }, <ResultsScreen mode="EAT_NOW" />);
    expect((await screen.findByTestId(`offer-${id(101)}`)).textContent).toContain('Koshari');
    expect(screen.getByTestId('cuisine-egyptian').textContent).toBe('egyptian (2)');
    await act(async () => { fireEvent.click(screen.getByTestId('cuisine-italian')); });
    await waitFor(() => expect(searchOffers).toHaveBeenLastCalledWith(expect.objectContaining({ cuisine: ['italian'], dishType: [] })));
    expect((await screen.findByTestId('empty-state')).textContent).toMatch(/No dishes match/);
    expect(screen.getByTestId('selected-count').textContent).toBe('1 selected');
    await act(async () => { fireEvent.click(screen.getByTestId('reset-filters')); });
    await waitFor(() => expect(searchOffers).toHaveBeenLastCalledWith(expect.objectContaining({ cuisine: [] })));
    expect(await screen.findByTestId(`offer-${id(101)}`)).toBeTruthy();
  });

  it('shows an explicit unsupported-area state instead of results', async () => {
    setup({ api: { searchOffers: async () => ({ serviceability: 'UNSUPPORTED_AREA', items: [], facetCounts: { cuisine: [], dishType: [] }, nextCursor: null }) } as Partial<ApiClient>, area: zamalek },
      <ResultsScreen mode="EAT_NOW" />);
    expect(await screen.findByTestId('results-unsupported')).toBeTruthy();
  });

  it('loads more with the cursor and appends', async () => {
    const searchOffers = vi.fn(async (q: { cursor?: string }): Promise<OfferSearchResponse> => ({
      serviceability: 'SERVICEABLE', items: q.cursor ? [card(2, 'Pasta')] : [card(1, 'Koshari')],
      facetCounts: { cuisine: [], dishType: [] }, nextCursor: q.cursor ? null : 'c1',
    }));
    setup({ api: { searchOffers } as Partial<ApiClient>, area: maadi }, <ResultsScreen mode="EAT_NOW" />);
    await screen.findByTestId(`offer-${id(101)}`);
    await act(async () => { fireEvent.click(screen.getByTestId('load-more')); });
    expect(await screen.findByTestId(`offer-${id(102)}`)).toBeTruthy();
    expect(screen.getByTestId(`offer-${id(101)}`)).toBeTruthy();
    expect(screen.queryByTestId('load-more')).toBeNull();
  });
});

describe('C05-C07 offer detail', () => {
  const detail: OfferDetail = {
    offerId: id(101), dishId: id(201), title: { en: 'Molokhia with chicken', ar: 'ملوخية بالفراخ' }, description: { en: '', ar: '' },
    serviceMode: 'EAT_NOW', chef: { id: id(300), publicName: 'Sample Kitchen A (sample)', area: { en: 'Maadi', ar: 'المعادي' }, acceptingOrders: true },
    laborPerPersonPiastres: 1000, packagingPiastres: 300, chefIngredientsOffered: true, chefIngredientsPerServingPiastres: 6000, supplierSourcingAllowed: true, leadTimeMinutes: 120,
    servingRules: { minServings: 2, maxServings: 8, servingStep: 1 }, portion: { grams: 450, basis: 'COOKED_NET' },
    safetyInstructions: { en: 'Eat within the stated time.', ar: 'يؤكل خلال المدة.' }, recipeVersion: 1,
    ingredients: [
      { ingredientId: id(500), name: { en: 'Chicken', ar: 'دجاج' }, quantityPerServing: 150, unit: 'g', weightBasis: 'RAW_EDIBLE', isPantry: false, allowedOmission: false, allergens: [], allergenDataStatus: 'DECLARED' },
      { ingredientId: id(501), name: { en: 'Spice mix', ar: 'بهارات' }, quantityPerServing: 2, unit: 'g', weightBasis: 'AS_PURCHASED', isPantry: true, allowedOmission: false, allergens: [], allergenDataStatus: 'UNKNOWN' },
    ],
    siblingVariants: [{ offerId: id(102), serviceMode: 'HEAT_AT_HOME' }], cuisines: [], illustrative: true,
    availability: 'AVAILABLE', slots: [{ slotId: id(600), startsAt: '2026-10-24T09:00:00.000Z', endsAt: '2026-10-24T12:00:00.000Z', maxServings: 3 }],
  };

  it('shows the next kitchen times, warns when none fits the group, and explains a fully booked kitchen', async () => {
    setup({ api: { offer: async () => detail } as Partial<ApiClient> }, <OfferDetailScreen offerId={id(101)} />);
    expect((await screen.findByTestId('offer-slot')).textContent).toMatch(/Sat 24 Oct 12:00–15:00 · up to 3 people/);
    expect(screen.queryByTestId('offer-slot-too-small')).toBeNull();
    fireEvent.click(screen.getByTestId('servings-increase'));
    fireEvent.click(screen.getByTestId('servings-increase'));
    expect(screen.getByTestId('offer-slot-too-small').textContent).toMatch(/4 people/);
    cleanup();
    setup({ api: { offer: async () => ({ ...detail, availability: 'FULLY_BOOKED' as const, slots: [] }) } as Partial<ApiClient> }, <OfferDetailScreen offerId={id(101)} />);
    expect((await screen.findByTestId('offer-fully-booked')).textContent).toMatch(/fully booked/);
  });

  it('founder example: 4 servings at 10 EGP per person shows 40 EGP; quantities scale; raw and cooked labelled', async () => {
    setup({ api: { offer: async () => detail } as Partial<ApiClient> }, <OfferDetailScreen offerId={id(101)} />);
    const labour = await screen.findByTestId('labour-line');
    expect(labour.textContent).toMatch(/10.*per person.*20/);
    fireEvent.click(screen.getByTestId('servings-increase'));
    fireEvent.click(screen.getByTestId('servings-increase'));
    expect(screen.getByTestId('servings-value').textContent).toBe('For 4 people');
    expect(screen.getByTestId('labour-line').textContent).toMatch(/40/);
    expect(screen.getAllByTestId('ingredient-line')[0]!.textContent).toMatch(/150 g per person.*600 g total for 4.*Raw edible weight/);
    expect(screen.getByTestId('offer-detail').textContent).toMatch(/Cooked net weight/);
  });

  it('unknown allergen data is flagged; ordering picks who buys ingredients and a kitchen time', async () => {
    const { nav } = setup({ api: { offer: async () => detail } as Partial<ApiClient> }, <OfferDetailScreen offerId={id(101)} />);
    expect((await screen.findByTestId('allergen-unknown')).textContent).toMatch(/do not assume/);
    expect(screen.getByTestId('source-CHEF').textContent).toMatch(/EGP 60 per person/);
    fireEvent.click(screen.getByTestId('source-SUPPLIERS'));
    fireEvent.click(screen.getByTestId('compare-cta'));
    expect(nav.push).toHaveBeenCalledWith(`/checkout?offerId=${id(101)}&servings=2&source=SUPPLIERS&slotId=${id(600)}`);
  });

  it('switches to a sibling variant', async () => {
    const { nav } = setup({ api: { offer: async () => detail } as Partial<ApiClient> }, <OfferDetailScreen offerId={id(101)} />);
    fireEvent.click(await screen.findByTestId('variant-HEAT_AT_HOME'));
    expect(nav.replace).toHaveBeenCalledWith(`/offers/${id(102)}`);
  });
});

describe('area and language memory across reloads', () => {
  function Probe() {
    const { area, hydrated } = useApp();
    return <span data-testid="probe">{hydrated ? area?.slug ?? 'none' : 'loading'}</span>;
  }
  const mount = (store: ReturnType<typeof memoryStore>, areas: Area[]) =>
    render(
      <AuthContextProvider value={signedOutAuth}>
        <AppProviders api={{ areas: async () => ({ items: areas }) } as unknown as ApiClient} nav={{ push: vi.fn(), replace: vi.fn(), back: vi.fn() }}
          location={{ requestApproximate: async () => ({ status: 'denied' as const }) }} store={store}>
          <Probe />
        </AppProviders>
      </AuthContextProvider>,
    );

  it('restores the remembered area and language after a reload', async () => {
    const store = memoryStore({ [KEYS.area]: JSON.stringify(maadi), [KEYS.locale]: 'ar' });
    mount(store, [maadi]);
    await waitFor(() => expect(screen.getByTestId('probe').textContent).toBe('maadi'));
    expect(document.documentElement.dir).toBe('rtl');
  });

  it('forgets a remembered area that the server no longer offers', async () => {
    const store = memoryStore({ [KEYS.area]: JSON.stringify(maadi) });
    mount(store, [zamalek]);
    await waitFor(() => expect(screen.getByTestId('probe').textContent).toBe('none'));
    expect(store.dump()[KEYS.area]).toBeUndefined();
  });

  it('saves the chosen area when the person picks one', async () => {
    const store = memoryStore();
    const nav: Nav = { push: vi.fn(), replace: vi.fn(), back: vi.fn() };
    render(
      <AuthContextProvider value={signedOutAuth}>
        <AppProviders api={{ areas: async () => ({ items: [maadi] }) } as unknown as ApiClient} nav={nav}
          location={{ requestApproximate: async () => ({ status: 'denied' as const }) }} store={store}>
          <AreaSelectScreen />
        </AppProviders>
      </AuthContextProvider>,
    );
    fireEvent.click(await screen.findByTestId('area-maadi'));
    await waitFor(() => expect(JSON.parse(store.dump()[KEYS.area]!).slug).toBe('maadi'));
  });
});

describe('C08-C10 checkout and sandbox payment', () => {
  const signedIn: AuthPort = { provider: 'clerk', status: 'signedIn', label: 'me@example.com', getToken: async () => 'tok', startCode: async () => ({ error: null }), verifyCode: async () => ({ error: null }), signOut: async () => undefined };
  const quote = {
    id: id(700), offerId: id(101), addressId: id(701), dishTitle: { en: 'Molokhia with chicken', ar: 'ملوخية' }, chef: { id: id(300), publicName: 'Sample Kitchen A' },
    source: 'SUPPLIERS' as const, servings: 4, slot: { slotId: id(600), startsAt: '2026-10-24T09:00:00.000Z', endsAt: '2026-10-24T12:00:00.000Z' }, deliveryArea: { en: 'Maadi', ar: 'المعادي' },
    lines: [
      { component: 'LABOR' as const, recipientType: 'CHEF' as const, recipientName: 'Sample Kitchen A', amountPiastres: 4000 },
      { component: 'INGREDIENTS' as const, recipientType: 'SUPPLIER' as const, recipientName: 'Corner Market', amountPiastres: 16500 },
      { component: 'FINAL_TRIP' as const, recipientType: 'DELIVERY_LEG' as const, recipientName: 'Meal delivery', amountPiastres: 2500 },
    ],
    basket: [{ ingredientId: id(500), name: { en: 'Chicken', ar: 'دجاج' }, requiredQuantity: 600, unit: 'g', chosen: null as any, options: [
      { productId: id(801), branchId: id(901), branchName: 'Corner Market', branchArea: { en: 'Nasr City', ar: 'مدينة نصر' }, packQuantity: 1000, packUnit: 'g', packPricePiastres: 16500, packs: 1, amountPiastres: 16500, leftoverQuantity: 400, variableWeight: true, availablePacks: 10 },
      { productId: id(802), branchId: id(902), branchName: 'Grocer', branchArea: { en: 'Maadi', ar: 'المعادي' }, packQuantity: 500, packUnit: 'g', packPricePiastres: 9000, packs: 2, amountPiastres: 18000, leftoverQuantity: 400, variableWeight: true, availablePacks: 20 },
    ] }],
    pantryNote: [{ en: 'Salt', ar: 'ملح' }], totalPiastres: 23000, expiresAt: '2026-10-23T12:10:00.000Z', illustrative: true, sandbox: true as const,
  };
  quote.basket[0]!.chosen = quote.basket[0]!.options[0];

  it('asks guests to sign in before pricing', () => {
    setup({ api: {}, area: maadi }, <CheckoutScreen offerId={id(101)} servings={4} source="SUPPLIERS" slotId={id(600)} />);
    expect(screen.getByText(/Sign in to order/)).toBeTruthy();
  });

  it('prices on the server, shows who is paid, switches shops per ingredient, and places the order', async () => {
    const quoteFn = vi.fn(async () => quote);
    const createOrder = vi.fn(async () => ({ id: id(710) }) as never);
    const { nav } = setup({ api: { quote: quoteFn, createOrder } as Partial<ApiClient>, area: maadi, auth: signedIn }, <CheckoutScreen offerId={id(101)} servings={4} source="SUPPLIERS" slotId={id(600)} />);
    expect(screen.getByTestId('sandbox-banner').textContent).toMatch(/No real money/);
    await act(async () => { fireEvent.click(screen.getByTestId('get-price')); });
    expect(screen.getByText(/complete/)).toBeTruthy(); // required field message
    fireEvent.change(screen.getByTestId('address-text'), { target: { value: '12 Road 9, Maadi' } });
    await act(async () => { fireEvent.click(screen.getByTestId('get-price')); });
    expect(quoteFn).toHaveBeenCalledWith(expect.objectContaining({ servings: 4, source: 'SUPPLIERS', address: { addressText: '12 Road 9, Maadi', areaId: maadi.id } }));
    expect(screen.getByTestId('price-lines').textContent).toMatch(/Paid to Corner Market/);
    expect(screen.getByTestId('quote-total').textContent).toMatch(/EGP 230/);
    await act(async () => { fireEvent.click(screen.getByTestId(`option-${id(802)}`)); });
    expect(quoteFn).toHaveBeenLastCalledWith(expect.objectContaining({ addressId: id(701), supplierChoices: [{ ingredientId: id(500), productId: id(802) }] }));
    await act(async () => { fireEvent.click(screen.getByTestId('place-order')); });
    expect(createOrder).toHaveBeenCalledWith(id(700), expect.any(String));
    expect(nav.replace).toHaveBeenCalledWith(`/orders/${id(710)}`);
  });

  it('explains basket problems in plain words', async () => {
    const quoteFn = vi.fn(async () => { throw new ApiError(409, 'BASKET_INCOMPLETE', 'x', 'c', { missing: ['Garlic'] }); });
    setup({ api: { quote: quoteFn } as Partial<ApiClient>, area: maadi, auth: signedIn }, <CheckoutScreen offerId={id(101)} servings={4} source="SUPPLIERS" slotId={id(600)} />);
    fireEvent.change(screen.getByTestId('address-text'), { target: { value: '12 Road 9, Maadi' } });
    await act(async () => { fireEvent.click(screen.getByTestId('get-price')); });
    expect(screen.getByTestId('checkout-error').textContent).toMatch(/Garlic/);
  });

  it('order page: pays through the sandbox page and shows funding separately from cooking', async () => {
    const base = {
      id: id(710), reference: 'LH-ABCD1234', dishTitle: quote.dishTitle, chef: quote.chef, source: 'CHEF' as const, servings: 4, slot: quote.slot,
      fulfillmentState: 'RESERVED' as const, fundingState: 'UNFUNDED' as const, chefAcceptance: 'PENDING' as const, suppliers: [], totalPiastres: 30800, lines: quote.lines,
      allocations: [{ allocationId: id(720), recipientType: 'CHEF' as const, recipientName: 'Sample Kitchen A', components: ['LABOR' as const], amountPiastres: 28300, state: 'UNPAID' as const, refundedPiastres: 0 },
        { allocationId: id(721), recipientType: 'DELIVERY_LEG' as const, recipientName: 'Meal delivery', components: ['FINAL_TRIP' as const], amountPiastres: 2500, state: 'UNPAID' as const, refundedPiastres: 0 }],
      payBy: '2026-10-23T12:30:00.000Z', dropoffCode: '123456', legs: [], cancelReason: null, events: [], version: 1, createdAt: '2026-10-23T12:00:00.000Z', sandbox: true as const,
    };
    let current: any = base;
    const order = vi.fn(async () => current);
    const startPayment = vi.fn(async () => ({ sessionId: `sim_${id(710)}`, orderId: id(710), attempts: [{ attemptId: id(730), recipientName: 'x', amountPiastres: 30800, state: 'PENDING' as const }], totalPiastres: 30800, provider: 'simulator' as const, sandbox: true as const }));
    const simulatePayment = vi.fn(async () => { current = { ...base, fundingState: 'FUNDED', allocations: base.allocations.map((a) => ({ ...a, state: 'PAID' })) }; return {} as never; });
    setup({ api: { order, startPayment, simulatePayment } as Partial<ApiClient>, area: maadi, auth: signedIn }, <OrderScreen orderId={id(710)} />);
    expect((await screen.findByTestId('order-status')).textContent).toMatch(/Waiting for payment/);
    expect(screen.queryByTestId('dropoff-code')).toBeNull(); // only once a courier has the meal
    await act(async () => { fireEvent.click(screen.getByTestId('pay-start')); });
    expect(screen.getByTestId('sandbox-pay').textContent).toMatch(/EGP 308/);
    await act(async () => { fireEvent.click(screen.getByTestId('pay-succeed')); });
    expect(simulatePayment).toHaveBeenCalledWith(`sim_${id(710)}`, { outcome: 'SUCCEED' }, expect.any(String));
    await waitFor(() => expect(screen.getByTestId('order-status').textContent).toMatch(/Paid — waiting for the cook/));
    expect(screen.getByTestId('allocations').textContent).toMatch(/Paid/);
    expect(screen.queryByTestId('pay-card')).toBeNull();
  });
});
