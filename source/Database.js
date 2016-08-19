const Promise = require('bluebird');
const _ = require('lodash');

const {
  VERBOSE_LOGGING
} = require('../resources/constants');

module.exports = (controller, bot, LOGGING_LEVEL = 1) => {
  const Util = require('./Util.js')(LOGGING_LEVEL); // eslint-disable-line global-require

  const Database = {
    //TODO mongo? mongoose?
  };

  return Database;
};
