import { Button } from '../shared/basic/Button'
import { useApp } from './AppContext'

export function NotificationProvider() {
  const { activeNotification: notification, dismissNotification: dismiss } =
    useApp()

  if (!notification) return null

  return (
    <div className="fixed top-0 left-0 right-0 z-modal flex justify-center pointer-events-none">
      <Button
        variant="ghost"
        className={`mt-2 px-4 py-2 rounded-lg shadow-lg text-sm font-medium pointer-events-auto cursor-pointer border-none h-auto hover:bg-opacity-90 ${
          notification.type === 'error'
            ? 'bg-red-600 text-white hover:bg-red-700'
            : notification.type === 'warning'
              ? 'bg-amber-500 text-white hover:bg-amber-600'
              : 'bg-blue-600 text-white hover:bg-blue-700'
        }`}
        onClick={dismiss}
      >
        <strong>{notification.title}</strong> {notification.message}
      </Button>
    </div>
  )
}
