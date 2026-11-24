/**
 * invites — the invite link for a track.
 *
 * The record id is the secret in the link (/join/<record id>), so being able
 * to read an invite is the same as being able to share it. Only the track
 * owner can: 'own' is checked against `ownerId`.
 *
 * Rows are created by the `createInviteLink` action, which first checks that
 * the caller owns the track. The owner turns a link off by deleting its row.
 */

import type { CollectionSchema, RolePermissions } from 'deepspace/schema'

const rules: RolePermissions = { read: 'own', create: false, update: false, delete: 'own' }

export const invitesSchema: CollectionSchema = {
  name: 'invites',
  columns: [
    { name: 'trackId', storage: 'text', interpretation: 'plain', required: true, immutable: true },
    { name: 'ownerId', storage: 'text', interpretation: 'plain', required: true, immutable: true },
  ],
  ownerField: 'ownerId',
  permissions: { member: rules, admin: rules },
}
