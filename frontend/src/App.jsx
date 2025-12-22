import React, { Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import RequireAuth from "@/routes/RequireAuth";
import RequireRole from "@/routes/RequireRole";
import AdminLayout from "@/layouts/AdminLayout";
import PublicLayout from "@/layouts/PublicLayout";

import { LoadingPageSkeleton } from "@/components/LoadingSkeleton";

const LoginPage = React.lazy(() => import("@/pages/auth/LoginPage"));
const AdminDashboardPage = React.lazy(() => import("@/pages/admin/AdminDashboardPage"));
const AdminRestaurantsPage = React.lazy(() => import("@/pages/admin/AdminRestaurantsPage"));
const AdminCategoriesPage = React.lazy(() => import("@/pages/admin/AdminCategoriesPage"));
const AdminDishesPage = React.lazy(() => import("@/pages/admin/AdminDishesPage"));
const AdminTablesPage = React.lazy(() => import("@/pages/admin/AdminTablesPage"));
const AdminUsersPage = React.lazy(() => import("@/pages/admin/AdminUsersPage"));
const ThemesPage = React.lazy(() => import("@/pages/admin/ThemesPage"));
const RestaurantSettingsLayout = React.lazy(() => import("@/pages/admin/restaurants/RestaurantSettingsLayout"));
const GeneralSettings = React.lazy(() => import("@/pages/admin/restaurants/sections/GeneralSettings"));
const ThemeColorsSettings = React.lazy(() => import("@/pages/admin/restaurants/sections/ThemeColorsSettings"));
const CardsSettings = React.lazy(() => import("@/pages/admin/restaurants/sections/CardsSettings"));
const HeaderSettings = React.lazy(() => import("@/pages/admin/restaurants/sections/HeaderSettings"));
const TypographySettings = React.lazy(() => import("@/pages/admin/restaurants/sections/TypographySettings"));
const PagesLayoutSettings = React.lazy(() => import("@/pages/admin/restaurants/sections/PagesLayoutSettings"));
const TranslationsSettings = React.lazy(() => import("@/pages/admin/restaurants/sections/TranslationsSettings"));

const PublicMenuPage = React.lazy(() => import("@/pages/public/PublicMenuPage"));
const TablePage = React.lazy(() => import("@/pages/public/TablePage"));
const QrPage = React.lazy(() => import("@/pages/public/QrPage"));
const NotFoundPage = React.lazy(() => import("@/pages/NotFoundPage"));

export default function App() {
  return (
    <Suspense fallback={<LoadingPageSkeleton />}>
      <Routes>
        <Route path="/" element={<Navigate to="/admin" replace />} />

        <Route path="/login" element={<LoginPage />} />

        <Route element={<PublicLayout />}>
          <Route path="/r/:slug/*" element={<PublicMenuPage />} />
          <Route path="/r/:slug/table/:tableId/*" element={<TablePage />} />
          <Route path="/qr/:code" element={<QrPage />} />
        </Route>

        <Route element={<RequireAuth />}>
          <Route path="/admin/restaurants/:id/settings" element={<RestaurantSettingsLayout />}>
            <Route index element={<Navigate to="general" replace />} />
            <Route path="general" element={<GeneralSettings />} />
            <Route path="theme" element={<ThemeColorsSettings />} />
            <Route path="cards" element={<CardsSettings />} />
            <Route path="header" element={<HeaderSettings />} />
            <Route path="fonts" element={<TypographySettings />} />
            <Route path="pages" element={<PagesLayoutSettings />} />
            <Route path="translations" element={<TranslationsSettings />} />
          </Route>

          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<AdminDashboardPage />} />
            <Route path="restaurants" element={<AdminRestaurantsPage />} />
            <Route path="restaurants/:id/manage" element={<Navigate to="../settings/general" replace />} />
            <Route path="categories" element={<AdminCategoriesPage />} />
            <Route path="dishes" element={<AdminDishesPage />} />
            <Route path="tables" element={<AdminTablesPage />} />
            <Route
              path="themes"
              element={
                <RequireRole roles={["admin", "superadmin"]}>
                  <ThemesPage />
                </RequireRole>
              }
            />
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
    </Suspense>
  );
}
