'use strict';
var Promise = require('bluebird');
var utils = require('./utils');
var MIN = 3;
var MAX = 9;
module.exports = remove;
function remove(self, id, bbox, nodeID) {
  var store = self.store;
  if (!nodeID) {
    if (!self.root) {
      return Promise.reject(new Error('can\'t delete it if it isn\'t here'));
    } else {
      return remove(self, id, bbox, self.root);
    }
  }
  return self.store.get(nodeID).then(function (root) {
    return findPath(self, id, bbox, [[root]]);
  }).then(function (path) {
    var node = path.pop();
    var toRemove = [];
    var toUpdate = [];
    var i = path.length - 1;
    var tail = path[i];
    tail.children.splice(indexById(id, tail.children), 1);
    var bbox, index;
    while (i) {
      i--;
      node = tail;
      tail = path[i];
      if (!node.children.length) {
        tail.children.splice(indexById(node.id, tail.children), 1);
        toRemove.push(node.id);
        toUpdate.push(tail);
        continue;
      }
      bbox = node.bbox;
      node.bbox = node.children.reduce(utils.enlarger);
      if (utils.equals(bbox, node.bbox)) {
        break;
      }
      if (toUpdate.indexOf(node) === -1) {
        toUpdate.push(node);
      }
      index = indexById(node.id, tail.children);
      tail.children[index].bbox = [node.bbox[0].slice(), node.bbox[1].slice()];
      if (toUpdate.indexOf(tail) === -1) {
        toUpdate.push(tail);
      }
    }
    return self.store.batch(toRemove.map(function (key) {
      return {
        key: key,
        type: 'del'
      };
    }).concat(toUpdate.map(function (item) {
      return {
        key: item.id,
        value: item
      };
    })));
  });
}

function indexById(id, children) {
  var i = -1;
    var len = children.length;
    while (++i < len) {
      if (id === children[i].id) {
        return i;
      }
    }
    throw new Error('id not in node it is claimed to be in');
}
function findPath(self, id, bbox, queue) {
  if (!queue.length) {
    throw new Error('not found');
  }
  var path = queue.pop();
  var node = path[path.length - 1];
  var candidates = [];
  var i = -1;
  var len = node.children.length;
  var child;
  while (++i < len) {
    child = node.children[i];
    if (child.leaf) {
      if (child.id === id) {
        path.push(child);
        return path;
      }
    } else {
      if (utils.contains(child.bbox, bbox)) {
        candidates.push(child.id);
      }
    }
  }
  return Promise.all(candidates.map(function (id) {
    return self.store.get(id);
  })).then(function (items) {
    items.forEach(function (item) {
      var nPath = path.slice();
      nPath.push(item);
      queue.push(nPath);
    });
    return findPath(self, id, bbox, queue);
  });
}