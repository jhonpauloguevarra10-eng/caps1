// WebRTC Configuration
const RTC_CONFIG = {
  iceServers: [
    {
      urls: [
        'stun:stun.l.google.com:19302',
        'stun:stun1.l.google.com:19302',
        'stun:stun2.l.google.com:19302',
        'stun:stun3.l.google.com:19302',
        'stun:stun4.l.google.com:19302'
      ]
    },
    {
      urls: 'turn:numb.viagenie.ca',
      credential: 'muazkh',
      username: 'webrtc@live.com'
    }
  ],
  iceCandidatePoolSize: 10,
  bundlePolicy: 'max-bundle',
  rtcpMuxPolicy: 'require'
};

const MEDIA_CONSTRAINTS = {
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

const SCREEN_SHARE_CONSTRAINTS = {
  video: {
    cursor: 'always',
    displaySurface: 'monitor'
  },
  audio: false
};

// Export for ES6 modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { RTC_CONFIG, MEDIA_CONSTRAINTS, SCREEN_SHARE_CONSTRAINTS };
}