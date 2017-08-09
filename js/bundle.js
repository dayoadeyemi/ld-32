(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
(function (global){
/*!
 * The buffer module from node.js, for the browser.
 *
 * @author   Feross Aboukhadijeh <feross@feross.org> <http://feross.org>
 * @license  MIT
 */
/* eslint-disable no-proto */

'use strict'

var base64 = require('base64-js')
var ieee754 = require('ieee754')
var isArray = require('isarray')

exports.Buffer = Buffer
exports.SlowBuffer = SlowBuffer
exports.INSPECT_MAX_BYTES = 50

/**
 * If `Buffer.TYPED_ARRAY_SUPPORT`:
 *   === true    Use Uint8Array implementation (fastest)
 *   === false   Use Object implementation (most compatible, even IE6)
 *
 * Browsers that support typed arrays are IE 10+, Firefox 4+, Chrome 7+, Safari 5.1+,
 * Opera 11.6+, iOS 4.2+.
 *
 * Due to various browser bugs, sometimes the Object implementation will be used even
 * when the browser supports typed arrays.
 *
 * Note:
 *
 *   - Firefox 4-29 lacks support for adding new properties to `Uint8Array` instances,
 *     See: https://bugzilla.mozilla.org/show_bug.cgi?id=695438.
 *
 *   - Chrome 9-10 is missing the `TypedArray.prototype.subarray` function.
 *
 *   - IE10 has a broken `TypedArray.prototype.subarray` function which returns arrays of
 *     incorrect length in some situations.

 * We detect these buggy browsers and set `Buffer.TYPED_ARRAY_SUPPORT` to `false` so they
 * get the Object implementation, which is slower but behaves correctly.
 */
Buffer.TYPED_ARRAY_SUPPORT = global.TYPED_ARRAY_SUPPORT !== undefined
  ? global.TYPED_ARRAY_SUPPORT
  : typedArraySupport()

/*
 * Export kMaxLength after typed array support is determined.
 */
exports.kMaxLength = kMaxLength()

function typedArraySupport () {
  try {
    var arr = new Uint8Array(1)
    arr.__proto__ = {__proto__: Uint8Array.prototype, foo: function () { return 42 }}
    return arr.foo() === 42 && // typed array instances can be augmented
        typeof arr.subarray === 'function' && // chrome 9-10 lack `subarray`
        arr.subarray(1, 1).byteLength === 0 // ie10 has broken `subarray`
  } catch (e) {
    return false
  }
}

function kMaxLength () {
  return Buffer.TYPED_ARRAY_SUPPORT
    ? 0x7fffffff
    : 0x3fffffff
}

function createBuffer (that, length) {
  if (kMaxLength() < length) {
    throw new RangeError('Invalid typed array length')
  }
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    // Return an augmented `Uint8Array` instance, for best performance
    that = new Uint8Array(length)
    that.__proto__ = Buffer.prototype
  } else {
    // Fallback: Return an object instance of the Buffer class
    if (that === null) {
      that = new Buffer(length)
    }
    that.length = length
  }

  return that
}

/**
 * The Buffer constructor returns instances of `Uint8Array` that have their
 * prototype changed to `Buffer.prototype`. Furthermore, `Buffer` is a subclass of
 * `Uint8Array`, so the returned instances will have all the node `Buffer` methods
 * and the `Uint8Array` methods. Square bracket notation works as expected -- it
 * returns a single octet.
 *
 * The `Uint8Array` prototype remains unmodified.
 */

function Buffer (arg, encodingOrOffset, length) {
  if (!Buffer.TYPED_ARRAY_SUPPORT && !(this instanceof Buffer)) {
    return new Buffer(arg, encodingOrOffset, length)
  }

  // Common case.
  if (typeof arg === 'number') {
    if (typeof encodingOrOffset === 'string') {
      throw new Error(
        'If encoding is specified then the first argument must be a string'
      )
    }
    return allocUnsafe(this, arg)
  }
  return from(this, arg, encodingOrOffset, length)
}

Buffer.poolSize = 8192 // not used by this implementation

// TODO: Legacy, not needed anymore. Remove in next major version.
Buffer._augment = function (arr) {
  arr.__proto__ = Buffer.prototype
  return arr
}

function from (that, value, encodingOrOffset, length) {
  if (typeof value === 'number') {
    throw new TypeError('"value" argument must not be a number')
  }

  if (typeof ArrayBuffer !== 'undefined' && value instanceof ArrayBuffer) {
    return fromArrayBuffer(that, value, encodingOrOffset, length)
  }

  if (typeof value === 'string') {
    return fromString(that, value, encodingOrOffset)
  }

  return fromObject(that, value)
}

/**
 * Functionally equivalent to Buffer(arg, encoding) but throws a TypeError
 * if value is a number.
 * Buffer.from(str[, encoding])
 * Buffer.from(array)
 * Buffer.from(buffer)
 * Buffer.from(arrayBuffer[, byteOffset[, length]])
 **/
Buffer.from = function (value, encodingOrOffset, length) {
  return from(null, value, encodingOrOffset, length)
}

if (Buffer.TYPED_ARRAY_SUPPORT) {
  Buffer.prototype.__proto__ = Uint8Array.prototype
  Buffer.__proto__ = Uint8Array
  if (typeof Symbol !== 'undefined' && Symbol.species &&
      Buffer[Symbol.species] === Buffer) {
    // Fix subarray() in ES2016. See: https://github.com/feross/buffer/pull/97
    Object.defineProperty(Buffer, Symbol.species, {
      value: null,
      configurable: true
    })
  }
}

function assertSize (size) {
  if (typeof size !== 'number') {
    throw new TypeError('"size" argument must be a number')
  } else if (size < 0) {
    throw new RangeError('"size" argument must not be negative')
  }
}

function alloc (that, size, fill, encoding) {
  assertSize(size)
  if (size <= 0) {
    return createBuffer(that, size)
  }
  if (fill !== undefined) {
    // Only pay attention to encoding if it's a string. This
    // prevents accidentally sending in a number that would
    // be interpretted as a start offset.
    return typeof encoding === 'string'
      ? createBuffer(that, size).fill(fill, encoding)
      : createBuffer(that, size).fill(fill)
  }
  return createBuffer(that, size)
}

/**
 * Creates a new filled Buffer instance.
 * alloc(size[, fill[, encoding]])
 **/
Buffer.alloc = function (size, fill, encoding) {
  return alloc(null, size, fill, encoding)
}

function allocUnsafe (that, size) {
  assertSize(size)
  that = createBuffer(that, size < 0 ? 0 : checked(size) | 0)
  if (!Buffer.TYPED_ARRAY_SUPPORT) {
    for (var i = 0; i < size; ++i) {
      that[i] = 0
    }
  }
  return that
}

/**
 * Equivalent to Buffer(num), by default creates a non-zero-filled Buffer instance.
 * */
Buffer.allocUnsafe = function (size) {
  return allocUnsafe(null, size)
}
/**
 * Equivalent to SlowBuffer(num), by default creates a non-zero-filled Buffer instance.
 */
Buffer.allocUnsafeSlow = function (size) {
  return allocUnsafe(null, size)
}

function fromString (that, string, encoding) {
  if (typeof encoding !== 'string' || encoding === '') {
    encoding = 'utf8'
  }

  if (!Buffer.isEncoding(encoding)) {
    throw new TypeError('"encoding" must be a valid string encoding')
  }

  var length = byteLength(string, encoding) | 0
  that = createBuffer(that, length)

  var actual = that.write(string, encoding)

  if (actual !== length) {
    // Writing a hex string, for example, that contains invalid characters will
    // cause everything after the first invalid character to be ignored. (e.g.
    // 'abxxcd' will be treated as 'ab')
    that = that.slice(0, actual)
  }

  return that
}

function fromArrayLike (that, array) {
  var length = array.length < 0 ? 0 : checked(array.length) | 0
  that = createBuffer(that, length)
  for (var i = 0; i < length; i += 1) {
    that[i] = array[i] & 255
  }
  return that
}

function fromArrayBuffer (that, array, byteOffset, length) {
  array.byteLength // this throws if `array` is not a valid ArrayBuffer

  if (byteOffset < 0 || array.byteLength < byteOffset) {
    throw new RangeError('\'offset\' is out of bounds')
  }

  if (array.byteLength < byteOffset + (length || 0)) {
    throw new RangeError('\'length\' is out of bounds')
  }

  if (byteOffset === undefined && length === undefined) {
    array = new Uint8Array(array)
  } else if (length === undefined) {
    array = new Uint8Array(array, byteOffset)
  } else {
    array = new Uint8Array(array, byteOffset, length)
  }

  if (Buffer.TYPED_ARRAY_SUPPORT) {
    // Return an augmented `Uint8Array` instance, for best performance
    that = array
    that.__proto__ = Buffer.prototype
  } else {
    // Fallback: Return an object instance of the Buffer class
    that = fromArrayLike(that, array)
  }
  return that
}

function fromObject (that, obj) {
  if (Buffer.isBuffer(obj)) {
    var len = checked(obj.length) | 0
    that = createBuffer(that, len)

    if (that.length === 0) {
      return that
    }

    obj.copy(that, 0, 0, len)
    return that
  }

  if (obj) {
    if ((typeof ArrayBuffer !== 'undefined' &&
        obj.buffer instanceof ArrayBuffer) || 'length' in obj) {
      if (typeof obj.length !== 'number' || isnan(obj.length)) {
        return createBuffer(that, 0)
      }
      return fromArrayLike(that, obj)
    }

    if (obj.type === 'Buffer' && isArray(obj.data)) {
      return fromArrayLike(that, obj.data)
    }
  }

  throw new TypeError('First argument must be a string, Buffer, ArrayBuffer, Array, or array-like object.')
}

function checked (length) {
  // Note: cannot use `length < kMaxLength()` here because that fails when
  // length is NaN (which is otherwise coerced to zero.)
  if (length >= kMaxLength()) {
    throw new RangeError('Attempt to allocate Buffer larger than maximum ' +
                         'size: 0x' + kMaxLength().toString(16) + ' bytes')
  }
  return length | 0
}

function SlowBuffer (length) {
  if (+length != length) { // eslint-disable-line eqeqeq
    length = 0
  }
  return Buffer.alloc(+length)
}

Buffer.isBuffer = function isBuffer (b) {
  return !!(b != null && b._isBuffer)
}

Buffer.compare = function compare (a, b) {
  if (!Buffer.isBuffer(a) || !Buffer.isBuffer(b)) {
    throw new TypeError('Arguments must be Buffers')
  }

  if (a === b) return 0

  var x = a.length
  var y = b.length

  for (var i = 0, len = Math.min(x, y); i < len; ++i) {
    if (a[i] !== b[i]) {
      x = a[i]
      y = b[i]
      break
    }
  }

  if (x < y) return -1
  if (y < x) return 1
  return 0
}

Buffer.isEncoding = function isEncoding (encoding) {
  switch (String(encoding).toLowerCase()) {
    case 'hex':
    case 'utf8':
    case 'utf-8':
    case 'ascii':
    case 'latin1':
    case 'binary':
    case 'base64':
    case 'ucs2':
    case 'ucs-2':
    case 'utf16le':
    case 'utf-16le':
      return true
    default:
      return false
  }
}

Buffer.concat = function concat (list, length) {
  if (!isArray(list)) {
    throw new TypeError('"list" argument must be an Array of Buffers')
  }

  if (list.length === 0) {
    return Buffer.alloc(0)
  }

  var i
  if (length === undefined) {
    length = 0
    for (i = 0; i < list.length; ++i) {
      length += list[i].length
    }
  }

  var buffer = Buffer.allocUnsafe(length)
  var pos = 0
  for (i = 0; i < list.length; ++i) {
    var buf = list[i]
    if (!Buffer.isBuffer(buf)) {
      throw new TypeError('"list" argument must be an Array of Buffers')
    }
    buf.copy(buffer, pos)
    pos += buf.length
  }
  return buffer
}

function byteLength (string, encoding) {
  if (Buffer.isBuffer(string)) {
    return string.length
  }
  if (typeof ArrayBuffer !== 'undefined' && typeof ArrayBuffer.isView === 'function' &&
      (ArrayBuffer.isView(string) || string instanceof ArrayBuffer)) {
    return string.byteLength
  }
  if (typeof string !== 'string') {
    string = '' + string
  }

  var len = string.length
  if (len === 0) return 0

  // Use a for loop to avoid recursion
  var loweredCase = false
  for (;;) {
    switch (encoding) {
      case 'ascii':
      case 'latin1':
      case 'binary':
        return len
      case 'utf8':
      case 'utf-8':
      case undefined:
        return utf8ToBytes(string).length
      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return len * 2
      case 'hex':
        return len >>> 1
      case 'base64':
        return base64ToBytes(string).length
      default:
        if (loweredCase) return utf8ToBytes(string).length // assume utf8
        encoding = ('' + encoding).toLowerCase()
        loweredCase = true
    }
  }
}
Buffer.byteLength = byteLength

function slowToString (encoding, start, end) {
  var loweredCase = false

  // No need to verify that "this.length <= MAX_UINT32" since it's a read-only
  // property of a typed array.

  // This behaves neither like String nor Uint8Array in that we set start/end
  // to their upper/lower bounds if the value passed is out of range.
  // undefined is handled specially as per ECMA-262 6th Edition,
  // Section 13.3.3.7 Runtime Semantics: KeyedBindingInitialization.
  if (start === undefined || start < 0) {
    start = 0
  }
  // Return early if start > this.length. Done here to prevent potential uint32
  // coercion fail below.
  if (start > this.length) {
    return ''
  }

  if (end === undefined || end > this.length) {
    end = this.length
  }

  if (end <= 0) {
    return ''
  }

  // Force coersion to uint32. This will also coerce falsey/NaN values to 0.
  end >>>= 0
  start >>>= 0

  if (end <= start) {
    return ''
  }

  if (!encoding) encoding = 'utf8'

  while (true) {
    switch (encoding) {
      case 'hex':
        return hexSlice(this, start, end)

      case 'utf8':
      case 'utf-8':
        return utf8Slice(this, start, end)

      case 'ascii':
        return asciiSlice(this, start, end)

      case 'latin1':
      case 'binary':
        return latin1Slice(this, start, end)

      case 'base64':
        return base64Slice(this, start, end)

      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return utf16leSlice(this, start, end)

      default:
        if (loweredCase) throw new TypeError('Unknown encoding: ' + encoding)
        encoding = (encoding + '').toLowerCase()
        loweredCase = true
    }
  }
}

// The property is used by `Buffer.isBuffer` and `is-buffer` (in Safari 5-7) to detect
// Buffer instances.
Buffer.prototype._isBuffer = true

function swap (b, n, m) {
  var i = b[n]
  b[n] = b[m]
  b[m] = i
}

Buffer.prototype.swap16 = function swap16 () {
  var len = this.length
  if (len % 2 !== 0) {
    throw new RangeError('Buffer size must be a multiple of 16-bits')
  }
  for (var i = 0; i < len; i += 2) {
    swap(this, i, i + 1)
  }
  return this
}

Buffer.prototype.swap32 = function swap32 () {
  var len = this.length
  if (len % 4 !== 0) {
    throw new RangeError('Buffer size must be a multiple of 32-bits')
  }
  for (var i = 0; i < len; i += 4) {
    swap(this, i, i + 3)
    swap(this, i + 1, i + 2)
  }
  return this
}

Buffer.prototype.swap64 = function swap64 () {
  var len = this.length
  if (len % 8 !== 0) {
    throw new RangeError('Buffer size must be a multiple of 64-bits')
  }
  for (var i = 0; i < len; i += 8) {
    swap(this, i, i + 7)
    swap(this, i + 1, i + 6)
    swap(this, i + 2, i + 5)
    swap(this, i + 3, i + 4)
  }
  return this
}

Buffer.prototype.toString = function toString () {
  var length = this.length | 0
  if (length === 0) return ''
  if (arguments.length === 0) return utf8Slice(this, 0, length)
  return slowToString.apply(this, arguments)
}

Buffer.prototype.equals = function equals (b) {
  if (!Buffer.isBuffer(b)) throw new TypeError('Argument must be a Buffer')
  if (this === b) return true
  return Buffer.compare(this, b) === 0
}

Buffer.prototype.inspect = function inspect () {
  var str = ''
  var max = exports.INSPECT_MAX_BYTES
  if (this.length > 0) {
    str = this.toString('hex', 0, max).match(/.{2}/g).join(' ')
    if (this.length > max) str += ' ... '
  }
  return '<Buffer ' + str + '>'
}

Buffer.prototype.compare = function compare (target, start, end, thisStart, thisEnd) {
  if (!Buffer.isBuffer(target)) {
    throw new TypeError('Argument must be a Buffer')
  }

  if (start === undefined) {
    start = 0
  }
  if (end === undefined) {
    end = target ? target.length : 0
  }
  if (thisStart === undefined) {
    thisStart = 0
  }
  if (thisEnd === undefined) {
    thisEnd = this.length
  }

  if (start < 0 || end > target.length || thisStart < 0 || thisEnd > this.length) {
    throw new RangeError('out of range index')
  }

  if (thisStart >= thisEnd && start >= end) {
    return 0
  }
  if (thisStart >= thisEnd) {
    return -1
  }
  if (start >= end) {
    return 1
  }

  start >>>= 0
  end >>>= 0
  thisStart >>>= 0
  thisEnd >>>= 0

  if (this === target) return 0

  var x = thisEnd - thisStart
  var y = end - start
  var len = Math.min(x, y)

  var thisCopy = this.slice(thisStart, thisEnd)
  var targetCopy = target.slice(start, end)

  for (var i = 0; i < len; ++i) {
    if (thisCopy[i] !== targetCopy[i]) {
      x = thisCopy[i]
      y = targetCopy[i]
      break
    }
  }

  if (x < y) return -1
  if (y < x) return 1
  return 0
}

// Finds either the first index of `val` in `buffer` at offset >= `byteOffset`,
// OR the last index of `val` in `buffer` at offset <= `byteOffset`.
//
// Arguments:
// - buffer - a Buffer to search
// - val - a string, Buffer, or number
// - byteOffset - an index into `buffer`; will be clamped to an int32
// - encoding - an optional encoding, relevant is val is a string
// - dir - true for indexOf, false for lastIndexOf
function bidirectionalIndexOf (buffer, val, byteOffset, encoding, dir) {
  // Empty buffer means no match
  if (buffer.length === 0) return -1

  // Normalize byteOffset
  if (typeof byteOffset === 'string') {
    encoding = byteOffset
    byteOffset = 0
  } else if (byteOffset > 0x7fffffff) {
    byteOffset = 0x7fffffff
  } else if (byteOffset < -0x80000000) {
    byteOffset = -0x80000000
  }
  byteOffset = +byteOffset  // Coerce to Number.
  if (isNaN(byteOffset)) {
    // byteOffset: it it's undefined, null, NaN, "foo", etc, search whole buffer
    byteOffset = dir ? 0 : (buffer.length - 1)
  }

  // Normalize byteOffset: negative offsets start from the end of the buffer
  if (byteOffset < 0) byteOffset = buffer.length + byteOffset
  if (byteOffset >= buffer.length) {
    if (dir) return -1
    else byteOffset = buffer.length - 1
  } else if (byteOffset < 0) {
    if (dir) byteOffset = 0
    else return -1
  }

  // Normalize val
  if (typeof val === 'string') {
    val = Buffer.from(val, encoding)
  }

  // Finally, search either indexOf (if dir is true) or lastIndexOf
  if (Buffer.isBuffer(val)) {
    // Special case: looking for empty string/buffer always fails
    if (val.length === 0) {
      return -1
    }
    return arrayIndexOf(buffer, val, byteOffset, encoding, dir)
  } else if (typeof val === 'number') {
    val = val & 0xFF // Search for a byte value [0-255]
    if (Buffer.TYPED_ARRAY_SUPPORT &&
        typeof Uint8Array.prototype.indexOf === 'function') {
      if (dir) {
        return Uint8Array.prototype.indexOf.call(buffer, val, byteOffset)
      } else {
        return Uint8Array.prototype.lastIndexOf.call(buffer, val, byteOffset)
      }
    }
    return arrayIndexOf(buffer, [ val ], byteOffset, encoding, dir)
  }

  throw new TypeError('val must be string, number or Buffer')
}

function arrayIndexOf (arr, val, byteOffset, encoding, dir) {
  var indexSize = 1
  var arrLength = arr.length
  var valLength = val.length

  if (encoding !== undefined) {
    encoding = String(encoding).toLowerCase()
    if (encoding === 'ucs2' || encoding === 'ucs-2' ||
        encoding === 'utf16le' || encoding === 'utf-16le') {
      if (arr.length < 2 || val.length < 2) {
        return -1
      }
      indexSize = 2
      arrLength /= 2
      valLength /= 2
      byteOffset /= 2
    }
  }

  function read (buf, i) {
    if (indexSize === 1) {
      return buf[i]
    } else {
      return buf.readUInt16BE(i * indexSize)
    }
  }

  var i
  if (dir) {
    var foundIndex = -1
    for (i = byteOffset; i < arrLength; i++) {
      if (read(arr, i) === read(val, foundIndex === -1 ? 0 : i - foundIndex)) {
        if (foundIndex === -1) foundIndex = i
        if (i - foundIndex + 1 === valLength) return foundIndex * indexSize
      } else {
        if (foundIndex !== -1) i -= i - foundIndex
        foundIndex = -1
      }
    }
  } else {
    if (byteOffset + valLength > arrLength) byteOffset = arrLength - valLength
    for (i = byteOffset; i >= 0; i--) {
      var found = true
      for (var j = 0; j < valLength; j++) {
        if (read(arr, i + j) !== read(val, j)) {
          found = false
          break
        }
      }
      if (found) return i
    }
  }

  return -1
}

Buffer.prototype.includes = function includes (val, byteOffset, encoding) {
  return this.indexOf(val, byteOffset, encoding) !== -1
}

Buffer.prototype.indexOf = function indexOf (val, byteOffset, encoding) {
  return bidirectionalIndexOf(this, val, byteOffset, encoding, true)
}

Buffer.prototype.lastIndexOf = function lastIndexOf (val, byteOffset, encoding) {
  return bidirectionalIndexOf(this, val, byteOffset, encoding, false)
}

function hexWrite (buf, string, offset, length) {
  offset = Number(offset) || 0
  var remaining = buf.length - offset
  if (!length) {
    length = remaining
  } else {
    length = Number(length)
    if (length > remaining) {
      length = remaining
    }
  }

  // must be an even number of digits
  var strLen = string.length
  if (strLen % 2 !== 0) throw new TypeError('Invalid hex string')

  if (length > strLen / 2) {
    length = strLen / 2
  }
  for (var i = 0; i < length; ++i) {
    var parsed = parseInt(string.substr(i * 2, 2), 16)
    if (isNaN(parsed)) return i
    buf[offset + i] = parsed
  }
  return i
}

function utf8Write (buf, string, offset, length) {
  return blitBuffer(utf8ToBytes(string, buf.length - offset), buf, offset, length)
}

function asciiWrite (buf, string, offset, length) {
  return blitBuffer(asciiToBytes(string), buf, offset, length)
}

function latin1Write (buf, string, offset, length) {
  return asciiWrite(buf, string, offset, length)
}

function base64Write (buf, string, offset, length) {
  return blitBuffer(base64ToBytes(string), buf, offset, length)
}

function ucs2Write (buf, string, offset, length) {
  return blitBuffer(utf16leToBytes(string, buf.length - offset), buf, offset, length)
}

Buffer.prototype.write = function write (string, offset, length, encoding) {
  // Buffer#write(string)
  if (offset === undefined) {
    encoding = 'utf8'
    length = this.length
    offset = 0
  // Buffer#write(string, encoding)
  } else if (length === undefined && typeof offset === 'string') {
    encoding = offset
    length = this.length
    offset = 0
  // Buffer#write(string, offset[, length][, encoding])
  } else if (isFinite(offset)) {
    offset = offset | 0
    if (isFinite(length)) {
      length = length | 0
      if (encoding === undefined) encoding = 'utf8'
    } else {
      encoding = length
      length = undefined
    }
  // legacy write(string, encoding, offset, length) - remove in v0.13
  } else {
    throw new Error(
      'Buffer.write(string, encoding, offset[, length]) is no longer supported'
    )
  }

  var remaining = this.length - offset
  if (length === undefined || length > remaining) length = remaining

  if ((string.length > 0 && (length < 0 || offset < 0)) || offset > this.length) {
    throw new RangeError('Attempt to write outside buffer bounds')
  }

  if (!encoding) encoding = 'utf8'

  var loweredCase = false
  for (;;) {
    switch (encoding) {
      case 'hex':
        return hexWrite(this, string, offset, length)

      case 'utf8':
      case 'utf-8':
        return utf8Write(this, string, offset, length)

      case 'ascii':
        return asciiWrite(this, string, offset, length)

      case 'latin1':
      case 'binary':
        return latin1Write(this, string, offset, length)

      case 'base64':
        // Warning: maxLength not taken into account in base64Write
        return base64Write(this, string, offset, length)

      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return ucs2Write(this, string, offset, length)

      default:
        if (loweredCase) throw new TypeError('Unknown encoding: ' + encoding)
        encoding = ('' + encoding).toLowerCase()
        loweredCase = true
    }
  }
}

Buffer.prototype.toJSON = function toJSON () {
  return {
    type: 'Buffer',
    data: Array.prototype.slice.call(this._arr || this, 0)
  }
}

function base64Slice (buf, start, end) {
  if (start === 0 && end === buf.length) {
    return base64.fromByteArray(buf)
  } else {
    return base64.fromByteArray(buf.slice(start, end))
  }
}

function utf8Slice (buf, start, end) {
  end = Math.min(buf.length, end)
  var res = []

  var i = start
  while (i < end) {
    var firstByte = buf[i]
    var codePoint = null
    var bytesPerSequence = (firstByte > 0xEF) ? 4
      : (firstByte > 0xDF) ? 3
      : (firstByte > 0xBF) ? 2
      : 1

    if (i + bytesPerSequence <= end) {
      var secondByte, thirdByte, fourthByte, tempCodePoint

      switch (bytesPerSequence) {
        case 1:
          if (firstByte < 0x80) {
            codePoint = firstByte
          }
          break
        case 2:
          secondByte = buf[i + 1]
          if ((secondByte & 0xC0) === 0x80) {
            tempCodePoint = (firstByte & 0x1F) << 0x6 | (secondByte & 0x3F)
            if (tempCodePoint > 0x7F) {
              codePoint = tempCodePoint
            }
          }
          break
        case 3:
          secondByte = buf[i + 1]
          thirdByte = buf[i + 2]
          if ((secondByte & 0xC0) === 0x80 && (thirdByte & 0xC0) === 0x80) {
            tempCodePoint = (firstByte & 0xF) << 0xC | (secondByte & 0x3F) << 0x6 | (thirdByte & 0x3F)
            if (tempCodePoint > 0x7FF && (tempCodePoint < 0xD800 || tempCodePoint > 0xDFFF)) {
              codePoint = tempCodePoint
            }
          }
          break
        case 4:
          secondByte = buf[i + 1]
          thirdByte = buf[i + 2]
          fourthByte = buf[i + 3]
          if ((secondByte & 0xC0) === 0x80 && (thirdByte & 0xC0) === 0x80 && (fourthByte & 0xC0) === 0x80) {
            tempCodePoint = (firstByte & 0xF) << 0x12 | (secondByte & 0x3F) << 0xC | (thirdByte & 0x3F) << 0x6 | (fourthByte & 0x3F)
            if (tempCodePoint > 0xFFFF && tempCodePoint < 0x110000) {
              codePoint = tempCodePoint
            }
          }
      }
    }

    if (codePoint === null) {
      // we did not generate a valid codePoint so insert a
      // replacement char (U+FFFD) and advance only 1 byte
      codePoint = 0xFFFD
      bytesPerSequence = 1
    } else if (codePoint > 0xFFFF) {
      // encode to utf16 (surrogate pair dance)
      codePoint -= 0x10000
      res.push(codePoint >>> 10 & 0x3FF | 0xD800)
      codePoint = 0xDC00 | codePoint & 0x3FF
    }

    res.push(codePoint)
    i += bytesPerSequence
  }

  return decodeCodePointsArray(res)
}

// Based on http://stackoverflow.com/a/22747272/680742, the browser with
// the lowest limit is Chrome, with 0x10000 args.
// We go 1 magnitude less, for safety
var MAX_ARGUMENTS_LENGTH = 0x1000

function decodeCodePointsArray (codePoints) {
  var len = codePoints.length
  if (len <= MAX_ARGUMENTS_LENGTH) {
    return String.fromCharCode.apply(String, codePoints) // avoid extra slice()
  }

  // Decode in chunks to avoid "call stack size exceeded".
  var res = ''
  var i = 0
  while (i < len) {
    res += String.fromCharCode.apply(
      String,
      codePoints.slice(i, i += MAX_ARGUMENTS_LENGTH)
    )
  }
  return res
}

function asciiSlice (buf, start, end) {
  var ret = ''
  end = Math.min(buf.length, end)

  for (var i = start; i < end; ++i) {
    ret += String.fromCharCode(buf[i] & 0x7F)
  }
  return ret
}

function latin1Slice (buf, start, end) {
  var ret = ''
  end = Math.min(buf.length, end)

  for (var i = start; i < end; ++i) {
    ret += String.fromCharCode(buf[i])
  }
  return ret
}

function hexSlice (buf, start, end) {
  var len = buf.length

  if (!start || start < 0) start = 0
  if (!end || end < 0 || end > len) end = len

  var out = ''
  for (var i = start; i < end; ++i) {
    out += toHex(buf[i])
  }
  return out
}

function utf16leSlice (buf, start, end) {
  var bytes = buf.slice(start, end)
  var res = ''
  for (var i = 0; i < bytes.length; i += 2) {
    res += String.fromCharCode(bytes[i] + bytes[i + 1] * 256)
  }
  return res
}

Buffer.prototype.slice = function slice (start, end) {
  var len = this.length
  start = ~~start
  end = end === undefined ? len : ~~end

  if (start < 0) {
    start += len
    if (start < 0) start = 0
  } else if (start > len) {
    start = len
  }

  if (end < 0) {
    end += len
    if (end < 0) end = 0
  } else if (end > len) {
    end = len
  }

  if (end < start) end = start

  var newBuf
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    newBuf = this.subarray(start, end)
    newBuf.__proto__ = Buffer.prototype
  } else {
    var sliceLen = end - start
    newBuf = new Buffer(sliceLen, undefined)
    for (var i = 0; i < sliceLen; ++i) {
      newBuf[i] = this[i + start]
    }
  }

  return newBuf
}

/*
 * Need to make sure that buffer isn't trying to write out of bounds.
 */
function checkOffset (offset, ext, length) {
  if ((offset % 1) !== 0 || offset < 0) throw new RangeError('offset is not uint')
  if (offset + ext > length) throw new RangeError('Trying to access beyond buffer length')
}

Buffer.prototype.readUIntLE = function readUIntLE (offset, byteLength, noAssert) {
  offset = offset | 0
  byteLength = byteLength | 0
  if (!noAssert) checkOffset(offset, byteLength, this.length)

  var val = this[offset]
  var mul = 1
  var i = 0
  while (++i < byteLength && (mul *= 0x100)) {
    val += this[offset + i] * mul
  }

  return val
}

Buffer.prototype.readUIntBE = function readUIntBE (offset, byteLength, noAssert) {
  offset = offset | 0
  byteLength = byteLength | 0
  if (!noAssert) {
    checkOffset(offset, byteLength, this.length)
  }

  var val = this[offset + --byteLength]
  var mul = 1
  while (byteLength > 0 && (mul *= 0x100)) {
    val += this[offset + --byteLength] * mul
  }

  return val
}

Buffer.prototype.readUInt8 = function readUInt8 (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 1, this.length)
  return this[offset]
}

Buffer.prototype.readUInt16LE = function readUInt16LE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 2, this.length)
  return this[offset] | (this[offset + 1] << 8)
}

Buffer.prototype.readUInt16BE = function readUInt16BE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 2, this.length)
  return (this[offset] << 8) | this[offset + 1]
}

Buffer.prototype.readUInt32LE = function readUInt32LE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length)

  return ((this[offset]) |
      (this[offset + 1] << 8) |
      (this[offset + 2] << 16)) +
      (this[offset + 3] * 0x1000000)
}

Buffer.prototype.readUInt32BE = function readUInt32BE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length)

  return (this[offset] * 0x1000000) +
    ((this[offset + 1] << 16) |
    (this[offset + 2] << 8) |
    this[offset + 3])
}

Buffer.prototype.readIntLE = function readIntLE (offset, byteLength, noAssert) {
  offset = offset | 0
  byteLength = byteLength | 0
  if (!noAssert) checkOffset(offset, byteLength, this.length)

  var val = this[offset]
  var mul = 1
  var i = 0
  while (++i < byteLength && (mul *= 0x100)) {
    val += this[offset + i] * mul
  }
  mul *= 0x80

  if (val >= mul) val -= Math.pow(2, 8 * byteLength)

  return val
}

Buffer.prototype.readIntBE = function readIntBE (offset, byteLength, noAssert) {
  offset = offset | 0
  byteLength = byteLength | 0
  if (!noAssert) checkOffset(offset, byteLength, this.length)

  var i = byteLength
  var mul = 1
  var val = this[offset + --i]
  while (i > 0 && (mul *= 0x100)) {
    val += this[offset + --i] * mul
  }
  mul *= 0x80

  if (val >= mul) val -= Math.pow(2, 8 * byteLength)

  return val
}

Buffer.prototype.readInt8 = function readInt8 (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 1, this.length)
  if (!(this[offset] & 0x80)) return (this[offset])
  return ((0xff - this[offset] + 1) * -1)
}

Buffer.prototype.readInt16LE = function readInt16LE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 2, this.length)
  var val = this[offset] | (this[offset + 1] << 8)
  return (val & 0x8000) ? val | 0xFFFF0000 : val
}

Buffer.prototype.readInt16BE = function readInt16BE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 2, this.length)
  var val = this[offset + 1] | (this[offset] << 8)
  return (val & 0x8000) ? val | 0xFFFF0000 : val
}

Buffer.prototype.readInt32LE = function readInt32LE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length)

  return (this[offset]) |
    (this[offset + 1] << 8) |
    (this[offset + 2] << 16) |
    (this[offset + 3] << 24)
}

Buffer.prototype.readInt32BE = function readInt32BE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length)

  return (this[offset] << 24) |
    (this[offset + 1] << 16) |
    (this[offset + 2] << 8) |
    (this[offset + 3])
}

Buffer.prototype.readFloatLE = function readFloatLE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length)
  return ieee754.read(this, offset, true, 23, 4)
}

Buffer.prototype.readFloatBE = function readFloatBE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length)
  return ieee754.read(this, offset, false, 23, 4)
}

Buffer.prototype.readDoubleLE = function readDoubleLE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 8, this.length)
  return ieee754.read(this, offset, true, 52, 8)
}

Buffer.prototype.readDoubleBE = function readDoubleBE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 8, this.length)
  return ieee754.read(this, offset, false, 52, 8)
}

function checkInt (buf, value, offset, ext, max, min) {
  if (!Buffer.isBuffer(buf)) throw new TypeError('"buffer" argument must be a Buffer instance')
  if (value > max || value < min) throw new RangeError('"value" argument is out of bounds')
  if (offset + ext > buf.length) throw new RangeError('Index out of range')
}

Buffer.prototype.writeUIntLE = function writeUIntLE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset | 0
  byteLength = byteLength | 0
  if (!noAssert) {
    var maxBytes = Math.pow(2, 8 * byteLength) - 1
    checkInt(this, value, offset, byteLength, maxBytes, 0)
  }

  var mul = 1
  var i = 0
  this[offset] = value & 0xFF
  while (++i < byteLength && (mul *= 0x100)) {
    this[offset + i] = (value / mul) & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeUIntBE = function writeUIntBE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset | 0
  byteLength = byteLength | 0
  if (!noAssert) {
    var maxBytes = Math.pow(2, 8 * byteLength) - 1
    checkInt(this, value, offset, byteLength, maxBytes, 0)
  }

  var i = byteLength - 1
  var mul = 1
  this[offset + i] = value & 0xFF
  while (--i >= 0 && (mul *= 0x100)) {
    this[offset + i] = (value / mul) & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeUInt8 = function writeUInt8 (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 1, 0xff, 0)
  if (!Buffer.TYPED_ARRAY_SUPPORT) value = Math.floor(value)
  this[offset] = (value & 0xff)
  return offset + 1
}

function objectWriteUInt16 (buf, value, offset, littleEndian) {
  if (value < 0) value = 0xffff + value + 1
  for (var i = 0, j = Math.min(buf.length - offset, 2); i < j; ++i) {
    buf[offset + i] = (value & (0xff << (8 * (littleEndian ? i : 1 - i)))) >>>
      (littleEndian ? i : 1 - i) * 8
  }
}

Buffer.prototype.writeUInt16LE = function writeUInt16LE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 2, 0xffff, 0)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value & 0xff)
    this[offset + 1] = (value >>> 8)
  } else {
    objectWriteUInt16(this, value, offset, true)
  }
  return offset + 2
}

Buffer.prototype.writeUInt16BE = function writeUInt16BE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 2, 0xffff, 0)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value >>> 8)
    this[offset + 1] = (value & 0xff)
  } else {
    objectWriteUInt16(this, value, offset, false)
  }
  return offset + 2
}

function objectWriteUInt32 (buf, value, offset, littleEndian) {
  if (value < 0) value = 0xffffffff + value + 1
  for (var i = 0, j = Math.min(buf.length - offset, 4); i < j; ++i) {
    buf[offset + i] = (value >>> (littleEndian ? i : 3 - i) * 8) & 0xff
  }
}

Buffer.prototype.writeUInt32LE = function writeUInt32LE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 4, 0xffffffff, 0)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset + 3] = (value >>> 24)
    this[offset + 2] = (value >>> 16)
    this[offset + 1] = (value >>> 8)
    this[offset] = (value & 0xff)
  } else {
    objectWriteUInt32(this, value, offset, true)
  }
  return offset + 4
}

Buffer.prototype.writeUInt32BE = function writeUInt32BE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 4, 0xffffffff, 0)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value >>> 24)
    this[offset + 1] = (value >>> 16)
    this[offset + 2] = (value >>> 8)
    this[offset + 3] = (value & 0xff)
  } else {
    objectWriteUInt32(this, value, offset, false)
  }
  return offset + 4
}

Buffer.prototype.writeIntLE = function writeIntLE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) {
    var limit = Math.pow(2, 8 * byteLength - 1)

    checkInt(this, value, offset, byteLength, limit - 1, -limit)
  }

  var i = 0
  var mul = 1
  var sub = 0
  this[offset] = value & 0xFF
  while (++i < byteLength && (mul *= 0x100)) {
    if (value < 0 && sub === 0 && this[offset + i - 1] !== 0) {
      sub = 1
    }
    this[offset + i] = ((value / mul) >> 0) - sub & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeIntBE = function writeIntBE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) {
    var limit = Math.pow(2, 8 * byteLength - 1)

    checkInt(this, value, offset, byteLength, limit - 1, -limit)
  }

  var i = byteLength - 1
  var mul = 1
  var sub = 0
  this[offset + i] = value & 0xFF
  while (--i >= 0 && (mul *= 0x100)) {
    if (value < 0 && sub === 0 && this[offset + i + 1] !== 0) {
      sub = 1
    }
    this[offset + i] = ((value / mul) >> 0) - sub & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeInt8 = function writeInt8 (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 1, 0x7f, -0x80)
  if (!Buffer.TYPED_ARRAY_SUPPORT) value = Math.floor(value)
  if (value < 0) value = 0xff + value + 1
  this[offset] = (value & 0xff)
  return offset + 1
}

Buffer.prototype.writeInt16LE = function writeInt16LE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 2, 0x7fff, -0x8000)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value & 0xff)
    this[offset + 1] = (value >>> 8)
  } else {
    objectWriteUInt16(this, value, offset, true)
  }
  return offset + 2
}

Buffer.prototype.writeInt16BE = function writeInt16BE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 2, 0x7fff, -0x8000)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value >>> 8)
    this[offset + 1] = (value & 0xff)
  } else {
    objectWriteUInt16(this, value, offset, false)
  }
  return offset + 2
}

Buffer.prototype.writeInt32LE = function writeInt32LE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value & 0xff)
    this[offset + 1] = (value >>> 8)
    this[offset + 2] = (value >>> 16)
    this[offset + 3] = (value >>> 24)
  } else {
    objectWriteUInt32(this, value, offset, true)
  }
  return offset + 4
}

Buffer.prototype.writeInt32BE = function writeInt32BE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000)
  if (value < 0) value = 0xffffffff + value + 1
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value >>> 24)
    this[offset + 1] = (value >>> 16)
    this[offset + 2] = (value >>> 8)
    this[offset + 3] = (value & 0xff)
  } else {
    objectWriteUInt32(this, value, offset, false)
  }
  return offset + 4
}

function checkIEEE754 (buf, value, offset, ext, max, min) {
  if (offset + ext > buf.length) throw new RangeError('Index out of range')
  if (offset < 0) throw new RangeError('Index out of range')
}

function writeFloat (buf, value, offset, littleEndian, noAssert) {
  if (!noAssert) {
    checkIEEE754(buf, value, offset, 4, 3.4028234663852886e+38, -3.4028234663852886e+38)
  }
  ieee754.write(buf, value, offset, littleEndian, 23, 4)
  return offset + 4
}

Buffer.prototype.writeFloatLE = function writeFloatLE (value, offset, noAssert) {
  return writeFloat(this, value, offset, true, noAssert)
}

Buffer.prototype.writeFloatBE = function writeFloatBE (value, offset, noAssert) {
  return writeFloat(this, value, offset, false, noAssert)
}

function writeDouble (buf, value, offset, littleEndian, noAssert) {
  if (!noAssert) {
    checkIEEE754(buf, value, offset, 8, 1.7976931348623157E+308, -1.7976931348623157E+308)
  }
  ieee754.write(buf, value, offset, littleEndian, 52, 8)
  return offset + 8
}

Buffer.prototype.writeDoubleLE = function writeDoubleLE (value, offset, noAssert) {
  return writeDouble(this, value, offset, true, noAssert)
}

Buffer.prototype.writeDoubleBE = function writeDoubleBE (value, offset, noAssert) {
  return writeDouble(this, value, offset, false, noAssert)
}

// copy(targetBuffer, targetStart=0, sourceStart=0, sourceEnd=buffer.length)
Buffer.prototype.copy = function copy (target, targetStart, start, end) {
  if (!start) start = 0
  if (!end && end !== 0) end = this.length
  if (targetStart >= target.length) targetStart = target.length
  if (!targetStart) targetStart = 0
  if (end > 0 && end < start) end = start

  // Copy 0 bytes; we're done
  if (end === start) return 0
  if (target.length === 0 || this.length === 0) return 0

  // Fatal error conditions
  if (targetStart < 0) {
    throw new RangeError('targetStart out of bounds')
  }
  if (start < 0 || start >= this.length) throw new RangeError('sourceStart out of bounds')
  if (end < 0) throw new RangeError('sourceEnd out of bounds')

  // Are we oob?
  if (end > this.length) end = this.length
  if (target.length - targetStart < end - start) {
    end = target.length - targetStart + start
  }

  var len = end - start
  var i

  if (this === target && start < targetStart && targetStart < end) {
    // descending copy from end
    for (i = len - 1; i >= 0; --i) {
      target[i + targetStart] = this[i + start]
    }
  } else if (len < 1000 || !Buffer.TYPED_ARRAY_SUPPORT) {
    // ascending copy from start
    for (i = 0; i < len; ++i) {
      target[i + targetStart] = this[i + start]
    }
  } else {
    Uint8Array.prototype.set.call(
      target,
      this.subarray(start, start + len),
      targetStart
    )
  }

  return len
}

// Usage:
//    buffer.fill(number[, offset[, end]])
//    buffer.fill(buffer[, offset[, end]])
//    buffer.fill(string[, offset[, end]][, encoding])
Buffer.prototype.fill = function fill (val, start, end, encoding) {
  // Handle string cases:
  if (typeof val === 'string') {
    if (typeof start === 'string') {
      encoding = start
      start = 0
      end = this.length
    } else if (typeof end === 'string') {
      encoding = end
      end = this.length
    }
    if (val.length === 1) {
      var code = val.charCodeAt(0)
      if (code < 256) {
        val = code
      }
    }
    if (encoding !== undefined && typeof encoding !== 'string') {
      throw new TypeError('encoding must be a string')
    }
    if (typeof encoding === 'string' && !Buffer.isEncoding(encoding)) {
      throw new TypeError('Unknown encoding: ' + encoding)
    }
  } else if (typeof val === 'number') {
    val = val & 255
  }

  // Invalid ranges are not set to a default, so can range check early.
  if (start < 0 || this.length < start || this.length < end) {
    throw new RangeError('Out of range index')
  }

  if (end <= start) {
    return this
  }

  start = start >>> 0
  end = end === undefined ? this.length : end >>> 0

  if (!val) val = 0

  var i
  if (typeof val === 'number') {
    for (i = start; i < end; ++i) {
      this[i] = val
    }
  } else {
    var bytes = Buffer.isBuffer(val)
      ? val
      : utf8ToBytes(new Buffer(val, encoding).toString())
    var len = bytes.length
    for (i = 0; i < end - start; ++i) {
      this[i + start] = bytes[i % len]
    }
  }

  return this
}

// HELPER FUNCTIONS
// ================

var INVALID_BASE64_RE = /[^+\/0-9A-Za-z-_]/g

function base64clean (str) {
  // Node strips out invalid characters like \n and \t from the string, base64-js does not
  str = stringtrim(str).replace(INVALID_BASE64_RE, '')
  // Node converts strings with length < 2 to ''
  if (str.length < 2) return ''
  // Node allows for non-padded base64 strings (missing trailing ===), base64-js does not
  while (str.length % 4 !== 0) {
    str = str + '='
  }
  return str
}

function stringtrim (str) {
  if (str.trim) return str.trim()
  return str.replace(/^\s+|\s+$/g, '')
}

function toHex (n) {
  if (n < 16) return '0' + n.toString(16)
  return n.toString(16)
}

function utf8ToBytes (string, units) {
  units = units || Infinity
  var codePoint
  var length = string.length
  var leadSurrogate = null
  var bytes = []

  for (var i = 0; i < length; ++i) {
    codePoint = string.charCodeAt(i)

    // is surrogate component
    if (codePoint > 0xD7FF && codePoint < 0xE000) {
      // last char was a lead
      if (!leadSurrogate) {
        // no lead yet
        if (codePoint > 0xDBFF) {
          // unexpected trail
          if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
          continue
        } else if (i + 1 === length) {
          // unpaired lead
          if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
          continue
        }

        // valid lead
        leadSurrogate = codePoint

        continue
      }

      // 2 leads in a row
      if (codePoint < 0xDC00) {
        if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
        leadSurrogate = codePoint
        continue
      }

      // valid surrogate pair
      codePoint = (leadSurrogate - 0xD800 << 10 | codePoint - 0xDC00) + 0x10000
    } else if (leadSurrogate) {
      // valid bmp char, but last char was a lead
      if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
    }

    leadSurrogate = null

    // encode utf8
    if (codePoint < 0x80) {
      if ((units -= 1) < 0) break
      bytes.push(codePoint)
    } else if (codePoint < 0x800) {
      if ((units -= 2) < 0) break
      bytes.push(
        codePoint >> 0x6 | 0xC0,
        codePoint & 0x3F | 0x80
      )
    } else if (codePoint < 0x10000) {
      if ((units -= 3) < 0) break
      bytes.push(
        codePoint >> 0xC | 0xE0,
        codePoint >> 0x6 & 0x3F | 0x80,
        codePoint & 0x3F | 0x80
      )
    } else if (codePoint < 0x110000) {
      if ((units -= 4) < 0) break
      bytes.push(
        codePoint >> 0x12 | 0xF0,
        codePoint >> 0xC & 0x3F | 0x80,
        codePoint >> 0x6 & 0x3F | 0x80,
        codePoint & 0x3F | 0x80
      )
    } else {
      throw new Error('Invalid code point')
    }
  }

  return bytes
}

function asciiToBytes (str) {
  var byteArray = []
  for (var i = 0; i < str.length; ++i) {
    // Node's code seems to be doing this and not & 0x7F..
    byteArray.push(str.charCodeAt(i) & 0xFF)
  }
  return byteArray
}

function utf16leToBytes (str, units) {
  var c, hi, lo
  var byteArray = []
  for (var i = 0; i < str.length; ++i) {
    if ((units -= 2) < 0) break

    c = str.charCodeAt(i)
    hi = c >> 8
    lo = c % 256
    byteArray.push(lo)
    byteArray.push(hi)
  }

  return byteArray
}

function base64ToBytes (str) {
  return base64.toByteArray(base64clean(str))
}

function blitBuffer (src, dst, offset, length) {
  for (var i = 0; i < length; ++i) {
    if ((i + offset >= dst.length) || (i >= src.length)) break
    dst[i + offset] = src[i]
  }
  return i
}

function isnan (val) {
  return val !== val // eslint-disable-line no-self-compare
}

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"base64-js":2,"ieee754":3,"isarray":4}],2:[function(require,module,exports){
'use strict'

exports.byteLength = byteLength
exports.toByteArray = toByteArray
exports.fromByteArray = fromByteArray

var lookup = []
var revLookup = []
var Arr = typeof Uint8Array !== 'undefined' ? Uint8Array : Array

var code = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
for (var i = 0, len = code.length; i < len; ++i) {
  lookup[i] = code[i]
  revLookup[code.charCodeAt(i)] = i
}

revLookup['-'.charCodeAt(0)] = 62
revLookup['_'.charCodeAt(0)] = 63

function placeHoldersCount (b64) {
  var len = b64.length
  if (len % 4 > 0) {
    throw new Error('Invalid string. Length must be a multiple of 4')
  }

  // the number of equal signs (place holders)
  // if there are two placeholders, than the two characters before it
  // represent one byte
  // if there is only one, then the three characters before it represent 2 bytes
  // this is just a cheap hack to not do indexOf twice
  return b64[len - 2] === '=' ? 2 : b64[len - 1] === '=' ? 1 : 0
}

function byteLength (b64) {
  // base64 is 4/3 + up to two characters of the original data
  return b64.length * 3 / 4 - placeHoldersCount(b64)
}

function toByteArray (b64) {
  var i, j, l, tmp, placeHolders, arr
  var len = b64.length
  placeHolders = placeHoldersCount(b64)

  arr = new Arr(len * 3 / 4 - placeHolders)

  // if there are placeholders, only get up to the last complete 4 chars
  l = placeHolders > 0 ? len - 4 : len

  var L = 0

  for (i = 0, j = 0; i < l; i += 4, j += 3) {
    tmp = (revLookup[b64.charCodeAt(i)] << 18) | (revLookup[b64.charCodeAt(i + 1)] << 12) | (revLookup[b64.charCodeAt(i + 2)] << 6) | revLookup[b64.charCodeAt(i + 3)]
    arr[L++] = (tmp >> 16) & 0xFF
    arr[L++] = (tmp >> 8) & 0xFF
    arr[L++] = tmp & 0xFF
  }

  if (placeHolders === 2) {
    tmp = (revLookup[b64.charCodeAt(i)] << 2) | (revLookup[b64.charCodeAt(i + 1)] >> 4)
    arr[L++] = tmp & 0xFF
  } else if (placeHolders === 1) {
    tmp = (revLookup[b64.charCodeAt(i)] << 10) | (revLookup[b64.charCodeAt(i + 1)] << 4) | (revLookup[b64.charCodeAt(i + 2)] >> 2)
    arr[L++] = (tmp >> 8) & 0xFF
    arr[L++] = tmp & 0xFF
  }

  return arr
}

function tripletToBase64 (num) {
  return lookup[num >> 18 & 0x3F] + lookup[num >> 12 & 0x3F] + lookup[num >> 6 & 0x3F] + lookup[num & 0x3F]
}

function encodeChunk (uint8, start, end) {
  var tmp
  var output = []
  for (var i = start; i < end; i += 3) {
    tmp = (uint8[i] << 16) + (uint8[i + 1] << 8) + (uint8[i + 2])
    output.push(tripletToBase64(tmp))
  }
  return output.join('')
}

function fromByteArray (uint8) {
  var tmp
  var len = uint8.length
  var extraBytes = len % 3 // if we have 1 byte left, pad 2 bytes
  var output = ''
  var parts = []
  var maxChunkLength = 16383 // must be multiple of 3

  // go through the array every three bytes, we'll deal with trailing stuff later
  for (var i = 0, len2 = len - extraBytes; i < len2; i += maxChunkLength) {
    parts.push(encodeChunk(uint8, i, (i + maxChunkLength) > len2 ? len2 : (i + maxChunkLength)))
  }

  // pad the end with zeros, but make sure to not forget the extra bytes
  if (extraBytes === 1) {
    tmp = uint8[len - 1]
    output += lookup[tmp >> 2]
    output += lookup[(tmp << 4) & 0x3F]
    output += '=='
  } else if (extraBytes === 2) {
    tmp = (uint8[len - 2] << 8) + (uint8[len - 1])
    output += lookup[tmp >> 10]
    output += lookup[(tmp >> 4) & 0x3F]
    output += lookup[(tmp << 2) & 0x3F]
    output += '='
  }

  parts.push(output)

  return parts.join('')
}

},{}],3:[function(require,module,exports){
exports.read = function (buffer, offset, isLE, mLen, nBytes) {
  var e, m
  var eLen = nBytes * 8 - mLen - 1
  var eMax = (1 << eLen) - 1
  var eBias = eMax >> 1
  var nBits = -7
  var i = isLE ? (nBytes - 1) : 0
  var d = isLE ? -1 : 1
  var s = buffer[offset + i]

  i += d

  e = s & ((1 << (-nBits)) - 1)
  s >>= (-nBits)
  nBits += eLen
  for (; nBits > 0; e = e * 256 + buffer[offset + i], i += d, nBits -= 8) {}

  m = e & ((1 << (-nBits)) - 1)
  e >>= (-nBits)
  nBits += mLen
  for (; nBits > 0; m = m * 256 + buffer[offset + i], i += d, nBits -= 8) {}

  if (e === 0) {
    e = 1 - eBias
  } else if (e === eMax) {
    return m ? NaN : ((s ? -1 : 1) * Infinity)
  } else {
    m = m + Math.pow(2, mLen)
    e = e - eBias
  }
  return (s ? -1 : 1) * m * Math.pow(2, e - mLen)
}

exports.write = function (buffer, value, offset, isLE, mLen, nBytes) {
  var e, m, c
  var eLen = nBytes * 8 - mLen - 1
  var eMax = (1 << eLen) - 1
  var eBias = eMax >> 1
  var rt = (mLen === 23 ? Math.pow(2, -24) - Math.pow(2, -77) : 0)
  var i = isLE ? 0 : (nBytes - 1)
  var d = isLE ? 1 : -1
  var s = value < 0 || (value === 0 && 1 / value < 0) ? 1 : 0

  value = Math.abs(value)

  if (isNaN(value) || value === Infinity) {
    m = isNaN(value) ? 1 : 0
    e = eMax
  } else {
    e = Math.floor(Math.log(value) / Math.LN2)
    if (value * (c = Math.pow(2, -e)) < 1) {
      e--
      c *= 2
    }
    if (e + eBias >= 1) {
      value += rt / c
    } else {
      value += rt * Math.pow(2, 1 - eBias)
    }
    if (value * c >= 2) {
      e++
      c /= 2
    }

    if (e + eBias >= eMax) {
      m = 0
      e = eMax
    } else if (e + eBias >= 1) {
      m = (value * c - 1) * Math.pow(2, mLen)
      e = e + eBias
    } else {
      m = value * Math.pow(2, eBias - 1) * Math.pow(2, mLen)
      e = 0
    }
  }

  for (; mLen >= 8; buffer[offset + i] = m & 0xff, i += d, m /= 256, mLen -= 8) {}

  e = (e << mLen) | m
  eLen += mLen
  for (; eLen > 0; buffer[offset + i] = e & 0xff, i += d, e /= 256, eLen -= 8) {}

  buffer[offset + i - d] |= s * 128
}

},{}],4:[function(require,module,exports){
var toString = {}.toString;

module.exports = Array.isArray || function (arr) {
  return toString.call(arr) == '[object Array]';
};

},{}],5:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

function EventEmitter() {
  this._events = this._events || {};
  this._maxListeners = this._maxListeners || undefined;
}
module.exports = EventEmitter;

// Backwards-compat with node 0.10.x
EventEmitter.EventEmitter = EventEmitter;

EventEmitter.prototype._events = undefined;
EventEmitter.prototype._maxListeners = undefined;

// By default EventEmitters will print a warning if more than 10 listeners are
// added to it. This is a useful default which helps finding memory leaks.
EventEmitter.defaultMaxListeners = 10;

// Obviously not all Emitters should be limited to 10. This function allows
// that to be increased. Set to zero for unlimited.
EventEmitter.prototype.setMaxListeners = function(n) {
  if (!isNumber(n) || n < 0 || isNaN(n))
    throw TypeError('n must be a positive number');
  this._maxListeners = n;
  return this;
};

EventEmitter.prototype.emit = function(type) {
  var er, handler, len, args, i, listeners;

  if (!this._events)
    this._events = {};

  // If there is no 'error' event listener then throw.
  if (type === 'error') {
    if (!this._events.error ||
        (isObject(this._events.error) && !this._events.error.length)) {
      er = arguments[1];
      if (er instanceof Error) {
        throw er; // Unhandled 'error' event
      } else {
        // At least give some kind of context to the user
        var err = new Error('Uncaught, unspecified "error" event. (' + er + ')');
        err.context = er;
        throw err;
      }
    }
  }

  handler = this._events[type];

  if (isUndefined(handler))
    return false;

  if (isFunction(handler)) {
    switch (arguments.length) {
      // fast cases
      case 1:
        handler.call(this);
        break;
      case 2:
        handler.call(this, arguments[1]);
        break;
      case 3:
        handler.call(this, arguments[1], arguments[2]);
        break;
      // slower
      default:
        args = Array.prototype.slice.call(arguments, 1);
        handler.apply(this, args);
    }
  } else if (isObject(handler)) {
    args = Array.prototype.slice.call(arguments, 1);
    listeners = handler.slice();
    len = listeners.length;
    for (i = 0; i < len; i++)
      listeners[i].apply(this, args);
  }

  return true;
};

EventEmitter.prototype.addListener = function(type, listener) {
  var m;

  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  if (!this._events)
    this._events = {};

  // To avoid recursion in the case that type === "newListener"! Before
  // adding it to the listeners, first emit "newListener".
  if (this._events.newListener)
    this.emit('newListener', type,
              isFunction(listener.listener) ?
              listener.listener : listener);

  if (!this._events[type])
    // Optimize the case of one listener. Don't need the extra array object.
    this._events[type] = listener;
  else if (isObject(this._events[type]))
    // If we've already got an array, just append.
    this._events[type].push(listener);
  else
    // Adding the second element, need to change to array.
    this._events[type] = [this._events[type], listener];

  // Check for listener leak
  if (isObject(this._events[type]) && !this._events[type].warned) {
    if (!isUndefined(this._maxListeners)) {
      m = this._maxListeners;
    } else {
      m = EventEmitter.defaultMaxListeners;
    }

    if (m && m > 0 && this._events[type].length > m) {
      this._events[type].warned = true;
      console.error('(node) warning: possible EventEmitter memory ' +
                    'leak detected. %d listeners added. ' +
                    'Use emitter.setMaxListeners() to increase limit.',
                    this._events[type].length);
      if (typeof console.trace === 'function') {
        // not supported in IE 10
        console.trace();
      }
    }
  }

  return this;
};

EventEmitter.prototype.on = EventEmitter.prototype.addListener;

EventEmitter.prototype.once = function(type, listener) {
  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  var fired = false;

  function g() {
    this.removeListener(type, g);

    if (!fired) {
      fired = true;
      listener.apply(this, arguments);
    }
  }

  g.listener = listener;
  this.on(type, g);

  return this;
};

// emits a 'removeListener' event iff the listener was removed
EventEmitter.prototype.removeListener = function(type, listener) {
  var list, position, length, i;

  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  if (!this._events || !this._events[type])
    return this;

  list = this._events[type];
  length = list.length;
  position = -1;

  if (list === listener ||
      (isFunction(list.listener) && list.listener === listener)) {
    delete this._events[type];
    if (this._events.removeListener)
      this.emit('removeListener', type, listener);

  } else if (isObject(list)) {
    for (i = length; i-- > 0;) {
      if (list[i] === listener ||
          (list[i].listener && list[i].listener === listener)) {
        position = i;
        break;
      }
    }

    if (position < 0)
      return this;

    if (list.length === 1) {
      list.length = 0;
      delete this._events[type];
    } else {
      list.splice(position, 1);
    }

    if (this._events.removeListener)
      this.emit('removeListener', type, listener);
  }

  return this;
};

EventEmitter.prototype.removeAllListeners = function(type) {
  var key, listeners;

  if (!this._events)
    return this;

  // not listening for removeListener, no need to emit
  if (!this._events.removeListener) {
    if (arguments.length === 0)
      this._events = {};
    else if (this._events[type])
      delete this._events[type];
    return this;
  }

  // emit removeListener for all listeners on all events
  if (arguments.length === 0) {
    for (key in this._events) {
      if (key === 'removeListener') continue;
      this.removeAllListeners(key);
    }
    this.removeAllListeners('removeListener');
    this._events = {};
    return this;
  }

  listeners = this._events[type];

  if (isFunction(listeners)) {
    this.removeListener(type, listeners);
  } else if (listeners) {
    // LIFO order
    while (listeners.length)
      this.removeListener(type, listeners[listeners.length - 1]);
  }
  delete this._events[type];

  return this;
};

EventEmitter.prototype.listeners = function(type) {
  var ret;
  if (!this._events || !this._events[type])
    ret = [];
  else if (isFunction(this._events[type]))
    ret = [this._events[type]];
  else
    ret = this._events[type].slice();
  return ret;
};

EventEmitter.prototype.listenerCount = function(type) {
  if (this._events) {
    var evlistener = this._events[type];

    if (isFunction(evlistener))
      return 1;
    else if (evlistener)
      return evlistener.length;
  }
  return 0;
};

EventEmitter.listenerCount = function(emitter, type) {
  return emitter.listenerCount(type);
};

function isFunction(arg) {
  return typeof arg === 'function';
}

function isNumber(arg) {
  return typeof arg === 'number';
}

function isObject(arg) {
  return typeof arg === 'object' && arg !== null;
}

function isUndefined(arg) {
  return arg === void 0;
}

},{}],6:[function(require,module,exports){
// shim for using process in browser
var process = module.exports = {};

// cached from whatever global is present so that test runners that stub it
// don't break things.  But we need to wrap it in a try catch in case it is
// wrapped in strict mode code which doesn't define any globals.  It's inside a
// function because try/catches deoptimize in certain engines.

var cachedSetTimeout;
var cachedClearTimeout;

function defaultSetTimout() {
    throw new Error('setTimeout has not been defined');
}
function defaultClearTimeout () {
    throw new Error('clearTimeout has not been defined');
}
(function () {
    try {
        if (typeof setTimeout === 'function') {
            cachedSetTimeout = setTimeout;
        } else {
            cachedSetTimeout = defaultSetTimout;
        }
    } catch (e) {
        cachedSetTimeout = defaultSetTimout;
    }
    try {
        if (typeof clearTimeout === 'function') {
            cachedClearTimeout = clearTimeout;
        } else {
            cachedClearTimeout = defaultClearTimeout;
        }
    } catch (e) {
        cachedClearTimeout = defaultClearTimeout;
    }
} ())
function runTimeout(fun) {
    if (cachedSetTimeout === setTimeout) {
        //normal enviroments in sane situations
        return setTimeout(fun, 0);
    }
    // if setTimeout wasn't available but was latter defined
    if ((cachedSetTimeout === defaultSetTimout || !cachedSetTimeout) && setTimeout) {
        cachedSetTimeout = setTimeout;
        return setTimeout(fun, 0);
    }
    try {
        // when when somebody has screwed with setTimeout but no I.E. maddness
        return cachedSetTimeout(fun, 0);
    } catch(e){
        try {
            // When we are in I.E. but the script has been evaled so I.E. doesn't trust the global object when called normally
            return cachedSetTimeout.call(null, fun, 0);
        } catch(e){
            // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error
            return cachedSetTimeout.call(this, fun, 0);
        }
    }


}
function runClearTimeout(marker) {
    if (cachedClearTimeout === clearTimeout) {
        //normal enviroments in sane situations
        return clearTimeout(marker);
    }
    // if clearTimeout wasn't available but was latter defined
    if ((cachedClearTimeout === defaultClearTimeout || !cachedClearTimeout) && clearTimeout) {
        cachedClearTimeout = clearTimeout;
        return clearTimeout(marker);
    }
    try {
        // when when somebody has screwed with setTimeout but no I.E. maddness
        return cachedClearTimeout(marker);
    } catch (e){
        try {
            // When we are in I.E. but the script has been evaled so I.E. doesn't  trust the global object when called normally
            return cachedClearTimeout.call(null, marker);
        } catch (e){
            // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error.
            // Some versions of I.E. have different rules for clearTimeout vs setTimeout
            return cachedClearTimeout.call(this, marker);
        }
    }



}
var queue = [];
var draining = false;
var currentQueue;
var queueIndex = -1;

function cleanUpNextTick() {
    if (!draining || !currentQueue) {
        return;
    }
    draining = false;
    if (currentQueue.length) {
        queue = currentQueue.concat(queue);
    } else {
        queueIndex = -1;
    }
    if (queue.length) {
        drainQueue();
    }
}

function drainQueue() {
    if (draining) {
        return;
    }
    var timeout = runTimeout(cleanUpNextTick);
    draining = true;

    var len = queue.length;
    while(len) {
        currentQueue = queue;
        queue = [];
        while (++queueIndex < len) {
            if (currentQueue) {
                currentQueue[queueIndex].run();
            }
        }
        queueIndex = -1;
        len = queue.length;
    }
    currentQueue = null;
    draining = false;
    runClearTimeout(timeout);
}

process.nextTick = function (fun) {
    var args = new Array(arguments.length - 1);
    if (arguments.length > 1) {
        for (var i = 1; i < arguments.length; i++) {
            args[i - 1] = arguments[i];
        }
    }
    queue.push(new Item(fun, args));
    if (queue.length === 1 && !draining) {
        runTimeout(drainQueue);
    }
};

// v8 likes predictible objects
function Item(fun, array) {
    this.fun = fun;
    this.array = array;
}
Item.prototype.run = function () {
    this.fun.apply(null, this.array);
};
process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];
process.version = ''; // empty string to avoid regexp issues
process.versions = {};

function noop() {}

process.on = noop;
process.addListener = noop;
process.once = noop;
process.off = noop;
process.removeListener = noop;
process.removeAllListeners = noop;
process.emit = noop;

process.binding = function (name) {
    throw new Error('process.binding is not supported');
};

process.cwd = function () { return '/' };
process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
};
process.umask = function() { return 0; };

},{}],7:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

var Buffer = require('buffer').Buffer;

var isBufferEncoding = Buffer.isEncoding
  || function(encoding) {
       switch (encoding && encoding.toLowerCase()) {
         case 'hex': case 'utf8': case 'utf-8': case 'ascii': case 'binary': case 'base64': case 'ucs2': case 'ucs-2': case 'utf16le': case 'utf-16le': case 'raw': return true;
         default: return false;
       }
     }


function assertEncoding(encoding) {
  if (encoding && !isBufferEncoding(encoding)) {
    throw new Error('Unknown encoding: ' + encoding);
  }
}

// StringDecoder provides an interface for efficiently splitting a series of
// buffers into a series of JS strings without breaking apart multi-byte
// characters. CESU-8 is handled as part of the UTF-8 encoding.
//
// @TODO Handling all encodings inside a single object makes it very difficult
// to reason about this code, so it should be split up in the future.
// @TODO There should be a utf8-strict encoding that rejects invalid UTF-8 code
// points as used by CESU-8.
var StringDecoder = exports.StringDecoder = function(encoding) {
  this.encoding = (encoding || 'utf8').toLowerCase().replace(/[-_]/, '');
  assertEncoding(encoding);
  switch (this.encoding) {
    case 'utf8':
      // CESU-8 represents each of Surrogate Pair by 3-bytes
      this.surrogateSize = 3;
      break;
    case 'ucs2':
    case 'utf16le':
      // UTF-16 represents each of Surrogate Pair by 2-bytes
      this.surrogateSize = 2;
      this.detectIncompleteChar = utf16DetectIncompleteChar;
      break;
    case 'base64':
      // Base-64 stores 3 bytes in 4 chars, and pads the remainder.
      this.surrogateSize = 3;
      this.detectIncompleteChar = base64DetectIncompleteChar;
      break;
    default:
      this.write = passThroughWrite;
      return;
  }

  // Enough space to store all bytes of a single character. UTF-8 needs 4
  // bytes, but CESU-8 may require up to 6 (3 bytes per surrogate).
  this.charBuffer = new Buffer(6);
  // Number of bytes received for the current incomplete multi-byte character.
  this.charReceived = 0;
  // Number of bytes expected for the current incomplete multi-byte character.
  this.charLength = 0;
};


// write decodes the given buffer and returns it as JS string that is
// guaranteed to not contain any partial multi-byte characters. Any partial
// character found at the end of the buffer is buffered up, and will be
// returned when calling write again with the remaining bytes.
//
// Note: Converting a Buffer containing an orphan surrogate to a String
// currently works, but converting a String to a Buffer (via `new Buffer`, or
// Buffer#write) will replace incomplete surrogates with the unicode
// replacement character. See https://codereview.chromium.org/121173009/ .
StringDecoder.prototype.write = function(buffer) {
  var charStr = '';
  // if our last write ended with an incomplete multibyte character
  while (this.charLength) {
    // determine how many remaining bytes this buffer has to offer for this char
    var available = (buffer.length >= this.charLength - this.charReceived) ?
        this.charLength - this.charReceived :
        buffer.length;

    // add the new bytes to the char buffer
    buffer.copy(this.charBuffer, this.charReceived, 0, available);
    this.charReceived += available;

    if (this.charReceived < this.charLength) {
      // still not enough chars in this buffer? wait for more ...
      return '';
    }

    // remove bytes belonging to the current character from the buffer
    buffer = buffer.slice(available, buffer.length);

    // get the character that was split
    charStr = this.charBuffer.slice(0, this.charLength).toString(this.encoding);

    // CESU-8: lead surrogate (D800-DBFF) is also the incomplete character
    var charCode = charStr.charCodeAt(charStr.length - 1);
    if (charCode >= 0xD800 && charCode <= 0xDBFF) {
      this.charLength += this.surrogateSize;
      charStr = '';
      continue;
    }
    this.charReceived = this.charLength = 0;

    // if there are no more bytes in this buffer, just emit our char
    if (buffer.length === 0) {
      return charStr;
    }
    break;
  }

  // determine and set charLength / charReceived
  this.detectIncompleteChar(buffer);

  var end = buffer.length;
  if (this.charLength) {
    // buffer the incomplete character bytes we got
    buffer.copy(this.charBuffer, 0, buffer.length - this.charReceived, end);
    end -= this.charReceived;
  }

  charStr += buffer.toString(this.encoding, 0, end);

  var end = charStr.length - 1;
  var charCode = charStr.charCodeAt(end);
  // CESU-8: lead surrogate (D800-DBFF) is also the incomplete character
  if (charCode >= 0xD800 && charCode <= 0xDBFF) {
    var size = this.surrogateSize;
    this.charLength += size;
    this.charReceived += size;
    this.charBuffer.copy(this.charBuffer, size, 0, size);
    buffer.copy(this.charBuffer, 0, 0, size);
    return charStr.substring(0, end);
  }

  // or just emit the charStr
  return charStr;
};

// detectIncompleteChar determines if there is an incomplete UTF-8 character at
// the end of the given buffer. If so, it sets this.charLength to the byte
// length that character, and sets this.charReceived to the number of bytes
// that are available for this character.
StringDecoder.prototype.detectIncompleteChar = function(buffer) {
  // determine how many bytes we have to check at the end of this buffer
  var i = (buffer.length >= 3) ? 3 : buffer.length;

  // Figure out if one of the last i bytes of our buffer announces an
  // incomplete char.
  for (; i > 0; i--) {
    var c = buffer[buffer.length - i];

    // See http://en.wikipedia.org/wiki/UTF-8#Description

    // 110XXXXX
    if (i == 1 && c >> 5 == 0x06) {
      this.charLength = 2;
      break;
    }

    // 1110XXXX
    if (i <= 2 && c >> 4 == 0x0E) {
      this.charLength = 3;
      break;
    }

    // 11110XXX
    if (i <= 3 && c >> 3 == 0x1E) {
      this.charLength = 4;
      break;
    }
  }
  this.charReceived = i;
};

StringDecoder.prototype.end = function(buffer) {
  var res = '';
  if (buffer && buffer.length)
    res = this.write(buffer);

  if (this.charReceived) {
    var cr = this.charReceived;
    var buf = this.charBuffer;
    var enc = this.encoding;
    res += buf.slice(0, cr).toString(enc);
  }

  return res;
};

function passThroughWrite(buffer) {
  return buffer.toString(this.encoding);
}

function utf16DetectIncompleteChar(buffer) {
  this.charReceived = buffer.length % 2;
  this.charLength = this.charReceived ? 2 : 0;
}

function base64DetectIncompleteChar(buffer) {
  this.charReceived = buffer.length % 3;
  this.charLength = this.charReceived ? 3 : 0;
}

},{"buffer":1}],8:[function(require,module,exports){
if (typeof Object.create === 'function') {
  // implementation from standard node.js 'util' module
  module.exports = function inherits(ctor, superCtor) {
    ctor.super_ = superCtor
    ctor.prototype = Object.create(superCtor.prototype, {
      constructor: {
        value: ctor,
        enumerable: false,
        writable: true,
        configurable: true
      }
    });
  };
} else {
  // old school shim for old browsers
  module.exports = function inherits(ctor, superCtor) {
    ctor.super_ = superCtor
    var TempCtor = function () {}
    TempCtor.prototype = superCtor.prototype
    ctor.prototype = new TempCtor()
    ctor.prototype.constructor = ctor
  }
}

},{}],9:[function(require,module,exports){
module.exports = function isBuffer(arg) {
  return arg && typeof arg === 'object'
    && typeof arg.copy === 'function'
    && typeof arg.fill === 'function'
    && typeof arg.readUInt8 === 'function';
}
},{}],10:[function(require,module,exports){
(function (process,global){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

var formatRegExp = /%[sdj%]/g;
exports.format = function(f) {
  if (!isString(f)) {
    var objects = [];
    for (var i = 0; i < arguments.length; i++) {
      objects.push(inspect(arguments[i]));
    }
    return objects.join(' ');
  }

  var i = 1;
  var args = arguments;
  var len = args.length;
  var str = String(f).replace(formatRegExp, function(x) {
    if (x === '%%') return '%';
    if (i >= len) return x;
    switch (x) {
      case '%s': return String(args[i++]);
      case '%d': return Number(args[i++]);
      case '%j':
        try {
          return JSON.stringify(args[i++]);
        } catch (_) {
          return '[Circular]';
        }
      default:
        return x;
    }
  });
  for (var x = args[i]; i < len; x = args[++i]) {
    if (isNull(x) || !isObject(x)) {
      str += ' ' + x;
    } else {
      str += ' ' + inspect(x);
    }
  }
  return str;
};


// Mark that a method should not be used.
// Returns a modified function which warns once by default.
// If --no-deprecation is set, then it is a no-op.
exports.deprecate = function(fn, msg) {
  // Allow for deprecating things in the process of starting up.
  if (isUndefined(global.process)) {
    return function() {
      return exports.deprecate(fn, msg).apply(this, arguments);
    };
  }

  if (process.noDeprecation === true) {
    return fn;
  }

  var warned = false;
  function deprecated() {
    if (!warned) {
      if (process.throwDeprecation) {
        throw new Error(msg);
      } else if (process.traceDeprecation) {
        console.trace(msg);
      } else {
        console.error(msg);
      }
      warned = true;
    }
    return fn.apply(this, arguments);
  }

  return deprecated;
};


var debugs = {};
var debugEnviron;
exports.debuglog = function(set) {
  if (isUndefined(debugEnviron))
    debugEnviron = process.env.NODE_DEBUG || '';
  set = set.toUpperCase();
  if (!debugs[set]) {
    if (new RegExp('\\b' + set + '\\b', 'i').test(debugEnviron)) {
      var pid = process.pid;
      debugs[set] = function() {
        var msg = exports.format.apply(exports, arguments);
        console.error('%s %d: %s', set, pid, msg);
      };
    } else {
      debugs[set] = function() {};
    }
  }
  return debugs[set];
};


/**
 * Echos the value of a value. Trys to print the value out
 * in the best way possible given the different types.
 *
 * @param {Object} obj The object to print out.
 * @param {Object} opts Optional options object that alters the output.
 */
/* legacy: obj, showHidden, depth, colors*/
function inspect(obj, opts) {
  // default options
  var ctx = {
    seen: [],
    stylize: stylizeNoColor
  };
  // legacy...
  if (arguments.length >= 3) ctx.depth = arguments[2];
  if (arguments.length >= 4) ctx.colors = arguments[3];
  if (isBoolean(opts)) {
    // legacy...
    ctx.showHidden = opts;
  } else if (opts) {
    // got an "options" object
    exports._extend(ctx, opts);
  }
  // set default options
  if (isUndefined(ctx.showHidden)) ctx.showHidden = false;
  if (isUndefined(ctx.depth)) ctx.depth = 2;
  if (isUndefined(ctx.colors)) ctx.colors = false;
  if (isUndefined(ctx.customInspect)) ctx.customInspect = true;
  if (ctx.colors) ctx.stylize = stylizeWithColor;
  return formatValue(ctx, obj, ctx.depth);
}
exports.inspect = inspect;


// http://en.wikipedia.org/wiki/ANSI_escape_code#graphics
inspect.colors = {
  'bold' : [1, 22],
  'italic' : [3, 23],
  'underline' : [4, 24],
  'inverse' : [7, 27],
  'white' : [37, 39],
  'grey' : [90, 39],
  'black' : [30, 39],
  'blue' : [34, 39],
  'cyan' : [36, 39],
  'green' : [32, 39],
  'magenta' : [35, 39],
  'red' : [31, 39],
  'yellow' : [33, 39]
};

// Don't use 'blue' not visible on cmd.exe
inspect.styles = {
  'special': 'cyan',
  'number': 'yellow',
  'boolean': 'yellow',
  'undefined': 'grey',
  'null': 'bold',
  'string': 'green',
  'date': 'magenta',
  // "name": intentionally not styling
  'regexp': 'red'
};


function stylizeWithColor(str, styleType) {
  var style = inspect.styles[styleType];

  if (style) {
    return '\u001b[' + inspect.colors[style][0] + 'm' + str +
           '\u001b[' + inspect.colors[style][1] + 'm';
  } else {
    return str;
  }
}


function stylizeNoColor(str, styleType) {
  return str;
}


function arrayToHash(array) {
  var hash = {};

  array.forEach(function(val, idx) {
    hash[val] = true;
  });

  return hash;
}


function formatValue(ctx, value, recurseTimes) {
  // Provide a hook for user-specified inspect functions.
  // Check that value is an object with an inspect function on it
  if (ctx.customInspect &&
      value &&
      isFunction(value.inspect) &&
      // Filter out the util module, it's inspect function is special
      value.inspect !== exports.inspect &&
      // Also filter out any prototype objects using the circular check.
      !(value.constructor && value.constructor.prototype === value)) {
    var ret = value.inspect(recurseTimes, ctx);
    if (!isString(ret)) {
      ret = formatValue(ctx, ret, recurseTimes);
    }
    return ret;
  }

  // Primitive types cannot have properties
  var primitive = formatPrimitive(ctx, value);
  if (primitive) {
    return primitive;
  }

  // Look up the keys of the object.
  var keys = Object.keys(value);
  var visibleKeys = arrayToHash(keys);

  if (ctx.showHidden) {
    keys = Object.getOwnPropertyNames(value);
  }

  // IE doesn't make error fields non-enumerable
  // http://msdn.microsoft.com/en-us/library/ie/dww52sbt(v=vs.94).aspx
  if (isError(value)
      && (keys.indexOf('message') >= 0 || keys.indexOf('description') >= 0)) {
    return formatError(value);
  }

  // Some type of object without properties can be shortcutted.
  if (keys.length === 0) {
    if (isFunction(value)) {
      var name = value.name ? ': ' + value.name : '';
      return ctx.stylize('[Function' + name + ']', 'special');
    }
    if (isRegExp(value)) {
      return ctx.stylize(RegExp.prototype.toString.call(value), 'regexp');
    }
    if (isDate(value)) {
      return ctx.stylize(Date.prototype.toString.call(value), 'date');
    }
    if (isError(value)) {
      return formatError(value);
    }
  }

  var base = '', array = false, braces = ['{', '}'];

  // Make Array say that they are Array
  if (isArray(value)) {
    array = true;
    braces = ['[', ']'];
  }

  // Make functions say that they are functions
  if (isFunction(value)) {
    var n = value.name ? ': ' + value.name : '';
    base = ' [Function' + n + ']';
  }

  // Make RegExps say that they are RegExps
  if (isRegExp(value)) {
    base = ' ' + RegExp.prototype.toString.call(value);
  }

  // Make dates with properties first say the date
  if (isDate(value)) {
    base = ' ' + Date.prototype.toUTCString.call(value);
  }

  // Make error with message first say the error
  if (isError(value)) {
    base = ' ' + formatError(value);
  }

  if (keys.length === 0 && (!array || value.length == 0)) {
    return braces[0] + base + braces[1];
  }

  if (recurseTimes < 0) {
    if (isRegExp(value)) {
      return ctx.stylize(RegExp.prototype.toString.call(value), 'regexp');
    } else {
      return ctx.stylize('[Object]', 'special');
    }
  }

  ctx.seen.push(value);

  var output;
  if (array) {
    output = formatArray(ctx, value, recurseTimes, visibleKeys, keys);
  } else {
    output = keys.map(function(key) {
      return formatProperty(ctx, value, recurseTimes, visibleKeys, key, array);
    });
  }

  ctx.seen.pop();

  return reduceToSingleString(output, base, braces);
}


function formatPrimitive(ctx, value) {
  if (isUndefined(value))
    return ctx.stylize('undefined', 'undefined');
  if (isString(value)) {
    var simple = '\'' + JSON.stringify(value).replace(/^"|"$/g, '')
                                             .replace(/'/g, "\\'")
                                             .replace(/\\"/g, '"') + '\'';
    return ctx.stylize(simple, 'string');
  }
  if (isNumber(value))
    return ctx.stylize('' + value, 'number');
  if (isBoolean(value))
    return ctx.stylize('' + value, 'boolean');
  // For some reason typeof null is "object", so special case here.
  if (isNull(value))
    return ctx.stylize('null', 'null');
}


function formatError(value) {
  return '[' + Error.prototype.toString.call(value) + ']';
}


function formatArray(ctx, value, recurseTimes, visibleKeys, keys) {
  var output = [];
  for (var i = 0, l = value.length; i < l; ++i) {
    if (hasOwnProperty(value, String(i))) {
      output.push(formatProperty(ctx, value, recurseTimes, visibleKeys,
          String(i), true));
    } else {
      output.push('');
    }
  }
  keys.forEach(function(key) {
    if (!key.match(/^\d+$/)) {
      output.push(formatProperty(ctx, value, recurseTimes, visibleKeys,
          key, true));
    }
  });
  return output;
}


function formatProperty(ctx, value, recurseTimes, visibleKeys, key, array) {
  var name, str, desc;
  desc = Object.getOwnPropertyDescriptor(value, key) || { value: value[key] };
  if (desc.get) {
    if (desc.set) {
      str = ctx.stylize('[Getter/Setter]', 'special');
    } else {
      str = ctx.stylize('[Getter]', 'special');
    }
  } else {
    if (desc.set) {
      str = ctx.stylize('[Setter]', 'special');
    }
  }
  if (!hasOwnProperty(visibleKeys, key)) {
    name = '[' + key + ']';
  }
  if (!str) {
    if (ctx.seen.indexOf(desc.value) < 0) {
      if (isNull(recurseTimes)) {
        str = formatValue(ctx, desc.value, null);
      } else {
        str = formatValue(ctx, desc.value, recurseTimes - 1);
      }
      if (str.indexOf('\n') > -1) {
        if (array) {
          str = str.split('\n').map(function(line) {
            return '  ' + line;
          }).join('\n').substr(2);
        } else {
          str = '\n' + str.split('\n').map(function(line) {
            return '   ' + line;
          }).join('\n');
        }
      }
    } else {
      str = ctx.stylize('[Circular]', 'special');
    }
  }
  if (isUndefined(name)) {
    if (array && key.match(/^\d+$/)) {
      return str;
    }
    name = JSON.stringify('' + key);
    if (name.match(/^"([a-zA-Z_][a-zA-Z_0-9]*)"$/)) {
      name = name.substr(1, name.length - 2);
      name = ctx.stylize(name, 'name');
    } else {
      name = name.replace(/'/g, "\\'")
                 .replace(/\\"/g, '"')
                 .replace(/(^"|"$)/g, "'");
      name = ctx.stylize(name, 'string');
    }
  }

  return name + ': ' + str;
}


function reduceToSingleString(output, base, braces) {
  var numLinesEst = 0;
  var length = output.reduce(function(prev, cur) {
    numLinesEst++;
    if (cur.indexOf('\n') >= 0) numLinesEst++;
    return prev + cur.replace(/\u001b\[\d\d?m/g, '').length + 1;
  }, 0);

  if (length > 60) {
    return braces[0] +
           (base === '' ? '' : base + '\n ') +
           ' ' +
           output.join(',\n  ') +
           ' ' +
           braces[1];
  }

  return braces[0] + base + ' ' + output.join(', ') + ' ' + braces[1];
}


// NOTE: These type checking functions intentionally don't use `instanceof`
// because it is fragile and can be easily faked with `Object.create()`.
function isArray(ar) {
  return Array.isArray(ar);
}
exports.isArray = isArray;

function isBoolean(arg) {
  return typeof arg === 'boolean';
}
exports.isBoolean = isBoolean;

function isNull(arg) {
  return arg === null;
}
exports.isNull = isNull;

function isNullOrUndefined(arg) {
  return arg == null;
}
exports.isNullOrUndefined = isNullOrUndefined;

function isNumber(arg) {
  return typeof arg === 'number';
}
exports.isNumber = isNumber;

function isString(arg) {
  return typeof arg === 'string';
}
exports.isString = isString;

function isSymbol(arg) {
  return typeof arg === 'symbol';
}
exports.isSymbol = isSymbol;

function isUndefined(arg) {
  return arg === void 0;
}
exports.isUndefined = isUndefined;

function isRegExp(re) {
  return isObject(re) && objectToString(re) === '[object RegExp]';
}
exports.isRegExp = isRegExp;

function isObject(arg) {
  return typeof arg === 'object' && arg !== null;
}
exports.isObject = isObject;

function isDate(d) {
  return isObject(d) && objectToString(d) === '[object Date]';
}
exports.isDate = isDate;

function isError(e) {
  return isObject(e) &&
      (objectToString(e) === '[object Error]' || e instanceof Error);
}
exports.isError = isError;

function isFunction(arg) {
  return typeof arg === 'function';
}
exports.isFunction = isFunction;

function isPrimitive(arg) {
  return arg === null ||
         typeof arg === 'boolean' ||
         typeof arg === 'number' ||
         typeof arg === 'string' ||
         typeof arg === 'symbol' ||  // ES6 symbol
         typeof arg === 'undefined';
}
exports.isPrimitive = isPrimitive;

exports.isBuffer = require('./support/isBuffer');

function objectToString(o) {
  return Object.prototype.toString.call(o);
}


function pad(n) {
  return n < 10 ? '0' + n.toString(10) : n.toString(10);
}


var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep',
              'Oct', 'Nov', 'Dec'];

// 26 Feb 16:19:34
function timestamp() {
  var d = new Date();
  var time = [pad(d.getHours()),
              pad(d.getMinutes()),
              pad(d.getSeconds())].join(':');
  return [d.getDate(), months[d.getMonth()], time].join(' ');
}


// log is just a thin wrapper to console.log that prepends a timestamp
exports.log = function() {
  console.log('%s - %s', timestamp(), exports.format.apply(exports, arguments));
};


/**
 * Inherit the prototype methods from one constructor into another.
 *
 * The Function.prototype.inherits from lang.js rewritten as a standalone
 * function (not on Function.prototype). NOTE: If this file is to be loaded
 * during bootstrapping this function needs to be rewritten using some native
 * functions as prototype setup using normal JavaScript does not work as
 * expected during bootstrapping (see mirror.js in r114903).
 *
 * @param {function} ctor Constructor function which needs to inherit the
 *     prototype.
 * @param {function} superCtor Constructor function to inherit prototype from.
 */
exports.inherits = require('inherits');

exports._extend = function(origin, add) {
  // Don't do anything if add isn't an object
  if (!add || !isObject(add)) return origin;

  var keys = Object.keys(add);
  var i = keys.length;
  while (i--) {
    origin[keys[i]] = add[keys[i]];
  }
  return origin;
};

function hasOwnProperty(obj, prop) {
  return Object.prototype.hasOwnProperty.call(obj, prop);
}

}).call(this,require('_process'),typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"./support/isBuffer":9,"_process":6,"inherits":8}],11:[function(require,module,exports){
(function (process,global){
/**
 * Highland: the high-level streams library
 *
 * Highland may be freely distributed under the Apache 2.0 license.
 * http://github.com/caolan/highland
 * Copyright (c) Caolan McMahon
 *
 */


var inherits = require('util').inherits;
var deprecate = require('util-deprecate');
var EventEmitter = require('events').EventEmitter;
var Decoder = require('string_decoder').StringDecoder;

/**
 * The Stream constructor, accepts an array of values or a generator function
 * as an optional argument. This is typically the entry point to the Highland
 * APIs, providing a convenient way of chaining calls together.
 *
 * **Arrays -** Streams created from Arrays will emit each value of the Array
 * and then emit a [nil](#nil) value to signal the end of the Stream.
 *
 * **Generators -** These are functions which provide values for the Stream.
 * They are lazy and can be infinite, they can also be asynchronous (for
 * example, making a HTTP request). You emit values on the Stream by calling
 * `push(err, val)`, much like a standard Node.js callback. Once it has been
 * called, the generator function will not be called again unless you call
 * `next()`. This call to `next()` will signal you've finished processing the
 * current data and allow for the generator function to be called again. If the
 * Stream is still being consumed the generator function will then be called
 * again.
 *
 * You can also redirect a generator Stream by passing a new source Stream
 * to read from to next. For example: `next(other_stream)` - then any subsequent
 * calls will be made to the new source.
 *
 * **Node Readable Stream -** Pass in a Node Readable Stream object to wrap
 * it with the Highland API. Reading from the resulting Highland Stream will
 * begin piping the data from the Node Stream to the Highland Stream.
 *
 * A stream constructed in this way relies on `Readable#pipe` to end the
 * Highland Stream once there is no more data. Not all Readable Streams do
 * this. For example, `IncomingMessage` will only emit `close` when the client
 * aborts communications and will *not* properly call `end`. In this case, you
 * can provide an optional `onFinished` function with the signature
 * `onFinished(readable, callback)` as the second argument.
 *
 * This function will be passed the Readable and a callback that should called
 * when the Readable ends. If the Readable ended from an error, the error
 * should be passed as the first argument to the callback. `onFinished` should
 * bind to whatever listener is necessary to detect the Readable's completion.
 * If the callback is called multiple times, only the first invocation counts.
 * If the callback is called *after* the Readable has already ended (e.g., the
 * `pipe` method already called `end`), it will be ignored.
 *
 * The `onFinished` function may optionally return one of the following:
 *
 * - A cleanup function that will be called when the stream ends. It should
 * unbind any listeners that were added.
 * - An object with the following optional properties:
 *    - `onDestroy` - the cleanup function.
 *    - `continueOnError` - Whether or not to continue the stream when an
 *      error is passed to the callback. Set this to `true` if the Readable
 *      may continue to emit values after errors. Default: `false`.
 *
 * See [this issue](https://github.com/caolan/highland/issues/490) for a
 * discussion on why Highland cannot reliably detect stream completion for
 * all implementations and why the `onFinished` function is required.
 *
 * **EventEmitter / jQuery Elements -** Pass in both an event name and an
 * event emitter as the two arguments to the constructor and the first
 * argument emitted to the event handler will be written to the new Stream.
 *
 * You can pass a mapping hint as the third argument, which specifies how
 * event arguments are pushed into the stream. If no mapping hint is provided,
 * only the first value emitted with the event to the will be pushed onto the
 * Stream.
 *
 * If `mappingHint` is a number, an array of that length will be pushed onto
 * the stream, containing exactly that many parameters from the event. If it's
 * an array, it's used as keys to map the arguments into an object which is
 * pushed to the tream. If it is a function, it's called with the event
 * arguments, and the returned value is pushed.
 *
 * **Promise -** Accepts an ES6 / jQuery style promise and returns a
 * Highland Stream which will emit a single value (or an error). In case you use
 * [bluebird cancellation](http://bluebirdjs.com/docs/api/cancellation.html) Highland Stream will be empty for a cancelled promise.
 *
 * **Iterator -** Accepts an ES6 style iterator that implements the [iterator protocol](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Iteration_protocols#The_.22iterator.22_protocol):
 * yields all the values from the iterator using its `next()` method and terminates when the
 * iterator's done value returns true. If the iterator's `next()` method throws, the exception will be emitted as an error,
 * and the stream will be ended with no further calls to `next()`.
 *
 * **Iterable -** Accepts an object that implements the [iterable protocol](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Iteration_protocols#The_.22iterable.22_protocol),
 * i.e., contains a method that returns an object that conforms to the iterator protocol. The stream will use the
 * iterator defined in the `Symbol.iterator` property of the iterable object to generate emitted values.
 *
 * @id _(source)
 * @section Stream Objects
 * @name _(source)
 * @param {Array | Function | Iterator | Iterable | Promise | Readable Stream | String} source - (optional) source to take values from from
 * @param {Function} onFinished - (optional) a function that detects when the readable completes. Second argument. Only valid if `source` is a Readable.
 * @param {EventEmitter | jQuery Element} eventEmitter - (optional) An event emitter. Second argument. Only valid if `source` is a String.
 * @param {Array | Function | Number} mappingHint - (optional) how to pass the
 * arguments to the callback. Only valid if `source` is a String.
 * @api public
 *
 * // from an Array
 * _([1, 2, 3, 4]);
 *
 * // using a generator function
 * _(function (push, next) {
 *     push(null, 1);
 *     push(err);
 *     next();
 * });
 *
 * // a stream with no source, can pipe node streams through it etc.
 * var through = _();
 *
 * // wrapping a Node Readable Stream so you can easily manipulate it
 * _(readable).filter(hasSomething).pipe(writeable);
 *
 * // wrapping a Readable that may signify completion by emitting `close`
 * // (e.g., IncomingMessage).
 * _(req, function (req, callback) {
 *     req.on('end', callback)
 *         .on('close', callback)
 *         .on('error', callback);
 *
 *     return function () {
 *         req.removeListener('end', callback);
 *         req.removeListener('close', callback);
 *         req.removeListener('error', callback);
 *     };
 * }).pipe(writable);
 *
 * // wrapping a Readable that may emit values after errors.
 * _(req, function (req, callback) {
 *     req.on('error', callback);
 *
 *     return {
 *         onDestroy: function () {
 *             req.removeListener('error', callback);
 *         },
 *         continueOnError: true
 *     };
 * }).pipe(writable);
 *
 * // creating a stream from events
 * _('click', btn).each(handleEvent);
 *
 * // creating a stream from events with a mapping array
 * _('request', httpServer, ['req', 'res']).each(handleEvent);
 * //=> { req: IncomingMessage, res: ServerResponse }
 *
 * // creating a stream from events with a mapping function
 * _('request', httpServer, function(req, res) {
 *     return res;
 * }).each(handleEvent);
 * //=> IncomingMessage
 *
 * // from a Promise object
 * var foo = _($.getJSON('/api/foo'));
 *
 * //from an iterator
 * var map = new Map([['a', 1], ['b', 2]]);
 * var bar = _(map.values()).toArray(_.log);
 * //=> [1, 2]
 *
 * //from an iterable
 * var set = new Set([1, 2, 2, 3, 4]);
 * var bar = _(set).toArray(_.log);
 * //=> [ 1, 2, 3, 4]
 */

/*eslint-disable no-multi-spaces */
exports = module.exports = function (/*optional*/xs, /*optional*/secondArg, /*optional*/ mappingHint) {
    /*eslint-enable no-multi-spaces */
    return new Stream(xs, secondArg, mappingHint);
};

var _ = exports;

// Create quick slice reference variable for speed
var slice = Array.prototype.slice;
var hasOwn = Object.prototype.hasOwnProperty;

// ES5 detected value, used for switch between ES5 and ES3 code
var isES5 = (function () {
    'use strict';
    return Function.prototype.bind && !this;
}());


_.isUndefined = function (x) {
    return typeof x === 'undefined';
};

_.isFunction = function (x) {
    return typeof x === 'function';
};

_.isObject = function (x) {
    return typeof x === 'object' && x !== null;
};

_.isString = function (x) {
    return typeof x === 'string';
};

_.isArray = Array.isArray || function (x) {
    return Object.prototype.toString.call(x) === '[object Array]';
};

// setImmediate browser fallback
if (typeof setImmediate === 'undefined') {
    _.setImmediate = function (fn) {
        setTimeout(fn, 0);
    };
}
// check no process.stdout to detect browserify
else if (typeof process === 'undefined' || !(process.stdout)) {
    // modern browser - but not a direct alias for IE10 compatibility
    _.setImmediate = function (fn) {
        setImmediate(fn);
    };
}
else {
    _.setImmediate = setImmediate;
}

/**
 * The end of stream marker. This is sent along the data channel of a Stream
 * to tell consumers that the Stream has ended. See the example map code for
 * an example of detecting the end of a Stream.
 *
 * Note: `nil` is setup as a global where possible. This makes it convenient
 * to access, but more importantly lets Streams from different Highland
 * instances work together and detect end-of-stream properly. This is mostly
 * useful for NPM where you may have many different Highland versions installed.
 *
 * @id nil
 * @section Utils
 * @name _.nil
 * @api public
 *
 * var map = function (iter, source) {
 *     return source.consume(function (err, val, push, next) {
 *         if (err) {
 *             push(err);
 *             next();
 *         }
 *         else if (val === _.nil) {
 *             push(null, val);
 *         }
 *         else {
 *             push(null, iter(val));
 *             next();
 *         }
 *     });
 * };
 */

// set up a global nil object in cases where you have multiple Highland
// instances installed (often via npm)
var _global = this;
if (typeof global !== 'undefined') {
    _global = global;
}
else if (typeof window !== 'undefined') {
    _global = window;
}
if (!_global.nil) {
    _global.nil = {};
}
var nil = _.nil = _global.nil;

/**
 * Transforms a function with specific arity (all arguments must be
 * defined) in a way that it can be called as a chain of functions until
 * the arguments list is saturated.
 *
 * This function is not itself curryable.
 *
 * @id curry
 * @name _.curry(fn, [*arguments])
 * @section Functions
 * @param {Function} fn - the function to curry
 * @param args.. - any number of arguments to pre-apply to the function
 * @returns Function
 * @api public
 *
 * fn = curry(function (a, b, c) {
 *     return a + b + c;
 * });
 *
 * fn(1)(2)(3) == fn(1, 2, 3)
 * fn(1, 2)(3) == fn(1, 2, 3)
 * fn(1)(2, 3) == fn(1, 2, 3)
 */

_.curry = function (fn /* args... */) {
    var args = slice.call(arguments);
    return _.ncurry.apply(this, [fn.length].concat(args));
};

/**
 * Same as `curry` but with a specific number of arguments. This can be
 * useful when functions do not explicitly define all its parameters.
 *
 * This function is not itself curryable.
 *
 * @id ncurry
 * @name _.ncurry(n, fn, [args...])
 * @section Functions
 * @param {Number} n - the number of arguments to wait for before apply fn
 * @param {Function} fn - the function to curry
 * @param args... - any number of arguments to pre-apply to the function
 * @returns Function
 * @api public
 *
 * fn = ncurry(3, function () {
 *     return Array.prototype.join.call(arguments, '.');
 * });
 *
 * fn(1, 2, 3) == '1.2.3';
 * fn(1, 2)(3) == '1.2.3';
 * fn(1)(2)(3) == '1.2.3';
 */

_.ncurry = function (n, fn /* args... */) {
    var largs = slice.call(arguments, 2);
    if (largs.length >= n) {
        return fn.apply(this, largs.slice(0, n));
    }

    return _.partial.apply(this, [_.ncurry, n, fn].concat(largs));
};

/**
 * Partially applies the function (regardless of whether it has had curry
 * called on it). This will always postpone execution until at least the next
 * call of the partially applied function.
 *
 * @id partial
 * @name _.partial(fn, args...)
 * @section Functions
 * @param {Function} fn - function to partial apply
 * @param args... - the arguments to apply to the function
 * @api public
 *
 * var addAll = function () {
 *     var args = Array.prototype.slice.call(arguments);
 *     return foldl1(add, args);
 * };
 * var f = partial(addAll, 1, 2);
 * f(3, 4) == 10
 */

_.partial = function (f /* args... */) {
    var args = slice.call(arguments, 1);
    return function () {
        return f.apply(this, args.concat(slice.call(arguments)));
    };
};

/**
 * Evaluates the function `fn` with the argument positions swapped. Only
 * works with functions that accept two arguments.
 *
 * @id flip
 * @name _.flip(fn, [x, y])
 * @section Functions
 * @param {Function} fn - function to flip argument application for
 * @param x - parameter to apply to the right hand side of f
 * @param y - parameter to apply to the left hand side of f
 * @api public
 *
 * div(2, 4) == 0.5
 * flip(div, 2, 4) == 2
 * flip(div)(2, 4) == 2
 */

_.flip = _.curry(function (fn, x, y) { return fn(y, x); });

/**
 * Creates a composite function, which is the application of function1 to
 * the results of function2. You can pass an arbitrary number of arguments
 * and have them composed. This means you can't partially apply the compose
 * function itself.
 *
 * @id compose
 * @name _.compose(fn1, fn2, ...)
 * @section Functions
 * @api public
 *
 * var add1 = add(1);
 * var mul3 = mul(3);
 *
 * var add1mul3 = compose(mul3, add1);
 * add1mul3(2) == 9
 */

_.compose = function (/*functions...*/) {
    var fns = slice.call(arguments).reverse();
    return _.seq.apply(null, fns);
};

/**
 * The reversed version of [compose](#compose). Where arguments are in the
 * order of application.
 *
 * @id seq
 * @name _.seq(fn1, fn2, ...)
 * @section Functions
 * @api public
 *
 * var add1 = add(1);
 * var mul3 = mul(3);
 *
 * var add1mul3 = seq(add1, mul3);
 * add1mul3(2) == 9
 */

_.seq = function () {
    var fns = slice.call(arguments);
    return function () {
        if (!fns.length) {
            return null;
        }
        var r = fns[0].apply(this, arguments);
        for (var i = 1; i < fns.length; i++) {
            r = fns[i].call(this, r);
        }
        return r;
    };
};

function nop() {
    // Do nothing.
}

function defaultReadableOnFinish(readable, callback) {
    // It's possible that `close` is emitted *before* `end`, so we simply
    // cannot handle that case. See
    // https://github.com/caolan/highland/issues/490 for details.

    // pipe already pushes on end, so no need to bind to `end`.

    // write any errors into the stream
    readable.once('error', callback);

    return function () {
        readable.removeListener('error', callback);
    };
}

function pipeReadable(xs, onFinish, stream) {
    var response = onFinish(xs, streamEndCb);
    var unbound = false;

    var cleanup = null;
    var endOnError = true;

    if (_.isFunction(response)) {
        cleanup = response;
    }
    else if (response != null) {
        cleanup = response.onDestroy;
        endOnError = !response.continueOnError;
    }

    xs.pipe(stream);

    // TODO: Replace with onDestroy in v3.
    stream._destructors.push(unbind);

    function streamEndCb(error) {
        if (stream._nil_pushed) {
            return;
        }

        if (error) {
            stream.write(new StreamError(error));
        }

        if (error == null || endOnError) {
            unbind();
            stream.end();
        }
    }

    function unbind() {
        if (unbound) {
            return;
        }

        unbound = true;

        if (cleanup) {
            cleanup();
        }

        if (xs.unpipe) {
            xs.unpipe(stream);
        }
    }
}

function promiseStream(promise) {
    if (_.isFunction(promise['finally'])) { // eslint-disable-line dot-notation
        // Using finally handles also bluebird promise cancellation
        return _(function (push) {
            promise.then(function (value) {
                return push(null, value);
            },
                function (err) {
                    return push(err);
                })['finally'](function () { // eslint-disable-line dot-notation
                    return push(null, nil);
                });
        });
    }
    else {
        // Sticking to promise standard only
        return _(function (push) {
            promise.then(function (value) {
                push(null, value);
                return push(null, nil);
            },
                function (err) {
                    push(err);
                    return push(null, nil);
                });
        });
    }
}

function iteratorStream(it) {
    return _(function (push, next) {
        var iterElem, iterErr;
        try {
            iterElem = it.next();
        }
        catch (err) {
            iterErr = err;
        }

        if (iterErr) {
            push(iterErr);
            push(null, _.nil);
        }
        else if (iterElem.done) {
            if (!_.isUndefined(iterElem.value)) {
                // generators can return a final
                // value on completion using return
                // keyword otherwise value will be
                // undefined
                push(null, iterElem.value);
            }
            push(null, _.nil);
        }
        else {
            push(null, iterElem.value);
            next();
        }

    });
}

function hintMapper(mappingHint) {
    var mappingHintType = (typeof mappingHint);
    var mapper;

    if (mappingHintType === 'function') {
        mapper = mappingHint;
    }
    else if (mappingHintType === 'number') {
        mapper = function () {
            return slice.call(arguments, 0, mappingHint);
        };
    }
    else if (_.isArray(mappingHint)) {
        mapper = function () {
            var args = arguments;
            return mappingHint.reduce(function (ctx, hint, idx) {
                ctx[hint] = args[idx];
                return ctx;
            }, {});
        };
    }
    else {
        mapper = function (x) { return x; };
    }

    return mapper;
}

function pipeStream(src, dest, write, end, passAlongErrors) {
    var resume = null;
    var s = src.consume(function (err, x, push, next) {
        var canContinue;
        if (err) {
            if (passAlongErrors) {
                canContinue = write.call(dest, new StreamError(err));
            }
            else {
                src.emit('error', err);
                canContinue = true;
            }
        }
        else if (x === nil) {
            end.call(dest);
            return;
        }
        else {
            canContinue = write.call(dest, x);
        }

        if (canContinue !== false) {
            next();
        }
        else {
            resume = next;
        }
    });

    dest.on('drain', onConsumerDrain);

    // Since we don't keep a reference to piped-to streams,
    // save a callback that will unbind the event handler.
    src._destructors.push(function () {
        dest.removeListener('drain', onConsumerDrain);
    });

    dest.emit('pipe', src);

    s.resume();
    return dest;

    function onConsumerDrain() {
        if (resume) {
            var oldResume = resume;
            resume = null;
            oldResume();
        }
    }
}

function generatorPush(stream, write) {
    if (!write) {
        write = stream.write;
    }

    return function (err, x) {
        // This will set _nil_pushed if necessary.
        write.call(stream, err ? new StreamError(err) : x);
    };
}


/**
 * Actual Stream constructor wrapped the the main exported function
 */

/*eslint-disable no-multi-spaces */
function Stream(/*optional*/xs, /*optional*/secondArg, /*optional*/mappingHint) {
    /*eslint-enable no-multi-spaces */
    if (xs && _.isStream(xs)) {
        // already a Stream
        return xs;
    }

    EventEmitter.call(this);
    var self = this;

    // used to detect Highland Streams using isStream(x), this
    // will work even in cases where npm has installed multiple
    // versions, unlike an instanceof check
    self.__HighlandStream__ = true;

    self.id = ('' + Math.random()).substr(2, 6);
    this.paused = true;
    this._incoming = [];
    this._outgoing = [];
    this._consumers = [];
    this._observers = [];
    this._destructors = [];
    this._send_events = false;
    this._nil_pushed = false;
    this._delegate = null;
    this._is_observer = false;
    this._in_consume_cb = false;
    this._repeat_resume = false;
    this.source = null;

    // Old-style node Stream.pipe() checks for this
    this.writable = true;

    self.on('newListener', function (ev) {
        if (ev === 'data') {
            self._send_events = true;
            _.setImmediate(self.resume.bind(self));
        }
        else if (ev === 'end') {
            // this property avoids us checking the length of the
            // listners subscribed to each event on each _send() call
            self._send_events = true;
        }
    });

    // TODO: write test to cover this removeListener code
    self.on('removeListener', function (ev) {
        if (ev === 'end' || ev === 'data') {
            var end_listeners = self.listeners('end').length;
            var data_listeners = self.listeners('data').length;
            if (end_listeners + data_listeners === 0) {
                // stop emitting events
                self._send_events = false;
            }
        }
    });

    if (_.isUndefined(xs)) {
        // nothing else to do
        return this;
    }
    else if (_.isArray(xs)) {
        self._incoming = xs.concat([nil]);
        return this;
    }
    else if (_.isFunction(xs)) {
        this._generator = xs;
        this._generator_push = generatorPush(this);
        this._generator_next = function (s) {
            if (self._nil_pushed) {
                throw new Error('Cannot call next after nil');
            }

            if (s) {
                // we MUST pause to get the redirect object into the _incoming
                // buffer otherwise it would be passed directly to _send(),
                // which does not handle StreamRedirect objects!
                var _paused = self.paused;
                if (!_paused) {
                    self.pause();
                }
                self.write(new StreamRedirect(s));
                if (!_paused) {
                    self.resume();
                }
            }
            else {
                self._generator_running = false;
            }
            if (!self.paused) {
                self.resume();
            }
        };

        return this;
    }
    else if (_.isObject(xs)) {
        // check to see if we have a readable stream
        if (_.isFunction(xs.on) && _.isFunction(xs.pipe)) {
            var onFinish = _.isFunction(secondArg) ? secondArg : defaultReadableOnFinish;
            pipeReadable(xs, onFinish, self);
            return this;
        }
        else if (_.isFunction(xs.then)) {
            //probably a promise
            return promiseStream(xs);
        }
        // must check iterators and iterables in this order
        // because generators are both iterators and iterables:
        // their Symbol.iterator method returns the `this` object
        // and an infinite loop would result otherwise
        else if (_.isFunction(xs.next)) {
            //probably an iterator
            return iteratorStream(xs);
        }
        else if (!_.isUndefined(_global.Symbol) && xs[_global.Symbol.iterator]) {
            //probably an iterable
            return iteratorStream(xs[_global.Symbol.iterator]());
        }
        else {
            throw new Error(
                'Object was not a stream, promise, iterator or iterable: ' + (typeof xs)
            );
        }
    }
    else if (_.isString(xs)) {
        var mapper = hintMapper(mappingHint);

        secondArg.on(xs, function () {
            var ctx = mapper.apply(this, arguments);
            self.write(ctx);
        });

        return this;
    }
    else {
        throw new Error(
            'Unexpected argument type to Stream(): ' + (typeof xs)
        );
    }
}
inherits(Stream, EventEmitter);

/**
 * Creates a stream that sends a single value then ends.
 *
 * @id of
 * @section Utils
 * @name _.of(x)
 * @param x - the value to send
 * @returns Stream
 * @api public
 *
 * _.of(1).toArray(_.log); // => [1]
 */

_.of = function (x) {
    return _([x]);
};

/**
 * Creates a stream that sends a single error then ends.
 *
 * @id fromError
 * @section Utils
 * @name _.fromError(err)
 * @param error - the error to send
 * @returns Stream
 * @api public
 *
 * _.fromError(new Error('Single Error')).toCallback(function (err, result) {
 *     // err contains Error('Single Error') object
 * }
 */

_.fromError = function (error) {
    return _(function (push) {
        push(error);
        push(null, _.nil);
    });
};

/**
 * adds a top-level _.foo(mystream) style export for Stream methods
 */

function exposeMethod(name) {
    var f = Stream.prototype[name];
    var n = f.length;
    _[name] = _.ncurry(n + 1, function () {
        var args = slice.call(arguments);
        var s = _(args.pop());
        return f.apply(s, args);
    });
}

/**
 * Used as an Error marker when writing to a Stream's incoming buffer
 */

function StreamError(err) {
    this.__HighlandStreamError__ = true;
    this.error = err;
}

/**
 * Used as a Redirect marker when writing to a Stream's incoming buffer
 */

function StreamRedirect(to) {
    this.__HighlandStreamRedirect__ = true;
    this.to = to;
}

/**
 * Returns true if `x` is a Highland Stream.
 *
 * @id isStream
 * @section Utils
 * @name _.isStream(x)
 * @param x - the object to test
 * @returns {Boolean}
 * @api public
 *
 * _.isStream('foo')  // => false
 * _.isStream(_([1,2,3]))  // => true
 */

_.isStream = function (x) {
    return _.isObject(x) && !!x.__HighlandStream__;
};

_._isStreamError = function (x) {
    return _.isObject(x) && !!x.__HighlandStreamError__;
};

_._isStreamRedirect = function (x) {
    return _.isObject(x) && !!x.__HighlandStreamRedirect__;
};

/**
 * Sends errors / data to consumers, observers and event handlers
 */

Stream.prototype._send = function (err, x) {
    //console.log(['_send', this.id, err, x]);
    var token;

    if (this._consumers.length) {
        token = err ? new StreamError(err) : x;
        // this._consumers may be changed from under us,
        // so we keep a copy.
        var consumers = this._consumers;
        for (var i = 0, len = consumers.length; i < len; i++) {
            consumers[i].write(token);
        }
    }
    if (this._observers.length) {
        token = err ? new StreamError(err) : x;
        // this._observers may be changed from under us,
        // so we keep a copy.
        var observers = this._observers;
        for (var j = 0, len2 = observers.length; j < len2; j++) {
            observers[j].write(token);
        }
    }
    if (this._send_events) {
        if (err) {
            this.emit('error', err);
        }
        else if (x === nil) {
            this.emit('end');
        }
        else {
            this.emit('data', x);
        }
    }

    if (x === nil) {
        this._onEnd();
    }
};


Stream.prototype._onEnd = function _onEnd() {
    if (this.ended) {
        return;
    }

    this.pause();

    this.ended = true;

    if (this.source) {
        var source = this.source;
        source._removeConsumer(this);
        source._removeObserver(this);
    }

    var i, len;

    // _removeConsumer may modify this._consumers.
    var consumers = this._consumers;
    for (i = 0, len = consumers.length; i < len; i++) {
        this._removeConsumer(consumers[i]);
    }

    // Don't use _removeObserver for efficiency reasons.
    var observer;
    for (i = 0, len = this._observers.length; i < len; i++) {
        observer = this._observers[i];
        if (observer.source === this) {
            observer.source = null;
        }
    }

    for (i = 0, len = this._destructors.length; i < len; i++) {
        this._destructors[i].call(this);
    }

    this.source = null;
    this._consumers = [];
    this._incoming = [];
    this._outgoing = [];
    this._delegate = null;
    this._generator = null;
    this._observers = [];
    this._destructors = [];
};

/**
 * Pauses the stream. All Highland Streams start in the paused state.
 *
 * It is unlikely that you will need to manually call this method.
 *
 * @id pause
 * @section Stream Objects
 * @name Stream.pause()
 * @api public
 *
 * var xs = _(generator);
 * xs.pause();
 */

Stream.prototype.pause = function () {
    //console.log(['pause', this.id]);
    this.paused = true;
    if (!this._is_observer && this.source) {
        this.source._checkBackPressure();
    }
};

/**
 * When there is a change in downstream consumers, it will often ask
 * the parent Stream to re-check its state and pause/resume accordingly.
 */

Stream.prototype._checkBackPressure = function () {
    if (!this._consumers.length) {
        this._repeat_resume = false;
        return this.pause();
    }
    for (var i = 0, len = this._consumers.length; i < len; i++) {
        if (this._consumers[i].paused) {
            this._repeat_resume = false;
            return this.pause();
        }
    }
    return this.resume();
};

/**
 * Starts pull values out of the incoming buffer and sending them downstream,
 * this will exit early if this causes a downstream consumer to pause.
 */

Stream.prototype._readFromBuffer = function () {
    //console.log(['_readFromBuffer', this.id, this.paused, this._incoming]);
    var len = this._incoming.length;
    var i = 0;
    while (i < len && !this.paused) {
        var x = this._incoming[i];
        if (_._isStreamError(x)) {
            this._send(x.error);
        }
        else if (_._isStreamRedirect(x)) {
            this._redirect(x.to);
        }
        else {
            this._send(null, x);
        }
        i++;
    }
    // remove processed data from _incoming buffer
    this._incoming.splice(0, i);
};

/**
 * Starts pull values out of the incoming buffer and sending them downstream,
 * this will exit early if this causes a downstream consumer to pause.
 */

Stream.prototype._sendOutgoing = function () {
    //console.log(['_sendOutgoing', this.id, this.paused, this._outgoing]);
    var len = this._outgoing.length;
    var i = 0;
    while (i < len && !this.paused) {
        var x = this._outgoing[i];
        if (_._isStreamError(x)) {
            Stream.prototype._send.call(this, x.error);
        }
        else if (_._isStreamRedirect(x)) {
            this._redirect(x.to);
        }
        else {
            Stream.prototype._send.call(this, null, x);
        }
        i++;
    }
    // remove processed data from _outgoing buffer
    this._outgoing.splice(0, i);
};

/**
 * Resumes a paused Stream. This will either read from the Stream's incoming
 * buffer or request more data from an upstream source. Never call this method
 * on a stream that has been consumed (via a call to [consume](#consume) or any
 * other transform).
 *
 * @id resume
 * @section Stream Objects
 * @name Stream.resume()
 * @api public
 *
 * var xs = _(generator);
 * xs.resume();
 */

Stream.prototype.resume = function () {
    //console.log(['resume', this.id]);
    if (this._resume_running || this._in_consume_cb) {
        //console.log(['resume already processing _incoming buffer, ignore resume call']);
        // already processing _incoming buffer, ignore resume call
        this._repeat_resume = true;
        return;
    }
    this._resume_running = true;
    do {
        // use a repeat flag to avoid recursing resume() calls
        this._repeat_resume = false;
        this.paused = false;

        // send values from outgoing buffer first
        this._sendOutgoing();

        // send values from incoming buffer before reading from source
        this._readFromBuffer();

        // we may have paused while reading from buffer
        if (!this.paused && !this._is_observer) {
            // ask parent for more data
            if (this.source) {
                //console.log(['ask parent for more data']);
                this.source._checkBackPressure();
            }
            // run _generator to fill up _incoming buffer
            else if (this._generator) {
                //console.log(['run generator to fill up _incoming buffer']);
                this._runGenerator();
            }
            else {
                // perhaps a node stream is being piped in
                this.emit('drain');
            }
        }
    } while (this._repeat_resume);
    this._resume_running = false;
};

/**
 * Ends a Stream. This is the same as sending a [nil](#nil) value as data.
 * You shouldn't need to call this directly, rather it will be called by
 * any [Node Readable Streams](http://nodejs.org/api/stream.html#stream_class_stream_readable)
 * you pipe in.
 *
 * Only call this function on streams that were constructed with no source
 * (i.e., with `_()`).
 *
 * @id end
 * @section Stream Objects
 * @name Stream.end()
 * @api public
 *
 * mystream.end();
 */

Stream.prototype.end = function () {
    if (this._nil_pushed) {
        // Allow ending multiple times.
        return;
    }

    this.write(nil);
};

/**
 * Pipes a Highland Stream to a [Node Writable
 * Stream](http://nodejs.org/api/stream.html#stream_class_stream_writable).
 * This will pull all the data from the source Highland Stream and write it to
 * the destination, automatically managing flow so that the destination is not
 * overwhelmed by a fast source.
 *
 * Users may optionally pass an object that may contain any of these fields:
 *
 * - `end` - Ends the destination when this stream ends. Default: `true`. This
 *   option has no effect if the destination is either `process.stdout` or
 *   `process.stderr`. Those two streams are never ended.
 *
 * Like [Readable#pipe](https://nodejs.org/api/stream.html#stream_readable_pipe_destination_options),
 * this function will throw errors if there is no `error` handler installed on
 * the stream.
 *
 * This function returns the destination so you can chain together `pipe` calls.
 *
 * **NOTE**: While Highland streams created via `_()` and [pipeline](#pipeline)
 * support being piped to, it is almost never appropriate to `pipe` from a
 * Highland stream to another Highland stream. Those two cases are meant for
 * use when piping from *Node* streams. You might be tempted to use `pipe` to
 * construct reusable transforms. Do not do it. See [through](#through) for a
 * better way.
 *
 * @id pipe
 * @section Consumption
 * @name Stream.pipe(dest, options)
 * @param {Writable Stream} dest - the destination to write all data to
 * @param {Object} options - (optional) pipe options.
 * @api public
 *
 * var source = _(generator);
 * var dest = fs.createWriteStream('myfile.txt')
 * source.pipe(dest);
 *
 * // chained call
 * source.pipe(through).pipe(dest);
 *
 * // DO NOT do this! It will not work. The stream returned by oddDoubler does
 * // not support being piped to.
 * function oddDoubler() {
 *     return _()
 *         return x % 2; // odd numbers only
 *     })
 *     .map(function (x) {
 *         return x * 2;
 *     });
 * }
 *
 * _([1, 2, 3, 4]).pipe(oddDoubler()) // => Garbage
 */

Stream.prototype.pipe = function (dest, options) {
    options = options || {};

    // stdout and stderr are special case writables that cannot be closed
    var canClose = dest !== process.stdout && dest !== process.stderr && options.end !== false;

    var end;
    if (canClose) {
        end = dest.end;
    }
    else {
        end = nop;
    }

    return pipeStream(this, dest, dest.write, end, false);
};

/**
 * Destroys a stream by unlinking it from any consumers and sources. This will
 * stop all consumers from receiving events from this stream and removes this
 * stream as a consumer of any source stream.
 *
 * This function calls end() on the stream and unlinks it from any piped-to streams.
 *
 * @id destroy
 * @section Stream Objects
 * @name Stream.destroy()
 * @api public
 */

Stream.prototype.destroy = function () {
    if (this.ended) {
        return;
    }

    if (!this._nil_pushed) {
        this.end();
    }

    this._onEnd();
};

/**
 * Runs the generator function for this Stream. If the generator is already
 * running (it has been called and not called next() yet) then this function
 * will do nothing.
 */

Stream.prototype._runGenerator = function () {
    //console.log(['_runGenerator', this.id]);
    // if _generator already running, exit
    if (this._generator_running) {
        return;
    }
    this._generator_running = true;
    this._generator(this._generator_push, this._generator_next);
};

/**
 * Performs the redirect from one Stream to another. In order for the
 * redirect to happen at the appropriate time, it is put on the incoming
 * buffer as a StreamRedirect object, and this function is called
 * once it is read from the buffer.
 */

Stream.prototype._redirect = function (to) {
    //console.log(['_redirect', this.id, '=>', to.id]);
    // coerce to Stream
    to = _(to);

    while (to._delegate) {
        to = to._delegate;
    }

    to._consumers = this._consumers.map(function (c) {
        c.source = to;
        return c;
    });

    // TODO: copy _observers
    this._consumers = [];
    //[this.consume = function () {
    //    return to.consume.apply(to, arguments);
    //};
    //this._removeConsumer = function () {
    //    return to._removeConsumer.apply(to, arguments);
    //};

    // this will cause a memory leak as long as the root object is around
    to._delegate_source = this._delegate_source || this;
    to._delegate_source._delegate = to;

    if (this.paused) {
        to.pause();
    }
    else {
        this.pause();
        to._checkBackPressure();
    }
};

/**
 * Adds a new consumer Stream, which will accept data and provide backpressure
 * to this Stream. Adding more than one consumer will cause an exception to be
 * thrown as the backpressure strategy must be explicitly chosen by the
 * developer (through calling fork or observe).
 */

Stream.prototype._addConsumer = function (s) {
    if (this._consumers.length) {
        throw new Error(
            'Stream already being consumed, you must either fork() or observe()'
        );
    }
    s.source = this;
    this._consumers.push(s);
    this._checkBackPressure();
};

/**
 * Removes a consumer from this Stream.
 */

Stream.prototype._removeConsumer = function (s) {
    var src = this;
    while (src._delegate) {
        src = src._delegate;
    }
    src._consumers = src._consumers.filter(function (c) {
        return c !== s;
    });
    if (s.source === src) {
        s.source = null;
    }
    src._checkBackPressure();
};

/**
 * Removes an observer from this Stream.
 */

Stream.prototype._removeObserver = function (s) {
    this._observers = this._observers.filter(function (o) {
        return o !== s;
    });
    if (s.source === this) {
        s.source = null;
    }
};

/**
 * Consumes values from a Stream (once resumed) and returns a new Stream for
 * you to optionally push values onto using the provided push / next functions.
 *
 * This function forms the basis of many higher-level Stream operations.
 * It will not cause a paused stream to immediately resume, but behaves more
 * like a 'through' stream, handling values as they are read.
 *
 * @id consume
 * @section Transforms
 * @name Stream.consume(f)
 * @param {Function} f - the function to handle errors and values
 * @api public
 *
 * var filter = function (f, source) {
 *     return source.consume(function (err, x, push, next) {
 *         if (err) {
 *             // pass errors along the stream and consume next value
 *             push(err);
 *             next();
 *         }
 *         else if (x === _.nil) {
 *             // pass nil (end event) along the stream
 *             push(null, x);
 *         }
 *         else {
 *             // pass on the value only if the value passes the predicate
 *             if (f(x)) {
 *                 push(null, x);
 *             }
 *             next();
 *         }
 *     });
 * };
 */

Stream.prototype.consume = function (f) {
    var self = this;
    while (self._delegate) {
        self = self._delegate;
    }
    var s = new Stream();

    // Hack. Not needed in v3.0.
    s._is_consumer = true;

    var async;
    var next_called;
    var _send = s._send;
    var push = function (err, x) {
        //console.log(['push', err, x, s.paused]);
        if (s._nil_pushed) {
            throw new Error('Cannot write to stream after nil');
        }
        if (x === nil) {
            // ended, remove consumer from source
            s._nil_pushed = true;
            self._removeConsumer(s);

            // We previously paused the stream, but since a nil was pushed,
            // next won't be called and we must manually resume.
            if (async) {
                s.resume();
            }
        }
        if (s.paused) {
            if (err) {
                s._outgoing.push(new StreamError(err));
            }
            else {
                s._outgoing.push(x);
            }
        }
        else {
            _send.call(s, err, x);
        }
    };
    var next = function (s2) {
        //console.log(['next', async]);
        if (s._nil_pushed) {
            throw new Error('Cannot call next after nil');
        }
        if (s2) {
            // we MUST pause to get the redirect object into the _incoming
            // buffer otherwise it would be passed directly to _send(),
            // which does not handle StreamRedirect objects!
            var _paused = s.paused;
            if (!_paused) {
                s.pause();
            }
            s.write(new StreamRedirect(s2));
            if (!_paused) {
                s.resume();
            }
        }
        else if (async) {
            s.resume();
        }
        else {
            next_called = true;
        }
    };
    s._send = function (err, x) {
        async = false;
        next_called = false;
        s._in_consume_cb = true;

        f(err, x, push, next);

        s._in_consume_cb = false;
        async = true;

        // Don't pause if x is nil -- as next will never be called after
        if (!next_called && x !== nil) {
            s.pause();
        }

        if (s._repeat_resume) {
            s._repeat_resume = false;
            s.resume();
        }
    };
    self._addConsumer(s);
    self._already_consumed = true;
    return s;
};
exposeMethod('consume');

/**
 * Consumes a single item from the Stream. Unlike consume, this function will
 * not provide a new stream for you to push values onto, and it will unsubscribe
 * as soon as it has a single error, value or nil from the source.
 *
 * You probably won't need to use this directly, but it is used internally by
 * some functions in the Highland library.
 *
 * @id pull
 * @section Consumption
 * @name Stream.pull(f)
 * @param {Function} f - the function to handle data
 * @api public
 *
 * xs.pull(function (err, x) {
 *     // do something
 * });
 */

Stream.prototype.pull = function (f) {
    var s = this.consume(function (err, x) {
        s.source._removeConsumer(s);
        f(err, x);
    });
    s.id = 'pull:' + s.id;
    s.resume();
};

/**
 * Writes a value to the Stream. If the Stream is paused it will go into the
 * Stream's incoming buffer, otherwise it will be immediately processed and
 * sent to the Stream's consumers (if any). Returns false if the Stream is
 * paused, true otherwise. This lets Node's pipe method handle back-pressure.
 *
 * You shouldn't need to call this yourself, but it may be called by Node
 * functions which treat Highland Streams as a [Node Writable Stream](http://nodejs.org/api/stream.html#stream_class_stream_writable).
 *
 * Only call this function on streams that were constructed with no source
 * (i.e., with `_()`).

 * @id write
 * @section Stream Objects
 * @name Stream.write(x)
 * @param x - the value to write to the Stream
 * @api public
 *
 * var xs = _();
 * xs.write(1);
 * xs.write(2);
 * xs.end();
 *
 * xs.toArray(function (ys) {
 *     // ys will be [1, 2]
 * });
 *
 * // Do *not* do this.
 * var xs2 = _().toArray(_.log);
 * xs2.write(1); // This call is illegal.
 */

Stream.prototype.write = function (x) {
    if (this._nil_pushed) {
        throw new Error('Cannot write to stream after nil');
    }

    // The check for _is_consumer is kind of a hack. Not
    // needed in v3.0.
    if (x === _.nil && !this._is_consumer) {
        this._nil_pushed = true;
    }

    if (this.paused) {
        this._incoming.push(x);
    }
    else {
        if (_._isStreamError(x)) {
            this._send(x.error);
        }
        else {
            this._send(null, x);
        }
    }
    return !this.paused;
};

/**
 * Forks a stream, allowing you to add additional consumers with shared
 * back-pressure. A stream forked to multiple consumers will only pull values
 * from its source as fast as the slowest consumer can handle them.
 *
 * **NOTE**: Do not depend on a consistent execution order between the forks.
 * This transform only guarantees that all forks will process a value `foo`
 * before any will process a second value `bar`. It does *not* guarantee the
 * order in which the forks process `foo`.
 *
 * **TIP**: Be careful about modifying stream values within the forks (or using
 * a library that does so). Since the same value will be passed to every fork,
 * changes made in one fork will be visible in any fork that executes after it.
 * Add to that the inconsistent execution order, and you can end up with subtle
 * data corruption bugs. If you need to modify any values, you should make a
 * copy and modify the copy instead.
 *
 * *Deprecation warning:* It is currently possible to `fork` a stream after
 * [consuming](#consume) it (e.g., via a [transform](#Transforms)). This will
 * no longer be possible in the next major release. If you are going to `fork`
 * a stream, always call `fork` on it.
 *
 * @id fork
 * @section Higher-order Streams
 * @name Stream.fork()
 * @api public
 *
 * var xs = _([1, 2, 3, 4]);
 * var ys = xs.fork();
 * var zs = xs.fork();
 *
 * // no values will be pulled from xs until zs also resume
 * ys.resume();
 *
 * // now both ys and zs will get values from xs
 * zs.resume();
 */

// Hack our way around the fact that util.deprecate is all-or-nothing for a
// function.
var warnForkAfterConsume = deprecate(function () {
}, 'Highland: Calling Stream.fork() on a stream that has already been consumed is deprecated. Always call fork() on a stream that is meant to be forked.');

Stream.prototype.fork = function () {
    if (this._already_consumed) {
        // Trigger deprecation warning.
        warnForkAfterConsume();
    }

    var s = new Stream();
    s.id = 'fork:' + s.id;
    s.source = this;
    this._consumers.push(s);
    this._checkBackPressure();
    return s;
};

/**
 * Observes a stream, allowing you to handle values as they are emitted, without
 * adding back-pressure or causing data to be pulled from the source. This can
 * be useful when you are performing two related queries on a stream where one
 * would block the other. Just be aware that a slow observer could fill up its
 * buffer and cause memory issues. Where possible, you should use [fork](#fork).
 *
 * @id observe
 * @section Higher-order Streams
 * @name Stream.observe()
 * @api public
 *
 * var xs = _([1, 2, 3, 4]);
 * var ys = xs.fork();
 * var zs = xs.observe();
 *
 * // now both zs and ys will receive data as fast as ys can handle it
 * ys.resume();
 */

Stream.prototype.observe = function () {
    var s = new Stream();
    s.id = 'observe:' + s.id;
    s.source = this;
    s._is_observer = true;
    this._observers.push(s);
    return s;
};

/**
 * Extracts errors from a Stream and applies them to an error handler
 * function. Returns a new Stream with the errors removed (unless the error
 * handler chooses to rethrow them using `push`). Errors can also be
 * transformed and put back onto the Stream as values.
 *
 * @id errors
 * @section Transforms
 * @name Stream.errors(f)
 * @param {Function} f - the function to pass all errors to
 * @api public
 *
 * getDocument.errors(function (err, push) {
 *     if (err.statusCode === 404) {
 *         // not found, return empty doc
 *         push(null, {});
 *     }
 *     else {
 *         // otherwise, re-throw the error
 *         push(err);
 *     }
 * });
 */

Stream.prototype.errors = function (f) {
    return this.consume(function (err, x, push, next) {
        if (err) {
            f(err, push);
            next();
        }
        else if (x === nil) {
            push(null, nil);
        }
        else {
            push(null, x);
            next();
        }
    });
};
exposeMethod('errors');

/**
 * Like the [errors](#errors) method, but emits a Stream end marker after
 * an Error is encountered.
 *
 * @id stopOnError
 * @section Transforms
 * @name Stream.stopOnError(f)
 * @param {Function} f - the function to handle an error
 * @api public
 *
 * brokenStream.stopOnError(function (err) {
 *     //console.error('Something broke: ' + err);
 * });
 */

Stream.prototype.stopOnError = function (f) {
    return this.consume(function (err, x, push, next) {
        if (err) {
            f(err, push);
            push(null, nil);
        }
        else if (x === nil) {
            push(null, nil);
        }
        else {
            push(null, x);
            next();
        }
    });
};
exposeMethod('stopOnError');

/**
 * Iterates over every value from the Stream, calling the iterator function
 * on each of them. This method consumes the Stream.
 *
 * If an error from the Stream reaches this call, it will emit an `error` event
 * (i.e., it will call `emit('error')` on the stream being consumed).  This
 * event will cause an error to be thrown if unhandled.
 *
 * While `each` consumes the stream, it is possible to chain [done](#done) (and
 * *only* `done`) after it.
 *
 * @id each
 * @section Consumption
 * @name Stream.each(f)
 * @param {Function} f - the iterator function
 * @api public
 *
 * _([1, 2, 3, 4]).each(function (x) {
 *     // will be called 4 times with x being 1, 2, 3 and 4
 * });
 */

Stream.prototype.each = function (f) {
    var self = this;
    var s = this.consume(function (err, x, push, next) {
        if (err) {
            self.emit('error', err);
        }
        else if (x === nil) {
            push(null, nil);
        }
        else {
            f(x);
            next();
        }
    });
    s.resume();
    return s;
};
exposeMethod('each');

/**
 * Applies all values from a Stream as arguments to a function. This method consumes the stream.
 * `f` will always be called when the `nil` token is encountered, even when the stream is empty.
 *
 * @id apply
 * @section Consumption
 * @name Stream.apply(f)
 * @param {Function} f - the function to apply arguments to
 * @api public
 *
 * _([1, 2, 3]).apply(function (a, b, c) {
 *     // a === 1
 *     // b === 2
 *     // c === 3
 * });
 *
 * _([1, 2, 3]).apply(function (a) {
 *     // arguments.length === 3
 *     // a === 1
 * });
 */

Stream.prototype.apply = function (f) {
    return this.toArray(function (args) {
        f.apply(null, args);
    });
};
exposeMethod('apply');

/**
 * Collects all values from a Stream into an Array and calls a function with
 * the result. This method consumes the stream.
 *
 * If an error from the Stream reaches this call, it will emit an `error` event
 * (i.e., it will call `emit('error')` on the stream being consumed).  This
 * event will cause an error to be thrown if unhandled.
 *
 * @id toArray
 * @section Consumption
 * @name Stream.toArray(f)
 * @param {Function} f - the callback to provide the completed Array to
 * @api public
 *
 * _([1, 2, 3, 4]).toArray(function (x) {
 *     // parameter x will be [1,2,3,4]
 * });
 */

Stream.prototype.toArray = function (f) {
    var self = this;
    return this.collect().pull(function (err, x) {
        if (err) {
            self.emit('error', err);
        }
        else {
            f(x);
        }
    });
};

/**
 * Calls a function once the Stream has ended. This method consumes the stream.
 * If the Stream has already ended, the function is called immediately.
 *
 * If an error from the Stream reaches this call, it will emit an `error` event
 * (i.e., it will call `emit('error')` on the stream being consumed).  This
 * event will cause an error to be thrown if unhandled.
 *
 * As a special case, it is possible to chain `done` after a call to
 * [each](#each) even though both methods consume the stream.
 *
 * @id done
 * @section Consumption
 * @name Stream.done(f)
 * @param {Function} f - the callback
 * @api public
 *
 * var total = 0;
 * _([1, 2, 3, 4]).each(function (x) {
 *     total += x;
 * }).done(function () {
 *     // total will be 10
 * });
 */

Stream.prototype.done = function (f) {
    if (this.ended) {
        f();
        return null;
    }
    var self = this;
    return this.consume(function (err, x, push, next) {
        if (err) {
            self.emit('error', err);
        }
        else if (x === nil) {
            f();
        }
        else {
            next();
        }
    }).resume();
};

/**
 * Returns the result of a stream to a nodejs-style callback function.
 *
 * If the stream contains a single value, it will call `cb`
 * with the single item emitted by the stream (if present).
 * If the stream is empty, `cb` will be called without any arguments.
 * If an error is encountered in the stream, this function will stop
 * consumption and call `cb` with the error.
 * If the stream contains more than one item, it will stop consumption
 * and call `cb` with an error.
 *
 * @id toCallback
 * @section Consumption
 * @name Stream.toCallback(cb)
 * @param {Function} cb - the callback to provide the error/result to
 * @api public
 *
 * _([1, 2, 3, 4]).collect().toCallback(function (err, result) {
 *     // parameter result will be [1,2,3,4]
 *     // parameter err will be null
 * });
 */

Stream.prototype.toCallback = function (cb) {
    var value;
    var hasValue = false; // In case an emitted value === null or === undefined.

    this.consume(function (err, x, push, next) {
        if (err) {
            push(null, nil);
            if (hasValue) {
                cb(new Error('toCallback called on stream emitting multiple values'));
            }
            else {
                cb(err);
            }
        }
        else if (x === nil) {
            if (hasValue) {
                cb(null, value);
            }
            else {
                cb();
            }
        }
        else {
            if (hasValue) {
                push(null, nil);
                cb(new Error('toCallback called on stream emitting multiple values'));
            }
            else {
                value = x;
                hasValue = true;
                next();
            }
        }
    }).resume();
};

/**
 * Creates a new Stream of transformed values by applying a function to each
 * value from the source. The transformation function can be replaced with
 * a non-function value for convenience, and it will emit that value
 * for every data event on the source Stream.
 *
 * *Deprecation warning:* The use of the convenience non-function argument for
 * `map` is deprecated and will be removed in the next major version.
 *
 * @id map
 * @section Transforms
 * @name Stream.map(f)
 * @param {Function} f - the transformation function or value to map to
 * @api public
 *
 * var doubled = _([1, 2, 3, 4]).map(function (x) {
 *     return x * 2;
 * });
 */

// Hack our way around the fact that util.deprecate is all-or-nothing for a
// function.
var warnMapWithValue = deprecate(function() {
}, 'Highland: Calling Stream.map() with a non-function argument is deprecated.');

Stream.prototype.map = function (f) {
    if (!_.isFunction(f)) {
        warnMapWithValue();
        var val = f;
        f = function () {
            return val;
        };
    }
    return this.consume(function (err, x, push, next) {
        if (err) {
            push(err);
            next();
        }
        else if (x === nil) {
            push(err, x);
        }
        else {
            var fnVal, fnErr;
            try {
                fnVal = f(x);
            }
            catch (e) {
                fnErr = e;
            }
            push(fnErr, fnVal);
            next();
        }
    });
};
exposeMethod('map');

/**
 * Creates a new Stream which applies a function to each value from the source
 * and re-emits the source value. Useful when you want to mutate the value or
 * perform side effects
 *
 * @id doto
 * @section Transforms
 * @name Stream.doto(f)
 * @param {Function} f - the function to apply
 * @api public
 *
 * var appended = _([[1], [2], [3], [4]]).doto(function (x) {
 *     x.push(1);
 * });
 *
 * _([1, 2, 3]).doto(console.log)
 * // 1
 * // 2
 * // 3
 * // => 1, 2, 3
 */

Stream.prototype.doto = function (f) {
    return this.map(function (x) {
        f(x);
        return x;
    });
};
exposeMethod('doto');

/**
 * An alias for the [doto](#doto) method.
 *
 * @id tap
 * @section Transforms
 * @name Stream.tap(f)
 * @param {Function} f - the function to apply
 * @api public
 *
 * _([1, 2, 3]).tap(console.log)
 */

Stream.prototype.tap = Stream.prototype.doto;
_.tap = _.doto;

/**
 * Limits number of values through the stream to a maximum of number of values
 * per window. Errors are not limited but allowed to pass through as soon as
 * they are read from the source.
 *
 * @id ratelimit
 * @section Transforms
 * @name Stream.ratelimit(num, ms)
 * @param {Number} num - the number of operations to perform per window
 * @param {Number} ms - the window of time to limit the operations in (in ms)
 * @api public
 *
 * _([1, 2, 3, 4, 5]).ratelimit(2, 100);
 *
 * // after 0ms => 1, 2
 * // after 100ms => 1, 2, 3, 4
 * // after 200ms => 1, 2, 3, 4, 5
 */

Stream.prototype.ratelimit = function (num, ms) {
    if (num < 1) {
        throw new Error('Invalid number of operations per ms: ' + num);
    }
    var sent = 0;
    return this.consume(function (err, x, push, next) {
        if (err) {
            push(err);
            next();
        }
        else if (x === nil) {
            push(null, nil);
        }
        else {
            if (sent < num) {
                sent++;
                push(null, x);
                next();
            }
            else {
                setTimeout(function () {
                    sent = 1;
                    push(null, x);
                    next();
                }, ms);
            }
        }
    });
};
exposeMethod('ratelimit');

/**
 * Creates a new Stream of values by applying each item in a Stream to an
 * iterator function which must return a (possibly empty) Stream. Each item on
 * these result Streams are then emitted on a single output Stream.
 *
 * This transform is functionally equivalent to `.map(f).sequence()`.
 *
 * @id flatMap
 * @section Higher-order Streams
 * @name Stream.flatMap(f)
 * @param {Function} f - the iterator function
 * @api public
 *
 * var readFile = _.wrapCallback(fs.readFile);
 * filenames.flatMap(readFile)
 */

Stream.prototype.flatMap = function (f) {
    return this.map(f).sequence();
};
exposeMethod('flatMap');

/**
 * Retrieves values associated with a given property from all elements in
 * the collection.
 *
 * @id pluck
 * @section Transforms
 * @name Stream.pluck(property)
 * @param {String} prop - the property to which values should be associated
 * @api public
 *
 * var docs = [
 *     {type: 'blogpost', title: 'foo'},
 *     {type: 'blogpost', title: 'bar'},
 *     {type: 'comment', title: 'baz'}
 * ];
 *
 * _(docs).pluck('title').toArray(function (xs) {
 *    // xs is now ['foo', 'bar', 'baz']
 * });
 */

Stream.prototype.pluck = function (prop) {
    return this.consume(function (err, x, push, next) {
        if (err) {
            push(err);
            next();
        }
        else if (x === nil) {
            push(err, x);
        }
        else if (_.isObject(x)) {
            push(null, x[prop]);
            next();
        }
        else {
            push(new Error(
                'Expected Object, got ' + (typeof x)
            ));
            next();
        }
    });
};
exposeMethod('pluck');

/**
 * Only applies the transformation strategy on Objects.
 * This helper is used in `pick` and `pickBy`
 **/

var objectOnly = _.curry(function(strategy, x) {
    if (_.isObject(x)) {
        return strategy(x);
    }
    else {
        throw new Error(
            'Expected Object, got ' + (typeof x)
        );
    }
});


/**
 *
 * Retrieves copies of all the elements in the collection
 * that satisfy a given predicate. Note: When using ES3,
 * only enumerable elements are selected. Both enumerable
 * and non-enumerable elements are selected when using ES5.
 *
 * @id pickBy
 * @section Transforms
 * @name Stream.pickBy(f)
 * @param {Function} f - the predicate function
 * @api public
 *
 *  var dogs = [
 *      {breed: 'chihuahua', name: 'Princess', age: 5},
 *      {breed: 'labrador', name: 'Rocky', age: 3},
 *      {breed: 'german-shepherd', name: 'Waffles', age: 9}
 *  ];

 *  _(dogs).pickBy(function (key, value) {
 *      return value > 4;
 *  }).toArray(function (xs) {
 *    // xs is now:
 *    [
 *      { age: 5 },
 *      {},
 *      { age: 9 }
 *    ]
 *  });
 */

Stream.prototype.pickBy = function (f) {
    return this.map(objectOnly(function (x) {
        var out = {};

        // prevents testing overridden properties multiple times.
        var seen = isES5 ? Object.create(null) : {};
        var obj = x;  // variable used to traverse prototype chain
        function testAndAdd (prop) {
            if (seen[prop] !== true && f(prop, x[prop])) {
                out[prop] = x[prop];
                seen[prop] = true;
            }
        }
        if (isES5) {
            do {
                Object.getOwnPropertyNames(obj).forEach(testAndAdd);
                obj = Object.getPrototypeOf(obj);
            } while (obj);
        }
        else {
            for (var k in x) {
                testAndAdd(k);
            }
        }
        return out;
    }));
};
exposeMethod('pickBy');

/**
 *
 * Retrieves copies of all elements in the collection,
 * with only the whitelisted keys. If one of the whitelisted
 * keys does not exist, it will be ignored.
 *
 * @id pick
 * @section Transforms
 * @name Stream.pick(properties)
 * @param {Array} properties - property names to white filter
 * @api public
 *
 * var dogs = [
 *      {breed: 'chihuahua', name: 'Princess', age: 5},
 *      {breed: 'labrador', name: 'Rocky', age: 3},
 *      {breed: 'german-shepherd', name: 'Waffles', age: 9}
 * ];
 *
 * _(dogs).pick(['breed', 'age']).toArray(function (xs) {
 *       // xs is now:
 *       [
 *           {breed: 'chihuahua', age: 5},
 *           {breed: 'labrador', age: 3},
 *           {breed: 'german-shepherd', age: 9}
 *       ]
 * });
 *
 * _(dogs).pick(['owner']).toArray(function (xs) {
 *      // xs is now:
 *      [
 *          {},
 *          {},
 *          {}
 *      ]
 * });*/

Stream.prototype.pick = function (properties) {
    return this.map(objectOnly(function(x) {
        var out = {};
        for (var i = 0, length = properties.length; i < length; i++) {
            var p = properties[i];
            if (p in x) {
                out[p] = x[p];
            }
        }
        return out;
    }));
};
exposeMethod('pick');

/**
 * Creates a new Stream that includes only the values that pass a truth test.
 *
 * @id filter
 * @section Transforms
 * @name Stream.filter(f)
 * @param {Function} f - the truth test function
 * @api public
 *
 * var evens = _([1, 2, 3, 4]).filter(function (x) {
 *     return x % 2 === 0;
 * });
 */

Stream.prototype.filter = function (f) {
    return this.consume(function (err, x, push, next) {
        if (err) {
            push(err);
            next();
        }
        else if (x === nil) {
            push(err, x);
        }
        else {
            var fnVal, fnErr;
            try {
                fnVal = f(x);
            }
            catch (e) {
                fnErr = e;
            }

            if (fnErr) {
                push(fnErr);
            }
            else if (fnVal) {
                push(null, x);
            }
            next();
        }
    });
};
exposeMethod('filter');

/**
 * Filters using a predicate which returns a Stream. If you need to check
 * against an asynchronous data source when filtering a Stream, this can
 * be convenient. The Stream returned from the filter function should have
 * a Boolean as its first value (all other values on the Stream will be
 * disregarded).
 *
 * @id flatFilter
 * @section Higher-order Streams
 * @name Stream.flatFilter(f)
 * @param {Function} f - the truth test function which returns a Stream
 * @api public
 *
 * var checkExists = _.wrapCallback(fs.access);
 *
 * filenames.flatFilter(checkExists)
 */

Stream.prototype.flatFilter = function (f) {
    return this.flatMap(function (x) {
        return f(x).take(1).otherwise(errorStream())
        .flatMap(function (bool) {
            return _(bool ? [x] : []);
        });
    });

    function errorStream() {
        return _(function (push) {
            push(new Error('Stream returned by function was empty.'));
            push(null, _.nil);
        });
    }
};
exposeMethod('flatFilter');

/**
 * The inverse of [filter](#filter).
 *
 * @id reject
 * @section Transforms
 * @name Stream.reject(f)
 * @param {Function} f - the truth test function
 * @api public
 *
 * var odds = _([1, 2, 3, 4]).reject(function (x) {
 *     return x % 2 === 0;
 * });
 */

Stream.prototype.reject = function (f) {
    return this.filter(_.compose(_.not, f));
};
exposeMethod('reject');

/**
 * A convenient form of [filter](#filter), which returns the first object from a
 * Stream that passes the provided truth test.
 *
 * @id find
 * @section Transforms
 * @name Stream.find(f)
 * @param {Function} f - the truth test function which returns a Stream
 * @api public
 *
 * var docs = [
 *     {type: 'blogpost', title: 'foo'},
 *     {type: 'blogpost', title: 'bar'},
 *     {type: 'comment', title: 'foo'}
 * ];
 *
 * var f = function (x) {
 *     return x.type == 'blogpost';
 * };
 *
 * _(docs).find(f);
 * // => {type: 'blogpost', title: 'foo'}
 *
 * // example with partial application
 * var firstBlogpost = _.find(f);
 *
 * firstBlogpost(docs)
 * // => {type: 'blogpost', title: 'foo'}
 */

Stream.prototype.find = function (f) {
    return this.filter(f).take(1);
};
exposeMethod('find');

/**
 * A convenient form of [where](#where), which returns the first object from a
 * Stream that matches a set of property values. findWhere is to [where](#where) as [find](#find) is to [filter](#filter).
 *
 * @id findWhere
 * @section Transforms
 * @name Stream.findWhere(props)
 * @param {Object} props - the properties to match against
 * @api public
 *
 * var docs = [
 *     {type: 'blogpost', title: 'foo'},
 *     {type: 'blogpost', title: 'bar'},
 *     {type: 'comment', title: 'foo'}
 * ];
 *
 * _(docs).findWhere({type: 'blogpost'})
 * // => {type: 'blogpost', title: 'foo'}
 *
 * // example with partial application
 * var firstBlogpost = _.findWhere({type: 'blogpost'});
 *
 * firstBlogpost(docs)
 * // => {type: 'blogpost', title: 'foo'}
 */

Stream.prototype.findWhere = function (props) {
    return this.where(props).take(1);
};
exposeMethod('findWhere');


/**
 * A convenient form of [reduce](#reduce), which groups items based on a function or property name
 *
 * @id group
 * @section Transforms
 * @name Stream.group(f)
 * @param {Function | String} f - the function or property name on which to group,
 *                              toString() is called on the result of a function.
 * @api public
 *
 * var docs = [
 *     {type: 'blogpost', title: 'foo'},
 *     {type: 'blogpost', title: 'bar'},
 *     {type: 'comment', title: 'foo'}
 * ];
 *
 * var f = function (x) {
 *     return x.type;
 * };
 *
 * _(docs).group(f); OR _(docs).group('type');
 * // => {
 * // =>    'blogpost': [{type: 'blogpost', title: 'foo'}, {type: 'blogpost', title: 'bar'}]
 * // =>    'comment': [{type: 'comment', title: 'foo'}]
 * // =>  }
 *
 */

Stream.prototype.group = function (f) {
    var lambda = _.isString(f) ? _.get(f) : f;
    return this.reduce({}, function (m, o) {
        var key = lambda(o);
        if (!hasOwn.call(m, key)) { m[key] = []; }
        m[key].push(o);
        return m;
    });
};
exposeMethod('group');

/**
 * Filters a Stream to drop all non-truthy values.
 *
 * @id compact
 * @section Transforms
 * @name Stream.compact()
 * @api public
 *
 * var compacted = _([0, 1, false, 3, null, undefined, 6]).compact();
 * // => 1, 3, 6
 */

Stream.prototype.compact = function () {
    return this.filter(function (x) {
        return x;
    });
};
exposeMethod('compact');

/**
 * A convenient form of [filter](#filter), which returns all objects from a Stream
 * which match a set of property values.
 *
 * @id where
 * @section Transforms
 * @name Stream.where(props)
 * @param {Object} props - the properties to match against
 * @api public
 *
 * var docs = [
 *     {type: 'blogpost', title: 'foo'},
 *     {type: 'blogpost', title: 'bar'},
 *     {type: 'comment', title: 'foo'}
 * ];
 *
 * _(docs).where({title: 'foo'})
 * // => {type: 'blogpost', title: 'foo'}
 * // => {type: 'comment', title: 'foo'}
 *
 * // example with partial application
 * var getBlogposts = _.where({type: 'blogpost'});
 *
 * getBlogposts(docs)
 * // => {type: 'blogpost', title: 'foo'}
 * // => {type: 'blogpost', title: 'bar'}
 */

Stream.prototype.where = function (props) {
    return this.filter(function (x) {
        for (var k in props) {
            if (x[k] !== props[k]) {
                return false;
            }
        }
        return true;
    });
};
exposeMethod('where');

/**
 * Filters out all duplicate values from the stream and keeps only the first
 * occurence of each value, using the provided function to define equality.
 *
 * Note:
 *
 * - Memory: In order to guarantee that each unique item is chosen only once,
 *   we need to keep an internal buffer of all unique values. This may outgrow
 *   the available memory if you are not cautious about the size of your stream
 *   and the number of unique objects you may receive on it.
 * - Errors: The comparison function should never throw an error. However, if
 *   it does, this transform will emit an error for each all that throws. This
 *   means that one value may turn into multiple errors.
 *
 * @id uniqBy
 * @section Transforms
 * @name Stream.uniqBy(compare)
 * @param {Function} compare - custom equality predicate
 * @api public
 *
 * var colors = [ 'blue', 'red', 'red', 'yellow', 'blue', 'red' ]
 *
 * _(colors).uniqBy(function(a, b) { return a[1] === b[1]; })
 * // => 'blue'
 * // => 'red'
 *
 */

Stream.prototype.uniqBy = function (compare) {
    var uniques = [];
    return this.consume(function (err, x, push, next) {
        if (err) {
            push(err);
            next();
        }
        else if (x === nil) {
            push(err, x);
        }
        else {
            var seen = false;
            var hasErr;
            for (var i = 0, len = uniques.length; i < len; i++) {
                try {
                    seen = compare(x, uniques[i]);
                }
                catch (e) {
                    hasErr = e;
                    seen = true;
                }
                if (seen) {
                    break;
                }
            }
            if (!seen) {
                uniques.push(x);
                push(null, x);
            }
            if (hasErr) {
                push(hasErr);
            }
            next();
        }
    });
};
exposeMethod('uniqBy');

/**
 * Filters out all duplicate values from the stream and keeps only the first
 * occurence of each value, using `===` to define equality.
 *
 * Like [uniqBy](#uniqBy), this transform needs to store a buffer containing
 * all unique values that has been encountered. Be careful about using this
 * transform on a stream that has many unique values.
 *
 * @id uniq
 * @section Transforms
 * @name Stream.uniq()
 * @api public
 *
 * var colors = [ 'blue', 'red', 'red', 'yellow', 'blue', 'red' ]
 *
 * _(colors).uniq()
 * // => 'blue'
 * // => 'red'
 * // => 'yellow'
 */

Stream.prototype.uniq = function () {
    if (!_.isUndefined(_global.Set)) {
        var uniques = new _global.Set(),
            size = uniques.size;

        return this.consume(function (err, x, push, next) {
            if (err) {
                push(err);
                next();
            }
            else if (x === nil) {
                push(err, x);
            }
            // pass NaN through as Set does not respect strict
            // equality in this case.
            else if (x !== x) {
                push(null, x);
                next();
            }
            else {
                uniques.add(x);
                if (uniques.size > size) {
                    size = uniques.size;
                    push(null, x);
                }
                next();
            }
        });
    }
    return this.uniqBy(function (a, b) {
        return a === b;
    });
};
exposeMethod('uniq');

/**
 * Takes a *finite* stream of streams and returns a stream where the first
 * element from each separate stream is combined into a single data event,
 * followed by the second elements of each stream and so on until the shortest
 * input stream is exhausted.
 *
 * *Note:* This transform will be renamed `zipAll` in the next major version
 * release.
 *
 * @id zipAll0
 * @section Higher-order Streams
 * @name Stream.zipAll0()
 * @api public
 *
 * _([
 *     _([1, 2, 3]),
 *     _([4, 5, 6]),
 *     _([7, 8, 9]),
 *     _([10, 11, 12])
 * ]).zipAll0()
 * // => [1, 4, 7, 10], [2, 5, 8, 11], [3, 6, 9, 12]
 *
 * // shortest stream determines length of output stream
 * _([
 *     _([1, 2, 3, 4]),
 *     _([5, 6, 7, 8]),
 *     _([9, 10, 11, 12]),
 *     _([13, 14])
 * ]).zipAll0()
 * // => [1, 5, 9, 13], [2, 6, 10, 14]
 */

Stream.prototype.zipAll0 = function () {
    var returned = 0;
    var z = [];
    var finished = false;

    function nextValue(index, max, src, push, next) {
        src.pull(function (err, x) {
            if (err) {
                push(err);
                nextValue(index, max, src, push, next);
            }
            else if (x === _.nil) {
                if (!finished) {
                    finished = true;
                    push(null, nil);
                }
            }
            else {
                returned++;
                z[index] = x;
                if (returned === max) {
                    push(null, z);
                    next();
                }
            }
        });
    }

    return this.collect().flatMap(function (array) {
        if (!array.length) {
            return _([]);
        }

        return _(function (push, next) {
            returned = 0;
            z = [];
            for (var i = 0, length = array.length; i < length; i++) {
                nextValue(i, length, array[i], push, next);
            }
        });
    });

};
exposeMethod('zipAll0');

/**
 * Takes a stream and a *finite* stream of `N` streams
 * and returns a stream of the corresponding `(N+1)`-tuples.
 *
 * *Note:* This transform will be renamed `zipEach` in the next major version
 * release.
 *
 * @id zipAll
 * @section Higher-order Streams
 * @name Stream.zipAll(ys)
 * @param {Array | Stream} ys - the array of streams to combine values with
 * @api public
 *
 * _([1,2,3]).zipAll([[4, 5, 6], [7, 8, 9], [10, 11, 12]])
 * // => [1, 4, 7, 10], [2, 5, 8, 11], [3, 6, 9, 12]
 *
 * // shortest stream determines length of output stream
 * _([1, 2, 3, 4]).zipAll([[5, 6, 7, 8], [9, 10, 11, 12], [13, 14]])
 * // => [1, 5, 9, 13], [2, 6, 10, 14]
 */

Stream.prototype.zipAll = function (ys) {
    return _([this]).concat(_(ys).map(_)).zipAll0();
};
exposeMethod('zipAll');

/**
 * Takes two Streams and returns a Stream of corresponding pairs. The size of
 * the resulting stream is the smaller of the two source streams.
 *
 * @id zip
 * @section Higher-order Streams
 * @name Stream.zip(ys)
 * @param {Array | Stream} ys - the other stream to combine values with
 * @api public
 *
 * _(['a', 'b', 'c']).zip([1, 2, 3])  // => ['a', 1], ['b', 2], ['c', 3]
 *
 * _(['a', 'b', 'c']).zip(_([1]))  // => ['a', 1]
 */

Stream.prototype.zip = function (ys) {
    return _([this, _(ys)]).zipAll0();
};
exposeMethod('zip');

/**
 * Takes one Stream and batches incoming data into arrays of given length
 *
 * @id batch
 * @section Transforms
 * @name Stream.batch(n)
 * @param {Number} n - length of the array to batch
 * @api public
 *
 * _([1, 2, 3, 4, 5]).batch(2)  // => [1, 2], [3, 4], [5]
 */

Stream.prototype.batch = function (n) {
    return this.batchWithTimeOrCount(-1, n);
};
exposeMethod('batch');

/**
 * Takes one Stream and batches incoming data within a maximum time frame
 * into arrays of a maximum length.
 *
 * @id batchWithTimeOrCount
 * @section Transforms
 * @name Stream.batchWithTimeOrCount(ms, n)
 * @param {Number} ms - the maximum milliseconds to buffer a batch
 * @param {Number} n - the maximum length of the array to batch
 * @api public
 *
 * _(function (push) {
 *     push(1);
 *     push(2);
 *     push(3);
 *     setTimeout(push, 20, 4);
 * }).batchWithTimeOrCount(10, 2)
 *
 * // => [1, 2], [3], [4]
 */

Stream.prototype.batchWithTimeOrCount = function (ms, n) {
    var batched = [],
        timeout;

    return this.consume(function (err, x, push, next) {
        if (err) {
            push(err);
            next();
        }
        else if (x === nil) {
            if (batched.length > 0) {
                push(null, batched);
                clearTimeout(timeout);
            }

            push(null, nil);
        }
        else {
            batched.push(x);

            if (batched.length === n) {
                push(null, batched);
                batched = [];
                clearTimeout(timeout);
            }
            else if (batched.length === 1 && ms >= 0) {
                timeout = setTimeout(function () {
                    push(null, batched);
                    batched = [];
                }, ms);
            }

            next();
        }
    });
};
exposeMethod('batchWithTimeOrCount');

/**
 * Creates a new Stream with the separator interspersed between the elements of the source.
 *
 * `intersperse` is effectively the inverse of [splitBy](#splitBy).
 *
 * @id intersperse
 * @section Transforms
 * @name Stream.intersperse(sep)
 * @param {String} sep - the value to intersperse between the source elements
 * @api public
 *
 * _(['ba', 'a', 'a']).intersperse('n')  // => 'ba', 'n', 'a', 'n', 'a'
 * _(['mississippi']).splitBy('ss').intersperse('ss')  // => 'mi', 'ss', 'i', 'ss', 'ippi'
 * _(['foo']).intersperse('bar')  // => 'foo'
 */

Stream.prototype.intersperse = function (separator) {
    var started = false;
    return this.consume(function (err, x, push, next) {
        if (err) {
            push(err);
            next();
        }
        else if (x === nil) {
            push(null, nil);
        }
        else {
            if (started) {
                push(null, separator);
            }
            else {
                started = true;
            }
            push(null, x);
            next();
        }
    });
};
exposeMethod('intersperse');

/**
 * Splits the source Stream by a separator and emits the pieces in between, much like splitting a string.
 *
 * `splitBy` is effectively the inverse of [intersperse](#intersperse).
 *
 * @id splitBy
 * @section Transforms
 * @name Stream.splitBy(sep)
 * @param {String | RegExp} sep - the separator to split on
 * @api public
 *
 * _(['mis', 'si', 's', 'sippi']).splitBy('ss')  // => 'mi', 'i', 'ippi'
 * _(['ba', 'a', 'a']).intersperse('n').splitBy('n')  // => 'ba', 'a', 'a'
 * _(['foo']).splitBy('bar')  // => 'foo'
 */

Stream.prototype.splitBy = function (sep) {
    var decoder = new Decoder();
    var buffer = false;

    function drain(x, push) {
        buffer = (buffer || '') + decoder.write(x);
        var pieces = buffer.split(sep);
        buffer = pieces.pop();

        pieces.forEach(function (piece) {
            push(null, piece);
        });
    }

    return this.consume(function (err, x, push, next) {
        if (err) {
            push(err);
            next();
        }
        else if (x === nil) {
            if (_.isString(buffer)) {
                drain(decoder.end(), push);
                push(null, buffer);
            }
            push(null, nil);
        }
        else {
            drain(x, push);
            next();
        }
    });
};
exposeMethod('splitBy');

/**
 * [splitBy](#splitBy) over newlines.
 *
 * @id split
 * @section Transforms
 * @name Stream.split()
 * @api public
 *
 * _(['a\n', 'b\nc\n', 'd', '\ne']).split()  // => 'a', 'b', 'c', 'd', 'e'
 * _(['a\r\nb\nc']]).split()  // => 'a', 'b', 'c'
 */

Stream.prototype.split = function () {
    return this.splitBy(/\r?\n/);
};
exposeMethod('split');

/**
 * Creates a new Stream with the values from the source in the range of `start` (inclusive) to `end` (exclusive).
 * `start` and `end` must be of type `Number`, if `start` is not a `Number` it will default to `0`
 * and, likewise, `end` will default to `Infinity`: this could result in the whole stream being be
 * returned.
 *
 * @id slice
 * @section Transforms
 * @name Stream.slice(start, end)
 * @param {Number} start - integer representing index to start reading from source (inclusive)
 * @param {Number} stop - integer representing index to stop reading from source (exclusive)
 * @api public
 *
 * _([1, 2, 3, 4]).slice(1, 3) // => 2, 3
 */

Stream.prototype.slice = function(start, end) {
    var index = 0;
    start = typeof start != 'number' || start < 0 ? 0 : start;
    end = typeof end != 'number' ? Infinity : end;

    if (start === 0 && end === Infinity) {
        return this;
    }
    else if (start >= end) {
        return _([]);
    }
    var s = this.consume(function (err, x, push, next) {
        var done = x === nil;
        if (err) {
            push(err);
        }
        else if (!done && index++ >= start) {
            push(null, x);
        }

        if (!done && index < end) {
            next();
        }
        else {
            push(null, nil);
        }
    });
    s.id = 'slice:' + s.id;
    return s;
};
exposeMethod('slice');

/**
 * Creates a new Stream with the first `n` values from the source. `n` must be of type `Number`,
 * if not the whole stream will be returned.
 *
 * @id take
 * @section Transforms
 * @name Stream.take(n)
 * @param {Number} n - integer representing number of values to read from source
 * @api public
 *
 * _([1, 2, 3, 4]).take(2) // => 1, 2
 */

Stream.prototype.take = function (n) {
    var s = this.slice(0, n);
    s.id = 'take:' + s.id;
    return s;
};
exposeMethod('take');

/**
 * Acts as the inverse of [`take(n)`](#take) - instead of returning the first `n` values, it ignores the
 * first `n` values and then emits the rest. `n` must be of type `Number`, if not the whole stream will
 * be returned. All errors (even ones emitted before the nth value) will be emitted.
 *
 * @id drop
 * @section Transforms
 * @name Stream.drop(n)
 * @param {Number} n - integer representing number of values to read from source
 * @api public
 *
 * _([1, 2, 3, 4]).drop(2) // => 3, 4
 */

Stream.prototype.drop = function (n) {
    return this.slice(n, Infinity);
};
exposeMethod('drop');

/**
 * Creates a new Stream with only the first value from the source.
 *
 * @id head
 * @section Transforms
 * @name Stream.head()
 * @api public
 *
 * _([1, 2, 3, 4]).head() // => 1
 */

Stream.prototype.head = function () {
    return this.take(1);
};
exposeMethod('head');

/**
 * Drops all values from the Stream apart from the last one (if any).
 *
 * @id last
 * @section Transforms
 * @name Stream.last()
 * @api public
 *
 * _([1, 2, 3, 4]).last()  // => 4
 */

Stream.prototype.last = function () {
    var nothing = {};
    var prev = nothing;
    return this.consume(function (err, x, push, next) {
        if (err) {
            push(err);
            next();
        }
        else if (x === nil) {
            if (prev !== nothing) {
                push(null, prev);
            }
            push(null, nil);
        }
        else {
            prev = x;
            next();
        }
    });
};
exposeMethod('last');

/**
 * Collects all values together then emits each value individually in sorted
 * order. The method for sorting the elements is defined by the comparator
 * function supplied as a parameter.
 *
 * The comparison function takes two arguments `a` and `b` and should return
 *
 * - a negative number if `a` should sort before `b`.
 * - a positive number if `a` should sort after `b`.
 * - zero if `a` and `b` may sort in any order (i.e., they are equal).
 *
 * This function must also define a [partial
 * order](https://en.wikipedia.org/wiki/Partially_ordered_set). If it does not,
 * the resulting ordering is undefined.
 *
 * @id sortBy
 * @section Transforms
 * @name Stream.sortBy(f)
 * @param {Function} f - the comparison function
 * @api public
 *
 * var sorts = _([3, 1, 4, 2]).sortBy(function (a, b) {
 *     return b - a;
 * }).toArray(_.log);
 *
 * //=> [4, 3, 2, 1]
 */

Stream.prototype.sortBy = function (f) {
    return this.collect().invoke('sort', [f]).sequence();
};
exposeMethod('sortBy');

/**
 * Collects all values together then emits each value individually but in sorted order.
 * The method for sorting the elements is ascending lexical.
 *
 * @id sort
 * @section Transforms
 * @name Stream.sort()
 * @api public
 *
 * var sorted = _(['b', 'z', 'g', 'r']).sort().toArray(_.log);
 * // => ['b', 'g', 'r', 'z']
 */

Stream.prototype.sort = function () {
    return this.sortBy();
};
exposeMethod('sort');


/**
 * Transforms a stream using an arbitrary target transform.
 *
 * If `target` is a function, this transform passes the current Stream to it,
 * returning the result.
 *
 * If `target` is a [Duplex
 * Stream](https://nodejs.org/api/stream.html#stream_class_stream_duplex_1),
 * this transform pipes the current Stream through it. It will always return a
 * Highland Stream (instead of the piped to target directly as in
 * [pipe](#pipe)). Any errors emitted will be propagated as Highland errors.
 *
 * **TIP**: Passing a function to `through` is a good way to implement complex
 * reusable stream transforms. You can even construct the function dynamically
 * based on certain inputs. See examples below.
 *
 * @id through
 * @section Higher-order Streams
 * @name Stream.through(target)
 * @param {Function | Duplex Stream} target - the stream to pipe through or a
 * function to call.
 * @api public
 *
 * // This is a static complex transform.
 * function oddDoubler(s) {
 *     return s.filter(function (x) {
 *         return x % 2; // odd numbers only
 *     })
 *     .map(function (x) {
 *         return x * 2;
 *     });
 * }
 *
 * // This is a dynamically-created complex transform.
 * function multiplyEvens(factor) {
 *     return function (x) {
 *         return s.filter(function (x) {
 *             return x % 2 === 0;
 *         })
 *         .map(function (x) {
 *             return x * factor;
 *         });
 *     };
 * }
 *
 * _([1, 2, 3, 4]).through(oddDoubler); // => 2, 6
 *
 * _([1, 2, 3, 4]).through(multiplyEvens(5)); // => 10, 20
 *
 * // Can also be used with Node Through Streams
 * _(filenames).through(jsonParser).map(function (obj) {
 *     // ...
 * });
 *
 * // All errors will be propagated as Highland errors
 * _(['zz{"a": 1}']).through(jsonParser).errors(function (err) {
 *   console.log(err); // => SyntaxError: Unexpected token z
 * });
 */

Stream.prototype.through = function (target) {
    var output;

    if (_.isFunction(target)) {
        return target(this);
    }
    else {
        target.pause();
        output = _();
        this.on('error', writeErr);
        target.on('error', writeErr);
        return this.pipe(target).pipe(output);
    }

    function writeErr(err) {
        output.write(new StreamError(err));
    }
};
exposeMethod('through');

/**
 * Creates a 'Through Stream', which passes data through a pipeline
 * of functions or other through Streams. This is particularly useful
 * when combined with partial application of Highland functions to expose a
 * Node-compatible Through Stream.
 *
 * This is not a method on a Stream, and it only exposed at the top-level
 * as `_.pipeline`. It takes an arbitrary number of arguments.
 *
 * @id pipeline
 * @section Higher-order Streams
 * @name _.pipeline(...)
 * @api public
 *
 * var through = _.pipeline(
 *     _.map(parseJSON),
 *     _.filter(isBlogpost),
 *     _.reduce(collectCategories)
 *     _.through(otherPipeline)
 * );
 *
 * readStream.pipe(through).pipe(outStream);
 *
 * // Alternatively, you can use pipeline to manipulate a stream in
 * // the chained method call style:
 *
 * var through2 = _.pipeline(function (s) {
 *     return s.map(parseJSON).filter(isBlogpost); // etc.
 * });
 */

_.pipeline = function (/*through...*/) {
    if (!arguments.length) {
        return _();
    }
    var start = arguments[0], rest, startHighland;
    if (!_.isStream(start) && !_.isFunction(start.resume)) {
        // not a Highland stream or Node stream, start with empty stream
        start = _();
        startHighland = start;
        rest = slice.call(arguments);
    }
    else {
        // got a stream as first argument, co-erce to Highland stream
        startHighland = _(start);
        rest = slice.call(arguments, 1);
    }

    var end = rest.reduce(function (src, dest) {
        return src.through(dest);
    }, startHighland);

    var wrapper = _(function (push, next) {
        end.pull(function (err, x) {
            push(err, x);
            if (x !== nil) {
                next();
            }
        });
    });

    wrapper.write = function (x) {
        return start.write(x);
    };

    wrapper.end = function () {
        return start.end();
    };

    start.on('drain', function () {
        wrapper.emit('drain');
    });

    return wrapper;
};

/**
 * Reads values from a Stream of Streams or Arrays, emitting them on a single
 * output Stream. This can be thought of as a [flatten](#flatten), just one
 * level deep, often used for resolving asynchronous actions such as a HTTP
 * request or reading a file.
 *
 * @id sequence
 * @section Higher-order Streams
 * @name Stream.sequence()
 * @api public
 *
 * var nums = _([
 *     _([1, 2, 3]),
 *     _([4, 5, 6])
 * ]);
 *
 * nums.sequence()  // => 1, 2, 3, 4, 5, 6
 *
 * // using sequence to read from files in series
 * var readFile = _.wrapCallback(fs.readFile);
 * filenames.map(readFile).sequence()
 */

Stream.prototype.sequence = function () {
    var original = this;
    var curr = this;
    return _(function (push, next) {
        curr.pull(function (err, x) {
            if (err) {
                push(err);
                next();
            }
            else if (_.isArray(x)) {
                if (onOriginalStream()) {
                    // just send all values from array directly
                    x.forEach(function (y) {
                        push(null, y);
                    });
                }
                else {
                    push(null, x);
                }
                next();
            }
            else if (_.isStream(x)) {
                if (onOriginalStream()) {
                    // switch to reading new stream
                    curr = x;
                    next();
                }
                else {
                    // sequence only goes 1 level deep
                    push(null, x);
                    next();
                }
            }
            else if (x === nil) {
                if (onOriginalStream()) {
                    push(null, nil);
                }
                else {
                    // resume reading from original
                    curr = original;
                    next();
                }
            }
            else {
                if (onOriginalStream()) {
                    // we shouldn't be getting non-stream (or array)
                    // values from the top-level stream
                    push(new Error(
                        'Expected Stream, got ' + (typeof x)
                    ));
                    next();
                }
                else {
                    push(null, x);
                    next();
                }
            }
        });
    });

    function onOriginalStream() {
        return curr === original;
    }
};
exposeMethod('sequence');

/**
 * An alias for the [sequence](#sequence) method.
 *
 * @id series
 * @section Higher-order Streams
 * @name Stream.series()
 * @api public
 *
 * var readFile = _.wrapCallback(fs.readFile);
 * filenames.map(readFile).series()
 */

Stream.prototype.series = Stream.prototype.sequence;
_.series = _.sequence;

/**
 * Recursively reads values from a Stream which may contain nested Streams
 * or Arrays. As values or errors are encountered, they are emitted on a
 * single output Stream.
 *
 * @id flatten
 * @section Higher-order Streams
 * @name Stream.flatten()
 * @api public
 *
 * _([1, [2, 3], [[4]]]).flatten();  // => 1, 2, 3, 4
 *
 * var nums = _(
 *     _([1, 2, 3]),
 *     _([4, _([5, 6]) ])
 * );
 *
 * nums.flatten();  // => 1, 2, 3, 4, 5, 6
 */

Stream.prototype.flatten = function () {
    var curr = this;
    var stack = [];
    return _(function (push, next) {
        curr.pull(function (err, x) {
            if (err) {
                push(err);
                next();
                return;
            }
            if (_.isArray(x)) {
                x = _(x);
            }
            if (_.isStream(x)) {
                stack.push(curr);
                curr = x;
                next();
            }
            else if (x === nil) {
                if (stack.length) {
                    curr = stack.pop();
                    next();
                }
                else {
                    push(null, nil);
                }
            }
            else {
                push(null, x);
                next();
            }
        });
    });
};
exposeMethod('flatten');

/**
 * Takes a Stream of Streams and reads from them in parallel, buffering
 * the results until they can be returned to the consumer in their original
 * order.
 *
 * @id parallel
 * @section Higher-order Streams
 * @name Stream.parallel(n)
 * @param {Number} n - the maximum number of concurrent reads/buffers
 * @api public
 *
 * var readFile = _.wrapCallback(fs.readFile);
 * var filenames = _(['foo.txt', 'bar.txt', 'baz.txt']);
 *
 * // read from up to 10 files at once
 * filenames.map(readFile).parallel(10);
 */

Stream.prototype.parallel = function (n) {
    var source = this;
    var running = [];
    var ended = false;
    var reading_source = false;

    if (typeof n !== 'number') {
        throw new Error('Must specify a number to parallel().');
    }

    if (n <= 0) {
        throw new Error('The parallelism factor must be positive');
    }

    return _(function (push, next) {
        if (running.length < n && !ended && !reading_source) {
            // get another stream if not already waiting for one
            reading_source = true;
            source.pull(function (err, x) {
                reading_source = false;
                if (err) {
                    push(err);
                }
                else if (x === nil) {
                    ended = true;
                }
                else if (!_.isStream(x)) {
                    push(new Error('Expected Stream, got ' + (typeof x)));
                }
                else {
                    // got a new source, add it to the running array
                    var run = {stream: x, buffer: []};
                    running.push(run);
                    x.consume(function (_err, y, _push, _next) {
                        if (running[0] === run) {
                            // current output stream
                            if (y === nil) {
                                // remove self from running and check
                                // to see if we need to read from source again
                                running.shift();
                                flushBuffer();
                                next();

                            }
                            else {
                                // push directly onto parallel output stream
                                push(_err, y);
                            }
                        }
                        else {
                            // we're reading ahead, buffer the output
                            run.buffer.push([_err, y]);
                        }
                        if (y !== nil) {
                            // keep reading until we hit nil
                            _next();
                        }
                    }).resume();
                }
                // check if we need to get any more streams
                return next();
            });
        }
        else if (!running.length && ended) {
            // nothing more to do
            push(null, nil);
        }

        function flushBuffer() {
            while (running.length && running[0].buffer.length) {
                var buf = running[0].buffer;
                for (var i = 0; i < buf.length; i++) {
                    if (buf[i][1] === nil) {
                        // this stream has ended
                        running.shift();
                        break;
                    }
                    else {
                        // send the buffered output
                        push.apply(null, buf[i]);
                    }
                }
                buf.length = 0;
            }
        }
        // else wait for more data to arrive from running streams
    });
};
exposeMethod('parallel');

/**
 * Switches source to an alternate Stream if the current Stream is empty.
 *
 * @id otherwise
 * @section Higher-order Streams
 * @name Stream.otherwise(ys)
 * @param {Stream | Function} ys - alternate stream (or stream-returning function) to use if this stream is empty
 * @api public
 *
 * _([1,2,3]).otherwise(['foo'])  // => 1, 2, 3
 * _([]).otherwise(['foo'])       // => 'foo'
 *
 * _.otherwise(_(['foo']), _([1,2,3]))    // => 1, 2, 3
 * _.otherwise(_(['foo']), _([]))         // => 'foo'
 */

Stream.prototype.otherwise = function (ys) {
    var xs = this;
    return xs.consume(function (err, x, push, next) {
        if (err) {
            // got an error, just keep going
            push(err);
            next();
        }
        else if (x === nil) {
            // hit the end without redirecting to xs, use alternative
            if (_.isFunction(ys)) {
                next(ys());
            }
            else {
                next(ys);
            }
        }
        else {
            // got a value, push it, then redirect to xs
            push(null, x);
            next(xs);
        }
    });
};
exposeMethod('otherwise');

/**
 * Adds a value to the end of a Stream.
 *
 * @id append
 * @section Transforms
 * @name Stream.append(y)
 * @param y - the value to append to the Stream
 * @api public
 *
 * _([1, 2, 3]).append(4)  // => 1, 2, 3, 4
 */

Stream.prototype.append = function (y) {
    return this.consume(function (err, x, push, next) {
        if (x === nil) {
            push(null, y);
            push(null, _.nil);
        }
        else {
            push(err, x);
            next();
        }
    });
};
exposeMethod('append');

/**
 * Boils down a Stream to a single value. The memo is the initial state
 * of the reduction, and each successive step of it should be returned by
 * the iterator function. The iterator is passed two arguments:
 * the memo and the next value.
 *
 * If the iterator throws an error, the reduction stops and the resulting
 * stream will emit that error instead of a value.
 *
 * *Note:* The order of the `memo` and `iterator` arguments will be flipped in
 * the next major version release.
 *
 * @id reduce
 * @section Transforms
 * @name Stream.reduce(memo, iterator)
 * @param memo - the initial state of the reduction
 * @param {Function} iterator - the function which reduces the values
 * @api public
 *
 * var add = function (a, b) {
 *     return a + b;
 * };
 *
 * _([1, 2, 3, 4]).reduce(0, add)  // => 10
 */

Stream.prototype.reduce = function (z, f) {
    // This can't be implemented with scan(), because we don't know if the
    // errors that we see from the scan were thrown by the iterator or just
    // passed through from the source stream.
    return this.consume(function (err, x, push, next) {
        if (x === nil) {
            push(null, z);
            push(null, _.nil);
        }
        else if (err) {
            push(err);
            next();
        }
        else {
            try {
                z = f(z, x);
            }
            catch (e) {
                push(e);
                push(null, _.nil);
                return;
            }

            next();
        }
    });
};
exposeMethod('reduce');

/**
 * Same as [reduce](#reduce), but uses the first element as the initial
 * state instead of passing in a `memo` value.
 *
 * @id reduce1
 * @section Transforms
 * @name Stream.reduce1(iterator)
 * @param {Function} iterator - the function which reduces the values
 * @api public
 *
 * _([1, 2, 3, 4]).reduce1(add)  // => 10
 */

Stream.prototype.reduce1 = function (f) {
    var self = this;
    return _(function (push, next) {
        self.pull(function (err, x) {
            if (err) {
                push(err);
                next();
            }
            else if (x === nil) {
                push(null, nil);
            }
            else {
                next(self.reduce(x, f));
            }
        });
    });
};
exposeMethod('reduce1');

/**
 * Groups all values into an Array and passes down the stream as a single
 * data event. This is a bit like doing [toArray](#toArray), but instead
 * of accepting a callback and consuming the stream, it passes the value on.
 *
 * @id collect
 * @section Transforms
 * @name Stream.collect()
 * @api public
 *
 * _(['foo', 'bar']).collect().toArray(function (xs) {
 *     // xs will be [['foo', 'bar']]
 * });
 */

Stream.prototype.collect = function () {
    var xs = [];
    return this.consume(function (err, x, push, next) {
        if (err) {
            push(err);
            next();
        }
        else if (x === nil) {
            push(null, xs);
            push(null, nil);
        }
        else {
            xs.push(x);
            next();
        }
    });
};
exposeMethod('collect');

/**
 * Like [reduce](#reduce), but emits each intermediate value of the
 * reduction as it is calculated.
 *
 * If the iterator throws an error, the scan will stop and the stream will
 * emit that error. Any intermediate values that were produced before the
 * error will still be emitted.
 *
 * *Note:* The order of the `memo` and `iterator` arguments will be flipped in
 * the next major version release.
 *
 * @id scan
 * @section Transforms
 * @name Stream.scan(memo, iterator)
 * @param memo - the initial state of the reduction
 * @param {Function} iterator - the function which reduces the values
 * @api public
 *
 * _([1, 2, 3, 4]).scan(0, add)  // => 0, 1, 3, 6, 10
 */

Stream.prototype.scan = function (z, f) {
    var self = this;
    return _([z]).concat(
        self.consume(function (err, x, push, next) {
            if (x === nil) {
                push(null, _.nil);
            }
            else if (err) {
                push(err);
                next();
            }
            else {
                try {
                    z = f(z, x);
                }
                catch (e) {
                    push(e);
                    push(null, _.nil);
                    return;
                }

                push(null, z);
                next();
            }
        })
    );
};
exposeMethod('scan');

/**
 * Same as [scan](#scan), but uses the first element as the initial
 * state instead of passing in a `memo` value.
 *
 * @id scan1
 * @section Transforms
 * @name Stream.scan1(iterator)
 * @param {Function} iterator - the function which reduces the values
 * @api public
 *
 * _([1, 2, 3, 4]).scan1(add)  // => 1, 3, 6, 10
 */

Stream.prototype.scan1 = function (f) {
    var self = this;
    return _(function (push, next) {
        self.pull(function (err, x) {
            if (err) {
                push(err);
                next();
            }
            else if (x === nil) {
                push(null, nil);
            }
            else {
                next(self.scan(x, f));
            }
        });
    });
};
exposeMethod('scan1');

function HighlandTransform(push) {
    this.push = push;
}

HighlandTransform.prototype['@@transducer/init'] = function () {
    return this.push;
};

HighlandTransform.prototype['@@transducer/result'] = function (push) {
    // Don't push nil here. Otherwise, we can't catch errors from `result`
    // and propagate them. The `transduce` implementation will do it.
    return push;
};

HighlandTransform.prototype['@@transducer/step'] = function (push, input) {
    push(null, input);
    return push;
};

/**
 * Applies the transformation defined by the the given *transducer* to the
 * stream. A transducer is any function that follows the
 * [Transducer Protocol](https://github.com/cognitect-labs/transducers-js#transformer-protocol).
 * See
 * [transduce-js](https://github.com/cognitect-labs/transducers-js#transducers-js)
 * for more details on what transducers actually are.
 *
 * The `result` object that is passed in through the
 * [Transformer Protocol](https://github.com/cognitect-labs/transducers-js#transformer-protocol)
 * will be the `push` function provided by the [consume](#consume) transform.
 *
 * Like [scan](#scan), if the transducer throws an exception, the transform
 * will stop and emit that error. Any intermediate values that were produced
 * before the error will still be emitted.
 *
 * @id transduce
 * @section Transforms
 * @name Stream.transduce(xf)
 * @param {Function} xf - The transducer.
 * @api public
 *
 * var xf = require('transducer-js').map(_.add(1));
 * _([1, 2, 3, 4]).transduce(xf);
 * // => 2, 3, 4, 5
 */

Stream.prototype.transduce = function transduce(xf) {
    var transform = null,
        memo = null;

    return this.consume(function (err, x, push, next) {
        if (transform == null) {
            transform = xf(new HighlandTransform(push));
            memo = transform['@@transducer/init']();
        }

        if (err) {
            // Pass through errors, like we always do.
            push(err);
            next();
        }
        else if (x === _.nil) {
            // Push may be different from memo depending on the transducer that
            // we get.
            runResult(push, memo);
        }
        else {
            var res = runStep(push, memo, x);

            if (!res) {
                return;
            }

            memo = res;
            if (memo['@@transducer/reduced']) {
                runResult(memo['@@transducer/value']);
            }
            else {
                next();
            }
        }
    });

    function runResult(push, _memo) {
        try {
            transform['@@transducer/result'](_memo);
        }
        catch (e) {
            push(e);
        }
        push(null, _.nil);
    }

    function runStep(push, _memo, x) {
        try {
            return transform['@@transducer/step'](_memo, x);
        }
        catch (e) {
            push(e);
            push(null, _.nil);
            return null;
        }
    }
};
exposeMethod('transduce');

/**
 * Concatenates a Stream to the end of this Stream.
 *
 * Be aware that in the top-level export, the args may be in the reverse
 * order to what you'd expect `_([a], [b]) => b, a`, as this follows the
 * convention of other top-level exported functions which do `x` to `y`.
 *
 * @id concat
 * @section Higher-order Streams
 * @name Stream.concat(ys)
 * @param {Stream | Array} ys - the values to concatenate onto this Stream
 * @api public
 *
 * _([1, 2]).concat([3, 4])  // => 1, 2, 3, 4
 * _.concat([3, 4], [1, 2])  // => 1, 2, 3, 4
 */

Stream.prototype.concat = function (ys) {
    ys = _(ys);
    return this.consume(function (err, x, push, next) {
        if (x === nil) {
            next(ys);
        }
        else {
            push(err, x);
            next();
        }
    });
};
exposeMethod('concat');

/**
 * Takes a Stream of Streams and merges their values and errors into a
 * single new Stream. The merged stream ends when all source streams have
 * ended.
 *
 * Note that no guarantee is made with respect to the order in which
 * values for each stream end up in the merged stream. Values in the
 * merged stream will, however, respect the order they were emitted from
 * their respective streams.
 *
 * @id merge
 * @section Higher-order Streams
 * @name Stream.merge()
 * @api public
 *
 * var readFile = _.wrapCallback(fs.readFile);
 *
 * var txt = _(['foo.txt', 'bar.txt']).map(readFile)
 * var md = _(['baz.md']).map(readFile)
 *
 * _([txt, md]).merge();
 * // => contents of foo.txt, bar.txt and baz.txt in the order they were read
 */

Stream.prototype.merge = function () {
    var self = this;
    var srcs = [];

    var srcsNeedPull = [],
        first = true,
        async = false;

    return _(function (push, next) {
        if (first) {
            first = false;
            getSourcesSync(push, next);
        }

        if (srcs.length === 0) {
            push(null, nil);
        }
        else if (srcsNeedPull.length) {
            pullFromAllSources(push, next);
            next();
        }
        else {
            async = true;
        }
    });

    // Make a handler for the main merge loop.
    function srcPullHandler(push, next, src) {
        return function (err, x) {
            if (err) {
                push(err);
                srcsNeedPull.push(src);
            }
            else if (x === nil) {
                srcs = srcs.filter(function (s) {
                    return s !== src;
                });
            }
            else {
                if (src === self) {
                    srcs.push(x);
                    srcsNeedPull.push(x);
                    srcsNeedPull.unshift(self);
                }
                else {
                    push(null, x);
                    srcsNeedPull.push(src);
                }
            }

            if (async) {
                async = false;
                next();
            }
        };
    }


    function pullFromAllSources(push, next) {
        var _srcs = srcsNeedPull;
        srcsNeedPull = [];
        _srcs.forEach(function (src) {
            src.pull(srcPullHandler(push, next, src));
        });
    }

    // Pulls as many sources as possible from self synchronously.
    function getSourcesSync(push, next) {
        // Shadows the outer async variable.
        var asynchronous;
        var done = false;

        var pull_cb = function(err, x) {
            asynchronous = false;
            if (done) {
                // This means the pull was async. Handle like
                // regular async.
                srcPullHandler(push, next, self)(err, x);
            }
            else {
                if (err) {
                    push(err);
                }
                else if (x === nil) {
                    done = true;
                }
                else {
                    srcs.push(x);
                    srcsNeedPull.push(x);
                }
            }
        };

        while (!done) {
            asynchronous = true;
            self.pull(pull_cb);

            // Async behavior, record self as a src and return.
            if (asynchronous) {
                done = true;
                srcs.unshift(self);
            }
        }
    }

};
exposeMethod('merge');

/**
 * Takes a Stream of Streams and merges their values and errors into a
 * single new Stream, limitting the number of unpaused streams that can
 * running at any one time.
 *
 * Note that no guarantee is made with respect to the order in which
 * values for each stream end up in the merged stream. Values in the
 * merged stream will, however, respect the order they were emitted from
 * their respective streams.
 *
 * @id mergeWithLimit
 * @section Higher-order Streams
 * @name Stream.mergeWithLimit(n)
 * @param {Number} n - the maximum number of streams to run in parallel
 * @api public
 *
 * var readFile = _.wrapCallback(fs.readFile);
 *
 * var txt = _(['foo.txt', 'bar.txt']).flatMap(readFile)
 * var md = _(['baz.md']).flatMap(readFile)
 * var js = _(['bosh.js']).flatMap(readFile)
 *
 * _([txt, md, js]).mergeWithLimit(2);
 * // => contents of foo.txt, bar.txt, baz.txt and bosh.js in the order
 * // they were read, but bosh.js is not read until either foo.txt and bar.txt
 * // has completely been read or baz.md has been read
 */


Stream.prototype.mergeWithLimit = function (n){
    var self = this;
    var processCount = 0;
    var waiting = false;
    if (typeof n !== 'number' || n < 1) {
        throw new Error('mergeWithLimit expects a positive number, but got: ' + n);
    }

    if (n === Infinity) {
        return this.merge();
    }
    return _(function(push, next){
        self.pull(function(err, x){
            var done = x === nil;
            if (err){
                push(err);
                next();
            }
            else if (x === nil) {
                push(null, nil);
            }
            else {
                processCount++;
                push(err, x);
                // console.log('start', x.id);
                x._destructors.push(function(){
                    processCount--;
                    // console.log('end', x.id);
                    if (waiting) {
                        // console.log('get more');
                        waiting = false;
                        next();
                    }
                });
                if (!done && processCount < n) {
                    next();
                }
                else {
                    // console.log('wait till something ends');
                    waiting = true;
                }
            }

        });
    }).merge();
};
exposeMethod('mergeWithLimit');

/**
 * Calls a named method on each object from the Stream - returning
 * a new stream with the result of those calls.
 *
 * @id invoke
 * @section Transforms
 * @name Stream.invoke(method, args)
 * @param {String} method - the method name to call
 * @param {Array} args - the arguments to call the method with
 * @api public
 *
 * _(['foo', 'bar']).invoke('toUpperCase', [])  // => 'FOO', 'BAR'
 *
 * var readFile = _.wrapCallback(fs.readFile);
 * filenames.flatMap(readFile).invoke('toString', ['utf8']);
 */

Stream.prototype.invoke = function (method, args) {
    return this.map(function (x) {
        return x[method].apply(x, args);
    });
};
exposeMethod('invoke');

/**
 * Takes a Stream of callback-accepting node-style functions,
 * [wraps](#wrapCallback) each one into a stream-returning function,
 * calls them with the arguments provided, and returns the results
 * as a Stream.
 *
 * This can be used as a control flow shortcut and draws parallels
 * with some control flow functions from [async](https://github.com/caolan/async).
 * A few rough correspondences include:
 *
 * - `.nfcall([]).series()` to `async.series()`
 * - `.nfcall([]).parallel(n)` to `async.parallelLimit(n)`
 * - `.nfcall(args)` to `async.applyEach(..., args)`
 * - `.nfcall(args).series()` to `async.applyEachSeries(..., args)`
 *
 * @id nfcall
 * @section Transforms
 * @name Stream.nfcall(args)
 * @param {Array} args - the arguments to call each function with
 * @api public
 *
 * _([
 *   function (callback) {
 *     setTimeout(function () {
 *       callback(null, 'one');
 *     }, 200);
 *   },
 *   function (callback) {
 *     setTimeout(function () {
 *       callback(null, 'two');
 *     }, 100);
 *   }
 * ]).nfcall([]).parallel(2).toArray(function (xs) {
 *   // xs is ['one', 'two'] even though second function had a shorter timeout
 * });
 *
 * _([enableSearch, updateSchema]).nfcall(['bucket']).toArray(callback);
 * // does roughly the same as
 * async.applyEach([enableSearch, updateSchema], 'bucket', callback);
 *
 * _([
 *   fs.appendFile,
 *   fs.appendFile
 * ]).nfcall(['example.txt', 'hello']).series().toArray(function() {
 *   // example.txt now contains 'hellohello'
 * });
 *
 */

Stream.prototype.nfcall = function (args) {
    return this.map(function (x) {
        return _.wrapCallback(x).apply(x, args);
    });
};
exposeMethod('nfcall');

/**
 * Ensures that only one data event is push downstream (or into the buffer)
 * every `ms` milliseconds, any other values are dropped.
 *
 * @id throttle
 * @section Transforms
 * @name Stream.throttle(ms)
 * @param {Number} ms - the minimum milliseconds between each value
 * @api public
 *
 * _('mousemove', document).throttle(1000);
 */

Stream.prototype.throttle = function (ms) {
    var last = 0 - ms;
    return this.consume(function (err, x, push, next) {
        var now = new Date().getTime();
        if (err) {
            push(err);
            next();
        }
        else if (x === nil) {
            push(null, nil);
        }
        else if (now - ms >= last) {
            last = now;
            push(null, x);
            next();
        }
        else {
            next();
        }
    });
};
exposeMethod('throttle');

/**
 * Holds off pushing data events downstream until there has been no more
 * data for `ms` milliseconds. Sends the last value that occurred before
 * the delay, discarding all other values.
 *
 * **Implementation Note**: This transform will will not wait the full `ms`
 * delay to emit a pending value (if any) once it see a `nil`, as that
 * guarantees that there will be no more values.
 *
 * @id debounce
 * @section Transforms
 * @name Stream.debounce(ms)
 * @param {Number} ms - the milliseconds to wait before sending data
 * @api public
 *
 * function delay(x, ms, push) {
 *     setTimeout(function () {
 *         push(null, x);
 *     }, ms);
 * }
 *
 * // sends last keyup event after user has stopped typing for 1 second
 * $('keyup', textbox).debounce(1000);
 *
 * // A nil triggers the emit immediately
 * _(function (push, next) {
 *     delay(0, 100, push);
 *     delay(1, 200, push);
 *     delay(_.nil, 250, push);
 * }).debounce(75);
 * // => after 175ms => 1
 * // => after 250ms (not 275ms!) => 1 2
 */

Stream.prototype.debounce = function (ms) {
    var t = null;
    var nothing = {};
    var last = nothing;

    return this.consume(function (err, x, push, next) {
        if (err) {
            // let errors through regardless
            push(err);
            next();
        }
        else if (x === nil) {
            if (t) {
                clearTimeout(t);
            }
            if (last !== nothing) {
                push(null, last);
            }
            push(null, nil);
        }
        else {
            last = x;
            if (t) {
                clearTimeout(t);
            }
            t = setTimeout(push.bind(this, null, x), ms);
            next();
        }
    });
};
exposeMethod('debounce');

/**
 * Creates a new Stream, which when read from, only returns the last
 * seen value from the source. The source stream does not experience
 * back-pressure. Useful if you're using a Stream to model a changing
 * property which you need to query periodically.
 *
 * @id latest
 * @section Transforms
 * @name Stream.latest()
 * @api public
 *
 * // slowThing will always get the last known mouse position
 * // when it asks for more data from the mousePosition stream
 * mousePosition.latest().map(slowThing)
 */

Stream.prototype.latest = function () {
    var nothing = {},
        latest = nothing,
        errors = [],
        ended = false,
        onValue = null;

    this.consume(function (err, x, push, next) {
        if (onValue != null) {
            var cb = onValue;
            onValue = null;
            cb(err, x);
        }

        if (err) {
            errors.push(err);
            next();
        }
        else if (x === nil) {
            ended = true;
        }
        else {
            latest = x;
            next();
        }
    }).resume();

    return _(function (push, next) {
        var oldErrors = errors;
        errors = [];

        if (!oldErrors.length && latest === nothing && !ended) {
            // We haven't gotten any data yet. We can't call next
            // because that might cause the stream to call the generator
            // again, resulting in an infinite loop. Thus, we stick a
            // a callback to be called whenever we get a value.
            onValue = function (err, x) {
                push(err, x);
                if (x !== nil) {
                    next();
                }
            };
        }
        else {
            oldErrors.forEach(push);
            if (latest !== nothing) {
                push(null, latest);
            }
            if (ended) {
                push(null, nil);
            }
            else {
                next();
            }
        }
    });
};
exposeMethod('latest');

/**
 * Returns values from an Object as a Stream. Reads properties
 * lazily, so if you don't read from all keys on an object, not
 * all properties will be read from (may have an effect where getters
 * are used).
 *
 * @id values
 * @section Objects
 * @name _.values(obj)
 * @param {Object} obj - the object to return values from
 * @api public
 *
 * _.values({foo: 1, bar: 2, baz: 3})  // => 1, 2, 3
 */

_.values = function (obj) {
    return _.keys(obj).map(function (k) {
        return obj[k];
    });
};

/**
 * Returns keys from an Object as a Stream.
 *
 * @id keys
 * @section Objects
 * @name _.keys(obj)
 * @param {Object} obj - the object to return keys from
 * @api public
 *
 * _.keys({foo: 1, bar: 2, baz: 3})  // => 'foo', 'bar', 'baz'
 */

function keys (obj) {
    var keysArray = [];
    for (var k in obj) {
        if (hasOwn.call(obj, k)) {
            keysArray.push(k);
        }
    }
    return keysArray;
}

_.keys = function (obj) {
    return _(keys(obj));
};

/**
 * Returns key/value pairs for an Object as a Stream. Reads properties
 * lazily, so if you don't read from all keys on an object, not
 * all properties will be read from (may have an effect where getters
 * are used).
 *
 * @id pairs
 * @section Objects
 * @name _.pairs(obj)
 * @param {Object} obj - the object to return key/value pairs from
 * @api public
 *
 * _.pairs({foo: 1, bar: 2})  // => ['foo', 1], ['bar', 2]
 */

_.pairs = function (obj) {
    return _.keys(obj).map(function (k) {
        return [k, obj[k]];
    });
};

/**
 * Extends one object with the properties of another. **Note:** The
 * arguments are in the reverse order of other libraries such as
 * underscore. This is so it follows the convention of other functions in
 * this library and so you can more meaningfully partially apply it.
 *
 * @id extend
 * @section Objects
 * @name _.extend(a, b)
 * @param {Object} a - the properties to extend b with
 * @param {Object} b - the original object to extend
 * @api public
 *
 * _.extend({name: 'bar'}, {name: 'foo', price: 20})
 * // => {name: 'bar', price: 20}
 *
 * // example of partial application
 * var publish = _.extend({published: true});
 *
 * publish({title: 'test post'})
 * // => {title: 'test post', published: true}
 */

_.extend = _.curry(function (extensions, target) {
    for (var k in extensions) {
        if (hasOwn.call(extensions, k)) {
            target[k] = extensions[k];
        }
    }
    return target;
});

/**
 * Returns a property from an object.
 *
 * @id get
 * @section Objects
 * @name _.get(prop, obj)
 * @param {String} prop - the property to return
 * @param {Object} obj - the object to read properties from
 * @api public
 *
 * var obj = {foo: 'bar', baz: 123};
 * _.get('foo', obj) // => 'bar'
 *
 * // making use of partial application
 * var posts = [
 *   {title: 'one'},
 *   {title: 'two'},
 *   {title: 'three'}
 * ];
 *
 * _(posts).map(_.get('title'))  // => 'one', 'two', 'three'
 */

_.get = _.curry(function (prop, obj) {
    return obj[prop];
});

/**
 * Updates a property on an object, returning the updated object.
 *
 * @id set
 * @section Objects
 * @name _.set(prop, value, obj)
 * @param {String} prop - the property to return
 * @param value - the value to set the property to
 * @param {Object} obj - the object to set properties on
 * @api public
 *
 * var obj = {foo: 'bar', baz: 123};
 * _.set('foo', 'wheeee', obj) // => {foo: 'wheeee', baz: 123}
 *
 * // making use of partial application
 * var publish = _.set('published', true);
 *
 * publish({title: 'example'})  // => {title: 'example', published: true}
 */

_.set = _.curry(function (prop, val, obj) {
    obj[prop] = val;
    return obj;
});

/**
 * Logs values to the console, a simple wrapper around `console.log` that
 * it suitable for passing to other functions by reference without having to
 * call `bind`.
 *
 * @id log
 * @section Utils
 * @name _.log(args..)
 * @api public
 *
 * _.log('Hello, world!');
 *
 * _([1, 2, 3, 4]).each(_.log);
 */

_.log = function () {
    console.log.apply(console, arguments);
};

/**
 * Wraps a node-style async function which accepts a callback, transforming
 * it to a function which accepts the same arguments minus the callback and
 * returns a Highland Stream instead. The wrapped function keeps its context,
 * so you can safely use it as a method without binding (see the second
 * example below).
 *
 * `wrapCallback` also accepts an optional `mappingHint`, which specifies how
 * callback arguments are pushed to the stream. This can be used to handle
 * non-standard callback protocols that pass back more than one value.
 *
 * `mappingHint` can be a function, number, or array. See the documentation on
 * [EventEmitter Stream Objects](#Stream Objects) for details on the mapping
 * hint. If `mappingHint` is a function, it will be called with all but the
 * first argument that is passed to the callback. The first is still assumed to
 * be the error argument.
 *
 * @id wrapCallback
 * @section Utils
 * @name _.wrapCallback(f)
 * @param {Function} f - the node-style function to wrap
 * @param {Array | Function | Number} mappingHint - (optional) how to pass the
 * arguments to the callback
 * @api public
 *
 * var fs = require('fs');
 *
 * var readFile = _.wrapCallback(fs.readFile);
 *
 * readFile('example.txt').apply(function (data) {
 *     // data is now the contents of example.txt
 * });
 *
 * function Reader(file) {
 *     this.file = file;
 * }
 *
 * Reader.prototype.read = function(cb) {
 *     fs.readFile(this.file, cb);
 * };
 *
 * Reader.prototype.readStream = _.wrapCallback(Reader.prototype.read);
 */

/*eslint-disable no-multi-spaces */
_.wrapCallback = function (f, /*optional*/mappingHint) {
    /*eslint-enable no-multi-spaces */
    var mapper = hintMapper(mappingHint);

    return function () {
        var self = this;
        var args = slice.call(arguments);
        return _(function (push) {
            var cb = function (err) {
                if (err) {
                    push(err);
                }
                else {
                    var cbArgs = slice.call(arguments, 1);
                    var v = mapper.apply(this, cbArgs);
                    push(null, v);
                }
                push(null, nil);
            };
            f.apply(self, args.concat([cb]));
        });
    };
};

/**
 * Takes an object or a constructor function and returns that object or
 * constructor with streamified versions of its function properties.
 * Passed constructors will also have their prototype functions
 * streamified.  This is useful for wrapping many node style async
 * functions at once, and for preserving those functions' context.
 *
 * @id streamifyAll
 * @section Utils
 * @name _.streamifyAll(source)
 * @param {Object | Function} source - the function or object with
 * node-style function properties.
 * @api public
 *
 * var fs = _.streamifyAll(require('fs'));
 *
 * fs.readFileStream('example.txt').apply(function (data) {
 *     // data is now the contents of example.txt
 * });
 */

function isClass (fn) {
    if (!(typeof fn === 'function' && fn.prototype)) { return false; }
    var getKeys = isES5 ? Object.getOwnPropertyNames : keys;
    var allKeys = getKeys(fn.prototype);
    return allKeys.length > 0 && !(allKeys.length === 1 &&
            allKeys[0] === 'constructor');
}

function inheritedKeys (obj) {
    var allProps = {};
    var curr = obj;
    var handleProp = function (prop) {
        allProps[prop] = true;
    };
    while (Object.getPrototypeOf(curr)) {
        var props = Object.getOwnPropertyNames(curr);
        props.forEach(handleProp);
        curr = Object.getPrototypeOf(curr);
    }
    return keys(allProps);
}

function streamifyAll (inp, suffix) {
    // will not streamify inherited functions in ES3
    var getKeys = isES5 ? inheritedKeys : keys;
    var allKeys = getKeys(inp);

    for (var i = 0, len = allKeys.length; i < len; i++) {
        var key = allKeys[i];
        var val;

        // will skip context aware getters
        try {
            val = inp[key];
        }
        catch (e) {
            // Ignore
        }

        if (val && typeof val === 'function' && !isClass(val) &&
                !val.__HighlandStreamifiedFunction__) {

            var streamified = _.wrapCallback(val);
            streamified.__HighlandStreamifiedFunction__ = true;
            inp[key + suffix] = streamified;
        }
    }
    return inp;
}

_.streamifyAll = function (arg) {
    if (typeof arg !== 'function' && typeof arg !== 'object') {
        throw new TypeError('takes an object or a constructor function');
    }
    var suffix = 'Stream';

    var ret = streamifyAll(arg, suffix);
    if (isClass(arg)) {
        ret.prototype = streamifyAll(arg.prototype, suffix);
    }
    return ret;
};

/**
 * Add two values. Can be partially applied.
 *
 * @id add
 * @section Operators
 * @name _.add(a, b)
 * @api public
 *
 * _.add(1, 2) === 3
 * _.add(1)(5) === 6
 */

_.add = _.curry(function (a, b) {
    return a + b;
});

/**
 * Perform logical negation on a value. If `x` is truthy then returns false,
 * otherwise returns true.
 *
 * @id not
 * @section Operators
 * @name _.not(x)
 * @param x - the value to negate
 * @api public
 *
 * _.not(true)   // => false
 * _.not(false)  // => true
 */

_.not = function (x) {
    return !x;
};

}).call(this,require('_process'),typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"_process":6,"events":5,"string_decoder":7,"util":10,"util-deprecate":12}],12:[function(require,module,exports){
(function (global){

/**
 * Module exports.
 */

module.exports = deprecate;

/**
 * Mark that a method should not be used.
 * Returns a modified function which warns once by default.
 *
 * If `localStorage.noDeprecation = true` is set, then it is a no-op.
 *
 * If `localStorage.throwDeprecation = true` is set, then deprecated functions
 * will throw an Error when invoked.
 *
 * If `localStorage.traceDeprecation = true` is set, then deprecated functions
 * will invoke `console.trace()` instead of `console.error()`.
 *
 * @param {Function} fn - the function to deprecate
 * @param {String} msg - the string to print to the console when `fn` is invoked
 * @returns {Function} a new "deprecated" version of `fn`
 * @api public
 */

function deprecate (fn, msg) {
  if (config('noDeprecation')) {
    return fn;
  }

  var warned = false;
  function deprecated() {
    if (!warned) {
      if (config('throwDeprecation')) {
        throw new Error(msg);
      } else if (config('traceDeprecation')) {
        console.trace(msg);
      } else {
        console.warn(msg);
      }
      warned = true;
    }
    return fn.apply(this, arguments);
  }

  return deprecated;
}

/**
 * Checks `localStorage` for boolean values for the given `name`.
 *
 * @param {String} name
 * @returns {Boolean}
 * @api private
 */

function config (name) {
  // accessing global.localStorage can trigger a DOMException in sandboxed iframes
  try {
    if (!global.localStorage) return false;
  } catch (_) {
    return false;
  }
  var val = global.localStorage[name];
  if (null == val) return false;
  return String(val).toLowerCase() === 'true';
}

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{}],13:[function(require,module,exports){
//  Ramda v0.13.0
//  https://github.com/ramda/ramda
//  (c) 2013-2015 Scott Sauyet, Michael Hurley, and David Chambers
//  Ramda may be freely distributed under the MIT license.

;(function() {

  'use strict';

  /**
     * A special placeholder value used to specify "gaps" within curried functions,
     * allowing partial application of any combination of arguments,
     * regardless of their positions.
     *
     * If `g` is a curried ternary function and `_` is `R.__`, the following are equivalent:
     *
     *   - `g(1, 2, 3)`
     *   - `g(_, 2, 3)(1)`
     *   - `g(_, _, 3)(1)(2)`
     *   - `g(_, _, 3)(1, 2)`
     *   - `g(_, 2, _)(1, 3)`
     *   - `g(_, 2)(1)(3)`
     *   - `g(_, 2)(1, 3)`
     *   - `g(_, 2)(_, 3)(1)`
     *
     * @constant
     * @memberOf R
     * @category Function
     * @example
     *
     *      var greet = R.replace('{name}', R.__, 'Hello, {name}!');
     *      greet('Alice'); //=> 'Hello, Alice!'
     */
    var __ = { ramda: 'placeholder' };

    var _add = function _add(a, b) {
        return a + b;
    };

    var _all = function _all(fn, list) {
        var idx = -1;
        while (++idx < list.length) {
            if (!fn(list[idx])) {
                return false;
            }
        }
        return true;
    };

    var _any = function _any(fn, list) {
        var idx = -1;
        while (++idx < list.length) {
            if (fn(list[idx])) {
                return true;
            }
        }
        return false;
    };

    var _assoc = function _assoc(prop, val, obj) {
        var result = {};
        for (var p in obj) {
            result[p] = obj[p];
        }
        result[prop] = val;
        return result;
    };

    var _cloneRegExp = function _cloneRegExp(pattern) {
        return new RegExp(pattern.source, (pattern.global ? 'g' : '') + (pattern.ignoreCase ? 'i' : '') + (pattern.multiline ? 'm' : '') + (pattern.sticky ? 'y' : '') + (pattern.unicode ? 'u' : ''));
    };

    var _complement = function _complement(f) {
        return function () {
            return !f.apply(this, arguments);
        };
    };

    /**
     * Basic, right-associative composition function. Accepts two functions and returns the
     * composite function; this composite function represents the operation `var h = f(g(x))`,
     * where `f` is the first argument, `g` is the second argument, and `x` is whatever
     * argument(s) are passed to `h`.
     *
     * This function's main use is to build the more general `compose` function, which accepts
     * any number of functions.
     *
     * @private
     * @category Function
     * @param {Function} f A function.
     * @param {Function} g A function.
     * @return {Function} A new function that is the equivalent of `f(g(x))`.
     * @example
     *
     *      var double = function(x) { return x * 2; };
     *      var square = function(x) { return x * x; };
     *      var squareThenDouble = _compose(double, square);
     *
     *      squareThenDouble(5); //≅ double(square(5)) => 50
     */
    var _compose = function _compose(f, g) {
        return function () {
            return f.call(this, g.apply(this, arguments));
        };
    };

    /**
     * Private `concat` function to merge two array-like objects.
     *
     * @private
     * @param {Array|Arguments} [set1=[]] An array-like object.
     * @param {Array|Arguments} [set2=[]] An array-like object.
     * @return {Array} A new, merged array.
     * @example
     *
     *      _concat([4, 5, 6], [1, 2, 3]); //=> [4, 5, 6, 1, 2, 3]
     */
    var _concat = function _concat(set1, set2) {
        set1 = set1 || [];
        set2 = set2 || [];
        var idx;
        var len1 = set1.length;
        var len2 = set2.length;
        var result = [];
        idx = -1;
        while (++idx < len1) {
            result[result.length] = set1[idx];
        }
        idx = -1;
        while (++idx < len2) {
            result[result.length] = set2[idx];
        }
        return result;
    };

    var _containsWith = function _containsWith(pred, x, list) {
        var idx = -1, len = list.length;
        while (++idx < len) {
            if (pred(x, list[idx])) {
                return true;
            }
        }
        return false;
    };

    var _createMapEntry = function _createMapEntry(key, val) {
        var obj = {};
        obj[key] = val;
        return obj;
    };

    /**
     * Create a function which takes a comparator function and a list
     * and determines the winning value by a compatator. Used internally
     * by `R.maxBy` and `R.minBy`
     *
     * @private
     * @param {Function} compatator a function to compare two items
     * @category Math
     * @return {Function}
     */
    var _createMaxMinBy = function _createMaxMinBy(comparator) {
        return function (valueComputer, list) {
            if (!(list && list.length > 0)) {
                return;
            }
            var idx = 0;
            var winner = list[idx];
            var computedWinner = valueComputer(winner);
            var computedCurrent;
            while (++idx < list.length) {
                computedCurrent = valueComputer(list[idx]);
                if (comparator(computedCurrent, computedWinner)) {
                    computedWinner = computedCurrent;
                    winner = list[idx];
                }
            }
            return winner;
        };
    };

    /**
     * Optimized internal two-arity curry function.
     *
     * @private
     * @category Function
     * @param {Function} fn The function to curry.
     * @return {Function} The curried function.
     */
    var _curry1 = function _curry1(fn) {
        return function f1(a) {
            if (arguments.length === 0) {
                return f1;
            } else if (a === __) {
                return f1;
            } else {
                return fn(a);
            }
        };
    };

    /**
     * Optimized internal two-arity curry function.
     *
     * @private
     * @category Function
     * @param {Function} fn The function to curry.
     * @return {Function} The curried function.
     */
    var _curry2 = function _curry2(fn) {
        return function f2(a, b) {
            var n = arguments.length;
            if (n === 0) {
                return f2;
            } else if (n === 1 && a === __) {
                return f2;
            } else if (n === 1) {
                return _curry1(function (b) {
                    return fn(a, b);
                });
            } else if (n === 2 && a === __ && b === __) {
                return f2;
            } else if (n === 2 && a === __) {
                return _curry1(function (a) {
                    return fn(a, b);
                });
            } else if (n === 2 && b === __) {
                return _curry1(function (b) {
                    return fn(a, b);
                });
            } else {
                return fn(a, b);
            }
        };
    };

    /**
     * Optimized internal three-arity curry function.
     *
     * @private
     * @category Function
     * @param {Function} fn The function to curry.
     * @return {Function} The curried function.
     */
    var _curry3 = function _curry3(fn) {
        return function f3(a, b, c) {
            var n = arguments.length;
            if (n === 0) {
                return f3;
            } else if (n === 1 && a === __) {
                return f3;
            } else if (n === 1) {
                return _curry2(function (b, c) {
                    return fn(a, b, c);
                });
            } else if (n === 2 && a === __ && b === __) {
                return f3;
            } else if (n === 2 && a === __) {
                return _curry2(function (a, c) {
                    return fn(a, b, c);
                });
            } else if (n === 2 && b === __) {
                return _curry2(function (b, c) {
                    return fn(a, b, c);
                });
            } else if (n === 2) {
                return _curry1(function (c) {
                    return fn(a, b, c);
                });
            } else if (n === 3 && a === __ && b === __ && c === __) {
                return f3;
            } else if (n === 3 && a === __ && b === __) {
                return _curry2(function (a, b) {
                    return fn(a, b, c);
                });
            } else if (n === 3 && a === __ && c === __) {
                return _curry2(function (a, c) {
                    return fn(a, b, c);
                });
            } else if (n === 3 && b === __ && c === __) {
                return _curry2(function (b, c) {
                    return fn(a, b, c);
                });
            } else if (n === 3 && a === __) {
                return _curry1(function (a) {
                    return fn(a, b, c);
                });
            } else if (n === 3 && b === __) {
                return _curry1(function (b) {
                    return fn(a, b, c);
                });
            } else if (n === 3 && c === __) {
                return _curry1(function (c) {
                    return fn(a, b, c);
                });
            } else {
                return fn(a, b, c);
            }
        };
    };

    var _dissoc = function _dissoc(prop, obj) {
        var result = {};
        for (var p in obj) {
            if (p !== prop) {
                result[p] = obj[p];
            }
        }
        return result;
    };

    var _filter = function _filter(fn, list) {
        var idx = -1, len = list.length, result = [];
        while (++idx < len) {
            if (fn(list[idx])) {
                result[result.length] = list[idx];
            }
        }
        return result;
    };

    var _filterIndexed = function _filterIndexed(fn, list) {
        var idx = -1, len = list.length, result = [];
        while (++idx < len) {
            if (fn(list[idx], idx, list)) {
                result[result.length] = list[idx];
            }
        }
        return result;
    };

    // i can't bear not to return *something*
    var _forEach = function _forEach(fn, list) {
        var idx = -1, len = list.length;
        while (++idx < len) {
            fn(list[idx]);
        }
        // i can't bear not to return *something*
        return list;
    };

    /**
     * @private
     * @param {Function} fn The strategy for extracting function names from an object
     * @return {Function} A function that takes an object and returns an array of function names.
     */
    var _functionsWith = function _functionsWith(fn) {
        return function (obj) {
            return _filter(function (key) {
                return typeof obj[key] === 'function';
            }, fn(obj));
        };
    };

    var _gt = function _gt(a, b) {
        return a > b;
    };

    var _has = function _has(prop, obj) {
        return Object.prototype.hasOwnProperty.call(obj, prop);
    };

    var _identity = function _identity(x) {
        return x;
    };

    /**
     * Internal implementation of `indexOf`.
     * Returns the position of the first occurrence of an item in an array
     * (by strict equality),
     * or -1 if the item is not included in the array.
     *
     * @private
     * @param {Array} list The array to search
     * @param {*} item the item to find in the Array
     * @param {Number} from (optional) the index to start searching the Array
     * @return {Number} The index of the found item, or -1.
     */
    var _indexOf = function _indexOf(list, item, from) {
        var idx = 0, len = list.length;
        if (typeof from == 'number') {
            idx = from < 0 ? Math.max(0, len + from) : from;
        }
        while (idx < len) {
            if (list[idx] === item) {
                return idx;
            }
            ++idx;
        }
        return -1;
    };

    /**
     * Tests whether or not an object is an array.
     *
     * @private
     * @param {*} val The object to test.
     * @return {Boolean} `true` if `val` is an array, `false` otherwise.
     * @example
     *
     *      _isArray([]); //=> true
     *      _isArray(null); //=> false
     *      _isArray({}); //=> false
     */
    var _isArray = Array.isArray || function _isArray(val) {
        return val != null && val.length >= 0 && Object.prototype.toString.call(val) === '[object Array]';
    };

    /**
     * Determine if the passed argument is an integer.
     *
     * @private
     * @param {*} n
     * @category Type
     * @return {Boolean}
     */
    var _isInteger = Number.isInteger || function _isInteger(n) {
        return n << 0 === n;
    };

    /**
     * Tests if a value is a thenable (promise).
     */
    var _isThenable = function _isThenable(value) {
        return value != null && value === Object(value) && typeof value.then === 'function';
    };

    var _isTransformer = function _isTransformer(obj) {
        return typeof obj.step === 'function' && typeof obj.result === 'function';
    };

    /**
     * Internal implementation of `lastIndexOf`.
     * Returns the position of the last occurrence of an item in an array
     * (by strict equality),
     * or -1 if the item is not included in the array.
     *
     * @private
     * @param {Array} list The array to search
     * @param {*} item the item to find in the Array
     * @param {Number} from (optional) the index to start searching the Array
     * @return {Number} The index of the found item, or -1.
     */
    var _lastIndexOf = function _lastIndexOf(list, item, from) {
        var idx = list.length;
        if (typeof from == 'number') {
            idx = from < 0 ? idx + from + 1 : Math.min(idx, from + 1);
        }
        while (--idx >= 0) {
            if (list[idx] === item) {
                return idx;
            }
        }
        return -1;
    };

    var _lt = function _lt(a, b) {
        return a < b;
    };

    var _map = function _map(fn, list) {
        var idx = -1, len = list.length, result = [];
        while (++idx < len) {
            result[idx] = fn(list[idx]);
        }
        return result;
    };

    var _multiply = function _multiply(a, b) {
        return a * b;
    };

    var _nth = function _nth(n, list) {
        return n < 0 ? list[list.length + n] : list[n];
    };

    /**
     * internal path function
     * Takes an array, paths, indicating the deep set of keys
     * to find.
     *
     * @private
     * @memberOf R
     * @category Object
     * @param {Array} paths An array of strings to map to object properties
     * @param {Object} obj The object to find the path in
     * @return {Array} The value at the end of the path or `undefined`.
     * @example
     *
     *      _path(['a', 'b'], {a: {b: 2}}); //=> 2
     */
    var _path = function _path(paths, obj) {
        if (obj == null || paths.length === 0) {
            return;
        } else {
            var val = obj;
            for (var idx = 0, len = paths.length; idx < len && val != null; idx += 1) {
                val = val[paths[idx]];
            }
            return val;
        }
    };

    var _prepend = function _prepend(el, list) {
        return _concat([el], list);
    };

    var _reduced = function (x) {
        return x && x.__transducers_reduced__ ? x : {
            value: x,
            __transducers_reduced__: true
        };
    };

    /**
     * internal helper for `where`
     *
     * @private
     * @see R.where
     */
    var _satisfiesSpec = function _satisfiesSpec(spec, parsedSpec, testObj) {
        if (spec === testObj) {
            return true;
        }
        if (testObj == null) {
            return false;
        }
        parsedSpec.fn = parsedSpec.fn || [];
        parsedSpec.obj = parsedSpec.obj || [];
        var key, val, idx = -1, fnLen = parsedSpec.fn.length, j = -1, objLen = parsedSpec.obj.length;
        while (++idx < fnLen) {
            key = parsedSpec.fn[idx];
            val = spec[key];
            if (!(key in testObj)) {
                return false;
            }
            if (!val(testObj[key], testObj)) {
                return false;
            }
        }
        while (++j < objLen) {
            key = parsedSpec.obj[j];
            if (spec[key] !== testObj[key]) {
                return false;
            }
        }
        return true;
    };

    /**
     * An optimized, private array `slice` implementation.
     *
     * @private
     * @param {Arguments|Array} args The array or arguments object to consider.
     * @param {Number} [from=0] The array index to slice from, inclusive.
     * @param {Number} [to=args.length] The array index to slice to, exclusive.
     * @return {Array} A new, sliced array.
     * @example
     *
     *      _slice([1, 2, 3, 4, 5], 1, 3); //=> [2, 3]
     *
     *      var firstThreeArgs = function(a, b, c, d) {
     *        return _slice(arguments, 0, 3);
     *      };
     *      firstThreeArgs(1, 2, 3, 4); //=> [1, 2, 3]
     */
    var _slice = function _slice(args, from, to) {
        switch (arguments.length) {
        case 1:
            return _slice(args, 0, args.length);
        case 2:
            return _slice(args, from, args.length);
        default:
            var length = Math.max(0, to - from), list = [], idx = -1;
            while (++idx < length) {
                list[idx] = args[from + idx];
            }
            return list;
        }
    };

    var _xall = function () {
        function XAll(f, xf) {
            this.xf = xf;
            this.f = f;
            this.all = true;
        }
        XAll.prototype.init = function () {
            return this.xf.init();
        };
        XAll.prototype.result = function (result) {
            if (this.all) {
                result = this.xf.step(result, true);
            }
            return this.xf.result(result);
        };
        XAll.prototype.step = function (result, input) {
            if (!this.f(input)) {
                this.all = false;
                result = _reduced(this.xf.step(result, false));
            }
            return result;
        };
        return _curry2(function _xall(f, xf) {
            return new XAll(f, xf);
        });
    }();

    var _xany = function () {
        function XAny(f, xf) {
            this.xf = xf;
            this.f = f;
            this.any = false;
        }
        XAny.prototype.init = function () {
            return this.xf.init();
        };
        XAny.prototype.result = function (result) {
            if (!this.any) {
                result = this.xf.step(result, false);
            }
            return this.xf.result(result);
        };
        XAny.prototype.step = function (result, input) {
            if (this.f(input)) {
                this.any = true;
                result = _reduced(this.xf.step(result, true));
            }
            return result;
        };
        return _curry2(function _xany(f, xf) {
            return new XAny(f, xf);
        });
    }();

    var _xdrop = function () {
        function XDrop(n, xf) {
            this.xf = xf;
            this.n = n;
        }
        XDrop.prototype.init = function () {
            return this.xf.init();
        };
        XDrop.prototype.result = function (result) {
            return this.xf.result(result);
        };
        XDrop.prototype.step = function (result, input) {
            if (this.n > 0) {
                this.n -= 1;
                return result;
            }
            return this.xf.step(result, input);
        };
        return _curry2(function _xdrop(n, xf) {
            return new XDrop(n, xf);
        });
    }();

    var _xdropWhile = function () {
        function XDropWhile(f, xf) {
            this.xf = xf;
            this.f = f;
        }
        XDropWhile.prototype.init = function () {
            return this.xf.init();
        };
        XDropWhile.prototype.result = function (result) {
            return this.xf.result(result);
        };
        XDropWhile.prototype.step = function (result, input) {
            if (this.f) {
                if (this.f(input)) {
                    return result;
                }
                this.f = null;
            }
            return this.xf.step(result, input);
        };
        return _curry2(function _xdropWhile(f, xf) {
            return new XDropWhile(f, xf);
        });
    }();

    var _xfilter = function () {
        function XFilter(f, xf) {
            this.xf = xf;
            this.f = f;
        }
        XFilter.prototype.init = function () {
            return this.xf.init();
        };
        XFilter.prototype.result = function (result) {
            return this.xf.result(result);
        };
        XFilter.prototype.step = function (result, input) {
            return this.f(input) ? this.xf.step(result, input) : result;
        };
        return _curry2(function _xfilter(f, xf) {
            return new XFilter(f, xf);
        });
    }();

    var _xfind = function () {
        function XFind(f, xf) {
            this.xf = xf;
            this.f = f;
            this.found = false;
        }
        XFind.prototype.init = function () {
            return this.xf.init();
        };
        XFind.prototype.result = function (result) {
            if (!this.found) {
                result = this.xf.step(result, void 0);
            }
            return this.xf.result(result);
        };
        XFind.prototype.step = function (result, input) {
            if (this.f(input)) {
                this.found = true;
                result = _reduced(this.xf.step(result, input));
            }
            return result;
        };
        return _curry2(function _xfind(f, xf) {
            return new XFind(f, xf);
        });
    }();

    var _xfindIndex = function () {
        function XFindIndex(f, xf) {
            this.xf = xf;
            this.f = f;
            this.idx = -1;
            this.found = false;
        }
        XFindIndex.prototype.init = function () {
            return this.xf.init();
        };
        XFindIndex.prototype.result = function (result) {
            if (!this.found) {
                result = this.xf.step(result, -1);
            }
            return this.xf.result(result);
        };
        XFindIndex.prototype.step = function (result, input) {
            this.idx += 1;
            if (this.f(input)) {
                this.found = true;
                result = _reduced(this.xf.step(result, this.idx));
            }
            return result;
        };
        return _curry2(function _xfindIndex(f, xf) {
            return new XFindIndex(f, xf);
        });
    }();

    var _xfindLast = function () {
        function XFindLast(f, xf) {
            this.xf = xf;
            this.f = f;
        }
        XFindLast.prototype.init = function () {
            return this.xf.init();
        };
        XFindLast.prototype.result = function (result) {
            return this.xf.result(this.xf.step(result, this.last));
        };
        XFindLast.prototype.step = function (result, input) {
            if (this.f(input)) {
                this.last = input;
            }
            return result;
        };
        return _curry2(function _xfindLast(f, xf) {
            return new XFindLast(f, xf);
        });
    }();

    var _xfindLastIndex = function () {
        function XFindLastIndex(f, xf) {
            this.xf = xf;
            this.f = f;
            this.idx = -1;
            this.lastIdx = -1;
        }
        XFindLastIndex.prototype.init = function () {
            return this.xf.init();
        };
        XFindLastIndex.prototype.result = function (result) {
            return this.xf.result(this.xf.step(result, this.lastIdx));
        };
        XFindLastIndex.prototype.step = function (result, input) {
            this.idx += 1;
            if (this.f(input)) {
                this.lastIdx = this.idx;
            }
            return result;
        };
        return _curry2(function _xfindLastIndex(f, xf) {
            return new XFindLastIndex(f, xf);
        });
    }();

    var _xmap = function () {
        function XMap(f, xf) {
            this.xf = xf;
            this.f = f;
        }
        XMap.prototype.init = function () {
            return this.xf.init();
        };
        XMap.prototype.result = function (result) {
            return this.xf.result(result);
        };
        XMap.prototype.step = function (result, input) {
            return this.xf.step(result, this.f(input));
        };
        return _curry2(function _xmap(f, xf) {
            return new XMap(f, xf);
        });
    }();

    var _xtake = function () {
        function XTake(n, xf) {
            this.xf = xf;
            this.n = n;
        }
        XTake.prototype.init = function () {
            return this.xf.init();
        };
        XTake.prototype.result = function (result) {
            return this.xf.result(result);
        };
        XTake.prototype.step = function (result, input) {
            this.n -= 1;
            return this.n === 0 ? _reduced(this.xf.step(result, input)) : this.xf.step(result, input);
        };
        return _curry2(function _xtake(n, xf) {
            return new XTake(n, xf);
        });
    }();

    var _xtakeWhile = function () {
        function XTakeWhile(f, xf) {
            this.xf = xf;
            this.f = f;
        }
        XTakeWhile.prototype.init = function () {
            return this.xf.init();
        };
        XTakeWhile.prototype.result = function (result) {
            return this.xf.result(result);
        };
        XTakeWhile.prototype.step = function (result, input) {
            return this.f(input) ? this.xf.step(result, input) : _reduced(result);
        };
        return _curry2(function _xtakeWhile(f, xf) {
            return new XTakeWhile(f, xf);
        });
    }();

    var _xwrap = function () {
        function XWrap(fn) {
            this.f = fn;
        }
        XWrap.prototype.init = function () {
            throw new Error('init not implemented on XWrap');
        };
        XWrap.prototype.result = function (acc) {
            return acc;
        };
        XWrap.prototype.step = function (acc, x) {
            return this.f(acc, x);
        };
        return function _xwrap(fn) {
            return new XWrap(fn);
        };
    }();

    /**
     * Adds two numbers (or strings). Equivalent to `a + b` but curried.
     *
     * @func
     * @memberOf R
     * @category Math
     * @sig Number -> Number -> Number
     * @sig String -> String -> String
     * @param {Number|String} a The first value.
     * @param {Number|String} b The second value.
     * @return {Number|String} The result of `a + b`.
     * @example
     *
     *      R.add(2, 3);       //=>  5
     *      R.add(7)(10);      //=> 17
     */
    var add = _curry2(_add);

    /**
     * Returns a function that always returns the given value. Note that for non-primitives the value
     * returned is a reference to the original value.
     *
     * @func
     * @memberOf R
     * @category Function
     * @sig a -> (* -> a)
     * @param {*} val The value to wrap in a function
     * @return {Function} A Function :: * -> val.
     * @example
     *
     *      var t = R.always('Tee');
     *      t(); //=> 'Tee'
     */
    var always = _curry1(function always(val) {
        return function () {
            return val;
        };
    });

    /**
     * A function that returns the first argument if it's falsy otherwise the second
     * argument. Note that this is NOT short-circuited, meaning that if expressions
     * are passed they are both evaluated.
     *
     * @func
     * @memberOf R
     * @category Logic
     * @sig * -> * -> *
     * @param {*} a any value
     * @param {*} b any other value
     * @return {*} the first argument if falsy otherwise the second argument.
     * @example
     *
     *      R.and(false, true); //=> true
     *      R.and(0, []); //=> []
     *      R.and(null, ''); => false
     */
    var and = _curry2(function and(a, b) {
        return a && b;
    });

    /**
     * Returns a new list, composed of n-tuples of consecutive elements
     * If `n` is greater than the length of the list, an empty list is returned.
     *
     * @func
     * @memberOf R
     * @category List
     * @sig Number -> [a] -> [[a]]
     * @param {Number} n The size of the tuples to create
     * @param {Array} list The list to split into `n`-tuples
     * @return {Array} The new list.
     * @example
     *
     *      R.aperture(2, [1, 2, 3, 4, 5]); //=> [[1, 2], [2, 3], [3, 4], [4, 5]]
     *      R.aperture(3, [1, 2, 3, 4, 5]); //=> [[1, 2, 3], [2, 3, 4], [3, 4, 5]]
     *      R.aperture(7, [1, 2, 3, 4, 5]); //=> []
     */
    var aperture = _curry2(function aperture(n, list) {
        var idx = -1;
        var limit = list.length - (n - 1);
        var acc = new Array(limit >= 0 ? limit : 0);
        while (++idx < limit) {
            acc[idx] = _slice(list, idx, idx + n);
        }
        return acc;
    });

    /**
     * Applies function `fn` to the argument list `args`. This is useful for
     * creating a fixed-arity function from a variadic function. `fn` should
     * be a bound function if context is significant.
     *
     * @func
     * @memberOf R
     * @category Function
     * @sig (*... -> a) -> [*] -> a
     * @param {Function} fn
     * @param {Array} args
     * @return {*}
     * @example
     *
     *      var nums = [1, 2, 3, -99, 42, 6, 7];
     *      R.apply(Math.max, nums); //=> 42
     */
    var apply = _curry2(function apply(fn, args) {
        return fn.apply(this, args);
    });

    /**
     * Wraps a function of any arity (including nullary) in a function that accepts exactly `n`
     * parameters. Unlike `nAry`, which passes only `n` arguments to the wrapped function,
     * functions produced by `arity` will pass all provided arguments to the wrapped function.
     *
     * @func
     * @memberOf R
     * @sig (Number, (* -> *)) -> (* -> *)
     * @category Function
     * @param {Number} n The desired arity of the returned function.
     * @param {Function} fn The function to wrap.
     * @return {Function} A new function wrapping `fn`. The new function is
     *         guaranteed to be of arity `n`.
     * @example
     *
     *      var takesTwoArgs = function(a, b) {
     *        return [a, b];
     *      };
     *      takesTwoArgs.length; //=> 2
     *      takesTwoArgs(1, 2); //=> [1, 2]
     *
     *      var takesOneArg = R.arity(1, takesTwoArgs);
     *      takesOneArg.length; //=> 1
     *      // All arguments are passed through to the wrapped function
     *      takesOneArg(1, 2); //=> [1, 2]
     */
    var arity = _curry2(function (n, fn) {
        switch (n) {
        case 0:
            return function () {
                return fn.apply(this, arguments);
            };
        case 1:
            return function (a0) {
                void a0;
                return fn.apply(this, arguments);
            };
        case 2:
            return function (a0, a1) {
                void a1;
                return fn.apply(this, arguments);
            };
        case 3:
            return function (a0, a1, a2) {
                void a2;
                return fn.apply(this, arguments);
            };
        case 4:
            return function (a0, a1, a2, a3) {
                void a3;
                return fn.apply(this, arguments);
            };
        case 5:
            return function (a0, a1, a2, a3, a4) {
                void a4;
                return fn.apply(this, arguments);
            };
        case 6:
            return function (a0, a1, a2, a3, a4, a5) {
                void a5;
                return fn.apply(this, arguments);
            };
        case 7:
            return function (a0, a1, a2, a3, a4, a5, a6) {
                void a6;
                return fn.apply(this, arguments);
            };
        case 8:
            return function (a0, a1, a2, a3, a4, a5, a6, a7) {
                void a7;
                return fn.apply(this, arguments);
            };
        case 9:
            return function (a0, a1, a2, a3, a4, a5, a6, a7, a8) {
                void a8;
                return fn.apply(this, arguments);
            };
        case 10:
            return function (a0, a1, a2, a3, a4, a5, a6, a7, a8, a9) {
                void a9;
                return fn.apply(this, arguments);
            };
        default:
            throw new Error('First argument to arity must be a non-negative integer no greater than ten');
        }
    });

    /**
     * Makes a shallow clone of an object, setting or overriding the specified
     * property with the given value.  Note that this copies and flattens
     * prototype properties onto the new object as well.  All non-primitive
     * properties are copied by reference.
     *
     * @func
     * @memberOf R
     * @category Object
     * @sig String -> a -> {k: v} -> {k: v}
     * @param {String} prop the property name to set
     * @param {*} val the new value
     * @param {Object} obj the object to clone
     * @return {Object} a new object similar to the original except for the specified property.
     * @example
     *
     *      R.assoc('c', 3, {a: 1, b: 2}); //=> {a: 1, b: 2, c: 3}
     */
    var assoc = _curry3(_assoc);

    /**
     * Creates a function that is bound to a context.
     * Note: `R.bind` does not provide the additional argument-binding capabilities of
     * [Function.prototype.bind](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Function/bind).
     *
     * @func
     * @memberOf R
     * @category Function
     * @category Object
     * @see R.partial
     * @sig (* -> *) -> {*} -> (* -> *)
     * @param {Function} fn The function to bind to context
     * @param {Object} thisObj The context to bind `fn` to
     * @return {Function} A function that will execute in the context of `thisObj`.
     */
    var bind = _curry2(function bind(fn, thisObj) {
        return arity(fn.length, function () {
            return fn.apply(thisObj, arguments);
        });
    });

    /**
     * A function wrapping calls to the two functions in an `&&` operation, returning the result of the first
     * function if it is false-y and the result of the second function otherwise.  Note that this is
     * short-circuited, meaning that the second function will not be invoked if the first returns a false-y
     * value.
     *
     * @func
     * @memberOf R
     * @category Logic
     * @sig (*... -> Boolean) -> (*... -> Boolean) -> (*... -> Boolean)
     * @param {Function} f a predicate
     * @param {Function} g another predicate
     * @return {Function} a function that applies its arguments to `f` and `g` and `&&`s their outputs together.
     * @example
     *
     *      var gt10 = function(x) { return x > 10; };
     *      var even = function(x) { return x % 2 === 0 };
     *      var f = R.both(gt10, even);
     *      f(100); //=> true
     *      f(101); //=> false
     */
    var both = _curry2(function both(f, g) {
        return function _both() {
            return f.apply(this, arguments) && g.apply(this, arguments);
        };
    });

    /**
     * Makes a comparator function out of a function that reports whether the first element is less than the second.
     *
     * @func
     * @memberOf R
     * @category Function
     * @sig (a, b -> Boolean) -> (a, b -> Number)
     * @param {Function} pred A predicate function of arity two.
     * @return {Function} A Function :: a -> b -> Int that returns `-1` if a < b, `1` if b < a, otherwise `0`.
     * @example
     *
     *      var cmp = R.comparator(function(a, b) {
     *        return a.age < b.age;
     *      });
     *      var people = [
     *        // ...
     *      ];
     *      R.sort(cmp, people);
     */
    var comparator = _curry1(function comparator(pred) {
        return function (a, b) {
            return pred(a, b) ? -1 : pred(b, a) ? 1 : 0;
        };
    });

    /**
     * Takes a function `f` and returns a function `g` such that:
     *
     *   - applying `g` to zero or more arguments will give __true__ if applying
     *     the same arguments to `f` gives a logical __false__ value; and
     *
     *   - applying `g` to zero or more arguments will give __false__ if applying
     *     the same arguments to `f` gives a logical __true__ value.
     *
     * @func
     * @memberOf R
     * @category Logic
     * @sig (*... -> *) -> (*... -> Boolean)
     * @param {Function} f
     * @return {Function}
     * @example
     *
     *      var isEven = function(n) { return n % 2 === 0; };
     *      var isOdd = R.complement(isEven);
     *      isOdd(21); //=> true
     *      isOdd(42); //=> false
     */
    var complement = _curry1(_complement);

    /**
     * Returns a function, `fn`, which encapsulates if/else-if/else logic.
     * Each argument to `R.cond` is a [predicate, transform] pair. All of
     * the arguments to `fn` are applied to each of the predicates in turn
     * until one returns a "truthy" value, at which point `fn` returns the
     * result of applying its arguments to the corresponding transformer.
     * If none of the predicates matches, `fn` returns undefined.
     *
     * @func
     * @memberOf R
     * @category Logic
     * @sig [(*... -> Boolean),(*... -> *)]... -> (*... -> *)
     * @param {...Function} functions
     * @return {Function}
     * @example
     *
     *      var fn = R.cond(
     *        [R.eq(0),   R.always('water freezes at 0°C')],
     *        [R.eq(100), R.always('water boils at 100°C')],
     *        [R.T,       function(temp) { return 'nothing special happens at ' + temp + '°C'; }]
     *      );
     *      fn(0); //=> 'water freezes at 0°C'
     *      fn(50); //=> 'nothing special happens at 50°C'
     *      fn(100); //=> 'water boils at 100°C'
     */
    var cond = function cond() {
        var pairs = arguments;
        return function () {
            var idx = -1;
            while (++idx < pairs.length) {
                if (pairs[idx][0].apply(this, arguments)) {
                    return pairs[idx][1].apply(this, arguments);
                }
            }
        };
    };

    /**
     * Returns `true` if the `x` is found in the `list`, using `pred` as an
     * equality predicate for `x`.
     *
     * @func
     * @memberOf R
     * @category List
     * @sig (a, a -> Boolean) -> a -> [a] -> Boolean
     * @param {Function} pred A predicate used to test whether two items are equal.
     * @param {*} x The item to find
     * @param {Array} list The list to iterate over
     * @return {Boolean} `true` if `x` is in `list`, else `false`.
     * @example
     *
     *     var xs = [{x: 12}, {x: 11}, {x: 10}];
     *     R.containsWith(function(a, b) { return a.x === b.x; }, {x: 10}, xs); //=> true
     *     R.containsWith(function(a, b) { return a.x === b.x; }, {x: 1}, xs); //=> false
     */
    var containsWith = _curry3(_containsWith);

    /**
     * Counts the elements of a list according to how many match each value
     * of a key generated by the supplied function. Returns an object
     * mapping the keys produced by `fn` to the number of occurrences in
     * the list. Note that all keys are coerced to strings because of how
     * JavaScript objects work.
     *
     * @func
     * @memberOf R
     * @category Relation
     * @sig (a -> String) -> [a] -> {*}
     * @param {Function} fn The function used to map values to keys.
     * @param {Array} list The list to count elements from.
     * @return {Object} An object mapping keys to number of occurrences in the list.
     * @example
     *
     *      var numbers = [1.0, 1.1, 1.2, 2.0, 3.0, 2.2];
     *      var letters = R.split('', 'abcABCaaaBBc');
     *      R.countBy(Math.floor)(numbers);    //=> {'1': 3, '2': 2, '3': 1}
     *      R.countBy(R.toLower)(letters);   //=> {'a': 5, 'b': 4, 'c': 3}
     */
    var countBy = _curry2(function countBy(fn, list) {
        var counts = {};
        var len = list.length;
        var idx = -1;
        while (++idx < len) {
            var key = fn(list[idx]);
            counts[key] = (_has(key, counts) ? counts[key] : 0) + 1;
        }
        return counts;
    });

    /**
     * Creates an object containing a single key:value pair.
     *
     * @func
     * @memberOf R
     * @category Object
     * @sig String -> a -> {String:a}
     * @param {String} key
     * @param {*} val
     * @return {Object}
     * @example
     *
     *      var matchPhrases = R.compose(
     *        R.createMapEntry('must'),
     *        R.map(R.createMapEntry('match_phrase'))
     *      );
     *      matchPhrases(['foo', 'bar', 'baz']); //=> {must: [{match_phrase: 'foo'}, {match_phrase: 'bar'}, {match_phrase: 'baz'}]}
     */
    var createMapEntry = _curry2(_createMapEntry);

    /**
     * Returns a curried equivalent of the provided function, with the
     * specified arity. The curried function has two unusual capabilities.
     * First, its arguments needn't be provided one at a time. If `g` is
     * `R.curryN(3, f)`, the following are equivalent:
     *
     *   - `g(1)(2)(3)`
     *   - `g(1)(2, 3)`
     *   - `g(1, 2)(3)`
     *   - `g(1, 2, 3)`
     *
     * Secondly, the special placeholder value `R.__` may be used to specify
     * "gaps", allowing partial application of any combination of arguments,
     * regardless of their positions. If `g` is as above and `_` is `R.__`,
     * the following are equivalent:
     *
     *   - `g(1, 2, 3)`
     *   - `g(_, 2, 3)(1)`
     *   - `g(_, _, 3)(1)(2)`
     *   - `g(_, _, 3)(1, 2)`
     *   - `g(_, 2)(1)(3)`
     *   - `g(_, 2)(1, 3)`
     *   - `g(_, 2)(_, 3)(1)`
     *
     * @func
     * @memberOf R
     * @category Function
     * @sig Number -> (* -> a) -> (* -> a)
     * @param {Number} length The arity for the returned function.
     * @param {Function} fn The function to curry.
     * @return {Function} A new, curried function.
     * @see R.curry
     * @example
     *
     *      var addFourNumbers = function() {
     *        return R.sum([].slice.call(arguments, 0, 4));
     *      };
     *
     *      var curriedAddFourNumbers = R.curryN(4, addFourNumbers);
     *      var f = curriedAddFourNumbers(1, 2);
     *      var g = f(3);
     *      g(4); //=> 10
     */
    var curryN = _curry2(function curryN(length, fn) {
        return arity(length, function () {
            var n = arguments.length;
            var shortfall = length - n;
            var idx = n;
            while (--idx >= 0) {
                if (arguments[idx] === __) {
                    shortfall += 1;
                }
            }
            if (shortfall <= 0) {
                return fn.apply(this, arguments);
            } else {
                var initialArgs = _slice(arguments);
                return curryN(shortfall, function () {
                    var currentArgs = _slice(arguments);
                    var combinedArgs = [];
                    var idx = -1;
                    while (++idx < n) {
                        var val = initialArgs[idx];
                        combinedArgs[idx] = val === __ ? currentArgs.shift() : val;
                    }
                    return fn.apply(this, combinedArgs.concat(currentArgs));
                });
            }
        });
    });

    /**
     * Decrements its argument.
     *
     * @func
     * @memberOf R
     * @category Math
     * @sig Number -> Number
     * @param {Number} n
     * @return {Number}
     * @example
     *
     *      R.dec(42); //=> 41
     */
    var dec = add(-1);

    /**
     * Returns the second argument if it is not null or undefined. If it is null
     * or undefined, the first (default) argument is returned.
     *
     * @func
     * @memberOf R
     * @category Logic
     * @sig a -> b -> a | b
     * @param {a} val The default value.
     * @param {b} val The value to return if it is not null or undefined
     * @return {*} The the second value or the default value
     * @example
     *
     *      var defaultTo42 = defaultTo(42);
     *
     *      defaultTo42(null);  //=> 42
     *      defaultTo42(undefined);  //=> 42
     *      defaultTo42('Ramda');  //=> 'Ramda'
     */
    var defaultTo = _curry2(function defaultTo(d, v) {
        return v == null ? d : v;
    });

    /**
     * Finds the set (i.e. no duplicates) of all elements in the first list not contained in the second list.
     * Duplication is determined according to the value returned by applying the supplied predicate to two list
     * elements.
     *
     * @func
     * @memberOf R
     * @category Relation
     * @sig (a,a -> Boolean) -> [a] -> [a] -> [a]
     * @param {Function} pred A predicate used to test whether two items are equal.
     * @param {Array} list1 The first list.
     * @param {Array} list2 The second list.
     * @see R.difference
     * @return {Array} The elements in `list1` that are not in `list2`.
     * @example
     *
     *      function cmp(x, y) { return x.a === y.a; }
     *      var l1 = [{a: 1}, {a: 2}, {a: 3}];
     *      var l2 = [{a: 3}, {a: 4}];
     *      R.differenceWith(cmp, l1, l2); //=> [{a: 1}, {a: 2}]
     */
    var differenceWith = _curry3(function differenceWith(pred, first, second) {
        var out = [];
        var idx = -1;
        var firstLen = first.length;
        var containsPred = containsWith(pred);
        while (++idx < firstLen) {
            if (!containsPred(first[idx], second) && !containsPred(first[idx], out)) {
                out[idx] = first[idx];
            }
        }
        return out;
    });

    /**
     * Returns a new object that does not contain a `prop` property.
     *
     * @func
     * @memberOf R
     * @category Object
     * @sig String -> {k: v} -> {k: v}
     * @param {String} prop the name of the property to dissociate
     * @param {Object} obj the object to clone
     * @return {Object} a new object similar to the original but without the specified property
     * @example
     *
     *      R.dissoc('b', {a: 1, b: 2, c: 3}); //=> {a: 1, c: 3}
     */
    var dissoc = _curry2(_dissoc);

    /**
     * Divides two numbers. Equivalent to `a / b`.
     *
     * @func
     * @memberOf R
     * @category Math
     * @sig Number -> Number -> Number
     * @param {Number} a The first value.
     * @param {Number} b The second value.
     * @return {Number} The result of `a / b`.
     * @example
     *
     *      R.divide(71, 100); //=> 0.71
     *
     *      var half = R.divide(R.__, 2);
     *      half(42); //=> 21
     *
     *      var reciprocal = R.divide(1);
     *      reciprocal(4);   //=> 0.25
     */
    var divide = _curry2(function divide(a, b) {
        return a / b;
    });

    /**
     * A function wrapping calls to the two functions in an `||` operation, returning the result of the first
     * function if it is truth-y and the result of the second function otherwise.  Note that this is
     * short-circuited, meaning that the second function will not be invoked if the first returns a truth-y
     * value.
     *
     * @func
     * @memberOf R
     * @category Logic
     * @sig (*... -> Boolean) -> (*... -> Boolean) -> (*... -> Boolean)
     * @param {Function} f a predicate
     * @param {Function} g another predicate
     * @return {Function} a function that applies its arguments to `f` and `g` and `||`s their outputs together.
     * @example
     *
     *      var gt10 = function(x) { return x > 10; };
     *      var even = function(x) { return x % 2 === 0 };
     *      var f = R.either(gt10, even);
     *      f(101); //=> true
     *      f(8); //=> true
     */
    var either = _curry2(function either(f, g) {
        return function _either() {
            return f.apply(this, arguments) || g.apply(this, arguments);
        };
    });

    /**
     * Tests if two items are equal.  Equality is strict here, meaning reference equality for objects and
     * non-coercing equality for primitives.
     *
     * @func
     * @memberOf R
     * @category Relation
     * @sig a -> b -> Boolean
     * @param {*} a
     * @param {*} b
     * @return {Boolean}
     * @example
     *
     *      var o = {};
     *      R.eq(o, o); //=> true
     *      R.eq(o, {}); //=> false
     *      R.eq(1, 1); //=> true
     *      R.eq(1, '1'); //=> false
     *      R.eq(0, -0); //=> false
     *      R.eq(NaN, NaN); //=> true
     */
    var eq = _curry2(function eq(a, b) {
        if (a === 0) {
            return 1 / a === 1 / b;
        } else {
            return a === b || a !== a && b !== b;
        }
    });

    /**
     * Reports whether two objects have the same value for the specified property.  Useful as a curried predicate.
     *
     * @func
     * @memberOf R
     * @category Object
     * @sig k -> {k: v} -> {k: v} -> Boolean
     * @param {String} prop The name of the property to compare
     * @param {Object} obj1
     * @param {Object} obj2
     * @return {Boolean}
     *
     * @example
     *
     *      var o1 = { a: 1, b: 2, c: 3, d: 4 };
     *      var o2 = { a: 10, b: 20, c: 3, d: 40 };
     *      R.eqProps('a', o1, o2); //=> false
     *      R.eqProps('c', o1, o2); //=> true
     */
    var eqProps = _curry3(function eqProps(prop, obj1, obj2) {
        return obj1[prop] === obj2[prop];
    });

    /**
     * Like `filter`, but passes additional parameters to the predicate function. The predicate
     * function is passed three arguments: *(value, index, list)*.
     *
     * @func
     * @memberOf R
     * @category List
     * @sig (a, i, [a] -> Boolean) -> [a] -> [a]
     * @param {Function} fn The function called per iteration.
     * @param {Array} list The collection to iterate over.
     * @return {Array} The new filtered array.
     * @example
     *
     *      var lastTwo = function(val, idx, list) {
     *        return list.length - idx <= 2;
     *      };
     *      R.filterIndexed(lastTwo, [8, 6, 7, 5, 3, 0, 9]); //=> [0, 9]
     */
    var filterIndexed = _curry2(_filterIndexed);

    /**
     * Iterate over an input `list`, calling a provided function `fn` for each element in the
     * list.
     *
     * `fn` receives one argument: *(value)*.
     *
     * Note: `R.forEach` does not skip deleted or unassigned indices (sparse arrays), unlike
     * the native `Array.prototype.forEach` method. For more details on this behavior, see:
     * https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/forEach#Description
     *
     * Also note that, unlike `Array.prototype.forEach`, Ramda's `forEach` returns the original
     * array. In some libraries this function is named `each`.
     *
     * @func
     * @memberOf R
     * @category List
     * @sig (a -> *) -> [a] -> [a]
     * @param {Function} fn The function to invoke. Receives one argument, `value`.
     * @param {Array} list The list to iterate over.
     * @return {Array} The original list.
     * @example
     *
     *      var printXPlusFive = function(x) { console.log(x + 5); };
     *      R.forEach(printXPlusFive, [1, 2, 3]); //=> [1, 2, 3]
     *      //-> 6
     *      //-> 7
     *      //-> 8
     */
    var forEach = _curry2(_forEach);

    /**
     * Like `forEach`, but but passes additional parameters to the predicate function.
     *
     * `fn` receives three arguments: *(value, index, list)*.
     *
     * Note: `R.forEachIndexed` does not skip deleted or unassigned indices (sparse arrays),
     * unlike the native `Array.prototype.forEach` method. For more details on this behavior,
     * see:
     * https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/forEach#Description
     *
     * Also note that, unlike `Array.prototype.forEach`, Ramda's `forEach` returns the original
     * array. In some libraries this function is named `each`.
     *
     * @func
     * @memberOf R
     * @category List
     * @sig (a, i, [a] -> ) -> [a] -> [a]
     * @param {Function} fn The function to invoke. Receives three arguments:
     *        (`value`, `index`, `list`).
     * @param {Array} list The list to iterate over.
     * @return {Array} The original list.
     * @example
     *
     *      // Note that having access to the original `list` allows for
     *      // mutation. While you *can* do this, it's very un-functional behavior:
     *      var plusFive = function(num, idx, list) { list[idx] = num + 5 };
     *      R.forEachIndexed(plusFive, [1, 2, 3]); //=> [6, 7, 8]
     */
    // i can't bear not to return *something*
    var forEachIndexed = _curry2(function forEachIndexed(fn, list) {
        var idx = -1, len = list.length;
        while (++idx < len) {
            fn(list[idx], idx, list);
        }
        // i can't bear not to return *something*
        return list;
    });

    /**
     * Creates a new object out of a list key-value pairs.
     *
     * @func
     * @memberOf R
     * @category List
     * @sig [[k,v]] -> {k: v}
     * @param {Array} pairs An array of two-element arrays that will be the keys and values of the output object.
     * @return {Object} The object made by pairing up `keys` and `values`.
     * @example
     *
     *      R.fromPairs([['a', 1], ['b', 2],  ['c', 3]]); //=> {a: 1, b: 2, c: 3}
     */
    var fromPairs = _curry1(function fromPairs(pairs) {
        var idx = -1, len = pairs.length, out = {};
        while (++idx < len) {
            if (_isArray(pairs[idx]) && pairs[idx].length) {
                out[pairs[idx][0]] = pairs[idx][1];
            }
        }
        return out;
    });

    /**
     * Returns true if the first parameter is greater than the second.
     *
     * @func
     * @memberOf R
     * @category Math
     * @sig Number -> Number -> Boolean
     * @param {Number} a
     * @param {Number} b
     * @return {Boolean} a > b
     * @example
     *
     *      R.gt(2, 6); //=> false
     *      R.gt(2, 0); //=> true
     *      R.gt(2, 2); //=> false
     *      R.gt(R.__, 2)(10); //=> true
     *      R.gt(2)(10); //=> false
     */
    var gt = _curry2(_gt);

    /**
     * Returns true if the first parameter is greater than or equal to the second.
     *
     * @func
     * @memberOf R
     * @category Math
     * @sig Number -> Number -> Boolean
     * @param {Number} a
     * @param {Number} b
     * @return {Boolean} a >= b
     * @example
     *
     *      R.gte(2, 6); //=> false
     *      R.gte(2, 0); //=> true
     *      R.gte(2, 2); //=> true
     *      R.gte(R.__, 6)(2); //=> false
     *      R.gte(2)(0); //=> true
     */
    var gte = _curry2(function gte(a, b) {
        return a >= b;
    });

    /**
     * Returns whether or not an object has an own property with
     * the specified name
     *
     * @func
     * @memberOf R
     * @category Object
     * @sig s -> {s: x} -> Boolean
     * @param {String} prop The name of the property to check for.
     * @param {Object} obj The object to query.
     * @return {Boolean} Whether the property exists.
     * @example
     *
     *      var hasName = R.has('name');
     *      hasName({name: 'alice'});   //=> true
     *      hasName({name: 'bob'});     //=> true
     *      hasName({});                //=> false
     *
     *      var point = {x: 0, y: 0};
     *      var pointHas = R.has(R.__, point);
     *      pointHas('x');  //=> true
     *      pointHas('y');  //=> true
     *      pointHas('z');  //=> false
     */
    var has = _curry2(_has);

    /**
     * Returns whether or not an object or its prototype chain has
     * a property with the specified name
     *
     * @func
     * @memberOf R
     * @category Object
     * @sig s -> {s: x} -> Boolean
     * @param {String} prop The name of the property to check for.
     * @param {Object} obj The object to query.
     * @return {Boolean} Whether the property exists.
     * @example
     *
     *      function Rectangle(width, height) {
     *        this.width = width;
     *        this.height = height;
     *      }
     *      Rectangle.prototype.area = function() {
     *        return this.width * this.height;
     *      };
     *
     *      var square = new Rectangle(2, 2);
     *      R.hasIn('width', square);  //=> true
     *      R.hasIn('area', square);  //=> true
     */
    var hasIn = _curry2(function (prop, obj) {
        return prop in obj;
    });

    /**
     * A function that does nothing but return the parameter supplied to it. Good as a default
     * or placeholder function.
     *
     * @func
     * @memberOf R
     * @category Function
     * @sig a -> a
     * @param {*} x The value to return.
     * @return {*} The input value, `x`.
     * @example
     *
     *      R.identity(1); //=> 1
     *
     *      var obj = {};
     *      R.identity(obj) === obj; //=> true
     */
    var identity = _curry1(_identity);

    /**
     * Creates a function that will process either the `onTrue` or the `onFalse` function depending
     * upon the result of the `condition` predicate.
     *
     * @func
     * @memberOf R
     * @category Logic
     * @sig (*... -> Boolean) -> (*... -> *) -> (*... -> *) -> (*... -> *)
     * @param {Function} condition A predicate function
     * @param {Function} onTrue A function to invoke when the `condition` evaluates to a truthy value.
     * @param {Function} onFalse A function to invoke when the `condition` evaluates to a falsy value.
     * @return {Function} A new unary function that will process either the `onTrue` or the `onFalse`
     *                    function depending upon the result of the `condition` predicate.
     * @example
     *
     *      // Flatten all arrays in the list but leave other values alone.
     *      var flattenArrays = R.map(R.ifElse(Array.isArray, R.flatten, R.identity));
     *
     *      flattenArrays([[0], [[10], [8]], 1234, {}]); //=> [[0], [10, 8], 1234, {}]
     *      flattenArrays([[[10], 123], [8, [10]], "hello"]); //=> [[10, 123], [8, 10], "hello"]
     */
    var ifElse = _curry3(function ifElse(condition, onTrue, onFalse) {
        return curryN(Math.max(condition.length, onTrue.length, onFalse.length), function _ifElse() {
            return condition.apply(this, arguments) ? onTrue.apply(this, arguments) : onFalse.apply(this, arguments);
        });
    });

    /**
     * Increments its argument.
     *
     * @func
     * @memberOf R
     * @category Math
     * @sig Number -> Number
     * @param {Number} n
     * @return {Number}
     * @example
     *
     *      R.inc(42); //=> 43
     */
    var inc = add(1);

    /**
     * Returns the position of the first occurrence of an item in an array
     * (by strict equality),
     * or -1 if the item is not included in the array.
     *
     * @func
     * @memberOf R
     * @category List
     * @sig a -> [a] -> Number
     * @param {*} target The item to find.
     * @param {Array} list The array to search in.
     * @return {Number} the index of the target, or -1 if the target is not found.
     *
     * @example
     *
     *      R.indexOf(3, [1,2,3,4]); //=> 2
     *      R.indexOf(10, [1,2,3,4]); //=> -1
     */
    var indexOf = _curry2(function indexOf(target, list) {
        return _indexOf(list, target);
    });

    /**
     * Inserts the sub-list into the list, at index `index`.  _Note  that this
     * is not destructive_: it returns a copy of the list with the changes.
     * <small>No lists have been harmed in the application of this function.</small>
     *
     * @func
     * @memberOf R
     * @category List
     * @sig Number -> [a] -> [a] -> [a]
     * @param {Number} index The position to insert the sub-list
     * @param {Array} elts The sub-list to insert into the Array
     * @param {Array} list The list to insert the sub-list into
     * @return {Array} A new Array with `elts` inserted starting at `index`.
     * @example
     *
     *      R.insertAll(2, ['x','y','z'], [1,2,3,4]); //=> [1,2,'x','y','z',3,4]
     */
    var insertAll = _curry3(function insertAll(idx, elts, list) {
        idx = idx < list.length && idx >= 0 ? idx : list.length;
        return _concat(_concat(_slice(list, 0, idx), elts), _slice(list, idx));
    });

    /**
     * See if an object (`val`) is an instance of the supplied constructor.
     * This function will check up the inheritance chain, if any.
     *
     * @func
     * @memberOf R
     * @category Type
     * @sig (* -> {*}) -> a -> Boolean
     * @param {Object} ctor A constructor
     * @param {*} val The value to test
     * @return {Boolean}
     * @example
     *
     *      R.is(Object, {}); //=> true
     *      R.is(Number, 1); //=> true
     *      R.is(Object, 1); //=> false
     *      R.is(String, 's'); //=> true
     *      R.is(String, new String('')); //=> true
     *      R.is(Object, new String('')); //=> true
     *      R.is(Object, 's'); //=> false
     *      R.is(Number, {}); //=> false
     */
    var is = _curry2(function is(Ctor, val) {
        return val != null && val.constructor === Ctor || val instanceof Ctor;
    });

    /**
     * Tests whether or not an object is similar to an array.
     *
     * @func
     * @memberOf R
     * @category Type
     * @category List
     * @param {*} x The object to test.
     * @return {Boolean} `true` if `x` has a numeric length property and extreme indices defined; `false` otherwise.
     * @example
     *
     *      R.isArrayLike([]); //=> true
     *      R.isArrayLike(true); //=> false
     *      R.isArrayLike({}); //=> false
     *      R.isArrayLike({length: 10}); //=> false
     *      R.isArrayLike({0: 'zero', 9: 'nine', length: 10}); //=> true
     */
    var isArrayLike = _curry1(function isArrayLike(x) {
        if (_isArray(x)) {
            return true;
        }
        if (!x) {
            return false;
        }
        if (typeof x !== 'object') {
            return false;
        }
        if (x instanceof String) {
            return false;
        }
        if (x.nodeType === 1) {
            return !!x.length;
        }
        if (x.length === 0) {
            return true;
        }
        if (x.length > 0) {
            return x.hasOwnProperty(0) && x.hasOwnProperty(x.length - 1);
        }
        return false;
    });

    /**
     * Reports whether the list has zero elements.
     *
     * @func
     * @memberOf R
     * @category Logic
     * @sig [a] -> Boolean
     * @param {Array} list
     * @return {Boolean}
     * @example
     *
     *      R.isEmpty([1, 2, 3]); //=> false
     *      R.isEmpty([]); //=> true
     *      R.isEmpty(''); //=> true
     *      R.isEmpty(null); //=> false
     */
    var isEmpty = _curry1(function isEmpty(list) {
        return Object(list).length === 0;
    });

    /**
     * Returns `true` if the input value is `NaN`.
     *
     * Equivalent to ES6's [`Number.isNaN`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number/isNaN).
     *
     * @func
     * @memberOf R
     * @category Math
     * @sig * -> Boolean
     * @param {*} x
     * @return {Boolean}
     * @example
     *
     *     R.isNaN(NaN);        //=> true
     *     R.isNaN(undefined);  //=> false
     *     R.isNaN({});         //=> false
     */
    var isNaN = _curry1(function isNaN(x) {
        return typeof x === 'number' && x !== x;
    });

    /**
     * Checks if the input value is `null` or `undefined`.
     *
     * @func
     * @memberOf R
     * @category Type
     * @sig * -> Boolean
     * @param {*} x The value to test.
     * @return {Boolean} `true` if `x` is `undefined` or `null`, otherwise `false`.
     * @example
     *
     *     R.isNil(null); //=> true
     *     R.isNil(undefined); //=> true
     *     R.isNil(0); //=> false
     *     R.isNil([]); //=> false
     */
    var isNil = _curry1(function isNil(x) {
        return x == null;
    });

    /**
     * Returns `true` if all elements are unique, otherwise `false`.
     * Uniqueness is determined using strict equality (`===`).
     *
     * @func
     * @memberOf R
     * @category List
     * @sig [a] -> Boolean
     * @param {Array} list The array to consider.
     * @return {Boolean} `true` if all elements are unique, else `false`.
     * @example
     *
     *      R.isSet(['1', 1]); //=> true
     *      R.isSet([1, 1]);   //=> false
     *      R.isSet([{}, {}]); //=> true
     */
    var isSet = _curry1(function isSet(list) {
        var len = list.length;
        var idx = -1;
        while (++idx < len) {
            if (_indexOf(list, list[idx], idx + 1) >= 0) {
                return false;
            }
        }
        return true;
    });

    /**
     * Returns a list containing the names of all the
     * properties of the supplied object, including prototype properties.
     * Note that the order of the output array is not guaranteed to be
     * consistent across different JS platforms.
     *
     * @func
     * @memberOf R
     * @category Object
     * @sig {k: v} -> [k]
     * @param {Object} obj The object to extract properties from
     * @return {Array} An array of the object's own and prototype properties.
     * @example
     *
     *      var F = function() { this.x = 'X'; };
     *      F.prototype.y = 'Y';
     *      var f = new F();
     *      R.keysIn(f); //=> ['x', 'y']
     */
    var keysIn = _curry1(function keysIn(obj) {
        var prop, ks = [];
        for (prop in obj) {
            ks[ks.length] = prop;
        }
        return ks;
    });

    /**
     * Returns the position of the last occurrence of an item (by strict equality) in
     * an array, or -1 if the item is not included in the array.
     *
     * @func
     * @memberOf R
     * @category List
     * @sig a -> [a] -> Number
     * @param {*} target The item to find.
     * @param {Array} list The array to search in.
     * @return {Number} the index of the target, or -1 if the target is not found.
     *
     * @example
     *
     *      R.lastIndexOf(3, [-1,3,3,0,1,2,3,4]); //=> 6
     *      R.lastIndexOf(10, [1,2,3,4]); //=> -1
     */
    var lastIndexOf = _curry2(function lastIndexOf(target, list) {
        return _lastIndexOf(list, target);
    });

    /**
     * Returns the number of elements in the array by returning `list.length`.
     *
     * @func
     * @memberOf R
     * @category List
     * @sig [a] -> Number
     * @param {Array} list The array to inspect.
     * @return {Number} The length of the array.
     * @example
     *
     *      R.length([]); //=> 0
     *      R.length([1, 2, 3]); //=> 3
     */
    var length = _curry1(function length(list) {
        return list != null && is(Number, list.length) ? list.length : NaN;
    });

    /**
     * Creates a lens. Supply a function to `get` values from inside an object, and a `set`
     * function to change values on an object. (n.b.: This can, and should, be done without
     * mutating the original object!) The lens is a function wrapped around the input `get`
     * function, with the `set` function attached as a property on the wrapper. A `map`
     * function is also attached to the returned function that takes a function to operate
     * on the specified (`get`) property, which is then `set` before returning. The attached
     * `set` and `map` functions are curried.
     *
     * @func
     * @memberOf R
     * @category Object
     * @sig (k -> v) -> (v -> a -> *) -> (a -> b)
     * @param {Function} get A function that gets a value by property name
     * @param {Function} set A function that sets a value by property name
     * @return {Function} the returned function has `set` and `map` properties that are
     *         also curried functions.
     * @example
     *
     *     var headLens = R.lens(
     *       function get(arr) { return arr[0]; },
     *       function set(val, arr) { return [val].concat(arr.slice(1)); }
     *     );
     *     headLens([10, 20, 30, 40]); //=> 10
     *     headLens.set('mu', [10, 20, 30, 40]); //=> ['mu', 20, 30, 40]
     *     headLens.map(function(x) { return x + 1; }, [10, 20, 30, 40]); //=> [11, 20, 30, 40]
     *
     *     var phraseLens = R.lens(
     *       function get(obj) { return obj.phrase; },
     *       function set(val, obj) {
     *         var out = R.clone(obj);
     *         out.phrase = val;
     *         return out;
     *       }
     *     );
     *     var obj1 = { phrase: 'Absolute filth . . . and I LOVED it!'};
     *     var obj2 = { phrase: "What's all this, then?"};
     *     phraseLens(obj1); // => 'Absolute filth . . . and I LOVED it!'
     *     phraseLens(obj2); // => "What's all this, then?"
     *     phraseLens.set('Ooh Betty', obj1); //=> { phrase: 'Ooh Betty'}
     *     phraseLens.map(R.toUpper, obj2); //=> { phrase: "WHAT'S ALL THIS, THEN?"}
     */
    var lens = _curry2(function lens(get, set) {
        var lns = function (a) {
            return get(a);
        };
        lns.set = _curry2(set);
        lns.map = _curry2(function (fn, a) {
            return set(fn(get(a)), a);
        });
        return lns;
    });

    /**
     * Returns a lens associated with the provided object.
     *
     * @func
     * @memberOf R
     * @category Object
     * @sig {} -> ({} -> v) -> (v -> a -> *) -> (a -> b)
     * @see R.lens
     * @param {Function} get A function that gets a value by property name
     * @param {Function} set A function that sets a value by property name
     * @return {Function} the returned function has `set` and `map` properties that are
     *         also curried functions.
     * @example
     *
     *     var xo = {x: 1};
     *     var xoLens = R.lensOn(xo,
     *                           function get(o) { return o.x; },
     *                           function set(v) { return {x: v}; });
     *     xoLens(); //=> 1
     *     xoLens.set(1000); //=> {x: 1000}
     *     xoLens.map(R.add(1)); //=> {x: 2}
     */
    var lensOn = _curry3(function lensOn(get, set, obj) {
        var lns = function () {
            return get(obj);
        };
        lns.set = set;
        lns.map = function (fn) {
            return set(fn(get(obj)));
        };
        return lns;
    });

    /**
     * Returns true if the first parameter is less than the second.
     *
     * @func
     * @memberOf R
     * @category Math
     * @sig Number -> Number -> Boolean
     * @param {Number} a
     * @param {Number} b
     * @return {Boolean} a < b
     * @example
     *
     *      R.lt(2, 6); //=> true
     *      R.lt(2, 0); //=> false
     *      R.lt(2, 2); //=> false
     *      R.lt(5)(10); //=> true
     *      R.lt(R.__, 5)(10); //=> false // right-sectioned currying
     */
    var lt = _curry2(_lt);

    /**
     * Returns true if the first parameter is less than or equal to the second.
     *
     * @func
     * @memberOf R
     * @category Math
     * @sig Number -> Number -> Boolean
     * @param {Number} a
     * @param {Number} b
     * @return {Boolean} a <= b
     * @example
     *
     *      R.lte(2, 6); //=> true
     *      R.lte(2, 0); //=> false
     *      R.lte(2, 2); //=> true
     *      R.lte(R.__, 2)(1); //=> true
     *      R.lte(2)(10); //=> true
     */
    var lte = _curry2(function lte(a, b) {
        return a <= b;
    });

    /**
     * The mapAccum function behaves like a combination of map and reduce; it applies a
     * function to each element of a list, passing an accumulating parameter from left to
     * right, and returning a final value of this accumulator together with the new list.
     *
     * The iterator function receives two arguments, *acc* and *value*, and should return
     * a tuple *[acc, value]*.
     *
     * @func
     * @memberOf R
     * @category List
     * @sig (acc -> x -> (acc, y)) -> acc -> [x] -> (acc, [y])
     * @param {Function} fn The function to be called on every element of the input `list`.
     * @param {*} acc The accumulator value.
     * @param {Array} list The list to iterate over.
     * @return {*} The final, accumulated value.
     * @example
     *
     *      var digits = ['1', '2', '3', '4'];
     *      var append = function(a, b) {
     *        return [a + b, a + b];
     *      }
     *
     *      R.mapAccum(append, 0, digits); //=> ['01234', ['01', '012', '0123', '01234']]
     */
    var mapAccum = _curry3(function mapAccum(fn, acc, list) {
        var idx = -1, len = list.length, result = [], tuple = [acc];
        while (++idx < len) {
            tuple = fn(tuple[0], list[idx]);
            result[idx] = tuple[1];
        }
        return [
            tuple[0],
            result
        ];
    });

    /**
     * The mapAccumRight function behaves like a combination of map and reduce; it applies a
     * function to each element of a list, passing an accumulating parameter from right
     * to left, and returning a final value of this accumulator together with the new list.
     *
     * Similar to `mapAccum`, except moves through the input list from the right to the
     * left.
     *
     * The iterator function receives two arguments, *acc* and *value*, and should return
     * a tuple *[acc, value]*.
     *
     * @func
     * @memberOf R
     * @category List
     * @sig (acc -> x -> (acc, y)) -> acc -> [x] -> (acc, [y])
     * @param {Function} fn The function to be called on every element of the input `list`.
     * @param {*} acc The accumulator value.
     * @param {Array} list The list to iterate over.
     * @return {*} The final, accumulated value.
     * @example
     *
     *      var digits = ['1', '2', '3', '4'];
     *      var append = function(a, b) {
     *        return [a + b, a + b];
     *      }
     *
     *      R.mapAccumRight(append, 0, digits); //=> ['04321', ['04321', '0432', '043', '04']]
     */
    var mapAccumRight = _curry3(function mapAccumRight(fn, acc, list) {
        var idx = list.length, result = [], tuple = [acc];
        while (--idx >= 0) {
            tuple = fn(tuple[0], list[idx]);
            result[idx] = tuple[1];
        }
        return [
            tuple[0],
            result
        ];
    });

    /**
     * Like `map`, but but passes additional parameters to the mapping function.
     * `fn` receives three arguments: *(value, index, list)*.
     *
     * Note: `R.mapIndexed` does not skip deleted or unassigned indices (sparse arrays), unlike
     * the native `Array.prototype.map` method. For more details on this behavior, see:
     * https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/map#Description
     *
     * @func
     * @memberOf R
     * @category List
     * @sig (a,i,[b] -> b) -> [a] -> [b]
     * @param {Function} fn The function to be called on every element of the input `list`.
     * @param {Array} list The list to be iterated over.
     * @return {Array} The new list.
     * @example
     *
     *      var squareEnds = function(elt, idx, list) {
     *        if (idx === 0 || idx === list.length - 1) {
     *          return elt * elt;
     *        }
     *        return elt;
     *      };
     *
     *      R.mapIndexed(squareEnds, [8, 5, 3, 0, 9]); //=> [64, 5, 3, 0, 81]
     */
    var mapIndexed = _curry2(function mapIndexed(fn, list) {
        var idx = -1, len = list.length, result = [];
        while (++idx < len) {
            result[idx] = fn(list[idx], idx, list);
        }
        return result;
    });

    /**
     * mathMod behaves like the modulo operator should mathematically, unlike the `%`
     * operator (and by extension, R.modulo). So while "-17 % 5" is -2,
     * mathMod(-17, 5) is 3. mathMod requires Integer arguments, and returns NaN
     * when the modulus is zero or negative.
     *
     * @func
     * @memberOf R
     * @category Math
     * @sig Number -> Number -> Number
     * @param {Number} m The dividend.
     * @param {Number} p the modulus.
     * @return {Number} The result of `b mod a`.
     * @see R.moduloBy
     * @example
     *
     *      R.mathMod(-17, 5);  //=> 3
     *      R.mathMod(17, 5);   //=> 2
     *      R.mathMod(17, -5);  //=> NaN
     *      R.mathMod(17, 0);   //=> NaN
     *      R.mathMod(17.2, 5); //=> NaN
     *      R.mathMod(17, 5.3); //=> NaN
     *
     *      var clock = R.mathMod(R.__, 12);
     *      clock(15); //=> 3
     *      clock(24); //=> 0
     *
     *      var seventeenMod = R.mathMod(17);
     *      seventeenMod(3);  //=> 2
     *      seventeenMod(4);  //=> 1
     *      seventeenMod(10); //=> 7
     */
    var mathMod = _curry2(function mathMod(m, p) {
        if (!_isInteger(m)) {
            return NaN;
        }
        if (!_isInteger(p) || p < 1) {
            return NaN;
        }
        return (m % p + p) % p;
    });

    /**
     * Determines the largest of a list of items as determined by pairwise comparisons from the supplied comparator
     *
     * @func
     * @memberOf R
     * @category Math
     * @sig (a -> Number) -> [a] -> a
     * @param {Function} keyFn A comparator function for elements in the list
     * @param {Array} list A list of comparable elements
     * @return {*} The greatest element in the list. `undefined` if the list is empty.
     * @see R.max
     * @example
     *
     *      function cmp(obj) { return obj.x; }
     *      var a = {x: 1}, b = {x: 2}, c = {x: 3};
     *      R.maxBy(cmp, [a, b, c]); //=> {x: 3}
     */
    var maxBy = _curry2(_createMaxMinBy(_gt));

    /**
     * Creates a new function that, when invoked, caches the result of calling `fn` for a given
     * argument set and returns the result. Subsequent calls to the memoized `fn` with the same
     * argument set will not result in an additional call to `fn`; instead, the cached result
     * for that set of arguments will be returned.
     *
     * Note that this version of `memoize` should not be applied to functions which
     * take objects as arguments.
     *
     * @func
     * @memberOf R
     * @category Function
     * @sig (*... -> a) -> (*... -> a)
     * @param {Function} fn The function to memoize.
     * @return {Function} Memoized version of `fn`.
     * @example
     *
     *      var count = 0;
     *      var factorial = R.memoize(function(n) {
     *        count += 1;
     *        return R.product(R.range(1, n + 1));
     *      });
     *      factorial(5); //=> 120
     *      factorial(5); //=> 120
     *      factorial(5); //=> 120
     *      count; //=> 1
     */
    // Returns a string representation of the given value suitable for use as
    // a property name.
    //
    // > repr(42)
    // '42::[object Number]'
    // Serializes an array-like object. The approach is similar to that taken
    // by [CANON](https://github.com/davidchambers/CANON), though it does not
    // differentiate between objects at all (!) and, since it is not applied
    // recursively, does not distinguish between [[42]] and [['42']].
    //
    // > serialize(['foo', 42])
    // '2:{foo::[object String],42::[object Number]}'
    var memoize = function () {
        // Returns a string representation of the given value suitable for use as
        // a property name.
        //
        // > repr(42)
        // '42::[object Number]'
        var repr = function (x) {
            return x + '::' + Object.prototype.toString.call(x);
        };
        // Serializes an array-like object. The approach is similar to that taken
        // by [CANON](https://github.com/davidchambers/CANON), though it does not
        // differentiate between objects at all (!) and, since it is not applied
        // recursively, does not distinguish between [[42]] and [['42']].
        //
        // > serialize(['foo', 42])
        // '2:{foo::[object String],42::[object Number]}'
        var serialize = function (args) {
            return args.length + ':{' + _map(repr, args).join(',') + '}';
        };
        return _curry1(function memoize(fn) {
            var cache = {};
            return function () {
                var key = serialize(arguments);
                if (!_has(key, cache)) {
                    cache[key] = fn.apply(this, arguments);
                }
                return cache[key];
            };
        });
    }();

    /**
     * Determines the smallest of a list of items as determined by pairwise comparisons from the supplied comparator
     *
     * @func
     * @memberOf R
     * @category Math
     * @sig (a -> Number) -> [a] -> a
     * @param {Function} keyFn A comparator function for elements in the list
     * @param {Array} list A list of comparable elements
     * @see R.min
     * @return {*} The greatest element in the list. `undefined` if the list is empty.
     * @example
     *
     *      function cmp(obj) { return obj.x; }
     *      var a = {x: 1}, b = {x: 2}, c = {x: 3};
     *      R.minBy(cmp, [a, b, c]); //=> {x: 1}
     */
    var minBy = _curry2(_createMaxMinBy(_lt));

    /**
     * Divides the second parameter by the first and returns the remainder.
     * Note that this functions preserves the JavaScript-style behavior for
     * modulo. For mathematical modulo see `mathMod`
     *
     * @func
     * @memberOf R
     * @category Math
     * @sig Number -> Number -> Number
     * @param {Number} a The value to the divide.
     * @param {Number} b The pseudo-modulus
     * @return {Number} The result of `b % a`.
     * @see R.mathMod
     * @example
     *
     *      R.modulo(17, 3); //=> 2
     *      // JS behavior:
     *      R.modulo(-17, 3); //=> -2
     *      R.modulo(17, -3); //=> 2
     *
     *      var isOdd = R.modulo(R.__, 2);
     *      isOdd(42); //=> 0
     *      isOdd(21); //=> 1
     */
    var modulo = _curry2(function modulo(a, b) {
        return a % b;
    });

    /**
     * Multiplies two numbers. Equivalent to `a * b` but curried.
     *
     * @func
     * @memberOf R
     * @category Math
     * @sig Number -> Number -> Number
     * @param {Number} a The first value.
     * @param {Number} b The second value.
     * @return {Number} The result of `a * b`.
     * @example
     *
     *      var double = R.multiply(2);
     *      var triple = R.multiply(3);
     *      double(3);       //=>  6
     *      triple(4);       //=> 12
     *      R.multiply(2, 5);  //=> 10
     */
    var multiply = _curry2(_multiply);

    /**
     * Wraps a function of any arity (including nullary) in a function that accepts exactly `n`
     * parameters. Any extraneous parameters will not be passed to the supplied function.
     *
     * @func
     * @memberOf R
     * @category Function
     * @sig Number -> (* -> a) -> (* -> a)
     * @param {Number} n The desired arity of the new function.
     * @param {Function} fn The function to wrap.
     * @return {Function} A new function wrapping `fn`. The new function is guaranteed to be of
     *         arity `n`.
     * @example
     *
     *      var takesTwoArgs = function(a, b) {
     *        return [a, b];
     *      };
     *      takesTwoArgs.length; //=> 2
     *      takesTwoArgs(1, 2); //=> [1, 2]
     *
     *      var takesOneArg = R.nAry(1, takesTwoArgs);
     *      takesOneArg.length; //=> 1
     *      // Only `n` arguments are passed to the wrapped function
     *      takesOneArg(1, 2); //=> [1, undefined]
     */
    var nAry = _curry2(function (n, fn) {
        switch (n) {
        case 0:
            return function () {
                return fn.call(this);
            };
        case 1:
            return function (a0) {
                return fn.call(this, a0);
            };
        case 2:
            return function (a0, a1) {
                return fn.call(this, a0, a1);
            };
        case 3:
            return function (a0, a1, a2) {
                return fn.call(this, a0, a1, a2);
            };
        case 4:
            return function (a0, a1, a2, a3) {
                return fn.call(this, a0, a1, a2, a3);
            };
        case 5:
            return function (a0, a1, a2, a3, a4) {
                return fn.call(this, a0, a1, a2, a3, a4);
            };
        case 6:
            return function (a0, a1, a2, a3, a4, a5) {
                return fn.call(this, a0, a1, a2, a3, a4, a5);
            };
        case 7:
            return function (a0, a1, a2, a3, a4, a5, a6) {
                return fn.call(this, a0, a1, a2, a3, a4, a5, a6);
            };
        case 8:
            return function (a0, a1, a2, a3, a4, a5, a6, a7) {
                return fn.call(this, a0, a1, a2, a3, a4, a5, a6, a7);
            };
        case 9:
            return function (a0, a1, a2, a3, a4, a5, a6, a7, a8) {
                return fn.call(this, a0, a1, a2, a3, a4, a5, a6, a7, a8);
            };
        case 10:
            return function (a0, a1, a2, a3, a4, a5, a6, a7, a8, a9) {
                return fn.call(this, a0, a1, a2, a3, a4, a5, a6, a7, a8, a9);
            };
        default:
            throw new Error('First argument to nAry must be a non-negative integer no greater than ten');
        }
    });

    /**
     * Negates its argument.
     *
     * @func
     * @memberOf R
     * @category Math
     * @sig Number -> Number
     * @param {Number} n
     * @return {Number}
     * @example
     *
     *      R.negate(42); //=> -42
     */
    var negate = _curry1(function negate(n) {
        return -n;
    });

    /**
     * A function that returns the `!` of its argument. It will return `true` when
     * passed false-y value, and `false` when passed a truth-y one.
     *
     * @func
     * @memberOf R
     * @category Logic
     * @sig * -> Boolean
     * @param {*} a any value
     * @return {Boolean} the logical inverse of passed argument.
     * @example
     *
     *      R.and(false, true); //=> true
     *      R.and(0, []); //=> []
     *      R.and(null, ''); => false
     */
    var not = _curry1(function not(a) {
        return !a;
    });

    /**
     * Returns the nth element in a list.
     * If n is negative the element at index length + n is returned.
     *
     * @func
     * @memberOf R
     * @category List
     * @sig Number -> [a] -> a
     * @param {Number} idx
     * @param {Array} list
     * @return {*} The nth element of the list.
     * @example
     *
     *      var list = ['foo', 'bar', 'baz', 'quux'];
     *      R.nth(1, list); //=> 'bar'
     *      R.nth(-1, list); //=> 'quux'
     *      R.nth(-99, list); //=> undefined
     */
    var nth = _curry2(_nth);

    /**
     * Returns a function which returns its nth argument.
     *
     * @func
     * @memberOf R
     * @category Function
     * @sig Number -> *... -> *
     * @param {Number} n
     * @return {Function}
     * @example
     *
     *      R.nthArg(1)('a', 'b', 'c'); //=> 'b'
     *      R.nthArg(-1)('a', 'b', 'c'); //=> 'c'
     */
    var nthArg = _curry1(function nthArg(n) {
        return function () {
            return _nth(n, arguments);
        };
    });

    /**
     * Returns the nth character of the given string.
     *
     * @func
     * @memberOf R
     * @category String
     * @sig Number -> String -> String
     * @param {Number} n
     * @param {String} str
     * @return {String}
     * @example
     *
     *      R.nthChar(2, 'Ramda'); //=> 'm'
     *      R.nthChar(-2, 'Ramda'); //=> 'd'
     */
    var nthChar = _curry2(function nthChar(n, str) {
        return str.charAt(n < 0 ? str.length + n : n);
    });

    /**
     * Returns the character code of the nth character of the given string.
     *
     * @func
     * @memberOf R
     * @category String
     * @sig Number -> String -> Number
     * @param {Number} n
     * @param {String} str
     * @return {Number}
     * @example
     *
     *      R.nthCharCode(2, 'Ramda'); //=> 'm'.charCodeAt(0)
     *      R.nthCharCode(-2, 'Ramda'); //=> 'd'.charCodeAt(0)
     */
    var nthCharCode = _curry2(function nthCharCode(n, str) {
        return str.charCodeAt(n < 0 ? str.length + n : n);
    });

    /**
     * Returns a singleton array containing the value provided.
     *
     * Note this `of` is different from the ES6 `of`; See
     * https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/of
     *
     * @func
     * @memberOf R
     * @category Function
     * @sig a -> [a]
     * @param {*} x any value
     * @return {Array} An array wrapping `x`.
     * @example
     *
     *      R.of(null); //=> [null]
     *      R.of([42]); //=> [[42]]
     */
    var of = _curry1(function of(x) {
        return [x];
    });

    /**
     * Returns a partial copy of an object omitting the keys specified.
     *
     * @func
     * @memberOf R
     * @category Object
     * @sig [String] -> {String: *} -> {String: *}
     * @param {Array} names an array of String property names to omit from the new object
     * @param {Object} obj The object to copy from
     * @return {Object} A new object with properties from `names` not on it.
     * @example
     *
     *      R.omit(['a', 'd'], {a: 1, b: 2, c: 3, d: 4}); //=> {b: 2, c: 3}
     */
    var omit = _curry2(function omit(names, obj) {
        var result = {};
        for (var prop in obj) {
            if (_indexOf(names, prop) < 0) {
                result[prop] = obj[prop];
            }
        }
        return result;
    });

    /**
     * Accepts a function `fn` and returns a function that guards invocation of `fn` such that
     * `fn` can only ever be called once, no matter how many times the returned function is
     * invoked.
     *
     * @func
     * @memberOf R
     * @category Function
     * @sig (a... -> b) -> (a... -> b)
     * @param {Function} fn The function to wrap in a call-only-once wrapper.
     * @return {Function} The wrapped function.
     * @example
     *
     *      var addOneOnce = R.once(function(x){ return x + 1; });
     *      addOneOnce(10); //=> 11
     *      addOneOnce(addOneOnce(50)); //=> 11
     */
    var once = _curry1(function once(fn) {
        var called = false, result;
        return function () {
            if (called) {
                return result;
            }
            called = true;
            result = fn.apply(this, arguments);
            return result;
        };
    });

    /**
     * A function that returns the first truthy of two arguments otherwise the
     * last argument. Note that this is NOT short-circuited, meaning that if
     * expressions are passed they are both evaluated.
     *
     * @func
     * @memberOf R
     * @category Logic
     * @sig * -> * -> *
     * @param {*} a any value
     * @param {*} b any other value
     * @return {*} the first truthy argument, otherwise the last argument.
     * @example
     *
     *      R.or(false, true); //=> true
     *      R.or(0, []); //=> []
     *      R.or(null, ''); => ''
     */
    var or = _curry2(function or(a, b) {
        return a || b;
    });

    /**
     * Retrieve the value at a given path.
     *
     * @func
     * @memberOf R
     * @category Object
     * @sig [String] -> {*} -> *
     * @param {Array} path The path to use.
     * @return {*} The data at `path`.
     * @example
     *
     *      R.path(['a', 'b'], {a: {b: 2}}); //=> 2
     */
    var path = _curry2(_path);

    /**
     * Determines whether a nested path on an object has a specific value
     * according to strict equality ('==='). Most likely used to filter a list:
     *
     * @func
     * @memberOf R
     * @category Relation
     * @sig [String] -> * -> {String: *} -> Boolean
     * @param {Array} path The path of the nested property to use
     * @param {*} val The value to compare the nested property with
     * @param {Object} obj The object to check the nested property in
     * @return {Boolean} `true` if the value equals the nested object property,
     *         `false` otherwise.
     * @example
     *
     *     var user1 = { address: { zipCode: 90210 } };
     *     var user2 = { address: { zipCode: 55555 } };
     *     var user3 = { name: 'Bob' };
     *     var users = [ user1, user2, user3 ];
     *     var isFamous = R.pathEq(['address', 'zipCode'], 90210);
     *     R.filter(isFamous, users); //=> [ user1 ]
     */
    var pathEq = _curry3(function pathEq(path, val, obj) {
        return _path(path, obj) === val;
    });

    /**
     * Returns a partial copy of an object containing only the keys specified.  If the key does not exist, the
     * property is ignored.
     *
     * @func
     * @memberOf R
     * @category Object
     * @sig [String] -> {String: *} -> {String: *}
     * @param {Array} names an array of String property names to copy onto a new object
     * @param {Object} obj The object to copy from
     * @return {Object} A new object with only properties from `names` on it.
     * @example
     *
     *      R.pick(['a', 'd'], {a: 1, b: 2, c: 3, d: 4}); //=> {a: 1, d: 4}
     *      R.pick(['a', 'e', 'f'], {a: 1, b: 2, c: 3, d: 4}); //=> {a: 1}
     */
    var pick = _curry2(function pick(names, obj) {
        var result = {};
        for (var prop in obj) {
            if (_indexOf(names, prop) >= 0) {
                result[prop] = obj[prop];
            }
        }
        return result;
    });

    /**
     * Similar to `pick` except that this one includes a `key: undefined` pair for properties that don't exist.
     *
     * @func
     * @memberOf R
     * @category Object
     * @sig [k] -> {k: v} -> {k: v}
     * @param {Array} names an array of String property names to copy onto a new object
     * @param {Object} obj The object to copy from
     * @return {Object} A new object with only properties from `names` on it.
     * @see R.pick
     * @example
     *
     *      R.pickAll(['a', 'd'], {a: 1, b: 2, c: 3, d: 4}); //=> {a: 1, d: 4}
     *      R.pickAll(['a', 'e', 'f'], {a: 1, b: 2, c: 3, d: 4}); //=> {a: 1, e: undefined, f: undefined}
     */
    var pickAll = _curry2(function pickAll(names, obj) {
        var result = {};
        var idx = -1;
        var len = names.length;
        while (++idx < len) {
            var name = names[idx];
            result[name] = obj[name];
        }
        return result;
    });

    /**
     * Returns a partial copy of an object containing only the keys that
     * satisfy the supplied predicate.
     *
     * @func
     * @memberOf R
     * @category Object
     * @sig (v, k -> Boolean) -> {k: v} -> {k: v}
     * @param {Function} pred A predicate to determine whether or not a key
     *        should be included on the output object.
     * @param {Object} obj The object to copy from
     * @return {Object} A new object with only properties that satisfy `pred`
     *         on it.
     * @see R.pick
     * @example
     *
     *      var isUpperCase = function(val, key) { return key.toUpperCase() === key; }
     *      R.pickBy(isUpperCase, {a: 1, b: 2, A: 3, B: 4}); //=> {A: 3, B: 4}
     */
    var pickBy = _curry2(function pickBy(test, obj) {
        var result = {};
        for (var prop in obj) {
            if (test(obj[prop], prop, obj)) {
                result[prop] = obj[prop];
            }
        }
        return result;
    });

    /**
     * Returns a new list with the given element at the front, followed by the contents of the
     * list.
     *
     * @func
     * @memberOf R
     * @category List
     * @sig a -> [a] -> [a]
     * @param {*} el The item to add to the head of the output list.
     * @param {Array} list The array to add to the tail of the output list.
     * @return {Array} A new array.
     * @example
     *
     *      R.prepend('fee', ['fi', 'fo', 'fum']); //=> ['fee', 'fi', 'fo', 'fum']
     */
    var prepend = _curry2(_prepend);

    /**
     * Returns a function that when supplied an object returns the indicated property of that object, if it exists.
     *
     * @func
     * @memberOf R
     * @category Object
     * @sig s -> {s: a} -> a
     * @param {String} p The property name
     * @param {Object} obj The object to query
     * @return {*} The value at `obj.p`.
     * @example
     *
     *      R.prop('x', {x: 100}); //=> 100
     *      R.prop('x', {}); //=> undefined
     */
    var prop = _curry2(function prop(p, obj) {
        return obj[p];
    });

    /**
     * Determines whether the given property of an object has a specific
     * value according to strict equality (`===`).  Most likely used to
     * filter a list:
     *
     * @func
     * @memberOf R
     * @category Relation
     * @sig k -> v -> {k: v} -> Boolean
     * @param {Number|String} name The property name (or index) to use.
     * @param {*} val The value to compare the property with.
     * @return {Boolean} `true` if the properties are equal, `false` otherwise.
     * @example
     *
     *      var abby = {name: 'Abby', age: 7, hair: 'blond'};
     *      var fred = {name: 'Fred', age: 12, hair: 'brown'};
     *      var rusty = {name: 'Rusty', age: 10, hair: 'brown'};
     *      var alois = {name: 'Alois', age: 15, disposition: 'surly'};
     *      var kids = [abby, fred, rusty, alois];
     *      var hasBrownHair = R.propEq('hair', 'brown');
     *      R.filter(hasBrownHair, kids); //=> [fred, rusty]
     */
    var propEq = _curry3(function propEq(name, val, obj) {
        return obj[name] === val;
    });

    /**
     * If the given, non-null object has an own property with the specified name,
     * returns the value of that property.
     * Otherwise returns the provided default value.
     *
     * @func
     * @memberOf R
     * @category Object
     * @sig a -> String -> Object -> a
     * @param {*} val The default value.
     * @param {String} p The name of the property to return.
     * @param {Object} obj The object to query.
     * @return {*} The value of given property of the supplied object or the default value.
     * @example
     *
     *      var alice = {
     *        name: 'ALICE',
     *        age: 101
     *      };
     *      var favorite = R.prop('favoriteLibrary');
     *      var favoriteWithDefault = R.propOr('Ramda', 'favoriteLibrary');
     *
     *      favorite(alice);  //=> undefined
     *      favoriteWithDefault(alice);  //=> 'Ramda'
     */
    var propOr = _curry3(function propOr(val, p, obj) {
        return _has(p, obj) ? obj[p] : val;
    });

    /**
     * Acts as multiple `get`: array of keys in, array of values out. Preserves order.
     *
     * @func
     * @memberOf R
     * @category Object
     * @sig [k] -> {k: v} -> [v]
     * @param {Array} ps The property names to fetch
     * @param {Object} obj The object to query
     * @return {Array} The corresponding values or partially applied function.
     * @example
     *
     *      R.props(['x', 'y'], {x: 1, y: 2}); //=> [1, 2]
     *      R.props(['c', 'a', 'b'], {b: 2, a: 1}); //=> [undefined, 1, 2]
     *
     *      var fullName = R.compose(R.join(' '), R.props(['first', 'last']));
     *      fullName({last: 'Bullet-Tooth', age: 33, first: 'Tony'}); //=> 'Tony Bullet-Tooth'
     */
    var props = _curry2(function props(ps, obj) {
        var len = ps.length;
        var out = [];
        var idx = -1;
        while (++idx < len) {
            out[idx] = obj[ps[idx]];
        }
        return out;
    });

    /**
     * Returns a list of numbers from `from` (inclusive) to `to`
     * (exclusive).
     *
     * @func
     * @memberOf R
     * @category List
     * @sig Number -> Number -> [Number]
     * @param {Number} from The first number in the list.
     * @param {Number} to One more than the last number in the list.
     * @return {Array} The list of numbers in tthe set `[a, b)`.
     * @example
     *
     *      R.range(1, 5);    //=> [1, 2, 3, 4]
     *      R.range(50, 53);  //=> [50, 51, 52]
     */
    var range = _curry2(function range(from, to) {
        var result = [];
        var n = from;
        while (n < to) {
            result[result.length] = n;
            n += 1;
        }
        return result;
    });

    /**
     * Like `reduce`, but passes additional parameters to the predicate function.
     *
     * The iterator function receives four values: *(acc, value, index, list)*
     *
     * Note: `R.reduceIndexed` does not skip deleted or unassigned indices (sparse arrays),
     * unlike the native `Array.prototype.reduce` method. For more details on this behavior,
     * see:
     * https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/reduce#Description
     *
     * @func
     * @memberOf R
     * @category List
     * @sig (a,b,i,[b] -> a) -> a -> [b] -> a
     * @param {Function} fn The iterator function. Receives four values: the accumulator, the
     *        current element from `list`, that element's index, and the entire `list` itself.
     * @param {*} acc The accumulator value.
     * @param {Array} list The list to iterate over.
     * @return {*} The final, accumulated value.
     * @example
     *
     *      var letters = ['a', 'b', 'c'];
     *      var objectify = function(accObject, elem, idx, list) {
     *        accObject[elem] = idx;
     *        return accObject;
     *      };
     *
     *      R.reduceIndexed(objectify, {}, letters); //=> { 'a': 0, 'b': 1, 'c': 2 }
     */
    var reduceIndexed = _curry3(function reduceIndexed(fn, acc, list) {
        var idx = -1, len = list.length;
        while (++idx < len) {
            acc = fn(acc, list[idx], idx, list);
        }
        return acc;
    });

    /**
     * Returns a single item by iterating through the list, successively calling the iterator
     * function and passing it an accumulator value and the current value from the array, and
     * then passing the result to the next call.
     *
     * Similar to `reduce`, except moves through the input list from the right to the left.
     *
     * The iterator function receives two values: *(acc, value)*
     *
     * Note: `R.reduceRight` does not skip deleted or unassigned indices (sparse arrays), unlike
     * the native `Array.prototype.reduce` method. For more details on this behavior, see:
     * https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/reduceRight#Description
     *
     * @func
     * @memberOf R
     * @category List
     * @sig (a,b -> a) -> a -> [b] -> a
     * @param {Function} fn The iterator function. Receives two values, the accumulator and the
     *        current element from the array.
     * @param {*} acc The accumulator value.
     * @param {Array} list The list to iterate over.
     * @return {*} The final, accumulated value.
     * @example
     *
     *      var pairs = [ ['a', 1], ['b', 2], ['c', 3] ];
     *      var flattenPairs = function(acc, pair) {
     *        return acc.concat(pair);
     *      };
     *
     *      R.reduceRight(flattenPairs, [], pairs); //=> [ 'c', 3, 'b', 2, 'a', 1 ]
     */
    var reduceRight = _curry3(function reduceRight(fn, acc, list) {
        var idx = list.length;
        while (--idx >= 0) {
            acc = fn(acc, list[idx]);
        }
        return acc;
    });

    /**
     * Like `reduceRight`, but passes additional parameters to the predicate function. Moves through
     * the input list from the right to the left.
     *
     * The iterator function receives four values: *(acc, value, index, list)*.
     *
     * Note: `R.reduceRightIndexed` does not skip deleted or unassigned indices (sparse arrays),
     * unlike the native `Array.prototype.reduce` method. For more details on this behavior,
     * see:
     * https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/reduceRight#Description
     *
     * @func
     * @memberOf R
     * @category List
     * @sig (a,b,i,[b] -> a -> [b] -> a
     * @param {Function} fn The iterator function. Receives four values: the accumulator, the
     *        current element from `list`, that element's index, and the entire `list` itself.
     * @param {*} acc The accumulator value.
     * @param {Array} list The list to iterate over.
     * @return {*} The final, accumulated value.
     * @example
     *
     *      var letters = ['a', 'b', 'c'];
     *      var objectify = function(accObject, elem, idx, list) {
     *        accObject[elem] = idx;
     *        return accObject;
     *      };
     *
     *      R.reduceRightIndexed(objectify, {}, letters); //=> { 'c': 2, 'b': 1, 'a': 0 }
     */
    var reduceRightIndexed = _curry3(function reduceRightIndexed(fn, acc, list) {
        var idx = list.length;
        while (--idx >= 0) {
            acc = fn(acc, list[idx], idx, list);
        }
        return acc;
    });

    /**
     * Like `reject`, but passes additional parameters to the predicate function. The predicate
     * function is passed three arguments: *(value, index, list)*.
     *
     * @func
     * @memberOf R
     * @category List
     * @sig (a, i, [a] -> Boolean) -> [a] -> [a]
     * @param {Function} fn The function called per iteration.
     * @param {Array} list The collection to iterate over.
     * @return {Array} The new filtered array.
     * @example
     *
     *      var lastTwo = function(val, idx, list) {
     *        return list.length - idx <= 2;
     *      };
     *
     *      R.rejectIndexed(lastTwo, [8, 6, 7, 5, 3, 0, 9]); //=> [8, 6, 7, 5, 3]
     */
    var rejectIndexed = _curry2(function rejectIndexed(fn, list) {
        return _filterIndexed(_complement(fn), list);
    });

    /**
     * Removes the sub-list of `list` starting at index `start` and containing
     * `count` elements.  _Note that this is not destructive_: it returns a
     * copy of the list with the changes.
     * <small>No lists have been harmed in the application of this function.</small>
     *
     * @func
     * @memberOf R
     * @category List
     * @sig Number -> Number -> [a] -> [a]
     * @param {Number} start The position to start removing elements
     * @param {Number} count The number of elements to remove
     * @param {Array} list The list to remove from
     * @return {Array} A new Array with `count` elements from `start` removed.
     * @example
     *
     *      R.remove(2, 3, [1,2,3,4,5,6,7,8]); //=> [1,2,6,7,8]
     */
    var remove = _curry3(function remove(start, count, list) {
        return _concat(_slice(list, 0, Math.min(start, list.length)), _slice(list, Math.min(list.length, start + count)));
    });

    /**
     * Replace a substring or regex match in a string with a replacement.
     *
     * @func
     * @memberOf R
     * @category String
     * @sig RegExp|String -> String -> String -> String
     * @param {RegExp|String} pattern A regular expression or a substring to match.
     * @param {String} replacement The string to replace the matches with.
     * @param {String} str The String to do the search and replacement in.
     * @return {String} The result.
     * @example
     *
     *      R.replace('foo', 'bar', 'foo foo foo'); //=> 'bar foo foo'
     *      R.replace(/foo/, 'bar', 'foo foo foo'); //=> 'bar foo foo'
     *
     *      // Use the "g" (global) flag to replace all occurrences:
     *      R.replace(/foo/g, 'bar', 'foo foo foo'); //=> 'bar bar bar'
     */
    var replace = _curry3(function replace(regex, replacement, str) {
        return str.replace(regex, replacement);
    });

    /**
     * Returns a new list with the same elements as the original list, just
     * in the reverse order.
     *
     * @func
     * @memberOf R
     * @category List
     * @sig [a] -> [a]
     * @param {Array} list The list to reverse.
     * @return {Array} A copy of the list in reverse order.
     * @example
     *
     *      R.reverse([1, 2, 3]);  //=> [3, 2, 1]
     *      R.reverse([1, 2]);     //=> [2, 1]
     *      R.reverse([1]);        //=> [1]
     *      R.reverse([]);         //=> []
     */
    var reverse = _curry1(function reverse(list) {
        return _slice(list).reverse();
    });

    /**
     * Scan is similar to reduce, but returns a list of successively reduced values from the left
     *
     * @func
     * @memberOf R
     * @category List
     * @sig (a,b -> a) -> a -> [b] -> [a]
     * @param {Function} fn The iterator function. Receives two values, the accumulator and the
     *        current element from the array
     * @param {*} acc The accumulator value.
     * @param {Array} list The list to iterate over.
     * @return {Array} A list of all intermediately reduced values.
     * @example
     *
     *      var numbers = [1, 2, 3, 4];
     *      var factorials = R.scan(R.multiply, 1, numbers); //=> [1, 1, 2, 6, 24]
     */
    var scan = _curry3(function scan(fn, acc, list) {
        var idx = 0, len = list.length + 1, result = [acc];
        while (++idx < len) {
            acc = fn(acc, list[idx - 1]);
            result[idx] = acc;
        }
        return result;
    });

    /**
     * Sorts the list according to a key generated by the supplied function.
     *
     * @func
     * @memberOf R
     * @category Relation
     * @sig (a -> String) -> [a] -> [a]
     * @param {Function} fn The function mapping `list` items to keys.
     * @param {Array} list The list to sort.
     * @return {Array} A new list sorted by the keys generated by `fn`.
     * @example
     *
     *      var sortByFirstItem = R.sortBy(prop(0));
     *      var sortByNameCaseInsensitive = R.sortBy(compose(R.toLower, prop('name')));
     *      var pairs = [[-1, 1], [-2, 2], [-3, 3]];
     *      sortByFirstItem(pairs); //=> [[-3, 3], [-2, 2], [-1, 1]]
     *      var alice = {
     *        name: 'ALICE',
     *        age: 101
     *      };
     *      var bob = {
     *        name: 'Bob',
     *        age: -10
     *      };
     *      var clara = {
     *        name: 'clara',
     *        age: 314.159
     *      };
     *      var people = [clara, bob, alice];
     *      sortByNameCaseInsensitive(people); //=> [alice, bob, clara]
     */
    var sortBy = _curry2(function sortBy(fn, list) {
        return _slice(list).sort(function (a, b) {
            var aa = fn(a);
            var bb = fn(b);
            return aa < bb ? -1 : aa > bb ? 1 : 0;
        });
    });

    /**
     * Finds the first index of a substring in a string, returning -1 if it's not present
     *
     * @func
     * @memberOf R
     * @category String
     * @sig String -> String -> Number
     * @param {String} c A string to find.
     * @param {String} str The string to search in
     * @return {Number} The first index of `c` or -1 if not found.
     * @example
     *
     *      R.strIndexOf('c', 'abcdefg'); //=> 2
     */
    var strIndexOf = _curry2(function strIndexOf(c, str) {
        return str.indexOf(c);
    });

    /**
     *
     * Finds the last index of a substring in a string, returning -1 if it's not present
     *
     * @func
     * @memberOf R
     * @category String
     * @sig String -> String -> Number
     * @param {String} c A string to find.
     * @param {String} str The string to search in
     * @return {Number} The last index of `c` or -1 if not found.
     * @example
     *
     *      R.strLastIndexOf('a', 'banana split'); //=> 5
     */
    var strLastIndexOf = _curry2(function (c, str) {
        return str.lastIndexOf(c);
    });

    /**
     * Subtracts two numbers. Equivalent to `a - b` but curried.
     *
     * @func
     * @memberOf R
     * @category Math
     * @sig Number -> Number -> Number
     * @param {Number} a The first value.
     * @param {Number} b The second value.
     * @return {Number} The result of `a - b`.
     * @example
     *
     *      R.subtract(10, 8); //=> 2
     *
     *      var minus5 = R.subtract(R.__, 5);
     *      minus5(17); //=> 12
     *
     *      var complementaryAngle = R.subtract(90);
     *      complementaryAngle(30); //=> 60
     *      complementaryAngle(72); //=> 18
     */
    var subtract = _curry2(function subtract(a, b) {
        return a - b;
    });

    /**
     * Runs the given function with the supplied object, then returns the object.
     *
     * @func
     * @memberOf R
     * @category Function
     * @sig (a -> *) -> a -> a
     * @param {Function} fn The function to call with `x`. The return value of `fn` will be thrown away.
     * @param {*} x
     * @return {*} `x`.
     * @example
     *
     *      var sayX = function(x) { console.log('x is ' + x); };
     *      R.tap(sayX, 100); //=> 100
     *      //-> 'x is 100'
     */
    var tap = _curry2(function tap(fn, x) {
        fn(x);
        return x;
    });

    /**
     * Determines whether a given string matches a given regular expression.
     *
     * @func
     * @memberOf R
     * @category String
     * @sig RegExp -> String -> Boolean
     * @param {RegExp} pattern
     * @param {String} str
     * @return {Boolean}
     * @example
     *
     *      R.test(/^x/, 'xyz'); //=> true
     *      R.test(/^y/, 'xyz'); //=> false
     */
    var test = _curry2(function test(pattern, str) {
        return _cloneRegExp(pattern).test(str);
    });

    /**
     * Calls an input function `n` times, returning an array containing the results of those
     * function calls.
     *
     * `fn` is passed one argument: The current value of `n`, which begins at `0` and is
     * gradually incremented to `n - 1`.
     *
     * @func
     * @memberOf R
     * @category List
     * @sig (i -> a) -> i -> [a]
     * @param {Function} fn The function to invoke. Passed one argument, the current value of `n`.
     * @param {Number} n A value between `0` and `n - 1`. Increments after each function call.
     * @return {Array} An array containing the return values of all calls to `fn`.
     * @example
     *
     *      R.times(R.identity, 5); //=> [0, 1, 2, 3, 4]
     */
    var times = _curry2(function times(fn, n) {
        var len = Number(n);
        var list = new Array(len);
        var idx = 0;
        while (idx < len) {
            list[idx] = fn(idx);
            idx += 1;
        }
        return list;
    });

    /**
     * Converts an object into an array of key, value arrays.
     * Only the object's own properties are used.
     * Note that the order of the output array is not guaranteed to be
     * consistent across different JS platforms.
     *
     * @func
     * @memberOf R
     * @category Object
     * @sig {String: *} -> [[String,*]]
     * @param {Object} obj The object to extract from
     * @return {Array} An array of key, value arrays from the object's own properties.
     * @example
     *
     *      R.toPairs({a: 1, b: 2, c: 3}); //=> [['a', 1], ['b', 2], ['c', 3]]
     */
    var toPairs = _curry1(function toPairs(obj) {
        var pairs = [];
        for (var prop in obj) {
            if (_has(prop, obj)) {
                pairs[pairs.length] = [
                    prop,
                    obj[prop]
                ];
            }
        }
        return pairs;
    });

    /**
     * Converts an object into an array of key, value arrays.
     * The object's own properties and prototype properties are used.
     * Note that the order of the output array is not guaranteed to be
     * consistent across different JS platforms.
     *
     * @func
     * @memberOf R
     * @category Object
     * @sig {String: *} -> [[String,*]]
     * @param {Object} obj The object to extract from
     * @return {Array} An array of key, value arrays from the object's own
     *         and prototype properties.
     * @example
     *
     *      var F = function() { this.x = 'X'; };
     *      F.prototype.y = 'Y';
     *      var f = new F();
     *      R.toPairsIn(f); //=> [['x','X'], ['y','Y']]
     */
    var toPairsIn = _curry1(function toPairsIn(obj) {
        var pairs = [];
        for (var prop in obj) {
            pairs[pairs.length] = [
                prop,
                obj[prop]
            ];
        }
        return pairs;
    });

    /**
     * Removes (strips) whitespace from both ends of the string.
     *
     * @func
     * @memberOf R
     * @category String
     * @sig String -> String
     * @param {String} str The string to trim.
     * @return {String} Trimmed version of `str`.
     * @example
     *
     *      R.trim('   xyz  '); //=> 'xyz'
     *      R.map(R.trim, R.split(',', 'x, y, z')); //=> ['x', 'y', 'z']
     */
    var trim = function () {
        var ws = '\t\n\x0B\f\r \xA0\u1680\u180E\u2000\u2001\u2002\u2003' + '\u2004\u2005\u2006\u2007\u2008\u2009\u200A\u202F\u205F\u3000\u2028' + '\u2029\uFEFF';
        var zeroWidth = '\u200B';
        var hasProtoTrim = typeof String.prototype.trim === 'function';
        if (!hasProtoTrim || (ws.trim() || !zeroWidth.trim())) {
            return _curry1(function trim(str) {
                var beginRx = new RegExp('^[' + ws + '][' + ws + ']*');
                var endRx = new RegExp('[' + ws + '][' + ws + ']*$');
                return str.replace(beginRx, '').replace(endRx, '');
            });
        } else {
            return _curry1(function trim(str) {
                return str.trim();
            });
        }
    }();

    /**
     * Gives a single-word string description of the (native) type of a value, returning such
     * answers as 'Object', 'Number', 'Array', or 'Null'.  Does not attempt to distinguish user
     * Object types any further, reporting them all as 'Object'.
     *
     * @func
     * @memberOf R
     * @category Type
     * @sig (* -> {*}) -> String
     * @param {*} val The value to test
     * @return {String}
     * @example
     *
     *      R.type({}); //=> "Object"
     *      R.type(1); //=> "Number"
     *      R.type(false); //=> "Boolean"
     *      R.type('s'); //=> "String"
     *      R.type(null); //=> "Null"
     *      R.type([]); //=> "Array"
     *      R.type(/[A-z]/); //=> "RegExp"
     */
    var type = _curry1(function type(val) {
        return val === null ? 'Null' : val === undefined ? 'Undefined' : Object.prototype.toString.call(val).slice(8, -1);
    });

    /**
     * Takes a function `fn`, which takes a single array argument, and returns
     * a function which:
     *
     *   - takes any number of positional arguments;
     *   - passes these arguments to `fn` as an array; and
     *   - returns the result.
     *
     * In other words, R.unapply derives a variadic function from a function
     * which takes an array. R.unapply is the inverse of R.apply.
     *
     * @func
     * @memberOf R
     * @category Function
     * @sig ([*...] -> a) -> (*... -> a)
     * @param {Function} fn
     * @return {Function}
     * @see R.apply
     * @example
     *
     *      R.unapply(JSON.stringify)(1, 2, 3); //=> '[1,2,3]'
     */
    var unapply = _curry1(function unapply(fn) {
        return function () {
            return fn(_slice(arguments));
        };
    });

    /**
     * Wraps a function of any arity (including nullary) in a function that accepts exactly 1
     * parameter. Any extraneous parameters will not be passed to the supplied function.
     *
     * @func
     * @memberOf R
     * @category Function
     * @sig (* -> b) -> (a -> b)
     * @param {Function} fn The function to wrap.
     * @return {Function} A new function wrapping `fn`. The new function is guaranteed to be of
     *         arity 1.
     * @example
     *
     *      var takesTwoArgs = function(a, b) {
     *        return [a, b];
     *      };
     *      takesTwoArgs.length; //=> 2
     *      takesTwoArgs(1, 2); //=> [1, 2]
     *
     *      var takesOneArg = R.unary(takesTwoArgs);
     *      takesOneArg.length; //=> 1
     *      // Only 1 argument is passed to the wrapped function
     *      takesOneArg(1, 2); //=> [1, undefined]
     */
    var unary = _curry1(function unary(fn) {
        return nAry(1, fn);
    });

    /**
     * Builds a list from a seed value. Accepts an iterator function, which returns either false
     * to stop iteration or an array of length 2 containing the value to add to the resulting
     * list and the seed to be used in the next call to the iterator function.
     *
     * The iterator function receives one argument: *(seed)*.
     *
     * @func
     * @memberOf R
     * @category List
     * @sig (a -> [b]) -> * -> [b]
     * @param {Function} fn The iterator function. receives one argument, `seed`, and returns
     *        either false to quit iteration or an array of length two to proceed. The element
     *        at index 0 of this array will be added to the resulting array, and the element
     *        at index 1 will be passed to the next call to `fn`.
     * @param {*} seed The seed value.
     * @return {Array} The final list.
     * @example
     *
     *      var f = function(n) { return n > 50 ? false : [-n, n + 10] };
     *      R.unfold(f, 10); //=> [-10, -20, -30, -40, -50]
     */
    var unfold = _curry2(function unfold(fn, seed) {
        var pair = fn(seed);
        var result = [];
        while (pair && pair.length) {
            result[result.length] = pair[0];
            pair = fn(pair[1]);
        }
        return result;
    });

    /**
     * Returns a new list containing only one copy of each element in the original list, based
     * upon the value returned by applying the supplied predicate to two list elements. Prefers
     * the first item if two items compare equal based on the predicate.
     *
     * @func
     * @memberOf R
     * @category List
     * @sig (a, a -> Boolean) -> [a] -> [a]
     * @param {Function} pred A predicate used to test whether two items are equal.
     * @param {Array} list The array to consider.
     * @return {Array} The list of unique items.
     * @example
     *
     *      var strEq = function(a, b) { return String(a) === String(b); };
     *      R.uniqWith(strEq)([1, '1', 2, 1]); //=> [1, 2]
     *      R.uniqWith(strEq)([{}, {}]);       //=> [{}]
     *      R.uniqWith(strEq)([1, '1', 1]);    //=> [1]
     *      R.uniqWith(strEq)(['1', 1, 1]);    //=> ['1']
     */
    var uniqWith = _curry2(function uniqWith(pred, list) {
        var idx = -1, len = list.length;
        var result = [], item;
        while (++idx < len) {
            item = list[idx];
            if (!_containsWith(pred, item, result)) {
                result[result.length] = item;
            }
        }
        return result;
    });

    /**
     * Returns a list of all the properties, including prototype properties,
     * of the supplied object.
     * Note that the order of the output array is not guaranteed to be
     * consistent across different JS platforms.
     *
     * @func
     * @memberOf R
     * @category Object
     * @sig {k: v} -> [v]
     * @param {Object} obj The object to extract values from
     * @return {Array} An array of the values of the object's own and prototype properties.
     * @example
     *
     *      var F = function() { this.x = 'X'; };
     *      F.prototype.y = 'Y';
     *      var f = new F();
     *      R.valuesIn(f); //=> ['X', 'Y']
     */
    var valuesIn = _curry1(function valuesIn(obj) {
        var prop, vs = [];
        for (prop in obj) {
            vs[vs.length] = obj[prop];
        }
        return vs;
    });

    /**
     * Wrap a function inside another to allow you to make adjustments to the parameters, or do
     * other processing either before the internal function is called or with its results.
     *
     * @func
     * @memberOf R
     * @category Function
     * @sig (a... -> b) -> ((a... -> b) -> a... -> c) -> (a... -> c)
     * @param {Function} fn The function to wrap.
     * @param {Function} wrapper The wrapper function.
     * @return {Function} The wrapped function.
     * @example
     *
     *      var greet = function(name) {return 'Hello ' + name;};
     *
     *      var shoutedGreet = R.wrap(greet, function(gr, name) {
     *        return gr(name).toUpperCase();
     *      });
     *      shoutedGreet("Kathy"); //=> "HELLO KATHY"
     *
     *      var shortenedGreet = R.wrap(greet, function(gr, name) {
     *        return gr(name.substring(0, 3));
     *      });
     *      shortenedGreet("Robert"); //=> "Hello Rob"
     */
    var wrap = _curry2(function wrap(fn, wrapper) {
        return curryN(fn.length, function () {
            return wrapper.apply(this, _concat([fn], arguments));
        });
    });

    /**
     * Creates a new list out of the two supplied by creating each possible
     * pair from the lists.
     *
     * @func
     * @memberOf R
     * @category List
     * @sig [a] -> [b] -> [[a,b]]
     * @param {Array} as The first list.
     * @param {Array} bs The second list.
     * @return {Array} The list made by combining each possible pair from
     *         `as` and `bs` into pairs (`[a, b]`).
     * @example
     *
     *      R.xprod([1, 2], ['a', 'b']); //=> [[1, 'a'], [1, 'b'], [2, 'a'], [2, 'b']]
     */
    // = xprodWith(prepend); (takes about 3 times as long...)
    var xprod = _curry2(function xprod(a, b) {
        // = xprodWith(prepend); (takes about 3 times as long...)
        var idx = -1;
        var ilen = a.length;
        var j;
        var jlen = b.length;
        var result = [];
        while (++idx < ilen) {
            j = -1;
            while (++j < jlen) {
                result[result.length] = [
                    a[idx],
                    b[j]
                ];
            }
        }
        return result;
    });

    /**
     * Creates a new list out of the two supplied by pairing up
     * equally-positioned items from both lists.  The returned list is
     * truncated to the length of the shorter of the two input lists.
     * Note: `zip` is equivalent to `zipWith(function(a, b) { return [a, b] })`.
     *
     * @func
     * @memberOf R
     * @category List
     * @sig [a] -> [b] -> [[a,b]]
     * @param {Array} list1 The first array to consider.
     * @param {Array} list2 The second array to consider.
     * @return {Array} The list made by pairing up same-indexed elements of `list1` and `list2`.
     * @example
     *
     *      R.zip([1, 2, 3], ['a', 'b', 'c']); //=> [[1, 'a'], [2, 'b'], [3, 'c']]
     */
    var zip = _curry2(function zip(a, b) {
        var rv = [];
        var idx = -1;
        var len = Math.min(a.length, b.length);
        while (++idx < len) {
            rv[idx] = [
                a[idx],
                b[idx]
            ];
        }
        return rv;
    });

    /**
     * Creates a new object out of a list of keys and a list of values.
     *
     * @func
     * @memberOf R
     * @category List
     * @sig [String] -> [*] -> {String: *}
     * @param {Array} keys The array that will be properties on the output object.
     * @param {Array} values The list of values on the output object.
     * @return {Object} The object made by pairing up same-indexed elements of `keys` and `values`.
     * @example
     *
     *      R.zipObj(['a', 'b', 'c'], [1, 2, 3]); //=> {a: 1, b: 2, c: 3}
     */
    var zipObj = _curry2(function zipObj(keys, values) {
        var idx = -1, len = keys.length, out = {};
        while (++idx < len) {
            out[keys[idx]] = values[idx];
        }
        return out;
    });

    /**
     * Creates a new list out of the two supplied by applying the function to
     * each equally-positioned pair in the lists. The returned list is
     * truncated to the length of the shorter of the two input lists.
     *
     * @function
     * @memberOf R
     * @category List
     * @sig (a,b -> c) -> [a] -> [b] -> [c]
     * @param {Function} fn The function used to combine the two elements into one value.
     * @param {Array} list1 The first array to consider.
     * @param {Array} list2 The second array to consider.
     * @return {Array} The list made by combining same-indexed elements of `list1` and `list2`
     *         using `fn`.
     * @example
     *
     *      var f = function(x, y) {
     *        // ...
     *      };
     *      R.zipWith(f, [1, 2, 3], ['a', 'b', 'c']);
     *      //=> [f(1, 'a'), f(2, 'b'), f(3, 'c')]
     */
    var zipWith = _curry3(function zipWith(fn, a, b) {
        var rv = [], idx = -1, len = Math.min(a.length, b.length);
        while (++idx < len) {
            rv[idx] = fn(a[idx], b[idx]);
        }
        return rv;
    });

    /**
     * A function that always returns `false`. Any passed in parameters are ignored.
     *
     * @func
     * @memberOf R
     * @category Function
     * @sig * -> false
     * @see R.always
     * @return {Boolean} false
     * @example
     *
     *      R.F(); //=> false
     */
    var F = always(false);

    /**
     * A function that always returns `true`. Any passed in parameters are ignored.
     *
     * @func
     * @memberOf R
     * @category Function
     * @sig * -> true
     * @see R.always
     * @return {Boolean} `true`.
     * @example
     *
     *      R.T(); //=> true
     */
    var T = always(true);

    var _append = function _append(el, list) {
        return _concat(list, [el]);
    };

    var _assocPath = function _assocPath(path, val, obj) {
        switch (path.length) {
        case 0:
            return obj;
        case 1:
            return _assoc(path[0], val, obj);
        default:
            return _assoc(path[0], _assocPath(_slice(path, 1), val, Object(obj[path[0]])), obj);
        }
    };

    /**
     * Copies an object.
     *
     * @private
     * @param {*} value The value to be copied
     * @param {Array} refFrom Array containing the source references
     * @param {Array} refTo Array containing the copied source references
     * @return {*} The copied value.
     */
    var _baseCopy = function _baseCopy(value, refFrom, refTo) {
        var copy = function copy(copiedValue) {
            var len = refFrom.length;
            var idx = -1;
            while (++idx < len) {
                if (value === refFrom[idx]) {
                    return refTo[idx];
                }
            }
            refFrom[idx + 1] = value;
            refTo[idx + 1] = copiedValue;
            for (var key in value) {
                copiedValue[key] = _baseCopy(value[key], refFrom, refTo);
            }
            return copiedValue;
        };
        switch (type(value)) {
        case 'Object':
            return copy({});
        case 'Array':
            return copy([]);
        case 'Date':
            return new Date(value);
        case 'RegExp':
            return _cloneRegExp(value);
        default:
            return value;
        }
    };

    /**
     * Similar to hasMethod, this checks whether a function has a [methodname]
     * function. If it isn't an array it will execute that function otherwise it will
     * default to the ramda implementation.
     *
     * @private
     * @param {Function} fn ramda implemtation
     * @param {String} methodname property to check for a custom implementation
     * @return {Object} Whatever the return value of the method is.
     */
    var _checkForMethod = function _checkForMethod(methodname, fn) {
        return function () {
            var length = arguments.length;
            if (length === 0) {
                return fn();
            }
            var obj = arguments[length - 1];
            return _isArray(obj) || typeof obj[methodname] !== 'function' ? fn.apply(this, arguments) : obj[methodname].apply(obj, _slice(arguments, 0, length - 1));
        };
    };

    /**
     * A right-associative two-argument composition function like `_compose`
     * but with automatic handling of promises (or, more precisely,
     * "thenables"). This function is used to construct a more general
     * `composeP` function, which accepts any number of arguments.
     *
     * @private
     * @category Function
     * @param {Function} f A function.
     * @param {Function} g A function.
     * @return {Function} A new function that is the equivalent of `f(g(x))`.
     * @example
     *
     *      var Q = require('q');
     *      var double = function(x) { return x * 2; };
     *      var squareAsync = function(x) { return Q.when(x * x); };
     *      var squareAsyncThenDouble = _composeP(double, squareAsync);
     *
     *      squareAsyncThenDouble(5)
     *        .then(function(result) {
     *          // the result is now 50.
     *        });
     */
    var _composeP = function _composeP(f, g) {
        return function () {
            var context = this;
            var value = g.apply(this, arguments);
            if (_isThenable(value)) {
                return value.then(function (result) {
                    return f.call(context, result);
                });
            } else {
                return f.call(this, value);
            }
        };
    };

    var _contains = function _contains(a, list) {
        return _indexOf(list, a) >= 0;
    };

    /*
     * Returns a function that makes a multi-argument version of compose from
     * either _compose or _composeP.
     */
    var _createComposer = function _createComposer(composeFunction) {
        return function () {
            var idx = arguments.length - 1;
            var fn = arguments[idx];
            var length = fn.length;
            while (--idx >= 0) {
                fn = composeFunction(arguments[idx], fn);
            }
            return arity(length, fn);
        };
    };

    /**
     * Create a function which takes a list
     * and determines the winning value by a comparator. Used internally
     * by `R.max` and `R.min`
     *
     * @private
     * @param {Function} compatator a function to compare two items
     * @param {*} intialVal, default value if nothing else wins
     * @category Math
     * @return {Function}
     */
    var _createMaxMin = function _createMaxMin(comparator, initialVal) {
        return _curry1(function (list) {
            var idx = -1, winner = initialVal, computed;
            while (++idx < list.length) {
                computed = +list[idx];
                if (comparator(computed, winner)) {
                    winner = computed;
                }
            }
            return winner;
        });
    };

    var _createPartialApplicator = function _createPartialApplicator(concat) {
        return function (fn) {
            var args = _slice(arguments, 1);
            return arity(Math.max(0, fn.length - args.length), function () {
                return fn.apply(this, concat(args, arguments));
            });
        };
    };

    /**
     * Returns a function that dispatches with different strategies based on the
     * object in list position (last argument). If it is an array, executes [fn].
     * Otherwise, if it has a  function with [methodname], it will execute that
     * function (functor case). Otherwise, if it is a transformer, uses transducer
     * [xf] to return a new transformer (transducer case). Otherwise, it will
     * default to executing [fn].
     *
     * @private
     * @param {String} methodname property to check for a custom implementation
     * @param {Function} xf transducer to initialize if object is transformer
     * @param {Function} fn default ramda implementation
     * @return {Function} A function that dispatches on object in list position
     */
    var _dispatchable = function _dispatchable(methodname, xf, fn) {
        return function () {
            var length = arguments.length;
            if (length === 0) {
                return fn();
            }
            var obj = arguments[length - 1];
            if (!_isArray(obj)) {
                var args = _slice(arguments, 0, length - 1);
                if (typeof obj[methodname] === 'function') {
                    return obj[methodname].apply(obj, args);
                }
                if (_isTransformer(obj)) {
                    var transducer = xf.apply(null, args);
                    return transducer(obj);
                }
            }
            return fn.apply(this, arguments);
        };
    };

    var _dissocPath = function _dissocPath(path, obj) {
        switch (path.length) {
        case 0:
            return obj;
        case 1:
            return _dissoc(path[0], obj);
        default:
            var head = path[0];
            var tail = _slice(path, 1);
            return obj[head] == null ? obj : _assoc(head, _dissocPath(tail, obj[head]), obj);
        }
    };

    /**
     * Private function that determines whether or not a provided object has a given method.
     * Does not ignore methods stored on the object's prototype chain. Used for dynamically
     * dispatching Ramda methods to non-Array objects.
     *
     * @private
     * @param {String} methodName The name of the method to check for.
     * @param {Object} obj The object to test.
     * @return {Boolean} `true` has a given method, `false` otherwise.
     * @example
     *
     *      var person = { name: 'John' };
     *      person.shout = function() { alert(this.name); };
     *
     *      _hasMethod('shout', person); //=> true
     *      _hasMethod('foo', person); //=> false
     */
    var _hasMethod = function _hasMethod(methodName, obj) {
        return obj != null && !_isArray(obj) && typeof obj[methodName] === 'function';
    };

    /**
     * `_makeFlat` is a helper function that returns a one-level or fully recursive function
     * based on the flag passed in.
     *
     * @private
     */
    var _makeFlat = function _makeFlat(recursive) {
        return function flatt(list) {
            var value, result = [], idx = -1, j, ilen = list.length, jlen;
            while (++idx < ilen) {
                if (isArrayLike(list[idx])) {
                    value = recursive ? flatt(list[idx]) : list[idx];
                    j = -1;
                    jlen = value.length;
                    while (++j < jlen) {
                        result[result.length] = value[j];
                    }
                } else {
                    result[result.length] = list[idx];
                }
            }
            return result;
        };
    };

    var _pluck = function _pluck(p, list) {
        return _map(prop(p), list);
    };

    var _reduce = function () {
        function _arrayReduce(xf, acc, list) {
            var idx = -1, len = list.length;
            while (++idx < len) {
                acc = xf.step(acc, list[idx]);
                if (acc && acc.__transducers_reduced__) {
                    acc = acc.value;
                    break;
                }
            }
            return xf.result(acc);
        }
        function _iterableReduce(xf, acc, iter) {
            var step = iter.next();
            while (!step.done) {
                acc = xf.step(acc, step.value);
                if (acc && acc.__transducers_reduced__) {
                    acc = acc.value;
                    break;
                }
                step = iter.next();
            }
            return xf.result(acc);
        }
        function _methodReduce(xf, acc, obj) {
            return xf.result(obj.reduce(bind(xf.step, xf), acc));
        }
        var symIterator = typeof Symbol !== 'undefined' ? Symbol.iterator : '@@iterator';
        return function _reduce(fn, acc, list) {
            if (typeof fn === 'function') {
                fn = _xwrap(fn);
            }
            if (isArrayLike(list)) {
                return _arrayReduce(fn, acc, list);
            }
            if (typeof list.reduce === 'function') {
                return _methodReduce(fn, acc, list);
            }
            if (list[symIterator] != null) {
                return _iterableReduce(fn, acc, list[symIterator]());
            }
            if (typeof list.next === 'function') {
                return _iterableReduce(fn, acc, list);
            }
            throw new TypeError('reduce: list must be array or iterable');
        };
    }();

    var _xgroupBy = function () {
        function XGroupBy(f, xf) {
            this.xf = xf;
            this.f = f;
            this.inputs = {};
        }
        XGroupBy.prototype.init = function () {
            return this.xf.init();
        };
        XGroupBy.prototype.result = function (result) {
            var key;
            for (key in this.inputs) {
                if (_has(key, this.inputs)) {
                    result = this.xf.step(result, this.inputs[key]);
                    if (result.__transducers_reduced__) {
                        result = result.value;
                        break;
                    }
                }
            }
            return this.xf.result(result);
        };
        XGroupBy.prototype.step = function (result, input) {
            var key = this.f(input);
            this.inputs[key] = this.inputs[key] || [
                key,
                []
            ];
            this.inputs[key][1] = _append(input, this.inputs[key][1]);
            return result;
        };
        return _curry2(function _xgroupBy(f, xf) {
            return new XGroupBy(f, xf);
        });
    }();

    /**
     * Returns `true` if all elements of the list match the predicate, `false` if there are any
     * that don't.
     *
     * Acts as a transducer if a transformer is given in list position.
     * @see R.transduce
     *
     * @func
     * @memberOf R
     * @category List
     * @sig (a -> Boolean) -> [a] -> Boolean
     * @param {Function} fn The predicate function.
     * @param {Array} list The array to consider.
     * @return {Boolean} `true` if the predicate is satisfied by every element, `false`
     *         otherwise.
     * @example
     *
     *      var lessThan2 = R.flip(R.lt)(2);
     *      var lessThan3 = R.flip(R.lt)(3);
     *      R.all(lessThan2)([1, 2]); //=> false
     *      R.all(lessThan3)([1, 2]); //=> true
     */
    var all = _curry2(_dispatchable('all', _xall, _all));

    /**
     * Returns `true` if at least one of elements of the list match the predicate, `false`
     * otherwise.
     *
     * Acts as a transducer if a transformer is given in list position.
     * @see R.transduce
     *
     * @func
     * @memberOf R
     * @category List
     * @sig (a -> Boolean) -> [a] -> Boolean
     * @param {Function} fn The predicate function.
     * @param {Array} list The array to consider.
     * @return {Boolean} `true` if the predicate is satisfied by at least one element, `false`
     *         otherwise.
     * @example
     *
     *      var lessThan0 = R.flip(R.lt)(0);
     *      var lessThan2 = R.flip(R.lt)(2);
     *      R.any(lessThan0)([1, 2]); //=> false
     *      R.any(lessThan2)([1, 2]); //=> true
     */
    var any = _curry2(_dispatchable('any', _xany, _any));

    /**
     * Returns a new list containing the contents of the given list, followed by the given
     * element.
     *
     * @func
     * @memberOf R
     * @category List
     * @sig a -> [a] -> [a]
     * @param {*} el The element to add to the end of the new list.
     * @param {Array} list The list whose contents will be added to the beginning of the output
     *        list.
     * @return {Array} A new list containing the contents of the old list followed by `el`.
     * @example
     *
     *      R.append('tests', ['write', 'more']); //=> ['write', 'more', 'tests']
     *      R.append('tests', []); //=> ['tests']
     *      R.append(['tests'], ['write', 'more']); //=> ['write', 'more', ['tests']]
     */
    var append = _curry2(_append);

    /**
     * Makes a shallow clone of an object, setting or overriding the nodes
     * required to create the given path, and placing the specific value at the
     * tail end of that path.  Note that this copies and flattens prototype
     * properties onto the new object as well.  All non-primitive properties
     * are copied by reference.
     *
     * @func
     * @memberOf R
     * @category Object
     * @sig [String] -> a -> {k: v} -> {k: v}
     * @param {Array} path the path to set
     * @param {*} val the new value
     * @param {Object} obj the object to clone
     * @return {Object} a new object similar to the original except along the specified path.
     * @example
     *
     *      R.assocPath(['a', 'b', 'c'], 42, {a: {b: {c: 0}}}); //=> {a: {b: {c: 42}}}
     */
    var assocPath = _curry3(_assocPath);

    /**
     * Wraps a function of any arity (including nullary) in a function that accepts exactly 2
     * parameters. Any extraneous parameters will not be passed to the supplied function.
     *
     * @func
     * @memberOf R
     * @category Function
     * @sig (* -> c) -> (a, b -> c)
     * @param {Function} fn The function to wrap.
     * @return {Function} A new function wrapping `fn`. The new function is guaranteed to be of
     *         arity 2.
     * @example
     *
     *      var takesThreeArgs = function(a, b, c) {
     *        return [a, b, c];
     *      };
     *      takesThreeArgs.length; //=> 3
     *      takesThreeArgs(1, 2, 3); //=> [1, 2, 3]
     *
     *      var takesTwoArgs = R.binary(takesThreeArgs);
     *      takesTwoArgs.length; //=> 2
     *      // Only 2 arguments are passed to the wrapped function
     *      takesTwoArgs(1, 2, 3); //=> [1, 2, undefined]
     */
    var binary = _curry1(function binary(fn) {
        return nAry(2, fn);
    });

    /**
     * Creates a deep copy of the value which may contain (nested) `Array`s and
     * `Object`s, `Number`s, `String`s, `Boolean`s and `Date`s. `Function`s are
     * not copied, but assigned by their reference.
     *
     * @func
     * @memberOf R
     * @category Object
     * @sig {*} -> {*}
     * @param {*} value The object or array to clone
     * @return {*} A new object or array.
     * @example
     *
     *      var objects = [{}, {}, {}];
     *      var objectsClone = R.clone(objects);
     *      objects[0] === objectsClone[0]; //=> false
     */
    var clone = _curry1(function clone(value) {
        return _baseCopy(value, [], []);
    });

    /**
     * Creates a new function that runs each of the functions supplied as parameters in turn,
     * passing the return value of each function invocation to the next function invocation,
     * beginning with whatever arguments were passed to the initial invocation.
     *
     * Note that `compose` is a right-associative function, which means the functions provided
     * will be invoked in order from right to left. In the example `var h = compose(f, g)`,
     * the function `h` is equivalent to `f( g(x) )`, where `x` represents the arguments
     * originally passed to `h`.
     *
     * @func
     * @memberOf R
     * @category Function
     * @sig ((y -> z), (x -> y), ..., (b -> c), (a... -> b)) -> (a... -> z)
     * @param {...Function} functions A variable number of functions.
     * @return {Function} A new function which represents the result of calling each of the
     *         input `functions`, passing the result of each function call to the next, from
     *         right to left.
     * @example
     *
     *      var triple = function(x) { return x * 3; };
     *      var double = function(x) { return x * 2; };
     *      var square = function(x) { return x * x; };
     *      var squareThenDoubleThenTriple = R.compose(triple, double, square);
     *
     *      //≅ triple(double(square(5)))
     *      squareThenDoubleThenTriple(5); //=> 150
     */
    var compose = _createComposer(_compose);

    /**
     * Similar to `compose` but with automatic handling of promises (or, more
     * precisely, "thenables"). The behavior is identical  to that of
     * compose() if all composed functions return something other than
     * promises (i.e., objects with a .then() method). If one of the function
     * returns a promise, however, then the next function in the composition
     * is called asynchronously, in the success callback of the promise, using
     * the resolved value as an input. Note that `composeP` is a right-
     * associative function, just like `compose`.
     *
     * @func
     * @memberOf R
     * @category Function
     * @sig ((y -> z), (x -> y), ..., (b -> c), (a... -> b)) -> (a... -> z)
     * @param {...Function} functions A variable number of functions.
     * @return {Function} A new function which represents the result of calling each of the
     *         input `functions`, passing either the returned result or the asynchronously
     *         resolved value) of each function call to the next, from right to left.
     * @example
     *
     *      var Q = require('q');
     *      var triple = function(x) { return x * 3; };
     *      var double = function(x) { return x * 2; };
     *      var squareAsync = function(x) { return Q.when(x * x); };
     *      var squareAsyncThenDoubleThenTriple = R.composeP(triple, double, squareAsync);
     *
     *      //≅ squareAsync(5).then(function(x) { return triple(double(x)) };
     *      squareAsyncThenDoubleThenTriple(5)
     *        .then(function(result) {
     *          // result is 150
     *        });
     */
    var composeP = _createComposer(_composeP);

    /**
     * Returns a new list consisting of the elements of the first list followed by the elements
     * of the second.
     *
     * @func
     * @memberOf R
     * @category List
     * @sig [a] -> [a] -> [a]
     * @param {Array} list1 The first list to merge.
     * @param {Array} list2 The second set to merge.
     * @return {Array} A new array consisting of the contents of `list1` followed by the
     *         contents of `list2`. If, instead of an Array for `list1`, you pass an
     *         object with a `concat` method on it, `concat` will call `list1.concat`
     *         and pass it the value of `list2`.
     *
     * @example
     *
     *      R.concat([], []); //=> []
     *      R.concat([4, 5, 6], [1, 2, 3]); //=> [4, 5, 6, 1, 2, 3]
     *      R.concat('ABC', 'DEF'); // 'ABCDEF'
     */
    var concat = _curry2(function (set1, set2) {
        if (_isArray(set2)) {
            return _concat(set1, set2);
        } else if (_hasMethod('concat', set1)) {
            return set1.concat(set2);
        } else {
            throw new TypeError('can\'t concat ' + typeof set1);
        }
    });

    /**
     * Returns `true` if the specified item is somewhere in the list, `false` otherwise.
     * Equivalent to `indexOf(a)(list) > -1`. Uses strict (`===`) equality checking.
     *
     * @func
     * @memberOf R
     * @category List
     * @sig a -> [a] -> Boolean
     * @param {Object} a The item to compare against.
     * @param {Array} list The array to consider.
     * @return {Boolean} `true` if the item is in the list, `false` otherwise.
     *
     * @example
     *
     *      R.contains(3)([1, 2, 3]); //=> true
     *      R.contains(4)([1, 2, 3]); //=> false
     *      R.contains({})([{}, {}]); //=> false
     *      var obj = {};
     *      R.contains(obj)([{}, obj, {}]); //=> true
     */
    var contains = _curry2(_contains);

    /**
     * Accepts at least three functions and returns a new function. When invoked, this new
     * function will invoke the first function, `after`, passing as its arguments the
     * results of invoking the subsequent functions with whatever arguments are passed to
     * the new function.
     *
     * @func
     * @memberOf R
     * @category Function
     * @sig ((*... -> c) -> (((* -> a), (* -> b), ...) -> c)
     * @param {Function} after A function. `after` will be invoked with the return values of
     *        `fn1` and `fn2` as its arguments.
     * @param {...Function} functions A variable number of functions.
     * @return {Function} A new function.
     * @example
     *
     *      var add = function(a, b) { return a + b; };
     *      var multiply = function(a, b) { return a * b; };
     *      var subtract = function(a, b) { return a - b; };
     *
     *      //≅ multiply( add(1, 2), subtract(1, 2) );
     *      R.converge(multiply, add, subtract)(1, 2); //=> -3
     *
     *      var add3 = function(a, b, c) { return a + b + c; };
     *      R.converge(add3, multiply, add, subtract)(1, 2); //=> 4
     */
    var converge = curryN(3, function (after) {
        var fns = _slice(arguments, 1);
        return function () {
            var args = arguments;
            return after.apply(this, _map(function (fn) {
                return fn.apply(this, args);
            }, fns));
        };
    });

    /**
     * Returns a curried equivalent of the provided function. The curried
     * function has two unusual capabilities. First, its arguments needn't
     * be provided one at a time. If `f` is a ternary function and `g` is
     * `R.curry(f)`, the following are equivalent:
     *
     *   - `g(1)(2)(3)`
     *   - `g(1)(2, 3)`
     *   - `g(1, 2)(3)`
     *   - `g(1, 2, 3)`
     *
     * Secondly, the special placeholder value `R.__` may be used to specify
     * "gaps", allowing partial application of any combination of arguments,
     * regardless of their positions. If `g` is as above and `_` is `R.__`,
     * the following are equivalent:
     *
     *   - `g(1, 2, 3)`
     *   - `g(_, 2, 3)(1)`
     *   - `g(_, _, 3)(1)(2)`
     *   - `g(_, _, 3)(1, 2)`
     *   - `g(_, 2)(1)(3)`
     *   - `g(_, 2)(1, 3)`
     *   - `g(_, 2)(_, 3)(1)`
     *
     * @func
     * @memberOf R
     * @category Function
     * @sig (* -> a) -> (* -> a)
     * @param {Function} fn The function to curry.
     * @return {Function} A new, curried function.
     * @see R.curryN
     * @example
     *
     *      var addFourNumbers = function(a, b, c, d) {
     *        return a + b + c + d;
     *      };
     *
     *      var curriedAddFourNumbers = R.curry(addFourNumbers);
     *      var f = curriedAddFourNumbers(1, 2);
     *      var g = f(3);
     *      g(4); //=> 10
     */
    var curry = _curry1(function curry(fn) {
        return curryN(fn.length, fn);
    });

    /**
     * Finds the set (i.e. no duplicates) of all elements in the first list not contained in the second list.
     *
     * @func
     * @memberOf R
     * @category Relation
     * @sig [a] -> [a] -> [a]
     * @param {Array} list1 The first list.
     * @param {Array} list2 The second list.
     * @return {Array} The elements in `list1` that are not in `list2`.
     * @see R.differenceWith
     * @example
     *
     *      R.difference([1,2,3,4], [7,6,5,4,3]); //=> [1,2]
     *      R.difference([7,6,5,4,3], [1,2,3,4]); //=> [7,6,5]
     */
    var difference = _curry2(function difference(first, second) {
        var out = [];
        var idx = -1;
        var firstLen = first.length;
        while (++idx < firstLen) {
            if (!_contains(first[idx], second) && !_contains(first[idx], out)) {
                out[out.length] = first[idx];
            }
        }
        return out;
    });

    /**
     * Makes a shallow clone of an object, omitting the property at the
     * given path. Note that this copies and flattens prototype properties
     * onto the new object as well.  All non-primitive properties are copied
     * by reference.
     *
     * @func
     * @memberOf R
     * @category Object
     * @sig [String] -> {k: v} -> {k: v}
     * @param {Array} path the path to set
     * @param {Object} obj the object to clone
     * @return {Object} a new object without the property at path
     * @example
     *
     *      R.dissocPath(['a', 'b', 'c'], {a: {b: {c: 42}}}); //=> {a: {b: {}}}
     */
    var dissocPath = _curry2(_dissocPath);

    /**
     * Returns a new list containing all but the first `n` elements of the given `list`.
     *
     * Acts as a transducer if a transformer is given in list position.
     * @see R.transduce
     *
     * @func
     * @memberOf R
     * @category List
     * @sig Number -> [a] -> [a]
     * @param {Number} n The number of elements of `list` to skip.
     * @param {Array} list The array to consider.
     * @return {Array} The last `n` elements of `list`.
     * @example
     *
     *     R.drop(3, [1,2,3,4,5,6,7]); //=> [4,5,6,7]
     */
    var drop = _curry2(_dispatchable('drop', _xdrop, function drop(n, list) {
        return n < list.length ? _slice(list, n) : [];
    }));

    /**
     * Returns a new list containing the last `n` elements of a given list, passing each value
     * to the supplied predicate function, skipping elements while the predicate function returns
     * `true`. The predicate function is passed one argument: *(value)*.
     *
     * Acts as a transducer if a transformer is given in list position.
     * @see R.transduce
     *
     * @func
     * @memberOf R
     * @category List
     * @sig (a -> Boolean) -> [a] -> [a]
     * @param {Function} fn The function called per iteration.
     * @param {Array} list The collection to iterate over.
     * @return {Array} A new array.
     * @example
     *
     *      var lteTwo = function(x) {
     *        return x <= 2;
     *      };
     *
     *      R.dropWhile(lteTwo, [1, 2, 3, 4]); //=> [3, 4]
     */
    var dropWhile = _curry2(_dispatchable('dropWhile', _xdropWhile, function dropWhile(pred, list) {
        var idx = -1, len = list.length;
        while (++idx < len && pred(list[idx])) {
        }
        return _slice(list, idx);
    }));

    /**
     * `empty` wraps any object in an array. This implementation is compatible with the
     * Fantasy-land Monoid spec, and will work with types that implement that spec.
     *
     * @func
     * @memberOf R
     * @category Function
     * @sig * -> []
     * @return {Array} An empty array.
     * @example
     *
     *      R.empty([1,2,3,4,5]); //=> []
     */
    var empty = _curry1(function empty(x) {
        return _hasMethod('empty', x) ? x.empty() : [];
    });

    /**
     * Returns a new list containing only those items that match a given predicate function.
     * The predicate function is passed one argument: *(value)*.
     *
     * Note that `R.filter` does not skip deleted or unassigned indices, unlike the native
     * `Array.prototype.filter` method. For more details on this behavior, see:
     * https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/filter#Description
     *
     * Acts as a transducer if a transformer is given in list position.
     * @see R.transduce
     *
     * @func
     * @memberOf R
     * @category List
     * @sig (a -> Boolean) -> [a] -> [a]
     * @param {Function} fn The function called per iteration.
     * @param {Array} list The collection to iterate over.
     * @return {Array} The new filtered array.
     * @example
     *
     *      var isEven = function(n) {
     *        return n % 2 === 0;
     *      };
     *      R.filter(isEven, [1, 2, 3, 4]); //=> [2, 4]
     */
    var filter = _curry2(_dispatchable('filter', _xfilter, _filter));

    /**
     * Returns the first element of the list which matches the predicate, or `undefined` if no
     * element matches.
     *
     * Acts as a transducer if a transformer is given in list position.
     * @see R.transduce
     *
     * @func
     * @memberOf R
     * @category List
     * @sig (a -> Boolean) -> [a] -> a | undefined
     * @param {Function} fn The predicate function used to determine if the element is the
     *        desired one.
     * @param {Array} list The array to consider.
     * @return {Object} The element found, or `undefined`.
     * @example
     *
     *      var xs = [{a: 1}, {a: 2}, {a: 3}];
     *      R.find(R.propEq('a', 2))(xs); //=> {a: 2}
     *      R.find(R.propEq('a', 4))(xs); //=> undefined
     */
    var find = _curry2(_dispatchable('find', _xfind, function find(fn, list) {
        var idx = -1;
        var len = list.length;
        while (++idx < len) {
            if (fn(list[idx])) {
                return list[idx];
            }
        }
    }));

    /**
     * Returns the index of the first element of the list which matches the predicate, or `-1`
     * if no element matches.
     *
     * Acts as a transducer if a transformer is given in list position.
     * @see R.transduce
     *
     * @func
     * @memberOf R
     * @category List
     * @sig (a -> Boolean) -> [a] -> Number
     * @param {Function} fn The predicate function used to determine if the element is the
     * desired one.
     * @param {Array} list The array to consider.
     * @return {Number} The index of the element found, or `-1`.
     * @example
     *
     *      var xs = [{a: 1}, {a: 2}, {a: 3}];
     *      R.findIndex(R.propEq('a', 2))(xs); //=> 1
     *      R.findIndex(R.propEq('a', 4))(xs); //=> -1
     */
    var findIndex = _curry2(_dispatchable('findIndex', _xfindIndex, function findIndex(fn, list) {
        var idx = -1;
        var len = list.length;
        while (++idx < len) {
            if (fn(list[idx])) {
                return idx;
            }
        }
        return -1;
    }));

    /**
     * Returns the last element of the list which matches the predicate, or `undefined` if no
     * element matches.
     *
     * Acts as a transducer if a transformer is given in list position.
     * @see R.transduce
     *
     * @func
     * @memberOf R
     * @category List
     * @sig (a -> Boolean) -> [a] -> a | undefined
     * @param {Function} fn The predicate function used to determine if the element is the
     * desired one.
     * @param {Array} list The array to consider.
     * @return {Object} The element found, or `undefined`.
     * @example
     *
     *      var xs = [{a: 1, b: 0}, {a:1, b: 1}];
     *      R.findLast(R.propEq('a', 1))(xs); //=> {a: 1, b: 1}
     *      R.findLast(R.propEq('a', 4))(xs); //=> undefined
     */
    var findLast = _curry2(_dispatchable('findLast', _xfindLast, function findLast(fn, list) {
        var idx = list.length;
        while (--idx >= 0) {
            if (fn(list[idx])) {
                return list[idx];
            }
        }
    }));

    /**
     * Returns the index of the last element of the list which matches the predicate, or
     * `-1` if no element matches.
     *
     * Acts as a transducer if a transformer is given in list position.
     * @see R.transduce
     *
     * @func
     * @memberOf R
     * @category List
     * @sig (a -> Boolean) -> [a] -> Number
     * @param {Function} fn The predicate function used to determine if the element is the
     * desired one.
     * @param {Array} list The array to consider.
     * @return {Number} The index of the element found, or `-1`.
     * @example
     *
     *      var xs = [{a: 1, b: 0}, {a:1, b: 1}];
     *      R.findLastIndex(R.propEq('a', 1))(xs); //=> 1
     *      R.findLastIndex(R.propEq('a', 4))(xs); //=> -1
     */
    var findLastIndex = _curry2(_dispatchable('findLastIndex', _xfindLastIndex, function findLastIndex(fn, list) {
        var idx = list.length;
        while (--idx >= 0) {
            if (fn(list[idx])) {
                return idx;
            }
        }
        return -1;
    }));

    /**
     * Returns a new list by pulling every item out of it (and all its sub-arrays) and putting
     * them in a new array, depth-first.
     *
     * @func
     * @memberOf R
     * @category List
     * @sig [a] -> [b]
     * @param {Array} list The array to consider.
     * @return {Array} The flattened list.
     * @example
     *
     *      R.flatten([1, 2, [3, 4], 5, [6, [7, 8, [9, [10, 11], 12]]]]);
     *      //=> [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
     */
    var flatten = _curry1(_makeFlat(true));

    /**
     * Returns a new function much like the supplied one, except that the first two arguments'
     * order is reversed.
     *
     * @func
     * @memberOf R
     * @category Function
     * @sig (a -> b -> c -> ... -> z) -> (b -> a -> c -> ... -> z)
     * @param {Function} fn The function to invoke with its first two parameters reversed.
     * @return {*} The result of invoking `fn` with its first two parameters' order reversed.
     * @example
     *
     *      var mergeThree = function(a, b, c) {
     *        return ([]).concat(a, b, c);
     *      };
     *
     *      mergeThree(1, 2, 3); //=> [1, 2, 3]
     *
     *      R.flip(mergeThree)(1, 2, 3); //=> [2, 1, 3]
     */
    var flip = _curry1(function flip(fn) {
        return curry(function (a, b) {
            var args = _slice(arguments);
            args[0] = b;
            args[1] = a;
            return fn.apply(this, args);
        });
    });

    /**
     * Calls the specified function on the supplied object. Any additional arguments
     * after `fn` and `obj` are passed in to `fn`. If no additional arguments are passed to `func`,
     * `fn` is invoked with no arguments.
     *
     * @deprecated since v0.12.0
     * @func
     * @memberOf R
     * @category Object
     * @sig k -> {k : v} -> v(*)
     * @param {String} funcName The name of the property mapped to the function to invoke
     * @param {Object} obj The object
     * @return {*} The value of invoking `obj.fn`.
     * @see R.invoke
     * @example
     *
     *      R.func('add', R, 1, 2); //=> 3
     *
     *      var obj = { f: function() { return 'f called'; } };
     *      R.func('f', obj); //=> 'f called'
     */
    var func = curry(function func(funcName, obj) {
        return obj[funcName].apply(obj, _slice(arguments, 2));
    });

    /**
     * Returns a list of function names of object's own and prototype functions
     *
     * @func
     * @memberOf R
     * @category Object
     * @sig {*} -> [String]
     * @param {Object} obj The objects with functions in it
     * @return {Array} A list of the object's own properties and prototype
     *         properties that map to functions.
     * @example
     *
     *      R.functionsIn(R); // returns list of ramda's own and prototype function names
     *
     *      var F = function() { this.x = function(){}; this.y = 1; }
     *      F.prototype.z = function() {};
     *      F.prototype.a = 100;
     *      R.functionsIn(new F()); //=> ["x", "z"]
     */
    var functionsIn = _curry1(_functionsWith(keysIn));

    /**
     * Splits a list into sub-lists stored in an object, based on the result of calling a String-returning function
     * on each element, and grouping the results according to values returned.
     *
     * Acts as a transducer if a transformer is given in list position.
     * @see R.transduce
     *
     * @func
     * @memberOf R
     * @category List
     * @sig (a -> String) -> [a] -> {String: [a]}
     * @param {Function} fn Function :: a -> String
     * @param {Array} list The array to group
     * @return {Object} An object with the output of `fn` for keys, mapped to arrays of elements
     *         that produced that key when passed to `fn`.
     * @example
     *
     *     var byGrade = R.groupBy(function(student) {
     *       var score = student.score;
     *       return score < 65 ? 'F' :
     *              score < 70 ? 'D' :
     *              score < 80 ? 'C' :
     *              score < 90 ? 'B' : 'A';
     *     });
     *     var students = [{name: 'Abby', score: 84},
     *                     {name: 'Eddy', score: 58},
     *                     // ...
     *                     {name: 'Jack', score: 69}];
     *     byGrade(students);
     *     // {
     *     //   'A': [{name: 'Dianne', score: 99}],
     *     //   'B': [{name: 'Abby', score: 84}]
     *     //   // ...,
     *     //   'F': [{name: 'Eddy', score: 58}]
     *     // }
     */
    var groupBy = _curry2(_dispatchable('groupBy', _xgroupBy, function groupBy(fn, list) {
        return _reduce(function (acc, elt) {
            var key = fn(elt);
            acc[key] = _append(elt, acc[key] || (acc[key] = []));
            return acc;
        }, {}, list);
    }));

    /**
     * Returns the first element in a list.
     * In some libraries this function is named `first`.
     *
     * @func
     * @memberOf R
     * @category List
     * @sig [a] -> a
     * @param {Array} list The array to consider.
     * @return {*} The first element of the list, or `undefined` if the list is empty.
     * @example
     *
     *      R.head(['fi', 'fo', 'fum']); //=> 'fi'
     */
    var head = nth(0);

    /**
     * Inserts the supplied element into the list, at index `index`.  _Note
     * that this is not destructive_: it returns a copy of the list with the changes.
     * <small>No lists have been harmed in the application of this function.</small>
     *
     * @func
     * @memberOf R
     * @category List
     * @sig Number -> a -> [a] -> [a]
     * @param {Number} index The position to insert the element
     * @param {*} elt The element to insert into the Array
     * @param {Array} list The list to insert into
     * @return {Array} A new Array with `elt` inserted at `index`.
     * @example
     *
     *      R.insert(2, 'x', [1,2,3,4]); //=> [1,2,'x',3,4]
     */
    var insert = _curry3(function insert(idx, elt, list) {
        idx = idx < list.length && idx >= 0 ? idx : list.length;
        return _concat(_append(elt, _slice(list, 0, idx)), _slice(list, idx));
    });

    /**
     * Combines two lists into a set (i.e. no duplicates) composed of those
     * elements common to both lists.  Duplication is determined according
     * to the value returned by applying the supplied predicate to two list
     * elements.
     *
     * @func
     * @memberOf R
     * @category Relation
     * @sig (a,a -> Boolean) -> [a] -> [a] -> [a]
     * @param {Function} pred A predicate function that determines whether
     *        the two supplied elements are equal.
     * @param {Array} list1 One list of items to compare
     * @param {Array} list2 A second list of items to compare
     * @see R.intersection
     * @return {Array} A new list containing those elements common to both lists.
     * @example
     *
     *      var buffaloSpringfield = [
     *        {id: 824, name: 'Richie Furay'},
     *        {id: 956, name: 'Dewey Martin'},
     *        {id: 313, name: 'Bruce Palmer'},
     *        {id: 456, name: 'Stephen Stills'},
     *        {id: 177, name: 'Neil Young'}
     *      ];
     *      var csny = [
     *        {id: 204, name: 'David Crosby'},
     *        {id: 456, name: 'Stephen Stills'},
     *        {id: 539, name: 'Graham Nash'},
     *        {id: 177, name: 'Neil Young'}
     *      ];
     *
     *      var sameId = function(o1, o2) {return o1.id === o2.id;};
     *
     *      R.intersectionWith(sameId, buffaloSpringfield, csny);
     *      //=> [{id: 456, name: 'Stephen Stills'}, {id: 177, name: 'Neil Young'}]
     */
    var intersectionWith = _curry3(function intersectionWith(pred, list1, list2) {
        var results = [], idx = -1;
        while (++idx < list1.length) {
            if (_containsWith(pred, list1[idx], list2)) {
                results[results.length] = list1[idx];
            }
        }
        return uniqWith(pred, results);
    });

    /**
     * Returns the result of applying `obj[methodName]` to `args`.
     *
     * @func
     * @memberOf R
     * @category Object
     * @sig String -> [*] -> Object -> *
     * @param {String} methodName
     * @param {Array} args
     * @param {Object} obj
     * @return {*}
     * @example
     *
     *      //  toBinary :: Number -> String
     *      var toBinary = R.invoke('toString', [2])
     *
     *      toBinary(42); //=> '101010'
     *      toBinary(63); //=> '111111'
     */
    var invoke = curry(function invoke(methodName, args, obj) {
        return obj[methodName].apply(obj, args);
    });

    /**
     * Turns a named method with a specified arity into a function
     * that can be called directly supplied with arguments and a target object.
     *
     * The returned function is curried and accepts `len + 1` parameters where
     * the final parameter is the target object.
     *
     * @func
     * @memberOf R
     * @category Function
     * @sig (Number, String) -> (a... -> c -> b)
     * @param {Number} len Number of arguments the returned function should take
     *        before the target object.
     * @param {Function} method Name of the method to call.
     * @return {Function} A new curried function.
     * @example
     *
     *      var sliceFrom = R.invoker(1, 'slice');
     *      sliceFrom(6, 'abcdefghijklm'); //=> 'ghijklm'
     *      var sliceFrom6 = R.invoker(2, 'slice', 6);
     *      sliceFrom6(8, 'abcdefghijklm'); //=> 'gh'
     */
    var invoker = curry(function invoker(arity, method) {
        var initialArgs = _slice(arguments, 2);
        var len = arity - initialArgs.length;
        return curryN(len + 1, function () {
            var target = arguments[len];
            var args = initialArgs.concat(_slice(arguments, 0, len));
            return target[method].apply(target, args);
        });
    });

    /**
     * Returns a string made by inserting the `separator` between each
     * element and concatenating all the elements into a single string.
     *
     * @func
     * @memberOf R
     * @category List
     * @sig String -> [a] -> String
     * @param {Number|String} separator The string used to separate the elements.
     * @param {Array} xs The elements to join into a string.
     * @return {String} str The string made by concatenating `xs` with `separator`.
     * @example
     *
     *      var spacer = R.join(' ');
     *      spacer(['a', 2, 3.4]);   //=> 'a 2 3.4'
     *      R.join('|', [1, 2, 3]);    //=> '1|2|3'
     */
    var join = invoker(1, 'join');

    /**
     * Returns a list containing the names of all the enumerable own
     * properties of the supplied object.
     * Note that the order of the output array is not guaranteed to be
     * consistent across different JS platforms.
     *
     * @func
     * @memberOf R
     * @category Object
     * @sig {k: v} -> [k]
     * @param {Object} obj The object to extract properties from
     * @return {Array} An array of the object's own properties.
     * @example
     *
     *      R.keys({a: 1, b: 2, c: 3}); //=> ['a', 'b', 'c']
     */
    // cover IE < 9 keys issues
    var keys = function () {
        // cover IE < 9 keys issues
        var hasEnumBug = !{ toString: null }.propertyIsEnumerable('toString');
        var nonEnumerableProps = [
            'constructor',
            'valueOf',
            'isPrototypeOf',
            'toString',
            'propertyIsEnumerable',
            'hasOwnProperty',
            'toLocaleString'
        ];
        return _curry1(function keys(obj) {
            if (Object(obj) !== obj) {
                return [];
            }
            if (Object.keys) {
                return Object.keys(obj);
            }
            var prop, ks = [], nIdx;
            for (prop in obj) {
                if (_has(prop, obj)) {
                    ks[ks.length] = prop;
                }
            }
            if (hasEnumBug) {
                nIdx = nonEnumerableProps.length;
                while (--nIdx >= 0) {
                    prop = nonEnumerableProps[nIdx];
                    if (_has(prop, obj) && !_contains(prop, ks)) {
                        ks[ks.length] = prop;
                    }
                }
            }
            return ks;
        });
    }();

    /**
     * Returns the last element from a list.
     *
     * @func
     * @memberOf R
     * @category List
     * @sig [a] -> a
     * @param {Array} list The array to consider.
     * @return {*} The last element of the list, or `undefined` if the list is empty.
     * @example
     *
     *      R.last(['fi', 'fo', 'fum']); //=> 'fum'
     */
    var last = nth(-1);

    /**
     * Returns a new list, constructed by applying the supplied function to every element of the
     * supplied list.
     *
     * Note: `R.map` does not skip deleted or unassigned indices (sparse arrays), unlike the
     * native `Array.prototype.map` method. For more details on this behavior, see:
     * https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/map#Description
     *
     * Acts as a transducer if a transformer is given in list position.
     * @see R.transduce
     *
     * @func
     * @memberOf R
     * @category List
     * @sig (a -> b) -> [a] -> [b]
     * @param {Function} fn The function to be called on every element of the input `list`.
     * @param {Array} list The list to be iterated over.
     * @return {Array} The new list.
     * @example
     *
     *      var double = function(x) {
     *        return x * 2;
     *      };
     *
     *      R.map(double, [1, 2, 3]); //=> [2, 4, 6]
     */
    var map = _curry2(_dispatchable('map', _xmap, _map));

    /**
     * Map, but for objects. Creates an object with the same keys as `obj` and values
     * generated by running each property of `obj` through `fn`. `fn` is passed one argument:
     * *(value)*.
     *
     * @func
     * @memberOf R
     * @category Object
     * @sig (v -> v) -> {k: v} -> {k: v}
     * @param {Function} fn A function called for each property in `obj`. Its return value will
     * become a new property on the return object.
     * @param {Object} obj The object to iterate over.
     * @return {Object} A new object with the same keys as `obj` and values that are the result
     *         of running each property through `fn`.
     * @example
     *
     *      var values = { x: 1, y: 2, z: 3 };
     *      var double = function(num) {
     *        return num * 2;
     *      };
     *
     *      R.mapObj(double, values); //=> { x: 2, y: 4, z: 6 }
     */
    var mapObj = _curry2(function mapObject(fn, obj) {
        return _reduce(function (acc, key) {
            acc[key] = fn(obj[key]);
            return acc;
        }, {}, keys(obj));
    });

    /**
     * Like `mapObj`, but but passes additional arguments to the predicate function. The
     * predicate function is passed three arguments: *(value, key, obj)*.
     *
     * @func
     * @memberOf R
     * @category List
     * @sig (v, k, {k: v} -> v) -> {k: v} -> {k: v}
     * @param {Function} fn A function called for each property in `obj`. Its return value will
     *        become a new property on the return object.
     * @param {Object} obj The object to iterate over.
     * @return {Object} A new object with the same keys as `obj` and values that are the result
     *         of running each property through `fn`.
     * @example
     *
     *      var values = { x: 1, y: 2, z: 3 };
     *      var prependKeyAndDouble = function(num, key, obj) {
     *        return key + (num * 2);
     *      };
     *
     *      R.mapObjIndexed(prependKeyAndDouble, values); //=> { x: 'x2', y: 'y4', z: 'z6' }
     */
    var mapObjIndexed = _curry2(function mapObjectIndexed(fn, obj) {
        return _reduce(function (acc, key) {
            acc[key] = fn(obj[key], key, obj);
            return acc;
        }, {}, keys(obj));
    });

    /**
     * Tests a regular expression against a String
     *
     * @func
     * @memberOf R
     * @category String
     * @sig RegExp -> String -> [String] | null
     * @param {RegExp} rx A regular expression.
     * @param {String} str The string to match against
     * @return {Array} The list of matches, or null if no matches found.
     * @see R.invoker
     * @example
     *
     *      R.match(/([a-z]a)/g, 'bananas'); //=> ['ba', 'na', 'na']
     */
    var match = invoker(1, 'match');

    /**
     * Determines the largest of a list of numbers (or elements that can be cast to numbers)
     *
     * @func
     * @memberOf R
     * @category Math
     * @sig [Number] -> Number
     * @see R.maxBy
     * @param {Array} list A list of numbers
     * @return {Number} The greatest number in the list.
     * @example
     *
     *      R.max([7, 3, 9, 2, 4, 9, 3]); //=> 9
     */
    var max = _createMaxMin(_gt, -Infinity);

    /**
     * Determines the smallest of a list of numbers (or elements that can be cast to numbers)
     *
     * @func
     * @memberOf R
     * @category Math
     * @sig [Number] -> Number
     * @param {Array} list A list of numbers
     * @return {Number} The greatest number in the list.
     * @see R.minBy
     * @example
     *
     *      R.min([7, 3, 9, 2, 4, 9, 3]); //=> 2
     */
    var min = _createMaxMin(_lt, Infinity);

    /**
     * Returns `true` if no elements of the list match the predicate,
     * `false` otherwise.
     *
     * @func
     * @memberOf R
     * @category List
     * @sig (a -> Boolean) -> [a] -> Boolean
     * @param {Function} fn The predicate function.
     * @param {Array} list The array to consider.
     * @return {Boolean} `true` if the predicate is not satisfied by every element, `false` otherwise.
     * @example
     *
     *      R.none(R.isNaN, [1, 2, 3]); //=> true
     *      R.none(R.isNaN, [1, 2, 3, NaN]); //=> false
     */
    var none = _curry2(_complement(_dispatchable('any', _xany, _any)));

    /**
     * Accepts as its arguments a function and any number of values and returns a function that,
     * when invoked, calls the original function with all of the values prepended to the
     * original function's arguments list. In some libraries this function is named `applyLeft`.
     *
     * @func
     * @memberOf R
     * @category Function
     * @sig (a -> b -> ... -> i -> j -> ... -> m -> n) -> a -> b-> ... -> i -> (j -> ... -> m -> n)
     * @param {Function} fn The function to invoke.
     * @param {...*} [args] Arguments to prepend to `fn` when the returned function is invoked.
     * @return {Function} A new function wrapping `fn`. When invoked, it will call `fn`
     *         with `args` prepended to `fn`'s arguments list.
     * @example
     *
     *      var multiply = function(a, b) { return a * b; };
     *      var double = R.partial(multiply, 2);
     *      double(2); //=> 4
     *
     *      var greet = function(salutation, title, firstName, lastName) {
     *        return salutation + ', ' + title + ' ' + firstName + ' ' + lastName + '!';
     *      };
     *      var sayHello = R.partial(greet, 'Hello');
     *      var sayHelloToMs = R.partial(sayHello, 'Ms.');
     *      sayHelloToMs('Jane', 'Jones'); //=> 'Hello, Ms. Jane Jones!'
     */
    var partial = curry(_createPartialApplicator(_concat));

    /**
     * Accepts as its arguments a function and any number of values and returns a function that,
     * when invoked, calls the original function with all of the values appended to the original
     * function's arguments list.
     *
     * Note that `partialRight` is the opposite of `partial`: `partialRight` fills `fn`'s arguments
     * from the right to the left.  In some libraries this function is named `applyRight`.
     *
     * @func
     * @memberOf R
     * @category Function
     * @sig (a -> b-> ... -> i -> j -> ... -> m -> n) -> j -> ... -> m -> n -> (a -> b-> ... -> i)
     * @param {Function} fn The function to invoke.
     * @param {...*} [args] Arguments to append to `fn` when the returned function is invoked.
     * @return {Function} A new function wrapping `fn`. When invoked, it will call `fn` with
     *         `args` appended to `fn`'s arguments list.
     * @example
     *
     *      var greet = function(salutation, title, firstName, lastName) {
     *        return salutation + ', ' + title + ' ' + firstName + ' ' + lastName + '!';
     *      };
     *      var greetMsJaneJones = R.partialRight(greet, 'Ms.', 'Jane', 'Jones');
     *
     *      greetMsJaneJones('Hello'); //=> 'Hello, Ms. Jane Jones!'
     */
    var partialRight = curry(_createPartialApplicator(flip(_concat)));

    /**
     * Takes a predicate and a list and returns the pair of lists of
     * elements which do and do not satisfy the predicate, respectively.
     *
     * @func
     * @memberOf R
     * @category List
     * @sig (a -> Boolean) -> [a] -> [[a],[a]]
     * @param {Function} pred A predicate to determine which array the element belongs to.
     * @param {Array} list The array to partition.
     * @return {Array} A nested array, containing first an array of elements that satisfied the predicate,
     *         and second an array of elements that did not satisfy.
     * @example
     *
     *      R.partition(R.contains('s'), ['sss', 'ttt', 'foo', 'bars']);
     *      //=> [ [ 'sss', 'bars' ],  [ 'ttt', 'foo' ] ]
     */
    var partition = _curry2(function partition(pred, list) {
        return _reduce(function (acc, elt) {
            var xs = acc[pred(elt) ? 0 : 1];
            xs[xs.length] = elt;
            return acc;
        }, [
            [],
            []
        ], list);
    });

    /**
     * Creates a new function that runs each of the functions supplied as parameters in turn,
     * passing the return value of each function invocation to the next function invocation,
     * beginning with whatever arguments were passed to the initial invocation.
     *
     * `pipe` is the mirror version of `compose`. `pipe` is left-associative, which means that
     * each of the functions provided is executed in order from left to right.
     *
     * In some libraries this function is named `sequence`.
     * @func
     * @memberOf R
     * @category Function
     * @sig ((a... -> b), (b -> c), ..., (x -> y), (y -> z)) -> (a... -> z)
     * @param {...Function} functions A variable number of functions.
     * @return {Function} A new function which represents the result of calling each of the
     *         input `functions`, passing the result of each function call to the next, from
     *         left to right.
     * @example
     *
     *      var triple = function(x) { return x * 3; };
     *      var double = function(x) { return x * 2; };
     *      var square = function(x) { return x * x; };
     *      var squareThenDoubleThenTriple = R.pipe(square, double, triple);
     *
     *      //≅ triple(double(square(5)))
     *      squareThenDoubleThenTriple(5); //=> 150
     */
    var pipe = function pipe() {
        return compose.apply(this, reverse(arguments));
    };

    /**
     * Creates a new function that runs each of the functions supplied as parameters in turn,
     * passing to the next function invocation either the value returned by the previous
     * function or the resolved value if the returned value is a promise. In other words,
     * if some of the functions in the sequence return promises, `pipeP` pipes the values
     * asynchronously. If none of the functions return promises, the behavior is the same as
     * that of `pipe`.
     *
     * `pipeP` is the mirror version of `composeP`. `pipeP` is left-associative, which means that
     * each of the functions provided is executed in order from left to right.
     *
     * @func
     * @memberOf R
     * @category Function
     * @sig ((a... -> b), (b -> c), ..., (x -> y), (y -> z)) -> (a... -> z)
     * @param {...Function} functions A variable number of functions.
     * @return {Function} A new function which represents the result of calling each of the
     *         input `functions`, passing either the returned result or the asynchronously
     *         resolved value) of each function call to the next, from left to right.
     * @example
     *
     *      var Q = require('q');
     *      var triple = function(x) { return x * 3; };
     *      var double = function(x) { return x * 2; };
     *      var squareAsync = function(x) { return Q.when(x * x); };
     *      var squareAsyncThenDoubleThenTriple = R.pipeP(squareAsync, double, triple);
     *
     *      //≅ squareAsync(5).then(function(x) { return triple(double(x)) };
     *      squareAsyncThenDoubleThenTriple(5)
     *        .then(function(result) {
     *          // result is 150
     *        });
     */
    var pipeP = function pipeP() {
        return composeP.apply(this, reverse(arguments));
    };

    /**
     * Returns a new list by plucking the same named property off all objects in the list supplied.
     *
     * @func
     * @memberOf R
     * @category List
     * @sig String -> {*} -> [*]
     * @param {Number|String} key The key name to pluck off of each object.
     * @param {Array} list The array to consider.
     * @return {Array} The list of values for the given key.
     * @example
     *
     *      R.pluck('a')([{a: 1}, {a: 2}]); //=> [1, 2]
     *      R.pluck(0)([[1, 2], [3, 4]]);   //=> [1, 3]
     */
    var pluck = _curry2(_pluck);

    /**
     * Returns a single item by iterating through the list, successively calling the iterator
     * function and passing it an accumulator value and the current value from the array, and
     * then passing the result to the next call.
     *
     * The iterator function receives two values: *(acc, value)*
     *
     * Note: `R.reduce` does not skip deleted or unassigned indices (sparse arrays), unlike
     * the native `Array.prototype.reduce` method. For more details on this behavior, see:
     * https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/reduce#Description
     *
     * @func
     * @memberOf R
     * @category List
     * @sig (a,b -> a) -> a -> [b] -> a
     * @param {Function} fn The iterator function. Receives two values, the accumulator and the
     *        current element from the array.
     * @param {*} acc The accumulator value.
     * @param {Array} list The list to iterate over.
     * @return {*} The final, accumulated value.
     * @example
     *
     *      var numbers = [1, 2, 3];
     *      var add = function(a, b) {
     *        return a + b;
     *      };
     *
     *      R.reduce(add, 10, numbers); //=> 16
     */
    var reduce = _curry3(_reduce);

    /**
     * Similar to `filter`, except that it keeps only values for which the given predicate
     * function returns falsy. The predicate function is passed one argument: *(value)*.
     *
     * @func
     * @memberOf R
     * @category List
     * @sig (a -> Boolean) -> [a] -> [a]
     * @param {Function} fn The function called per iteration.
     * @param {Array} list The collection to iterate over.
     * @return {Array} The new filtered array.
     * @example
     *
     *      var isOdd = function(n) {
     *        return n % 2 === 1;
     *      };
     *      R.reject(isOdd, [1, 2, 3, 4]); //=> [2, 4]
     */
    var reject = _curry2(function reject(fn, list) {
        return filter(_complement(fn), list);
    });

    /**
     * Returns a fixed list of size `n` containing a specified identical value.
     *
     * @func
     * @memberOf R
     * @category List
     * @sig a -> n -> [a]
     * @param {*} value The value to repeat.
     * @param {Number} n The desired size of the output list.
     * @return {Array} A new array containing `n` `value`s.
     * @example
     *
     *      R.repeat('hi', 5); //=> ['hi', 'hi', 'hi', 'hi', 'hi']
     *
     *      var obj = {};
     *      var repeatedObjs = R.repeat(obj, 5); //=> [{}, {}, {}, {}, {}]
     *      repeatedObjs[0] === repeatedObjs[1]; //=> true
     */
    var repeat = _curry2(function repeat(value, n) {
        return times(always(value), n);
    });

    /**
     * Returns a list containing the elements of `xs` from `fromIndex` (inclusive)
     * to `toIndex` (exclusive).
     *
     * @func
     * @memberOf R
     * @category List
     * @sig Number -> Number -> [a] -> [a]
     * @param {Number} fromIndex The start index (inclusive).
     * @param {Number} toIndex The end index (exclusive).
     * @param {Array} xs The list to take elements from.
     * @return {Array} The slice of `xs` from `fromIndex` to `toIndex`.
     * @example
     *
     *      var xs = R.range(0, 10);
     *      R.slice(2, 5)(xs); //=> [2, 3, 4]
     */
    var slice = _curry3(_checkForMethod('slice', function slice(fromIndex, toIndex, xs) {
        return Array.prototype.slice.call(xs, fromIndex, toIndex);
    }));

    /**
     * Returns a copy of the list, sorted according to the comparator function, which should accept two values at a
     * time and return a negative number if the first value is smaller, a positive number if it's larger, and zero
     * if they are equal.  Please note that this is a **copy** of the list.  It does not modify the original.
     *
     * @func
     * @memberOf R
     * @category List
     * @sig (a,a -> Number) -> [a] -> [a]
     * @param {Function} comparator A sorting function :: a -> b -> Int
     * @param {Array} list The list to sort
     * @return {Array} a new array with its elements sorted by the comparator function.
     * @example
     *
     *      var diff = function(a, b) { return a - b; };
     *      R.sort(diff, [4,2,7,5]); //=> [2, 4, 5, 7]
     */
    var sort = _curry2(function sort(comparator, list) {
        return clone(list).sort(comparator);
    });

    /**
     * Splits a string into an array of strings based on the given
     * separator.
     *
     * @func
     * @memberOf R
     * @category String
     * @sig String -> String -> [String]
     * @param {String} sep The separator string.
     * @param {String} str The string to separate into an array.
     * @return {Array} The array of strings from `str` separated by `str`.
     * @example
     *
     *      var pathComponents = R.split('/');
     *      R.tail(pathComponents('/usr/local/bin/node')); //=> ['usr', 'local', 'bin', 'node']
     *
     *      R.split('.', 'a.b.c.xyz.d'); //=> ['a', 'b', 'c', 'xyz', 'd']
     */
    var split = invoker(1, 'split');

    /**
     * Returns a string containing the characters of `str` from `fromIndex`
     * (inclusive) to `toIndex` (exclusive).
     *
     * @func
     * @memberOf R
     * @category String
     * @sig Number -> Number -> String -> String
     * @param {Number} fromIndex The start index (inclusive).
     * @param {Number} toIndex The end index (exclusive).
     * @param {String} str The string to slice.
     * @return {String}
     * @see R.slice
     * @example
     *
     *      R.substring(2, 5, 'abcdefghijklm'); //=> 'cde'
     */
    var substring = slice;

    /**
     * Returns a string containing the characters of `str` from `fromIndex`
     * (inclusive) to the end of `str`.
     *
     * @func
     * @memberOf R
     * @category String
     * @sig Number -> String -> String
     * @param {Number} fromIndex
     * @param {String} str
     * @return {String}
     * @example
     *
     *      R.substringFrom(3, 'Ramda'); //=> 'da'
     *      R.substringFrom(-2, 'Ramda'); //=> 'da'
     */
    var substringFrom = substring(__, Infinity);

    /**
     * Returns a string containing the first `toIndex` characters of `str`.
     *
     * @func
     * @memberOf R
     * @category String
     * @sig Number -> String -> String
     * @param {Number} toIndex
     * @param {String} str
     * @return {String}
     * @example
     *
     *      R.substringTo(3, 'Ramda'); //=> 'Ram'
     *      R.substringTo(-2, 'Ramda'); //=> 'Ram'
     */
    var substringTo = substring(0);

    /**
     * Adds together all the elements of a list.
     *
     * @func
     * @memberOf R
     * @category Math
     * @sig [Number] -> Number
     * @param {Array} list An array of numbers
     * @return {Number} The sum of all the numbers in the list.
     * @see reduce
     * @example
     *
     *      R.sum([2,4,6,8,100,1]); //=> 121
     */
    var sum = reduce(_add, 0);

    /**
     * Returns all but the first element of a list. If the list provided has the `tail` method,
     * it will instead return `list.tail()`.
     *
     * @func
     * @memberOf R
     * @category List
     * @sig [a] -> [a]
     * @param {Array} list The array to consider.
     * @return {Array} A new array containing all but the first element of the input list, or an
     *         empty list if the input list is empty.
     * @example
     *
     *      R.tail(['fi', 'fo', 'fum']); //=> ['fo', 'fum']
     */
    var tail = _checkForMethod('tail', function (list) {
        return _slice(list, 1);
    });

    /**
     * Returns a new list containing the first `n` elements of the given list.  If
     * `n > * list.length`, returns a list of `list.length` elements.
     *
     * Acts as a transducer if a transformer is given in list position.
     * @see R.transduce
     *
     * @func
     * @memberOf R
     * @category List
     * @sig Number -> [a] -> [a]
     * @param {Number} n The number of elements to return.
     * @param {Array} list The array to query.
     * @return {Array} A new array containing the first elements of `list`.
     * @example
     *
     *      R.take(3,[1,2,3,4,5]); //=> [1,2,3]
     *
     *      var members= [ "Paul Desmond","Bob Bates","Joe Dodge","Ron Crotty","Lloyd Davis","Joe Morello","Norman Bates",
     *                     "Eugene Wright","Gerry Mulligan","Jack Six","Alan Dawson","Darius Brubeck","Chris Brubeck",
     *                     "Dan Brubeck","Bobby Militello","Michael Moore","Randy Jones"];
     *      var takeFive = R.take(5);
     *      takeFive(members); //=> ["Paul Desmond","Bob Bates","Joe Dodge","Ron Crotty","Lloyd Davis"]
     */
    var take = _curry2(_dispatchable('take', _xtake, function take(n, list) {
        return _slice(list, 0, Math.min(n, list.length));
    }));

    /**
     * Returns a new list containing the first `n` elements of a given list, passing each value
     * to the supplied predicate function, and terminating when the predicate function returns
     * `false`. Excludes the element that caused the predicate function to fail. The predicate
     * function is passed one argument: *(value)*.
     *
     * Acts as a transducer if a transformer is given in list position.
     * @see R.transduce
     *
     * @func
     * @memberOf R
     * @category List
     * @sig (a -> Boolean) -> [a] -> [a]
     * @param {Function} fn The function called per iteration.
     * @param {Array} list The collection to iterate over.
     * @return {Array} A new array.
     * @example
     *
     *      var isNotFour = function(x) {
     *        return !(x === 4);
     *      };
     *
     *      R.takeWhile(isNotFour, [1, 2, 3, 4]); //=> [1, 2, 3]
     */
    var takeWhile = _curry2(_dispatchable('takeWhile', _xtakeWhile, function takeWhile(fn, list) {
        var idx = -1, len = list.length;
        while (++idx < len && fn(list[idx])) {
        }
        return _slice(list, 0, idx);
    }));

    /**
     * The lower case version of a string.
     *
     * @func
     * @memberOf R
     * @category String
     * @sig String -> String
     * @param {String} str The string to lower case.
     * @return {String} The lower case version of `str`.
     * @example
     *
     *      R.toLower('XYZ'); //=> 'xyz'
     */
    var toLower = invoker(0, 'toLowerCase');

    /**
     * The upper case version of a string.
     *
     * @func
     * @memberOf R
     * @category String
     * @sig String -> String
     * @param {String} str The string to upper case.
     * @return {String} The upper case version of `str`.
     * @example
     *
     *      R.toUpper('abc'); //=> 'ABC'
     */
    var toUpper = invoker(0, 'toUpperCase');

    /**
     * Initializes a transducer using supplied iterator function. Returns a single item by
     * iterating through the list, successively calling the transformed iterator function and
     * passing it an accumulator value and the current value from the array, and then passing
     * the result to the next call.
     *
     * The iterator function receives two values: *(acc, value)*. It will be wrapped as a
     * transformer to initialize the transducer. A transformer can be passed directly in place
     * of an iterator function.
     *
     * A transducer is a function that accepts a transformer and returns a transformer and can
     * be composed directly.
     *
     * A transformer is an an object that provides a 2-arity reducing iterator function, step,
     * 0-arity initial value function, init, and 1-arity result extraction function, result.
     * The step function is used as the iterator function in reduce. The result function is used
     * to convert the final accumulator into the return type and in most cases is R.identity.
     * The init function can be used to provide an initial accumulator, but is ignored by transduce.
     *
     * The iteration is performed with R.reduce after initializing the transducer.
     *
     * @func
     * @memberOf R
     * @category List
     * @sig (c -> c) -> (a,b -> a) -> a -> [b] -> a
     * @param {Function} xf The transducer function. Receives a transformer and returns a transformer.
     * @param {Function} fn The iterator function. Receives two values, the accumulator and the
     *        current element from the array. Wrapped as transformer, if necessary, and used to
     *        initialize the transducer
     * @param {*} acc The initial accumulator value.
     * @param {Array} list The list to iterate over.
     * @see R.into
     * @return {*} The final, accumulated value.
     * @example
     *
     *      var numbers = [1, 2, 3, 4];
     *      var transducer = R.compose(R.map(R.add(1)), R.take(2));
     *
     *      R.transduce(transducer, R.flip(R.append), [], numbers); //=> [2, 3]
     */
    var transduce = curryN(4, function (xf, fn, acc, list) {
        return _reduce(xf(typeof fn === 'function' ? _xwrap(fn) : fn), acc, list);
    });

    /**
     * Combines two lists into a set (i.e. no duplicates) composed of the elements of each list.  Duplication is
     * determined according to the value returned by applying the supplied predicate to two list elements.
     *
     * @func
     * @memberOf R
     * @category Relation
     * @sig (a,a -> Boolean) -> [a] -> [a] -> [a]
     * @param {Function} pred A predicate used to test whether two items are equal.
     * @param {Array} list1 The first list.
     * @param {Array} list2 The second list.
     * @return {Array} The first and second lists concatenated, with
     *         duplicates removed.
     * @see R.union
     * @example
     *
     *      function cmp(x, y) { return x.a === y.a; }
     *      var l1 = [{a: 1}, {a: 2}];
     *      var l2 = [{a: 1}, {a: 4}];
     *      R.unionWith(cmp, l1, l2); //=> [{a: 1}, {a: 2}, {a: 4}]
     */
    var unionWith = _curry3(function unionWith(pred, list1, list2) {
        return uniqWith(pred, _concat(list1, list2));
    });

    /**
     * Returns a new list containing only one copy of each element in the original list.
     * Equality is strict here, meaning reference equality for objects and non-coercing equality
     * for primitives.
     *
     * @func
     * @memberOf R
     * @category List
     * @sig [a] -> [a]
     * @param {Array} list The array to consider.
     * @return {Array} The list of unique items.
     * @example
     *
     *      R.uniq([1, 1, 2, 1]); //=> [1, 2]
     *      R.uniq([{}, {}]);     //=> [{}, {}]
     *      R.uniq([1, '1']);     //=> [1, '1']
     */
    var uniq = _curry1(function uniq(list) {
        var idx = -1, len = list.length;
        var result = [], item;
        while (++idx < len) {
            item = list[idx];
            if (!_contains(item, result)) {
                result[result.length] = item;
            }
        }
        return result;
    });

    /**
     * Returns a new list by pulling every item at the first level of nesting out, and putting
     * them in a new array.
     *
     * @func
     * @memberOf R
     * @category List
     * @sig [a] -> [b]
     * @param {Array} list The array to consider.
     * @return {Array} The flattened list.
     * @example
     *
     *      R.unnest([1, [2], [[3]]]); //=> [1, 2, [3]]
     *      R.unnest([[1, 2], [3, 4], [5, 6]]); //=> [1, 2, 3, 4, 5, 6]
     */
    var unnest = _curry1(_makeFlat(false));

    /**
     * Accepts a function `fn` and any number of transformer functions and returns a new
     * function. When the new function is invoked, it calls the function `fn` with parameters
     * consisting of the result of calling each supplied handler on successive arguments to the
     * new function.
     *
     * If more arguments are passed to the returned function than transformer functions, those
     * arguments are passed directly to `fn` as additional parameters. If you expect additional
     * arguments that don't need to be transformed, although you can ignore them, it's best to
     * pass an identity function so that the new function reports the correct arity.
     *
     * @func
     * @memberOf R
     * @category Function
     * @sig ((* -> *), (* -> *)...) -> (* -> *)
     * @param {Function} fn The function to wrap.
     * @param {...Function} transformers A variable number of transformer functions
     * @return {Function} The wrapped function.
     * @example
     *
     *      // Example 1:
     *
     *      // Number -> [Person] -> [Person]
     *      var byAge = R.useWith(R.filter, R.propEq('age'), R.identity);
     *
     *      var kids = [
     *        {name: 'Abbie', age: 6},
     *        {name: 'Brian', age: 5},
     *        {name: 'Chris', age: 6},
     *        {name: 'David', age: 4},
     *        {name: 'Ellie', age: 5}
     *      ];
     *
     *      byAge(5, kids); //=> [{name: 'Brian', age: 5}, {name: 'Ellie', age: 5}]
     *
     *      // Example 2:
     *
     *      var double = function(y) { return y * 2; };
     *      var square = function(x) { return x * x; };
     *      var add = function(a, b) { return a + b; };
     *      // Adds any number of arguments together
     *      var addAll = function() {
     *        return R.reduce(add, 0, arguments);
     *      };
     *
     *      // Basic example
     *      var addDoubleAndSquare = R.useWith(addAll, double, square);
     *
     *      //≅ addAll(double(10), square(5));
     *      addDoubleAndSquare(10, 5); //=> 45
     *
     *      // Example of passing more arguments than transformers
     *      //≅ addAll(double(10), square(5), 100);
     *      addDoubleAndSquare(10, 5, 100); //=> 145
     *
     *      // If there are extra _expected_ arguments that don't need to be transformed, although
     *      // you can ignore them, it might be best to pass in the identity function so that the new
     *      // function correctly reports arity.
     *      var addDoubleAndSquareWithExtraParams = R.useWith(addAll, double, square, R.identity);
     *      // addDoubleAndSquareWithExtraParams.length //=> 3
     *      //≅ addAll(double(10), square(5), R.identity(100));
     *      addDoubleAndSquare(10, 5, 100); //=> 145
     */
    /*, transformers */
    var useWith = curry(function useWith(fn) {
        var transformers = _slice(arguments, 1);
        var tlen = transformers.length;
        return curry(arity(tlen, function () {
            var args = [], idx = -1;
            while (++idx < tlen) {
                args[idx] = transformers[idx](arguments[idx]);
            }
            return fn.apply(this, args.concat(_slice(arguments, tlen)));
        }));
    });

    /**
     * Returns a list of all the enumerable own properties of the supplied object.
     * Note that the order of the output array is not guaranteed across
     * different JS platforms.
     *
     * @func
     * @memberOf R
     * @category Object
     * @sig {k: v} -> [v]
     * @param {Object} obj The object to extract values from
     * @return {Array} An array of the values of the object's own properties.
     * @example
     *
     *      R.values({a: 1, b: 2, c: 3}); //=> [1, 2, 3]
     */
    var values = _curry1(function values(obj) {
        var props = keys(obj);
        var len = props.length;
        var vals = [];
        var idx = -1;
        while (++idx < len) {
            vals[idx] = obj[props[idx]];
        }
        return vals;
    });

    /**
     * Takes a spec object and a test object and returns true if the test satisfies the spec.
     * Any property on the spec that is not a function is interpreted as an equality
     * relation.
     *
     * If the spec has a property mapped to a function, then `where` evaluates the function, passing in
     * the test object's value for the property in question, as well as the whole test object.
     *
     * `where` is well suited to declaratively expressing constraints for other functions, e.g.,
     * `filter`, `find`, `pickBy`, etc.
     *
     * @func
     * @memberOf R
     * @category Object
     * @sig {k: v} -> {k: v} -> Boolean
     * @param {Object} spec
     * @param {Object} testObj
     * @return {Boolean}
     * @example
     *
     *      var spec = {x: 2};
     *      R.where(spec, {w: 10, x: 2, y: 300}); //=> true
     *      R.where(spec, {x: 1, y: 'moo', z: true}); //=> false
     *
     *      var spec2 = {x: function(val, obj) { return  val + obj.y > 10; }};
     *      R.where(spec2, {x: 2, y: 7}); //=> false
     *      R.where(spec2, {x: 3, y: 8}); //=> true
     *
     *      var xs = [{x: 2, y: 1}, {x: 10, y: 2}, {x: 8, y: 3}, {x: 10, y: 4}];
     *      R.filter(R.where({x: 10}), xs); // ==> [{x: 10, y: 2}, {x: 10, y: 4}]
     */
    var where = _curry2(function where(spec, testObj) {
        var parsedSpec = groupBy(function (key) {
            return typeof spec[key] === 'function' ? 'fn' : 'obj';
        }, keys(spec));
        return _satisfiesSpec(spec, parsedSpec, testObj);
    });

    // The algorithm used to handle cyclic structures is
    // inspired by underscore's isEqual
    // RegExp equality algorithm: http://stackoverflow.com/a/10776635
    var _eqDeep = function _eqDeep(a, b, stackA, stackB) {
        var typeA = type(a);
        if (typeA !== type(b)) {
            return false;
        }
        if (eq(a, b)) {
            return true;
        }
        if (typeA == 'RegExp') {
            // RegExp equality algorithm: http://stackoverflow.com/a/10776635
            return a.source === b.source && a.global === b.global && a.ignoreCase === b.ignoreCase && a.multiline === b.multiline && a.sticky === b.sticky && a.unicode === b.unicode;
        }
        if (Object(a) === a) {
            if (typeA === 'Date' && a.getTime() != b.getTime()) {
                return false;
            }
            var keysA = keys(a);
            if (keysA.length !== keys(b).length) {
                return false;
            }
            var idx = stackA.length;
            while (--idx >= 0) {
                if (stackA[idx] === a) {
                    return stackB[idx] === b;
                }
            }
            stackA[stackA.length] = a;
            stackB[stackB.length] = b;
            idx = keysA.length;
            while (--idx >= 0) {
                var key = keysA[idx];
                if (!_has(key, b) || !_eqDeep(b[key], a[key], stackA, stackB)) {
                    return false;
                }
            }
            stackA.pop();
            stackB.pop();
            return true;
        }
        return false;
    };

    /**
     * Assigns own enumerable properties of the other object to the destination
     * object preferring items in other.
     *
     * @private
     * @memberOf R
     * @category Object
     * @param {Object} destination The destination object.
     * @param {Object} other The other object to merge with destination.
     * @return {Object} The destination object.
     * @example
     *
     *      _extend({ 'name': 'fred', 'age': 10 }, { 'age': 40 });
     *      //=> { 'name': 'fred', 'age': 40 }
     */
    var _extend = function _extend(destination, other) {
        var props = keys(other);
        var idx = -1, length = props.length;
        while (++idx < length) {
            destination[props[idx]] = other[props[idx]];
        }
        return destination;
    };

    /**
     * Create a predicate wrapper which will call a pick function (all/any) for each predicate
     *
     * @private
     * @see R.all
     * @see R.any
     */
    // Call function immediately if given arguments
    // Return a function which will call the predicates with the provided arguments
    var _predicateWrap = function _predicateWrap(predPicker) {
        return function (preds) {
            var predIterator = function () {
                var args = arguments;
                return predPicker(function (predicate) {
                    return predicate.apply(null, args);
                }, preds);
            };
            return arguments.length > 1 ? // Call function immediately if given arguments
            predIterator.apply(null, _slice(arguments, 1)) : // Return a function which will call the predicates with the provided arguments
            arity(max(_pluck('length', preds)), predIterator);
        };
    };

    /**
     * Given a list of predicates, returns a new predicate that will be true exactly when all of them are.
     *
     * @func
     * @memberOf R
     * @category Logic
     * @sig [(*... -> Boolean)] -> (*... -> Boolean)
     * @param {Array} list An array of predicate functions
     * @param {*} optional Any arguments to pass into the predicates
     * @return {Function} a function that applies its arguments to each of
     *         the predicates, returning `true` if all are satisfied.
     * @example
     *
     *      var gt10 = function(x) { return x > 10; };
     *      var even = function(x) { return x % 2 === 0};
     *      var f = R.allPass([gt10, even]);
     *      f(11); //=> false
     *      f(12); //=> true
     */
    var allPass = curry(_predicateWrap(_all));

    /**
     * Given a list of predicates returns a new predicate that will be true exactly when any one of them is.
     *
     * @func
     * @memberOf R
     * @category Logic
     * @sig [(*... -> Boolean)] -> (*... -> Boolean)
     * @param {Array} list An array of predicate functions
     * @param {*} optional Any arguments to pass into the predicates
     * @return {Function} A function that applies its arguments to each of the predicates, returning
     *         `true` if all are satisfied.
     * @example
     *
     *      var gt10 = function(x) { return x > 10; };
     *      var even = function(x) { return x % 2 === 0};
     *      var f = R.anyPass([gt10, even]);
     *      f(11); //=> true
     *      f(8); //=> true
     *      f(9); //=> false
     */
    var anyPass = curry(_predicateWrap(_any));

    /**
     * ap applies a list of functions to a list of values.
     *
     * @func
     * @memberOf R
     * @category Function
     * @sig [f] -> [a] -> [f a]
     * @param {Array} fns An array of functions
     * @param {Array} vs An array of values
     * @return {Array} An array of results of applying each of `fns` to all of `vs` in turn.
     * @example
     *
     *      R.ap([R.multiply(2), R.add(3)], [1,2,3]); //=> [2, 4, 6, 4, 5, 6]
     */
    var ap = _curry2(function ap(fns, vs) {
        return _hasMethod('ap', fns) ? fns.ap(vs) : _reduce(function (acc, fn) {
            return _concat(acc, map(fn, vs));
        }, [], fns);
    });

    /**
     * Returns the result of calling its first argument with the remaining
     * arguments. This is occasionally useful as a converging function for
     * `R.converge`: the left branch can produce a function while the right
     * branch produces a value to be passed to that function as an argument.
     *
     * @func
     * @memberOf R
     * @category Function
     * @sig (*... -> a),*... -> a
     * @param {Function} fn The function to apply to the remaining arguments.
     * @param {...*} args Any number of positional arguments.
     * @return {*}
     * @example
     *
     *      var indentN = R.pipe(R.times(R.always(' ')),
     *                           R.join(''),
     *                           R.replace(/^(?!$)/gm));
     *
     *      var format = R.converge(R.call,
     *                              R.pipe(R.prop('indent'), indentN),
     *                              R.prop('value'));
     *
     *      format({indent: 2, value: 'foo\nbar\nbaz\n'}); //=> '  foo\n  bar\n  baz\n'
     */
    var call = curry(function call(fn) {
        return fn.apply(this, _slice(arguments, 1));
    });

    /**
     * `chain` maps a function over a list and concatenates the results.
     * This implementation is compatible with the
     * Fantasy-land Chain spec, and will work with types that implement that spec.
     * `chain` is also known as `flatMap` in some libraries
     *
     * @func
     * @memberOf R
     * @category List
     * @sig (a -> [b]) -> [a] -> [b]
     * @param {Function} fn
     * @param {Array} list
     * @return {Array}
     * @example
     *
     *      var duplicate = function(n) {
     *        return [n, n];
     *      };
     *      R.chain(duplicate, [1, 2, 3]); //=> [1, 1, 2, 2, 3, 3]
     */
    var chain = _curry2(_checkForMethod('chain', function chain(f, list) {
        return unnest(_map(f, list));
    }));

    /**
     * The character at the nth position in a String:
     *
     * @deprecated since v0.12.0
     * @func
     * @memberOf R
     * @category String
     * @sig Number -> String -> String
     * @param {Number} index An integer between 0 and the length of the string.
     * @param {String} str The string to extract a char from
     * @return {String} The character at `index` of `str`.
     * @see R.nthChar
     * @example
     *
     *      R.charAt(8, 'abcdefghijklm'); //=> 'i'
     */
    var charAt = invoker(1, 'charAt');

    /**
     * The ascii code of the character at the nth position in a String:
     *
     * @deprecated since v0.12.0
     * @func
     * @memberOf R
     * @category String
     * @sig Number -> String -> Number
     * @param {Number} index An integer between 0 and the length of the string.
     * @param {String} str The string to extract a charCode from
     * @return {Number} The code of the character at `index` of `str`.
     * @see R.nthCharCode
     * @example
     *
     *      R.charCodeAt(8, 'abcdefghijklm'); //=> 105
     *      // (... 'a' ~ 97, 'b' ~ 98, ... 'i' ~ 105)
     */
    var charCodeAt = invoker(1, 'charCodeAt');

    /**
     * Turns a list of Functors into a Functor of a list, applying
     * a mapping function to the elements of the list along the way.
     *
     * Note: `commuteMap` may be more useful to convert a list of non-Array Functors (e.g.
     * Maybe, Either, etc.) to Functor of a list.
     *
     * @func
     * @memberOf R
     * @category List
     * @see R.commute
     * @sig (a -> (b -> c)) -> (x -> [x]) -> [[*]...]
     * @param {Function} fn The transformation function
     * @param {Function} of A function that returns the data type to return
     * @param {Array} list An Array (or other Functor) of Arrays (or other Functors)
     * @return {Array}
     * @example
     *
     *     var plus10map = R.map(function(x) { return x + 10; });
     *     var as = [[1], [3, 4]];
     *     R.commuteMap(R.map(function(x) { return x + 10; }), R.of, as); //=> [[11, 13], [11, 14]]
     *
     *     var bs = [[1, 2], [3]];
     *     R.commuteMap(plus10map, R.of, bs); //=> [[11, 13], [12, 13]]
     *
     *     var cs = [[1, 2], [3, 4]];
     *     R.commuteMap(plus10map, R.of, cs); //=> [[11, 13], [12, 13], [11, 14], [12, 14]]
     */
    var commuteMap = _curry3(function commuteMap(fn, of, list) {
        function consF(acc, ftor) {
            return ap(map(append, fn(ftor)), acc);
        }
        return _reduce(consF, of([]), list);
    });

    /**
     * Wraps a constructor function inside a curried function that can be called with the same
     * arguments and returns the same type. The arity of the function returned is specified
     * to allow using variadic constructor functions.
     *
     * @func
     * @memberOf R
     * @category Function
     * @sig Number -> (* -> {*}) -> (* -> {*})
     * @param {Number} n The arity of the constructor function.
     * @param {Function} Fn The constructor function to wrap.
     * @return {Function} A wrapped, curried constructor function.
     * @example
     *
     *      // Variadic constructor function
     *      var Widget = function() {
     *        this.children = Array.prototype.slice.call(arguments);
     *        // ...
     *      };
     *      Widget.prototype = {
     *        // ...
     *      };
     *      var allConfigs = {
     *        // ...
     *      };
     *      R.map(R.constructN(1, Widget), allConfigs); // a list of Widgets
     */
    var constructN = _curry2(function constructN(n, Fn) {
        if (n > 10) {
            throw new Error('Constructor with greater than ten arguments');
        }
        if (n === 0) {
            return function () {
                return new Fn();
            };
        }
        return curry(nAry(n, function ($0, $1, $2, $3, $4, $5, $6, $7, $8, $9) {
            switch (arguments.length) {
            case 1:
                return new Fn($0);
            case 2:
                return new Fn($0, $1);
            case 3:
                return new Fn($0, $1, $2);
            case 4:
                return new Fn($0, $1, $2, $3);
            case 5:
                return new Fn($0, $1, $2, $3, $4);
            case 6:
                return new Fn($0, $1, $2, $3, $4, $5);
            case 7:
                return new Fn($0, $1, $2, $3, $4, $5, $6);
            case 8:
                return new Fn($0, $1, $2, $3, $4, $5, $6, $7);
            case 9:
                return new Fn($0, $1, $2, $3, $4, $5, $6, $7, $8);
            case 10:
                return new Fn($0, $1, $2, $3, $4, $5, $6, $7, $8, $9);
            }
        }));
    });

    /**
     * Performs a deep test on whether two items are equal.
     * Equality implies the two items are semmatically equivalent.
     * Cyclic structures are handled as expected
     *
     * @func
     * @memberOf R
     * @category Relation
     * @sig a -> b -> Boolean
     * @param {*} a
     * @param {*} b
     * @return {Boolean}
     * @example
     *
     *      var o = {};
     *      R.eqDeep(o, o); //=> true
     *      R.eqDeep(o, {}); //=> true
     *      R.eqDeep(1, 1); //=> true
     *      R.eqDeep(1, '1'); //=> false
     *
     *      var a = {}; a.v = a;
     *      var b = {}; b.v = b;
     *      R.eqDeep(a, b); //=> true
     */
    var eqDeep = _curry2(function eqDeep(a, b) {
        return _eqDeep(a, b, [], []);
    });

    /**
     * Creates a new object by evolving a shallow copy of `object`, according to the
     * `transformation` functions.  All non-primitive properties are copied by reference.
     *
     * @func
     * @memberOf R
     * @category Object
     * @sig {k: (v -> v)} -> {k: v} -> {k: v}
     * @param {Object} transformations The object specifying transformation functions to apply
     *        to the object.
     * @param {Object} object The object to be transformed.
     * @return {Object} The transformed object.
     * @example
     *
     *      R.evolve({ elapsed: R.add(1), remaining: R.add(-1) }, { name: 'Tomato', elapsed: 100, remaining: 1400 }); //=> { name: 'Tomato', elapsed: 101, remaining: 1399 }
     */
    var evolve = _curry2(function evolve(transformations, object) {
        return _extend(_extend({}, object), mapObjIndexed(function (fn, key) {
            return fn(object[key]);
        }, transformations));
    });

    /**
     * Returns a list of function names of object's own functions
     *
     * @func
     * @memberOf R
     * @category Object
     * @sig {*} -> [String]
     * @param {Object} obj The objects with functions in it
     * @return {Array} A list of the object's own properties that map to functions.
     * @example
     *
     *      R.functions(R); // returns list of ramda's own function names
     *
     *      var F = function() { this.x = function(){}; this.y = 1; }
     *      F.prototype.z = function() {};
     *      F.prototype.a = 100;
     *      R.functions(new F()); //=> ["x"]
     */
    var functions = _curry1(_functionsWith(keys));

    /**
     * Returns all but the last element of a list.
     *
     * @func
     * @memberOf R
     * @category List
     * @sig [a] -> [a]
     * @param {Array} list The array to consider.
     * @return {Array} A new array containing all but the last element of the input list, or an
     *         empty list if the input list is empty.
     * @example
     *
     *      R.init(['fi', 'fo', 'fum']); //=> ['fi', 'fo']
     */
    var init = slice(0, -1);

    /**
     * Combines two lists into a set (i.e. no duplicates) composed of those elements common to both lists.
     *
     * @func
     * @memberOf R
     * @category Relation
     * @sig [a] -> [a] -> [a]
     * @param {Array} list1 The first list.
     * @param {Array} list2 The second list.
     * @see R.intersectionWith
     * @return {Array} The list of elements found in both `list1` and `list2`.
     * @example
     *
     *      R.intersection([1,2,3,4], [7,6,5,4,3]); //=> [4, 3]
     */
    var intersection = _curry2(function intersection(list1, list2) {
        return uniq(_filter(flip(_contains)(list1), list2));
    });

    /**
     * Same as R.invertObj, however this accounts for objects
     * with duplicate values by putting the values into an
     * array.
     *
     * @func
     * @memberOf R
     * @category Object
     * @sig {s: x} -> {x: [ s, ... ]}
     * @param {Object} obj The object or array to invert
     * @return {Object} out A new object with keys
     * in an array.
     * @example
     *
     *      var raceResultsByFirstName = {
     *        first: 'alice',
     *        second: 'jake',
     *        third: 'alice',
     *      };
     *      R.invert(raceResultsByFirstName);
     *      //=> { 'alice': ['first', 'third'], 'jake':['second'] }
     */
    var invert = _curry1(function invert(obj) {
        var props = keys(obj);
        var len = props.length;
        var idx = -1;
        var out = {};
        while (++idx < len) {
            var key = props[idx];
            var val = obj[key];
            var list = _has(val, out) ? out[val] : out[val] = [];
            list[list.length] = key;
        }
        return out;
    });

    /**
     * Returns a new object with the keys of the given object
     * as values, and the values of the given object as keys.
     *
     * @func
     * @memberOf R
     * @category Object
     * @sig {s: x} -> {x: s}
     * @param {Object} obj The object or array to invert
     * @return {Object} out A new object
     * @example
     *
     *      var raceResults = {
     *        first: 'alice',
     *        second: 'jake'
     *      };
     *      R.invertObj(raceResults);
     *      //=> { 'alice': 'first', 'jake':'second' }
     *
     *      // Alternatively:
     *      var raceResults = ['alice', 'jake'];
     *      R.invertObj(raceResults);
     *      //=> { 'alice': '0', 'jake':'1' }
     */
    var invertObj = _curry1(function invertObj(obj) {
        var props = keys(obj);
        var len = props.length;
        var idx = -1;
        var out = {};
        while (++idx < len) {
            var key = props[idx];
            out[obj[key]] = key;
        }
        return out;
    });

    /**
     * "lifts" a function to be the specified arity, so that it may "map over" that many
     * lists (or other Functors).
     *
     * @func
     * @memberOf R
     * @see R.lift
     * @category Function
     * @sig Number -> (*... -> *) -> ([*]... -> [*])
     * @param {Function} fn The function to lift into higher context
     * @return {Function} The function `fn` applicable to mappable objects.
     * @example
     *
     *     var madd3 = R.liftN(3, R.curryN(3, function() {
     *       return R.reduce(R.add, 0, arguments);
     *     }));
     *     madd3([1,2,3], [1,2,3], [1]); //=> [3, 4, 5, 4, 5, 6, 5, 6, 7]
     */
    var liftN = _curry2(function liftN(arity, fn) {
        var lifted = curryN(arity, fn);
        return curryN(arity, function () {
            return _reduce(ap, map(lifted, arguments[0]), _slice(arguments, 1));
        });
    });

    /**
     * Create a new object with the own properties of a
     * merged with the own properties of object b.
     * This function will *not* mutate passed-in objects.
     *
     * @func
     * @memberOf R
     * @category Object
     * @sig {k: v} -> {k: v} -> {k: v}
     * @param {Object} a source object
     * @param {Object} b object with higher precedence in output
     * @return {Object} The destination object.
     * @example
     *
     *      R.merge({ 'name': 'fred', 'age': 10 }, { 'age': 40 });
     *      //=> { 'name': 'fred', 'age': 40 }
     *
     *      var resetToDefault = R.merge(R.__, {x: 0});
     *      resetToDefault({x: 5, y: 2}); //=> {x: 0, y: 2}
     */
    var merge = _curry2(function merge(a, b) {
        return _extend(_extend({}, a), b);
    });

    /**
     * Merges a list of objects together into one object.
     *
     * @func
     * @memberOf R
     * @category List
     * @sig [{k: v}] -> {k: v}
     * @param {Array} list An array of objects
     * @return {Object} A merged object.
     * @see reduce
     * @example
     *
     *      R.mergeAll([{foo:1},{bar:2},{baz:3}]); //=> {foo:1,bar:2,baz:3}
     *      R.mergeAll([{foo:1},{foo:2},{bar:2}]); //=> {foo:2,bar:2}
     */
    var mergeAll = _curry1(function mergeAll(list) {
        return reduce(merge, {}, list);
    });

    /**
     * Multiplies together all the elements of a list.
     *
     * @func
     * @memberOf R
     * @category Math
     * @sig [Number] -> Number
     * @param {Array} list An array of numbers
     * @return {Number} The product of all the numbers in the list.
     * @see reduce
     * @example
     *
     *      R.product([2,4,6,8,100,1]); //=> 38400
     */
    var product = reduce(_multiply, 1);

    /**
     * Reasonable analog to SQL `select` statement.
     *
     * @func
     * @memberOf R
     * @category Object
     * @category Relation
     * @sig [k] -> [{k: v}] -> [{k: v}]
     * @param {Array} props The property names to project
     * @param {Array} objs The objects to query
     * @return {Array} An array of objects with just the `props` properties.
     * @example
     *
     *      var abby = {name: 'Abby', age: 7, hair: 'blond', grade: 2};
     *      var fred = {name: 'Fred', age: 12, hair: 'brown', grade: 7};
     *      var kids = [abby, fred];
     *      R.project(['name', 'grade'], kids); //=> [{name: 'Abby', grade: 2}, {name: 'Fred', grade: 7}]
     */
    // passing `identity` gives correct arity
    var project = useWith(_map, pickAll, identity);

    /**
     * Combines two lists into a set (i.e. no duplicates) composed of the
     * elements of each list.
     *
     * @func
     * @memberOf R
     * @category Relation
     * @sig [a] -> [a] -> [a]
     * @param {Array} as The first list.
     * @param {Array} bs The second list.
     * @return {Array} The first and second lists concatenated, with
     *         duplicates removed.
     * @example
     *
     *      R.union([1, 2, 3], [2, 3, 4]); //=> [1, 2, 3, 4]
     */
    var union = _curry2(compose(uniq, _concat));

    var _stepCat = function () {
        var _stepCatArray = {
            init: Array,
            step: function (xs, x) {
                return _concat(xs, [x]);
            },
            result: _identity
        };
        var _stepCatString = {
            init: String,
            step: _add,
            result: _identity
        };
        var _stepCatObject = {
            init: Object,
            step: function (result, input) {
                return merge(result, isArrayLike(input) ? _createMapEntry(input[0], input[1]) : input);
            },
            result: _identity
        };
        return function _stepCat(obj) {
            if (_isTransformer(obj)) {
                return obj;
            }
            if (isArrayLike(obj)) {
                return _stepCatArray;
            }
            if (typeof obj === 'string') {
                return _stepCatString;
            }
            if (typeof obj === 'object') {
                return _stepCatObject;
            }
            throw new Error('Cannot create transformer for ' + obj);
        };
    }();

    /**
     * Turns a list of Functors into a Functor of a list.
     *
     * Note: `commute` may be more useful to convert a list of non-Array Functors (e.g.
     * Maybe, Either, etc.) to Functor of a list.
     *
     * @func
     * @memberOf R
     * @category List
     * @see R.commuteMap
     * @sig (x -> [x]) -> [[*]...]
     * @param {Function} of A function that returns the data type to return
     * @param {Array} list An Array (or other Functor) of Arrays (or other Functors)
     * @return {Array}
     * @example
     *
     *     var as = [[1], [3, 4]];
     *     R.commute(R.of, as); //=> [[1, 3], [1, 4]]
     *
     *     var bs = [[1, 2], [3]];
     *     R.commute(R.of, bs); //=> [[1, 3], [2, 3]]
     *
     *     var cs = [[1, 2], [3, 4]];
     *     R.commute(R.of, cs); //=> [[1, 3], [2, 3], [1, 4], [2, 4]]
     */
    var commute = commuteMap(map(identity));

    /**
     * Wraps a constructor function inside a curried function that can be called with the same
     * arguments and returns the same type.
     *
     * @func
     * @memberOf R
     * @category Function
     * @sig (* -> {*}) -> (* -> {*})
     * @param {Function} Fn The constructor function to wrap.
     * @return {Function} A wrapped, curried constructor function.
     * @example
     *
     *      // Constructor function
     *      var Widget = function(config) {
     *        // ...
     *      };
     *      Widget.prototype = {
     *        // ...
     *      };
     *      var allConfigs = {
     *        // ...
     *      };
     *      R.map(R.construct(Widget), allConfigs); // a list of Widgets
     */
    var construct = _curry1(function construct(Fn) {
        return constructN(Fn.length, Fn);
    });

    /**
     * Transforms the items of the list with the transducer and appends the transformed items to
     * the accumulator using an appropriate iterator function based on the accumulator type.
     *
     * The accumulator can be an array, string, object or a transformer. Iterated items will
     * be appended to arrays and concatenated to strings. Objects will be merged directly or 2-item
     * arrays will be merged as key, value pairs.
     *
     * The accumulator can also be a transformer object that provides a 2-arity reducing iterator
     * function, step, 0-arity initial value function, init, and 1-arity result extraction function
     * result. The step function is used as the iterator function in reduce. The result function is
     * used to convert the final accumulator into the return type and in most cases is R.identity.
     * The init function is used to provide the initial accumulator.
     *
     * The iteration is performed with R.reduce after initializing the transducer.
     *
     * @func
     * @memberOf R
     * @category List
     * @sig a -> (b -> b) -> [c] -> a
     * @param {*} acc The initial accumulator value.
     * @param {Function} xf The transducer function. Receives a transformer and returns a transformer.
     * @param {Array} list The list to iterate over.
     * @return {*} The final, accumulated value.
     * @example
     *
     *      var numbers = [1, 2, 3, 4];
     *      var transducer = R.compose(R.map(R.add(1)), R.take(2));
     *
     *      R.into([], transducer, numbers); //=> [2, 3]
     *
     *      var intoArray = R.into([]);
     *      intoArray(transducer, numbers); //=> [2, 3]
     */
    var into = _curry3(function into(acc, xf, list) {
        return _isTransformer(acc) ? _reduce(xf(acc), acc.init(), list) : _reduce(xf(_stepCat(acc)), acc, list);
    });

    /**
     * "lifts" a function of arity > 1 so that it may "map over" an Array or
     * other Functor.
     *
     * @func
     * @memberOf R
     * @see R.liftN
     * @category Function
     * @sig (*... -> *) -> ([*]... -> [*])
     * @param {Function} fn The function to lift into higher context
     * @return {Function} The function `fn` applicable to mappable objects.
     * @example
     *
     *     var madd3 = R.lift(R.curry(function(a, b, c) {
     *       return a + b + c;
     *     }));
     *     madd3([1,2,3], [1,2,3], [1]); //=> [3, 4, 5, 4, 5, 6, 5, 6, 7]
     *
     *     var madd5 = R.lift(R.curry(function(a, b, c, d, e) {
     *       return a + b + c + d + e;
     *     }));
     *     madd5([1,2], [3], [4, 5], [6], [7, 8]); //=> [21, 22, 22, 23, 22, 23, 23, 24]
     */
    var lift = _curry1(function lift(fn) {
        return liftN(fn.length, fn);
    });

    var R = {
        F: F,
        T: T,
        __: __,
        add: add,
        all: all,
        allPass: allPass,
        always: always,
        and: and,
        any: any,
        anyPass: anyPass,
        ap: ap,
        aperture: aperture,
        append: append,
        apply: apply,
        arity: arity,
        assoc: assoc,
        assocPath: assocPath,
        binary: binary,
        bind: bind,
        both: both,
        call: call,
        chain: chain,
        charAt: charAt,
        charCodeAt: charCodeAt,
        clone: clone,
        commute: commute,
        commuteMap: commuteMap,
        comparator: comparator,
        complement: complement,
        compose: compose,
        composeP: composeP,
        concat: concat,
        cond: cond,
        construct: construct,
        constructN: constructN,
        contains: contains,
        containsWith: containsWith,
        converge: converge,
        countBy: countBy,
        createMapEntry: createMapEntry,
        curry: curry,
        curryN: curryN,
        dec: dec,
        defaultTo: defaultTo,
        difference: difference,
        differenceWith: differenceWith,
        dissoc: dissoc,
        dissocPath: dissocPath,
        divide: divide,
        drop: drop,
        dropWhile: dropWhile,
        either: either,
        empty: empty,
        eq: eq,
        eqDeep: eqDeep,
        eqProps: eqProps,
        evolve: evolve,
        filter: filter,
        filterIndexed: filterIndexed,
        find: find,
        findIndex: findIndex,
        findLast: findLast,
        findLastIndex: findLastIndex,
        flatten: flatten,
        flip: flip,
        forEach: forEach,
        forEachIndexed: forEachIndexed,
        fromPairs: fromPairs,
        func: func,
        functions: functions,
        functionsIn: functionsIn,
        groupBy: groupBy,
        gt: gt,
        gte: gte,
        has: has,
        hasIn: hasIn,
        head: head,
        identity: identity,
        ifElse: ifElse,
        inc: inc,
        indexOf: indexOf,
        init: init,
        insert: insert,
        insertAll: insertAll,
        intersection: intersection,
        intersectionWith: intersectionWith,
        into: into,
        invert: invert,
        invertObj: invertObj,
        invoke: invoke,
        invoker: invoker,
        is: is,
        isArrayLike: isArrayLike,
        isEmpty: isEmpty,
        isNaN: isNaN,
        isNil: isNil,
        isSet: isSet,
        join: join,
        keys: keys,
        keysIn: keysIn,
        last: last,
        lastIndexOf: lastIndexOf,
        length: length,
        lens: lens,
        lensOn: lensOn,
        lift: lift,
        liftN: liftN,
        lt: lt,
        lte: lte,
        map: map,
        mapAccum: mapAccum,
        mapAccumRight: mapAccumRight,
        mapIndexed: mapIndexed,
        mapObj: mapObj,
        mapObjIndexed: mapObjIndexed,
        match: match,
        mathMod: mathMod,
        max: max,
        maxBy: maxBy,
        memoize: memoize,
        merge: merge,
        mergeAll: mergeAll,
        min: min,
        minBy: minBy,
        modulo: modulo,
        multiply: multiply,
        nAry: nAry,
        negate: negate,
        none: none,
        not: not,
        nth: nth,
        nthArg: nthArg,
        nthChar: nthChar,
        nthCharCode: nthCharCode,
        of: of,
        omit: omit,
        once: once,
        or: or,
        partial: partial,
        partialRight: partialRight,
        partition: partition,
        path: path,
        pathEq: pathEq,
        pick: pick,
        pickAll: pickAll,
        pickBy: pickBy,
        pipe: pipe,
        pipeP: pipeP,
        pluck: pluck,
        prepend: prepend,
        product: product,
        project: project,
        prop: prop,
        propEq: propEq,
        propOr: propOr,
        props: props,
        range: range,
        reduce: reduce,
        reduceIndexed: reduceIndexed,
        reduceRight: reduceRight,
        reduceRightIndexed: reduceRightIndexed,
        reject: reject,
        rejectIndexed: rejectIndexed,
        remove: remove,
        repeat: repeat,
        replace: replace,
        reverse: reverse,
        scan: scan,
        slice: slice,
        sort: sort,
        sortBy: sortBy,
        split: split,
        strIndexOf: strIndexOf,
        strLastIndexOf: strLastIndexOf,
        substring: substring,
        substringFrom: substringFrom,
        substringTo: substringTo,
        subtract: subtract,
        sum: sum,
        tail: tail,
        take: take,
        takeWhile: takeWhile,
        tap: tap,
        test: test,
        times: times,
        toLower: toLower,
        toPairs: toPairs,
        toPairsIn: toPairsIn,
        toUpper: toUpper,
        transduce: transduce,
        trim: trim,
        type: type,
        unapply: unapply,
        unary: unary,
        unfold: unfold,
        union: union,
        unionWith: unionWith,
        uniq: uniq,
        uniqWith: uniqWith,
        unnest: unnest,
        useWith: useWith,
        values: values,
        valuesIn: valuesIn,
        where: where,
        wrap: wrap,
        xprod: xprod,
        zip: zip,
        zipObj: zipObj,
        zipWith: zipWith
    };

  /* TEST_ENTRY_POINT */

  if (typeof exports === 'object') {
    module.exports = R;
  } else if (typeof define === 'function' && define.amd) {
    define(function() { return R; });
  } else {
    this.R = R;
  }

}.call(this));

},{}],14:[function(require,module,exports){
var GunType = { ENLARGE: 0, SHRINK: 1 }
var type = GunType.ENLARGE
var isCharging = false
var lastStartedCharging = 0

var BULLET_VELOCITY = 500;

var gunSprite;

var switchType = function() {
	if(type == GunType.ENLARGE) {
		type = GunType.SHRINK;
		console.log("Switching gun to SHRINK");
	} else {
		type = GunType.ENLARGE;
		console.log("Switching gun to ENLARGE");
	}
}

var startCharging = function(game) {
	console.log("Starting to charge the gun")
	isCharging = true;
	lastStartedCharging = game.time.now;
}

var fire = function(game, bullets) {
	var rot = game.physics.arcade.angleToPointer(gunSprite)

	if(!isCharging) throw "the toys out the pram";
	isCharging = false;
	console.log("We were charging for " + (game.time.now - lastStartedCharging) + "seconds");

	bullet = bullets.create(gunSprite.x, gunSprite.y, 'bullet');
	game.physics.arcade.enable(bullet);
	bullet.rotation = gunSprite.rotation;
	bullet.anchor.setTo(0.5, 0.5)
	bullet.body.mass = 0;
	bullet.body.bounce.x = 1
	bullet.body.bounce.y = 1
	bullet.gunType = type;

	game.physics.arcade.velocityFromAngle(bullet.angle, BULLET_VELOCITY, bullet.body.velocity);
	return bullet;
}


function getSprite(game){
	gunSprite = game.add.sprite(0, 0, 'gun');
	gunSprite.anchor.setTo(0.3, 0.6)
	gunSprite.animations.add('fire', [0, 1, 2, 3, 2, 1, 0], 20, false);
	return gunSprite;
}

function updateRotation(game, player) {
	var rot = game.physics.arcade.angleToPointer(gunSprite)

	gunSprite.scale.y = Math.abs(rot) < Math.PI/2 ? 1 : -1;

	gunSprite.rotation = rot;
	gunSprite.position.x = player.position.x + player.width*0.5;
	gunSprite.position.y = player.position.y + player.height*0.55;
}

module.exports.updateRotation = updateRotation;
module.exports.getSprite = getSprite;
module.exports.switchType = switchType;
module.exports.startCharging = startCharging;
module.exports.fire = fire;
module.exports.gunType = GunType;

},{}],15:[function(require,module,exports){
var _ = require('highland');
var R = require('ramda');
var key = {
  87: 'up',
  83: 'down',
  65: 'left',
  68: 'right',
  32: 'switchgun'
}
var INITIAL_STATE = {
    up:false,
    down:false,
    left: false,
    right: false,
    x: 0,
    y: 0,
    switchgun: false,
    chargegun: false,
    firegun: false
  };

module.exports = function input(){
  var canvas = $( 'canvas' )
  return _.merge([
    _('mousemove', $( document )),
    _('mousedown', $( document )),
    _('mouseup', $( document )),
    _('keydown', $( document )),
    // _('keypress', $( document )),
    _('keyup', $( document ))
  ])
  .scan(INITIAL_STATE, function(_memo, e){
    var memo = R.clone(_memo);
    memo.chargegun = !!(e.type === 'mousedown');
    memo.firegun = !!(e.type === 'mouseup');
    if (e.type === 'mousemove') {
      memo.x = e.clientX - canvas[0].offsetLeft;
      memo.y = e.clientY - canvas[0].offsetTop;
      return memo;
    }
    if (key[e.keyCode] !== void 0) {
      memo[key[e.keyCode]] = !!(e.type === 'keydown');
      return memo;
    }
    return memo;
  })
}

module.exports.INITIAL_STATE = INITIAL_STATE;
},{"highland":11,"ramda":13}],16:[function(require,module,exports){
var _ = require('highland');
var R = require('ramda');
var input = require('./input.js');
var gun = require('./gun.js')
var platforms, player, gun, map, layer, gunSprite, boxes, inputState = input.INITIAL_STATE;
var width, height, lastTime;
var GRAVITY = 700;
var bullets, gooSet;
var level;

var game = new Phaser.Game(800, 600, Phaser.AUTO, '', { preload: preload, create: create, update: update });

function getParameterByName(name) {
    name = name.replace(/[\[]/, "\\[").replace(/[\]]/, "\\]");
    var regex = new RegExp("[\\?&]" + name + "=([^&#]*)"),
        results = regex.exec(location.search);
    return results === null ? "" : decodeURIComponent(results[1].replace(/\+/g, " "));
}

function preload() {
  level = getParameterByName('level');
  var map = getParameterByName('map');
  var mapName = level ? "level" + level :
                map   ? map             :
                        "test";

  game.load.tilemap('map', '../resources/maps/' + mapName + ".json", null, Phaser.Tilemap.TILED_JSON);
  game.load.spritesheet('tiles', '../resources/tiles.png', 32, 32);

  game.load.spritesheet('player', '../resources/player.png', 72, 72);
  game.load.spritesheet('gun', '../resources/gun.png', 128, 128);
  game.load.image('bullet', '../resources/pl-bullet.png');
  game.load.image('box', '../resources/box.png');
  game.load.image('goo', '../resources/goo.png');
  game.load.image('reflector', '../resources/reflctor.png');
  game.load.image('door', '../resources/door.png');

  game.load.image('ledge', '../resources/pl-ledge.png')
}

function create() {
  game.stage.backgroundColor = '#998458';
  game.physics.startSystem(Phaser.Physics.ARCADE);

  map = game.add.tilemap('map');
  map.addTilesetImage('tiles');

  boxes = game.add.group();
  boxes.enableBody = true;
  map.createFromObjects('objects', 17, 'box', 0, true, false, boxes);
  boxes.setAll('body.bounce.y', 0.2);
  boxes.setAll('body.gravity.y', GRAVITY);
  boxes.setAll('modSize', 1);
  boxes.callAll('anchor.setTo', 0.5, 1);

  gooSet = game.add.group();
  gooSet.enableBody = true;
  map.createFromObjects('objects', 20, 'goo', 0, true, false, gooSet);
  gooSet.setAll('body.immovable',  true)

  layer = map.createLayer('Tile Layer 1');
  layer.resizeWorld();
  layer.enableBody = true;

  map.setCollisionBetween(1, 16);

  target = game.add.group();
  target.enableBody = true;
  map.createFromObjects('objects', 19, 'door', 0, true, false, target);
  target.setAll('body.immovable', true);

  player = game.add.sprite(100, game.world.height - 400, 'player');
  game.physics.arcade.enable(player);
  player.body.bounce.y = 0.2;
  player.body.gravity.y = GRAVITY;
  player.body.collideWorldBounds = true;
  player.animations.add('walk', [0, 1, 2, 3, 4], 10, true);
  player.anchor.setTo(0.5, 0)
  game.camera.follow(player);

  gunSprite = gun.getSprite(game)
  bullets = game.add.group();
  bullets.enableBody = true;

  bulletReflectables = game.add.group();
  bulletReflectables.enableBody = true;
  map.createFromObjects('objects', 18, 'reflector', 0, true, false, bulletReflectables);
  bulletReflectables.setAll('body.immovable',  true)

  input().each(function(s){
    inputState = s;

    if (inputState.switchgun) {
      gun.switchType();
    }

    if(inputState.chargegun) {
      gun.startCharging(game)
    } else if(inputState.firegun) {
      gun.fire(game, bullets, player)
      gunSprite.animations.play('fire');
    }
  })
}

function destroy(thingsToDestroy, bullet, tile) {
  thingsToDestroy.push(bullet);
}

function update() {
  game.physics.arcade.collide(target, player, function(player, target) {
    if(level) {
      window.location = window.location.href.split('?')[0] + "?level=" + (parseInt(level) + 1)
    }
  });

  boxes.forEach(function(box) {
    if(box.scale.x > player.scale.x && box.scale.y > player.scale.y) {
      box.body.immovable = true;
    } else {
      box.body.immovable = false;
    }
  });

  game.physics.arcade.collide(boxes, layer);
  game.physics.arcade.collide(boxes, boxes);
  game.physics.arcade.collide(player, layer);
  game.physics.arcade.collide(player, boxes);
  game.physics.arcade.collide(player, bulletReflectables);
  game.physics.arcade.collide(bullets, bulletReflectables);

  boxes.forEach(function(box) {
    if (box.body.onFloor()) {
      box.body.drag.setTo(100000);
    } else {
      box.body.drag.setTo(0);
    }
    // box.scale.x = box.modSize;
    // box.scale.y = box.modSize;
  }, this);

  if (inputState.up && (player.body.onFloor() || player.body.touching.down)){
      player.body.velocity.y = -GRAVITY/2;
  }
  gun.updateRotation(game, player, inputState)
  if (inputState.left){
    player.body.velocity.x = -150;
    player.scale.x = -Math.abs(player.scale.x);
    player.animations.play('walk');
  } else if (inputState.right){
    player.body.velocity.x = 150;
    player.scale.x = Math.abs(player.scale.x)
    player.animations.play('walk');
  } else {
    player.body.velocity.x = 0;
    player.animations.stop();
    player.frame = 0;
  }

  var thingsToDestroy = [];
  game.physics.arcade.collide(bullets, layer, R.partial(destroy, thingsToDestroy));
  game.physics.arcade.collide(bullets, gooSet, R.partial(destroy, thingsToDestroy));

  var expandOrShrink = function(sprite) {
    if (sprite.scale.y != Math.floor(sprite.scale.y)) return;
    if(bullet.gunType === gun.gunType.ENLARGE && Math.abs(sprite.scale.x) < 4 && Math.abs(sprite.scale.y) < 4) {
      game.add.tween(sprite.scale).to({ x: sprite.scale.x * 2, y: sprite.scale.y * 2}, 1000, Phaser.Easing.Quadratic.In, true, 0);
      game.add.tween(sprite).to({x: sprite.x - sprite.width / 2}, 1000, Phaser.Easing.Quadratic.In, true, 0)
      game.add.tween(sprite).to({y: sprite.y - sprite.height}, 1000, Phaser.Easing.Quadratic.In, true, 0)
    } else if(bullet.gunType == gun.gunType.SHRINK && Math.abs(sprite.scale.x) > 0.25 && Math.abs(sprite.scale.y) > 0.25) {
      game.add.tween(sprite.scale).to({ x: sprite.scale.x / 2, y: sprite.scale.y / 2 }, 500, Phaser.Easing.Quadratic.In, true, 0);
      game.add.tween(sprite).to({ x: sprite.x + sprite.width / 4 }, 500, Phaser.Easing.Quadratic.In, true, 0)
    }
    sprite.body.velocity.y = 0;
    sprite.body.velocity.x = 0;
  }

  game.physics.arcade.collide(bullets, boxes, function(bullet, box) {
    thingsToDestroy.push(bullet);
    expandOrShrink(box)
  });
  game.physics.arcade.collide(bullets, player, function(player, bullet) {
    thingsToDestroy.push(bullet);
    expandOrShrink(player);
  });

  for(i = 0; i < thingsToDestroy.length; i++) {
    thingsToDestroy[i].destroy();
  }

}

},{"./gun.js":14,"./input.js":15,"highland":11,"ramda":13}]},{},[16]);
