import { NavLink } from 'react-router-dom';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { useTranslation } from 'react-i18next';
import {
  LayoutDashboard, BookOpen, ClipboardList, FileText, BarChart2,
  Users, FolderOpen, Calendar, Trophy, Star, Settings,
  GraduationCap, BookMarked, UserCheck, Upload, Mic, Wallet, UserCog, Inbox, Building2,
  PieChart, Receipt, UserPlus,
} from 'lucide-react';
import { cn } from '../../utils/cn';
import { getLevelProgress } from '../../utils/format';

const studentLinks = [
  { to: '/student/dashboard', icon: LayoutDashboard, key: 'dashboard' },
  { to: '/student/lessons', icon: BookOpen, key: 'lessons' },
  { to: '/student/homework', icon: ClipboardList, key: 'homework' },
  { to: '/student/tests', icon: FileText, key: 'tests' },
  { to: '/student/results', icon: BarChart2, key: 'results' },
  { to: '/student/resources', icon: FolderOpen, key: 'resources' },
  { to: '/student/attendance', icon: UserCheck, key: 'attendance' },
  { to: '/student/achievements', icon: Trophy, key: 'achievements' },
  { to: '/student/leaderboard', icon: Star, key: 'leaderboard' },
  { to: '/student/analytics', icon: BarChart2, key: 'analytics' },
];

const teacherLinks = [
  { to: '/teacher/dashboard', icon: LayoutDashboard, key: 'dashboard' },
  { to: '/teacher/groups', icon: Users, key: 'groups' },
  { to: '/teacher/students', icon: GraduationCap, key: 'students' },
  { to: '/teacher/lessons', icon: BookOpen, key: 'lessons' },
  { to: '/teacher/homework', icon: ClipboardList, key: 'homework' },
  { to: '/teacher/tests', icon: FileText, key: 'tests' },
  { to: '/teacher/attendance', icon: Calendar, key: 'attendance' },
  { to: '/teacher/resources', icon: Upload, key: 'resources' },
  { to: '/teacher/voice', icon: Mic, key: 'voice' },
  { to: '/teacher/analytics', icon: BarChart2, key: 'analytics' },
];

const adminLinks = [
  { to: '/admin/dashboard', icon: LayoutDashboard, key: 'dashboard' },
  { to: '/admin/applications', icon: Inbox, key: 'applications' },
  { to: '/leads', icon: UserPlus, key: 'leads', label: 'Lidlar' },
  { to: '/admin/branches', icon: Building2, key: 'branches' },
  { to: '/admin/managers', icon: UserCheck, key: 'managers' },
  { to: '/finance', icon: PieChart, key: 'finance', label: 'Moliya' },
  { to: '/finance/payroll', icon: Receipt, key: 'payroll', label: 'Ish haqi' },
  { to: '/admin/settings', icon: Settings, key: 'settings' },
];

const managerLinks = [
  { to: '/manager/dashboard', icon: LayoutDashboard, key: 'dashboard' },
  { to: '/leads', icon: UserPlus, key: 'leads', label: 'Lidlar' },
  { to: '/manager/branches', icon: Building2, key: 'branches' },
  { to: '/manager/reception', icon: UserCog, key: 'reception' },
  { to: '/manager/teachers', icon: BookMarked, key: 'teachers' },
  { to: '/manager/groups', icon: Users, key: 'groups' },
  { to: '/manager/students', icon: GraduationCap, key: 'students' },
  { to: '/finance', icon: PieChart, key: 'finance', label: 'Moliya' },
  { to: '/finance/payroll', icon: Receipt, key: 'payroll', label: 'Ish haqi' },
  { to: '/manager/settings', icon: Settings, key: 'settings' },
];

