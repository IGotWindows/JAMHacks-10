import { FaceDetector, FilesetResolver } from 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/+esm';

let faceDetector;
let video;
let canvas;
let ctx;
let animationId;

let lastTimestamp = null;
let facePresentTime = 0;
let totalElapsedTime = 0;
let framesWithFace = 0;
let framesLooking = 0;
let prevCenter = null;
let movementEMA = 0;
let faceSizeEMA = 0;
const emaAlpha = 0.15;

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
    return { x: b.originX, y: b.originY, w: b.width, h: b.height, normalized: true };
  }
  if ('xMin' in b && 'xMax' in b && 'yMin' in b && 'yMax' in b) {
    return { x: b.xMin, y: b.yMin, w: b.xMax - b.xMin, h: b.yMax - b.yMin, normalized: true };
  }
  if ('left' in b && 'top' in b && 'width' in b && 'height' in b) {
    return { x: b.left, y: b.top, w: b.width, h: b.height, normalized: false };
  }
  return null;
}

function drawDetections(detections) {
  if (!ctx || !canvas) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const W = canvas.width;
  const H = canvas.height;

  for (const det of detections) {
    const bb = _parseBoundingBox(det);
    if (!bb) continue;

    let px, py, pw, ph;
    if (bb.normalized) {
      px = bb.x * W;
      py = bb.y * H;
      pw = bb.w * W;
      ph = bb.h * H;
    } else {
      const scaleX = W / (video.videoWidth || W);
      const scaleY = H / (video.videoHeight || H);
      px = bb.x * scaleX;
      py = bb.y * scaleY;
      pw = bb.w * scaleX;
      ph = bb.h * scaleY;
    }

    // Bounding box
    ctx.strokeStyle = '#22d3ee';
    ctx.lineWidth = 2;
    ctx.strokeRect(px, py, pw, ph);

    // Score label
    const score = det.categories?.[0]?.score ?? det.score ?? null;
    if (score !== null) {
      const label = `${Math.round(score * 100)}%`;
      ctx.font = 'bold 13px system-ui, sans-serif';
      ctx.fillStyle = '#22d3ee';
      ctx.fillText(label, px + 4, py > 16 ? py - 4 : py + 14);
    }

    // Keypoints
    const kps = det.keypoints || det.landmarks || [];
    for (const kp of kps) {
      const kx = (kp.x ?? kp.px ?? 0) * W;
      const ky = (kp.y ?? kp.py ?? 0) * H;
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
  const status = document.getElementById('status');

  if (!faceDetector) {
    status.textContent = 'Loading face detector…';
    try {
      await initFaceDetector();
    } catch (err) {
      status.textContent = 'Failed to load face detector';
      console.error(err);
      return;
    }
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } });
    video.srcObject = stream;
    status.textContent = 'Camera on – face detection active';
    video.onloadedmetadata = () => {
      video.play();
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      lastTimestamp = performance.now();
      detectLoop();
      statsUpdateLoop();
    };
  } catch (err) {
    status.textContent = 'Camera permission denied';
    console.error(err);
  }
}

