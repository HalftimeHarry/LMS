/// <reference path="../pb_data/types.d.ts" />
// Add displayName and role fields to the built-in users auth collection
migrate((app) => {
  const collection = app.findCollectionByNameOrId("_pb_users_auth_");

  collection.fields.add(new Field({
    name: "displayName",
    type: "text",
    required: false
  }));

  collection.fields.add(new Field({
    name: "role",
    type: "select",
    required: false,
    values: ["super_admin", "pool_admin", "participant"],
    maxSelect: 1
  }));

  app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("_pb_users_auth_");
  collection.fields.removeByName("displayName");
  collection.fields.removeByName("role");
  app.save(collection);
});
