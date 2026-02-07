// WebRTC Manager - Handles peer connections and signaling
class WebRTCManager {
  constructor(socket) {
    this.socket = socket;
    this.peerConnections = new Map();
    this.dataChannels = new Map();
    this.remoteStreams = new Map();
    this.RTCPeerConnection = window.RTCPeerConnection || 
                           window.webkitRTCPeerConnection || 
                           window.mozRTCPeerConnection;
    
    if (!this.RTCPeerConnection) {
      throw new Error('WebRTC is not supported in this browser');
    }
  }

  // Create peer connection
  createPeerConnection(peerId, localStream, isInitiator = false) {
    try {
      console.log(`Creating peer connection with ${peerId}, initiator: ${isInitiator}`);
      
      const peerConnection = new this.RTCPeerConnection(RTC_CONFIG);
      
      // Add local stream tracks
      if (localStream) {
        localStream.getTracks().forEach(track => {
          if (track.kind === 'audio' && !this.hasAudioTrack(peerConnection)) {
            peerConnection.addTrack(track, localStream);
          } else if (track.kind === 'video' && !this.hasVideoTrack(peerConnection)) {
            peerConnection.addTrack(track, localStream);
          }
        });
        console.log('Added local tracks to peer connection');
      }

      // Create data channel for messaging
      if (isInitiator) {
        const dataChannel = peerConnection.createDataChannel('chat');
        this.setupDataChannel(peerId, dataChannel);
      }

      // Set up event handlers
      this.setupPeerConnectionEvents(peerId, peerConnection);

      this.peerConnections.set(peerId, peerConnection);
      console.log(`Peer connection created for ${peerId}`);
      
      return peerConnection;
    } catch (error) {
      console.error('Error creating peer connection:', error);
      throw error;
    }
  }

