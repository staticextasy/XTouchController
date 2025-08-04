// Global variables
let socket;
let obsIP = "localhost";
let password = "";

// Global state variables
let isStreaming = false;
let isRecording = false;
let isReplayBufferActive = false;
let audioSources = [];
let currentFPS = 0;
let statsInterval = null;
let audioSyncInterval = null;
let muteRequests = new Map();
let muteOperationInProgress = false;
let requestIdCounter = 0;

// Connection state management
let connectionState = {
  isConnected: false,
  obsIP: "localhost",
  password: "",
  lastConnected: null
};

// Connection recovery variables
let autoReconnectEnabled = true;
let reconnectAttempts = 0;
let maxReconnectAttempts = 3;
let reconnectInterval = null;

// Theme switcher functionality
function initThemeSwitcher() {
  const themeBtns = document.querySelectorAll('.theme-btn');
  const savedTheme = localStorage.getItem('obs-theme') || 'ocean';
  
  // Set initial theme
  document.documentElement.setAttribute('data-theme', savedTheme);
  updateActiveThemeButton(savedTheme);
  
  // Add click and touch handlers
  themeBtns.forEach(btn => {
    btn.removeEventListener('click', handleThemeClick);
    btn.removeEventListener('touchstart', handleThemeTouch);
    btn.removeEventListener('touchend', handleThemeTouch);
    
    btn.addEventListener('click', handleThemeClick);
    btn.addEventListener('touchstart', handleThemeTouch, { passive: false });
    btn.addEventListener('touchend', handleThemeTouch, { passive: false });
  });
  
  // Apply theme for mobile devices
  forceThemeApplication();
}

function handleThemeClick(e) {
  e.preventDefault();
  e.stopPropagation();
  const theme = e.currentTarget.getAttribute('data-theme');
  setTheme(theme);
}

function handleThemeTouch(e) {
  e.preventDefault();
  e.stopPropagation();
  const theme = e.currentTarget.getAttribute('data-theme');
  setTheme(theme);
}

function setTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('obs-theme', theme);
  updateActiveThemeButton(theme);
  
  // Re-apply for mobile devices
  setTimeout(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, 100);
}

function updateActiveThemeButton(activeTheme) {
  const themeBtns = document.querySelectorAll('.theme-btn');
  themeBtns.forEach(btn => {
    btn.classList.remove('active');
    if (btn.getAttribute('data-theme') === activeTheme) {
      btn.classList.add('active');
    }
  });
}

function createSceneButton(sceneName) {
  const btn = document.createElement("button");
  btn.textContent = sceneName;
  btn.className = "btn scene-button";
  btn.onclick = () => switchScene(sceneName);
  return btn;
}

function updateStatus(message, type = "connecting") {
  const container = document.getElementById("scene-buttons");
  const alertClass = type === "error" ? "alert-danger" : type === "success" ? "alert-success" : "alert-info";
  const loadingIcon = type === "connecting" ? '<div class="spinner-border spinner-border-sm me-2" role="status"></div>' : '';
  
  container.innerHTML = `<div class="alert ${alertClass}">${loadingIcon}${message}</div>`;
}

async function computeAuthResponse(password, salt, challenge) {
  const enc = new TextEncoder();
  const base64 = buffer => btoa(String.fromCharCode(...new Uint8Array(buffer)));

  const secretHash = await crypto.subtle.digest("SHA-256", enc.encode(password + salt));
  const secret = base64(secretHash);

  const authHash = await crypto.subtle.digest("SHA-256", enc.encode(secret + challenge));
  return base64(authHash);
}

function getSceneList() {
  const request = {
    op: 6,
    d: {
      requestType: "GetSceneList",
      requestId: "scene-list-" + Date.now()
    }
  };
  socket.send(JSON.stringify(request));
}

function switchScene(sceneName) {
  const request = {
    op: 6,
    d: {
      requestType: "SetCurrentProgramScene",
      requestId: "switch-scene-" + Date.now(),
      requestData: {
        sceneName: sceneName
      }
    }
  };
  socket.send(JSON.stringify(request));
}

// Stream/Record Control Functions
async function toggleStream() {
  const request = {
    op: 6,
    d: {
      requestType: isStreaming ? "StopStream" : "StartStream",
      requestId: "stream-toggle-" + Date.now()
    }
  };
  socket.send(JSON.stringify(request));
}

async function toggleRecording() {
  const request = {
    op: 6,
    d: {
      requestType: isRecording ? "StopRecord" : "StartRecord",
      requestId: "record-toggle-" + Date.now()
    }
  };
  socket.send(JSON.stringify(request));
}

async function toggleReplayBuffer() {
  const request = {
    op: 6,
    d: {
      requestType: isReplayBufferActive ? "StopReplayBuffer" : "StartReplayBuffer",
      requestId: "replay-toggle-" + Date.now()
    }
  };
  socket.send(JSON.stringify(request));
}

