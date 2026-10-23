import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, type ApiClient, type OpsApplicationDetail } from '@lahloba/contracts';
import { OpsApp } from './OpsApp';

afterEach(cleanup);
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const app = { id: id(1), kind: 'CHEF' as const, subjectId: id(2), status: 'SUBMITTED' as const, submittedAt: new Date(0).toISOString(), decidedAt: null, decisionReason: null, permittedNextStep: null, version: 1, evidenceCount: 1 };
const detail: OpsApplicationDetail = {
  ...app, applicant: { userId: id(3), displayName: 'Applicant' }, subjectSummary: { publicName: 'Kitchen', area: { en: 'Maadi', ar: 'المعادي' }, equipment: [] },
  evidence: [{ evidenceId: id(4), evidenceType: 'NATIONAL_ID', contentType: 'image/jpeg', byteSize: 10, expiresOn: '2030-01-01', reviewState: 'PENDING_REVIEW', createdAt: new Date(0).toISOString() }],
};

async function signIn(api: Partial<ApiClient>) {
  render(<OpsApp apiUrl="http://x" devStubEnabled apiFactory={() => ({ devToken: async () => ({ token: 't', expiresInSeconds: 1, warning: '' }), ...api }) as ApiClient} />);
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
    expect((await screen.findByTestId('detail')).textContent).toMatch(/NATIONAL_ID/);
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
});
