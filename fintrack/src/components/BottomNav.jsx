import { LayoutDashboard, ArrowUpDown, BarChart3, Wallet, Menu } from 'lucide-react'
import { useAppSettings } from '../context/AppSettingsContext'

export default function BottomNav({ page, setPage }) {
  const { t } = useAppSettings()

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-dark-800/95 backdrop-blur-xl border-t border-gray-700/50">
      <div className="flex items-center justify-around px-2 py-1">
        {[
          { id: 'dashboard', icon: LayoutDashboard, label: t('nav.home') },
          { id: 'transactions', icon: ArrowUpDown, label: t('nav.actions') },
          { id: 'analytics', icon: BarChart3, label: t('nav.analysis') },
          { id: 'accounts', icon: Wallet, label: t('nav.accounts') },
        ].map(item => (
          <button key={item.id} onClick={() => setPage(item.id)}
            className={`flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl text-[10px] font-medium min-w-[60px] transition-colors ${page === item.id ? 'text-primary-400' : 'text-gray-500'}`}>
            <item.icon className="w-5 h-5" />
            <span>{item.label}</span>
          </button>
        ))}
        <button onClick={() => setPage('budget')}
          className={`flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl text-[10px] font-medium min-w-[60px] transition-colors ${['budget', 'debts', 'transfers', 'report', 'notifications', 'settings', 'family'].includes(page) ? 'text-primary-400' : 'text-gray-500'}`}>
          <Menu className="w-5 h-5" />
          <span>{t('nav.more')}</span>
        </button>
      </div>
    </nav>
  )
}
