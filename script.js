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
  console.log("Requesting input list for audio sources...");
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
  console.log("Requesting all inputs for debugging...");
  socket.send(JSON.stringify(request));
}

// Function to get specific input properties
async function getInputProperties(inputName) {
  const request = {
    op: 6,
    d: {
      requestType: "GetInputProperties",
      requestId: "input-props-" + Date.now(),
      requestData: {
        inputName: inputName
      }
    }
  };
  console.log(`Getting properties for: ${inputName}`);
  socket.send(JSON.stringify(request));
}

// Test function to check if OBS WebSocket is working
async function testObsConnection() {
  console.log("Testing OBS WebSocket connection...");
  
  if (!socket || socket.readyState !== WebSocket.OPEN) {
    console.error("WebSocket not connected for test!");
    return;
  }
  
  const request = {
    op: 6,
    d: {
      requestType: "GetVersion",
      requestId: "test-connection-" + Date.now()
    }
  };
  
  console.log("Sending test request:", request);
  socket.send(JSON.stringify(request));
}

async function toggleAudioMute(inputName) {
  console.log(`Toggling mute for: ${inputName}`);
  
  // Check if socket is connected
  if (!socket || socket.readyState !== WebSocket.OPEN) {
    console.error("WebSocket not connected!");
    return;
  }
  
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
  console.log("Sending mute toggle request:", request);
  
  try {
    socket.send(JSON.stringify(request));
    console.log("Mute toggle request sent successfully");
  } catch (error) {
    console.error("Failed to send mute toggle request:", error);
  }
}

