const R = require('ramda');
const moment = require('moment');

const { START_DATE, END_DATE, TYPES, PROPERTIES, DATE_FORMAT } = require('../variables.js');

const getDate = (trade) => moment(R.prop(PROPERTIES.DATE, trade), DATE_FORMAT);

const getQuantity = (trade) => parseFloat(R.prop(PROPERTIES.QUANTITY, trade));

const isCashOperation = R.either(
  R.propEq(PROPERTIES.TYPE, TYPES.CASH_IN),
  R.propEq(PROPERTIES.TYPE, TYPES.CASH_OUT)
);

const separateByType = (type, trades) => R.partition(
  R.propEq(PROPERTIES.TYPE, type),
  trades
);

const hasDateOutOfRange = (trade = {}) => {
  const date = getDate(trade);
  return date.isBefore(moment(START_DATE).startOf('day'))
    || date.isAfter(moment(END_DATE).endOf('day'));
};

const sumPLN = R.reduce(
  (acc, trade) => acc += R.prop(PROPERTIES.TOTAL_PLN, trade),
  0
);

const getTotalPLN = (type, trades) => {
  const [items, filteredTrades] = separateByType(type, trades);

  const totalPLN = R.pipe(
    R.reject(hasDateOutOfRange),
    sumPLN
  )(items);

  return [totalPLN, filteredTrades];
};

const throwError = (error, trade = {}) => {
  const date = getDate(trade).format('YYYY-MM-DD');
  console.error(`Error: ${error}`);
  console.error(`${date} - SELL - ${R.prop(PROPERTIES.TICKER, trade)} - ${R.prop(PROPERTIES.QUANTITY, trade)}`);
  throw new Error(error);
};

module.exports = {
  getDate,
  getQuantity,
  isCashOperation,
  separateByType,
  hasDateOutOfRange,
  getTotalPLN,
  throwError
};