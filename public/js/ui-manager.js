// UI Manager - Handles all UI interactions and updates
class UIManager {
  constructor() {
    this.remoteStreams = new Map();
    this.participants = new Map();
    this.currentPage = 'landing';
    this.isChatOpen = false;
    this.isParticipantsOpen = false;
    this.unreadMessages = 0;
    this.meetingStartTime = null;
    this.meetingTimer = null;
    this.activeSpeakerId = null;
  }

  // ==================== PAGE MANAGEMENT ====================
  showPage(pageName) {
    // Hide all pages
    document.querySelectorAll('.page').forEach(page => {
      page.classList.add('hidden');
    });

    // Show selected page
    const page = document.getElementById(`${pageName}-page`);
    if (page) {
      page.classList.remove('hidden');
      this.currentPage = pageName;
      console.log(`Showing page: ${pageName}`);
    }
  }

  showLoading(text = 'Loading...') {
    const loadingOverlay = document.getElementById('loading-overlay');
    const loadingText = document.getElementById('loading-text');
    
    loadingText.textContent = text;
    loadingOverlay.classList.remove('hidden');
  }

  hideLoading() {
    document.getElementById('loading-overlay').classList.add('hidden');
  }

  showNotification(message, type = 'info', duration = 5000) {
    const notificationArea = document.getElementById('notification-area');
    
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
      <div class="notification-content">
        <i class="fas fa-${this.getNotificationIcon(type)}"></i>
        <span>${message}</span>
      </div>
    `;
    
    notificationArea.appendChild(notification);
    
    // Auto remove after duration
    setTimeout(() => {
      notification.remove();
    }, duration);
    
    return notification;
  }

  getNotificationIcon(type) {
    switch(type) {
      case 'success': return 'check-circle';
      case 'error': return 'exclamation-circle';
      case 'warning': return 'exclamation-triangle';
      default: return 'info-circle';
    }
  }

  showModal(modalId) {
    const modal = document.getElementById(modalId);
    const overlay = document.getElementById('modal-overlay');
    
    if (modal && overlay) {
      overlay.classList.remove('hidden');
      modal.classList.remove('hidden');
    }
  }

  hideModal(modalId) {
    const modal = document.getElementById(modalId);
    const overlay = document.getElementById('modal-overlay');
    
    if (modal && overlay) {
      overlay.classList.add('hidden');
      modal.classList.add('hidden');
    }
  }

  showError(title, message) {
    document.getElementById('error-title').textContent = title;
    document.getElementById('error-message').textContent = message;
    this.showModal('error-modal');
  }

  hideError() {
    this.hideModal('error-modal');
  }

  // ==================== SETUP PAGE ====================
  populateDeviceSelects(devices) {
    const cameraSelect = document.getElementById('camera-select');
    const micSelect = document.getElementById('microphone-select');
    
    // Clear existing options
    cameraSelect.innerHTML = '';
    micSelect.innerHTML = '';
    
    // Update device counts
    const cameraCount = document.getElementById('camera-count');
    const micCount = document.getElementById('microphone-count');
    
    if (cameraCount) {
      cameraCount.textContent = devices.videoinput.length > 0 
        ? `(${devices.videoinput.length})` 
        : '(0)';
    }
    if (micCount) {
      micCount.textContent = devices.audioinput.length > 0 
        ? `(${devices.audioinput.length})` 
        : '(0)';
    }
    
    // Add camera options
    if (devices.videoinput.length === 0) {
      const option = document.createElement('option');
      option.textContent = 'No cameras found';
      option.disabled = true;
      cameraSelect.appendChild(option);
      cameraSelect.disabled = true;
    } else {
      devices.videoinput.forEach((device, index) => {
        const option = document.createElement('option');
        option.value = device.deviceId;
        option.textContent = device.label || `Camera ${index + 1}`;
        cameraSelect.appendChild(option);
      });
      cameraSelect.disabled = false;
    }
    
    // Add microphone options
    if (devices.audioinput.length === 0) {
      const option = document.createElement('option');
      option.textContent = 'No microphones found';
      option.disabled = true;
      micSelect.appendChild(option);
      micSelect.disabled = true;
    } else {
      devices.audioinput.forEach((device, index) => {
        const option = document.createElement('option');
        option.value = device.deviceId;
        option.textContent = device.label || `Microphone ${index + 1}`;
        micSelect.appendChild(option);
      });
      micSelect.disabled = false;
    }
  }

  // Update camera/microphone status indicators on setup page
  updateMediaStatusBadges(mediaState) {
    const cameraStatus = document.getElementById('camera-status');
    const micStatus = document.getElementById('microphone-status');

    if (cameraStatus) {
      if (mediaState.camera) {
        cameraStatus.classList.remove('status-inactive');
        cameraStatus.classList.add('status-active');
        cameraStatus.innerHTML = '<i class="fas fa-circle"></i> Camera On';
      } else {
        cameraStatus.classList.remove('status-active');
        cameraStatus.classList.add('status-inactive');
        cameraStatus.innerHTML = '<i class="fas fa-circle-slash"></i> Camera Off';
      }
    }

    if (micStatus) {
      if (mediaState.microphone) {
        micStatus.classList.remove('status-inactive');
        micStatus.classList.add('status-active');
        micStatus.innerHTML = '<i class="fas fa-circle"></i> Mic On';
      } else {
        micStatus.classList.remove('status-active');
        micStatus.classList.add('status-inactive');
        micStatus.innerHTML = '<i class="fas fa-circle-slash"></i> Mic Off';
      }
    }
  }

  // Show media access alert
  showMediaAlert(message) {
    const alert = document.getElementById('media-status-alert');
    const msg = document.getElementById('media-status-message');
    
    if (alert && msg) {
      msg.textContent = message;
      alert.style.display = 'flex';
      
      // Auto-hide after 8 seconds
      setTimeout(() => {
        alert.style.display = 'none';
      }, 8000);
    }
  }

  // Hide media access alert
  hideMediaAlert() {
    const alert = document.getElementById('media-status-alert');
    if (alert) {
      alert.style.display = 'none';
    }
  }

  updateVideoPreview(stream) {
    const video = document.getElementById('setup-video');
    if (video) {
      video.srcObject = stream;
    }
  }

  setRoomId(roomId) {
    const roomIdDisplay = document.getElementById('room-id-display');
    if (roomIdDisplay) {
      roomIdDisplay.textContent = roomId;
    }
  }

  updateShareLink(roomId) {
    const shareInput = document.getElementById('share-link-input');
    const inviteLink = document.getElementById('invite-link');
    
    const link = this.generateMeetingLink(roomId);
    
    if (shareInput) shareInput.value = link;
    if (inviteLink) inviteLink.value = link;
  }

  // ==================== MEETING PAGE ====================
  addLocalStream(stream, username) {
    const videoGrid = document.getElementById('video-grid');
    
    // Remove existing local video if any
    const existingLocal = document.getElementById('local-video-tile');
    if (existingLocal) {
      existingLocal.remove();
    }
    
    const tile = this.createVideoTile('local', stream, username, true);
    tile.id = 'local-video-tile';
    // Ensure max tiles (1 local + up to 2 remote) => total 3
    this.ensureMaxTiles(3);
    videoGrid.appendChild(tile);
    
    // Add to participants list
    this.addParticipant('local', username, true, true, true);
  }

  addRemoteStream(peerId, stream, username = 'Guest') {
    const videoGrid = document.getElementById('video-grid');
    
    // Remove existing remote video if any
    const existingRemote = document.getElementById(`remote-video-tile-${peerId}`);
    if (existingRemote) {
      existingRemote.remove();
    }
    
    const tile = this.createVideoTile(peerId, stream, username, false);
    tile.id = `remote-video-tile-${peerId}`;
    // Ensure max tiles (1 local + up to 2 remote) => total 3
    this.ensureMaxTiles(3);
    videoGrid.appendChild(tile);
    
    // Add to participants list
    this.addParticipant(peerId, username, false, true, true);
    
    this.remoteStreams.set(peerId, { stream, username });
  }

  createVideoTile(id, stream, username, isLocal) {
    const tile = document.createElement('div');
    tile.className = 'video-tile';
    
    const video = document.createElement('video');
    video.srcObject = stream;
    video.autoplay = true;
    video.playsinline = true;
    video.muted = isLocal;
    
    const overlay = document.createElement('div');
    overlay.className = 'video-tile-overlay';
    
    const userNameSpan = document.createElement('span');
    userNameSpan.className = 'user-name';
    userNameSpan.innerHTML = `
      <i class="fas fa-user"></i>
      ${username} ${isLocal ? '(You)' : ''}
    `;
    
    const mediaIndicator = document.createElement('div');
    mediaIndicator.className = 'media-indicator';
    mediaIndicator.id = `media-indicator-${id}`;
    mediaIndicator.innerHTML = `
      <i class="fas fa-microphone"></i>
      <i class="fas fa-video"></i>
    `;
    
    overlay.appendChild(userNameSpan);
    overlay.appendChild(mediaIndicator);
    
    tile.appendChild(video);
    tile.appendChild(overlay);
    
    return tile;
  }

  removeRemoteStream(peerId) {
    const tile = document.getElementById(`remote-video-tile-${peerId}`);
    if (tile) {
      tile.remove();
    }
    
    this.removeParticipant(peerId);
    this.remoteStreams.delete(peerId);
  }

  // Ensure the video grid does not exceed `max` tiles.
  // Keeps the local tile and removes oldest remote tiles first.
  ensureMaxTiles(max = 3) {
    const videoGrid = document.getElementById('video-grid');
    if (!videoGrid) return;

    const tiles = Array.from(videoGrid.children);
    while (tiles.length >= max) {
      // Find oldest removable tile (first that's not local)
      const removable = tiles.find(t => t.id !== 'local-video-tile');
      if (!removable) break; // only local remains

      // Extract peerId from id attribute if possible
      const match = removable.id && removable.id.match(/remote-video-tile-(.+)/);
      if (match && match[1]) {
        const peerId = match[1];
        // Remove UI tile
        removable.remove();
        // Remove from internal maps
        this.remoteStreams.delete(peerId);
        this.removeParticipant(peerId);
      } else {
        // Fallback: just remove the element
        removable.remove();
      }

      // Recompute tiles
      const remaining = Array.from(videoGrid.children);
      tiles.length = 0;
      tiles.push(...remaining);
    }
  }

  updateMediaIndicator(peerId, mediaState) {
    const indicator = document.getElementById(`media-indicator-${peerId}`);
    if (indicator) {
      const micIcon = indicator.querySelector('.fa-microphone');
      const videoIcon = indicator.querySelector('.fa-video');
      
      if (micIcon) {
        micIcon.style.color = mediaState.microphone ? 'white' : 'var(--danger)';
      }
      if (videoIcon) {
        videoIcon.style.color = mediaState.camera ? 'white' : 'var(--danger)';
      }
    }
  }

  setActiveSpeaker(peerId, username) {
    if (this.activeSpeakerId !== peerId) {
      this.activeSpeakerId = peerId;
      
      const activeSpeaker = document.getElementById('active-speaker');
      const speakerName = document.getElementById('active-speaker-name');
      
      if (activeSpeaker && speakerName) {
        speakerName.textContent = username;
        activeSpeaker.classList.remove('hidden');
      }
    }
  }

  clearActiveSpeaker() {
    this.activeSpeakerId = null;
    document.getElementById('active-speaker').classList.add('hidden');
  }

  // ==================== PARTICIPANTS MANAGEMENT ====================
  addParticipant(id, username, isLocal = false, isAudioOn = true, isVideoOn = true) {
    const participant = {
      id,
      username,
      isLocal,
      isAudioOn,
      isVideoOn,
      joinedAt: new Date()
    };
    
    this.participants.set(id, participant);
    this.updateParticipantsList();
    this.updateParticipantCount();
  }

  removeParticipant(id) {
    this.participants.delete(id);
    this.updateParticipantsList();
    this.updateParticipantCount();
  }

  updateParticipantMedia(id, mediaState) {
    const participant = this.participants.get(id);
    if (participant) {
      participant.isAudioOn = mediaState.microphone;
      participant.isVideoOn = mediaState.camera;
      this.updateParticipantsList();
    }
  }

  updateParticipantsList() {
    const participantsList = document.getElementById('participants-list');
    if (!participantsList) return;
    
    participantsList.innerHTML = '';
    
    this.participants.forEach((participant, id) => {
      const item = document.createElement('div');
      item.className = 'participant-item';
      
      const avatar = participant.username.charAt(0).toUpperCase();
      
      item.innerHTML = `
        <div class="participant-avatar">${avatar}</div>
        <div class="participant-info">
          <div class="participant-name">
            ${participant.username} ${participant.isLocal ? '(You)' : ''}
          </div>
          <div class="participant-role">
            ${participant.isLocal ? 'Host' : 'Participant'}
          </div>
        </div>
        <div class="participant-status">
          <i class="fas fa-microphone ${participant.isAudioOn ? 'active' : 'muted'}"></i>
          <i class="fas fa-video ${participant.isVideoOn ? 'active' : 'muted'}"></i>
        </div>
      `;
      
      participantsList.appendChild(item);
    });
  }

  updateParticipantCount() {
    const count = this.participants.size;
    
    const countElements = [
      document.getElementById('participant-count'),
      document.getElementById('participants-count'),
      document.getElementById('participants-badge')
    ];
    
    countElements.forEach(element => {
      if (element) element.textContent = count;
    });
  }

  // ==================== CHAT ====================
  toggleChat(forceOpen) {
    const chatPanel = document.getElementById('chat-panel');
    
    if (forceOpen !== undefined) {
      this.isChatOpen = forceOpen;
    } else {
      this.isChatOpen = !this.isChatOpen;
    }
    
    if (this.isChatOpen) {
      chatPanel.classList.remove('hidden');
      this.unreadMessages = 0;
      this.updateChatNotification();
    } else {
      chatPanel.classList.add('hidden');
    }
  }

  toggleParticipants(forceOpen) {
    const participantsPanel = document.getElementById('participants-panel');
    
    if (forceOpen !== undefined) {
      this.isParticipantsOpen = forceOpen;
    } else {
      this.isParticipantsOpen = !this.isParticipantsOpen;
    }
    
    if (this.isParticipantsOpen) {
      participantsPanel.classList.remove('hidden');
    } else {
      participantsPanel.classList.add('hidden');
    }
  }

  addChatMessage(username, message, timestamp, isOwn = false) {
    const messagesContainer = document.getElementById('chat-messages');
    
    // Remove welcome message if it exists
    const welcomeMessage = messagesContainer.querySelector('.welcome-message');
    if (welcomeMessage) {
      welcomeMessage.remove();
    }
    
    const messageDiv = document.createElement('div');
    messageDiv.className = `chat-message ${isOwn ? 'own' : ''}`;
    
    const time = timestamp ? new Date(timestamp).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit'
    }) : new Date().toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
    
    messageDiv.innerHTML = `
      <div class="chat-message-header">
        <span class="chat-message-username">${username}</span>
        <span class="chat-message-time">${time}</span>
      </div>
      <div class="chat-message-text">${this.escapeHtml(message)}</div>
    `;
    
    messagesContainer.appendChild(messageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
    
    // Increment unread messages if chat is not open
    if (!this.isChatOpen && !isOwn) {
      this.unreadMessages++;
      this.updateChatNotification();
    }
  }

  updateChatNotification() {
    const badge = document.getElementById('chat-notification');
    if (badge) {
      if (this.unreadMessages > 0) {
        badge.textContent = this.unreadMessages;
        badge.classList.remove('hidden');
      } else {
        badge.classList.add('hidden');
      }
    }
  }

  // ==================== MEDIA CONTROLS ====================
  setMicButtonState(enabled) {
    const btn = document.getElementById('btn-toggle-mic');
    const label = btn.querySelector('.control-label');
    
    if (enabled) {
      btn.classList.add('btn-control-active');
      label.textContent = 'Mute';
      btn.title = 'Mute microphone';
    } else {
      btn.classList.remove('btn-control-active');
      label.textContent = 'Unmute';
      btn.title = 'Unmute microphone';
    }
  }

  setCameraButtonState(enabled) {
    const btn = document.getElementById('btn-toggle-camera');
    const label = btn.querySelector('.control-label');
    
    if (enabled) {
      btn.classList.add('btn-control-active');
      label.textContent = 'Stop Video';
      btn.title = 'Turn camera off';
    } else {
      btn.classList.remove('btn-control-active');
      label.textContent = 'Start Video';
      btn.title = 'Turn camera on';
    }
  }

  setSetupCameraButtonState(enabled) {
    const btn = document.getElementById('toggle-camera-setup');
    
    if (enabled) {
      btn.classList.add('btn-control-active');
      btn.title = 'Turn camera off';
    } else {
      btn.classList.remove('btn-control-active');
      btn.title = 'Turn camera on';
    }
  }

  setSetupMicButtonState(enabled) {
    const btn = document.getElementById('toggle-mic-setup');
    
    if (enabled) {
      btn.classList.add('btn-control-active');
      btn.title = 'Mute microphone';
    } else {
      btn.classList.remove('btn-control-active');
      btn.title = 'Unmute microphone';
    }
  }

  // ==================== MEETING TIMER ====================
  startMeetingTimer() {
    this.meetingStartTime = new Date();
    
    this.meetingTimer = setInterval(() => {
      this.updateMeetingTimer();
    }, 1000);
  }

  stopMeetingTimer() {
    if (this.meetingTimer) {
      clearInterval(this.meetingTimer);
      this.meetingTimer = null;
    }
  }

  updateMeetingTimer() {
    if (!this.meetingStartTime) return;
    
    const now = new Date();
    const diff = Math.floor((now - this.meetingStartTime) / 1000);
    
    const hours = Math.floor(diff / 3600);
    const minutes = Math.floor((diff % 3600) / 60);
    const seconds = diff % 60;
    
    const timerElement = document.getElementById('meeting-timer');
    if (timerElement) {
      if (hours > 0) {
        timerElement.textContent = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
      } else {
        timerElement.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
      }
    }
  }

  // ==================== UTILITIES ====================
  generateMeetingLink(roomId) {
    const baseUrl = window.location.origin;
    // Support both ?room= and /room/ formats
    return `${baseUrl}/?room=${roomId}`;
  }

  async copyToClipboard(text) {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
      } else {
        // Fallback for older browsers or non-HTTPS
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      this.showNotification('✓ Copied to clipboard!', 'success');
      return true;
    } catch (error) {
      console.error('Failed to copy:', error);
      this.showNotification('Failed to copy to clipboard', 'error');
      return false;
    }
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  getUsername() {
    const input = document.getElementById('username-input');
    return input ? input.value.trim() || 'Guest' : 'Guest';
  }

  getChatInput() {
    const input = document.getElementById('chat-input');
    return input ? input.value.trim() : '';
  }

  clearChatInput() {
    const input = document.getElementById('chat-input');
    if (input) input.value = '';
  }

  getSelectedCamera() {
    const select = document.getElementById('camera-select');
    return select ? select.value : null;
  }

  getSelectedMicrophone() {
    const select = document.getElementById('microphone-select');
    return select ? select.value : null;
  }

  // ==================== CLEANUP ====================
  clearAll() {
    // Clear video grid
    const videoGrid = document.getElementById('video-grid');
    if (videoGrid) videoGrid.innerHTML = '';
    
    // Clear chat
    const chatMessages = document.getElementById('chat-messages');
    if (chatMessages) chatMessages.innerHTML = '';
    
    // Clear participants
    const participantsList = document.getElementById('participants-list');
    if (participantsList) participantsList.innerHTML = '';
    
    // Reset state
    this.remoteStreams.clear();
    this.participants.clear();
    this.unreadMessages = 0;
    this.activeSpeakerId = null;
    
    // Stop timer
    this.stopMeetingTimer();
  }

  // ==================== FULLSCREEN ====================
  toggleFullscreen() {
    const elem = document.documentElement;
    
    if (!document.fullscreenElement) {
      elem.requestFullscreen().catch(err => {
        console.error(`Error attempting to enable fullscreen: ${err.message}`);
        this.showNotification('Failed to enter fullscreen', 'error');
      });
    } else {
      document.exitFullscreen();
    }
  }
}

// Export for ES6 modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = UIManager;
}