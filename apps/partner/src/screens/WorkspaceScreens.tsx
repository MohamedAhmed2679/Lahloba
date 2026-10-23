import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError, newIdempotencyKey, type ChefDishDto } from '@lahloba/contracts';
import { parseEgpToPiastres } from '@lahloba/domain';
import { formatMoney, pickLocalized } from '@lahloba/i18n';
import { Button, Card, Chip, EmptyState, ErrorState, LoadingState, Notice, Row, Screen, Text, TextField, useLocale } from '@lahloba/ui';
import { View } from 'react-native';
import { roleAccent, RoleStrip } from '@lahloba/ui';
import { usePartner } from '../PartnerContext';
import { SupplierOrdersPanel, Tabs } from './WorkScreens';

/** H03 groundwork: chef menu list + draft creation (shown as the Menu tab of the chef workspace). */
export function ChefMenuPanel(props: { chefId: string }) {
  const { api, interfaces } = usePartner();
  const { t, locale } = useLocale();
  const [dishes, setDishes] = useState<ChefDishDto[] | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [titleEn, setTitleEn] = useState('');
  const [titleAr, setTitleAr] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const key = useRef(newIdempotencyKey());
  const pending = interfaces.some((i) => i.ui === 'CHEF' && i.scopeId === props.chefId && i.approvalState === 'PENDING');

  const load = useCallback(() => {
    setError(null);
    api.chefDishes(props.chefId).then((r) => setDishes(r.items), setError);
  }, [api, props.chefId]);
  useEffect(load, [load]);

  const create = async () => {
    if (titleEn.trim().length < 2 || titleAr.trim().length < 2) return setFormError(t('partner.form.required'));
    try {
      await api.createDish(props.chefId, { titleEn: titleEn.trim(), titleAr: titleAr.trim() }, key.current);
      key.current = newIdempotencyKey();
      setTitleEn('');
      setTitleAr('');
      setFormError(null);
      load();
    } catch (e) {
      setFormError(e instanceof ApiError ? e.message : t('common.error.generic'));
    }
  };

  return (
    <View testID="chef-menu" style={{ gap: 12 }}>
      <Text variant="title" role="header">{t('partner.menu')}</Text>
      {pending ? <Notice>{t('partner.pendingAccess')}</Notice> : null}
      {error ? <ErrorState message={t('common.error.generic')} onRetry={load} /> : null}
      {!error && !dishes ? <LoadingState /> : null}
      {dishes && dishes.length === 0 ? <EmptyState message={t('partner.noDishes')} /> : null}
      {dishes?.map((d) => (
        <Card key={d.id} testID={`dish-${d.id}`}>
          <Text variant="label">{pickLocalized(locale, d.title.en, d.title.ar)}</Text>
          <Text variant="caption" muted>{d.publicationState === 'PUBLISHED' ? t('partner.published') : t('partner.draft')}</Text>
          {d.variants.map((v) => (
            <Text key={v.id} variant="caption">{t(`entry.${v.serviceMode}.title` as const)} · {t('results.labourBasis', { amount: formatMoney(v.laborPerPersonPiastres, locale) })}</Text>
          ))}
        </Card>
      ))}
      <Text variant="title" role="header">{t('partner.newDish')}</Text>
      <TextField label={t('partner.titleEn')} value={titleEn} onChangeText={setTitleEn} testID="title-en" />
      <TextField label={t('partner.titleAr')} value={titleAr} onChangeText={setTitleAr} testID="title-ar" />
      {formError ? <Notice tone="danger">{formError}</Notice> : null}
      <Button label={t('partner.create')} onPress={create} testID="create-dish" />
    </View>
  );
}

