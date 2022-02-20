const csv = require('csv-parser');
const fs = require('fs');
const R = require('ramda');
const moment = require('moment');

const { TAX_RATE, END_DATE, TYPES, PROPERTIES, DATE_FORMAT } = require('./variables.js');
const { fetchFxRates } = require('./fx_rates.js');
const { writeToFile, round } = require('./utils/common.js');
const {
  getDate,
  getQuantity,
  isCashOperation,
  hasDateOutOfRange,
  getTotalPLN,
  throwError
} = require('./utils/trades.js');

// -------------------------------------------------------------------

let rawTrades = [];
let fx_rates = {};
let result = {
  fees: 0, // overall fees
  dividends: {
    income: 0, // amount of received dividends (gross)
    taxOverall: 0, // dividends.income * tax rate
    taxPaid: 0, // already paid taxes in the US
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

const sortByDate = R.sort(
  (tradeA, tradeB) => {
    const dateA = getDate(tradeA);
    const dateB = getDate(tradeB);
    if (dateA.isBefore(dateB)) {
      return -1;
    }
    return 1;
  }
);

const removeTradesAfterEndDate = R.reject(
  (trade = {}) => {
    const date = getDate(trade);
    return date.isAfter(END_DATE);
  }
)

const assignFXRateAndTotalPLN = R.map(
  (trade = {}) => {
    const date = moment(R.prop(PROPERTIES.DATE, trade), DATE_FORMAT);
  
    let fxRate = null;
    while (!fxRate) {
      fxRate = R.prop(
        date.format('YYYY-MM-DD'),
        fx_rates
      );
      date.subtract(1, 'day');
    }
    const totalAmountPLN = R.prop(PROPERTIES.TOTAL_AMOUNT, trade) * fxRate;
    return {
      ...trade,
      [PROPERTIES.FX_RATE]: fxRate,
      [PROPERTIES.TOTAL_PLN]: totalAmountPLN
    };
  }
);

const removeCashOperations = R.reject(isCashOperation);

const calculateFees = (trades = []) => {
  const [totalFees, filteredTrades] = getTotalPLN(TYPES.CUSTODY_FEE, trades);

  result.fees = Math.abs(round(totalFees));
  result.total.expense += result.fees;

  return filteredTrades;
};

// It might be individual per trading platform.
// Revolut takes 15%, but eToro takes 25-30%.
const calculateDividends = (trades = []) => {
  const [totalDividends, filteredTrades] = getTotalPLN(TYPES.DIVIDEND, trades);

  // This will work only for Revolut - it shows already NET received value,
  // which is equal to 85% of the gross one.
  const dividendIncome = round(totalDividends / 0.85);
  const dividendTaxOverall = round(dividendIncome * TAX_RATE);
  const dividendTaxPaid = round(dividendIncome - totalDividends);
  
  result.dividends.income = dividendIncome;
  result.dividends.taxOverall = dividendTaxOverall;
  result.dividends.taxPaid = dividendTaxPaid;
  result.dividends.tax = round(dividendTaxOverall - dividendTaxPaid);

  return filteredTrades;
};

const splitDeal = (initialDeal, trade) => {
  const tradeQuantity = getQuantity(trade);
  let subDeal = [];
  let deal = [...initialDeal];
  let subDealCurrentQuantity = 0;
  while (subDealCurrentQuantity < tradeQuantity) {
    const subTrade = deal.shift();
    subDeal.push(subTrade);
    subDealCurrentQuantity += getQuantity(subTrade);
  }
  const leftoverQuantity = subDealCurrentQuantity - tradeQuantity;
  const tradeToSplit = subDeal.pop();
  const leftoverTrade = {
    ...tradeToSplit,
    [PROPERTIES.QUANTITY]: leftoverQuantity
  };
  const completedTrade = {
    ...tradeToSplit,
    [PROPERTIES.QUANTITY]: getQuantity(tradeToSplit) - leftoverQuantity
  };
  subDeal.push(completedTrade);
  subDeal.push(trade);
  deal.unshift(leftoverTrade);
  return [subDeal, deal];
};

const getDeals = (trades = []) => {
  let deals = [];
  let currentQuantity = 0;
  let deal = [];
  trades.forEach((trade) => {
    const tradeQuantity = getQuantity(trade);
    if (R.propEq(PROPERTIES.TYPE, TYPES.BUY, trade)) {
      currentQuantity += tradeQuantity;
      deal.push(trade);
    } else {
      currentQuantity -= tradeQuantity;
      if (hasDateOutOfRange(trade)) {
        if (currentQuantity <= 0) {
          deal = [];
          currentQuantity = 0;
        } else {
          [, deal] = splitDeal(deal, trade);
        }
      } else {
        if (currentQuantity < 0) {
          throwError('SELL with no corresponding BUY', trade);
        } else if (currentQuantity === 0) {
          deal.push(trade);
          deals.push(deal);
          deal = [];
        } else if (currentQuantity > 0) {
          let subDeal = [];
          [subDeal, deal] = splitDeal(deal, trade);
          deals.push(subDeal);
        }
      }
    }
  });
  return deals;
};

const groupToDeals = R.pipe(
  R.groupBy(R.prop(PROPERTIES.TICKER)),
  R.map(getDeals),
  R.pickBy((deals = []) => deals.length > 0),
);

const calculateDealBalance = R.map(
  (deal = []) => {
    let expense = 0;
    let income = 0;
    deal.forEach((trade) => {
      const cost = R.prop(PROPERTIES.TOTAL_PLN, trade);
      if (R.propEq(PROPERTIES.TYPE, TYPES.BUY, trade)) {
        expense += cost;
      } else {
        income += cost;
      }
    });
    return { expense, income };
  }
);

const calculateTickerBalance = (balanceList = []) => {
  let expense = 0;
  let income = 0;
  balanceList.forEach((balance) => {
    expense += balance.expense;
    income += balance.income;
  });
  return { expense, income };
};

const calculateTradesBalance = (tickerBalances = {}) => {
  let totalExpense = 0;
  let totalIncome = 0;
  Object.values(tickerBalances).forEach((balance) => {
    totalExpense += balance.expense;
    totalIncome += balance.income;
  });
  totalExpense = round(totalExpense);
  totalIncome = round(totalIncome);
  const totalProfit = round(totalIncome - totalExpense);

  result.trades.expense = totalExpense;
  result.trades.income = totalIncome;
  result.trades.profit = totalProfit
  result.trades.tax = round(totalProfit * TAX_RATE);

  result.total.expense = round(result.total.expense + result.trades.expense);
  result.total.income = round(result.total.income + result.trades.income);
};

const calculateTrades = R.pipe(
  R.map(calculateDealBalance),
  R.map(calculateTickerBalance),
  calculateTradesBalance
);

const calculateTotal = () => {
  result.total.profit = round(result.total.income - result.total.expense);
  result.total.tax = round(result.total.profit * TAX_RATE);
}


// -------------------------------------------------------------------

fs.createReadStream('trades.csv')
  .pipe(csv())
  .on('data', (data) => rawTrades.push(data))
  .on('end', async () => {
    const sortedTrades = sortByDate(rawTrades);
    fx_rates = await fetchFxRates(sortedTrades);

    R.pipe(
      removeTradesAfterEndDate,
      assignFXRateAndTotalPLN,
      removeCashOperations,
      calculateFees,
      calculateDividends,
      groupToDeals,
      writeToFile('deals.json'),
      calculateTrades
    )(sortedTrades);

    calculateTotal();
    writeToFile('result.json', result);
  });