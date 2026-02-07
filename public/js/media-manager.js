// Media Manager - Handles camera and microphone access
class MediaManager {
  constructor() {
    this.localStream = null;
    this.screenStream = null;
    this.devices = {
      videoinput: [],
      audioinput: []
    };
    this.mediaState = {
      camera: true,
      microphone: true,
      screenShare: false
    };
    this.currentConstraints = {};
  }

  // Check WebRTC support
  static isWebRTCSupported() {
    return !!(
      navigator.mediaDevices &&
      navigator.mediaDevices.getUserMedia &&
      window.RTCPeerConnection
    );
  }

  // Enumerate available media devices
  async enumerateDevices() {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      
      this.devices = {
        videoinput: devices.filter(d => d.kind === 'videoinput'),
        audioinput: devices.filter(d => d.kind === 'audioinput')
      };
      
      console.log('Available devices:', this.devices);
      return this.devices;
    } catch (error) {
      console.error('Error enumerating devices:', error);
      throw error;
    }
  }

  // Request media permissions and get stream with fallback strategy
  async getLocalStream(constraints = MEDIA_CONSTRAINTS, isRetry = false) {
    try {
      console.log('Requesting media stream with constraints:', constraints);
      
      this.localStream = await navigator.mediaDevices.getUserMedia(constraints);
      this.currentConstraints = constraints;
      
      // Update media state based on actual tracks
      this.mediaState.camera = this.localStream.getVideoTracks().some(track => track.enabled);
      this.mediaState.microphone = this.localStream.getAudioTracks().some(track => track.enabled);
      
      console.log('Got local stream:', this.localStream);
      return this.localStream;
    } catch (error) {
      console.error('Error getting local stream:', error);
      
      // Provide user-friendly error messages
      let errorMessage = 'Failed to access media devices. ';
      
      switch(error.name) {
        case 'NotFoundError':
          errorMessage += 'No camera or microphone found.';
          break;
        case 'NotAllowedError':
          errorMessage += 'Permission denied. Please allow camera and microphone access.';
          break;
        case 'NotReadableError':
          errorMessage += 'Device is already in use by another application.';
          break;
        case 'OverconstrainedError':
          errorMessage += 'Cannot satisfy constraints. Try different camera or microphone.';
          break;
        default:
          errorMessage += error.message;
      }
      
      error.userMessage = errorMessage;
      throw error;
    }
  }

  // Advanced retry with fallback constraints
  async getLocalStreamWithFallback(preferAudio = false, preferVideo = false) {
    const strategies = [
      MEDIA_CONSTRAINTS,
      FALLBACK_CONSTRAINTS
    ];

    // Add audio-only or video-only based on preferences
    if (preferAudio && !preferVideo) {
      strategies.unshift(AUDIO_ONLY_CONSTRAINTS);
    } else if (preferVideo && !preferAudio) {
      strategies.unshift(VIDEO_ONLY_CONSTRAINTS);
    }

    let lastError = null;

    for (let i = 0; i < strategies.length; i++) {
      try {
        console.log(`Attempting media access with strategy ${i + 1}:`, strategies[i]);
        const stream = await this.getLocalStream(strategies[i], true);
        console.log(`✓ Successfully got stream with strategy ${i + 1}`);
        return stream;
      } catch (error) {
        lastError = error;
        console.warn(`✗ Strategy ${i + 1} failed:`, error.message);

        // If this is permission error, don't try other strategies for this permission
        if (error.name === 'NotAllowedError' && i === 0) {
          // Try without the denied device
          if (error.message.includes('video')) {
            console.log('Video permission denied, trying audio-only...');
            try {
              return await this.getLocalStream(AUDIO_ONLY_CONSTRAINTS, true);
            } catch (audioError) {
              lastError = audioError;
            }
          } else if (error.message.includes('audio')) {
            console.log('Audio permission denied, trying video-only...');
            try {
              return await this.getLocalStream(VIDEO_ONLY_CONSTRAINTS, true);
            } catch (videoError) {
              lastError = videoError;
            }
          }
        }

        // Continue to next strategy if overconstrained
        if (error.name === 'OverconstrainedError' || error.name === 'NotFoundError') {
          continue;
        }
      }
    }

    // All strategies failed
    const errorMsg = `Unable to access camera and microphone after ${strategies.length} attempts. ${lastError?.userMessage || lastError?.message}`;
    const finalError = new Error(errorMsg);
    finalError.name = lastError?.name || 'MediaAccessError';
    throw finalError;
  }

  // Start screen sharing
  async startScreenShare() {
    try {
      this.screenStream = await navigator.mediaDevices.getDisplayMedia(
        SCREEN_SHARE_CONSTRAINTS
      );
      
      // Handle screen sharing stop
      this.screenStream.getVideoTracks()[0].onended = () => {
        this.stopScreenShare();
      };
      
      this.mediaState.screenShare = true;
      return this.screenStream;
    } catch (error) {
      console.error('Error starting screen share:', error);
      throw error;
    }
  }

  // Stop screen sharing
  stopScreenShare() {
    if (this.screenStream) {
      this.screenStream.getTracks().forEach(track => track.stop());
      this.screenStream = null;
      this.mediaState.screenShare = false;
    }
  }

  // Switch camera
  async switchCamera(deviceId) {
    try {
      if (!this.localStream) {
        throw new Error('No active stream to switch');
      }

      const newConstraints = {
        ...this.currentConstraints,
        video: { 
          ...this.currentConstraints.video,
          deviceId: { exact: deviceId }
        }
      };

      await this.getLocalStream(newConstraints);
      return this.localStream;
    } catch (error) {
      console.error('Error switching camera:', error);
      throw error;
    }
  }

  // Switch microphone
  async switchMicrophone(deviceId) {
    try {
      if (!this.localStream) {
        throw new Error('No active stream to switch');
      }

      const newConstraints = {
        ...this.currentConstraints,
        audio: { 
          ...this.currentConstraints.audio,
          deviceId: { exact: deviceId }
        }
      };

      await this.getLocalStream(newConstraints);
      return this.localStream;
    } catch (error) {
      console.error('Error switching microphone:', error);
      throw error;
    }
  }

  // Toggle video track
  toggleVideo(enabled) {
    if (this.localStream) {
      const videoTracks = this.localStream.getVideoTracks();
      videoTracks.forEach(track => {
        track.enabled = enabled;
      });
      this.mediaState.camera = enabled;
      console.log(`Video ${enabled ? 'enabled' : 'disabled'}`);
    }
  }

  // Toggle audio track
  toggleAudio(enabled) {
    if (this.localStream) {
      const audioTracks = this.localStream.getAudioTracks();
      audioTracks.forEach(track => {
        track.enabled = enabled;
      });
      this.mediaState.microphone = enabled;
      console.log(`Audio ${enabled ? 'enabled' : 'disabled'}`);
    }
  }

  // Get current media state
  getMediaState() {
    return { ...this.mediaState };
  }

  // Stop all local streams
  stopLocalStream() {
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = null;
    }
    this.stopScreenShare();
  }

  // Get stream for specific track type
  getStreamForTrack(trackType) {
    if (trackType === 'screen' && this.screenStream) {
      return this.screenStream;
    }
    return this.localStream;
  }

  // Check if device is available
  hasDevice(kind, deviceId) {
    const devices = this.devices[kind];
    return devices && devices.some(device => device.deviceId === deviceId);
  }

  // Get device label
  getDeviceLabel(kind, deviceId) {
    const device = this.devices[kind].find(d => d.deviceId === deviceId);
    return device ? device.label : `Unknown ${kind}`;
  }
}

// Export for ES6 modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = MediaManager;
}