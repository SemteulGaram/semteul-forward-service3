var fs = require('fs')

var rs = fs.createReadStream('D:/ProgramData/ESTsoft/ALYac/stgr/TWT_Workspace.jpg.bak')

console.log('ReadStream:', rs)
console.log('isPause:', rs.isPaused())

process.exit(1)

/*
class TestClass {
  constructor () {}

  static sa () {console.log('sa')}

  a() {
    console.log('a')
    this.constructor.sa()
  }
}
*/

/*
//http://timnew.me/blog/2014/06/23/process-nexttick-implementation-in-browser/
process.nextTick = (function () {
    var canSetImmediate = typeof window !== 'undefined'
    && window.setImmediate;
    var canPost = typeof window !== 'undefined'
    && window.postMessage && window.addEventListener;
    if (canSetImmediate) {
        return function (f) { return window.setImmediate(f) };
    }
    if (canPost) {
        var queue = [];
        window.addEventListener('message', function (ev) {
            var source = ev.source;
            if ((source === window || source === null) && ev.data === 'process-tick') {
                ev.stopPropagation();
                if (queue.length > 0) {
                    var fn = queue.shift();
                    fn();
                }
            }
        }, true);
        return function nextTick(fn) {
            queue.push(fn);
            window.postMessage('process-tick', '*');
        };
    }
    return function nextTick(fn) {
        setTimeout(fn, 0);
    };
})();
*/

/*
function testCase0 (count) {
  console.time('TestCase0')
  let loop
  loop = function (count) {
    if (count > 0) process.nextTick(() => {loop(count - 1)})
    else console.timeEnd('TestCase0')
  }

  loop(count)
}

function testCase1 (count) {
  console.time('TestCase1')
  let loop
  loop = function (count) {
    if (count > 0) (new Promise(function (s, _) {s()})).then(() => {
      loop(count - 1)
    })
    else console.timeEnd('TestCase1')
  }

  loop(count)
}

function testCase2 (count) {
  console.time('TestCase2')
  let loop
  loop = function (count) {
    if (count > 0) setTimeout(() => {loop(count - 1)}, 0)
    else console.timeEnd('TestCase2')
  }

  loop(count)
}

function testCase3 (count) {
  console.time('TestCase3')
  let loop
  loop = function (count) {
    if (count > 0) setImmediate(() => {loop(count - 1)})
    else console.timeEnd('TestCase3')
  }

  loop(count)
}
*/
