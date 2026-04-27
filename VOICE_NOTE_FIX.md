# Voice Note Playback Fix

## Problem
Voice notes were showing the error:
```
PipelineStatus::DEMUXER_ERROR_COULD_NOT_OPEN: FFmpegDemuxer: open context failed
```

This error means the browser cannot decode/play the audio file format.

## Root Cause
The voice recording was using **WebM format** (with Opus codec) as the first priority, which has poor support on mobile browsers, especially on Android Chrome and iOS Safari.

## Solution

### 1. Changed Format Priority
Changed the MIME type priority to favor **MP4/AAC** format, which has universal mobile support:

**Before:**
```javascript
const mimeType = [
  "audio/webm;codecs=opus",  // ❌ Poor mobile support
  "audio/webm",
  "audio/ogg;codecs=opus",
  "audio/mp4",               // ✅ Best mobile support (last!)
].find((m) => MediaRecorder.isTypeSupported(m)) ?? "";
```

**After:**
```javascript
const mimeType = [
  "audio/mp4",                    // ✅ Best mobile support (FIRST!)
  "audio/webm;codecs=opus",       // Good desktop support
  "audio/webm",                   // Fallback webm
  "audio/ogg;codecs=opus",        // Fallback ogg
].find((m) => MediaRecorder.isTypeSupported(m)) ?? "";
```

### 2. Improved File Extension Handling
Updated the file extension logic to properly handle MP4/M4A files:

```javascript
let ext = "webm";
let finalMime = mimeType || "audio/webm";

if (mimeType?.includes("mp4") || mimeType?.includes("m4a")) {
  ext = "m4a";  // Use .m4a for MP4 audio
  finalMime = "audio/mp4";
} else if (mimeType?.includes("ogg")) {
  ext = "ogg";
  finalMime = "audio/ogg";
} else if (mimeType?.includes("webm")) {
  ext = "webm";
  finalMime = "audio/webm";
}
```

### 3. Added Extensive Logging
Added detailed console logging to help diagnose issues:

**Recording:**
- Selected MIME type
- Supported formats check
- Data chunk sizes and types
- Total chunks recorded

**Upload:**
- Blob size and type
- Upload path
- Public URL
- Success/failure status

**Playback:**
- File URL being loaded
- Metadata loading status
- Duration information
- Detailed error codes and messages

## Browser Compatibility

### MP4/AAC (audio/mp4)
- ✅ Chrome (Desktop & Mobile)
- ✅ Safari (Desktop & Mobile)
- ✅ Firefox (Desktop & Mobile)
- ✅ Edge
- ✅ iOS Safari
- ✅ Android Chrome

### WebM/Opus (audio/webm)
- ✅ Chrome (Desktop)
- ✅ Firefox (Desktop)
- ✅ Edge
- ⚠️ Safari (Limited support)
- ❌ iOS Safari (No support)
- ⚠️ Android Chrome (Inconsistent)

## Testing

### To test voice notes:
1. Open the chat on your mobile device
2. Tap and hold the microphone button to record
3. Release to send
4. The voice note should now play without errors

### To check the format being used:
Open browser console and look for:
```
[VoiceNote] Selected MIME type: audio/mp4
[VoiceNote] Supported formats: ...
```

### If playback still fails:
Check the console for detailed error messages:
```
[VoiceBubble] Audio error: ...
[VoiceBubble] Error code: 4
[VoiceBubble] Error message: MEDIA_ERR_SRC_NOT_SUPPORTED
```

## Error Codes Reference

| Code | Constant | Meaning | Solution |
|------|----------|---------|----------|
| 1 | MEDIA_ERR_ABORTED | Playback aborted | Retry playing |
| 2 | MEDIA_ERR_NETWORK | Network error | Check internet connection |
| 3 | MEDIA_ERR_DECODE | Cannot decode | Format not supported by browser |
| 4 | MEDIA_ERR_SRC_NOT_SUPPORTED | Source not supported | File format or URL issue |

## Files Changed
- `src/routes/dashboard.chat.tsx`:
  - `startRecording()` - Changed MIME type priority
  - `sendVoiceNote()` - Improved file extension handling
  - `VoiceBubble` - Already had good error handling

## Next Steps if Issues Persist

1. **Check browser support:**
   - Open console and run: `MediaRecorder.isTypeSupported("audio/mp4")`
   - If false, the browser doesn't support MP4 recording

2. **Check existing voice notes:**
   - Old voice notes in WebM format will still fail
   - Only new recordings will use MP4 format
   - Consider re-recording important voice notes

3. **Check Supabase storage:**
   - Ensure CORS is properly configured
   - Verify files are publicly accessible
   - Check file URLs are valid

4. **Alternative solution:**
   - If MP4 is not supported, consider server-side transcoding
   - Convert WebM files to MP4 on the server after upload
   - This would fix old voice notes too

## Why This Happens

Mobile browsers have inconsistent audio codec support:
- **iOS Safari**: Only supports MP4/AAC, M4A, and MP3
- **Android Chrome**: Supports WebM but playback is unreliable
- **Desktop browsers**: Support most formats

By prioritizing MP4/AAC, we ensure maximum compatibility across all devices.
