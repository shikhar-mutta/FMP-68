#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# FMP-68 — Vault Initialisation Script
# Run ONCE after vault container starts for the first time.
# Usage:  bash vault/init-vault.sh
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

VAULT_ADDR="${VAULT_ADDR:-http://localhost:8200}"
export VAULT_ADDR

echo "⏳  Waiting for Vault to be ready at ${VAULT_ADDR}..."
until curl -s "${VAULT_ADDR}/v1/sys/health" | grep -q '"initialized"'; do
  sleep 2
done

# ── 1. Initialise if not already done ────────────────────────────────────────
STATUS=$(curl -s "${VAULT_ADDR}/v1/sys/health" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('initialized', False))")
if [ "$STATUS" = "False" ]; then
  echo "🔑  Initialising Vault..."
  INIT_OUTPUT=$(vault operator init -key-shares=1 -key-threshold=1 -format=json)
  UNSEAL_KEY=$(echo "$INIT_OUTPUT" | python3 -c "import sys,json; print(json.load(sys.stdin)['unseal_keys_b64'][0])")
  ROOT_TOKEN=$(echo "$INIT_OUTPUT" | python3 -c "import sys,json; print(json.load(sys.stdin)['root_token'])")
  echo ""
  echo "⚠️  SAVE THESE — they will NOT be shown again:"
  echo "   Unseal Key : $UNSEAL_KEY"
  echo "   Root Token : $ROOT_TOKEN"
  echo "$UNSEAL_KEY" > vault/.unseal_key        # dev only — never commit
  echo "$ROOT_TOKEN" > vault/.root_token         # dev only — never commit
else
  echo "ℹ️   Vault already initialised."
  UNSEAL_KEY=$(cat vault/.unseal_key 2>/dev/null || echo "")
  ROOT_TOKEN=$(cat vault/.root_token 2>/dev/null || echo "")
fi

# ── 2. Unseal ─────────────────────────────────────────────────────────────
echo "🔓  Unsealing Vault..."
vault operator unseal "$UNSEAL_KEY"
export VAULT_TOKEN="$ROOT_TOKEN"

# ── 3. Enable KV v2 secrets engine ──────────────────────────────────────────
echo "📂  Enabling KV v2 secrets engine at 'secret/'..."
vault secrets enable -path=secret kv-v2 2>/dev/null || echo "   (already enabled)"

# ── 4. Write all application secrets ─────────────────────────────────────────
echo "✍️   Writing FMP-68 secrets..."

vault kv put secret/fmp68/auth \
  JWT_SECRET="${JWT_SECRET:-change_me_in_production_use_openssl_rand_hex_64}" \
  JWT_EXPIRES_IN="7d" \
  GOOGLE_CLIENT_ID="${GOOGLE_CLIENT_ID:-your_google_client_id}" \
  GOOGLE_CLIENT_SECRET="${GOOGLE_CLIENT_SECRET:-your_google_client_secret}" \
  GOOGLE_CALLBACK_URL="http://localhost:4000/auth/google/callback"

vault kv put secret/fmp68/database \
  MONGO_URL="mongodb://mongodb:27017/fmp68?replicaSet=rs0&directConnection=true"

vault kv put secret/fmp68/cache \
  REDIS_HOST="redis" \
  REDIS_PORT="6379"

vault kv put secret/fmp68/messaging \
  RABBITMQ_URL="amqp://fmp68:fmp68pass@rabbitmq:5672"

# ── 5. Write & apply app policy ──────────────────────────────────────────────
echo "📋  Applying app-policy..."
vault policy write fmp68-app vault/policies/app-policy.hcl

# ── 6. Create AppRole for services ───────────────────────────────────────────
echo "🔐  Creating AppRole 'fmp68-role'..."
vault auth enable approle 2>/dev/null || echo "   (already enabled)"
vault write auth/approle/role/fmp68-role \
  token_policies="fmp68-app" \
  token_ttl=1h \
  token_max_ttl=4h

ROLE_ID=$(vault read -field=role_id auth/approle/role/fmp68-role/role-id)
SECRET_ID=$(vault write -f -field=secret_id auth/approle/role/fmp68-role/secret-id)

echo ""
echo "✅  Vault setup complete!"
echo "   Role ID    : $ROLE_ID"
echo "   Secret ID  : $SECRET_ID"
echo ""
echo "   Access UI  : http://localhost:8200/ui"
echo "   Login with root token from vault/.root_token"
