import * as R from 'ramda';

import { round, writeToFile } from './src/common/utils.js';
import { execute as executeRevolut } from './src/revolut/index.js';
import { execute as executeEtoro } from './src/etoro/index.js';
import { TAX_RATE } from './src/common/enums.js';

const RUN_MODE = {
  ALL: 'all', // runs everything
  REVOLUT: 'revolut', // runs Revolut only
  ETORO: 'etoro', // runs eToro only
};

let result = {
  dividends: {
    income: 0, // sum of dividends.income
    taxOverall: 0, // sum of dividends.taxOverall
    taxPaid: 0, // sum of dividends.taxPaid
    tax: 0 // sum of dividends.tax (might not be equal to taxOverall - taxPaid)
  },
  trades: {
    expense: 0, // sum of trades.expense
    income: 0, // sum of trades.income
    profit: 0, // sum of trades.profit
    tax: 0, // (trades.profit * tax rate)
  },
  total: {
    profit: 0, // sum of total.profit
    tax: 0 // trades.tax + dividends.tax
  },
};

(async () => {
  const mode = R.path(['argv', 2], process);
  switch (mode) {
    case RUN_MODE.REVOLUT:
      return await executeRevolut();
    case RUN_MODE.ETORO:
      return await executeEtoro();
    case RUN_MODE.ALL: {
      const revolutResult = await executeRevolut();
      const etoroResult = await executeEtoro();

      result.dividends.income = round(revolutResult.dividends.income + etoroResult.dividends.income);
      result.dividends.taxOverall = round(revolutResult.dividends.taxOverall + etoroResult.dividends.taxOverall);
      result.dividends.taxPaid = round(revolutResult.dividends.taxPaid + etoroResult.dividends.taxPaid);
      result.dividends.tax = round(revolutResult.dividends.tax + etoroResult.dividends.tax);

      result.trades.expense = round(revolutResult.trades.expense + etoroResult.trades.expense);
      result.trades.income = round(revolutResult.trades.income + etoroResult.trades.income);
      result.trades.profit = round(revolutResult.trades.profit + etoroResult.trades.profit);
      result.trades.tax = round(result.trades.profit * TAX_RATE);

      result.total.profit = round(revolutResult.total.profit + etoroResult.total.profit);
      result.total.tax = round(result.dividends.tax + result.trades.tax);

      writeToFile('result.json', result);

      return result;
    }
    default:
      throw new Error(`Unknown mode: ${mode}`);
  }
})();
