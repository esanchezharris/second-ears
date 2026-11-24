/**
 * paid_calls — one row for every AI run and every email the app pays for.
 *
 * The row is written BEFORE the paid call is made, and it is what the rate
 * limits read (see src/actions/paid-calls.ts).
 *
 * `slot` is unique. Two requests that ask for the same slot cannot both get
 * it, even if they arrive at the same instant, because the database refuses
 * the second row:
 *   email:<trackId>                one first-comment email per track, ever
 *   revision:<trackId>:<window>    one revision list per track per 5-minute window
 *
 * No role has any permission here. Only server actions read or write it.
 */

import type { CollectionSchema, RolePermissions } from 'deepspace/schema'

const noAccess: RolePermissions = { read: false, create: false, update: false, delete: false }

export const paidCallsSchema: CollectionSchema = {
  name: 'paid_calls',
  columns: [
    // The track owner the call was made for. Daily limits count per user.
    { name: 'userId', storage: 'text', interpretation: 'plain', required: true, immutable: true },
    {
      name: 'kind',
      storage: 'text',
      interpretation: { kind: 'select', options: ['revision-list', 'first-comment-email'] },
      required: true,
      immutable: true,
    },
    { name: 'trackId', storage: 'text', interpretation: 'plain', required: true, immutable: true },
    { name: 'slot', storage: 'text', interpretation: 'plain', required: true, immutable: true },
  ],
  uniqueOn: ['slot'],
  permissions: { member: noAccess, admin: noAccess },
}
