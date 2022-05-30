var t = function (t) { var n, r = Object.prototype, e = r.hasOwnProperty, o = "function" == typeof Symbol ? Symbol : {}, i = o.iterator || "@@iterator", u = o.asyncIterator || "@@asyncIterator", c = o.toStringTag || "@@toStringTag"; function a(t, n, r, e) { var o = n && n.prototype instanceof v ? n : v, i = Object.create(o.prototype), u = new E(e || []); return i._invoke = function (t, n, r) { var e = s; return function (o, i) { if (e === h)
    throw new Error("Generator is already running"); if (e === p) {
    if ("throw" === o)
        throw i;
    return _();
} for (r.method = o, r.arg = i;;) {
    var u = r.delegate;
    if (u) {
        var c = S(u, r);
        if (c) {
            if (c === y)
                continue;
            return c;
        }
    }
    if ("next" === r.method)
        r.sent = r._sent = r.arg;
    else if ("throw" === r.method) {
        if (e === s)
            throw e = p, r.arg;
        r.dispatchException(r.arg);
    }
    else
        "return" === r.method && r.abrupt("return", r.arg);
    e = h;
    var a = f(t, n, r);
    if ("normal" === a.type) {
        if (e = r.done ? p : l, a.arg === y)
            continue;
        return { value: a.arg, done: r.done };
    }
    "throw" === a.type && (e = p, r.method = "throw", r.arg = a.arg);
} }; }(t, r, u), i; } function f(t, n, r) { try {
    return { type: "normal", arg: t.call(n, r) };
}
catch (t) {
    return { type: "throw", arg: t };
} } t.wrap = a; var s = "suspendedStart", l = "suspendedYield", h = "executing", p = "completed", y = {}; function v() { } function d() { } function g() { } var m = {}; m[i] = function () { return this; }; var b = Object.getPrototypeOf, w = b && b(b(L([]))); w && w !== r && e.call(w, i) && (m = w); var O = g.prototype = v.prototype = Object.create(m); function j(t) { ["next", "throw", "return"].forEach(function (n) { t[n] = function (t) { return this._invoke(n, t); }; }); } function x(t) { var n; this._invoke = function (r, o) { function i() { return new Promise(function (n, i) { !function n(r, o, i, u) { var c = f(t[r], t, o); if ("throw" !== c.type) {
    var a = c.arg, s = a.value;
    return s && "object" == typeof s && e.call(s, "__await") ? Promise.resolve(s.__await).then(function (t) { n("next", t, i, u); }, function (t) { n("throw", t, i, u); }) : Promise.resolve(s).then(function (t) { a.value = t, i(a); }, function (t) { return n("throw", t, i, u); });
} u(c.arg); }(r, o, n, i); }); } return n = n ? n.then(i, i) : i(); }; } function S(t, r) { var e = t.iterator[r.method]; if (e === n) {
    if (r.delegate = null, "throw" === r.method) {
        if (t.iterator.return && (r.method = "return", r.arg = n, S(t, r), "throw" === r.method))
            return y;
        r.method = "throw", r.arg = new TypeError("The iterator does not provide a 'throw' method");
    }
    return y;
} var o = f(e, t.iterator, r.arg); if ("throw" === o.type)
    return r.method = "throw", r.arg = o.arg, r.delegate = null, y; var i = o.arg; return i ? i.done ? (r[t.resultName] = i.value, r.next = t.nextLoc, "return" !== r.method && (r.method = "next", r.arg = n), r.delegate = null, y) : i : (r.method = "throw", r.arg = new TypeError("iterator result is not an object"), r.delegate = null, y); } function P(t) { var n = { tryLoc: t[0] }; 1 in t && (n.catchLoc = t[1]), 2 in t && (n.finallyLoc = t[2], n.afterLoc = t[3]), this.tryEntries.push(n); } function A(t) { var n = t.completion || {}; n.type = "normal", delete n.arg, t.completion = n; } function E(t) { this.tryEntries = [{ tryLoc: "root" }], t.forEach(P, this), this.reset(!0); } function L(t) { if (t) {
    var r = t[i];
    if (r)
        return r.call(t);
    if ("function" == typeof t.next)
        return t;
    if (!isNaN(t.length)) {
        var o = -1, u = function r() { for (; ++o < t.length;)
            if (e.call(t, o))
                return r.value = t[o], r.done = !1, r; return r.value = n, r.done = !0, r; };
        return u.next = u;
    }
} return { next: _ }; } function _() { return { value: n, done: !0 }; } return d.prototype = O.constructor = g, g.constructor = d, g[c] = d.displayName = "GeneratorFunction", t.isGeneratorFunction = function (t) { var n = "function" == typeof t && t.constructor; return !!n && (n === d || "GeneratorFunction" === (n.displayName || n.name)); }, t.mark = function (t) { return Object.setPrototypeOf ? Object.setPrototypeOf(t, g) : (t.__proto__ = g, c in t || (t[c] = "GeneratorFunction")), t.prototype = Object.create(O), t; }, t.awrap = function (t) { return { __await: t }; }, j(x.prototype), x.prototype[u] = function () { return this; }, t.AsyncIterator = x, t.async = function (n, r, e, o) { var i = new x(a(n, r, e, o)); return t.isGeneratorFunction(r) ? i : i.next().then(function (t) { return t.done ? t.value : i.next(); }); }, j(O), O[c] = "Generator", O[i] = function () { return this; }, O.toString = function () { return "[object Generator]"; }, t.keys = function (t) { var n = []; for (var r in t)
    n.push(r); return n.reverse(), function r() { for (; n.length;) {
    var e = n.pop();
    if (e in t)
        return r.value = e, r.done = !1, r;
} return r.done = !0, r; }; }, t.values = L, E.prototype = { constructor: E, reset: function (t) { if (this.prev = 0, this.next = 0, this.sent = this._sent = n, this.done = !1, this.delegate = null, this.method = "next", this.arg = n, this.tryEntries.forEach(A), !t)
        for (var r in this)
            "t" === r.charAt(0) && e.call(this, r) && !isNaN(+r.slice(1)) && (this[r] = n); }, stop: function () { this.done = !0; var t = this.tryEntries[0].completion; if ("throw" === t.type)
        throw t.arg; return this.rval; }, dispatchException: function (t) { if (this.done)
        throw t; var r = this; function o(e, o) { return c.type = "throw", c.arg = t, r.next = e, o && (r.method = "next", r.arg = n), !!o; } for (var i = this.tryEntries.length - 1; i >= 0; --i) {
        var u = this.tryEntries[i], c = u.completion;
        if ("root" === u.tryLoc)
            return o("end");
        if (u.tryLoc <= this.prev) {
            var a = e.call(u, "catchLoc"), f = e.call(u, "finallyLoc");
            if (a && f) {
                if (this.prev < u.catchLoc)
                    return o(u.catchLoc, !0);
                if (this.prev < u.finallyLoc)
                    return o(u.finallyLoc);
            }
            else if (a) {
                if (this.prev < u.catchLoc)
                    return o(u.catchLoc, !0);
            }
            else {
                if (!f)
                    throw new Error("try statement without catch or finally");
                if (this.prev < u.finallyLoc)
                    return o(u.finallyLoc);
            }
        }
    } }, abrupt: function (t, n) { for (var r = this.tryEntries.length - 1; r >= 0; --r) {
        var o = this.tryEntries[r];
        if (o.tryLoc <= this.prev && e.call(o, "finallyLoc") && this.prev < o.finallyLoc) {
            var i = o;
            break;
        }
    } i && ("break" === t || "continue" === t) && i.tryLoc <= n && n <= i.finallyLoc && (i = null); var u = i ? i.completion : {}; return u.type = t, u.arg = n, i ? (this.method = "next", this.next = i.finallyLoc, y) : this.complete(u); }, complete: function (t, n) { if ("throw" === t.type)
        throw t.arg; return "break" === t.type || "continue" === t.type ? this.next = t.arg : "return" === t.type ? (this.rval = this.arg = t.arg, this.method = "return", this.next = "end") : "normal" === t.type && n && (this.next = n), y; }, finish: function (t) { for (var n = this.tryEntries.length - 1; n >= 0; --n) {
        var r = this.tryEntries[n];
        if (r.finallyLoc === t)
            return this.complete(r.completion, r.afterLoc), A(r), y;
    } }, catch: function (t) { for (var n = this.tryEntries.length - 1; n >= 0; --n) {
        var r = this.tryEntries[n];
        if (r.tryLoc === t) {
            var e = r.completion;
            if ("throw" === e.type) {
                var o = e.arg;
                A(r);
            }
            return o;
        }
    } throw new Error("illegal catch attempt"); }, delegateYield: function (t, r, e) { return this.delegate = { iterator: L(t), resultName: r, nextLoc: e }, "next" === this.method && (this.arg = n), y; } }, t; }("object" == typeof module ? module.exports : {});
