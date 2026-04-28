# Bugfix Requirements Document

## Introduction

When a video call is minimized to the floating Picture-in-Picture (PiP) window, the remote video stream does not display in the minimized view. The PiP window appears but shows a black screen instead of the remote participant's video. This occurs because the `remoteVideoRef` React ref is being assigned to multiple `<video>` elements simultaneously (the hidden element at line 1172, the minimized PiP element at line 1241, and the full-screen element at line 1326). Since a React ref can only point to one DOM element at a time, the video stream (`srcObject`) gets set on one element but the ref points to a different element when the PiP view renders, causing the stream to not display.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN a video call is active and the user clicks the minimize button THEN the PiP window appears but the remote video does not display (shows black or blank screen)

1.2 WHEN the component renders with `callMinimized=true` THEN the `remoteVideoRef` gets reassigned to the PiP video element, disconnecting it from the hidden video element that has the `srcObject` stream

1.3 WHEN multiple video elements share the same `remoteVideoRef` THEN only the last-rendered element receives the ref, causing stream assignment to fail for other elements

### Expected Behavior (Correct)

2.1 WHEN a video call is active and the user clicks the minimize button THEN the PiP window SHALL display the remote participant's video stream

2.2 WHEN the component renders with `callMinimized=true` THEN the remote video stream SHALL be visible in the minimized PiP video element

2.3 WHEN the remote video stream is set via `srcObject` THEN all video elements that need to display the stream SHALL have access to it regardless of which element currently holds the ref

### Unchanged Behavior (Regression Prevention)

3.1 WHEN a video call is in full-screen mode (not minimized) THEN the remote video SHALL CONTINUE TO display correctly in the full-screen view

3.2 WHEN a user toggles between minimized and full-screen views THEN the remote video SHALL CONTINUE TO display in both views without interruption

3.3 WHEN the remote audio stream is playing THEN it SHALL CONTINUE TO play correctly regardless of the video display state

3.4 WHEN a voice call (non-video) is minimized THEN it SHALL CONTINUE TO work correctly as it does not use video elements
