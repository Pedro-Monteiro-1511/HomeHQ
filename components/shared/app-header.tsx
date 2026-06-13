import { Home, LogOut, Menu, Moon, Sun } from "lucide-react";
import type { Theme } from "@/types/homehq";

type AppHeaderProps = {
  theme: Theme;
  onToggleTheme: () => void;
  onLogout: () => void;
  loading?: boolean;
  onToggleMenu?: () => void;
  menuOpen?: boolean;
};

export function AppHeader({ theme, onToggleTheme, onLogout, loading = false, onToggleMenu, menuOpen }: AppHeaderProps) {
  return <header className="dashboard-header">
    <div className="header-leading">
      {onToggleMenu && <button className="icon-button header-menu-button" onClick={onToggleMenu} aria-label={menuOpen ? "Fechar menu da casa" : "Abrir menu da casa"} aria-expanded={menuOpen}><Menu size={20} /></button>}
      <div className="dashboard-brand"><Home size={20} /> HomeHQ</div>
    </div>
    <div className="header-actions">
      <ThemeButton theme={theme} onToggle={onToggleTheme} />
      <button className="icon-button logout" onClick={onLogout} disabled={loading} aria-label="Terminar sessão"><LogOut size={19} /></button>
    </div>
  </header>;
}

export function ThemeButton({ theme, onToggle }: { theme: Theme; onToggle: () => void }) {
  return <button className="icon-button theme-button" onClick={onToggle} aria-label={theme === "light" ? "Ativar modo escuro" : "Ativar modo claro"}>{theme === "light" ? <Moon size={18} /> : <Sun size={18} />}</button>;
}
