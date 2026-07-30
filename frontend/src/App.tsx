import { NavLink, Navigate, Route, Routes } from "react-router-dom";
import { IconInbox, IconTag, IconTrendingUp } from "./components/icons";
import { OrdersBoard } from "./pages/OrdersBoard";
import { ProductsAdmin } from "./pages/ProductsAdmin";
import { SalesMetrics } from "./pages/SalesMetrics";

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  isActive ? "nav-link nav-link-active" : "nav-link";

export function App() {
  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-header-inner">
          <div className="brand">
            <img src="/logo-fox.png" alt="" className="brand-mark" width={34} height={34} />
            <span className="brand-word">Hielo Guala</span>
          </div>
          <nav className="app-nav">
            <NavLink to="/orders" className={navLinkClass}>
              <IconInbox width={16} height={16} />
              <span>Pedidos</span>
            </NavLink>
            <NavLink to="/products" className={navLinkClass}>
              <IconTag width={16} height={16} />
              <span>Productos</span>
            </NavLink>
            <NavLink to="/metrics" className={navLinkClass}>
              <IconTrendingUp width={16} height={16} />
              <span>Métricas</span>
            </NavLink>
          </nav>
        </div>
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
