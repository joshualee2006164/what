import { useEffect, useState } from 'react'

export default function BrandedLoading() {
  const [takingLong, setTakingLong] = useState(false)
  useEffect(() => {
    const timer = window.setTimeout(() => setTakingLong(true), 8000)
    return () => window.clearTimeout(timer)
  }, [])

  return <div className="branded-loading" role="status" aria-live="polite">
    <svg className="loading-earth" viewBox="0 0 120 120" aria-hidden="true">
      <defs><linearGradient id="loading-ocean" x1="0" x2="1" y1="0" y2="1"><stop stopColor="#8ECBD4" /><stop offset="1" stopColor="#2C7C9C" /></linearGradient></defs>
      <circle cx="60" cy="69" r="37" fill="url(#loading-ocean)" />
      <path d="M30 56 39 44l12-4 5 7 10 2 4 10-7 6-2 11-9 5-7-7-9-1-7-7z M63 77l8-5 9 4 5 10-5 9-8 5-6-9z" fill="#80BC00" />
      <path className="loading-sprout" d="M61 33c0-9 3-15 8-20m-7 14c-10-1-14-6-15-13 9-1 15 3 17 11m-4-5c4-10 10-12 17-10-1 8-7 13-16 14" fill="none" stroke="#76A52D" strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" />
    </svg>
    <span className="loading-wordmark">what<span>.</span></span>
    <span className="loading-caption">{takingLong ? 'Still catching up with the world…' : 'Catching up with the world…'}</span>
    {takingLong && <button className="loading-retry" onClick={() => window.location.reload()}>Try again</button>}
  </div>
}
