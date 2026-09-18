# Mobile-to-Mobile Call Testing Guide

## Prerequisites for Mobile Calls to Work

### 1. **HTTPS Required** 🔒
Mobile browsers (especially iOS Safari and Chrome) **require HTTPS** for:
- Camera access
- Microphone access
- WebRTC connections

**Check**: Your app URL should start with `https://`

If testing locally, you need:
- Use `ngrok` or similar to get HTTPS tunnel
- Or deploy to a hosting service with HTTPS (Netlify, Vercel, Render)

---

### 2. **Browser Permissions** 📱
Both users must grant:
- ✅ Camera permission (for video calls)
- ✅ Microphone permission (for voice/video calls)
- ✅ Notification permission (for incoming call alerts)

**How to check**:
1. Open browser settings
2. Look for site permissions
3. Ensure Camera, Microphone, Notifications are "Allow"

---

### 3. **Supported Browsers** 🌐
**iOS**:
- ✅ Safari 11+ (best support)
- ✅ Chrome iOS (uses Safari engine)
- ❌ Firefox iOS (limited WebRTC support)

**Android**:
- ✅ Chrome 60+ (best support)
- ✅ Firefox 68+
- ✅ Samsung Internet 9+
- ⚠️ Opera (partial support)

---

## Testing Steps

### Step 1: Verify HTTPS
1. Open your app on mobile
2. Check URL bar - should show 🔒 (lock icon)
3. If not HTTPS, calls **will not work**

### Step 2: Test Permissions
1. Navigate to chat page
2. Try to start a call
3. Browser should prompt for permissions
4. Grant all permissions
5. Check console logs:
   ```
   [CM] Device type: Mobile
   [CM] ✅ Mobile media acquired successfully!
   [CM] Echo cancellation: true
   ```

### Step 3: Test Mobile-to-Mobile Call

**Device A (Initiator)**:
1. Open chat with Device B
2. Tap voice or video call button
3. Wait for "Calling..." screen
4. Check console:
   ```
   [CM] Initiator ready, waiting for receiver 'ready' signal
   [Dashboard] Initiating call...
   ```

**Device B (Receiver)**:
1. Should see incoming call screen
2. Should hear ringtone
3. Should see vibration
4. Check console:
   ```
   [CallListener] Incoming call: [id]
   [Dashboard] Incoming call from [name]
   ```
5. Tap "Answer"
6. Check console:
   ```
   [CM] Receiver sent 'ready', waiting for offer
   [CM] Received offer
   [CM] Answer sent
   [CM] Connection: connected
   ```

**Both Devices**:
- Should see/hear each other
- Should NOT hear echo (own voice)
- Controls should work (mute, camera off, etc.)

---

## Common Issues & Solutions

### Issue 1: "Permission Denied" Error
**Symptoms**: Can't access camera/microphone

**Solutions**:
1. Check browser permissions in settings
2. Reload page and try again
3. Clear browser cache
4. Try different browser
5. Ensure HTTPS is enabled

**Console log**: `[CM] ❌ Minimum mobile failed: NotAllowedError`

---

### Issue 2: Call Doesn't Connect
**Symptoms**: Stuck on "Calling..." or "Connecting..."

**Solutions**:
1. Check internet connection (both devices)
2. Verify TURN servers are working
3. Check firewall/network restrictions
4. Try on different network (WiFi vs Mobile data)

**Console logs to check**:
```
[CM] ICE: checking
[CM] ICE: connected
[CM] Connection: connected
```

If stuck on "checking", TURN server might be blocked.

---

### Issue 3: Echo / Hearing Own Voice
**Symptoms**: Can hear yourself when speaking

**Solutions**:
1. Check console for: `[CM] Echo cancellation: true`
2. If false, browser doesn't support echo cancellation
3. Try different browser
4. Ensure both devices have echo cancellation enabled

**Fixed in latest version**: Echo cancellation now forced on all devices

---

### Issue 4: Call Ends on One Side Only
**Symptoms**: One person's call ends, other still in call

**Solutions**:
1. Check console for: `[CallListener] Active call ended by other party`
2. Verify realtime connection is active
3. Check Supabase realtime status
4. Reload both apps

**Fixed in latest version**: Realtime listener now handles call end events

---

### Issue 5: No Incoming Call Notification
**Symptoms**: Receiver doesn't see incoming call

**Solutions**:
1. Check notification permissions
2. Verify app is open (or in background)
3. Check console: `[CallListener] Incoming call: [id]`
4. Verify Supabase realtime is connected
5. Check network connection

---

### Issue 6: Poor Video/Audio Quality
**Symptoms**: Choppy video, robotic audio, lag

**Solutions**:
1. Check internet speed (both devices)
2. Use WiFi instead of mobile data
3. Close other apps using camera/mic
4. Reduce video quality (automatic fallback should happen)
5. Try voice-only call instead of video

