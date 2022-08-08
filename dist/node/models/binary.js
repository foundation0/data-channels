"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const { BasicModel, Any } = require('./objectmodel');
const b4a = require('b4a');
exports.default = BasicModel(Any).assert(data => b4a.isBuffer(data));
//# sourceMappingURL=binary.js.map