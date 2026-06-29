const BASE = import.meta.env.VITE_API_URL || "/api";

function getToken() {
  return localStorage.getItem("stp_token");
}

async function request(method, path, body) {
  const token = getToken();
  const headers = { Accept: "text/plain" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  if (body !== undefined) headers["Content-Type"] = "application/json";

  const url = `${BASE}${path}`;
  const bodyStr = body !== undefined ? JSON.stringify(body) : undefined;
  console.log(`[API] >> ${method} ${url}`, body || "");

  const res = await fetch(url, { method, headers, body: bodyStr });

  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try { const err = await res.json(); msg = Array.isArray(err) ? err.map((e) => e.description).join("; ") : err.title || msg; } catch {}
    console.error(`[API] << ${res.status} ${method} ${url} — ${msg}`);
    throw new Error(msg);
  }
  if (res.status === 204) { console.log(`[API] << 204 ${method} ${url}`); return null; }
  const data = await res.json();
  console.log(`[API] << ${res.status} ${method} ${url}`, data);
  return data;
}

export function getCityInterests(cityCode) {
  return request("GET", `/cities/${cityCode}/interests`);
}

export function searchPlaces(query, cityCode, maxResults = 10) {
  return request("POST", "/trips/places/search", {
    query, cityCode, maxResults, fetchFromExternalIfInsufficient: false,
  });
}

export function getTrips(cityCode, startDate, endDate) {
  const params = new URLSearchParams();
  if (cityCode) params.set("cityCode", cityCode);
  if (startDate) params.set("startDate", startDate);
  if (endDate) params.set("endDate", endDate);
  return request("GET", `/trips${params.toString() ? `?${params}` : ""}`);
}

export function createTrip(payload) {
  return request("POST", "/trips", payload);
}

export function updateTrip(tripId, payload) {
  return request("PATCH", `/trips/${tripId}`, payload);
}

export function getTripDetails(tripId) {
  return request("GET", `/trips/${tripId}`);
}

export function generateItinerary(tripId) {
  return request("POST", `/trips/${tripId}/generate`);
}

export function toggleCompletion(tripId, dayIndex, placeId, isCompleted) {
  return request("PATCH", `/trips/${tripId}/days/${dayIndex}/completion`, { placeId, isCompleted });
}

export function replanTrip(tripId, currentDateTime, scope, currentBlockWeather) {
  return request("POST", `/trips/${tripId}/replan`, { currentDateTime, scope, currentBlockWeather });
}
