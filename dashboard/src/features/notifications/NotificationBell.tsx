import { useRef, useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useNotifications } from './useNotifications'
import type { AppNotification } from './useNotifications'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function relativeTime(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime()
  const minutes = Math.floor(diff / 60_000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`
  const days = Math.floor(hours / 24)
  return `${days} day${days === 1 ? '' : 's'} ago`
}

function getViewPath(notification: AppNotification): string | null {
  if (!notification.related_id) return null
  if (notification.type === 'new_complaint') return '/dashboard/complaints'
  if (notification.type === 'missed_route') return `/dashboard/routes/${notification.related_id}`
  return null
}

// ---------------------------------------------------------------------------
// NotificationBell
// ---------------------------------------------------------------------------

export default function NotificationBell() {
  const [open, setOpen] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const navigate = useNavigate()

  const { notifications, unreadCount, dismissNotification, dismissAllNotifications, isLoading } =
    useNotifications()

  // Close panel when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        panelRef.current &&
        !panelRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setOpen(false)
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [open])

  const handleView = (notification: AppNotification) => {
    const path = getViewPath(notification)
    if (path) {
      navigate(path)
      setOpen(false)
    }
  }

  return (
    <div className="relative">
      {/* Bell button */}
      <button
        ref={buttonRef}
        onClick={() => setOpen((prev) => !prev)}
        aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ''}`}
        aria-haspopup="true"
        aria-expanded={open}
        className="relative p-2 rounded-lg text-gray-400 hover:text-white hover:bg-gray-700 transition-colors focus:outline-none focus:ring-2 focus:ring-green-500"
      >
        {/* Bell SVG */}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-6 w-6"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>

        {/* Unread badge */}
        {unreadCount > 0 && (
          <span
            aria-hidden="true"
            className="absolute top-1 right-1 flex items-center justify-center min-w-[1.1rem] h-[1.1rem] rounded-full bg-red-500 text-white text-[0.6rem] font-bold leading-none px-0.5"
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      {open && (
        <div
          ref={panelRef}
          role="dialog"
          aria-label="Notifications panel"
          className="absolute right-0 mt-2 w-96 max-h-[32rem] flex flex-col bg-white rounded-xl shadow-2xl border border-gray-200 z-50 overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50">
            <h2 className="text-sm font-semibold text-gray-800">Notifications</h2>
            {notifications.length > 0 && (
              <button
                onClick={() => dismissAllNotifications()}
                className="text-xs text-blue-600 hover:text-blue-800 font-medium transition-colors focus:outline-none focus:underline"
              >
                Mark all as dismissed
              </button>
            )}
          </div>

          {/* List */}
          <div className="overflow-y-auto flex-1">
            {isLoading ? (
              <div className="flex items-center justify-center py-10 text-gray-400 text-sm">
                Loading…
              </div>
            ) : notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-gray-400 text-sm gap-2">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-8 w-8 text-gray-300"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                  />
                </svg>
                No new notifications
              </div>
            ) : (
              <ul role="list" className="divide-y divide-gray-100">
                {notifications.map((notification) => {
                  const viewPath = getViewPath(notification)
                  return (
                    <li
                      key={notification.id}
                      className="px-4 py-3 hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-start gap-3">
                        {/* Type indicator dot */}
                        <span
                          aria-hidden="true"
                          className={[
                            'mt-1.5 flex-shrink-0 w-2 h-2 rounded-full',
                            notification.type === 'missed_route'
                              ? 'bg-orange-400'
                              : notification.type === 'pending_sync_overflow'
                              ? 'bg-yellow-400'
                              : 'bg-blue-400',
                          ].join(' ')}
                        />

                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {notification.title}
                          </p>
                          {notification.body && (
                            <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">
                              {notification.body}
                            </p>
                          )}
                          <p className="text-xs text-gray-400 mt-1">
                            {relativeTime(notification.created_at)}
                          </p>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-1 flex-shrink-0 ml-1">
                          {viewPath && (
                            <button
                              onClick={() => handleView(notification)}
                              className="text-xs text-blue-600 hover:text-blue-800 font-medium px-1.5 py-0.5 rounded hover:bg-blue-50 transition-colors focus:outline-none focus:ring-1 focus:ring-blue-400"
                              aria-label={`View details for: ${notification.title}`}
                            >
                              View
                            </button>
                          )}
                          <button
                            onClick={() => dismissNotification(notification.id)}
                            className="text-gray-400 hover:text-gray-600 p-0.5 rounded hover:bg-gray-100 transition-colors focus:outline-none focus:ring-1 focus:ring-gray-400"
                            aria-label={`Dismiss notification: ${notification.title}`}
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              className="h-4 w-4"
                              viewBox="0 0 20 20"
                              fill="currentColor"
                              aria-hidden="true"
                            >
                              <path
                                fillRule="evenodd"
                                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                                clipRule="evenodd"
                              />
                            </svg>
                          </button>
                        </div>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