// Audio Control Functions
async function getAudioSources() {
  const request = {
    op: 6,
    d: {
      requestType: "GetInputList",
      requestId: "audio-sources-" + Date.now()
    }
  };
  socket.send(JSON.stringify(request));
}

async function getInputMute(inputName) {
  requestIdCounter++;
  const requestId = `input-mute-${Date.now()}-${requestIdCounter}-${Math.random().toString(36).substr(2, 9)}`;
  
  const request = {
    op: 6,
    d: {
      requestType: "GetInputMute",
      requestId: requestId,
      requestData: {
        inputName: inputName
      }
    }
  };
  
  muteRequests.set(requestId, inputName);
  socket.send(JSON.stringify(request));
}

async function toggleAudioMute(inputName) {
  if (!socket || socket.readyState !== WebSocket.OPEN) {
    return;
  }
  
  muteOperationInProgress = true;
  
  const request = {
    op: 6,
    d: {
      requestType: "ToggleInputMute",
      requestId: `mute-toggle-${Date.now()}-${++requestIdCounter}-${Math.random().toString(36).substr(2, 9)}`,
      requestData: {
        inputName: inputName
      }
    }
  };
  
  try {
    socket.send(JSON.stringify(request));
  } catch (error) {
    muteOperationInProgress = false;
  }
}

async function setAudioVolume(inputName, volume) {
  const volumeValue = parseFloat(volume);
  
  let volumeMultiplier;
  let calculatedDb;
  let obsDb;
   
  if (volumeValue === 0) {
    volumeMultiplier = 0;
    calculatedDb = -60;
    obsDb = -60;
  } else if (volumeValue === 100) {
    volumeMultiplier = 1;
    calculatedDb = 0;
    obsDb = 0;
  } else {
    calculatedDb = (volumeValue / 100) * 60 - 60;
    
    const normalizedSlider = volumeValue / 100;
    const normalizedObsDb = Math.pow(normalizedSlider, 1/1.5);
    obsDb = normalizedObsDb * 60 - 60;
    
    volumeMultiplier = Math.pow(10, obsDb / 20);
  }
  
  if (!socket || socket.readyState !== WebSocket.OPEN) {
    return;
  }
  
  const request = {
    op: 6,
    d: {
      requestType: "SetInputVolume",
      requestId: "volume-set-" + Date.now(),
      requestData: {
        inputName: inputName,
        inputVolumeMul: volumeMultiplier
      }
    }
  };
  try {
    socket.send(JSON.stringify(request));
  } catch (error) {
    // Handle error silently
  }
}

// Status Monitoring Functions
async function getStreamStatus() {
  const request = {
    op: 6,
    d: {
      requestType: "GetStreamStatus",
      requestId: "stream-status-" + Date.now()
    }
  };
  socket.send(JSON.stringify(request));
}

async function getRecordStatus() {
  const request = {
    op: 6,
    d: {
      requestType: "GetRecordStatus",
      requestId: "record-status-" + Date.now()
    }
  };
  socket.send(JSON.stringify(request));
}

async function getReplayBufferStatus() {
  const request = {
    op: 6,
    d: {
      requestType: "GetReplayBufferStatus",
      requestId: "replay-status-" + Date.now()
    }
  };
  socket.send(JSON.stringify(request));
}

async function getStats() {
  const request = {
    op: 6,
    d: {
      requestType: "GetStats",
      requestId: "stats-" + Date.now()
    }
  };
  socket.send(JSON.stringify(request));
}

// UI Update Functions
function updateConnectionStatus(status) {
  const element = document.getElementById('connection-status');
  element.textContent = status;
  element.className = 'status-value ' + (status === 'Connected' ? 'connected' : 'disconnected');
}

function updateStreamStatus(status) {
  const element = document.getElementById('stream-status');
  const btn = document.getElementById('stream-btn');
  element.textContent = status;
  element.className = 'status-value ' + (status === 'Active' ? 'active' : 'inactive');
  
  isStreaming = status === 'Active';
  btn.className = 'control-btn' + (isStreaming ? ' active' : '');
  btn.querySelector('.btn-text').textContent = isStreaming ? 'Stop Stream' : 'Start Stream';
}

function updateRecordingStatus(status) {
  const element = document.getElementById('recording-status');
  const btn = document.getElementById('record-btn');
  element.textContent = status;
  element.className = 'status-value ' + (status === 'Active' ? 'active' : 'inactive');
  
  isRecording = status === 'Active';
  btn.className = 'control-btn' + (isRecording ? ' active' : '');
  btn.querySelector('.btn-text').textContent = isRecording ? 'Stop Recording' : 'Start Recording';
}

