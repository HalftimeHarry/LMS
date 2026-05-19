/// <reference path="../pb_data/types.d.ts" />
/**
 * Adds pool toggle and configuration fields to the seasons collection:
 *   lmsEnabled              — bool, default true
 *   secondHalfEnabled       — bool, default true
 *   secondHalfStartWeek     — number, week registration opens (default 6)
 *   secondHalfPicksStartWeek — number, week picks increase to secondHalfPicksPerWeek (default 10)
 */
migrate((app) => {
  const collection = app.findCollectionByNameOrId('seasons');

  collection.fields.add(new Field({
    name: 'lmsEnabled', type: 'bool', required: false
  }));
  collection.fields.add(new Field({
    name: 'secondHalfEnabled', type: 'bool', required: false
  }));
  collection.fields.add(new Field({
    name: 'secondHalfStartWeek', type: 'number', required: false, min: 1, max: 18
  }));
  collection.fields.add(new Field({
    name: 'secondHalfPicksStartWeek', type: 'number', required: false, min: 1, max: 18
  }));

  app.save(collection);

  // Back-fill existing seasons with sensible defaults
  const seasons = app.findAllRecords('seasons');
  for (const season of seasons) {
    season.set('lmsEnabled',              true);
    season.set('secondHalfEnabled',       true);
    season.set('secondHalfStartWeek',     6);
    season.set('secondHalfPicksStartWeek', 10);
    app.save(season);
  }
}, (app) => {
  const collection = app.findCollectionByNameOrId('seasons');
  const toRemove = ['lmsEnabled', 'secondHalfEnabled', 'secondHalfStartWeek', 'secondHalfPicksStartWeek'];
  collection.fields = collection.fields.filter((f) => !toRemove.includes(f.name));
  app.save(collection);
});
