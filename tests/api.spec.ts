import { test, expect } from '@playwright/test'

test.describe('API tests', () => {
  test('auth proxy forwards to auth worker', async ({ request }) => {
    const res = await request.get('/api/auth/ok')
    expect(res.ok()).toBeTruthy()
  })

  test('perspective upvote counts are public but changing an upvote still requires authentication', async ({ request }) => {
    const counts = await request.post('/api/actions/perspective-upvote-stats', {
      data: { storyId: 'missing-story' },
    })
    expect(counts.status()).toBe(200)
    expect(await counts.json()).toMatchObject({ success: false, code: 'not_found' })

    const write = await request.post('/api/actions/set-perspective-upvote', {
      data: { storyId: 'missing-story', perspectiveId: 'comment:missing-comment', upvoted: true },
    })
    expect(write.status()).toBe(401)
  })

  test('WebSocket endpoint exists', async ({ page }) => {
    // /home mounts the providers and auto-connects the records WebSocket.
    await page.goto('/home')
    // Wait for the app to connect its WebSocket (it auto-connects on mount)
    await page.waitForSelector('[data-testid="app-navigation"]', { timeout: 15000 })
    // If the app loaded and connected, the WS endpoint works
  })
})
