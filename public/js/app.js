// Main Application
class App {
  constructor() {
    this.socket = null;
    this.mediaManager = new MediaManager();
    this.webrtcManager = null;
    this.uiManager = new UIManager();
    
    this.state = {
      roomId: null,
      username: null,
      userId: this.generateUserId(),
      localStream: null,
      isInMeeting: false,
      isHost: false,
      participants: new Map(),
      chatMessages: [],
      isScreenSharing: false,
      isRecording: false
    };

    this.init();
  }

  // Generate unique user ID
  generateUserId() {
    return `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  async init() {
    console.log('Initializing VideoMeet application...');
    
    // Check WebRTC support
    if (!MediaManager.isWebRTCSupported()) {
      this.uiManager.showError(
        'Browser Not Supported',
        'Your browser does not support WebRTC. Please use Chrome, Edge, or Firefox.'
      );
      return;
    }

    // Initialize Socket.IO connection
    this.initSocket();
    
    // Setup event listeners
    this.setupEventListeners();
    
    // Check for room parameter in URL
    const urlParams = new URLSearchParams(window.location.search);
    const roomFromUrl = urlParams.get('room');
    
    if (roomFromUrl) {
      console.log('Meeting link detected, auto-joining room:', roomFromUrl);
      this.state.roomId = roomFromUrl;
      this.prepareForMeeting();
    } else {
      // Check if we're on a room-specific URL
      const path = window.location.pathname;
      const roomMatch = path.match(/\/room\/([A-Z0-9-]+)/i);
      if (roomMatch) {
        this.state.roomId = roomMatch[1];
        this.prepareForMeeting();
      } else {
        this.uiManager.showPage('landing');
      }
    }
  }

  initSocket() {
    this.socket = io({
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      timeout: 10000
    });

    this.setupSocketListeners();
  }

  // ==================== EVENT LISTENERS ====================
  setupEventListeners() {
    // Landing Page
    document.getElementById('btn-new-meeting').addEventListener('click', () => this.startNewMeeting());
    document.getElementById('btn-join-meeting').addEventListener('click', () => this.showJoinDialog());
    document.getElementById('btn-join-from-link').addEventListener('click', () => this.joinFromLink());
    document.getElementById('meeting-link-input').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') this.joinFromLink();
    });

    // Setup Page
    document.getElementById('btn-back').addEventListener('click', () => this.backToLanding());
    document.getElementById('btn-join-ready').addEventListener('click', () => this.joinMeeting());
    
    document.getElementById('camera-select').addEventListener('change', (e) => this.switchCamera(e.target.value));
    document.getElementById('microphone-select').addEventListener('change', (e) => this.switchMicrophone(e.target.value));
    
    document.getElementById('toggle-camera-setup').addEventListener('click', () => this.toggleSetupCamera());
    document.getElementById('toggle-mic-setup').addEventListener('click', () => this.toggleSetupMicrophone());
    document.getElementById('btn-copy-link').addEventListener('click', () => this.copyMeetingLink());

    // Meeting Page
    document.getElementById('btn-toggle-mic').addEventListener('click', () => this.toggleMicrophone());
    document.getElementById('btn-toggle-camera').addEventListener('click', () => this.toggleCamera());
    document.getElementById('btn-toggle-chat').addEventListener('click', () => this.uiManager.toggleChat());
    document.getElementById('btn-toggle-participants').addEventListener('click', () => this.uiManager.toggleParticipants());
    document.getElementById('btn-share-link').addEventListener('click', () => this.showInviteModal());
    document.getElementById('btn-share-screen').addEventListener('click', () => this.toggleScreenShare());
    document.getElementById('btn-record-meeting').addEventListener('click', () => this.toggleRecording());
    document.getElementById('btn-fullscreen').addEventListener('click', () => this.uiManager.toggleFullscreen());
    document.getElementById('btn-leave').addEventListener('click', () => this.leaveMeeting());
    document.getElementById('btn-end-meeting').addEventListener('click', () => this.endMeeting());
    document.getElementById('btn-settings').addEventListener('click', () => this.showSettings());

    // Chat
    document.getElementById('btn-close-chat').addEventListener('click', () => this.uiManager.toggleChat(false));
    document.getElementById('btn-close-participants').addEventListener('click', () => this.uiManager.toggleParticipants(false));
    document.getElementById('btn-send-message').addEventListener('click', () => this.sendChatMessage());
    document.getElementById('chat-input').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') this.sendChatMessage();
    });

    // Modals
    document.getElementById('btn-error-close').addEventListener('click', () => this.uiManager.hideError());
    document.getElementById('btn-close-invite').addEventListener('click', () => this.uiManager.hideModal('invite-modal'));
    document.getElementById('btn-copy-invite').addEventListener('click', () => this.copyInviteLink());

    // Handle before unload
    window.addEventListener('beforeunload', (e) => {
      if (this.state.isInMeeting) {
        e.preventDefault();
        e.returnValue = 'Are you sure you want to leave the meeting?';
        this.cleanupBeforeUnload();
      }
    });

    // Handle page visibility
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        console.log('App hidden');
        if (this.state.isInMeeting) {
          this.sendMediaState();
        }
      } else {
        console.log('App visible');
      }
    });

    // Handle resize
    window.addEventListener('resize', () => {
      this.adjustVideoGrid();
    });
  }

  setupSocketListeners() {
    // Connection events
    this.socket.on('connect', () => {
      console.log('Connected to server with ID:', this.socket.id);
      this.uiManager.showNotification('Connected to server', 'success');
    });

    this.socket.on('disconnect', (reason) => {
      console.log('Disconnected from server:', reason);
      this.uiManager.showNotification('Disconnected from server', 'warning');
    });

    this.socket.on('connect_error', (error) => {
      console.error('Connection error:', error);
      this.uiManager.showError('Connection Error', 'Failed to connect to the server. Please check your internet connection.');
    });

    this.socket.on('reconnect', (attemptNumber) => {
      console.log('Reconnected after', attemptNumber, 'attempts');
      this.uiManager.showNotification('Reconnected to server', 'success');
    });

    // Room events
    this.socket.on('room-created', (data) => {
      console.log('Room created:', data);
      this.state.roomId = data.roomId;
      this.state.isHost = true;
      this.uiManager.setRoomId(data.roomId);
      this.uiManager.updateShareLink(data.roomId);
    });

    this.socket.on('room-joined', (data) => {
      console.log('Joined room:', data);
      this.state.roomId = data.roomId;
      this.uiManager.setRoomId(data.roomId);
      this.uiManager.updateShareLink(data.roomId);
    });

    this.socket.on('user-joined', (data) => {
      console.log('User joined:', data);
      this.handleUserJoined(data);
    });

    this.socket.on('user-left', (data) => {
      console.log('User left:', data);
      this.handleUserLeft(data);
    });

    this.socket.on('existing-users', (users) => {
      console.log('Existing users:', users);
      this.handleExistingUsers(users);
    });

    // WebRTC Signaling
    this.socket.on('receive-offer', async (data) => {
      console.log('Received offer from:', data.from);
      await this.webrtcManager.handleOffer(data.from, data.offer, this.state.localStream);
    });

    this.socket.on('receive-answer', async (data) => {
      console.log('Received answer from:', data.from);
      await this.webrtcManager.handleAnswer(data.from, data.answer);
    });

    this.socket.on('receive-ice-candidate', async (data) => {
      console.log('Received ICE candidate from:', data.from);
      await this.webrtcManager.handleICECandidate(data.from, data.candidate);
    });

    // Chat
    this.socket.on('receive-message', (data) => {
      console.log('Message received:', data);
      this.uiManager.addChatMessage(data.username, data.message, data.timestamp);
    });

    // Media state
    this.socket.on('user-media-state', (data) => {
      console.log('User media state update:', data);
      this.updateRemoteUserMediaState(data);
    });

    // Screen share
    this.socket.on('screen-share-started', (data) => {
      console.log('Screen share started by:', data.username);
      this.uiManager.showNotification(`${data.username} started screen sharing`, 'info');
    });

    this.socket.on('screen-share-stopped', (data) => {
      console.log('Screen share stopped by:', data.username);
      this.uiManager.showNotification(`${data.username} stopped screen sharing`, 'info');
    });
  }

  // ==================== MEETING MANAGEMENT ====================
  async startNewMeeting() {
    try {
      this.uiManager.showLoading('Creating meeting...');
      
      // Generate room ID
      this.state.roomId = this.generateRoomId();
      this.state.isHost = true;
      
      // Update UI with room ID
      this.uiManager.setRoomId(this.state.roomId);
      this.uiManager.updateShareLink(this.state.roomId);
      
      // Prepare for meeting
      await this.prepareForMeeting();
    } catch (error) {
      console.error('Error creating meeting:', error);
      this.uiManager.showError('Error', 'Failed to create meeting. Please try again.');
    } finally {
      this.uiManager.hideLoading();
    }
  }

  generateRoomId() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 8; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  showJoinDialog() {
    const linkInput = document.getElementById('meeting-link-input');
    linkInput.value = '';
    linkInput.focus();
  }

  async joinFromLink() {
    const link = document.getElementById('meeting-link-input').value.trim();
    
    if (!link) {
      this.uiManager.showNotification('Please enter a meeting link or code', 'warning');
      return;
    }

    try {
      let roomId = null;
      
      // Try to extract room ID from various formats
      if (link.includes('/room/')) {
        // Full URL format
        const url = new URL(link.includes('://') ? link : `https://${link}`);
        const pathParts = url.pathname.split('/');
        roomId = pathParts[pathParts.length - 1];
      } else if (link.includes('room=')) {
        // Query parameter format
        const url = new URL(link.includes('://') ? link : `https://${link}`);
        roomId = url.searchParams.get('room');
      } else {
        // Direct room code format (8 characters)
        if (/^[A-Z0-9]{8}$/i.test(link)) {
          roomId = link.toUpperCase();
        }
      }
      
