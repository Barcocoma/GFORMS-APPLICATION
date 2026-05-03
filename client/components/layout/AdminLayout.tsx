import { ReactNode, useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { apiUrl } from '@/lib/api';
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { 
  LayoutDashboard, 
  FileText,
  ChevronLeft,
  ChevronRight,
  Bell,
  User,
  LogOut,
  UserCircle,
  CheckCheck,
  Search,
  Users,
  ClipboardList
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Notification {
  id: number;
  form_id: number;
  submission_id: number;
  message: string;
  is_read: boolean;
  created_at: string;
  form_title?: string;
}

interface AdminLayoutProps {
  children: ReactNode;
}

export function AdminLayout({ children }: AdminLayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout, token } = useAuth();
  const [isSidebarMinimized, setIsSidebarMinimized] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [eventSource, setEventSource] = useState<EventSource | null>(null);

  const navItems = [
    {
      title: "Admin Dashboard",
      href: "/admin",
      icon: LayoutDashboard,
    },
    {
      title: "Manage Users",
      href: "/admin/users",
      icon: Users,
    },
    {
      title: "Manage Forms",
      href: "/admin/forms",
      icon: FileText,
    },
    {
      title: "View Submissions",
      href: "/admin/submissions",
      icon: ClipboardList,
    },
    {
      title: "Go to Forms",
      href: "/",
      icon: FileText,
    },
  ];

  const toggleSidebar = () => {
    setIsSidebarMinimized(prev => !prev);
  };

  const handleLogout = () => {
    logout();
    window.location.href = "/login";
  };

  // Fetch notifications
  const fetchNotifications = async () => {
    if (!token) return;
    
    try {
      const response = await fetch(apiUrl('/api/notifications'), {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setNotifications(data);
        setUnreadCount(data.filter((n: Notification) => !n.is_read).length);
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
    }
  };

  // Mark notification as read
  const markAsRead = async (notificationId: number) => {
    if (!token) return;
    
    try {
      const response = await fetch(apiUrl(`/api/notifications/${notificationId}/read`), {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        setNotifications(prev => 
          prev.map(n => n.id === notificationId ? { ...n, is_read: true } : n)
        );
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  // Mark all as read
  const markAllAsRead = async () => {
    if (!token) return;
    
    try {
      const response = await fetch(apiUrl('/api/notifications/read-all'), {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
        setUnreadCount(0);
      }
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  };

  // Handle notification click
  const handleNotificationClick = (notification: Notification) => {
    if (!notification.is_read) {
      markAsRead(notification.id);
    }
    navigate(`/forms/${notification.form_id}`);
    setNotificationsOpen(false);
  };

  // Format time ago
  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;
    return date.toLocaleDateString();
  };

  // Setup real-time notifications using Server-Sent Events
  useEffect(() => {
    if (token) {
      // Fetch initial notifications
      fetchNotifications();
      
      // Setup SSE connection for real-time updates
      const eventSourceUrl = apiUrl(`/api/notifications/stream?token=${encodeURIComponent(token)}`);
      const es = new EventSource(eventSourceUrl);
      
      es.onopen = () => {
        console.log('Real-time notifications connected');
      };
      
      es.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          if (data.type === 'connected') {
            console.log('SSE connection established');
          } else if (data.type === 'new_notification') {
            setNotifications(prev => [data, ...prev]);
            setUnreadCount(prev => prev + 1);
            
            if ('Notification' in window && Notification.permission === 'granted') {
              new Notification('New Form Submission', {
                body: data.message,
                icon: '/favicon.ico'
              });
            }
            
            fetchNotifications();
          } else if (data.type === 'notification_read') {
            setNotifications(prev => 
              prev.map(n => n.id === data.id ? { ...n, is_read: true } : n)
            );
            setUnreadCount(prev => Math.max(0, prev - 1));
          } else if (data.type === 'all_notifications_read') {
            setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
            setUnreadCount(0);
          }
        } catch (error) {
          console.error('Error parsing SSE message:', error);
        }
      };
      
      es.onerror = (error) => {
        console.error('SSE error:', error);
        setTimeout(() => {
          if (es.readyState === EventSource.CLOSED) {
            es.close();
            setEventSource(null);
          }
        }, 3000);
      };
      
      setEventSource(es);
      
      if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
      }
      
      return () => {
        es.close();
        setEventSource(null);
      };
    } else {
      if (eventSource) {
        eventSource.close();
        setEventSource(null);
      }
    }
  }, [token]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-blue-900 text-slate-900">
      {/* Header - Search, Notifications, Profile */}
      <header className={cn(
        "sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-gray-200/60 shadow-sm transition-all duration-300 ease-in-out",
        isSidebarMinimized ? "ml-16" : "ml-56"
      )}>
        <div className="max-w-full px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between text-slate-900">
          {/* Left side - Empty for admin (logo is in sidebar) */}
          <div className="flex items-center gap-3">
            {/* Spacer to balance layout */}
          </div>

          {/* Center - Search (only on Go to Forms page) */}
          {location.pathname === "/" && (
            <div className="hidden md:block flex-1 max-w-xl mx-6">
              <div className="relative">
                <span className="absolute inset-y-0 left-3 flex items-center text-gray-700">
                  <Search className="w-4 h-4 font-bold" />
                </span>
                <input
                  type="text"
                  placeholder="Search forms"
                  value={searchValue}
                  onChange={(e) => {
                    const value = e.target.value;
                    setSearchValue(value);
                    window.dispatchEvent(new CustomEvent("formSearchChanged", { detail: value }));
                  }}
                  className="w-full rounded-full border border-gray-200 bg-white pl-9 pr-4 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary placeholder:text-gray-500 text-black font-bold"
                />
              </div>
            </div>
          )}
          
          {/* Spacer when search is hidden */}
          {location.pathname !== "/" && (
            <div className="flex-1"></div>
          )}

          {/* Right side - Notifications and Profile */}
          <div className="flex items-center gap-3">
            {user && (
              <>
                {/* Notifications Bell */}
                <DropdownMenu 
                  open={notificationsOpen} 
                  onOpenChange={setNotificationsOpen}
                  modal={false}
                >
                  <DropdownMenuTrigger asChild>
                    <Button 
                      variant="outline" 
                      size="icon" 
                      className="relative border-gray-300 hover:bg-gray-50 hover:text-gray-900 text-gray-900 z-10"
                      data-notification-trigger
                      style={{ pointerEvents: 'auto' }}
                    >
                      <Bell className="h-4 w-4" />
                      {unreadCount > 0 && (
                        <Badge className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 bg-red-500 text-white text-xs">
                          {unreadCount > 9 ? '9+' : unreadCount}
                        </Badge>
                      )}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent 
                    align="end" 
                    className="w-80 p-0"
                    sideOffset={8}
                    onCloseAutoFocus={(e) => e.preventDefault()}
                    onInteractOutside={(e) => {
                      const target = e.target as HTMLElement;
                      if (target.closest('[data-notification-content]') || 
                          target.closest('[data-notification-trigger]')) {
                        e.preventDefault();
                      }
                    }}
                    onEscapeKeyDown={(e) => {
                      setNotificationsOpen(false);
                    }}
                    style={{ pointerEvents: 'auto' }}
                  >
                    <div 
                      className="px-4 py-3 border-b border-gray-200 flex items-center justify-between"
                      data-notification-content
                    >
                      <h3 className="font-semibold text-sm">Notifications</h3>
                      {unreadCount > 0 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={markAllAsRead}
                          className="h-7 text-xs text-gray-600 hover:text-gray-900"
                        >
                          <CheckCheck className="h-3 w-3 mr-1" />
                          Mark all read
                        </Button>
                      )}
                    </div>
                    <ScrollArea className="h-[400px]" data-notification-content>
                      {notifications.length === 0 ? (
                        <div className="px-4 py-8 text-center text-sm text-gray-500">
                          No notifications yet
                        </div>
                      ) : (
                        <div className="divide-y divide-gray-100">
                          {notifications.map((notification) => (
                            <div
                              key={notification.id}
                              className={cn(
                                "px-4 py-3 hover:bg-gray-50 cursor-pointer transition-colors",
                                !notification.is_read && 'bg-blue-50/50'
                              )}
                              onClick={() => handleNotificationClick(notification)}
                              onMouseDown={(e) => {
                                e.preventDefault();
                              }}
                              data-notification-content
                            >
                              <div className="flex items-start gap-3">
                                <div className={cn("flex-1 min-w-0", !notification.is_read && 'font-medium')}>
                                  <p className="text-sm text-gray-900">{notification.message}</p>
                                  {notification.form_title && (
                                    <p className="text-xs text-gray-500 mt-1">{notification.form_title}</p>
                                  )}
                                  <p className="text-xs text-gray-400 mt-1">{formatTimeAgo(notification.created_at)}</p>
                                </div>
                                {!notification.is_read && (
                                  <div className="w-2 h-2 rounded-full bg-blue-500 shrink-0 mt-1.5" />
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </ScrollArea>
                    {notifications.length > 0 && (
                      <div className="px-4 py-2 border-t border-gray-200 text-center" data-notification-content>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setNotificationsOpen(false);
                            navigate('/');
                          }}
                          className="text-xs text-gray-600 hover:text-gray-900"
                        >
                          View all forms
                        </Button>
                      </div>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
                
                {/* User Menu */}
                <DropdownMenu modal={false}>
                  <DropdownMenuTrigger asChild>
                    <Button 
                      variant="outline" 
                      className="gap-2 border-gray-300 hover:bg-gray-50 hover:text-gray-900 text-gray-900 z-10"
                      data-user-menu-trigger
                      style={{ pointerEvents: 'auto' }}
                    >
                      <User className="w-4 h-4" />
                      <span className="hidden sm:inline font-medium">{user.username}</span>
                      <Badge variant={user.role === 'admin' ? 'default' : 'secondary'} className="ml-1">
                        {user.role}
                      </Badge>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent 
                    align="end" 
                    className="w-56"
                    sideOffset={8}
                    onCloseAutoFocus={(e) => e.preventDefault()}
                    onInteractOutside={(e) => {
                      const target = e.target as HTMLElement;
                      if (target.closest('[data-user-menu-trigger]')) {
                        e.preventDefault();
                      }
                    }}
                    style={{ pointerEvents: 'auto' }}
                  >
                    <DropdownMenuLabel>
                      <div className="flex flex-col">
                        <span className="font-semibold">{user.username}</span>
                        <span className="text-xs text-gray-500 font-normal">{user.role}</span>
                      </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <Link to="/profile">
                      <DropdownMenuItem className="cursor-pointer">
                        <UserCircle className="mr-2 h-4 w-4" />
                        <span>Profile</span>
                      </DropdownMenuItem>
                    </Link>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleLogout} className="cursor-pointer text-red-600 focus:text-red-600">
                      <LogOut className="mr-2 h-4 w-4" />
                      <span>Logout</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            )}
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Side Navigation */}
        <aside className={cn(
          "bg-white shadow-xl border-r border-gray-200 fixed left-0 top-0 h-screen z-50 flex flex-col transition-all duration-300 ease-in-out overflow-hidden",
          isSidebarMinimized ? "w-16" : "w-56"
        )}>
          {/* Logo and Minimize Button */}
          <div className={cn(
            "border-b border-gray-200 bg-gradient-to-r from-gray-50 to-white flex-shrink-0",
            isSidebarMinimized ? "p-2.5" : "p-3"
          )}>
            {!isSidebarMinimized ? (
              <div className="flex items-center justify-between gap-2">
                <Link to="/admin" className="flex items-center gap-2.5 group flex-1 min-w-0">
                  <div className="w-9 h-9 bg-gradient-to-br from-blue-600 to-blue-700 rounded-lg flex items-center justify-center shadow-sm group-hover:shadow-md transition-all duration-200 flex-shrink-0">
                    <svg
                      className="w-5 h-5 text-white"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                      />
                    </svg>
                  </div>
                  <h1 className="text-base font-bold text-gray-800 truncate">
                    GleentForm
                  </h1>
                </Link>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={toggleSidebar}
                  className="h-7 w-7 p-0 hover:bg-gray-200 rounded-md flex-shrink-0 transition-colors"
                  title="Minimize sidebar"
                  type="button"
                >
                  <ChevronLeft className="h-4 w-4 text-gray-600" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-1">
                <Link 
                  to="/admin" 
                  className="flex items-center justify-center flex-1 group"
                  title="GleentForm"
                >
                  <div className="w-9 h-9 bg-gradient-to-br from-blue-600 to-blue-700 rounded-lg flex items-center justify-center shadow-sm group-hover:shadow-md transition-all duration-200">
                    <svg
                      className="w-5 h-5 text-white"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                      />
                    </svg>
                  </div>
                </Link>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={toggleSidebar}
                  className="h-7 w-7 p-0 hover:bg-gray-200 rounded-md flex-shrink-0 transition-colors"
                  title="Expand sidebar"
                  type="button"
                >
                  <ChevronRight className="h-4 w-4 text-gray-600" />
                </Button>
              </div>
            )}
          </div>

          {/* Navigation Items */}
          <nav className={cn("overflow-y-auto pt-2", isSidebarMinimized ? "px-1.5" : "px-2")}>
            <div className={cn("space-y-1", isSidebarMinimized && "space-y-1.5")}>
              {navItems.map((item) => {
                const Icon = item.icon;
                // Determine active state: exact match or starts with for admin routes
                const isActive = location.pathname === item.href || 
                  (item.href === "/admin" && location.pathname === "/admin") ||
                  (item.href === "/" && location.pathname === "/") ||
                  (item.href !== "/admin" && item.href !== "/" && location.pathname.startsWith(item.href));
                
                return (
                  <Link
                    key={item.href}
                    to={item.href}
                    className={cn(
                      "flex items-center gap-2.5 rounded-lg transition-all duration-200 group",
                      isActive
                        ? "bg-blue-600 text-white shadow-sm"
                        : "text-gray-700 hover:bg-gray-100 hover:text-blue-600",
                      isSidebarMinimized ? "justify-center px-2 py-2.5" : "px-3 py-2.5"
                    )}
                    title={isSidebarMinimized ? item.title : undefined}
                  >
                    <Icon className={cn(
                      "flex-shrink-0 transition-colors",
                      isActive ? "text-white" : "text-gray-500 group-hover:text-blue-600",
                      isSidebarMinimized ? "w-5 h-5" : "w-5 h-5"
                    )} />
                    {!isSidebarMinimized && (
                      <span className={cn(
                        "font-medium text-base",
                        isActive ? "text-white" : "text-gray-700"
                      )}>
                        {item.title}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          </nav>
        </aside>

        {/* Main Content */}
        <main className={cn(
          "flex-1 px-4 sm:px-6 lg:px-8 py-8 transition-all duration-300 ease-in-out overflow-x-hidden pt-20",
          isSidebarMinimized ? "ml-16" : "ml-56"
        )}>
          <div className="max-w-full">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
