"""Real-stack tests for the dashboard auth proxy.

Unlike tests/test_runtime_validation.py, which loads authproxy.py against
stand-in modules, these tests drive the actual FastAPI/Starlette application
through fastapi.testclient with a real HTTP upstream. They are skipped when the
pinned dependencies from tests/requirements-auth.txt are not installed.
"""

import importlib.util
import json
import os
import sys
import tempfile
import threading
import unittest
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from unittest import mock

ROOT = Path(__file__).resolve().parents[1]
AUTHPROXY_PATH = ROOT / "containers" / "auth" / "authproxy.py"

try:
    import fastapi  # noqa: F401
    import httpx  # noqa: F401
    import itsdangerous  # noqa: F401
    import ldap3  # noqa: F401
    from fastapi.testclient import TestClient

    HAVE_REAL_STACK = True
except ImportError:  # pragma: no cover - exercised only without the deps
    HAVE_REAL_STACK = False


class EchoUpstreamHandler(BaseHTTPRequestHandler):
    """Upstream stand-in: echoes method, path and request headers as JSON."""

    def _respond(self):
        payload = {
            "method": self.command,
            "path": self.path,
            "headers": {key.lower(): value for key, value in self.headers.items()},
        }
        body = json.dumps(payload).encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Set-Cookie", "upstream=1; Path=/")
        self.end_headers()
        self.wfile.write(body)

    do_GET = _respond
    do_POST = _respond

    def log_message(self, *args):  # keep test output quiet
        del args


