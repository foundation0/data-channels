echo "Pulling dependencies..."
cd core/store && git pull hyper master && cd ../..
cd core/store/core && git pull hyper master && cd ../../..
cd core/rebase && git pull hyper master && cd ../..
cd common/network/swarm && git pull hyper master && cd ../../..
cd core/kv && git pull hyper master && cd ../..