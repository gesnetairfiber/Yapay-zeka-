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
  X,
  ChevronDown,
  ChevronRight,
  DollarSign,
  Phone,
  Wifi,
  MessageSquare
} from 'lucide-react';

const Layout = ({ children }) => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [expandedCategories, setExpandedCategories] = useState(['abone', 'muhasebe', 'cihaz']);

  // Kategorili menü yapısı - WiRadius tarzı
  const menuCategories = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: LayoutDashboard,
      path: '/',
      single: true
    },
    {
      id: 'abone',
      label: 'ABONE İŞLEMLERİ',
      icon: Users,
      items: [
        { path: '/customers', label: 'Abone Listesi', testId: 'nav-aboneler' },
        { path: '/packages', label: 'Paket Yönetimi', testId: 'nav-paketler' }
      ]
    },
    {
      id: 'muhasebe',
      label: 'MUHASEBE İŞLEMLERİ',
      icon: FileText,
      items: [
        { path: '/invoices', label: 'Fatura İşlemleri', testId: 'nav-faturalar' },
        { path: '/payments', label: 'Ödeme Takibi', testId: 'nav-odemeler' },
        { path: '/accounting', label: 'Kasa İşlemleri', badge: 'Yakında' }
      ]
    },
    {
      id: 'cihaz',
      label: 'CİHAZ İŞLEMLERİ',
      icon: HardDrive,
      items: [
        { path: '/devices', label: 'Cihaz Listesi', testId: 'nav-cihazlar' },
        { path: '/pop-points', label: 'Pop Noktaları', badge: 'Yakında' },
        { path: '/ip-management', label: 'IP Yönetimi', badge: 'Yakında' }
      ]
    },
    {
      id: 'tasks',
      label: 'İŞ EMİRLERİ',
      icon: ClipboardList,
      items: [
        { path: '/tasks', label: 'İş Emri Listesi', testId: 'nav-görevler' },
        { path: '/faults', label: 'Arıza Kayıtları', badge: 'Yakında' },
        { path: '/tech-service', label: 'Teknik Servis', badge: 'Yakında' }
      ]
    },
    {
      id: 'reports',
      label: 'RAPORLAR',
      icon: BarChart3,
      items: [
        { path: '/reports', label: 'Dashboard Raporları', testId: 'nav-raporlar' },
        { path: '/reports/customers', label: 'Abone Raporları', badge: 'Yakında' },
        { path: '/reports/revenue', label: 'Gelir Raporları', badge: 'Yakında' }
      ]
    },
    {
      id: 'collections',
      label: 'TAHSİLAT İŞLEMLERİ',
      icon: DollarSign,
      items: [
        { path: '/collections/pos', label: 'POS İşlemleri', badge: 'Yakında' },
        { path: '/collections/virtual-pos', label: 'Sanal POS', badge: 'Yakında' }
      ]
    },
    {
      id: 'iss',
      label: 'ISS İŞLEMLERİ',
      icon: Wifi,
      items: [
        { path: '/iss/forms', label: 'Abone Formları', badge: 'Yakında' },
        { path: '/iss/campaigns', label: 'Kampanyalar', badge: 'Yakında' },
        { path: '/iss/sms', label: 'Toplu SMS', badge: 'Yakında' }
      ]
    },
    {
      id: 'call',
      label: 'ÇAĞRI YÖNETİMİ',
      icon: Phone,
      items: [
        { path: '/calls', label: 'Çağrı Listesi', badge: 'Yakında' },
        { path: '/phone-book', label: 'Telefon Rehberi', badge: 'Yakında' }
      ]
    },
    {
      id: 'settings',
      label: 'AYARLAR',
      icon: Settings,
      path: '/settings',
      single: true,
      testId: 'nav-ayarlar'
    }
  ];

  const toggleCategory = (categoryId) => {
    setExpandedCategories(prev => 
      prev.includes(categoryId)
        ? prev.filter(id => id !== categoryId)
        : [...prev, categoryId]
    );
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const isPathActive = (path) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar */}
      <aside
        className={`${
          sidebarOpen ? 'w-64' : 'w-20'
        } bg-blue-900 text-white transition-all duration-300 flex flex-col overflow-y-auto`}
      >
        {/* Logo */}
        <div className="p-4 flex items-center justify-between border-b border-blue-800 sticky top-0 bg-blue-900 z-10">
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
        <nav className="flex-1 p-4 space-y-1">
          {menuCategories.map((category) => {
            const Icon = category.icon;
            const isExpanded = expandedCategories.includes(category.id);
            
            // Single item (no submenu)
            if (category.single) {
              const isActive = isPathActive(category.path);
              return (
                <Link
                  key={category.id}
                  to={category.path}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                    isActive
                      ? 'bg-blue-700 text-white'
                      : 'hover:bg-blue-800 text-blue-100'
                  }`}
                  data-testid={category.testId}
                >
                  <Icon size={20} />
                  {sidebarOpen && <span>{category.label}</span>}
                </Link>
              );
            }

            // Category with submenu
            return (
              <div key={category.id} className="space-y-1">
                <button
                  onClick={() => toggleCategory(category.id)}
                  className={`flex items-center justify-between w-full px-3 py-2 rounded-lg transition-colors hover:bg-blue-800 text-blue-100`}
                >
                  <div className="flex items-center gap-3">
                    <Icon size={20} />
                    {sidebarOpen && <span className="text-xs font-semibold">{category.label}</span>}
                  </div>
                  {sidebarOpen && (
                    isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />
                  )}
                </button>

                {/* Submenu items */}
                {sidebarOpen && isExpanded && (
                  <div className="ml-4 space-y-1 border-l-2 border-blue-700 pl-2">
                    {category.items.map((item, idx) => {
                      const isActive = item.path && isPathActive(item.path);
                      const isDisabled = !!item.badge;
                      
                      if (isDisabled) {
                        return (
                          <div
                            key={idx}
                            className="flex items-center justify-between px-3 py-2 text-blue-300 text-sm cursor-not-allowed opacity-60"
                          >
                            <span>{item.label}</span>
                            <span className="text-xs bg-blue-800 px-2 py-0.5 rounded">{item.badge}</span>
                          </div>
                        );
                      }

                      return (
                        <Link
                          key={idx}
                          to={item.path}
                          className={`flex items-center px-3 py-2 rounded text-sm transition-colors ${
                            isActive
                              ? 'bg-blue-700 text-white font-medium'
                              : 'hover:bg-blue-800 text-blue-100'
                          }`}
                          data-testid={item.testId}
                        >
                          {item.label}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* User Info */}
        <div className="p-4 border-t border-blue-800 sticky bottom-0 bg-blue-900">
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
