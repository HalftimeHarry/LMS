/**
 * Migration: add editable rules/winners content fields to seasons.
 *
 * rulesDeadlineNote   - optional text shown in rules/FAQ for deadline wording.
 * winnersLocationNote - optional text shown under past winners to highlight geographic reach.
 * pastWinnersJson     - optional JSON string (array of { year, winner, location, payout }).
 */
migrate(
  (app) => {
    const collection = app.findCollectionByNameOrId('seasons');

    collection.fields.add(new Field({
      name: 'rulesDeadlineNote',
      type: 'text',
      required: false,
      max: 1000,
    }));

    collection.fields.add(new Field({
      name: 'winnersLocationNote',
      type: 'text',
      required: false,
      max: 1000,
    }));

    collection.fields.add(new Field({
      name: 'pastWinnersJson',
      type: 'text',
      required: false,
      max: 10000,
    }));

    app.save(collection);
  },
  (app) => {
    const collection = app.findCollectionByNameOrId('seasons');
    collection.fields.removeByName('rulesDeadlineNote');
    collection.fields.removeByName('winnersLocationNote');
    collection.fields.removeByName('pastWinnersJson');
    app.save(collection);
  }
);
