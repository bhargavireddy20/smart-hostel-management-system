
const API_BASE_URL = "http://127.0.0.1:8000";

export interface ApiStudent {
  id: number;
  student_id: string;
  full_name: string;
  email: string;
  phone: string;
  course: string;
  academic_year: number;
  is_active: boolean;
  created_at: string;
}

export interface StudentCreate {
  student_id: string;
  full_name: string;
  email: string;
  phone: string;
  course: string;
  academic_year: number;
}

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  // Get the logged-in admin's session token
  const token = sessionStorage.getItem("smartstay_access_token");
  const role = sessionStorage.getItem("smartstay_role");

  if (!token || role !== "admin") {
    throw new Error("Admin authentication required. Please log in again.");
  }

  const headers = new Headers(options.headers);

  headers.set("Authorization", `Bearer ${token}`);

  if (options.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => null);
    const detail = error?.detail ?? `Request failed: ${response.status}`;

    throw new Error(
      typeof detail === "string" ? detail : JSON.stringify(detail),
    );
  }

  return response.json() as Promise<T>;
}

export function getStudents(): Promise<ApiStudent[]> {
  return request<ApiStudent[]>("/students/");
}

export function createStudent(
  student: StudentCreate,
): Promise<ApiStudent> {
  return request<ApiStudent>("/students/", {
    method: "POST",
    body: JSON.stringify(student),
  });
}

export function deactivateStudent(
  studentId: string,
): Promise<{ message: string; student_id: string }> {
  return request(`/students/${encodeURIComponent(studentId)}/deactivate`, {
    method: "PATCH",
  });
}
