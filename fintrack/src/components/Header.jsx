import { useCallback, useEffect, useRef, useState } from 'react'
import { Bell, ChevronsLeft, ChevronsRight } from 'lucide-react'
import toast from 'react-hot-toast'
import { api } from '../api'
import { useAppSettings } from '../context/AppSettingsContext'

const NOTIFICATION_CHANGED_EVENT = 'fintrack:notifications-changed'

export default function Header({ title, sidebarCollapsed = false, onToggleSidebar, onOpenNotifications }) {
  const { t, language, setLanguage } = useAppSettings()
  const [unreadCount, setUnreadCount] = useState(0)
  const latestNotificationIdRef = useRef('')
  const bootstrappedRef = useRef(false)
  const lastUnreadCountRef = useRef(0)

  const pushBrowserNotification = (titleText, bodyText) => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return
    }
    if (window.Notification.permission === 'granted') {
      new window.Notification(titleText, { body: bodyText })
    }
  }

  const loadUnreadCount = useCallback(async () => {
    try {
      const res = await api.get(`/notifications?limit=5&page=1&_=${Date.now()}`)
      const data = res?.data || {}
      const count = Number(data.unreadCount || 0)
      const latestItem = Array.isArray(data.items) ? data.items[0] : null
      setUnreadCount(count)

      if (!latestItem?.id) {
        return
      }

      if (!bootstrappedRef.current) {
        latestNotificationIdRef.current = latestItem.id
        lastUnreadCountRef.current = count
        bootstrappedRef.current = true
        return
      }

      if (count <= lastUnreadCountRef.current) {
        lastUnreadCountRef.current = count
        latestNotificationIdRef.current = latestItem.id
        return
      }

      if (latestNotificationIdRef.current === latestItem.id) {
        lastUnreadCountRef.current = count
        return
      }

      lastUnreadCountRef.current = count
      latestNotificationIdRef.current = latestItem.id
      toast.success(latestItem.title, {
        id: `notification-${latestItem.id}`,
        duration: 5000,
      })
      pushBrowserNotification(latestItem.title, latestItem.message)
    } catch {
      setUnreadCount(0)
    }
  }, [])

  useEffect(() => {
    loadUnreadCount()
  }, [loadUnreadCount])

  useEffect(() => {
    const refresh = () => {
      loadUnreadCount()
    }
    const timer = setInterval(refresh, 5000)
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', refresh)
    window.addEventListener(NOTIFICATION_CHANGED_EVENT, refresh)
    return () => {
      clearInterval(timer)
      window.removeEventListener('focus', refresh)
      document.removeEventListener('visibilitychange', refresh)
      window.removeEventListener(NOTIFICATION_CHANGED_EVENT, refresh)
    }
  }, [loadUnreadCount])

  return (
    <header className="sticky top-0 z-30 bg-dark-800/90 backdrop-blur-xl border-b border-gray-700/50">
      <div className="flex items-center justify-between px-4 lg:px-6 py-3">
        <div className="flex items-center gap-2">
          <button
            onClick={onToggleSidebar}
            title={sidebarCollapsed ? t('sidebar.expand') : t('sidebar.collapse')}
            className="hidden lg:inline-flex p-2 rounded-xl text-gray-400 hover:text-gray-200 hover:bg-gray-700/50 transition-colors"
          >
            {sidebarCollapsed ? <ChevronsRight className="w-5 h-5" /> : <ChevronsLeft className="w-5 h-5" />}
          </button>
          <h1 className="text-xl font-bold text-white">{title}</h1>
        </div>
        <div className="flex items-center gap-2">
          <select
            aria-label={t('language.label')}
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className="rounded-lg border border-gray-700 bg-dark-900 px-2.5 py-1.5 text-xs text-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500/30"
          >
            <option value="uz">{t('language.uz')}</option>
            <option value="en">{t('language.en')}</option>
            <option value="ru">{t('language.ru')}</option>
          </select>
          <button
            title={t('header.notifications')}
            onClick={onOpenNotifications}
            className="relative p-2 rounded-xl text-gray-400 hover:text-gray-200 hover:bg-gray-700/50 transition-colors"
          >
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-danger-500 text-[10px] font-semibold text-white flex items-center justify-center">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>
        </div>
      </div>
    </header>
  )
}
