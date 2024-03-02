import fs from 'fs';
import moment from 'moment';
import * as R from 'ramda';

import { round, filterByType, sumPLN } from '../common/utils.js';
import { TAX_RATE, TYPES, PROPERTIES } from '../common/enums.js';
import { TYPES_MAPPING, DATE_FORMAT, DIVIDEND_NET_RATE } from './enums.js';

const parseTrades = R.map((trade) => ({
  [PROPERTIES.DATE]: R.pipe(
    R.prop('Date'),
    (date) => moment(date, DATE_FORMAT).format('YYYY-MM-DD')
  )(trade),
  [PROPERTIES.TICKER]: R.prop('Ticker', trade),
  [PROPERTIES.TYPE]: R.pipe(
    R.prop('Type'),
    (type) => R.prop(type, TYPES_MAPPING)
  )(trade),
  [PROPERTIES.QUANTITY]: R.pipe(
    R.prop('Quantity'),
    parseFloat
  )(trade),
  [PROPERTIES.PRICE]: R.pipe(
    R.prop('Price per share'),
    R.replace(/[^0-9\.]/g, ''),
    parseFloat
  )(trade),
  [PROPERTIES.TOTAL_AMOUNT]: R.pipe(
    R.prop('Total Amount'),
    R.replace(/[^0-9\.]/g, ''),
    parseFloat
  )(trade),
}));


const calculateDividends = (trades = []) => {
  const totalDividends = R.pipe(
    filterByType(TYPES.DIVIDEND),
    sumPLN
  )(trades);

  const income = round(totalDividends / DIVIDEND_NET_RATE);
  const taxOverall = round(income * TAX_RATE);
  const taxPaid = round(income - totalDividends);
  const tax = Math.max(round(taxOverall - taxPaid), 0);

  return {
    income,
    taxOverall,
    taxPaid,
    tax,
  };
};

const getLeftoverTrades = () => {
  try {
    const leftoverTrades = JSON.parse(fs.readFileSync('./input/revolut/leftoverTrades.json', 'utf8'));
    return R.pipe(
      R.values,
      R.flatten
    )(leftoverTrades);
  } catch (error) {
    console.error('No revolut leftoverTrades');
    return [];
  }
};

export {
  parseTrades,
  calculateDividends,
  getLeftoverTrades,
};