  // Set up peer connection event handlers
  setupPeerConnectionEvents(peerId, peerConnection) {
    // Handle remote stream
    peerConnection.ontrack = (event) => {
      console.log(`Received remote track from ${peerId}:`, event.track.kind);
      
      if (event.streams && event.streams[0]) {
        this.remoteStreams.set(peerId, event.streams[0]);
        
        // Notify UI manager
        if (window.app && window.app.uiManager) {
          window.app.uiManager.addRemoteStream(peerId, event.streams[0]);
        }
      }
    };

    // Handle ICE candidates
    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        console.log(`Sending ICE candidate to ${peerId}`);
        this.socket.emit('send-ice-candidate', {
          to: peerId,
          candidate: event.candidate
        });
      }
    };

    // Handle connection state
    peerConnection.onconnectionstatechange = () => {
      const state = peerConnection.connectionState;
      console.log(`Connection state with ${peerId}: ${state}`);
      
      switch(state) {
        case 'connected':
          console.log(`Connected to ${peerId}`);
          break;
        case 'disconnected':
        case 'failed':
          console.log(`Connection with ${peerId} failed`);
          this.removePeerConnection(peerId);
          break;
        case 'closed':
          console.log(`Connection with ${peerId} closed`);
          this.removePeerConnection(peerId);
          break;
      }
    };

    // Handle ICE connection state
    peerConnection.oniceconnectionstatechange = () => {
      console.log(`ICE state with ${peerId}: ${peerConnection.iceConnectionState}`);
    };

    // Handle data channel
    peerConnection.ondatachannel = (event) => {
      console.log(`Data channel received from ${peerId}`);
      this.setupDataChannel(peerId, event.channel);
    };
  }

  // Set up data channel
  setupDataChannel(peerId, dataChannel) {
    dataChannel.onopen = () => {
      console.log(`Data channel opened with ${peerId}`);
    };

    dataChannel.onclose = () => {
      console.log(`Data channel closed with ${peerId}`);
      this.dataChannels.delete(peerId);
    };

    dataChannel.onmessage = (event) => {
      console.log(`Message from ${peerId}:`, event.data);
      // Handle chat messages via data channel if needed
    };

    dataChannel.onerror = (error) => {
      console.error(`Data channel error with ${peerId}:`, error);
    };

    this.dataChannels.set(peerId, dataChannel);
  }

  // Create and send offer
  async createOffer(peerId, localStream) {
    try {
      console.log(`Creating offer for ${peerId}`);
      
      let peerConnection = this.peerConnections.get(peerId);
      if (!peerConnection) {
        peerConnection = this.createPeerConnection(peerId, localStream, true);
      }

      const offerOptions = {
        offerToReceiveAudio: true,
        offerToReceiveVideo: true
      };

      const offer = await peerConnection.createOffer(offerOptions);
      await peerConnection.setLocalDescription(offer);

      console.log(`Sending offer to ${peerId}`);
      this.socket.emit('send-offer', {
        to: peerId,
        offer: offer
      });

      return offer;
    } catch (error) {
      console.error('Error creating offer:', error);
      throw error;
    }
  }

  // Handle incoming offer
  async handleOffer(peerId, offer, localStream) {
    try {
      console.log(`Handling offer from ${peerId}`);
      
      let peerConnection = this.peerConnections.get(peerId);
      if (!peerConnection) {
        peerConnection = this.createPeerConnection(peerId, localStream, false);
      }

      await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));

      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);

      console.log(`Sending answer to ${peerId}`);
      this.socket.emit('send-answer', {
        to: peerId,
        answer: answer
      });

      return answer;
    } catch (error) {
      console.error('Error handling offer:', error);
      throw error;
    }
  }

  // Handle incoming answer
  async handleAnswer(peerId, answer) {
    try {
      console.log(`Handling answer from ${peerId}`);
      
      const peerConnection = this.peerConnections.get(peerId);
      if (peerConnection) {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
        console.log(`Answer processed for ${peerId}`);
      }
    } catch (error) {
      console.error('Error handling answer:', error);
      throw error;
    }
  }

  // Handle incoming ICE candidate
  async handleICECandidate(peerId, candidate) {
    try {
      console.log(`Handling ICE candidate from ${peerId}`);
      
      const peerConnection = this.peerConnections.get(peerId);
      if (peerConnection && candidate) {
        await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
        console.log(`ICE candidate added for ${peerId}`);
      }
    } catch (error) {
      console.error('Error handling ICE candidate:', error);
    }
  }

  // Send data via data channel
  sendData(peerId, data) {
    const dataChannel = this.dataChannels.get(peerId);
    if (dataChannel && dataChannel.readyState === 'open') {
      dataChannel.send(JSON.stringify(data));
    }
  }

  // Remove peer connection
  removePeerConnection(peerId) {
    const peerConnection = this.peerConnections.get(peerId);
    if (peerConnection) {
      peerConnection.close();
      this.peerConnections.delete(peerId);
      this.dataChannels.delete(peerId);
      this.remoteStreams.delete(peerId);
      console.log(`Peer connection removed for ${peerId}`);
    }
  }

  // Close all connections
  closeAllConnections() {
    this.peerConnections.forEach((pc, peerId) => {
      pc.close();
    });
    this.peerConnections.clear();
    this.dataChannels.clear();
    this.remoteStreams.clear();
    console.log('All peer connections closed');
  }

  // Helper methods
  hasAudioTrack(peerConnection) {
    return peerConnection.getSenders().some(
      sender => sender.track && sender.track.kind === 'audio'
    );
  }

  hasVideoTrack(peerConnection) {
    return peerConnection.getSenders().some(
      sender => sender.track && sender.track.kind === 'video'
    );
  }

  // Get connection stats
  async getStats(peerId) {
    try {
      const peerConnection = this.peerConnections.get(peerId);
      if (!peerConnection) return null;

      const stats = await peerConnection.getStats();
      const result = {
        audio: {},
        video: {},
        connection: {}
      };

      stats.forEach(report => {
        if (report.type === 'inbound-rtp' && report.kind === 'audio') {
          result.audio.inbound = {
            bytesReceived: report.bytesReceived,
            packetsLost: report.packetsLost,
            jitter: report.jitter
          };
        } else if (report.type === 'outbound-rtp' && report.kind === 'audio') {
          result.audio.outbound = {
            bytesSent: report.bytesSent
          };
        } else if (report.type === 'inbound-rtp' && report.kind === 'video') {
          result.video.inbound = {
            bytesReceived: report.bytesReceived,
            packetsLost: report.packetsLost,
            frameWidth: report.frameWidth,
            frameHeight: report.frameHeight,
            framesPerSecond: report.framesPerSecond
          };
        } else if (report.type === 'outbound-rtp' && report.kind === 'video') {
          result.video.outbound = {
            bytesSent: report.bytesSent,
            framesEncoded: report.framesEncoded
          };
        } else if (report.type === 'candidate-pair' && report.selected) {
          result.connection = {
            currentRoundTripTime: report.currentRoundTripTime,
            availableOutgoingBitrate: report.availableOutgoingBitrate
          };
        }
      });

      return result;
    } catch (error) {
      console.error('Error getting stats:', error);
      return null;
    }
  }

  // Get active peer connections count
  getActiveConnections() {
    return this.peerConnections.size;
  }

  // Get remote stream
  getRemoteStream(peerId) {
    return this.remoteStreams.get(peerId);
  }

  // Update tracks when local stream changes
  updateLocalStream(localStream) {
    this.peerConnections.forEach((pc, peerId) => {
      // Replace tracks in existing connections
      if (localStream) {
        const senders = pc.getSenders();
        
        localStream.getTracks().forEach(track => {
          const sender = senders.find(s => s.track && s.track.kind === track.kind);
          if (sender) {
            sender.replaceTrack(track);
          }
        });
      }
    });
  }
}

// Export for ES6 modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = WebRTCManager;
}