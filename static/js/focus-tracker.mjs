import { FaceDetector, FilesetResolver } from 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/+esm';

export const FOCUS_THRESHOLD = 80;
export const SAMPLE_WINDOW_SEC = 4;
export const DEFAULT_VIDEO_W = 640;
export const DEFAULT_VIDEO_H = 480;

const VISION_WASM = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm';
const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite';

export function parseBoundingBox(det) {
  const b = det.boundingBox || det.box || det.locationData || {};
  if ('originX' in b && 'originY' in b && 'width' in b && 'height' in b) {
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

export function normalizeBox(bb, videoWidth, videoHeight) {
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

function normalizeKeypoints(keypoints, videoWidth, videoHeight) {
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

export function getEngagementState(detection, videoWidth, videoHeight, norm) {
  const kps = detection.keypoints || detection.landmarks || [];
  if (kps.length < 4) {
    return { engaged: false, hint: 'Face visible — look back at the screen' };
  }

  const points = normalizeKeypoints(kps, videoWidth, videoHeight);
  const rightEye = points[0];
  const leftEye = points[1];
  const nose = points[2];
  const mouth = points[3];

  const eyeDist = Math.hypot(leftEye.x - rightEye.x, leftEye.y - rightEye.y);
  if (eyeDist < 0.02) {
    return { engaged: false, hint: 'Face visible — look back at the screen' };
  }

  const eyeMidX = (rightEye.x + leftEye.x) / 2;
  const eyeMidY = (rightEye.y + leftEye.y) / 2;
  const yaw = (nose.x - eyeMidX) / eyeDist;
  const pitch = (nose.y - eyeMidY) / eyeDist;
  const mouthGap = (mouth.y - nose.y) / eyeDist;
  const eyeToNose = nose.y - eyeMidY;
  const noseToMouth = mouth.y - nose.y;
  const faceVerticalRatio = eyeToNose > 0.001 ? noseToMouth / eyeToNose : 0;
  const eyeTilt = Math.atan2(leftEye.y - rightEye.y, leftEye.x - rightEye.x);

  if (Math.abs(yaw) > 0.26) {
    return { engaged: false, hint: 'Face turned — look straight at the screen' };
  }

  if (Math.abs(eyeTilt) > 0.17) {
    return { engaged: false, hint: 'Head tilted — face the screen squarely' };
  }

  if (pitch < 0.44) {
    return { engaged: false, hint: 'Eyes up — look back at the screen' };
  }

  if (pitch > 1.02) {
    return { engaged: false, hint: 'Eyes down — look up at the screen' };
  }

  if (mouthGap < 0.24 || (pitch > 0.90 && faceVerticalRatio < 0.50)) {
    return { engaged: false, hint: 'Head down — put the phone away and look up' };
  }

  if (norm) {
    if (norm.cy < 0.36) {
      return { engaged: false, hint: 'Looking up — lower your gaze to the screen' };
    }
    if (norm.cy > 0.67) {
      return { engaged: false, hint: 'Looking down — raise your eyes to the screen' };
    }
    if (Math.abs(norm.cx - 0.5) > 0.34) {
      return { engaged: false, hint: 'Not centered — face the webcam' };
    }
  }

  if (points.length >= 6) {
    const rightEar = points[4];
    const leftEar = points[5];
    const earSpan = Math.hypot(leftEar.x - rightEar.x, leftEar.y - rightEar.y);
    if (earSpan / eyeDist < 1.38) {
      return { engaged: false, hint: 'Face turned — look straight at the screen' };
    }
  }

  return { engaged: true, hint: 'Locked in — facing the screen' };
}

export function findLargestDetection(detections, vw, vh) {
  let best = detections[0];
  let bestArea = 0;
  for (const det of detections) {
    const norm = normalizeBox(parseBoundingBox(det), vw, vh);
    const area = norm?.area || 0;
    if (area > bestArea) {
      bestArea = area;
      best = det;
    }
  }
  return best;
}

export async function createFaceDetector() {
  const filesetResolver = await FilesetResolver.forVisionTasks(VISION_WASM);
  return FaceDetector.createFromOptions(filesetResolver, {
    baseOptions: {
      modelAssetPath: MODEL_URL,
      delegate: 'GPU',
    },
    runningMode: 'VIDEO',
    minDetectionConfidence: 0.5,
  });
}

export class FocusTracker {
  constructor() {
    this.emaAlpha = 0.15;
    this.recentSamples = [];
    this.prevCenter = null;
    this.movementEMA = 0;
    this.faceSizeEMA = 0;
    this.lastTimestamp = null;
    this.currentFrameEngaged = false;
    this.currentEngagementHint = 'Face visible — look back at the screen';
    this.currentFocusScore = 0;
    this.facePresentTime = 0;
  }

  reset() {
    this.recentSamples = [];
    this.prevCenter = null;
    this.movementEMA = 0;
    this.faceSizeEMA = 0;
    this.lastTimestamp = null;
    this.currentFrameEngaged = false;
    this.currentEngagementHint = 'Face visible — look back at the screen';
    this.currentFocusScore = 0;
    this.facePresentTime = 0;
  }

  hasRecentFace() {
    return this.recentSamples.some((sample) => sample.hadFace);
  }

  pushFocusSample(hadFace, engaged, timestampMs) {
    this.recentSamples.push({ t: timestampMs, hadFace, engaged });
    const cutoff = timestampMs - SAMPLE_WINDOW_SEC * 1000;
    this.recentSamples = this.recentSamples.filter((sample) => sample.t >= cutoff);
  }

  getWindowStats() {
    if (this.recentSamples.length === 0) {
      return { presence: 0, engaged: 0 };
    }

    const withFace = this.recentSamples.filter((sample) => sample.hadFace);
    const engaged = withFace.filter((sample) => sample.engaged);
    return {
      presence: withFace.length / this.recentSamples.length,
      engaged: withFace.length ? engaged.length / withFace.length : 0,
    };
  }

  computeFocusScore() {
    const { presence, engaged } = this.getWindowStats();
    const stabilityScore = 1 - Math.min(1, this.movementEMA * 4);
    const sizeScore = Math.min(1, Math.max(0, (this.faceSizeEMA - 0.04) / 0.12));

    let score = 100 * (0.2 * presence + 0.6 * engaged + 0.1 * stabilityScore + 0.1 * sizeScore);

    if (!this.currentFrameEngaged) {
      if (!this.hasRecentFace()) {
        score = 0;
      } else {
        score = Math.min(score, 22 + 18 * presence);
      }
    }

    return Math.round(Math.min(100, Math.max(0, score)));
  }

  analyzeFrame(detections, videoWidth, videoHeight, timestampMs) {
    const now = timestampMs;
    const dt = this.lastTimestamp ? (now - this.lastTimestamp) / 1000 : 0;
    this.lastTimestamp = now;

    let hadFace = false;
    let frameEngaged = false;

    if (detections.length > 0) {
      hadFace = true;
      const vw = videoWidth || DEFAULT_VIDEO_W;
      const vh = videoHeight || DEFAULT_VIDEO_H;
      const best = findLargestDetection(detections, vw, vh);
      const norm = normalizeBox(parseBoundingBox(best), vw, vh);

      if (norm) {
        const engagement = getEngagementState(best, vw, vh, norm);
        frameEngaged = engagement.engaged;
        this.currentEngagementHint = engagement.hint;

        if (this.prevCenter) {
          const dx = norm.cx - this.prevCenter.x;
          const dy = norm.cy - this.prevCenter.y;
          const dist = Math.hypot(dx, dy);
          this.movementEMA = this.movementEMA
            ? this.movementEMA * (1 - this.emaAlpha) + dist * this.emaAlpha
            : dist;
        }
        this.prevCenter = { x: norm.cx, y: norm.cy };
        this.faceSizeEMA = this.faceSizeEMA
          ? this.faceSizeEMA * (1 - this.emaAlpha) + norm.area * this.emaAlpha
          : norm.area;
      }
    }

    this.currentFrameEngaged = hadFace && frameEngaged;
    this.pushFocusSample(hadFace, this.currentFrameEngaged, now);
    this.currentFocusScore = this.computeFocusScore();

    if (hadFace) {
      this.facePresentTime += dt;
    }

    return {
      dt,
      hadFace,
      frameEngaged: this.currentFrameEngaged,
      focusScore: this.currentFocusScore,
      hint: this.currentEngagementHint,
      detections,
    };
  }
}

export function toCanvasRect(bb, videoWidth, videoHeight, canvasWidth, canvasHeight) {
  const norm = normalizeBox(bb, videoWidth, videoHeight);
  if (!norm) return null;
  return {
    x: norm.x * canvasWidth,
    y: norm.y * canvasHeight,
    w: norm.w * canvasWidth,
    h: norm.h * canvasHeight,
  };
}
