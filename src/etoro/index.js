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
  parseDividends,
  calculateDividends,
} from './utils.js';

let result = {
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
    tax: 0, // profit * tax rate
  },
  total: {
    profit: 0, // total.income - total.expense
    tax: 0 // total.profit * tax rate
  },
};

async function execute() {
  let csv;
  try {
    csv = fs.readFileSync('./input/etoro/deals.csv', 'utf8');
  } catch (error) {
    console.error('No etoro deals!');
    return result;
  }
  const rawData = await neatCsv(csv);
  const trades = parseTrades(rawData);
  const dividendTrades = await parseDividends();
  const sortedTrades = sortByDate([...trades, ...dividendTrades]);
  
  const fxRates = await fetchFxRates({ trades: sortedTrades });
  writeToFile('etoro/fx_rates.json', fxRates);

  const tradesExclCash = R.pipe(
    assignFXRateAndTotalPLN(fxRates),
    removeCashOperations
  )(sortedTrades);

  const fees = calculateFees(tradesExclCash);
  const tradesExclFees = rejectByType(TYPES.CUSTODY_FEE, tradesExclCash);

  result.dividends = calculateDividends(tradesExclFees);
  const tradesExclDividends = rejectByType(TYPES.DIVIDEND, tradesExclFees);

  const { deals } = groupToDeals(tradesExclDividends);
  writeToFile('etoro/deals.json', deals);

  result.trades = calculateDeals({ deals, fees });

  result.total.profit = round(result.trades.profit + result.dividends.income - result.dividends.taxPaid);
  result.total.tax = Math.max(round(result.dividends.tax + result.trades.tax), 0);

  writeToFile('etoro/result.json', result);

  return result;
}

export {
  execute,
};