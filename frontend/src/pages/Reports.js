import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { BarChart3 } from 'lucide-react';

const Reports = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Raporlar</h1>
        <p className="text-gray-600 mt-1">Detaylı analiz ve raporlar</p>
      </div>
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16">
          <BarChart3 className="h-16 w-16 text-gray-400 mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Raporlar Modülü</h3>
          <p className="text-gray-600">Bu modül yakında eklenecek</p>
        </CardContent>
      </Card>
    </div>
  );
};

export default Reports;