@unittest.skipUnless(HAVE_REAL_STACK, "install tests/requirements-auth.txt to run real-stack auth proxy tests")
class AuthProxyHttpTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.upstream = ThreadingHTTPServer(("127.0.0.1", 0), EchoUpstreamHandler)
        cls.upstream_thread = threading.Thread(target=cls.upstream.serve_forever, daemon=True)
        cls.upstream_thread.start()
        cls.upstream_url = f"http://127.0.0.1:{cls.upstream.server_address[1]}"

        cls.temp_dir = tempfile.TemporaryDirectory()
        cls.registry_path = Path(cls.temp_dir.name) / "authproxy_agents.json"
        cls.registry_path.write_text(
            json.dumps(
                {
                    "agents": [
                        {"id": 1, "name": "Agent One", "allowed_user": "alice", "status": "start", "upstream_url": cls.upstream_url},
                        {"id": 2, "name": "Agent Two", "allowed_user": "bob", "status": "stop", "upstream_url": cls.upstream_url},
                        {"id": 3, "name": "Agent Three", "allowed_user": "carol", "status": "start", "upstream_url": "http://127.0.0.1:9"},
                    ]
                }
            ),
            encoding="utf-8",
        )

        cls.env_patch = mock.patch.dict(
            os.environ,
            {
                "USER_DOMAIN": "example.org",
                "LDAP_HOST": "127.0.0.1",
                "LDAP_PORT": "389",
                "LDAP_BASE_DN": "dc=example,dc=org",
                "LDAP_SCHEMA": "rfc2307",
                "HERMES_AUTH_SESSION_SECRET": "unit-test-secret",
                "AUTH_PROXY_AGENT_REGISTRY": str(cls.registry_path),
            },
        )
        cls.env_patch.start()

        module_name = "authproxy_real_stack"
        sys.modules.pop(module_name, None)
        spec = importlib.util.spec_from_file_location(module_name, AUTHPROXY_PATH)
        cls.authproxy = importlib.util.module_from_spec(spec)
        sys.modules[module_name] = cls.authproxy
        spec.loader.exec_module(cls.authproxy)

    @classmethod
    def tearDownClass(cls):
        cls.env_patch.stop()
        cls.upstream.shutdown()
        cls.upstream.server_close()
        cls.temp_dir.cleanup()
        sys.modules.pop("authproxy_real_stack", None)

    def setUp(self):
        self.authproxy.LOGIN_THROTTLE = self.authproxy.LoginThrottle()

    def client(self):
        # https base URL: the login cookie carries the Secure flag behind Traefik
        # and httpx's cookie jar would otherwise refuse to send it back.
        return TestClient(self.authproxy.app, base_url="https://agents.example.org")

    def login(self, client, username="alice", password="secret", authenticated=True, next_path="/", **headers):
        with mock.patch.object(self.authproxy, "authenticate_credentials", return_value=authenticated):
            return client.post(
                "/login",
                data={"username": username, "password": password, "next": next_path},
                headers={"x-forwarded-proto": "https", **headers},
                follow_redirects=False,
            )

    def test_anonymous_get_renders_login_form(self):
        with self.client() as client:
            response = client.get("/")
        self.assertEqual(response.status_code, 200)
        self.assertIn('<form method="post" action="/login">', response.text)
        self.assertEqual(response.headers["cache-control"], "no-store")

    def test_anonymous_non_get_is_401(self):
        with self.client() as client:
            response = client.post("/api/chat", json={"x": 1})
        self.assertEqual(response.status_code, 401)

    def test_health_does_not_require_session(self):
        with self.client() as client:
            response = client.get("/health")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["status"], "ok")

    def test_login_sets_hardened_session_cookie_and_redirects(self):
        with self.client() as client:
            response = self.login(client, next_path="/chat?x=1")
        self.assertEqual(response.status_code, 303)
        self.assertEqual(response.headers["location"], "/chat?x=1")
        cookie = response.headers["set-cookie"]
        self.assertIn("hermes_dashboard_session=", cookie)
        self.assertIn("HttpOnly", cookie)
        self.assertIn("SameSite=lax", cookie)
        self.assertIn("Secure", cookie)
        self.assertIn("Path=/", cookie)

    def test_login_over_plain_http_omits_secure_flag(self):
        with self.client() as client:
            with mock.patch.object(self.authproxy, "authenticate_credentials", return_value=True):
                response = client.post(
                    "/login",
                    data={"username": "alice", "password": "secret", "next": "/"},
                    follow_redirects=False,
                )
        self.assertNotIn("Secure", response.headers["set-cookie"])

    def test_wrong_password_is_401_and_keeps_username(self):
        with self.client() as client:
            response = self.login(client, authenticated=False)
        self.assertEqual(response.status_code, 401)
        self.assertIn('value="alice"', response.text)
        self.assertNotIn("set-cookie", response.headers)

    def test_stopped_agent_user_cannot_log_in(self):
        with self.client() as client:
            response = self.login(client, username="bob")
        self.assertEqual(response.status_code, 401)

    def test_login_redirect_target_is_sanitised(self):
        for candidate in ("//evil.example/", "/\\evil.example", "https://evil.example/", "/login"):
            with self.subTest(candidate=candidate), self.client() as client:
                response = self.login(client, next_path=candidate)
                self.assertEqual(response.status_code, 303)
                self.assertEqual(response.headers["location"], "/")

    def test_session_proxies_to_assigned_agent_with_identity_header(self):
        with self.client() as client:
            self.login(client)
            client.cookies.set("unrelated", "keep-me")
            response = client.get("/api/status?x=1", headers={"X-Hermes-Authenticated-User": "spoofed", "Authorization": "Bearer t"})

        self.assertEqual(response.status_code, 200)
        echoed = response.json()
        self.assertEqual(echoed["path"], "/api/status?x=1")
        self.assertEqual(echoed["headers"]["x-hermes-authenticated-user"], "alice")
        self.assertEqual(echoed["headers"]["authorization"], "Bearer t")
        self.assertEqual(echoed["headers"]["host"], "127.0.0.1:9120")
        self.assertEqual(echoed["headers"]["x-forwarded-host"], "agents.example.org")
        self.assertIn("unrelated=keep-me", echoed["headers"].get("cookie", ""))
        self.assertNotIn("hermes_dashboard_session", echoed["headers"].get("cookie", ""))
        # Upstream Set-Cookie passes through to the browser.
        self.assertIn("upstream=1", response.headers.get("set-cookie", ""))

    def test_auth_me_returns_identity_from_session(self):
        with self.client() as client:
            self.login(client)
            response = client.get("/api/auth/me")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"user_id": "alice", "display_name": "alice"})

    def test_tampered_and_expired_sessions_are_rejected(self):
        with self.client() as client:
            self.login(client)
            good_cookie = client.cookies.get("hermes_dashboard_session")

            client.cookies.set("hermes_dashboard_session", good_cookie[:-3] + "xyz")
            self.assertEqual(client.get("/api/auth/me").status_code, 401)

            client.cookies.set("hermes_dashboard_session", good_cookie)
            with mock.patch.object(self.authproxy, "SESSION_TTL_SECONDS", -1):
                self.assertEqual(client.get("/api/auth/me").status_code, 401)

            self.assertEqual(client.get("/api/auth/me").status_code, 200)

    def test_session_secret_rotation_invalidates_sessions(self):
        with self.client() as client:
            self.login(client)
            with mock.patch.dict(os.environ, {"HERMES_AUTH_SESSION_SECRET": "rotated"}):
                self.assertEqual(client.get("/api/auth/me").status_code, 401)

    def test_agent_status_page_for_other_agent_does_not_proxy(self):
        with self.client() as client:
            self.login(client)
            response = client.get("/hermes-3/")
        self.assertEqual(response.status_code, 200)
        self.assertIn("Signed in to Agent One", response.text)
        self.assertIn("this page only manages that session", response.text)

    def test_logout_clears_cookie_and_redirects_same_origin(self):
        with self.client() as client:
            self.login(client)
            response = client.post("/logout", data={"return_to": "//evil.example"}, follow_redirects=False)
            self.assertEqual(response.status_code, 303)
            self.assertEqual(response.headers["location"], "/")
            self.assertIn('hermes_dashboard_session=""', response.headers["set-cookie"])

    def test_unreachable_upstream_is_502(self):
        with self.client() as client:
            self.login(client, username="carol")
            response = client.get("/")
        self.assertEqual(response.status_code, 502)

    def test_login_throttle_returns_429_with_retry_after(self):
        self.authproxy.LOGIN_THROTTLE = self.authproxy.LoginThrottle(max_failures=2, window_seconds=60)
        with self.client() as client:
            self.login(client, authenticated=False)
            self.login(client, authenticated=False)
            response = self.login(client, authenticated=True)
        self.assertEqual(response.status_code, 429)
        self.assertTrue(response.headers["retry-after"].isdigit())

    def test_ldap_outage_is_503(self):
        with self.client() as client:
            with mock.patch.object(
                self.authproxy, "authenticate_credentials", side_effect=self.authproxy.LDAPException("down")
            ):
                response = client.post("/login", data={"username": "alice", "password": "x", "next": "/"})
        self.assertEqual(response.status_code, 503)

    def test_websocket_without_session_is_closed_with_4401(self):
        from starlette.websockets import WebSocketDisconnect

        with self.client() as client:
            with self.assertRaises(WebSocketDisconnect) as raised:
                with client.websocket_connect("/api/pty"):
                    pass
        self.assertEqual(raised.exception.code, 4401)

    def test_unconfigured_proxy_returns_503_page(self):
        with mock.patch.dict(os.environ, {"USER_DOMAIN": ""}), self.client() as client:
            response = client.get("/")
        self.assertEqual(response.status_code, 503)
        self.assertIn("Dashboard access is not configured", response.text)


if __name__ == "__main__":
    unittest.main()