async function setAudioVolume(inputName, volume) {
  // Ensure volume is a number and convert to float
  const volumeValue = parseFloat(volume);
  
  // Based on the user's feedback, OBS uses a different scale than -60 to 0 dB
  // We need to apply the inverse of the scaling factor we used in the event handler
  let volumeMultiplier;
  let calculatedDb;
  
  if (volumeValue === 0) {
    volumeMultiplier = 0; // Mute
    calculatedDb = -60;
  } else if (volumeValue === 100) {
    volumeMultiplier = 1; // Full volume (0 dB)
    calculatedDb = 0;
  } else {
    // Convert percentage to dB using our -60 to 0 dB scale
    calculatedDb = (volumeValue / 100) * 60 - 60; // Linear interpolation
    
    // Apply inverse scaling factor to match OBS's scale
    // If our -18.4 corresponds to OBS's -30, then scalingFactor = -18.4 / -30 ≈ 0.613
    // So to convert our dB to OBS's dB: obsDb = ourDb / scalingFactor
    const scalingFactor = -18.4 / -30; // ≈ 0.613
    const obsDb = calculatedDb / scalingFactor;
    
    // Convert OBS's dB to multiplier: multiplier = 10^(obsDb/20)
    volumeMultiplier = Math.pow(10, obsDb / 20);
  }
  
  console.log(`Setting volume for ${inputName}:`);
  console.log(`  - Raw slider value: ${volume}%`);
  console.log(`  - Parsed value: ${volumeValue}%`);
  console.log(`  - Our calculated dB: ${calculatedDb.toFixed(2)} dB`);
  console.log(`  - OBS target dB: ${(calculatedDb / (-18.4 / -30)).toFixed(2)} dB`);
  console.log(`  - Volume multiplier: ${volumeMultiplier.toFixed(6)}`);
  
  // Double-check our conversion by converting back
  const verificationObsDb = volumeMultiplier === 0 ? -60 : 20 * Math.log10(volumeMultiplier);
  const verificationOurDb = verificationObsDb * (-18.4 / -30);
  const verificationPercentage = ((verificationOurDb + 60) / 60) * 100;
  console.log(`  - Verification: ${verificationPercentage.toFixed(2)}% -> ${verificationObsDb.toFixed(2)} dB (OBS)`);
  
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
  console.log("Sending volume set request:", request);
  
  try {
    socket.send(JSON.stringify(request));
    console.log("Volume set request sent successfully");
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
    
    // Apply scaling factor to convert OBS's dB to our expected dB
    // If OBS -30 corresponds to our -18.4, then scalingFactor = -18.4 / -30 ≈ 0.613
    const scalingFactor = -18.4 / -30; // ≈ 0.613
    const scaledDb = db * scalingFactor;
    
    // Convert dB to percentage: 0% = -60 dB, 100% = 0 dB
    sliderValue = ((scaledDb + 60) / 60) * 100;
    
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
    console.log(`Slider changed for ${source.inputName}:`);
    console.log(`  - Event target value: ${e.target.value}`);
    console.log(`  - Event target type: ${typeof e.target.value}`);
    setAudioVolume(source.inputName, e.target.value);
  });
  
  // Add dB value display on slider interaction
  volumeSlider.addEventListener('input', (e) => {
    const volumeValue = parseFloat(e.target.value);
    // Convert linear percentage to dB: 0% = -60 dB, 100% = 0 dB
    const db = (volumeValue / 100) * 60 - 60;
    dbValue.textContent = `${db.toFixed(1)} dB`;
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

  // Handle all inputs (debug)
  if (msg.op === 7 && msg.d.requestType === "GetInputList" && msg.d.requestId?.includes("all-inputs")) {
    const inputs = msg.d.responseData?.inputs || [];
    console.log("=== ALL INPUTS DEBUG ===");
    inputs.forEach(input => {
      console.log(`Input: ${input.inputName} | Kind: ${input.inputKind} | Muted: ${input.inputMuted} | Volume: ${input.inputVolumeMul}`);
    });
    console.log("=== END DEBUG ===");
  }

  // Handle audio sources
  if (msg.op === 7 && msg.d.requestType === "GetInputList" && !msg.d.requestId?.includes("all-inputs")) {
    const inputs = msg.d.responseData?.inputs || [];
    console.log("All inputs received:", inputs);
    
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
    
    console.log("Filtered audio sources:", audioSources);
    
    const audioContainer = document.getElementById('audio-sources');
    
    // Check if this is a UI update request (not initial load)
    const isUIUpdate = msg.d.requestId?.includes("update-ui");
    
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
    console.log("OBS Version response:", msg.d);
    if (!msg.d.error) {
      console.log("✅ OBS WebSocket connection is working!");
      console.log("OBS Version:", msg.d.responseData?.obsVersion);
      console.log("WebSocket Version:", msg.d.responseData?.obsWebSocketVersion);
    } else {
      console.error("❌ OBS WebSocket test failed:", msg.d.error);
    }
  }

  // Handle audio control responses
  if (msg.op === 7 && msg.d.requestType === "ToggleInputMute") {
    console.log("Mute toggle response:", msg.d);
    if (!msg.d.error) {
      console.log("✅ Mute toggle successful");
      // Update the specific button text without full refresh
      updateAudioSourceUI();
    } else {
      console.error("❌ Mute toggle failed:", msg.d.error);
    }
  }

  if (msg.op === 7 && msg.d.requestType === "SetInputVolume") {
    console.log("Volume set response:", msg.d);
    if (!msg.d.error) {
      console.log("✅ Volume set successful");
      // Don't refresh UI for volume changes to prevent slider snapping
      // The slider will stay where the user set it
    } else {
      console.error("❌ Volume set failed:", msg.d.error);
    }
  }

  // Handle volume change events from OBS
  if (msg.op === 5 && msg.d.eventType === "InputVolumeChanged") {
    const eventData = msg.d.eventData;
    console.log("🎵 Volume changed event:", eventData);
    console.log(`  - Input: ${eventData.inputName}`);
    console.log(`  - Volume Mul: ${eventData.inputVolumeMul}`);
    console.log(`  - Volume dB: ${eventData.inputVolumeDb}`);
    
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
        // Based on the user's report: website -18.4 vs OBS -30
        // This suggests OBS might be using a different scale
        // Let's try using OBS's reported dB directly and map it to our slider
        // Assuming OBS's scale might be something like -infinity to 0 dB
        // For now, let's use a linear mapping based on the observed values
        
        // If OBS reports -30 dB and we want that to correspond to our slider position
        // We need to find the relationship between OBS's dB scale and our 0-100% scale
        
        // Let's try mapping OBS's dB to our slider using a different approach
        // Since OBS -30 corresponds to our -18.4, there's a scaling factor
        const scalingFactor = -18.4 / -30; // ≈ 0.613
        
        // Apply this scaling factor to convert OBS dB to our expected dB
        const scaledDb = obsDb * scalingFactor;
        
        // Now convert to percentage using our -60 to 0 dB scale
        newValue = ((scaledDb + 60) / 60) * 100;
        
        // Clamp to valid range
        newValue = Math.max(0, Math.min(100, newValue));
      }
      
      const currentValue = parseFloat(volumeSlider.value);
      
      console.log(`  - OBS reported dB: ${obsDb.toFixed(2)} dB`);
      console.log(`  - OBS volume mul: ${eventData.inputVolumeMul.toFixed(6)}`);
      console.log(`  - Current slider: ${currentValue}%`);
      console.log(`  - Calculated percentage: ${newValue.toFixed(2)}%`);
      console.log(`  - Scaling factor used: ${scalingFactor?.toFixed(3) || 'N/A'}`);
      
      if (Math.abs(currentValue - newValue) > 0.1) {
        volumeSlider.value = newValue;
        console.log(`✅ Updated slider for ${eventData.inputName}: ${currentValue}% -> ${newValue.toFixed(2)}%`);
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
      getAllInputs(); // Debug: get all inputs
      getStreamStatus();
      getRecordStatus();
      getReplayBufferStatus();
      getStats();
      
      // Test OBS WebSocket connection
      setTimeout(() => {
        testObsConnection();
      }, 1000);
      
             // Set up periodic updates
       setInterval(() => {
         if (socket.readyState === WebSocket.OPEN) {
           getStats();
         }
       }, 2000); // Update stats every 2 seconds
       
               // Set up periodic audio source updates to sync with OBS
        setInterval(() => {
          if (socket.readyState === WebSocket.OPEN) {
            console.log("🔄 Periodic audio sync triggered");
            updateAudioSourceUI();
          }
        }, 2000); // Update audio sources every 2 seconds (more frequent)
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
  console.log("Updating existing audio controls with:", audioSources);
  
  audioSources.forEach(source => {
    const muteBtn = document.querySelector(`[data-input-name="${source.inputName}"]`);
    if (muteBtn) {
      // Update button text and class
      muteBtn.textContent = source.inputMuted ? 'Unmute' : 'Mute';
      muteBtn.className = `btn btn-sm audio-btn mute-btn ${source.inputMuted ? 'muted' : ''}`;
      
      // Update mute status indicator
      const muteStatus = muteBtn.parentElement.querySelector('.mute-status');
      if (muteStatus) {
        const muteStatusText = muteStatus.querySelector('.mute-status-text');
        if (muteStatusText) {
          muteStatusText.textContent = source.inputMuted ? 'MUTED' : 'LIVE';
        }
        muteStatus.className = `mute-status me-2 ${source.inputMuted ? 'muted' : 'unmuted'}`;
      }
      
             // Update volume slider value (but don't trigger change event)
       const volumeSlider = muteBtn.parentElement.querySelector('.volume-slider');
       if (volumeSlider) {
         const currentValue = parseFloat(volumeSlider.value);
         
         // Convert volume multiplier to linear percentage using the corrected scaling
         let newValue;
         let calculatedDb;
         if (source.inputVolumeMul === 0) {
           newValue = 0; // Mute
           calculatedDb = -60;
         } else if (source.inputVolumeMul === 1) {
           newValue = 100; // Full volume (0 dB)
           calculatedDb = 0;
         } else {
           // Convert multiplier to dB: dB = 20 * log10(multiplier)
           calculatedDb = 20 * Math.log10(source.inputVolumeMul);
           
           // Apply scaling factor to convert OBS's dB to our expected dB
           // If OBS -30 corresponds to our -18.4, then scalingFactor = -18.4 / -30 ≈ 0.613
           const scalingFactor = -18.4 / -30; // ≈ 0.613
           const scaledDb = calculatedDb * scalingFactor;
           
           // Convert dB to percentage: 0% = -60 dB, 100% = 0 dB
           newValue = ((scaledDb + 60) / 60) * 100;
           
           // Clamp to valid range
           newValue = Math.max(0, Math.min(100, newValue));
         }
         
         console.log(`Checking ${source.inputName}: current=${currentValue}%, new=${newValue.toFixed(2)}%, diff=${Math.abs(currentValue - newValue).toFixed(2)}`);
         console.log(`  - OBS volume mul: ${source.inputVolumeMul.toFixed(6)}`);
         console.log(`  - OBS calculated dB: ${calculatedDb.toFixed(2)} dB`);
         console.log(`  - Scaled dB: ${(calculatedDb * (-18.4 / -30)).toFixed(2)} dB`);
         
         // Always update the slider to match OBS (remove threshold)
         if (Math.abs(currentValue - newValue) > 0.1) {
           volumeSlider.value = newValue;
           console.log(`✅ Updated slider for ${source.inputName}: ${currentValue}% -> ${newValue.toFixed(1)}%`);
           
           // Update dB value display - use OBS's calculated dB
           const dbValue = muteBtn.parentElement.querySelector('.db-value');
           if (dbValue) {
             dbValue.textContent = `${calculatedDb.toFixed(1)} dB`;
           }
         }
       }
      
      // Update audio level indicator
      const audioLevelFill = muteBtn.parentElement.parentElement.querySelector('.audio-level-fill');
      if (audioLevelFill) {
        audioLevelFill.style.width = `${source.inputVolumeMul * 100}%`;
      }
    } else {
      console.log(`❌ Could not find mute button for: ${source.inputName}`);
    }
  });
}

// Function to manually refresh audio sources (for debugging)
function refreshAudioSources() {
  console.log("🔄 Manually refreshing audio sources...");
  updateAudioSourceUI();
}

// Function to force immediate sync with OBS
function forceSyncWithOBS() {
  console.log("🚀 Force syncing with OBS...");
  if (socket && socket.readyState === WebSocket.OPEN) {
    const request = {
      op: 6,
      d: {
        requestType: "GetInputList",
        requestId: "force-sync-" + Date.now()
      }
    };
    socket.send(JSON.stringify(request));
  } else {
    console.error("❌ WebSocket not connected!");
  }
}

// Global functions for debugging (accessible from browser console)
window.testObsConnection = testObsConnection;
window.getAudioSources = getAudioSources;
window.getAllInputs = getAllInputs;
window.refreshAudioSources = refreshAudioSources;
window.forceSyncWithOBS = forceSyncWithOBS; 