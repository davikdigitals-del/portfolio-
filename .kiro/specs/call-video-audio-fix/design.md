# Call Video/Audio Fix — Bugfix Design

## Overview

Three distinct bugs affect the call initiator's experience in `src/routes/dashboard.chat.tsx` and `src/routes/dashboard.tsx`. The receiver's experience is unaffected.

1. **Remote video black screen (race condition)** — `onRemoteStreamCb` is assigned inside `__setActiveCall`, which runs *after* `callManager.initiateCall()` returns. If the remote `ontrack` event fires during `initiateCall()` (before `__setActiveCall` is called), the callback is null and the stream is silently dropped.

2. **Hidden video ref stealing** — `remoteVideoRef` is a single React ref that is attached to an always-mounted hidden `<video>` element (0×0 px). When the full-screen video element is rendered, it also tries to use the same ref, but the ref already points to the hidden element, so the visible element never receives the stream.

3. **Audio autoplay blocked** — `.play().catch(() => {})` silently swallows `NotAllowedError` from the browser's autoplay policy. The caller hears nothing and there is no recovery path.

The fix strategy is: assign callbacks before `initiateCall()`, store the remote stream in React state and sync it via `useEffect`, and handle `NotAllowedError` explicitly with a one-time interaction listener.

---

## Glossary

- **Bug_Condition (C)**: The set of `CallEvent` inputs that trigger one or more of the three defects described above.
- **Property (P)**: The desired correct behavior for any input where C holds — remote video is visible and playing, remote audio is audible.
- **Preservation**: All call behaviors that must remain unchanged by the fix — receiver-side display, mute/unmute, video toggle, call teardown, background audio.
- **`initiateCall()`**: The async function in `src/routes/dashboard.chat.tsx` that calls `callManager.initiateCall()` and then calls `window.__setActiveCall()`.
- **`__setActiveCall`**: A window global registered in `src/routes/dashboard.tsx` that sets React state and assigns `callManager.onRemoteStreamCb` — currently called *after* `callManager.initiateCall()`.
- **`onRemoteStreamCb`**: The callback on `CallManager` that is invoked by `pc.ontrack` when the remote peer's media stream arrives.
- **`remoteVideoRef`**: A React ref currently attached to a hidden always-mounted `<video>` element, causing the visible full-screen element to never receive the stream.
- **`remoteStream` state**: The proposed React state variable that will hold the remote `MediaStream`, decoupling stream delivery from DOM ref availability.
- **`NotAllowedError`**: The `DOMException` thrown by `HTMLMediaElement.play()` when the browser's autoplay policy blocks playback without prior user interaction.

---

## Bug Details

### Bug Condition

The bug manifests in three distinct scenarios, all affecting the call initiator.

**Formal Specification:**

```
FUNCTION isBugCondition(X)
  INPUT: X of type CallEvent
  OUTPUT: boolean

  // Bug 1 — remote stream race condition
  IF X.role = "initiator"
    AND X.call_type = "video"
    AND X.ontrack_fired_before_setActiveCall = true
  THEN RETURN true

  // Bug 2 — hidden video ref stealing
  IF X.role = "initiator"
    AND X.call_type = "video"
    AND X.remoteVideoRef_points_to_hidden_element = true
  THEN RETURN true

  // Bug 3 — autoplay blocked
  IF X.role = "initiator"
    AND X.browser_autoplay_blocked = true
  THEN RETURN true

  RETURN false
END FUNCTION
```

### Examples

