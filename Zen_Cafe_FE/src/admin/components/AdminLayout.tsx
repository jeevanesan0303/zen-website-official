
import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'

/**
 * Copies each table header's text onto the matching body cells as
 * data-label, so admin.css can show tables as stacked cards on phones.
 */
function useTableCellLabels(root: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = root.current
    if (!el) return

    const label = () => {
      el.querySelectorAll('table').forEach((table) => {
        const heads = [...table.querySelectorAll('thead th')].map((th) => th.textContent?.trim() || '')
        if (!heads.length) return
        table.querySelectorAll('tbody tr').forEach((tr) => {
          ;[...tr.children].forEach((cell, i) => {
            const text = heads[i] || ''
            if (cell.getAttribute('data-label') !== text) cell.setAttribute('data-label', text)
          })
        })
      })
    }

    // Card mode only when the table would not fit: measure its natural
    // width with card mode off, then switch it on if it overflows.
    const fit = (wrap: Element) => {
      const table = wrap.querySelector('table')
      if (!table) return
      const wasCards = wrap.classList.contains('is-cards')
      if (wasCards) wrap.classList.remove('is-cards')
      const needsCards = table.scrollWidth > wrap.clientWidth + 1
      wrap.classList.toggle('is-cards', needsCards)
    }

    const resizeObserver = new ResizeObserver((entries) => {
      entries.forEach((entry) => fit(entry.target))
    })
    const watched = new Set<Element>()

    const update = () => {
      label()
      el.querySelectorAll('.za-table-wrap').forEach((wrap) => {
        if (!watched.has(wrap)) {
          watched.add(wrap)
          resizeObserver.observe(wrap)
        }
        fit(wrap)
      })
    }

    update()
    const observer = new MutationObserver((records) => {
      // Ignore our own class toggles to avoid a feedback loop.
      if (records.every((r) => r.type === 'attributes')) return
      update()
    })
    observer.observe(el, { childList: true, subtree: true })
    return () => {
      observer.disconnect()
      resizeObserver.disconnect()
    }
  }, [root])
}

import type { AdminPage } from '../AdminApp'

import Header from './Header'
import Sidebar from './Sidebar'

import AdminAlert from '../utils/sweetAlert'

/* ==========================================
   TYPES
========================================== */

type Props = {
  children: ReactNode

  page: AdminPage

  onNavigate: (
    page: AdminPage
  ) => void

  query: string

  onQuery: (
    query: string
  ) => void

  onOpenSettings?: (
    tab: 'profile' | 'security'
  ) => void

  // Existing authentication logout function
  onLogout?: () => void | Promise<void>

  // SweetAlert confirmation from AdminApp
  onConfirmLogout?: (
    performLogout: () => void | Promise<void>
  ) => Promise<void>
}

/* ==========================================
   ADMIN LAYOUT
========================================== */

export default function AdminLayout({
  children,
  page,
  onNavigate,
  query,
  onQuery,
  onOpenSettings,
  onLogout,
  onConfirmLogout,
}: Props) {
  /* ==========================================
     MOBILE SIDEBAR STATE
  ========================================== */

  const [open, setOpen] =
    useState(false)

  const contentRef = useRef<HTMLElement | null>(null)
  useTableCellLabels(contentRef)

  /* ==========================================
     PAGE NAVIGATION
  ========================================== */

  const handleNavigate = (
    nextPage: AdminPage
  ) => {
    onNavigate(nextPage)
    setOpen(false)
  }

  /* ==========================================
     OPEN PROFILE / SECURITY SETTINGS
  ========================================== */

  const handleOpenSettings = (
    tab: 'profile' | 'security'
  ) => {
    onOpenSettings?.(tab)
    setOpen(false)
  }

  /* ==========================================
     LOGOUT WITH SWEETALERT2
  ========================================== */

  const handleLogout = async () => {
    setOpen(false)

    // Prevent misleading logout confirmation
    // if no authentication logout function exists.
    if (!onLogout) {
      await AdminAlert.warning(
        'Logout Not Connected',
        'The admin authentication logout function has not been connected yet.'
      )

      return
    }

    // Use the centralized confirmation
    // supplied by AdminApp.
    if (onConfirmLogout) {
      await onConfirmLogout(onLogout)
      return
    }

    // Fallback confirmation using SweetAlert2
    const confirmed =
      await AdminAlert.confirm(
        'Logout Confirmation',
        'Are you sure you want to log out of Zen Café Admin?',
        'Yes, Logout'
      )

    if (!confirmed) return

    try {
      await onLogout()
    } catch (error) {
      console.error(
        'Admin logout failed:',
        error
      )

      await AdminAlert.error(
        'Logout Failed',
        'Unable to log out. Please try again.'
      )
    }
  }

  /* ==========================================
     LAYOUT
  ========================================== */

  return (
    <div className="za-shell">

      {/* SIDEBAR */}

      <Sidebar
        page={page}
        onNavigate={handleNavigate}
        open={open}
        onClose={() =>
          setOpen(false)
        }
      />

      {/* MAIN CONTENT */}

      <div className="za-main">

        {/* HEADER */}

        <Header
          page={page}
          query={query}
          onQuery={onQuery}
          onMenu={() =>
            setOpen(true)
          }
          onNavigate={handleNavigate}
          onOpenSettings={
            handleOpenSettings
          }
          onLogout={() => {
            void handleLogout()
          }}
        />

        {/* PAGE CONTENT */}

        <main className="za-content" ref={contentRef}>
          {children}
        </main>

      </div>

    </div>
  )
}
