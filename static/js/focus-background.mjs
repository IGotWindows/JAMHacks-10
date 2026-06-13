import {
  createFaceDetector,
  FocusTracker,
  FOCUS_THRESHOLD,
  DEFAULT_VIDEO_W,
  DEFAULT_VIDEO_H,
} from './focus-tracker.mjs';

let running = false;
let video = null;
let faceDetector = null;
let tracker = null;
let intervalId = null;
let starting = false;

function getSessionApi() {
  return window.StudiousFocusSession;
}

function shouldTrack() {
  const api = getSessionApi();
  if (!api) return false;
  const state = api.load();
  return Boolean(state?.active) && !api.isFocusPage();
}

function ensureVideo() {
  if (video) return video;
  video = document.createElement('video');
  video.id = 'focus-bg-video';
  video.autoplay = true;
  video.muted = true;
  video.playsInline = true;
  video.setAttribute('playsinline', '');
  video.width = DEFAULT_VIDEO_W;
  video.height = DEFAULT_VIDEO_H;
  video.className = 'focus-bg-video';
  document.body.appendChild(video);
  return video;
}

function syncFocusedTime(dt, focusScore) {
  const api = getSessionApi();
  if (!api) return;

  const state = api.load();
  if (!state?.active) {
    stopBackgroundFocusTracking();
    return;
  }

  let focusedSeconds = state.focusedSeconds || 0;
  const inZone = focusScore > FOCUS_THRESHOLD;
  if (inZone && dt > 0) {
    focusedSeconds += dt;
  }

  api.save({
    sessionStartedAt: state.sessionStartedAt,
    focusedSeconds,
    isInFocusZone: inZone,
  });
}

async function runTick() {
  if (!running || !faceDetector || !video?.srcObject) return;

  if (!shouldTrack()) {
    stopBackgroundFocusTracking();
    return;
  }

  try {
    if (video.paused) {
      await video.play().catch(() => {});
    }

    const now = performance.now();
    const results = await faceDetector.detectForVideo(video, now);
    const frame = tracker.analyzeFrame(
      results?.detections ?? [],
      video.videoWidth || DEFAULT_VIDEO_W,
      video.videoHeight || DEFAULT_VIDEO_H,
      now
    );
    syncFocusedTime(frame.dt, frame.focusScore);
  } catch (err) {
    console.error('background focus tracking error', err);
  }
}

export async function startBackgroundFocusTracking() {
  if (running || starting) return;
  if (!shouldTrack()) return;

  starting = true;
  try {
    tracker = new FocusTracker();
    faceDetector = await createFaceDetector();
    const cam = ensureVideo();

    const stream = await navigator.mediaDevices.getUserMedia({
      video: { width: DEFAULT_VIDEO_W, height: DEFAULT_VIDEO_H },
    });
    cam.srcObject = stream;
    await cam.play();

    running = true;
    intervalId = window.setInterval(runTick, 200);
    runTick();
  } catch (err) {
    console.error('failed to start background focus tracking', err);
    stopBackgroundFocusTracking();
  } finally {
    starting = false;
  }
}

export function stopBackgroundFocusTracking() {
  running = false;
  starting = false;

  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }

  if (video?.srcObject) {
    video.srcObject.getTracks().forEach((track) => track.stop());
    video.srcObject = null;
  }

  if (video?.parentNode) {
    video.parentNode.removeChild(video);
    video = null;
  }

  tracker = null;
  faceDetector = null;
}

export function refreshBackgroundFocusTracking() {
  if (shouldTrack()) {
    startBackgroundFocusTracking();
  } else {
    stopBackgroundFocusTracking();
  }
}
