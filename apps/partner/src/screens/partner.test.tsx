import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, type ApiClient, type Me } from '@lahloba/contracts';
import { AuthContextProvider, memoryStore, type AuthPort } from '@lahloba/app-shell';
import type { PickFile } from '../filePicker';
import { PartnerProviders, type Nav } from '../PartnerContext';
import { ApplyScreen } from './ApplyScreen';
import { RolesScreen } from './RolesScreen';
import { SignInScreen } from './SignInScreen';
import { SupplierScreen } from './WorkspaceScreens';
import { ChefOrdersPanel, CourierJobsScreen, SupplierOrdersPanel } from './WorkScreens';

afterEach(cleanup);

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const maadi = { id: id(1), slug: 'maadi', label: { en: 'Maadi', ar: 'المعادي' }, status: 'ACTIVE' as const, physicalOrderingEnabled: true };

const fakeAuth = (status: AuthPort['status'], provider: AuthPort['provider'] = 'clerk'): AuthPort => ({
  provider, status, label: status === 'signedIn' ? 'me@example.com' : null, getToken: async () => (status === 'signedIn' ? 'tok' : null),
  startCode: async () => ({ error: null }), verifyCode: async () => ({ error: null }), signOut: async () => undefined,
});

function setup(api: Partial<ApiClient>, ui: React.ReactNode, opts: { signedIn?: boolean; provider?: AuthPort['provider']; pickFile?: PickFile } = {}) {
  const nav: Nav = { push: vi.fn(), replace: vi.fn(), back: vi.fn() };
  render(
    <AuthContextProvider value={fakeAuth(opts.signedIn === false ? 'signedOut' : 'signedIn', opts.provider)}>
      <PartnerProviders apiUrl="http://x" nav={nav} store={memoryStore()} apiFactory={() => api as ApiClient} pickFile={opts.pickFile}>{ui}</PartnerProviders>
    </AuthContextProvider>,
  );
  return nav;
}

const me = (memberships: Me['memberships']): Me => ({ userId: id(9), displayName: 'x', locale: 'en', memberships });

describe('sign-in', () => {
  it('uses the shared one-time-code sign-in; explains when no provider is configured', () => {
    setup({}, <SignInScreen />, { signedIn: false, provider: 'none' });
    expect(screen.getByTestId('auth-not-configured')).toBeTruthy();
    cleanup();
    setup({}, <SignInScreen />, { signedIn: false });
    expect(screen.getByTestId('auth-send')).toBeTruthy();
  });
});

describe('role switching (multi-role accounts)', () => {
  it('lists each partner membership separately with its own state and switches explicitly', async () => {
    const api: Partial<ApiClient> = {
      me: async () => me([
        { id: id(10), role: 'CUSTOMER', scopeType: 'GLOBAL', scopeId: null, approvalState: 'APPROVED' },
        { id: id(11), role: 'CHEF_OWNER', scopeType: 'CHEF', scopeId: id(20), approvalState: 'APPROVED' },
        { id: id(12), role: 'COURIER', scopeType: 'COURIER', scopeId: id(21), approvalState: 'PENDING' },
      ]),
      myApplications: async () => ({ items: [] }),
    };
    const nav = setup(api, <RolesScreen />);
    expect(await screen.findByTestId('role-CHEF')).toBeTruthy();
    expect(screen.getByTestId('role-COURIER').textContent).toMatch(/Pending review/);
    expect(screen.queryByTestId('role-SUPPLIER')).toBeNull();
    expect(screen.getByTestId('apply-SUPPLIER')).toBeTruthy();
    expect(screen.queryByTestId('apply-CHEF')).toBeNull();
    fireEvent.click(screen.getByTestId('switch-CHEF'));
    expect(nav.push).toHaveBeenCalledWith(`/chef/${id(20)}`);
    expect(screen.getByTestId('active-role').textContent).toBe('Active role: Chef');
  });
});

