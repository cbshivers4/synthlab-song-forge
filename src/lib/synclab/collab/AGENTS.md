# Live collaboration ("Live together")

- Access is song membership: project_members (invited email, matched to the signed-in JWT email) + can_access_project()/owns_project() security-definer helpers drive RLS on cloud_projects, project_members, project_ops and storage reads of `<uploader>/<song id>/…`; the owner keeps user_id (trigger) and alone can delete or invite.
- Live edits are rows in project_ops (realtime INSERT feed filtered by project_id). CollabBridge (mounted once per layout) diffs channels by trackKey (arm/record excluded), sends whole changed channels + the SharedSong settings, applies others through store.applyRemote (no undo step, no panel/playback reset) and records the applied keys so nothing echoes back. Last change wins per channel.
- Joiners get the current song from the longest-present peer (answersJoin) in chunked "snapshot" ops; with nobody present they keep the saved version. Saving stays manual (File → Save writes in place for members via update, never re-owning).
- Device-only audio (blob:) is uploaded to the sharer's own `<user>/<song>/live/` folder before a channel is sent (live-media.ts); only the shared copy gets the signed link.
