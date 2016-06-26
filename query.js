'use strict';

var config = require('./config'),
    _ = require('lodash'),
    moment = require('moment'),
    request = require("request"),
    querystring = require("querystring"),
    q = require('q');

module.exports = function(urlConfig, fieldMapping, customRowProcess){

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

    function fetchData(query){
        var dfd = q.defer();

        var urlSuffix = config.apiName+"?"+querystring.stringify(_.extend({orderBy:query.dimension, sort:"ASC"},query));

        var fetchMethod;

        if(urlSuffix.length<4000){
            fetchMethod = request.get.bind(request, {
                url: urlConfig.url + urlSuffix,
                json: true
            });
        }
        else{
            fetchMethod = request.bind(request,{
                url: urlConfig.url+config.apiName,
                method: 'POST',
                body: _.extend({orderBy:query.dimension[0],sort:"ASC"},query),
                json: true
            });
        }

        fetchMethod(function (error, response, data) {

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

            dfd.resolve(_.map(data.results,elm=>proccessRow(elm, query.dimension)));
        });

        return dfd.promise;
    }

    return function (query, done) {

        var getDataPromise, logs=[];
        if(query.combine){

            getDataPromise = fetchData(_.extend({},query,{dimension:["eDate"]}))

            .then(eDateResults=>{
                if(query.showLatestIfOnly){
                    var endDate = query.endDate.replace(/-/g,'')
                    var dataOfEndDate = _.filter(eDateResults,elm=>elm.eDate===endDate);
                    if(dataOfEndDate.length){
                        query.startDate = query.endDate
                    }
                    else if(query.startDate !== query.endDate){
                        query.endDate = moment(query.endDate,"YYYY-MM-DD").subtract(1,"day").format("YYYY-MM-DD")
                    }
                }
                return eDateResults;
            })

            .then(eDateResults=>q.all(_.map([
                'country',
                'product',
                'deviceType',
                'connectionType',
                'adTypePortal'
            ], dim => fetchData(_.extend({},query,{dimension:[dim]})).then(data=>({dim,data}))))

            .then(theRest=>[{dim:'eDate',data:eDateResults}].concat(theRest)))

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
                _.each(data[fieldMapping.eDate], row=>{
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
