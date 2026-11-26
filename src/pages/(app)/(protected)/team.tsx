import { useState } from 'react'
import { useAuth, useUser, useUsers } from 'deepspace'
import { Link } from 'react-router-dom'

export default function TeamPage() {
  const { userId } = useAuth()
  const { user } = useUser()
  const { users, usersLoaded, setRole, refresh } = useUsers()
  const [notice, setNotice] = useState('')
  const isAdmin = user?.role === 'admin'

  if (!isAdmin) {
    return <main className="team-page">
      <section className="team-panel">
        <p className="eyebrow">Account access</p>
        <h1>Admin access required</h1>
        <p>Only a what. app admin can view the team or change roles. The app owner is automatically an admin.</p>
        <Link className="pill-button pill-button--dark" to="/">Back to what.</Link>
      </section>
    </main>
  }

  function changeRole(targetId: string, role: 'member' | 'admin') {
    setRole(targetId, role)
    setNotice('Role update sent to DeepSpace. The roster updates when the server confirms it.')
  }

  return <main className="team-page">
    <section className="team-panel">
      <div className="team-heading">
        <div><p className="eyebrow">App access</p><h1>Manage admins</h1></div>
        <button className="team-refresh" onClick={refresh}>Refresh list</button>
      </div>
      <p className="team-intro">Promote a signed-in what. reader to admin so they can refresh the shared news feed. DeepSpace verifies admin permission on every role change.</p>
      {!usersLoaded ? <p className="team-state">Loading app accounts…</p> : users.length === 0 ? <p className="team-state">No app accounts are registered yet. Ask the person to sign in to what. first, then refresh this list.</p> : (
        <ul className="team-list">
          {users.map((member) => <li key={member.id} className="team-row">
            <div className="team-identity">
              <strong>{member.name || 'Unnamed reader'}{member.id === userId ? ' (you)' : ''}</strong>
              <span>{member.email || (member.id === userId ? user?.email : 'Email is visible to admins only')}</span>
            </div>
            <div className="team-role-actions">
              <span className={`team-role team-role--${member.role}`}>{member.role}</span>
              {member.id !== userId && member.role !== 'admin' && <button onClick={() => changeRole(member.id, 'admin')}>Make admin</button>}
              {member.id !== userId && member.role === 'admin' && <button onClick={() => changeRole(member.id, 'member')}>Remove admin</button>}
            </div>
          </li>)}
        </ul>
      )}
      {notice && <p className="team-notice" role="status">{notice}</p>}
      <p className="team-footnote">Your own role cannot be changed here. The app owner remains an admin.</p>
    </section>
  </main>
}
