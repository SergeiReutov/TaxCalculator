const fs = require('fs');
const R = require('ramda');

const writeToFile = R.curry((file, data) => {
  fs.writeFileSync(file, JSON.stringify(data));
  return data;
});

const round = (number) => Math.round((number + Number.EPSILON) * 100) / 100;

module.exports = {
  writeToFile,
  round,
}