import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2 } from 'lucide-react';

const Login = () => {
  const [credentials, setCredentials] = useState({ username: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(credentials);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.detail || 'Giriş başarısız. Lütfen tekrar deneyin.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-500 to-blue-700 p-4">
      <Card className="w-full max-w-md" data-testid="login-card">
        <CardHeader className="space-y-1 text-center">
          <div className="mb-4">
            <div className="w-16 h-16 bg-blue-600 rounded-full mx-auto flex items-center justify-center">
              <span className="text-2xl font-bold text-white">WR</span>
            </div>
          </div>
          <CardTitle className="text-2xl font-bold">WiRadius CRM</CardTitle>
          <CardDescription>ISP Yönetim Sistemi</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <Alert variant="destructive" data-testid="login-error">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            
            <div className="space-y-2">
              <Label htmlFor="username">Kullanıcı Adı</Label>
              <Input
                id="username"
                type="text"
                placeholder="Kullanıcı adınızı girin"
                value={credentials.username}
                onChange={(e) => setCredentials({ ...credentials, username: e.target.value })}
                required
                disabled={loading}
                data-testid="username-input"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="password">Şifre</Label>
              <Input
                id="password"
                type="password"
                placeholder="Şifrenizi girin"
                value={credentials.password}
                onChange={(e) => setCredentials({ ...credentials, password: e.target.value })}
                required
                disabled={loading}
                data-testid="password-input"
              />
            </div>
            
            <Button
              type="submit"
              className="w-full"
              disabled={loading}
              data-testid="login-button"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Giriş yapılıyor...
                </>
              ) : (
                'Giriş Yap'
              )}
            </Button>
          </form>
          
          <div className="mt-6 text-center text-sm text-gray-600">
            <p>Demo hesap: admin / admin123</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Login;
