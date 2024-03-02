import fs from 'fs';
import * as R from 'ramda';
import moment from 'moment';
import { TYPES, PROPERTIES, TAX_RATE } from './enums.js'; 

const writeToFile = R.curry((file, data) => {
  fs.writeFileSync(`output/${file}`, JSON.stringify(data));
  return data;
});

const round = (number) => Math.round((number + Number.EPSILON) * 100) / 100;

const roundUnits = (number) => Math.round((number + Number.EPSILON) * 1000000) / 100000;

const debug = R.curry((message, data) => {
  console.log(message);
  return data;
});

const sortByDate = R.sort(
  (tradeA, tradeB) => {
    const dateA = moment(R.prop(PROPERTIES.DATE, tradeA), 'YYYY-MM-DD');
    const dateB = moment(R.prop(PROPERTIES.DATE, tradeB), 'YYYY-MM-DD');
    if (dateA.isBefore(dateB)) {
      return -1;
    }
    return 1;
  }
);

const assignFXRateAndTotalPLN = (fxRates) => (trades = []) => R.map(
  (trade = {}) => {
    // fx rate for the previous day of the trade's date
    const date = moment(R.prop(PROPERTIES.DATE, trade), 'YYYY-MM-DD').subtract(1, 'day');
  
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
    const totalAmountPLN = R.prop(PROPERTIES.TOTAL_AMOUNT, trade) * fxRate;
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

const sumUSD = R.reduce(
  (acc, trade) => acc += R.prop(PROPERTIES.TOTAL_AMOUNT, trade),
  0
);

const calculateFees = R.pipe(
  filterByType(TYPES.CUSTODY_FEE),
  (fees) => ({
    pln: sumPLN(fees),
    usd: sumUSD(fees),
  }),
  (fees) => ({
    pln: Math.abs(round(fees.pln)),
    usd: Math.abs(round(fees.usd)),
  })
);

const throwError = (error, trade = {}) => {
  console.error(`Error: ${error}`);
  console.error(`${R.prop(PROPERTIES.DATE, trade)} - ${
    R.prop(PROPERTIES.TYPE, trade)} - ${
    R.prop(PROPERTIES.TICKER, trade)} - ${
    R.prop(PROPERTIES.QUANTITY, trade)
  }`);
  console.error('--------------------');
  throw new Error(error);
};

const splitDeal = (initialDeal, trade) => {
  const tradeQuantity = R.prop(PROPERTIES.QUANTITY, trade);
  let subDeal = [];
  let deal = [...initialDeal];
  let subDealCurrentQuantity = 0;
  while (subDealCurrentQuantity < tradeQuantity) {
    const subTrade = deal.shift();
    subDeal.push(subTrade);
    subDealCurrentQuantity += R.prop(PROPERTIES.QUANTITY, subTrade);
  }
  const leftoverQuantity = subDealCurrentQuantity - tradeQuantity;
  const tradeToSplit = subDeal.pop();
  const leftoverTrade = {
    ...tradeToSplit,
    [PROPERTIES.QUANTITY]: leftoverQuantity,
    [PROPERTIES.TOTAL_AMOUNT]: round(R.prop(PROPERTIES.PRICE, tradeToSplit) * leftoverQuantity),
    [PROPERTIES.TOTAL_PLN]: round(
      R.prop(PROPERTIES.PRICE, tradeToSplit) * leftoverQuantity * R.prop(PROPERTIES.FX_RATE, tradeToSplit)
    ),
  };
  const completedQuantity = R.prop(PROPERTIES.QUANTITY, tradeToSplit) - leftoverQuantity;
  const completedTrade = {
    ...tradeToSplit,
    [PROPERTIES.QUANTITY]: completedQuantity,
    [PROPERTIES.TOTAL_AMOUNT]: round(R.prop(PROPERTIES.PRICE, tradeToSplit) * completedQuantity),
    [PROPERTIES.TOTAL_PLN]: round(
      R.prop(PROPERTIES.PRICE, tradeToSplit) * completedQuantity * R.prop(PROPERTIES.FX_RATE, tradeToSplit)
    ),
  };
  subDeal.push(completedTrade);
  subDeal.push(trade);
  if (leftoverQuantity > 0) {
    deal.unshift(leftoverTrade);
  }
  return [subDeal, deal];
};

const getDeals = (trades = []) => {
  let result = [];
  let currentQuantity = 0;
  let currentDeal = [];
  let openTrades = [];
  trades.forEach((trade) => {
    const tradeQuantity = R.prop(PROPERTIES.QUANTITY, trade);
    if (R.propEq(PROPERTIES.TYPE, TYPES.STOCK_SPLIT, trade)) {
      currentQuantity += roundUnits(tradeQuantity);
      return;
    }
    if (R.propEq(PROPERTIES.TYPE, TYPES.BUY, trade)) {
      // if BUY trade - just increase currentQuantity
      currentQuantity += roundUnits(tradeQuantity);
      currentDeal.push(trade);
      return;
    }
    // if SELL trade - decrease currentQuantity
    currentQuantity -= roundUnits(tradeQuantity);
    if (roundUnits(currentQuantity) < 0) {
      // means your input is not full
      // check leftoverTrades from the past year
      // should be in input/leftoverTrades.json
      throwError('SELL with no corresponding BUY', trade);
    } else if (roundUnits(currentQuantity) === 0) {
      // means the currentTrade is done
      currentDeal.push(trade);
      result.push(currentDeal);
      currentDeal = [];
    } else if (roundUnits(currentQuantity) > 0) {
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
    let expenseUsd = 0;
    let income = 0;
    let incomeUsd = 0;
    deal.forEach((trade) => {
      const cost = R.prop(PROPERTIES.TOTAL_PLN, trade);
      const costUsd = R.prop(PROPERTIES.TOTAL_AMOUNT, trade);
      if (R.propEq(PROPERTIES.TYPE, TYPES.BUY, trade)) {
        expense += cost;
        expenseUsd += costUsd;
      } else {
        income += cost;
        incomeUsd += costUsd;
      }
    });
    return { expense, expenseUsd, income, incomeUsd };
  }
);

const calculateTickerBalance = (balanceList = []) => {
  let expense = 0;
  let expenseUsd = 0;
  let income = 0;
  let incomeUsd = 0;
  balanceList.forEach((balance) => {
    expense += balance.expense;
    expenseUsd += balance.expenseUsd;
    income += balance.income;
    incomeUsd += balance.incomeUsd;
  });
  return { expense, expenseUsd, income, incomeUsd };
};

const calculateTotalBalance = (fees) => (tickerBalances = {}) => {
  let totalExpense = 0;
  let totalExpenseUsd = 0;
  let totalIncome = 0;
  let totalIncomeUsd = 0;
  Object.values(tickerBalances).forEach((balance) => {
    totalExpense += balance.expense;
    totalExpenseUsd += balance.expenseUsd;
    totalIncome += balance.income;
    totalIncomeUsd += balance.incomeUsd;
  });
  totalExpense = round(totalExpense + fees.pln);
  totalExpenseUsd = round(totalExpenseUsd + fees.usd);
  totalIncome = round(totalIncome);
  totalIncomeUsd = round(totalIncomeUsd);
  const totalProfit = round(totalIncome - totalExpense);
  const totalProfitUsd = round(totalIncomeUsd - totalExpenseUsd);
  const totalTax = Math.max(round(totalProfit * TAX_RATE), 0);

  return {
    expense: totalExpense,
    expenseUsd: totalExpenseUsd,
    income: totalIncome,
    incomeUsd: totalIncomeUsd,
    profit: totalProfit,
    profitUsd: totalProfitUsd,
    tax: totalTax,
  }
};

const calculateDeals = ({ deals, fees }) => R.pipe(
  R.map(calculateDealBalance),
  R.map(calculateTickerBalance),
  calculateTotalBalance(fees)
)(deals);

export {
  writeToFile,
  round,
  debug,
  sortByDate,
  assignFXRateAndTotalPLN,
  removeCashOperations,
  calculateFees,
  filterByType,
  rejectByType,
  sumPLN,
  sumUSD,
  groupToDeals,
  calculateDeals,
};