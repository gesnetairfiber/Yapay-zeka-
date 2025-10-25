import React, { useState, useEffect } from 'react';
import { deviceAPI, customerAPI } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Plus, Search, Edit, Trash2, UserPlus, UserMinus, Loader2, HardDrive } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const Devices = () => {
  const [devices, setDevices] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [isDeviceDialogOpen, setIsDeviceDialogOpen] = useState(false);
  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false);
  const [editingDevice, setEditingDevice] = useState(null);
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [formData, setFormData] = useState({
    device_type: 'modem',
    brand: '',
    model: '',
    serial_number: '',
    mac_address: '',
    purchase_date: '',
    purchase_price: '',
    notes: ''
  });
  const [assignData, setAssignData] = useState({
    customer_id: ''
  });
  const { toast } = useToast();

  useEffect(() => {
    fetchDevices();
    fetchCustomers();
  }, [searchTerm, statusFilter, typeFilter]);

  const fetchDevices = async () => {
    try {
      const params = {};
      if (searchTerm) params.search = searchTerm;
      if (statusFilter) params.status = statusFilter;
      if (typeFilter) params.device_type = typeFilter;
      
      const response = await deviceAPI.getAll(params);
      setDevices(response.data);
    } catch (error) {
      toast({
        title: 'Hata',
        description: 'Cihazlar yüklenemedi',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchCustomers = async () => {
    try {
      const response = await customerAPI.getAll({ status: 'active' });
      setCustomers(response.data);
    } catch (error) {
      console.error('Müşteriler yüklenemedi:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const data = {
        ...formData,
        purchase_price: formData.purchase_price ? parseFloat(formData.purchase_price) : null,
        purchase_date: formData.purchase_date ? new Date(formData.purchase_date).toISOString() : null
      };

      if (editingDevice) {
        await deviceAPI.update(editingDevice.id, data);
        toast({
          title: 'Başarılı',
          description: 'Cihaz güncellendi'
        });
      } else {
        await deviceAPI.create(data);
        toast({
          title: 'Başarılı',
          description: 'Yeni cihaz eklendi'
        });
      }
      setIsDeviceDialogOpen(false);
      resetForm();
      fetchDevices();
    } catch (error) {
      toast({
        title: 'Hata',
        description: error.response?.data?.detail || 'İşlem başarısız',
        variant: 'destructive'
      });
    }
  };

  const handleAssign = async (e) => {
    e.preventDefault();
    try {
      await deviceAPI.assign(selectedDevice.id, assignData);
      toast({
        title: 'Başarılı',
        description: 'Cihaz müşteriye atandı'
      });
      setIsAssignDialogOpen(false);
      setSelectedDevice(null);
      resetAssignForm();
      fetchDevices();
    } catch (error) {
      toast({
        title: 'Hata',
        description: error.response?.data?.detail || 'Atama başarısız',
        variant: 'destructive'
      });
    }
  };

  const handleUnassign = async (deviceId) => {
    if (!window.confirm('Cihaz atamasını kaldırmak istediğinize emin misiniz?')) return;
    
    try {
      await deviceAPI.unassign(deviceId);
      toast({
        title: 'Başarılı',
        description: 'Cihaz atama kaldırıldı'
      });
      fetchDevices();
    } catch (error) {
      toast({
        title: 'Hata',
        description: 'Atama kaldırılamadı',
        variant: 'destructive'
      });
    }
  };

  const handleEdit = (device) => {
    setEditingDevice(device);
    setFormData({
      device_type: device.device_type,
      brand: device.brand,
      model: device.model,
      serial_number: device.serial_number,
      mac_address: device.mac_address || '',
      purchase_date: device.purchase_date ? new Date(device.purchase_date).toISOString().split('T')[0] : '',
      purchase_price: device.purchase_price ? device.purchase_price.toString() : '',
      notes: device.notes || ''
    });
    setIsDeviceDialogOpen(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Bu cihazı silmek istediğinize emin misiniz?')) return;
    
    try {
      await deviceAPI.delete(id);
      toast({
        title: 'Başarılı',
        description: 'Cihaz silindi'
      });
      fetchDevices();
    } catch (error) {
      toast({
        title: 'Hata',
        description: error.response?.data?.detail || 'Silme işlemi başarısız',
        variant: 'destructive'
      });
    }
  };

  const openAssignDialog = (device) => {
    setSelectedDevice(device);
    setIsAssignDialogOpen(true);
  };

  const resetForm = () => {
    setFormData({
      device_type: 'modem',
      brand: '',
      model: '',
      serial_number: '',
      mac_address: '',
      purchase_date: '',
      purchase_price: '',
      notes: ''
    });
    setEditingDevice(null);
  };

  const resetAssignForm = () => {
    setAssignData({
      customer_id: ''
    });
  };

  const getStatusBadge = (status) => {
    const variants = {
      in_stock: { color: 'bg-blue-100 text-blue-800', label: 'Depoda' },
      assigned: { color: 'bg-green-100 text-green-800', label: 'Kullanımda' },
      faulty: { color: 'bg-red-100 text-red-800', label: 'Arızalı' },
      retired: { color: 'bg-gray-100 text-gray-800', label: 'Hurdaya Ayrıldı' }
    };
    const variant = variants[status] || variants.in_stock;
    return <Badge className={variant.color}>{variant.label}</Badge>;
  };

  const getDeviceTypeLabel = (type) => {
    const types = {
      modem: 'Modem',
      router: 'Router',
      ont: 'ONT',
      switch: 'Switch'
    };
    return types[type] || type;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900" data-testid="devices-title">Cihaz Yönetimi</h1>
          <p className="text-gray-600 mt-1">Modem, router ve cihaz takibi</p>
        </div>
        <Dialog open={isDeviceDialogOpen} onOpenChange={setIsDeviceDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={resetForm} data-testid="add-device-button">
              <Plus className="mr-2 h-4 w-4" />
              Yeni Cihaz
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{editingDevice ? 'Cihaz Düzenle' : 'Yeni Cihaz Ekle'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="device_type">Cihaz Tipi *</Label>
                  <select
                    id="device_type"
                    value={formData.device_type}
                    onChange={(e) => setFormData({ ...formData, device_type: e.target.value })}
                    className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
                    required
                    data-testid="device-type-select"
                  >
                    <option value="modem">Modem</option>
                    <option value="router">Router</option>
                    <option value="ont">ONT</option>
                    <option value="switch">Switch</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="brand">Marka *</Label>
                  <Input
                    id="brand"
                    value={formData.brand}
                    onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                    required
                    placeholder="Örn: TP-Link, Zyxel"
                    data-testid="device-brand-input"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="model">Model *</Label>
                  <Input
                    id="model"
                    value={formData.model}
                    onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                    required
                    placeholder="Örn: Archer C6"
                    data-testid="device-model-input"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="serial_number">Seri No *</Label>
                  <Input
                    id="serial_number"
                    value={formData.serial_number}
                    onChange={(e) => setFormData({ ...formData, serial_number: e.target.value })}
                    required
                    disabled={!!editingDevice}
                    data-testid="device-serial-input"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="mac_address">MAC Adresi</Label>
                <Input
                  id="mac_address"
                  value={formData.mac_address}
                  onChange={(e) => setFormData({ ...formData, mac_address: e.target.value })}
                  placeholder="Örn: 00:1A:2B:3C:4D:5E"
                  data-testid="device-mac-input"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="purchase_date">Satın Alma Tarihi</Label>
                  <Input
                    id="purchase_date"
                    type="date"
                    value={formData.purchase_date}
                    onChange={(e) => setFormData({ ...formData, purchase_date: e.target.value })}
                    data-testid="device-purchase-date-input"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="purchase_price">Satın Alma Fiyatı (₺)</Label>
                  <Input
                    id="purchase_price"
                    type="number"
                    step="0.01"
                    value={formData.purchase_price}
                    onChange={(e) => setFormData({ ...formData, purchase_price: e.target.value })}
                    data-testid="device-purchase-price-input"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Notlar</Label>
                <textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="flex min-h-[80px] w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
                  data-testid="device-notes-input"
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setIsDeviceDialogOpen(false)}>
                  İptal
                </Button>
                <Button type="submit" data-testid="device-submit-button">
                  {editingDevice ? 'Güncelle' : 'Kaydet'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Assign Dialog */}
      <Dialog open={isAssignDialogOpen} onOpenChange={setIsAssignDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cihaz Ata</DialogTitle>
          </DialogHeader>
          {selectedDevice && (
            <div className="space-y-4">
              <div className="bg-gray-50 p-4 rounded-lg">
                <p><strong>Cihaz:</strong> {selectedDevice.brand} {selectedDevice.model}</p>
                <p><strong>Seri No:</strong> {selectedDevice.serial_number}</p>
              </div>
              <form onSubmit={handleAssign} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="customer_id">Müşteri *</Label>
                  <select
                    id="customer_id"
                    value={assignData.customer_id}
                    onChange={(e) => setAssignData({ ...assignData, customer_id: e.target.value })}
                    className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
                    required
                    data-testid="assign-customer-select"
                  >
                    <option value="">Müşteri Seçin</option>
                    {customers.map((customer) => (
                      <option key={customer.id} value={customer.id}>
                        {customer.first_name} {customer.last_name} ({customer.customer_number})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setIsAssignDialogOpen(false)}>
                    İptal
                  </Button>
                  <Button type="submit" data-testid="assign-submit-button">
                    Ata
                  </Button>
                </div>
              </form>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Devices List */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Cihaz ara (marka, model, seri no...)"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
                data-testid="device-search-input"
              />
            </div>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="h-10 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
              data-testid="device-type-filter"
            >
              <option value="">Tüm Tipler</option>
              <option value="modem">Modem</option>
              <option value="router">Router</option>
              <option value="ont">ONT</option>
              <option value="switch">Switch</option>
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-10 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
              data-testid="device-status-filter"
            >
              <option value="">Tüm Durumlar</option>
              <option value="in_stock">Depoda</option>
              <option value="assigned">Kullanımda</option>
              <option value="faulty">Arızalı</option>
              <option value="retired">Hurdaya Ayrıldı</option>
            </select>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            </div>
          ) : devices.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              Cihaz bulunamadı
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tip</TableHead>
                  <TableHead>Marka/Model</TableHead>
                  <TableHead>Seri No</TableHead>
                  <TableHead>MAC Adresi</TableHead>
                  <TableHead>Durum</TableHead>
                  <TableHead>Müşteri</TableHead>
                  <TableHead className="text-right">İşlemler</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {devices.map((device) => (
                  <TableRow key={device.id} data-testid={`device-row-${device.id}`}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <HardDrive className="h-4 w-4 text-gray-500" />
                        {getDeviceTypeLabel(device.device_type)}
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">
                      {device.brand} {device.model}
                    </TableCell>
                    <TableCell className="text-sm text-gray-600">{device.serial_number}</TableCell>
                    <TableCell className="text-sm text-gray-600">{device.mac_address || '-'}</TableCell>
                    <TableCell>{getStatusBadge(device.status)}</TableCell>
                    <TableCell>{device.customer_name || '-'}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        {device.status === 'in_stock' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openAssignDialog(device)}
                            data-testid={`assign-device-${device.id}`}
                          >
                            <UserPlus className="h-4 w-4 text-blue-600" />
                          </Button>
                        )}
                        {device.status === 'assigned' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleUnassign(device.id)}
                            data-testid={`unassign-device-${device.id}`}
                          >
                            <UserMinus className="h-4 w-4 text-orange-600" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(device)}
                          data-testid={`edit-device-${device.id}`}
                        >
                          <Edit className="h-4 w-4 text-blue-600" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(device.id)}
                          disabled={device.status === 'assigned'}
                          data-testid={`delete-device-${device.id}`}
                        >
                          <Trash2 className="h-4 w-4 text-red-600" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Devices;
