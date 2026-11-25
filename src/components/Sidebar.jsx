import { useState } from 'react'
import { Plus, MessageSquare, Settings, LogOut, Leaf, PanelLeftClose, PanelLeftOpen, BarChart3, Trash2, Menu, X } from 'lucide-react'
import ThemeToggle from './ThemeToggle.jsx'
import '../styles/Sidebar.css'

function Sidebar({ chats = [], activeChatId, onSelectChat, onNewChat, onOpenSettings, onOpenDashboard, onDeleteChat, onLogout }) {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const closeMobile = () => setMobileOpen(false)

  return (
    <>
      <button type="button" className="mobile-sidebar-trigger" onClick={() => setMobileOpen(true)} aria-label="Open navigation"><Menu size={18} /></button>
      {mobileOpen && <button type="button" className="sidebar-backdrop" onClick={closeMobile} aria-label="Close navigation" />}
      <aside className={`sidebar ${collapsed ? 'is-collapsed' : ''} ${mobileOpen ? 'is-mobile-open' : ''}`}>
        <div className="sidebar-brand">
          <Leaf size={18} className="sidebar-brand-icon" />
          <span className="sidebar-label">EcoRoute AI</span>
          <button type="button" className="sidebar-collapse" onClick={() => setCollapsed((value) => !value)} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>{collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}</button>
          <button type="button" className="mobile-sidebar-close" onClick={closeMobile} aria-label="Close navigation"><X size={18} /></button>
        </div>

        <button type="button" className="sidebar-new-chat" onClick={() => { onNewChat(); closeMobile() }} title="New chat"><Plus size={16} /><span className="sidebar-label">New chat</span></button>

        <nav className="sidebar-history" aria-label="Conversations">
          <span className="sidebar-section-label sidebar-label">Conversations</span>
          {chats.length === 0 ? <div className="sidebar-empty"><MessageSquare size={16} /><span className="sidebar-label">Your conversations will appear here.</span></div> : <ul>{chats.map((chat) => <li key={chat.id}><button type="button" className={`sidebar-history-item ${chat.id === activeChatId ? 'is-active' : ''}`} onClick={() => { onSelectChat(chat.id); closeMobile() }} title={chat.title}><MessageSquare size={15} /><span className="sidebar-label">{chat.title}</span><Trash2 size={13} className="sidebar-delete" onClick={(event) => { event.stopPropagation(); onDeleteChat?.(chat.id) }} /></button></li>)}</ul>}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-theme-row"><span className="sidebar-label">Appearance</span><ThemeToggle /></div>
          <button type="button" className="sidebar-footer-btn" onClick={() => { onOpenDashboard?.(); closeMobile() }} title="Impact dashboard"><BarChart3 size={16} /><span className="sidebar-label">Impact dashboard</span></button>
          <button type="button" className="sidebar-footer-btn" onClick={() => { onOpenSettings(); closeMobile() }} title="Settings"><Settings size={16} /><span className="sidebar-label">Settings</span></button>
          <button type="button" className="sidebar-footer-btn" onClick={onLogout} title="Log out"><LogOut size={16} /><span className="sidebar-label">Log out</span></button>
        </div>
      </aside>
    </>
  )
}

export default Sidebar
