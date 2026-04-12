import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Header } from "./Header";
import { Sidebar } from "./Sidebar";
import { Footer } from "./Footer";

interface AppProps {
  debug: boolean;
  port: number;
}

interface Notification {
  id: string;
  message: string;
  type: "info" | "success" | "warning" | "error";
  dismissable: boolean;
}

function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const addNotification = useCallback(
    (
      message: string,
      type: Notification["type"] = "info",
      dismissable = true,
    ) => {
      const id = Math.random().toString(36).slice(2);
      setNotifications((prev) => [...prev, { id, message, type, dismissable }]);

      if (type !== "error") {
        setTimeout(() => {
          setNotifications((prev) => prev.filter((n) => n.id !== id));
        }, 5000);
      }
    },
    [],
  );

  const dismissNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const clearAll = useCallback(() => {
    setNotifications([]);
  }, []);

  return { notifications, addNotification, dismissNotification, clearAll };
}

interface DataItem {
  id: string;
  label: string;
  category: string;
}

export function App({ debug, port }: AppProps) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<DataItem[]>([]);
  const [filter, setFilter] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const { notifications, addNotification, dismissNotification, clearAll } =
    useNotifications();

  const filteredData = useMemo(() => {
    if (!filter) return data;
    const lower = filter.toLowerCase();
    return data.filter(
      (item) =>
        item.label.toLowerCase().includes(lower) ||
        item.category.toLowerCase().includes(lower),
    );
  }, [data, filter]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setData([
        { id: "1", label: "Item 1", category: "A" },
        { id: "2", label: "Item 2", category: "A" },
        { id: "3", label: "Item 3", category: "B" },
        { id: "4", label: "Item 4", category: "B" },
        { id: "5", label: "Item 5", category: "C" },
      ]);
      setLoading(false);
    }, 1000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (debug) {
      console.log(`App mounted in debug mode on port ${port}`);
      console.log(`Data items: ${data.length}`);
    }
  }, [debug, port, data.length]);

  const handleRefresh = useCallback(() => {
    setLoading(true);
    setError(null);
    setFilter("");
    setTimeout(() => {
      setData([
        { id: "1", label: "Item 1", category: "A" },
        { id: "2", label: "Item 2", category: "A" },
        { id: "3", label: "Item 3", category: "B" },
        { id: "4", label: "Item 4", category: "B" },
        { id: "5", label: "Item 5", category: "C" },
        { id: "6", label: "Item 6", category: "C" },
      ]);
      setLoading(false);
      addNotification("Data refreshed successfully", "success");
    }, 500);
  }, [addNotification]);

  if (error) {
    return (
      <div className="app error-state">
        <Header title="My App" subtitle={`Port: ${port}`} />
        <main>
          <p className="error">{error}</p>
          <button onClick={handleRefresh}>Retry</button>
        </main>
      </div>
    );
  }

  return (
    <div className="app">
      <Header title="My App" subtitle={`Port: ${port}`} />
      {notifications.length > 0 && (
        <div className="notifications">
          {notifications.map((n) => (
            <div key={n.id} className={`notification ${n.type}`}>
              <span>{n.message}</span>
              {n.dismissable && (
                <button onClick={() => dismissNotification(n.id)}>×</button>
              )}
            </div>
          ))}
          {notifications.length > 1 && (
            <button className="clear-all" onClick={clearAll}>
              Clear all
            </button>
          )}
        </div>
      )}
      <div className="layout">
        {sidebarOpen && <Sidebar />}
        <main>
          <div className="toolbar">
            <input
              type="text"
              placeholder="Filter items..."
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
            <button onClick={() => setSidebarOpen(!sidebarOpen)}>
              {sidebarOpen ? "Hide" : "Show"} Sidebar
            </button>
          </div>
          {loading ? (
            <p>Loading...</p>
          ) : (
            <>
              <p className="count">
                Showing {filteredData.length} of {data.length} items
              </p>
              <ul>
                {filteredData.map((item) => (
                  <li key={item.id}>
                    <span className="label">{item.label}</span>
                    <span className="category">{item.category}</span>
                  </li>
                ))}
              </ul>
              <button onClick={handleRefresh}>Refresh</button>
            </>
          )}
        </main>
      </div>
      <Footer />
    </div>
  );
}
