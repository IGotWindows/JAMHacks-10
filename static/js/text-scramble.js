/**
 * Vanilla port of text-scramble (React + framer-motion component).
 */
(function () {
  const DEFAULT_CHARS =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

  function initTextScramble(element, options = {}) {
    if (!element) return;

    const {
      text = element.textContent?.trim() || '',
      duration = 0.8,
      speed = 0.04,
      characterSet = DEFAULT_CHARS,
      trigger = true,
      onComplete = null,
    } = options;

    if (!trigger || !text) return;

    const steps = Math.max(1, duration / speed);
    let step = 0;
    let isAnimating = false;

    const scramble = () => {
      if (isAnimating) return;
      isAnimating = true;

      const interval = window.setInterval(() => {
        let scrambled = '';
        const progress = step / steps;

        for (let i = 0; i < text.length; i += 1) {
          if (text[i] === ' ') {
            scrambled += ' ';
            continue;
          }

          if (progress * text.length > i) {
            scrambled += text[i];
          } else {
            scrambled +=
              characterSet[Math.floor(Math.random() * characterSet.length)];
          }
        }

        element.textContent = scrambled;
        step += 1;

        if (step > steps) {
          window.clearInterval(interval);
          element.textContent = text;
          isAnimating = false;
          if (typeof onComplete === 'function') onComplete();
        }
      }, speed * 1000);
    };

    scramble();
  }

  window.initTextScramble = initTextScramble;
})();
