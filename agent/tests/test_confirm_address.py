import os, sys, unittest
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
import browser_agent as ba

DOM = "a" * 63 + "b"
BAD = "a" * 64

class ConfirmAddress(unittest.TestCase):
    def run_it(self, first, reads):
        it = iter(reads); calls = []
        out = ba.confirm_address(DOM, first, lambda n: (calls.append(n), next(it))[1], extra=2, sleep=lambda s: None)
        return out, calls

    def test_exact_first_try_no_reread(self):
        self.assertEqual(self.run_it(DOM, []), (DOM, []))

    def test_recovers_on_reread(self):
        self.assertEqual(self.run_it(BAD, [DOM]), (DOM, [1]))

    def test_all_mismatch_never_returns_dom(self):
        out, calls = self.run_it(BAD, [BAD, ""])
        self.assertNotEqual(out, DOM); self.assertEqual(calls, [1, 2])

if __name__ == "__main__": unittest.main()
