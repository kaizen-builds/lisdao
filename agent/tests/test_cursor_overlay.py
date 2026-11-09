import os, subprocess, sys, unittest
HERE = os.path.join(os.path.dirname(__file__), "..")

def flag(env):
    code = "import browser_agent as b; print(b.CURSOR_OVERLAY)"
    e = {k: v for k, v in os.environ.items() if k not in ("RECORD", "HEADLESS", "CURSOR_OVERLAY")} | env
    return subprocess.run([sys.executable, "-c", code], cwd=HERE, env=e, capture_output=True, text=True).stdout.strip().splitlines()[-1]

class CursorOverlayFlag(unittest.TestCase):
    def test_default_on(self): self.assertEqual(flag({}), "True")
    def test_on_when_recording(self): self.assertEqual(flag({"RECORD": "1"}), "True")
    def test_on_when_headed(self): self.assertEqual(flag({"HEADLESS": "0"}), "True")
    def test_explicit_off(self): self.assertEqual(flag({"RECORD": "1", "CURSOR_OVERLAY": "0"}), "False")

if __name__ == "__main__": unittest.main()
