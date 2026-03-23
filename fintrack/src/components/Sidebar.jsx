import { LayoutDashboard, Wallet, ArrowUpDown, ArrowLeftRight, Receipt, PiggyBank, BarChart3, FileText, Bell, LogOut, Landmark, Settings, Users } from 'lucide-react'
import { useAppSettings } from '../context/AppSettingsContext'

const NAV = [
  { id: 'dashboard', icon: LayoutDashboard, labelKey: 'nav.dashboard' },
  { id: 'family', icon: Users, labelKey: 'nav.family' },
  { id: 'accounts', icon: Wallet, labelKey: 'nav.accounts' },
  { id: 'transactions', icon: ArrowUpDown, labelKey: 'nav.transactions' },
  { id: 'transfers', icon: ArrowLeftRight, labelKey: 'nav.transfers' },
  { id: 'debts', icon: Receipt, labelKey: 'nav.debts' },
  { id: 'budget', icon: PiggyBank, labelKey: 'nav.budget' },
  { id: 'analytics', icon: BarChart3, labelKey: 'nav.analytics' },
  { id: 'report', icon: FileText, labelKey: 'nav.report' },
  { id: 'notifications', icon: Bell, labelKey: 'nav.notifications' },
  { id: 'settings', icon: Settings, labelKey: 'nav.settings' },
]

export default function Sidebar({ page, setPage, onLogout, user, collapsed = false }) {
  const { t } = useAppSettings()

  return (
    <aside className={`hidden lg:flex flex-col fixed left-0 top-0 bottom-0 bg-dark-800 border-r border-gray-700/50 z-40 transition-[width] duration-200 ease-in-out overflow-hidden ${collapsed ? 'w-20' : 'w-64'}`}>
      <div className={`border-b border-gray-700/50 ${collapsed ? 'px-3 py-5' : 'px-6 py-6'}`}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-purple-500 flex items-center justify-center shadow-lg shadow-primary-500/30 shrink-0">
            <Landmark className="w-5 h-5 text-white" />
          </div>
          <div className={`overflow-hidden whitespace-nowrap transition-[max-width,opacity] duration-200 ease-in-out ${collapsed ? 'max-w-0 opacity-0' : 'max-w-[180px] opacity-100'}`}>
            <h1 className="text-lg font-bold text-white">{t('app.name')}</h1>
            <p className="text-[10px] text-gray-400 -mt-0.5">{t('app.tagline')}</p>
          </div>
        </div>
      </div>

      <nav className={`flex-1 py-4 space-y-1 overflow-y-auto ${collapsed ? 'px-2' : 'px-3'}`}>
        {NAV.map((item) => (
          <button
            key={item.id}
            onClick={() => setPage(item.id)}
            title={collapsed ? t(item.labelKey) : undefined}
            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors duration-150
              ${collapsed ? 'justify-center px-2' : ''}
              ${page === item.id
                ? 'bg-primary-500/10 text-primary-400 shadow-sm'
                : 'text-gray-400 hover:bg-gray-700/50 hover:text-white'
              }`}
          >
            <item.icon className="w-5 h-5" />
            <span className={`overflow-hidden whitespace-nowrap transition-[max-width,opacity] duration-150 ease-in-out ${collapsed ? 'max-w-0 opacity-0' : 'max-w-[140px] opacity-100'}`}>
              {t(item.labelKey)}
            </span>
          </button>
        ))}
      </nav>

      <div className={`border-t border-gray-700/50 ${collapsed ? 'px-2 py-3' : 'px-3 py-4'}`}>
        <div className={`rounded-xl bg-gray-700/30 ${collapsed ? 'p-2 flex items-center justify-center' : 'flex items-center gap-3 px-4 py-3'}`}>
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary-400 to-purple-500 flex items-center justify-center text-white text-sm font-bold">
            {user?.name?.charAt(0)?.toUpperCase() || 'U'}
          </div>
          <div className={`flex-1 min-w-0 overflow-hidden whitespace-nowrap transition-[max-width,opacity] duration-200 ease-in-out ${collapsed ? 'max-w-0 opacity-0' : 'max-w-[150px] opacity-100'}`}>
            <p className="text-sm font-medium text-white truncate">{user?.name || t('settings.account.name')}</p>
            <p className="text-[11px] text-gray-400 truncate">{user?.email || ''}</p>
          </div>
          <button onClick={onLogout} title={t('settings.account.logout')} className="p-1.5 rounded-lg text-gray-400 hover:text-danger-500 hover:bg-danger-500/10 transition-colors">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  )
}
