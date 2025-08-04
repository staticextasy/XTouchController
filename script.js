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
let statsInterval = null;
let audioSyncInterval = null;
let muteRequests = new Map(); // Use module-level variable instead of window

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

// Function to get input mute status
async function getInputMute(inputName) {
  const requestId = "input-mute-" + Date.now();
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
  console.log(`Getting mute status for: ${inputName} with requestId: ${requestId}`);
  
  // Store the input name for this request
  muteRequests.set(requestId, inputName);
  console.log(`📝 Stored requestId: ${requestId} -> ${inputName}`);
  console.log(`📝 Total stored requests: ${muteRequests.size}`);
  console.log(`📝 Map contents after storing:`, {
    size: muteRequests.size,
    keys: Array.from(muteRequests.keys()),
    values: Array.from(muteRequests.values())
  });
  
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
   
   console.log(`Setting volume for ${inputName}:`);
   console.log(`  - Raw slider value: ${volume}%`);
   console.log(`  - Parsed value: ${volumeValue}%`);
   console.log(`  - Our calculated dB: ${calculatedDb.toFixed(2)} dB`);
   console.log(`  - OBS target dB: ${obsDb.toFixed(2)} dB`);
   console.log(`  - Volume multiplier: ${volumeMultiplier.toFixed(6)}`);
   
   // Double-check our conversion by converting back
   const verificationObsDb = volumeMultiplier === 0 ? -60 : 20 * Math.log10(volumeMultiplier);
   const verificationNormalizedDb = (verificationObsDb + 60) / 60;
   const verificationSlider = Math.pow(verificationNormalizedDb, 1.5) * 100;
   console.log(`  - Verification: ${verificationSlider.toFixed(2)}% -> ${verificationObsDb.toFixed(2)} dB (OBS)`);
  
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
    console.log(`🔘 Mute button clicked for: ${source.inputName}`);
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
      console.log(`  Full input object:`, input);
    });
    console.log("=== END DEBUG ===");
  }

  // Handle audio sources
  if (msg.op === 7 && msg.d.requestType === "GetInputList" && !msg.d.requestId?.includes("all-inputs")) {
    const inputs = msg.d.responseData?.inputs || [];
    console.log("All inputs received:", inputs);
    
    // Debug: Log the first input to see what properties are available
    if (inputs.length > 0) {
      console.log("=== FIRST INPUT DEBUG ===");
      console.log("First input object:", inputs[0]);
      console.log("Available properties:", Object.keys(inputs[0]));
      console.log("=== END FIRST INPUT DEBUG ===");
    }
    
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
    
         // If this is a UI update request, update the existing controls with the fresh data
     const isUIUpdate = msg.d.requestId?.includes("update-ui");
     const isMuteStatusUpdate = msg.d.requestId?.includes("mute-status-update");
     
     if (isUIUpdate || isMuteStatusUpdate) {
       console.log("🔄 UI update requested - updating existing controls with fresh data");
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
      // Get the updated mute status for all audio sources
      console.log("🔄 Getting updated mute status for all audio sources");
      setTimeout(() => {
        if (socket && socket.readyState === WebSocket.OPEN && audioSources.length > 0) {
          audioSources.forEach(source => {
            getInputMute(source.inputName);
          });
        }
      }, 100);
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

  // Handle input mute status response
  if (msg.op === 7 && msg.d.requestType === "GetInputMute") {
    console.log("Input mute status response:", msg.d);
    if (!msg.d.error && msg.d.responseData) {
      // Get the input name from our stored request mapping
      const requestId = msg.d.requestId;
      console.log(`🔍 Looking for requestId: ${requestId}`);
      console.log(`🔍 muteRequests exists: ${!!muteRequests}`);
      console.log(`🔍 muteRequests size: ${muteRequests.size}`);
      console.log(`🔍 All stored requestIds:`, Array.from(muteRequests.keys()));
      console.log(`🔍 All stored values:`, Array.from(muteRequests.values()));
      
      const inputName = muteRequests.get(requestId);
      const inputMuted = msg.d.responseData.inputMuted;
      
      if (inputName) {
        console.log(`🔧 Updating mute status for ${inputName}: ${inputMuted ? 'MUTED' : 'LIVE'}`);
        
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
              console.log(`🔇 Updated mute status for ${inputName}: ${inputMuted ? 'MUTED' : 'LIVE'}`);
            }
            muteStatus.className = `mute-status me-2 ${inputMuted ? 'muted' : 'unmuted'}`;
          }
        } else {
          console.error(`❌ Could not find mute button for ${inputName}`);
        }
        
        // Clean up the request mapping
        muteRequests.delete(requestId);
        console.log(`🗑️ Cleaned up requestId: ${requestId}`);
      } else {
        console.error(`❌ Could not find input name for requestId: ${requestId}`);
        console.error(`❌ This might be due to page refresh or timing issues`);
        console.error(`❌ Map state:`, {
          exists: !!muteRequests,
          size: muteRequests.size,
          keys: Array.from(muteRequests.keys())
        });
      }
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
      
             console.log(`  - OBS reported dB: ${obsDb.toFixed(2)} dB`);
       console.log(`  - OBS volume mul: ${eventData.inputVolumeMul.toFixed(6)}`);
       console.log(`  - Current slider: ${currentValue}%`);
       console.log(`  - Calculated percentage: ${newValue.toFixed(2)}%`);
       console.log(`  - Power curve mapping: normalized=${((obsDb + 60) / 60).toFixed(3)} -> slider=${newValue.toFixed(1)}%`);
      
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
     
     // Update button state
     const reconnectBtn = document.getElementById('reconnect-btn');
     const disconnectBtn = document.getElementById('disconnect-btn');
     if (reconnectBtn) reconnectBtn.disabled = true;
     if (disconnectBtn) disconnectBtn.disabled = false;
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
        statsInterval = setInterval(() => {
          if (socket && socket.readyState === WebSocket.OPEN) {
            getStats();
          }
        }, 2000); // Update stats every 2 seconds
        
        // Set up periodic audio source updates to sync with OBS
         audioSyncInterval = setInterval(() => {
           if (socket && socket.readyState === WebSocket.OPEN) {
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
    if (socket && socket.readyState !== WebSocket.OPEN) {
      updateStatus("Connection timeout - check OBS WebSocket settings", "error");
      updateConnectionStatus("Timeout");
    }
  }, 5000); // 5 second timeout
}

      // Initialize the application
   document.addEventListener('DOMContentLoaded', function() {
     // Load version information
     loadVersionInfo();
     
     // Initialize theme switcher
     initThemeSwitcher();
     
     // Set up disconnect/reconnect button event listeners
     const reconnectBtn = document.getElementById('reconnect-btn');
     const disconnectBtn = document.getElementById('disconnect-btn');
     
     if (reconnectBtn) {
       reconnectBtn.addEventListener('click', reconnectToOBS);
       reconnectBtn.disabled = false;
     }
     
     if (disconnectBtn) {
       disconnectBtn.addEventListener('click', disconnectFromOBS);
       disconnectBtn.disabled = true;
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
     
     // Start the connection
     connect();
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
  console.log("🔄 updateAudioSourceUI called - requesting input list for UI update");
  console.log(`🔍 muteRequests before updateAudioSourceUI: size=${muteRequests.size}, keys=${Array.from(muteRequests.keys())}`);
  
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
  console.log(`🔍 muteRequests before updateExistingAudioControls: size=${muteRequests.size}, keys=${Array.from(muteRequests.keys())}`);
  
  // Since GetInputList doesn't provide mute/volume status, we need to request it for each source
  audioSources.forEach(source => {
    // Request mute status for this source
    getInputMute(source.inputName);
    
    // Note: Volume updates will come from InputVolumeChanged events
    // We don't need to request volume status here
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

   // Connection management functions
  function disconnectFromOBS() {
    console.log("🔌 Disconnecting from OBS...");
    
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
    const reconnectBtn = document.getElementById('reconnect-btn');
    const disconnectBtn = document.getElementById('disconnect-btn');
    if (reconnectBtn) reconnectBtn.disabled = false;
    if (disconnectBtn) disconnectBtn.disabled = true;
  }

 function reconnectToOBS() {
   console.log("🔌 Reconnecting to OBS...");
   updateStatus("Reconnecting to OBS...", "connecting");
   updateConnectionStatus("Connecting");
   
   // Update button state
   const reconnectBtn = document.getElementById('reconnect-btn');
   const disconnectBtn = document.getElementById('disconnect-btn');
   if (reconnectBtn) reconnectBtn.disabled = true;
   if (disconnectBtn) disconnectBtn.disabled = false;
   
   // Start connection
   connect();
 }

 // Global functions for debugging (accessible from browser console)
 window.testObsConnection = testObsConnection;
 window.getAudioSources = getAudioSources;
 window.getAllInputs = getAllInputs;
 window.refreshAudioSources = refreshAudioSources;
 window.forceSyncWithOBS = forceSyncWithOBS;
 window.disconnectFromOBS = disconnectFromOBS;
 window.reconnectToOBS = reconnectToOBS; 