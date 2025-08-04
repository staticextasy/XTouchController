# X Touch Controller (XTC)

A comprehensive web-based controller for OBS Studio with scene switching, stream/record controls, audio management, and real-time monitoring via WebSocket connection.

## ✨ Features

- **🎭 Scene Management** - Switch between OBS scenes with beautiful buttons
- **📺 Stream & Record Controls** - Start/stop streaming and recording with one click
- **🎵 Audio Management** - Control audio sources (mute/unmute, volume adjustment)
- **📊 Real-time Monitoring** - Live status of connection, stream, recording, and FPS
- **📱 Responsive Design** - Works perfectly on desktop, tablet, and mobile devices
- **🎨 Theme Customization** - 6 beautiful color themes including dark mode
- **⚡ Professional UI** - Modern Bootstrap-based interface with smooth animations
- **🔒 Secure** - Built with security best practices and HTTPS support

## 🚀 Quick Start

### Prerequisites

- **Node.js** (version 14 or higher)
- **OBS Studio** with WebSocket plugin installed
- **OBS WebSocket** (version 5.0 or higher)

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/staticextasy/XTouchController.git
   cd XTouchController
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure OBS WebSocket:**
   - Open OBS Studio
   - Go to `Tools` → `WebSocket Server Settings`
   - Enable WebSocket server
   - Set a password (remember this for configuration)
   - Note your OBS PC's IP address

4. **Configure the application:**
   - The application now uses a web interface for configuration
   - No need to edit script.js files
   - Connection settings are entered directly in the web interface

5. **Start the server:**
   ```bash
   # Development mode (with auto-restart)
   npm run dev
   
   # Production mode
   npm start
   ```

6. **Access the application:**
   - Open your browser and go to `http://localhost:3000`
   - Enter your OBS WebSocket IP address and password in the connection fields
   - Click "Connect" to establish connection to OBS

## 🎮 Usage

### Scene Controls
- Click any scene button to switch to that scene in OBS
- Active scenes are highlighted with a green glow

### Stream & Record Controls
- **📡 Stream Button** - Start/stop streaming
- **🔴 Record Button** - Start/stop recording
- **⏪ Replay Buffer** - Save replay buffer

### Audio Controls
- **Mute/Unmute** - Toggle audio sources on/off
- **Volume Slider** - Adjust volume levels in real-time
- **Audio Level Indicator** - Visual feedback of current volume

### Status Monitoring
- **Connection Status** - Shows connection to OBS
- **Stream Status** - Current streaming state
- **Recording Status** - Current recording state
- **FPS Counter** - Real-time FPS monitoring

### Theme Switching
- Click the theme buttons in the top-right corner
- Choose from 6 beautiful themes:
  - 🌊 Ocean (default)
  - 🌅 Sunset
  - 🌲 Forest
  - 🌙 Midnight
  - 🌌 Aurora
  - 🌑 Dark Mode

## 🔧 Configuration

### Environment Variables
- `PORT` - Server port (default: 3000)
- `NODE_ENV` - Environment mode (development/production)

### OBS WebSocket Settings
- **Port**: 4455 (default)
- **Password**: Set in OBS WebSocket settings
- **IP Address**: Your OBS PC's local IP address

## 🛠️ Development

### Project Structure
```
XTouchController/
├── index.html          # Main HTML file
├── styles.css          # Custom CSS styles
├── script.js           # JavaScript logic
├── server.js           # Express server
├── package.json        # Dependencies and scripts
└── README.md           # Documentation
```

### Available Scripts
- `npm start` - Start production server
- `npm run dev` - Start development server with auto-restart
- `npm test` - Run tests (placeholder)

### API Endpoints
- `GET /` - Main application
- `GET /health` - Health check
- `GET /api/status` - Server status

## 🔒 Security Features

- **Helmet.js** - Security headers
- **CORS** - Cross-origin resource sharing
- **Content Security Policy** - XSS protection
- **Compression** - Gzip compression for performance

## 🚨 Troubleshooting

### Connection Issues
1. **Check OBS WebSocket settings**
   - Ensure WebSocket server is enabled
   - Verify password is correct
   - Check IP address is accessible

2. **Network Issues**
   - Ensure both devices are on the same network
   - Check firewall settings
   - Try using localhost if running on same machine

3. **Browser Issues**
   - Clear browser cache
   - Try different browser
   - Check browser console for errors

### Common Errors
- **"WebSocket connection failed"** - Check OBS WebSocket settings
- **"Authentication failed"** - Verify password in configuration
- **"Scenes not loading"** - Check OBS is running and scenes exist

## 📱 Mobile Usage

The application is fully responsive and works great on mobile devices:
- Touch-friendly buttons
- Optimized layout for small screens
- Swipe gestures supported
- PWA-ready for future enhancements

## 🔮 Future Features

- **User Authentication** - Secure access control
- **Multiple OBS Instances** - Control multiple OBS setups
- **Custom Hotkeys** - Programmable keyboard shortcuts
- **Stream Chat Integration** - Display chat messages
- **Analytics Dashboard** - View stream statistics
- **Plugin System** - Extensible functionality

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📞 Support

If you encounter any issues or have questions:
1. Check the troubleshooting section
2. Search existing issues
3. Create a new issue with detailed information

---

**Made with ❤️ for the streaming community** 