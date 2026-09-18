# Call Minimize Video Fix — Bugfix Design

## Overview

When a video call is minimized to the floating Picture-in-Picture (PiP) window, the remote video stream does not display (black screen). The root cause is that `remoteVideoRef` is assigned to three `<video>` elements simultaneously — the always-mounted hidden element (line 1172), the minimized PiP element (line 1241), and the full-screen element (line 1326). Because a React ref can only point to one DOM node at a time, the `srcObject` is set on whichever element holds the ref at stream-arrival time, but when `callMinimized` toggles the rendered element the ref re-points to a different node that has no `srcObject`, producing a black screen.

The fix stores the remote `MediaStream` in a React state variable (`remoteStream`) and uses a `useEffect` to sync it to whichever video element is currently rendered. This decouples stream assignment from ref identity.

## Glossary

- **Bug_Condition (C)**: The condition that triggers the bug — a video call is active AND `callMinimized` is `true`
- **Property (P)**: The desired behavior — the PiP `<video>` element displays the remote participant's video stream
- **Preservation**: Existing behaviors that must remain unchanged — full-screen video display, audio playback, voice call PiP, and view-toggle continuity
- **remoteVideoRef**: The `useRef<HTMLVideoElement>` in `DashboardLayout` (`src/routes/dashboard.tsx`) used to imperatively set `srcObject` on the remote video element
- **remoteStream**: The proposed `useState<MediaStream | null>` that will hold the remote `MediaStream` object so all video elements can access it via `useEffect`
- **callMinimized**: Boolean React state that controls whether the PiP or full-screen call UI is rendered
- **onRemoteStreamCb**: Callback on `callManager` invoked when the WebRTC `ontrack` event fires with the remote stream

## Bug Details

### Bug Condition

The bug manifests when a video call is active and the user clicks the minimize button, causing `callMinimized` to become `true`. React unmounts the full-screen `<video ref={remoteVideoRef}>` and mounts the PiP `<video ref={remoteVideoRef}>`. The ref now points to the new (empty) PiP element, but `srcObject` was set on the previous element and is not transferred. The stream is lost from the visible element.

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type { callType: string, callMinimized: boolean, remoteStream: MediaStream | null }
  OUTPUT: boolean

  RETURN input.callType = "video"
         AND input.callMinimized = true
         AND input.remoteStream IS NOT NULL
