import type { ReactNode } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, Text as RNText, TextInput, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { useLocale } from './LocaleContext';
import { fonts, minTouchTarget, radius, space, type as typeScale, type TypeVariant } from './tokens';

/** react-native-web adds focus/hover to the Pressable state; native provides only `pressed`. */
type WebPressState = { pressed: boolean; focused?: boolean; hovered?: boolean };

const STRONG: TypeVariant[] = ['label', 'title', 'price', 'priceLarge'];

/** Font family per brand spec: Readex Pro for display/headings, IBM Plex (Arabic or Latin) for UI. */
export function fontFor(variant: TypeVariant, locale: 'en' | 'ar', strong = false): TextStyle {
  if (variant === 'display') return { fontFamily: fonts.display };
  if (variant === 'heading') return { fontFamily: fonts.heading };
  if (variant === 'price' || variant === 'priceLarge') return { fontFamily: fonts.bodyEnStrong, fontVariant: ['tabular-nums'] };
  const isStrong = strong || STRONG.includes(variant);
  if (locale === 'ar') return { fontFamily: isStrong ? fonts.bodyArStrong : fonts.bodyAr };
  return { fontFamily: isStrong ? fonts.bodyEnStrong : fonts.bodyEn };
}

function scale(variant: TypeVariant, locale: 'en' | 'ar'): TextStyle {
  const s = typeScale[variant];
  return { fontSize: s.fontSize, lineHeight: locale === 'ar' ? s.arLineHeight : s.lineHeight };
}

export type Tone = 'danger' | 'warning' | 'success' | 'pending' | 'info' | 'accent';

/** Text with OS font scaling (large text), brand fonts and token colours. */
export function Text(props: {
  children: ReactNode; variant?: TypeVariant; muted?: boolean; strong?: boolean; style?: StyleProp<TextStyle>;
  role?: 'header'; testID?: string; tone?: Tone; numberOfLines?: number;
}) {
  const { colors, locale } = useLocale();
  const variant = props.variant ?? 'body';
  const color = props.tone ? colors[props.tone] : props.muted ? colors.textMuted : colors.text;
  return (
    <RNText
      allowFontScaling
      testID={props.testID}
      accessibilityRole={props.role}
      numberOfLines={props.numberOfLines}
      style={[scale(variant, locale), fontFor(variant, locale, props.strong), { color, textAlign: 'auto' }, props.style]}
    >
      {props.children}
    </RNText>
  );
}

export function Screen(props: { children: ReactNode; scroll?: boolean; testID?: string; header?: ReactNode }) {
  const { colors } = useLocale();
  const style: ViewStyle = { padding: space.lg, gap: space.lg, backgroundColor: colors.background, flexGrow: 1 };
  if (props.scroll === false) return <View style={[style, { flex: 1 }]} testID={props.testID}>{props.header}{props.children}</View>;
  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={{ flexGrow: 1 }} testID={props.testID} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
      {props.header}
      <View style={[style, { maxWidth: 960, width: '100%', alignSelf: 'center' }]}>{props.children}</View>
    </ScrollView>
  );
}

export type ButtonVariant = 'primary' | 'secondary' | 'tertiary' | 'destructive';

/** Brand buttons: height 48, radius 12, label 16/600 sentence case. Loading keeps the label and blocks a second tap. */
export function Button(props: {
  label: string; onPress: () => void; disabled?: boolean; loading?: boolean; variant?: ButtonVariant;
  accessibilityHint?: string; accessibilityLabel?: string; testID?: string; icon?: ReactNode;
}) {
  const { colors, locale } = useLocale();
  const v = props.variant ?? 'primary';
  const disabled = props.disabled || props.loading;
  const bg = v === 'primary' ? colors.accent : v === 'destructive' ? colors.danger : v === 'secondary' ? colors.surface : 'transparent';
  const fg = v === 'primary' || v === 'destructive' ? colors.onAccent : v === 'tertiary' ? colors.accent : colors.text;
  const border = v === 'secondary' ? colors.ink : bg;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={props.accessibilityLabel ?? props.label}
      accessibilityState={{ disabled: !!disabled, busy: !!props.loading }}
      accessibilityHint={props.accessibilityHint}
      aria-disabled={!!disabled}
      disabled={disabled}
      onPress={props.onPress}
      testID={props.testID}
      style={(state) => {
        const { pressed, focused } = state as WebPressState;
        return {
          minHeight: minTouchTarget, paddingHorizontal: space.lg, paddingVertical: space.sm, borderRadius: radius.md,
          alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: space.sm,
          backgroundColor: bg, borderWidth: v === 'secondary' ? 1.5 : 2,
          borderColor: focused ? colors.focus : border,
          opacity: disabled ? 0.5 : pressed ? 0.85 : 1,
          ...(focused && Platform.OS === 'web' ? { outlineStyle: 'solid', outlineWidth: 2, outlineColor: colors.focus, outlineOffset: 2 } : {}),
        } as ViewStyle;
      }}
    >
      {props.loading ? <ActivityIndicator color={fg} /> : props.icon ?? null}
      <RNText allowFontScaling style={[scale('label', locale), fontFor('label', locale), { color: fg }]}>{props.label}</RNText>
    </Pressable>
  );
}

