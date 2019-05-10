var tests = require('abstract-chunk-store/tests')
var tape = require('tape')

var StoreLib = require('../dist/Store.js')

var Store = StoreLib.default

tests(tape, Store)
