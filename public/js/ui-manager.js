// UI Manager - Handles all UI interactions and updates
class UIManager {
  constructor() {
    this.remoteStreams = new Map();
    this.currentPage = 'landing';
    this.isChatOpen = false;
    this.messageCount = 0;
    this.activeSpeaker = null;
    this.usernames = new Map();
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
    document.getElementById('loading-overlay').classList.remove('hidden');
    document.getElementById('loading-text').textContent = text;
  }

  hideLoading() {
    document.getElementById('loading-overlay').classList.add('hidden');
  }

  showError(title, message) {
    document.getElementById('error-title').textContent = title;
    document.getElementById('error-text').textContent = message;
    document.getElementById('error-modal').classList.remove('hidden');
  }

  hideError() {
    document.getElementById('error-modal').classList.add('hidden');
  }

  showToast(message, duration = 3000) {
    const toast = document.getElementById('meeting-toast');
    document.getElementById('toast-message').textContent = message;
    toast.classList.remove('hidden');

    setTimeout(() => {
      toast.classList.add('hidden');
    }, duration);
  }

  // ==================== SETUP PAGE ====================
  populateDeviceSelects(devices) {
    const cameraSelect = document.getElementById('camera-select');
    const micSelect = document.getElementById('microphone-select');

    // Populate cameras
    cameraSelect.innerHTML = '';
    devices.videoinput.forEach(device => {
      const option = document.createElement('option');
      option.value = device.deviceId;
      option.textContent = device.label || `Camera ${devices.videoinput.indexOf(device) + 1}`;
      cameraSelect.appendChild(option);
    });

    // Populate mics
    micSelect.innerHTML = '';
    devices.audioinput.forEach(device => {
      const option = document.createElement('option');
      option.value = device.deviceId;
      option.textContent = device.label || `Microphone ${devices.audioinput.indexOf(device) + 1}`;
      micSelect.appendChild(option);
    });
  }

  updateVideoPreview(stream) {
    const video = document.getElementById('setup-video');
    video.srcObject = stream;
  }

  getSelectedDevices() {
    return {
      videoDeviceId: document.getElementById('camera-select').value,
      audioDeviceId: document.getElementById('microphone-select').value
    };
  }

  getUsername() {
    return document.getElementById('username-input').value.trim() || 'Guest';
  }

  // ==================== VIDEO GRID ====================
  addLocalStream(stream, username) {
    const videoGrid = document.getElementById('video-grid');
    
    // Remove existing local video if any
    const existingLocal = document.getElementById('local-video');
    if (existingLocal) {
      existingLocal.remove();
    }

    const tile = document.createElement('div');
    tile.id = 'local-video';
    tile.className = 'video-tile small';

    const video = document.createElement('video');
    video.srcObject = stream;
    video.autoplay = true;
    video.muted = true;
    video.playsinline = true;

    const overlay = document.createElement('div');
    overlay.className = 'video-tile-overlay';
    overlay.innerHTML = `
      <span class="media-indicator">
        <span class="media-badge"></span>
        ${username} (You)
      </span>
    `;

    tile.appendChild(video);
    tile.appendChild(overlay);
    videoGrid.appendChild(tile);

    this.usernames.set('local', { username, socketId: 'local' });
  }

  addRemoteStream(peerId, stream, username = 'User') {
    const videoGrid = document.getElementById('video-grid');

    // Check if tile already exists
    let tile = document.getElementById(`remote-video-${peerId}`);
    if (!tile) {
      tile = document.createElement('div');
      tile.id = `remote-video-${peerId}`;
      tile.className = 'video-tile';

      const video = document.createElement('video');
      video.id = `remote-video-element-${peerId}`;
      video.autoplay = true;
      video.playsinline = true;

      const overlay = document.createElement('div');
      overlay.className = 'video-tile-overlay';
      overlay.id = `overlay-${peerId}`;
      overlay.innerHTML = `
        <span class="media-indicator">
          <span class="media-badge"></span>
          <span class="username">${username}</span>
        </span>
      `;

      tile.appendChild(video);
      tile.appendChild(overlay);
      videoGrid.appendChild(tile);
    }

    // Update video stream
    const videoElement = document.getElementById(`remote-video-element-${peerId}`);
    if (videoElement) {
      videoElement.srcObject = stream;
    }

    this.remoteStreams.set(peerId, { stream, username });
    this.updateActiveSpeaker(peerId, username);
  }

  removeRemoteStream(peerId) {
    const tile = document.getElementById(`remote-video-${peerId}`);
    if (tile) {
      tile.remove();
    }
    this.remoteStreams.delete(peerId);

    // Clear active speaker if it was this user
    if (this.activeSpeaker === peerId) {
      this.activeSpeaker = null;
      document.getElementById('active-speaker-info').classList.add('hidden');
    }
  }

