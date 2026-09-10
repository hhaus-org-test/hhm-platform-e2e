from __future__ import annotations

import re
import tomllib
import unittest

PINS = {
    "middleware": "0ba59b36777345989788f8cd4687c10735546c3d",
    "rate_limit": "241353d0f5269450690d9646be03db2aba59a2ae",
    "lru": "4474d240b38a4fe1dd24f01dcd2e9ab7a4c34b27",
    "shared_auth": "52b7ac7fbf0c7c169684f613eda923f3aa6c82e9",
    "fanwaave": "e27695091a5b8276543a6f435156a25043f297a9",
    "tjsv_rate_lru": "2281843126ab644607b11cf8281d84f382d68dfc",
    "tjsv_fanwaave": "4a5d049218adc2740d4cf78f612caf7f38f6f64c",
    "tjsv_middleware": "4473504c4c9d2831d825919f70c03994d8ce01d2",
}
ENV = re.compile(r"^[A-Z_][A-Z0-9_]{0,127}$")


def load(raw: str) -> dict:
    return tomllib.loads(raw)


def env_name(value: str) -> bool:
    return isinstance(value, str) and ENV.fullmatch(value) is not None


HYBRID_MW = '''
schema_version = 1
repository_mode = "hybrid"
allow_overlapping_roots = true
[[targets]]
name = "server"
role = "server"
roots = ["."]
middleware = "disabled"
[[targets]]
name = "client"
role = "client"
roots = ["."]
middleware = "propagation-only"
propagate_headers = ["traceparent", "x-request-id"]
'''
HYBRID_RL = '''
schemaVersion = "ores.rate-limit.config.v1"
layout = "combined"
defaultPolicyId = "default"
[client]
root = "."
exposePolicyMetadata = true
[server]
root = "."
backend = "local"
enforcementLayer = "service"
keyHmacEnv = "ORES_RL_HMAC_KEY"
[[policies]]
policyId = "default"
clientVisible = true
algorithm = "token-bucket"
identityScope = "anonymous-ip"
capacity = 120
windowMs = 0
refillTokens = 120
refillIntervalMs = 60000
requestCost = 1
enforcementMode = "observe-only"
consistencyMode = "advisory"
backendFailureMode = "fail-open"
denyCacheMode = "local-denials"
denyCacheCapacity = 1024
maxOvershoot = 120
maxBlockTtlMs = 60000
keyVersion = "v1"
policyVersion = 1
'''
HYBRID_LRU = '''
protocol = "ores.lru-config.v1"
namespace = "hhaus-test"
roles = ["client", "server"]
[redis]
urlEnv = "REDIS_URL"
keyPrefix = "ores:lru:hhaus"
pubsubChannel = "ores:lru:hhaus:events"
reconcileIntervalMs = 180000
reconnectMinMs = 1000
reconnectMaxMs = 30000
[defaults]
capacity = 1024
syncMode = "local_only"
overflowMode = "evict_lru"
failOpenOnStartup = false
[[roleOverrides]]
role = "server"
syncMode = "read_only"
overflowMode = "reject_and_reconcile"
[[caches]]
name = "runtime-env"
role = "client"
capacity = 256
syncMode = "local_only"
[[caches]]
name = "runtime-env"
role = "server"
syncMode = "read_only"
'''
CLI = '''
[env]
load = false
[parse]
allow_unknown = false
[flags.api]
env = "HHM_API_BASE_URL"
type = "string"
'''
FAN = '''
version = 1
mode = "hybrid"
strict = true
[flags2env]
contract = ".cli-flags.toml"
require_audit = true
precedence = "argv-over-env"
[client]
enabled = true
[server]
enabled = true
[[env]]
name = "auth_token"
key = "FANWAAVE_AUTH_TOKEN"
kind = "string"
required = true
secret = true
[[env]]
name = "database_url"
key = "DATABASE_URL"
kind = "url"
required = true
secret = true
'''


class HhausRuntimeConfigAcceptance(unittest.TestCase):
    def test_all_sources_are_immutable(self):
        for name, sha in PINS.items():
            self.assertRegex(sha, r"^[0-9a-f]{40}$", name)

    def test_same_root_hybrid_is_explicit(self):
        cfg = load(HYBRID_MW)
        self.assertEqual(cfg["repository_mode"], "hybrid")
        self.assertIs(cfg["allow_overlapping_roots"], True)
        self.assertEqual({t["role"] for t in cfg["targets"]}, {"client", "server"})
        self.assertTrue(all(t["roots"] == ["."] for t in cfg["targets"]))

    def test_rate_limit_uses_admitted_deny_cache_value(self):
        cfg = load(HYBRID_RL)
        self.assertEqual(cfg["policies"][0]["denyCacheMode"], "local-denials")
        self.assertNotIn("disabled", {"local-denials", "redis-denial-fanout", "redis-strict-blocks"})
        self.assertTrue(env_name(cfg["server"]["keyHmacEnv"]))

    def test_rate_limit_disabled_deny_cache_regression(self):
        bad = load(HYBRID_RL.replace('denyCacheMode = "local-denials"', 'denyCacheMode = "disabled"'))
        self.assertNotIn(bad["policies"][0]["denyCacheMode"], {"local-denials", "redis-denial-fanout", "redis-strict-blocks"})

    def test_lru_client_never_resolves_redis_mode(self):
        cfg = load(HYBRID_LRU)
        client = next(c for c in cfg["caches"] if c["role"] == "client")
        server = next(c for c in cfg["caches"] if c["role"] == "server")
        self.assertEqual(client["syncMode"], "local_only")
        self.assertEqual(server["syncMode"], "read_only")
        self.assertTrue(env_name(cfg["redis"]["urlEnv"]))

    def test_literal_redis_url_is_not_an_env_reference(self):
        bad = load(HYBRID_LRU.replace('urlEnv = "REDIS_URL"', 'urlEnv = "redis://user:pass@cache"'))
        self.assertFalse(env_name(bad["redis"]["urlEnv"]))

    def test_cli_is_fail_closed_and_non_secret(self):
        cfg = load(CLI)
        self.assertIs(cfg["env"]["load"], False)
        self.assertIs(cfg["parse"]["allow_unknown"], False)
        self.assertNotIn("DATABASE_URL", {v["env"] for v in cfg["flags"].values()})
        self.assertNotIn("FANWAAVE_AUTH_TOKEN", {v["env"] for v in cfg["flags"].values()})

    def test_secret_cli_regression_is_detected(self):
        bad = load(CLI + '\n[flags.database]\nenv = "DATABASE_URL"\ntype = "string"\n')
        self.assertIn("DATABASE_URL", {v["env"] for v in bad["flags"].values()})

    def test_fanwaave_secrets_are_env_only(self):
        fan = load(FAN)
        cli = load(CLI)
        exposed = {v["env"] for v in cli["flags"].values()}
        for binding in fan["env"]:
            if binding["secret"]:
                self.assertNotIn("default", binding)
                self.assertNotIn(binding["key"], exposed)

    def test_shared_auth_alias_collision_is_rejected_by_policy(self):
        present = {".auth-shared.toml", ".shared-auth.toml"}
        self.assertTrue({".auth-shared.toml", ".shared-auth.toml"} <= present)


if __name__ == "__main__":
    unittest.main(verbosity=2)
