import { Navigate, Route, Routes } from "react-router-dom";
import { OrdersBoard } from "./pages/OrdersBoard";

export function App() {
  return (
    <div className="app-shell">
      <header className="app-header">
        <h2>🧊 Hielo Guala</h2>
      </header>
      <main className="app-content">
        <Routes>
          <Route path="/" element={<Navigate to="/orders" replace />} />
          <Route path="/orders" element={<OrdersBoard />} />
        </Routes>
      </main>
    </div>
  );
}
