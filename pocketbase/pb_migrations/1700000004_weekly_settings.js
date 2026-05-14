/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = new Collection({
    name: "weekly_settings",
    type: "base",
    fields: [
      { name: "season", type: "relation", required: true,
        collectionId: app.findCollectionByNameOrId("seasons").id,
        cascadeDelete: false, maxSelect: 1 },
      { name: "week",     type: "number",  required: true },
      { name: "deadline", type: "date",    required: true },
      { name: "status",   type: "select",  required: true,
        values: ["open", "locked", "results_pending", "complete"],
        maxSelect: 1 },
      { name: "biggestFavoriteTeam", type: "relation",
        collectionId: app.findCollectionByNameOrId("nfl_teams").id,
        cascadeDelete: false, maxSelect: 1 },
      { name: "notes", type: "text" }
    ]
  });
  app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("weekly_settings");
  app.delete(collection);
});
