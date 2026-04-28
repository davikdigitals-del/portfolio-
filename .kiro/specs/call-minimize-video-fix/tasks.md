# Implementation Plan

- [ ] 1. Write bug condition exploration test
  - **Property 1: Bug Condition** - PiP Black Screen Bug
  - **CRITICAL**: This test MUST FAIL on unfixed code — failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior — it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate the bug exists
  - **Scoped PBT Approach**: Scope the property to the concrete failing case — video call active, remote stream arrives, then `callMinimized` is toggled to `true`
  - Render `DashboardLayout` with a mocked `callManager`; simulate `onRemoteStreamCb` firing with a fake `MediaStream`; then set `callMinimized = true`
  - Assert that the PiP `<video>` element's `srcObject` equals the remote stream (from Bug Condition in design: `isBugCondition` where `callType = "video"` AND `callMinimized = true` AND `remoteStream IS NOT NULL`)
  - Also assert `remoteVideoRef.current` points to the PiP element and has `srcObject` set
  - Run test on UNFIXED code
  - **EXPECTED OUTCOME**: Test FAILS — `srcObject` is `null` on the PiP element (ref still points to hidden element or previously unmounted full-screen element)
  - Document counterexamples found (e.g., "PiP `<video>.srcObject` is `null` after minimizing even though stream is active")
  - Mark task complete when test is written, run, and failure is documented
  - _Requirements: 1.1, 1.2, 1.3_

- [ ] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - Full-Screen and Non-Video Behavior Unchanged
  - **IMPORTANT**: Follow observation-first methodology
  - Observe: on UNFIXED code, when `callMinimized = false` and `onRemoteStreamCb` fires, `remoteVideoRef.current.srcObject` equals the stream
  - Observe: on UNFIXED code, voice call PiP renders correctly and `remoteAudioRef.current.srcObject` is set regardless of `callMinimized`
  - Observe: on UNFIXED code, toggling back from PiP to full-screen (`callMinimized = false`) shows the stream in the full-screen element
  - Write property-based tests: for all states where `isBugCondition` returns false (`callMinimized = false` OR `callType = "voice"`), the component produces the same video/audio output as the original
  - Test cases to cover (from Preservation Requirements in design):
    - Full-screen video: `callMinimized = false` + stream present → full-screen `<video>.srcObject` equals stream
    - Voice call PiP: `callType = "voice"` + minimized → compact bar renders, no video element, audio plays
    - Toggle continuity: minimize → maximize → assert full-screen `<video>.srcObject` still equals stream
    - Audio preservation: `remoteAudioRef.current.srcObject` is always set regardless of `callMinimized`
  - Verify all tests PASS on UNFIXED code
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [ ] 3. Fix for PiP black screen — remote video not displayed when call is minimized

  - [ ] 3.1 Add `remoteStream` state variable
    - In `DashboardLayout`, add `const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);`
    - This decouples stream storage from ref identity
    - _Bug_Condition: isBugCondition(input) where input.callType = "video" AND input.callMinimized = true AND input.remoteStream IS NOT NULL_
    - _Expected_Behavior: PiP `<video>.srcObject` equals remoteStream when callMinimized = true_
    - _Preservation: Full-screen video, audio, voice call PiP, and toggle continuity must remain unchanged_
    - _Requirements: 2.1, 2.2, 2.3_

  - [ ] 3.2 Update `onRemoteStreamCb` in both `answerCall` and `initiateCall`
    - Replace `remoteVideoRef.current.srcObject = stream` with `setRemoteStream(stream)` for video calls
    - Keep `remoteAudioRef.current.srcObject = stream` and `.play()` unchanged
    - Keep `remoteVideoActive` track event listeners unchanged
    - Apply in both locations in `src/routes/dashboard.tsx`
    - _Bug_Condition: isBugCondition(input) from design_
    - _Expected_Behavior: remoteStream state holds the MediaStream; useEffect syncs it to the current video element_
    - _Requirements: 2.1, 2.2, 2.3, 3.3_

  - [ ] 3.3 Add `useEffect` to sync `remoteStream` to the currently rendered video element
    - Add effect with `[remoteStream, callMinimized]` dependency array so it re-runs on every view toggle
    - Inside effect: if `!remoteStream || !remoteVideoRef.current` return early; otherwise set `remoteVideoRef.current.srcObject = remoteStream` and call `.play().catch(() => {})`
    - This ensures the newly rendered element (PiP or full-screen) always receives the stream
    - _Bug_Condition: isBugCondition(input) from design — callMinimized in deps triggers re-sync on toggle_
    - _Expected_Behavior: expectedBehavior — whichever video element is currently rendered has srcObject set_
    - _Requirements: 2.1, 2.2, 2.3, 3.1, 3.2_

  - [ ] 3.4 Remove the always-mounted hidden `<video ref={remoteVideoRef}>` element
    - Remove the hidden `<video>` element (line ~1172) that causes ref contention
    - Keep the hidden `<audio ref={remoteAudioRef}>` element — audio handling is unaffected
    - With `remoteStream` in state, there is no need for a hidden element to hold the stream
    - _Preservation: remoteAudioRef and audio playback must remain unchanged_
    - _Requirements: 2.3, 3.3_

  - [ ] 3.5 Clear `remoteStream` on call end
    - In `onCallEndCb` callback, add `setRemoteStream(null)` alongside existing cleanup
    - In `endActiveCall` function, add `setRemoteStream(null)` alongside existing cleanup
    - _Preservation: Cleanup must not affect audio or voice call teardown_
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

  - [ ] 3.6 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - PiP Displays Remote Video Stream
    - **IMPORTANT**: Re-run the SAME test from task 1 — do NOT write a new test
    - The test from task 1 encodes the expected behavior (PiP `<video>.srcObject` equals stream when `callMinimized = true`)
    - When this test passes, it confirms the expected behavior is satisfied
    - Run bug condition exploration test from step 1
    - **EXPECTED OUTCOME**: Test PASSES (confirms bug is fixed)
    - _Requirements: 2.1, 2.2, 2.3_

  - [ ] 3.7 Verify preservation tests still pass
    - **Property 2: Preservation** - Full-Screen and Non-Video Behavior Unchanged
    - **IMPORTANT**: Re-run the SAME tests from task 2 — do NOT write new tests
    - Run preservation property tests from step 2
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions)
    - Confirm full-screen video, audio, voice call PiP, and toggle continuity all still work

- [ ] 4. Checkpoint — Ensure all tests pass
  - Run the full test suite and confirm all tests pass
  - Verify the bug condition exploration test passes (PiP shows remote video)
  - Verify all preservation tests pass (no regressions in full-screen, audio, voice calls)
  - Ask the user if any questions arise
