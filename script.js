// CONFIGURATION - Update these values for your setup
const password = ""; // Leave empty if no password, or enter your OBS WebSocket password
const obsIP = "localhost"; // Use "localhost" if OBS is on the same PC, or enter the IP address
let socket;

// Global state variables
let isStreaming = false;
let isRecording = false;
let isReplayBufferActive = false;
let audioSources = [];
let currentFPS = 0;

// Theme switcher functionality
function initThemeSwitcher() {
  const themeBtns = document.querySelectorAll('.theme-btn');
  const savedTheme = localStorage.getItem('obs-theme') || 'ocean';
  
  // Set initial theme
  document.documentElement.setAttribute('data-theme', savedTheme);
  updateActiveThemeButton(savedTheme);
  
  // Add click handlers
  themeBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const theme = btn.getAttribute('data-theme');
      setTheme(theme);
    });
  });
}

function setTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('obs-theme', theme);
  updateActiveThemeButton(theme);
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
  console.log("Status:", message);
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
  console.log("Requesting scene list:", request);
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
  console.log("Switching to scene:", sceneName, request);
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
  console.log(isStreaming ? "Stopping stream..." : "Starting stream...");
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
  console.log(isRecording ? "Stopping recording..." : "Starting recording...");
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
  console.log(isReplayBufferActive ? "Stopping replay buffer..." : "Starting replay buffer...");
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

async function toggleAudioMute(inputName) {
  const request = {
    op: 6,
    d: {
      requestType: "ToggleInputMute",
      requestId: "mute-toggle-" + Date.now(),
      requestData: {
        inputName: inputName
      }
    }
  };
  socket.send(JSON.stringify(request));
}

async function setAudioVolume(inputName, volume) {
  const request = {
    op: 6,
    d: {
      requestType: "SetInputVolume",
      requestId: "volume-set-" + Date.now(),
      requestData: {
        inputName: inputName,
        inputVolumeMul: volume / 100
      }
    }
  };
  socket.send(JSON.stringify(request));
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
  audioDiv.innerHTML = `
    <div class="audio-info d-flex align-items-center">
      <span class="audio-name me-3">${source.inputName}</span>
      <div class="audio-level">
        <div class="audio-level-fill" style="width: ${source.inputVolumeMul * 100}%"></div>
      </div>
    </div>
    <div class="audio-controls d-flex align-items-center">
      <button class="btn btn-sm audio-btn mute-btn ${source.inputMuted ? 'muted' : ''}" 
              onclick="toggleAudioMute('${source.inputName}')">
        ${source.inputMuted ? 'Unmute' : 'Mute'}
      </button>
      <input type="range" class="volume-slider ms-2" min="0" max="100" 
             value="${source.inputVolumeMul * 100}"
             onchange="setAudioVolume('${source.inputName}', this.value)">
    </div>
  `;
  return audioDiv;
}

// Enhanced message handler
function handleObsMessage(msg) {
  console.log("Handling message:", msg);

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
  if (msg.op === 7 && msg.d.requestType === "GetInputList") {
    const inputs = msg.d.responseData?.inputs || [];
    audioSources = inputs.filter(input => input.inputKind.includes('audio'));
    
    const audioContainer = document.getElementById('audio-sources');
    audioContainer.innerHTML = '';
    
            if (audioSources.length === 0) {
          audioContainer.innerHTML = '<div class="alert alert-warning">No audio sources found</div>';
        } else {
      audioSources.forEach(source => {
        audioContainer.appendChild(createAudioSourceElement(source));
      });
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
      getStreamStatus(); // Refresh status
    }
  }

  if (msg.op === 7 && (msg.d.requestType === "StartRecord" || msg.d.requestType === "StopRecord")) {
    if (!msg.d.error) {
      getRecordStatus(); // Refresh status
    }
  }

  if (msg.op === 7 && (msg.d.requestType === "StartReplayBuffer" || msg.d.requestType === "StopReplayBuffer")) {
    if (!msg.d.error) {
      getReplayBufferStatus(); // Refresh status
    }
  }
}

// Enhanced connection function
async function connect() {
  updateStatus("Connecting to OBS...", "connecting");
  updateConnectionStatus("Connecting");
  socket = new WebSocket(`ws://${obsIP}:4455`);

  socket.onopen = () => {
    console.log("WebSocket opened");
    updateStatus("Connected! Authenticating...", "connecting");
    updateConnectionStatus("Connected");
  };

  socket.onmessage = async (event) => {
    console.log("Received message:", event.data);
    const msg = JSON.parse(event.data);

    // Handle identification
    if (msg.op === 0) {
      console.log("Received identification:", msg.d);
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
      console.log("Sending identify:", identifyMessage);
      socket.send(JSON.stringify(identifyMessage));
    }

    // Handle identified
    if (msg.op === 2) {
      console.log("Successfully identified!");
      updateStatus("Authenticated! Loading data...", "connecting");
      
      // Load all data
      getSceneList();
      getAudioSources();
      getStreamStatus();
      getRecordStatus();
      getReplayBufferStatus();
      getStats();
      
      // Set up periodic updates
      setInterval(() => {
        if (socket.readyState === WebSocket.OPEN) {
          getStats();
        }
      }, 2000); // Update stats every 2 seconds
    }

    // Handle all other messages
    handleObsMessage(msg);

    // Original scene handling
    if (msg.op === 7 && msg.d.requestType === "GetSceneList") {
      console.log("Scene list response:", msg.d);
      if (msg.d.responseData && msg.d.responseData.scenes) {
        const scenes = msg.d.responseData.scenes;
        const container = document.getElementById("scene-buttons");
        container.innerHTML = ""; // Clear loading message
        scenes.forEach(s => {
          container.appendChild(createSceneButton(s.sceneName));
        });
        console.log("Loaded", scenes.length, "scenes");
      } else {
        console.error("No scenes in response:", msg.d);
        updateStatus("No scenes found in response", "error");
      }
    }

    // Handle errors
    if (msg.op === 7 && msg.d.error) {
      console.error("Request error:", msg.d);
      updateStatus(`Error: ${msg.d.error}`, "error");
    }

    // Handle authentication failure
    if (msg.op === 7 && msg.d.error && msg.d.error.includes("authentication")) {
      console.error("Authentication failed:", msg.d.error);
      updateStatus("Authentication failed - check password", "error");
      updateConnectionStatus("Auth Failed");
    }

    // Handle scene switch response
    if (msg.op === 7 && msg.d.requestType === "SetCurrentProgramScene") {
      if (msg.d.error) {
        console.error("Scene switch error:", msg.d.error);
      } else {
        console.log("Scene switched successfully");
      }
    }
  };

  socket.onerror = (err) => {
    console.error("WebSocket error:", err);
    updateStatus("Connection error - check OBS WebSocket server and settings", "error");
    updateConnectionStatus("Error");
  };

  socket.onclose = (event) => {
    console.log("WebSocket closed:", event.code, event.reason);
    updateStatus("Connection closed - make sure OBS is running and WebSocket server is enabled", "error");
    updateConnectionStatus("Disconnected");
  };

  // Add connection timeout
  setTimeout(() => {
    if (socket.readyState !== WebSocket.OPEN) {
      updateStatus("Connection timeout - check OBS WebSocket settings", "error");
      updateConnectionStatus("Timeout");
    }
  }, 5000); // 5 second timeout
}

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
  // Load version information
  loadVersionInfo();
  
  // Start the connection
  connect();
  initThemeSwitcher(); // Initialize theme switcher
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
    console.error('Failed to load version info:', error);
  }
} 