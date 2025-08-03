// Changelog functionality
let currentVersion = '1.1.0';

// Initialize changelog when page loads
document.addEventListener('DOMContentLoaded', function() {
  loadVersionInfo();
  loadChangelog();
  initThemeSwitcher(); // Reuse theme switcher from main script
});

// Load version information from package.json
async function loadVersionInfo() {
  try {
    const response = await fetch('/api/status');
    const data = await response.json();
    
    if (data.version) {
      currentVersion = data.version;
      document.getElementById('current-version').textContent = currentVersion;
      document.getElementById('app-version').textContent = currentVersion;
    }
  } catch (error) {
    console.error('Failed to load version info:', error);
  }
}

// Load changelog from GitHub API
async function loadChangelog() {
  const changelogContent = document.getElementById('changelog-content');
  const errorDisplay = document.getElementById('error-display');
  
  try {
    // Show loading state
    changelogContent.innerHTML = `
      <div class="text-center py-4">
        <div class="spinner-border text-primary" role="status"></div>
        <p class="mt-3 text-muted">Loading changelog from GitHub...</p>
      </div>
    `;
    errorDisplay.style.display = 'none';

    // Fetch releases from GitHub API
    const response = await fetch('https://api.github.com/repos/staticextasy/XTouchController/releases');
    
    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status}`);
    }
    
    const releases = await response.json();
    
    if (releases.length === 0) {
      // No releases found, show commit history instead
      await loadCommitHistory();
      return;
    }

    // Display releases
    displayReleases(releases);
    
    // Update release date for current version
    if (releases.length > 0) {
      const latestRelease = releases[0];
      const releaseDate = new Date(latestRelease.published_at).toLocaleDateString();
      document.getElementById('release-date').textContent = releaseDate;
    }

  } catch (error) {
    console.error('Failed to load changelog:', error);
    showError('Failed to load changelog from GitHub. Please try again later.');
    
    // Fallback to local changelog
    loadLocalChangelog();
  }
}

// Load commit history as fallback
async function loadCommitHistory() {
  try {
    const response = await fetch('https://api.github.com/repos/staticextasy/XTouchController/commits?per_page=10');
    
    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status}`);
    }
    
    const commits = await response.json();
    displayCommits(commits);
    
  } catch (error) {
    console.error('Failed to load commit history:', error);
    loadLocalChangelog();
  }
}

// Display GitHub releases
function displayReleases(releases) {
  const changelogContent = document.getElementById('changelog-content');
  
  let html = '';
  
  releases.forEach((release, index) => {
    const releaseDate = new Date(release.published_at).toLocaleDateString();
    const isLatest = index === 0;
    
    html += `
      <div class="release-item mb-4 ${isLatest ? 'border-start border-success border-3 ps-3' : ''}">
        <div class="d-flex justify-content-between align-items-start mb-2">
          <div>
            <h5 class="mb-1">
              ${isLatest ? '<span class="badge bg-success me-2">Latest</span>' : ''}
              ${release.tag_name}
            </h5>
            <p class="text-muted mb-2">${releaseDate}</p>
          </div>
          <div class="text-end">
            <a href="${release.html_url}" target="_blank" class="btn btn-sm btn-outline-primary">
              <i class="bi bi-github"></i> View on GitHub
            </a>
          </div>
        </div>
        
        <div class="release-body">
          ${formatReleaseBody(release.body)}
        </div>
        
        ${release.assets.length > 0 ? `
          <div class="mt-3">
            <small class="text-muted">Downloads:</small>
            <div class="mt-1">
              ${release.assets.map(asset => `
                <a href="${asset.browser_download_url}" class="btn btn-sm btn-outline-secondary me-2">
                  <i class="bi bi-download"></i> ${asset.name}
                </a>
              `).join('')}
            </div>
          </div>
        ` : ''}
      </div>
    `;
  });
  
  changelogContent.innerHTML = html;
}

// Display commit history
function displayCommits(commits) {
  const changelogContent = document.getElementById('changelog-content');
  
  let html = `
    <div class="alert alert-info mb-4">
      <i class="bi bi-info-circle"></i>
      No releases found. Showing recent commits instead.
    </div>
  `;
  
  commits.forEach((commit, index) => {
    const commitDate = new Date(commit.commit.author.date).toLocaleDateString();
    const isLatest = index === 0;
    
    html += `
      <div class="commit-item mb-3 ${isLatest ? 'border-start border-success border-3 ps-3' : ''}">
        <div class="d-flex justify-content-between align-items-start">
          <div class="flex-grow-1">
            <h6 class="mb-1">
              ${isLatest ? '<span class="badge bg-success me-2">Latest</span>' : ''}
              ${commit.commit.message.split('\n')[0]}
            </h6>
            <p class="text-muted mb-1">
              <i class="bi bi-person"></i> ${commit.commit.author.name} • 
              <i class="bi bi-calendar"></i> ${commitDate}
            </p>
            <small class="text-muted">Commit: ${commit.sha.substring(0, 7)}</small>
          </div>
          <a href="${commit.html_url}" target="_blank" class="btn btn-sm btn-outline-primary ms-2">
            <i class="bi bi-github"></i>
          </a>
        </div>
      </div>
    `;
  });
  
  changelogContent.innerHTML = html;
}

