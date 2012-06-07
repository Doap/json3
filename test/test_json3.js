/* JSON 3 Unit Test Suite | http://bestiejs.github.com/json3 */
(function (root) {
  var isLoader = typeof define == "function" && !!define.amd,
  isModule = typeof require == "function" && typeof exports == "object" && exports && !isLoader,
  isBrowser = "window" in root && root.window == root && typeof root.navigator != "undefined",
  isEngine = !isBrowser && !isModule && typeof root.load == "function",

  load = function load(module, path) {
    return root[module] || (isModule ? require(path) : isEngine ?
      (root.load(path.replace(/\.js$/, "") + ".js"), root[module]) : null);
  },

  // Load Spec, Newton, and JSON 3.
  Spec = load("Spec", "./../vendor/spec/lib/spec"), Newton = load("Newton", "./../vendor/spec/lib/newton"), JSON = load("JSON5", "../lib/json3"),

  // Create the test suite.
  testSuite = JSON.testSuite = new Spec.Suite("JSON 3 Unit Tests");

  // Create and attach the logger event handler.
  testSuite.on("all", isBrowser ? Newton.createReport("suite") : Newton.createConsole(function (value) {
    if (typeof console != "undefined" && console.log) {
      console.log(value);
    } else if (typeof print == "function" && !isBrowser) {
      // In browsers, the global `print` function prints the current page.
      print(value);
    } else {
      throw value;
    }
  }));

  // Ensures that `JSON.parse` throws an exception when parsing the given
  // `source` string.
  Spec.Test.prototype.parseError = function (source, message, callback) {
    return this.error(function () {
      JSON.parse(source, callback);
    }, function (exception) {
      return exception.name == "SyntaxError";
    }, message);
  };

  // Ensures that `JSON.parse` parses the given source string correctly.
  Spec.Test.prototype.parses = function (expected, source, message, callback) {
    return this.deepEqual(JSON.parse(source, callback), expected, message);
  };

  // Ensures that `JSON.stringify` throws a `TypeError` if the given object
  // contains a circular reference.
  Spec.Test.prototype.cyclicError = function (value, message) {
    return this.error(function () {
      JSON.stringify(value);
    }, function (exception) {
      return exception.name == "TypeError";
    }, message);
  };

  // Tests
  // -----

  testSuite.addTest("`parse`: Empty Source Strings", function () {
    this.parseError("", "Empty JSON source string");
    this.parseError("\n\n\r\n", "Source string containing only line terminators");
    this.parseError(" ", "Source string containing a single space character");
    this.parseError(" ", "Source string containing multiple space characters");
    this.done(4);
  });

  testSuite.addTest("`parse`: Whitespace", function (test) {
    var characters = ["{\u1680}", "{\u180e}", "{\u2000}", "{\u2001}",
      "{\u2002}", "{\u2003}", "{\u2004}", "{\u2005}", "{\u2006}", "{\u2007}",
      "{\u2008}", "{\u2009}", "{\u200a}", "{\u202f}", "{\u205f}", "{\u3000}"];

    Spec.forEach(characters, function (value) {
      test.parseError(value, "Source string containing an invalid Unicode whitespace character");
    });

    this.parses({}, "{\u00a0}", "Source string containing a non-breaking space");
    this.parses({}, "{\u2028}", "Source string containing a Unicode line separator");
    this.parses({}, "{\u2029}", "Source string containing a Unicode paragraph separator");

    this.parses({}, "{\u000b}", "Source string containing a vertical tab");
    this.parses({}, "{\u000c}", "Source string containing a form feed");
    this.parses({}, "{\ufeff}", "Source string containing a byte-order mark");

    this.parses({}, "{\r\n}", "Source string containing a CRLF line ending");
    this.parses({}, "{\n\n\r\n}", "Source string containing multiple line terminators");
    this.parses({}, "{\t}", "Source string containing a tab character");
    this.parses({}, "{ }", "Source string containing a space character");
    this.done(26);
  });

  testSuite.addTest("`parse`: Octal Values", function (test) {
    // `08` and `018` are invalid octal values.
    Spec.forEach(["00", "01", "02", "03", "04", "05", "06", "07", "010", "011", "08", "018"], function (value) {
      test.parseError(value, "Octal literal");
      test.parseError("-" + value, "Negative octal literal");
      test.parseError('"\\' + value + '"', "Octal escape sequence in a string");
      test.parseError('"\\x' + value + '"', "Hex escape sequence in a string");
    });
    this.done(48);
  });

  testSuite.addTest("`parse`: Numeric Literals", function () {
    this.parses(100, "100", "Integer");
    this.parses(-100, "-100", "Negative integer");
    this.parses(10.5, "10.5", "Float");
    this.parses(-3.141, "-3.141", "Negative float");
    this.parses(0.625, "0.625", "Decimal");
    this.parses(-0.03125, "-0.03125", "Negative decimal");
    this.parses(1000, "1e3", "Exponential");
    this.parses(100, "1e+2", "Positive exponential");
    this.parses(-0.01, "-1e-2", "Negative exponential");
    this.parses(3125, "0.03125e+5", "Decimalized exponential");
    this.parses(100, "1E2", "Case-insensitive exponential delimiter");

    this.parseError("+1", "Leading `+`");
    this.parseError("1.", "Trailing decimal point");
    this.parses(0.1, ".1", "Leading decimal point");
    this.parseError("1e", "Missing exponent");
    this.parseError("1e-", "Missing signed exponent");
    this.parseError("--1", "Leading `--`");
    this.parseError("1-+", "Trailing `-+`");
    this.parses(0xaf, "0xaf", "Hex literal");

    // The native `JSON.parse` implementation in IE 9 allows this syntax, but
    // the feature tests should detect the broken implementation.
    this.parseError("- 5", "Invalid negative sign");

    this.done(20);
  });

  testSuite.addTest("`parse`: String Literals", function (test) {
    var expected = 49, controlCharacters = ["\u0001", "\u0002", "\u0003",
      "\u0004", "\u0005", "\u0006", "\u0007", "\b", "\t", "\n", "\u000b", "\f",
      "\r", "\u000e", "\u000f", "\u0010", "\u0011", "\u0012", "\u0013",
      "\u0014", "\u0015", "\u0016", "\u0017", "\u0018", "\u0019", "\u001a",
      "\u001b", "\u001c", "\u001d", "\u001e", "\u001f"];

    // Opera 7 discards null characters in strings.
    if ("\0".length) {
      expected += 1;
      controlCharacters.push("\u0000");
    }

    this.parses("value", '"value"', "Double-quoted string literal");
    this.parses("", '""', "Empty string literal");

    this.parses("\u2028", '"\\u2028"', "String containing an escaped Unicode line separator");
    this.parses("\u2029", '"\\u2029"', "String containing an escaped Unicode paragraph separator");
    this.parses("\ud834\udf06", '"\\ud834\\udf06"', "String containing an escaped Unicode surrogate pair");
    this.parses("\ud834\udf06", '"\ud834\udf06"', "String containing an unescaped Unicode surrogate pair");
    this.parses("\u0001", '"\\u0001"', "String containing an escaped ASCII control character");
    this.parses("\b", '"\\b"', "String containing an escaped backspace");
    this.parses("\f", '"\\f"', "String containing an escaped form feed");
    this.parses("\n", '"\\n"', "String containing an escaped line feed");
    this.parses("\r", '"\\r"', "String containing an escaped carriage return");
    this.parses("\t", '"\\t"', "String containing an escaped tab");

    this.parses("hello/world", '"hello\\/world"', "String containing an escaped solidus");
    this.parses("hello\\world", '"hello\\\\world"', "String containing an escaped reverse solidus");
    this.parses("hello\"world", '"hello\\"world"', "String containing an escaped double-quote character");

    this.parses("hello", "'hello'", "Single-quoted string literal");
    this.parseError('"\\x61"', "String containing a hex escape sequence");
    this.parseError('"hello \r\n world"', "String containing an unescaped CRLF line ending");

    Spec.forEach(controlCharacters, function (value) {
      test.parseError('"' + value + '"', "String containing an unescaped ASCII control character");
    });

    this.done(expected);
  });

  testSuite.addTest("`parse`: Array Literals", function () {
    this.parses([1, 2, 3], "[1, 2, 3,]", "Trailing comma in array literal");
    this.parses([1, 2, [3, [4, 5]], 6, [true, false], [null], [[]]], "[1, 2, [3, [4, 5]], 6, [true, false], [null], [[]]]", "Nested arrays");
    this.parses([{}], "[{}]", "Array containing empty object literal");
    this.parses([100, true, false, null, {"a": ["hello"], "b": ["world"]}, [0.01]], "[1e2, true, false, null, {\"a\": [\"hello\"], \"b\": [\"world\"]}, [1e-2]]", "Mixed array");
    this.done(4);
  });

  testSuite.addTest("`parse`: Object Literals", function () {
    this.parses({"hello": "world"}, "{\"hello\": \"world\"}", "Object literal containing one member");
    this.parses({"hello": "world", "foo": ["bar", true], "fox": {"quick": true, "purple": false}}, "{\"hello\": \"world\", \"foo\": [\"bar\", true], \"fox\": {\"quick\": true, \"purple\": false}}", "Object literal containing multiple members");

    this.parses({ "key": 1 }, "{key: 1}", "Unquoted identifier used as a property name");
    this.parseError("{false: 1}", "`false` used as a property name");
    this.parseError("{true: 1}", "`true` used as a property name");
    this.parseError("{null: 1}", "`null` used as a property name");
    this.parses({ "key": 1}, "{'key': 1}", "Single-quoted string used as a property name");
    this.parseError("{1: 2, 3: 4}", "Number used as a property name");

    this.parses({ "hello": "world", "foo": "bar" }, "{\"hello\": \"world\", \"foo\": \"bar\",}", "Trailing comma in object literal");
    this.done(9);
  });

  // JavaScript expressions should never be evaluated, as JSON 3 does not use
  // `eval`.
  testSuite.addTest("`parse`: Invalid Expressions", function (test) {
    Spec.forEach(["1 + 1", "1 * 2", "var value = 123;", "{});value = 123;({}", "call()", "1, 2, 3, \"value\""], function (expression) {
      test.parseError(expression, "Source string containing a JavaScript expression");
    });
    this.done(6);
  });

  testSuite.addTest("`parse`: Optional Arguments", function () {
    this.parses({"a": 1, "b": 16}, '{"a": 1, "b": "10000"}', "Callback function provided", function (key, value) {
      return typeof value == "string" ? parseInt(value, 2) : value;
    });
    this.equal(3, JSON.parse("[1, 2, 3]", function (key, value) {
      if (typeof value == "object" && value) {
        return value;
      }
    }).length, "Issue #10: `walk` should not use `splice` when removing an array element");
    this.done(2);
  });

  /*
   * The following tests are adapted from the ECMAScript 5 Conformance Suite.
   * Copyright 2009, Microsoft Corporation. Distributed under the New BSD License.
   *
   * Redistribution and use in source and binary forms, with or without
   * modification, are permitted provided that the following conditions are met:
   *
   *   - Redistributions of source code must retain the above copyright notice,
   *     this list of conditions and the following disclaimer.
   *   - Redistributions in binary form must reproduce the above copyright notice,
   *     this list of conditions and the following disclaimer in the documentation
   *     and/or other materials provided with the distribution.
   *   - Neither the name of Microsoft nor the names of its contributors may be
   *     used to endorse or promote products derived from this software without
   *     specific prior written permission.
   *
   * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
   * AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
   * IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
   * ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT OWNER OR CONTRIBUTORS BE
   * LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR
   * CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF
   * SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS
   * INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN
   * CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE)
   * ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE
   * POSSIBILITY OF SUCH DAMAGE.
  */
  testSuite.addTest("ECMAScript 5 Conformance", function () {
    var value = { "a1": { "b1": [1, 2, 3, 4], "b2": { "c1": 1, "c2": 2 } }, "a2": "a2" };

    // Section 15.12.1.1: The JSON Grammar.
    // ------------------------------------

    // Tests 15.12.1.1-0-1 thru 15.12.1.1-0-8.
    this.parseError("12\t\r\n 34", "Valid whitespace characters may not separate two discrete tokens");
    this.parses(1234, "\u000b1234", "The vertical tab is a valid whitespace character");
    this.parses(1234, "\u000c1234", "The form feed is a valid whitespace character");
    this.parses(1234, "\u00a01234", "The non-breaking space is a valid whitespace character");
    this.parses(1234, "\ufeff1234", "The byte order mark (zero-width non-breaking space) is a valid whitespace character");
    this.parses(1234, "\u20281234\u2029", "The Unicode line and paragraph separators are valid whitespace characters");
    this.parseError("\u200b1234", "The zero-width space is not a valid whitespace character");
    this.parseError("\u1680\u180e\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200a\u202f\u205f\u30001234", "Other Unicode category `Z` characters are not valid whitespace characters");

    // Test 15.12.1.1-0-9.
    this.parses({ "property": {}, "prop2": [true, null, 123.456] },
      '\t\r \n{\t\r \n' +
      '"property"\t\r \n:\t\r \n{\t\r \n}\t\r \n,\t\r \n' +
      '"prop2"\t\r \n:\t\r \n' +
        '[\t\r \ntrue\t\r \n,\t\r \nnull\t\r \n,123.456\t\r \n]' +
      '\t\r \n}\t\r \n',
    "Valid whitespace characters may precede and follow all tokens");

    // Tests 15.12.1.1-g1-1 thru 15.12.1.1-g1-4.
    this.parses(1234, "\t1234", "Leading tab characters should be ignored");
    this.parseError("12\t34", "A tab character may not separate two disparate tokens");
    this.parses(1234, "\r1234", "Leading carriage returns should be ignored");
    this.parseError("12\r34", "A carriage return may not separate two disparate tokens");
    this.parses(1234, "\n1234", "Leading line feeds should be ignored");
    this.parseError("12\n34", "A line feed may not separate two disparate tokens");
    this.parses(1234, " 1234", "Leading space characters should be ignored");
    this.parseError("12 34", "A space character may not separate two disparate tokens");

    // Tests 15.12.1.1-g2-1 thru 15.12.1.1-g2-5.
    this.parses("abc", '"abc"', "Strings must be enclosed in double quotes");
    this.parses("abc", "'abc'", "Single-quoted strings are permitted");
    // Note: the original test 15.12.1.1-g2-3 (`"\u0022abc\u0022"`) is incorrect,
    // as the JavaScript interpreter will always convert `\u0022` to `"`.
    this.parseError("\\u0022abc\\u0022", "Unicode-escaped double quote delimiters are not permitted");
    this.parseError('"ab'+"c'", "Strings must terminate with a double quote character");
    this.parses("", '""', "Strings may be empty");

    // Tests 15.12.1.1-g4-1 thru 15.12.1.1-g4-4.
    this.parseError('"\u0000\u0001\u0002\u0003\u0004\u0005\u0006\u0007"', "Unescaped control characters in the range [U+0000, U+0007] are not permitted within strings");
    this.parseError('"\u0008\u0009\u000a\u000b\u000c\u000d\u000e\u000f"', "Unescaped control characters in the range [U+0008, U+000F] are not permitted within strings");
    this.parseError('"\u0010\u0011\u0012\u0013\u0014\u0015\u0016\u0017"', "Unescaped control characters in the range [U+0010, U+0017] are not permitted within strings");
    this.parseError('"\u0018\u0019\u001a\u001b\u001c\u001d\u001e\u001f"', "Unescaped control characters in the range [U+0018, U+001F] are not permitted within strings");

    // Tests 15.12.1.1-g5-1 thru 15.12.1.1-g5-3.
    this.parses("X", '"\\u0058"', "Unicode escape sequences are permitted within strings");
    this.parseError('"\\u005"', "Unicode escape sequences may not comprise fewer than four hexdigits");
    this.parseError('"\\u0X50"', "Unicode escape sequences may not contain non-hex characters");

    // Tests 15.12.1.1-g6-1 thru 15.12.1.1-g6-7.
    this.parses("/", '"\\/"', "Escaped solidus");
    this.parses("\\", '"\\\\"', "Escaped reverse solidus");
    this.parses("\b", '"\\b"', "Escaped backspace");
    this.parses("\f", '"\\f"', "Escaped form feed");
    this.parses("\n", '"\\n"', "Escaped line feed");
    this.parses("\r", '"\\r"', "Escaped carriage return");
    this.parses("\t", '"\\t"', "Escaped tab");

    this.done();
  });

  testSuite.addTest("JSON5 Extensions", function () {
    // Arrays.
    this.parses([], "[]", "Empty array");
    this.parses([true, false, null], "[true, false, null]", "Array containing Boolean and `null` literals");
    this.parses([null], "[null,]", "Trailing comma in array literal");

    this.parseError("[,null]", "Leading comma in array literal");
    this.parseError("[,]", "Array containing an elision");
    this.parseError("[true false]", "Array missing the requisite `,` delimiter between two elements");

    // Comments.
    this.parses({}, "{/* Block comment. */}", "Block comment in object literal");
    this.parses({}, "{/* Block comment.\n// Nested line comment. */}", "Block comment with nested line comment");
    this.parses([false], "[\n\tfalse/*\n\t\ttrue\n\t*/]", "Block comment and whitespace in array");
    this.parses(null, "null\n/*\n\tTrailing block comment.\n*/", "`null` literal with trailing block comment");
    this.parses("/* Block comment */ syntax in string.", '"/* Block comment */ syntax in string."', "Block comment delimiters in string");
    this.parses(null, "/* Leading block comment. */\nnull", "`null` literal with leading block comment");
    this.parses(true, "/**\n * Sample JSDoc comment...\r\n * With CRLF-style line endings.\n**/true", "JSDoc-style block comment with CRLF-style line endings");
    this.parses([false], "[false // true\n]", "Line comment in array");
    this.parses([], "// Line comment.\n[\n// Another line comment.\n]", "Line comments should be treated as whitespace");
    this.parses(null, "null // Trailing line comment.", "`null` literal with trailing line comment");
    this.parses(false, "// Leading line comment.\nfalse", "Boolean literal with leading line comment");
    this.parses("Line comment // syntax in string.", '"Line comment // syntax in string."', "Line comment delimiter in string");

    this.parseError("/**/", "Empty block comment");
    this.parseError("//", "Empty line comment");
    this.parseError("true /* Unterminated block comment", "Unterminated trailing block comment");

    // Miscellaneous.
    this.parses({
      "foo": "bar",
      "while": true,
      "this": "is a multi-line string",
      "here": "is another",
      "hex": 0xdeadbeef,
      "half": 0.5,
      "finally": "a trailing comma",
      "oh": ["we shouldn't forget", "arrays can have", "trailing commas too"]
    }, "{ foo: 'bar', while: true, this: 'is a\\\n multi-line string',\n" +
      "// this is an inline comment\nhere: 'is another', // inline comment\n\n" +
      "/* this is a block comment\n\tit continues on another line*/\n" +
      "hex: 0xDEADbeef, half: .5, finally: 'a trailing comma'," +
      "oh: ['we shouldn\\'t forget', 'arrays can have', 'trailing commas too',],}",
    "Complete source string with JSON5 grammar extensions");

    // Numbers.
    this.parses(0xc8, "0xc8", "Lowercase hex literal");
    this.parses(0xc8, "0XC8", "Uppercase hex literal");
    this.parses(0xc8, "0xC8", "Mixed case hex literal");
    this.parses(-0xc8, "-0xC8", "Negative hex literal");

    this.parseError("0x", "Empty hexadecimal value");
    this.parseError("0770", "Valid octal value");
    this.parseError("080", "Invalid octal value");

    // Objects.
    this.parses({}, "{}", "Empty object");
    this.parses({ "while": true }, "{ while: true }", "Reserved word used as unquoted object property name");
    this.parses({ "hello": "world" }, "{ 'hello': \"world\" }", "Single-quoted object property name");
    this.parses({ "foo": "bar" }, "{ \"foo\": \"bar\", }", "Trailing comma in object literal");
    this.parses({
      "hello": "world",
      "_": "underscore",
      "$": "dollar sign",
      "one1": "numerals",
      "_$_": "multiple symbols",
      "$_$hello123world_$_": "mixed"
    }, '{ hello: "world", _: "underscore", $: "dollar sign", one1: "numerals", _$_: "multiple symbols", $_$hello123world_$_: "mixed" }',
      "Identifiers used as unquoted object property names");

    this.parseError("{ 10twenty: \"ten twenty\" }", "Illegal identifier (leading numeric value)");
    this.parseError("{ multi-word: \"multi-word\" }", "Illegal identifier (invalid punctuator)");
    this.parseError("{ ,\"foo\": \"bar\" }", "Leading comma in object literal");
    this.parseError("{,}", "Object literal containing a single comma");
    this.parseError("{ \"foo\": \"bar\"\n \"hello\": \"world\" }", "Object literal missing the requisite `,` delimiter between two members");

    // Strings.
    this.parses("I can't wait", "'I can\\'t wait'", "Single-quoted string with escaped single quote character");
    this.parses("hello world", "'hello\\\n world'", "Single-quoted string with LF line continuation");
    this.parses("hello world", "'hello\\\r world'", "Single-quoted string with CR line continuation");
    this.parses("hello world", '"hello \\\r\nworld"', "Double-quoted string with CRLF line continuation");
    this.parseError('"hello \nworld"', "String with invalid line continuation");

    // Identifiers.
    this.parseError('{ sig\\u03A3ma: "the sum of all things" }', "Illegal identifier (Unicode escape sequence)");
    this.parseError('{ ümlåût: "that\'s not really an ümlaüt, but this is" }', "Illegal identifier (literal Unicode character)");

    this.done(46);
  });

  testSuite.shuffle();

  if (isLoader) {
    define(function () {
      return testSuite;
    });
  } else if (!isBrowser && (!isModule || (typeof module == "object" && module == require.main))) {
    testSuite.run();
  }
})(this);