function updateFPSStatus(fps) {
  const element = document.getElementById('fps-status');
  element.textContent = fps.toFixed(1);
}

function createAudioSourceElement(source) {
  const audioDiv = document.createElement('div');
  audioDiv.className = 'audio-source d-flex align-items-center justify-content-between';
  
  let sliderValue;
  let initialDb;
  if (source.inputVolumeMul === 0) {
    sliderValue = 0;
    initialDb = -60;
  } else if (source.inputVolumeMul === 1) {
    sliderValue = 100;
    initialDb = 0;
  } else {
    const db = 20 * Math.log10(source.inputVolumeMul);
    initialDb = db;
    
    const normalizedDb = (db + 60) / 60;
    sliderValue = Math.pow(normalizedDb, 1.5) * 100;
    sliderValue = Math.max(0, Math.min(100, sliderValue));
  }
  
  const muteStatusClass = source.inputMuted ? 'muted' : 'unmuted';
  const muteStatusText = source.inputMuted ? 'MUTED' : 'LIVE';
  
  audioDiv.innerHTML = `
    <div class="audio-info d-flex align-items-center">
      <span class="audio-name me-3">${source.inputName}</span>
      <div class="audio-level">
        <div class="audio-level-fill" style="width: ${sliderValue}%"></div>
      </div>
    </div>
    <div class="audio-controls d-flex align-items-center position-relative">
      <div class="mute-status me-2 ${muteStatusClass}">
        <small class="mute-status-text">${muteStatusText}</small>
      </div>
      <button class="btn btn-sm audio-btn mute-btn ${source.inputMuted ? 'muted' : ''}" 
              data-input-name="${source.inputName}">
        ${source.inputMuted ? 'Unmute' : 'Mute'}
      </button>
      <input type="range" class="volume-slider ms-2" min="0" max="100" 
             value="${sliderValue}"
             data-input-name="${source.inputName}">
      <div class="db-value" data-input-name="${source.inputName}">${initialDb.toFixed(1)} dB</div>
    </div>
  `;
  
  const muteBtn = audioDiv.querySelector('.mute-btn');
  const volumeSlider = audioDiv.querySelector('.volume-slider');
  const dbValue = audioDiv.querySelector('.db-value');
  
  muteBtn.addEventListener('click', () => {
    toggleAudioMute(source.inputName);
  });
  
  volumeSlider.addEventListener('change', (e) => {
    setAudioVolume(source.inputName, e.target.value);
  });
  
  volumeSlider.addEventListener('input', (e) => {
    const volumeValue = parseFloat(e.target.value);
    const normalizedSlider = volumeValue / 100;
    const normalizedObsDb = Math.pow(normalizedSlider, 1/1.5);
    const obsDb = normalizedObsDb * 60 - 60;
    dbValue.textContent = `${obsDb.toFixed(1)} dB`;
    dbValue.classList.add('show');
  });
  
  volumeSlider.addEventListener('mousedown', () => {
    dbValue.classList.add('show');
  });
  
  volumeSlider.addEventListener('mouseup', () => {
    setTimeout(() => {
      dbValue.classList.remove('show');
    }, 1000);
  });
  
  volumeSlider.addEventListener('mouseleave', () => {
    dbValue.classList.remove('show');
  });
  
  return audioDiv;
}

