import React, { useState, useEffect } from 'react';
import { packageAPI } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Plus, Edit, Trash2, Wifi, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const Packages = () => {
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingPackage, setEditingPackage] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    download_speed: '',
    upload_speed: '',
    traffic_limit: '',
    price: '',
    duration_days: '30'
  });
  const { toast } = useToast();

  useEffect(() => {
    fetchPackages();
  }, []);

  const fetchPackages = async () => {
    try {
      const response = await packageAPI.getAll();
      setPackages(response.data);
    } catch (error) {
      toast({
        title: 'Hata',
        description: 'Paketler yüklenemedi',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const data = {
        ...formData,
        download_speed: parseInt(formData.download_speed),
        upload_speed: parseInt(formData.upload_speed),
        traffic_limit: formData.traffic_limit ? parseInt(formData.traffic_limit) : null,
        price: parseFloat(formData.price),
        duration_days: parseInt(formData.duration_days)
      };

      if (editingPackage) {
        await packageAPI.update(editingPackage.id, data);
        toast({
          title: 'Başarılı',
          description: 'Paket güncellendi'
        });
      } else {
        await packageAPI.create(data);
        toast({
          title: 'Başarılı',
          description: 'Yeni paket eklendi'
        });
      }
      setIsDialogOpen(false);
      resetForm();
      fetchPackages();
    } catch (error) {
      toast({
        title: 'Hata',
        description: error.response?.data?.detail || 'İşlem başarısız',
        variant: 'destructive'
      });
    }
  };

  const handleEdit = (pkg) => {
    setEditingPackage(pkg);
    setFormData({
      name: pkg.name,
      description: pkg.description || '',
      download_speed: pkg.download_speed.toString(),
      upload_speed: pkg.upload_speed.toString(),
      traffic_limit: pkg.traffic_limit ? pkg.traffic_limit.toString() : '',
      price: pkg.price.toString(),
      duration_days: pkg.duration_days.toString()
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Bu paketi silmek istediğinize emin misiniz?')) return;
    
    try {
      await packageAPI.delete(id);
      toast({
        title: 'Başarılı',
        description: 'Paket silindi'
      });
      fetchPackages();
    } catch (error) {
      toast({
        title: 'Hata',
        description: 'Silme işlemi başarısız',
        variant: 'destructive'
      });
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      download_speed: '',
      upload_speed: '',
      traffic_limit: '',
      price: '',
      duration_days: '30'
    });
    setEditingPackage(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900" data-testid="packages-title">İnternet Paketleri</h1>
          <p className="text-gray-600 mt-1">Paketlerinizi yönetin</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={resetForm} data-testid="add-package-button">
              <Plus className="mr-2 h-4 w-4" />
              Yeni Paket
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{editingPackage ? 'Paket Düzenle' : 'Yeni Paket Ekle'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Paket Adı *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Örn: Premium 50 Mbps"
                  required
                  data-testid="package-name-input"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Açıklama</Label>
                <textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="flex min-h-[80px] w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
                  placeholder="Paket açıklaması"
                  data-testid="package-description-input"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="download_speed">Download Hızı (Mbps) *</Label>
                  <Input
                    id="download_speed"
                    type="number"
                    value={formData.download_speed}
                    onChange={(e) => setFormData({ ...formData, download_speed: e.target.value })}
                    required
                    min="1"
                    data-testid="package-download-speed-input"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="upload_speed">Upload Hızı (Mbps) *</Label>
                  <Input
                    id="upload_speed"
                    type="number"
                    value={formData.upload_speed}
                    onChange={(e) => setFormData({ ...formData, upload_speed: e.target.value })}
                    required
                    min="1"
                    data-testid="package-upload-speed-input"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="traffic_limit">Trafik Limiti (GB)</Label>
                  <Input
                    id="traffic_limit"
                    type="number"
                    value={formData.traffic_limit}
                    onChange={(e) => setFormData({ ...formData, traffic_limit: e.target.value })}
                    placeholder="Boş bırakın (Sınırsız)"
                    min="1"
                    data-testid="package-traffic-limit-input"
                  />
                  <p className="text-xs text-gray-500">Boş bırakırsanız sınırsız olur</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="duration_days">Süre (Gün) *</Label>
                  <Input
                    id="duration_days"
                    type="number"
                    value={formData.duration_days}
                    onChange={(e) => setFormData({ ...formData, duration_days: e.target.value })}
                    required
                    min="1"
                    data-testid="package-duration-input"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="price">Fiyat (₺) *</Label>
                <Input
                  id="price"
                  type="number"
                  step="0.01"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                  required
                  min="0"
                  data-testid="package-price-input"
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  İptal
                </Button>
                <Button type="submit" data-testid="package-submit-button">
                  {editingPackage ? 'Güncelle' : 'Kaydet'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      ) : packages.length === 0 ? (
        <Card>
          <CardContent className="text-center py-8 text-gray-500">
            Henüz paket bulunmuyor. Yeni paket ekleyin.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {packages.map((pkg) => (
            <Card key={pkg.id} className="hover:shadow-lg transition-shadow" data-testid={`package-card-${pkg.id}`}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <Wifi className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{pkg.name}</CardTitle>
                      {pkg.description && (
                        <p className="text-sm text-gray-600 mt-1">{pkg.description}</p>
                      )}
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Download:</span>
                    <span className="font-medium">{pkg.download_speed} Mbps</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Upload:</span>
                    <span className="font-medium">{pkg.upload_speed} Mbps</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Trafik:</span>
                    <span className="font-medium">
                      {pkg.traffic_limit ? `${pkg.traffic_limit} GB` : 'Sınırsız'}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Süre:</span>
                    <span className="font-medium">{pkg.duration_days} Gün</span>
                  </div>
                </div>

                <div className="border-t pt-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-2xl font-bold text-blue-600">₺{pkg.price.toFixed(2)}</p>
                      <p className="text-xs text-gray-500">/{pkg.duration_days} gün</p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(pkg)}
                        data-testid={`edit-package-${pkg.id}`}
                      >
                        <Edit className="h-4 w-4 text-blue-600" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(pkg.id)}
                        data-testid={`delete-package-${pkg.id}`}
                      >
                        <Trash2 className="h-4 w-4 text-red-600" />
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default Packages;
