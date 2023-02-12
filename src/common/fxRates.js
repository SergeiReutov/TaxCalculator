import * as R from 'ramda';
import moment from 'moment';
import fetch from 'node-fetch';

import { NBP_BASE_URL, PROPERTIES } from './enums.js';

const fetchFxRates = async ({ trades = [] }) => {
  let fx_rates = {};
  let rateStartDate = R.pipe(
    R.head,
    R.prop(PROPERTIES.DATE),
    (date) => moment(date, 'YYYY-MM-DD'),
    (date) => date.subtract(5, 'days')
  )(trades);
  let rateEndDate = R.pipe(
    R.last,
    R.prop(PROPERTIES.DATE),
    (date) => moment(date, 'YYYY-MM-DD'),
  )(trades);
  let currentEndDate = moment.min([
    rateEndDate,
    moment(rateStartDate).add(3, 'months'),
  ]);

  while (currentEndDate.isSameOrBefore(rateEndDate)) {
    const startDate = rateStartDate.format('YYYY-MM-DD');
    const endDate = currentEndDate.format('YYYY-MM-DD');
    const response = await fetch(`${NBP_BASE_URL}/${startDate}/${endDate}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      }
    });
    const response_json = await response.json();
    const rates = R.pipe(
      R.prop('rates'),
      R.indexBy(R.prop('effectiveDate')),
      R.map(R.prop('mid'))
    )(response_json);
    fx_rates = {
      ...fx_rates,
      ...rates
    };
    if (currentEndDate.isSame(rateEndDate)) {
      break;
    }
    rateStartDate = moment(currentEndDate);
    currentEndDate = moment(currentEndDate).add(3, 'months');
    if (currentEndDate.isAfter(rateEndDate)) {
      currentEndDate = moment(rateEndDate);
    }
  }

  if (R.isEmpty(fx_rates)) {
    throw new Error('Error fetching FX Rates');
  }

  return fx_rates;
}

export {
  fetchFxRates
};