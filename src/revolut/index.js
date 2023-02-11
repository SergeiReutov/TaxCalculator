const csv = require('csv-parser');
const fs = require('fs');
const R = require('ramda');

const { TYPES } = require('./enums.js');
const { TAX_RATE } = require('../common/enums.js');
const { fetchFxRates } = require('../common/fxRates.js');
const { writeToFile, round } = require('../common/utils.js');
const {
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
} = require('./utils.js');


// -------------------------------------------------------------------

let rawTrades = [];
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
  return fs.createReadStream('./input/revolut/trades.csv')
    .pipe(csv())
    .on('data', (data) => rawTrades.push(data))
    .on('end', async () => {
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
    });
}

module.exports = {
  execute,
};
