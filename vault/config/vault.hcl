## FMP-68 — HashiCorp Vault Server Configuration
## Storage: file-based (simple, no external deps)

storage "file" {
  path = "/vault/data"
}

listener "tcp" {
  address     = "0.0.0.0:8200"
  # TLS disabled for dev/demo — set tls_cert_file + tls_key_file to enable
  tls_disable = 1
}

## UI enables the web dashboard at http://localhost:8200/ui
ui = true

## Allow disabling mlock for Docker environments
disable_mlock = true

## API address (used by clients connecting to this vault)
api_addr = "http://0.0.0.0:8200"

## Cluster address (used for HA, not needed for single-node)
cluster_addr = "http://0.0.0.0:8201"

## Log level
log_level = "info"
