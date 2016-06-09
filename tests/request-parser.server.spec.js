'use strict';

var rewire = require('rewire'),
    moment = require('moment'),
    config = require('../config'),
    RequestParser = require('../request-parser');

describe('Test the publisher-api\'s request-parser', function() {

    let rewire = require('rewire');
    let should = require('should');

    var sinon = require('sinon'), req;

    beforeEach(function (done) {

        done();

    });

    it('Should correctly identify missing dates', function (done) {

        var requestParser = new RequestParser({
            query: {}
        });

        requestParser.logMessages.should.containEql('SA105');
        requestParser.logMessages.should.containEql('SA106');

        done();

    });

    it('Should correctly identify wrong dates', function (done) {

        var requestParser = new RequestParser({
            query: {
                startDate: '2013-10-10',
                endDate: '2099-10-20'
            }
        });

        requestParser.logMessages.should.containEql('SA107');
        requestParser.logMessages.should.containEql('SA108');

        done();

    });

    it('Should correctly validate dimensions', function (done) {

        var requestParser = new RequestParser({
            query: {
                dimension: 'wrongDimension,country,connectionType'
            },
            profile: {
                userId: 'me'
            }
        });

        requestParser.logMessages.should.containEql('SA109');

        done();

    });

    it('Should correctly validate dimensions', function (done) {

        var requestParser = new RequestParser({
            query: {
                limit: config.maxResults + 1
            }
        });

        requestParser.logMessages.should.containEql('SA112');

        done();

    });

    it('Should correctly test for validation errors', function (done) {

        var requestParser, isValid;

        //'Warning' message is not an error
        requestParser = new RequestParser({
            query: {
                startDate: '2014-10-10',
                endDate: '2014-10-20',
                limit: config.maxResults + 1
            }
        });

        isValid = requestParser.isValidRequest();
        isValid.should.eql(true);

        //'Error' message
        requestParser = new RequestParser({
            query: { }
        });

        isValid = requestParser.isValidRequest();
        isValid.should.eql(false);

        done();

    });

});