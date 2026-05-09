import { useCallback, useEffect, useState } from 'react'
import { AppOperation } from '../../lib/constants/app'

interface Notification {
  type: 'error' | 'warning' | 'info'
  title: string
  message: string
}

export function NotificationProvider() {
  const [notification, setNotification] = useState<Notification | null>(null)

  const dismiss = useCallback(() => setNotification(null), [])

  useEffect(() => {
    const unsub = window.aynite.onAppOperation((operation, data) => {
      if (operation !== AppOperation.SHOW_NOTIFICATION) return
      setNotification(data as Notification)
      setTimeout(dismiss, 5000)
    })
    return unsub
  }, [dismiss])

  if (!notification) return null

  return (
    <div className="fixed top-0 left-0 right-0 z-modal flex justify-center pointer-events-none">
      <button
        className={`mt-2 px-4 py-2 rounded-lg shadow-lg text-sm font-medium pointer-events-auto cursor-pointer border-none ${
          notification.type === 'error'
            ? 'bg-red-600 text-white'
            : notification.type === 'warning'
              ? 'bg-amber-500 text-white'
              : 'bg-blue-600 text-white'
        }`}
        onClick={dismiss}
        type="button"
      >
        <strong>{notification.title}</strong> {notification.message}
      </button>
    </div>
  )
}