END FUNCTION
```

### Examples

- User answers a video call → full-screen view shows remote video correctly → user taps Minimize → PiP appears with black screen (bug)
- User initiates a video call → remote connects → user minimizes → PiP shows black screen (bug)
- User minimizes then maximizes → full-screen view may also go black if ref was re-assigned during PiP render (edge case)
- Voice call minimized → PiP shows compact bar with no video element → unaffected (not a bug condition)

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- Full-screen remote video display must continue to work when `callMinimized = false`
- Toggling between minimized and full-screen views must not interrupt the remote video stream
- Remote audio playback via `remoteAudioRef` must continue unaffected
- Voice call PiP (compact bar) must continue to work as before
- Local video preview (`localVideoRef`) must continue to work
- `remoteVideoActive` state tracking (camera on/off detection) must continue to work

**Scope:**
All inputs where `callMinimized = false` OR `callType = "voice"` are outside the bug condition and must be completely unaffected by this fix. This includes:
- Full-screen video call view
- All voice call states (ringing, active, minimized)
- Mouse/touch interactions with call controls
- Mute, camera toggle, speaker, screen share controls

## Hypothesized Root Cause

Based on the bug description and code analysis, the root cause is:

1. **Single ref assigned to multiple elements**: `remoteVideoRef` appears in three JSX locations — the always-mounted hidden `<video>` (line 1172), the PiP `<video>` (line 1241), and the full-screen `<video>` (line 1326). React processes refs in render order; the last rendered element wins the ref.

2. **Imperative srcObject assignment tied to ref at stream-arrival time**: In `onRemoteStreamCb`, `remoteVideoRef.current.srcObject = stream` is called once when the stream arrives. If `callMinimized` changes after this point, the ref moves to a new element that never had `srcObject` set.

3. **No re-sync on view toggle**: There is no `useEffect` that re-applies `srcObject` when `callMinimized` changes, so the newly rendered video element always starts empty.

4. **Always-mounted hidden element steals the ref**: The hidden `<video ref={remoteVideoRef}>` at line 1172 is always in the DOM. When neither PiP nor full-screen is rendered, the ref points here. When PiP or full-screen renders, the ref moves — but the hidden element retains the `srcObject` from the initial assignment.

## Correctness Properties

Property 1: Bug Condition — PiP Displays Remote Video Stream

_For any_ state where `isBugCondition` returns true (video call active, `callMinimized = true`, remote stream present), the fixed component SHALL display the remote `MediaStream` in the PiP `<video>` element such that the video is visible and playing.

**Validates: Requirements 2.1, 2.2, 2.3**

Property 2: Preservation — Full-Screen and Non-Video Behavior Unchanged

_For any_ state where `isBugCondition` returns false (full-screen video call, voice call, or no active call), the fixed component SHALL produce exactly the same behavior as the original component, preserving remote video display in full-screen mode, audio playback, and all voice call functionality.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4**

## Fix Implementation

### Changes Required

**File**: `src/routes/dashboard.tsx`

**Specific Changes**:

1. **Add `remoteStream` state**: Replace the imperative ref-based stream assignment with a state variable.
   ```ts
   const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
   ```

2. **Update `onRemoteStreamCb`**: Instead of setting `remoteVideoRef.current.srcObject` directly, store the stream in state.
   ```ts
   callManager.onRemoteStreamCb = (stream) => {
     if (remoteAudioRef.current) {
       remoteAudioRef.current.srcObject = stream;
       remoteAudioRef.current.play().catch(() => {});
     }
     if (call.call_type === "video") {
       setRemoteStream(stream);
       // track video active state as before
     }
   };
   ```
   This change applies in both `answerCall` and `initiateCall` (two locations in the file).

3. **Add `useEffect` to sync stream to current video element**: Watch `remoteStream` and `callMinimized` together and apply `srcObject` to whichever element the ref currently points to.
   ```ts
   useEffect(() => {
     if (!remoteStream || !remoteVideoRef.current) return;
     remoteVideoRef.current.srcObject = remoteStream;
     remoteVideoRef.current.play().catch(() => {});
   }, [remoteStream, callMinimized]);
   ```
   Because `callMinimized` is in the dependency array, this effect re-runs every time the view toggles, re-applying the stream to the newly rendered element.

4. **Remove the always-mounted hidden `<video ref={remoteVideoRef}>`**: This element is the primary cause of ref contention. With `remoteStream` in state, there is no need for a hidden element to "hold" the stream. The hidden `<audio ref={remoteAudioRef}>` should remain.
   ```tsx
   {/* Before */}
   <audio ref={remoteAudioRef} autoPlay playsInline style={{ display: "none" }} />
   <video ref={remoteVideoRef} autoPlay playsInline style={{ display: "none", position: "absolute", width: 0, height: 0 }} />

   {/* After */}
   <audio ref={remoteAudioRef} autoPlay playsInline style={{ display: "none" }} />
   {/* hidden video element removed — stream managed via remoteStream state */}
   ```

5. **Clear `remoteStream` on call end**: In `onCallEndCb` and `endActiveCall`, add `setRemoteStream(null)` alongside the existing cleanup.

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, surface counterexamples that demonstrate the bug on unfixed code, then verify the fix works correctly and preserves existing behavior.

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples that demonstrate the bug BEFORE implementing the fix. Confirm or refute the root cause analysis. If we refute, we will need to re-hypothesize.

**Test Plan**: Write tests that render `DashboardLayout` with a mocked `callManager`, simulate a remote stream arriving, then toggle `callMinimized` to `true` and assert that the PiP `<video>` element's `srcObject` is set. Run these tests on the UNFIXED code to observe failures.

**Test Cases**:
1. **PiP Video Stream Test**: Simulate remote stream arrival → set `callMinimized = true` → assert PiP `<video>.srcObject` equals the stream (will fail on unfixed code)
2. **Ref Contention Test**: Assert that after minimizing, `remoteVideoRef.current` points to the PiP element and has `srcObject` set (will fail on unfixed code — ref points to hidden element or full-screen element)
3. **Toggle Test**: Minimize → maximize → minimize again → assert PiP video has stream each time (will fail on unfixed code)
4. **Stream Arrival After Minimize Test**: Set `callMinimized = true` first, then fire `onRemoteStreamCb` → assert PiP video has stream (may fail on unfixed code)

**Expected Counterexamples**:
- PiP `<video>.srcObject` is `null` after minimizing even though stream is active
- Possible causes: ref points to hidden element, ref points to previously unmounted full-screen element, `srcObject` not re-applied on re-render

### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds, the fixed component displays the remote stream in the PiP element.

**Pseudocode:**
```
FOR ALL state WHERE isBugCondition(state) DO
  result := render DashboardLayout with remoteStream set AND callMinimized = true
  ASSERT pipVideoElement.srcObject = remoteStream
  ASSERT pipVideoElement is playing
END FOR
```

### Preservation Checking

**Goal**: Verify that for all inputs where the bug condition does NOT hold, the fixed component produces the same behavior as the original.

**Pseudocode:**
```
FOR ALL state WHERE NOT isBugCondition(state) DO
  ASSERT fixedComponent(state) produces same video/audio output as originalComponent(state)
END FOR
```

**Testing Approach**: Property-based testing is recommended for preservation checking because:
- It generates many test cases automatically across the input domain
- It catches edge cases that manual unit tests might miss
- It provides strong guarantees that behavior is unchanged for all non-buggy inputs

**Test Plan**: Observe behavior on UNFIXED code for full-screen video and voice calls, then write property-based tests capturing that behavior.

**Test Cases**:
1. **Full-Screen Video Preservation**: Verify `remoteVideoRef.current.srcObject` is set when `callMinimized = false` and stream is present
2. **Voice Call Preservation**: Verify voice call PiP renders correctly and audio plays — no video element involved
3. **Toggle Continuity**: Verify stream is present in full-screen view after toggling back from PiP
4. **Audio Preservation**: Verify `remoteAudioRef.current.srcObject` is always set regardless of `callMinimized` state

### Unit Tests

- Test that `remoteStream` state is set when `onRemoteStreamCb` fires
- Test that the PiP `<video>` element receives `srcObject` when `callMinimized = true` and `remoteStream` is set
- Test that the full-screen `<video>` element receives `srcObject` when `callMinimized = false` and `remoteStream` is set
- Test that `remoteStream` is cleared to `null` when the call ends

### Property-Based Tests

- Generate random sequences of `callMinimized` toggles and assert the currently visible video element always has `srcObject` set when `remoteStream` is non-null
- Generate random call states (video/voice, minimized/full-screen) and assert audio always plays regardless of video state
- Test that `remoteVideoActive` tracking remains accurate across many stream configurations

### Integration Tests

- Full flow: answer video call → remote stream arrives → minimize → assert PiP shows video → maximize → assert full-screen shows video
- Full flow: initiate video call → remote connects → minimize → assert PiP shows video
- Toggle stress test: rapidly toggle `callMinimized` multiple times and assert video is always visible in the current view
- End call while minimized: assert cleanup runs correctly and `remoteStream` is cleared
