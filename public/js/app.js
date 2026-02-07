// Main Application
class App {
  constructor() {
    this.socket = io();
    this.mediaManager = new MediaManager();
    this.webrtcManager = null;
    this.uiManager = new UIManager();
    
    this.state = {
      roomId: null,
      username: null,
      userId: this.uiManager.generateUserId(),
      localStream: null,
      isInMeeting: false
    };

    this.init();
  }

  init() {
    console.log('Initializing application...');
    
    // Check WebRTC support
    if (!MediaManager.isWebRTCSupported()) {
      this.uiManager.showError(
        'Browser Not Supported',
        'Your browser does not support WebRTC. Please use Chrome, Edge, or Firefox.'
      );
      return;
    }

    this.setupEventListeners();
    this.setupSocketListeners();
    
    // Check for room parameter in URL (auto-join from link)
    const urlParams = new URLSearchParams(window.location.search);
    const roomFromUrl = urlParams.get('room');
    
    if (roomFromUrl) {
      console.log('Meeting link detected, auto-joining room:', roomFromUrl);
      this.state.roomId = roomFromUrl;
      this.prepareForMeeting();
    } else {
      this.uiManager.showPage('landing');
    }
  }

  // ==================== EVENT LISTENERS ====================
  setupEventListeners() {
    // Landing Page
    document.getElementById('btn-new-meeting').addEventListener('click', () => this.startNewMeeting());
    document.getElementById('btn-join-from-link').addEventListener('click', () => this.joinFromLink());
    document.getElementById('meeting-link-input').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') this.joinFromLink();
    });

    // Setup Page
    document.getElementById('btn-back').addEventListener('click', () => this.backToLanding());
    document.getElementById('btn-join-meeting').addEventListener('click', () => this.joinMeeting());
    
    document.getElementById('camera-select').addEventListener('change', (e) => this.switchCamera(e.target.value));
    document.getElementById('microphone-select').addEventListener('change', (e) => this.switchMicrophone(e.target.value));
    
    document.getElementById('toggle-camera-setup').addEventListener('click', () => this.toggleSetupCamera());
    document.getElementById('toggle-mic-setup').addEventListener('click', () => this.toggleSetupMicrophone());

    // Meeting Page
    document.getElementById('btn-toggle-mic').addEventListener('click', () => this.toggleMicrophone());
    document.getElementById('btn-toggle-camera').addEventListener('click', () => this.toggleCamera());
    document.getElementById('btn-share-link').addEventListener('click', () => this.shareLink());
    document.getElementById('btn-toggle-chat').addEventListener('click', () => this.toggleChat());
    document.getElementById('btn-leave').addEventListener('click', () => this.leaveMeeting());
    document.getElementById('btn-fullscreen').addEventListener('click', () => this.uiManager.toggleFullscreen());
    document.getElementById('btn-end-meeting').addEventListener('click', () => this.leaveMeeting());

    // Chat
    document.getElementById('btn-close-chat').addEventListener('click', () => this.toggleChat());
    document.getElementById('btn-send-message').addEventListener('click', () => this.sendChatMessage());
    document.getElementById('chat-input').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') this.sendChatMessage();
    });

    // Error Modal
    document.getElementById('btn-error-close').addEventListener('click', () => this.uiManager.hideError());
  }

  setupSocketListeners() {
    // User joined
    this.socket.on('user-joined', (data) => {
      console.log('User joined:', data);
      this.handleUserJoined(data);
    });

    // Existing users
    this.socket.on('existing-users', (users) => {
      console.log('Existing users:', users);
      users.forEach(user => {
        this.webrtcManager.createOffer(user.socketId, this.state.localStream);
      });
    });

    // WebRTC Signaling
    this.socket.on('receive-offer', async (data) => {
      await this.webrtcManager.handleOffer(data.from, data.offer, this.state.localStream);
    });

    this.socket.on('receive-answer', async (data) => {
      await this.webrtcManager.handleAnswer(data.from, data.answer);
    });

    this.socket.on('receive-ice-candidate', async (data) => {
      await this.webrtcManager.handleICECandidate(data.from, data.candidate);
    });

    // User left
    this.socket.on('user-left', (data) => {
      console.log('User left:', data);
      this.handleUserLeft(data);
    });

    this.socket.on('user-disconnected', (data) => {
      console.log('User disconnected:', data);
      this.handleUserLeft(data);
    });

    // Chat
    this.socket.on('receive-message', (data) => {
      console.log('Message received:', data);
      this.uiManager.addChatMessage(data.username, data.message, data.timestamp);
    });

    // Media state
    this.socket.on('user-media-state', (data) => {
      this.updateRemoteUserMediaState(data);
    });

    // Connection events
    this.socket.on('connect', () => {
      console.log('Connected to server');
    });

    this.socket.on('disconnect', () => {
      console.log('Disconnected from server');
      if (this.state.isInMeeting) {
        this.uiManager.showError('Connection Lost', 'Disconnected from server. Please rejoin the meeting.');
      }
    });

    this.socket.on('connect_error', (error) => {
      console.error('Connection error:', error);
      this.uiManager.showError('Connection Error', 'Failed to connect to the server.');
    });
  }

  // ==================== MEETING MANAGEMENT ====================
  async startNewMeeting() {
    try {
      this.uiManager.showLoading('Creating meeting...');
      
      const response = await fetch('/api/create-meeting');
      const data = await response.json();
      this.state.roomId = data.meetingId;
      
      // Go to setup page
      this.prepareForMeeting();
    } catch (error) {
      console.error('Error creating meeting:', error);
      this.uiManager.showError('Error', 'Failed to create meeting. Please try again.');
    } finally {
      this.uiManager.hideLoading();
    }
  }

  joinFromLink() {
    const link = document.getElementById('meeting-link-input').value.trim();
    if (!link) {
      this.uiManager.showSetupError('Please enter or paste a meeting link');
      return;
    }

    try {
      let roomId = null;
      
      // Try parsing as full URL first
      try {
        // Handle both absolute URLs and relative URLs
        const url = link.includes('://') 
          ? new URL(link) 
          : new URL(link, window.location.origin);
        roomId = url.searchParams.get('room');
      } catch (e) {
        console.log('Not a valid URL, trying as room code');
      }
      
      // If not found in URL params, treat link as room code directly
      if (!roomId) {
        // Accept 8-character room codes (case-insensitive)
        if (/^[A-Za-z0-9]{8}$/.test(link)) {
          roomId = link.toUpperCase();
        }
      }
      
      if (!roomId) {
        throw new Error('Invalid meeting link format. Please paste a valid link or 8-digit code.');
      }

      this.state.roomId = roomId;
      this.prepareForMeeting();
    } catch (error) {
      console.error('Error parsing link:', error);
      this.uiManager.showSetupError(error.message || 'Invalid meeting link. Paste the full link or 8-digit code.');
    }
  }

  async prepareForMeeting() {
    try {
      this.uiManager.showLoading('Preparing meeting...');
      
      // Enumerate devices first (this should not trigger permission prompt)
      try {
        await this.mediaManager.enumerateDevices();
        this.uiManager.populateDeviceSelects(this.mediaManager.devices);
      } catch (error) {
        console.warn('Could not enumerate devices:', error);
      }

      // Get initial stream - this will trigger permission prompt
      try {
        const stream = await this.mediaManager.getLocalStream();
        this.state.localStream = stream;
        this.uiManager.updateVideoPreview(stream);
        
        // Show setup page
        this.uiManager.showPage('setup');
        this.uiManager.hideLoading();
        
        // Set button states
        this.uiManager.setSetupCameraButtonState(true);
        this.uiManager.setSetupMicButtonState(true);
      } catch (error) {
        console.error('Error accessing media devices:', error);
        this.uiManager.hideLoading();
        
        // Show detailed error message
        let errorMessage = '';
        if (error.name === 'NotAllowedError') {
          errorMessage = '📛 Permission Denied!\n\n' +
            'The permission dialog may be blocked by another app or overlay.\n\n' +
            'Try:\n' +
            '1. Close any floating windows, notifications, or apps\n' +
            '2. Disable screen recording or streaming apps\n' +
            '3. Refresh this page and try again\n\n' +
            'You can still join as audio/text only without camera.';
        } else if (error.name === 'NotFoundError') {
          errorMessage = '❌ No Camera/Microphone Found\n\n' +
            'Your device does not have a camera or microphone.\n\n' +
            'You can still join as text-only.';
        } else if (error.name === 'NotReadableError') {
          errorMessage = '⚠️ Device In Use\n\n' +
            'Your camera/microphone is already in use by another app.\n\n' +
            'Please close that app and try again:\n' +
            '• Close video calls (Teams, Zoom, etc)\n' +
            '• Close camera apps (Snapchat, Instagram, etc)\n' +
            '• Restart your browser';
        } else {
          errorMessage = '⚠️ ' + (error.message || 'Failed to access camera/microphone');
        }
        
        this.uiManager.showError('Camera/Microphone Access', errorMessage);
      }
    } catch (error) {
      console.error('Unexpected error preparing for meeting:', error);
      this.uiManager.hideLoading();
      this.uiManager.showError('Setup Error', 'Failed to prepare meeting. Please refresh and try again.');
    }
  }

  async joinMeeting() {
    try {
      const username = this.uiManager.getUsername();
      if (!username) {
        this.uiManager.showSetupError('Please enter your name');
        return;
      }

      if (!this.state.roomId) {
        this.uiManager.showSetupError('Room ID missing. Please try again.');
        return;
      }

      this.uiManager.showLoading('Joining meeting...');

      this.state.username = username;
      this.state.isInMeeting = true;

      // Initialize WebRTC manager
      this.webrtcManager = new WebRTCManager(this.socket);

      // Join room via Socket.IO
      this.socket.emit('join-meeting', {
        roomId: this.state.roomId,
        username: this.state.username,
        userId: this.state.userId
      });

      // Add local stream to UI if available
      if (this.state.localStream) {
        this.uiManager.addLocalStream(this.state.localStream, this.state.username);
      }

      // Update button states
      this.updateMediaButtonStates();

      // Show meeting page
      this.uiManager.showPage('meeting');
      this.uiManager.hideLoading();

      console.log(`Joined meeting ${this.state.roomId} as ${this.state.username}`);
    } catch (error) {
      console.error('Error joining meeting:', error);
      this.uiManager.showError('Error', 'Failed to join meeting. Please try again.');
      this.uiManager.hideLoading();
    }
  }

  async leaveMeeting() {
    try {
      this.state.isInMeeting = false;

      // Emit leave event
      this.socket.emit('leave-meeting');

      // Stop streams
      this.mediaManager.stopLocalStream();
      this.webrtcManager?.closeAllConnections();

      // Clear UI
      this.uiManager.clearAllRemoteStreams();
      this.uiManager.clearChat();

      // Go back to landing
      this.state.roomId = null;
      this.state.username = null;
      this.uiManager.showPage('landing');

      console.log('Left meeting');
    } catch (error) {
      console.error('Error leaving meeting:', error);
    }
  }

  backToLanding() {
    // Stop current stream
    this.mediaManager.stopLocalStream();
    this.state.roomId = null;
    this.uiManager.showPage('landing');
  }

  // ==================== MEDIA CONTROLS ====================
  async toggleCamera() {
    try {
      const currentState = this.mediaManager.getMediaState();
      const newState = !currentState.camera;
      
      this.mediaManager.toggleVideo(newState);
      this.uiManager.setCameraButtonState(newState);
      
      // Notify others
      this.emitMediaState();
    } catch (error) {
      console.error('Error toggling camera:', error);
    }
  }

  async toggleMicrophone() {
    try {
      const currentState = this.mediaManager.getMediaState();
      const newState = !currentState.microphone;
      
      this.mediaManager.toggleAudio(newState);
      this.uiManager.setMicButtonState(newState);
      
      // Notify others
      this.emitMediaState();
    } catch (error) {
      console.error('Error toggling microphone:', error);
    }
  }

  async toggleSetupCamera() {
    try {
      const currentState = this.mediaManager.getMediaState();
      const newState = !currentState.camera;
      
      this.mediaManager.toggleVideo(newState);
      this.uiManager.setSetupCameraButtonState(newState);
    } catch (error) {
      console.error('Error toggling camera:', error);
    }
  }

  async toggleSetupMicrophone() {
    try {
      const currentState = this.mediaManager.getMediaState();
      const newState = !currentState.microphone;
      
      this.mediaManager.toggleAudio(newState);
      this.uiManager.setSetupMicButtonState(newState);
    } catch (error) {
      console.error('Error toggling microphone:', error);
    }
  }

  async switchCamera(deviceId) {
    try {
      await this.mediaManager.switchCamera(deviceId);
      this.state.localStream = this.mediaManager.localStream;
      
      // Update preview
      const video = document.getElementById('setup-video');
      if (video && this.uiManager.currentPage === 'setup') {
        video.srcObject = this.state.localStream;
      }
    } catch (error) {
      console.error('Error switching camera:', error);
      this.uiManager.showSetupError('Failed to switch camera');
    }
  }

  async switchMicrophone(deviceId) {
    try {
      await this.mediaManager.switchMicrophone(deviceId);
      this.state.localStream = this.mediaManager.localStream;
    } catch (error) {
      console.error('Error switching microphone:', error);
      this.uiManager.showSetupError('Failed to switch microphone');
    }
  }

  emitMediaState() {
    if (this.state.isInMeeting) {
      this.socket.emit('media-state', {
        roomId: this.state.roomId,
        mediaState: this.mediaManager.getMediaState()
      });
    }
  }

  updateMediaButtonStates() {
    // Only update button states if we have a local stream
    if (this.state.localStream) {
      const state = this.mediaManager.getMediaState();
      this.uiManager.setCameraButtonState(state.camera);
      this.uiManager.setMicButtonState(state.microphone);
    } else {
      // Disable media buttons if no stream
      this.uiManager.setCameraButtonState(false);
      this.uiManager.setMicButtonState(false);
    }
  }

  // ==================== CHAT ====================
  toggleChat() {
    const isCurrentlyOpen = this.uiManager.isChatOpen;
    this.uiManager.toggleChat(!isCurrentlyOpen);
  }

  sendChatMessage() {
    const message = this.uiManager.getChatInput();
    if (!message) return;

    // Add to UI
    this.uiManager.addChatMessage(this.state.username, message, new Date(), true);

    // Send via socket
    this.socket.emit('chat-message', {
      roomId: this.state.roomId,
      message,
      username: this.state.username
    });

    this.uiManager.clearChatInput();
  }

  // ==================== MEETING LINK ====================
  shareLink() {
    const link = this.uiManager.getMeetingLink(this.state.roomId);
    this.uiManager.copyToClipboard(link);
    this.uiManager.showToast('Meeting link copied to clipboard!');
  }

  // ==================== SOCKET HANDLERS ====================
  async handleUserJoined(data) {
    console.log(`${data.username} joined`);
    this.uiManager.showToast(`${data.username} joined the meeting`);

    // Create offer for new user
    if (this.state.isInMeeting && this.state.localStream) {
      try {
        await this.webrtcManager.createOffer(data.socketId, this.state.localStream);
      } catch (error) {
        console.error('Error creating offer:', error);
      }
    }
  }

  handleUserLeft(data) {
    console.log(`${data.username} left`);
    this.uiManager.showToast(`${data.username} left the meeting`);
    
    // Remove peer connection
    if (this.webrtcManager) {
      this.webrtcManager.removePeerConnection(data.socketId);
      this.uiManager.removeRemoteStream(data.socketId);
    }
  }

  updateRemoteUserMediaState(data) {
    // Could use this to update UI indicators
    console.log('Remote user media state:', data);
  }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  window.app = new App();
});

// Handle page visibility
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    console.log('App hidden');
  } else {
    console.log('App visible');
  }
});

// Handle before unload
window.addEventListener('beforeunload', (e) => {
  if (window.app?.state?.isInMeeting) {
    e.preventDefault();
    e.returnValue = '';
  }
});
