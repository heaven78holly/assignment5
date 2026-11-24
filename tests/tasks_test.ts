// pinar hale kara , 2024502033
// TODO R7: no token is 401, create and list work, a user cannot read or change
// another user's task, an invalid status is 400, pagination returns the right page.
import { freshApp } from "./helpers.ts";

Deno.test("tasks without token returns 401", async () => {
  const app = await freshApp();

  const res = await app.request("/api/tasks", {
    method: "GET",
  });

  if (res.status !== 401) {
    throw new Error(
      `Expected 401, got ${res.status}: ${await res.text()}`,
    );
  }
});
Deno.test("create and list tasks", async () => {
  const app = await freshApp();

  const user = {
    email: "tasks@example.com",
    password: "Test12345!",
  };

  // Kullanıcı kaydı
  const register = await app.request("/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(user),
  });

  if (register.status !== 201) {
    throw new Error(`Register failed: ${register.status}`);
  }

  // Giriş yap ve token al
  const login = await app.request("/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(user),
  });

  if (login.status !== 200) {
    throw new Error(`Login failed: ${login.status}`);
  }

  const { token } = await login.json();

  // Yeni görev oluştur
  const create = await app.request("/api/tasks", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      title: "Finish assignment",
      status: "todo",
      priority: 1,
    }),
  });

  if (create.status !== 201) {
    throw new Error(
      `Expected 201, got ${create.status}: ${await create.text()}`,
    );
  }

  // Görevleri listele
  const list = await app.request("/api/tasks", {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (list.status !== 200) {
    throw new Error(`Expected 200, got ${list.status}`);
  }

  const tasks = await list.json();

  if (!Array.isArray(tasks) || tasks.length !== 1) {
    throw new Error("Expected exactly one task");
  }

  if (tasks[0].title !== "Finish assignment") {
    throw new Error("Task title does not match");
  }
});
Deno.test("update task status returns 200", async () => {
  const app = await freshApp();

  const user = {
    email: "update@example.com",
    password: "Test12345!",
  };

  await app.request("/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(user),
  });

  const login = await app.request("/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(user),
  });

  const { token } = await login.json();

  const create = await app.request("/api/tasks", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ title: "Study Deno" }),
  });

  if (create.status !== 201) {
    throw new Error(`Create failed: ${create.status}`);
  }

  const task = await create.json();

  const update = await app.request(`/api/tasks/${task.id}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ status: "done" }),
  });

  if (update.status !== 200) {
    throw new Error(`Expected 200, got ${update.status}`);
  }

  const updatedTask = await update.json();

  if (updatedTask.status !== "done") {
    throw new Error("Task status was not updated");
  }
});
Deno.test("delete task returns 204", async () => {
  const app = await freshApp();

  const user = {
    email: "delete@example.com",
    password: "Test12345!",
  };

  await app.request("/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(user),
  });

  const login = await app.request("/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(user),
  });

  const { token } = await login.json();

  const create = await app.request("/api/tasks", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ title: "Delete this task" }),
  });

  if (create.status !== 201) {
    throw new Error(`Create failed: ${create.status}`);
  }

  const task = await create.json();

  const del = await app.request(`/api/tasks/${task.id}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (del.status !== 204) {
    throw new Error(`Expected 204, got ${del.status}`);
  }

  const get = await app.request(`/api/tasks/${task.id}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (get.status !== 404) {
    throw new Error(`Expected 404 after deletion, got ${get.status}`);
  }
});
Deno.test("invalid task status returns 400", async () => {
  const app = await freshApp();

  const user = {
    email: "invalidstatus@example.com",
    password: "Test12345!",
  };

  await app.request("/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(user),
  });

  const login = await app.request("/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(user),
  });

  const { token } = await login.json();

  const res = await app.request("/api/tasks", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      title: "Invalid task",
      status: "completed",
    }),
  });

  if (res.status !== 400) {
    throw new Error(
      `Expected 400, got ${res.status}: ${await res.text()}`,
    );
  }
});
Deno.test("users cannot access each other's tasks", async () => {
  const app = await freshApp();

  async function createUser(email: string) {
    const user = {
      email,
      password: "Test12345!",
    };

    const register = await app.request("/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(user),
    });

    if (register.status !== 201) {
      throw new Error(`Register failed: ${register.status}`);
    }

    const login = await app.request("/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(user),
    });

    if (login.status !== 200) {
      throw new Error(`Login failed: ${login.status}`);
    }

    const { token } = await login.json();
    return token;
  }

  const tokenA = await createUser("usera@example.com");
  const tokenB = await createUser("userb@example.com");

  const create = await app.request("/api/tasks", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${tokenA}`,
    },
    body: JSON.stringify({ title: "User A private task" }),
  });

  if (create.status !== 201) {
    throw new Error(`Create failed: ${create.status}`);
  }

  const task = await create.json();

  for (const method of ["GET", "PATCH", "DELETE"]) {
    const res = await app.request(`/api/tasks/${task.id}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenB}`,
      },
      ...(method === "PATCH" ? { body: JSON.stringify({ status: "done" }) } : {}),
    });

    if (res.status !== 404) {
      throw new Error(
        `${method}: Expected 404, got ${res.status}`,
      );
    }
  }
});
Deno.test("pagination returns correct tasks", async () => {
  const app = await freshApp();

  const user = {
    email: "pagination@example.com",
    password: "Test12345!",
  };

  await app.request("/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(user),
  });

  const login = await app.request("/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(user),
  });

  const { token } = await login.json();

  // Create 5 tasks
  for (let i = 1; i <= 5; i++) {
    const res = await app.request("/api/tasks", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ title: `Task ${i}` }),
    });

    if (res.status !== 201) {
      throw new Error(`Task creation failed: ${res.status}`);
    }
  }

  // Request the second page with 2 tasks per page
  const res = await app.request("/api/tasks?page=2&limit=2", {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (res.status !== 200) {
    throw new Error(`Expected 200, got ${res.status}`);
  }

  const tasks = await res.json();

  if (tasks.length !== 2) {
    throw new Error(`Expected 2 tasks, got ${tasks.length}`);
  }

  if (tasks[0].title !== "Task 3" || tasks[1].title !== "Task 2") {
    throw new Error("Pagination returned incorrect tasks");
  }
});
Deno.test("status filter returns only matching tasks", async () => {
  const app = await freshApp();

  const user = {
    email: "statusfilter@example.com",
    password: "Test12345!",
  };

  await app.request("/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(user),
  });

  const login = await app.request("/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(user),
  });

  const { token } = await login.json();

  for (
    const task of [
      { title: "Task A", status: "todo" },
      { title: "Task B", status: "done" },
      { title: "Task C", status: "done" },
    ]
  ) {
    const create = await app.request("/api/tasks", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(task),
    });

    if (create.status !== 201) {
      throw new Error(`Create failed: ${create.status}`);
    }
  }

  const res = await app.request("/api/tasks?status=done", {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (res.status !== 200) {
    throw new Error(`Expected 200, got ${res.status}`);
  }

  const tasks = await res.json();

  if (tasks.length !== 2) {
    throw new Error(`Expected 2 tasks, got ${tasks.length}`);
  }

  if (tasks.some((task: { status: string }) => task.status !== "done")) {
    throw new Error("Status filter returned incorrect tasks");
  }
});
Deno.test("PUT updates a task", async () => {
  const app = await freshApp();

  const user = {
    email: "puttest@example.com",
    password: "Test12345!",
  };

  const register = await app.request("/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(user),
  });

  if (register.status !== 201) {
    throw new Error(`Register failed: ${register.status}`);
  }

  const login = await app.request("/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(user),
  });

  if (login.status !== 200) {
    throw new Error(`Login failed: ${login.status}`);
  }

  const { token } = await login.json();

  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };

  const create = await app.request("/api/tasks", {
    method: "POST",
    headers,
    body: JSON.stringify({ title: "Old title" }),
  });

  if (create.status !== 201) {
    throw new Error(`Create failed: ${create.status}`);
  }

  const task = await create.json();

  const update = await app.request(`/api/tasks/${task.id}`, {
    method: "PUT",
    headers,
    body: JSON.stringify({
      title: "New title",
      status: "done",
      priority: 2,
    }),
  });

  if (update.status !== 200) {
    throw new Error(`Expected 200, got ${update.status}`);
  }

  const updated = await update.json();

  if (
    updated.title !== "New title" ||
    updated.status !== "done" ||
    updated.priority !== 2
  ) {
    throw new Error("PUT did not update the task correctly");
  }
});
