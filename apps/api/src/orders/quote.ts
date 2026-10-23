import * as C from '@lahloba/contracts';
import { INGREDIENT_TRIP_PIASTRES, assertServingsAllowed, packRequirement, quoteMeal } from '@lahloba/domain';
import type { ResolvedActor } from '../app';
import type { DbClient } from '../db';
import { HttpError, conflict, notFound } from '../errors';
import { workUnits } from '../capacity';

export const QUOTE_TTL_MINUTES = 10;
const L = (en: string, ar: string) => ({ en, ar });
const num = (v: unknown) => Number(v);

export interface QuoteSnapshot {
  offer: { id: string; priceVersion: number; recipeVersionId: string; serviceMode: 'EAT_NOW' | 'HEAT_AT_HOME' | 'COOK_AT_HOME'; leadTimeMinutes: number; titleEn: string; titleAr: string };
  chef: { id: string; name: string; areaId: string; kitchenAddressId: string };
  addressId: string;
  customerAreaId: string;
  slot: { id: string; startsAt: string; endsAt: string };
  workUnits: number;
  finalTariff: { id: string; version: number; feePiastres: number };
  ingredientTariff: { feePiastres: number; maxStops: number } | null;
  basket: Array<{ ingredientId: string; productId: string; branchId: string; branchName: string; sku: string; nameEn: string; nameAr: string; priceVersion: number; packs: number; packPricePiastres: number; packQuantity: number; packUnit: string; amountPiastres: number }>;
  lines: Array<{ component: C.QuoteDto['lines'][number]['component']; recipientType: 'CHEF' | 'SUPPLIER' | 'DELIVERY_LEG' | 'PLATFORM'; recipientKey: string; recipientName: string; amountPiastres: number }>;
  illustrative: boolean;
}

/**
 * Builds a server-side quote (C08/C09/C10) from authoritative catalog, capacity, inventory and
 * tariff data. Nothing about price comes from the client. The result is an immutable snapshot.
 */