---

## Debug Console Logs

### Successful Call Flow:

**Initiator (Device A)**:
```
[CM] Device type: Mobile Call type: video
[CM] ✅ Mobile media acquired successfully!
[CM] Echo cancellation: true
[CM] Signaling: SUBSCRIBED
[CM] Initiator ready, waiting for receiver 'ready' signal
[CM] Receiver ready, adding tracks and creating offer
[CM] Offer sent
[CM] Received answer
[CM] ICE: checking
[CM] ICE: connected
[CM] Connection: connected
```

**Receiver (Device B)**:
```
[CallListener] Incoming call: [id]
[Dashboard] Incoming call from [name]
[CM] Device type: Mobile Call type: video
[CM] ✅ Mobile media acquired successfully!
[CM] Echo cancellation: true
[CM] Signaling: SUBSCRIBED
[CM] Receiver sent 'ready', waiting for offer
[CM] Received offer
[CM] Answer sent
[CM] ICE: checking
[CM] ICE: connected
[CM] Connection: connected
[Dashboard] Remote stream, tracks: ['audio', 'video']
```

---

## Network Requirements

### Minimum Internet Speed:
- **Voice calls**: 100 kbps upload/download
- **Video calls (SD)**: 500 kbps upload/download
- **Video calls (HD)**: 2 Mbps upload/download
- **Video calls (4K)**: 8 Mbps upload/download

### Ports Required:
- **UDP**: 3478 (STUN)
- **TCP**: 443 (TURN over TLS)
- **UDP**: 49152-65535 (RTP media)

Most mobile networks allow these by default, but corporate/school networks might block them.

---

## Testing Checklist

Before reporting "mobile calls don't work", verify:

- [ ] App is accessed via HTTPS
- [ ] Both devices granted camera/microphone permissions
- [ ] Both devices granted notification permissions
- [ ] Using supported browsers (Safari iOS, Chrome Android)
- [ ] Both devices have stable internet connection
- [ ] Console shows "Echo cancellation: true"
- [ ] Console shows "Connection: connected"
- [ ] No firewall blocking WebRTC ports
- [ ] Supabase realtime is connected
- [ ] Both users are logged in
- [ ] Conversation exists between users

---

## Quick Test Commands

Open browser console and run:

### Test Media Access:
```javascript
navigator.mediaDevices.getUserMedia({ audio: true, video: true })
  .then(stream => {
    console.log('✅ Media access works!');
    console.log('Tracks:', stream.getTracks().map(t => t.kind));
    stream.getTracks().forEach(t => t.stop());
  })
  .catch(err => console.error('❌ Media access failed:', err));
```

### Test Echo Cancellation:
```javascript
navigator.mediaDevices.getUserMedia({ 
  audio: { echoCancellation: true } 
})
  .then(stream => {
    const track = stream.getAudioTracks()[0];
    const settings = track.getSettings();
    console.log('Echo cancellation:', settings.echoCancellation);
    track.stop();
  });
```

### Test TURN Server:
```javascript
const pc = new RTCPeerConnection({
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { 
      urls: 'turn:openrelay.metered.ca:443',
      username: 'openrelayproject',
      credential: 'openrelayproject'
    }
  ]
});
pc.createDataChannel('test');
pc.createOffer().then(offer => pc.setLocalDescription(offer));
pc.onicecandidate = e => {
  if (e.candidate) {
    console.log('ICE candidate:', e.candidate.type);
  }
};
```

---

## Still Not Working?

If mobile calls still don't work after checking everything:

1. **Share console logs**: Copy all console output and share
2. **Share network info**: WiFi or mobile data? Speed test results?
3. **Share device info**: iOS/Android version, browser version
4. **Share error messages**: Any red errors in console?
5. **Test on different network**: Try WiFi if on mobile data, or vice versa

---

## Known Limitations

1. **iOS Safari**: 
   - Requires user gesture to start call (can't auto-answer)
   - Background calls may pause after 30 seconds
   - Screen share not supported

2. **Android Chrome**:
   - May request permissions multiple times
   - Background calls work better than iOS

3. **Mobile Networks**:
   - 4G/5G usually works fine
   - 3G may be too slow for video
   - Some carriers block WebRTC (rare)

4. **Battery Saver Mode**:
   - May limit camera/microphone quality
   - May pause background calls
   - Disable for best experience

---

## Success Indicators

You'll know mobile calls are working when:

✅ Console shows: `[CM] Connection: connected`
✅ Both users can see/hear each other
✅ No echo (can't hear own voice)
✅ Controls work (mute, camera, end call)
✅ Call ends properly on both sides
✅ No console errors

---

## Support

If you've followed this guide and calls still don't work, it's likely:
1. Network/firewall issue
2. Browser compatibility issue
3. HTTPS not properly configured
4. Supabase realtime connection issue

Check the console logs and share them for debugging.
