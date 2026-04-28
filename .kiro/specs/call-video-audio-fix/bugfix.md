# Bugfix Requirements Document

## Introduction

When a user initiates a video or voice call, two distinct failures occur on the caller's side:

1. **Remote video black screen** — the caller cannot see the person they are calling; the remote video element remains black for the entire call.
2. **Voice call audio not heard** — the caller cannot hear the person they are calling; the remote audio is silently blocked.

Both issues affect the initiator of the call. The receiver's experience is unaffected. The bugs are caused by a race condition in remote stream delivery and by the browser's autoplay policy silently blocking audio playback.

---

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN the initiator starts a video call AND the remote `ontrack` event fires before `onRemoteStreamCb` is assigned THEN the system silently drops the remote stream and the remote video remains a black screen

1.2 WHEN the initiator starts a video call AND `remoteVideoRef` is assigned THEN the system points the ref at the always-mounted hidden `<video>` element (0×0 size) instead of the visible full-screen video element, so even a correctly delivered stream is never displayed

1.3 WHEN the initiator starts a voice call AND the browser autoplay policy blocks the `.play()` call on the remote audio element THEN the system swallows the error silently with `.play().catch(() => {})` and the caller hears nothing for the duration of the call

### Expected Behavior (Correct)

2.1 WHEN the initiator starts a video call THEN the system SHALL assign `onRemoteStreamCb` before calling `initiateCall()` so that any remote stream delivered by `ontrack` is captured and displayed

2.2 WHEN the initiator starts a video call AND the remote stream arrives THEN the system SHALL store the stream in a `remoteStream` state variable and use a `useEffect` to sync it to whichever video element is currently rendered, ensuring the visible full-screen element receives the stream

2.3 WHEN the initiator starts a voice call AND the browser autoplay policy blocks `.play()` THEN the system SHALL detect the failure, register a one-time listener for the next user interaction (click or touchstart), and retry `.play()` once the interaction occurs

### Unchanged Behavior (Regression Prevention)

3.1 WHEN the receiver answers a video call THEN the system SHALL CONTINUE TO display the initiator's video stream correctly on the receiver's screen

3.2 WHEN the receiver answers a voice call THEN the system SHALL CONTINUE TO play the initiator's audio correctly on the receiver's device

3.3 WHEN either party mutes or unmutes audio during an active call THEN the system SHALL CONTINUE TO toggle the audio track state correctly for the other party

3.4 WHEN either party turns video on or off during an active call THEN the system SHALL CONTINUE TO toggle the video track state correctly for the other party

3.5 WHEN a call is declined or ended by either party THEN the system SHALL CONTINUE TO clean up the WebRTC peer connection, media streams, and UI state correctly

3.6 WHEN a voice call is active and the app is backgrounded THEN the system SHALL CONTINUE TO keep audio flowing without interruption

---

## Bug Condition

### Bug Condition Function

```pascal
FUNCTION isBugCondition(X)
  INPUT: X of type CallEvent
  OUTPUT: boolean

  // Triggers Issue 1 — remote stream race condition
  IF X.role = "initiator"
    AND X.call_type = "video"
    AND X.onRemoteStreamCb_assigned_after_initiateCall = true
  THEN RETURN true

  // Triggers Issue 2 — hidden video ref stealing
  IF X.role = "initiator"
    AND X.call_type = "video"
    AND X.remoteVideoRef_points_to_hidden_element = true
  THEN RETURN true

  // Triggers Issue 3 — autoplay policy blocks audio
  IF X.role = "initiator"
    AND X.call_type = "voice"
    AND X.browser_autoplay_blocked = true
  THEN RETURN true

  RETURN false
END FUNCTION
```

### Property: Fix Checking

```pascal
// Property: Fix Checking — Remote Video Displayed
FOR ALL X WHERE isBugCondition(X) AND X.call_type = "video" DO
  result ← initiateVideoCall'(X)
  ASSERT result.remoteVideoElement.srcObject ≠ null
    AND result.remoteVideoElement.visible = true
    AND result.remoteVideoElement.playing = true
END FOR

// Property: Fix Checking — Remote Audio Heard
FOR ALL X WHERE isBugCondition(X) AND X.call_type = "voice" DO
  result ← initiateVoiceCall'(X)
  ASSERT result.remoteAudioElement.playing = true
END FOR
```

### Property: Preservation Checking

```pascal
// Property: Preservation Checking
FOR ALL X WHERE NOT isBugCondition(X) DO
  ASSERT F(X) = F'(X)
END FOR
```
