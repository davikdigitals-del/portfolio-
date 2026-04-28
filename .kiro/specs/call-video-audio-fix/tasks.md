# Implementation Plan

- [ ] 1. Write bug condition exploration test
  - **Property 1: Bug Condition** - Race Condition + Hidden Ref + Autoplay Block
  - **CRITICAL**: This test MUST FAIL on unfixed code — failure confirms the bugs exist
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior — it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate all three bugs on unfixed code
  - **Scoped PBT Approach**: Scope each sub-property to the concrete failing case to ensure reproducibility
  - Sub-property A — Race condition: call `callManager.initiateCall()`, fire a synthetic `ontrack` event immediately (before `window.__setActiveCall` runs), assert that `onRemoteStreamCb` was invoked with the stream. On unfixed code `onRemoteStreamCb` is null at that moment so the stream is silently dropped — test FAILS
  - Sub-property B — Hidden ref: render the dashboard with the always-mounted hidden `<video ref={remoteVideoRef}>` element, fire `onRemoteStreamCb(stream)`, assert that the visible full-screen `<video>` element's `srcObject` equals the stream. On unfixed code the ref points to the hidden 0×0 element — test FAILS
  - Sub-property C — Autoplay block: mock `HTMLMediaElement.play()` to reject with `new DOMException("", "NotAllowedError")`, call the audio play logic, assert that a `click` listener is registered on `document`. On unfixed code the error is swallowed by `.catch(() => {})` — test FAILS
  - Sub-property D — Autoplay retry: after sub-property C, fire a synthetic `click` event on `document`, assert that `.play()` is called a second time. On unfixed code no retry listener exists — test FAILS
  - Run all sub-properties on UNFIXED code
  - **EXPECTED OUTCOME**: Tests FAIL (this is correct — it proves the bugs exist)
  - Document counterexamples found:
    - `onRemoteStreamCb` is null when `ontrack` fires during `initiateCall()`
    - `remoteVideoRef.current` points to the hidden element, not the visible one
    - No retry listener is registered after `NotAllowedError`
  - Mark task complete when tests are written, run, and failures are documented
  - _Requirements: 1.1, 1.2, 1.3_

- [ ] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - Receiver and In-Call Behavior Unchanged
  - **IMPORTANT**: Follow observation-first methodology — run unfixed code with non-buggy inputs first
  - Observe: receiver answering a call (`isBugCondition = false`) correctly receives the remote stream via `onRemoteStreamCb` — record that `remoteVideoRef.current.srcObject` is set on the receiver side
  - Observe: `callManager.toggleAudio(true)` disables all audio tracks on `localStream` — record `track.enabled = false`
  - Observe: `callManager.toggleVideo(true)` disables all video tracks on `localStream` — record `track.enabled = false`
  - Observe: `callManager.endCall()` calls `onCallEndCb`, closes the peer connection, and stops all local tracks
  - Write property-based tests capturing these observed behaviors for all non-buggy inputs (where `isBugCondition(X) = false`):
    - For all receiver-side call events: `answerCall` sets callbacks before `callManager.answerCall()` and the remote stream reaches the correct element
    - For all mute/unmute sequences: `toggleAudio(muted)` always sets `audioTrack.enabled = !muted`
    - For all video toggle sequences: `toggleVideo(off)` always sets `videoTrack.enabled = !off`
    - For all call teardown events: `endCall()` always clears `remoteStream` state, closes the peer connection, and stops local tracks
  - Verify all preservation tests PASS on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

