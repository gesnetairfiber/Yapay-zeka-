import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { HardDrive } from 'lucide-react';

const Devices = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Cihazlar</h1>
        <p className="text-gray-600 mt-1">Modem ve router yönetimi</p>
      </div>
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16">
          <HardDrive className="h-16 w-16 text-gray-400 mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Cihazlar Modülü</h3>
          <p className="text-gray-600">Bu modül yakında eklenecek</p>
        </CardContent>
      </Card>
    </div>
  );
};

export default Devices;
