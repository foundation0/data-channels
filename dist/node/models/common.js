"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PromiseOf = exports.ArrayDense = exports.ArrayUnique = exports.ArrayNotEmpty = exports.FutureDate = exports.PastDate = exports.TrimmedString = exports.NormalizedString = exports.StringNotBlank = exports.NegativeInteger = exports.PositiveInteger = exports.NegativeNumber = exports.PositiveNumber = exports.FiniteNumber = exports.SafeInteger = exports.Integer = exports.Truthy = exports.Falsy = exports.Primitive = void 0;
const objectmodel_1 = __importDefault(require("objectmodel"));
const { BasicModel } = objectmodel_1.default;
exports.Primitive = BasicModel([Boolean, Number, String, Symbol]).as("Primitive");
exports.Falsy = BasicModel([exports.Primitive, null, undefined]).assert(function isFalsy(x) { return !x; }).as("Falsy");
exports.Truthy = BasicModel([exports.Primitive, Object]).assert(function isTruthy(x) { return !!x; }).as("Truthy");
exports.Integer = BasicModel(Number).assert(Number.isInteger).as("Integer");
exports.SafeInteger = BasicModel(Number).assert(Number.isSafeInteger).as("SafeInteger");
exports.FiniteNumber = BasicModel(Number).assert(Number.isFinite).as("FiniteNumber");
exports.PositiveNumber = BasicModel(Number).assert(function isPositive(n) { return n >= 0; }).as("PositiveNumber");
exports.NegativeNumber = BasicModel(Number).assert(function isNegative(n) { return n <= 0; }).as("NegativeNumber");
exports.PositiveInteger = exports.PositiveNumber.extend().assert(Number.isInteger).as("PositiveInteger");
exports.NegativeInteger = exports.NegativeNumber.extend().assert(Number.isInteger).as("NegativeInteger");
exports.StringNotBlank = BasicModel(String).assert(function isNotBlank(str) { return str.trim().length > 0; }).as("StringNotBlank");
exports.NormalizedString = BasicModel(String).assert(function isNormalized(str) { return str.normalize() === str; }).as("NormalizedString");
exports.TrimmedString = BasicModel(String).assert(function isTrimmed(str) { return str.trim() === str; }).as("TrimmedString");
exports.PastDate = BasicModel(Date).assert(function isInThePast(date) { return date.getTime() < Date.now(); }).as("PastDate");
exports.FutureDate = BasicModel(Date).assert(function isInTheFuture(date) { return date.getTime() > Date.now(); }).as("FutureDate");
exports.ArrayNotEmpty = BasicModel(Array).assert(function isNotEmpty(arr) { return arr.length > 0; }).as("ArrayNotEmpty");
exports.ArrayUnique = BasicModel(Array).assert(function hasNoDuplicates(arr) { return arr.every((x, i) => arr.indexOf(x) === i); }).as("ArrayUnique");
exports.ArrayDense = BasicModel(Array).assert(function hasNoHoles(arr) { return arr.filter(() => true).length === arr.length; }).as("ArrayDense");
exports.PromiseOf = model => p => BasicModel(Promise)(p).then(x => model(x));
//# sourceMappingURL=common.js.map