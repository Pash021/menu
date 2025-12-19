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
  formData.append("logo", file);
  const { data } = await api.post(`/admin/restaurants/${id}/logo`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
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
