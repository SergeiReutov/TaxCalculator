import fs from 'fs';
import * as R from 'ramda';

const writeToFile = R.curry((file, data) => {
  fs.writeFileSync(`output/${file}`, JSON.stringify(data));
  return data;
});

const round = (number) => Math.round((number + Number.EPSILON) * 100) / 100;

const debug = R.curry((message, data) => {
  console.log(message);
  return data;
})

export {
  writeToFile,
  round,
  debug,
};