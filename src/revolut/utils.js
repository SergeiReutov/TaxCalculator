const fs = require('fs');
const moment = require('moment');
const R = require('ramda');

const { round } = require('../common/utils.js');
const { TAX_RATE } = require('../common/enums.js');
const { TYPES, PROPERTIES, DATE_FORMAT, DIVIDEND_NET_RATE } = require('./enums.js');

const getDate = (trade) => moment(R.prop(PROPERTIES.DATE, trade), DATE_FORMAT);

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

const getTotalAmount = R.pipe(
  R.prop(PROPERTIES.TOTAL_AMOUNT),
  (string) => string.replace(/[$,]/g, ''),
  parseFloat
);

const assignFXRateAndTotalPLN = (fxRates) => (trades = []) => R.map(
  (trade = {}) => {
    // fx rate for the previous day of the trade's date
    const date = moment(R.prop(PROPERTIES.DATE, trade), DATE_FORMAT).subtract(1, 'day');
  
    // in case there's no fxRate for a given date trade
    // (e.g. it was a weekend or a national holiday)
    // we need to take the fxRate for the previous working day
    let fxRate = null;
    while (!fxRate) {
      fxRate = R.prop(
        date.format('YYYY-MM-DD'),
        fxRates
      );
      date.subtract(1, 'day');
    }
    const totalAmountPLN = getTotalAmount(trade) * fxRate;
    return {
      ...trade,
      [PROPERTIES.FX_RATE]: fxRate,
      [PROPERTIES.TOTAL_PLN]: totalAmountPLN
    };
  },
  trades
);


const isCashOperation = R.either(
  R.propEq(PROPERTIES.TYPE, TYPES.CASH_IN),
  R.propEq(PROPERTIES.TYPE, TYPES.CASH_OUT)
);

const removeCashOperations = R.reject(isCashOperation);

const filterByType = R.curry((type, trades) => R.filter(
  R.propEq(PROPERTIES.TYPE, type),
  trades
));

const rejectByType = R.curry((type, trades) => R.reject(
  R.propEq(PROPERTIES.TYPE, type),
  trades
));

const sumPLN = R.reduce(
  (acc, trade) => acc += R.prop(PROPERTIES.TOTAL_PLN, trade),
  0
);

const calculateFees = R.pipe(
  filterByType(TYPES.CUSTODY_FEE),
  sumPLN,
  (fees) => Math.abs(round(fees))
);

const calculateDividends = (trades = []) => {
  const totalDividends = R.pipe(
    filterByType(TYPES.DIVIDEND),
    sumPLN
  )(trades);

  const income = round(totalDividends / DIVIDEND_NET_RATE);
  const taxOverall = round(income * TAX_RATE);
  const taxPaid = round(income - totalDividends);
  const tax = round(taxOverall - taxPaid);

  return {
    income,
    taxOverall,
    taxPaid,
    tax,
  };
};

const prependLeftoverTrades = (trades = []) => {
  try {
    const leftoverTrades = JSON.parse(fs.readFileSync('./input/revolut/leftoverTrades.json', 'utf8'));
    return R.concat(
      R.pipe(
        R.values,
        R.flatten
      )(leftoverTrades),
      trades
    );
  } catch (error) {
    console.error('Error reading leftoverTrades');
    return trades;
  }
};

const getQuantity = (trade) => parseFloat(R.prop(PROPERTIES.QUANTITY, trade));

const throwError = (error, trade = {}) => {
  const date = getDate(trade).format('YYYY-MM-DD');
  console.error(`Error: ${error}`);
  console.error(`${date} - ${R.prop(PROPERTIES.TYPE, trade)} - ${R.prop(PROPERTIES.TICKER, trade)} - ${R.prop(PROPERTIES.QUANTITY, trade)}`);
  console.error('--------------------');
  throw new Error(error);
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
  let result = [];
  let currentQuantity = 0;
  let currentDeal = [];
  let openTrades = [];
  trades.forEach((trade) => {
    const tradeQuantity = getQuantity(trade);
    if (R.propEq(PROPERTIES.TYPE, TYPES.STOCK_SPLIT, trade)) {
      currentQuantity += tradeQuantity;
      return;
    }
    if (R.propEq(PROPERTIES.TYPE, TYPES.BUY, trade)) {
      // if BUY trade - just increase currentQuantity
      currentQuantity += tradeQuantity;
      currentDeal.push(trade);
      return;
    }
    // if SELL trade - decrease currentQuantity
    currentQuantity -= tradeQuantity;
    if (currentQuantity < 0) {
      // means your input is not full
      // check leftoverTrades from the past year
      // should be in input/leftoverTrades.json
      throwError('SELL with no corresponding BUY', trade);
    } else if (currentQuantity === 0) {
      // means the currentTrade is done
      currentDeal.push(trade);
      result.push(currentDeal);
      currentDeal = [];
    } else if (currentQuantity > 0) {
      // means you sold just a part of bought stocks
      let subDeal = [];
      [subDeal, currentDeal] = splitDeal(currentDeal, trade);
      result.push(subDeal);
    }
  });
  if (currentDeal.length) {
    // means you have open trades at the end of the year
    // they will be stored in 'openTrades.json'
    // that should be used as 'leftoverTrades.json' in the next year
    openTrades = currentDeal;
  }
  return { deals: result, openTrades };
};

const notEmpty = (deals = []) => deals.length > 0;

const groupToDeals = R.pipe(
  R.groupBy(R.prop(PROPERTIES.TICKER)),
  R.map(getDeals),
  (groups) => ({
    deals: R.pipe(
      R.map(R.prop('deals')),
      R.pickBy(notEmpty)
    )(groups),
    openTrades: R.pipe(
      R.map(R.prop('openTrades')),
      R.pickBy(notEmpty)
    )(groups),
  })
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

const calculateTotalBalance = (tickerBalances = {}) => {
  let totalExpense = 0;
  let totalIncome = 0;
  Object.values(tickerBalances).forEach((balance) => {
    totalExpense += balance.expense;
    totalIncome += balance.income;
  });
  totalExpense = round(totalExpense);
  totalIncome = round(totalIncome);
  const totalProfit = round(totalIncome - totalExpense);
  const totalTax = round(totalProfit * TAX_RATE);

  return {
    expense: totalExpense,
    income: totalIncome,
    profit: totalProfit,
    tax: totalTax,
  }
};

const calculateDeals = R.pipe(
  R.map(calculateDealBalance),
  R.map(calculateTickerBalance),
  calculateTotalBalance
);

module.exports = {
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
};