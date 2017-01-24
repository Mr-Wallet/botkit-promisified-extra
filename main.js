const Botkit = require('botkit');
const Promise = require('bluebird');
const _ = require('lodash');

const BOT_TOKEN = require('./config/token.js');
const {
  ONLY_ERROR_LOGGING,
  VERBOSE_LOGGING
} = require('./resources/constants');

const USER_CONFIG = require('./config/config');
const DEFAULT_CONFIG = require('./resources/defaultConfig');

const {
  HELP_PREAMBLE,
  LOGGING_LEVEL
} = _.assign({}, DEFAULT_CONFIG, USER_CONFIG);


/* ### MESSY GLOBAL VARIABLES ### */
const controller = Botkit.slackbot({
  json_file_store: './saveData'
});

const bot = controller.spawn({
  retry: 100,
  token: BOT_TOKEN
});

const Util = require('./source/Util.js')(controller, bot, LOGGING_LEVEL);
const Database = require('./source/Database.js')(controller, bot, LOGGING_LEVEL, Util);
const Message = require('./source/Message.js')(controller, bot, LOGGING_LEVEL, Util);


/* ### PROMISIFY API CALLS - turns e.g. channels.info into channels.infoAsync which returns a promise ### */
const slackApiCategories = [
  'auth',
  'oauth',
  'channels',
  'chat',
  'emoji',
  'files',
  'groups',
  'im',
  'mpim',
  'pins',
  'reactions',
  'rtm',
  'search',
  'stars',
  'team',
  'users'
];

_.forEach(slackApiCategories, (category) => {
  bot.api[category] = Promise.promisifyAll(bot.api[category]);
});

/* ### PROMISIFY STORAGE ### */
controller.storage.channels = Promise.promisifyAll(controller.storage.channels);
controller.storage.teams = Promise.promisifyAll(controller.storage.teams);
controller.storage.users = Promise.promisifyAll(controller.storage.users);

/* ### INITALIZE BOT ### */
bot.startRTM((error /* , _bot, _payload */) => {
  if (error) {
    throw new Error('Could not connect to Slack');
  }
});

const helpData = {
  details: {},
  summaries: {},
  summaryOrder: []
};

/**
 * @param {String} command The first word the bot hears (see registerCommand)
 * @param {String} summary [optional] A brief one-liner.
 *                                    When the bot gets `help` then it replies with a list of all summaries, ordered by
 *                                    when each command was registered.
 *                                    NOTE that having a falsy summary will result in a "secret" command.
 * @param {String} details [optional] A nice long man page.
 *                                    When the bot gets `help ${command}` then it replies with this.
 *                                    If falsy, it will just send back the `summary`, if that is truthy.
 */
const registerHelp = (command, { details, summary }) => {
  if (!helpData.summaryOrder.includes(command)) {
    helpData.summaryOrder.push(command);
  }
  helpData.details[command] = details;
  helpData.summaries[command] = summary;
};

/**
 * Convenience method for setting up a command that the bot will respond to, complete with easy logging/errors.
 * @param {String} command The first word the bot hears, which is the "command".
 *                         Not case sensitive except for what gets logged and put into the help info.
 * @param {Object} help An object of shape { details: String, summary: String }. (See registerHelp.)
 * @param {Function} callback What the command does.
 *                            callback takes the arguments (message, log, ...params) where:
 *                              message is the slack API message object
 *                              log is Util.log, partially applied with `command` as its first parameter - use this for
 *                                  logging to ensure that log output is consistent (avoids copy-paste errors).
 *                              ...params all of the space-separated words the user sent with the command.
 *                                        If the user said 'myCommand a b c' then params are 'a', 'b', 'c'.
 * @param {Array | String} types (optional) The 2nd parameter to controller.hears (i.e. the type(s) of message/mention)
 *                               See https://github.com/howdyai/botkit#matching-patterns-and-keywords-with-hears
 */
const registerCommand = (command, help, callback, types = ['direct_message']) => {
  if (command !== 'help') {
    registerHelp(command, help);
  }

  const commandRegExp = new RegExp(`^${command}(\\b.+)?$`, 'i');

  controller.hears([commandRegExp], types, (_bot, message) => {
    const params = message.text.split(' ');
    params.shift();
    const log = _.partial(Util.log, command);
    log(`Received request from ${message.user}: ${message.text}`);
    Promise.method(callback)(message, log, ...params)
      .catch((reason) => {
        const errorMessage = _.get(reason, 'message', reason);
        log(reason, VERBOSE_LOGGING);
        log(`Failed for reason: ${errorMessage}`, ONLY_ERROR_LOGGING);
        Message.private(message.user, errorMessage);
      });
  });
};

registerCommand('help', {}, (message /* , log */) => {
  const helpMessage = _.reduce(
    helpData.summaryOrder,
    (result, command) => `\n\`${command}\` ${helpData.summaries[command]}`,
    HELP_PREAMBLE
  );
  Message.private(message.user, helpMessage);
});

controller.hears([/.+/], ['direct_message', 'direct_mention', 'mention'], (_bot, message) => {
  Util.log('message', `Passively got a mention/message from ${message.user}`, VERBOSE_LOGGING);
  _bot.reply(message, 'I don\'t understand. Say `help` to me for a list of commands.');
  //TODO allow registering a default behavior here
});

module.exports = {
  Database,
  Message,
  Util,
  helpData,
  registerCommand,
  registerHelp
};
