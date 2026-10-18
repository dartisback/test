const all = [
  ...require('./whitelist'),
  ...require('./assistenza'),
  ...require('./direzione'),
  ...require('./candidature'),
  ...require('./moduli'),
];

module.exports = {
  list: all,
  map: new Map(all.map((c) => [c.data.name, c])),
  json: () => all.map((c) => c.data.toJSON()),
};
