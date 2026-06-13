/**
 * Vanilla port of animated-gradient-background (framer-motion React component).
 * Drives a radial gradient via requestAnimationFrame.
 */
(function () {
  const DEFAULT_COLORS = [
    '#0f0a1a',
    '#2e1065',
    '#7c3aed',
    '#a855f7',
    '#c084fc',
    '#9333ea',
    '#0f0a1a',
  ];
  const DEFAULT_STOPS = [35, 50, 60, 70, 80, 90, 100];

  function initAnimatedGradientBackground(container, options = {}) {
    if (!container) return () => {};

    const {
      startingGap = 125,
      breathing = false,
      gradientColors = DEFAULT_COLORS,
      gradientStops = DEFAULT_STOPS,
      animationSpeed = 0.02,
      breathingRange = 5,
      topOffset = 0,
    } = options;

    if (gradientColors.length !== gradientStops.length) {
      throw new Error(
        `gradientColors and gradientStops must have the same length (${gradientColors.length} vs ${gradientStops.length}).`
      );
    }

    const layer = document.createElement('div');
    layer.className = 'animated-gradient-bg__layer';
    container.appendChild(layer);

    let animationFrame = 0;
    let width = startingGap;
    let directionWidth = 1;

    const animateGradient = () => {
      if (width >= startingGap + breathingRange) directionWidth = -1;
      if (width <= startingGap - breathingRange) directionWidth = 1;
      if (!breathing) directionWidth = 0;

      width += directionWidth * animationSpeed;

      const stopsString = gradientStops
        .map((stop, index) => `${gradientColors[index]} ${stop}%`)
        .join(', ');

      layer.style.background = `radial-gradient(${width}% ${width + topOffset}% at 50% 20%, ${stopsString})`;

      animationFrame = requestAnimationFrame(animateGradient);
    };

    animationFrame = requestAnimationFrame(animateGradient);

    return () => {
      cancelAnimationFrame(animationFrame);
      layer.remove();
    };
  }

  window.initAnimatedGradientBackground = initAnimatedGradientBackground;
})();
