/// <reference path="../pb_data/types.d.ts" />

// picks — one record per entry per week.
//
// LMS entries:         pickedTeams holds 1 team the player thinks will LOSE.
// Second Half entries: pickedTeams holds 1–3 teams the player thinks will WIN.
//
// Picks are submitted while the week is "open". Once the week moves to
// "locked" the listRule blocks other participants from reading them.
// When the week reaches "complete" the rule opens up so everyone can see.
//
// pick_results — one record per team per pick, written by admin after games.
// Kept separate so a second_half entry with 3 picks can have 3 independent
// outcomes without denormalising the picks record.

migrate((app) => {

  // ── picks ──────────────────────────────────────────────────────────────────
  const picks = new Collection({
    name: "picks",
    type: "base",
    // listRule / viewRule: owner always sees their own picks.
    // Others can only see picks once the week is locked (deadline passed).
    // Admin roles bypass rules via pbAdmin() server calls.
    listRule: `entry.user = @request.auth.id || week.status != "open"`,
    viewRule: `entry.user = @request.auth.id || week.status != "open"`,
    // Only the entry owner (or admin via server) may create/update/delete.
    createRule: `entry.user = @request.auth.id`,
    updateRule: `entry.user = @request.auth.id && week.status = "open"`,
    deleteRule: `entry.user = @request.auth.id && week.status = "open"`,
    fields: [
      {
        name: "entry",
        type: "relation",
        required: true,
        collectionId: app.findCollectionByNameOrId("entries").id,
        cascadeDelete: true,   // remove picks if entry is deleted
        maxSelect: 1
      },
      {
        name: "week",
        type: "relation",
        required: true,
        collectionId: app.findCollectionByNameOrId("weekly_settings").id,
        cascadeDelete: true,
        maxSelect: 1
      },
      {
        // Up to 3 teams. LMS = 1 team (loser pick). Second Half = 1–3 (winner picks).
        // The UI enforces the correct count based on entryType + secondHalfPicksPerWeek.
        name: "pickedTeams",
        type: "relation",
        required: true,
        collectionId: app.findCollectionByNameOrId("nfl_teams").id,
        cascadeDelete: false,
        maxSelect: 3
      },
      {
        // Mirrors entry.entryType — denormalised here so queries don't need a join.
        name: "entryType",
        type: "select",
        required: true,
        values: ["lms", "second_half"],
        maxSelect: 1
      },
      {
        // Auto-pick: true when the system assigned this pick because the player
        // missed the deadline (biggestFavoriteTeam from weekly_settings).
        name: "isAutoPick",
        type: "bool",
        required: false
      }
    ],
    indexes: [
      // One pick per entry per week — prevents duplicate submissions.
      "CREATE UNIQUE INDEX idx_picks_entry_week ON picks (entry, week)"
    ]
  });
  app.save(picks);

  // ── pick_results ───────────────────────────────────────────────────────────
  // Admin records the outcome for each team in a pick after games are played.
  // For LMS: correct_loss = player survives, incorrect = player is eliminated.
  // For Second Half: correct_win = team won, incorrect = team lost.
  const pickResults = new Collection({
    name: "pick_results",
    type: "base",
    listRule:   "",   // public read — results are always visible
    viewRule:   "",
    createRule: null, // admin only (via pbAdmin server calls)
    updateRule: null,
    deleteRule: null,
    fields: [
      {
        name: "pick",
        type: "relation",
        required: true,
        collectionId: app.findCollectionByNameOrId("picks").id,
        cascadeDelete: true,
        maxSelect: 1
      },
      {
        name: "team",
        type: "relation",
        required: true,
        collectionId: app.findCollectionByNameOrId("nfl_teams").id,
        cascadeDelete: false,
        maxSelect: 1
      },
      {
        // LMS:         correct_loss | incorrect_loss (team won, player out) | pending
        // Second Half: correct_win  | incorrect_win  (team lost, pick wrong) | pending
        name: "result",
        type: "select",
        required: true,
        values: ["pending", "correct", "incorrect"],
        maxSelect: 1
      },
      {
        name: "notes",
        type: "text",
        required: false
      }
    ],
    indexes: [
      // One result per team per pick
      "CREATE UNIQUE INDEX idx_pick_results_pick_team ON pick_results (pick, team)"
    ]
  });
  app.save(pickResults);

}, (app) => {
  // Rollback — delete in reverse dependency order
  try { app.delete(app.findCollectionByNameOrId("pick_results")); } catch (_) {}
  try { app.delete(app.findCollectionByNameOrId("picks")); } catch (_) {}
});
