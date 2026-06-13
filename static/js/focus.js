import { FaceDetector, FilesetResolver } from 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/+esm';

let faceDetector;
let video;
let canvas;
let ctx;
let animationId;

let lastTimestamp = null;
let facePresentTime = 0;
let prevCenter = null;
let movementEMA = 0;
let faceSizeEMA = 0;
const emaAlpha = 0.15;
const FOCUS_THRESHOLD = 80;
const SAMPLE_WINDOW_SEC = 4;
const DEFAULT_VIDEO_W = 640;
const DEFAULT_VIDEO_H = 480;

let recentSamples = [];
let currentFrameEngaged = false;

let sessionActive = false;
let focusedSeconds = 0;
let currentFocusScore = 0;
let isInFocusZone = false;

function getVideoSize() {
  return {
    vw: video?.videoWidth || DEFAULT_VIDEO_W,
    vh: video?.videoHeight || DEFAULT_VIDEO_H,
  };
}

function hasRecentFace() {
  return recentSamples.some((sample) => sample.hadFace);
}

function findLargestDetection(detections, vw, vh) {
  let best = detections[0];
  let bestArea = 0;
  for (const det of detections) {
    const norm = _normalizeBox(_parseBoundingBox(det), vw, vh);
    const area = norm?.area || 0;
    if (area > bestArea) {
      bestArea = area;
      best = det;
    }
  }
  return best;
}

function setStatus(text) {
  const el = document.getElementById('status');
  if (el) el.textContent = text;
}

async function initFaceDetector() {
  const filesetResolver = await FilesetResolver.forVisionTasks(
    'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm'
  );
  faceDetector = await FaceDetector.createFromOptions(filesetResolver, {
    baseOptions: {
      modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite',
      delegate: 'GPU'
    },
    runningMode: 'VIDEO',
    minDetectionConfidence: 0.5
  });
}

function _parseBoundingBox(det) {
  const b = det.boundingBox || det.box || det.locationData || {};
  if ('originX' in b && 'originY' in b && 'width' in b && 'height' in b) {
    // MediaPipe returns pixel coordinates, not 0–1.
    return { x: b.originX, y: b.originY, w: b.width, h: b.height, normalized: false };
  }
  if ('xMin' in b && 'xMax' in b && 'yMin' in b && 'yMax' in b) {
    return { x: b.xMin, y: b.yMin, w: b.xMax - b.xMin, h: b.yMax - b.yMin, normalized: true };
  }
  if ('left' in b && 'top' in b && 'width' in b && 'height' in b) {
    const normalized = b.width <= 1 && b.height <= 1 && b.left <= 1 && b.top <= 1;
    return { x: b.left, y: b.top, w: b.width, h: b.height, normalized };
  }
  return null;
}

function _normalizeBox(bb, videoWidth, videoHeight) {
  const vw = videoWidth || DEFAULT_VIDEO_W;
  const vh = videoHeight || DEFAULT_VIDEO_H;
  if (!bb) return null;

  if (bb.normalized) {
    return {
      x: bb.x,
      y: bb.y,
      w: bb.w,
      h: bb.h,
      cx: bb.x + bb.w / 2,
      cy: bb.y + bb.h / 2,
      area: bb.w * bb.h,
    };
  }

  const w = bb.w / vw;
  const h = bb.h / vh;
  const x = bb.x / vw;
  const y = bb.y / vh;
  return {
    x,
    y,
    w,
    h,
    cx: x + w / 2,
    cy: y + h / 2,
    area: w * h,
  };
}

function _normalizeKeypoints(keypoints, videoWidth, videoHeight) {
  const vw = videoWidth || DEFAULT_VIDEO_W;
  const vh = videoHeight || DEFAULT_VIDEO_H;
  return keypoints.map((kp) => {
    const rawX = kp.x ?? kp.px ?? 0;
    const rawY = kp.y ?? kp.py ?? 0;
    return {
      x: rawX <= 1 ? rawX : rawX / vw,
      y: rawY <= 1 ? rawY : rawY / vh,
    };
  });
}

