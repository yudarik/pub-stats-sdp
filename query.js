'use strict';

var config = require('./config'),
    _ = require('lodash'),
    moment = require('moment'),
    request = require("request"),
    querystring = require("querystring"),
    q = require('q');

module.exports = function(urlConfig, fieldSettings){
    var fieldMapping = fieldSettings.mappings;

    function proccessRow(aggregatedRow) {

        aggregatedRow.fillrate = (aggregatedRow.requests > 0) ? (aggregatedRow.adResponses / aggregatedRow.requests) : 0;
        aggregatedRow.ctr = (aggregatedRow.impressions > 0) ? (aggregatedRow.clicks / aggregatedRow.impressions) : 0;
        aggregatedRow.cr = ( (aggregatedRow.clicks - aggregatedRow.payableClicks) > 0) ? (aggregatedRow.installs / (aggregatedRow.clicks - aggregatedRow.payableClicks)) : 0;
        aggregatedRow.cpm = (aggregatedRow.impressions > 0) ? ((aggregatedRow.revenue / aggregatedRow.impressions) * 1000) : 0;

        //Round
        _.forEach(['adResponses', 'clicks', 'impressions', 'installs', 'revenue', 'requests', 'payableClicks', 'fillrate', 'ctr', 'cr', 'cpm'], function (key) {
            aggregatedRow[key] = aggregatedRow[key] && Number(aggregatedRow[key].toFixed(config.maxDecimalPlaces));
        });
        if(aggregatedRow.eDate){
            aggregatedRow.eDate = aggregatedRow.eDate.replace(/-/g,"");
        }
        var omit=[];
        _.each(aggregatedRow, (value,key)=>{

            if(fieldMapping[key]){
                aggregatedRow[fieldMapping[key]]=value;
                if(fieldMapping[key]!==key){
                    omit.push(key);
                }
            }
        });
        aggregatedRow = _.omit(aggregatedRow, omit);
        return aggregatedRow;
    }

    function fetchData(query){
        var dfd = q.defer();

        //query.publisherId = "112832612";

        //query.publisherId = "109630816";

        //query.publisherId = "104602676";

        request.get({
            url: urlConfig.url+config.apiName+"?"+querystring.stringify(query),
            json: true
        }, function (error, response, data) {
            if(error){
                return dfd.reject(error);
            }
            if(query.showLatestIfOnly){
                var endDate = query.endDate.replace(/-/g,'')
                var dataExceptEndDate = _.filter(data.results,elm=>elm.eDate!==endDate);
                if(dataExceptEndDate.length) {
                    data.results=dataExceptEndDate
                }
            }
            dfd.resolve(_.map(data.results,proccessRow));
        });
        return dfd.promise;
    }

    return function (query, done) {

        var getDataPromise, logs=[];
        if(query.dimension.indexOf("combined")>=0){

            getDataPromise = q.all(_.map([
                'eDate',
                'country',
                'product',
                'deviceType',
                'connectionType',
                'adTypePortal'
            ], dim => fetchData(_.extend({},query,{dimension:[dim]})).then(data=>({dim,data}))))
            .then(result=>{
                var data={};
                _.each(result,res4dim=>{
                    data[fieldMapping[res4dim.dim]]=res4dim.data
                });

                data.total=[{
                    "adResponses": 0,
                    "clicks": 0,
                    "impressions": 0,
                    "installs": 0,
                    "revenue": 0,
                    "requests": 0,
                    "payableClicks": 0
                }];
                _.each(data[fieldMapping.deviceType], row=>{
                    _.each(data.total[0], (val,prop)=>{
                        data.total[0][prop]+=row[prop];
                    })
                });
                proccessRow(data.total[0]);

                return data;
            });
        }
        else {
            getDataPromise = fetchData(query);
        }

        getDataPromise.then(data=>{
            if (data.length > query.limit) {
                data.pop();
                logs.push('SA111');
            }
            done(logs,data);
        },err=>{
            logs.push('SA101');
            done(logs);
        });
    };

};
