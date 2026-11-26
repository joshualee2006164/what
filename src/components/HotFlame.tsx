export default function HotFlame({ className = '' }: { className?: string }) {
  return <svg className={`hot-flame ${className}`} viewBox="0 0 32 40" role="img" aria-label="Active discussion, based on recent reader comments">
    <path className="hot-flame__outer" d="M17 1c2 8-5 10-2 17 1-5 6-6 7-12 7 8 10 14 8 21-2 8-8 12-16 12C6 39 1 33 2 25 3 17 9 12 11 6c2 3 3 5 3 8 4-4 4-8 3-13Z" />
    <path className="hot-flame__inner" d="M19 18c1 5-3 6-2 11 1-3 4-4 5-7 3 4 4 7 3 10-1 4-4 6-8 6s-7-3-6-7c0-4 3-6 4-9 1 2 2 3 2 5 2-2 2-5 2-9Z" />
    <path className="hot-flame__core" d="M17 28c2 3 1 5-1 6-2 0-3-1-3-3 0-1 1-3 2-4 0 1 1 1 2 1Z" />
  </svg>
}
