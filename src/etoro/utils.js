import fs from 'fs';
import moment from 'moment';
import * as R from 'ramda';
import neatCsv from 'neat-csv';

import { round, filterByType, sumPLN } from '../common/utils.js';
import { TYPES, PROPERTIES }  from '../common/enums.js';
import { DATE_FORMAT } from './enums.js';

const parseTrades = R.pipe(
  R.map((deal) => [
    {
      [PROPERTIES.TICKER]: R.pipe(
        R.prop('Action'),
        R.replace('Buy ', '')
      )(deal),
      [PROPERTIES.TYPE]: TYPES.BUY,
      [PROPERTIES.DATE]: R.pipe(
        R.prop('Open Date'),
        (date) => moment(date, DATE_FORMAT).format('YYYY-MM-DD')
      )(deal),
      [PROPERTIES.QUANTITY]: R.pipe(
        R.prop('Units'),
        parseFloat
      )(deal),
      [PROPERTIES.PRICE]: R.pipe(
        R.prop('Open Rate'),
        R.replace(/[^0-9\,]/g, ''),
        R.replace(',', '.'),
        parseFloat
      )(deal),
      [PROPERTIES.TOTAL_AMOUNT]: R.pipe(
        R.prop('Units'),
        parseFloat,
        R.multiply(
          R.pipe(
            R.prop('Open Rate'),
            R.replace(/[^0-9\,]/g, ''),
            R.replace(',', '.'),
            parseFloat,
          )(deal)
        ),
        round
      )(deal),
    },
    {
      [PROPERTIES.TICKER]: R.pipe(
        R.prop('Action'),
        R.replace('Buy ', '')
      )(deal),
      [PROPERTIES.TYPE]: TYPES.SELL,
      [PROPERTIES.DATE]: R.pipe(
        R.prop('Close Date'),
        (date) => moment(date, DATE_FORMAT).format('YYYY-MM-DD')
      )(deal),
      [PROPERTIES.QUANTITY]: R.pipe(
        R.prop('Units'),
        parseFloat
      )(deal),
      [PROPERTIES.PRICE]: R.pipe(
        R.prop('Close Rate'),
        R.replace(/[^0-9\,]/g, ''),
        R.replace(',', '.'),
        parseFloat
      )(deal),
      [PROPERTIES.TOTAL_AMOUNT]: R.pipe(
        R.prop('Units'),
        parseFloat,
        R.multiply(
          R.pipe(
            R.prop('Close Rate'),
            R.replace(/[^0-9\,]/g, ''),
            R.replace(',', '.'),
            parseFloat,
          )(deal)
        ),
        round
      )(deal),
    }
  ]),
  R.flatten
);

const parseDividends = async () => {
  try {
    const csv = fs.readFileSync('./input/etoro/dividends.csv', 'utf8');
    const rawDividendTrades = await neatCsv(csv);
    return R.map((trade) => ({
      [PROPERTIES.TICKER]: R.prop('Instrument Name', trade),
      [PROPERTIES.TYPE]: TYPES.DIVIDEND,
      [PROPERTIES.DATE]: R.pipe(
        R.prop('Date of Payment'),
        (date) => moment(date, 'DD/MM/YYYY').format('YYYY-MM-DD')
      )(trade),
      [PROPERTIES.TOTAL_AMOUNT]: R.pipe(
        R.prop('Net Dividend Received (USD)'),
        R.replace(',', '.'),
        parseFloat
      )(trade),
    }), rawDividendTrades);
  } catch (error) {
    console.error('No etoro dividends!');
    return [];
  }
}

// It is super hard to calculate dividends in eToro
// there's no W-8BEN Form, and I pay 25-30% for each dividend.
// And still I have to pay 4% on the NET amount!!
const calculateDividends = (trades = []) => {
  const totalDividends = R.pipe(
    filterByType(TYPES.DIVIDEND),
    sumPLN
  )(trades);

  const income = round(totalDividends); // would count NET amount as income
  const taxOverall = 0; // not needed
  const taxPaid = 0; // not needed
  const tax = round(income * 0.04);

  return {
    income,
    taxOverall,
    taxPaid,
    tax,
  };
};

export {
  parseTrades,
  parseDividends,
  calculateDividends,
};