export function Card(props: { children: ReactNode; onPress?: () => void; accessibilityLabel?: string; testID?: string; style?: StyleProp<ViewStyle>; selected?: boolean }) {
  const { colors, scheme } = useLocale();
  const base: ViewStyle = {
    backgroundColor: colors.surface, borderRadius: radius.lg, padding: space.lg, gap: space.sm,
    borderWidth: props.selected ? 2 : 1, borderColor: props.selected ? colors.accent : scheme === 'light' ? 'rgba(42,28,23,0.08)' : colors.border,
    ...(scheme === 'light' ? { shadowColor: '#2A1C17', shadowOpacity: 0.08, shadowRadius: 2, shadowOffset: { width: 0, height: 1 }, elevation: 1 } : {}),
  };
  if (!props.onPress) return <View style={[base, props.style]} testID={props.testID}>{props.children}</View>;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={props.accessibilityLabel}
      accessibilityState={props.selected !== undefined ? { selected: props.selected } : undefined}
      onPress={props.onPress}
      testID={props.testID}
      style={(state) => [base, { minHeight: minTouchTarget }, (state as WebPressState).focused ? { borderColor: colors.focus, borderWidth: 2 } : null, props.style]}
    >
      {props.children}
    </Pressable>
  );
}

/** Filter chip: outline; selected fills Hibiscus 100 with Hibiscus 700 text and a ✓ (never colour alone). */
export function Chip(props: { label: string; selected: boolean; onToggle: () => void; count?: number; disabled?: boolean; testID?: string }) {
  const { colors, locale } = useLocale();
  const text = `${props.selected ? '✓ ' : ''}${props.label}${props.count !== undefined ? ` (${props.count})` : ''}`;
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: props.selected, disabled: !!props.disabled }}
      aria-checked={props.selected}
      disabled={props.disabled}
      onPress={props.onToggle}
      testID={props.testID}
      hitSlop={6}
      style={(state) => {
        const { focused } = state as WebPressState;
        return {
          minHeight: 40, paddingHorizontal: space.md, justifyContent: 'center', borderRadius: radius.md,
          borderWidth: focused ? 2 : 1, borderColor: focused ? colors.focus : props.selected ? colors.accent : colors.border,
          backgroundColor: props.selected ? colors.accentSoft : colors.surface, opacity: props.disabled ? 0.5 : 1,
        };
      }}
    >
      <RNText allowFontScaling style={[scale('caption', locale), fontFor('caption', locale, props.selected), { color: props.selected ? colors.accent : colors.text }]}>{text}</RNText>
    </Pressable>
  );
}

export function Row(props: { children: ReactNode; wrap?: boolean; gap?: number; style?: StyleProp<ViewStyle> }) {
  return <View style={[{ flexDirection: 'row', flexWrap: props.wrap ? 'wrap' : 'nowrap', gap: props.gap ?? space.sm, alignItems: 'center' }, props.style]}>{props.children}</View>;
}

export function Notice(props: { children: ReactNode; tone?: 'info' | 'warning' | 'danger' | 'success'; testID?: string }) {
  const { colors } = useLocale();
  const tone = props.tone ?? 'info';
  const surface = { info: colors.infoSurface, warning: colors.warningSurface, danger: colors.dangerSurface, success: colors.successSurface }[tone];
  const fg = { info: 'info', warning: 'warning', danger: 'danger', success: 'success' }[tone] as Tone;
  return (
    <View
      accessibilityRole={tone === 'info' || tone === 'success' ? 'summary' : 'alert'}
      testID={props.testID}
      style={{ padding: space.md, borderRadius: radius.md, backgroundColor: surface }}
    >
      <Text tone={fg}>{props.children}</Text>
    </View>
  );
}

export type Status = 'confirmed' | 'pending' | 'progress' | 'failed';

