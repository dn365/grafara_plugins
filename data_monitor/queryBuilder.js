define([
  'lodash'
],
function (_) {
  'use strict';

  function MonQueryBuilder(target) {
    // console.log("MonQueryBuilder target: ------");
    // console.log(target);
    this.target = target;
  }

  function renderTagCondition (tag, index) {
    var str = "";
    // var operator = tag.operator;
    var value = tag.value;
    // if (index > 0) {
    //   str = (tag.condition || 'AND') + ' ';
    // }
    //
    // if (!operator) {
    //   if (/^\/.*\/$/.test(tag.value)) {
    //     operator = '=~';
    //   } else {
    //     operator = '=';
    //   }
    // }
    //
    // // quote value unless regex
    // if (operator !== '=~' && operator !== '!~') {
    //   value = "'" + value + "'";
    // }
    // console.log("renderTagCondition: -----------");
    // console.log(tag);
    return str + tag.key + ':' + value;
  }

  var p = MonQueryBuilder.prototype;

  p.build = function() {
    return this.target.rawQuery ? this._modifyRawQuery() : this._buildQuery();
  };

  p.buildExploreQuery = function(type, withKey) {
    var query;
    var measurement;

    if (type === 'TAG_KEYS') {
      // query = 'SHOW TAG KEYS';
      measurement = this.target.measurement;
      // query = {'name':measurement};
      query = {'query_type':'TAG_KEYS'};
    } else if (type === 'TAG_VALUES') {
      // query = 'SHOW TAG VALUES';
      measurement = this.target.measurement;
      query = {'query_type':'TAG_VALUES'};
      // query = {'name':measurement};
      // query = {'name':measurement,'key':$scope.segments[$scope.segments.length - 2].value};
    } else if (type === 'MEASUREMENTS') {
      // query = 'SHOW MEASUREMENTS';
      query = {'query_type': 'MEASUREMENTS'};
    }

    // } else if (type === 'FIELDS') {
    //   query = 'SHOW FIELD KEYS FROM "' + this.target.measurement + '"';
    //   return query;
    // }

    if (measurement) {
      // if (!measurement.match('^/.*/') && !measurement.match(/^merge\(.*\)/)) {
      //   measurement = '"' + measurement+ '"';
      // }
      // query += ' FROM ' + measurement;
      query['name'] = measurement;
    }

    if (withKey) {
      // query += ' WITH KEY = "' + withKey + '"';
      query['key'] = withKey;
    }

    if (this.target.tags && this.target.tags.length > 0) {
      var whereConditions = _.reduce(this.target.tags, function(memo, tag) {
        // do not add a condition for the key we want to explore for
        if (tag.key === withKey) {
          return memo;
        }
        memo.push(renderTagCondition(tag, memo.length));
        return memo;
      }, []);

      if (whereConditions.length > 0) {
        // query +=  ' WHERE ' + whereConditions.join(' ');
      }
    }
    // console.log("Builder explore: -----");
    // console.log(query);
    return query;
  };

  p._buildQuery = function() {
    var target = this.target;

    if (!target.measurement) {
      throw "Metric is missing";
    }

    // if (!target.fields) {
    //   target.fields = [{name: 'value', func: target.function || 'avg'}];
    // }

    // var query = 'SELECT ';
    // var measurement = target.measurement;


    // var i;
    // for (i = 0; i < target.fields.length; i++) {
    //   var field = target.fields[i];
    //   if (i > 0) {
    //     query += ', ';
    //   }
    //   query += field.func + '(' + field.name + ')';
    // }

    var measurement = target.measurement;
    var aggregationFunc = target.function || 'avg';

    // if (!measurement.match('^/.*/') && !measurement.match(/^merge\(.*\)/)) {
    //   measurement = '"' + measurement+ '"';
    // }

    // query += ' FROM ' + measurement + ' WHERE ';
    // var conditions = _.map(target.tags, function(tag, index) {
    //   return renderTagCondition(tag, index);
    // });
    // console.log("target.tags: ----------");
    // console.log(target);
    var dimensions = _.map(target.tags, function(tag, index) {
      // return key+':'+value;
      return renderTagCondition(tag,index);
    }).join(',');
    // console.log(dimensions);
    // query += conditions.join(' ');
    // query += (conditions.length > 0 ? ' AND ' : '') + '$timeFilter';

    // query += ' GROUP BY time($interval)';
    // if  (target.groupByTags && target.groupByTags.length > 0) {
      // query += ', "' + target.groupByTags.join('", "') + '"';
    // }

    // if (target.fill) {
    //   query += ' fill(' + target.fill + ')';
    // }

    var query = {
      name: measurement,
      function: aggregationFunc,
      dimensions: dimensions
    };

    target.query = query;

    return query;
  };

  p._modifyRawQuery = function () {
    var query = this.target.query.replace(";", "");
    return query;
  };

  return MonQueryBuilder;
});