  updateActiveSpeaker(peerId, username) {
    // Simple active speaker detection (could be enhanced with volume analysis)
    if (this.activeSpeaker !== peerId) {
      this.activeSpeaker = peerId;
      const speakerInfo = document.getElementById('active-speaker-info');
      document.getElementById('speaker-name').textContent = username;
      speakerInfo.classList.remove('hidden');
    }
  }

  // ==================== MEDIA CONTROLS ====================
  setMicButtonState(enabled) {
    const btn = document.getElementById('btn-toggle-mic');
    if (enabled) {
      btn.classList.remove('muted');
      btn.classList.add('active');
      btn.title = 'Mute microphone';
    } else {
      btn.classList.add('muted');
      btn.classList.remove('active');
      btn.title = 'Unmute microphone';
    }
  }

  setCameraButtonState(enabled) {
    const btn = document.getElementById('btn-toggle-camera');
    if (enabled) {
      btn.classList.remove('muted');
      btn.classList.add('active');
      btn.title = 'Turn camera off';
    } else {
      btn.classList.add('muted');
      btn.classList.remove('active');
      btn.title = 'Turn camera on';
    }
  }

  setSetupMicButtonState(enabled) {
    const btn = document.getElementById('toggle-mic-setup');
    if (enabled) {
      btn.classList.add('btn-active');
      btn.classList.remove('btn-inactive');
      btn.querySelector('.label').textContent = 'Mic On';
    } else {
      btn.classList.remove('btn-active');
      btn.classList.add('btn-inactive');
      btn.querySelector('.label').textContent = 'Mic Off';
    }
  }

  setSetupCameraButtonState(enabled) {
    const btn = document.getElementById('toggle-camera-setup');
    if (enabled) {
      btn.classList.add('btn-active');
      btn.classList.remove('btn-inactive');
      btn.querySelector('.label').textContent = 'Camera On';
    } else {
      btn.classList.remove('btn-active');
      btn.classList.add('btn-inactive');
      btn.querySelector('.label').textContent = 'Camera Off';
    }
  }

  // ==================== CHAT ====================
  toggleChat(show) {
    const chatPanel = document.getElementById('chat-panel');
    if (show) {
      chatPanel.classList.remove('hidden');
      this.isChatOpen = true;
      this.messageCount = 0;
      this.updateChatBadge();
    } else {
      chatPanel.classList.add('hidden');
      this.isChatOpen = false;
    }
  }

  addChatMessage(username, message, timestamp, isOwn = false) {
    const messagesContainer = document.getElementById('chat-messages');

    const messageDiv = document.createElement('div');
    messageDiv.className = `chat-message ${isOwn ? 'own' : ''}`;

    const time = timestamp ? new Date(timestamp).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit'
    }) : new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    messageDiv.innerHTML = `
      <div class="chat-message-header">
        <span class="chat-message-username">${username}</span>
        <span class="chat-message-time">${time}</span>
      </div>
      <div class="chat-message-text">${this.escapeHtml(message)}</div>
    `;

    messagesContainer.appendChild(messageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;

    // Increment badge if chat not open
    if (!this.isChatOpen) {
      this.messageCount++;
      this.updateChatBadge();
    }
  }

  updateChatBadge() {
    const badge = document.getElementById('chat-notification-badge');
    if (this.messageCount > 0) {
      badge.textContent = this.messageCount;
      badge.classList.remove('hidden');
    } else {
      badge.classList.add('hidden');
    }
  }

  getChatInput() {
    return document.getElementById('chat-input').value.trim();
  }

  clearChatInput() {
    document.getElementById('chat-input').value = '';
  }

  // ==================== MEETING LINK ====================
  getMeetingLink(roomId) {
    const baseUrl = window.location.origin;
    return `${baseUrl}?room=${roomId}`;
  }

  copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
      const notification = document.getElementById('copy-notification');
      notification.classList.remove('hidden');
      setTimeout(() => {
        notification.classList.add('hidden');
      }, 2000);
    });
  }

  showMeetingLink(roomId) {
    const link = this.getMeetingLink(roomId);
    this.showToast(`Meeting link: ${link}`, 5000);
    this.copyToClipboard(link);
  }

  // ==================== ERROR HANDLING ====================
  showSetupError(message) {
    const errorDiv = document.getElementById('setup-error');
    errorDiv.textContent = message;
    errorDiv.classList.remove('hidden');

    setTimeout(() => {
      errorDiv.classList.add('hidden');
    }, 5000);
  }

  // ==================== FULLSCREEN ====================
  toggleFullscreen() {
    const elem = document.documentElement;
    
    if (!document.fullscreenElement) {
      elem.requestFullscreen().catch(err => {
        console.error(`Error attempting to enable fullscreen: ${err.message}`);
      });
    } else {
      document.exitFullscreen();
    }
  }

  // ==================== UTILITY ====================
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  clearAllRemoteStreams() {
    this.remoteStreams.forEach((_, peerId) => {
      this.removeRemoteStream(peerId);
    });
  }

  clearChat() {
    document.getElementById('chat-messages').innerHTML = '';
  }

  // Generate temporary user ID
  generateUserId() {
    return `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
