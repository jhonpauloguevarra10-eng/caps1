/* Main frontend: handles UI, getUserMedia, device selection, WebRTC peer mesh, and Socket.IO signaling */
(function(){
  const socket = io();

  // UI elements
  const lobby = document.getElementById('lobby');
  const meeting = document.getElementById('meeting');
  const createBtn = document.getElementById('createBtn');
  const joinBtn = document.getElementById('joinBtn');
  const nameInput = document.getElementById('nameInput');
  const roomInput = document.getElementById('roomInput');
  const videos = document.getElementById('videos');
  const copyLinkBtn = document.getElementById('copyLinkBtn');
  const leaveBtn = document.getElementById('leaveBtn');
  const muteBtn = document.getElementById('muteBtn');
  const camBtn = document.getElementById('camBtn');
  const chatToggleBtn = document.getElementById('chatToggleBtn');
  const chatPanel = document.getElementById('chatPanel');
  const chatList = document.getElementById('chatList');
  const chatForm = document.getElementById('chatForm');
  const chatInput = document.getElementById('chatInput');
  const audioSourceSel = document.getElementById('audioSource');
  const videoSourceSel = document.getElementById('videoSource');
  const fullscreenBtn = document.getElementById('fullscreenBtn');
  const endBtn = document.getElementById('endBtn');
  const participantsList = document.getElementById('participantsList');

  // State
  let localStream = null;
  let muted = false;
  let cameraOff = false;
  let roomId = null;
  let myName = '';
  let peers = new Map(); // peerId -> {pc, el}
  let mySocketId = null;
  let isHost = false;

  // STUN servers
  const ICE_CONFIG = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };

  // Helpers
  function log(...args){ /* avoid polluting console in production but keep for troubleshooting */ console.info(...args); }

  // Device enumeration
  async function updateDeviceList() {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const audios = devices.filter(d => d.kind === 'audioinput');
      const videosList = devices.filter(d => d.kind === 'videoinput');

      populateSelect(audioSourceSel, audios);
      populateSelect(videoSourceSel, videosList);
    } catch (err) {
      console.error('Device enumeration failed', err);
    }
  }

  function populateSelect(selectEl, devices) {
    const cur = selectEl.value;
    selectEl.innerHTML = '';
    devices.forEach(d => {
      const opt = document.createElement('option');
      opt.value = d.deviceId;
      opt.textContent = d.label || (d.kind === 'audioinput' ? 'Microphone' : 'Camera');
      selectEl.appendChild(opt);
    });
    if (cur) selectEl.value = cur;
  }

  // Request media with given device ids
  async function getLocalStream(audioDeviceId, videoDeviceId) {
    const constraints = {
      audio: audioDeviceId ? { deviceId: { exact: audioDeviceId } } : true,
      video: videoDeviceId ? { deviceId: { exact: videoDeviceId } } : { facingMode: 'user' }
    };
    try {
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      return stream;
    } catch (err) {
      console.error('getUserMedia error', err);
      throw err;
    }
  }

  // Create local video element
  function createLocalVideoEl(stream) {
    const slot = document.createElement('div');
    slot.className = 'video-slot';
    const video = document.createElement('video');
    video.autoplay = true; video.muted = true; video.playsInline = true;
    video.srcObject = stream;
    const label = document.createElement('div');
    label.className = 'video-label';
    label.textContent = myName || 'Me';
    slot.appendChild(video);
    slot.appendChild(label);
    slot.dataset.id = 'local';
    videos.prepend(slot);
  }

  function createRemoteVideoEl(peerId, name) {
    const slot = document.createElement('div');
    slot.className = 'video-slot';
    slot.dataset.peer = peerId;
    const video = document.createElement('video');
    video.autoplay = true; video.playsInline = true;
    const label = document.createElement('div');
    label.className = 'video-label';
    label.textContent = name || 'Participant';
    slot.appendChild(video);
    slot.appendChild(label);
    videos.appendChild(slot);
    return slot;
  }

  function removeRemoteVideoEl(peerId) {
    const el = videos.querySelector(`[data-peer="${peerId}"]`);
    if (el) el.remove();
  }

  // Resize grid depending on participant count
  function adjustGrid() {
    const count = videos.children.length;
    if (count <= 1) videos.style.gridTemplateColumns = '1fr';
    else if (count === 2) videos.style.gridTemplateColumns = 'repeat(2,1fr)';
    else if (count <= 4) videos.style.gridTemplateColumns = 'repeat(2,1fr)';
    else if (count <= 9) videos.style.gridTemplateColumns = 'repeat(3,1fr)';
    else videos.style.gridTemplateColumns = 'repeat(4,1fr)';
  }

  // WebRTC: create peer connection and tracks
  function createPeerConnection(peerId, name, isInitiator) {
    const pc = new RTCPeerConnection(ICE_CONFIG);

    // Attach local tracks
    if (localStream) {
      for (const track of localStream.getTracks()) {
        pc.addTrack(track, localStream);
      }
    }

    // remote track handling
    pc.addEventListener('track', ev => {
      let entry = peers.get(peerId);
      if (!entry) {
        const el = createRemoteVideoEl(peerId, name);
        entry = { pc, el };
        peers.set(peerId, entry);
      }
      const video = entry.el.querySelector('video');
      if (video.srcObject !== ev.streams[0]) video.srcObject = ev.streams[0];
      adjustGrid();
    });

    pc.addEventListener('icecandidate', event => {
      if (event.candidate) {
        socket.emit('signal', { to: peerId, data: { type: 'candidate', candidate: event.candidate } });
      }
    });

    pc.addEventListener('connectionstatechange', () => {
      if (pc.connectionState === 'failed') pc.restartIce?.();
    });

    return pc;
  }

  // Initiate offer to a remote peer
  async function initConnectionAsCaller(peerId, name) {
    const pc = createPeerConnection(peerId, name, true);
    peers.set(peerId, { pc, el: document.querySelector(`[data-peer="${peerId}"]`) });
    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socket.emit('signal', { to: peerId, data: { type: 'offer', sdp: pc.localDescription } });
    } catch (err) { console.error('Failed to create offer', err); }
  }

  // Handle incoming signal
  socket.on('signal', async ({ from, data }) => {
    if (!from) return;
    let entry = peers.get(from);
    if (!entry) {
      const el = createRemoteVideoEl(from, 'Participant');
      const pc = createPeerConnection(from, 'Participant', false);
      entry = { pc, el };
      peers.set(from, entry);
      adjustGrid();
    }
    const pc = entry.pc;
    try {
      if (data.type === 'offer') {
        await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit('signal', { to: from, data: { type: 'answer', sdp: pc.localDescription } });
      } else if (data.type === 'answer') {
        await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
      } else if (data.type === 'candidate') {
        try { await pc.addIceCandidate(data.candidate); } catch (e) { console.warn('ICE add failed', e); }
      }
    } catch (err) {
      console.error('Error handling signal', err);
    }
  });

  // When a participant joins, start offer to them
  socket.on('participant-joined', ({ id, name }) => {
    // create placeholder element
    createRemoteVideoEl(id, name);
    // small timeout to ensure element created
    setTimeout(() => initConnectionAsCaller(id, name), 50);
    addParticipantListItem(id, name);
    adjustGrid();
  });

  socket.on('participant-left', ({ id }) => {
    const entry = peers.get(id);
    if (entry) {
      try { entry.pc.close(); } catch(e){}
      peers.delete(id);
    }
    removeRemoteVideoEl(id);
    removeParticipantListItem(id);
    adjustGrid();
  });

  socket.on('host-changed', ({ hostId }) => {
    isHost = (mySocketId === hostId);
    endBtn.classList.toggle('hidden', !isHost);
  });

  socket.on('room-ended', () => {
    alert('Host ended the meeting');
    leaveRoom();
  });

  socket.on('chat-message', ({ id, name, message, ts }) => {
    appendChatMessage(name || 'Anonymous', message, ts);
  });

  socket.on('connect', () => { mySocketId = socket.id; });

  // When joining, server returns existing participants
  function handleJoinedResponse({ success, participants, hostId }){
    isHost = (hostId === mySocketId);
    endBtn.classList.toggle('hidden', !isHost);
    participants.forEach(p => {
      createRemoteVideoEl(p.id, p.name);
      // start offers where we initiate
      setTimeout(() => initConnectionAsCaller(p.id, p.name), 100);
      addParticipantListItem(p.id, p.name);
    });
    adjustGrid();
  }

  // Buttons
  createBtn.addEventListener('click', async () => {
    myName = nameInput.value.trim() || 'Host';
    try {
      const res = await fetch('/create-room', { method: 'POST' });
      const data = await res.json();
      roomInput.value = location.origin + '/r/' + data.roomId;
      joinRoom(data.roomId);
    } catch (err) { alert('Failed to create room'); }
  });

  joinBtn.addEventListener('click', () => {
    const val = roomInput.value.trim();
    if (!val) return alert('Enter meeting id or link');
    const id = extractRoomId(val);
    if (!id) return alert('Invalid meeting link or id');
    joinRoom(id);
  });

  copyLinkBtn.addEventListener('click', async () => {
    if (!roomId) return;
    const link = location.origin + '/r/' + roomId;
    try { await navigator.clipboard.writeText(link); alert('Link copied'); }
    catch (e) { alert('Failed to copy'); }
  });

  leaveBtn.addEventListener('click', () => leaveRoom());
  chatToggleBtn.addEventListener('click', ()=> chatPanel.classList.toggle('hidden'));

  muteBtn.addEventListener('click', ()=>{
    if (!localStream) return;
    muted = !muted;
    localStream.getAudioTracks().forEach(t => t.enabled = !muted);
    muteBtn.textContent = muted ? 'Unmute' : 'Mute';
  });

  camBtn.addEventListener('click', ()=>{
    if (!localStream) return;
    cameraOff = !cameraOff;
    localStream.getVideoTracks().forEach(t => t.enabled = !cameraOff);
    camBtn.textContent = cameraOff ? 'Camera On' : 'Camera Off';
  });

  fullscreenBtn.addEventListener('click', async ()=>{
    if (!document.fullscreenElement) await document.documentElement.requestFullscreen();
    else await document.exitFullscreen();
  });

  endBtn.addEventListener('click', ()=>{
    if (!roomId) return;
    if (!confirm('End meeting for all participants?')) return;
    socket.emit('end-room', { roomId });
  });

  chatForm.addEventListener('submit', (e)=>{
    e.preventDefault();
    const msg = chatInput.value.trim();
    if (!msg) return;
    socket.emit('chat-message', { roomId, message: msg, name: myName });
    appendChatMessage(myName, msg, Date.now());
    chatInput.value = '';
  });

  // Device switching
  audioSourceSel.addEventListener('change', async ()=> switchLocalTrack('audio', audioSourceSel.value));
  videoSourceSel.addEventListener('change', async ()=> switchLocalTrack('video', videoSourceSel.value));

  // Helpers for participants list
  function addParticipantListItem(id, name){
    const span = document.createElement('span'); span.id = 'p-' + id; span.textContent = name; participantsList.appendChild(span);
  }
  function removeParticipantListItem(id){ const el = document.getElementById('p-'+id); if(el) el.remove(); }

  function appendChatMessage(name, message, ts){
    const item = document.createElement('div'); item.className = 'chat-item';
    const time = new Date(ts).toLocaleTimeString();
    item.innerHTML = `<strong>${escapeHtml(name)}</strong> <span class="small">${time}</span><div>${escapeHtml(message)}</div>`;
    chatList.appendChild(item);
    chatList.scrollTop = chatList.scrollHeight;
  }

  function escapeHtml(s){ return (s+'').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }

  // Extract room id from URL or raw id
  function extractRoomId(val){
    try{
      const url = new URL(val);
      const parts = url.pathname.split('/').filter(Boolean);
      const id = parts[parts.indexOf('r')+1] || parts[0];
      return id || null;
    }catch(e){ return val; }
  }

  async function joinRoom(id){
    myName = nameInput.value.trim() || 'Guest';
    roomId = id;
    // attempt to get devices then stream
    try{
      await updateDeviceList();
      const audioId = audioSourceSel.value || undefined;
      const videoId = videoSourceSel.value || undefined;
      localStream = await getLocalStream(audioId, videoId);
      createLocalVideoEl(localStream);
    }catch(err){
      alert('Unable to access camera/microphone. Please allow permissions or check device.');
      return;
    }

    socket.emit('join-room', { roomId, name: myName }, (res)=>{
      if (res && res.error) { alert(res.error); return; }
      lobby.classList.add('hidden');
      meeting.classList.remove('hidden');
      handleJoinedResponse(res || {});
      addParticipantListItem('local', myName + ' (You)');
    });
  }

  async function leaveRoom(){
    if (roomId) socket.emit('leave-room', { roomId });
    // close peers
    for (const [id, entry] of peers.entries()){
      try{ entry.pc.close(); }catch(e){}
      removeRemoteVideoEl(id);
    }
    peers.clear();
    // stop local tracks
    if (localStream){ localStream.getTracks().forEach(t=>t.stop()); localStream = null; }
    // reset UI
    videos.innerHTML = '';
    chatList.innerHTML = '';
    participantsList.innerHTML = '';
    roomId = null; myName = '';
    meeting.classList.add('hidden'); lobby.classList.remove('hidden');
  }

  // Replace local track (device switch)
  async function switchLocalTrack(kind, deviceId){
    if (!localStream) return;
    try{
      const constraints = {};
      if (kind === 'audio') constraints.audio = { deviceId: { exact: deviceId } };
      if (kind === 'video') constraints.video = { deviceId: { exact: deviceId } };
      const newStream = await navigator.mediaDevices.getUserMedia(constraints);
      const newTrack = (kind === 'audio') ? newStream.getAudioTracks()[0] : newStream.getVideoTracks()[0];
      const oldTrack = (kind === 'audio') ? localStream.getAudioTracks()[0] : localStream.getVideoTracks()[0];
      // replace track in senders
      for (const [id, entry] of peers.entries()){
        const senders = entry.pc.getSenders().filter(s=>s.track && s.track.kind === kind);
        for (const s of senders) s.replaceTrack(newTrack);
      }
      // stop old and update localStream
      if (oldTrack) oldTrack.stop();
      if (kind === 'audio'){
        localStream.removeTrack(oldTrack);
        localStream.addTrack(newTrack);
      } else {
        localStream.removeTrack(oldTrack);
        localStream.addTrack(newTrack);
        // update local video element
        const localVideo = videos.querySelector('[data-id="local"] video');
        if (localVideo) localVideo.srcObject = null, localVideo.srcObject = localStream;
      }
    }catch(err){ console.error('Switch track failed', err); }
  }

  // Initial setup
  (async function init(){
    // permissions and device list check
    try{ await updateDeviceList(); }catch(e){}
    // show existing room if path contains
    const parts = location.pathname.split('/').filter(Boolean);
    if (parts[0] === 'r' && parts[1]){
      roomInput.value = location.href;
    }
    // graceful permission error handling
    navigator.permissions && navigator.permissions.query({name:'camera'}).then(()=>{}).catch(()=>{});
  })();

})();