// Enhanced message handler
function handleObsMessage(msg) {
  // Handle stream status
  if (msg.op === 7 && msg.d.requestType === "GetStreamStatus") {
    const isActive = msg.d.responseData?.outputActive || false;
    updateStreamStatus(isActive ? 'Active' : 'Inactive');
  }

  // Handle record status
  if (msg.op === 7 && msg.d.requestType === "GetRecordStatus") {
    const isActive = msg.d.responseData?.outputActive || false;
    updateRecordingStatus(isActive ? 'Active' : 'Inactive');
  }

  // Handle replay buffer status
  if (msg.op === 7 && msg.d.requestType === "GetReplayBufferStatus") {
    const isActive = msg.d.responseData?.outputActive || false;
    isReplayBufferActive = isActive;
    const btn = document.getElementById('replay-btn');
    btn.className = 'control-btn' + (isActive ? ' active' : '');
    btn.querySelector('.btn-text').textContent = isActive ? 'Stop Replay' : 'Start Replay';
  }

  // Handle audio sources
  if (msg.op === 7 && msg.d.requestType === "GetInputList" && !msg.d.requestId?.includes("all-inputs")) {
    const inputs = msg.d.responseData?.inputs || [];
    
    audioSources = inputs.filter(input => {
      const inputKind = input.inputKind.toLowerCase();
      return inputKind.includes('audio') || 
             inputKind.includes('wasapi') || 
             inputKind.includes('coreaudio') || 
             inputKind.includes('pulse') || 
             inputKind.includes('alsa') ||
             inputKind.includes('dshow') ||
             inputKind.includes('avfoundation') ||
             inputKind.includes('decklink') ||
             inputKind.includes('ndi') ||
             inputKind.includes('rtmp') ||
             inputKind.includes('ffmpeg');
    });
    
    const isUIUpdate = msg.d.requestId?.includes("update-ui");
    const isMuteStatusUpdate = msg.d.requestId?.includes("mute-status-update");
    
    if (isUIUpdate || isMuteStatusUpdate) {
      updateExistingAudioControls(audioSources);
    }
    
    const audioContainer = document.getElementById('audio-sources');
    
    if (audioSources.length === 0) {
      audioContainer.innerHTML = `
        <div class="alert alert-warning">
          <i class="bi bi-exclamation-triangle"></i>
          No audio sources found. Make sure you have audio inputs configured in OBS.
          <br><small class="text-muted">Total inputs found: ${inputs.length}</small>
        </div>
      `;
    } else {
      if (isUIUpdate) {
        updateExistingAudioControls(audioSources);
      } else {
        audioContainer.innerHTML = '';
        audioSources.forEach(source => {
          audioContainer.appendChild(createAudioSourceElement(source));
        });
        
        setTimeout(() => {
          if (socket && socket.readyState === WebSocket.OPEN) {
            audioSources.forEach(source => {
              getInputMute(source.inputName);
            });
          }
        }, 100);
      }
    }
  }

  // Handle stats
  if (msg.op === 7 && msg.d.requestType === "GetStats") {
    const stats = msg.d.responseData;
    if (stats?.fps) {
      updateFPSStatus(stats.fps);
    }
  }

  // Handle stream/record toggle responses
  if (msg.op === 7 && (msg.d.requestType === "StartStream" || msg.d.requestType === "StopStream")) {
    if (!msg.d.error) {
      setTimeout(() => {
        getStreamStatus();
      }, 500);
    }
  }

  if (msg.op === 7 && (msg.d.requestType === "StartRecord" || msg.d.requestType === "StopRecord")) {
    if (!msg.d.error) {
      setTimeout(() => {
        getRecordStatus();
      }, 500);
    }
  }

  if (msg.op === 7 && (msg.d.requestType === "StartReplayBuffer" || msg.d.requestType === "StopReplayBuffer")) {
    if (!msg.d.error) {
      setTimeout(() => {
        getReplayBufferStatus();
      }, 500);
    }
  }

  // Handle audio control responses
  if (msg.op === 7 && msg.d.requestType === "ToggleInputMute") {
    if (!msg.d.error) {
      setTimeout(() => {
        if (socket && socket.readyState === WebSocket.OPEN && audioSources.length > 0) {
          audioSources.forEach(source => {
            getInputMute(source.inputName);
          });
        }
        setTimeout(() => {
          muteOperationInProgress = false;
        }, 500);
      }, 100);
    } else {
      muteOperationInProgress = false;
    }
  }

  // Handle input mute status response
  if (msg.op === 7 && msg.d.requestType === "GetInputMute") {
    if (!msg.d.error && msg.d.responseData) {
      const requestId = msg.d.requestId;
      const inputName = muteRequests.get(requestId);
      const inputMuted = msg.d.responseData.inputMuted;
      
      if (inputName) {
        const muteBtn = document.querySelector(`.mute-btn[data-input-name="${inputName}"]`);
        if (muteBtn) {
          muteBtn.textContent = inputMuted ? 'Unmute' : 'Mute';
          muteBtn.className = `btn btn-sm audio-btn mute-btn ${inputMuted ? 'muted' : ''}`;
          
          const muteStatus = muteBtn.parentElement.querySelector('.mute-status');
          if (muteStatus) {
            const muteStatusText = muteStatus.querySelector('.mute-status-text');
            if (muteStatusText) {
              muteStatusText.textContent = inputMuted ? 'MUTED' : 'LIVE';
            }
            muteStatus.className = `mute-status me-2 ${inputMuted ? 'muted' : 'unmuted'}`;
          }
        }
        
        muteRequests.delete(requestId);
      }
    }
  }

  // Handle recording state change events
  if (msg.op === 5 && msg.d.eventType === "RecordStateChanged") {
    const eventData = msg.d.eventData;
    const isActive = eventData.outputState === 'OBS_RECORDING_STATE_RECORDING';
    updateRecordingStatus(isActive ? 'Active' : 'Inactive');
  }

  // Handle stream state change events
  if (msg.op === 5 && msg.d.eventType === "StreamStateChanged") {
    const eventData = msg.d.eventData;
    const isActive = eventData.outputState === 'OBS_OUTPUT_STATE_STARTING' || 
                    eventData.outputState === 'OBS_OUTPUT_STATE_STREAMING';
    updateStreamStatus(isActive ? 'Active' : 'Inactive');
  }

  // Handle volume change events from OBS
  if (msg.op === 5 && msg.d.eventType === "InputVolumeChanged") {
    const eventData = msg.d.eventData;
    
    const volumeSlider = document.querySelector(`[data-input-name="${eventData.inputName}"].volume-slider`);
    if (volumeSlider) {
      const obsDb = eventData.inputVolumeDb;
      
      let newValue;
      
      if (eventData.inputVolumeMul === 0) {
        newValue = 0;
      } else if (eventData.inputVolumeMul === 1) {
        newValue = 100;
      } else {
        const normalizedDb = (obsDb + 60) / 60;
        newValue = Math.pow(normalizedDb, 1.5) * 100;
        newValue = Math.max(0, Math.min(100, newValue));
      }
      
      const currentValue = parseFloat(volumeSlider.value);
      
      if (Math.abs(currentValue - newValue) > 0.1) {
        volumeSlider.value = newValue;
      }
      
      const audioLevelFill = volumeSlider.parentElement.parentElement.querySelector('.audio-level-fill');
      if (audioLevelFill) {
        audioLevelFill.style.width = `${newValue}%`;
      }
      
      const dbValue = volumeSlider.parentElement.querySelector('.db-value');
      if (dbValue) {
        dbValue.textContent = `${obsDb.toFixed(1)} dB`;
      }
    }
  }
}

