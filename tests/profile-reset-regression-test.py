import importlib.util
import json
import subprocess
import tempfile
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location("jsc_server", ROOT / "server.py")
SERVER = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(SERVER)


class FakeHandler:
    _jl_reset_profile = SERVER.AppHandler._jl_reset_profile
    _load_jl_local_profile = SERVER.AppHandler._load_jl_local_profile
    _parse_simple_yaml = SERVER.AppHandler._parse_simple_yaml
    _parse_simple_yaml_value = SERVER.AppHandler._parse_simple_yaml_value
    _try_save_jl_drive_profile = SERVER.AppHandler._try_save_jl_drive_profile

    def __init__(self):
        self.response = None

    def _json(self, data, status=200):
        self.response = {"status": status, "data": data}

    def _drive_service_payload(self):
        return {}


with tempfile.TemporaryDirectory() as temp_dir:
    repo = Path(temp_dir)
    config_dir = repo / "config"
    config_dir.mkdir()
    profile_path = config_dir / "candidate_profile.yaml"
    committed = 'name: "Corinne"\ntarget_titles:\n  - "Data Analyst"\n'
    profile_path.write_text(committed, encoding="utf-8")

    subprocess.run(["git", "init"], cwd=repo, check=True, capture_output=True)
    subprocess.run(["git", "config", "user.email", "test@example.com"], cwd=repo, check=True)
    subprocess.run(["git", "config", "user.name", "Test"], cwd=repo, check=True)
    subprocess.run(["git", "add", "config/candidate_profile.yaml"], cwd=repo, check=True)
    subprocess.run(["git", "commit", "-m", "profile"], cwd=repo, check=True, capture_output=True)

    profile_path.write_text('name: "Old"\ntarget_titles:\n  - "Old Role"\n', encoding="utf-8")
    original_locator = SERVER._job_leads_tool_dir_required
    SERVER._job_leads_tool_dir_required = lambda: str(repo)
    try:
        handler = FakeHandler()
        handler._jl_reset_profile()
    finally:
        SERVER._job_leads_tool_dir_required = original_locator

    assert handler.response["status"] == 200, json.dumps(handler.response)
    assert handler.response["data"]["source"] == "committed-default"
    assert handler.response["data"]["profile"]["target_titles"] == ["Data Analyst"]
    assert profile_path.read_text(encoding="utf-8") == committed

print("Profile reset regression test passed.")
