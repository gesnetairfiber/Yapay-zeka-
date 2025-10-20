import React, { useState, useEffect } from 'react';
import { customerAPI, packageAPI } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Plus, Search, Edit, Trash2, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const Customers = () => {
  const [customers, setCustomers] = useState([]);
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    national_id: '',
    address: '',
    city: '',
    district: '',
    radius_username: '',
    radius_password: '',
    package_id: '',
    notes: ''
  });
  const { toast } = useToast();

  useEffect(() => {
    fetchCustomers();
    fetchPackages();
  }, [searchTerm, statusFilter]);

  const fetchCustomers = async () => {
    try {
      const params = {};
      if (searchTerm) params.search = searchTerm;
      if (statusFilter) params.status = statusFilter;
      
      const response = await customerAPI.getAll(params);
      setCustomers(response.data);
    } catch (error) {
      toast({
        title: 'Hata',
        description: 'Aboneler yüklenemedi',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchPackages = async () => {
    try {
      const response = await packageAPI.getAll();
      setPackages(response.data);
    } catch (error) {
      console.error('Paketler yüklenemedi:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingCustomer) {
        await customerAPI.update(editingCustomer.id, formData);
        toast({
          title: 'Başarılı',
          description: 'Abone güncellendi'
        });
      } else {
        await customerAPI.create(formData);
        toast({
          title: 'Başarılı',
          description: 'Yeni abone eklendi'
        });
      }
      setIsDialogOpen(false);
      resetForm();
      fetchCustomers();
    } catch (error) {
      toast({
        title: 'Hata',
        description: error.response?.data?.detail || 'İşlem başarısız',
        variant: 'destructive'
      });
    }
  };

  const handleEdit = (customer) => {
    setEditingCustomer(customer);
    setFormData({
      first_name: customer.first_name,
      last_name: customer.last_name,
      email: customer.email || '',
      phone: customer.phone,
      national_id: customer.national_id || '',
      address: customer.address || '',
      city: customer.city || '',
      district: customer.district || '',
      radius_username: customer.radius_username,
      radius_password: customer.radius_password,
      package_id: customer.package_id || '',
      notes: customer.notes || ''
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Bu aboneyi silmek istediğinize emin misiniz?')) return;
    
    try {
      await customerAPI.delete(id);
      toast({
        title: 'Başarılı',
        description: 'Abone silindi'
      });
      fetchCustomers();
    } catch (error) {
      toast({
        title: 'Hata',
        description: 'Silme işlemi başarısız',
        variant: 'destructive'
      });
    }
  };

  const handleStatusChange = async (id, newStatus) => {
    try {
      await customerAPI.updateStatus(id, newStatus);
      toast({
        title: 'Başarılı',
        description: 'Durum güncellendi'
      });
      fetchCustomers();
    } catch (error) {
      toast({
        title: 'Hata',
        description: 'Durum güncellenemedi',
        variant: 'destructive'
      });
    }
  };

  const resetForm = () => {
    setFormData({
      first_name: '',
      last_name: '',
      email: '',
      phone: '',
      national_id: '',
      address: '',
      city: '',
      district: '',
      radius_username: '',
      radius_password: '',
      package_id: '',
      notes: ''
    });
    setEditingCustomer(null);
  };

  const getStatusBadge = (status) => {
    const variants = {
      active: { color: 'bg-green-100 text-green-800', label: 'Aktif' },
      suspended: { color: 'bg-yellow-100 text-yellow-800', label: 'Askıda' },
      inactive: { color: 'bg-gray-100 text-gray-800', label: 'Pasif' }
    };
    const variant = variants[status] || variants.inactive;
    return <Badge className={variant.color}>{variant.label}</Badge>;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900" data-testid="customers-title">Aboneler</h1>
          <p className="text-gray-600 mt-1">Tüm abonelerinizi yönetin</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={resetForm} data-testid="add-customer-button">
              <Plus className="mr-2 h-4 w-4" />
              Yeni Abone
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingCustomer ? 'Abone Düzenle' : 'Yeni Abone Ekle'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="first_name">Ad *</Label>
                  <Input
                    id="first_name"
                    value={formData.first_name}
                    onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                    required
                    data-testid="customer-first-name-input"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="last_name">Soyad *</Label>
                  <Input
                    id="last_name"
                    value={formData.last_name}
                    onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                    required
                    data-testid="customer-last-name-input"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="phone">Telefon *</Label>
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    required
                    data-testid="customer-phone-input"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">E-posta</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    data-testid="customer-email-input"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="national_id">TC Kimlik No</Label>
                <Input
                  id="national_id"
                  value={formData.national_id}
                  onChange={(e) => setFormData({ ...formData, national_id: e.target.value })}
                  data-testid="customer-national-id-input"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="address">Adres</Label>
                <Input
                  id="address"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  data-testid="customer-address-input"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="city">Şehir</Label>
                  <Input
                    id="city"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    data-testid="customer-city-input"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="district">İlçe</Label>
                  <Input
                    id="district"
                    value={formData.district}
                    onChange={(e) => setFormData({ ...formData, district: e.target.value })}
                    data-testid="customer-district-input"
                  />
                </div>
              </div>

              <div className="border-t pt-4">
                <h3 className="font-semibold mb-3">RADIUS Bilgileri</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="radius_username">Kullanıcı Adı *</Label>
                    <Input
                      id="radius_username"
                      value={formData.radius_username}
                      onChange={(e) => setFormData({ ...formData, radius_username: e.target.value })}
                      required
                      disabled={!!editingCustomer}
                      data-testid="customer-radius-username-input"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="radius_password">Şifre *</Label>
                    <Input
                      id="radius_password"
                      type="text"
                      value={formData.radius_password}
                      onChange={(e) => setFormData({ ...formData, radius_password: e.target.value })}
                      required
                      data-testid="customer-radius-password-input"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="package_id">Paket</Label>
                <select
                  id="package_id"
                  value={formData.package_id}
                  onChange={(e) => setFormData({ ...formData, package_id: e.target.value })}
                  className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
                  data-testid="customer-package-select"
                >
                  <option value="">Paket Seçin</option>
                  {packages.map((pkg) => (
                    <option key={pkg.id} value={pkg.id}>
                      {pkg.name} - {pkg.download_speed}/{pkg.upload_speed} Mbps - ₺{pkg.price}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Notlar</Label>
                <textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="flex min-h-[80px] w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
                  data-testid="customer-notes-input"
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  İptal
                </Button>
                <Button type="submit" data-testid="customer-submit-button">
                  {editingCustomer ? 'Güncelle' : 'Kaydet'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Abone ara (ad, telefon, kullanıcı adı...)"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
                data-testid="customer-search-input"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-10 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
              data-testid="customer-status-filter"
            >
              <option value="">Tüm Durumlar</option>
              <option value="active">Aktif</option>
              <option value="suspended">Askıda</option>
              <option value="inactive">Pasif</option>
            </select>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            </div>
          ) : customers.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              Abone bulunamadı
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Abone No</TableHead>
                  <TableHead>Ad Soyad</TableHead>
                  <TableHead>Telefon</TableHead>
                  <TableHead>RADIUS</TableHead>
                  <TableHead>Paket</TableHead>
                  <TableHead>Durum</TableHead>
                  <TableHead>Borç/Alacak</TableHead>
                  <TableHead className="text-right">İşlemler</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {customers.map((customer) => (
                  <TableRow key={customer.id} data-testid={`customer-row-${customer.id}`}>
                    <TableCell className="font-medium">{customer.customer_number}</TableCell>
                    <TableCell>{customer.first_name} {customer.last_name}</TableCell>
                    <TableCell>{customer.phone}</TableCell>
                    <TableCell className="text-sm text-gray-600">{customer.radius_username}</TableCell>
                    <TableCell>{customer.package_name || '-'}</TableCell>
                    <TableCell>{getStatusBadge(customer.status)}</TableCell>
                    <TableCell>
                      <span className={customer.balance < 0 ? 'text-red-600 font-medium' : 'text-green-600'}>
                        ₺{customer.balance.toFixed(2)}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        {customer.status === 'active' ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleStatusChange(customer.id, 'suspended')}
                            data-testid={`suspend-customer-${customer.id}`}
                          >
                            <XCircle className="h-4 w-4 text-yellow-600" />
                          </Button>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleStatusChange(customer.id, 'active')}
                            data-testid={`activate-customer-${customer.id}`}
                          >
                            <CheckCircle className="h-4 w-4 text-green-600" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(customer)}
                          data-testid={`edit-customer-${customer.id}`}
                        >
                          <Edit className="h-4 w-4 text-blue-600" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(customer.id)}
                          data-testid={`delete-customer-${customer.id}`}
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

export default Customers;
