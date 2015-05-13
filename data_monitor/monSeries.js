define([
  'lodash',
],
function (_) {
  'use strict';

  function MonSeries(options) {
    this.seriesList = options.seriesList;
    this.alias = options.alias;
    // this.annotation = options.annotation;
  }

  var p = MonSeries.prototype;

  p.getTimeSeries = function() {
    var output = [];
    var self = this;

    if (!self.seriesList) {
      return output;
    }

    var alias = self.alias;

    _.map(this.seriesList, function(series) {
      return _.map(series, function(values, series_name) {
        var datapoints = [];
        var seriesName = series_name;

        for (var i = 0; i < values.length; i++) {
          datapoints[i] = [values[i].value, new Date(values[i].time).getTime()];
        }

        // console.log('show seriesName ' + alias);

        if (alias) {
          seriesName = alias;
        }

        output.push({ target: seriesName, datapoints: datapoints });
      });

    });

    // console.log('show output ...');
    // console.log(output);
    return output;
  };

  p.getAnnotations = function () {
    var list = [];
    var self = this;

    _.each(this.seriesList, function (series) {
      var titleCol = null;
      var timeCol = null;
      var tagsCol = null;
      var textCol = null;

      _.each(series.columns, function(column, index) {
        if (column === 'time') { timeCol = index; return; }
        if (column === 'sequence_number') { return; }
        if (!titleCol) { titleCol = index; }
        if (column === self.annotation.titleColumn) { titleCol = index; return; }
        if (column === self.annotation.tagsColumn) { tagsCol = index; return; }
        if (column === self.annotation.textColumn) { textCol = index; return; }
      });

      _.each(series.points, function (point) {
        var data = {
          annotation: self.annotation,
          time: point[timeCol],
          title: point[titleCol],
          tags: point[tagsCol],
          text: point[textCol]
        };

        if (tagsCol) {
          data.tags = point[tagsCol];
        }

        list.push(data);
      });
    });

    return list;
  };

  p.createNameForSeries = function(seriesName, groupByColValue) {
    var regex = /\$(\w+)/g;
    var segments = seriesName.split('.');

    return this.alias.replace(regex, function(match, group) {
      if (group === 's') {
        return seriesName;
      }
      else if (group === 'g') {
        return groupByColValue;
      }
      var index = parseInt(group);
      if (_.isNumber(index) && index < segments.length) {
        return segments[index];
      }
      return match;
    });

  };

  return MonSeries;
});
