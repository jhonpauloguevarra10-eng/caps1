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
    });

    this.socket.on('disconnect', (reason) => {
      console.log('Disconnected from server:', reason);
      if (this.state.isInMeeting) {
        this.uiManager.showNotification('Lost connection to server', 'error');
      }
    });

    this.socket.on('connect_error', (error) => {
      console.error('Connection error:', error);
      if (this.state.isInMeeting) {
        this.uiManager.showError('Connection Error', 'Lost connection. Attempting to reconnect...');
      }
    });

    this.socket.on('reconnect', (attemptNumber) => {
      console.log('Reconnected after', attemptNumber, 'attempts');
      if (this.state.isInMeeting) {
        this.uiManager.showNotification('Reconnected!', 'success');
      }
    });

    this.socket.on('room-error', (data) => {
      console.error('Room error:', data.message);
      this.uiManager.hideLoading();
      this.state.isInMeeting = false; // Reset meeting state
      
      // User-friendly error messages
      let errorTitle = 'Cannot Join Meeting';
      let errorMsg = data.message;
      
      if (data.message.includes('does not exist')) {
        errorMsg = 'This meeting doesn\'t exist. Please ask the host to create a new meeting and share the link.';
      } else if (data.message.includes('ended')) {
        errorMsg = 'This meeting has ended. Please start a new meeting.';
      } else if (data.message.includes('already in')) {
        errorMsg = 'You are already in this meeting. Please close other windows.';
      }
      
      this.uiManager.showError(errorTitle, errorMsg);
      setTimeout(() => {
        this.uiManager.showPage('landing');
      }, 3000);
    });

    this.socket.on('room-full', (data) => {
      console.error('Room full:', data.message);
      this.uiManager.hideLoading();
      this.state.isInMeeting = false;
      this.uiManager.showError('Room Full', data.message || 'This meeting is full.');
      setTimeout(() => this.uiManager.showPage('landing'), 3000);
    });

    // Room events
    this.socket.on('room-created', (data) => {
      console.log('Host created room:', data);
      this.state.roomId = data.roomId;
      this.state.isHost = true;
      this.uiManager.showNotification('Meeting created successfully', 'success');
    });

    this.socket.on('room-joined', (data) => {
      console.log('Participant joined room:', data);
      this.state.roomId = data.roomId;
      this.state.isHost = data.isHost || false;
      this.uiManager.showNotification('Connected to meeting', 'success');
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
      // Try to create meeting on server so the link/code is valid for others
      try {
        const res = await fetch('/api/create-meeting');
        if (res.ok) {
          const json = await res.json();
          if (json && json.meetingId) {
            this.state.roomId = json.meetingId;
          }
        }
      } catch (err) {
        console.warn('Server create-meeting failed, falling back to client-generated ID', err);
      }

      // Fallback to client-generated ID if server didn't return one
      if (!this.state.roomId) {
        this.state.roomId = this.generateRoomId();
      }

      this.state.isHost = true;

      // Update UI with room ID and share link
      this.uiManager.setRoomId(this.state.roomId);
      this.uiManager.updateShareLink(this.state.roomId);

      // Prepare for meeting (enumerate devices, preview)
      await this.prepareForMeeting();

      // Auto-join as host so link becomes active immediately
      await this.joinMeeting();
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
    // Focus on the meeting link input for better UX
    const linkInput = document.getElementById('meeting-link-input');
    linkInput.value = '';
    linkInput.focus();
    
    // Scroll to input on mobile
    if (window.innerWidth < 768) {
      linkInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
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
        // URL with /room/ path
        const url = new URL(link.includes('://') ? link : `https://${link}`);
        const pathParts = url.pathname.split('/');
        roomId = pathParts[pathParts.length - 1];
      } else if (link.includes('room=')) {
        // Query parameter format (?room=CODE or full URL)
        try {
          const url = new URL(link.includes('://') ? link : `https://${link}`);
          roomId = url.searchParams.get('room');
        } catch (e) {
          // If URL parsing fails, try as direct code
          if (/^[A-Z0-9]{8}$/i.test(link)) {
            roomId = link.toUpperCase();
          }
        }
      } else if (link.includes('http')) {
        // Try parsing as full URL first
        try {
          const urlObj = new URL(link);
          roomId = urlObj.searchParams.get('room');
        } catch (e) {
          console.warn('Could not parse URL:', e);
        }
      }

      // If still no roomId, try direct 8-character code
      if (!roomId && /^[A-Z0-9]{8}$/i.test(link)) {
        roomId = link.toUpperCase();
      }
      
      if (!roomId) {
        throw new Error('Invalid meeting link format. Examples: CODE123AB, https://example.com/?room=CODE123AB, or https://example.com/room/CODE123AB');
      }

      // Validate room ID format
      if (!/^[A-Z0-9]{8}$/i.test(roomId)) {
        throw new Error('Invalid meeting code. Please use an 8-digit code.');
      }

      this.state.roomId = roomId.toUpperCase();
      this.state.isHost = false; // Joining as participant
      
      console.log(`Joining meeting from link: ${this.state.roomId}`);
      await this.prepareForMeeting();
      
      // Clear input after successful parsing
      document.getElementById('meeting-link-input').value = '';
    } catch (error) {
      console.error('Error joining from link:', error);
      this.uiManager.showError('Invalid Link', error.message || 'Please enter a valid meeting link or 8-digit code.');
    }
  }

  async prepareForMeeting() {
    try {
      this.uiManager.showLoading('Preparing meeting...');

      // Enumerate devices for selects (best-effort)
      try {
        const devices = await this.mediaManager.enumerateDevices();
        if (devices) this.uiManager.populateDeviceSelects(devices);
      } catch (err) {
        console.warn('Could not enumerate devices:', err);
      }

      // Attempt to get media with fallback strategy
      try {
        const stream = await this.mediaManager.getLocalStreamWithFallback();
        this.state.localStream = stream;

        const hasVideo = stream.getVideoTracks && stream.getVideoTracks().length > 0 && stream.getVideoTracks()[0].enabled;
        const hasAudio = stream.getAudioTracks && stream.getAudioTracks().length > 0 && stream.getAudioTracks()[0].enabled;

        // Update UI preview only if we have video
        if (hasVideo) {
          this.uiManager.updateVideoPreview(stream);
        }

        // Update media badges
        this.uiManager.updateMediaStatusBadges(this.mediaManager.getMediaState());

        // Show helpful alerts based on what is available
        if (!hasVideo && hasAudio) {
          this.uiManager.showMediaAlert('Camera access unavailable — joining with audio only');
          this.uiManager.showNotification('Camera access unavailable — joining with audio only', 'info');
        } else if (hasVideo && !hasAudio) {
          this.uiManager.showMediaAlert('Microphone access unavailable — joining with video only');
          this.uiManager.showNotification('Microphone access unavailable — joining with video only', 'warning');
        } else if (!hasVideo && !hasAudio) {
          this.uiManager.showMediaAlert('No camera or microphone available — you can still join as an observer');
          this.uiManager.showNotification('No camera or microphone available', 'warning');
        }
      } catch (err) {
        console.warn('Media access failed:', err);
        this.uiManager.showMediaAlert('Unable to access camera or microphone');
        this.uiManager.showNotification(err.message || 'Unable to access camera or microphone', 'error');
      }

      // Show setup page and focus username
      this.uiManager.showPage('setup');
      const usernameInput = document.getElementById('username-input');
      if (usernameInput) setTimeout(() => usernameInput.focus(), 300);

      // Update share link for hosts
      if (this.state.roomId && this.state.isHost) this.uiManager.updateShareLink(this.state.roomId);

      this.uiManager.hideLoading();
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
        this.uiManager.showError('Error', 'Missing meeting code. Please try again.');
        return;
      }

      // Check if socket is connected
      if (!this.socket.connected) {
        this.uiManager.showNotification('Connecting to server...', 'info');
        // Wait for socket connection
        await new Promise(resolve => {
          if (this.socket.connected) {
            resolve();
          } else {
            this.socket.once('connect', resolve);
          }
        });
      }

      this.uiManager.showLoading('Joining meeting...');
      this.state.isInMeeting = true;

      // Initialize WebRTC manager if not already done
      if (!this.webrtcManager) {
        this.webrtcManager = new WebRTCManager(this.socket);
      }

      // Add local stream to UI first
      if (this.state.localStream) {
        this.uiManager.addLocalStream(this.state.localStream, this.state.username);
      }

      // Update media button states before joining
      const mediaState = this.mediaManager.getMediaState();
      this.uiManager.setMicButtonState(mediaState.microphone);
      this.uiManager.setCameraButtonState(mediaState.camera);

      // Show meeting page immediately
      this.uiManager.showPage('meeting');
      this.uiManager.startMeetingTimer();
      // Update meeting page media indicators
      this.updateMeetingPageMediaStatus();

      // Emit join-room event to server
      console.log(`Emitting join-room for room ${this.state.roomId} as ${this.state.username}`);
      this.socket.emit('join-room', {
        roomId: this.state.roomId,
        username: this.state.username,
        userId: this.state.userId,
        isHost: this.state.isHost
      }, (error) => {
        if (error) {
          console.error('Server error on join:', error);
          this.uiManager.showError('Cannot Join', error);
          setTimeout(() => this.backToLanding(), 1500);
        }
      });

      // Hide loading after a short delay to allow data to flow
      setTimeout(() => {
        this.uiManager.hideLoading();
      }, 300);

      // Send initial media state
      this.sendMediaState();

      console.log(`Joined meeting ${this.state.roomId} as ${this.state.username}`);
      this.uiManager.showNotification('Joined meeting successfully', 'success');
    } catch (error) {
      console.error('Error joining meeting:', error);
      this.state.isInMeeting = false;
      this.uiManager.hideLoading();
      this.uiManager.showError('Error', 'Failed to join meeting. Please try again.');
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
      this.updateMeetingPageMediaStatus();
        this.updateMeetingPageMediaStatus();
      
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
      this.updateMeetingPageMediaStatus();
        this.updateMeetingPageMediaStatus();
      
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
      this.uiManager.updateMediaStatusBadges(this.mediaManager.getMediaState());
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
      this.uiManager.updateMediaStatusBadges(this.mediaManager.getMediaState());
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
      
      // Update status badges
      this.uiManager.updateMediaStatusBadges(this.mediaManager.getMediaState());
      this.uiManager.showMediaAlert('✓ Camera switched successfully');
      this.updateMeetingPageMediaStatus();
    } catch (error) {
      console.error('Error switching camera:', error);
      this.uiManager.showMediaAlert('✗ Failed to switch camera: ' + error.message);
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
      
      // Update status badges
      this.uiManager.updateMediaStatusBadges(this.mediaManager.getMediaState());
      this.uiManager.showMediaAlert('✓ Microphone switched successfully');
      this.updateMeetingPageMediaStatus();
    } catch (error) {
      console.error('Error switching microphone:', error);
      this.uiManager.showMediaAlert('✗ Failed to switch microphone: ' + error.message);
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

    updateMeetingPageMediaStatus() {
      const cameraIndicator = document.querySelector('.status-indicator[data-media="camera"]');
      const micIndicator = document.querySelector('.status-indicator[data-media="microphone"]');
    
      if (!cameraIndicator || !micIndicator) return;
    
      const mediaState = this.mediaManager.getMediaState();
      const hasVideo = mediaState.camera;
      const hasAudio = mediaState.microphone;
    
      if (cameraIndicator) {
        if (hasVideo) {
          cameraIndicator.classList.remove('status-off');
          cameraIndicator.innerHTML = '<i class="fas fa-video"></i>';
          cameraIndicator.title = 'Camera is on';
        } else {
          cameraIndicator.classList.add('status-off');
          cameraIndicator.innerHTML = '<i class="fas fa-video-slash"></i>';
          cameraIndicator.title = 'Camera is off';
        }
      }
    
      if (micIndicator) {
        if (hasAudio) {
          micIndicator.classList.remove('status-off');
          micIndicator.innerHTML = '<i class="fas fa-microphone"></i>';
          micIndicator.title = 'Microphone is on';
        } else {
          micIndicator.classList.add('status-off');
          micIndicator.innerHTML = '<i class="fas fa-microphone-slash"></i>';
          micIndicator.title = 'Microphone is off';
        }
      }
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
    const linkInput = document.getElementById('invite-link');
    if (linkInput && linkInput.value) {
      this.uiManager.copyToClipboard(linkInput.value);
    } else {
      this.uiManager.showNotification('No link to copy', 'warning');
    }
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
    console.log(`${data.username} (${data.socketId}) joined the meeting`);
    this.uiManager.showNotification(`${data.username} joined the meeting`, 'info');

    // Create offer for new user if we have local stream and WebRTC manager
    if (this.state.localStream && this.webrtcManager) {
      try {
        // Limit total peer connections to 2 remote peers (max 3 participants including local)
        const maxRemotePeers = 2;
        const currentRemotes = this.webrtcManager.getActiveConnections();
        if (currentRemotes < maxRemotePeers) {
          await this.webrtcManager.createOffer(data.socketId, this.state.localStream);
        } else {
          console.log('Max remote peers reached; not creating offer for', data.socketId);
        }
      } catch (error) {
        console.error('Error creating offer:', error);
      }
    }
  }

  async handleExistingUsers(users) {
    console.log('Creating offers for existing users:', users.length);
    if (!this.state.localStream || !this.webrtcManager) return;

    const maxRemotePeers = 2; // allow up to 2 remote peers
    let created = 0;

    for (const user of users) {
      // Respect maximum remote peers
      if (this.webrtcManager.getActiveConnections() + created >= maxRemotePeers) break;

      try {
        await this.webrtcManager.createOffer(user.socketId, this.state.localStream);
        created++;
      } catch (error) {
        console.error(`Error creating offer for user ${user.socketId}:`, error);
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