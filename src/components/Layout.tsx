/**
 * Main layout component with header and sidebar navigation
 */

import { useState, ReactNode } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/router';
import { useAuth } from '@/hooks/useAuth';
import {
  LayoutDashboard,
  Users,
  PiggyBank,
  CreditCard,
  DollarSign,
  Settings,
  Menu,
  X,
  LogOut,
  MessageSquare,
} from 'lucide-react';
import { useEffect } from 'react';

interface LayoutProps {
  children: ReactNode;
}

const navItems = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard, color: 'bg-primary' },
  { path: '/members', label: 'Member', icon: Users, color: 'bg-secondary' },
  { path: '/savings', label: 'Saving', icon: PiggyBank, color: 'bg-success' },
  { path: '/loans', label: 'Loan', icon: CreditCard, color: 'bg-warning' },
  { path: '/payments', label: 'Payment', icon: DollarSign, color: 'bg-info' },
  { path: '/settings', label: 'Setting', icon: Settings, color: 'bg-accent' },
];

export default function Layout({ children }: LayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const router = useRouter();
  const { user, logout } = useAuth();

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        if (!user) { setUnread(0); return; }
        const token = localStorage.getItem('token');
        const res = await fetch('/api/chat/get', { headers: token ? { Authorization: `Bearer ${token}` } : {} });
        if (!res.ok) return;
        const data = await res.json();
        if (!mounted) return;
        const count = Array.isArray(data)
          ? data.filter((m: any) => m.sender !== user.userId && !(m.seenBy || []).includes(user.userId)).length
          : 0;
        setUnread(count);
      } catch (e) {
        console.error(e);
      }
    };

    load();
    const id = setInterval(load, 10000);
    return () => { mounted = false; clearInterval(id); };
  }, []);

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  return (
    <div className="min-h-screen bg-gray-50 w-full overflow-x-hidden">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-40 w-full">
        <div className="flex items-center justify-between px-3 sm:px-4 py-3 gap-2">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="lg:hidden p-2 rounded-lg hover:bg-gray-100 active:bg-gray-200 flex-shrink-0 touch-manipulation"
              aria-label="Toggle menu"
            >
              {sidebarOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
            <Link href="/" className="flex items-center gap-2 min-w-0 flex-1">
              <Image
                src="/logo.svg"
                alt="Shree Thaleshwor Mahadev Yuwa Samuh"
                width={36}
                height={36}
                priority
                className="flex-shrink-0"
              />
              <h1 className="text-base sm:text-lg md:text-xl font-bold text-gray-800 truncate">
                <span className="hidden sm:inline">Shree Thaleshwor Mahadev Yuwa Samuh</span>
                <span className="sm:hidden">STMYS</span>
              </h1>
            </Link>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
            <div className="text-right hidden md:block">
              <div className="text-sm font-medium text-gray-700">{user?.userId}</div>
              <div className="text-xs text-gray-500">{user?.role}</div>
            </div>
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white font-semibold flex-shrink-0">
              {user?.userId?.[0]?.toUpperCase() || 'U'}
            </div>
            <button
              onClick={handleLogout}
              className="p-2 rounded-lg hover:bg-gray-100 active:bg-gray-200 text-gray-600 touch-manipulation"
              title="Logout"
              aria-label="Logout"
            >
              <LogOut size={20} />
            </button>
          </div>
        </div>
      </header>

      <div className="flex w-full">
        {/* Sidebar */}
        <aside
          className={`
            fixed lg:sticky top-[64px] left-0 h-[calc(100vh-4rem)] w-64 bg-white shadow-lg z-30
            transform transition-transform duration-300 ease-in-out
            ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
            overflow-y-auto
          `}
        >
          <nav className="p-3 sm:p-4 space-y-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = router.pathname === item.path;
              
              return (
                <Link
                  key={item.path}
                  href={item.path}
                  onClick={() => setSidebarOpen(false)}
                  className={`
                    flex items-center gap-3 px-4 py-3 rounded-lg transition-all touch-manipulation
                    min-h-[48px] active:scale-95
                    ${isActive 
                      ? `${item.color} text-white shadow-md` 
                      : 'text-gray-700 hover:bg-gray-100 active:bg-gray-200'
                    }
                  `}
                >
                  <Icon size={20} className="flex-shrink-0" />
                  <span className="font-medium">{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </aside>

        {/* Floating chat button */}
        <button
          onClick={() => router.push('/chat')}
          title="Open chat"
          className="fixed right-4 top-[72px] z-50 bg-indigo-600 text-white p-3 rounded-full shadow-lg hover:scale-105 active:scale-95 transition-transform"
          aria-label="Open chat"
        >
          <MessageSquare size={20} />
          {unread > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-semibold w-5 h-5 rounded-full flex items-center justify-center">{unread}</span>
          )}
        </button>

        {/* Overlay for mobile */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black bg-opacity-50 z-20 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Main content */}
        <main className="flex-1 w-full min-w-0 p-3 sm:p-4 lg:p-6">
          <div className="w-full max-w-full overflow-x-hidden">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

