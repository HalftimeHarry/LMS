/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = new Collection({
    name: "seasons",
    type: "base",
    fields: [
      { name: "year",               type: "number",  required: true },
      { name: "name",               type: "text",    required: true },
      { name: "entryFee",           type: "number",  required: true },
      { name: "status",             type: "select",  required: true,
        values: ["setup", "open", "active", "complete"], maxSelect: 1 },
      { name: "regularSeasonOnly",  type: "bool" },
      { name: "paymentDeadline",    type: "date" },
      { name: "firstPickDeadline",  type: "date" },
      { name: "notes",              type: "text" }
    ]
  });
  app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("seasons");
  app.delete(collection);
});
