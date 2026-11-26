import { test, expect } from '@playwright/test'
import { captureConsoleErrors } from './helpers/errors'

/** Wait for the React app shell (present on every page). */
async function waitForApp(page: import('@playwright/test').Page) {
  await page.waitForSelector('[data-testid="app-root"]', { timeout: 15000 })
}

test.describe('Smoke tests', () => {
  test('globe landing loads without JS errors', async ({ page }) => {
    const errors = captureConsoleErrors(page)
    await page.goto('/')
    await waitForApp(page)
    await expect(page.getByTestId('what-landing')).toBeVisible()
    await expect(page.getByRole('button', { name: /rotating globe/i })).toBeVisible()
    const globeMap = page.locator('.globe-map')
    const firstMapPosition = await globeMap.getAttribute('transform')
    await page.waitForTimeout(90)
    expect(await globeMap.getAttribute('transform')).not.toBe(firstMapPosition)
    expect(await page.locator('.globe-city').count()).toBeGreaterThan(0)
    expect(await page.locator('.globe-city-label').count()).toBe(0)
    await expect(globeMap).toHaveAttribute('transform', /^rotate\(/)
    expect(errors).toEqual([])
  })

  test('landing questions emerge individually in distinct safe positions', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 })
    await page.goto('/')
    await expect(page.getByTestId('what-landing')).toBeVisible()
    const bubbles = page.locator('.globe-bubble')
    await page.waitForTimeout(300)
    await expect(bubbles).toHaveCount(0)
    await expect(bubbles).toHaveCount(1, { timeout: 3000 })
    const firstId = await bubbles.first().getAttribute('data-bubble-id')
    const firstStoryId = await bubbles.first().getAttribute('data-story-id')
    await expect(bubbles).toHaveCount(2, { timeout: 3000 })
    expect(await bubbles.first().getAttribute('data-bubble-id')).toBe(firstId)
    const details = await bubbles.evaluateAll((nodes) => nodes.map((node) => {
      const box = node.getBoundingClientRect()
      return {
        storyId: node.getAttribute('data-story-id'),
        question: node.textContent?.trim() ?? '',
        left: box.left,
        top: box.top,
        right: box.right,
        bottom: box.bottom,
      }
    }))
    expect(new Set(details.map((item) => item.storyId)).size).toBe(details.length)
    expect(details.some((item) => item.storyId === firstStoryId)).toBe(true)
    for (const bubble of details) {
      expect(bubble.question).toMatch(/\?$/)
      expect(bubble.question).not.toMatch(/…|\.\.\./)
    }
    for (let first = 0; first < details.length; first += 1) {
      for (let second = first + 1; second < details.length; second += 1) {
        const a = details[first]
        const b = details[second]
        expect(a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top).toBe(true)
      }
    }
    await expect(page.locator('.globe-bubble--exiting')).toHaveCount(0)
  })

  test('the complete planet rotates clockwise around its fixed ocean center', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 })
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.addInitScript(() => {
      const nativeSetInterval = window.setInterval.bind(window)
      window.setInterval = ((handler: TimerHandler, delay?: number, ...args: unknown[]) => {
        if (delay === 33) return 0
        return nativeSetInterval(handler, delay, ...args)
      }) as typeof window.setInterval
    })
    await page.goto('/')
    const planet = page.getByTestId('globe-planet')
    await expect(planet).toBeVisible()
    await page.waitForTimeout(100)
    const hierarchy = await page.evaluate(() => {
      const root = document.querySelector('[data-testid="globe-planet"]')
      const ocean = document.querySelector('[data-testid="earth-sphere"]')
      const city = document.querySelector('.globe-city')
      const land = root?.querySelector('[clip-path] path')
      return {
        oceanInPlanet: ocean?.parentElement === root,
        landInPlanet: land?.closest('[data-testid="globe-planet"]') === root,
        cityInPlanet: city?.closest('[data-testid="globe-planet"]') === root,
        cityUnclipped: city?.closest('[clip-path]') === null,
        cssAnimation: root ? getComputedStyle(root).animationName : '',
      }
    })
    expect(hierarchy).toEqual({
      oceanInPlanet: true,
      landInPlanet: true,
      cityInPlanet: true,
      cityUnclipped: true,
      cssAnimation: 'none',
    })

    const expected = [0, 90, 180, 270]
    let fixedCenter: { x: number; y: number } | undefined
    for (const angle of expected) {
      const geometry = await page.evaluate((value) => {
        const planet = document.querySelector('[data-testid="globe-planet"]')!
        planet.setAttribute('transform', `rotate(${value} 180 180)`)
        const ocean = document.querySelector('[data-testid="earth-sphere"]')!
        const sphereBox = ocean.getBoundingClientRect()
        return {
          center: { x: sphereBox.x + sphereBox.width / 2, y: sphereBox.y + sphereBox.height / 2 },
          circle: { width: sphereBox.width, height: sphereBox.height },
        }
      }, angle)
      await page.screenshot({ path: `/tmp/what-globe-angle-${angle}.png`, animations: 'disabled' })
      if (fixedCenter) {
        expect(geometry.center.x).toBeCloseTo(fixedCenter.x, 3)
        expect(geometry.center.y).toBeCloseTo(fixedCenter.y, 3)
      } else fixedCenter = geometry.center
      expect(geometry.circle.width).toBeCloseTo(geometry.circle.height, 3)
    }

    const cityDetails = await page.locator('.globe-city').evaluateAll((cities) => cities.map((city) => ({
      variant: city.getAttribute('data-city-variant'),
      buildingCount: city.querySelectorAll('rect').length,
      fills: [...new Set([...city.querySelectorAll('rect')].map((building) => building.getAttribute('fill')))],
    })))
    expect(new Set(cityDetails.map((city) => city.variant)).size).toBeGreaterThan(4)
    expect(new Set(cityDetails.map((city) => city.buildingCount)).size).toBeGreaterThan(3)
    expect(new Set(cityDetails.flatMap((city) => city.fills)).size).toBeGreaterThan(5)
  })

  test('landing has a title, description, and canonical', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByTestId('what-landing')).toBeVisible()
    await expect(page).toHaveTitle(/what\./)
    await expect(page.locator('head meta[name="description"]')).toHaveAttribute('content', /different point of view/i)
    await expect(page.locator('head link[rel="canonical"]')).toHaveAttribute('href', /\/$/)
  })

  test('globe fits a one-handed mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/')
    await expect(page.getByRole('button', { name: /rotating globe/i })).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
  })

  test('speech bubbles stay compact and separated on desktop and mobile', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 })
    await page.goto('/')
    await expect(page.getByTestId('what-landing')).toBeVisible()
    await page.screenshot({ path: '/tmp/what-current-landing-desktop.png' })
    await page.addStyleTag({ content: '.globe-scene .globe-bubble:not(.visual-test-fixture){display:none!important}@media(max-width:600px){.visual-test-fixture.globe-bubble--slot-5,.visual-test-fixture.globe-bubble--slot-6{display:none!important}}' })
    await page.evaluate(() => {
      const scene = document.querySelector('.globe-scene')
      if (!scene) return
      const colors = ['honey', 'mint', 'ocean', 'peach', 'lavender', 'rose']
      for (let index = 0; index < colors.length; index += 1) {
        const bubble = document.createElement('button')
        bubble.type = 'button'
        bubble.className = `speech-bubble speech-bubble--${colors[index]} globe-bubble globe-bubble--slot-${index + 1} visual-test-fixture`
        bubble.setAttribute('aria-label', 'Visual test fixture only; not a news story')
        bubble.innerHTML = '<span class="speech-bubble__content">Should cities make buses free?</span><span aria-hidden="true" class="speech-bubble__tail speech-bubble__tail--bottom-left"></span>'
        scene.appendChild(bubble)
      }
    })
    await page.waitForTimeout(650)
    const fixtures = page.locator('.globe-scene .visual-test-fixture')
    const bubbleStyle = await fixtures.first().evaluate((node) => ({ opacity: getComputedStyle(node).opacity, animation: getComputedStyle(node).animationName, position: getComputedStyle(node).position }))
    expect(bubbleStyle).toMatchObject({ opacity: '1', position: 'absolute' })
    const desktop = await fixtures.evaluateAll((nodes) => nodes.filter((node) => getComputedStyle(node).display !== 'none').map((node) => {
      const box = node.getBoundingClientRect()
      return { left: box.left, right: box.right, top: box.top, bottom: box.bottom, height: box.height }
    }))
    expect(desktop.length).toBe(6)
    expect(Math.max(...desktop.map((box) => box.height))).toBeLessThan(100)
    for (let i = 0; i < desktop.length; i += 1) for (let j = i + 1; j < desktop.length; j += 1) {
      const overlapX = Math.min(desktop[i].right, desktop[j].right) - Math.max(desktop[i].left, desktop[j].left)
      const overlapY = Math.min(desktop[i].bottom, desktop[j].bottom) - Math.max(desktop[i].top, desktop[j].top)
      expect(overlapX > 0 && overlapY > 0, `desktop bubbles ${i + 1} and ${j + 1} overlap`).toBe(false)
    }
    await page.screenshot({ path: '/tmp/what-speech-bubbles-desktop.png' })

    await page.setViewportSize({ width: 390, height: 844 })
    const mobile = await fixtures.evaluateAll((nodes) => nodes.filter((node) => getComputedStyle(node).display !== 'none').map((node) => {
      const box = node.getBoundingClientRect()
      return { left: box.left, right: box.right, top: box.top, bottom: box.bottom, height: box.height }
    }))
    expect(mobile.length).toBe(4)
    expect(Math.max(...mobile.map((box) => box.height))).toBeLessThan(90)
    for (let i = 0; i < mobile.length; i += 1) for (let j = i + 1; j < mobile.length; j += 1) {
      const overlapX = Math.min(mobile[i].right, mobile[j].right) - Math.max(mobile[i].left, mobile[j].left)
      const overlapY = Math.min(mobile[i].bottom, mobile[j].bottom) - Math.max(mobile[i].top, mobile[j].top)
      expect(overlapX > 0 && overlapY > 0, `mobile bubbles ${i + 1} and ${j + 1} overlap`).toBe(false)
    }
    await page.screenshot({ path: '/tmp/what-speech-bubbles-mobile.png' })
  })

  test('landing stacks the headline, globe, and invitation in the center', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 })
    await page.goto('/')
    const headline = page.getByRole('heading', { name: /everyone has an opinion/i })
    const globe = page.getByRole('button', { name: /rotating globe/i })
    const invitation = page.getByText(/tap the world to explore/i)
    await expect(headline).toBeVisible()
    await expect(globe).toBeVisible()
    await expect(invitation).toBeVisible()
    const boxes = await Promise.all([headline.boundingBox(), globe.boundingBox(), invitation.boundingBox()])
    expect(boxes[0] && boxes[1] && boxes[2]).toBeTruthy()
    expect((boxes[0]!.x + boxes[0]!.width / 2)).toBeCloseTo(640, 0)
    expect((boxes[1]!.x + boxes[1]!.width / 2)).toBeCloseTo(640, 0)
    expect(boxes[0]!.y + boxes[0]!.height).toBeLessThan(boxes[1]!.y)
    expect(boxes[2]!.y).toBeGreaterThan(boxes[1]!.y + boxes[1]!.height)
    const sphere = await page.getByTestId('earth-sphere').boundingBox()
    expect(sphere).toBeTruthy()
    expect(sphere!.x + sphere!.width / 2).toBeCloseTo(640, 0)
    const nav = await page.getByTestId('app-navigation').boundingBox()
    expect(nav).toBeTruthy()
    expect(sphere!.y + sphere!.height / 2).toBeCloseTo((nav!.y + nav!.height + 900) / 2, 0)
    expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBeLessThanOrEqual(900)
  })

  test('story query opens an over-globe dialog and Escape returns to the landing route', async ({ page }) => {
    await page.goto('/?story=unseeded-test-record')
    await expect(page.getByRole('dialog', { name: /story and perspectives/i })).toBeVisible()
    await expect(page.getByTestId('what-landing')).toBeVisible()
    const modal = await page.locator('.story-modal-dialog').boundingBox()
    expect(modal).toBeTruthy()
    expect(modal!.width).toBeLessThanOrEqual(460)
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await expect(page.getByTestId('what-landing')).toBeVisible()
    await expect(page).toHaveURL(/\/$/)
  })

  test('a saved story opens a compact question with fully readable answers', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 })
    await page.goto('/')
    const bubbles = page.locator('.globe-bubble')
    await expect(bubbles.first()).toBeVisible({ timeout: 15000 })
    await bubbles.first().evaluate((node) => (node as HTMLButtonElement).click())
    await expect(page).toHaveURL(/\?story=/, { timeout: 5000 })
    await expect(page.getByRole('dialog', { name: /story and perspectives/i })).toBeVisible()
    const question = page.locator('.story-modal-dialog .prompt-question')
    await expect(question).toBeVisible({ timeout: 15000 })
    const orbitBubbles = page.locator('.discussion-orbit .perspective-bubble:visible')
    await expect(orbitBubbles).toHaveCount(1, { timeout: 3000 })
    await expect(orbitBubbles).toHaveCount(2, { timeout: 7000 })
    const cards = page.locator('.story-modal-dialog .opinion-grid .opinion-card')
    await expect(cards).toHaveCount(2)
    await expect(cards.nth(0)).toHaveAttribute('aria-pressed', 'false')
    await expect(cards.nth(1)).toHaveAttribute('aria-pressed', 'false')
    await expect(cards.nth(0)).toBeEnabled()
    await expect(cards.nth(1)).toBeEnabled()
    await expect(page.locator('.vote-confirmation')).toHaveCount(0)
    await expect(page.locator('.landing-page .globe-bubble:visible')).toHaveCount(0)
    const sideA = page.locator('.discussion-orbit .perspective-bubble--side-a:visible')
    const sideB = page.locator('.discussion-orbit .perspective-bubble--side-b:visible')
    expect(Math.abs(await sideA.count() - await sideB.count())).toBeLessThanOrEqual(1)
    await expect(page.locator('.discussion-orbit .ai-persona-disclosure').first()).toContainText('AI-generated')
    await expect(page.locator('.discussion-orbit .bubble-author--ai strong').first()).toContainText('· AI says')
    await expect(page.locator('.discussion-orbit .perspective-position-label')).toHaveCount(0)
    await expect(page.locator('.discussion-orbit .perspective-avatar')).toHaveCount(await orbitBubbles.count())
    await expect(page.locator('.discussion-orbit .perspective-upvote__button')).toHaveCount(await orbitBubbles.count())
    await expect(page.locator('.discussion-orbit .perspective-upvote__count').first()).toHaveText(/^\d+$/)
    const avatarDimensions = await page.locator('.discussion-orbit .perspective-avatar').first().evaluate((node) => {
      const { width, height } = node.getBoundingClientRect()
      return { width, height }
    })
    expect(avatarDimensions.width).toBeGreaterThanOrEqual(28)
    expect(avatarDimensions.width).toBeLessThanOrEqual(36)
    expect(avatarDimensions.height).toBe(avatarDimensions.width)
    const aiLabelWeight = await page.locator('.discussion-orbit .bubble-author--ai strong').first().evaluate((node) => Number(getComputedStyle(node).fontWeight))
    expect(aiLabelWeight).toBeGreaterThanOrEqual(800)
    const modalBounds = await page.locator('.story-modal-dialog').boundingBox()
    const orbitBounds = await orbitBubbles.evaluateAll((nodes) => nodes.map((node) => {
      const box = node.getBoundingClientRect()
      return { left: box.left, right: box.right, top: box.top, bottom: box.bottom, text: node.textContent ?? '' }
    }))
    for (const [index, bubble] of orbitBounds.entries()) {
      expect(bubble.right <= modalBounds!.x || bubble.left >= modalBounds!.x + modalBounds!.width || bubble.bottom <= modalBounds!.y || bubble.top >= modalBounds!.y + modalBounds!.height, `perspective ${index + 1} overlaps the question card`).toBe(true)
      expect(bubble.text).not.toContain((index % 2 ? await cards.nth(1).locator('.opinion-card__text').innerText() : await cards.nth(0).locator('.opinion-card__text').innerText()).trim())
    }
    for (const card of await cards.all()) {
      const text = (await card.innerText()).trim()
      expect(text).not.toMatch(/…|\.\.\./)
      const layout = await card.locator('.opinion-card__text').evaluate((node) => {
        const textRect = node.getBoundingClientRect()
        const cardRect = node.parentElement!.getBoundingClientRect()
        return { clamp: getComputedStyle(node).webkitLineClamp, overflow: getComputedStyle(node).overflow, scroll: node.scrollHeight, client: node.clientHeight, bottomSpace: cardRect.bottom - textRect.bottom }
      })
      expect(layout.clamp).toBe('none')
      expect(layout.scroll).toBeLessThanOrEqual(layout.client + 1)
      expect(layout.bottomSpace).toBeGreaterThanOrEqual(0)
    }
    await page.screenshot({ path: '/tmp/what-question-desktop.png' })
    const longOpinionA = 'Support the policy only after an independent review confirms its cost, benefit, effects on families, and long-term results. '.repeat(2).trim()
    const longOpinionB = 'Reject the policy until independent evidence shows it will work fairly, avoid unnecessary costs, and protect the people most affected. '.repeat(2).trim()
    await cards.nth(0).locator('.opinion-card__text').evaluate((node, text) => { node.textContent = text }, longOpinionA)
    await cards.nth(1).locator('.opinion-card__text').evaluate((node, text) => { node.textContent = text }, longOpinionB)
    await page.locator('.opinion-section').evaluate((section) => {
      const selectedCard = section.querySelector('.opinion-card--a')
      selectedCard?.classList.add('opinion-card--selected')
      const lock = document.createElement('span')
      lock.className = 'opinion-card__selected'
      lock.setAttribute('aria-hidden', 'true')
      lock.textContent = 'lock'
      selectedCard?.append(lock)
      const confirmation = document.createElement('div')
      confirmation.className = 'vote-confirmation'
      const message = document.createElement('p')
      message.textContent = 'Your opinion is locked in'
      const change = document.createElement('button')
      change.type = 'button'
      change.textContent = 'Change my answer'
      confirmation.append(message, change)
      section.querySelector('.opinion-grid')?.after(confirmation)
    })
    async function expectOpinionFlowToFit() {
      const layout = await page.locator('.opinion-section').evaluate((section) => {
        const cards = [...section.querySelectorAll<HTMLElement>('.opinion-card')]
        const grid = section.querySelector('.opinion-grid')!.getBoundingClientRect()
        const confirmation = section.querySelector('.vote-confirmation')!.getBoundingClientRect()
        const context = document.querySelector('.story-page--modal .context-toggle')!.getBoundingClientRect()
        return {
          cards: cards.map((card) => {
            const text = card.querySelector('.opinion-card__text')!
            const textRect = text.getBoundingClientRect()
            const cardRect = card.getBoundingClientRect()
            return { height: cardRect.height, textFits: text.scrollHeight <= text.clientHeight + 1, textBottom: textRect.bottom, cardBottom: cardRect.bottom }
          }),
          gridBottom: grid.bottom,
          confirmationTop: confirmation.top,
          confirmationBottom: confirmation.bottom,
          contextTop: context.top,
        }
      })
      expect(layout.cards[0].height).toBeCloseTo(layout.cards[1].height, 0)
      expect(layout.cards.every((card) => card.textFits && card.textBottom <= card.cardBottom)).toBe(true)
      expect(layout.confirmationTop).toBeGreaterThanOrEqual(layout.gridBottom)
      expect(layout.contextTop).toBeGreaterThanOrEqual(layout.confirmationBottom)
    }
    await expectOpinionFlowToFit()
    await page.setViewportSize({ width: 390, height: 844 })
    await expect(page.locator('.discussion-orbit .perspective-bubble:visible').first()).toBeVisible()
    const mobileCount = await page.locator('.discussion-orbit .perspective-bubble:visible').count()
    expect(mobileCount).toBeLessThanOrEqual(4)
    expect(Math.abs(
      await page.locator('.discussion-orbit .perspective-bubble--side-a:visible').count() -
      await page.locator('.discussion-orbit .perspective-bubble--side-b:visible').count(),
    )).toBeLessThanOrEqual(1)
    await expectOpinionFlowToFit()
    await page.screenshot({ path: '/tmp/what-question-mobile.png' })
  })

  test('discussion bubbles occupy the modal surroundings on desktop and mobile', async ({ page }) => {
    async function addVisualBubbles() {
      await page.locator('[data-modal-discussion-orbit]').evaluate((root) => {
        root.innerHTML = ''
        for (let index = 1; index <= 3; index += 1) {
          const bubble = document.createElement('button')
          bubble.className = `speech-bubble speech-bubble--${['peach','lavender','honey'][index - 1]} perspective-bubble perspective-bubble--anchor-${index}`
          bubble.textContent = 'Visual test fixture only. This is not a reader comment.'
          bubble.setAttribute('aria-label', 'Visual test fixture only; not a reader comment')
          root.appendChild(bubble)
        }
      })
    }
    await page.setViewportSize({ width: 1280, height: 900 })
    await page.goto('/?story=visual-test-only')
    await expect(page.getByRole('dialog', { name: /story and perspectives/i })).toBeVisible()
    await page.locator('.story-modal-dialog').evaluate((node) => { (node as HTMLElement).style.cssText += 'height:280px;overflow:visible;' })
    await addVisualBubbles()
    await page.waitForTimeout(550)
    const desktopCard = await page.locator('.story-modal-dialog').boundingBox()
    const desktopBubbles = await page.locator('.discussion-orbit .perspective-bubble').evaluateAll((nodes) => nodes.map((node) => {
      const box = node.getBoundingClientRect()
      return { left: box.left, right: box.right, top: box.top, bottom: box.bottom }
    }))
    expect(desktopBubbles).toHaveLength(3)
    await page.screenshot({ path: '/tmp/what-discussion-desktop.png' })
    for (const [index, bubble] of desktopBubbles.entries()) expect(bubble.right <= desktopCard!.x || bubble.left >= desktopCard!.x + desktopCard!.width || bubble.bottom <= desktopCard!.y || bubble.top >= desktopCard!.y + desktopCard!.height, `bubble ${index + 1} ${JSON.stringify(bubble)} overlaps modal ${JSON.stringify(desktopCard)}`).toBe(true)

    await page.setViewportSize({ width: 390, height: 844 })
    await page.locator('.story-modal-dialog').evaluate((node) => { (node as HTMLElement).style.height = '300px' })
    await page.waitForTimeout(100)
    const mobileCard = await page.locator('.story-modal-dialog').boundingBox()
    const mobileBubbles = await page.locator('.discussion-orbit .perspective-bubble').evaluateAll((nodes) => nodes.map((node) => {
      const box = node.getBoundingClientRect()
      return { left: box.left, right: box.right, top: box.top, bottom: box.bottom }
    }))
    for (const bubble of mobileBubbles) expect(bubble.right <= mobileCard!.x || bubble.left >= mobileCard!.x + mobileCard!.width || bubble.bottom <= mobileCard!.y || bubble.top >= mobileCard!.y + mobileCard!.height).toBe(true)
    await page.screenshot({ path: '/tmp/what-discussion-mobile.png' })
  })

  test('landing connects to shared story data', async ({ page }) => {
    let recordSocket = false
    page.on('websocket', (ws) => {
      if (new URL(ws.url()).pathname.startsWith('/ws/')) recordSocket = true
    })
    await page.goto('/')
    await expect(page.getByTestId('what-landing')).toBeVisible()
    await expect.poll(() => recordSocket, { timeout: 10000 }).toBeTruthy()
  })

  test('dynamic app boundary mounts on /home', async ({ page }) => {
    await page.goto('/home')
    await expect(page.getByTestId('app-navigation')).toBeVisible({ timeout: 15000 })
  })

  test('sign-in button visible when logged out', async ({ page }) => {
    await page.goto('/home')
    await expect(page.getByTestId('nav-sign-in-button')).toBeVisible({ timeout: 15000 })
    await expect(page.getByTestId('nav-user-name')).toHaveCount(0)
  })

  test('team role management requires sign-in', async ({ page }) => {
    await page.goto('/team')
    await expect(page.getByText('Sign in to continue')).toBeVisible({ timeout: 15000 })
    await expect(page.getByRole('heading', { name: 'Manage admins' })).toHaveCount(0)
  })

  test('unknown route shows 404', async ({ page }) => {
    await page.goto('/nonexistent-page-xyz')
    await waitForApp(page)
    await expect(page.locator('text=404')).toBeVisible()
  })
})
