import { api } from "./client";

export async function listRestaurants(params = {}) {
  const { data } = await api.get("/admin/restaurants", { params });
  return data?.data;
}

export async function getRestaurant(id) {
  const { data } = await api.get(`/admin/restaurants/${id}`);
  return data?.data;
}

export async function createRestaurant(payload) {
  const { data } = await api.post("/admin/restaurants", payload);
  return data?.data;
}

export async function updateRestaurant(id, payload) {
  const { data } = await api.patch(`/admin/restaurants/${id}`, payload);
  return data?.data;
}

export async function uploadRestaurantLogo(id, file) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("logo", file);
  const { data } = await api.post(`/admin/restaurants/${id}/logo`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data?.data;
}

export async function deleteRestaurantLogo(id) {
  const { data } = await api.delete(`/admin/restaurants/${id}/logo`);
  return data?.data;
}

export async function getRestaurantQr(id, params = {}) {
  const { data } = await api.get(`/admin/restaurants/${id}/qr`, { params });
  return data?.data;
}

export async function listRestaurantFonts(id) {
  const { data } = await api.get(`/admin/restaurants/${id}/fonts`);
  return data?.data;
}

export async function uploadRestaurantFont(id, file) {
  const formData = new FormData();
  formData.append("file", file);
  const { data } = await api.post(`/admin/restaurants/${id}/fonts/upload`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data?.data;
}

export async function deleteRestaurantFont(id, path) {
  const { data } = await api.delete(`/admin/restaurants/${id}/fonts`, { params: { path } });
  return data?.data;
}

export async function listRestaurantLoaders(id) {
  const { data } = await api.get(`/admin/restaurants/${id}/loaders`);
  return data?.data;
}

export async function uploadRestaurantLoader(id, file) {
  const formData = new FormData();
  formData.append("file", file);
  const { data } = await api.post(`/admin/restaurants/${id}/loaders/upload`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data?.data;
}

export async function deleteRestaurantLoader(id, path) {
  const { data } = await api.delete(`/admin/restaurants/${id}/loaders`, { params: { path } });
  return data?.data;
}

export async function getRestaurantHeaderStyle(id) {
  const { data } = await api.get(`/admin/restaurants/${id}/header-style`);
  return data?.data;
}

export async function updateRestaurantHeaderStyle(id, payload) {
  const { data } = await api.put(`/admin/restaurants/${id}/header-style`, payload);
  return data?.data;
}

export async function listHeroPresets() {
  const { data } = await api.get("/admin/hero-presets");
  return data?.data;
}

export async function listMenuCardPresets() {
  const { data } = await api.get("/admin/menu-card-presets");
  return data?.data;
}

export async function duplicateMenuCardPreset(presetId) {
  const { data } = await api.post(`/admin/menu-card-presets/${presetId}/duplicate`);
  return data?.data;
}

export async function updateMenuCardPreset(presetId, payload) {
  const { data } = await api.put(`/admin/menu-card-presets/${presetId}`, payload);
  return data?.data;
}

export async function getRestaurantMenuCards(id) {
  const { data } = await api.get(`/admin/restaurants/${id}/menu-cards`);
  return data?.data;
}

export async function updateRestaurantMenuCards(id, payload) {
  const { data } = await api.put(`/admin/restaurants/${id}/menu-cards`, payload);
  return data?.data;
}

export async function createHeroPreset(payload) {
  const { data } = await api.post("/admin/hero-presets", payload);
  return data?.data;
}

export async function duplicateHeroPreset(presetId) {
  const { data } = await api.post(`/admin/hero-presets/${presetId}/duplicate`);
  return data?.data;
}

export async function updateHeroPreset(presetId, payload) {
  const { data } = await api.put(`/admin/hero-presets/${presetId}`, payload);
  return data?.data;
}

export async function getRestaurantHero(id) {
  const { data } = await api.get(`/admin/restaurants/${id}/hero`);
  return data?.data;
}

export async function updateRestaurantHero(id, payload) {
  const { data } = await api.put(`/admin/restaurants/${id}/hero`, payload);
  return data?.data;
}

export async function listCategories(restaurantId, params = {}) {
  const { data } = await api.get(`/admin/restaurants/${restaurantId}/categories`, { params });
  return data?.data;
}

export async function createCategory(restaurantId, payload) {
  const { data } = await api.post(`/admin/restaurants/${restaurantId}/categories`, payload);
  return data?.data;
}

export async function updateCategory(categoryId, payload) {
  const { data } = await api.patch(`/admin/categories/${categoryId}`, payload);
  return data?.data;
}

export async function deleteCategory(categoryId) {
  const { data } = await api.delete(`/admin/categories/${categoryId}`);
  return data?.data;
}

export async function listCategoryIcons(restaurantId) {
  const { data } = await api.get(`/admin/categories/icons`, {
    params: { restaurant_id: restaurantId },
  });
  return data?.data;
}

export async function uploadCategoryIcon(restaurantId, file) {
  const formData = new FormData();
  formData.append("file", file);
  const { data } = await api.post(`/admin/categories/upload-icon`, formData, {
    params: { restaurant_id: restaurantId },
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data?.data;
}

export async function deleteCategoryIcon(restaurantId, path) {
  const { data } = await api.delete(`/admin/categories/icons`, { params: { restaurant_id: restaurantId, path } });
  return data?.data;
}

export async function getCategoryHeaderStyle(categoryId) {
  const { data } = await api.get(`/admin/categories/${categoryId}/header-style`);
  return data?.data;
}

export async function updateCategoryHeaderStyle(categoryId, payload) {
  const { data } = await api.put(`/admin/categories/${categoryId}/header-style`, payload);
  return data?.data;
}

export async function listDishes(restaurantId, params = {}) {
  const { data } = await api.get(`/admin/restaurants/${restaurantId}/dishes`, { params });
  return data?.data;
}

export async function createDish(restaurantId, payload) {
  const formData = new FormData();
  Object.entries(payload).forEach(([k, v]) => {
    if (v === undefined || v === null) return;
    if (k === "image" && v instanceof File) formData.append("image", v);
    else formData.append(k, String(v));
  });

  const { data } = await api.post(`/admin/restaurants/${restaurantId}/dishes`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data?.data;
}

export async function updateDish(dishId, payload) {
  const formData = new FormData();
  Object.entries(payload).forEach(([k, v]) => {
    if (v === undefined || v === null) return;
    if (k === "image" && v instanceof File) formData.append("image", v);
    else formData.append(k, String(v));
  });
  const { data } = await api.patch(`/admin/dishes/${dishId}`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data?.data;
}

export async function deleteDish(dishId) {
  const { data } = await api.delete(`/admin/dishes/${dishId}`);
  return data?.data;
}

export async function getDishImageStatus(dishId) {
  const { data } = await api.get(`/admin/dishes/${dishId}/image`);
  return data?.data;
}

export async function requestDishRemoveBg(dishId) {
  const { data } = await api.post(`/admin/dishes/${dishId}/image/remove-bg`);
  return data?.data;
}

export async function useDishOriginalImage(dishId) {
  const { data } = await api.post(`/admin/dishes/${dishId}/image/use-original`);
  return data?.data;
}

export async function useDishProcessedImage(dishId) {
  const { data } = await api.post(`/admin/dishes/${dishId}/image/use-processed`);
  return data?.data;
}

export async function getDishTranslations(dishId, params = {}) {
  const { data } = await api.get(`/admin/dishes/${dishId}/translations`, { params });
  return data?.data;
}

export async function updateDishTranslation(dishId, lang, payload) {
  const { data } = await api.put(`/admin/dishes/${dishId}/translations/${lang}`, payload);
  return data?.data;
}

export async function listTables(restaurantId, params = {}) {
  const { data } = await api.get(`/admin/restaurants/${restaurantId}/tables`, { params });
  return data?.data;
}

export async function createTable(restaurantId, payload) {
  const { data } = await api.post(`/admin/restaurants/${restaurantId}/tables`, payload);
  return data?.data;
}

export async function updateTable(tableId, payload) {
  const { data } = await api.patch(`/admin/tables/${tableId}`, payload);
  return data?.data;
}

export async function deleteTable(tableId) {
  const { data } = await api.delete(`/admin/tables/${tableId}`);
  return data?.data;
}

export async function listUsers(params = {}) {
  const { data } = await api.get("/admin/users", { params });
  return data?.data;
}
