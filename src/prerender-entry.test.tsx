import { describe, expect, it } from 'vitest'
import { PRERENDER_ROUTES } from './prerender-entry'

/**
 * The what. landing reads stories from the live RecordRoom, so it is purposely
 * excluded from the build-time static page list. The plugin still emits the
 * empty client shell needed by the Worker for app routes.
 */
describe('public pages prerender', () => {
  it('keeps the live-data landing out of prerendered pages', () => {
    expect(PRERENDER_ROUTES).toEqual([])
  })
})
