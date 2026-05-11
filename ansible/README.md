# Ansible Secret Management Structure

This directory is the secure handoff layer between Jenkins credentials and runtime environment files.

## Layout

- `inventory/` - per-environment host groups.
- `group_vars/<env>/vault.yml` - encrypted secret files (commit encrypted only).
- `group_vars/<env>/main.yml` - non-secret environment metadata.
- `templates/` - Jinja templates to render runtime env files.
- `playbooks/deploy-compose.yml` - decrypt + render + deploy flow for Docker Compose.

## Bootstrap

1. Create vault files:
   - `ansible-vault create group_vars/dev/vault.yml`
   - `ansible-vault create group_vars/stage/vault.yml`
   - `ansible-vault create group_vars/prod/vault.yml`
2. Store vault password outside git (for local: `ansible/.vault_pass`, in CI: Jenkins Secret file).
3. Run playbook:
   - `ansible-playbook -i inventory/dev.ini playbooks/deploy-compose.yml --vault-password-file .vault_pass`