async function detectLoop() {
  if (!video || !faceDetector || !video.srcObject) return;

  const now = performance.now();
  const dt = lastTimestamp ? (now - lastTimestamp) / 1000 : 0;
  lastTimestamp = now;
  totalElapsedTime += dt;

  let hadFace = false;
  try {
    const results = await faceDetector.detectForVideo(video, now);
    const detections = results?.detections ?? [];

    if (detections.length > 0) {
      hadFace = true;
      framesWithFace += 1;

      let best = detections[0];
      let bestArea = 0;
      for (const d of detections) {
        const bb = _parseBoundingBox(d) || {};
        const area = (bb.w || 0) * (bb.h || 0);
        if (area > bestArea) { bestArea = area; best = d; }
      }

      const bb = _parseBoundingBox(best);
      if (bb) {
        const nx = bb.normalized ? bb.x : bb.x / video.videoWidth;
        const ny = bb.normalized ? bb.y : bb.y / video.videoHeight;
        const nw = bb.normalized ? bb.w : bb.w / video.videoWidth;
        const nh = bb.normalized ? bb.h : bb.h / video.videoHeight;
        const cx = nx + nw / 2;
        const cy = ny + nh / 2;

        const centerThreshold = 0.20;
        if (Math.abs(cx - 0.5) < centerThreshold && Math.abs(cy - 0.5) < centerThreshold * 1.2) {
          framesLooking += 1;
        }

        if (prevCenter) {
          const dx = cx - prevCenter.x;
          const dy = cy - prevCenter.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          movementEMA = movementEMA ? movementEMA * (1 - emaAlpha) + dist * emaAlpha : dist;
        }
        prevCenter = { x: cx, y: cy };

        const faceArea = nw * nh;
        faceSizeEMA = faceSizeEMA ? faceSizeEMA * (1 - emaAlpha) + faceArea * emaAlpha : faceArea;
      }

      drawDetections(detections);
    } else {
      if (ctx && canvas) ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  } catch (err) {
    console.error('detection error', err);
  }

  if (hadFace) {
    facePresentTime += dt;
    document.getElementById('status').textContent = 'Face detected';
  } else {
    document.getElementById('status').textContent = 'No face detected – stay focused!';
  }

  animationId = requestAnimationFrame(detectLoop);
}

function statsUpdateLoop() {
  const elLooking = document.getElementById('stat-looking');
  const elFaceSeconds = document.getElementById('stat-face-seconds');
  const elFaceSize = document.getElementById('stat-face-size');
  const elMovement = document.getElementById('stat-movement');
  const elFocus = document.getElementById('stat-focus-score');

  const update = () => {
    if (elFaceSeconds) elFaceSeconds.textContent = `${Math.round(facePresentTime)}s`;
    if (elFaceSize) elFaceSize.textContent = `${Math.round((faceSizeEMA || 0) * 100)}%`;
    if (elMovement) elMovement.textContent = `${Number((movementEMA || 0).toFixed(3))}`;
    if (elLooking) {
      const ratio = framesWithFace ? framesLooking / framesWithFace : 0;
      elLooking.textContent = ratio > 0.5 ? 'Yes' : 'No';
    }
    if (elFocus) {
      const presenceScore = Math.min(1, facePresentTime / Math.max(1, totalElapsedTime));
      const sizeScore = Math.min(1, (faceSizeEMA || 0) / 0.12);
      const stabilityScore = 1 - Math.min(1, movementEMA * 6);
      const lookingRatio = framesWithFace ? framesLooking / framesWithFace : 0;
      const score = Math.round(100 * (0.4 * presenceScore + 0.4 * lookingRatio + 0.2 * (0.5 * sizeScore + 0.5 * stabilityScore)));
      elFocus.textContent = `${score}`;
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
  document.getElementById('status').textContent = 'Camera off';
  lastTimestamp = null;
  facePresentTime = 0;
  totalElapsedTime = 0;
  framesWithFace = 0;
  framesLooking = 0;
  prevCenter = null;
  movementEMA = 0;
  faceSizeEMA = 0;
}

// Timer
let timerInterval;
let totalSeconds = 25 * 60;

function startTimer() {
  if (timerInterval) return;
  timerInterval = setInterval(() => {
    if (totalSeconds <= 0) {
      clearInterval(timerInterval);
      timerInterval = null;
      alert('Session complete!');
      return;
    }
    totalSeconds--;
    updateTimerDisplay();
  }, 1000);
}

function resetTimer() {
  clearInterval(timerInterval);
  timerInterval = null;
  totalSeconds = 25 * 60;
  updateTimerDisplay();
}

function updateTimerDisplay() {
  const el = document.getElementById('timer');
  if (el) {
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    el.textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
}

// Expose for onclick handlers in HTML (modules don't share window scope automatically)
window.startCamera = startCamera;
window.closeCamera = closeCamera;
window.startTimer = startTimer;
window.resetTimer = resetTimer;

document.addEventListener('DOMContentLoaded', updateTimerDisplay);
