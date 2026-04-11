import 'package:flutter/material.dart';

/// Lahloba Animation Constants
/// Consistent, premium micro-animation system.
class AppAnimations {
  AppAnimations._();

  // ── Durations ─────────────────────────────────────────────────
  static const Duration ultraFast = Duration(milliseconds: 100);
  static const Duration fast = Duration(milliseconds: 150);
  static const Duration normal = Duration(milliseconds: 220);
  static const Duration slow = Duration(milliseconds: 350);
  static const Duration verySlow = Duration(milliseconds: 500);

  // Page transition
  static const Duration pageTransition = Duration(milliseconds: 280);
  // Skeleton shimmer
  static const Duration shimmer = Duration(milliseconds: 1200);
  // Card press/scale
  static const Duration press = Duration(milliseconds: 80);

  // ── Curves ───────────────────────────────────────────────────
  static const Curve standard = Curves.easeOutCubic;
  static const Curve decelerate = Curves.easeOutQuart;
  static const Curve spring = Curves.elasticOut;
  static const Curve emphasizedDecelerate = Curves.easeOutQuint;
  static const Curve pressDown = Curves.easeIn;
  static const Curve bounce = Curves.bounceOut;

  // ── Scale values ─────────────────────────────────────────────
  static const double pressScale = 0.96;
  static const double hoverScale = 1.02;
  static const double iconBounce = 1.15;

  // ── Slide offsets ─────────────────────────────────────────────
  static const Offset slideFromBottom = Offset(0, 0.1);
  static const Offset slideFromRight = Offset(0.1, 0);
  static const Offset slideFromLeft = Offset(-0.1, 0);
}

/// Pressable widget — provides scale + opacity feedback on tap.
class PressableWidget extends StatefulWidget {
  final Widget child;
  final VoidCallback? onTap;
  final VoidCallback? onLongPress;
  final double scale;
  final Duration duration;
  final BorderRadius? borderRadius;

  const PressableWidget({
    super.key,
    required this.child,
    this.onTap,
    this.onLongPress,
    this.scale = AppAnimations.pressScale,
    this.duration = AppAnimations.press,
    this.borderRadius,
  });

  @override
  State<PressableWidget> createState() => _PressableWidgetState();
}

class _PressableWidgetState extends State<PressableWidget>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<double> _scaleAnimation;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(vsync: this, duration: widget.duration);
    _scaleAnimation = Tween<double>(begin: 1, end: widget.scale).animate(
      CurvedAnimation(parent: _controller, curve: AppAnimations.pressDown),
    );
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: widget.onTap,
      onLongPress: widget.onLongPress,
      onTapDown: (_) => _controller.forward(),
      onTapUp: (_) => _controller.reverse(),
      onTapCancel: () => _controller.reverse(),
      child: AnimatedBuilder(
        animation: _scaleAnimation,
        builder: (_, child) => Transform.scale(
          scale: _scaleAnimation.value,
          child: child,
        ),
        child: ClipRRect(
          borderRadius: widget.borderRadius ?? BorderRadius.zero,
          child: widget.child,
        ),
      ),
    );
  }
}

/// Fade + slide in widget for list items.
class FadeSlideIn extends StatefulWidget {
  final Widget child;
  final Duration delay;
  final Duration duration;
  final Offset beginOffset;

  const FadeSlideIn({
    super.key,
    required this.child,
    this.delay = Duration.zero,
    this.duration = AppAnimations.slow,
    this.beginOffset = AppAnimations.slideFromBottom,
  });

  @override
  State<FadeSlideIn> createState() => _FadeSlideInState();
}

class _FadeSlideInState extends State<FadeSlideIn>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<double> _opacity;
  late Animation<Offset> _slide;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(vsync: this, duration: widget.duration);
    _opacity = CurvedAnimation(parent: _controller, curve: AppAnimations.standard);
    _slide = Tween<Offset>(begin: widget.beginOffset, end: Offset.zero).animate(
      CurvedAnimation(parent: _controller, curve: AppAnimations.emphasizedDecelerate),
    );
    Future.delayed(widget.delay, () {
      if (mounted) _controller.forward();
    });
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => FadeTransition(
    opacity: _opacity,
    child: SlideTransition(position: _slide, child: widget.child),
  );
}
