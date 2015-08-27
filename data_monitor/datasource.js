define([
  'angular',
  'lodash',
  'kbn',
  './monSeries',
  './queryBuilder',
  './queryCtrl',
  // './funcEditor',
],
function (angular, _, kbn, MonSeries, MonQueryBuilder) {
  'use strict';

  var module = angular.module('grafana.services');

  module.factory('MonDatasource', function($q, $http, templateSrv) {

    function MonDatasource(datasource) {
      this.type = 'data_monitor';
      // this.urls = _.map(datasource.url.split(','), function(url) {
      //   return url.trim();
      // });
      this.url = datasource.url;
      // this.username = datasource.username;
      // this.password = datasource.password;
      this.name = datasource.name;
      // this.database = datasource.database;
      this.basicAuth = datasource.basicAuth;

      this.supportAnnotations = true;
      this.supportMetrics = true;

      this.editorSrc = 'app/features/data_monitor/partials/query.editor.html';

      var query = window.location.href.split('?')[1];
      var vars = query.split("&");

      for (var i=0;i<vars.length;i++) {
        var pair = vars[i].split("=");
        if (pair[0] === "api_key") {
          // this.api = decodeURIComponent(pair[1]);
          this.api_key = pair[1];
        }
      }
    }


    MonDatasource.prototype.query = function(options) {
      var timeFilter = getTimeFilter(options);
      var i, y;

      var allQueries = _.map(options.targets, function(target) {
        if (target.hide) { return []; }

        // build query
        // console.log("target: ------ ");
        // console.log(target);
        var queryBuilder = new MonQueryBuilder(target);
        var query =  queryBuilder.build();

        query = $.extend(query,timeFilter);
        query = $.extend(query,{query_type:'Measurements'});

        // query = query.replace(/\$interval/g, (target.interval || options.interval));

        query = $.extend(query,{group_by: target.interval || options.interval});

        // console.log("templateSrv query: ------");
        // console.log(query);

        var strQuery = JSON.stringify(query);

        // console.log("templateSrv values: -----");
        // console.log(strQuery);
        // console.log(templateSrv._values);

        _.map(templateSrv._values,function(v,k) {

          return strQuery = strQuery.replace('/$'+k+'/',v);
        });

        query = JSON.parse(strQuery);

        // var alias = target.alias ? templateSrv.replace(target.alias) : null;

        // console.log("MonDatasource query: -----");
        // console.log(query);
        return query;

      });
      // console.log("allQueries test: ------");
      // console.log(allQueries);
      // replace grafana variables
      // allQueries = allQueries.replace(/\$timeFilter/g, timeFilter);

      // replace templated variables
      // allQueries = templateSrv.replace(allQueries, options.scopedVars);
      // var seriesList = [];
      // for(i = 0; i < allQueries.length; i++) {
      //   this._seriesQuery(allQueries[i]).then(function(data) {
      //     if (!data || !data[0]) {
      //       return [];
      //     }
      //     var alias = (options.targets[i] || {}).alias;
      //     if (alias) {
      //       alias = templateSrv.replace(alias, options.scopedVars);
      //     }
      //     var targetSeries = new MonSeries({ series: data, alias: alias }).getTimeSeries();
      //     seriesList.push(targetSeries[0]);
      //   });
      //   return {data: seriesList};
      // }
      // var queryData = [];
      // _.map(allQueries,function(i){
      //   var d;
      //   return d = this._seriesQuery(i);
      //   queryData.push(d);
      // });

      var queryData = [];
      var promises = _.map(allQueries,function(query){
        var data = this._seriesQuery(query);
        return queryData.push(data);
      }, this);
      // console.log("allQueries.queryData:--- ");
      // console.log(queryData);

      return $q.all(queryData).then(function(data) {
        // console.log("queryData functon: ----");
        // console.log(data);
        if (!data || !data[0]) {
          return [];
        }
        var seriesList = [];

        for (i = 0; i < data.length; i++) {
          var result = data[i];
          // if (!result || !result.series) { continue; }
          // console.log("MonDatasource _seriesQuery result: -------------");
          // console.log(result);
          // console.log("options.targets: ------");
          // console.log(options.targets);
          var alias = (options.targets[i] || {}).alias;

          // console.log(alias);

          if (alias) {
            alias = templateSrv.replace(alias, options.scopedVars);
          }
          // console.log("alias name: ----");
          // console.log(alias);
          // console.log(result);
          var targetSeries = new MonSeries({ series: result, alias: alias }).getTimeSeries();
          // console.log("MonDatasource targetSeries:  ---------------");
          // console.log(targetSeries);

          for (y = 0; y < targetSeries.length; y++) {
            seriesList.push(targetSeries[y]);
          }
        }
        return { data: seriesList };
      });



        // return this._seriesQuery(allQueries[0]).then(function(data) {
        //   if (!data || !data[0]) {
        //     return [];
        //   }
        //
        //   var seriesList = [];
        //   for (i = 0; i < data.length; i++) {
        //     var result = data[i];
        //
        //     // if (!result || !result.series) { continue; }
        //     console.log("MonDatasource _seriesQuery result: -------------");
        //     console.log(result);
        //
        //     var alias = (options.targets[i] || {}).alias;
        //
        //     console.log(alias);
        //
        //     if (alias) {
        //       alias = templateSrv.replace(alias, options.scopedVars);
        //     }
        //     var targetSeries = new MonSeries({ series: data, alias: alias }).getTimeSeries();
        //     console.log("MonDatasource targetSeries:  ---------------");
        //     console.log(targetSeries);
        //
        //     for (y = 0; y < targetSeries.length; y++) {
        //       seriesList.push(targetSeries[y]);
        //     }
        //   }
        //
        //   return { data: seriesList };
        // });

    };

    MonDatasource.prototype.annotationQuery = function(annotation, rangeUnparsed) {
      var timeFilter = getTimeFilter({ range: rangeUnparsed });
      var query = annotation.query.replace('$timeFilter', timeFilter);
      query = templateSrv.replace(query);
      return this._seriesQuery(query).then(function(data) {
        if (!data || !data.results || !data.results[0]) {
          throw { message: 'No results in response from Data Monitor' };
        }
        return new MonSeries({ series: data.results[0].series, annotation: annotation }).getAnnotations();
      });
    };

    MonDatasource.prototype.metricFindQuery = function (query) {
      var interpolated;
      // try {
      //   // interpolated = templateSrv.replace(query);
      // }
      // catch (err) {
      //   return $q.reject(err);
      // }
      try {
        interpolated = templateSrv.replace(query);
      }
      catch (err) {
        interpolated = query;
      }
      // interpolated = query;
      // console.log("metricFindQuery: -------");
      // console.log(interpolated);
      return this._seriesQuery(interpolated).then(function (results) {
        // console.log("results: -------");
        // console.log(results);
        if (!results || results.length === 0) { return []; }

        var monResults = results;

        // if (!monResults.series) {
        //   return [];
        // }
        var series = monResults;

        switch (query.query_type) {
        case 'MEASUREMENTS':
          return _.map(series, function(value) { return { text: value, expandable: true }; });
        case 'TAG_KEYS':
          var tagKeys = _.flatten(series);
          return _.map(tagKeys, function(tagKey) { return { text: tagKey, expandable: true }; });
        case 'TAG_VALUES':
          var tagValues = _.flatten(series);
          return _.map(tagValues, function(tagValue) { return { text: tagValue, expandable: true }; });
        default: // template values service does not pass in a a query type
          var flattenedValues = _.flatten(series);
          return _.map(flattenedValues, function(value) { return { text: value, expandable: true }; });
        }

        // if (query.indexOf('SHOW MEASUREMENTS') === 0) {
        //   return _.map(series.values, function(value) { return { text: value[0], expandable: true }; });
        // }

        // var flattenedValues = _.flatten(series.values);
        // return _.map(flattenedValues, function(value) { return { text: value, expandable: true }; });
      });
    };

    MonDatasource.prototype._seriesQuery = function(query) {
      // return this._influxRequest('GET', '/query', {q: query, epoch: 'ms'});
      // console.log("_seriesQuery: -------");
      // console.log(query);
      switch (query.query_type) {
      case 'MEASUREMENTS':
        return this._monRequest('GET', '/metrics',{});
      case 'TAG_KEYS':
        return this._monRequest('GET', '/metrics/tags',{name:query.name,type:'keys'});
      case 'TAG_VALUES':
        return this._monRequest('GET',"/metrics/tags",{name:query.name,type:'values',key:query.key});
      case 'Measurements':
        return this._monRequest('GET','/metrics/measurements',query);
      default:
        return this._monRequest('GET',query, {});
        // return this._monRequest('GET','/metrics/measurements',query);
      }
    };

    // MonDatasource.prototype.testDatasource = function() {
    //   return this.metricFindQuery('SHOW MEASUREMENTS LIMIT 1').then(function () {
    //     return { status: "success", message: "Data source is working", title: "Success" };
    //   });
    // };

    MonDatasource.prototype._monRequest = function(method, url, data) {
      var self = this;

      // var currentUrl = self.urls.shift();
      var currentUrl =  self.url;
      // self.urls.push(currentUrl);

      // var params = {
      //   u: self.username,
      //   p: self.password,
      // };
      var params = {
        api_key: self.api_key,
      };

      if (self.database) {
        params.db = self.database;
      }

      if (method === 'GET') {
        _.extend(params, data);
        data = null;
      }

      var options = {
        method: method,
        url:    currentUrl + url,
        params: params,
        data:   data,
        precision: "ms",
        // inspect: { type: 'influxdb' },
      };

      options.headers = options.headers || {};
      if (self.basicAuth) {
        options.headers.Authorization = self.basicAuth;
      }
      // console.log("_monRequest: -----");
      // console.log(options);
      return $http(options).then(function(result) {
        return result.data;
      }, function(reason) {
        if (reason.status !== 0 || reason.status >= 300) {
          if (reason.data && reason.data.error) {
            throw { message: 'Data Monitor API Error Response: ' + reason.data.error };
          }
          else {
            throw { messsage: 'Data Monitor API Error: ' + reason.message };
          }
        }
      });
    };

    function getTimeFilter(options) {
      var from = getTime(options.range.from);
      var until = getTime(options.range.to);
      // var fromIsAbsolute = from[from.length-1] === 's';
      var fromIsAbsolute = _.isString(from);

      if (until === 'now' && fromIsAbsolute) {
        // return 'time > ' + from;
        return {from:from.split(' - ')[1],until:until};
      }

      // if (until === 'now()' && !fromIsAbsolute) {
      //   return 'time > ' + from;
      // }

      // return 'time > ' + from + ' and time < ' + until;
      return {from: from,until:until};
    }

    function getTime(date) {
      // if (_.isString(date)) {
      //   if (date.indexOf('now') >= 0) {
      //     return date.replace('now', 'now()').replace('-', ' - ');
      //   }
      //   date = kbn.parseDate(date);
      // }

      if (_.isString(date)) {
        return date.replace('-', ' - ');
      }
      return date;
      // return to_utc_epoch_seconds(date);
    }

    function to_utc_epoch_seconds(date) {
      return (date.getTime() / 1000).toFixed(0) + 's';
    }

    return MonDatasource;

  });

});
