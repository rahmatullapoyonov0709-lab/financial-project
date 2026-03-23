import { useCallback, useEffect, useState } from 'react'
import { Bell, Check, CheckCheck, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { api } from '../api'
import { useAppSettings } from '../context/AppSettingsContext'

const NOTIFICATION_CHANGED_EVENT = 'fintrack:notifications-changed'
const NOTIFICATION_CHANGED_KEY = 'fintrack:notifications:last-change'

const formatDateTime = (value, locale) => {
  if (!value) return ''
  try {
    return new Intl.DateTimeFormat(locale, {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(value))
  } catch {
    return String(value)
  }
}

export default function Notifications() {
  const { t, language } = useAppSettings()
  const locale = language === 'ru' ? 'ru-RU' : language === 'en' ? 'en-US' : 'uz-UZ'
  const [loading, setLoading] = useState(true)
  const [items, setItems] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [markingAll, setMarkingAll] = useState(false)
  const [deletingId, setDeletingId] = useState('')

  const loadNotifications = useCallback(async ({ withLoader = true } = {}) => {
    if (withLoader) setLoading(true)
    try {
      const res = await api.get(`/notifications?limit=100&page=1&_=${Date.now()}`)
      const data = res?.data || {}
      setItems(Array.isArray(data.items) ? data.items : [])
      setUnreadCount(Number(data.unreadCount || 0))
    } catch (error) {
      toast.error(error.message || t('notifications.loadError'))
    } finally {
      if (withLoader) setLoading(false)
    }
  }, [t])

  useEffect(() => {
    loadNotifications({ withLoader: true })
  }, [loadNotifications])

  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === 'visible') {
        loadNotifications({ withLoader: false })
      }
    }
    const onStorage = (event) => {
      if (event.key === NOTIFICATION_CHANGED_KEY) refresh()
    }
    const timer = setInterval(refresh, 5000)
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', refresh)
    window.addEventListener(NOTIFICATION_CHANGED_EVENT, refresh)
    window.addEventListener('storage', onStorage)
    return () => {
      clearInterval(timer)
      window.removeEventListener('focus', refresh)
      document.removeEventListener('visibilitychange', refresh)
      window.removeEventListener(NOTIFICATION_CHANGED_EVENT, refresh)
      window.removeEventListener('storage', onStorage)
    }
  }, [loadNotifications])

  const markAsRead = async (id) => {
    try {
      await api.put(`/notifications/${id}/read`, {})
      setItems((prev) => prev.map((item) => (item.id === id ? { ...item, is_read: true } : item)))
      setUnreadCount((prev) => Math.max(0, prev - 1))
    } catch (error) {
      toast.error(error.message || t('notifications.markReadError'))
    }
  }

  const markAllRead = async () => {
    setMarkingAll(true)
    try {
      await api.put('/notifications/read-all', {})
      setItems((prev) => prev.map((item) => ({ ...item, is_read: true })))
      setUnreadCount(0)
      toast.success(t('notifications.markedAll'))
    } catch (error) {
      toast.error(error.message || t('notifications.markReadError'))
    } finally {
      setMarkingAll(false)
    }
  }

  const deleteNotification = async (id, isRead) => {
    setDeletingId(id)
    try {
      await api.delete(`/notifications/${id}`)
      setItems((prev) => prev.filter((item) => item.id !== id))
      if (!isRead) {
        setUnreadCount((prev) => Math.max(0, prev - 1))
      }
      toast.success(t('notifications.deleted'))
    } catch (error) {
      toast.error(error.message || t('notifications.deleteError'))
    } finally {
      setDeletingId('')
    }
  }

  if (loading) {
    return (
      <div className="p-6 flex justify-center">
        <div className="w-8 h-8 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="p-4 lg:p-6 space-y-4">
      <div className="bg-dark-800 rounded-2xl border border-gray-700/50 p-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-white">{t('notifications.title')}</h2>
          <p className="text-sm text-gray-400 mt-1">{t('notifications.subtitle', { count: unreadCount })}</p>
        </div>
        <button
          onClick={markAllRead}
          disabled={markingAll || unreadCount === 0}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-success-500/40 bg-success-500/10 text-success-400 hover:bg-success-500/20 text-sm font-medium transition-colors disabled:opacity-50"
        >
          <CheckCheck className="w-4 h-4" />
          {markingAll ? t('common.loading') : t('notifications.markAll')}
        </button>
      </div>

      {items.length === 0 ? (
        <div className="bg-dark-800 rounded-2xl border border-gray-700/50 p-10 text-center">
          <Bell className="w-10 h-10 text-gray-500 mx-auto mb-3" />
          <p className="text-sm text-gray-400">{t('notifications.empty')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <article
              key={item.id}
              className={`rounded-2xl border p-4 transition-colors ${
                item.is_read
                  ? 'bg-dark-800 border-gray-700/50'
                  : 'bg-primary-500/5 border-primary-500/25'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className={`text-sm font-semibold ${item.is_read ? 'text-gray-200' : 'text-primary-300'}`}>
                    {item.title}
                  </h3>
                  <p className="text-xs text-gray-500 mt-1">{formatDateTime(item.created_at, locale)}</p>
                </div>
                <div className="flex items-center gap-2">
                  {!item.is_read && (
                    <button
                      onClick={() => markAsRead(item.id)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-gray-700 text-gray-300 hover:bg-gray-700/40 text-xs transition-colors"
                    >
                      <Check className="w-3.5 h-3.5" />
                      {t('notifications.markOne')}
                    </button>
                  )}
                  <button
                    onClick={() => deleteNotification(item.id, item.is_read)}
                    disabled={deletingId === item.id}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-danger-500/30 text-danger-400 hover:bg-danger-500/10 text-xs transition-colors disabled:opacity-50"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    {deletingId === item.id ? t('common.loading') : t('common.delete')}
                  </button>
                </div>
              </div>
              <p className="text-sm text-gray-300 whitespace-pre-line mt-3">{item.message}</p>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}
