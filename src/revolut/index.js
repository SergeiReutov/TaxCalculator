import fs from 'fs';
import neatCsv from 'neat-csv';
import * as R from 'ramda';

import { TYPES } from './enums.js';
import { TAX_RATE } from '../common/enums.js';
import { fetchFxRates } from '../common/fxRates.js';
import { writeToFile, round } from '../common/utils.js';
import {
  getDate,
  sortByDate,
  assignFXRateAndTotalPLN,
  removeCashOperations,
  calculateFees,
  rejectByType,
  calculateDividends,
  prependLeftoverTrades,
  groupToDeals,
  calculateDeals,
} from './utils.js';


// -------------------------------------------------------------------

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

// -------------------------------------------------------------------

async function execute() {
  const csv = fs.readFileSync('./input/revolut/trades.csv', 'utf8');
  const rawTrades = await neatCsv(csv);

  const sortedTrades = sortByDate(rawTrades);
  const fxRates = await fetchFxRates({ trades: sortedTrades, getDate });
  writeToFile('revolut/fx_rates.json', fxRates);

  const tradesExclCash = R.pipe(
    assignFXRateAndTotalPLN(fxRates),
    removeCashOperations
  )(sortedTrades);

  const fees = calculateFees(tradesExclCash);
  result.fees = fees;
  result.total.expense += fees;

  const tradesExclFees = rejectByType(TYPES.CUSTODY_FEE, tradesExclCash);
  result.dividends = calculateDividends(tradesExclFees);

  const tradesExclDividends = rejectByType(TYPES.DIVIDEND, tradesExclCash);
  const trades = prependLeftoverTrades(tradesExclDividends);
  const { deals, openTrades } = groupToDeals(trades);
  writeToFile('revolut/deals.json', deals);
  writeToFile('revolut/openTrades.json', openTrades);

  result.trades = calculateDeals(deals);

  result.total.expense = round(result.total.expense + result.trades.expense);
  result.total.income = round(result.total.income + result.trades.income);
  result.total.profit = round(result.total.income - result.total.expense);
  result.total.tax = round(result.total.profit * TAX_RATE + result.dividends.tax);

  writeToFile('revolut/result.json', result);

  return result;
}

export {
  execute,
};