- **Bug 1**: Initiator starts a video call on a fast connection. The receiver answers quickly and `ontrack` fires while `callManager.initiateCall()` is still awaiting the signaling subscription. `onRemoteStreamCb` is null at that moment, so the stream is dropped. Remote video stays black for the entire call.
- **Bug 2**: Initiator starts a video call. `onRemoteStreamCb` fires correctly (Bug 1 not triggered). The callback assigns `remoteVideoRef.current.srcObject = stream`, but `remoteVideoRef.current` points to the hidden 0×0 `<video>` element. The visible full-screen element never receives the stream. Remote video stays black.
- **Bug 3**: Initiator starts a voice call on mobile Chrome. The browser's autoplay policy blocks `.play()` on `remoteAudioRef`. The `.catch(() => {})` swallows the error. The caller hears nothing for the entire call.
- **Edge case — Bug 1 + Bug 2 combined**: Both race condition and ref stealing occur. Even if the race is fixed, Bug 2 still causes a black screen. Both must be fixed together.

---

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- The receiver's remote video display must continue to work correctly after the fix.
- The receiver's remote audio playback must continue to work correctly after the fix.
- Mute/unmute toggling by either party must continue to affect the other party's audio track.
- Video on/off toggling by either party must continue to affect the other party's video track.
- Call teardown (end, decline, missed) must continue to clean up WebRTC, media streams, and UI state correctly.
- Background audio must continue to flow without interruption when the app is backgrounded during an active call.

**Scope:**
All inputs where `isBugCondition(X) = false` must be completely unaffected by this fix. This includes:
- All receiver-side call handling (`answerCall`, `declineCall`)
- All in-call control actions (mute, video off, speaker, screen share, camera flip)
- All call lifecycle events (call end, missed call, call restore from localStorage)
- All non-call UI in the dashboard (chat, files, tasks, settings)

**Note:** The correct behavior for buggy inputs (what the fix must produce) is defined in the Correctness Properties section below.

---

## Hypothesized Root Cause

### Bug 1 — Remote Stream Race Condition

The call flow in `dashboard.chat.tsx` is:

```
1. callManager.initiateCall()   ← acquires media, opens signaling, builds RTCPeerConnection
2. window.__setActiveCall()     ← assigns callManager.onRemoteStreamCb
```

`callManager.initiateCall()` opens the signaling channel and builds the `RTCPeerConnection`. The `pc.ontrack` handler fires `onRemoteStreamCb?.(stream)` as soon as the remote peer sends tracks. On fast connections, `ontrack` can fire during step 1, before step 2 has run. At that point `onRemoteStreamCb` is `null`, so the stream is silently discarded.

**Root cause**: `onRemoteStreamCb` is assigned too late — after `initiateCall()` instead of before it.

### Bug 2 — Hidden Video Ref Stealing

The dashboard renders an always-mounted hidden `<video>` element with `ref={remoteVideoRef}`. When the full-screen call overlay is shown, a second `<video>` element also uses `ref={remoteVideoRef}`. React refs can only point to one DOM node at a time; the last assignment wins, but the hidden element is mounted first and the ref may not reliably update to the visible element. Even when the callback assigns `remoteVideoRef.current.srcObject = stream`, it writes to the hidden element.

**Root cause**: A single ref is shared between two video elements. The stream must be stored in state and synced to the correct element via `useEffect`.

### Bug 3 — Audio Autoplay Blocked

The current code:

```ts
remoteAudioRef.current.play().catch(() => {});
```

The empty catch silently discards `NotAllowedError`. The browser's autoplay policy requires a user gesture before media can play. On mobile browsers (Chrome, Safari) this policy is strictly enforced. There is no retry mechanism, so the audio never plays.

**Root cause**: `NotAllowedError` is not distinguished from other errors, and there is no recovery path (retry on user interaction).

---

## Correctness Properties

Property 1: Bug Condition — Remote Video Displayed for Initiator

_For any_ `CallEvent` where `isBugCondition(X) = true` and `X.call_type = "video"`, the fixed `initiateCall` flow SHALL deliver the remote `MediaStream` to the visible full-screen `<video>` element such that `remoteVideoElement.srcObject ≠ null`, `remoteVideoElement` is visible, and `remoteVideoElement.playing = true`.

**Validates: Requirements 2.1, 2.2**

Property 2: Bug Condition — Remote Audio Heard for Initiator

