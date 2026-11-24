/**
 * checklist_items — the owner's revision list for a track.
 *
 * Owner-only: 'own' is checked against `ownerId`, so reviewers cannot read
 * these rows at all, let alone change them.
 *
 * Rows are created by the `makeRevisionList` server action (the AI writes
 * them). After that the owner works on them directly:
 *   update: 'own'  → tick an item off (`status`) or reword it (`title`)
 *   delete: 'own'  → remove an item
 */

import type { CollectionSchema, RolePermissions } from 'deepspace/schema'
import { MAX_CHECKLIST_TITLE_LENGTH } from '../types'

const rules: RolePermissions = {
  read: 'own',
  create: false,
  update: 'own',
  delete: 'own',
  writableFields: ['title', 'status'],
}

export const checklistItemsSchema: CollectionSchema = {
  name: 'checklist_items',
  columns: [
    { name: 'trackId', storage: 'text', interpretation: 'plain', required: true, immutable: true },
    { name: 'ownerId', storage: 'text', interpretation: 'plain', required: true, immutable: true },
    {
      name: 'title',
      storage: 'text',
      interpretation: 'plain',
      required: true,
      maxLength: MAX_CHECKLIST_TITLE_LENGTH,
    },
    {
      name: 'priority',
      storage: 'text',
      interpretation: { kind: 'select', options: ['high', 'medium', 'low'] },
      required: true,
      immutable: true,
    },
    // Time of the earliest source comment, so the item can jump to the spot.
    { name: 'timeSec', storage: 'number', interpretation: 'plain', required: true, immutable: true },
    // Record ids of the comments this item was made from.
    { name: 'commentIds', storage: 'text', interpretation: { kind: 'json' }, required: true, immutable: true },
    {
      name: 'status',
      storage: 'text',
      interpretation: { kind: 'select', options: ['open', 'done'] },
      default: 'open',
    },
  ],
  ownerField: 'ownerId',
  permissions: { member: rules, admin: rules },
}
