import { NavLink, Navigate, Route, Routes } from "react-router-dom";
import { IconInbox, IconTag, IconTrendingUp, IconUsers } from "./components/icons";
import { CustomersPage } from "./pages/CustomersPage";
import { OrdersBoard } from "./pages/OrdersBoard";
import { ProductsAdmin } from "./pages/ProductsAdmin";
import { SalesMetrics } from "./pages/SalesMetrics";

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  isActive ? "nav-link nav-link-active" : "nav-link";

export function App() {
  return (
    <div className="app-shell">
      <aside className="app-sidebar">
        <div className="brand">
          <img src="/logo-fox.png" alt="" className="brand-mark" width={34} height={34} />
          <span className="brand-word">Hielo Guala</span>
        </div>
        <nav className="app-nav">
          <NavLink to="/orders" className={navLinkClass}>
            <IconInbox width={17} height={17} />
            <span>Pedidos</span>
          </NavLink>
          <NavLink to="/products" className={navLinkClass}>
            <IconTag width={17} height={17} />
            <span>Productos</span>
          </NavLink>
          <NavLink to="/customers" className={navLinkClass}>
            <IconUsers width={17} height={17} />
            <span>Clientes</span>
          </NavLink>
          <NavLink to="/metrics" className={navLinkClass}>
            <IconTrendingUp width={17} height={17} />
            <span>Métricas</span>
          </NavLink>
        </nav>
        <div className="sidebar-footer">Gestión de pedidos</div>
      </aside>
      <main className="app-content">
        <div className="app-content-inner">
          <Routes>
            <Route path="/" element={<Navigate to="/orders" replace />} />
            <Route path="/orders" element={<OrdersBoard />} />
            <Route path="/products" element={<ProductsAdmin />} />
            <Route path="/customers" element={<CustomersPage />} />
            <Route path="/metrics" element={<SalesMetrics />} />
          </Routes>
        </div>
      </main>
    </div>
  );
}
