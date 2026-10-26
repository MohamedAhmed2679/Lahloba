import { View } from 'react-native';
import { stepServings, type EntryPoint, type ServingRules, type WeightBasis } from '@lahloba/domain';
import { formatMoney, formatQuantity, type Unit } from '@lahloba/i18n';
import { useLocale } from './LocaleContext';
import { Button, Card, Notice, Row, Text } from './primitives';
import { radius, space } from './tokens';
import { BrandArt } from './brand/Brand';

export function ServiceModeCard(props: { entry: EntryPoint; onPress: () => void }) {
  const { t } = useLocale();
  const title = t(`entry.${props.entry}.title` as const);
  const body = t(`entry.${props.entry}.body` as const);
  return (
    <Card onPress={props.onPress} accessibilityLabel={`${title}. ${body}`} testID={`entry-${props.entry}`} style={{ minHeight: 96, flexDirection: 'row', alignItems: 'center', gap: space.lg }}>
      <View style={{ width: 56, height: 56, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' }}>
        <BrandArt name={props.entry} size={44} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="title">{title}</Text>
        <Text muted>{body}</Text>
      </View>
    </Card>
  );
}

export function MoneyText(props: { piastres: number; large?: boolean; testID?: string }) {
  const { locale } = useLocale();
  return <Text variant={props.large ? 'priceLarge' : 'price'} testID={props.testID}>{formatMoney(props.piastres, locale)}</Text>;
}

/** Servings stepper honoring min/max/step. Disabled buttons explain the bound via state. */
export function ServingStepper(props: { value: number; rules: ServingRules; onChange: (n: number) => void }) {
  const { t } = useLocale();
  const down = stepServings(props.value, -1, props.rules);
  const up = stepServings(props.value, 1, props.rules);
  return (
    <View accessibilityRole="adjustable" accessibilityLabel={t('offer.servingsLabel')} accessibilityValue={{ min: props.rules.minServings, max: props.rules.maxServings, now: props.value }} testID="serving-stepper">
      <Row>
        <Button variant="secondary" label="−" accessibilityLabel={t('offer.decrease')} disabled={down === null} onPress={() => down !== null && props.onChange(down)} testID="servings-decrease" />
        <Text variant="label" testID="servings-value">{t('offer.servings', { count: props.value })}</Text>
        <Button variant="secondary" label="+" accessibilityLabel={t('offer.increase')} disabled={up === null} onPress={() => up !== null && props.onChange(up)} testID="servings-increase" />
      </Row>
    </View>
  );
}

export function WeightBasisBadge(props: { basis: WeightBasis }) {
  const { t, colors } = useLocale();
  return (
    <View style={{ alignSelf: 'flex-start', paddingHorizontal: space.sm, paddingVertical: 2, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border }}>
      <Text variant="caption">{t(`offer.weightBasis.${props.basis}` as const)}</Text>
    </View>
  );
}

/** Unknown allergen data is never presented as safe (C07). */
export function AllergenNotice(props: { status: 'DECLARED' | 'UNKNOWN'; allergens: string[] }) {
  const { t } = useLocale();
  if (props.status === 'UNKNOWN') return <Notice tone="warning" testID="allergen-unknown">{t('offer.allergensUnknown')}</Notice>;
  if (props.allergens.length === 0) return <Text variant="caption" muted>{t('offer.allergensNone')}</Text>;
  return <Text variant="caption" tone="warning">{t('offer.allergens', { list: props.allergens.join(', ') })}</Text>;
}

export function IngredientLineView(props: {
  name: string; quantityPerServing: number; unit: Unit; servings: number; weightBasis: WeightBasis; isPantry: boolean;
  allergenDataStatus: 'DECLARED' | 'UNKNOWN'; allergens: string[];
}) {
  const { t, locale } = useLocale();
  const total = props.quantityPerServing * props.servings;
  return (
    <Card testID="ingredient-line">
      <Text variant="label">{props.name}</Text>
      <Text>{t('offer.perServing', { qty: formatQuantity(props.quantityPerServing, props.unit, locale) })}</Text>
      <Text>{t('offer.total', { qty: formatQuantity(total, props.unit, locale), count: props.servings })}</Text>
      <WeightBasisBadge basis={props.weightBasis} />
      {props.isPantry ? <Text variant="caption" muted>{t('offer.pantry')}</Text> : null}
      <AllergenNotice status={props.allergenDataStatus} allergens={props.allergens} />
    </Card>
  );
}

export function LanguageSwitch() {
  const { locale, setLocale, t } = useLocale();
  const next = locale === 'ar' ? 'en' : 'ar';
  return (
    <Button
      variant="secondary"
      label={next === 'ar' ? t('common.switchToArabic') : t('common.switchToEnglish')}
      accessibilityHint={t('common.language')}
      onPress={() => setLocale(next)}
      testID="language-switch"
    />
  );
}

export function IllustrativeBadge(props: { show: boolean }) {
  const { t } = useLocale();
  if (!props.show) return null;
  return <Text variant="caption" tone="warning" testID="illustrative-badge">{t('common.illustrative')}</Text>;
}
