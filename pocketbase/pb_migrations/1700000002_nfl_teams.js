/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = new Collection({
    name: "nfl_teams",
    type: "base",
    fields: [
      { name: "abbreviation", type: "text",   required: true },
      { name: "name",         type: "text",   required: true },
      { name: "city",         type: "text",   required: true },
      { name: "conference",   type: "select", required: true,
        values: ["AFC", "NFC"], maxSelect: 1 },
      { name: "division",     type: "select", required: true,
        values: ["East", "West", "North", "South"], maxSelect: 1 }
    ]
  });
  app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("nfl_teams");
  app.delete(collection);
});
