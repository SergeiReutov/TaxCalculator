import fs from 'fs';
import neatCsv from 'neat-csv';
import * as R from 'ramda';

import { TYPES } from '../common/enums.js';
import { fetchFxRates } from '../common/fxRates.js';
import {
  writeToFile,
  round,
  sortByDate,
  assignFXRateAndTotalPLN,
  removeCashOperations,
  calculateFees,
  rejectByType,
  groupToDeals,
  calculateDeals,
} from '../common/utils.js';
import {
  parseTrades,
  calculateDividends,
  getLeftoverTrades,
} from './utils.js';


// -------------------------------------------------------------------

let result = {
  dividends: {
    income: 0, // amount of received dividends (gross)
    taxOverall: 0, // dividends.income * tax rate
    taxPaid: 0, // taxes already paid in the US
    tax: 0 // what's left (0 if result is negative)
  },
  trades: {
    expense: 0, // sum of SELL trades + fees
    income: 0, // sum of BUY trades
    profit: 0, // difference
    tax: 0, // profit * tax_rate (0 if result is negative)
  },
  total: { // for viewing purposes only
    profit: 0, // trades.profit + dividends.income - dividends.taxPaid
    tax: 0 // dividends.tax + trades.tax
  },
};

// -------------------------------------------------------------------

async function execute() {
  let csv;
  try {
    csv = fs.readFileSync('./input/revolut/trades.csv', 'utf8');
  } catch (error) {
    console.error('No revolut trades!');
    return result;
  }
  const rawTrades = await neatCsv(csv);
  const leftOverTrades = getLeftoverTrades();
  const sortedTrades = R.pipe(
    parseTrades,
    R.concat(leftOverTrades),
    sortByDate
  )(rawTrades);

  const fxRates = await fetchFxRates({ trades: sortedTrades });
  writeToFile('revolut/fx_rates.json', fxRates);

  const tradesExclCash = R.pipe(
    assignFXRateAndTotalPLN(fxRates),
    removeCashOperations
  )(sortedTrades);

  const fees = calculateFees(tradesExclCash);
  const tradesExclFees = rejectByType(TYPES.CUSTODY_FEE, tradesExclCash);

  result.dividends = calculateDividends(tradesExclFees);
  const tradesExclDividends = rejectByType(TYPES.DIVIDEND, tradesExclCash);
  
  const { deals, openTrades } = groupToDeals(tradesExclDividends);
  writeToFile('revolut/deals.json', deals);
  writeToFile('revolut/openTrades.json', openTrades);

  result.trades = calculateDeals({ deals, fees });

  result.total.profit = round(result.trades.profit + result.dividends.income - result.dividends.taxPaid);
  result.total.tax = Math.max(round(result.dividends.tax + result.trades.tax), 0);

  writeToFile('revolut/result.json', result);

  return result;
}

export {
  execute,
};
