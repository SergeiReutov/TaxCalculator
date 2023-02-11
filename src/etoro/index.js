import fs from 'fs';
import neatCsv from 'neat-csv';

import { TAX_RATE } from '../common/enums.js';
import { fetchFxRates } from '../common/fxRates.js';
import { writeToFile, round } from '../common/utils.js';
import {
  splitDealsToTrades,
  getDate,
  sortByDate,
  assignFXRateAndTotalPLN,
  groupToDeals,
  calculateDeals,
} from './utils.js';

let result = {
  fees: 0, // overall fees
  dividends: {
    income: 0, // amount of received dividends (gross)
    taxOverall: 0, // dividends.income * tax rate
    taxPaid: 0, // taxes already paid in the US
    tax: 0 // what's left (might be negative if you pay > 19% in the US)
  },
  trades: {
    expense: 0, // sum of SELL trades
    income: 0, // sum of BUY trades
    profit: 0, // difference
    tax: 0 // trades.profit * tax rate
  },
  total: {
    expense: 0, // trades.expense + fees
    income: 0, // only trades.income - dividends are counted and filled separately
    profit: 0, // total.income - total.expense
    tax: 0 // total.profit * tax rate
  },
};

async function execute() {
  const csv = fs.readFileSync('./input/etoro/deals.csv', 'utf8');
  const rawDeals = await neatCsv(csv);
  const trades = splitDealsToTrades(rawDeals);
  const sortedTrades = sortByDate(trades);
  const fxRates = await fetchFxRates({ trades: sortedTrades, getDate });
  writeToFile('etoro/fx_rates.json', fxRates);

  const tradesWithPLN = assignFXRateAndTotalPLN(fxRates)(sortedTrades);

  // result.dividends = calculateDividends(tradesExclFees);

  const { deals } = groupToDeals(tradesWithPLN);
  writeToFile('etoro/deals.json', deals);

  result.trades = calculateDeals(deals);

  result.total.expense = round(result.total.expense + result.trades.expense);
  result.total.income = round(result.total.income + result.trades.income);
  result.total.profit = round(result.total.income - result.total.expense);
  result.total.tax = round(result.total.profit * TAX_RATE + result.dividends.tax);

  writeToFile('etoro/result.json', result);

  return result;
}

export {
  execute,
};