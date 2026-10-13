import datetime as dt
import importlib.util
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location("idle_policy", Path(__file__).with_name("idle-policy.py"))
policy = importlib.util.module_from_spec(spec)
spec.loader.exec_module(policy)


class IdlePolicyTests(unittest.TestCase):
    now = dt.datetime(2026, 10, 11, 18, tzinfo=dt.timezone.utc)

    def runner_set(self, age):
        return {"metadata": {"annotations": {
            policy.LAST_ACTIVE: (self.now - dt.timedelta(seconds=age)).isoformat()
        }}}

    def runner(self, age, phase="Running", job_id=None):
        return {"metadata": {"creationTimestamp": (
            self.now - dt.timedelta(seconds=age)).isoformat()},
            "status": {"phase": phase, "jobId": job_id}}

    def test_retains_capacity_before_one_hour(self):
        self.assertEqual(policy.decide(self.runner_set(3599), [], self.now)[0], 16)

    def test_releases_capacity_after_one_hour(self):
        self.assertEqual(policy.decide(self.runner_set(3600), [], self.now)[0], 0)

    def test_long_running_job_prevents_scale_down(self):
        result = policy.decide(self.runner_set(7200), [self.runner(9000, job_id="busy")], self.now)
        self.assertEqual((result[0], result[2], result[3]), (16, 1, 0))

    def test_replacement_captures_short_job_between_checks(self):
        result = policy.decide(self.runner_set(3700), [self.runner(20)], self.now)
        self.assertEqual((result[0], result[3]), (16, 20))

    def test_completed_job_is_not_busy(self):
        result = policy.decide(self.runner_set(3700), [self.runner(4000, "Succeeded", "done")], self.now)
        self.assertEqual((result[0], result[2]), (0, 0))

    def test_first_run_starts_full_grace_period(self):
        result = policy.decide({"metadata": {}}, [], self.now)
        self.assertEqual((result[0], result[3]), (16, 0))

    def test_clock_rollback_does_not_release_capacity(self):
        self.assertEqual(policy.decide(self.runner_set(-100), [], self.now)[0], 16)

    def test_bad_timestamp_fails_instead_of_releasing_capacity(self):
        with self.assertRaises(ValueError):
            policy.decide({"metadata": {"annotations": {policy.LAST_ACTIVE: "invalid"}}}, [], self.now)


if __name__ == "__main__":
    unittest.main()
