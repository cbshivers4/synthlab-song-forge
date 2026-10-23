# Delete my account (App Store guideline 5.1.1(v))

## What you'll see

In **Settings**, a new **Account** section at the bottom with a red **"Delete my account"** button. Tapping it opens a confirmation dialog that:

- Explains in plain words that this permanently deletes the account, all cloud projects, library files, and subscription record — and cannot be undone.
- Requires typing **DELETE** into a box before the red "Permanently delete my account" button becomes clickable (prevents accidental taps).
- On success: signs you out and returns to the sign-in screen with a confirmation message.
- On failure: shows an error and keeps you signed in.

## How it works (technical)

1. **New server function** `src/utils/account.functions.ts` → `deleteMyAccount`:
   - Protected by `requireSupabaseAuth` — only the signed-in user can delete their own account; the user ID comes from the verified session, never from the client.
   - Loads `supabaseAdmin` inside the handler (privileged, server-only) and deletes, in order:
     - Rows in `cloud_projects`, `library_items`, `subscriptions`, `support_tickets`, `user_roles`, `user_visual_settings` matching the user ID.
     - All files in the `synclab-cloud` storage bucket under the user's `${userId}/` prefix (listed then removed).
     - The auth account itself via `auth.admin.deleteUser(userId)` — this is the real backend deletion Apple requires.
   - Returns success only after all steps complete; storage cleanup failures are logged but don't block account removal.

2. **Settings UI** (`src/components/studio/Settings.tsx`):
   - New "Account" section with the danger button and the confirmation dialog (existing Dialog component, type-to-confirm pattern).

3. **Sign-out**: after the server confirms deletion, the client calls `supabase.auth.signOut()` and returns to the welcome screen.

## Verification

- Build must pass.
- Code-level check that the function rejects unauthenticated calls.
- I will NOT run a real deletion against your founder account.

## Not changing

- Paddle/browser checkout, pricing, paywall — untouched.
- No other settings or screens affected.
