"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const common_1 = require("../../common");
class WhitelistClass {
    constructor() {
        this.whitelisted_ids = new Set();
        this.firewall = this.firewall.bind(this);
        this.add = this.add.bind(this);
        this.remove = this.remove.bind(this);
    }
    firewall(connection_id) {
        const fail = !this.whitelisted_ids.has(connection_id.toString('hex'));
        common_1.emit({
            ch: 'network',
            msg: `connection from ${connection_id.toString('hex')} - ${fail ? 'block' : 'pass'}`,
            verbose: true,
        });
        if (fail)
            common_1.emit({
                ch: 'network',
                msg: `firewall blocked connection from ${connection_id.toString('hex')}`,
            });
        return fail;
    }
    add(connection_id) {
        this.whitelisted_ids.add(connection_id);
        common_1.emit({ ch: 'network', msg: `whitelisted connections from ${connection_id}`, verbose: true });
    }
    remove(connection_id) {
        this.whitelisted_ids.delete(connection_id);
        common_1.emit({ ch: 'network', msg: `removed ${connection_id} from whitelist`, verbose: true });
    }
}
exports.default = async () => {
    const W = new WhitelistClass();
    const API = common_1.registerMethods({
        source: W,
        methods: [
            'firewall', 'add', 'remove'
        ],
    });
    return API;
};
//# sourceMappingURL=whitelist.js.map