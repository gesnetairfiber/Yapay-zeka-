import React, { useState, useEffect } from 'react';
import { invoiceAPI, customerAPI, packageAPI } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Plus, Search, DollarSign, CheckCircle, XCircle, Loader2, Calendar } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const Invoices = () => {
  const [invoices, setInvoices] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [isInvoiceDialogOpen, setIsInvoiceDialogOpen] = useState(false);
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [formData, setFormData] = useState({
    customer_id: '',
    package_id: '',
    amount: '',
    due_date: '',
    notes: ''
  });
  const [paymentData, setPaymentData] = useState({
    payment_method: 'cash',
    notes: ''
  });
  const { toast } = useToast();

  useEffect(() => {
    fetchInvoices();
    fetchCustomers();
    fetchPackages();
  }, [searchTerm, statusFilter]);

  const fetchInvoices = async () => {
    try {
      const params = {};
      if (searchTerm) params.search = searchTerm;
      if (statusFilter) params.status = statusFilter;
      
      const response = await invoiceAPI.getAll(params);
      setInvoices(response.data);
    } catch (error) {
      toast({
        title: 'Hata',
        description: 'Faturalar yüklenemedi',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchCustomers = async () => {
    try {
      const response = await customerAPI.getAll({});
      setCustomers(response.data);
    } catch (error) {
      console.error('Müşteriler yüklenemedi:', error);
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
      const data = {
        ...formData,
        amount: parseFloat(formData.amount),
        due_date: new Date(formData.due_date).toISOString()
      };

      await invoiceAPI.create(data);
      toast({
        title: 'Başarılı',
        description: 'Fatura oluşturuldu'
      });
      setIsInvoiceDialogOpen(false);
      resetForm();
      fetchInvoices();
    } catch (error) {
      toast({
        title: 'Hata',
        description: error.response?.data?.detail || 'İşlem başarısız',
        variant: 'destructive'
      });
    }
  };

  const handlePayment = async (e) => {
    e.preventDefault();
    try {
      await invoiceAPI.pay(selectedInvoice.id, paymentData);
      toast({
        title: 'Başarılı',
        description: 'Ödeme kaydedildi'
      });
      setIsPaymentDialogOpen(false);
      setSelectedInvoice(null);
      resetPaymentForm();
      fetchInvoices();
    } catch (error) {
      toast({
        title: 'Hata',
        description: error.response?.data?.detail || 'Ödeme kaydedilemedi',
        variant: 'destructive'
      });
    }
  };

  const handleCancel = async (id) => {
    if (!window.confirm('Bu faturayı iptal etmek istediğinize emin misiniz?')) return;
    
    try {
      await invoiceAPI.cancel(id);
      toast({
        title: 'Başarılı',
        description: 'Fatura iptal edildi'
      });
      fetchInvoices();
    } catch (error) {
      toast({
        title: 'Hata',
        description: error.response?.data?.detail || 'İptal işlemi başarısız',
        variant: 'destructive'
      });
    }
  };

  const openPaymentDialog = (invoice) => {
    setSelectedInvoice(invoice);
    setIsPaymentDialogOpen(true);
  };

  const resetForm = () => {
    setFormData({
      customer_id: '',
      package_id: '',
      amount: '',
      due_date: '',
      notes: ''
    });
  };

  const resetPaymentForm = () => {
    setPaymentData({
      payment_method: 'cash',
      notes: ''
    });
  };

  const getStatusBadge = (status, dueDate) => {
    // Check if overdue
    if (status === 'unpaid' && new Date(dueDate) < new Date()) {
      return <Badge className="bg-red-100 text-red-800">Vadesi Geçmiş</Badge>;
    }

    const variants = {
      unpaid: { color: 'bg-yellow-100 text-yellow-800', label: 'Ödenmedi' },
      paid: { color: 'bg-green-100 text-green-800', label: 'Ödendi' },
      cancelled: { color: 'bg-gray-100 text-gray-800', label: 'İptal' }
    };
    const variant = variants[status] || variants.unpaid;
    return <Badge className={variant.color}>{variant.label}</Badge>;
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('tr-TR');
  };

  const handleCustomerChange = (customerId) => {
    setFormData({ ...formData, customer_id: customerId });
    const customer = customers.find(c => c.id === customerId);
    if (customer && customer.package_id) {
      setFormData(prev => ({
        ...prev,
        customer_id: customerId,
        package_id: customer.package_id
      }));
      const pkg = packages.find(p => p.id === customer.package_id);
      if (pkg) {
        setFormData(prev => ({ ...prev, amount: pkg.price.toString() }));
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900" data-testid="invoices-title">Faturalar</h1>
          <p className="text-gray-600 mt-1">Fatura ve ödeme yönetimi</p>
        </div>
        <Dialog open={isInvoiceDialogOpen} onOpenChange={setIsInvoiceDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={resetForm} data-testid="add-invoice-button">
              <Plus className="mr-2 h-4 w-4" />
              Yeni Fatura
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Yeni Fatura Oluştur</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="customer_id">Müşteri *</Label>
                <select
                  id="customer_id"
                  value={formData.customer_id}
                  onChange={(e) => handleCustomerChange(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
                  required
                  data-testid="invoice-customer-select"
                >
                  <option value="">Müşteri Seçin</option>
                  {customers.map((customer) => (
                    <option key={customer.id} value={customer.id}>
                      {customer.first_name} {customer.last_name} ({customer.customer_number})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="package_id">Paket</Label>
                <select
                  id="package_id"
                  value={formData.package_id}
                  onChange={(e) => {
                    const pkgId = e.target.value;
                    setFormData({ ...formData, package_id: pkgId });
                    if (pkgId) {
                      const pkg = packages.find(p => p.id === pkgId);
                      if (pkg) {
                        setFormData(prev => ({ ...prev, amount: pkg.price.toString() }));
                      }
                    }
                  }}
                  className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
                  data-testid="invoice-package-select"
                >
                  <option value="">Paket Seçin (Opsiyonel)</option>
                  {packages.map((pkg) => (
                    <option key={pkg.id} value={pkg.id}>
                      {pkg.name} - ₺{pkg.price}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="amount">Tutar (₺) *</Label>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  required
                  min="0"
                  data-testid="invoice-amount-input"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="due_date">Son Ödeme Tarihi *</Label>
                <Input
                  id="due_date"
                  type="date"
                  value={formData.due_date}
                  onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                  required
                  data-testid="invoice-due-date-input"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Notlar</Label>
                <textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="flex min-h-[80px] w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
                  data-testid="invoice-notes-input"
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setIsInvoiceDialogOpen(false)}>
                  İptal
                </Button>
                <Button type="submit" data-testid="invoice-submit-button">
                  Oluştur
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Payment Dialog */}
      <Dialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ödeme Kaydet</DialogTitle>
          </DialogHeader>
          {selectedInvoice && (
            <div className="space-y-4">
              <div className="bg-gray-50 p-4 rounded-lg">
                <p><strong>Fatura No:</strong> {selectedInvoice.invoice_number}</p>
                <p><strong>Müşteri:</strong> {selectedInvoice.customer_name}</p>
                <p><strong>Tutar:</strong> ₺{selectedInvoice.amount.toFixed(2)}</p>
              </div>
              <form onSubmit={handlePayment} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="payment_method">Ödeme Yöntemi *</Label>
                  <select
                    id="payment_method"
                    value={paymentData.payment_method}
                    onChange={(e) => setPaymentData({ ...paymentData, payment_method: e.target.value })}
                    className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
                    required
                    data-testid="payment-method-select"
                  >
                    <option value="cash">Nakit</option>
                    <option value="credit_card">Kredi Kartı</option>
                    <option value="bank_transfer">Havale/EFT</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="payment_notes">Notlar</Label>
                  <textarea
                    id="payment_notes"
                    value={paymentData.notes}
                    onChange={(e) => setPaymentData({ ...paymentData, notes: e.target.value })}
                    className="flex min-h-[80px] w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
                    data-testid="payment-notes-input"
                  />
                </div>

                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setIsPaymentDialogOpen(false)}>
                    İptal
                  </Button>
                  <Button type="submit" data-testid="payment-submit-button">
                    Ödeme Kaydet
                  </Button>
                </div>
              </form>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Fatura ara (fatura no, müşteri adı...)"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
                data-testid="invoice-search-input"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-10 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
              data-testid="invoice-status-filter"
            >
              <option value="">Tüm Durumlar</option>
              <option value="unpaid">Ödenmedi</option>
              <option value="paid">Ödendi</option>
              <option value="cancelled">İptal</option>
            </select>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            </div>
          ) : invoices.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              Fatura bulunamadı
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fatura No</TableHead>
                  <TableHead>Müşteri</TableHead>
                  <TableHead>Paket</TableHead>
                  <TableHead>Tutar</TableHead>
                  <TableHead>Düzenleme</TableHead>
                  <TableHead>Son Ödeme</TableHead>
                  <TableHead>Durum</TableHead>
                  <TableHead className="text-right">İşlemler</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map((invoice) => (
                  <TableRow key={invoice.id} data-testid={`invoice-row-${invoice.id}`}>
                    <TableCell className="font-medium">{invoice.invoice_number}</TableCell>
                    <TableCell>
                      {invoice.customer_name}
                      <br />
                      <span className="text-sm text-gray-500">{invoice.customer_phone}</span>
                    </TableCell>
                    <TableCell>{invoice.package_name || '-'}</TableCell>
                    <TableCell className="font-medium">₺{invoice.amount.toFixed(2)}</TableCell>
                    <TableCell>{formatDate(invoice.issue_date)}</TableCell>
                    <TableCell>{formatDate(invoice.due_date)}</TableCell>
                    <TableCell>{getStatusBadge(invoice.status, invoice.due_date)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        {invoice.status === 'unpaid' && (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openPaymentDialog(invoice)}
                              data-testid={`pay-invoice-${invoice.id}`}
                            >
                              <CheckCircle className="h-4 w-4 text-green-600" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleCancel(invoice.id)}
                              data-testid={`cancel-invoice-${invoice.id}`}
                            >
                              <XCircle className="h-4 w-4 text-red-600" />
                            </Button>
                          </>
                        )}
                        {invoice.status === 'paid' && (
                          <span className="text-sm text-gray-500">
                            {formatDate(invoice.payment_date)}
                          </span>
                        )}
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

export default Invoices;
