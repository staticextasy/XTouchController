# Mobile Access Guide

## How to Access X Touch Controller from Mobile Devices

### Step 1: Find Your Computer's IP Address

**On Windows:**
1. Open Command Prompt
2. Type `ipconfig` and press Enter
3. Look for "IPv4 Address" under your active network adapter
4. Note the IP address (e.g., `192.168.1.100`)

**On Mac/Linux:**
1. Open Terminal
2. Type `ifconfig` (Mac/Linux) or `ip addr` (Linux) and press Enter
3. Look for "inet" followed by your IP address
4. Note the IP address (e.g., `192.168.1.100`)

### Step 2: Start the Server

1. Open terminal/command prompt in the XTouchController folder
2. Run: `npm start`
3. The server will start on port 3000

### Step 3: Access from Mobile

1. Make sure your mobile device is on the same WiFi network as your computer
2. Open your mobile browser
3. Navigate to: `http://YOUR_COMPUTER_IP:3000`
   - Example: `http://192.168.1.100:3000`

### Troubleshooting

**If you get a "secure connection failed" error:**
- Make sure you're using `http://` not `https://`
- The application runs on HTTP, not HTTPS
- Some browsers may warn about security - this is normal for local development

**If the page doesn't load:**
- Check that your computer's firewall allows connections on port 3000
- Ensure both devices are on the same WiFi network
- Try accessing from another device on the same network to test

**For better mobile experience:**
- Use the mobile browser's "Add to Home Screen" feature
- The application is optimized for mobile touch interactions
- Theme switching and all controls work on mobile devices

### Security Note

This application is designed for local network use only. Do not expose it to the internet without proper security measures. 