try {
    regeneratorRuntime = t;
}
catch (n) {
    Function("r", "regeneratorRuntime = r")(t);
}
!function (t, n) { if ("function" == typeof define && define.amd)
    define("objectmodel", ["exports"], n);
else if ("undefined" != typeof exports)
    n(exports);
else {
    var r = { exports: {} };
    n(r.exports), t.objectmodel = r.exports;
} }(this, function (t) { var n, r, e, o; function i(t, n, r) { return (i = function () { if ("undefined" == typeof Reflect || !Reflect.construct)
    return !1; if (Reflect.construct.sham)
    return !1; if ("function" == typeof Proxy)
    return !0; try {
    return Date.prototype.toString.call(Reflect.construct(Date, [], function () { })), !0;
}
catch (t) {
    return !1;
} }() ? Reflect.construct : function (t, n, r) { var e = [null]; e.push.apply(e, n); var o = new (Function.bind.apply(t, e)); return r && u(o, r.prototype), o; }).apply(null, arguments); } function u(t, n) { return (u = Object.setPrototypeOf || function (t, n) { return t.__proto__ = n, t; })(t, n); } function c(t, n) { return function (t) { if (Array.isArray(t))
    return t; }(t) || function (t, n) { var r = [], e = !0, o = !1, i = void 0; try {
    for (var u, c = t[Symbol.iterator](); !(e = (u = c.next()).done) && (r.push(u.value), !n || r.length !== n); e = !0)
        ;
}
catch (t) {
    o = !0, i = t;
}
finally {
    try {
        e || null == c.return || c.return();
    }
    finally {
        if (o)
            throw i;
    }
} return r; }(t, n) || function () { throw new TypeError("Invalid attempt to destructure non-iterable instance"); }(); } function a(t, n) { var r = Object.keys(t); if (Object.getOwnPropertySymbols) {
    var e = Object.getOwnPropertySymbols(t);
    n && (e = e.filter(function (n) { return Object.getOwnPropertyDescriptor(t, n).enumerable; })), r.push.apply(r, e);
} return r; } function f(t) { for (var n = 1; n < arguments.length; n++) {
    var r = null != arguments[n] ? arguments[n] : {};
    n % 2 ? a(r, !0).forEach(function (n) { s(t, n, r[n]); }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(t, Object.getOwnPropertyDescriptors(r)) : a(r).forEach(function (n) { Object.defineProperty(t, n, Object.getOwnPropertyDescriptor(r, n)); });
} return t; } function s(t, n, r) { return n in t ? Object.defineProperty(t, n, { value: r, enumerable: !0, configurable: !0, writable: !0 }) : t[n] = r, t; } function l(t) { return function (t) { if (Array.isArray(t)) {
    for (var n = 0, r = new Array(t.length); n < t.length; n++)
        r[n] = t[n];
    return r;
} }(t) || function (t) { if (Symbol.iterator in Object(t) || "[object Arguments]" === Object.prototype.toString.call(t))
    return Array.from(t); }(t) || function () { throw new TypeError("Invalid attempt to spread non-iterable instance"); }(); } function h(t) { return (h = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (t) { return typeof t; } : function (t) { return t && "function" == typeof Symbol && t.constructor === Symbol && t !== Symbol.prototype ? "symbol" : typeof t; })(t); } Object.defineProperty(t, "__esModule", { value: !0 }), t.ArrayModel = tt, t.BasicModel = Q, t.FunctionModel = rt, t.MapModel = et, t.Model = J, t.ObjectModel = V, t.SetModel = ot, t.Any = void 0; var p = function (t) { return Object.prototype.toString.call(t).match(/\s([a-zA-Z]+)/)[1]; }, y = Object.getPrototypeOf, v = Object.setPrototypeOf, d = function (t, n) { return Object.prototype.hasOwnProperty.call(t, n); }, g = function (t, n) { return n instanceof t; }, m = function (t) { return "function" == typeof t; }, b = function (t) { return t && "object" === h(t); }, w = function (t) { return b(t) && y(t) === Object.prototype; }, O = function (t) { return t && m(t[Symbol.iterator]); }, j = function (t, n) { return new Proxy(t, n); }, x = function t(n) { var r = arguments.length > 1 && void 0 !== arguments[1] ? arguments[1] : {}; for (var e in r)
    if (w(r[e])) {
        var o = {};
        t(o, n[e]), t(o, r[e]), n[e] = o;
    }
    else
        n[e] = r[e]; return n; }, S = function (t, n, r) { var e = arguments.length > 3 && void 0 !== arguments[3] && arguments[3]; Object.defineProperty(t, n, { value: r, enumerable: e, writable: !0, configurable: !0 }); }, P = function (t, n, r) { t.prototype = Object.assign(Object.create(n.prototype, { constructor: { value: t, writable: !0, configurable: !0 } }), r), v(t, n); }, A = Symbol(), E = Symbol(), L = Symbol(), _ = function (t, n, r, e, o, i) { var u = function t() { var n = arguments.length > 0 && void 0 !== arguments[0] ? arguments[0] : t.default, r = arguments.length > 1 ? arguments[1] : void 0; return i && !g(t, this) ? new t(n) : (e && (n = e(n, t, this)), r === E || G(t, n) ? o ? j(n, o(t)) : n : void 0); }; return r && P(u, r), v(u, n.prototype), u.constructor = n, u.definition = t, u.assertions = l(u.assertions), S(u, "errors", []), delete u.name, u; }, k = function (t, n, r) { return g(n, t) ? t : (b(t) || m(t) || void 0 === t || F(n.errors, Object, t), x(r, n.default), n.parentClass && x(t, new n.parentClass(t)), x(r, t), r); }, R = function (t, n, r) { var e; return P(t, n, r), (e = t.assertions).push.apply(e, l(n.assertions)), t; }, F = function (t, n, r, e, o) { t.push({ expected: n, received: r, path: e, message: o }); }, M = function (t) { var n = arguments.length > 1 && void 0 !== arguments[1] ? arguments[1] : t.errorCollector, r = t.errors.length; if (r > 0) {
    var e = t.errors.map(function (t) { if (!t.message) {
        var n = [].concat(t.expected);
        t.message = "expecting " + (t.path ? t.path + " to be " : "") + n.map(function (t) { return z(t); }).join(" or ") + ", got " + (null != t.received ? p(t.received) + " " : "") + z(t.received);
    } return t; });
    t.errors.length = 0, n.call(t, e);
} return r; }, C = function (t) { return t && y(t) && g(J, y(t).constructor); }, N = function t(n) { if (w(n))
    Object.keys(n).map(function (r) { n[r] = t(n[r]); });
else {
    if (!Array.isArray(n))
        return [n];
    if (1 === n.length)
        return [].concat(l(n), [void 0, null]);
} return n; }, T = function (t, n) { var r = N(t).map(function (t) { return z(t, n); }); return r.length > 1 ? "(".concat(r.join(" or "), ")") : r[0]; }, D = function (t) { var n = arguments.length > 1 && void 0 !== arguments[1] ? arguments[1] : []; return (n = [].concat(n)).length > 0 && (t = n.reduce(function (t, n) { return t.concat(n); }, [].concat(t)).filter(function (t, n, r) { return r.indexOf(t) === n; })), t; }, G = function (t, n) { return t[A](n, null, t.errors, [], !0), !M(t); }, I = function t(n, r, e, o, i, u) { var c = i.indexOf(r); if (-1 !== c && -1 !== i.indexOf(r, c + 1))
    return n; if (g(J, r))
    u && (n = Z(n, r)), r[A](n, e, o, i.concat(r));
else if (w(r))
    Object.keys(r).map(function (c) { var a = n ? n[c] : void 0; t(a, r[c], B(e, c), o, i, u); });
else {
    if (N(r).some(function (t) { return K(n, t, e, i); }))
        return u ? Z(n, r) : n;
    F(o, r, n, e);
} return n; }, K = function (t, n, r, e, o) { if (n === X)
    return !0; if (null == t)
    return t === n; if (w(n) || g(J, n)) {
    var i = [];
    return I(t, n, r, i, e, o), !i.length;
} return g(RegExp, n) ? n.test(t) : n === Number || n === Date ? t.constructor === n && !isNaN(t) : t === n || m(n) && g(n, t) || t.constructor === n; }, Y = function (t, n, r) { var e = arguments.length > 3 && void 0 !== arguments[3] ? arguments[3] : n.errors, o = !0, i = !1, u = void 0; try {
    for (var c, a = function () { var o = c.value, i = void 0; try {
        i = o.call(n, t);
    }
    catch (t) {
        i = t;
    } if (!0 !== i) {
        var u = m(o.description) ? o.description : function (t, n) { return 'assertion "'.concat(o.description, '" returned ').concat(z(t), " ") + "for ".concat(r ? r + " =" : "value", " ").concat(z(n)); };
        F(e, o, t, r, u.call(n, i, t, r));
    } }, f = n.assertions[Symbol.iterator](); !(o = (c = f.next()).done); o = !0)
        a();
}
catch (t) {
    i = !0, u = t;
}
finally {
    try {
        o || null == f.return || f.return();
    }
    finally {
        if (i)
            throw u;
    }
} }, z = function t(n) { var r = arguments.length > 1 && void 0 !== arguments[1] ? arguments[1] : []; if (r.length > 15 || r.includes(n))
    return "..."; if (null == n)
    return String(n); if ("string" == typeof n)
    return '"'.concat(n, '"'); if (g(J, n))
    return n.toString(r); if (r.unshift(n), m(n))
    return n.name || n.toString(); if (g(Map, n) || g(Set, n))
    return t(l(n)); if (Array.isArray(n))
    return "[".concat(n.map(function (n) { return t(n, r); }).join(", "), "]"); if (n.toString && n.toString !== Object.prototype.toString)
    return n.toString(); if (b(n)) {
    var e = Object.keys(n), o = "\t".repeat(r.length);
    return "{".concat(e.map(function (e) { return "\n".concat(o + e, ": ").concat(t(n[e], l(r))); }).join(", "), " ").concat(e.length ? "\n".concat(o.slice(1)) : "", "}");
} return String(n); }, B = function (t, n) { return t ? t + "." + n : n; }, U = function (t, n, r, e, o, i, u) { var c = B(r, o), a = t.conventionForPrivate(o), f = t.conventionForConstant(o), s = d(e, o), l = s && Object.getOwnPropertyDescriptor(e, o); o in n && (a && !i || f && void 0 !== e[o]) && W("modify ".concat(a ? "private" : "constant", " property ").concat(o), t), u(c), d(n, o) && I(e[o], n[o], c, t.errors, []), Y(e, t, c); var h = t.errors.length; return h && (s ? Object.defineProperty(e, o, l) : delete e[o], M(t)), !h; }, W = function (t, n) { n.errors.push({ message: "cannot " + t }); }, Z = function (t) { var n = arguments.length > 1 && void 0 !== arguments[1] ? arguments[1] : []; if (!t || w(n) || g(Q, n) || C(t))
    return t; var r = N(n), e = [], o = !0, i = !1, u = void 0; try {
    for (var c, a = r[Symbol.iterator](); !(o = (c = a.next()).done); o = !0) {
        var f = c.value;
        g(J, f) && !g(Q, f) && f.test(t) && e.push(f);
    }
}
catch (t) {
    i = !0, u = t;
}
finally {
    try {
        o || null == a.return || a.return();
    }
    finally {
        if (i)
            throw u;
    }
} return 1 === e.length ? new e[0](t, E) : (e.length > 1 && console.warn("Ambiguous model for value ".concat(z(t), ", could be ").concat(e.join(" or "))), t); }, q = function (t, n, r, e, o) { return w(r) ? j(t, H(n, r, e, o)) : Z(t, r); }, H = function (t, n, r, e) { return { getPrototypeOf: function (t) { return r ? Object.prototype : y(t); }, get: function (o, i) { if (i === L)
        return o; if ("string" != typeof i)
        return Reflect.get(o, i); var u, c = B(r, i), a = n[i]; return !e && i in n && t.conventionForPrivate(i) ? (W("access to private property ".concat(c), t), void M(t)) : (o[i] && d(o, i) && !w(a) && !C(o[i]) && (o[i] = Z(o[i], a)), m(o[i]) && "constructor" !== i && !e ? (u = o[i], j(u, { apply: function (t, n, r) { e = !0; var o = Reflect.apply(t, n, r); return e = !1, o; } })) : (w(a) && !o[i] && (o[i] = {}), q(o[i], t, a, c, e))); }, set: function (o, i, u) { return U(t, n, r, o, i, e, function (r) { return Reflect.set(o, i, q(u, t, n[i], r)); }); }, deleteProperty: function (o, i) { return U(t, n, r, o, i, e, function () { return Reflect.deleteProperty(o, i); }); }, defineProperty: function (o, i, u) { return U(t, n, r, o, i, e, function () { return Reflect.defineProperty(o, i, u); }); }, has: function (r, e) { return Reflect.has(r, e) && Reflect.has(n, e) && !t.conventionForPrivate(e); }, ownKeys: function (r) { return Reflect.ownKeys(r).filter(function (r) { return Reflect.has(n, r) && !t.conventionForPrivate(r); }); }, getOwnPropertyDescriptor: function (r, e) { var o; return t.conventionForPrivate(e) || void 0 !== (o = Object.getOwnPropertyDescriptor(n, e)) && (o.value = r[e]), o; } }; }; function J(t, n) { return w(t) ? new V(t, n) : new Q(t); } function Q(t) { return _(t, Q); } function V(t) { return _(t, V, Object, k, function (n) { return H(n, t); }, !0); } Object.assign(J.prototype, (s(n = { name: "Model", assertions: [], conventionForConstant: function (t) { return t.toUpperCase() === t; }, conventionForPrivate: function (t) { return "_" === t[0]; }, toString: function (t) { return T(this.definition, t); }, as: function (t) { return S(this, "name", t), this; }, defaultTo: function (t) { return this.default = t, this; } }, A, function (t, n, r, e) { I(t, this.definition, n, r, e), Y(t, this, n, r); }), s(n, "test", function (t, n) { for (var r = this, e = this; !d(e, "errorCollector");)
    e = y(e); var o, i = e.errorCollector; return e.errorCollector = function (t) { o = !0, n && n.call(r, t); }, new this(t), e.errorCollector = i, !o; }), s(n, "errorCollector", function (t) { var n = new TypeError(t.map(function (t) { return t.message; }).join("\n")); throw n.stack = n.stack.replace(/\n.*object-model(.|\n)*object-model.*/, ""), n; }), s(n, "assert", function (t) { var n = arguments.length > 1 && void 0 !== arguments[1] ? arguments[1] : z(t); return S(t, "description", n), this.assertions = this.assertions.concat(t), this; }), n)), P(Q, J, { extend: function () { for (var t = arguments.length, n = new Array(t), r = 0; r < t; r++)
        n[r] = arguments[r]; for (var e = R(new Q(D(this.definition, n)), this), o = 0, i = n; o < i.length; o++) {
        var u, c = i[o];
        g(Q, c) && (u = e.assertions).push.apply(u, l(c.assertions));
    } return e; } }), P(V, J, s({ defaultTo: function (t) { var n = this.definition; for (var r in t)
        d(n, r) && (t[r] = I(t[r], n[r], r, this.errors, [], !0)); return M(this), this.default = t, this; }, toString: function (t) { return z(this.definition, t); }, extend: function () { for (var t = f({}, this.definition), n = f({}, this.prototype), r = f({}, this.default), e = [], o = arguments.length, i = new Array(o), u = 0; u < o; u++)
        i[u] = arguments[u]; for (var c = 0, a = i; c < a.length; c++) {
        var s = a[c];
        g(J, s) && (x(t, s.definition), x(r, s.default), e.push.apply(e, l(s.assertions))), m(s) && x(n, s.prototype), b(s) && x(t, s);
    } var h = R(new V(t), this, n).defaultTo(r); return h.assertions = [].concat(l(this.assertions), e), y(this) !== V.prototype && (h.parentClass = this), h; } }, A, function (t, n, r, e, o) { if (b(t)) {
    var i = this.definition;
    I(t[L] || t, i, n, r, e, o);
}
else
    F(r, this, t, n); Y(t, this, n, r); })); var X = j(Q(), { apply: function (t, n, r) { var e = c(r, 1)[0]; return Object.assign(Object.create(X), { definition: e }); } }); t.Any = X, X.definition = X, X.toString = function () { return "Any"; }, X.remaining = function (t) { this.definition = t; }, P(X.remaining, X, { toString: function () { return "..." + T(this.definition); } }), X[Symbol.iterator] = regeneratorRuntime.mark(function t() { return regeneratorRuntime.wrap(function (t) { for (;;)
    switch (t.prev = t.next) {
        case 0: return t.next = 2, new X.remaining(this.definition);
        case 2:
        case "end": return t.stop();
    } }, t, this); }); var $ = function (t, n, r, e, o, i, u) { return _(r, n, t, e, function (n) { return Object.assign({ getPrototypeOf: function () { return n.prototype; }, get: function (r, e) { if (e === L)
        return r; var u = r[e]; return m(u) ? j(u, { apply: function (u, a, f) { if (d(i, e)) {
            for (var s = c(i[e], 3), l = s[0], h = s[1], p = void 0 === h ? f.length - 1 : h, y = s[2], v = l; v <= p; v++) {
                var g = y ? y(v) : n.definition;
                f[v] = I(f[v], g, "".concat(t.name, ".").concat(e, " arguments[").concat(v, "]"), n.errors, [], !0);
            }
            if (n.assertions.length > 0) {
                var m = o(r);
                u.apply(m, f), Y(m, n, "after ".concat(e, " mutation"));
            }
            M(n);
        } return u.apply(r, f); } }) : u; } }, u); }); }; function tt(t) { var n = $(Array, tt, t, function (t) { return Array.isArray(t) ? t.map(function (t) { return Z(t, n.definition); }) : t; }, function (t) { return l(t); }, { copyWithin: [], fill: [0, 0], pop: [], push: [0], reverse: [], shift: [], sort: [], splice: [2], unshift: [0] }, { set: function (t, r, e) { return nt(n, t, r, e, function (t, n) { return t[r] = n; }, !0); }, deleteProperty: function (t, r) { return nt(n, t, r, void 0, function (t) { return delete t[r]; }); } }); return n; } P(tt, J, (s(r = { toString: function (t) { return "Array of " + T(this.definition, t); } }, A, function (t, n, r, e) { var o = this; Array.isArray(t) ? (t[L] || t).forEach(function (t, i) { return I(t, o.definition, "".concat(n || "Array", "[").concat(i, "]"), r, e); }) : F(r, this, t, n), Y(t, this, n, r); }), s(r, "extend", function () { for (var t = arguments.length, n = new Array(t), r = 0; r < t; r++)
    n[r] = arguments[r]; return R(new tt(D(this.definition, n)), this); }), r)); var nt = function (t, n, r, e, o, i) { var u = "Array[".concat(r, "]"); +r >= 0 && (i || r in n) && (e = I(e, t.definition, u, t.errors, [], !0)); var c = l(n); o(c), Y(c, t, u); var a = !M(t); return a && o(n, e), a; }; function rt() { for (var t = arguments.length, n = new Array(t), r = 0; r < t; r++)
    n[r] = arguments[r]; return _({ arguments: n }, rt, Function, null, function (t) { return { getPrototypeOf: function () { return t.prototype; }, get: function (t, n) { return n === L ? t : t[n]; }, apply: function (n, r, e) { for (var o, i = t.definition, u = i.arguments.find(function (t) { return g(X.remaining, t); }), c = u ? Math.max(e.length, i.arguments.length - 1) : i.arguments.length, a = 0; a < c; a++) {
        var f = u && a >= i.arguments.length - 1 ? u.definition : i.arguments[a];
        e[a] = I(e[a], f, "arguments[".concat(a, "]"), t.errors, [], !0);
    } return Y(e, t, "arguments"), t.errors.length || (o = Reflect.apply(n, r, e), "return" in i && (o = I(o, i.return, "return value", t.errors, [], !0))), M(t), o; } }; }); } function et(t, n) { var r = function (t) { return 0 === t ? e.definition.key : e.definition.value; }, e = $(Map, et, { key: t, value: n }, function (t) { return O(t) ? new Map(l(t).map(function (t) { return t.map(function (t, n) { return Z(t, r(n)); }); })) : t; }, function (t) { return new Map(t); }, { set: [0, 1, r], delete: [], clear: [] }); return e; } function ot(t) { var n = $(Set, ot, t, function (t) { return O(t) ? new Set(l(t).map(function (t) { return Z(t, n.definition); })) : t; }, function (t) { return new Set(t); }, { add: [0, 0], delete: [], clear: [] }); return n; } P(rt, J, s({ toString: function () { var t = arguments.length > 0 && void 0 !== arguments[0] ? arguments[0] : [], n = "Function(".concat(this.definition.arguments.map(function (n) { return T(n, l(t)); }).join(", "), ")"); return "return" in this.definition && (n += " => " + T(this.definition.return, t)), n; }, return: function (t) { return this.definition.return = t, this; }, extend: function (t, n) { var r = this.definition.arguments, e = t.map(function (n, e) { return D(e in r ? r[e] : [], t[e]); }), o = D(this.definition.return, n); return R(i(rt, l(e)).return(o), this); } }, A, function (t, n, r) { m(t) || F(r, "Function", t, n); })), P(et, J, (s(e = { toString: function (t) { return "Map of ".concat(T(this.definition.key, t), " : ").concat(T(this.definition.value, t)); } }, A, function (t, n, r, e) { if (g(Map, t)) {
    n = n || "Map";
    var o = !0, i = !1, u = void 0;
    try {
        for (var a, f = t[Symbol.iterator](); !(o = (a = f.next()).done); o = !0) {
            var s = c(a.value, 2), l = s[0], h = s[1];
            I(l, this.definition.key, "".concat(n, " key"), r, e), I(h, this.definition.value, "".concat(n, "[").concat(z(l), "]"), r, e);
        }
    }
    catch (t) {
        i = !0, u = t;
    }
    finally {
        try {
            o || null == f.return || f.return();
        }
        finally {
            if (i)
                throw u;
        }
    }
}
else
    F(r, this, t, n); Y(t, this, n, r); }), s(e, "extend", function (t, n) { return R(new et(D(this.definition.key, t), D(this.definition.value, n)), this); }), e)), P(ot, J, (s(o = { toString: function (t) { return "Set of " + T(this.definition, t); } }, A, function (t, n, r, e) { if (g(Set, t)) {
    var o = !0, i = !1, u = void 0;
    try {
        for (var c, a = t.values()[Symbol.iterator](); !(o = (c = a.next()).done); o = !0) {
            var f = c.value;
            I(f, this.definition, "".concat(n || "Set", " value"), r, e);
        }
    }
    catch (t) {
        i = !0, u = t;
    }
    finally {
        try {
            o || null == a.return || a.return();
        }
        finally {
            if (i)
                throw u;
        }
    }
}
else
    F(r, this, t, n); Y(t, this, n, r); }), s(o, "extend", function () { for (var t = arguments.length, n = new Array(t), r = 0; r < t; r++)
    n[r] = arguments[r]; return R(new ot(D(this.definition, n)), this); }), o)); });
//# sourceMappingURL=objectmodel.js.map