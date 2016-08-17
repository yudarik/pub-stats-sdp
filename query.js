'use strict';

var config = require('./config'),
    _ = require('lodash'),
    moment = require('moment'),
    request = require("request"),
    querystring = require("querystring"),
      orderByIgnore = require("./orderByIgnore"),
    q = require('q');

module.exports = function(urlConfig, fieldMapping, logger, customRowProcess){

    function proccessRow(aggregatedRow, dimension) {

        if(dimension){
            _.each(dimension, dim=>{
                if(!aggregatedRow[dim]){
                    aggregatedRow[dim]="Unknown";
                }
            });
        }

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
            aggregatedRow.date = Number(aggregatedRow.eDate)
        }

        _.each(aggregatedRow, (value,key)=>{
            if(fieldMapping[key]){
                aggregatedRow[fieldMapping[key]]=value;
            }
        });

        if(customRowProcess){
            customRowProcess(aggregatedRow);
        }

        return aggregatedRow;
    }

    function getTotal(data){
        var total=[{
            "adResponses": 0,
            "clicks": 0,
            "impressions": 0,
            "installs": 0,
            "revenue": 0,
            "requests": 0,
            "payableClicks": 0
        }];
        _.each(data, row=>{
            _.each(total[0], (val,prop)=>{
                total[0][prop]+=row[prop];
            })
        });
        proccessRow(total[0]);

        return total;
    }

    function fetchData(query, logs){
        var orderBy = _.without.apply(_, query.dimension, orderByIgnore);
        var dfd = q.defer();
        var urlSuffix = config.apiName+"?"+querystring.stringify(_.extend({orderBy, sort:"ASC"},query));
        var fetchMethod;

        if(urlSuffix.length<4000){

            logger.info('GET request to SDP:',urlConfig.url + urlSuffix);

            fetchMethod = request.get.bind(request, {
                url: urlConfig.url + urlSuffix,
                json: true
            });
        }
        else{
            var body = _.extend({orderBy,sort:"ASC"},query);

            logger.info('POST request to SDP:',urlConfig.url, JSON.stringify(body, null, 4));

            fetchMethod = request.bind(request,{
                url: urlConfig.url+config.apiName,
                method: 'POST',
                body,
                json: true
            });
        }

        fetchMethod(function (error, response, data) {
            if(error){
                return dfd.reject(error);
            }
            if(response.statusCode!==200){
                logger.error("response code returned not successful: "+response.statusCode);
            }

            var finalResults = _.map(data.results,elm=>proccessRow(elm, query.dimension))

            if (finalResults.length === query.limit) {
                if (finalResults.length === config.maxResults+1){
                    if(logs.indexOf('SA112')===-1){
                        logs.push('SA112');
                    }
                }
                else if(logs.indexOf('SA111')===-1){
                    logs.push('SA111');
                }

                finalResults.pop();
            }

            dfd.resolve(finalResults);
        });

        return dfd.promise;
    }

    return function (query, done) {

        var getDataPromise, logs=[];
        if(query.combine){

            getDataPromise = q.all(_.map([
                'eDate',
                'country',
                'product',
                'deviceType',
                'connectionType',
                'adTypePortal'
            ], dim =>
                fetchData(_.extend({},query,{dimension:[dim]}), logs)
                .then(data=>({dim,data}))
            ))

            .then(result=>{
                var data={};
                _.each(result,res4dim=>{
                    data[fieldMapping[res4dim.dim]]=res4dim.data
                });
                data.total = getTotal(data[fieldMapping.eDate]);
                return data;
            });
        }
        else {
            getDataPromise = fetchData(query, logs)
            .then(data=>{
                if(query.fetchTotal){
                    return{
                        data,
                        total:getTotal(data)
                    };
                }
                else{
                    return data;
                }
            });
        }

        getDataPromise.then(data=>{
            done(logs,data);
        },err=>{
            logs.push('SA101');
            done(logs);
        });
    };

};
