const fs = require('fs');
const R = require('ramda');
const moment = require('moment');
const fetch = require('node-fetch');

const { NBP_BASE_URL } = require('./variables.js');
const { getDate } = require('./utils/trades.js');

const fetchFxRates = async (trades = []) => {
  let fx_rates = {};
  let rateStartDate = R.pipe(
    R.head,
    getDate,
    (date) => date.subtract(5, 'days')
  )(trades);
  let rateEndDate = R.pipe(
    R.last,
    getDate
  )(trades);
  let currentEndDate = moment(rateStartDate).add(3, 'months');
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
  fs.writeFileSync('fx_rates.json', JSON.stringify(fx_rates));

  return fx_rates;
}

module.exports = {
  fetchFxRates
};