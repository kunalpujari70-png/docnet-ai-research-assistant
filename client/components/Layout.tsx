import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';

interface LayoutProps {
  children: React.ReactNode;
  currentPage?: string;
}

export default function Layout({ children, currentPage = 'home' }: LayoutProps) {
  const { user, signOut } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Check if device is mobile and set initial sidebar state
  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth <= 768;
      setIsMobile(mobile);
      setSidebarOpen(!mobile); // Open on desktop, closed on mobile
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const handleLogout = async () => {
    await signOut();
  };

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  return (
    <div className="flex flex-col h-screen bg-white">
      {/* Fixed Header */}
      <header className="fixed top-0 w-full z-10 bg-white border-b border-gray-200 h-16">
        <div className="max-w-7xl mx-auto px-4 h-full flex items-center justify-between">
          {/* Logo and Brand */}
          <div className="flex items-center gap-3">
            <a href="/" className="flex items-center gap-3 text-gray-900 font-semibold text-xl">
              <div className="w-8 h-8 text-blue-600">
                <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M14 2H6C4.9 2 4 2.9 4 4V20C4 21.1 4.9 22 6 22H18C19.1 22 20 21.1 20 20V8L14 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M14 2V8H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M16 13H8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M16 17H8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M10 9H8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <circle cx="18" cy="18" r="3" stroke="currentColor" strokeWidth="2"/>
                  <path d="M18 16V20" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  <path d="M16 18H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </div>
              <span className="font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                DocNet
              </span>
            </a>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-4">
            <a 
              href="/" 
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                currentPage === 'home' 
                  ? 'text-blue-600 bg-blue-50' 
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M3 9L12 2L21 9V20C21 20.5304 20.7893 21.0391 20.4142 21.4142C20.0391 21.7893 19.5304 22 19 22H5C4.46957 22 3.96086 21.7893 3.58579 21.4142C3.21071 21.0391 3 20.5304 3 20V9Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <polyline points="9,22 9,12 15,12 15,22" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <span>Chat</span>
            </a>
            
            <a 
              href="/upload" 
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                currentPage === 'upload' 
                  ? 'text-blue-600 bg-blue-50' 
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M14 2H6C4.9 2 4 2.9 4 4V20C4 21.1 4.9 22 6 22H18C19.1 22 20 21.1 20 20V8L14 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M14 2V8H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M16 13H8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M16 17H8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M10 9H8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <span>Upload</span>
            </a>
            
            <a 
              href="/settings" 
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                currentPage === 'settings' 
                  ? 'text-blue-600 bg-blue-50' 
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2"/>
                <path d="M19.4 15A1.65 1.65 0 0 0 18 14.63C18 13.83 17.17 13 16.37 13C15.57 13 14.74 13.83 14.74 14.63C14.74 15.43 15.57 16.26 16.37 16.26C17.17 16.26 18 15.43 18 14.63" stroke="currentColor" strokeWidth="2"/>
                <path d="M2.21 10.6C2.21 9.8 3.04 8.97 3.84 8.97C4.64 8.97 5.47 9.8 5.47 10.6C5.47 11.4 4.64 12.23 3.84 12.23C3.04 12.23 2.21 11.4 2.21 10.6" stroke="currentColor" strokeWidth="2"/>
                <path d="M2.21 3.4C2.21 2.6 3.04 1.77 3.84 1.77C4.64 1.77 5.47 2.6 5.47 3.4C5.47 4.2 4.64 5.03 3.84 5.03C3.04 5.03 2.21 4.2 2.21 3.4" stroke="currentColor" strokeWidth="2"/>
                <path d="M10.6 2.21C10.6 1.41 11.43 0.58 12.23 0.58C13.03 0.58 13.86 1.41 13.86 2.21C13.86 3.01 13.03 3.84 12.23 3.84C11.43 3.84 10.6 3.01 10.6 2.21" stroke="currentColor" strokeWidth="2"/>
                <path d="M18.6 2.21C18.6 1.41 19.43 0.58 20.23 0.58C21.03 0.58 21.86 1.41 21.86 2.21C21.86 3.01 21.03 3.84 20.23 3.84C19.43 3.84 18.6 3.01 18.6 2.21" stroke="currentColor" strokeWidth="2"/>
                <path d="M21.79 10.6C21.79 9.8 20.96 8.97 20.16 8.97C19.36 8.97 18.53 9.8 18.53 10.6C18.53 11.4 19.36 12.23 20.16 12.23C20.96 12.23 21.79 11.4 21.79 10.6" stroke="currentColor" strokeWidth="2"/>
                <path d="M21.79 17.4C21.79 16.6 20.96 15.77 20.16 15.77C19.36 15.77 18.53 16.6 18.53 17.4C18.53 18.2 19.36 19.03 20.16 19.03C20.96 19.03 21.79 18.2 21.79 17.4" stroke="currentColor" strokeWidth="2"/>
                <path d="M10.6 21.79C10.6 20.99 11.43 20.16 12.23 20.16C13.03 20.16 13.86 20.99 13.86 21.79C13.86 22.59 13.03 23.42 12.23 23.42C11.43 23.42 10.6 22.59 10.6 21.79" stroke="currentColor" strokeWidth="2"/>
                <path d="M3.4 21.79C3.4 20.99 4.23 20.16 5.03 20.16C5.83 20.16 6.66 20.99 6.66 21.79C6.66 22.59 5.83 23.42 5.03 23.42C4.23 23.42 3.4 22.59 3.4 21.79" stroke="currentColor" strokeWidth="2"/>
              </svg>
              <span>Settings</span>
            </a>
          </nav>

          {/* User Section */}
          <div className="flex items-center gap-4">
            {user ? (
              <div className="flex items-center gap-3">
                <div className="hidden sm:flex items-center gap-2">
                  <span className="text-sm text-gray-700 truncate max-w-[200px]">{user.email}</span>
                  {user.isGuest && (
                    <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">
                      Guest
                    </span>
                  )}
                </div>
                <button 
                  onClick={handleLogout}
                  className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-red-600 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M9 21H5C4.46957 21 3.96086 20.7893 3.58579 20.4142C3.21071 20.0391 3 19.5304 3 19V5C3 4.46957 3.21071 3.96086 3.58579 3.58579C3.96086 3.21071 4.46957 3 5 3H9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M16 17L21 12L16 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M21 12H9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  <span className="hidden sm:inline">Sign Out</span>
                </button>
              </div>
            ) : (
              <a 
                href="/signin" 
                className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-blue-600 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M15 3H19C19.5304 3 20.0391 3.21071 20.4142 3.58579C20.7893 3.96086 21 4.46957 21 5V19C21 19.5304 20.7893 20.0391 20.4142 20.4142C20.0391 20.7893 19.5304 21 19 21H15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M10 17L15 12L10 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M15 12H3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <span className="hidden sm:inline">Sign In</span>
              </a>
            )}

            {/* Mobile Menu Button */}
            <button 
              className="md:hidden flex items-center justify-center w-10 h-10 text-gray-600 bg-gray-100 border border-gray-200 rounded-lg hover:bg-gray-200 transition-colors"
              onClick={toggleSidebar}
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M3 12H21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M3 6H21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M3 18H21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex flex-1 pt-16">
        {/* Sidebar */}
        <aside className={`${
          isMobile 
            ? 'fixed top-16 left-0 bottom-0 z-20 w-80 transform transition-transform duration-200 ease-in-out' 
            : 'hidden md:flex md:w-72 shrink-0'
        } ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } bg-gray-50 border-r border-gray-200 flex flex-col`}>
          <div className="flex flex-col h-full">
            <div className="p-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-900">Chat History</h3>
                <button className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-white bg-blue-600 rounded hover:bg-blue-700 transition-colors">
                  <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="12" y1="5" x2="12" y2="19"/>
                    <line x1="5" y1="12" x2="19" y2="12"/>
                  </svg>
                  New
                </button>
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4">
              {/* Chat sessions will be rendered here */}
              <div className="space-y-2">
                <div className="p-3 bg-white border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                  <div className="text-sm font-medium text-gray-900">New Chat</div>
                  <div className="text-xs text-gray-500">Start a new conversation</div>
                </div>
              </div>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex flex-col flex-1 min-w-0 bg-white">
          {children}
        </main>
      </div>

      {/* Mobile Sidebar Overlay */}
      {isMobile && sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-10" 
          onClick={toggleSidebar}
        />
      )}
    </div>
  );
}