/** S02: supplier branch products with integer-piastre price entry. */
export function SupplierScreen() {
  const { api, nav } = usePartner();
  const { t, locale } = useLocale();
  const [branches, setBranches] = useState<Array<{ id: string; publicName: string; status: string; isOpen: boolean }> | null>(null);
  const [branchId, setBranchId] = useState<string | null>(null);
  const [products, setProducts] = useState<Array<{ id: string; sku: string; ingredient: { en: string; ar: string }; pricePiastres: number; availablePacks: number }>>([]);
  const [ingredients, setIngredients] = useState<Array<{ id: string; name: { en: string; ar: string }; unit: 'g' | 'ml' | 'count' }>>([]);
  const [categories, setCategories] = useState<Array<{ id: string; label: { en: string; ar: string } }>>([]);
  const [form, setForm] = useState({ ingredientId: '', categoryId: '', sku: '', pack: '', price: '', stock: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const key = useRef(newIdempotencyKey());
  const [tab, setTab] = useState<'orders' | 'products'>('orders');

  useEffect(() => {
    api.myBranches().then((r) => { setBranches(r.items); setBranchId(r.items[0]?.id ?? null); }, () => setBranches([]));
    api.ingredients().then((r) => setIngredients(r.items), () => undefined);
    api.facets('SUPPLIER_CATEGORY').then((r) => setCategories(r.items), () => undefined);
  }, [api]);
  const loadProducts = useCallback(() => {
    if (branchId) api.branchProducts(branchId).then((r) => setProducts(r.items), () => setProducts([]));
  }, [api, branchId]);
  useEffect(loadProducts, [loadProducts]);

  const unit = ingredients.find((i) => i.id === form.ingredientId)?.unit ?? 'g';
  const publish = async () => {
    const e: Record<string, string> = {};
    const price = parseEgpToPiastres(form.price);
    const pack = Number(form.pack);
    const stock = Number(form.stock);
    if (!form.ingredientId) e.ingredient = t('partner.form.required');
    if (!form.categoryId) e.category = t('partner.form.required');
    if (!/^[A-Za-z0-9._-]{1,64}$/.test(form.sku)) e.sku = t('partner.form.required');
    if (!Number.isSafeInteger(pack) || pack <= 0) e.pack = t('partner.invalidNumber');
    if (price === null) e.price = t('partner.invalidPrice');
    if (!Number.isSafeInteger(stock) || stock < 0) e.stock = t('partner.invalidNumber');
    setErrors(e);
    if (Object.keys(e).length || !branchId || price === null) return;
    try {
      await api.createProduct(branchId, {
        ingredientId: form.ingredientId, sku: form.sku, packQuantity: pack, packUnit: unit, pricePiastres: price,
        variableWeight: false, brand: null, categoryFacetId: form.categoryId, availablePacks: stock,
      }, key.current);
      key.current = newIdempotencyKey();
      setSubmitError(null);
      setForm({ ingredientId: '', categoryId: '', sku: '', pack: '', price: '', stock: '' });
      loadProducts();
    } catch (err) {
      setSubmitError(err instanceof ApiError ? err.message : t('common.error.generic'));
    }
  };

  return (
    <Screen testID="supplier" header={<RoleStrip title={t('partner.role.SUPPLIER')} strip={roleAccent.SUPPLIER.strip} onStrip={roleAccent.SUPPLIER.onStrip} />}>
      <Button variant="secondary" label={t('common.back')} onPress={() => nav.back()} />
      <Tabs tabs={[['orders', t('pw.tab.orders')], ['products', t('pw.tab.products')]]} value={tab} onChange={setTab} />
      {branches === null ? <LoadingState /> : null}
      {branches?.length === 0 ? <EmptyState message={t('partner.noBranches')} /> : null}
      <Row wrap>
        {branches?.map((b) => (
          <Chip key={b.id} label={`${b.publicName} · ${t(`partner.state.${b.status}` as 'partner.state.PENDING')}`} selected={branchId === b.id} onToggle={() => setBranchId(b.id)} />
        ))}
      </Row>
      {tab === 'orders' && branchId ? <SupplierOrdersPanel branchId={branchId} /> : null}
      {tab === 'products' ? <Text variant="title" role="header">{t('partner.products')}</Text> : null}
      {tab === 'products' ? products.map((p) => (
        <Card key={p.id}>
          <Text variant="label">{pickLocalized(locale, p.ingredient.en, p.ingredient.ar)} · {p.sku}</Text>
          <Text>{formatMoney(p.pricePiastres, locale)} · {t('partner.availablePacks')}: {p.availablePacks}</Text>
        </Card>
      )) : null}
      {tab === 'products' && branchId ? (
        <>
          <Text variant="title" role="header">{t('partner.addProduct')}</Text>
          <Text variant="label">{t('partner.ingredient')}</Text>
          <Row wrap>
            {ingredients.map((i) => <Chip key={i.id} label={pickLocalized(locale, i.name.en, i.name.ar)} selected={form.ingredientId === i.id} onToggle={() => setForm({ ...form, ingredientId: i.id })} />)}
          </Row>
          {errors.ingredient ? <Text tone="danger" variant="caption">{errors.ingredient}</Text> : null}
          <Text variant="label">{t('partner.category')}</Text>
          <Row wrap>
            {categories.map((c) => <Chip key={c.id} label={pickLocalized(locale, c.label.en, c.label.ar)} selected={form.categoryId === c.id} onToggle={() => setForm({ ...form, categoryId: c.id })} />)}
          </Row>
          {errors.category ? <Text tone="danger" variant="caption">{errors.category}</Text> : null}
          <TextField label={t('partner.sku')} value={form.sku} onChangeText={(v) => setForm({ ...form, sku: v })} autoCapitalize="none" error={errors.sku} testID="sku" />
          <TextField label={t('partner.packQuantity', { unit })} value={form.pack} onChangeText={(v) => setForm({ ...form, pack: v })} keyboardType="numeric" error={errors.pack} testID="pack" />
          <TextField label={t('partner.priceEgp')} value={form.price} onChangeText={(v) => setForm({ ...form, price: v })} keyboardType="decimal-pad" error={errors.price} testID="price" />
          <TextField label={t('partner.availablePacks')} value={form.stock} onChangeText={(v) => setForm({ ...form, stock: v })} keyboardType="numeric" error={errors.stock} testID="stock" />
          {submitError ? <Notice tone="danger">{submitError}</Notice> : null}
          <Button label={t('partner.addProduct')} onPress={publish} testID="publish-product" />
        </>
      ) : null}
    </Screen>
  );
}
