(function () {
  const DEFAULTS = {
    gradientBackgroundStart: 'rgb(30, 10, 55)',
    gradientBackgroundEnd: 'rgb(12, 4, 32)',
    firstColor: '168, 85, 247',
    secondColor: '139, 92, 246',
    thirdColor: '192, 132, 252',
    fourthColor: '124, 58, 237',
    fifthColor: '217, 70, 239',
    pointerColor: '167, 139, 250',
    size: '80%',
    blendingValue: 'hard-light',
    interactive: true,
  };

  function initBackgroundGradientAnimation(container, options = {}) {
    if (!container) return () => {};

    const config = { ...DEFAULTS, ...options };

    container.style.setProperty('--gradient-background-start', config.gradientBackgroundStart);
    container.style.setProperty('--gradient-background-end', config.gradientBackgroundEnd);
    container.style.setProperty('--first-color', config.firstColor);
    container.style.setProperty('--second-color', config.secondColor);
    container.style.setProperty('--third-color', config.thirdColor);
    container.style.setProperty('--fourth-color', config.fourthColor);
    container.style.setProperty('--fifth-color', config.fifthColor);
    container.style.setProperty('--pointer-color', config.pointerColor);
    container.style.setProperty('--size', config.size);
    container.style.setProperty('--blending-value', config.blendingValue);

    const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
    if (isSafari) {
      container.classList.add('is-safari');
    }

    if (!config.interactive) return () => {};

    const interactive = container.querySelector('.bg-gradient-animation__blob--interactive');
    if (!interactive) return () => {};

    let curX = 0;
    let curY = 0;
    let tgX = 0;
    let tgY = 0;
    let frameId = 0;

    const tick = () => {
      curX += (tgX - curX) / 20;
      curY += (tgY - curY) / 20;
      interactive.style.transform = `translate(${Math.round(curX)}px, ${Math.round(curY)}px)`;
      frameId = requestAnimationFrame(tick);
    };

    const onMouseMove = (event) => {
      tgX = event.clientX - window.innerWidth / 2;
      tgY = event.clientY - window.innerHeight / 2;
    };

    frameId = requestAnimationFrame(tick);
    window.addEventListener('mousemove', onMouseMove);

    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener('mousemove', onMouseMove);
    };
  }

  window.initBackgroundGradientAnimation = initBackgroundGradientAnimation;
})();
