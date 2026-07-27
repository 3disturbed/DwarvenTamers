/**
 * Consume a one-frame pointer activation after a modal handles it.
 *
 * Local single-player network events are synchronous, so a dialog choice can
 * open another panel before the current update finishes. Clearing both inputs
 * prevents that same click/tap from activating or dismissing the new panel.
 */
export default function consumePointerAction(actions) {
  actions.action = false;
  actions.screenTap = false;
}
