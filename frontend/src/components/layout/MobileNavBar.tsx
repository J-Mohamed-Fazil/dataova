import React from 'react';
import {
  LayoutDashboard,
  LineChart,
  BotMessageSquare,
  Lightbulb,
  Menu,
  Sparkles
} from 'lucide-react';
import { useWorkspace, ActiveTab } from '../../store/workspaceContext';

interface MobileNavBarProps {
  onToggleMobileMenu: () => void;
  isMobileMenuOpen: boolean;
}

export const MobileNavBar: React.FC<MobileNavBarProps> = ({
  onToggleMobileMenu,
  isMobileMenuOpen
}) => {
  const { activeTab, setActiveTab } = useWorkspace();

  const navItems: Array<{ tab: ActiveTab; label: string; icon: React.ReactNode }> = [
    { tab: 'overview', label: 'Overview', icon: <LayoutDashboard className="w-5 h-5" /> },
    { tab: 'dashboard', label: 'Dashboard', icon: <LineChart className="w-5 h-5" /> },
    { tab: 'chat', label: 'Ask AI', icon: <BotMessageSquare className="w-5 h-5 text-cyan-400" /> },
    { tab: 'insights', label: 'Insights', icon: <Lightbulb className="w-5 h-5 text-amber-400" /> },
  ];

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 bg-[#060D1F]/92 backdrop-blur-xl border-t border-cyan-500/20 px-2 sm:px-4 pt-1.5 pb-[max(0.65rem,env(safe-area-inset-bottom,12px))] md:hidden flex items-center justify-around select-none shadow-[0_-8px_30px_rgba(0,0,0,0.7)]"
      aria-label="Mobile Navigation Bar"
    >
      {/* Top Cyber Accent Line */}
      <div className="absolute top-0 left-0 right-0 h-[1.5px] bg-gradient-to-r from-transparent via-cyan-400/60 to-transparent pointer-events-none" />

      {navItems.map((item) => {
        const isActive = activeTab === item.tab && !isMobileMenuOpen;
        return (
          <button
            key={item.tab}
            type="button"
            onClick={() => setActiveTab(item.tab)}
            className={`flex-1 max-w-[76px] flex flex-col items-center justify-center py-1 px-1 rounded-2xl relative transition-all duration-150 active:scale-90 ${
              isActive
                ? 'text-cyan-300 font-bold'
                : 'text-slate-400 hover:text-white font-medium'
            }`}
          >
            {isActive && (
              <span className="mobile-tab-indicator absolute -top-1.5 w-8 h-1 rounded-full bg-gradient-to-r from-cyan-400 to-blue-500 shadow-[0_0_10px_#22d3ee]" />
            )}
            <div
              className={`p-1.5 rounded-xl transition-all duration-200 ${
                isActive
                  ? 'bg-gradient-to-tr from-cyan-500/25 to-blue-600/25 text-cyan-300 border border-cyan-500/40 shadow-[0_0_12px_rgba(6,182,212,0.35)]'
                  : 'hover:bg-slate-800/40'
              }`}
            >
              {item.icon}
            </div>
            <span className="text-[10px] tracking-tight mt-0.5 font-medium truncate max-w-full">
              {item.label}
            </span>
          </button>
        );
      })}

      {/* Menu / Full Modules Drawer Toggle Button */}
      <button
        type="button"
        onClick={onToggleMobileMenu}
        className={`flex-1 max-w-[76px] flex flex-col items-center justify-center py-1 px-1 rounded-2xl relative transition-all duration-150 active:scale-90 ${
          isMobileMenuOpen
            ? 'text-cyan-300 font-bold'
            : 'text-slate-400 hover:text-white font-medium'
        }`}
        aria-label="Toggle Navigation Drawer"
      >
        {isMobileMenuOpen && (
          <span className="mobile-tab-indicator absolute -top-1.5 w-8 h-1 rounded-full bg-gradient-to-r from-cyan-400 to-blue-500 shadow-[0_0_10px_#22d3ee]" />
        )}
        <div
          className={`p-1.5 rounded-xl transition-all duration-200 ${
            isMobileMenuOpen
              ? 'bg-gradient-to-tr from-cyan-500/25 to-blue-600/25 text-cyan-300 border border-cyan-500/40 shadow-[0_0_12px_rgba(6,182,212,0.35)]'
              : 'hover:bg-slate-800/40'
          }`}
        >
          <Menu className="w-5 h-5" />
        </div>
        <span className="text-[10px] tracking-tight mt-0.5 font-medium">Menu</span>
      </button>
    </nav>
  );
};