/** Status badge: icon + word, never colour alone. Pending never uses success colours or a check. */
export function StatusBadge(props: { status: Status; label: string; testID?: string }) {
  const { colors, locale } = useLocale();
  const map = {
    confirmed: { fg: colors.success, bg: colors.successSurface, icon: '✓' },
    pending: { fg: colors.pending, bg: colors.pendingSurface, icon: '⧗' },
    progress: { fg: colors.info, bg: colors.infoSurface, icon: '•' },
    failed: { fg: colors.danger, bg: colors.dangerSurface, icon: '✕' },
  }[props.status];
  return (
    <View testID={props.testID} accessibilityLabel={props.label}
      style={{ alignSelf: 'flex-start', flexDirection: 'row', gap: space.xs, paddingHorizontal: space.sm, paddingVertical: 2, borderRadius: radius.xs, backgroundColor: map.bg }}>
      <RNText allowFontScaling importantForAccessibility="no" style={[scale('caption', locale), { color: map.fg }]}>{map.icon}</RNText>
      <RNText allowFontScaling style={[scale('caption', locale), fontFor('caption', locale, true), { color: map.fg }]}>{props.label}</RNText>
    </View>
  );
}

export function LoadingState(props: { testID?: string }) {
  const { t, colors } = useLocale();
  return (
    <View accessibilityRole="progressbar" accessibilityLabel={t('common.loading')} style={{ padding: space.xl, alignItems: 'center', gap: space.sm }} testID={props.testID ?? 'loading'}>
      <ActivityIndicator color={colors.accent} />
      <Text muted>{t('common.loading')}</Text>
    </View>
  );
}

export function EmptyState(props: { message: string; actionLabel?: string; onAction?: () => void; testID?: string; art?: ReactNode }) {
  return (
    <View style={{ padding: space.xl, gap: space.md, alignItems: 'center' }} testID={props.testID ?? 'empty-state'}>
      {props.art ?? null}
      <Text muted style={{ textAlign: 'center' }}>{props.message}</Text>
      {props.actionLabel && props.onAction ? <Button variant="secondary" label={props.actionLabel} onPress={props.onAction} /> : null}
    </View>
  );
}

/** Errors are never hidden behind an endless skeleton; retry keeps the user's choices. */
export function ErrorState(props: { message: string; onRetry?: () => void; testID?: string }) {
  const { t } = useLocale();
  return (
    <View style={{ padding: space.xl, gap: space.md, alignItems: 'center' }} testID={props.testID ?? 'error-state'}>
      <Notice tone="danger">{props.message}</Notice>
      {props.onRetry ? <Button variant="secondary" label={t('common.retry')} onPress={props.onRetry} /> : null}
    </View>
  );
}

/** Labelled input: 48px, white, Sesame border, label above (never placeholder-only), error below. */
export function TextField(props: {
  label: string; value: string; onChangeText: (v: string) => void; error?: string | null; hint?: string;
  multiline?: boolean; keyboardType?: 'default' | 'numeric' | 'decimal-pad' | 'phone-pad' | 'email-address'; testID?: string;
  autoCapitalize?: 'none' | 'sentences'; secureTextEntry?: boolean; ltr?: boolean;
}) {
  const { colors, locale } = useLocale();
  return (
    <View style={{ gap: space.xs }}>
      <Text variant="label">{props.label}</Text>
      {props.hint ? <Text variant="caption" muted>{props.hint}</Text> : null}
      <TextInput
        accessibilityLabel={props.label}
        accessibilityHint={props.hint}
        aria-invalid={!!props.error}
        value={props.value}
        onChangeText={props.onChangeText}
        multiline={props.multiline}
        keyboardType={props.keyboardType ?? 'default'}
        autoCapitalize={props.autoCapitalize ?? 'sentences'}
        secureTextEntry={props.secureTextEntry}
        allowFontScaling
        testID={props.testID}
        style={[scale('bodyLarge', locale), fontFor('body', locale), {
          minHeight: minTouchTarget, borderWidth: 1, borderRadius: radius.sm, paddingHorizontal: space.md, paddingVertical: space.sm,
          borderColor: props.error ? colors.danger : colors.border, color: colors.text, backgroundColor: colors.surface,
          textAlign: props.ltr ? 'left' : 'auto', writingDirection: props.ltr ? 'ltr' : 'auto',
        } as TextStyle]}
      />
      {props.error ? <Text variant="caption" tone="danger" testID={props.testID ? `${props.testID}-error` : undefined}>{`⚠ ${props.error}`}</Text> : null}
    </View>
  );
}

/** Role header strip: the role accent only appears here, on the active nav item and on role chips. */
export function RoleStrip(props: { title: string; strip: string; onStrip: string; right?: ReactNode; testID?: string }) {
  const { locale } = useLocale();
  return (
    <View testID={props.testID} style={{ backgroundColor: props.strip, paddingHorizontal: space.lg, paddingVertical: space.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md }}>
      <RNText accessibilityRole="header" allowFontScaling style={[scale('title', locale), fontFor('heading', locale), { color: props.onStrip }]}>{props.title}</RNText>
      {props.right ?? null}
    </View>
  );
}
