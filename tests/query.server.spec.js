'use strict';

var rewire = require('rewire'),
    moment = require('moment'),
    config = require('../config'),
    crypto = require('crypto'),
    query  = !rewire('../query'),
    q = require('q');

describe('Test the publisher-api\'s query', function() {

    let rewire = require('rewire');
    let should = require('should');

    var sinon = require('sinon');

    var request,fetchedData;

    let config = {url:"http://sdpUrl.com/"};

    beforeEach(function (done) {

        query  = rewire('../query');

        request={
            get:sinon.stub()
        };

        query.__set__('request', request);

        fetchedData=[{
            "date": moment().subtract(3,"day").unix(),
            "advertiser": 3452,
            "country": "GR",
            "deviceType": "TABLET",
            "impressions": 100,
            "clicks": 50,
            "installs": 0,
            "postInstalls": 0,
            "spent": 1.86,
            adResponses:11,
            revenue:12,
            payableClicks:23,
            requests:34
        },
        {
            "date": moment().subtract(2,"day").unix(),
            "advertiser": 234,
            "country": "GR",
            "deviceType": "TABLET",
            "impressions": 30,
            "clicks": 150,
            "installs": 20,
            "postInstalls": 30,
            "spent": 1.6,
            adResponses:222,
            revenue:23,
            payableClicks:34,
            requests:45
        },
        {
            "date": moment().unix(),
            "advertiser": 1768,
            "country": "GR",
            "deviceType": "TABLET",
            "impressions": 800,
            "clicks": 50,
            "installs": 0,
            "postInstalls": 0,
            "spent": 1.86,
            adResponses:333,
            revenue:67,
            payableClicks:78,
            requests:89
        }];

        done();

    });

    it('Should test fetchData result proccessing', function (done) {

        request.get.callsArgWith(1, null,null,{
            results:fetchedData
        });

        query.__get__('fetchData')({
            startDate: '2014-10-10',
            endDate: '2014-10-20',
            dimension: ['eDate'],
            publisherId:"12345",
            limit:100000,
            showLatestIfOnly:true
        },config).then(function(data){
            request.get.getCall(0).args[0].url.should.eql("http://sdpUrl.com//counters/pub/getCounters?startDate=2014-10-10&endDate=2014-10-20&dimension=eDate&publisherId=12345&limit=100000&showLatestIfOnly=true")
            data.length.should.eql(3);
            done();
        });
    });

    it('Should test query function #1', function (done) {
        var dfd = q.defer();
        dfd.resolve(fetchedData);

        query.__set__('fetchData', function(){
            return dfd.promise;
        });

        query({
            startDate: '2014-10-10',
            endDate: '2014-10-20',
            dimension: ['eDate'],
            publisherId:"12345",
            limit:100000,
            portalUI:false
        }, config, function(err,data){
            data.length.should.eql(3);
            done();
        });
    });

    it('Should test query function with dimension combined', function (done) {
        var dfd = q.defer();
        dfd.resolve(fetchedData);

        query.__set__('fetchData', function(){
            return dfd.promise;
        });

        query({
            startDate: '2014-10-10',
            endDate: '2014-10-20',
            dimension: ['combined'],
            publisherId:"12345",
            limit:100000
        }, config, function(err,data){
            ['dtKey','country','segId','deviceType','connectionType'  /*,'adType'*/].forEach(function(dim){
                data[dim].length.should.eql(3);
            });
            done();
        });
    });


});