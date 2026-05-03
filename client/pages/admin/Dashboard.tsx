import { useEffect, useState } from 'react';
import { apiUrl } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { AdminStats } from '@shared/api';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, FileText, ClipboardList, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

export default function AdminDashboard() {
  const { token } = useAuth();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/admin/stats', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch stats');
      }

      const data = await response.json();
      setStats(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load stats');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-gray-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error}</p>
          <Button onClick={fetchStats}>Retry</Button>
        </div>
      </div>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-8">
        <div className="space-y-2">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-slate-50 via-slate-100 to-slate-200 bg-clip-text text-transparent">
            Admin Dashboard
          </h1>
          <p className="text-slate-200 text-lg">
            Overview of system statistics and management
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="border-0 shadow-lg hover:shadow-xl transition-shadow duration-300 overflow-hidden">
            <div className="h-2 bg-gradient-to-r from-blue-500 to-blue-600"></div>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <CardTitle className="text-sm font-semibold text-gray-700">Total Users</CardTitle>
              <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center">
                <Users className="h-6 w-6 text-blue-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold text-gray-900 mb-1">{stats?.totalUsers || 0}</div>
              <CardDescription className="text-sm">Registered users in the system</CardDescription>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg hover:shadow-xl transition-shadow duration-300 overflow-hidden">
            <div className="h-2 bg-gradient-to-r from-green-500 to-green-600"></div>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <CardTitle className="text-sm font-semibold text-gray-700">Total Forms</CardTitle>
              <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center">
                <FileText className="h-6 w-6 text-green-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold text-gray-900 mb-1">{stats?.totalForms || 0}</div>
              <CardDescription className="text-sm">Forms created by users</CardDescription>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg hover:shadow-xl transition-shadow duration-300 overflow-hidden">
            <div className="h-2 bg-gradient-to-r from-purple-500 to-purple-600"></div>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <CardTitle className="text-sm font-semibold text-gray-700">Total Submissions</CardTitle>
              <div className="w-12 h-12 rounded-xl bg-purple-100 flex items-center justify-center">
                <ClipboardList className="h-6 w-6 text-purple-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold text-gray-900 mb-1">{stats?.totalSubmissions || 0}</div>
              <CardDescription className="text-sm">Form submissions received</CardDescription>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <div className="space-y-4">
          <h2 className="text-2xl font-bold text-white drop-shadow-sm">
            Quick Actions
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Link to="/admin/users">
              <Card className="hover:shadow-xl cursor-pointer transition-all duration-300 border-2 hover:border-primary/30 h-full">
                <CardHeader>
                  <div className="w-14 h-14 rounded-xl bg-blue-100 flex items-center justify-center mb-4">
                    <Users className="h-7 w-7 text-blue-600" />
                  </div>
                  <CardTitle className="text-xl font-bold">Manage Users</CardTitle>
                  <CardDescription className="text-base">View and manage all users in the system</CardDescription>
                </CardHeader>
              </Card>
            </Link>

            <Link to="/admin/forms">
              <Card className="hover:shadow-xl cursor-pointer transition-all duration-300 border-2 hover:border-primary/30 h-full">
                <CardHeader>
                  <div className="w-14 h-14 rounded-xl bg-green-100 flex items-center justify-center mb-4">
                    <FileText className="h-7 w-7 text-green-600" />
                  </div>
                  <CardTitle className="text-xl font-bold">Manage Forms</CardTitle>
                  <CardDescription className="text-base">View and manage all forms</CardDescription>
                </CardHeader>
              </Card>
            </Link>

            <Link to="/admin/submissions">
              <Card className="hover:shadow-xl cursor-pointer transition-all duration-300 border-2 hover:border-primary/30 h-full">
                <CardHeader>
                  <div className="w-14 h-14 rounded-xl bg-purple-100 flex items-center justify-center mb-4">
                    <ClipboardList className="h-7 w-7 text-purple-600" />
                  </div>
                  <CardTitle className="text-xl font-bold">View Submissions</CardTitle>
                  <CardDescription className="text-base">View all form submissions</CardDescription>
                </CardHeader>
              </Card>
            </Link>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}

