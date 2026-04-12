import React, { useState, useCallback } from "react";

interface HeaderProps {
  title: string;
  subtitle?: string;
}

interface NavItem {
  label: string;
  href: string;
  icon?: string;
  active?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { label: "Home", href: "/", icon: "🏠" },
  { label: "About", href: "/about", icon: "ℹ️" },
  { label: "Docs", href: "/docs", icon: "📄" },
  { label: "Settings", href: "/settings", icon: "⚙️" },
  { label: "Contact", href: "/contact", icon: "✉️" },
];

export function Header({ title, subtitle }: HeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeItem, setActiveItem] = useState("/");
  const [searchQuery, setSearchQuery] = useState("");

  const handleNavClick = useCallback(
    (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
      e.preventDefault();
      setActiveItem(href);
      setMenuOpen(false);
    },
    [],
  );

  const handleSearch = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (searchQuery.trim()) {
        console.log("Search:", searchQuery);
      }
    },
    [searchQuery],
  );

  return (
    <header className="header">
      <div className="header-brand">
        <h1>{title}</h1>
        {subtitle && <span className="subtitle">{subtitle}</span>}
      </div>
      <button
        className="menu-toggle"
        onClick={() => setMenuOpen(!menuOpen)}
        aria-label="Toggle menu"
        aria-expanded={menuOpen}
      >
        {menuOpen ? "✕" : "☰"}
      </button>
      <nav className={`header-nav ${menuOpen ? "open" : ""}`} role="navigation">
        {NAV_ITEMS.map((item) => (
          <a
            key={item.href}
            href={item.href}
            className={activeItem === item.href ? "active" : ""}
            onClick={(e) => handleNavClick(e, item.href)}
          >
            {item.icon && <span className="nav-icon">{item.icon}</span>}
            {item.label}
          </a>
        ))}
      </nav>
      <div className="header-actions">
        <form onSubmit={handleSearch}>
          <input
            type="search"
            placeholder="Search..."
            className="header-search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </form>
      </div>
    </header>
  );
}