      if (!roomId) {
        throw new Error('Invalid meeting link. Please check the link and try again.');
      }

      this.state.roomId = roomId;
      await this.prepareForMeeting();
    } catch (error) {
      console.error('Error joining from link:', error);
      this.uiManager.showError('Invalid Link', error.message || 'Please enter a valid meeting link or 8-digit code.');
    }
  }

  async prepareForMeeting() {
    try {
      this.uiManager.showLoading('Preparing meeting...');
      
      // Enumerate devices
      try {
        const devices = await this.mediaManager.enumerateDevices();
        this.uiManager.populateDeviceSelects(devices);
      } catch (error) {
        console.warn('Could not enumerate devices:', error);
      }

      // Get initial stream
      try {
        const stream = await this.mediaManager.getLocalStream();
        this.state.localStream = stream;
        this.uiManager.updateVideoPreview(stream);
        
        // Show setup page
        this.uiManager.showPage('setup');
        this.uiManager.hideLoading();
        
        // Update UI with meeting link
        if (this.state.roomId) {
          this.uiManager.updateShareLink(this.state.roomId);
        }
      } catch (error) {
        console.error('Error accessing media devices:', error);
        this.uiManager.hideLoading();
        
        // Show setup page anyway (allow audio/text only)
        this.uiManager.showPage('setup');
        
        if (error.userMessage) {
          this.uiManager.showError('Media Access Error', error.userMessage);
        }
      }
    } catch (error) {
      console.error('Unexpected error preparing for meeting:', error);
      this.uiManager.hideLoading();
      this.uiManager.showError('Setup Error', 'Failed to prepare meeting. Please refresh and try again.');
    }
  }

  async joinMeeting() {
    try {
      // Get username
      this.state.username = this.uiManager.getUsername();
      if (!this.state.username) {
        this.uiManager.showNotification('Please enter your name', 'warning');
        return;
      }

      if (!this.state.roomId) {
        this.uiManager.showError('Error', 'Missing room ID. Please try again.');
        return;
      }

      this.uiManager.showLoading('Joining meeting...');

      this.state.isInMeeting = true;

      // Initialize WebRTC manager
      this.webrtcManager = new WebRTCManager(this.socket);

      // Emit join event
      this.socket.emit('join-room', {
        roomId: this.state.roomId,
        username: this.state.username,
        userId: this.state.userId,
        isHost: this.state.isHost
      });

      // Add local stream to UI
      if (this.state.localStream) {
        this.uiManager.addLocalStream(this.state.localStream, this.state.username);
      }

      // Update media button states
      const mediaState = this.mediaManager.getMediaState();
      this.uiManager.setMicButtonState(mediaState.microphone);
      this.uiManager.setCameraButtonState(mediaState.camera);

      // Show meeting page
      this.uiManager.showPage('meeting');
      this.uiManager.hideLoading();

      // Start meeting timer
      this.uiManager.startMeetingTimer();

      // Send initial media state
      this.sendMediaState();

      console.log(`Joined meeting ${this.state.roomId} as ${this.state.username}`);
      this.uiManager.showNotification('Joined meeting successfully', 'success');
    } catch (error) {
      console.error('Error joining meeting:', error);
      this.uiManager.showError('Error', 'Failed to join meeting. Please try again.');
      this.uiManager.hideLoading();
    }
  }

  async leaveMeeting() {
    if (!this.state.isInMeeting) return;

    try {
      // Emit leave event
      this.socket.emit('leave-room', {
        roomId: this.state.roomId,
        username: this.state.username
      });

      // Clean up
      await this.cleanupMeeting();

      // Update state
      this.state.isInMeeting = false;
      this.state.roomId = null;
      this.state.username = null;
      this.state.isHost = false;

      // Show landing page
      this.uiManager.showPage('landing');
      this.uiManager.showNotification('Left meeting', 'info');
    } catch (error) {
      console.error('Error leaving meeting:', error);
    }
  }

  async endMeeting() {
    if (!this.state.isHost) {
      this.uiManager.showNotification('Only the host can end the meeting', 'warning');
      return;
    }

    if (confirm('Are you sure you want to end the meeting for all participants?')) {
      // Emit end meeting event
      this.socket.emit('end-meeting', { roomId: this.state.roomId });
      
      // Clean up
      await this.cleanupMeeting();
      
      // Update state
      this.state.isInMeeting = false;
      this.state.roomId = null;
      this.state.username = null;
      this.state.isHost = false;
      
      // Show landing page
      this.uiManager.showPage('landing');
      this.uiManager.showNotification('Meeting ended', 'info');
    }
  }

  backToLanding() {
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
      
      // Update local video tile
      this.updateLocalMediaIndicators();
      
      // Notify others
      this.sendMediaState();
    } catch (error) {
      console.error('Error toggling camera:', error);
      this.uiManager.showNotification('Failed to toggle camera', 'error');
    }
  }

  async toggleMicrophone() {
    try {
      const currentState = this.mediaManager.getMediaState();
      const newState = !currentState.microphone;
      
      this.mediaManager.toggleAudio(newState);
      this.uiManager.setMicButtonState(newState);
      
      // Update local media indicators
      this.updateLocalMediaIndicators();
      
      // Notify others
      this.sendMediaState();
    } catch (error) {
      console.error('Error toggling microphone:', error);
      this.uiManager.showNotification('Failed to toggle microphone', 'error');
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
      
      // Update preview and meeting video
      this.uiManager.updateVideoPreview(this.state.localStream);
      
      // Update WebRTC tracks
      if (this.webrtcManager) {
        this.webrtcManager.updateLocalStream(this.state.localStream);
      }
    } catch (error) {
      console.error('Error switching camera:', error);
      this.uiManager.showNotification('Failed to switch camera', 'error');
    }
  }

  async switchMicrophone(deviceId) {
    try {
      await this.mediaManager.switchMicrophone(deviceId);
      this.state.localStream = this.mediaManager.localStream;
      
      // Update WebRTC tracks
      if (this.webrtcManager) {
        this.webrtcManager.updateLocalStream(this.state.localStream);
      }
    } catch (error) {
      console.error('Error switching microphone:', error);
      this.uiManager.showNotification('Failed to switch microphone', 'error');
    }
  }

  async toggleScreenShare() {
    try {
      if (this.state.isScreenSharing) {
        this.mediaManager.stopScreenShare();
        this.state.isScreenSharing = false;
        this.uiManager.showNotification('Screen sharing stopped', 'info');
        
        // Emit event
        this.socket.emit('stop-screen-share', {
          roomId: this.state.roomId,
          username: this.state.username
        });
      } else {
        const screenStream = await this.mediaManager.startScreenShare();
        this.state.isScreenSharing = true;
        this.uiManager.showNotification('Screen sharing started', 'success');
        
        // Emit event
        this.socket.emit('start-screen-share', {
          roomId: this.state.roomId,
          username: this.state.username
        });
        
        // TODO: Handle screen stream in WebRTC
      }
    } catch (error) {
      console.error('Error toggling screen share:', error);
      this.uiManager.showNotification('Failed to start screen sharing', 'error');
    }
  }

  async toggleRecording() {
    if (!this.state.isHost) {
      this.uiManager.showNotification('Only the host can record the meeting', 'warning');
      return;
    }

    this.state.isRecording = !this.state.isRecording;
    
    if (this.state.isRecording) {
      this.uiManager.showNotification('Recording started', 'success');
      // TODO: Implement recording
    } else {
      this.uiManager.showNotification('Recording stopped', 'info');
    }
  }

  updateLocalMediaIndicators() {
    const mediaState = this.mediaManager.getMediaState();
    this.uiManager.updateMediaIndicator('local', mediaState);
  }

  sendMediaState() {
    if (this.state.isInMeeting) {
      const mediaState = this.mediaManager.getMediaState();
      this.socket.emit('media-state', {
        roomId: this.state.roomId,
        mediaState
      });
    }
  }

  // ==================== CHAT ====================
  sendChatMessage() {
    const message = this.uiManager.getChatInput();
    if (!message.trim()) return;

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
  copyMeetingLink() {
    if (this.state.roomId) {
      const link = this.uiManager.generateMeetingLink(this.state.roomId);
      this.uiManager.copyToClipboard(link);
    }
  }

  copyInviteLink() {
    const link = document.getElementById('invite-link').value;
    this.uiManager.copyToClipboard(link);
  }

  showInviteModal() {
    if (this.state.roomId) {
      this.uiManager.updateShareLink(this.state.roomId);
      this.uiManager.showModal('invite-modal');
    }
  }

  showSettings() {
    // TODO: Implement settings modal
    this.uiManager.showNotification('Settings feature coming soon', 'info');
  }

  // ==================== SOCKET HANDLERS ====================
  async handleUserJoined(data) {
    console.log(`${data.username} joined the meeting`);
    this.uiManager.showNotification(`${data.username} joined the meeting`, 'info');

    // Create offer for new user
    if (this.state.isInMeeting && this.state.localStream) {
      try {
        await this.webrtcManager.createOffer(data.socketId, this.state.localStream);
      } catch (error) {
        console.error('Error creating offer:', error);
      }
    }
  }

  async handleExistingUsers(users) {
    for (const user of users) {
      if (this.state.isInMeeting && this.state.localStream) {
        try {
          await this.webrtcManager.createOffer(user.socketId, this.state.localStream);
        } catch (error) {
          console.error('Error creating offer for existing user:', error);
        }
      }
    }
  }

  handleUserLeft(data) {
    console.log(`${data.username} left the meeting`);
    this.uiManager.showNotification(`${data.username} left the meeting`, 'info');
    
    // Remove peer connection
    if (this.webrtcManager) {
      this.webrtcManager.removePeerConnection(data.socketId);
      this.uiManager.removeRemoteStream(data.socketId);
    }
  }

  updateRemoteUserMediaState(data) {
    this.uiManager.updateMediaIndicator(data.socketId, data.mediaState);
  }

  // ==================== UTILITIES ====================
  adjustVideoGrid() {
    // Adjust video grid layout based on number of participants
    const participantCount = this.state.participants.size;
    
    // This is a simplified example - you can implement more sophisticated layout logic
    if (participantCount <= 2) {
      document.getElementById('video-grid').style.gridTemplateColumns = 'repeat(1, 1fr)';
    } else if (participantCount <= 4) {
      document.getElementById('video-grid').style.gridTemplateColumns = 'repeat(2, 1fr)';
    } else {
      document.getElementById('video-grid').style.gridTemplateColumns = 'repeat(auto-fit, minmax(300px, 1fr))';
    }
  }

  async cleanupMeeting() {
    // Stop all media
    this.mediaManager.stopLocalStream();
    
    // Close all WebRTC connections
    if (this.webrtcManager) {
      this.webrtcManager.closeAllConnections();
    }
    
    // Clear UI
    this.uiManager.clearAll();
    
    // Stop timer
    this.uiManager.stopMeetingTimer();
  }

  cleanupBeforeUnload() {
    if (this.state.isInMeeting) {
      // Leave meeting before unload
      this.socket.emit('leave-room', {
        roomId: this.state.roomId,
        username: this.state.username
      });
    }
  }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  window.app = new App();
});