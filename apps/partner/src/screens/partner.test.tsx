import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ApiClient, Me } from '@lahloba/contracts';
import { AuthContextProvider, memoryStore, type AuthPort } from '@lahloba/app-shell';
import { PartnerProviders, type Nav } from '../PartnerContext';
import { ApplyScreen } from './ApplyScreen';
import { RolesScreen } from './RolesScreen';
import { SignInScreen } from './SignInScreen';
import { SupplierScreen } from './WorkspaceScreens';

afterEach(cleanup);

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const maadi = { id: id(1), slug: 'maadi', label: { en: 'Maadi', ar: 'المعادي' }, status: 'ACTIVE' as const, physicalOrderingEnabled: true };

const fakeAuth = (status: AuthPort['status'], provider: AuthPort['provider'] = 'clerk'): AuthPort => ({
  provider, status, label: status === 'signedIn' ? 'me@example.com' : null, getToken: async () => (status === 'signedIn' ? 'tok' : null),
  startCode: async () => ({ error: null }), verifyCode: async () => ({ error: null }), signOut: async () => undefined,
});

function setup(api: Partial<ApiClient>, ui: React.ReactNode, opts: { signedIn?: boolean; provider?: AuthPort['provider'] } = {}) {
  const nav: Nav = { push: vi.fn(), replace: vi.fn(), back: vi.fn() };
  render(
    <AuthContextProvider value={fakeAuth(opts.signedIn === false ? 'signedOut' : 'signedIn', opts.provider)}>
      <PartnerProviders apiUrl="http://x" nav={nav} store={memoryStore()} apiFactory={() => api as ApiClient}>{ui}</PartnerProviders>
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

  it('after submission explains that documents are only references (no upload yet)', async () => {
    const registerEvidence = vi.fn(async () => ({ evidenceId: id(30), upload: { status: 'DEV_METADATA_ONLY' as const } }));
    setup({
      me: async () => me([]), areas: async () => ({ items: [] }), registerEvidence,
      applyAsPartner: async () => ({ id: id(40), kind: 'COURIER', subjectId: id(41), status: 'SUBMITTED', submittedAt: '', decidedAt: null, decisionReason: null, permittedNextStep: null, version: 1, evidenceCount: 0 }),
    } as Partial<ApiClient>, <ApplyScreen kind="COURIER" />);
    await screen.findByTestId('apply-COURIER');
    fireEvent.change(screen.getByTestId('name'), { target: { value: 'Rider' } });
    fireEvent.click(screen.getByTestId('equipment-BICYCLE'));
    await act(async () => { fireEvent.click(screen.getByTestId('submit-application')); });
    expect(await screen.findByTestId('application-submitted')).toBeTruthy();
    expect(screen.getByTestId('apply-done').textContent).toMatch(/no file is uploaded/);
    await act(async () => { fireEvent.click(screen.getByTestId('add-evidence')); });
    expect(registerEvidence).toHaveBeenCalledWith(id(40), expect.objectContaining({ evidenceType: 'DRIVING_LICENSE' }));
    expect(screen.getByTestId('evidence-count').textContent).toMatch(/1/);
  });
});

describe('supplier product form', () => {
  it('rejects malformed prices and sends integer piastres', async () => {
    const createProduct = vi.fn(async () => ({}) as never);
    setup({
      me: async () => me([]),
      myBranches: async () => ({ items: [{ id: id(50), publicName: 'Branch', status: 'APPROVED' as const, isOpen: true, organizationId: id(51) }] }),
      branchProducts: async () => ({ items: [] }),
      ingredients: async () => ({ items: [{ id: id(60), slug: 'rice', name: { en: 'Rice', ar: 'أرز' }, unit: 'g' as const, allergens: [], allergenDataStatus: 'DECLARED' as const }] }),
      facets: async () => ({ items: [{ id: id(70), type: 'SUPPLIER_CATEGORY' as const, slug: 'pantry', label: { en: 'Pantry', ar: 'تموين' } }] }),
      createProduct,
    } as Partial<ApiClient>, <SupplierScreen />);
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
