// Pınar Hale Kara , 2024502033
// TODO R7: register works (201), a duplicate email is 409, a wrong password is 401,
// a bad body is 400, login returns a token.
import { freshApp } from "./helpers.ts";

Deno.test("register returns 201", async () => {
  const app = await freshApp();

  const res = await app.request("/auth/register", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: "test@example.com",
      password: "Test12345!",
    }),
  });

  if (res.status !== 201) {
    throw new Error(
      `Expected 201, got ${res.status}: ${await res.text()}`,
    );
  }
});
Deno.test("duplicate email returns 409", async () => {
  const app = await freshApp();

  const user = {
    email: "duplicate@example.com",
    password: "Test12345!",
  };

  const first = await app.request("/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(user),
  });

  const second = await app.request("/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(user),
  });

  if (first.status !== 201 || second.status !== 409) {
    throw new Error(
      `Expected 201 and 409, got ${first.status} and ${second.status}`,
    );
  }
});
Deno.test("wrong password returns 401", async () => {
  const app = await freshApp();

  const user = {
    email: "wrong@example.com",
    password: "Correct123!",
  };

  await app.request("/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(user),
  });

  const res = await app.request("/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: user.email,
      password: "Wrong123!",
    }),
  });

  if (res.status !== 401) {
    throw new Error(`Expected 401, got ${res.status}`);
  }
});
Deno.test("login returns a token", async () => {
  const app = await freshApp();

  const user = {
    email: "login@example.com",
    password: "Test12345!",
  };

  await app.request("/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(user),
  });

  const res = await app.request("/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(user),
  });

  if (res.status !== 200) {
    throw new Error(`Expected 200, got ${res.status}`);
  }

  const data = await res.json();

  if (typeof data.token !== "string" || !data.token) {
    throw new Error("Login did not return a token");
  }
});
Deno.test("invalid register body returns 400", async () => {
  const app = await freshApp();

  const res = await app.request("/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "invalid-email",
      password: "123",
    }),
  });

  if (res.status !== 400) {
    throw new Error(
      `Expected 400, got ${res.status}: ${await res.text()}`,
    );
  }
});
