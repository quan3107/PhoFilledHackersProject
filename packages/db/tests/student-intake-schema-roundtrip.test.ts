// packages/db/tests/student-intake-schema-roundtrip.test.ts
// Integration coverage for the canonical student intake persistence table.
// Verifies chat history and progress metadata round-trip through the checked-in migration.

import assert from "node:assert/strict";
import test from "node:test";

import { eq } from "drizzle-orm";

import { studentIntakeSessions, users } from "../src/index.js";
import { createCatalogTestDatabase } from "../src/testing/pglite.js";

test("student intake sessions round-trip through the schema", async () => {
  const database = await createCatalogTestDatabase();

  try {
    await database.db.insert(users).values({
      id: "user_1",
      name: "Minh Anh",
      email: "minh.anh@example.com",
      emailVerified: true,
      image: null,
    });

    await database.db.insert(studentIntakeSessions).values({
      userId: "user_1",
      currentStepIndex: 3,
      conversationDone: false,
      messages: [
        {
          id: "message_1",
          role: "assistant",
          text: "Welcome to the intake flow.",
          createdAt: "2026-03-22T00:00:00.000Z",
        },
        {
          id: "message_2",
          role: "student",
          text: "I want to major in computer science.",
          createdAt: "2026-03-22T00:00:05.000Z",
        },
      ],
    });

    const storedSession =
      await database.db.query.studentIntakeSessions.findFirst({
        where: eq(studentIntakeSessions.userId, "user_1"),
      });

    assert.ok(storedSession);
    assert.equal(storedSession?.currentStepIndex, 3);
    assert.equal(storedSession?.conversationDone, false);
    assert.equal(storedSession?.messages.length, 2);
    assert.equal(storedSession?.messages[0].role, "assistant");
    assert.equal(
      storedSession?.messages[1].text,
      "I want to major in computer science."
    );

    await database.db
      .update(studentIntakeSessions)
      .set({
        currentStepIndex: 5,
        conversationDone: true,
        messages: [
          ...storedSession.messages,
          {
            id: "message_3",
            role: "assistant",
            text: "Great, I have enough to save your progress.",
            createdAt: "2026-03-22T00:00:10.500Z",
          },
        ],
      })
      .where(eq(studentIntakeSessions.userId, "user_1"));

    const reloadedSession =
      await database.db.query.studentIntakeSessions.findFirst({
        where: eq(studentIntakeSessions.userId, "user_1"),
      });

    assert.ok(reloadedSession);
    assert.equal(reloadedSession.currentStepIndex, 5);
    assert.equal(reloadedSession.conversationDone, true);
    assert.deepEqual(reloadedSession.messages, [
      {
        id: "message_1",
        role: "assistant",
        text: "Welcome to the intake flow.",
        createdAt: "2026-03-22T00:00:00.000Z",
      },
      {
        id: "message_2",
        role: "student",
        text: "I want to major in computer science.",
        createdAt: "2026-03-22T00:00:05.000Z",
      },
      {
        id: "message_3",
        role: "assistant",
        text: "Great, I have enough to save your progress.",
        createdAt: "2026-03-22T00:00:10.500Z",
      },
    ]);
  } finally {
    await database.close();
  }
});

test("student intake sessions preserve richer LLM metadata inside message payloads", async () => {
  const database = await createCatalogTestDatabase();

  try {
    await database.db.insert(users).values({
      id: "user_2",
      name: "Minh Anh",
      email: "minh.anh-2@example.com",
      emailVerified: true,
      image: null,
    });

    const messages = [
      {
        id: "message_1",
        role: "assistant",
        text: "I can help fill in the next field.",
        createdAt: "2026-03-22T00:00:00.000Z",
        responseId: "resp_123",
        nextFieldPath: "citizenshipCountry",
        fieldStatuses: {
          citizenshipCountry: "filled",
        },
      },
      {
        id: "message_2",
        role: "student",
        text: "I do not know yet.",
        createdAt: "2026-03-22T00:00:05.000Z",
        fieldPath: "budget.annualBudgetUsd",
        fieldStatus: "unknown",
        userIntent: "unknown",
      },
      {
        id: "message_3",
        role: "student",
        text: "I decline to answer.",
        createdAt: "2026-03-22T00:00:10.000Z",
        fieldPath: "readiness.hasEssayDraftsStarted",
        fieldStatus: "declined",
        userIntent: "declined",
      },
    ] as const;

    await database.db.insert(studentIntakeSessions).values({
      userId: "user_2",
      currentStepIndex: 0,
      conversationDone: false,
      messages: messages as never,
    });

    const storedSession =
      await database.db.query.studentIntakeSessions.findFirst({
        where: eq(studentIntakeSessions.userId, "user_2"),
      });

    assert.ok(storedSession);
    assert.deepEqual(storedSession?.messages, messages);
  } finally {
    await database.close();
  }
});