// Enhanced connection function
async function connect() {
  if (socket && socket.readyState === WebSocket.OPEN) {
    return;
  }
  
  if (socket) {
    socket.close();
    socket = null;
  }
  
  updateStatus("Connecting to OBS...", "connecting");
  updateConnectionStatus("Connecting");
  socket = new WebSocket(`ws://${obsIP}:4455`);

  socket.onopen = () => {
    updateStatus("Connected! Authenticating...", "connecting");
    updateConnectionStatus("Connected");
    
    connectionState.isConnected = true;
    connectionState.obsIP = obsIP;
    connectionState.password = password;
    connectionState.lastConnected = new Date().toISOString();
    localStorage.setItem('obsConnectionState', JSON.stringify(connectionState));
    
    reconnectAttempts = 0;
    
    const connectBtn = document.getElementById('connect-btn');
    const disconnectBtn = document.getElementById('disconnect-btn');
    if (connectBtn) {
      connectBtn.disabled = true;
      connectBtn.innerHTML = '<i class="bi bi-wifi"></i> Connected';
    }
    if (disconnectBtn) disconnectBtn.disabled = false;
  };

  socket.onmessage = async (event) => {
    const msg = JSON.parse(event.data);

    if (msg.op === 0) {
      const { authentication, rpcVersion } = msg.d;
      const { challenge, salt } = authentication;
      const auth = await computeAuthResponse(password, salt, challenge);

      const identifyMessage = {
        op: 1,
        d: {
          rpcVersion,
          authentication: auth
        }
      };
      socket.send(JSON.stringify(identifyMessage));
    }

    if (msg.op === 2) {
      updateStatus("Authenticated! Loading data...", "connecting");
      
      getSceneList();
      getAudioSources();
      getStreamStatus();
      getRecordStatus();
      getReplayBufferStatus();
      getStats();
      
      statsInterval = setInterval(() => {
        if (socket && socket.readyState === WebSocket.OPEN) {
          getStats();
        }
      }, 2000);
      
      audioSyncInterval = setInterval(() => {
        if (socket && socket.readyState === WebSocket.OPEN) {
          updateAudioSourceUI();
        }
      }, 2000);
    }

    handleObsMessage(msg);

    if (msg.op === 7 && msg.d.requestType === "GetSceneList") {
      if (msg.d.responseData && msg.d.responseData.scenes) {
        const scenes = msg.d.responseData.scenes;
        const container = document.getElementById("scene-buttons");
        container.innerHTML = "";
        scenes.forEach(s => {
          container.appendChild(createSceneButton(s.sceneName));
        });
      } else {
        updateStatus("No scenes found in response", "error");
      }
    }

    if (msg.op === 7 && msg.d.error) {
      updateStatus(`Error: ${msg.d.error}`, "error");
    }

    if (msg.op === 7 && msg.d.error && msg.d.error.includes("authentication")) {
      updateStatus("Authentication failed - check password", "error");
      updateConnectionStatus("Auth Failed");
    }
  };

  socket.onerror = (err) => {
    updateStatus("Connection error - check OBS WebSocket server and settings", "error");
    updateConnectionStatus("Error");
    
    const connectBtn = document.getElementById('connect-btn');
    if (connectBtn) {
      connectBtn.disabled = false;
      connectBtn.innerHTML = '<i class="bi bi-wifi"></i> Connect';
    }
  };

  socket.onclose = (event) => {
    updateStatus("Connection closed - make sure OBS is running and WebSocket server is enabled", "error");
    updateConnectionStatus("Disconnected");
    
    if (autoReconnectEnabled && connectionState.lastConnected) {
      startReconnectTimer();
    }
    
    const connectBtn = document.getElementById('connect-btn');
    if (connectBtn) {
      connectBtn.disabled = false;
      connectBtn.innerHTML = '<i class="bi bi-wifi"></i> Connect';
    }
  };

  setTimeout(() => {
    if (socket && socket.readyState !== WebSocket.OPEN) {
      updateStatus("Connection timeout - check OBS WebSocket settings", "error");
      updateConnectionStatus("Timeout");
      
      const connectBtn = document.getElementById('connect-btn');
      if (connectBtn) {
        connectBtn.disabled = false;
        connectBtn.innerHTML = '<i class="bi bi-wifi"></i> Connect';
      }
    }
  }, 5000);
}

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
  loadVersionInfo();
  forceThemeApplication();
  initThemeSwitcher();
  initPageVisibilityHandling();
  restoreConnectionState();
  initQRScanner();
  
  const disconnectBtn = document.getElementById('disconnect-btn');
  if (disconnectBtn) {
    disconnectBtn.addEventListener('click', disconnectFromOBS);
    disconnectBtn.disabled = true;
  }
  
  const connectBtn = document.getElementById('connect-btn');
  if (connectBtn) {
    connectBtn.addEventListener('click', () => {
      obsIP = document.getElementById('obs-ip').value || 'localhost';
      password = document.getElementById('obs-password').value || '';
      
      connectBtn.disabled = true;
      connectBtn.innerHTML = '<i class="bi bi-hourglass-split"></i> Connecting...';
      
      connect();
    });
  }
  
  const streamBtn = document.getElementById('stream-btn');
  const recordBtn = document.getElementById('record-btn');
  const replayBtn = document.getElementById('replay-btn');
  
  if (streamBtn) {
    streamBtn.addEventListener('click', toggleStream);
  }
  
  if (recordBtn) {
    recordBtn.addEventListener('click', toggleRecording);
  }
  
  if (replayBtn) {
    replayBtn.addEventListener('click', toggleReplayBuffer);
  }
});

