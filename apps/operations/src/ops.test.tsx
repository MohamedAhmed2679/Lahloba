import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, type ApiClient, type OpsApplicationDetail } from '@lahloba/contracts';
import { OpsApp } from './OpsApp';

afterEach(cleanup);
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const app = { id: id(1), kind: 'CHEF' as const, subjectId: id(2), status: 'SUBMITTED' as const, submittedAt: new Date(0).toISOString(), decidedAt: null, decisionReason: null, permittedNextStep: null, version: 1, evidenceCount: 1 };
const detail: OpsApplicationDetail = {
  ...app, applicant: { userId: id(3), displayName: 'Applicant' }, subjectSummary: { publicName: 'Kitchen', area: { en: 'Maadi', ar: 'المعادي' }, equipment: [] },
  evidence: [{ evidenceId: id(4), evidenceType: 'NATIONAL_ID', contentType: 'image/jpeg', byteSize: 10, expiresOn: '2030-01-01', reviewState: 'PENDING_REVIEW', createdAt: new Date(0).toISOString(), fileState: 'UPLOADED', scanState: 'NOT_SCANNED' },
    { evidenceId: id(5), evidenceType: 'KITCHEN_PHOTO', contentType: 'image/png', byteSize: 0, expiresOn: null, reviewState: 'PENDING_REVIEW', createdAt: new Date(0).toISOString(), fileState: 'PENDING_UPLOAD', scanState: 'NOT_SCANNED' }],
};

async function signIn(api: Partial<ApiClient>, openUrl?: (u: string) => void) {
  render(<OpsApp apiUrl="http://x" devStubEnabled openUrl={openUrl} apiFactory={() => ({ devToken: async () => ({ token: 't', expiresInSeconds: 1, warning: '' }), ...api }) as ApiClient} />);
  fireEvent.change(screen.getByLabelText('Test identity name'), { target: { value: 'reviewer' } });
  await act(async () => { fireEvent.click(screen.getByText('Development sign-in (stub)')); });
}

describe('operations console', () => {
  it('shows a not-authorized message when the API refuses the role', async () => {
    await signIn({ opsApplications: async () => { throw new ApiError(403, 'FORBIDDEN', 'Operations verifier role required', 'c'); } });
    expect((await screen.findByRole('alert')).textContent).toMatch(/not authorized/);
  });

  it('requires a reason and a next step for rejection; shows self-review refusal from the API', async () => {
    const opsDecide = vi.fn(async () => { throw new ApiError(403, 'FORBIDDEN', 'You cannot review your own application', 'c'); });
    await signIn({ opsApplications: async () => ({ items: [app] }), opsApplication: async () => detail, opsDecide });
    await act(async () => { fireEvent.click(await screen.findByTestId(`queue-${app.id}`)); });
    expect((await screen.findByTestId('detail')).textContent).toMatch(/National ID/);
    expect(screen.getByTestId('detail').textContent).not.toMatch(/dev-only|objectKey/);
    fireEvent.click(screen.getByLabelText(/Reject/));
    fireEvent.change(screen.getByLabelText(/Reason/), { target: { value: 'Unclear photo' } });
    await act(async () => { fireEvent.submit(screen.getByLabelText(/Reason/).closest('form')!); });
    expect(screen.getByTestId('decision-error').textContent).toMatch(/complete/);
    expect(opsDecide).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText(/next step/), { target: { value: 'Upload a clear photo' } });
    await act(async () => { fireEvent.submit(screen.getByLabelText(/Reason/).closest('form')!); });
    expect(opsDecide).toHaveBeenCalledWith(app.id, { decision: 'REJECT', reason: 'Unclear photo', permittedNextStep: 'Upload a clear photo', expectedVersion: 1 }, expect.any(String));
    expect(screen.getByTestId('decision-error').textContent).toMatch(/own application/);
  });

  it('switches to Arabic RTL', async () => {
    await signIn({ opsApplications: async () => ({ items: [] }) });
    await act(async () => { fireEvent.click(screen.getByText('العربية')); });
    expect(document.documentElement.dir).toBe('rtl');
    expect(screen.getByText('لا توجد طلبات بانتظار المراجعة.')).toBeTruthy();
  });

  it('opens uploaded files only through a signed link from the API, and shows which documents have no file', async () => {
    const opsEvidenceLink = vi.fn(async () => ({ url: `/v1/evidence-files/${id(4)}?exp=1&sig=s`, expiresAt: new Date().toISOString() }));
    const opened: string[] = [];
    await signIn({ opsApplications: async () => ({ items: [app] }), opsApplication: async () => detail, opsEvidenceLink }, (u) => opened.push(u));
    await act(async () => { fireEvent.click(await screen.findByTestId(`queue-${app.id}`)); });
    await screen.findByTestId('detail');
    expect(screen.getByTestId(`evidence-${id(5)}`).textContent).toMatch(/Waiting for upload/);
    expect(screen.queryByTestId(`open-${id(5)}`)).toBeNull();
    expect(screen.getByTestId('detail').textContent).toMatch(/Not virus-scanned/);
    await act(async () => { fireEvent.click(screen.getByTestId(`open-${id(4)}`)); });
    expect(opsEvidenceLink).toHaveBeenCalledWith(id(4));
    expect(opened).toEqual([`http://x/v1/evidence-files/${id(4)}?exp=1&sig=s`]);
  });

  it('uses the host sign-in (Clerk) when provided and never shows the dev stub', async () => {
    render(<OpsApp apiUrl="http://x" devStubEnabled auth={{ signedIn: false, getToken: async () => null, signOut: () => undefined, signIn: <div data-testid="clerk-signin" /> }} />);
    expect(screen.getByTestId('clerk-signin')).toBeTruthy();
    expect(screen.queryByLabelText('Test identity name')).toBeNull();
  });
});
