# Call and Message Status Fixes

## Issues Fixed

### 1. ✅ Screen Share Moved to Options Menu on Mobile
**Problem**: Screen share button was hidden on mobile, making it inaccessible.

**Solution**:
- Added "More Options" button (three dots) visible on all devices during video calls
- Screen share is now inside the options menu
- Menu appears above the button with smooth animation
- Closes automatically when clicking outside or after selecting an option

**How to use**:
- During a video call, tap the "More" button (three vertical dots)
- Select "Share screen" from the menu
- Works on both mobile and desktop

---

### 2. ✅ Voice Echo Fixed When Switching Apps
**Problem**: Audio would echo when switching to another app during a call because the microphone stayed active.

**Solution**:
- Added `pauseAudio()` and `resumeAudio()` methods to CallManager
- Automatically pauses microphone when app goes to background (document.hidden)
- Automatically resumes when app comes back to foreground
- Respects mute state (won't resume if user had muted)

**Technical details**:
- Uses `visibilitychange` event to detect app state
- Disables audio tracks when hidden to prevent echo
- Re-enables tracks when visible (unless muted)

---

### 3. ✅ Video Call Paused Overlay
**Problem**: No visual indication when video call is paused (app in background).

**Solution**:
- Added "Video call paused" text overlay on both local and remote video
- Shows pause icon with message "Return to app to resume"
- Video blurs when app is hidden for privacy
- Works for both participants

**Visual changes**:
- Local video preview: Shows "Paused" with pause icon
- Remote video: Shows "Video call paused" with larger text
- Fallback avatar view: Shows "Video call paused" text

---

### 4. ✅ Message Status Ticks Fixed
**Problem**: Sent/delivered/seen ticks weren't updating properly for both client and admin.

**Solution**:
- Added explicit `status: "sent"` when inserting messages (was relying on DB default)
- Added comprehensive logging to track status changes:
  - `[MessageStatus] UPDATE received` - When status changes via realtime
  - `[MessageStatus] Marking messages as delivered` - When recipient connects
  - `[MessageStatus] Marking message as seen` - When recipient opens chat
- Fixed realtime UPDATE handler to properly update message status in UI

**Status flow**:
1. **Sent** (grey single check) - Message sent to database
2. **Delivered** (grey double check) - Recipient's device received the message
3. **Seen** (blue double check) - Recipient opened the chat and saw the message

**How it works**:
- When you send a message: starts as "sent"
- When recipient's app receives it: updates to "delivered"
- When recipient opens the chat: updates to "seen"
- All updates happen via Supabase realtime subscriptions

---

## Testing Guide

### Test Screen Share on Mobile
1. Start a video call from mobile device
2. Tap the "More" button (three dots) at the bottom
3. Select "Share screen" from menu
4. Grant screen sharing permission
5. Your screen should now be shared
6. Tap "More" → "Stop sharing" to end

### Test Echo Fix
1. Start a voice or video call
2. Switch to another app (home screen, browser, etc.)
3. **Expected**: Microphone automatically pauses (no echo)
4. Switch back to the call
5. **Expected**: Microphone resumes (unless you had muted it)
6. Check console logs for:
   ```
   [Dashboard] App hidden, pausing audio to prevent echo
   [CM] Audio paused (app hidden)
   [Dashboard] App visible, resuming audio
   [CM] Audio resumed (app visible)
   ```

### Test Video Pause Overlay
1. Start a video call
2. Switch to another app
3. **Expected**: Video blurs and shows "Video call paused" overlay
4. Switch back to the call
5. **Expected**: Video unblurs and overlay disappears
6. Works for both local preview and remote video

### Test Message Status Ticks
1. **As sender**:
   - Send a message
   - Should show grey single check (sent)
   - When recipient's device receives it: grey double check (delivered)
   - When recipient opens chat: blue double check (seen)

2. **As recipient**:
   - Receive a message while chat is closed
   - Open the chat
   - Message should immediately show as "seen" to sender

3. **Check console logs**:
   ```
   [MessageStatus] Marking message as seen: [id]
   [MessageStatus] Message marked as seen: [id]
   [MessageStatus] UPDATE received: [id] status: seen
   ```

---

## Console Logs to Monitor

### Call Audio Management
- `[CM] Audio track enabled: true/false` - Audio track state
- `[CM] Audio paused (app hidden)` - Audio paused when app hidden
- `[CM] Audio resumed (app visible)` - Audio resumed when app visible
- `[Dashboard] App hidden, pausing audio to prevent echo`
- `[Dashboard] App visible, resuming audio`

### Message Status
- `[MessageStatus] Marking messages as delivered for conversation: [id]`
- `[MessageStatus] Marked messages as delivered`
- `[MessageStatus] Marking message as seen: [id]`
- `[MessageStatus] Message marked as seen: [id]`
- `[MessageStatus] UPDATE received: [id] status: [status]`

### Screen Share
- `[ScreenShare] Current state: true/false`
- `[ScreenShare] Starting screen share`
- `[ScreenShare] Stopping screen share, switching to camera`
- `[ScreenShare] Replaced camera track with screen track`
- `[ScreenShare] Replaced screen track with camera track`

---

## Known Limitations

1. **Screen Share on Mobile**: Some mobile browsers don't support screen sharing (iOS Safari, some Android browsers). The feature will show an error if not supported.

2. **Audio Pause**: Audio pauses when app goes to background. This is intentional to prevent echo, but means the other person won't hear you until you return to the app.

3. **Message Status**: Status updates require active realtime connection. If connection is lost, status may not update until reconnection.

---

## Files Modified

1. `src/lib/calls.ts`
   - Added `pauseAudio()` and `resumeAudio()` methods
   - Added logging to audio track management

2. `src/routes/dashboard.tsx`
   - Added `showCallOptions` state for options menu
   - Moved screen share to options menu
   - Added visibility change handler for audio pause/resume
   - Added "Video call paused" overlays
   - Added MoreVertical icon import

3. `src/routes/dashboard.chat.tsx`
   - Added explicit `status: "sent"` when inserting messages
   - Added comprehensive logging for status updates
   - Fixed realtime UPDATE handler logging

---

## Deployment

All changes have been committed to git. To deploy:

```bash
git pull origin main
npm install  # if needed
npm run build
# Deploy to your hosting platform
```

---

## Support

If you encounter issues:

1. **Check browser console** for error messages and logs
2. **Test on different devices** (mobile vs desktop)
3. **Check network connection** (realtime requires stable connection)
4. **Verify Supabase realtime** is enabled for your project

Common issues:
- Screen share not working: Check browser support
- Echo still present: Check console logs for audio pause/resume
- Status not updating: Check realtime connection in Supabase dashboard
- Video not pausing: Check visibility change events in console
