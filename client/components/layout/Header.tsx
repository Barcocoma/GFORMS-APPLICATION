import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Plus, LogOut, User, Settings, FileText, Search } from "lucide-react";
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

export function Header() {
  const location = useLocation();
  const isCreatePage = location.pathname === "/create";
  const isIndexPage = location.pathname === "/";
  const isAdminPage = location.pathname.startsWith("/admin");
  const isFormDetailPage = location.pathname.startsWith("/forms/");
  const { user, logout } = useAuth();
  const [searchValue, setSearchValue] = useState("");

  const handleLogout = () => {
    logout();
    window.location.href = "/login";
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

  return (
    <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-200/50 shadow-sm">
      <div className="max-w-full px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
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
            <div>
              <h1 className="text-xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
                GleentForm
              </h1>
            </div>
          </div>
        </Link>

        {/* Search in header (only on Your Forms page) */}
        {isIndexPage && (
          <div className="hidden md:block flex-1 max-w-xl mx-6">
            <div className="relative">
              <span className="absolute inset-y-0 left-3 flex items-center text-gray-400">
                <Search className="w-4 h-4" />
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
                className="w-full rounded-full border border-gray-200 bg-white pl-9 pr-4 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary placeholder:text-gray-400"
              />
            </div>
          </div>
        )}

        <div className="flex items-center gap-3">
        {!isCreatePage && !isIndexPage && !isFormDetailPage && (
          <Link to={buttonConfig.link}>
            <Button className="bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary text-white gap-2 shadow-md hover:shadow-lg transition-all duration-200">
              {buttonConfig.icon}
              <span className="hidden sm:inline">{buttonConfig.text}</span>
            </Button>
          </Link>
        )}
          {user && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="gap-2 border-gray-300 hover:bg-gray-50">
                  <User className="w-4 h-4" />
                  <span className="hidden sm:inline font-medium">{user.username}</span>
                  <Badge variant={user.role === 'admin' ? 'default' : 'secondary'} className="ml-1">
                    {user.role}
                  </Badge>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div className="flex flex-col">
                    <span className="font-semibold">{user.username}</span>
                    <span className="text-xs text-gray-500 font-normal">{user.role}</span>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {user?.role === 'admin' && (
                  <>
                    <Link to="/admin">
                      <DropdownMenuItem className="cursor-pointer">
                        <Settings className="mr-2 h-4 w-4" />
                        <span>Admin Dashboard</span>
                      </DropdownMenuItem>
                    </Link>
                    <DropdownMenuSeparator />
                  </>
                )}
                <DropdownMenuItem onClick={handleLogout} className="cursor-pointer text-red-600 focus:text-red-600">
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Logout</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
    </header>
  );
}
