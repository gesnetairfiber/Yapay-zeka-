import React, { useState, useEffect } from 'react';
import { dashboardAPI } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, UserCheck, UserX, Wifi, Package, TrendingUp, AlertCircle } from 'lucide-react';

const Dashboard = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const response = await dashboardAPI.getStats();
      setStats(response.data);
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const statCards = [
    {
      title: 'Toplam Abone',
      value: stats?.total_customers || 0,
      icon: Users,
      color: 'bg-blue-500',
      testId: 'total-customers-stat'
    },
    {
      title: 'Aktif Abone',
      value: stats?.active_customers || 0,
      icon: UserCheck,
      color: 'bg-green-500',
      testId: 'active-customers-stat'
    },
    {
      title: 'Askıda',
      value: stats?.suspended_customers || 0,
      icon: UserX,
      color: 'bg-yellow-500',
      testId: 'suspended-customers-stat'
    },
    {
      title: 'Online',
      value: stats?.online_customers || 0,
      icon: Wifi,
      color: 'bg-emerald-500',
      testId: 'online-customers-stat'
    },
    {
      title: 'Toplam Paket',
      value: stats?.total_packages || 0,
      icon: Package,
      color: 'bg-purple-500',
      testId: 'total-packages-stat'
    },
    {
      title: 'Aylık Gelir',
      value: `₺${(stats?.monthly_revenue || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}`,
      icon: TrendingUp,
      color: 'bg-cyan-500',
      testId: 'monthly-revenue-stat'
    },
    {
      title: 'Bekleyen Ödeme',
      value: `₺${(stats?.pending_payments || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}`,
      icon: AlertCircle,
      color: 'bg-red-500',
      testId: 'pending-payments-stat'
    },
    {
      title: 'Yeni Abone (Bu Ay)',
      value: stats?.new_customers_this_month || 0,
      icon: Users,
      color: 'bg-indigo-500',
      testId: 'new-customers-stat'
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900" data-testid="dashboard-title">Dashboard</h1>
        <p className="text-gray-600 mt-1">ISP yönetim paneline hoş geldiniz</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <Card key={index} data-testid={stat.testId}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">
                  {stat.title}
                </CardTitle>
                <div className={`${stat.color} p-2 rounded-lg`}>
                  <Icon className="h-4 w-4 text-white" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Son İşlemler</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <p className="text-sm text-gray-500">Henüz işlem bulunmuyor</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Bekleyen Görevler</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <p className="text-sm text-gray-500">Henüz görev bulunmuyor</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;
