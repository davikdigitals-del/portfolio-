# Delete/Edit Message Testing Guide

## Changes Made

### 1. Fixed Context Menu Button Handlers
- Changed from `onPointerDown` to `onClick` for better mobile compatibility
- Added `e.preventDefault()` to all button handlers to prevent default touch behavior
- Added 50ms delay before executing delete to prevent event conflicts
- The menu now closes immediately, then the action executes

### 2. Enhanced Logging
Added comprehensive console logging to help debug:
- `[ContextMenu]` - When context menu opens (shows message ID, type, ownership)
- `[Delete]` - Delete operation progress (start, database call, success/error)
- `[Edit]` - Edit operation progress (start, database call, success/error)

### 3. Improved Error Handling
- Added validation for empty message IDs
- Better error messages in toasts
- More detailed console error logs

## How to Test

### Testing Delete Functionality

1. **Open the chat page** on your mobile device
2. **Long-press on a message** you sent (hold for 500ms)
3. **Context menu should appear** with vibration feedback
4. **Tap "Delete message"** button
5. **Check console logs** for:
   ```
   [ContextMenu] Opening menu for message: [id]...
   [Delete] Starting delete for message: [id]
   [Delete] Calling Supabase update...
   [Delete] Message deleted successfully in database
   ```
6. **Verify**:
   - Toast notification shows "Message deleted"
   - Message content changes to "This message was deleted"
   - Message appears grayed out in chat

### Testing Edit Functionality

1. **Long-press on a TEXT message** you sent
2. **Context menu should appear**
3. **Tap "Edit message"** button
4. **Inline editor should appear** with current message text
5. **Modify the text** and press Enter (or tap Save)
6. **Check console logs** for:
   ```
   [ContextMenu] Opening menu for message: [id]...
   [Edit] Starting edit for message: [id] New text: [text]
   [Edit] Calling Supabase update...
   [Edit] Message edited successfully in database
   ```
7. **Verify**:
   - Toast notification shows "Message edited"
   - Message content updates in chat
   - Edit mode closes

### Testing Context Menu

1. **Long-press on any message** (yours or received)
2. **Menu should show**:
   - "Reply" button (always visible)
   - "Edit message" button (only for YOUR text messages)
   - "Delete message" button (for YOUR messages, or ALL messages if you're admin)
3. **Tap outside menu** to close without action
4. **Menu should close** smoothly

## Common Issues & Solutions

### Issue: Context menu doesn't appear
**Solution**: 
- Make sure you're holding for at least 500ms
- Check if touch events are being captured by another element
- Look for console errors

### Issue: Delete/Edit buttons don't work
**Solution**:
- Check browser console for error messages
- Look for `[Delete]` or `[Edit]` logs to see where it fails
- Check if RLS policies are blocking the operation (403 error)
- Verify you're logged in and have permission

### Issue: "Failed to delete/edit message" error
**Possible causes**:
1. **RLS Policy Issue**: Check Supabase logs for policy violations
2. **Network Issue**: Check network tab for failed requests
3. **Invalid Message ID**: Check console logs for the message ID being used

### Issue: Menu closes before button is clicked
**Solution**:
- This should be fixed with the new `onClick` handlers
- The 50ms delay on delete should prevent this
- Check console to see if the action is being triggered

## Database Permissions

The following RLS policies should be in place:

```sql
-- Users can update their own messages
-- Admins can update any message
-- Anyone can update message status (delivered/seen)
CREATE POLICY "msg_update_own_or_admin" ON public.messages FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.conversations c 
            WHERE c.id = conversation_id 
            AND (c.user_id = auth.uid() OR public.has_role(auth.uid(), 'admin')))
  )
  WITH CHECK (
    sender_id = auth.uid() OR 
    public.has_role(auth.uid(), 'admin') OR
    (sender_id != auth.uid() AND (status = 'sent' OR status = 'delivered'))
  );
```

## Testing Checklist

- [ ] Long-press opens context menu with vibration
- [ ] Context menu shows correct buttons based on message ownership
- [ ] Delete button works on own messages
- [ ] Delete button works on all messages (admin only)
- [ ] Edit button appears only for text messages
- [ ] Edit button works and saves changes
- [ ] Toast notifications appear for success/error
- [ ] Console logs show operation progress
- [ ] Menu closes after action
- [ ] Tapping outside menu closes it
- [ ] No console errors during operations

## Next Steps

1. **Deploy the changes** to your environment
2. **Test on mobile device** (not just desktop)
3. **Check console logs** while testing
4. **Report any errors** with the console log output

If delete/edit still doesn't work after these changes, the console logs will show exactly where the operation is failing.
