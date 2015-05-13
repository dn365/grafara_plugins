define([
  'angular',
  'lodash',
  'kbn',
  './queryBuilder',
  './monSeries',
  './queryCtrl',
],
function (angular, _, kbn, MonQueryBuilder, MonSeries) {
  'use strict';

  var module = angular.module('grafana.services');

  module.factory('MonDatasource', function($q, $http, templateSrv) {

    function MonDatasource(datasource) {
      this.type = 'data_mon';
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
        if (pair[0] === "app_key") {
          // this.api = decodeURIComponent(pair[1]);
          this.app_key = pair[1];
        }
      }

      // this.annotationEditorSrc = 'app/features/influxdb/partials/annotations.editor.html';
    }

    MonDatasource.prototype.query = function(options) {

      // console.log(options)

      var timeFilter = getTimeFilter(options);

      console.log(timeFilter);
      // console.log(options.targets);
      var promises = _.map(options.targets, function(target) {
        if (target.hide) {
          return [];
        }

        // build query
        var queryBuilder = new MonQueryBuilder(target);
        var query = queryBuilder.build();
        query = $.extend(query,timeFilter);

        // replace grafana variables
        // query = query.replace('$timeFilter', timeFilter);
        // query = query.replace(/\$interval/g, (target.interval || options.interval));

        query = $.extend(query,{group_by: target.interval || options.interval});

        // replace templated variables
        // console.log(_.map(query,function(value, key){
        //   return key+'='+value;
        // }).join('&'));

        // query = _.map(query,function(value, key){
        //   return key+'='+value;
        // }).join('&');

        // query = templateSrv.replace(query);

        var alias = target.alias ? templateSrv.replace(target.alias) : '';

        // var handleResponse = handleMonQueryResponse;


        var handleResponse = _.partial(handleMonQueryResponse, alias);
        return this._seriesQuery("Measurements",query).then(handleResponse);

      }, this);

      // console.log('promises show ...');
      // console.log(promises);

      return $q.all(promises).then(function(results) {
        return { data: _.flatten(results) };
      });
    };

    // MonDatasource.prototype.annotationQuery = function(annotation, rangeUnparsed) {
    //   var timeFilter = getTimeFilter({ range: rangeUnparsed });
    //   var query = annotation.query.replace('$timeFilter', timeFilter);
    //   query = templateSrv.replace(query);
    //
    //   return this._seriesQuery(query).then(function(results) {
    //     return new InfluxSeries({ seriesList: results, annotation: annotation }).getAnnotations();
    //   });
    // };

    MonDatasource.prototype.metricFindQuery = function (query, queryType) {
      var interpolated;

      try {
        interpolated = templateSrv.replace(queryType);
      }
      catch (err) {
        return $q.reject(err);
      }


      return this._seriesQuery(interpolated, query).then(function (results) {

        if (!results || results.length === 0) { return []; }

        var series = results;
        switch (queryType) {
        case 'MEASUREMENTS':
          // console.log('MEASUREMENTS list.....');
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
      });
    };

    function retry(deferred, callback, delay) {
      return callback().then(undefined, function(reason) {
        if (reason.status !== 0 || reason.status >= 300) {
          reason.message = 'Data API Error: <br/>' + reason.data;
          deferred.reject(reason);
        }
        else {
          setTimeout(function() {
            return retry(deferred, callback, Math.min(delay * 2, 30000));
          }, delay);
        }
      });
    }

    MonDatasource.prototype._seriesQuery = function(queryType,query) {
      switch (queryType) {
      case 'MEASUREMENTS':
        return this._monRequest('GET', '/metrics',{});
      case 'TAG_KEYS':
        return this._monRequest('GET', '/metrics/tags',{name:query.name,type:'keys'});
      case 'TAG_VALUES':
        return this._monRequest('GET',"/metrics/tags",{name:query.name,type:'values',key:query.key});
      case 'Measurements':
        return this._monRequest('GET','/metrics/measurements',query);
      }
    };

    MonDatasource.prototype._monRequest = function(method, url, data) {
      var self = this;
      var deferred = $q.defer();


      retry(deferred, function() {

        var currentUrl =  self.url;

        var params = {
          app_key: self.app_key,
        };

        if (self.database) {
          params.db = self.database;
        }

        if (method === 'GET') {
          _.extend(params, data);
          data = null;
        }

        console.log(currentUrl + url);

        var options = {
          method: method,
          url:    currentUrl + url,
          params: params,
          data:   data,
          precision: "ms",
        };

        options.headers = options.headers || {};
        if (self.basicAuth) {
          options.headers.Authorization = self.basicAuth;
        }

        return $http(options).success(function (data) {
          deferred.resolve(data);
        });
      }, 10);

      return deferred.promise;
    };

    function handleMonQueryResponse(alias, seriesList) {
      console.log('handleMonQueryResponse ...');
      console.log(seriesList);
      var Series = new MonSeries({ seriesList: seriesList, alias: alias });
      return Series.getTimeSeries();
    }

    function getTimeFilter(options) {
      var from = getTime(options.range.from);
      var until = getTime(options.range.to);
      var fromIsAbsolute = from[from.length-1] === 's';

      if (until === 'now' && !fromIsAbsolute) {
        // return 'time > ' + from;
        return {from:from.split(' - ')[1],until:until};
      }

      // return 'time > ' + from + ' and time < ' + until;
      return {from: from,until:until};
    }

    function getTime(date) {
      if (_.isString(date)) {
        return date.replace('-', ' - ');
      }

      return to_utc_epoch_seconds(date);
      // return date;
    }

    function to_utc_epoch_seconds(date) {
      return (date.getTime() / 1000).toFixed(0) + 's';
    }

    return MonDatasource;

  });

});
