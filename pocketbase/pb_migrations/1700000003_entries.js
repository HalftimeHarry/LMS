/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = new Collection({
    name: "entries",
    type: "base",
    fields: [
      { name: "season",          type: "relation", required: true,
        collectionId: app.findCollectionByNameOrId("seasons").id,
        cascadeDelete: false, maxSelect: 1 },
      { name: "user",            type: "relation", required: true,
        collectionId: app.findCollectionByNameOrId("_pb_users_auth_").id,
        cascadeDelete: false, maxSelect: 1 },
      { name: "entryName",       type: "text",   required: true },
      { name: "status",          type: "select", required: true,
        values: ["pending_payment", "active", "eliminated", "winner"],
        maxSelect: 1 },
      { name: "paid",            type: "bool" },
      { name: "paidAt",          type: "date" },
      { name: "paymentMethod",   type: "select",
        values: ["check", "venmo", "paypal", "zelle", "cash"], maxSelect: 1 },
      { name: "paymentNotes",    type: "text" },
      { name: "eliminatedWeek",  type: "number" },
      { name: "eliminatedReason",type: "text" },
      { name: "referredBy",      type: "text" }
    ]
  });
  app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("entries");
  app.delete(collection);
});