// Load version information from package.json
async function loadVersionInfo() {
  try {
    const response = await fetch('/api/status');
    const data = await response.json();
    
    if (data.version) {
      const versionElement = document.getElementById('app-version');
      if (versionElement) {
        versionElement.textContent = data.version;
      }
    }
  } catch (error) {
    // Handle error silently
  }
}

// Function to update audio source UI without full refresh
async function updateAudioSourceUI() {
  const request = {
    op: 6,
    d: {
      requestType: "GetInputList",
      requestId: "update-ui-" + Date.now()
    }
  };
  socket.send(JSON.stringify(request));
}

// Function to update existing audio controls without recreating them
function updateExistingAudioControls(audioSources) {
  if (muteOperationInProgress) {
    return;
  }
  
  audioSources.forEach(source => {
    getInputMute(source.inputName);
  });
}

// Connection management functions
function disconnectFromOBS() {
  if (statsInterval) {
    clearInterval(statsInterval);
    statsInterval = null;
  }
  if (audioSyncInterval) {
    clearInterval(audioSyncInterval);
    audioSyncInterval = null;
  }
  
  if (socket) {
    socket.close();
    socket = null;
  }
  
  connectionState.isConnected = false;
  connectionState.lastConnected = null;
  localStorage.removeItem('obsConnectionState');
  
  updateConnectionStatus("Disconnected");
  updateStatus("Disconnected from OBS", "error");
  
  const sceneContainer = document.getElementById("scene-buttons");
  const audioContainer = document.getElementById('audio-sources');
  sceneContainer.innerHTML = '<div class="alert alert-warning">Disconnected from OBS</div>';
  audioContainer.innerHTML = '<div class="alert alert-warning">Disconnected from OBS</div>';
  
  updateStreamStatus('Inactive');
  updateRecordingStatus('Inactive');
  updateFPSStatus(0);
  
  const connectBtn = document.getElementById('connect-btn');
  const disconnectBtn = document.getElementById('disconnect-btn');
  if (connectBtn) {
    connectBtn.disabled = false;
    connectBtn.innerHTML = '<i class="bi bi-wifi"></i> Connect';
  }
  if (disconnectBtn) disconnectBtn.disabled = true;
}

