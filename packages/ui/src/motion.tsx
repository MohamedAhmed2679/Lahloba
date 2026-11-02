import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AccessibilityInfo, Animated, Easing, Platform, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { motion } from './tokens';

/**
 * Motion for Lahloba. Principles:
 *  - Motion answers a person's action (press, toggle, price change, a code appearing) and shows what changed.
 *  - One ambient moment only: the steam on the order journey's current stage.
 *  - Reduce Motion (OS setting / prefers-reduced-motion) turns every animation into an instant change.
 */

const nativeDriver = Platform.OS !== 'web';

let reducedMotion = false;
const listeners = new Set<(v: boolean) => void>();
function setReduced(v: boolean) { reducedMotion = v; listeners.forEach((l) => l(v)); }
if (Platform.OS === 'web' && typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
  const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
  reducedMotion = mq.matches;
  mq.addEventListener?.('change', (e) => setReduced(e.matches));
} else if (Platform.OS !== 'web') {
  void AccessibilityInfo.isReduceMotionEnabled?.().then(setReduced).catch(() => undefined);
  AccessibilityInfo.addEventListener?.('reduceMotionChanged', setReduced);
}

/** True when the person asked the OS for less motion. */
export function useReducedMotion(): boolean {
  const [v, setV] = useState(reducedMotion);
  useEffect(() => { listeners.add(setV); return () => { listeners.delete(setV); }; }, []);
  return v;
}

/** Haptic tick for confirming actions. Apps register expo-haptics at start-up; web stays silent. */
type HapticKind = 'tap' | 'success' | 'warning';
let haptic: ((k: HapticKind) => void) | null = null;
export function registerHaptics(fn: (k: HapticKind) => void) { haptic = fn; }
export function feedback(kind: HapticKind = 'tap') { try { haptic?.(kind); } catch { /* no haptics on this device */ } }

export const easing = {
  out: Easing.bezier(0.2, 0.8, 0.2, 1),
  inOut: Easing.bezier(0.45, 0, 0.25, 1),
};

/** Spring scale for pressables: compresses to `to` while held, springs back on release. */
export function usePressScale(to = 0.97) {
  const reduced = useReducedMotion();
  const scale = useRef(new Animated.Value(1)).current;
  const go = (v: number) => {
    if (reduced) { scale.setValue(1); return; }
    Animated.spring(scale, { toValue: v, useNativeDriver: nativeDriver, speed: 40, bounciness: v === 1 ? 6 : 0 }).start();
  };
  return { style: { transform: [{ scale }] }, onPressIn: () => go(to), onPressOut: () => go(1) };
}

/** Appears with a short drop and fade. Used for notices and errors that answer an action. */
export function Reveal(props: { children: ReactNode; style?: StyleProp<ViewStyle>; delay?: number; from?: number; testID?: string }) {
  const reduced = useReducedMotion();
  const v = useRef(new Animated.Value(reduced ? 1 : 0)).current;
  useEffect(() => {
    if (reduced) { v.setValue(1); return; }
    Animated.timing(v, { toValue: 1, duration: motion.base, delay: props.delay ?? 0, easing: easing.out, useNativeDriver: nativeDriver }).start();
  }, [reduced, v, props.delay]);
  const from = props.from ?? -6;
  return (
    <Animated.View testID={props.testID} style={[props.style, { opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [from, 0] }) }] }]}>
      {props.children}
    </Animated.View>
  );
}

/**
 * A number that rolls from its previous value to the new one, so a price change is visible.
 * The final text is always exact (formatted by `format`); screen readers get only the final value.
 */
