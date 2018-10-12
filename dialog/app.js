var restify = require('restify');
var builder = require('botbuilder');
var request = require('request');
var botbuilder_azure = require("botbuilder-azure");
var builder_cognitiveservices = require("botbuilder-cognitiveservices");

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

// Receive messages from the user and respond by echoing each message back (prefixed with 'You said:')
var bot = new builder.UniversalBot(connector);

bot.dialog('/echo', function (session) {
        session.endDialog("You said: " + session.message.text);
    }
).triggerAction ( {
        matches: /^echo$/i
});

bot.dialog('/waterfall'
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
).triggerAction({
    matches: /^waterfall$/i,
    confirmPrompt: "This will cancel current dialog. Are you sure?"
}
);

var searchQueryStringBuilder = function (query) {
    var searchName = 'mwci';
    var indexName = 'mwci-laptop-index';
    var apiKey = '7048945958124F9720BDD8552F4B07E4';
    var queryString = 'https://' + searchName + '.search.windows.net/indexes/' + indexName + '/docs?api-key=' + apiKey + '&api-version=2017-11-11&';
    return queryString + query;
}

var performSearchQuery = function (queryString, callback) {
    request(queryString, function (error, response, body) {
        if (!error && response && response.statusCode == 200) {
            var result = JSON.parse(body);
            callback(null, result);
        } else {
            callback(error, null);
        }
    })
}

bot.dialog('/laptop', [ function (session) {
        builder.Prompts.text(session, "Please enter your name: ");
    },
    function (session, results) {
        var name = results.response;
        var queryString = searchQueryStringBuilder('search=' + name);
        performSearchQuery(queryString, function (err, result) {
            if (err) {
                console.log("Error when searching for laptop: " + err);
            } else if (result) {
                session.replaceDialog('/showResults', { result });
            } else {
                session.endDialog("No laptop owned by " + name + " found.");
            }
        })
    }
]).triggerAction({
        matches: /^laptop$/i,
        confirmPrompt: "This will cancel current dialog. Are you sure?"
});

bot.dialog('/showResults', [
    function (session, args) {
        var msg = new builder.Message(session).attachmentLayout(builder.AttachmentLayout.carousel);
            args.result['value'].forEach(function (laptop, i) {
                msg.addAttachment(
                    new builder.HeroCard(session)
                        .title(laptop.Name)
                        .subtitle("Make: " + laptop.Make + " | " + "Model: " + laptop.Model + " | " + "Search Score: " + laptop['@search.score'])
                        .text(laptop.Serial)
                );
            })
            session.endDialog(msg);
    }
]);

// Recognizer and and Dialog for preview QnAMaker service
var previewRecognizer = new builder_cognitiveservices.QnAMakerRecognizer({
    knowledgeBaseId: process.env.QnAKnowledgebaseId,
    authKey: process.env.QnAAuthKey || process.env.QnASubscriptionKey
});

var basicQnAMakerPreviewDialog = new builder_cognitiveservices.QnAMakerDialog({
    recognizers: [previewRecognizer],
    defaultMessage: 'No match! Try changing the query terms!',
    qnaThreshold: 0.3
}
);

bot.dialog('basicQnAMakerPreviewDialog', basicQnAMakerPreviewDialog);

// Recognizer and and Dialog for GA QnAMaker service
var recognizer = new builder_cognitiveservices.QnAMakerRecognizer({
    knowledgeBaseId: process.env.QnAKnowledgebaseId,
    authKey: process.env.QnAAuthKey || process.env.QnASubscriptionKey, // Backward compatibility with QnAMaker (Preview)
    endpointHostName: process.env.QnAEndpointHostName
});

var basicQnAMakerDialog = new builder_cognitiveservices.QnAMakerDialog({
    recognizers: [recognizer],
    defaultMessage: 'No match! Try changing the query terms!',
    qnaThreshold: 0.3
}
);

bot.dialog('basicQnAMakerDialog', basicQnAMakerDialog);

bot.dialog('/', //basicQnAMakerDialog);
    [
        function (session) {
            var qnaKnowledgebaseId = process.env.QnAKnowledgebaseId;
            var qnaAuthKey = process.env.QnAAuthKey || process.env.QnASubscriptionKey;
            var endpointHostName = process.env.QnAEndpointHostName;

            // QnA Subscription Key and KnowledgeBase Id null verification
            if ((qnaAuthKey == null || qnaAuthKey == '') || (qnaKnowledgebaseId == null || qnaKnowledgebaseId == ''))
                session.send('Please set QnAKnowledgebaseId, QnAAuthKey and QnAEndpointHostName (if applicable) in App Settings. Learn how to get them at https://aka.ms/qnaabssetup.');
            else {
                if (endpointHostName == null || endpointHostName == '')
                    // Replace with Preview QnAMakerDialog service
                    session.replaceDialog('basicQnAMakerPreviewDialog');
                else
                    // Replace with GA QnAMakerDialog service
                    session.replaceDialog('basicQnAMakerDialog');
            }
        }
    ]);
