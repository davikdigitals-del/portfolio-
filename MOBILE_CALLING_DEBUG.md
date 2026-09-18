# Mobile Calling Debug Guide

## Recent Changes

### 1. Simplified Mobile Media Acquisition
- Removed all complex constraints for mobile devices
- Now uses the simplest possible constraints: `{ audio: true, video: true }`
- Added extensive logging to help diagnose issues
- Added specific error messages for different failure types

### 2. Enhanced Error Handling
- All errors now show the actual error message to the user
- Added detailed console logging with error names, messages, and stack traces
- Errors are categorized by type (permission denied, device not found, etc.)

### 3. Diagnostic Test Function
- Added `testMediaAccess()` function to test camera/microphone access
- Available globally as `window.__testMedia()` for debugging
- Shows detailed information about available tracks and permissions

## Testing on Mobile

### Step 1: Check Browser Console
1. Open the app on your mobile device
2. Open browser developer tools (if available)
3. Look for logs starting with `[CM]` (CallManager) or `[Call]`

### Step 2: Test Media Access
Open the browser console and run:
```javascript
window.__testMedia()
```

This will:
- Test camera and microphone access
- Show detailed error messages if it fails
- Display available tracks if it succeeds

### Step 3: Try Making a Call
1. Click the voice or video call button
2. Watch for error messages in the toast notifications
3. Check the console for detailed logs

## Common Issues and Solutions

### Issue: "Camera/microphone permission denied"
**Solution:** 
- Go to browser settings → Site settings → Camera/Microphone
- Allow access for your app's domain
- Refresh the page and try again

### Issue: "Camera/microphone is already in use"
**Solution:**
- Close other apps that might be using the camera/microphone
- Close other browser tabs with video calls
- Restart the browser

### Issue: "Your browser doesn't support video/audio calls"
**Solution:**
- Use a modern browser (Chrome, Firefox, Safari)
- Update your browser to the latest version

### Issue: "Access blocked. Please use HTTPS"
**Solution:**
- Make sure you're accessing the app via HTTPS (not HTTP)
- Some browsers require HTTPS for camera/microphone access

### Issue: Calls work on desktop but not mobile
**Possible causes:**
1. Mobile browser doesn't have camera/microphone permissions
2. Another app is using the camera/microphone
3. Browser is outdated
4. Device doesn't support WebRTC

**Debug steps:**
1. Run `window.__testMedia()` in the console
2. Check if the error message gives specific details
3. Try a different browser on the same device
4. Try a different device

## Technical Details

### Mobile Detection
The app detects mobile devices using:
```javascript
/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
```

### Media Constraints (Mobile)
For mobile devices, we use the simplest constraints:
```javascript
// Video call
{ audio: true, video: true }

// Voice call
{ audio: true, video: false }
```

No width, height, frameRate, or other constraints are applied on mobile to maximize compatibility.

### Desktop Constraints
Desktop devices still use high-quality settings:
- 4K video (3840x2160 @ 60fps) with fallback to 1080p
- High bitrate (8 Mbps)
- Echo cancellation and noise suppression

## Logs to Look For

### Successful Call
```
[CM] Device type: Mobile Call type: video
[CM] User agent: Mozilla/5.0...
[CM] Protocol: https:
[CM] Trying absolute minimum mobile settings (no constraints)...
[CM] Constraints: {"audio":true,"video":true}
[CM] ✅ Mobile media acquired successfully!
[CM] Tracks: ["audio - enabled:true - readyState:live", "video - enabled:true - readyState:live"]
```

### Failed Call
```
[CM] Device type: Mobile Call type: video
[CM] ❌ Minimum mobile failed: NotAllowedError: Permission denied
[CM] Error name: NotAllowedError
[CM] Error message: Permission denied
```

## Screen Share on Mobile
Screen sharing is **hidden on mobile** because:
- `getDisplayMedia` is not well supported on mobile browsers
- Most mobile browsers don't allow screen sharing
- The button is hidden with `hidden md:flex` class

## Next Steps if Issues Persist

1. **Check HTTPS**: Ensure the app is served over HTTPS
2. **Test on different browsers**: Try Chrome, Firefox, Safari
3. **Test on different devices**: Try different phones/tablets
4. **Check browser version**: Update to the latest version
5. **Check device compatibility**: Some older devices may not support WebRTC

## Support

If you're still experiencing issues:
1. Run `window.__testMedia()` and share the console output
2. Share the browser console logs (especially lines with `[CM]` or `[Call]`)
3. Share your device model and browser version
4. Share any error messages shown in toast notifications
