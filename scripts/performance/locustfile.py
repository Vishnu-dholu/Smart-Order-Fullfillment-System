from locust import HttpUser, task, between, events, tag
import time

class SmartOrderLoadTest(HttpUser):
    # Zero wait time for maximum stress testing
    wait_time = between(0, 0)

    # ==========================================
    # SCENARIO A: Raw Framework Overhead (No DB)
    # ==========================================
    @tag('ping_test')
    @task(1)
    def test_java_ping(self):
        java_url = "http://localhost:8082/ping"
        with self.client.get(java_url, name="Scenario A: Java Ping", catch_response=True) as response:
            if response.status_code == 200:
                response.success()
            else:
                response.failure(f"Java failed with: {response.status_code}")

    @tag('ping_test')
    @task(1)
    def test_go_ping(self):
        go_url = "http://localhost:8084/health"
        with self.client.get(go_url, name="Scenario A: Go Ping", catch_response=True) as response:
            if response.status_code in [200, 201]:
                response.success()
            else:
                response.failure(f"Go failed with: {response.status_code}")

    # ==========================================
    # SCENARIO B: Database Read & JSON Serialization
    # ==========================================
    @tag('db_read_test')
    @task(1)
    def test_java_db_read(self):
        java_url = "http://localhost:8082/products"
        with self.client.get(java_url, name="Scenario B: Java DB Read", catch_response=True) as response:
            if response.status_code in [200, 201]:
                response.success()
            else:
                response.failure(f"Java failed with: {response.status_code}")

    @tag('db_read_test')
    @task(1)
    def test_go_db_read(self):
        go_url = "http://localhost:8084/warehouses"
        with self.client.get(go_url, name="Scenario B: Go DB Read", catch_response=True) as response:
            if response.status_code in [200, 201]:
                response.success()
            else:
                response.failure(f"Go failed with: {response.status_code}")

@events.quitting.add_listener
def _(environment, **kw):
    if environment.stats.total.fail_ratio > 0.01:
        print("Test failed due to high error rate")
        environment.process_exit_code = 1
