# OBS Scene Switcher

A simple web-based controller for switching OBS Studio scenes via WebSocket connection.

## Features

- Connect to OBS Studio via WebSocket
- Display all available scenes as clickable buttons
- Switch between scenes with a single click
- Real-time status updates and error handling

## Setup

### Prerequisites

1. **OBS Studio** with WebSocket plugin installed
2. **OBS WebSocket** plugin enabled and configured

### OBS WebSocket Configuration

1. In OBS Studio, go to **Tools** → **WebSocket Server Settings**
2. Enable the WebSocket server
3. Set a password (you'll need this for configuration)
4. Note the port (default: `4455`)

### Configuration

Edit the configuration in `index.html`:

```javascript
const password = "YOUR_OBS_WEBSOCKET_PASSWORD";  // Your OBS WebSocket password
const obsIP = "YOUR_OBS_PC_IP_ADDRESS";          // Your OBS PC's IP address
```

### Usage

1. Open `index.html` in a web browser
2. The page will automatically connect to OBS
3. Once connected, you'll see buttons for all available scenes
4. Click any scene button to switch to that scene

## Troubleshooting

### Connection Issues

- Ensure OBS WebSocket server is enabled
- Check that the IP address and port are correct
- Verify the password matches your OBS WebSocket settings
- Check browser console for detailed error messages

### Scene Loading Issues

- Make sure you have scenes created in OBS
- Check browser console for authentication errors
- Verify OBS is running and not in Studio Mode

## Development

This is a simple HTML/JavaScript application that uses:
- WebSocket API for real-time communication
- OBS WebSocket protocol v5
- SHA-256 authentication

## License

This project is open source and available under the MIT License. 