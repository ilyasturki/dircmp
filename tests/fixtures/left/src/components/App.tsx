import React, { useState, useEffect, useCallback } from "react";
import { Header } from "./Header";
import { Footer } from "./Footer";

interface AppProps {
  debug: boolean;
}

interface Notification {
  id: string;
  message: string;
  type: "info" | "warning" | "error";
}

function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const addNotification = useCallback(
    (message: string, type: Notification["type"] = "info") => {
      const id = Math.random().toString(36).slice(2);
      setNotifications((prev) => [...prev, { id, message, type }]);
    },
    [],
  );

  const dismissNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  return { notifications, addNotification, dismissNotification };
}

export function App({ debug }: AppProps) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const { notifications, addNotification, dismissNotification } =
    useNotifications();

  useEffect(() => {
    const timer = setTimeout(() => {
      setData(["Item 1", "Item 2", "Item 3"]);
      setLoading(false);
    }, 1000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (debug) {
      console.log("App mounted in debug mode");
    }
  }, [debug]);

  const handleRefresh = useCallback(() => {
    setLoading(true);
    setError(null);
    setTimeout(() => {
      setData(["Item 1", "Item 2", "Item 3", "Item 4"]);
      setLoading(false);
      addNotification("Data refreshed successfully");
    }, 500);
  }, [addNotification]);

  if (error) {
    return (
      <div className="app error-state">
        <Header title="My App" />
        <main>
          <p className="error">{error}</p>
          <button onClick={handleRefresh}>Retry</button>
        </main>
      </div>
    );
  }

  return (
    <div className="app">
      <Header title="My App" />
      <div className="notifications">
        {notifications.map((n) => (
          <div key={n.id} className={`notification ${n.type}`}>
            <span>{n.message}</span>
            <button onClick={() => dismissNotification(n.id)}>×</button>
          </div>
        ))}
      </div>
      <main>
        {loading ? (
          <p>Loading...</p>
        ) : (
          <>
            <ul>
              {data.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
            <button onClick={handleRefresh}>Refresh</button>
          </>
        )}
      </main>
      <Footer />
    </div>
  );
}
