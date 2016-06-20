'use strict';

var path = require('path'),
    events = require('events');

module.exports = function(logger, config, fieldMapping) {

    var RequestParser = require('./request-parser.js')(logger, fieldMapping),
        query = require('./query.js')(config, fieldMapping);

    function validateAndExecute(res, requestParser) {

        //Execute the query
        if (!requestParser.isValidRequest()) { //Abort on critical errors

            res.apiResponse(requestParser.logMessages, [], 400);

        } else { //No errors, execute query

            query(requestParser.query, function (logs, data) {

                requestParser.addLogs(logs); //Join the log results from the validation and the log returned from the query

                if (!requestParser.isValidRequest()) { //Abort on critical errors & send no data
                    res.apiResponse(logs, [], 400);
                } else {
                    res.apiResponse(requestParser.getLogs(), data, 200); //Send both logs and data
                }

            });
        }
    }

    function queryExecutor(req, res) {

        //Parse & validate the request
        var requestParser = new RequestParser(req);
        if(requestParser instanceof events.EventEmitter) {

            requestParser.on('requestParsed',function() { //requestParser is an EventEmitter - continue after its done

                validateAndExecute(res, requestParser);
            });

        } else {

            validateAndExecute(res, requestParser);
        }
    }

    return queryExecutor;
};