// Function to restore connection state from localStorage
function restoreConnectionState() {
  const savedState = localStorage.getItem('obsConnectionState');
  if (savedState) {
    try {
      const state = JSON.parse(savedState);
      connectionState = state;
      
      const obsIpField = document.getElementById('obs-ip');
      const obsPasswordField = document.getElementById('obs-password');
      
      if (obsIpField && state.obsIP) {
        obsIpField.value = state.obsIP;
        obsIP = state.obsIP;
      }
      
      if (obsPasswordField && state.password) {
        obsPasswordField.value = state.password;
        password = state.password;
      }
      
      if (state.isConnected && state.lastConnected) {
        const lastConnected = new Date(state.lastConnected);
        const timeSinceConnection = Date.now() - lastConnected.getTime();
        
        if (timeSinceConnection < 5 * 60 * 1000) {
          if (!socket || socket.readyState !== WebSocket.OPEN) {
            setTimeout(() => {
              if (autoReconnectEnabled) {
                attemptReconnect();
              }
            }, 1000);
          }
        } else {
          connectionState.isConnected = false;
          connectionState.lastConnected = null;
          localStorage.removeItem('obsConnectionState');
        }
      }
    } catch (error) {
      localStorage.removeItem('obsConnectionState');
    }
  }
}

// Connection recovery functions
function attemptReconnect() {
  if (!autoReconnectEnabled || reconnectAttempts >= maxReconnectAttempts) {
    return;
  }
  
  reconnectAttempts++;
  
  const savedState = localStorage.getItem('obsConnectionState');
  if (savedState) {
    try {
      const state = JSON.parse(savedState);
      obsIP = state.obsIP || 'localhost';
      password = state.password || '';
      
      const obsIpField = document.getElementById('obs-ip');
      const obsPasswordField = document.getElementById('obs-password');
      if (obsIpField) obsIpField.value = obsIP;
      if (obsPasswordField) obsPasswordField.value = password;
      
      connect();
    } catch (error) {
      // Handle error silently
    }
  }
}

function startReconnectTimer() {
  if (reconnectInterval) {
    clearInterval(reconnectInterval);
  }
  
  reconnectInterval = setInterval(() => {
    if (socket && socket.readyState === WebSocket.OPEN) {
      clearInterval(reconnectInterval);
      reconnectInterval = null;
      reconnectAttempts = 0;
      return;
    }
    
    if (autoReconnectEnabled && reconnectAttempts < maxReconnectAttempts) {
      attemptReconnect();
    } else {
      clearInterval(reconnectInterval);
      reconnectInterval = null;
    }
  }, 5000);
}

// Page visibility API handling
function handlePageVisibilityChange() {
  if (document.visibilityState === 'visible') {
    forceThemeApplication();
    
    if (connectionState.isConnected && connectionState.lastConnected) {
      const lastConnected = new Date(connectionState.lastConnected);
      const timeSinceConnection = Date.now() - lastConnected.getTime();
      
      if (timeSinceConnection < 5 * 60 * 1000) {
        if (!socket || socket.readyState !== WebSocket.OPEN) {
          if (autoReconnectEnabled) {
            attemptReconnect();
          }
        }
      } else {
        connectionState.isConnected = false;
        connectionState.lastConnected = null;
        localStorage.removeItem('obsConnectionState');
      }
    }
  }
}

// Initialize page visibility handling
function initPageVisibilityHandling() {
  document.addEventListener('visibilitychange', handlePageVisibilityChange);
  
  window.addEventListener('focus', () => {
    if (connectionState.isConnected && (!socket || socket.readyState !== WebSocket.OPEN)) {
      reconnectAttempts = 0;
      attemptReconnect();
    }
  });
}

// QR Code Scanner functionality
let qrStream = null;
let qrScanning = false;

function initQRScanner() {
  const qrScanBtn = document.getElementById('qr-scan-btn');
  const qrManualBtn = document.getElementById('qr-manual-btn');
  
  if (qrScanBtn) {
    qrScanBtn.addEventListener('click', openQRScanner);
  }
  
  if (qrManualBtn) {
    qrManualBtn.addEventListener('click', () => {
      const modal = bootstrap.Modal.getInstance(document.getElementById('qrScannerModal'));
      if (modal) {
        modal.hide();
      }
      document.getElementById('obs-ip').focus();
    });
  }
}

function openQRScanner() {
  const modal = new bootstrap.Modal(document.getElementById('qrScannerModal'));
  modal.show();
  
  setTimeout(() => {
    startQRScanner();
  }, 500);
}