- [ ] 3. Fix all three call video/audio bugs

  - [ ] 3.1 Fix Bug 1 — assign `onRemoteStreamCb` before `callManager.initiateCall()` in `dashboard.chat.tsx`
    - In the `initiateCall` function in `src/routes/dashboard.chat.tsx`, move the assignment of `callManager.onRemoteStreamCb`, `callManager.onCallActiveCb`, and `callManager.onCallEndCb` to BEFORE the `await callManager.initiateCall(...)` call
    - The callback assigned to `onRemoteStreamCb` should call `setRemoteStream(stream)` (see task 3.2) rather than writing directly to `remoteVideoRef.current`
    - `window.__setActiveCall` should then only update UI state (setActiveCall, setActiveProfile) — callbacks are already wired
    - _Bug_Condition: `isBugCondition(X)` where `X.role = "initiator"` AND `X.ontrack_fired_before_setActiveCall = true`_
    - _Expected_Behavior: `onRemoteStreamCb` is non-null when `pc.ontrack` fires during `initiateCall()`_
    - _Requirements: 2.1_

  - [ ] 3.2 Fix Bug 2 — replace `remoteVideoRef` ref-stealing with `remoteStream` state in `dashboard.tsx`
    - Add `const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null)` to `DashboardLayout`
    - Remove the always-mounted hidden `<video ref={remoteVideoRef} style={{ display: "none" }}>` element from the JSX
    - In `onRemoteStreamCb` (both in `answerCall` and in the initiator path after task 3.1), replace `remoteVideoRef.current.srcObject = stream` with `setRemoteStream(stream)`
    - Add a `useEffect` that depends on `[remoteStream, callMinimized]`: when `remoteStream` is non-null and `remoteVideoRef.current` exists, assign `remoteVideoRef.current.srcObject = remoteStream` and call `playWithAutoplayFallback(remoteVideoRef.current)`
    - In `onCallEndCb`, replace `remoteVideoRef.current.style.display = "none"` with `setRemoteStream(null)`
    - _Bug_Condition: `isBugCondition(X)` where `X.role = "initiator"` AND `X.remoteVideoRef_points_to_hidden_element = true`_
    - _Expected_Behavior: visible full-screen `<video>` element's `srcObject` equals the remote `MediaStream`_
    - _Preservation: receiver-side `onRemoteStreamCb` must also call `setRemoteStream(stream)` so receiver video is unaffected_
    - _Requirements: 2.2, 3.1_

  - [ ] 3.3 Fix Bug 3 — handle `NotAllowedError` with retry on user interaction
    - Add a `playWithAutoplayFallback(el: HTMLMediaElement)` helper function (can live in `dashboard.tsx` or a shared util)
    - Implementation: call `el.play()`, catch `DOMException`, if `err.name === "NotAllowedError"` register a one-time `click` and `touchstart` listener on `document` that calls `el.play().catch(() => {})` and removes itself
    - Replace every `.play().catch(() => {})` call on `remoteAudioRef.current` and `remoteVideoRef.current` in `dashboard.tsx` with `playWithAutoplayFallback(el)`
    - Also apply to the `localVideoRef.current.play()` call in `answerCall` if it uses the same silent-catch pattern
    - _Bug_Condition: `isBugCondition(X)` where `X.browser_autoplay_blocked = true`_
    - _Expected_Behavior: after first user interaction, `remoteAudioElement.playing = true`_
    - _Preservation: non-`NotAllowedError` errors are still silently ignored (no change in behavior for other error types)_
    - _Requirements: 2.3_

  - [ ] 3.4 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - Race Condition + Hidden Ref + Autoplay Block
    - **IMPORTANT**: Re-run the SAME tests from task 1 — do NOT write new tests
    - The tests from task 1 encode the expected behavior; when they pass the fix is confirmed
    - Run all four sub-properties (A, B, C, D) from task 1 on the FIXED code
    - **EXPECTED OUTCOME**: All sub-properties PASS (confirms all three bugs are fixed)
    - _Requirements: 2.1, 2.2, 2.3_

  - [ ] 3.5 Verify preservation tests still pass
    - **Property 2: Preservation** - Receiver and In-Call Behavior Unchanged
    - **IMPORTANT**: Re-run the SAME tests from task 2 — do NOT write new tests
    - Run all preservation property tests from task 2 on the FIXED code
    - **EXPECTED OUTCOME**: All tests PASS (confirms no regressions in receiver flow, mute/unmute, video toggle, call teardown, background audio)
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

- [ ] 4. Checkpoint — Ensure all tests pass
  - Run the full test suite and confirm every test passes
  - Verify no dangling `click`/`touchstart` listeners remain after a call ends (check that `playWithAutoplayFallback` cleans up its own listeners via `{ once: true }` or explicit removal)
  - Verify no hidden `<video>` element remains in the DOM after the fix
  - Verify `remoteStream` state is `null` after call teardown (no memory leak from retained `MediaStream`)
  - Ask the user if any questions arise before closing the spec
