import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
function UserNavbar() {
  const { user, logout } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  // Initials fallback
  const initials = (user?.name || 'U')
    .split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)

  return (
    <nav className="user-navbar">
      <div className="user-navbar-brand">
        Sub<span>Manage</span>
      </div>

      <div className="user-navbar-right">
         {/* ── Theme toggle ── */}
        <button
          onClick={toggleTheme}
          style={{
            background: 'rgba(255,255,255,0.1)',
            border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: '8px',
            padding: '6px 10px',
            cursor: 'pointer',
            fontSize: '16px',
            lineHeight: 1,
            transition: 'background 0.2s',
          }}
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {theme === 'dark' ? '☀️' : '🌙'}
        </button>
        {/* Avatar + name */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '10px',
        }}>
          {/* Avatar circle */}
          {user?.avatarUrl ? (
            <img
              src={user.avatarUrl}
              alt={user.name}
              style={{
                width: '32px', height: '32px',
                borderRadius: '50%', objectFit: 'cover',
                border: '2px solid rgba(255,255,255,0.3)',
                flexShrink: 0,
              }}
            />
          ) : (
            <div style={{
              width: '32px', height: '32px',
              borderRadius: '50%',
              background: 'rgba(255,255,255,0.15)',
              border: '2px solid rgba(255,255,255,0.3)',
              display: 'flex', alignItems: 'center',
              justifyContent: 'center',
              fontFamily: "'Sora', sans-serif",
              fontSize: '12px', fontWeight: '700',
              color: 'white', flexShrink: 0,
            }}>
              {initials}
            </div>
          )}

          {/* Name */}
          <span className="user-navbar-user">
            <strong>{user?.name || 'User'}</strong>
          </span>
        </div>

        <button className="user-logout-btn" onClick={handleLogout}>
          Logout
        </button>
      </div>
    </nav>
  )
}

export default UserNavbar