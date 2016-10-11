const Botkit = require('botkit');
const Promise = require('bluebird');
const _ = require('lodash');

const BOT_TOKEN = require('./token.js');
const {
  ONLY_ERROR_LOGGING,
  VERBOSE_LOGGING
} = require('./resources/constants');

const USER_CONFIG = require('./config');
const DEFAULT_CONFIG = require('./resources/defaultConfig');

const {
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

// TODO automatically register a `help` command and add a parameter here for what gets added to the help
/**
 * Convenience method for setting up a command that the bot will respond to, complete with easy logging/errors.
 * @param {String} command The first word the bot hears, which is the "command".
 *                         Not case sensitive except for what gets logged.
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
const registerCommand = (command, callback, types = ['direct_message']) => {
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

registerCommand('help', (message /* , log */) => {
  /* eslint-disable max-len */
  //TODO generate this automatically
  Message.private(
    message.user,
    'Any time I am mentioned, I\'ll pass it along to the current Squid Pope.' +
    '\nI will also pass along any direct messages that I don\'t recognize as a command.' +
    '\nBesides this `help` command, I know the following commands:' +
    '\n`list` lists the current queue of squid popes.' +
    '\n`cyclePope` puts the current pope at the end of the queue.' +
    '\n`deferPope` swaps the current and next popes. Use this when the scheduled pope is unavailable for the week.' +
    '\n`addPope user-name` adds a user to the end of the squid pope queue.' +
    '\n`removePope user-name` removes a user from the squid pope queue. *NOTE:* If the current pope is removed, the next user becomes pope but _is not automatically notified._'
  );
  /* eslint-enable max-len */
});

controller.hears([/.+/], ['direct_message', 'direct_mention', 'mention'], (_bot, message) => {
  Util.log('message', `Passively got a mention/message from ${message.user}`, VERBOSE_LOGGING);
  //TODO allow registering a default behavior and help here
});

module.exports = {
  Database,
  Message,
  Util,
  helpData,
  registerCommand,
  registerHelp
};
