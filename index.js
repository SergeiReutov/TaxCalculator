const R = require('ramda');

const { execute: executeRevolut } = require('./src/revolut/index.js');
const { execute: executeEtoro } = require('./src/etoro/index.js');

const RUN_MODE = {
  ALL: 'all', // runs everything
  REVOLUT: 'revolut', // runs Revolut only
  ETORO: 'etoro', // runs eToro only
};

(async () => {
  const mode = R.path(['argv', 2], process);
  switch (mode) {
    case RUN_MODE.REVOLUT:
      return await executeRevolut();
    case RUN_MODE.ETORO:
      return await executeEtoro();
    case RUN_MODE.ALL: {
      await executeRevolut();
      await executeEtoro();
      return;
    }
    default:
      throw new Error(`Unknown mode: ${mode}`);
  }
})();
