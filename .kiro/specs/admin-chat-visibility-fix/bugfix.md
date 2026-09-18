# Bugfix Requirements Document

## Introduction

In the client's chat view, the admin's online/offline status and last seen time are never shown correctly. The `adminOnline` variable is hardcoded to `false` on line 731 of `dashboard.chat.tsx`, so the green presence dot is always absent and the last seen label never reflects the admin's real status — even though `adminProfile.status` and `adminProfile.last_seen` are already available from the existing subscription and polling.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN the client chat sidebar renders the admin conversation row THEN the system uses a hardcoded `adminOnline = false`, always treating the admin as offline regardless of actual status

1.2 WHEN `adminOnline` is hardcoded to `false` and the admin is actually online THEN the system shows no green presence dot next to the admin's avatar

1.3 WHEN `adminOnline` is hardcoded to `false` THEN the system displays a "last seen X ago" label even when the admin is currently online

### Expected Behavior (Correct)

2.1 WHEN the client chat sidebar renders the admin conversation row THEN the system SHALL derive `adminOnline` from `adminProfile?.status === "online"` instead of the hardcoded `false` value

2.2 WHEN `adminOnline` is `true` THEN the system SHALL show a green presence dot next to the admin's avatar

2.3 WHEN `adminOnline` is `true` THEN the system SHALL display "Online" as the last seen label, matching the same logic used for client presence in the admin view

2.4 WHEN `adminOnline` is `false` THEN the system SHALL display "Last seen X ago" using `adminProfile.last_seen` via the existing `useLastSeenLabel` hook

### Unchanged Behavior (Regression Prevention)

3.1 WHEN the admin is logged in and views the chat THEN the system SHALL CONTINUE TO display client profiles, names, avatars, and online statuses correctly in the admin sidebar

3.2 WHEN a client sends or receives messages THEN the system SHALL CONTINUE TO deliver and display messages correctly regardless of admin online state

3.3 WHEN `adminProfile` updates via the existing real-time subscription or polling THEN the system SHALL CONTINUE TO reflect the latest `status` and `last_seen` values live without a page reload

3.4 WHEN the client chat page is unmounted THEN the system SHALL CONTINUE TO clean up all subscriptions and polling timers to prevent memory leaks

---

## Bug Condition

```pascal
FUNCTION isBugCondition(X)
  INPUT: X of type ChatPageState
  OUTPUT: boolean

  // Bug triggers when the client sidebar renders with adminOnline hardcoded
  RETURN (X.role = "client") AND (X.adminOnline = false /* hardcoded constant, not derived from adminProfile.status */)
END FUNCTION
```

```pascal
// Property: Fix Checking
FOR ALL X WHERE isBugCondition(X) DO
  result ← renderClientSidebar'(X)
  ASSERT result.adminOnline = (adminProfile.status = "online")
  ASSERT result.presenceDotVisible = (adminProfile.status = "online")
  ASSERT result.lastSeenLabel = "Online" WHEN adminProfile.status = "online"
END FOR

// Property: Preservation Checking
FOR ALL X WHERE NOT isBugCondition(X) DO
  ASSERT renderClientSidebar(X) = renderClientSidebar'(X)
END FOR
```
