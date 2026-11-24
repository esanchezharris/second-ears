/**
 * comments — a note pinned to a moment (timeSec) on a track.
 *
 *   read:   'team'  → the track's owner and reviewers
 *   create: false   → only through the `addComment` server action, because a
 *                     schema cannot express "only members of this track"
 *   update: 'own'   → the author, and only the `body` field
 *   delete: 'own'   → the author
 *
 * `maxLength` on `body` is checked by the platform on every write, so an edit
 * sent around the page's own limit is refused too.
 */

import type { CollectionSchema, RolePermissions } from 'deepspace/schema'
import { MAX_COMMENT_LENGTH } from '../types'

const rules: RolePermissions = {
  read: 'team',
  create: false,
  update: 'own',
  delete: 'own',
  writableFields: ['body'],
}

export const commentsSchema: CollectionSchema = {
  name: 'comments',
  columns: [
    { name: 'trackId', storage: 'text', interpretation: 'plain', required: true, immutable: true },
    { name: 'authorId', storage: 'text', interpretation: 'plain', required: true, immutable: true },
    { name: 'timeSec', storage: 'number', interpretation: 'plain', required: true, immutable: true },
    {
      name: 'body',
      storage: 'text',
      interpretation: 'plain',
      required: true,
      maxLength: MAX_COMMENT_LENGTH,
    },
  ],
  ownerField: 'authorId',
  teamField: 'trackId',
  permissions: { member: rules, admin: rules },
}
