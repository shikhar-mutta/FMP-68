#!/bin/bash
# MongoDB Replica Set Initialization Script
# Waits for mongo to be ready, then initiates rs0

echo "⏳ Waiting for MongoDB to start..."
sleep 5

until mongosh --host mongodb:27017 --eval "print('MongoDB ready')" &>/dev/null; do
  echo "MongoDB not ready yet, retrying..."
  sleep 2
done

echo "🔧 Initiating replica set rs0..."
mongosh --host mongodb:27017 <<EOF
try {
  rs.status();
  print("Replica set already initiated");
} catch(e) {
  rs.initiate({
    _id: "rs0",
    members: [{ _id: 0, host: "mongodb:27017" }]
  });
  print("Replica set initiated successfully");
}
EOF
echo "✅ MongoDB replica set rs0 ready"
