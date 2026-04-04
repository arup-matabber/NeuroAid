// ── API service layer ─────────────────────────────────────────────────────────
const BASE = import.meta.env.VITE_API_BASE_URL + "/api" || "/api";

// ── Token / session helpers ───────────────────────────────────────────────────
export const getToken   = () => sessionStorage.getItem("neuroaid_token");
export const getUser    = () => { const u = sessionStorage.getItem("neuroaid_user"); return u ? JSON.parse(u) : null; };
export const isLoggedIn = () => !!getToken();

function saveSession(token, user) {
  sessionStorage.setItem("neuroaid_token", token);
  sessionStorage.setItem("neuroaid_user", JSON.stringify(user));
}
export function clearSession() {
  sessionStorage.removeItem("neuroaid_token");
  sessionStorage.removeItem("neuroaid_user");
}

// ── Core request ──────────────────────────────────────────────────────────────
async function request(method, path, body, requiresAuth = false) {
  const headers = { "Content-Type": "application/json" };
  if (requiresAuth) {
    const token = getToken();
    if (!token) throw new Error("Not authenticated. Please log in.");
    headers["Authorization"] = `Bearer ${token}`;
  }
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || `API error ${res.status}`);
  }
  return res.json();
}

// ── Auth API ──────────────────────────────────────────────────────────────────

/** Register a new user. role = "patient" | "doctor" */
export async function register({ full_name, email, password, role, age, gender, phone, license_number, specialization, hospital, location, years_experience, consultation_mode, bio, max_patients }) {
  const data = await request("POST", "/auth/register", { full_name, email, password, role, age, gender, phone, license_number, specialization, hospital, location, years_experience, consultation_mode, bio, max_patients });
  saveSession(data.token, data.user);
  return data;
}

/** Login. role = "patient" | "doctor" */
export async function login(email, password, role = "patient") {
  const data = await request("POST", "/auth/login", { email, password, role });
  saveSession(data.token, data.user);
  return data;
}

/** Logout current user. */
export async function logout() {
  try { await request("POST", "/auth/logout", null, true); } finally { clearSession(); }
}

/** Get current user profile. */
export async function fetchMe() {
  const data = await request("GET", "/auth/me", null, true);
  sessionStorage.setItem("neuroaid_user", JSON.stringify(data.user));
  return data.user;
}

/** Doctors only — get all registered patients. */
export async function getPatients() {
  const data = await request("GET", "/auth/patients", null, true);
  return data.patients;
}

// ── Assessment API ────────────────────────────────────────────────────────────
export const submitAnalysis = (payload) => request("POST", "/analyze", payload, true);

/** Get current patient's own past results */
export async function getMyResults() {
  const data = await request("GET", "/results/my", null, true);
  return data.results; // array, newest last
}

/** Doctor only — get a specific patient's results */
export async function getPatientResults(patientId) {
  const data = await request("GET", `/results/patient/${patientId}`, null, true);
  return data.results;
}

// ── Messaging ────────────────────────────────────────────────────────────────
export async function sendMessage(recipientId, text) {
  return request("POST", "/messages/send", { recipient_id: recipientId, text }, true);
}
export async function getMessages(otherUserId) {
  const data = await request("GET", `/messages/${otherUserId}`, null, true);
  return data.messages;
}
export async function deleteMessage(messageId) {
  return request("DELETE", `/messages/${messageId}`, null, true);
}
export async function getConversations() {
  const data = await request("GET", "/conversations", null, true);
  return data.conversations;
}
export async function getUnreadCount() {
  const data = await request("GET", "/messages/unread/count", null, true);
  return data.count;
}

export async function getDoctors() {
  const data = await request("GET", "/auth/doctors", null, true);
  return data.doctors;
}

export async function getMyDoctor() {
  const data = await request("GET", "/auth/doctors/my-doctor", null, true);
  return data;
}

export async function enrollWithDoctor(doctorId) {
  return request("POST", "/auth/doctors/enroll", { doctor_id: doctorId }, true);
}

export async function getPendingRequests() {
  const data = await request("GET", "/auth/doctors/pending-requests", null, true);
  return data.pending_requests;
}

export async function approvePatient(patientId, action) {
  return request("POST", "/auth/doctors/approve", { patient_id: patientId, action }, true);
}

// ── Chat / RAG ────────────────────────────────────────────────────────────────
export async function submitChat(question, user_context = {}) {
  return request("POST", "/chat", { question, user_context });
}