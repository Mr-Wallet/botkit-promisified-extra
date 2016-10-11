const _ = require('lodash');
const moment = require('moment');

module.exports = (controller, bot, logLevel) => {
  const Util = {
    getUserByName: (userName) => {
      const strippedID = _.get((/^<@(U[^>]+)>$/).exec(userName), 1);
      if (strippedID) {
        return bot.api.users.infoAsync({ user: strippedID })
          .then(({ user }) => user);
      }

      return bot.api.users.listAsync({})
        .then(({ members }) => _.find(members, ({ name }) => name === userName) || null);
    },

    log: (type, message, level = 1) => {
      const theTime = moment();
      if (!type) {
        console // eslint-disable-line no-console
          .log(`## ${theTime} ## error: Util.log was called with no arguments or falsy first argument`);
      }

      if (logLevel < level) {
        return;
      }

      if (!message) {
        console.log(`## ${theTime} ## log: ${type}`); // eslint-disable-line no-console
        return;
      }

      console.log(`## ${theTime} ## ${type}: ${message}`); // eslint-disable-line no-console
    }
  };

  return Util;
};