function isFacingScreen(detection, videoWidth, videoHeight) {
  const kps = detection.keypoints || detection.landmarks || [];
  if (kps.length < 3) return false;

  const points = _normalizeKeypoints(kps, videoWidth, videoHeight);
  const rightEye = points[0];
  const leftEye = points[1];
  const nose = points[2];

  const eyeDist = Math.hypot(leftEye.x - rightEye.x, leftEye.y - rightEye.y);
  if (eyeDist < 0.02) return false;

  const eyeMidX = (rightEye.x + leftEye.x) / 2;
  const eyeMidY = (rightEye.y + leftEye.y) / 2;
  const yaw = (nose.x - eyeMidX) / eyeDist;
  const pitch = (nose.y - eyeMidY) / eyeDist;

  // Head turned left/right — nose drifts off eye midpoint.
  if (Math.abs(yaw) > 0.26) return false;
  // Looking down at desk or up away from screen.
  if (pitch < 0.32 || pitch > 1.05) return false;

  if (points.length >= 6) {
    const rightEar = points[4];
    const leftEar = points[5];
    const earSpan = Math.hypot(leftEar.x - rightEar.x, leftEar.y - rightEar.y);
    if (earSpan / eyeDist < 1.35) return false;
  }

  return true;
}

function isFaceCentered(norm) {
  return (
    Math.abs(norm.cx - 0.5) < 0.32 &&
    Math.abs(norm.cy - 0.5) < 0.36
  );
}

function pushFocusSample(hadFace, engaged, timestampMs) {
  recentSamples.push({ t: timestampMs, hadFace, engaged });
  const cutoff = timestampMs - SAMPLE_WINDOW_SEC * 1000;
  recentSamples = recentSamples.filter((sample) => sample.t >= cutoff);
}

function getWindowStats() {
  if (recentSamples.length === 0) {
    return { presence: 0, engaged: 0 };
  }

  const withFace = recentSamples.filter((sample) => sample.hadFace);
  const engaged = withFace.filter((sample) => sample.engaged);
  return {
    presence: withFace.length / recentSamples.length,
    engaged: withFace.length ? engaged.length / withFace.length : 0,
  };
}

function _toCanvasRect(bb, videoWidth, videoHeight, canvasWidth, canvasHeight) {
  const norm = _normalizeBox(bb, videoWidth, videoHeight);
  if (!norm) return null;
  return {
    x: norm.x * canvasWidth,
    y: norm.y * canvasHeight,
    w: norm.w * canvasWidth,
    h: norm.h * canvasHeight,
  };
}

function drawDetections(detections, engagedFace) {
  if (!ctx || !canvas || !video) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const vw = video.videoWidth || canvas.width;
  const vh = video.videoHeight || canvas.height;

  for (const det of detections) {
    const bb = _parseBoundingBox(det);
    const rect = _toCanvasRect(bb, vw, vh, canvas.width, canvas.height);
    if (!rect) continue;

    ctx.strokeStyle = engagedFace ? '#4ade80' : '#fbbf24';
    ctx.lineWidth = 2;
    ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);

    const score = det.categories?.[0]?.score ?? det.score ?? null;
    if (score !== null) {
      const label = `${Math.round(score * 100)}%`;
      ctx.font = 'bold 13px system-ui, sans-serif';
      ctx.fillStyle = '#22d3ee';
      ctx.fillText(label, rect.x + 4, rect.y > 16 ? rect.y - 4 : rect.y + 14);
    }

    const kps = det.keypoints || det.landmarks || [];
    for (const kp of kps) {
      const rawX = kp.x ?? kp.px ?? 0;
      const rawY = kp.y ?? kp.py ?? 0;
      const kx = rawX <= 1 ? rawX * canvas.width : (rawX / vw) * canvas.width;
      const ky = rawY <= 1 ? rawY * canvas.height : (rawY / vh) * canvas.height;
      ctx.beginPath();
      ctx.arc(kx, ky, 3, 0, 2 * Math.PI);
      ctx.fillStyle = '#f472b6';
      ctx.fill();
    }
  }
}

