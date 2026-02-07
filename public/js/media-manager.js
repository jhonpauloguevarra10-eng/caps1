// Media Manager - Handles camera and microphone access
class MediaManager {
  constructor() {
    this.localStream = null;
    this.devices = {
      videoinput: [],
      audioinput: []
    };
    this.mediaState = {
      camera: true,
      microphone: true
    };
  }

  // Enumerate available media devices
  async enumerateDevices() {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      this.devices = {
        videoinput: devices.filter(d => d.kind === 'videoinput'),
        audioinput: devices.filter(d => d.kind === 'audioinput')
      };
      return this.devices;
    } catch (error) {
      console.error('Error enumerating devices:', error);
      throw error;
    }
  }

  // Get user media with fallback options
  async getLocalStream(videoDeviceId = null, audioDeviceId = null, retryCount = 0) {
    try {
      const constraints = {
        video: videoDeviceId ? { ...MEDIA_CONSTRAINTS.video, deviceId: { exact: videoDeviceId } } : MEDIA_CONSTRAINTS.video,
        audio: audioDeviceId ? { ...MEDIA_CONSTRAINTS.audio, deviceId: { exact: audioDeviceId } } : MEDIA_CONSTRAINTS.audio
      };

      this.localStream = await navigator.mediaDevices.getUserMedia(constraints);
      this.mediaState = {
        camera: true,
        microphone: true
      };
      return this.localStream;
    } catch (error) {
      // Handle specific errors
      if (error.name === 'NotAllowedError') {
        console.error('Permission denied - user blocked access or overlay is blocking permission dialog');
        error.message = 'Camera/microphone permission denied. Please check browser settings and close any overlays.';
      } else if (error.name === 'NotFoundError') {
        console.error('No camera or microphone found');
        error.message = 'No camera or microphone detected on your device.';
      } else if (error.name === 'NotReadableError') {
        console.error('Media device is already in use');
        error.message = 'Camera/microphone is already in use by another app. Please close it and try again.';
      }
      throw error;
    }
  }

  // Stop local stream
  stopLocalStream() {
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = null;
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
    }
  }

  // Switch to different camera
  async switchCamera(deviceId) {
    try {
      this.stopLocalStream();
      this.localStream = await this.getLocalStream(deviceId, null);
      return this.localStream;
    } catch (error) {
      console.error('Error switching camera:', error);
      throw error;
    }
  }

  // Switch to different microphone
  async switchMicrophone(deviceId) {
    try {
      this.stopLocalStream();
      this.localStream = await this.getLocalStream(null, deviceId);
      return this.localStream;
    } catch (error) {
      console.error('Error switching microphone:', error);
      throw error;
    }
  }

  // Get current media state
  getMediaState() {
    return { ...this.mediaState };
  }

  // Check if browser supports WebRTC
  static isWebRTCSupported() {
    return !!(
      navigator.mediaDevices &&
      navigator.mediaDevices.getUserMedia &&
      window.RTCPeerConnection
    );
  }

  // Check for browser specific APIs
  static getWebRTCSupport() {
    const RTCPeerConnection = 
      window.RTCPeerConnection || 
      window.webkitRTCPeerConnection || 
      window.mozRTCPeerConnection;
    
    return {
      supported: !!RTCPeerConnection,
      rtcPeerConnection: RTCPeerConnection
    };
  }
}
