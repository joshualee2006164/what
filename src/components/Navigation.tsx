import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { AuthOverlay, useAuthProfileReady, signOut } from 'deepspace'

export default function Navigation() {
  const { isLoaded, isSignedIn, user, userLoading } = useAuthProfileReady({ requireUser: true })
  const { pathname } = useLocation()
  const [showAuth, setShowAuth] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const ready = !isSignedIn || (!userLoading && !!user)

  return (
    <>
      <nav data-testid="app-navigation" className="site-nav">
        <Link to="/" className="wordmark" aria-label="what. home">what<span>.</span></Link>
        <span className="nav-spacer" />
        <div className="site-nav-links">
          <Link to="/home" aria-current={pathname === '/home' ? 'page' : undefined}>Explore</Link>
          {isSignedIn && <Link to="/settings" aria-current={pathname === '/settings' ? 'page' : undefined}>You</Link>}
          {user?.role === 'admin' && <Link to="/news-admin" aria-current={pathname === '/news-admin' ? 'page' : undefined}>News desk</Link>}
          {user?.role === 'admin' && <Link to="/team" aria-current={pathname === '/team' ? 'page' : undefined}>Team</Link>}
        </div>
        {!isLoaded ? <span className="nav-skeleton" /> : isSignedIn && ready && user ? (
          <div className="account-nav">
            <span className="nav-user-name" data-testid="nav-user-name">{user.name || user.email}</span>
            <span className="sr-only" data-testid="nav-user-email">{user.email}</span>
            <button className="nav-account-button" onClick={() => setMenuOpen((open) => !open)} aria-expanded={menuOpen} aria-label="Account menu">
              {(user.name || user.email || 'W').slice(0, 1).toUpperCase()}
            </button>
            {menuOpen && <div className="account-popover"><span>{user.name || 'Signed in'}</span><small>{user.email}</small><button onClick={() => signOut()}>Sign out</button></div>}
          </div>
        ) : isSignedIn ? <span className="nav-skeleton" /> : (
          <button data-testid="nav-sign-in-button" className="nav-sign-in" onClick={() => setShowAuth(true)}>Sign in</button>
        )}
      </nav>
      {showAuth && <AuthOverlay onClose={() => setShowAuth(false)} />}
    </>
  )
}