async function startCamera() {
  video = document.getElementById('cam');
  canvas = document.getElementById('overlay');
  ctx = canvas.getContext('2d');

  if (!faceDetector) {
    setStatus('Loading face detector…');
    try {
      await initFaceDetector();
    } catch (err) {
      setStatus('Failed to load face detector');
      console.error(err);
      return;
    }
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { width: DEFAULT_VIDEO_W, height: DEFAULT_VIDEO_H },
    });
    video.srcObject = stream;
    setStatus('Camera on – face detection active');
    video.onloadedmetadata = () => {
      video.play();
      canvas.width = video.videoWidth || DEFAULT_VIDEO_W;
      canvas.height = video.videoHeight || DEFAULT_VIDEO_H;
      lastTimestamp = performance.now();
      detectLoop();
      statsUpdateLoop();
    };
  } catch (err) {
    setStatus('Camera permission denied');
    console.error(err);
  }
}

async function detectLoop() {
  if (!video || !faceDetector || !video.srcObject) return;

  const now = performance.now();
  const dt = lastTimestamp ? (now - lastTimestamp) / 1000 : 0;
  lastTimestamp = now;

  let hadFace = false;
  let frameEngaged = false;
  try {
    const results = await faceDetector.detectForVideo(video, now);
    const detections = results?.detections ?? [];

    if (detections.length > 0) {
      hadFace = true;
      const { vw, vh } = getVideoSize();
      const best = findLargestDetection(detections, vw, vh);
      const norm = _normalizeBox(_parseBoundingBox(best), vw, vh);

      if (norm) {
        frameEngaged = isFaceCentered(norm) && isFacingScreen(best, vw, vh);

        if (prevCenter) {
          const dx = norm.cx - prevCenter.x;
          const dy = norm.cy - prevCenter.y;
          const dist = Math.hypot(dx, dy);
          movementEMA = movementEMA ? movementEMA * (1 - emaAlpha) + dist * emaAlpha : dist;
        }
        prevCenter = { x: norm.cx, y: norm.cy };
        faceSizeEMA = faceSizeEMA
          ? faceSizeEMA * (1 - emaAlpha) + norm.area * emaAlpha
          : norm.area;
      }

      drawDetections(detections, frameEngaged);
    } else {
      if (ctx && canvas) ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  } catch (err) {
    console.error('detection error', err);
  }

  currentFrameEngaged = hadFace && frameEngaged;
  pushFocusSample(hadFace, currentFrameEngaged, now);

  if (hadFace) {
    facePresentTime += dt;
    setStatus(
      currentFrameEngaged
        ? 'Locked in — facing the screen'
        : 'Face visible — look back at the screen'
    );
  } else {
    setStatus('No face detected – stay focused!');
  }

  tickFocusedSession(dt);

  animationId = requestAnimationFrame(detectLoop);
}

function computeFocusScore() {
  const { presence, engaged } = getWindowStats();
  const stabilityScore = 1 - Math.min(1, movementEMA * 4);
  const sizeScore = Math.min(1, Math.max(0, (faceSizeEMA - 0.04) / 0.12));

  let score = 100 * (0.2 * presence + 0.6 * engaged + 0.1 * stabilityScore + 0.1 * sizeScore);

  // Drop quickly when you look away right now, not only after the window average catches up.
  if (!currentFrameEngaged) {
    if (!hasRecentFace()) {
      score = 0;
    } else {
      score = Math.min(score, 35 + 25 * presence);
    }
  }

  return Math.round(Math.min(100, Math.max(0, score)));
}

function tickFocusedSession(dt) {
  if (!sessionActive) return;

  currentFocusScore = computeFocusScore();
  if (currentFocusScore > FOCUS_THRESHOLD) {
    focusedSeconds += dt;
    isInFocusZone = true;
  } else {
    isInFocusZone = false;
  }

  updateTimerDisplay();
  updateTimerStatus();
}

function statsUpdateLoop() {
  const elLooking = document.getElementById('stat-looking');
  const elFaceSeconds = document.getElementById('stat-face-seconds');
  const elFaceSize = document.getElementById('stat-face-size');
  const elMovement = document.getElementById('stat-movement');
  const elFocus = document.getElementById('stat-focus-score');

  const update = () => {
    if (elFaceSeconds) elFaceSeconds.textContent = `${Math.round(facePresentTime)}s`;
    if (elFaceSize) {
      const sizePct = Math.min(100, Math.round((faceSizeEMA || 0) * 100));
      elFaceSize.textContent = `${sizePct}%`;
    }
    if (elMovement) elMovement.textContent = `${Number((movementEMA || 0).toFixed(3))}`;
    if (elLooking) {
      const { engaged } = getWindowStats();
      if (!hasRecentFace()) {
        elLooking.textContent = '—';
      } else if (currentFrameEngaged) {
        elLooking.textContent = 'Yes';
      } else {
        elLooking.textContent = engaged >= 0.45 ? 'Mostly' : 'No';
      }
    }
    if (elFocus) {
      currentFocusScore = computeFocusScore();
      elFocus.textContent = `${currentFocusScore}`;
    }
    if (sessionActive && !video?.srcObject) {
      tickFocusedSession(0);
    }
    setTimeout(update, 500);
  };
  update();
}

function closeCamera() {
  if (video && video.srcObject) {
    video.srcObject.getTracks().forEach(t => t.stop());
    video.srcObject = null;
  }
  if (animationId) cancelAnimationFrame(animationId);
  if (ctx && canvas) ctx.clearRect(0, 0, canvas.width, canvas.height);
  setStatus('Camera off');
  lastTimestamp = null;
  facePresentTime = 0;
  recentSamples = [];
  currentFrameEngaged = false;
  prevCenter = null;
  movementEMA = 0;
  faceSizeEMA = 0;
}

// Focus session stopwatch (counts only above FOCUS_THRESHOLD)
function startTimer() {
  if (sessionActive) return;
  sessionActive = true;
  updateTimerDisplay();
  updateTimerStatus();
}

function resetTimer() {
  sessionActive = false;
  focusedSeconds = 0;
  isInFocusZone = false;
  updateTimerDisplay();
  updateTimerStatus();
}

function updateTimerDisplay() {
  const el = document.getElementById('timer');
  if (!el) return;

  const total = Math.floor(focusedSeconds);
  const m = Math.floor(total / 60);
  const s = total % 60;
  el.textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  el.classList.toggle('focus-timer-active', sessionActive && isInFocusZone);
  el.classList.toggle('focus-timer-paused', sessionActive && !isInFocusZone);
}

function updateTimerStatus() {
  const el = document.getElementById('timer-status');
  if (!el) return;

  if (!sessionActive) {
    el.textContent = 'Turn on your webcam, then press Start.';
    return;
  }

  if (!video?.srcObject) {
    el.textContent = 'Camera is off — turn it on to earn focused time.';
    return;
  }

  if (isInFocusZone) {
    el.textContent = `Focused — score ${currentFocusScore} (above ${FOCUS_THRESHOLD}).`;
    return;
  }

  el.textContent = `Paused — score ${currentFocusScore}. Stay on screen to go above ${FOCUS_THRESHOLD}.`;
}

// Expose for onclick handlers in HTML (modules don't share window scope automatically)
window.startCamera = startCamera;
window.closeCamera = closeCamera;
window.startTimer = startTimer;
window.resetTimer = resetTimer;

document.addEventListener('DOMContentLoaded', () => {
  updateTimerDisplay();
  updateTimerStatus();
});
