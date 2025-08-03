# X Touch Controller (XTC)

A comprehensive web-based controller for OBS Studio with scene switching, stream/record controls, audio management, and real-time monitoring via WebSocket connection.

## Features

- **Scene Management**: Connect to OBS Studio via WebSocket and switch between scenes
- **Stream & Record Controls**: Start/stop streaming, recording, and replay buffer
- **Audio Management**: Control volume and mute/unmute individual audio sources
- **Real-time Monitoring**: Live status updates for connection, stream, recording, and FPS
- **Responsive Design**: Works on desktop, tablet, and mobile devices
- **Theme Customization**: Multiple color schemes with persistent settings
- **Professional UI**: Modern, intuitive interface with smooth animations

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
3. Once connected, you'll see:
   - **Status Panel**: Real-time connection, stream, recording, and FPS status
   - **Stream & Record Controls**: Buttons to start/stop streaming, recording, and replay buffer
   - **Audio Controls**: Volume sliders and mute buttons for all audio sources
   - **Scene Controls**: Buttons for all available scenes
4. Use the theme switcher (top-right) to customize the appearance
5. All controls are touch-friendly and work on mobile devices

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