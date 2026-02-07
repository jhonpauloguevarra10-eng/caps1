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

  // Get user media
  async getLocalStream(videoDeviceId = null, audioDeviceId = null) {
    try {
      const constraints = {
        video: MEDIA_CONSTRAINTS.video,
        audio: MEDIA_CONSTRAINTS.audio
      };

      if (videoDeviceId) {
        constraints.video.deviceId = { exact: videoDeviceId };
      }
      if (audioDeviceId) {
        constraints.audio.deviceId = { exact: audioDeviceId };
      }

      this.localStream = await navigator.mediaDevices.getUserMedia(constraints);
      this.mediaState = {
        camera: true,
        microphone: true
      };
      return this.localStream;
    } catch (error) {
      console.error('Error accessing media devices:', error);
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
