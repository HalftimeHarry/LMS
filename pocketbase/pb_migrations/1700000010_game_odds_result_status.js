/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId('game_odds');
  if (!collection) return;

  const field = collection.fields.find((f) => f.name === 'resultStatus');
  if (!field) {
    collection.fields.add(new Field({
      name: 'resultStatus',
      type: 'select',
      required: false,
      values: ['pending', 'final', 'postponed', 'cancelled'],
      maxSelect: 1,
    }));
    app.save(collection);
  }
}, (app) => {
  const collection = app.findCollectionByNameOrId('game_odds');
  if (!collection) return;
  collection.fields.removeByName('resultStatus');
  app.save(collection);
});
