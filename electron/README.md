# PulseChat Desktop App

This folder contains the Electron wrapper to create desktop apps for Windows, Mac, and Linux.

## Setup

1. **Install dependencies:**
   ```bash
   cd electron
   npm install
   ```

2. **Update the URL in `main.js`:**
   - Open `main.js`
   - Replace `https://your-website-url.com` with your actual website URL

3. **Add an icon:**
   - Place a `icon.png` file (512x512px or larger) in this folder
   - This will be used as the app icon

## Build Desktop Apps

### Windows:
```bash
npm run build:win
```
Output: `electron/dist/PulseChat Setup.exe`

### Mac:
```bash
npm run build:mac
```
Output: `electron/dist/PulseChat.dmg`

### Linux:
```bash
npm run build:linux
```
Output: `electron/dist/PulseChat.AppImage` and `PulseChat.deb`

## Test Locally

```bash
npm start
```

This will open the desktop app pointing to your website.

## Distribution

After building, the installers will be in the `electron/dist/` folder. You can:
1. Upload them to your website for download
2. Distribute them to users
3. Sign them for production (recommended for Mac/Windows)

## Notes

- The app is essentially a browser wrapper around your website
- All features work exactly like the web version
- Notifications, calls, and all functionality are preserved
- Users get a native app experience with taskbar icon, system tray, etc.