describe('partner application form', () => {
  it('validates required fields, keeps the kitchen address in a private field, and reuses one idempotency key', async () => {
    const applyAsPartner = vi.fn(async () => { throw Object.assign(new Error('offline'), {}); });
    setup({ me: async () => me([]), areas: async () => ({ items: [maadi] }), applyAsPartner } as Partial<ApiClient>, <ApplyScreen kind="CHEF" />);
    await screen.findByTestId('apply-CHEF');
    fireEvent.click(screen.getByTestId('submit-application'));
    expect(screen.getByTestId('name-error').textContent).toMatch(/complete/);
    expect(applyAsPartner).not.toHaveBeenCalled();
    expect(screen.getByTestId('apply-CHEF').textContent).toMatch(/private and never shown/);

    fireEvent.change(screen.getByTestId('name'), { target: { value: 'My Kitchen' } });
    fireEvent.click(await screen.findByTestId('area-maadi'));
    fireEvent.change(screen.getByTestId('address'), { target: { value: '12 Example Street' } });
    await act(async () => { fireEvent.click(screen.getByTestId('submit-application')); });
    await act(async () => { fireEvent.click(screen.getByTestId('submit-application')); });
    expect(applyAsPartner).toHaveBeenCalledTimes(2);
    const calls = applyAsPartner.mock.calls as unknown as Array<[unknown, string]>;
    expect(calls[0]![1]).toBe(calls[1]![1]);
    expect(calls[0]![0]).toMatchObject({ kind: 'CHEF', chef: { publicName: 'My Kitchen', serviceAreaIds: [maadi.id], kitchenAddress: { addressText: '12 Example Street', areaId: maadi.id } } });
  });

  const submittedCourier = async (api: Partial<ApiClient>, pickFile: PickFile) => {
    setup({
      me: async () => me([]), areas: async () => ({ items: [] }),
      applyAsPartner: async () => ({ id: id(40), kind: 'COURIER', subjectId: id(41), status: 'SUBMITTED', submittedAt: '', decidedAt: null, decisionReason: null, permittedNextStep: null, version: 1, evidenceCount: 0 }),
      ...api,
    } as Partial<ApiClient>, <ApplyScreen kind="COURIER" />, { pickFile });
    await screen.findByTestId('apply-COURIER');
    fireEvent.change(screen.getByTestId('name'), { target: { value: 'Rider' } });
    fireEvent.click(screen.getByTestId('equipment-BICYCLE'));
    await act(async () => { fireEvent.click(screen.getByTestId('submit-application')); });
    expect(await screen.findByTestId('application-submitted')).toBeTruthy();
  };
  const pdf = { bytes: Uint8Array.from([0x25, 0x50, 0x44, 0x46, 0x2d]), contentType: 'application/pdf' as const, name: 'licence.pdf' };

  it('after submission uploads each document privately and shows its state', async () => {
    const registerEvidence = vi.fn(async () => ({ evidenceId: id(30), upload: { status: 'PENDING_UPLOAD' as const, uploadPath: `/v1/partner-evidence/${id(30)}/content` } }));
    const uploadEvidenceFile = vi.fn(async () => ({ evidenceId: id(30), fileState: 'UPLOADED' as const, byteSize: 5, scanState: 'NOT_SCANNED' as const }));
    const pick = vi.fn(async () => pdf);
    await submittedCourier({ registerEvidence, uploadEvidenceFile }, pick);
    expect(screen.getByTestId('doc-DRIVING_LICENSE-status').textContent).toMatch(/Not added/);
    await act(async () => { fireEvent.click(screen.getByTestId('doc-DRIVING_LICENSE-file')); });
    expect(pick).toHaveBeenCalledWith('document');
    expect(registerEvidence).toHaveBeenCalledWith(id(40), { evidenceType: 'DRIVING_LICENSE', contentType: 'application/pdf', byteSize: 5 }, expect.any(String));
    expect(uploadEvidenceFile).toHaveBeenCalledWith(`/v1/partner-evidence/${id(30)}/content`, pdf.bytes, 'application/pdf');
    expect(screen.getByTestId('doc-DRIVING_LICENSE-status').textContent).toMatch(/Uploaded/);
    expect(screen.queryByTestId('evidence-storage-off')).toBeNull();
  });

  it('explains picker and server rejections, and says plainly when file storage is off', async () => {
    const registerEvidence = vi.fn(async () => ({ evidenceId: id(31), upload: { status: 'DEV_METADATA_ONLY' as const, uploadPath: null } }));
    const uploadEvidenceFile = vi.fn();
    let next: () => Promise<typeof pdf | null> = async () => { throw Object.assign(new Error(), { code: 'FILE_TOO_LARGE' }); };
    await submittedCourier({ registerEvidence, uploadEvidenceFile } as Partial<ApiClient>, () => next());
    await act(async () => { fireEvent.click(screen.getByTestId('doc-NATIONAL_ID-camera')); });
    expect(screen.getByTestId('doc-NATIONAL_ID-error').textContent).toMatch(/larger than 4 MB/);
    expect(registerEvidence).not.toHaveBeenCalled();
    next = async () => null; // cancelled: nothing happens
    await act(async () => { fireEvent.click(screen.getByTestId('doc-VEHICLE_LICENSE-photo')); });
    expect(registerEvidence).not.toHaveBeenCalled();
    next = async () => pdf;
    await act(async () => { fireEvent.click(screen.getByTestId('doc-NATIONAL_ID-file')); });
    expect(uploadEvidenceFile).not.toHaveBeenCalled();
    expect(screen.getByTestId('evidence-storage-off').textContent).toMatch(/not kept/);
    expect(screen.queryByTestId('doc-NATIONAL_ID-error')).toBeNull();
  });
});

