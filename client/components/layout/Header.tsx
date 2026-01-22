import { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Plus, LogOut, User, Settings, FileText, Search, Bell, Check, CheckCheck, UserCircle, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
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
import { Separator } from "@/components/ui/separator";

interface Notification {
  id: number;
  form_id: number;
  submission_id: number;
  message: string;
  is_read: boolean;
  created_at: string;
  form_title?: string;
}

interface HeaderProps {
  isSidebarMinimized?: boolean;
  onToggleSidebar?: () => void;
}

export function Header({ isSidebarMinimized, onToggleSidebar }: HeaderProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const isCreatePage = location.pathname === "/create";
  const isIndexPage = location.pathname === "/";
  const isAdminPage = location.pathname.startsWith("/admin");
  const isFormDetailPage = location.pathname.startsWith("/forms/");
  const isProfilePage = location.pathname === "/profile";
  const { user, logout, token } = useAuth();
  const [searchValue, setSearchValue] = useState("");
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [eventSource, setEventSource] = useState<EventSource | null>(null);

  const handleLogout = () => {
    logout();
    window.location.href = "/login";
  };

  // Fetch notifications
  const fetchNotifications = async () => {
    if (!token) return;
    
    try {
      const response = await fetch('/api/notifications', {
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

  // Fetch unread count
  const fetchUnreadCount = async () => {
    if (!token) return;
    
    try {
      const response = await fetch('/api/notifications/unread-count', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setUnreadCount(data.count || 0);
      }
    } catch (error) {
      console.error('Error fetching unread count:', error);
    }
  };

  // Mark notification as read
  const markAsRead = async (notificationId: number) => {
    if (!token) return;
    
    try {
      const response = await fetch(`/api/notifications/${notificationId}/read`, {
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
      const response = await fetch('/api/notifications/read-all', {
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

  // Setup real-time notifications using Server-Sent Events
  useEffect(() => {
    if (token) {
      // Fetch initial notifications
      fetchNotifications();
      
      // Setup SSE connection for real-time updates
      // Note: EventSource doesn't support custom headers, so we pass token as query param
      const eventSourceUrl = `/api/notifications/stream?token=${encodeURIComponent(token)}`;
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
            // Add new notification to the list
            setNotifications(prev => [data, ...prev]);
            setUnreadCount(prev => prev + 1);
            
            // Show browser notification if permission granted
            if ('Notification' in window && Notification.permission === 'granted') {
              new Notification('New Form Submission', {
                body: data.message,
                icon: '/favicon.ico'
              });
            }
            
            // Refresh notifications list to get latest
            fetchNotifications();
          } else if (data.type === 'notification_read') {
            // Update notification as read
            setNotifications(prev => 
              prev.map(n => n.id === data.id ? { ...n, is_read: true } : n)
            );
            setUnreadCount(prev => Math.max(0, prev - 1));
          } else if (data.type === 'all_notifications_read') {
            // Mark all as read
            setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
            setUnreadCount(0);
          }
        } catch (error) {
          console.error('Error parsing SSE message:', error);
        }
      };
      
      es.onerror = (error) => {
        console.error('SSE error:', error);
        // Reconnect after 3 seconds
        setTimeout(() => {
          if (es.readyState === EventSource.CLOSED) {
            es.close();
            setEventSource(null);
          }
        }, 3000);
      };
      
      setEventSource(es);
      
      // Request browser notification permission
      if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
      }
      
      return () => {
        es.close();
        setEventSource(null);
      };
    } else {
      // Close connection if no token
      if (eventSource) {
        eventSource.close();
        setEventSource(null);
      }
    }
  }, [token]);

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

  // Determine button text and link based on user role and location
  const getButtonConfig = () => {
    if (user?.role === 'admin' && isAdminPage) {
      return {
        text: "Go to Forms",
        link: "/",
        icon: <FileText className="w-4 h-4" />
      };
    }
    return {
      text: "Create Form",
      link: "/create",
      icon: <Plus className="w-4 h-4" />
    };
  };

  const buttonConfig = getButtonConfig();
  
  // Don't show Create Form button on profile page
  const shouldShowCreateButton = !isCreatePage && !isIndexPage && !isFormDetailPage && !isAdminPage && !isProfilePage;

  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-gray-200/60 shadow-sm">
      <div className="max-w-full px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between text-slate-900">
        <Link to={user?.role === 'admin' && isAdminPage ? "/admin" : "/"} className="flex items-center gap-3 group">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 bg-gradient-to-br from-primary to-primary/80 rounded-xl flex items-center justify-center shadow-md group-hover:shadow-lg transition-shadow duration-200">
              <svg
                className="w-6 h-6 text-white"
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
            {(!isAdminPage || !isSidebarMinimized) && (
              <div>
                <h1 className="text-xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">
                  GleentForm
                </h1>
              </div>
            )}
            {isAdminPage && onToggleSidebar && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onToggleSidebar}
                className="h-8 w-8 p-0 hover:bg-gray-100"
              >
                {isSidebarMinimized ? (
                  <ChevronRight className="h-4 w-4" />
                ) : (
                  <ChevronLeft className="h-4 w-4" />
                )}
              </Button>
            )}
          </div>
        </Link>

        {/* Search in header (only on Your Forms page) */}
        {isIndexPage && (
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

        <div className="flex items-center gap-3">
        {shouldShowCreateButton && (
          <Link to={buttonConfig.link}>
            <Button className="bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary text-white gap-2 shadow-md hover:shadow-lg transition-all duration-200">
              {buttonConfig.icon}
              <span className="hidden sm:inline">{buttonConfig.text}</span>
            </Button>
          </Link>
        )}
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
                    // Don't close if interacting with trigger or notification content
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
                            className={`px-4 py-3 hover:bg-gray-50 cursor-pointer transition-colors ${
                              !notification.is_read ? 'bg-blue-50/50' : ''
                            }`}
                            onClick={() => handleNotificationClick(notification)}
                            onMouseDown={(e) => {
                              // Prevent dropdown from closing when clicking
                              e.preventDefault();
                            }}
                            data-notification-content
                          >
                            <div className="flex items-start gap-3">
                              <div className={`flex-1 min-w-0 ${!notification.is_read ? 'font-medium' : ''}`}>
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
                    // Don't close if interacting with trigger
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
  );
}
