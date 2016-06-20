'use strict';

var _ = require('lodash'),
    moment = require('moment'),
    config = require('./config'),
    logMessages = require('./log-messages');

module.exports = function(logger, fieldMapping) {

    /**
     * returns value from req. querystring, if not exists then tries req. body
     * @param req
     * @param fieldName
     * @returns {*}
     */
    function getParam(req, fieldName) {
        if (req.query && req.query[fieldName]) {
            return req.query[fieldName];
        }
        else if (req.body && req.body[fieldName]) {
            return req.body[fieldName];
        }
        return undefined;
    }

    function parseDimensions(req) {

        var dimensions=[];

        //Parse query string
        if (getParam(req, 'dimension')) {

            dimensions = getParam(req, 'dimension').split(',');

            _.pull(dimensions, 'showLatestIfOnly');

            if (_.includes(dimensions, '-date')) { //Disable default dimension
                _.pull(dimensions, '-date');

            }
            else{
                dimensions.push(fieldMapping.eDate);
            }

            dimensions = _.map(dimensions, dim=> {
                var translatedDim=null;
                _.each(fieldMapping, (value, key)=> {
                    if (dim === value) {
                        translatedDim = key;
                    }
                });
                return translatedDim?translatedDim:null;
            });

        } else { //Set default dimension
            dimensions = ['eDate'];
        }

        return dimensions;
    }

    function parseFilters(req) {

        var filters = {};

        //Parse query string
        _.each(fieldMapping, (translated, key)=> {
            if (getParam(req, translated)) {
                filters[key] = getParam(req, translated).split(',');
            }
        });

        //Set partner filter
        if (process.env.NODE_ENV === 'development' && getParam(req, 'partner') === '*') {
            filters.publisherId = [getParam(req, 'actualPartner')]; //Special user that can load anyone's data from API
        } else { //Filter by partner/user
            if (req.profile) filters.publisherId = getUserIdOrSubAccounts(req.profile); //req.profile.userId; //Website
            else filters.publisherId = [getParam(req, 'partner')]; //API
        }
        return filters;
    }

    function getUserIdOrSubAccounts(user) {
        if (user.hasSubAccounts) {
            var accounts = user.subAccounts;
            accounts.push(user.userId);
            return accounts;
        } else {
            return [user.userId];
        }
    }

    function parseSort(req) {
        var sort = {};
        if (getParam(req, 'sortBy')) {
            _.forEach(getParam(req, 'sortBy').split(','), function (sortField) {
                if (sortField[0] === '-') {
                    sort[sortField.substring(1)] = -1;
                } else {
                    sort[sortField] = 1;
                }
            });
        } else if (getParam(req, 'dimension') && !_.includes(getParam(req, 'dimension').split(','), '-date')) { //Add default sorting of default dimension if applied
            sort['day'] = 1;
        }

        return sort;
    }

    function validateQuery(requestQuery) {

        var logs = [];

        var startDate = moment.utc(requestQuery.startDate, "YYYY-MM-DD");
        var endDate = moment.utc(requestQuery.endDate, "YYYY-MM-DD");

        //Start Date
        if (!startDate || !startDate.isValid()) {
            logs.push('SA105');
        }
        else if (startDate < moment.utc(config.minDate)) {
            s.push('SA107');
        }

        //End Date
        if (!endDate || !endDate.isValid()) {
            logs.push('SA106');
        }
        else if (endDate > moment.utc().add(1, 'day')) {
            logs.push('SA108');
        }

        //Dimensions
        _.forEach(requestQuery.dimension, function (dimension) {
            if (dimension !== 'none' && !fieldMapping[dimension]) {
                logs.push('SA109');
            }
        });

        //Limit
        if (requestQuery.limit > config.maxResults) {
            logs.push('SA112');
            requestQuery.limit = config.maxResults;
        }

        //Done
        return logs;
    }

    function requestParser(req) {

        if (getParam(req, 'prType') || getParam(req, 'dimension')) {
            /**
             *  Replace adType with prType (reverse action) before each report request,
             *  to prevent AdBlocker and AdBlocker Plus to block the GET request when containing adType string
             */
            if (getParam(req, 'prType')) {
                req.query.adType = getParam(req, 'prType');
                delete req.query.prType;
                delete req.body.prType;
            }
            if (getParam(req, 'dimension')) {
                req.query.dimension = getParam(req, 'dimension').replace(/prType/g, 'adType');
            }
        }

        this.req = req;

        this.query = _.extend({
            startDate: (getParam(req, 'startDate') ? moment.utc(getParam(req, 'startDate'), 'YYYYMMDD').format("YYYY-MM-DD") : false),
            endDate: (getParam(req, 'endDate') ? moment.utc(getParam(req, 'endDate'), 'YYYYMMDD').format("YYYY-MM-DD") : false),
            dimension: parseDimensions(this.req),
            combine: getParam(req, 'portalUI') === 'true',
            limit: getParam(req, 'limit') ? Number(getParam(req, 'limit')) : config.maxResults,
            showLatestIfOnly: getParam(req, 'showLatestIfOnly')
        }, parseFilters(this.req));

        logger.info('Query:');
        logger.info(JSON.stringify(this.query, null, 4));

        this.logMessages = validateQuery(this.query);
    }

    requestParser.prototype.isValidRequest = function () {
        var errorLogs = [];
        if (this.logMessages.length > 0) {
            errorLogs = _.filter(this.logMessages, function (log) {
                return logMessages[log].severity === 'error';
            });
        }
        return errorLogs.length === 0;
    };

    requestParser.prototype.addLogs = function (logs) {
        this.logMessages = _.union(this.logMessages, logs);
    };

    requestParser.prototype.getLogs = function () {
        return this.logMessages;
    };

    //Export object
    return requestParser;
};