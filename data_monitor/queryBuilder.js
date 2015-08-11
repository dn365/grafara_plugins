define([
    'lodash'
],
function (_) {
  'use strict';

  function MonQueryBuilder(target) {
    this.target = target;
  }

  var p = MonQueryBuilder.prototype;

  p.build = function() {
    return this.target.rawQuery ? this._modifyRawQuery() : this._buildQuery();
  };

  p._buildQuery = function() {
    var target = this.target;

    // console.log('Build Query: target = ', target);

    if (!target.measurement) {
      throw "Metric measurement is missing";
    }

    // var query = 'SELECT ';
    var measurement = target.measurement;
    var aggregationFunc = target.function || 'avg';

    // if(!measurement.match('^/.*/') && !measurement.match(/^merge\(.*\)/)) {
    //   measurement = '"' + measurement+ '"';
    // }

    // query +=  aggregationFunc + '(value)';
    // query += ' FROM ' + measurement + ' WHERE $timeFilter';
    // query += _.map(target.tags, function(value, key) {
    //   return ' AND ' + key + '=' + "'" + value + "'";
    // }).join('');

    var dimensions = _.map(target.tags, function(value, key) {
      return key+':'+value;
    }).join(',');


    // query += ' GROUP BY time($interval)';
    var query = {
      name: measurement,
      function: aggregationFunc,
      dimensions: dimensions
    };

    // query = $.extend(query,$timeFilter);

    // if (target.fill) {
    //   query += ' fill(' + target.fill + ')';
    // }

    // query += " ORDER BY asc";
    target.query = query;

    return query;
  };

  p._modifyRawQuery = function () {
    var query = this.target.query.replace(";", "");
    return query;
  };

  return MonQueryBuilder;
});
