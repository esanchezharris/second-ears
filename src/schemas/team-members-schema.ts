/**
 * team_members — who has which role on which track.
 *
 * The collection name and the `teamId` / `userId` / `status` columns are fixed
 * by the SDK: the 'team' permission level looks up rows here. One "team" is
 * one track, so `teamId` holds a track id.
 *
 * Nobody can write this collection from the browser. Rows are created by
 * server actions only (`createTrack` for the owner, `redeemInvite` for
 * reviewers), which is what makes membership trustworthy.
 */

import type { CollectionSchema, RolePermissions } from 'deepspace/schema'

/** You can see your own memberships and the other members of your tracks. */
const rules: RolePermissions = { read: 'team', create: false, update: false, delete: false }

export const teamMembersSchema: CollectionSchema = {
  name: 'team_members',
  columns: [
    { name: 'teamId', storage: 'text', interpretation: 'plain', required: true, immutable: true },
    { name: 'userId', storage: 'text', interpretation: 'plain', required: true, immutable: true },
    { name: 'status', storage: 'text', interpretation: 'plain', default: 'active' },
    {
      name: 'role',
      storage: 'text',
      interpretation: { kind: 'select', options: ['owner', 'reviewer'] },
      required: true,
    },
  ],
  // One membership per user per track.
  uniqueOn: ['teamId', 'userId'],
  ownerField: 'userId',
  teamField: 'teamId',
  permissions: { member: rules, admin: rules },
}
