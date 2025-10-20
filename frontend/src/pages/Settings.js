import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Settings as SettingsIcon } from 'lucide-react';

const Settings = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Ayarlar</h1>
        <p className="text-gray-600 mt-1">Sistem ayarları</p>
      </div>
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16">
          <SettingsIcon className="h-16 w-16 text-gray-400 mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Ayarlar Modülü</h3>
          <p className="text-gray-600">Bu modül yakında eklenecek</p>
        </CardContent>
      </Card>
    </div>
  );
};

export default Settings;
