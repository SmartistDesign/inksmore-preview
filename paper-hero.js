(() => {
  'use strict';

  const root = document.querySelector('.paper-hero');
  if (!root) return;

  const scene = root.querySelector('.paper-scene');
  const ink = root.querySelector('.paper-ink');
  const countInk = root.querySelector('.ink-count');
  const steps = [...root.querySelectorAll('[data-paper-step]')];
  const playControl = root.querySelector('[data-paper-play]');
  const playLabel = playControl?.querySelector('[data-paper-play-label]');
  const caption = root.querySelector('[data-paper-caption]');
  const announcement = root.querySelector('[data-paper-announcement]');
  const motionQuery = matchMedia('(prefers-reduced-motion: reduce)');
  const pointerQuery = matchMedia('(hover: hover) and (pointer: fine)');
  const captions = [
    'A small mark. A place to begin.',
    'One idea connects to another.',
    'A learning path, all their own.'
  ];
  const names = ['Count', 'Connect', 'Grow'];
  const interval = 3000;

  let step = 0;
  let state = motionQuery.matches ? 'paused' : 'playing';
  let remaining = interval;
  let timeout = null;
  let startedAt = 0;
  let inView = !('IntersectionObserver' in window);
  let windowActive = true;
  let frame = null;
  let sceneX = 0;
  let sceneY = 0;
  let explicitVisualPause = false;
  const pausedVisuals = new Set();

  function updateControls() {
    root.dataset.playState = state;
    root.dataset.reducedMotion = String(motionQuery.matches);
    if (!playControl) return;
    const label = state === 'finished' ? 'Replay animation'
      : state === 'playing' ? 'Pause animation' : 'Play animation';
    playControl.disabled = motionQuery.matches;
    playControl.setAttribute('aria-label', label);
    playControl.setAttribute('title', label);
    if (playLabel) playLabel.textContent = label;
    else playControl.textContent = label;
  }

  function showStep(next, announce = false) {
    step = next;
    root.dataset.step = String(step);
    steps.forEach(button => {
      button.setAttribute('aria-pressed', String(Number(button.dataset.paperStep) === step));
    });
    if (caption) caption.textContent = captions[step];
    if (announcement) announcement.textContent = announce ? `${names[step]}. ${captions[step]}` : '';
  }

  // Keep only the unspent part of a stage when the scene becomes unavailable.
  function suspendTimer() {
    if (timeout === null) return;
    clearTimeout(timeout);
    timeout = null;
    remaining = Math.max(0, remaining - (performance.now() - startedAt));
  }

  function canAnimate() {
    return state === 'playing' && !motionQuery.matches && inView
      && !document.hidden && windowActive;
  }

  function inkAnimations(element) {
    return element?.getAnimations ? element.getAnimations({ subtree: true }) : [];
  }

  function syncVisualMotion() {
    const visible = inView && !document.hidden && windowActive;
    const allowMotion = visible && !explicitVisualPause && !motionQuery.matches;
    if (allowMotion) {
      pausedVisuals.forEach(animation => {
        if (animation.playState === 'paused') animation.play();
      });
      pausedVisuals.clear();
    } else {
      inkAnimations(ink).forEach(animation => {
        if (animation.playState === 'running') {
          animation.pause();
          pausedVisuals.add(animation);
        }
      });
    }
  }

  function finishCountDrawing() {
    inkAnimations(countInk).forEach(animation => {
      const end = animation.effect?.getComputedTiming().endTime;
      if (!Number.isFinite(end)) return;
      animation.finish();
      pausedVisuals.delete(animation);
    });
  }

  function replayCountDrawing() {
    inkAnimations(countInk).forEach(animation => {
      animation.currentTime = 0;
      animation.play();
      pausedVisuals.delete(animation);
    });
  }

  function schedule() {
    if (!canAnimate() || timeout !== null) return;
    startedAt = performance.now();
    timeout = setTimeout(() => {
      timeout = null;
      if (!canAnimate()) {
        remaining = 0;
        return;
      }
      remaining = interval;
      if (step < captions.length - 1) {
        showStep(step + 1);
        syncVisualMotion();
        schedule();
      } else {
        state = 'finished';
        updateControls();
      }
    }, remaining);
  }

  function reconcileTimer() {
    syncVisualMotion();
    if (canAnimate()) schedule();
    else suspendTimer();
  }

  steps.forEach(button => {
    button.addEventListener('click', () => {
      const next = Number(button.dataset.paperStep);
      if (!Number.isInteger(next) || next < 0 || next >= captions.length) return;
      suspendTimer();
      state = next === captions.length - 1 ? 'finished' : 'paused';
      explicitVisualPause = false;
      remaining = interval;
      finishCountDrawing();
      showStep(next, true);
      updateControls();
      reconcileTimer();
    });
  });

  playControl?.addEventListener('click', () => {
    if (motionQuery.matches) return;
    if (state === 'playing') {
      suspendTimer();
      state = 'paused';
      explicitVisualPause = true;
    } else {
      explicitVisualPause = false;
      if (state === 'finished') {
        remaining = interval;
        showStep(0);
        replayCountDrawing();
      }
      state = 'playing';
    }
    updateControls();
    reconcileTimer();
  });

  function paintPosition() {
    frame = null;
    if (!scene) return;
    scene.style.setProperty('--scene-x', `${sceneX.toFixed(2)}px`);
    scene.style.setProperty('--scene-y', `${sceneY.toFixed(2)}px`);
  }

  function queuePosition(x, y) {
    sceneX = Math.max(-2, Math.min(2, x));
    sceneY = Math.max(-2, Math.min(2, y));
    if (frame === null) frame = requestAnimationFrame(paintPosition);
  }

  function resetPosition() {
    if (frame !== null) cancelAnimationFrame(frame);
    frame = null;
    sceneX = 0;
    sceneY = 0;
    paintPosition();
  }

  scene?.addEventListener('pointermove', event => {
    if (motionQuery.matches || !pointerQuery.matches || event.pointerType === 'touch') return;
    const bounds = scene.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;
    queuePosition(
      ((event.clientX - bounds.left) / bounds.width - 0.5) * 4,
      ((event.clientY - bounds.top) / bounds.height - 0.5) * 4
    );
  });
  scene?.addEventListener('pointerleave', resetPosition);
  scene?.addEventListener('pointercancel', resetPosition);

  motionQuery.addEventListener('change', () => {
    suspendTimer();
    resetPosition();
    // Turning motion off is an explicit preference; turning it back on does
    // not restart an animation the visitor may already have chosen to stop.
    if (motionQuery.matches && state === 'playing') state = 'paused';
    updateControls();
    reconcileTimer();
  });
  pointerQuery.addEventListener('change', resetPosition);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) resetPosition();
    reconcileTimer();
  });
  window.addEventListener('blur', () => {
    windowActive = false;
    reconcileTimer();
    resetPosition();
  });
  window.addEventListener('focus', () => {
    windowActive = true;
    reconcileTimer();
  });

  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => {
      inView = entries[0].isIntersecting && entries[0].intersectionRatio >= 0.45;
      if (!inView) resetPosition();
      reconcileTimer();
    }, { threshold: 0.45 });
    observer.observe(scene || root);
  }

  showStep(0);
  updateControls();
  reconcileTimer();
})();