async function startQRScanner() {
  const video = document.getElementById('qr-video');
  const status = document.getElementById('qr-status');
  
  try {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error('Camera access not supported in this browser');
    }
    
    const constraints = {
      video: {
        facingMode: { ideal: 'environment' },
        width: { ideal: 1280, min: 320, max: 1920 },
        height: { ideal: 720, min: 240, max: 1080 },
        aspectRatio: { ideal: 16/9, min: 1, max: 2 }
      }
    };
    
    try {
      qrStream = await navigator.mediaDevices.getUserMedia(constraints);
    } catch (fallbackError) {
      const fallbackConstraints = {
        video: {
          facingMode: 'user',
          width: { ideal: 640, min: 320 },
          height: { ideal: 480, min: 240 }
        }
      };
      
      try {
        qrStream = await navigator.mediaDevices.getUserMedia(fallbackConstraints);
      } catch (secondFallbackError) {
        qrStream = await navigator.mediaDevices.getUserMedia({ video: true });
      }
    }
    
    video.srcObject = qrStream;
    
    await new Promise((resolve, reject) => {
      video.onloadedmetadata = () => {
        video.play().then(resolve).catch(reject);
      };
      video.onerror = reject;
      
      setTimeout(() => reject(new Error('Video loading timeout')), 10000);
    });
    
    qrScanning = true;
    
    status.innerHTML = '<i class="bi bi-camera"></i> Camera active. Point at QR code...';
    status.className = 'alert alert-success';
    
    scanQRCode();
    
  } catch (error) {
    let errorMessage = 'Camera access failed. ';
    
    if (error.name === 'NotAllowedError') {
      errorMessage += 'Please allow camera access in your browser settings and try again.';
    } else if (error.name === 'NotFoundError') {
      errorMessage += 'No camera found on this device.';
    } else if (error.name === 'NotSupportedError') {
      errorMessage += 'Camera not supported in this browser.';
    } else if (error.name === 'NotReadableError') {
      errorMessage += 'Camera is already in use by another application.';
    } else if (error.message === 'Video loading timeout') {
      errorMessage += 'Camera took too long to start. Please try again.';
    } else {
      errorMessage += 'Please check your camera permissions and try again.';
    }
    
    status.innerHTML = `<i class="bi bi-exclamation-triangle"></i> ${errorMessage}`;
    status.className = 'alert alert-warning';
    
    const manualBtn = document.getElementById('qr-manual-btn');
    if (manualBtn) {
      manualBtn.style.display = 'block';
      manualBtn.innerHTML = '<i class="bi bi-keyboard"></i> Enter Connection Details Manually';
    }
  }
}

function scanQRCode() {
  if (!qrScanning) return;
  
  const video = document.getElementById('qr-video');
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  
  if (video.videoWidth === 0) {
    setTimeout(scanQRCode, 100);
    return;
  }
  
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  context.drawImage(video, 0, 0, canvas.width, canvas.height);
  
  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  const code = jsQR(imageData.data, imageData.width, imageData.height);
  
  if (code) {
    handleQRCodeResult(code.data);
    return;
  }
  
  setTimeout(scanQRCode, 100);
}

function handleQRCodeResult(qrData) {
  const obsUrlPattern = /^obsws:\/\/([^:]+):(\d+)\/(.+)$/;
  const match = qrData.match(obsUrlPattern);
  
  if (match) {
    const [, host, port, password] = match;
    
    document.getElementById('obs-ip').value = host;
    document.getElementById('obs-password').value = password;
    
    const modal = bootstrap.Modal.getInstance(document.getElementById('qrScannerModal'));
    if (modal) {
      modal.hide();
    }
    
    const status = document.getElementById('qr-status');
    status.innerHTML = '<i class="bi bi-check-circle"></i> QR code scanned successfully! Connection details filled.';
    status.className = 'alert alert-success';
    
    stopQRScanner();
    
  } else {
    const status = document.getElementById('qr-status');
    status.innerHTML = '<i class="bi bi-exclamation-triangle"></i> Invalid QR code format. Expected: obsws://host:port/password';
    status.className = 'alert alert-warning';
    
    setTimeout(() => {
      status.innerHTML = '<i class="bi bi-camera"></i> Camera active. Point at QR code...';
      status.className = 'alert alert-success';
    }, 3000);
  }
}

function stopQRScanner() {
  qrScanning = false;
  
  if (qrStream) {
    qrStream.getTracks().forEach(track => track.stop());
    qrStream = null;
  }
  
  const video = document.getElementById('qr-video');
  if (video) {
    video.srcObject = null;
  }
}

// Clean up QR scanner when modal is closed
document.addEventListener('DOMContentLoaded', function() {
  const qrModal = document.getElementById('qrScannerModal');
  if (qrModal) {
    qrModal.addEventListener('hidden.bs.modal', stopQRScanner);
  }
}); 

// Force theme application for mobile devices
function forceThemeApplication() {
  const savedTheme = localStorage.getItem('obs-theme') || 'ocean';
  
  document.documentElement.setAttribute('data-theme', savedTheme);
  document.documentElement.offsetHeight;
  
  setTimeout(() => {
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateActiveThemeButton(savedTheme);
  }, 100);
} 