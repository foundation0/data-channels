echo "Installing dependencies..."
npm install
git clone https://github.com/backbonedao/store core/store
cd core/store && npm i && cd ../..
git clone https://github.com/backbonedao/store-core core/store/core
cd core/store/core && npm i && cd ../../..
git clone https://github.com/backbonedao/rebase core/rebase
cd core/rebase && npm i && cd ../..
git clone https://github.com/backbonedao/swarm common/network/swarm
cd common/network/swarm && npm i && cd ../../..
git clone https://github.com/backbonedao/swarm-network common/network/dht
cd common/network/dht && npm i && cd ../../..
git clone https://github.com/backbonedao/kv core/kv
cd core/kv && npm i && cd ../..