import { api } from "./client";

export async function listThemes(params = {}) {
  const { data } = await api.get("/admin/themes", { params });
  return data?.data;
}

export async function createTheme(payload) {
  const { data } = await api.post("/admin/themes", payload);
  return data?.data;
}

export async function updateTheme(id, payload) {
  const { data } = await api.put(`/admin/themes/${id}`, payload);
  return data?.data;
}

export async function updateRestaurantTheme(restaurantId, payload) {
  const { data } = await api.put(`/admin/restaurants/${restaurantId}/theme`, payload);
  return data?.data;
}

