# Ansible Role-Based Deployment Architecture

This architecture provides production-grade deployment automation for Docker Compose microservices with strict environment separation, secure secret handling, idempotent execution, health validation, and rollback orchestration.

## 1) Recommended Directory Structure

```text
ansible/
  ansible.cfg
  ARCHITECTURE.md
  requirements.yml
  inventories/
    dev/hosts.yml
    stage/hosts.yml
    prod/hosts.yml
  group_vars/
    all/main.yml
    dev/main.yml
    dev/vault.yml.example
    stage/main.yml
    stage/vault.yml.example
    prod/main.yml
    prod/vault.yml.example
  playbooks/
    deploy.yml
    verify.yml
    rollback.yml
    site.yml
  roles/
    common/
      tasks/main.yml
    docker/
      tasks/main.yml
    vault_render/
      defaults/main.yml
      templates/compose.env.j2
      tasks/main.yml
    compose_deploy/
      defaults/main.yml
      handlers/main.yml
      tasks/main.yml
      templates/compose.override.yml.j2
    healthcheck/
      defaults/main.yml
      tasks/main.yml
    rollback/
      defaults/main.yml
      tasks/main.yml
```

## 2) Inventory Design

- Environment-isolated inventories in `inventories/<env>/hosts.yml`.
- Group services by runtime capabilities:
  - `compose_nodes`: deploy targets.
  - `registry_nodes`: optional local/private registry hosts.
- Keep host auth in Jenkins credentials and connection vars in inventory only.

## 3) Group Variables Structure

- `group_vars/all/main.yml`: shared non-secret defaults (timeouts, compose project name base, health endpoints).
- `group_vars/<env>/main.yml`: env-specific non-secret settings (domain, replica strategy, registry namespace/tag policy).
- `group_vars/<env>/vault.yml`: encrypted secret source of truth (generated/updated by CI).

## 4) Role Breakdown

- `common`: baseline filesystem, release directories, permissions, runtime users.
- `docker`: Docker engine and Compose plugin validation/bootstrap.
- `vault_render`: render runtime env files from decrypted vault vars with mode `0600`.
- `compose_deploy`: release orchestration (`docker compose pull/up`), symlink switch, backup metadata.
- `healthcheck`: endpoint and container-state checks with retries.
- `rollback`: restore last-known-good release and restart stack.

## 5) Playbook Design

- `site.yml`: orchestration entrypoint; imports deploy/verify flow.
- `deploy.yml`: common -> docker -> vault_render -> compose_deploy.
- `verify.yml`: healthcheck role only; callable independently by Jenkins.
- `rollback.yml`: rollback role, then healthcheck for rollback verification.

## 6) Example Task Strategy

- Use `ansible.builtin.file`, `template`, `copy`, `stat`, `set_fact`, `uri`, `command`.
- Avoid shell unless command module is the only viable option.
- All changed files are deterministic and idempotent.

## 7) Vault Integration Strategy

- Jenkins injects secret values from Jenkins Credentials.
- Pipeline writes transient `group_vars/<env>/vault.yml`, encrypts with `ansible-vault`.
- Playbooks decrypt at runtime using vault password file credential.
- CI removes plaintext vault files in `finally` blocks.

## 8) Health-Check Implementation

- HTTP checks: gateway and service health endpoints with retries and failure budget.
- Runtime checks: `docker compose ps` filtered for unhealthy/exited states.
- Verification is a first-class pipeline gate before success.

## 9) Rollback Strategy

- Keep release folders under `/opt/smart-order/releases/<release-id>`.
- Maintain `current` and `previous` symlinks.
- On failed deploy:
  1. Stop current compose stack.
  2. Switch `current` -> `previous`.
  3. Re-run compose up.
  4. Execute health checks.
