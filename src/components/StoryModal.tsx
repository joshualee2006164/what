import { createContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

export const StoryModalDiscussionRoot = createContext<HTMLElement | null>(null)

export default function StoryModal({ children, onClose, closing = false }: { children: ReactNode; onClose: () => void; closing?: boolean }) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const [discussionRoot, setDiscussionRoot] = useState<HTMLDivElement | null>(null)

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const previousBodyOverflow = document.body.style.overflow
    const appScroller = document.querySelector<HTMLElement>('[data-app-scroll]')
    const previousScrollerOverflow = appScroller?.style.overflow
    document.body.style.overflow = 'hidden'
    if (appScroller) appScroller.style.overflow = 'hidden'
    requestAnimationFrame(() => dialogRef.current?.querySelector<HTMLElement>('[data-modal-close]')?.focus())

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault()
        if (!closing) onClose()
        return
      }
      if (event.key !== 'Tab' || !dialogRef.current) return
      const items = [...dialogRef.current.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])')]
        .filter((element) => element.getClientRects().length > 0)
      const first = items[0]
      const last = items.at(-1)
      if (!first || !last) { event.preventDefault(); dialogRef.current.focus(); return }
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousBodyOverflow
      if (appScroller && previousScrollerOverflow !== undefined) appScroller.style.overflow = previousScrollerOverflow
      previousFocus?.focus()
    }
  }, [onClose, closing])

  return createPortal(
    <div ref={dialogRef} className={`story-modal-scrim ${closing ? 'story-modal-scrim--closing' : ''}`} role="dialog" aria-modal="true" aria-label="Story and perspectives" tabIndex={-1} onMouseDown={(event) => { if (!closing && event.target === event.currentTarget) onClose() }}>
      <div ref={setDiscussionRoot} className="discussion-orbit" data-modal-discussion-orbit aria-label="Perspectives around this story" />
      <StoryModalDiscussionRoot.Provider value={discussionRoot}>
        <div className={`story-modal-dialog ${closing ? 'story-modal-dialog--closing' : ''}`}>{children}</div>
      </StoryModalDiscussionRoot.Provider>
    </div>,
    document.body,
  )
}