describe('supplier product form', () => {
  it('rejects malformed prices and sends integer piastres', async () => {
    const createProduct = vi.fn(async () => ({}) as never);
    setup({
      me: async () => me([]),
      myBranches: async () => ({ items: [{ id: id(50), publicName: 'Branch', status: 'APPROVED' as const, isOpen: true, organizationId: id(51) }] }),
      branchProducts: async () => ({ items: [] }),
      branchSuborders: async () => ({ items: [] }),
      ingredients: async () => ({ items: [{ id: id(60), slug: 'rice', name: { en: 'Rice', ar: 'أرز' }, unit: 'g' as const, allergens: [], allergenDataStatus: 'DECLARED' as const }] }),
      facets: async () => ({ items: [{ id: id(70), type: 'SUPPLIER_CATEGORY' as const, slug: 'pantry', label: { en: 'Pantry', ar: 'تموين' } }] }),
      createProduct,
    } as Partial<ApiClient>, <SupplierScreen />);
    fireEvent.click(await screen.findByTestId('tab-products'));
    fireEvent.click(await screen.findByText('Rice'));
    fireEvent.click(screen.getByText('Pantry'));
    fireEvent.change(screen.getByTestId('sku'), { target: { value: 'RICE-1KG' } });
    fireEvent.change(screen.getByTestId('pack'), { target: { value: '1000' } });
    fireEvent.change(screen.getByTestId('stock'), { target: { value: '5' } });
    fireEvent.change(screen.getByTestId('price'), { target: { value: '60.999' } });
    await act(async () => { fireEvent.click(screen.getByTestId('publish-product')); });
    expect(screen.getByTestId('price-error')).toBeTruthy();
    expect(createProduct).not.toHaveBeenCalled();
    fireEvent.change(screen.getByTestId('price'), { target: { value: '60.50' } });
    await act(async () => { fireEvent.click(screen.getByTestId('publish-product')); });
    await waitFor(() => expect(createProduct).toHaveBeenCalled());
    expect((createProduct.mock.calls as unknown as Array<[string, Record<string, unknown>]>)[0]![1]).toMatchObject({ pricePiastres: 6050, packQuantity: 1000, packUnit: 'g' });
  });
});

