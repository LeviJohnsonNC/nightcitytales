# Roster page refresh

## What will change
- Use the supplied Night City artwork as a full-page roster background with a dark readability treatment.
- Reduce the page heading to only “Your Roster” and “New Character,” styled to remain clear over the artwork.
- Label each main action “Start Adventure” when no active campaign exists and “Continue Adventure” when one does.
- Place a sheet icon beside the main action, with an accessible label and tooltip.
- Move Reset Adventure and Delete into an ellipsis menu beside the sheet icon while preserving their existing confirmation dialogs.

## Technical details
- Store the supplied background through the project asset CDN and reference its pointer from the roster route.
- Extend the existing roster backend read to include whether each character has an active campaign; no new table or rule logic is needed.
- Keep the card layout responsive and use the existing Button, dropdown, tooltip, and dialog components.
- Verify the roster visually on desktop and mobile, then run focused tests/type checks and confirm the preview build is healthy.
