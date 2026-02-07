// WebRTC configuration and media constraints
// Provides: RTC_CONFIG, MEDIA_CONSTRAINTS, SCREEN_SHARE_CONSTRAINTS

// Detect if running in a browser and if the device is likely mobile
const isBrowser = typeof window !== 'undefined' && typeof navigator !== 'undefined';
const isMobileDevice = () => {
  if (!isBrowser) return false;
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
         window.innerWidth < 768;
};

// ICE servers (STUN/TURN)
const RTC_CONFIG = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' }
  ],
  iceCandidatePoolSize: 2
};

// Desktop constraints - high quality
const DESKTOP_CONSTRAINTS = {
  video: {
    width: { ideal: 1280, min: 640, max: 1920 },
    height: { ideal: 720, min: 480, max: 1080 },
    frameRate: { ideal: 30, min: 20, max: 60 },
    facingMode: 'user'
  },
  audio: {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
    channelCount: 2,
    sampleRate: 48000,
    sampleSize: 16
  }
};

// Mobile constraints - optimized for performance
const MOBILE_CONSTRAINTS = {
  video: {
    width: { ideal: 720, min: 320, max: 1280 },
    height: { ideal: 480, min: 240, max: 720 },
    frameRate: { ideal: 24, min: 15, max: 30 },
    facingMode: 'user'
  },
  audio: {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
    channelCount: 1,
    sampleRate: 16000,
    sampleSize: 16
  }
};

// Fallback constraints - minimum requirements
const FALLBACK_CONSTRAINTS = {
  video: true,
  audio: true
};

// Audio-only constraints (when camera denied)
const AUDIO_ONLY_CONSTRAINTS = {
  video: false,
  audio: {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true
  }
};

// Video-only constraints (when microphone denied)
const VIDEO_ONLY_CONSTRAINTS = {
  video: {
    width: { ideal: 1280, min: 640, max: 1920 },
    height: { ideal: 720, min: 480, max: 1080 },
    frameRate: { ideal: 30, min: 20, max: 60 },
    facingMode: 'user'
  },
  audio: false
};

// Pick default media constraints based on device type
const MEDIA_CONSTRAINTS = isMobileDevice() ? MOBILE_CONSTRAINTS : DESKTOP_CONSTRAINTS;

const SCREEN_SHARE_CONSTRAINTS = {
  video: {
    cursor: 'always'
  },
  audio: false
};

// Export for CommonJS (server-side tests) and attached to window for browser usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    RTC_CONFIG,
    MEDIA_CONSTRAINTS,
    SCREEN_SHARE_CONSTRAINTS,
    DESKTOP_CONSTRAINTS,
    MOBILE_CONSTRAINTS,
    FALLBACK_CONSTRAINTS,
    AUDIO_ONLY_CONSTRAINTS,
    VIDEO_ONLY_CONSTRAINTS
  };
} else if (isBrowser) {
  window.RTC_CONFIG = RTC_CONFIG;
  window.MEDIA_CONSTRAINTS = MEDIA_CONSTRAINTS;
  window.SCREEN_SHARE_CONSTRAINTS = SCREEN_SHARE_CONSTRAINTS;
}
