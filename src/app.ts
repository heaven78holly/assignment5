// PINAR HALE KARA , 2024502033
import { Hono } from "hono";
import type { Db } from "./db.ts";
import { z } from "zod";
import { checkPassword, createSession, hashPassword, requireAuth } from "./auth.ts";

/** Build the whole application around a database, so tests can give it their own. */
function errorResponse(
  message: string,
  issues: unknown[] = [],
) {
  return {
    error: message,
    issues,
  };
}
export function createApp(_db: Db) {
  const app = new Hono<{
    Variables: {
      userId: number;
    };
  }>();

  // Worked example: a health check.
  app.get("/health", (c) => c.json({ ok: true }));

  // TODO R3: POST /auth/register and POST /auth/login (validate with Zod, hash the
  //          password; on login call createSession and answer with the token).
  // TODO R4: GET/POST /api/tasks and GET/PUT/DELETE /api/tasks/:id, only for the owner.
  // TODO R5: one error shape for every failure: { "error": "message", "issues": [...] }.
  const registerSchema = z.object({
    email: z.email(),
    password: z.string().min(8),
  });

  app.post("/auth/register", async (c) => {
    const body = await c.req.json().catch(() => null);
    const result = registerSchema.safeParse(body);

    if (!result.success) {
      return c.json(
        errorResponse("invalid input", result.error.issues),
        400,
      );
    }

    const { email, password } = result.data;

    const existing = await _db.client.execute({
      sql: "SELECT id FROM users WHERE email = ?",
      args: [email],
    });

    if (existing.rows.length > 0) {
      return c.json(errorResponse("email already exists"), 409);
    }

    const passwordHash = await hashPassword(password);

    try {
      await _db.client.execute({
        sql: "INSERT INTO users (email, password_hash) VALUES (?, ?)",
        args: [email, passwordHash],
      });
    } catch (error) {
      const conflict = await _db.client.execute({
        sql: "SELECT id FROM users WHERE email = ?",
        args: [email],
      });

      if (conflict.rows.length > 0) {
        return c.json(errorResponse("email already exists"), 409);
      }

      throw error;
    }

    return c.json({ message: "registered successfully" }, 201);
  });
  const loginAttempts = new Map<
    string,
    { count: number; expiresAt: number }
  >();
  app.post("/auth/login", async (c) => {
    const body = await c.req.json().catch(() => null);
    const result = registerSchema.safeParse(body);

    if (!result.success) {
      return c.json(
        errorResponse("invalid input", result.error.issues),
        400,
      );
    }

    const { email, password } = result.data;
    const now = Date.now();

    for (const [key, value] of loginAttempts) {
      if (value.expiresAt <= now) {
        loginAttempts.delete(key);
      }
    }

    const attempt = loginAttempts.get(email);

    if (attempt && attempt.count >= 5) {
      const retryAfter = Math.ceil(
        (attempt.expiresAt - now) / 1000,
      );

      c.header("Retry-After", String(retryAfter));

      return c.json(
        errorResponse("too many login attempts"),
        429,
      );
    }

    const res = await _db.client.execute({
      sql: "SELECT id, password_hash FROM users WHERE email = ?",
      args: [email],
    });

    const user = res.rows[0];

    const valid = user
      ? await checkPassword(password, String(user.password_hash))
      : false;

    if (!user || !valid) {
      const previous = loginAttempts.get(email);
      const failedAt = Date.now();

      loginAttempts.set(email, {
        count: previous && previous.expiresAt > failedAt ? previous.count + 1 : 1,
        expiresAt: previous && previous.expiresAt > failedAt
          ? previous.expiresAt
          : failedAt + 60000,
      });

      return c.json(
        errorResponse("invalid credentials"),
        401,
      );
    }

    loginAttempts.delete(email);

    const token = await createSession(_db, Number(user.id));

    return c.json({ token }, 200);
  });
  app.use("/api/*", requireAuth(_db));
  const taskIdSchema = z.coerce.number().int().positive().safe();
  const taskSchema = z.object({
    title: z.string().trim().min(1),
    description: z.string().optional(),
    status: z.enum(["todo", "in-progress", "done"]).default("todo"),
    priority: z.number().int().min(1).default(1),
  });

  app.post("/api/tasks", async (c) => {
    const body = await c.req.json().catch(() => null);
    const result = taskSchema.safeParse(body);

    if (!result.success) {
      return c.json(
        errorResponse("invalid input", result.error.issues),
        400,
      );
    }

    const userId = c.get("userId") as number;
    const querySchema = z.object({
      page: z.coerce.number().int().min(1).default(1),
      limit: z.coerce.number().int().min(1).max(100).default(10),
      status: z.enum(["todo", "in-progress", "done"]).optional(),
    });

    const queryResult = querySchema.safeParse({
      page: c.req.query("page") ?? 1,
      limit: c.req.query("limit") ?? 10,
      status: c.req.query("status"),
    });

    if (!queryResult.success) {
      return c.json(
        errorResponse("invalid query", queryResult.error.issues),
        400,
      );
    }
    const { title, description, status, priority } = result.data;

    const res = await _db.client.execute({
      sql: `INSERT INTO tasks
          (user_id, title, description, status, priority)
          VALUES (?, ?, ?, ?, ?)
          RETURNING *`,
      args: [userId, title, description ?? null, status, priority],
    });

    return c.json(res.rows[0], 201);
  });
  app.get("/api/tasks", async (c) => {
    const userId = c.get("userId") as number;

    const querySchema = z.object({
      page: z.coerce.number().int().min(1).default(1),
      limit: z.coerce.number().int().min(1).max(100).default(10),
      status: z.enum(["todo", "in-progress", "done"]).optional(),
    });

    const queryResult = querySchema.safeParse({
      page: c.req.query("page") ?? 1,
      limit: c.req.query("limit") ?? 10,
      status: c.req.query("status"),
    });

    if (!queryResult.success) {
      return c.json(
        errorResponse("invalid query", queryResult.error.issues),
        400,
      );
    }

    const { page, limit, status } = queryResult.data;
    const offset = (page - 1) * limit;

    if (!Number.isSafeInteger(offset)) {
      return c.json(errorResponse("invalid pagination"), 400);
    }

    const res = await _db.client.execute({
      sql: `SELECT * FROM tasks
        WHERE user_id = ?
        AND (? IS NULL OR status = ?)
        ORDER BY created_at DESC, id DESC
        LIMIT ? OFFSET ?`,
      args: [
        userId,
        status ?? null,
        status ?? null,
        limit,
        offset,
      ],
    });

    return c.json(res.rows, 200);
  });
  app.get("/api/tasks/:id", async (c) => {
    const userId = c.get("userId") as number;
    const idResult = taskIdSchema.safeParse(c.req.param("id"));

    if (!idResult.success) {
      return c.json(
        errorResponse("invalid task id", idResult.error.issues),
        400,
      );
    }

    const id = idResult.data;

    const res = await _db.client.execute({
      sql: "SELECT * FROM tasks WHERE id = ? AND user_id = ?",
      args: [id, userId],
    });

    if (res.rows.length === 0) {
      return c.json(errorResponse("task not found"), 404);
    }

    return c.json(res.rows[0], 200);
  });
  const updateTaskSchema = z.object({
    title: z.string().trim().min(1).optional(),
    description: z.string().optional(),
    status: z.enum(["todo", "in-progress", "done"]).optional(),
    priority: z.number().int().min(1).optional(),
  }).strict();

  app.on(["PUT", "PATCH"], "/api/tasks/:id", async (c) => {
    const userId = c.get("userId") as number;
    const idResult = taskIdSchema.safeParse(c.req.param("id"));

    if (!idResult.success) {
      return c.json(
        errorResponse("invalid task id", idResult.error.issues),
        400,
      );
    }

    const id = idResult.data;

    const body = await c.req.json().catch(() => null);
    const result = updateTaskSchema.safeParse(body);

    if (!result.success) {
      return c.json(
        errorResponse("invalid input", result.error.issues),
        400,
      );
    }

    if (Object.keys(result.data).length === 0) {
      return c.json(errorResponse("no fields to update"), 400);
    }

    const updates = result.data;

    const res = await _db.client.execute({
      sql: `UPDATE tasks SET
          title = COALESCE(?, title),
          description = COALESCE(?, description),
          status = COALESCE(?, status),
          priority = COALESCE(?, priority)
        WHERE id = ? AND user_id = ?
        RETURNING *`,
      args: [
        updates.title ?? null,
        updates.description ?? null,
        updates.status ?? null,
        updates.priority ?? null,
        id,
        userId,
      ],
    });

    if (res.rows.length === 0) {
      return c.json(errorResponse("task not found"), 404);
    }

    return c.json(res.rows[0], 200);
  });
  app.delete("/api/tasks/:id", async (c) => {
    const userId = c.get("userId") as number;
    const idResult = taskIdSchema.safeParse(c.req.param("id"));

    if (!idResult.success) {
      return c.json(
        errorResponse("invalid task id", idResult.error.issues),
        400,
      );
    }

    const id = idResult.data;

    const res = await _db.client.execute({
      sql: "DELETE FROM tasks WHERE id = ? AND user_id = ? RETURNING id",
      args: [id, userId],
    });

    if (res.rows.length === 0) {
      return c.json(errorResponse("task not found"), 404);
    }

    return c.body(null, 204);
  });
  app.get("/api/me/summary", async (c) => {
    const userId = c.get("userId");

    const res = await _db.client.execute({
      sql: `SELECT
            COUNT(CASE WHEN status = 'todo' THEN 1 END) AS todo,
            COUNT(CASE WHEN status = 'in-progress' THEN 1 END) AS "in-progress",
            COUNT(CASE WHEN status = 'done' THEN 1 END) AS done
          FROM tasks
          WHERE user_id = ?`,
      args: [userId],
    });

    return c.json(res.rows[0], 200);
  });
  app.notFound((c) => c.json(errorResponse("not found"), 404));
  return app;
}
