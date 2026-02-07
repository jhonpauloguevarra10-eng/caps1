// WebRTC Manager - Handles peer connections and signaling
class WebRTCManager {
  constructor(socket) {
    this.socket = socket;
    this.peerConnections = new Map();
    this.dataChannels = new Map();
    this.RTCPeerConnection = window.RTCPeerConnection || 
                           window.webkitRTCPeerConnection || 
                           window.mozRTCPeerConnection;
  }

  // Create peer connection
  createPeerConnection(peerId, localStream) {
    try {
      const peerConnection = new this.RTCPeerConnection(RTC_CONFIG);

      // Add local stream tracks
      if (localStream) {
        localStream.getTracks().forEach(track => {
          peerConnection.addTrack(track, localStream);
        });
      }

      // Handle remote stream
      peerConnection.ontrack = (event) => {
        console.log('Received remote track:', event.track.kind);
        window.app?.uiManager?.addRemoteStream(peerId, event.streams[0]);
      };

      // Handle ICE candidates
      peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
          this.socket.emit('send-ice-candidate', {
            to: peerId,
            candidate: event.candidate
          });
        }
      };

      // Handle connection state changes
      peerConnection.onconnectionstatechange = () => {
        console.log(`Connection state with ${peerId}: ${peerConnection.connectionState}`);
        
        if (peerConnection.connectionState === 'failed' || 
            peerConnection.connectionState === 'disconnected') {
          this.removePeerConnection(peerId);
          window.app?.uiManager?.removeRemoteStream(peerId);
        }
      };

      // Handle ICE connection state
      peerConnection.oniceconnectionstatechange = () => {
        console.log(`ICE state with ${peerId}: ${peerConnection.iceConnectionState}`);
      };

      this.peerConnections.set(peerId, peerConnection);
      console.log(`Peer connection created with ${peerId}`);
      return peerConnection;
    } catch (error) {
      console.error('Error creating peer connection:', error);
      throw error;
    }
  }

  // Create and send offer
  async createOffer(peerId, localStream) {
    try {
      if (!this.peerConnections.has(peerId)) {
        this.createPeerConnection(peerId, localStream);
      }

      const peerConnection = this.peerConnections.get(peerId);
      const offer = await peerConnection.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true
      });

      await peerConnection.setLocalDescription(offer);
      
      this.socket.emit('send-offer', {
        to: peerId,
        offer: offer
      });

      console.log(`Offer sent to ${peerId}`);
    } catch (error) {
      console.error('Error creating offer:', error);
      throw error;
    }
  }

  // Handle incoming offer
  async handleOffer(peerId, offer, localStream) {
    try {
      if (!this.peerConnections.has(peerId)) {
        this.createPeerConnection(peerId, localStream);
      }

      const peerConnection = this.peerConnections.get(peerId);
      await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));

      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);

      this.socket.emit('send-answer', {
        to: peerId,
        answer: answer
      });

      console.log(`Offer handled and answer sent to ${peerId}`);
    } catch (error) {
      console.error('Error handling offer:', error);
      throw error;
    }
  }

  // Handle incoming answer
  async handleAnswer(peerId, answer) {
    try {
      const peerConnection = this.peerConnections.get(peerId);
      if (peerConnection) {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
        console.log(`Answer received from ${peerId}`);
      }
    } catch (error) {
      console.error('Error handling answer:', error);
      throw error;
    }
  }

  // Handle incoming ICE candidate
  async handleICECandidate(peerId, candidate) {
    try {
      const peerConnection = this.peerConnections.get(peerId);
      if (peerConnection && candidate) {
        await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
      }
    } catch (error) {
      console.error('Error handling ICE candidate:', error);
    }
  }

  // Remove peer connection
  removePeerConnection(peerId) {
    const peerConnection = this.peerConnections.get(peerId);
    if (peerConnection) {
      peerConnection.close();
      this.peerConnections.delete(peerId);
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
  }

  // Get connection stats (for debugging)
  async getStats(peerId) {
    try {
      const peerConnection = this.peerConnections.get(peerId);
      if (!peerConnection) return null;

      const stats = await peerConnection.getStats();
      const result = {};

      stats.forEach(report => {
        if (report.type === 'inbound-rtp') {
          result.inbound = {
            bytesReceived: report.bytesReceived,
            packetsLost: report.packetsLost,
            jitter: report.jitter
          };
        } else if (report.type === 'outbound-rtp') {
          result.outbound = {
            bytesSent: report.bytesSent,
            framesSent: report.framesSent
          };
        }
      });

      return result;
    } catch (error) {
      console.error('Error getting stats:', error);
      return null;
    }
  }

  // Get peer connections count
  getPeerConnectionCount() {
    return this.peerConnections.size;
  }

  // Check if peer connection exists
  hasPeerConnection(peerId) {
    return this.peerConnections.has(peerId);
  }
}
