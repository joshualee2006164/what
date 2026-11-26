import type { ButtonHTMLAttributes } from 'react'

type Tail = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'left' | 'right'

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  tail?: Tail
  tone?: 'cream' | 'mint' | 'ocean' | 'peach' | 'lavender' | 'honey' | 'rose'
}

export default function SpeechBubble({ children, className = '', tail = 'bottom-left', tone = 'cream', ...buttonProps }: Props) {
  return <button {...buttonProps} type={buttonProps.type ?? 'button'} className={`speech-bubble speech-bubble--${tone} ${className}`}>
    <span className="speech-bubble__content">{children}</span>
    <span aria-hidden="true" className={`speech-bubble__tail speech-bubble__tail--${tail}`} />
  </button>
}
