import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import * as C from '@lahloba/contracts';
import { canManageBranch } from '@lahloba/domain';
import type { RouteContext } from '../app';
import type { Queryable } from '../db';
import { HttpError, conflict, notFound } from '../errors';
import { audit } from '../platform';
import { runMutation } from './mutation';

const BranchParams = z.object({ branchId: z.string().uuid() });

async function branchOrg(db: Queryable, branchId: string) {
  const r = await db.query<{ organization_id: string; status: string }>(`SELECT organization_id, status FROM supplier_branches WHERE id = $1`, [branchId]);
  return r.rows[0] ?? null;
}

async function productDto(db: Queryable, id: string) {
  const r = await db.query(
    `SELECT p.id, p.sku, i.name_en, i.name_ar, p.pack_quantity, p.pack_unit, p.price_piastres, p.price_version, p.variable_weight, p.status,
            COALESCE(ib.on_hand_packs - ib.reserved_packs, 0) AS available
     FROM supplier_products p JOIN ingredients i ON i.id = p.ingredient_id LEFT JOIN inventory_balances ib ON ib.product_id = p.id WHERE p.id = $1`,
    [id],
  );
  const p = r.rows[0];
  return C.SupplierProductDto.parse({
    id: p.id, sku: p.sku, ingredient: { en: p.name_en, ar: p.name_ar }, packQuantity: p.pack_quantity, packUnit: p.pack_unit,
    pricePiastres: p.price_piastres, priceVersion: p.price_version, variableWeight: p.variable_weight, availablePacks: p.available, status: p.status,
  });
}

/** S01/S02: branch-scoped product publishing. Owner (org scope) or staff (branch scope) only. */
export function registerSupplierRoutes(app: FastifyInstance, ctx: RouteContext) {
  const authorize = async (req: FastifyRequest, branchId: string, allowPending = true) => {
    const actor = await ctx.requireActor(req);
    const b = await branchOrg(ctx.pool, branchId);
    if (!b || !canManageBranch(actor, { branchId, organizationId: b.organization_id }, { allowPending })) throw notFound('Branch');
    return { actor, branch: b };
  };

  // Branches visible to the caller: all branches of orgs they own + branches they staff.
  app.get('/v1/supplier/branches', async (req) => {
    const actor = await ctx.requireActor(req);
    const orgIds = actor.memberships.filter((m) => m.role === 'SUPPLIER_OWNER' && (m.approvalState === 'APPROVED' || m.approvalState === 'PENDING')).map((m) => m.scopeId!);
    const branchIds = actor.memberships.filter((m) => m.role === 'SUPPLIER_STAFF' && m.approvalState === 'APPROVED').map((m) => m.scopeId!);
    const r = await ctx.pool.query(
      `SELECT b.id, b.public_name, b.status, b.is_open, b.organization_id FROM supplier_branches b
       WHERE b.organization_id = ANY($1::uuid[]) OR b.id = ANY($2::uuid[]) ORDER BY b.created_at`,
      [orgIds, branchIds],
    );
    return C.SupplierBranchList.parse({ items: r.rows.map((b) => ({ id: b.id, publicName: b.public_name, status: b.status, isOpen: b.is_open, organizationId: b.organization_id })) });
  });

  app.get('/v1/supplier/branches/:branchId/products', async (req) => {
    const { branchId } = BranchParams.parse(req.params);
    await authorize(req, branchId);
    const ids = await ctx.pool.query(`SELECT id FROM supplier_products WHERE branch_id = $1 ORDER BY sku`, [branchId]);
    return C.SupplierProductList.parse({ items: await Promise.all(ids.rows.map((r) => productDto(ctx.pool, r.id))) });
  });

  app.post('/v1/supplier/branches/:branchId/products', async (req, reply) => {
    const { branchId } = BranchParams.parse(req.params);
    await authorize(req, branchId);
    const body = C.CreateProductRequest.parse(req.body);
    return runMutation(ctx, req, reply, { route: 'POST /v1/supplier/branches/:branchId/products', params: { branchId }, body, status: 201 }, async (db, actor) => {
      const ing = await db.query<{ canonical_unit: string }>(`SELECT canonical_unit FROM ingredients WHERE id = $1`, [body.ingredientId]);
      if (!ing.rowCount) throw new HttpError(422, 'UNKNOWN_INGREDIENT', 'Ingredient does not exist');
      if (ing.rows[0]!.canonical_unit !== body.packUnit) throw new HttpError(422, 'UNIT_MISMATCH', 'Pack unit must match the ingredient canonical unit');
      const cat = await db.query(`SELECT 1 FROM facets WHERE id = $1 AND facet_type = 'SUPPLIER_CATEGORY'`, [body.categoryFacetId]);
      if (!cat.rowCount) throw new HttpError(422, 'INVALID_FACET', 'Category must be a supplier category');
      const dupe = await db.query(`SELECT 1 FROM supplier_products WHERE branch_id = $1 AND sku = $2`, [branchId, body.sku]);
      if (dupe.rowCount) throw conflict('SKU_EXISTS', 'This SKU already exists for the branch');
      const p = await db.query<{ id: string }>(
        `INSERT INTO supplier_products (branch_id, ingredient_id, sku, pack_quantity, pack_unit, price_piastres, variable_weight, brand, category_facet_id, minimum_order_packs)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
        [branchId, body.ingredientId, body.sku, body.packQuantity, body.packUnit, body.pricePiastres, body.variableWeight, body.brand, body.categoryFacetId, body.minimumOrderPacks],
      );
      const id = p.rows[0]!.id;
      await db.query(`INSERT INTO inventory_balances (product_id, on_hand_packs) VALUES ($1, $2)`, [id, body.availablePacks]);
      await audit(db, { actorUserId: actor.userId, action: 'SUPPLIER_PRODUCT_PUBLISHED', targetType: 'supplier_product', targetId: id, metadata: { branchId, sku: body.sku }, correlationId: req.id });
      return productDto(db, id);
    });
  });

  app.post('/v1/supplier/branches/:branchId/open', async (req, reply) => {
    const { branchId } = BranchParams.parse(req.params);
    await authorize(req, branchId, false);
    const body = z.object({ isOpen: z.boolean() }).strict().parse(req.body);
    return runMutation(ctx, req, reply, { route: 'POST /v1/supplier/branches/:branchId/open', params: { branchId }, body }, async (db, actor) => {
      const r = await db.query(`SELECT status FROM supplier_branches WHERE id = $1 FOR UPDATE`, [branchId]);
      if (body.isOpen && r.rows[0]?.status !== 'APPROVED') throw new HttpError(422, 'BRANCH_NOT_APPROVED', 'Only approved branches can open');
      await db.query(`UPDATE supplier_branches SET is_open = $2 WHERE id = $1`, [branchId, body.isOpen]);
      await audit(db, { actorUserId: actor.userId, action: body.isOpen ? 'BRANCH_OPENED' : 'BRANCH_CLOSED', targetType: 'supplier_branch', targetId: branchId, correlationId: req.id });
      return { branchId, isOpen: body.isOpen };
    });
  });
}
