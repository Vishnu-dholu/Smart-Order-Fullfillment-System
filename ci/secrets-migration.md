# Secrets Migration Guide (Jenkins + Ansible Vault + Docker Compose + Kubernetes)

## Required Jenkins Credentials

Create these Jenkins credentials (kind: `Secret text` unless noted):

- `JWT_SECRET`
- `INTERNAL_SERVICE_TOKEN`
- `GOOGLE_CLIENT_ID`
- `AUTH_DB_URL`
- `ORDER_DB_URL`
- `INVENTORY_DB_URL`
- `WAREHOUSE_DB_URL`
- `DELIVERY_DB_URL`
- `NOTIFICATION_DB_URL`
- `SMTP_EMAIL`
- `SMTP_PASSWORD`
- `ANSIBLE_VAULT_PASSWORD_FILE` (kind: `Secret file`)

## Jenkins -> Ansible -> Docker Compose Flow

1. Jenkins loads credentials with `withCredentials`.
2. Jenkins writes a temporary `ansible/group_vars/<env>/vault.yml` in the workspace.
3. Jenkins encrypts the file using `ansible-vault encrypt --vault-password-file "$ANSIBLE_VAULT_PASSWORD_FILE"`.
4. Jenkins runs `ansible-playbook ansible/playbooks/deploy-compose.yml -e target_env=<env> --vault-password-file "$ANSIBLE_VAULT_PASSWORD_FILE"`.
5. Ansible decrypts vault vars in-memory and renders:
   - `<compose_project_dir>/.env`
   - `services/go/warehouse-service/.env`
   - `services/go/delivery-service/.env`
   - `services/go/notification-service/.env`
6. Docker Compose starts containers with rendered env files.

## Kubernetes Secret Feed

- Keep `k8s/kustomization.yaml` `secretGenerator` approach for dev only.
- For stage/prod, prefer applying secret manifests generated in CI:
  - `kubectl create secret generic smart-order-secrets --from-literal=... --dry-run=client -o yaml | kubectl apply -f -`
- Never commit decrypted `.env` or plain secret YAML to git.

## Migration Checklist

1. Rotate all currently exposed credentials and tokens.
2. Remove hardcoded defaults from service config (`JWT_SECRET`, DB users/passwords, internal token fallback).
3. Replace Jenkins `.env` echo logic with playbook invocation.
4. Add CI checks to fail if secret placeholders or hardcoded token patterns are detected.
5. Promote with separate vault files per environment (`dev`, `stage`, `prod`).
