import React from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import RequireAuth from "@/routes/RequireAuth";
import RequireRole from "@/routes/RequireRole";
import AdminLayout from "@/layouts/AdminLayout";
import PublicLayout from "@/layouts/PublicLayout";

import LoginPage from "@/pages/auth/LoginPage";
import AdminDashboardPage from "@/pages/admin/AdminDashboardPage";
import AdminRestaurantsPage from "@/pages/admin/AdminRestaurantsPage";
import RestaurantManagePage from "@/pages/admin/RestaurantManagePage";
import AdminCategoriesPage from "@/pages/admin/AdminCategoriesPage";
import AdminDishesPage from "@/pages/admin/AdminDishesPage";
import AdminTablesPage from "@/pages/admin/AdminTablesPage";
import AdminUsersPage from "@/pages/admin/AdminUsersPage";

import PublicMenuPage from "@/pages/public/PublicMenuPage";
import TablePage from "@/pages/public/TablePage";
import QrPage from "@/pages/public/QrPage";
import NotFoundPage from "@/pages/NotFoundPage";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/admin" replace />} />

      <Route path="/login" element={<LoginPage />} />

      <Route element={<PublicLayout />}>
        <Route path="/r/:slug" element={<PublicMenuPage />} />
        <Route path="/r/:slug/table/:tableId" element={<TablePage />} />
        <Route path="/qr/:code" element={<QrPage />} />
      </Route>

      <Route element={<RequireAuth />}>
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<AdminDashboardPage />} />
          <Route path="restaurants" element={<AdminRestaurantsPage />} />
          <Route path="restaurants/:id/manage" element={<RestaurantManagePage />} />
          <Route path="categories" element={<AdminCategoriesPage />} />
          <Route path="dishes" element={<AdminDishesPage />} />
          <Route path="tables" element={<AdminTablesPage />} />
          <Route
            path="users"
            element={
              <RequireRole roles={["admin", "superadmin"]}>
                <AdminUsersPage />
              </RequireRole>
            }
          />
        </Route>
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}

