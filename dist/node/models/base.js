"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Any = exports.SetModel = exports.MapModel = exports.FunctionModel = exports.ArrayModel = exports.ObjectModel = exports.BasicModel = exports.Model = void 0;
const { Model, BasicModel, ObjectModel, ArrayModel, FunctionModel, MapModel, SetModel, Any } = require('./objectmodel');
exports.Model = Model;
exports.BasicModel = BasicModel;
exports.ObjectModel = ObjectModel;
exports.ArrayModel = ArrayModel;
exports.FunctionModel = FunctionModel;
exports.MapModel = MapModel;
exports.SetModel = SetModel;
exports.Any = Any;
exports.default = (core) => {
    return (model) => {
        return ObjectModel(model);
    };
};
//# sourceMappingURL=base.js.map