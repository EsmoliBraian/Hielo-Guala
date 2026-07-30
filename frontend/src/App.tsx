import { NavLink, Navigate, Route, Routes } from "react-router-dom";
import { OrdersBoard } from "./pages/OrdersBoard";
import { ProductsAdmin } from "./pages/ProductsAdmin";
import { SalesMetrics } from "./pages/SalesMetrics";

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  isActive ? "nav-link nav-link-active" : "nav-link";

export function App() {
  return (
    <div className="app-shell">
      <header className="app-header">
        <h2>🧊 Hielo Guala</h2>
        <nav className="app-nav">
          <NavLink to="/orders" className={navLinkClass}>
            Pedidos
          </NavLink>
          <NavLink to="/products" className={navLinkClass}>
            Productos
          </NavLink>
          <NavLink to="/metrics" className={navLinkClass}>
            Métricas
          </NavLink>
        </nav>
      </header>
      <main className="app-content">
        <Routes>
          <Route path="/" element={<Navigate to="/orders" replace />} />
          <Route path="/orders" element={<OrdersBoard />} />
          <Route path="/products" element={<ProductsAdmin />} />
          <Route path="/metrics" element={<SalesMetrics />} />
        </Routes>
      </main>
    </div>
  );
}
