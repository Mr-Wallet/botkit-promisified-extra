const _ = require('lodash');

const {
  VERBOSE_LOGGING
} = require('../resources/constants');

module.exports = (controller, bot, LOGGING_LEVEL, { log }) => {
  const Message = {
    private: (user, text) =>
      bot.api.im.openAsync({ user })
        .then((response) => {
          log('Message.private', `Sending to ${user}: ${_.truncate(text)}`, VERBOSE_LOGGING);
          return bot.api.chat.postMessageAsync({ as_user: true, channel: response.channel.id, text });
        })
  };

  return Message;
};
