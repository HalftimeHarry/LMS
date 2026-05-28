/**
 * Migration: add maintenanceFee to seasons collection.
 *
 * maintenanceFee — number, deducted from the LMS pot to cover site costs.
 * Defaults to 0 (no fee).
 */
migrate(
  (app) => {
    const collection = app.findCollectionByNameOrId('seasons');
    const field = new Field({
      name:     'maintenanceFee',
      type:     'number',
      required: false,
      min:      0,
    });
    collection.fields.add(field);
    app.save(collection);
  },
  (app) => {
    const collection = app.findCollectionByNameOrId('seasons');
    collection.fields.removeByName('maintenanceFee');
    app.save(collection);
  }
);