const receptionLinks = [
  { to: '/reception/dashboard', icon: LayoutDashboard, key: 'dashboard' },
  { to: '/reception/teachers', icon: BookMarked, key: 'teachers' },
  { to: '/reception/groups', icon: Users, key: 'groups' },
  { to: '/reception/students', icon: GraduationCap, key: 'students' },
  { to: '/reception/payments', icon: Wallet, key: 'payments' },
  { to: '/leads', icon: UserPlus, key: 'leads', label: 'Lidlar' },
  { to: '/finance', icon: PieChart, key: 'finance', label: 'Moliya' },
  { to: '/reception/settings', icon: Settings, key: 'settings' },
];

export default function Sidebar({ isOpen, onClose }) {
  const { user } = useAuthStore();
  const { t } = useTranslation();
  const links = user?.role === 'student' ? studentLinks
    : user?.role === 'teacher' ? teacherLinks
    : user?.role === 'reception' ? receptionLinks
    : user?.role === 'manager' ? managerLinks
    : adminLinks;
  const { level, progress } = getLevelProgress(user?.xp || 0);

  return (
    <aside
      className={cn(
        'w-64 flex-shrink-0 bg-white dark:bg-gray-900 border-r border-gray-100 dark:border-gray-800 flex flex-col h-full overflow-hidden',
        'fixed inset-y-0 left-0 z-40 transition-transform duration-300 ease-in-out',
        'md:relative md:translate-x-0',
        isOpen ? 'translate-x-0' : '-translate-x-full'
      )}
    >
      {/* Logo */}
      <div className="p-5 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 gradient-bg rounded-xl flex items-center justify-center text-white font-bold text-sm shadow-glow">A</div>
          <div>
            <div className="font-bold text-gray-900 dark:text-white text-sm">{t('app_name')}</div>
            <div className="text-xs text-gray-400">
              {user?.role === 'student' ? 'Student' : user?.role === 'teacher' ? 'Teacher' : user?.role === 'reception' ? 'Reception' : user?.role === 'manager' ? 'Manager' : 'Admin'}
            </div>
          </div>
        </div>
        {/* Mobile close button */}
        <button
          onClick={onClose}
          className="md:hidden p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500"
        >
          <X size={18} />
        </button>
      </div>

      {/* User card */}
      <div className="p-4 border-b border-gray-100 dark:border-gray-800">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 gradient-bg rounded-full flex items-center justify-center text-white font-semibold text-sm">
            {(user?.name || 'U').charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-gray-800 dark:text-white text-sm truncate">{user?.name}</div>
            <div className="text-xs text-gray-400 truncate">@{user?.username}</div>
          </div>
        </div>
        {user?.role === 'student' && (
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-gray-500">{t('level')} {level}</span>
              <span className="text-primary font-semibold">{user?.xp || 0} XP</span>
            </div>
            <div className="h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 1, ease: 'easeOut' }}
                className="h-full gradient-bg rounded-full"
              />
            </div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-3 space-y-0.5">
        {links.map(({ to, icon: Icon, key, label }, i) => (
          <motion.div
            key={to}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.04 }}
          >
            <NavLink
              to={to}
              end={to === '/finance'}
              onClick={onClose}
              className={({ isActive }) => cn('sidebar-link', isActive && 'active')}
            >
              <Icon size={16} />
              <span>{label || (user?.role === 'manager' && key === 'branches' ? 'Filiallar' : t(key))}</span>
            </NavLink>
          </motion.div>
        ))}
      </nav>

      {/* Bottom */}
      <div className="p-4 border-t border-gray-100 dark:border-gray-800">
        {user?.role === 'student' && (
          <div className="flex gap-3 text-xs text-center mb-3">
            <div className="flex-1 bg-surface dark:bg-gray-800 rounded-xl p-2">
              <div className="font-bold text-primary">{user?.streak?.current || 0}</div>
              <div className="text-gray-500">{t('streak')}</div>
            </div>
            <div className="flex-1 bg-surface dark:bg-gray-800 rounded-xl p-2">
              <div className="font-bold text-secondary">{user?.coins || 0}</div>
              <div className="text-gray-500">{t('coins')}</div>
            </div>
          </div>
        )}
        <div className="text-xs text-center text-gray-400">
          © 2026 {t('app_name')}
        </div>
      </div>
    </aside>
  );
}
