const _ = require('lodash');

const {
  ONLY_ERROR_LOGGING
} = require('../resources/constants');

const CHANNELS = 'channels';
const TEAMS = 'teams';
const USERS = 'users';
const ApiInfoMethodResultKeys = {
  [CHANNELS]: 'channel',
  [USERS]: 'user'
};
const ApiListMethodResultKeys = {
  [CHANNELS]: 'channels',
  [USERS]: 'members'
};

module.exports = (controller, bot, LOGGING_LEVEL = 1, { log }) => {
  function get(type) {
    return (id) => controller.storage[type].getAsync(id);
  }

  function getByName(type) {
    return (name) => {
      const resultKey = ApiInfoMethodResultKeys[type];
      const strippedID = _.get((/^<@(U[^>]+)>$/).exec(name), 1);
      if (strippedID) {
        return bot.api[type].infoAsync({ [resultKey]: strippedID })
          .then((info) => info[resultKey]);
      }

      return bot.api[type].listAsync({})
        .then((listObject) => {
          const list = listObject[ApiListMethodResultKeys[type]];
          return _.find(list, (item) => item.name === name) || null;
        });
    };
  }

  function overwrite(type) {
    return (id, data) => {
      const saveObject = _.defaults({ id }, data);
      return controller.storage[type].saveAsync(saveObject)
        .then(() => controller.storage[type].getAsync(id));
    };
  }

  function update(type) {
    return (updateObject) => {
      const id = updateObject;
      return controller.storage[type].getAsync(id)
        .then((data = {}) => {
          if (!data) {
            const errorMessage = `User ${id} was not found`;
            log('Database.update', errorMessage, ONLY_ERROR_LOGGING);
            throw new Error(errorMessage);
          }

          const saveObject = _.defaultsDeep({}, data, updateObject);
          return controller.storage[type].saveAsync(saveObject)
            .then(() => saveObject);
        });
    };
  }

  const Database = {
    Channels: {
      get: get(CHANNELS),
      getByName: getByName(CHANNELS),
      overwrite: overwrite(CHANNELS),
      update: update(CHANNELS)
    },
    Teams: {
      get: get(TEAMS),
      overwrite: overwrite(TEAMS),
      update: update(TEAMS)
    },
    Users: {
      get: get(USERS),
      getByName: getByName(USERS),
      overwrite: overwrite(USERS),
      update: update(USERS)
    }
  };

  return Database;
};