export function RollingNumber(props: { value: number; format: (n: number) => string; style?: StyleProp<TextStyle>; testID?: string; duration?: number; step?: number }) {
  const reduced = useReducedMotion();
  const [shown, setShown] = useState(props.value);
  const prev = useRef(props.value);
  const flash = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const from = prev.current;
    const to = props.value;
    prev.current = to;
    if (from === to) return;
    if (reduced) { setShown(to); return; }
    const anim = new Animated.Value(0);
    // In-between frames move in whole steps (e.g. whole pounds); the last frame is the exact value.
    const step = props.step ?? 1;
    const id = anim.addListener(({ value }) => setShown(Math.round((from + (to - from) * value) / step) * step));
    flash.setValue(1);
    Animated.parallel([
      Animated.timing(anim, { toValue: 1, duration: props.duration ?? motion.slow + 180, easing: easing.out, useNativeDriver: false }),
      Animated.timing(flash, { toValue: 0, duration: motion.slow * 3, easing: easing.inOut, useNativeDriver: false }),
    ]).start(() => { anim.removeListener(id); setShown(to); });
    return () => { anim.removeListener(id); anim.stopAnimation(); };
  }, [props.value, reduced, flash, props.duration, props.step]);
  return (
    <Animated.Text
      allowFontScaling
      testID={props.testID}
      accessibilityLabel={props.format(props.value)}
      style={[props.style, { opacity: flash.interpolate({ inputRange: [0, 1], outputRange: [1, 0.72] }) }]}
    >
      {props.format(shown)}
    </Animated.Text>
  );
}

/** Code digits appear one after another (a new handoff code is visible as new). */
export function CodeReveal(props: { code: string; style?: StyleProp<TextStyle>; testID?: string }) {
  const reduced = useReducedMotion();
  const chars = props.code.split('');
  const vals = useRef(chars.map(() => new Animated.Value(reduced ? 1 : 0))).current;
  useEffect(() => {
    if (reduced) { vals.forEach((v) => v.setValue(1)); return; }
    Animated.stagger(55, vals.map((v) => Animated.timing(v, { toValue: 1, duration: motion.base, easing: easing.out, useNativeDriver: nativeDriver }))).start();
  }, [props.code, reduced, vals]);
  return (
    <View accessible accessibilityLabel={chars.join(' ')} testID={props.testID} style={{ flexDirection: 'row', direction: 'ltr', alignSelf: 'flex-start' }}>
      {chars.map((c, i) => (
        <Animated.Text key={`${i}-${c}`} allowFontScaling importantForAccessibility="no"
          style={[props.style, { opacity: vals[i], transform: [{ translateY: (vals[i] ?? new Animated.Value(1)).interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }] }]}>
          {c}
        </Animated.Text>
      ))}
    </View>
  );
}

/**
 * The single ambient motion: three wisps of steam rising from a pot that is cooking.
 * Slow (2.4 s loop), small, and absent when Reduce Motion is on.
 */
export function Steam(props: { color: string; size?: number; testID?: string }) {
  const reduced = useReducedMotion();
  const size = props.size ?? 18;
  const wisps = useRef([0, 1, 2].map(() => new Animated.Value(0))).current;
  useEffect(() => {
    if (reduced) return;
    const loops = wisps.map((w, i) => Animated.loop(Animated.sequence([
      Animated.delay(i * 700),
      Animated.timing(w, { toValue: 1, duration: 2400, easing: easing.out, useNativeDriver: nativeDriver }),
      Animated.timing(w, { toValue: 0, duration: 0, useNativeDriver: nativeDriver }),
    ])));
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, [reduced, wisps]);
  if (reduced) return null;
  return (
    <View pointerEvents="none" importantForAccessibility="no-hide-descendants" accessibilityElementsHidden testID={props.testID}
      style={{ position: 'absolute', width: size, height: size * 1.4, bottom: '100%', left: 0, flexDirection: 'row', justifyContent: 'space-around' }}>
      {wisps.map((w, i) => (
        <Animated.View key={i} style={{
          width: 3, height: size * 0.6, borderRadius: 2, backgroundColor: props.color,
          opacity: w.interpolate({ inputRange: [0, 0.25, 1], outputRange: [0, 0.9, 0] }),
          transform: [
            { translateY: w.interpolate({ inputRange: [0, 1], outputRange: [size * 0.5, -size * 0.1] }) },
            { translateX: w.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, i === 1 ? -2 : 2, 0] }) },
            { scaleY: w.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1.2] }) },
          ],
        }} />
      ))}
    </View>
  );
}

/** Animates a 0..1 progress value toward `to` (used by the order journey rail). */
export function useProgress(to: number) {
  const reduced = useReducedMotion();
  const v = useRef(new Animated.Value(reduced ? to : 0)).current;
  useEffect(() => {
    if (reduced) { v.setValue(to); return; }
    Animated.timing(v, { toValue: to, duration: 700, easing: easing.inOut, useNativeDriver: false }).start();
  }, [to, reduced, v]);
  return v;
}
