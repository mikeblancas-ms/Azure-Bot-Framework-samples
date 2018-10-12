var restify = require('restify');
var builder = require('botbuilder');

// Setup Restify Server
var server = restify.createServer();
server.listen(process.env.port || process.env.PORT || 3978, function () {
   console.log('%s listening to %s', server.name, server.url); 
});

// Create chat connector for communicating with the Bot Framework Service
var connector = new builder.ChatConnector({
    appId: process.env.MicrosoftAppId,
    appPassword: process.env.MicrosoftAppPassword
});

// Listen for messages from users 
server.post('/api/messages', connector.listen());

var bot = new builder.UniversalBot(connector);

bot.dialog('/'
, [
    function (session) {
        builder.Prompts.text(session, "Hello... What is your name?");
    },
    function (session, results) {
        session.userData.name = results.response;
        builder.Prompts.number(session, "How many years have you been coding?");
    },
    function (session, results) {
        session.userData.coding = results.response;
        builder.Prompts.choice(session, "What language do you code using?", ["C#", "JavaScript", "Python", "Java"]);
    },
    function (session, results) {
        session.userData.language = results.response.entity;
        session.endDialog("Hi " + session.userData.name + " you have been programming for " + 
            session.userData.coding + " yrs, and you use " + session.userData.language + ".");
    }
]
);