describe('partner work: chef, shop and courier', () => {
  const area = { en: 'Maadi', ar: 'المعادي' };
  const chefOrder = {
    id: id(80), reference: 'LH-0000ABCD', dishTitle: { en: 'Molokhia', ar: 'ملوخية' }, serviceMode: 'EAT_NOW' as const, servings: 4, source: 'SUPPLIERS' as const,
    slot: { startsAt: '2026-10-24T09:00:00.000Z', endsAt: '2026-10-24T12:00:00.000Z' }, fulfillmentState: 'RESERVED' as const, fundingState: 'FUNDED' as const,
    chefAcceptance: 'PENDING' as const, respondBy: '2026-10-23T13:00:00.000Z', ingredientsAccepted: false,
    ingredients: [{ ingredientId: id(81), name: { en: 'Chicken', ar: 'دجاج' }, quantity: 600, unit: 'g', weightBasis: 'RAW_EDIBLE', isPantry: false },
      { ingredientId: id(82), name: { en: 'Salt', ar: 'ملح' }, quantity: 8, unit: 'g', weightBasis: 'AS_PURCHASED', isPantry: true }],
    chefEarningsPiastres: 4300, ingredientDropoffCode: null, mealPickupCode: null, legs: [], version: 3,
  };

  it('chef: accepts a paid order; declining needs a reason and says the customer is refunded', async () => {
    const chefRespond = vi.fn(async () => chefOrder as never);
    setup({ me: async () => me([]), chefOrders: async () => ({ items: [chefOrder] }), chefRespond } as Partial<ApiClient>, <ChefOrdersPanel chefId={id(90)} />);
    expect((await screen.findByTestId(`chef-order-state-${id(80)}`)).textContent).toMatch(/Waiting for your answer/);
    expect(screen.getByTestId(`chef-order-${id(80)}`).textContent).toMatch(/You receive EGP 43/);
    fireEvent.click(screen.getByTestId(`decline-${id(80)}`));
    expect(screen.getByText(/refunded in full/)).toBeTruthy();
    await act(async () => { fireEvent.click(screen.getByTestId(`decline-confirm-${id(80)}`)); });
    expect(chefRespond).not.toHaveBeenCalled(); // no reason chosen yet
    fireEvent.click(screen.getByText('Kitchen is full'));
    await act(async () => { fireEvent.click(screen.getByTestId(`decline-confirm-${id(80)}`)); });
    expect(chefRespond).toHaveBeenCalledWith(id(90), id(80), { accept: false, reason: 'Kitchen is full', expectedVersion: 3 }, expect.any(String));
  });

  it('chef: checks delivered ingredients item by item (delivery is not acceptance)', async () => {
    const delivered = { ...chefOrder, fulfillmentState: 'AWAITING_INGREDIENTS' as const, chefAcceptance: 'ACCEPTED' as const,
      legs: [{ legId: id(83), kind: 'INGREDIENT_TO_CHEF' as const, state: 'DELIVERED' as const, feePiastres: 2000, courierName: 'Karim', from: null, to: null }] };
    const chefCheckIngredients = vi.fn(async () => delivered as never);
    setup({ me: async () => me([]), chefOrders: async () => ({ items: [delivered] }), chefCheckIngredients } as Partial<ApiClient>, <ChefOrdersPanel chefId={id(90)} />);
    await screen.findByTestId(`check-${id(80)}`);
    expect(screen.queryByTestId(`check-${id(82)}`)).toBeNull(); // pantry items are not delivered
    fireEvent.click(screen.getByTestId(`check-${id(81)}`)); // untick chicken
    expect(screen.queryByTestId(`accept-ingredients-${id(80)}`)).toBeNull();
    fireEvent.change(screen.getByTestId(`problem-note-${id(80)}`), { target: { value: 'Chicken smells off' } });
    await act(async () => { fireEvent.click(screen.getByTestId(`report-${id(80)}`)); });
    expect(chefCheckIngredients).toHaveBeenCalledWith(id(90), id(80), { accepted: false, note: 'Chicken smells off', lines: [{ ingredientId: id(81), ok: false }], expectedVersion: 3 }, expect.any(String));
  });

  it('shop: confirms a paid sub-order and then shows the pickup code', async () => {
    let state: any = { id: id(84), orderReference: 'LH-0000ABCD', state: 'PENDING', lines: [{ productId: id(85), sku: 'RICE-1KG', name: { en: 'Rice', ar: 'أرز' }, packs: 1, packQuantity: 1000, packUnit: 'g', amountPiastres: 6000 }],
      totalPiastres: 6000, respondBy: '2026-10-23T13:00:00.000Z', funded: true, pickupCode: null, courierName: null, version: 1 };
    const supplierRespond = vi.fn(async () => { state = { ...state, state: 'CONFIRMED', pickupCode: '482913', version: 2 }; return state; });
    setup({ me: async () => me([]), branchSuborders: async () => ({ items: [state] }), supplierRespond } as Partial<ApiClient>, <SupplierOrdersPanel branchId={id(50)} />);
    const confirm = await screen.findByTestId(`confirm-${id(84)}`);
    await act(async () => { fireEvent.click(confirm); });
    expect(supplierRespond).toHaveBeenCalledWith(id(50), id(84), { confirm: true, expectedVersion: 1 }, expect.any(String));
    expect((await screen.findByTestId(`shop-code-${id(84)}-value`)).textContent).toBe('482913');
  });

  it('courier: claims a job, addresses appear only after claiming, wrong codes are explained', async () => {
    const open = { legId: id(86), kind: 'MEAL_TO_CUSTOMER' as const, state: 'OPEN' as const, feePiastres: 2500, requiredEquipment: ['INSULATED_BAG'], fromArea: area, toArea: area,
      stops: [{ stopId: id(87), seq: 1, partyType: 'CHEF' as const, partyName: 'Kitchen A', area, addressText: null, state: 'PENDING' as const }],
      dropoff: { partyName: 'Customer', addressText: null, accessNotes: null }, from: null, to: null, version: 1, canClaim: true };
    let legs: any[] = [open];
    const claimLeg = vi.fn(async () => { legs = [{ ...open, state: 'ASSIGNED', version: 2, stops: [{ ...open.stops[0], addressText: '9 Kitchen St' }], dropoff: { partyName: 'Customer', addressText: '12 Road 9', accessNotes: 'Ring twice' } }]; return legs[0]; });
    const collectStop = vi.fn(async () => { throw new ApiError(422, 'WRONG_CODE', 'x', 'c', { attemptsLeft: 4 }); });
    setup({ me: async () => me([]), courierJobs: async () => ({ items: legs }), claimLeg, collectStop } as Partial<ApiClient>, <CourierJobsScreen />);
    expect((await screen.findByTestId(`leg-${id(86)}`)).textContent).toMatch(/Exact address shown after you take the job/);
    await act(async () => { fireEvent.click(screen.getByTestId(`claim-${id(86)}`)); });
    expect(await screen.findByText('9 Kitchen St')).toBeTruthy();
    expect(screen.getByText(/Ring twice/)).toBeTruthy();
    fireEvent.change(screen.getByTestId(`stop-code-${id(87)}`), { target: { value: '12a3456' } });
    await act(async () => { fireEvent.click(screen.getByTestId(`collect-${id(87)}`)); });
    expect(collectStop).toHaveBeenCalledWith(id(86), id(87), { code: '123456', expectedVersion: 2 });
    expect(screen.getByTestId(`leg-error-${id(86)}`).textContent).toMatch(/4 tries left/);
  });
});
