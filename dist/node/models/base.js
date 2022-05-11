"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Any = exports.SetModel = exports.MapModel = exports.FunctionModel = exports.ArrayModel = exports.ObjectModel = exports.BasicModel = exports.Model = void 0;
const objectmodel_1 = require("objectmodel");
Object.defineProperty(exports, "Model", { enumerable: true, get: function () { return objectmodel_1.Model; } });
Object.defineProperty(exports, "BasicModel", { enumerable: true, get: function () { return objectmodel_1.BasicModel; } });
Object.defineProperty(exports, "ObjectModel", { enumerable: true, get: function () { return objectmodel_1.ObjectModel; } });
Object.defineProperty(exports, "ArrayModel", { enumerable: true, get: function () { return objectmodel_1.ArrayModel; } });
Object.defineProperty(exports, "FunctionModel", { enumerable: true, get: function () { return objectmodel_1.FunctionModel; } });
Object.defineProperty(exports, "MapModel", { enumerable: true, get: function () { return objectmodel_1.MapModel; } });
Object.defineProperty(exports, "SetModel", { enumerable: true, get: function () { return objectmodel_1.SetModel; } });
Object.defineProperty(exports, "Any", { enumerable: true, get: function () { return objectmodel_1.Any; } });
exports.default = (core) => {
    return (model) => {
        return objectmodel_1.ObjectModel(model);
    };
};
//# sourceMappingURL=base.js.map