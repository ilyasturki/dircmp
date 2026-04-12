import React, { useState, useCallback } from "react";

interface HeaderProps {
  title: string;
}

interface NavItem {
  label: string;
  href: string;
  active?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { label: "Home", href: "/" },
  { label: "About", href: "/about" },
  { label: "Docs", href: "/docs" },
  { label: "Contact", href: "/contact" },
];

export function Header({ title }: HeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeItem, setActiveItem] = useState("/");

  const handleNavClick = useCallback(
    (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
      e.preventDefault();
      setActiveItem(href);
      setMenuOpen(false);
    },
    [],
  );

  return (
    <header className="header">
      <div className="header-brand">
        <h1>{title}</h1>
      </div>
      <button
        className="menu-toggle"
        onClick={() => setMenuOpen(!menuOpen)}
        aria-label="Toggle menu"
      >
        {menuOpen ? "✕" : "☰"}
      </button>
      <nav className={`header-nav ${menuOpen ? "open" : ""}`}>
        {NAV_ITEMS.map((item) => (
          <a
            key={item.href}
            href={item.href}
            className={activeItem === item.href ? "active" : ""}
            onClick={(e) => handleNavClick(e, item.href)}
          >
            {item.label}
          </a>
        ))}
      </nav>
      <div className="header-actions">
        <input
          type="search"
          placeholder="Search..."
          className="header-search"
        />
      </div>
    </header>
  );
}
