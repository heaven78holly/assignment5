// Pınar Hale Kara - 2024502033

import { createDb, migrate } from "./db.ts";
import { hashPassword } from "./auth.ts";

const db = createDb(Deno.args[0] ?? "file:tasks.db");

await migrate(db);

const passwordHash = await hashPassword("Demo12345!");

for (const email of ["demo1@example.com", "demo2@example.com"]) {
  await db.client.execute({
    sql: `INSERT OR IGNORE INTO users (email, password_hash)
          VALUES (?, ?)`,
    args: [email, passwordHash],
  });

  const result = await db.client.execute({
    sql: "SELECT id FROM users WHERE email = ?",
    args: [email],
  });

  const userId = Number(result.rows[0].id);

  for (
    const task of [
      { title: "Study TypeScript", status: "todo" },
      { title: "Develop API", status: "in-progress" },
      { title: "Install Deno", status: "done" },
    ]
  ) {
    await db.client.execute({
      sql: `INSERT INTO tasks (user_id, title, status)
            SELECT ?, ?, ?
            WHERE NOT EXISTS (
              SELECT 1 FROM tasks
              WHERE user_id = ? AND title = ?
            )`,
      args: [
        userId,
        task.title,
        task.status,
        userId,
        task.title,
      ],
    });
  }
}

const users = await db.client.execute(
  "SELECT COUNT(*) AS total FROM users",
);

const tasks = await db.client.execute(
  "SELECT COUNT(*) AS total FROM tasks",
);

console.log("Users:", users.rows[0].total);
console.log("Tasks:", tasks.rows[0].total);

db.client.close();
