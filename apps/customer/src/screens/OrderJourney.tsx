import { Animated, View } from 'react-native';
import type { OrderDto } from '@lahloba/contracts';
import type { MessageKey } from '@lahloba/i18n';
import { Steam, Text, space, useLocale, useProgress } from '@lahloba/ui';

type Stage = { key: string; label: MessageKey };

/** The real sequence an order goes through; ingredient collection only when shops supply them. */
export function journeyStages(o: Pick<OrderDto, 'source'>): Stage[] {
  return [
    { key: 'paid', label: 'journey.paid' },
    { key: 'accepted', label: 'journey.accepted' },
    ...(o.source === 'SUPPLIERS' ? [{ key: 'ingredients', label: 'journey.ingredients' as MessageKey }] : []),
    { key: 'cooking', label: 'journey.cooking' },
    { key: 'onTheWay', label: 'journey.onTheWay' },
    { key: 'delivered', label: 'journey.delivered' },
  ];
}

/** Index of the stage the order is at now (stages before it are done). */
export function currentStage(o: Pick<OrderDto, 'source' | 'fulfillmentState' | 'fundingState' | 'chefAcceptance'>): number {
  const stages = journeyStages(o).map((s) => s.key);
  const at = (k: string) => stages.indexOf(k);
  switch (o.fulfillmentState) {
    case 'RESERVED':
      if (o.fundingState !== 'FUNDED') return at('paid');
      return o.chefAcceptance === 'ACCEPTED' ? at('accepted') + 1 : at('accepted');
    case 'AWAITING_INGREDIENTS': return at('ingredients');
    case 'READY_TO_PREPARE':
    case 'PREPARING': return at('cooking');
    case 'READY_FOR_PICKUP':
    case 'OUT_FOR_DELIVERY': return at('onTheWay');
    case 'DELIVERED': return stages.length; // all done
    default: return 0;
  }
}

const DOT = 18;
const ROW = 44;

/**
 * Order journey: a rail through the real stages. Completed stages are filled; the rail grows to
 * the current stage when it changes, and while the meal is cooking it steams (the app's one ambient motion).
 */
export function OrderJourney(props: { order: OrderDto; testID?: string }) {
  const { t, colors, dir } = useLocale();
  const side = dir === 'rtl' ? 'right' : 'left';
  const stages = journeyStages(props.order);
  const now = currentStage(props.order);
  const done = Math.min(now, stages.length);
  const fill = useProgress(stages.length > 1 ? Math.min(done, stages.length - 1) / (stages.length - 1) : 0);
  const railHeight = (stages.length - 1) * ROW;
  return (
    <View testID={props.testID} accessibilityRole="list" style={{ paddingVertical: space.sm }}>
      <View style={{ position: 'absolute', top: space.sm + DOT / 2, [side]: DOT / 2 - 1.5, width: 3, height: railHeight, borderRadius: 2, backgroundColor: colors.border }} />
      <Animated.View style={{
        position: 'absolute', top: space.sm + DOT / 2, [side]: DOT / 2 - 1.5, width: 3, borderRadius: 2, backgroundColor: colors.accent,
        height: fill.interpolate({ inputRange: [0, 1], outputRange: [0, railHeight] }),
      }} />
      {stages.map((s, i) => {
        const isDone = i < done;
        const isNow = i === done && done < stages.length;
        const state = isDone ? t('journey.state.done') : isNow ? t('journey.state.now') : t('journey.state.next');
        return (
          <View key={s.key} accessibilityRole="text" accessibilityLabel={`${t(s.label)}: ${state}`} testID={`journey-${s.key}`}
            style={{ height: ROW, flexDirection: 'row', alignItems: 'flex-start', gap: space.md }}>
            <View style={{ width: DOT, height: DOT }}>
              <View style={{
                width: DOT, height: DOT, borderRadius: DOT / 2, borderWidth: 3,
                borderColor: isDone || isNow ? colors.accent : colors.border,
                backgroundColor: isDone ? colors.accent : colors.surface,
              }} />
            </View>
            <Text variant={isNow ? 'label' : 'body'} muted={!isDone && !isNow} style={{ marginTop: -3 }}>{t(s.label)}</Text>
            {isNow && s.key === 'cooking' ? (
              // A small pot with steam: the app's one ambient motion, only while the meal is cooking.
              <View style={{ width: 18, height: 10, marginTop: 6, borderBottomLeftRadius: 7, borderBottomRightRadius: 7, borderTopLeftRadius: 2, borderTopRightRadius: 2, backgroundColor: colors.turmeric }}>
                <Steam color={colors.textMeta} size={18} testID="journey-steam" />
              </View>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}