_For any_ `CallEvent` where `isBugCondition(X) = true` and `X.browser_autoplay_blocked = true`, the fixed code SHALL detect the `NotAllowedError`, register a one-time interaction listener, and retry `.play()` on the next user gesture so that `remoteAudioElement.playing = true` after the first interaction.

**Validates: Requirements 2.3**

Property 3: Preservation — Receiver and In-Call Behavior Unchanged

_For any_ `CallEvent` where `isBugCondition(X) = false`, the fixed code SHALL produce exactly the same observable behavior as the original code, preserving receiver-side video/audio display, mute/unmute, video toggle, call teardown, and background audio continuity.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6**

---

## Fix Implementation

### Changes Required

#### File: `src/routes/dashboard.chat.tsx`

**Function**: `initiateCall`

**Change 1 — Assign `onRemoteStreamCb` before `callManager.initiateCall()`**

Move the callback assignment to before the `callManager.initiateCall()` call so that any `ontrack` event fired during signaling is captured:

```ts
// BEFORE (buggy):
const call = await callManager.initiateCall(...);
window.__setActiveCall(call, profile);  // assigns onRemoteStreamCb here — too late

// AFTER (fixed):
callManager.onRemoteStreamCb = (stream) => { /* store in state */ };
callManager.onCallActiveCb = () => { /* start timer */ };
callManager.onCallEndCb = () => { /* cleanup */ };
const call = await callManager.initiateCall(...);
window.__setActiveCall(call, profile);  // now only sets UI state, callbacks already set
```

**Change 2 — Handle `NotAllowedError` in audio `.play()` calls**

Replace all `.play().catch(() => {})` on `remoteAudioRef` with a targeted handler:

```ts
function playWithAutoplayFallback(el: HTMLMediaElement) {
  el.play().catch((err: DOMException) => {
    if (err.name === "NotAllowedError") {
      const retry = () => {
        el.play().catch(() => {});
        document.removeEventListener("click", retry);
        document.removeEventListener("touchstart", retry);
      };
      document.addEventListener("click", retry, { once: true });
      document.addEventListener("touchstart", retry, { once: true });
    }
  });
}
```

#### File: `src/routes/dashboard.tsx`

**Change 3 — Replace `remoteVideoRef` with `remoteStream` state**

1. Remove the always-mounted hidden `<video ref={remoteVideoRef}>` element from the JSX.
2. Add `const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null)`.
3. In `onRemoteStreamCb`, call `setRemoteStream(stream)` instead of assigning to `remoteVideoRef.current`.
4. Add a `useEffect([remoteStream, callMinimized])` that assigns `remoteStream` to whichever video element is currently rendered:

```ts
useEffect(() => {
  if (!remoteStream) return;
  const el = remoteVideoRef.current;  // now only the visible element
  if (el) {
    el.srcObject = remoteStream;
    playWithAutoplayFallback(el);
  }
}, [remoteStream, callMinimized]);
```

5. Update `onCallEndCb` to call `setRemoteStream(null)` instead of manipulating `remoteVideoRef.current.style.display`.

**Change 4 — Apply `playWithAutoplayFallback` to all `.play()` calls on media elements**

Replace all instances of `.play().catch(() => {})` on `remoteAudioRef` and `remoteVideoRef` with `playWithAutoplayFallback(el)`.

---

## Testing Strategy

### Validation Approach

Testing follows a two-phase approach: first run exploratory tests on the unfixed code to confirm the root cause, then verify the fix with fix-checking and preservation-checking tests.

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples that demonstrate each bug on the unfixed code. Confirm or refute the root cause hypotheses.

**Test Plan**: Write unit tests that simulate the call initiation flow with controlled timing, assert that `onRemoteStreamCb` is called and the stream reaches the correct video element, and assert that audio plays after a simulated user interaction.

**Test Cases**:

