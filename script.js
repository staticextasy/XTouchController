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
let muteRequests = new Map(); // Use module-level variable instead of window
let muteOperationInProgress = false; // Flag to prevent interference with user mute operations
let requestIdCounter = 0; // Counter for unique request IDs

// Connection state management
let connectionState = {
  isConnected: false,
  obsIP: "localhost",
  password: "",
  lastConnected: null
};

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

// Debug function to get all inputs
async function getAllInputs() {
  const request = {
    op: 6,
    d: {
      requestType: "GetInputList",
      requestId: "all-inputs-" + Date.now()
    }
  };
  socket.send(JSON.stringify(request));
}

// Function to get input mute status
async function getInputMute(inputName) {
  // Generate a truly unique request ID using counter + timestamp + random
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
  
  // Store the input name for this request
  muteRequests.set(requestId, inputName);
  
  socket.send(JSON.stringify(request));
}



async function toggleAudioMute(inputName) {
  if (!socket || socket.readyState !== WebSocket.OPEN) {
    console.error("WebSocket not connected!");
    return;
  }
  
  // Set flag to prevent periodic updates from interfering
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
    console.error("Failed to send mute toggle request:", error);
    muteOperationInProgress = false; // Reset flag on error
  }
}

async function setAudioVolume(inputName, volume) {
  // Ensure volume is a number and convert to float
  const volumeValue = parseFloat(volume);
  
  // Based on the user's feedback, OBS uses a different scale than -60 to 0 dB
  // We need to apply the inverse of the scaling factor we used in the event handler
  let volumeMultiplier;
  let calculatedDb;
  
     let obsDb; // Declare obsDb at function scope
   
   if (volumeValue === 0) {
     volumeMultiplier = 0; // Mute
     calculatedDb = -60;
     obsDb = -60;
   } else if (volumeValue === 100) {
     volumeMultiplier = 1; // Full volume (0 dB)
     calculatedDb = 0;
     obsDb = 0;
   } else {
     // Convert percentage to dB using our -60 to 0 dB scale
     calculatedDb = (volumeValue / 100) * 60 - 60; // Linear interpolation
     
     // Apply the inverse of our human-friendly mapping
     // Convert our slider percentage back to OBS's dB scale
     
     // Inverse of the power curve: obsDb = (sliderValue/100)^(1/1.5) * 60 - 60
     const normalizedSlider = volumeValue / 100; // 0 to 1 range
     const normalizedObsDb = Math.pow(normalizedSlider, 1/1.5); // Inverse power curve
     obsDb = normalizedObsDb * 60 - 60; // Convert back to -60 to 0 dB range
     
     // Convert OBS's dB to multiplier: multiplier = 10^(obsDb/20)
     volumeMultiplier = Math.pow(10, obsDb / 20);
   }
   

  
  // Check if socket is connected
  if (!socket || socket.readyState !== WebSocket.OPEN) {
    console.error("WebSocket not connected!");
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
    console.error("Failed to send volume set request:", error);
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
  
  // Convert volume multiplier to linear percentage using the corrected scaling
  let sliderValue;
  let initialDb;
  if (source.inputVolumeMul === 0) {
    sliderValue = 0; // Mute
    initialDb = -60;
  } else if (source.inputVolumeMul === 1) {
    sliderValue = 100; // Full volume (0 dB)
    initialDb = 0;
  } else {
    // Convert multiplier to dB: dB = 20 * log10(multiplier)
    const db = 20 * Math.log10(source.inputVolumeMul);
    initialDb = db;
    
         // Apply the same human-friendly mapping
     // Convert OBS's dB to a more intuitive percentage
     
     // Use the same power curve for consistency
     const normalizedDb = (db + 60) / 60; // 0 to 1 range
     sliderValue = Math.pow(normalizedDb, 1.5) * 100; // Power curve for more intuitive feel
     
     // Clamp to valid range
     sliderValue = Math.max(0, Math.min(100, sliderValue));
  }
  
  // Create mute status indicator
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
  
  // Add event listeners instead of inline handlers
  const muteBtn = audioDiv.querySelector('.mute-btn');
  const volumeSlider = audioDiv.querySelector('.volume-slider');
  const dbValue = audioDiv.querySelector('.db-value');
  
  muteBtn.addEventListener('click', () => {
    toggleAudioMute(source.inputName);
  });
  
  volumeSlider.addEventListener('change', (e) => {
    setAudioVolume(source.inputName, e.target.value);
  });
  
     // Add dB value display on slider interaction
   volumeSlider.addEventListener('input', (e) => {
     const volumeValue = parseFloat(e.target.value);
     // Convert slider percentage to OBS dB using the inverse power curve
     const normalizedSlider = volumeValue / 100; // 0 to 1 range
     const normalizedObsDb = Math.pow(normalizedSlider, 1/1.5); // Inverse power curve
     const obsDb = normalizedObsDb * 60 - 60; // Convert to -60 to 0 dB range
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
    
    // More comprehensive audio source filtering
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
    
    // If this is a UI update request, update the existing controls with the fresh data
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
         // Update existing controls without recreating them
         updateExistingAudioControls(audioSources);
       } else {
         // Initial load - create all controls
         audioContainer.innerHTML = '';
         audioSources.forEach(source => {
           audioContainer.appendChild(createAudioSourceElement(source));
         });
         
         // Get mute status for all audio sources after creating the UI
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

  // Handle test connection response
  if (msg.op === 7 && msg.d.requestType === "GetVersion") {
    if (msg.d.error) {
      console.error("OBS WebSocket test failed:", msg.d.error);
    }
  }

  // Handle audio control responses
  if (msg.op === 7 && msg.d.requestType === "ToggleInputMute") {
    if (!msg.d.error) {
      // Get the updated mute status for all audio sources
      setTimeout(() => {
        if (socket && socket.readyState === WebSocket.OPEN && audioSources.length > 0) {
          audioSources.forEach(source => {
            getInputMute(source.inputName);
          });
        }
        // Reset the flag after a delay to allow the GetInputMute responses to come back
        setTimeout(() => {
          muteOperationInProgress = false;
        }, 500);
      }, 100);
    } else {
      console.error("Mute toggle failed:", msg.d.error);
      muteOperationInProgress = false; // Reset flag on error
    }
  }

  if (msg.op === 7 && msg.d.requestType === "SetInputVolume") {
    if (msg.d.error) {
      console.error("Volume set failed:", msg.d.error);
    }
  }

  // Handle input mute status response
  if (msg.op === 7 && msg.d.requestType === "GetInputMute") {
    if (!msg.d.error && msg.d.responseData) {
      // Get the input name from our stored request mapping
      const requestId = msg.d.requestId;
      const inputName = muteRequests.get(requestId);
      const inputMuted = msg.d.responseData.inputMuted;
      
      if (inputName) {
        // Update the specific audio source
        const muteBtn = document.querySelector(`.mute-btn[data-input-name="${inputName}"]`);
        if (muteBtn) {
          // Update button text and class
          muteBtn.textContent = inputMuted ? 'Unmute' : 'Mute';
          muteBtn.className = `btn btn-sm audio-btn mute-btn ${inputMuted ? 'muted' : ''}`;
          
          // Update mute status indicator
          const muteStatus = muteBtn.parentElement.querySelector('.mute-status');
          if (muteStatus) {
            const muteStatusText = muteStatus.querySelector('.mute-status-text');
            if (muteStatusText) {
              muteStatusText.textContent = inputMuted ? 'MUTED' : 'LIVE';
            }
            muteStatus.className = `mute-status me-2 ${inputMuted ? 'muted' : 'unmuted'}`;
          }
        }
        
        // Clean up the request mapping
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
    
    // Update the specific slider for this input
    const volumeSlider = document.querySelector(`[data-input-name="${eventData.inputName}"].volume-slider`);
    if (volumeSlider) {
      // Use OBS's reported dB value directly instead of calculating our own
      const obsDb = eventData.inputVolumeDb;
      
      // Convert OBS's dB value to slider percentage
      // OBS appears to use a different scale than -60 to 0 dB
      // Let's determine the actual scale by analyzing the values
      let newValue;
      
      if (eventData.inputVolumeMul === 0) {
        newValue = 0; // Mute
      } else if (eventData.inputVolumeMul === 1) {
        newValue = 100; // Full volume
      } else {
                 // Make the scaling more human-friendly
         // Instead of linear scaling, let's use a more intuitive mapping
         // where lower volumes (like 14%) map to lower slider positions
         
         // Convert OBS's dB to a more intuitive percentage
         // Use a curve that feels more natural to humans
         
         // For OBS dB values, let's create a more intuitive mapping:
         // -60 dB (mute) = 0%
         // -30 dB = ~25% (instead of 50%)
         // -20 dB = ~50%
         // -10 dB = ~75%
         // 0 dB = 100%
         
         // Use a power curve to make it feel more natural
         const normalizedDb = (obsDb + 60) / 60; // 0 to 1 range
         newValue = Math.pow(normalizedDb, 1.5) * 100; // Power curve for more intuitive feel
         
         // Clamp to valid range
         newValue = Math.max(0, Math.min(100, newValue));
      }
      
      const currentValue = parseFloat(volumeSlider.value);
      
      if (Math.abs(currentValue - newValue) > 0.1) {
        volumeSlider.value = newValue;
      }
      
      // Update audio level indicator
      const audioLevelFill = volumeSlider.parentElement.parentElement.querySelector('.audio-level-fill');
      if (audioLevelFill) {
        audioLevelFill.style.width = `${newValue}%`;
      }
      
      // Update dB value display - use OBS's reported dB
      const dbValue = volumeSlider.parentElement.querySelector('.db-value');
      if (dbValue) {
        dbValue.textContent = `${obsDb.toFixed(1)} dB`;
      }
    }
  }
}

// Enhanced connection function
async function connect() {
  updateStatus("Connecting to OBS...", "connecting");
  updateConnectionStatus("Connecting");
  socket = new WebSocket(`ws://${obsIP}:4455`);

     socket.onopen = () => {
     updateStatus("Connected! Authenticating...", "connecting");
     updateConnectionStatus("Connected");
     
     // Save connection state
     connectionState.isConnected = true;
     connectionState.obsIP = obsIP;
     connectionState.password = password;
     connectionState.lastConnected = new Date().toISOString();
     localStorage.setItem('obsConnectionState', JSON.stringify(connectionState));
     
     // Update button state
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

    // Handle identification
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

    // Handle identified
    if (msg.op === 2) {
      updateStatus("Authenticated! Loading data...", "connecting");
      
      // Load all data
      getSceneList();
      getAudioSources();
      getStreamStatus();
      getRecordStatus();
      getReplayBufferStatus();
      getStats();
      
      // Set up periodic updates
      statsInterval = setInterval(() => {
        if (socket && socket.readyState === WebSocket.OPEN) {
          getStats();
        }
      }, 2000); // Update stats every 2 seconds
      
      // Set up periodic audio source updates to sync with OBS
      audioSyncInterval = setInterval(() => {
        if (socket && socket.readyState === WebSocket.OPEN) {
          updateAudioSourceUI();
        }
      }, 2000); // Update audio sources every 2 seconds
    }

    // Handle all other messages
    handleObsMessage(msg);

    // Original scene handling
    if (msg.op === 7 && msg.d.requestType === "GetSceneList") {
      if (msg.d.responseData && msg.d.responseData.scenes) {
        const scenes = msg.d.responseData.scenes;
        const container = document.getElementById("scene-buttons");
        container.innerHTML = ""; // Clear loading message
        scenes.forEach(s => {
          container.appendChild(createSceneButton(s.sceneName));
        });
      } else {
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
      }
    }
  };

  socket.onerror = (err) => {
    console.error("WebSocket error:", err);
    updateStatus("Connection error - check OBS WebSocket server and settings", "error");
    updateConnectionStatus("Error");
    
    // Reset connect button
    const connectBtn = document.getElementById('connect-btn');
    if (connectBtn) {
      connectBtn.disabled = false;
      connectBtn.innerHTML = '<i class="bi bi-wifi"></i> Connect';
    }
  };

  socket.onclose = (event) => {
    updateStatus("Connection closed - make sure OBS is running and WebSocket server is enabled", "error");
    updateConnectionStatus("Disconnected");
    
    // Reset connect button
    const connectBtn = document.getElementById('connect-btn');
    if (connectBtn) {
      connectBtn.disabled = false;
      connectBtn.innerHTML = '<i class="bi bi-wifi"></i> Connect';
    }
  };

  // Add connection timeout
  setTimeout(() => {
    if (socket && socket.readyState !== WebSocket.OPEN) {
      updateStatus("Connection timeout - check OBS WebSocket settings", "error");
      updateConnectionStatus("Timeout");
      
      // Reset connect button
      const connectBtn = document.getElementById('connect-btn');
      if (connectBtn) {
        connectBtn.disabled = false;
        connectBtn.innerHTML = '<i class="bi bi-wifi"></i> Connect';
      }
    }
  }, 5000); // 5 second timeout
}

      // Initialize the application
   document.addEventListener('DOMContentLoaded', function() {
     // Load version information
     loadVersionInfo();
     
     // Initialize theme switcher
     initThemeSwitcher();
     
     // Restore connection state from localStorage
     restoreConnectionState();
     
     // Set up disconnect/reconnect button event listeners
     const disconnectBtn = document.getElementById('disconnect-btn');
     
     if (disconnectBtn) {
       disconnectBtn.addEventListener('click', disconnectFromOBS);
       disconnectBtn.disabled = true;
     }
     
     // Set up connect button event listener
     const connectBtn = document.getElementById('connect-btn');
     if (connectBtn) {
       connectBtn.addEventListener('click', () => {
         // Get values from input fields
         obsIP = document.getElementById('obs-ip').value || 'localhost';
         password = document.getElementById('obs-password').value || '';
         
         // Update button state
         connectBtn.disabled = true;
         connectBtn.innerHTML = '<i class="bi bi-hourglass-split"></i> Connecting...';
         
         // Start connection
         connect();
       });
     }
     
     // Set up stream/record control button event listeners
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
    console.error('Failed to load version info:', error);
  }
}

// Function to update audio source UI without full refresh
async function updateAudioSourceUI() {
  // Get current audio sources to update button states
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
  // Skip mute status updates if a user-initiated mute operation is in progress
  if (muteOperationInProgress) {
    return;
  }
  
  // Since GetInputList doesn't provide mute/volume status, we need to request it for each source
  audioSources.forEach(source => {
    // Request mute status for this source
    getInputMute(source.inputName);
    
    // Note: Volume updates will come from InputVolumeChanged events
    // We don't need to request volume status here
  });
}



   // Connection management functions
  function disconnectFromOBS() {
    // Clear intervals to prevent null socket access
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
    
    // Clear connection state
    connectionState.isConnected = false;
    connectionState.lastConnected = null;
    localStorage.removeItem('obsConnectionState');
    
    updateConnectionStatus("Disconnected");
    updateStatus("Disconnected from OBS", "error");
    
    // Clear all UI elements
    const sceneContainer = document.getElementById("scene-buttons");
    const audioContainer = document.getElementById('audio-sources');
    sceneContainer.innerHTML = '<div class="alert alert-warning">Disconnected from OBS</div>';
    audioContainer.innerHTML = '<div class="alert alert-warning">Disconnected from OBS</div>';
    
    // Reset status indicators
    updateStreamStatus('Inactive');
    updateRecordingStatus('Inactive');
    updateFPSStatus(0);
    
    // Update button state
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
      
      // Restore connection fields if they exist
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
      
      // If we were previously connected, show reconnection option
      if (state.isConnected && state.lastConnected) {
        const lastConnected = new Date(state.lastConnected);
        const timeSinceConnection = Date.now() - lastConnected.getTime();
        
        // If connection was within the last 5 minutes, offer to reconnect
        if (timeSinceConnection < 5 * 60 * 1000) {
          console.log('Previous connection found, offering reconnection...');
          // Don't auto-reconnect, just update UI to show reconnection is available
          const connectBtn = document.getElementById('connect-btn');
          if (connectBtn) {
            connectBtn.disabled = false;
            connectBtn.innerHTML = '<i class="bi bi-wifi"></i> Reconnect';
          }
        }
      }
    } catch (error) {
      console.error('Failed to restore connection state:', error);
      localStorage.removeItem('obsConnectionState');
    }
  }
}

   // Global functions for debugging (accessible from browser console)
  window.getAudioSources = getAudioSources;
  window.getAllInputs = getAllInputs;
  window.disconnectFromOBS = disconnectFromOBS;
  window.checkMuteRequests = () => {
    console.log("Current muteRequests state:");
    console.log(`  - Size: ${muteRequests.size}`);
    console.log(`  - Keys: ${Array.from(muteRequests.keys())}`);
    console.log(`  - Values: ${Array.from(muteRequests.values())}`);
    console.log(`  - muteOperationInProgress: ${muteOperationInProgress}`);
    console.log(`  - requestIdCounter: ${requestIdCounter}`);
  }; 