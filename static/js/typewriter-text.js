/**
 * Vanilla port of typewriter-text (React component).
 */
(function () {
  function initTypewriter(element, options = {}) {
    if (!element) return () => {};

    const {
      text,
      speed = 40,
      loop = false,
      deleteSpeed = 25,
      delay = 800,
      onComplete = null,
    } = options;

    const textArray = Array.isArray(text) ? text : [text];
    let textArrayIndex = 0;
    let currentIndex = 0;
    let displayText = '';
    let isDeleting = false;
    let timeoutId = null;

    const currentText = () => textArray[textArrayIndex] || '';

    const tick = () => {
      const target = currentText();
      if (!target) return;

      if (!isDeleting) {
        if (currentIndex < target.length) {
          displayText += target[currentIndex];
          currentIndex += 1;
          element.textContent = displayText;
          timeoutId = window.setTimeout(tick, speed);
          return;
        }

        if (loop) {
          timeoutId = window.setTimeout(() => {
            isDeleting = true;
            tick();
          }, delay);
          return;
        }

        if (typeof onComplete === 'function') onComplete();
        return;
      }

      if (displayText.length > 0) {
        displayText = displayText.slice(0, -1);
        element.textContent = displayText;
        timeoutId = window.setTimeout(tick, deleteSpeed);
        return;
      }

      isDeleting = false;
      currentIndex = 0;
      textArrayIndex = (textArrayIndex + 1) % textArray.length;
      timeoutId = window.setTimeout(tick, speed);
    };

    tick();

    return () => {
      if (timeoutId) window.clearTimeout(timeoutId);
    };
  }

  window.initTypewriter = initTypewriter;
})();