1. **Race condition test**: Call `callManager.initiateCall()`, fire a synthetic `ontrack` event immediately (before `__setActiveCall` runs), assert that `onRemoteStreamCb` was invoked. Will fail on unfixed code because `onRemoteStreamCb` is null at that point.
2. **Hidden ref test**: Render the dashboard with the hidden `<video>` element mounted, assign a stream via `onRemoteStreamCb`, assert that the visible full-screen `<video>` element's `srcObject` is set. Will fail on unfixed code because the ref points to the hidden element.
3. **Autoplay blocked test**: Mock `HTMLMediaElement.play()` to reject with `NotAllowedError`, call the audio play logic, assert that a `click` listener is registered on `document`. Will fail on unfixed code because the error is swallowed.
4. **Autoplay retry test**: After the above, fire a synthetic `click` event on `document`, assert that `.play()` is called again. Will fail on unfixed code because no retry listener is registered.

**Expected Counterexamples**:
- `onRemoteStreamCb` is null when `ontrack` fires during `initiateCall()`.
- `remoteVideoRef.current` points to the hidden element, not the visible one.
- No retry listener is registered after `NotAllowedError`.

### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds, the fixed code produces the expected behavior.

**Pseudocode:**

```
FOR ALL X WHERE isBugCondition(X) DO
  result := initiateCall_fixed(X)
  IF X.call_type = "video" THEN
    ASSERT result.visibleVideoElement.srcObject ≠ null
    ASSERT result.visibleVideoElement.playing = true
  END IF
  IF X.browser_autoplay_blocked = true THEN
    ASSERT document.hasListener("click", retryPlay) = true
    FIRE click event
    ASSERT result.audioElement.playing = true
  END IF
END FOR
```

### Preservation Checking

**Goal**: Verify that for all inputs where the bug condition does NOT hold, the fixed code produces the same result as the original code.

**Pseudocode:**

```
FOR ALL X WHERE NOT isBugCondition(X) DO
  ASSERT original_behavior(X) = fixed_behavior(X)
END FOR
```

**Testing Approach**: Property-based testing is recommended for preservation checking because it generates many random call states and interaction sequences, catching regressions that manual tests would miss.

**Test Cases**:

1. **Receiver video preservation**: Simulate a receiver answering a call, assert that the receiver's remote video element receives the stream correctly after the fix.
2. **Mute/unmute preservation**: Toggle audio mute during an active call, assert that the audio track's `enabled` state changes correctly.
3. **Video toggle preservation**: Toggle video off/on during an active call, assert that the video track's `enabled` state changes correctly.
4. **Call teardown preservation**: End a call, assert that `remoteStream` state is cleared, the video element's `srcObject` is null, and the peer connection is closed.

### Unit Tests

- Test that `onRemoteStreamCb` is assigned before `callManager.initiateCall()` is awaited.
- Test that `setRemoteStream` is called when `onRemoteStreamCb` fires.
- Test that the `useEffect([remoteStream, callMinimized])` assigns the stream to the correct video element.
- Test `playWithAutoplayFallback`: normal play, `NotAllowedError` registers retry listener, retry fires on click.
- Test edge case: `ontrack` fires with no video tracks (voice call) — `remoteStream` state is still set for audio.

### Property-Based Tests

- Generate random `MediaStream` configurations (audio-only, video+audio) and verify that `remoteStream` state is always set correctly regardless of when `ontrack` fires relative to `__setActiveCall`.
- Generate random sequences of `callMinimized` state changes and verify that the stream is always synced to the currently rendered video element.
- Generate random browser autoplay policy states and verify that audio always eventually plays after at most one user interaction.

### Integration Tests

- Full initiator flow: start video call → receiver answers → verify initiator sees remote video within 2 seconds of connection.
- Full voice call flow: start voice call on mobile → simulate autoplay block → tap screen → verify audio plays.
- Minimize/maximize during call: start video call → minimize → maximize → verify remote video is still playing on the full-screen element.
- Call teardown: end call → verify `remoteStream` is null, hidden video element is gone, no memory leaks from dangling event listeners.