export async function buildQuote(db: DbClient, actor: ResolvedActor, body: C.QuoteRequest): Promise<{ id: string; dto: C.QuoteDto }> {
  const o = (await db.query(
    `SELECT v.*, d.title_en, d.title_ar, d.chef_id, d.publication_state, c.public_name AS chef_name, c.status AS chef_status, c.accepting_orders,
            c.public_area_id AS chef_area_id, c.kitchen_address_id, c.is_illustrative
     FROM offer_variants v JOIN dishes d ON d.id = v.dish_id JOIN chefs c ON c.id = d.chef_id WHERE v.id = $1`, [body.offerId])).rows[0];
  if (!o || o.status !== 'ACTIVE' || o.publication_state !== 'PUBLISHED' || o.chef_status !== 'APPROVED') throw notFound('Offer');
  if (!o.accepting_orders || !o.kitchen_address_id) throw conflict('CHEF_NOT_ACCEPTING', 'This cook is not taking orders right now');
  assertServingsAllowed(body.servings, { minServings: o.min_servings, maxServings: o.max_servings, servingStep: o.serving_step });
  if (body.source === 'CHEF' && o.chef_ingredients_per_serving_piastres === null) throw new HttpError(422, 'SOURCE_NOT_OFFERED', 'This cook does not supply the ingredients for this dish');
  if (body.source === 'SUPPLIERS' && !o.supplier_sourcing_allowed) throw new HttpError(422, 'SOURCE_NOT_OFFERED', 'This dish cannot be made with shop-bought ingredients');

  // Delivery address: private, owned by the customer.
  let addressId: string;
  let areaId: string;
  if (body.addressId) {
    const a = (await db.query(`SELECT id, area_id FROM private_addresses WHERE id = $1 AND owner_user_id = $2 AND kind = 'CUSTOMER'`, [body.addressId, actor.userId])).rows[0];
    if (!a) throw notFound('Address');
    addressId = a.id; areaId = a.area_id;
  } else {
    const a = body.address!;
    const ins = await db.query(
      `INSERT INTO private_addresses (owner_user_id, address_text, area_id, access_notes, label, kind) VALUES ($1, $2, $3, $4, $5, 'CUSTOMER') RETURNING id, area_id`,
      [actor.userId, a.addressText, a.areaId, a.accessNotes ?? null, a.label ?? null]);
    addressId = ins.rows[0].id; areaId = ins.rows[0].area_id;
  }
  const area = (await db.query(`SELECT label_en, label_ar, status, physical_ordering_enabled FROM service_areas WHERE id = $1`, [areaId])).rows[0];
  if (!area?.physical_ordering_enabled) throw new HttpError(422, 'AREA_NOT_SERVED', 'Delivery is not available in this area yet');
  const serves = await db.query(`SELECT 1 FROM chef_service_areas WHERE chef_id = $1 AND area_id = $2`, [o.chef_id, areaId]);
  if (!serves.rowCount) throw new HttpError(422, 'OUTSIDE_CHEF_AREA', 'This cook does not deliver to your area');

  const fin = (await db.query(`SELECT id, version, fee_piastres, eligible FROM delivery_tariffs WHERE kind = 'FINAL' AND from_area_id = $1 AND to_area_id = $2`, [o.chef_area_id, areaId])).rows[0];
  if (!fin?.eligible) throw new HttpError(422, 'UNSERVICEABLE', 'Delivery between these areas is not available yet');

  const units = workUnits(o, body.servings);
  const slot = (await db.query(
    `SELECT id, starts_at, ends_at FROM chef_capacity_slots
     WHERE id = $1 AND chef_id = $2 AND status = 'ACTIVE' AND starts_at >= now() + make_interval(mins => $3) AND total_work_units - reserved_work_units >= $4`,
    [body.slotId, o.chef_id, o.lead_time_minutes, units])).rows[0];
  if (!slot) throw conflict('SLOT_UNAVAILABLE', 'That kitchen time is no longer available for this many people. Choose another time.');

  const reqs = (await db.query(
    `SELECT r.ingredient_id, r.quantity_per_serving, r.unit, r.is_pantry, r.allowed_omission, i.name_en, i.name_ar
     FROM ingredient_requirements r JOIN ingredients i ON i.id = r.ingredient_id WHERE r.recipe_version_id = $1 ORDER BY r.sort_order`, [o.recipe_version_id])).rows;

  const basketDto: C.QuoteDto['basket'] = [];
  const basket: QuoteSnapshot['basket'] = [];
  let ingredientTariff: QuoteSnapshot['ingredientTariff'] = null;
  if (body.source === 'SUPPLIERS') {
    const needed = reqs.filter((r) => !r.is_pantry);
    const cands = (await db.query(
      `SELECT p.id, p.ingredient_id, p.sku, p.pack_quantity, p.pack_unit, p.price_piastres, p.price_version, p.variable_weight, p.minimum_order_packs,
              b.id AS branch_id, b.public_name AS branch_name, a.label_en, a.label_ar, ib.on_hand_packs - ib.reserved_packs AS available, t.max_stops
       FROM supplier_products p
       JOIN supplier_branches b ON b.id = p.branch_id
       JOIN supplier_organizations org ON org.id = b.organization_id
       JOIN inventory_balances ib ON ib.product_id = p.id
       JOIN service_areas a ON a.id = b.area_id
       JOIN delivery_tariffs t ON t.kind = 'INGREDIENT' AND t.from_area_id = b.area_id AND t.to_area_id = $2 AND t.eligible
       WHERE p.ingredient_id = ANY($1) AND p.status = 'ACTIVE' AND b.status = 'APPROVED' AND b.is_open AND org.status = 'APPROVED'`,
      [needed.map((r) => r.ingredient_id), o.chef_area_id])).rows;
    const choices = new Map((body.supplierChoices ?? []).map((c) => [c.ingredientId, c.productId]));
    const missing: string[] = [];
    let maxStops = 10;
    for (const r of needed) {
      const required = Math.ceil(num(r.quantity_per_serving));
      const options = cands
        .filter((p) => p.ingredient_id === r.ingredient_id && p.pack_unit === r.unit)
        .map((p) => {
          const q = packRequirement(required, body.servings, Math.round(num(p.pack_quantity)));
          const packs = Math.max(q.packs, p.minimum_order_packs);
          return {
            row: p,
            dto: {
              productId: p.id, branchId: p.branch_id, branchName: p.branch_name, branchArea: L(p.label_en, p.label_ar),
              packQuantity: num(p.pack_quantity), packUnit: p.pack_unit, packPricePiastres: num(p.price_piastres), packs,
              amountPiastres: packs * num(p.price_piastres), leftoverQuantity: packs * num(p.pack_quantity) - required * body.servings,
              variableWeight: p.variable_weight, availablePacks: num(p.available),
            },
          };
        })
        .filter((x) => x.dto.availablePacks >= x.dto.packs)
        .sort((a, b) => a.dto.amountPiastres - b.dto.amountPiastres || a.dto.branchName.localeCompare(b.dto.branchName));
      const wanted = choices.get(r.ingredient_id);
      const chosen = wanted ? options.find((x) => x.dto.productId === wanted) : options[0];
      if (wanted && !chosen) throw new HttpError(422, 'INVALID_CHOICE', 'A chosen product is not available for this ingredient');
      basketDto.push({ ingredientId: r.ingredient_id, name: L(r.name_en, r.name_ar), requiredQuantity: required * body.servings, unit: r.unit, chosen: chosen?.dto ?? null, options: options.map((x) => x.dto) });
      if (!chosen) {
        if (!r.allowed_omission) missing.push(r.name_en);
        continue;
      }
      maxStops = Math.min(maxStops, chosen.row.max_stops);
      basket.push({
        ingredientId: r.ingredient_id, productId: chosen.row.id, branchId: chosen.row.branch_id, branchName: chosen.row.branch_name, sku: chosen.row.sku,
        nameEn: r.name_en, nameAr: r.name_ar, priceVersion: chosen.row.price_version, packs: chosen.dto.packs, packPricePiastres: chosen.dto.packPricePiastres,
        packQuantity: chosen.dto.packQuantity, packUnit: chosen.dto.packUnit, amountPiastres: chosen.dto.amountPiastres,
      });
    }
    if (missing.length) throw conflict('BASKET_INCOMPLETE', 'Some ingredients are not available from shops that deliver to this cook. Choose "cook supplies ingredients" or try later.', { missing });
    const branches = new Set(basket.map((b) => b.branchId));
    if (branches.size > maxStops) throw new HttpError(422, 'TOO_MANY_STOPS', `Choose ingredients from at most ${maxStops} shops so one courier can collect them`, { maxStops });
    ingredientTariff = { feePiastres: INGREDIENT_TRIP_PIASTRES, maxStops };
  }

  const q = quoteMeal({
    source: body.source, servings: body.servings, laborPerPersonPiastres: num(o.labor_per_person_piastres), chefId: o.chef_id,
    finalCourierId: 'leg:MEAL', finalTripPiastres: num(fin.fee_piastres), routeEligible: true,
    packagingPiastres: num(o.packaging_piastres),
    chefIngredientPiastres: body.source === 'CHEF' ? num(o.chef_ingredients_per_serving_piastres) * body.servings : 0,
    supplierLines: body.source === 'SUPPLIERS'
      ? basket.map((b) => ({ ingredientId: b.ingredientId, supplierId: b.branchId, gramsPerPerson: 1, packGrams: body.servings, packPricePiastres: b.amountPiastres }))
      : [],
    ...(body.source === 'SUPPLIERS' ? { ingredientCourierId: 'leg:INGREDIENT', ingredientRouteEligible: true } : {}),
  });
  // Supplier lines are passed as exactly one "pack" priced at the amount computed above (which
  // includes minimum order packs), so quoteMeal charges the authoritative pack maths.
  const branchName = new Map(basket.map((b) => [b.branchId, b.branchName]));
  const lines: QuoteSnapshot['lines'] = q.lines.map((l) => {
    if (l.recipientId === o.chef_id) return { component: l.component, recipientType: 'CHEF', recipientKey: o.chef_id, recipientName: o.chef_name, amountPiastres: l.amountPiastres };
    if (l.recipientId === 'leg:MEAL') return { component: l.component, recipientType: 'DELIVERY_LEG', recipientKey: 'MEAL_TO_CUSTOMER', recipientName: 'Meal delivery', amountPiastres: l.amountPiastres };
    if (l.recipientId === 'leg:INGREDIENT') return { component: l.component, recipientType: 'DELIVERY_LEG', recipientKey: 'INGREDIENT_TO_CHEF', recipientName: 'Ingredient delivery', amountPiastres: l.amountPiastres };
    if (l.recipientId === 'platform') return { component: l.component, recipientType: 'PLATFORM', recipientKey: 'platform', recipientName: 'Lahloba', amountPiastres: l.amountPiastres };
    return { component: l.component, recipientType: 'SUPPLIER', recipientKey: l.recipientId, recipientName: branchName.get(l.recipientId) ?? 'Shop', amountPiastres: l.amountPiastres };
  });
  // Merge per-ingredient supplier lines into one line per shop for display and allocation.
  const merged: QuoteSnapshot['lines'] = [];
  for (const l of lines) {
    const same = merged.find((m) => m.component === l.component && m.recipientKey === l.recipientKey);
    if (same) same.amountPiastres += l.amountPiastres; else merged.push({ ...l });
  }

  const pantry = reqs.filter((r) => r.is_pantry).map((r) => L(r.name_en, r.name_ar));
  const snapshot: QuoteSnapshot = {
    offer: { id: o.id, priceVersion: o.price_version, recipeVersionId: o.recipe_version_id, serviceMode: o.service_mode, leadTimeMinutes: o.lead_time_minutes, titleEn: o.title_en, titleAr: o.title_ar },
    chef: { id: o.chef_id, name: o.chef_name, areaId: o.chef_area_id, kitchenAddressId: o.kitchen_address_id },
    addressId, customerAreaId: areaId,
    slot: { id: slot.id, startsAt: new Date(slot.starts_at).toISOString(), endsAt: new Date(slot.ends_at).toISOString() },
    workUnits: units,
    finalTariff: { id: fin.id, version: fin.version, feePiastres: num(fin.fee_piastres) },
    ingredientTariff, basket, lines: merged, illustrative: o.is_illustrative,
  };
  const ins = await db.query(
    `INSERT INTO quotes (customer_id, offer_id, source, servings, slot_id, address_id, snapshot, total_piastres, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now() + make_interval(mins => $9)) RETURNING id, expires_at`,
    [actor.userId, o.id, body.source, body.servings, slot.id, addressId, JSON.stringify(snapshot), q.totalPiastres, QUOTE_TTL_MINUTES]);
  const dto = C.QuoteDto.parse({
    id: ins.rows[0].id, offerId: o.id, addressId, dishTitle: L(o.title_en, o.title_ar), chef: { id: o.chef_id, publicName: o.chef_name },
    source: body.source, servings: body.servings, slot: { slotId: slot.id, startsAt: snapshot.slot.startsAt, endsAt: snapshot.slot.endsAt },
    deliveryArea: L(area.label_en, area.label_ar),
    lines: merged.map((l) => ({ component: l.component, recipientType: l.recipientType, recipientName: l.recipientName, amountPiastres: l.amountPiastres })),
    basket: basketDto, pantryNote: pantry, totalPiastres: q.totalPiastres,
    expiresAt: new Date(ins.rows[0].expires_at).toISOString(), illustrative: o.is_illustrative, sandbox: true,
  });
  return { id: dto.id, dto };
}
