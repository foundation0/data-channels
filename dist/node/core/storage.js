"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const platform_detect_1 = __importDefault(require("platform-detect"));
const random_access_memory_1 = __importDefault(require("random-access-memory"));
const random_access_idb_1 = __importDefault(require("random-access-idb"));
const common_1 = require("../common");
function getStorage(config) {
    if (!config)
        throw new Error('GETSTORAGE REQUIRES CORECONFIG');
    let storage;
    if (config?.storage === 'ram') {
        common_1.log('RAM storage requested, using memory for storage');
        storage = random_access_memory_1.default;
    }
    else if (config?.env === 'node' || platform_detect_1.default?.node) {
        common_1.log('Node runtime detected, using file system for storage');
        const prefix = config?.storage_prefix ? `${config?.storage_prefix}/` : '';
        if (prefix)
            common_1.log(`Using storage prefix: ${prefix}`);
        const pathname = config.address.match(/.{1,2}/g)?.join('/');
        storage = `${common_1.getHomedir()}/${prefix}${pathname}`;
    }
    else {
        common_1.log('Browser runtime detected, using RAI for storage');
        storage = random_access_idb_1.default(config.address);
    }
    const storage_id = config?.storage_prefix
        ? config.address + config.storage_prefix
        : config.address;
    return { storage, storage_id };
}
exports.default = getStorage;
//# sourceMappingURL=storage.js.map