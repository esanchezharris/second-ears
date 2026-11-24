/**
 * tracks — one row per uploaded track.
 *
 * Who can read a track is decided per row, not by app role:
 *   - `ownerField` makes the uploader the owner ('own').
 *   - `teamField` points at the track's own id; 'team' passes for anyone with
 *     an active row in `team_members` for that id (owner or reviewer).
 *
 * `create: false` for everyone: tracks are created by the `createTrack`
 * server action, which also writes the owner's membership row.
 */

import type { CollectionSchema, RolePermissions } from 'deepspace/schema'
import { MAX_TITLE_LENGTH } from '../types'

/** Signed-in users get these rules whether their app role is member or admin,
 *  so the app owner's account has no special access to other people's tracks. */
const rules: RolePermissions = {
  read: 'team',
  create: false,
  update: 'own',
  delete: false,
  writableFields: ['title', 'visibility'],
}

export const tracksSchema: CollectionSchema = {
  name: 'tracks',
  columns: [
    // Same value as the record id. Exists as a column so `teamField` can use it.
    { name: 'trackId', storage: 'text', interpretation: 'plain', required: true, immutable: true },
    { name: 'ownerId', storage: 'text', interpretation: 'plain', required: true, immutable: true },
    {
      name: 'title',
      storage: 'text',
      interpretation: 'plain',
      required: true,
      maxLength: MAX_TITLE_LENGTH,
    },
    // Key of the audio file in the owner's private file storage.
    { name: 'audioKey', storage: 'text', interpretation: 'plain', required: true, immutable: true },
    { name: 'durationSec', storage: 'number', interpretation: 'plain', required: true },
    // Waveform peaks (numbers 0..1), computed once in the uploader's browser.
    { name: 'peaks', storage: 'text', interpretation: { kind: 'json' }, required: true },
    {
      name: 'visibility',
      storage: 'text',
      interpretation: { kind: 'select', options: ['private', 'public'] },
      default: 'private',
    },
  ],
  ownerField: 'ownerId',
  teamField: 'trackId',
  permissions: { member: rules, admin: rules },
}
