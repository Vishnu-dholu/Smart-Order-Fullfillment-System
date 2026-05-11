# Jenkins Integration Contract

Use this contract from Jenkins Declarative Pipeline stages:

## Required Jenkins Credentials

- `ANSIBLE_VAULT_PASSWORD_FILE` (Secret file)
- `ANSIBLE_SSH_KEY` (SSH Username with private key)
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

## Deploy Invocation

```bash
ansible-playbook -i ansible/inventories/${DEPLOY_ENV}/hosts.yml \
  ansible/playbooks/deploy.yml \
  -e target_env=${DEPLOY_ENV} \
  -e image_tag=${IMAGE_TAG} \
  --vault-password-file "$VAULT_FILE" \
  --private-key "$ANSIBLE_KEY" -u "$ANSIBLE_USER"
```

## Verify Invocation

```bash
ansible-playbook -i ansible/inventories/${DEPLOY_ENV}/hosts.yml \
  ansible/playbooks/verify.yml \
  -e target_env=${DEPLOY_ENV} \
  --private-key "$ANSIBLE_KEY" -u "$ANSIBLE_USER"
```

## Rollback Invocation

```bash
ansible-playbook -i ansible/inventories/${DEPLOY_ENV}/hosts.yml \
  ansible/playbooks/rollback.yml \
  -e target_env=${DEPLOY_ENV} \
  --private-key "$ANSIBLE_KEY" -u "$ANSIBLE_USER"
```