// Format release body (convert markdown to HTML)
function formatReleaseBody(body) {
  if (!body) return '<p class="text-muted">No description available</p>';
  
  // Simple markdown to HTML conversion
  let formatted = body
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') // Bold
    .replace(/\*(.*?)\*/g, '<em>$1</em>') // Italic
    .replace(/`(.*?)`/g, '<code>$1</code>') // Inline code
    .replace(/^### (.*$)/gim, '<h5>$1</h5>') // H3
    .replace(/^## (.*$)/gim, '<h4>$1</h4>') // H2
    .replace(/^# (.*$)/gim, '<h3>$1</h3>') // H1
    .replace(/^- (.*$)/gim, '<li>$1</li>') // List items
    .replace(/\n\n/g, '</p><p>') // Paragraphs
    .replace(/^(.+)$/gm, '<p>$1</p>'); // Wrap lines in paragraphs
  
  // Fix double paragraphs
  formatted = formatted.replace(/<\/p><p><\/p><p>/g, '</p><p>');
  
  return formatted;
}

// Load local changelog as fallback
function loadLocalChangelog() {
  const changelogContent = document.getElementById('changelog-content');
  
  changelogContent.innerHTML = `
    <div class="alert alert-warning mb-4">
      <i class="bi bi-exclamation-triangle"></i>
      Unable to load from GitHub. Showing local changelog.
    </div>
    
    <div class="release-item mb-4 border-start border-success border-3 ps-3">
      <div class="d-flex justify-content-between align-items-start mb-2">
        <div>
          <h5 class="mb-1">
            <span class="badge bg-success me-2">Latest</span>
            v${currentVersion}
          </h5>
          <p class="text-muted mb-2">Current Release</p>
        </div>
      </div>
      
      <div class="release-body">
        <h5>🎉 Major Features</h5>
        <ul>
          <li><strong>Node.js Server</strong> - Professional Express.js web server with security features</li>
          <li><strong>Bootstrap UI</strong> - Modern, responsive interface with Bootstrap 5</li>
          <li><strong>Dark Mode</strong> - Beautiful dark theme with true black background</li>
          <li><strong>Audio Controls</strong> - Real-time audio source management</li>
          <li><strong>Status Monitoring</strong> - Live connection, stream, and recording status</li>
          <li><strong>Theme System</strong> - 6 beautiful color themes</li>
        </ul>
        
        <h5>🔧 Technical Improvements</h5>
        <ul>
          <li>Separated CSS and JavaScript into external files</li>
          <li>Added comprehensive error handling</li>
          <li>Implemented responsive design for all screen sizes</li>
          <li>Added security headers and CORS support</li>
          <li>Created professional documentation</li>
        </ul>
        
        <h5>🐛 Bug Fixes</h5>
        <ul>
          <li>Fixed theme switcher overlap issues</li>
          <li>Improved spacing and visual balance</li>
          <li>Enhanced WebSocket connection reliability</li>
        </ul>
      </div>
    </div>
    
    <div class="release-item mb-4">
      <div class="d-flex justify-content-between align-items-start mb-2">
        <div>
          <h5 class="mb-1">v0.9.0</h5>
          <p class="text-muted mb-2">Initial Release</p>
        </div>
      </div>
      
      <div class="release-body">
        <h5>🚀 Initial Features</h5>
        <ul>
          <li>Basic OBS WebSocket integration</li>
          <li>Scene switching functionality</li>
          <li>Simple web interface</li>
          <li>GitHub repository setup</li>
        </ul>
      </div>
    </div>
  `;
}

// Show error message
function showError(message) {
  const errorDisplay = document.getElementById('error-display');
  const errorMessage = document.getElementById('error-message');
  
  errorMessage.textContent = message;
  errorDisplay.style.display = 'block';
}

// Refresh changelog
function refreshChangelog() {
  loadVersionInfo();
  loadChangelog();
}

// Check for updates
async function checkForUpdates() {
  try {
    const response = await fetch('https://api.github.com/repos/staticextasy/XTouchController/releases/latest');
    
    if (!response.ok) {
      return null;
    }
    
    const latestRelease = await response.json();
    const latestVersion = latestRelease.tag_name.replace('v', '');
    
    if (latestVersion !== currentVersion) {
      return {
        version: latestVersion,
        url: latestRelease.html_url,
        body: latestRelease.body
      };
    }
    
    return null;
  } catch (error) {
    console.error('Failed to check for updates:', error);
    return null;
  }
} 