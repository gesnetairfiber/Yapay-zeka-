import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import {
  LayoutDashboard,
  Users,
  Package,
  FileText,
  ClipboardList,
  HardDrive,
  BarChart3,
  Settings,
  LogOut,
  Menu,
  X
} from 'lucide-react';

const Layout = ({ children }) => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const menuItems = [
    { path: '/', icon: LayoutDashboard, label: 'Dashboard' },
    { path: '/customers', icon: Users, label: 'Aboneler' },
    { path: '/packages', icon: Package, label: 'Paketler' },
    { path: '/invoices', icon: FileText, label: 'Faturalar' },
    { path: '/tasks', icon: ClipboardList, label: 'Görevler' },
    { path: '/devices', icon: HardDrive, label: 'Cihazlar' },
    { path: '/reports', icon: BarChart3, label: 'Raporlar' },
    { path: '/settings', icon: Settings, label: 'Ayarlar' },
  ];

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar */}
      <aside
        className={`${
          sidebarOpen ? 'w-64' : 'w-20'
        } bg-blue-900 text-white transition-all duration-300 flex flex-col`}
      >
        {/* Logo */}
        <div className="p-4 flex items-center justify-between border-b border-blue-800">
          {sidebarOpen ? (
            <h1 className="text-xl font-bold">WiRadius CRM</h1>
          ) : (
            <span className="text-xl font-bold">WR</span>
          )}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-1 hover:bg-blue-800 rounded"
          >
            {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-2">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                  isActive
                    ? 'bg-blue-700 text-white'
                    : 'hover:bg-blue-800 text-blue-100'
                }`}
                data-testid={`nav-${item.label.toLowerCase()}`}
              >
                <Icon size={20} />
                {sidebarOpen && <span>{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* User Info */}
        <div className="p-4 border-t border-blue-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-700 rounded-full flex items-center justify-center">
              <span className="text-sm font-medium">
                {user?.full_name?.charAt(0) || 'A'}
              </span>
            </div>
            {sidebarOpen && (
              <div className="flex-1">
                <p className="text-sm font-medium">{user?.full_name}</p>
                <p className="text-xs text-blue-300">{user?.role}</p>
              </div>
            )}
          </div>
          {sidebarOpen && (
            <Button
              onClick={handleLogout}
              variant="ghost"
              className="w-full mt-3 text-white hover:bg-blue-800"
              data-testid="logout-button"
            >
              <LogOut size={16} className="mr-2" />
              Çıkış Yap
            </Button>
          )}
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <div className="p-8">{children}</div>
      </main>
    </div>
  );
};

export default Layout;
