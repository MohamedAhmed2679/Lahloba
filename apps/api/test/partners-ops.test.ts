import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { TEST_DB_ADMIN_URL, createTestContext, type TestContext } from '../src/testing';
import { call } from './helpers';

describe.skipIf(!TEST_DB_ADMIN_URL)('identity, partner applications and operations review (H01, S01, D01, O01)', () => {
  let ctx: TestContext;
  let ops: string;
  let area: Record<string, string>;
  beforeAll(async () => {
    ctx = await createTestContext();
    area = ctx.seed!.area;
    ops = await ctx.token('sample-ops-reviewer');
  });
  afterAll(async () => ctx?.close());

  const chefApplication = () => ({
    kind: 'CHEF',
    chef: { publicName: 'New Test Kitchen', publicAreaId: area.maadi, serviceAreaIds: [area.maadi], kitchenAddress: { addressText: 'SECRET-STREET 42, Maadi', areaId: area.maadi } },
  });

  it('requires a verified bearer token; garbage and unsigned tokens are rejected', async () => {
    expect((await call(ctx, 'GET', '/v1/me')).status).toBe(401);
    expect((await call(ctx, 'GET', '/v1/me', { token: 'garbage' })).status).toBe(401);
    const forged = 'eyJhbGciOiJub25lIn0.eyJzdWIiOiJzYW1wbGUtb3BzLXJldmlld2VyIn0.';
    expect((await call(ctx, 'GET', '/v1/me', { token: forged })).status).toBe(401);
  });

  it('dev stub issues tokens in test env; a new user gets exactly one CUSTOMER membership', async () => {
    const t = await call(ctx, 'POST', '/v1/dev/tokens', { body: { subject: 'fresh-user' }, key: null });
    expect(t.status).toBe(200);
    expect(t.body.warning).toMatch(/Development/);
    const me = await call(ctx, 'GET', '/v1/me', { token: t.body.token });
    expect(me.body.memberships).toEqual([expect.objectContaining({ role: 'CUSTOMER', approvalState: 'APPROVED', scopeType: 'GLOBAL' })]);
  });

  it('client cannot set roles or approval through the application body', async () => {
    const tok = await ctx.token('role-escalator');
    const r = await call(ctx, 'POST', '/v1/partner-applications', { token: tok, body: { ...chefApplication(), status: 'APPROVED', role: 'OPS_ADMIN' } });
    expect(r.status).toBe(400);
  });

  it('mutations require an Idempotency-Key', async () => {
    const tok = await ctx.token('no-key-user');
    const r = await call(ctx, 'POST', '/v1/partner-applications', { token: tok, body: chefApplication(), key: null });
    expect(r.status).toBe(400);
    expect(r.body.error.code).toBe('IDEMPOTENCY_KEY_REQUIRED');
  });

  it('full chef approval flow with evidence, no self review and version guard', async () => {
    const tok = await ctx.token('new-chef');
    const applied = await call(ctx, 'POST', '/v1/partner-applications', { token: tok, body: chefApplication() });
    expect(applied.status).toBe(201);
    expect(applied.body).toMatchObject({ kind: 'CHEF', status: 'SUBMITTED', evidenceCount: 0, version: 1 });
    const appId = applied.body.id;
    const chefId = applied.body.subjectId;

    // Pending chef: membership PENDING; can draft but not publish; not in discovery.
    const me = await call(ctx, 'GET', '/v1/me', { token: tok });
    expect(me.body.memberships).toContainEqual(expect.objectContaining({ role: 'CHEF_OWNER', scopeId: chefId, approvalState: 'PENDING' }));
    expect((await call(ctx, 'GET', `/v1/chefs/${chefId}`)).status).toBe(404);

    // Second open application of same kind is refused.
    expect((await call(ctx, 'POST', '/v1/partner-applications', { token: tok, body: chefApplication() })).body.error.code).toBe('APPLICATION_ALREADY_OPEN');

    // Customers cannot review.
    expect((await call(ctx, 'GET', '/v1/ops/partner-applications', { token: tok })).status).toBe(403);

    // Approval without evidence is refused.
    const noEvidence = await call(ctx, 'POST', `/v1/ops/partner-applications/${appId}/decision`, { token: ops, body: { decision: 'APPROVE', reason: 'Checked in person', expectedVersion: 1 } });
    expect(noEvidence.status).toBe(422);
    expect(noEvidence.body.error.code).toBe('EVIDENCE_REQUIRED');

    const ev = await call(ctx, 'POST', `/v1/partner-applications/${appId}/evidence`, { token: tok, body: { evidenceType: 'NATIONAL_ID', contentType: 'image/jpeg', byteSize: 2048, expiresOn: '2030-01-31' } });
    expect(ev.status).toBe(201);
    expect(ev.body.upload.status).toBe('DEV_METADATA_ONLY');
    // Another user cannot attach evidence to this application.
    const other = await ctx.token('someone-else');
    expect((await call(ctx, 'POST', `/v1/partner-applications/${appId}/evidence`, { token: other, body: { evidenceType: 'OTHER', contentType: 'image/png', byteSize: 10 } })).status).toBe(404);
    // Oversized or wrong-type evidence rejected.
    expect((await call(ctx, 'POST', `/v1/partner-applications/${appId}/evidence`, { token: tok, body: { evidenceType: 'OTHER', contentType: 'text/html', byteSize: 10 } })).status).toBe(400);
    expect((await call(ctx, 'POST', `/v1/partner-applications/${appId}/evidence`, { token: tok, body: { evidenceType: 'OTHER', contentType: 'image/png', byteSize: 50_000_000 } })).status).toBe(400);

    // Ops view: metadata only, no object key or kitchen address; the read is audited.
    const detail = await call(ctx, 'GET', `/v1/ops/partner-applications/${appId}`, { token: ops });
    expect(detail.status).toBe(200);
    expect(detail.body.evidence).toHaveLength(1);
    expect(detail.raw).not.toMatch(/dev-only\/|object_key|objectKey|SECRET-STREET/);
    const reads = await ctx.pool.query(`SELECT count(*)::int AS n FROM audit_events WHERE action = 'PARTNER_EVIDENCE_METADATA_READ' AND target_id = $1`, [appId]);
    expect(reads.rows[0].n).toBe(1);

    // Stale version refused.
    const stale = await call(ctx, 'POST', `/v1/ops/partner-applications/${appId}/decision`, { token: ops, body: { decision: 'APPROVE', reason: 'looks fine', expectedVersion: 7 } });
    expect(stale.status).toBe(409);

    const ok = await call(ctx, 'POST', `/v1/ops/partner-applications/${appId}/decision`, { token: ops, body: { decision: 'APPROVE', reason: 'Evidence reviewed', expectedVersion: 1 } });
    expect(ok.status).toBe(200);
    expect(ok.body.status).toBe('APPROVED');
    const me2 = await call(ctx, 'GET', '/v1/me', { token: tok });
    expect(me2.body.memberships).toContainEqual(expect.objectContaining({ role: 'CHEF_OWNER', scopeId: chefId, approvalState: 'APPROVED' }));
    const granted = await ctx.pool.query(`SELECT granted_by FROM role_memberships WHERE scope_id = $1`, [chefId]);
    expect(granted.rows[0].granted_by).toBe(ctx.seed!.users.ops);

    // Deciding again is refused; outbox + audit written in the same transaction.
    expect((await call(ctx, 'POST', `/v1/ops/partner-applications/${appId}/decision`, { token: ops, body: { decision: 'REJECT', reason: 'x'.repeat(5), permittedNextStep: 'reapply', expectedVersion: 2 } })).body.error.code).toBe('ALREADY_DECIDED');
    const outbox = await ctx.pool.query(`SELECT event_type FROM outbox_events WHERE aggregate_id = $1 ORDER BY created_at`, [appId]);
    expect(outbox.rows.map((r) => r.event_type)).toEqual(['PartnerApplicationSubmitted', 'PartnerApplicationDecided']);

    // Approved chef profile is public but kitchen address still private; not accepting until they open.
    const pub = await call(ctx, 'GET', `/v1/chefs/${chefId}`);
    expect(pub.status).toBe(200);
    expect(pub.raw).not.toContain('SECRET-STREET');
    expect(pub.body.acceptingOrders).toBe(false);
    expect(pub.body.verifiedClaims).toEqual([]);
  });

  it('O01: an ops reviewer cannot approve their own application (API and database)', async () => {
    const own = await call(ctx, 'POST', '/v1/partner-applications', { token: ops, body: { kind: 'COURIER', courier: { displayName: 'Ops Person', equipment: ['BICYCLE'] } } });
    expect(own.status).toBe(201);
    await call(ctx, 'POST', `/v1/partner-applications/${own.body.id}/evidence`, { token: ops, body: { evidenceType: 'DRIVING_LICENSE', contentType: 'application/pdf', byteSize: 100 } });
    const self = await call(ctx, 'POST', `/v1/ops/partner-applications/${own.body.id}/decision`, { token: ops, body: { decision: 'APPROVE', reason: 'self', expectedVersion: 1 } });
    expect(self.status).toBe(403);
    await expect(ctx.pool.query(
      `UPDATE partner_applications SET status = 'APPROVED', decided_by = applicant_user_id, decided_at = now(), decision_reason = 'x' WHERE id = $1`, [own.body.id],
    )).rejects.toThrow(/check/);
  });

  it('rejection records a permitted next step; the applicant may reapply', async () => {
    const tok = await ctx.token('rejected-courier');
    const a = await call(ctx, 'POST', '/v1/partner-applications', { token: tok, body: { kind: 'COURIER', courier: { displayName: 'Rider', equipment: ['MOTORCYCLE', 'INSULATED_BAG'] } } });
    const missingStep = await call(ctx, 'POST', `/v1/ops/partner-applications/${a.body.id}/decision`, { token: ops, body: { decision: 'REJECT', reason: 'Licence unreadable', expectedVersion: 1 } });
    expect(missingStep.status).toBe(400);
    const rej = await call(ctx, 'POST', `/v1/ops/partner-applications/${a.body.id}/decision`, { token: ops, body: { decision: 'REJECT', reason: 'Licence unreadable', permittedNextStep: 'Upload a clear licence photo and reapply', expectedVersion: 1 } });
    expect(rej.body).toMatchObject({ status: 'REJECTED', permittedNextStep: 'Upload a clear licence photo and reapply' });
    const mine = await call(ctx, 'GET', '/v1/partner-applications/mine', { token: tok });
    expect(mine.body.items[0].decisionReason).toBe('Licence unreadable');
    const again = await call(ctx, 'POST', '/v1/partner-applications', { token: tok, body: { kind: 'COURIER', courier: { displayName: 'Rider', equipment: ['MOTORCYCLE'] } } });
    expect(again.status).toBe(201);
    const me = await call(ctx, 'GET', '/v1/me', { token: tok });
    expect(me.body.memberships.find((m: any) => m.role === 'COURIER').approvalState).toBe('PENDING');
  });

  it('D01: courier equipment is validated against the allowed list', async () => {
    const tok = await ctx.token('bad-equipment');
    const r = await call(ctx, 'POST', '/v1/partner-applications', { token: tok, body: { kind: 'COURIER', courier: { displayName: 'Rider', equipment: ['JETPACK'] } } });
    expect(r.status).toBe(400);
  });

  it('S01: supplier application creates a pending org and branch with private address', async () => {
    const tok = await ctx.token('new-supplier');
    const r = await call(ctx, 'POST', '/v1/partner-applications', { token: tok, body: {
      kind: 'SUPPLIER', supplier: { organizationName: 'Test Market', branch: { publicName: 'Test Market Maadi', areaId: area.maadi, serviceAreaIds: [area.maadi], address: { addressText: 'HIDDEN-BRANCH-ADDRESS 9', areaId: area.maadi } } },
    } });
    expect(r.status).toBe(201);
    const branches = await call(ctx, 'GET', '/v1/supplier/branches', { token: tok });
    expect(branches.body.items).toEqual([expect.objectContaining({ publicName: 'Test Market Maadi', status: 'PENDING', isOpen: false })]);
    expect(branches.raw).not.toContain('HIDDEN-BRANCH-ADDRESS');
    // A pending branch cannot open.
    const open = await call(ctx, 'POST', `/v1/supplier/branches/${branches.body.items[0].id}/open`, { token: tok, body: { isOpen: true } });
    expect(open.status).toBe(404); // approved membership required; pending owner gets no access
  });

  it('concurrent decisions on one application: exactly one wins', async () => {
    const tok = await ctx.token('race-courier');
    const a = await call(ctx, 'POST', '/v1/partner-applications', { token: tok, body: { kind: 'COURIER', courier: { displayName: 'Race', equipment: ['CAR'] } } });
    await call(ctx, 'POST', `/v1/partner-applications/${a.body.id}/evidence`, { token: tok, body: { evidenceType: 'DRIVING_LICENSE', contentType: 'image/png', byteSize: 10 } });
    const second = await ctx.token('sample-ops-reviewer');
    const results = await Promise.all([
      call(ctx, 'POST', `/v1/ops/partner-applications/${a.body.id}/decision`, { token: ops, body: { decision: 'APPROVE', reason: 'ok one', expectedVersion: 1 } }),
      call(ctx, 'POST', `/v1/ops/partner-applications/${a.body.id}/decision`, { token: second, body: { decision: 'REJECT', reason: 'no two', permittedNextStep: 'reapply', expectedVersion: 1 } }),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
    const audits = await ctx.pool.query(`SELECT count(*)::int AS n FROM audit_events WHERE target_id = $1 AND action LIKE 'PARTNER_APPLICATION_%' AND action <> 'PARTNER_APPLICATION_SUBMITTED'`, [a.body.id]);
    expect(audits.rows[0].n).toBe(1);
  });

  it('idempotency: replay returns the same result once; reused key with a different body is refused; concurrent duplicates create one record', async () => {
    const tok = await ctx.token('idem-user');
    const key = ctx.key();
    const body = { kind: 'COURIER', courier: { displayName: 'Idem', equipment: ['BICYCLE'] } };
    const [r1, r2] = await Promise.all([
      call(ctx, 'POST', '/v1/partner-applications', { token: tok, body, key }),
      call(ctx, 'POST', '/v1/partner-applications', { token: tok, body, key }),
    ]);
    expect(r1.status).toBe(201);
    expect(r2.status).toBe(201);
    expect(r1.body.id).toBe(r2.body.id);
    expect([r1.headers['idempotent-replayed'], r2.headers['idempotent-replayed']]).toContain('true');
    const n = await ctx.pool.query(`SELECT count(*)::int AS n FROM partner_applications a JOIN app_users u ON u.id = a.applicant_user_id WHERE u.identity_subject = 'dev:idem-user'`);
    expect(n.rows[0].n).toBe(1);
    const changed = await call(ctx, 'POST', '/v1/partner-applications', { token: tok, body: { ...body, courier: { ...body.courier, displayName: 'Other' } }, key });
    expect(changed.status).toBe(409);
    expect(changed.body.error.code).toBe('IDEMPOTENCY_CONFLICT');
    // Same key by a different actor is independent.
    const otherTok = await ctx.token('idem-user-2');
    expect((await call(ctx, 'POST', '/v1/partner-applications', { token: otherTok, body, key })).status).toBe(201);
  });

  it('suspended accounts are refused even with a valid token', async () => {
    const tok = await ctx.token('to-suspend');
    await call(ctx, 'GET', '/v1/me', { token: tok });
    await ctx.pool.query(`UPDATE app_users SET status = 'SUSPENDED' WHERE identity_subject = 'dev:to-suspend'`);
    expect((await call(ctx, 'GET', '/v1/me', { token: tok })).status).toBe(403);
  });

  it('audit trail is append-only', async () => {
    await expect(ctx.pool.query(`UPDATE audit_events SET reason = 'tampered'`)).rejects.toThrow(/append-only/);
    await expect(ctx.pool.query(`DELETE FROM audit_events`)).rejects.toThrow(/append-only/);
  });

  it('locale preference persists (C23 groundwork)', async () => {
    const tok = await ctx.token('arabic-user');
    const r = await call(ctx, 'PATCH', '/v1/me', { token: tok, body: { locale: 'ar' } });
    expect(r.body.locale).toBe('ar');
    expect((await call(ctx, 'GET', '/v1/me', { token: tok })).body.locale).toBe('ar');
    expect((await call(ctx, 'PATCH', '/v1/me', { token: tok, body: { locale: 'fr' } })).status).toBe(400);
  });
});
