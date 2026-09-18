# PulseChat Desktop App - Build Guide

## Quick Start

Your desktop app files are ready in the `electron/` folder. Here's how to build installers for Windows, Mac, and Linux.

## Prerequisites

You need Node.js installed on your computer. If you don't have it, download from: https://nodejs.org

## Step 1: Install Dependencies

Open terminal/command prompt in the `electron` folder and run:

```bash
cd electron
npm install
```

This will download Electron and Electron Builder (may take a few minutes).

## Step 2: Add an App Icon (Optional)

Place a `icon.png` file (512x512px or larger) in the `electron/` folder. This will be your app icon.

If you skip this, a default icon will be used.

## Step 3: Build Desktop Apps

### For Windows:
```bash
npm run build:win
```

Output: `electron/dist/PulseChat Setup.exe` (Windows installer)

### For Mac:
```bash
npm run build:mac
```

Output: `electron/dist/PulseChat.dmg` (Mac installer)

### For Linux:
```bash
npm run build:linux
```

Output: 
- `electron/dist/PulseChat.AppImage` (Universal Linux app)
- `electron/dist/PulseChat.deb` (Debian/Ubuntu installer)

## Step 4: Test Before Building

To test the app without building an installer:

```bash
npm start
```

This opens the desktop app immediately.

## Step 5: Distribute

After building, the installers will be in `electron/dist/`. You can:

1. **Upload to your website** - Add download links for Windows/Mac/Linux
2. **Share directly** - Send the installer files to users
3. **Auto-updates** (advanced) - Set up Electron auto-updater for automatic updates

## What Users Get

- Native desktop app with taskbar icon
- System notifications
- Offline support (if you add service worker caching)
- Faster than browser (no browser overhead)
- Looks and feels like WhatsApp Desktop

## File Sizes

- Windows: ~150MB
- Mac: ~200MB
- Linux: ~150MB

These are large because they include a full Chromium browser engine.

## Troubleshooting

**Build fails with "out of memory":**
- Close other apps
- Try building one platform at a time
- Use a machine with more RAM (8GB+ recommended)

**"electron not found" error:**
- Make sure you ran `npm install` in the `electron/` folder
- Try deleting `node_modules` and running `npm install` again

**App opens but shows blank screen:**
- Check your internet connection (the app loads from your website)
- Make sure your website URL in `main.js` is correct

## Next Steps

Once you have the installers:

1. Test them on clean machines (without Node.js installed)
2. Upload to your website for download
3. Consider code signing (required for Mac, recommended for Windows)

## Code Signing (Production)

For production distribution:

- **Windows**: Get a code signing certificate from DigiCert, Sectigo, etc.
- **Mac**: Requires Apple Developer account ($99/year) and notarization
- **Linux**: No signing required

Without signing:
- Windows: Users see "Unknown publisher" warning
- Mac: Users must right-click → Open (Gatekeeper blocks unsigned apps)
- Linux: Works fine

---

**Need help?** Check the full Electron Builder docs: https://www.electron.build
