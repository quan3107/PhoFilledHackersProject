// packages/db/src/schema/relations.ts
// Drizzle relations for catalog and recommendation tables used by tests and later application queries.
// Keeps ownership inside the db package so downstream packages can consume one schema surface.

import { relations } from "drizzle-orm";

import { catalogImportItems, catalogImportRuns } from "./imports.js";
import {
  accounts,
  sessions,
  studentIntakeSessions,
  studentProfileSnapshots,
  studentProfiles,
  users,
  verifications,
} from "./student-profiles.js";
import {
  recommendationExplanations,
  recommendationResults,
  recommendationShortlists,
  recommendationRuns,
} from "./recommendations.js";
import { universities, universitySources } from "./universities.js";

export const universitiesRelations = relations(universities, ({ many }) => ({
  universitySources: many(universitySources),
  catalogImportRuns: many(catalogImportRuns),
  catalogImportItems: many(catalogImportItems),
  recommendationResults: many(recommendationResults),
}));

export const universitySourcesRelations = relations(
  universitySources,
  ({ one }) => ({
    university: one(universities, {
      fields: [universitySources.universityId],
      references: [universities.id],
    }),
  })
);

export const catalogImportRunsRelations = relations(
  catalogImportRuns,
  ({ many, one }) => ({
    university: one(universities, {
      fields: [catalogImportRuns.universityId],
      references: [universities.id],
    }),
    items: many(catalogImportItems),
  })
);

export const catalogImportItemsRelations = relations(
  catalogImportItems,
  ({ one }) => ({
    importRun: one(catalogImportRuns, {
      fields: [catalogImportItems.importRunId],
      references: [catalogImportRuns.id],
    }),
    university: one(universities, {
      fields: [catalogImportItems.universityId],
      references: [universities.id],
    }),
  })
);

export const usersRelations = relations(users, ({ many, one }) => ({
  accounts: many(accounts),
  sessions: many(sessions),
  studentIntakeSession: one(studentIntakeSessions, {
    fields: [users.id],
    references: [studentIntakeSessions.userId],
  }),
  studentProfile: one(studentProfiles, {
    fields: [users.id],
    references: [studentProfiles.userId],
  }),
}));

export const accountsRelations = relations(accounts, ({ one }) => ({
  user: one(users, {
    fields: [accounts.userId],
    references: [users.id],
  }),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id],
  }),
}));

export const verificationsRelations = relations(verifications, () => ({}));

export const studentProfilesRelations = relations(
  studentProfiles,
  ({ many, one }) => ({
    user: one(users, {
      fields: [studentProfiles.userId],
      references: [users.id],
    }),
    snapshots: many(studentProfileSnapshots),
    recommendationRuns: many(recommendationRuns),
  })
);

export const studentProfileSnapshotsRelations = relations(
  studentProfileSnapshots,
  ({ one }) => ({
    studentProfile: one(studentProfiles, {
      fields: [studentProfileSnapshots.studentProfileId],
      references: [studentProfiles.id],
    }),
  })
);

export const studentIntakeSessionsRelations = relations(
  studentIntakeSessions,
  ({ one }) => ({
    user: one(users, {
      fields: [studentIntakeSessions.userId],
      references: [users.id],
    }),
  })
);

export const recommendationRunsRelations = relations(
  recommendationRuns,
  ({ many, one }) => ({
    studentProfile: one(studentProfiles, {
      fields: [recommendationRuns.studentProfileId],
      references: [studentProfiles.id],
    }),
    currentSnapshot: one(studentProfileSnapshots, {
      fields: [recommendationRuns.currentSnapshotId],
      references: [studentProfileSnapshots.id],
    }),
    projectedSnapshot: one(studentProfileSnapshots, {
      fields: [recommendationRuns.projectedSnapshotId],
      references: [studentProfileSnapshots.id],
    }),
    results: many(recommendationResults),
    shortlists: many(recommendationShortlists),
  })
);

export const recommendationResultsRelations = relations(
  recommendationResults,
  ({ one }) => ({
    recommendationRun: one(recommendationRuns, {
      fields: [recommendationResults.recommendationRunId],
      references: [recommendationRuns.id],
    }),
    university: one(universities, {
      fields: [recommendationResults.universityId],
      references: [universities.id],
    }),
  })
);

export const recommendationShortlistsRelations = relations(
  recommendationShortlists,
  ({ many, one }) => ({
    recommendationRun: one(recommendationRuns, {
      fields: [recommendationShortlists.recommendationRunId],
      references: [recommendationRuns.id],
    }),
    explanations: many(recommendationExplanations),
  })
);

export const recommendationExplanationsRelations = relations(
  recommendationExplanations,
  ({ one }) => ({
    recommendationShortlist: one(recommendationShortlists, {
      fields: [recommendationExplanations.recommendationShortlistId],
      references: [recommendationShortlists.id],
    }),
    recommendationResult: one(recommendationResults, {
      fields: [recommendationExplanations.recommendationResultId],
      references: [recommendationResults.id],
    }),
  })
);
